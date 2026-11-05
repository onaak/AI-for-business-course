// D3 Apply the adaptation operations in code. Origin is computed by comparing
// text with the template. The model's own statement about what it changed is not trusted.
import type { P2Output } from '../schemas';
import type { DataPack, HazardList, Lang, Origin, Sja, SjaLine, SjaLineLang, Template, TemplateLine } from '../types';
import { fillParams, makeFlag } from '../util';
import { deriveState } from '../verification';
import { findSourceTerms } from './glossary';
import { isSupported } from './languages';

export function supportedLangs(sja: Pick<Sja, 'languages'>, pack: DataPack): Lang[] {
  return sja.languages.filter((l) => isSupported(l, pack)) as Lang[];
}

/** The template lines in today's SJA: product lines only for the products the foreman picked (K1). */
export function templateLinesFor(template: Template, products: string[] | undefined): TemplateLine[] {
  const picked = new Set(products ?? []);
  return template.lines.filter((tl) => !tl.onlyWithProduct || picked.has(tl.onlyWithProduct));
}

export function changedParameters(template: Template, values: Record<string, number | string>): string[] {
  return template.parameters.filter((p) => values[p.key] !== undefined && values[p.key] !== p.default).map((p) => p.key);
}

export function pendingLang(): SjaLineLang {
  return { text: '', source: 'machineNew', verification: 'draft', oralFallback: false, flags: [], checkState: 'pending' };
}

function templateOrigin(tl: TemplateLine): Origin {
  return tl.parameterRefs.length > 0 ? 'parameterFilled' : 'reused';
}

function reuseTranslations(
  tl: TemplateLine,
  template: Template,
  values: Record<string, number | string>,
  langs: Lang[],
  baselineNb: string,
): Record<string, SjaLineLang> {
  const byLang: Record<string, SjaLineLang> = {};
  for (const lang of langs) {
    const stored = tl.translations[lang];
    if (!stored) {
      byLang[lang] = pendingLang(); // no stored translation: must be translated and checked
      continue;
    }
    const state = deriveState(stored.keyLanguage, tl.keyTechnical);
    byLang[lang] = {
      // Reused lines are copied byte-for-byte; parameter values are inserted by code (AC-05).
      text: fillParams(stored.text, template.parameters, values, lang),
      source: state === 'verified' ? 'verifiedReuse' : 'draftReuse',
      verification: state,
      oralFallback: false,
      flags: [],
      checkState: 'reused',
      checkedSource: baselineNb,
    };
  }
  return byLang;
}

export function lineFromTemplate(
  tl: TemplateLine,
  template: Template,
  values: Record<string, number | string>,
  langs: Lang[],
): SjaLine {
  const baselineNb = fillParams(tl.textNb, template.parameters, values, 'nb');
  const changed = changedParameters(template, values);
  const affected = [...tl.parameterRefs, ...tl.dependsOnParameters].some((k) => changed.includes(k));
  return {
    lineId: tl.lineId,
    templateLineId: tl.lineId,
    section: tl.section,
    origin: templateOrigin(tl),
    textNb: baselineNb,
    baselineNb,
    critical: tl.critical,
    addedBy: 'template',
    hazardRef: tl.sourceRef,
    techRecheck: affected ? 'open' : 'none',
    aiSuggestion: 'none',
    flags: [],
    byLang: reuseTranslations(tl, template, values, langs, baselineNb),
  };
}

export function containsCriticalTerm(textNb: string, pack: DataPack): boolean {
  return findSourceTerms(textNb, pack.glossary).some((m) => m.term.critical);
}

function pendingAll(langs: Lang[]): Record<string, SjaLineLang> {
  return Object.fromEntries(langs.map((l) => [l, pendingLang()]));
}

function aiContentFlag(lineId: string, kind: 'new' | 'changed') {
  return makeFlag({
    lineId,
    lang: 'nb',
    type: 'AI_ADDED_CONTENT',
    severity: 'amber',
    raisedBy: 'D3',
    nb:
      kind === 'new'
        ? 'KI-forslag uten kilde. Linjen finnes ikke i den kuraterte farelisten. Godta eller slett.'
        : 'KI-forslag uten kilde. Endringen har ingen referanse i farelisten. Godta eller angre.',
    en:
      kind === 'new'
        ? 'AI suggestion: no source. The line is not in the curated hazard list. Accept or delete.'
        : 'AI suggestion: no source. The change has no reference in the hazard list. Accept or revert.',
  });
}

export function criticalRemovedFlag(lineId: string) {
  return makeFlag({
    lineId,
    lang: 'nb',
    type: 'CRITICAL_LINE_REMOVED',
    severity: 'red',
    raisedBy: 'D3',
    nb: 'En sikkerhetskritisk linje fra malen er fjernet. Gjenopprett den, eller oppgi en begrunnelse som føres i protokollen.',
    en: 'A safety-critical template line was removed. Restore it, or give a reason that goes in the record.',
  });
}

