// D1 Glossary check (specification F-07 step 2; plan SC-07).
// Pure functions. No model, no network.
import type { DataPack, Flag, GlossaryTerm } from '../types';
import { escapeRegExp, makeFlag, norm } from '../util';

export interface TermMatch {
  term: GlossaryTerm;
  form: string;
  start: number;
  end: number;
}

/**
 * Find glossary terms in a Norwegian line. Forms are matched as substrings, so
 * compounds are found ("stillas" inside "rullestillas"). A form written "=bas"
 * matches the whole word only. A match that lies inside a longer match of another
 * term is dropped ("kran" inside "kranfører").
 */
export function findSourceTerms(sourceNb: string, glossary: GlossaryTerm[]): TermMatch[] {
  const text = norm(sourceNb);
  const all: TermMatch[] = [];
  for (const term of glossary) {
    for (const rawForm of term.nbForms) {
      const whole = rawForm.startsWith('=');
      const form = norm(whole ? rawForm.slice(1) : rawForm);
      if (!form) continue;
      const re = whole
        ? new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(form)}(?![\\p{L}\\p{N}])`, 'gu')
        : new RegExp(escapeRegExp(form), 'gu');
      for (const m of text.matchAll(re)) {
        all.push({ term, form, start: m.index, end: m.index + form.length });
      }
    }
  }
  const kept = all.filter(
    (m) =>
      !all.some(
        (o) =>
          o.term.termId !== m.term.termId &&
          o.start <= m.start &&
          o.end >= m.end &&
          o.end - o.start > m.end - m.start,
      ),
  );
  const seen = new Set<string>();
  return kept
    .sort((a, b) => a.start - b.start)
    .filter((m) => (seen.has(m.term.termId) ? false : (seen.add(m.term.termId), true)));
}

/** A stem matches at the start of a word. "a|b" accepts either alternative. */
export function stemPresent(targetText: string, stemSpec: string): boolean {
  const text = norm(targetText);
  return stemSpec
    .split('|')
    .map((s) => norm(s.trim()))
    .filter(Boolean)
    .some((alt) => new RegExp(`(?<![\\p{L}])${escapeRegExp(alt)}`, 'u').test(text));
}

/** Derive stems from an approved term (SC-07). Editable afterwards in the review screen. */
export function deriveStems(approved: string): string[] {
  const words = norm(approved.replace(/\([^)]*\)/g, ' '))
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);
  return words.map((w) => (w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2))));
}

export function checkGlossary(args: {
  lineId: string;
  source: string;
  target: string;
  lang: string;
  pack: DataPack;
}): Flag[] {
  const { lineId, source, target, lang, pack } = args;
  const flags: Flag[] = [];
  for (const { term } of findSourceTerms(source, pack.glossary)) {
    const entry = term.byLang[lang as keyof typeof term.byLang];
    if (!entry) continue;
    const forbiddenFound = entry.forbidden.find((f) => stemPresent(target, f));
    if (forbiddenFound) {
      flags.push(
        makeFlag({
          lineId,
          lang,
          type: 'FORBIDDEN_TERM',
          severity: 'red',
          raisedBy: 'D1',
          termId: term.termId,
          nb: `Oversettelsen bruker et ord som ordlisten markerer som feil for «${term.nbForms[0].replace(/^=/, '')}» (${term.conceptEn}).`,
          en: `The translation uses a word the glossary lists as wrong for "${term.conceptEn}".`,
          evidence: { source, target, expected: entry.approved, found: forbiddenFound },
        }),
      );
      continue;
    }
    const missing = entry.stems.filter((s) => !stemPresent(target, s));
    if (missing.length > 0) {
      flags.push(
        makeFlag({
          lineId,
          lang,
          type: 'GLOSSARY_MISMATCH',
          severity: term.critical ? 'red' : 'amber',
          raisedBy: 'D1',
          termId: term.termId,
          nb: `Fant ikke det godkjente ordet for «${term.nbForms[0].replace(/^=/, '')}» (${term.conceptEn}) i oversettelsen.`,
          en: `The approved term for "${term.conceptEn}" was not found in the translation.`,
          evidence: { source, target, expected: entry.approved },
        }),
      );
    }
  }
  return flags;
}

/** Glossary entries that apply to a Norwegian line, for the translation prompt (P4). */
export function glossaryForLine(sourceNb: string, lang: string, pack: DataPack) {
  return findSourceTerms(sourceNb, pack.glossary)
    .map(({ term }) => {
      const entry = term.byLang[lang as keyof typeof term.byLang];
      return entry ? { nb: term.nbForms[0].replace(/^=/, ''), approved: entry.approved, definition: term.definition } : null;
    })
    .filter((x): x is { nb: string; approved: string; definition: string } => x !== null);
}