export interface ApplyResult {
  lines: SjaLine[];
  warnings: string[];
}

export function applyOperations(args: {
  template: Template;
  values: Record<string, number | string>;
  operations: P2Output['operations'];
  hazards: HazardList | undefined;
  pack: DataPack;
  langs: Lang[];
  products?: string[];
}): ApplyResult {
  const { template, values, operations, hazards, pack, langs } = args;
  const lines = templateLinesFor(template, args.products).map((tl) => lineFromTemplate(tl, template, values, langs));
  const warnings: string[] = [];
  const hazardById = new Map((hazards?.entries ?? []).map((h) => [h.hazardId, h]));
  let added = 0;

  for (const op of operations) {
    if (op.op === 'keep' || op.op === 'fill_parameter') continue;

    if (op.op === 'add') {
      const text = (op.text ?? '').trim();
      if (!text) {
        warnings.push('add without text ignored');
        continue;
      }
      added += 1;
      const hazard = op.hazardRef ? hazardById.get(op.hazardRef) : undefined;
      const lineId = `ny-${added}`;
      const line: SjaLine = {
        lineId,
        templateLineId: null,
        section: op.section ?? hazard?.section ?? 'controls',
        origin: 'new',
        textNb: text,
        baselineNb: null,
        critical: Boolean(hazard?.critical) || Boolean(op.critical) || containsCriticalTerm(text, pack),
        addedBy: 'ai',
        hazardRef: hazard ? hazard.hazardId : null,
        techRecheck: 'none',
        aiSuggestion: hazard ? 'none' : 'open',
        flags: hazard ? [] : [aiContentFlag(lineId, 'new')],
        byLang: pendingAll(langs),
      };
      const afterIdx = op.afterLineId ? lines.findIndex((l) => l.lineId === op.afterLineId) : -1;
      if (afterIdx >= 0) lines.splice(afterIdx + 1, 0, line);
      else {
        const lastInSection = lines.map((l) => l.section).lastIndexOf(line.section);
        lines.splice(lastInSection >= 0 ? lastInSection + 1 : lines.length, 0, line);
      }
      continue;
    }

    const line = lines.find((l) => l.lineId === op.lineId);
    if (!line) {
      warnings.push(`${op.op}: unknown line "${op.lineId ?? ''}" ignored`);
      continue;
    }

    if (op.op === 'modify') {
      const text = (op.text ?? '').trim();
      // The code compares text. A "modify" that returns the template text is a kept line.
      if (!text || text === line.baselineNb) continue;
      const hazard = op.hazardRef ? hazardById.get(op.hazardRef) : undefined;
      line.textNb = text;
      line.origin = 'changed';
      line.critical = line.critical || Boolean(hazard?.critical) || containsCriticalTerm(text, pack);
      line.byLang = pendingAll(langs);
      if (hazard) line.hazardRef = hazard.hazardId;
      else {
        line.aiSuggestion = 'open';
        line.flags.push(aiContentFlag(line.lineId, 'changed'));
      }
      continue;
    }

    if (op.op === 'remove') {
      line.origin = 'removed';
      if (line.critical) line.flags.push(criticalRemovedFlag(line.lineId));
    }
  }
  return { lines, warnings };
}

/** Recompute a line after an edit by a person. Origin always comes from the text comparison. */
export function setLineText(
  line: SjaLine,
  text: string,
  template: Template,
  values: Record<string, number | string>,
  langs: Lang[],
  pack: DataPack,
): void {
  const trimmed = text.trim();
  if (trimmed === line.textNb) return;
  line.textNb = trimmed;
  line.plainSuggestion = undefined;
  // Source flags described the old wording.
  for (const f of line.flags) {
    if (f.type === 'SOURCE_AMBIGUOUS' && f.status === 'open') {
      f.status = 'resolved';
      f.route = 'rewrite';
      f.resolvedBy = 'foreman';
    }
  }
  const tl = template.lines.find((l) => l.lineId === line.templateLineId);
  if (tl && line.baselineNb !== null && trimmed === line.baselineNb) {
    line.origin = templateOrigin(tl);
    line.critical = tl.critical;
    line.byLang = reuseTranslations(tl, template, values, langs, line.baselineNb);
    return;
  }
  line.origin = line.templateLineId ? 'changed' : 'new';
  line.critical = Boolean(tl?.critical) || line.critical || containsCriticalTerm(trimmed, pack);
  // Old target texts no longer match the source: mark every language for a new check.
  for (const lang of langs) {
    const prev = line.byLang[lang];
    line.byLang[lang] = { ...pendingLang(), flags: (prev?.flags ?? []).filter((f) => f.status === 'resolved') };
  }
}
