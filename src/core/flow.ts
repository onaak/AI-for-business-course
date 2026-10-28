// The foreman flow as a set of use cases. Each function takes an SJA and returns a
// new one. No interface code and no network code here: model calls go through the
// client object that is passed in (architectural rule 1), so tests pass a fake one.
import { activeLines, allFlags, allowedRoutes, findFlag, routeDisabled } from './flags';
import { checkLineRules } from './pipeline/checkLine';
import { translateAndCheck } from './pipeline/translate';
import { applyOperations, criticalRemovedFlag, lineFromTemplate, pendingLang, setLineText, supportedLangs, templateLinesFor } from './rules/diff';
import { canSign, deriveStatus, hasFallback } from './rules/gate';
import { isSupported, unsupportedFlag } from './rules/languages';
import { exactMatch } from './rules/memory';
import { checkNumbers } from './rules/numbers';
import { buildP1, buildP2, buildP3 } from './rules/payload';
import { initUnderstanding, isComplete, NO_CHECK, recordWorker, type WorkerCheck } from './rules/understanding';
import type { P1Output, P2Output, P3Output, P7Input, P7Output } from './schemas';
import type {
  DataPack,
  Flag,
  HazardList,
  Lang,
  LogEvent,
  ModelCall,
  ModelClient,
  ReviewerSession,
  Route,
  Section,
  Sja,
  SjaLine,
  Task,
  Template,
  TraceEntry,
} from './types';
import { clone, makeFlag, mapLimit, nowIso, uid } from './util';

export type LogInput = Omit<LogEvent, 'eventId' | 'runId' | 'at' | 'arm' | 'packVersion' | 'testId'>;
export type TraceInput = Omit<TraceEntry, 'seq' | 'at'>;

export interface FlowCtx {
  pack: DataPack;
  template: Template;
  hazards?: HazardList;
  client: ModelClient;
  log: (e: LogInput) => void;
  trace: (e: TraceInput) => void;
  onProgress?: (done: number, total: number) => void;
}

export const MAX_CLARIFYING_QUESTIONS = 3;
const PARALLEL_CALLS = 6;

// ---------- helpers ----------

const isSigned = (sja: Pick<Sja, 'status'>) => sja.status === 'signed' || sja.status === 'signedWithFallback';

function finish(ctx: FlowCtx, sja: Sja): Sja {
  // Once signed, what was recorded about understanding stays as it was (a reviewer may still decide a flag afterwards).
  if (!isSigned(sja)) {
    sja.understanding = initUnderstanding(sja, ctx.template);
    sja.understanding.completed = isComplete(sja.understanding);
  }
  sja.status = deriveStatus(sja, ctx.pack);
  return sja;
}

function noteCall(sja: Sja, call: ModelCall) {
  sja.versions.prompts[call.task] = call.promptVersion;
  sja.versions.models[call.task] = call.model;
  sja.versions.mode = call.mode;
  const origin = call.mode === 'replay' ? `replay:${call.fixtureOrigin ?? 'recorded'}` : call.mode;
  if (!sja.versions.fixtureOrigins.includes(origin)) sja.versions.fixtureOrigins.push(origin);
}

/** Wraps the model client so that every call, including a failed one, lands in the trace and the log. */
function tracing(ctx: FlowCtx, sja: Sja, step: string, lineId?: string, lang?: string): ModelClient {
  return {
    async call<T>(task: Task, input: unknown, meta: { runId: string }) {
      const started = Date.now();
      try {
        const res = await ctx.client.call<T>(task, input, meta);
        noteCall(sja, res.call);
        ctx.trace({ kind: 'model', step, title: `${task} ${TASK_TITLES[task]}`, detail: lineId ? `${lineId}${lang ? ` → ${lang}` : ''}` : undefined, call: res.call });
        ctx.log({
          actor: 'ai',
          type: 'model_call',
          step,
          durationMs: res.call.durationMs,
          lineId,
          languagePair: lang ? `nb-${lang}` : undefined,
          promptVersion: res.call.promptVersion,
          modelId: res.call.model,
        });
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.trace({ kind: 'system', step, title: `${task} failed`, detail: `${lineId ?? ''} ${lang ?? ''} ${message}`.trim() });
        ctx.log({ actor: 'system', type: 'model_error', step, durationMs: Date.now() - started, lineId, languagePair: lang ? `nb-${lang}` : undefined });
        throw err;
      }
    },
  };
}

export const TASK_TITLES: Record<Task, string> = {
  P1: 'Normalise the foreman’s text',
  P2: 'Adapt the template',
  P3: 'Check the source for ambiguity',
  P4: 'Translate',
  P5: 'Back-translate (target text only)',
  P6: 'Compare original with back-translation',
  P7: 'Translate a worker’s written explanation for the foreman',
};

function logFlags(ctx: FlowCtx, flags: Flag[], step: string) {
  for (const f of flags) {
    ctx.log({ actor: 'system', type: 'flag_raised', step, lineId: f.lineId, languagePair: f.lang === 'nb' ? 'nb' : `nb-${f.lang}`, flagType: f.type });
  }
}

function getLine(sja: Sja, lineId: string): SjaLine {
  const line = sja.lines.find((l) => l.lineId === lineId);
  if (!line) throw new Error(`Unknown line ${lineId}`);
  return line;
}

// ---------- step 1: job ----------

export interface SjaInit {
  header: Sja['header'];
  parameterValues: Record<string, number | string>;
  freeText: string;
  languages: string[];
  crewFlags: Sja['crewFlags'];
  /** Products for today's job (K1). Only offered for templates that list products. */
  products?: string[];
  testId?: string;
  fixtureId?: string;
  /** Made in the clean view: kept out of everything that feeds back into the templates. */
  cleanView?: boolean;
}

export function createSja(pack: DataPack, template: Template, init: SjaInit, sjaId = uid('sja')): Sja {
  const langs = init.languages.filter((l) => isSupported(l, pack)) as Lang[];
  const sja: Sja = {
    sjaId,
    templateId: template.templateId,
    packVersion: pack.version,
    packHash: pack.hash,
    createdAt: nowIso(),
    testId: init.testId,
    fixtureId: init.fixtureId,
    ...(init.cleanView ? { cleanView: true } : {}),
    header: init.header,
    parameterValues: init.parameterValues,
    freeText: init.freeText.slice(0, 600),
    specifics: [],
    questions: [],
    questionsAsked: 0,
    specificsConfirmed: false,
    languages: init.languages,
    crewFlags: init.crewFlags,
    ...(init.products?.length ? { products: [...init.products] } : {}),
    lines: templateLinesFor(template, init.products).map((tl) => lineFromTemplate(tl, template, init.parameterValues, langs)),
    sjaFlags: [],
    contentConfirmed: false,
    languageCheckDone: false,
    understanding: { ...NO_CHECK, teachBack: { ok: 0, rebriefed: 0 }, misunderstood: [] },
    step: 1,
    status: 'draft',
    versions: { prompts: {}, models: {}, mode: '', fixtureOrigins: [] },
    assists: 0,
  };
  return sja;
}

// ---------- step 2: understood (P1) ----------

export async function runNormalise(ctx: FlowCtx, sja: Sja): Promise<Sja> {
  const next = clone(sja);
  next.specificsConfirmed = false;
  if (!next.freeText.trim()) {
    next.specifics = [];
    next.questions = [];
    ctx.trace({ kind: 'system', step: 'understood', title: 'P1 skipped', detail: 'No free-text specifics were entered.' });
    next.step = 2;
    return next;
  }
  const client = tracing(ctx, next, 'understood');
  const { parsed } = await client.call<P1Output>('P1', buildP1(next, ctx.template), { runId: next.sjaId });
  next.specifics = parsed.specifics;
  // No more than three clarifying questions per SJA (8.4).
  const room = Math.max(0, MAX_CLARIFYING_QUESTIONS - next.questionsAsked);
  const fresh = parsed.questions.slice(0, room).map((q) => ({ id: uid('q'), question: q.question, options: q.options ?? [] }));
  next.questionsAsked += fresh.length;
  next.questions = [...next.questions.filter((q) => q.answer), ...fresh];
  if (fresh.length) ctx.log({ actor: 'ai', type: 'clarifying_questions', step: 'understood', count: fresh.length });
  next.step = 2;
  return next;
}

export function answerQuestion(sja: Sja, questionId: string, answer: string): Sja {
  const next = clone(sja);
  const q = next.questions.find((x) => x.id === questionId);
  if (q) q.answer = answer.trim() || undefined;
  return next;
}

/** The foreman wants to answer the clarifying questions again: the answers are cleared, the questions come back. */
export function clearAnswers(sja: Sja): Sja {
  const next = clone(sja);
  for (const q of next.questions) q.answer = undefined;
  return next;
}

export function removeSpecific(ctx: FlowCtx, sja: Sja, index: number): Sja {
  const next = clone(sja);
  next.specifics.splice(index, 1);
  ctx.log({ actor: 'foreman', type: 'specific_removed', step: 'understood' });
  ctx.trace({ kind: 'human', step: 'understood', title: 'Foreman removed a detail' });
  return next;
}

/** The flow does not continue on a guess: open questions and unclear details block. */
export function specificsBlockers(sja: Sja): { openQuestions: number; unclear: number } {
  return {
    openQuestions: sja.questions.filter((q) => !q.answer).length,
    unclear: sja.specifics.filter((s) => s.status === 'unclear').length,
  };
}

// ---------- step 3: content (P2, D3, P3) ----------

export async function runAdapt(ctx: FlowCtx, sja: Sja): Promise<Sja> {
  const blockers = specificsBlockers(sja);
  if (blockers.openQuestions || blockers.unclear) throw new Error('Clarifying questions or unclear details are still open.');
  let next = clone(sja);
  const langs = supportedLangs(next, ctx.pack);
  const baseline = templateLinesFor(ctx.template, next.products).map((tl) => lineFromTemplate(tl, ctx.template, next.parameterValues, langs));
  ctx.log({ actor: 'foreman', type: 'specifics_confirmed', step: 'understood', count: next.specifics.length });
  ctx.trace({ kind: 'human', step: 'understood', title: 'Foreman confirmed what was understood', data: next.specifics });

  let operations: P2Output['operations'] = [];
  if (next.specifics.some((s) => s.status === 'clear')) {
    const client = tracing(ctx, next, 'content');
    const res = await client.call<P2Output>('P2', buildP2(next, ctx.template, baseline, ctx.hazards), { runId: next.sjaId });
    operations = res.parsed.operations;
  } else {
    ctx.trace({ kind: 'system', step: 'content', title: 'P2 skipped', detail: 'No specifics: every template line is kept.' });
  }

  const applied = applyOperations({
    template: ctx.template,
    values: next.parameterValues,
    operations,
    hazards: ctx.hazards,
    pack: ctx.pack,
    langs,
    products: next.products,
  });
  next.lines = applied.lines;
  next.specificsConfirmed = true;
  next.contentConfirmed = false;
  next.languageCheckDone = false;
  next.sjaFlags = [];
  const counts = originCounts(next);
  ctx.trace({
    kind: 'rule',
    step: 'content',
    title: 'D3 applied the operations and computed origins by text comparison',
    detail: `reused ${counts.reused}, parameter filled ${counts.parameterFilled}, changed ${counts.changed}, new ${counts.new}, removed ${counts.removed}`,
    data: { operations, warnings: applied.warnings, techRecheck: next.lines.filter((l) => l.techRecheck === 'open').map((l) => l.lineId) },
  });
  ctx.log({ actor: 'system', type: 'adapted', step: 'content', count: next.lines.length });
  logFlags(ctx, next.lines.flatMap((l) => l.flags), 'content');
  for (const l of next.lines.filter((x) => x.techRecheck === 'open')) {
    ctx.log({ actor: 'system', type: 'flag_raised', step: 'content', lineId: l.lineId, flagType: 'TECH_RECHECK' });
  }
  next = await runAmbiguity(ctx, next);
  next.step = 3;
  return finish(ctx, next);
}

export function originCounts(sja: Pick<Sja, 'lines'>) {
  const c = { reused: 0, parameterFilled: 0, changed: 0, new: 0, removed: 0 };
  for (const l of sja.lines) c[l.origin] += 1;
  return c;
}

/** P3 on new and changed Norwegian lines, before any translation of them (F-05, AC-07). One call per line. */
export async function runAmbiguity(ctx: FlowCtx, sja: Sja, onlyLineIds?: string[]): Promise<Sja> {
  const next = clone(sja);
  const targets = activeLines(next).filter(
    (l) =>
      (l.origin === 'changed' || l.origin === 'new') &&
      l.ambiguityCheckedNb !== l.textNb &&
      (!onlyLineIds || onlyLineIds.includes(l.lineId)),
  );
  await mapLimit(targets, PARALLEL_CALLS, async (line) => {
    const client = tracing(ctx, next, 'content', line.lineId);
    try {
      const { parsed } = await client.call<P3Output>('P3', buildP3([line]), { runId: next.sjaId });
      const res = parsed.lines.find((r) => r.lineId === line.lineId) ?? parsed.lines[0];
      line.ambiguityCheckedNb = line.textNb;
      line.plainSuggestion = res?.plain && res.plain.trim() !== line.textNb ? res.plain.trim() : undefined;
      if (res?.status === 'ambiguous') {
        const flag = makeFlag({
          lineId: line.lineId,
          lang: 'nb',
          type: 'SOURCE_AMBIGUOUS',
          severity: 'amber',
          raisedBy: 'P3',
          nb: res.reasonNb ?? 'Den norske teksten kan ikke oversettes eller følges trygt slik den står.',
          en: res.reasonEn ?? 'The Norwegian cannot be translated or acted on safely as written.',
          evidence: { source: line.textNb, suggestion: res.suggestion },
        });
        line.flags.push(flag);
        logFlags(ctx, [flag], 'content');
      }
    } catch (err) {
      // Nothing is silently skipped: the line stays unchecked and blocks confirmation.
      line.ambiguityCheckedNb = undefined;
      const flag = makeFlag({
        lineId: line.lineId,
        lang: 'nb',
        type: 'SOURCE_AMBIGUOUS',
        severity: 'red',
        raisedBy: 'P3',
        nb: `Tvetydighetskontrollen kunne ikke kjøres for denne linjen. Prøv igjen. (${err instanceof Error ? err.message : String(err)})`,
        en: `The ambiguity check could not run for this line. Try again. (${err instanceof Error ? err.message : String(err)})`,
        evidence: { source: line.textNb },
      });
      flag.reason = 'model_error';
      line.flags = line.flags.filter((f) => f.reason !== 'model_error');
      line.flags.push(flag);
    }
  });
  return next;
}

export interface ContentBlockers {
  aiSuggestions: number;
  techRecheck: number;
  ambiguousCritical: number;
  criticalRemoved: number;
  checkErrors: number;
}

export function contentBlockers(sja: Sja): ContentBlockers {
  const lines = activeLines(sja);
  return {
    aiSuggestions: lines.filter((l) => l.aiSuggestion === 'open').length,
    techRecheck: lines.filter((l) => l.techRecheck === 'open').length,
    ambiguousCritical: lines.filter((l) => l.critical && l.flags.some((f) => f.type === 'SOURCE_AMBIGUOUS' && f.status === 'open' && f.reason !== 'model_error')).length,
    criticalRemoved: sja.lines.filter((l) => l.flags.some((f) => f.type === 'CRITICAL_LINE_REMOVED' && f.status === 'open')).length,
    checkErrors: lines.filter((l) => l.flags.some((f) => f.reason === 'model_error' && f.status === 'open')).length,
  };
}

function touched(ctx: FlowCtx, sja: Sja): Sja {
  // Any edit to the Norwegian after confirmation re-opens the content review.
  if (sja.step <= 3) sja.contentConfirmed = false;
  return finish(ctx, sja);
}

export function editLine(ctx: FlowCtx, sja: Sja, lineId: string, text: string): Sja {
  const next = clone(sja);
  const line = getLine(next, lineId);
  line.flags = line.flags.filter((f) => f.reason !== 'model_error');
  setLineText(line, text, ctx.template, next.parameterValues, supportedLangs(next, ctx.pack), ctx.pack);
  if (line.techRecheck === 'open') line.techRecheck = 'confirmed'; // editing a marked line counts as handling it
  ctx.log({ actor: 'foreman', type: 'line_edited', step: 'content', lineId });
  ctx.trace({ kind: 'human', step: 'content', title: 'Foreman edited a Norwegian line', detail: lineId, data: { text: line.textNb, origin: line.origin } });
  return touched(ctx, next);
}

export function addLine(ctx: FlowCtx, sja: Sja, section: Section, text: string): Sja {
  const next = clone(sja);
  const lineId = `egen-${next.lines.filter((l) => l.addedBy === 'foreman').length + 1}`;
  const langs = supportedLangs(next, ctx.pack);
  const line: SjaLine = {
    lineId,
    templateLineId: null,
    section,
    origin: 'new',
    textNb: text.trim(),
    baselineNb: null,
    critical: true, // a line the foreman adds by hand is treated as safety-critical
    addedBy: 'foreman',
    hazardRef: null,
    techRecheck: 'none',
    aiSuggestion: 'none',
    flags: [],
    byLang: Object.fromEntries(langs.map((l) => [l, pendingLang()])),
  };
  const last = next.lines.map((l) => l.section).lastIndexOf(section);
  next.lines.splice(last >= 0 ? last + 1 : next.lines.length, 0, line);
  ctx.log({ actor: 'foreman', type: 'line_added', step: 'content', lineId });
  ctx.trace({ kind: 'human', step: 'content', title: 'Foreman added a line', detail: lineId, data: { text: line.textNb } });
  return touched(ctx, next);
}

export function removeLine(ctx: FlowCtx, sja: Sja, lineId: string): Sja {
  const next = clone(sja);
  const line = getLine(next, lineId);
  if (!line.templateLineId) {
    next.lines = next.lines.filter((l) => l.lineId !== lineId);
  } else {
    line.origin = 'removed';
    if (line.critical && !line.flags.some((f) => f.type === 'CRITICAL_LINE_REMOVED' && f.status === 'open')) {
      const flag = criticalRemovedFlag(lineId);
      line.flags.push(flag);
      logFlags(ctx, [flag], 'content');
    }
  }
  ctx.log({ actor: 'foreman', type: 'line_removed', step: 'content', lineId });
  ctx.trace({ kind: 'human', step: 'content', title: 'Foreman removed a line', detail: lineId });
  return touched(ctx, next);
}

export function restoreLine(ctx: FlowCtx, sja: Sja, lineId: string): Sja {
  const next = clone(sja);
  const idx = next.lines.findIndex((l) => l.lineId === lineId);
  const tl = ctx.template.lines.find((l) => l.lineId === next.lines[idx]?.templateLineId);
  if (idx < 0 || !tl) return next;
  const fresh = lineFromTemplate(tl, ctx.template, next.parameterValues, supportedLangs(next, ctx.pack));
  const old = next.lines[idx];
  fresh.flags = old.flags.map((f) =>
    f.type === 'CRITICAL_LINE_REMOVED' && f.status === 'open'
      ? { ...f, status: 'resolved' as const, resolvedBy: 'foreman' as const, resolvedAt: nowIso(), reason: 'restored' }
      : f,
  );
  if (old.techRecheck === 'confirmed') fresh.techRecheck = 'confirmed';
  next.lines[idx] = fresh;
  ctx.log({ actor: 'foreman', type: 'line_restored', step: 'content', lineId });
  ctx.trace({ kind: 'human', step: 'content', title: 'Foreman restored a template line', detail: lineId });
  return touched(ctx, next);
}

export function giveRemovalReason(ctx: FlowCtx, sja: Sja, lineId: string, reason: string): Sja {
  const next = clone(sja);
  const line = getLine(next, lineId);
  if (!reason.trim()) return next;
  line.removalReason = reason.trim();
  for (const f of line.flags) {
    if (f.type === 'CRITICAL_LINE_REMOVED' && f.status === 'open') {
      f.status = 'resolved';
      f.resolvedBy = 'foreman';
      f.resolvedAt = nowIso();
      f.reason = reason.trim();
    }
  }
  ctx.log({ actor: 'foreman', type: 'removal_reason_given', step: 'content', lineId, flagType: 'CRITICAL_LINE_REMOVED' });
  ctx.trace({ kind: 'human', step: 'content', title: 'Foreman gave a reason for removing a safety-critical line', detail: lineId });
  return touched(ctx, next);
}

export function decideSuggestion(ctx: FlowCtx, sja: Sja, lineId: string, accept: boolean): Sja {
  let next = clone(sja);
  const line = getLine(next, lineId);
  const settle = (reason: string) => {
    for (const f of line.flags) {
      if (f.type === 'AI_ADDED_CONTENT' && f.status === 'open') {
        f.status = 'resolved';
        f.resolvedBy = 'foreman';
        f.resolvedAt = nowIso();
        f.reason = reason;
      }
    }
  };
  if (accept) {
    line.aiSuggestion = 'accepted';
    settle('accepted');
  } else if (line.templateLineId && line.baselineNb !== null) {
    settle('reverted');
    line.aiSuggestion = 'none';
    setLineText(line, line.baselineNb, ctx.template, next.parameterValues, supportedLangs(next, ctx.pack), ctx.pack);
  } else {
    next.lines = next.lines.filter((l) => l.lineId !== lineId);
  }
  ctx.log({ actor: 'foreman', type: accept ? 'ai_suggestion_accepted' : 'ai_suggestion_rejected', step: 'content', lineId, flagType: 'AI_ADDED_CONTENT' });
  ctx.trace({ kind: 'human', step: 'content', title: accept ? 'Foreman accepted an AI suggestion' : 'Foreman rejected an AI suggestion', detail: lineId });
  next = touched(ctx, next);
  return next;
}

export function confirmTechRecheck(ctx: FlowCtx, sja: Sja, lineId: string): Sja {
  const next = clone(sja);
  const line = getLine(next, lineId);
  if (line.techRecheck === 'open') {
    line.techRecheck = 'confirmed';
    ctx.log({ actor: 'foreman', type: 'tech_recheck_confirmed', step: 'content', lineId, flagType: 'TECH_RECHECK' });
    ctx.trace({ kind: 'human', step: 'content', title: 'Foreman confirmed a technical re-check marker', detail: lineId });
  }
  return finish(ctx, next);
}

export function acknowledgeSourceFlag(ctx: FlowCtx, sja: Sja, flagId: string, reason: string): Sja {
  return applyRouteSync(ctx, sja, flagId, 'acknowledged', reason);
}

/** The foreman confirms the Norwegian content as a whole. Translation starts only after this (SC-02). */
export async function confirmContent(ctx: FlowCtx, sja: Sja): Promise<Sja> {
  const next = await runAmbiguity(ctx, sja);
  const b = contentBlockers(next);
  if (b.aiSuggestions || b.techRecheck || b.ambiguousCritical || b.criticalRemoved || b.checkErrors) {
    return finish(ctx, next);
  }
  next.contentConfirmed = true;
  next.step = 4;
  ctx.log({ actor: 'foreman', type: 'content_confirmed', step: 'content' });
  ctx.trace({ kind: 'human', step: 'content', title: 'Foreman confirmed the Norwegian content', detail: 'Technical correctness for today’s job. Separate from the language check.' });
  return finish(ctx, next);
}

// ---------- step 4: language check (P4, D1, D2, P5, P6) ----------

async function translateOne(
  ctx: FlowCtx,
  sja: Sja,
  line: SjaLine,
  lang: string,
  opts: { enforce: boolean; attempt: number },
): Promise<Flag[]> {
  const prev = line.byLang[lang] ?? pendingLang();
  const kept = prev.flags.filter((f) => f.status === 'resolved');
  const client = tracing(ctx, sja, 'languageCheck', line.lineId, lang);
  try {
    const r = await translateAndCheck(
      client,
      ctx.pack,
      { lineId: line.lineId, source: line.textNb, lang, critical: line.critical, enforce: opts.enforce, attempt: opts.attempt },
      { runId: sja.sjaId },
    );
    line.byLang[lang] = {
      text: r.text,
      source: 'machineNew',
      verification: 'draft',
      oralFallback: false,
      flags: [...kept, ...r.flags],
      checkState: 'checked',
      checkedSource: line.textNb,
      backTranslation: r.backTranslation,
      missingConcepts: r.missingConcepts,
    };
    ctx.trace({
      kind: 'rule',
      step: 'languageCheck',
      title: 'Deterministic checks D4, D1, D2',
      detail: `${line.lineId} → ${lang}: ${r.rules.map((x) => `${x.rule} ${x.flags}`).join(', ')}`,
      data: { flags: r.flags.map((f) => ({ type: f.type, raisedBy: f.raisedBy, severity: f.severity })) },
    });
    logFlags(ctx, r.flags, 'languageCheck');
    return r.flags;
  } catch (err) {
    // One retry happened on the server. The line stays unchecked and blocking (7.3, AC-28).
    line.byLang[lang] = { ...prev, flags: prev.flags, checkState: 'error', error: err instanceof Error ? err.message : String(err) };
    return [];
  }
}

export async function runLanguageCheck(ctx: FlowCtx, sja: Sja): Promise<Sja> {
  const next = clone(sja);
  const started = Date.now();
  const langs = supportedLangs(next, ctx.pack);

  // D4: no worker-facing text for an unsupported language. The record says "interpreter required".
  for (const lang of next.languages.filter((l) => !isSupported(l, ctx.pack))) {
    if (!next.sjaFlags.some((f) => f.lang === lang && f.type === 'UNSUPPORTED_LANGUAGE')) {
      const flag = unsupportedFlag(lang);
      next.sjaFlags.push(flag);
      ctx.trace({ kind: 'rule', step: 'languageCheck', title: 'D4 language not supported', detail: lang });
      logFlags(ctx, [flag], 'languageCheck');
    }
  }

  const jobs: { line: SjaLine; lang: Lang }[] = [];
  for (const line of activeLines(next)) {
    for (const lang of langs) {
      const e = line.byLang[lang];
      if (line.origin === 'parameterFilled' && e && e.checkState === 'reused' && !e.flags.some((f) => f.type === 'NUMBER_UNIT_MISMATCH')) {
        // Parameter values were inserted by code. D2 confirms they arrived unchanged.
        const flags = checkNumbers({ lineId: line.lineId, source: line.textNb, target: e.text, lang });
        e.flags.push(...flags);
        logFlags(ctx, flags, 'languageCheck');
      }
      if (line.origin !== 'changed' && line.origin !== 'new') continue;
      if (e?.oralFallback) continue;
      if (e && e.checkState === 'checked' && e.checkedSource === line.textNb) continue;
      const blockedBySource = line.critical && line.flags.some((f) => f.type === 'SOURCE_AMBIGUOUS' && f.status === 'open');
      if (blockedBySource) {
        line.byLang[lang] = { ...pendingLang(), checkState: 'blocked' };
        continue;
      }
      jobs.push({ line, lang });
    }
  }

  // L1: a line whose exact Norwegian text is already verified in this language (both keys) needs no model call.
  const fromMemory: string[] = [];
  for (let i = jobs.length - 1; i >= 0; i--) {
    const { line, lang } = jobs[i];
    const hit = exactMatch(ctx.pack, line.textNb, lang);
    if (!hit) continue;
    const re = checkLineRules({ lineId: line.lineId, source: line.textNb, target: hit.target, lang, critical: line.critical }, ctx.pack);
    line.byLang[lang] = { text: hit.target, source: 'memory', verification: 'verified', oralFallback: false, flags: re.flags, checkState: 'checked', checkedSource: line.textNb };
    logFlags(ctx, re.flags, 'languageCheck');
    fromMemory.push(`${line.lineId} → ${lang} (${hit.templateId}/${hit.lineId})`);
    jobs.splice(i, 1);
  }
  if (fromMemory.length) {
    ctx.log({ actor: 'system', type: 'translation_memory', step: 'languageCheck', count: fromMemory.length });
    ctx.trace({ kind: 'rule', step: 'languageCheck', title: 'Translation memory: verified translation reused, no model call', detail: fromMemory.join('; ') });
  }

  let done = 0;
  ctx.onProgress?.(0, jobs.length);
  await mapLimit(jobs, PARALLEL_CALLS, async ({ line, lang }) => {
    await translateOne(ctx, next, line, lang, { enforce: false, attempt: 0 });
    done += 1;
    ctx.onProgress?.(done, jobs.length);
  });

  next.languageCheckDone = true;
  ctx.log({ actor: 'system', type: 'language_check_done', step: 'languageCheck', durationMs: Date.now() - started, count: jobs.length });
  ctx.trace({
    kind: 'system',
    step: 'languageCheck',
    title: 'Language check finished',
    detail: `${jobs.length} line-language pairs translated and checked (changed and new lines only). Reused lines kept their stored translations.`,
  });
  return finish(ctx, next);
}

export async function retryLine(ctx: FlowCtx, sja: Sja, lineId: string, lang: string): Promise<Sja> {
  const next = clone(sja);
  await translateOne(ctx, next, getLine(next, lineId), lang, { enforce: false, attempt: 0 });
  return finish(ctx, next);
}

/** Oral fallback for a line that could not be checked at all (model failure). */
export function oralForLine(ctx: FlowCtx, sja: Sja, lineId: string, lang: string): Sja {
  const next = clone(sja);
  const line = getLine(next, lineId);
  const e = line.byLang[lang] ?? pendingLang();
  e.oralFallback = true;
  line.byLang[lang] = e;
  ctx.log({ actor: 'foreman', type: 'route_chosen', step: 'languageCheck', lineId, languagePair: `nb-${lang}`, route: 'oral' });
  ctx.trace({ kind: 'human', step: 'languageCheck', title: 'Foreman chose: brief this line orally', detail: `${lineId} → ${lang} (line could not be checked)` });
  return finish(ctx, next);
}

function resolve(flag: Flag, route: Route, by: Flag['resolvedBy'], reason?: string) {
  flag.status = 'resolved';
  flag.route = route;
  flag.resolvedBy = by;
  flag.resolvedAt = nowIso();
  if (reason) flag.reason = reason;
}

function applyRouteSync(ctx: FlowCtx, sja: Sja, flagId: string, route: Route, reason?: string): Sja {
  const next = clone(sja);
  const ref = findFlag(next, flagId);
  if (!ref) throw new Error('Unknown flag');
  const { flag, line, lang } = ref;
  const critical = Boolean(line?.critical);
  if (!allowedRoutes(flag, critical).includes(route) || routeDisabled(flag, route)) {
    throw new Error(`Route "${route}" is not available for this flag.`);
  }
  if (route === 'oral') {
    resolve(flag, 'oral', 'foreman');
    if (line && lang !== 'nb') {
      const e = line.byLang[lang];
      e.oralFallback = true;
      // The line is explained by a bilingual colleague, so its other flags in this language are settled the same way.
      for (const other of e.flags) if (other.status === 'open') resolve(other, 'oral', 'foreman');
    }
  } else if (route === 'reviewer') {
    flag.route = 'reviewer'; // stays open until the reviewer decides
    flag.reviewerVerdict = undefined;
  } else if (route === 'acknowledged') {
    if (!reason?.trim()) throw new Error('A reason is required.');
    resolve(flag, 'acknowledged', 'foreman', reason.trim());
  }
  ctx.log({ actor: 'foreman', type: 'route_chosen', step: 'languageCheck', lineId: flag.lineId, languagePair: lang === 'nb' ? 'nb' : `nb-${lang}`, flagType: flag.type, route });
  ctx.trace({ kind: 'human', step: 'languageCheck', title: `Foreman chose route: ${route}`, detail: `${flag.type} on ${flag.lineId} (${lang})` });
  return finish(ctx, next);
}

/**
 * The foreman picks a route for a flag. Every route works without knowledge of the
 * target language. There is no route that dismisses a red language flag.
 */
export async function applyRoute(
  ctx: FlowCtx,
  sja: Sja,
  flagId: string,
  route: Route,
  payload: { text?: string; reason?: string } = {},
): Promise<Sja> {
  if (route === 'oral' || route === 'reviewer' || route === 'acknowledged') {
    return applyRouteSync(ctx, sja, flagId, route, payload.reason);
  }
  const next = clone(sja);
  const ref = findFlag(next, flagId);
  if (!ref || !ref.line) throw new Error('Unknown flag');
  const { flag, line, lang } = ref;
  if (!allowedRoutes(flag, line.critical).includes(route) || routeDisabled(flag, route)) {
    throw new Error(`Route "${route}" is not available for this flag.`);
  }
  ctx.log({ actor: 'foreman', type: 'route_chosen', step: 'languageCheck', lineId: line.lineId, languagePair: lang === 'nb' ? 'nb' : `nb-${lang}`, flagType: flag.type, route });
  ctx.trace({ kind: 'human', step: 'languageCheck', title: `Foreman chose route: ${route}`, detail: `${flag.type} on ${line.lineId} (${lang})` });

  if (route === 'approvedTerm') {
    const attempt = flag.autoAttempts + 1;
    const before = line.byLang[lang].flags.filter((f) => f.status === 'open');
    const fresh = await translateOne(ctx, next, line, lang, { enforce: true, attempt });
    const entry = line.byLang[lang];
    if (entry.checkState === 'error') return finish(ctx, next);
    const remaining = [...fresh];
    const merged: Flag[] = [];
    for (const old of before) {
      const idx = remaining.findIndex((n) => n.type === old.type && n.termId === old.termId);
      if (idx >= 0) {
        // Still wrong after re-translation: the same flag stays open with one more attempt counted.
        const again = remaining.splice(idx, 1)[0];
        merged.push({
          ...old,
          evidence: again.evidence,
          explanation: again.explanation,
          autoAttempts: old.type === 'GLOSSARY_MISMATCH' || old.type === 'FORBIDDEN_TERM' ? attempt : old.autoAttempts,
        });
      } else {
        const done = { ...old, autoAttempts: old.flagId === flagId ? attempt : old.autoAttempts };
        resolve(done, 'approvedTerm', 'foreman');
        merged.push(done);
      }
    }
    entry.flags = [...entry.flags.filter((f) => f.status === 'resolved' && !fresh.includes(f)), ...merged, ...remaining];
    ctx.trace({
      kind: 'system',
      step: 'languageCheck',
      title: `Re-check after "use the approved term" (attempt ${attempt})`,
      detail: merged.some((f) => f.status === 'open') || remaining.length ? 'Flags remain.' : 'Clean.',
    });
    return finish(ctx, next);
  }

  // route === 'rewrite': the foreman simplifies the Norwegian; ambiguity check, then translation and check in all languages.
  const text = (payload.text ?? '').trim();
  if (!text || text === line.textNb) throw new Error('Write a new wording first.');
  const langs = supportedLangs(next, ctx.pack);
  for (const l of langs) for (const f of line.byLang[l]?.flags ?? []) if (f.status === 'open') resolve(f, 'rewrite', 'foreman');
  setLineText(line, text, ctx.template, next.parameterValues, langs, ctx.pack);
  ctx.trace({ kind: 'human', step: 'languageCheck', title: 'Foreman rewrote the Norwegian line', detail: line.lineId, data: { text } });
  const checked = await runAmbiguity(ctx, next, [line.lineId]);
  const line2 = getLine(checked, line.lineId);
  // If the new wording could not be checked at all, the rewrite is not applied: the SJA stays as it was and the
  // foreman can try again. Otherwise a failed call would leave a line that can neither be checked nor undone.
  const failed = line2.flags.find((f) => f.reason === 'model_error' && f.status === 'open');
  if (failed) throw new Error(`The new wording could not be checked, so it was not saved. ${(failed.explanation.en.match(/\((.*)\)$/)?.[1] ?? '').trim()}`.trim());
  if (line2.origin === 'changed' || line2.origin === 'new') {
    const blocked = line2.critical && line2.flags.some((f) => f.type === 'SOURCE_AMBIGUOUS' && f.status === 'open');
    if (blocked) {
      for (const l of langs) line2.byLang[l] = { ...pendingLang(), flags: line2.byLang[l]?.flags ?? [], checkState: 'blocked' };
    } else {
      await mapLimit(langs, PARALLEL_CALLS, (l) => translateOne(ctx, checked, line2, l, { enforce: false, attempt: 0 }));
    }
  }
  return finish(ctx, checked);
}

// ---------- reviewer decisions on an SJA (F-12) ----------

export function reviewerVerdict(
  ctx: FlowCtx,
  sja: Sja,
  flagId: string,
  kind: 'falseAlarm' | 'confirmed',
  reason: string,
  session: ReviewerSession,
  durationMs?: number,
): Sja {
  const next = clone(sja);
  const ref = findFlag(next, flagId);
  if (!ref) throw new Error('Unknown flag');
  if (!reason.trim()) throw new Error('A reason is required.');
  // Only a language reviewer of that language can call a language flag a false alarm (F-08).
  if (kind === 'falseAlarm' && !(session.role === 'language' && session.lang === ref.lang)) {
    throw new Error('Only a language reviewer of this language can mark a false alarm.');
  }
  ref.flag.reviewerVerdict = { kind, reason: reason.trim() };
  if (kind === 'falseAlarm') {
    resolve(ref.flag, 'reviewer', 'reviewer', reason.trim());
  } else {
    ref.flag.route = undefined; // confirmed error without a correction: back to the foreman (rewrite or oral)
  }
  ctx.log({ actor: 'reviewer', type: kind === 'falseAlarm' ? 'flag_false_alarm' : 'flag_confirmed', step: 'checking', lineId: ref.flag.lineId, languagePair: `nb-${ref.lang}`, flagType: ref.flag.type, durationMs, timeCategory: 'reviewer' });
  ctx.trace({ kind: 'human', step: 'review', title: `Reviewer verdict: ${kind}`, detail: `${ref.flag.type} on ${ref.flag.lineId} (${ref.lang}); ${session.role} reviewer, ${session.outsideGroup ? 'outside' : 'inside'} the group` });
  return finish(ctx, next);
}

/** A reviewer's correction replaces the target text, triggers a deterministic re-check and settles the old flags. */
export function reviewerCorrect(
  ctx: FlowCtx,
  sja: Sja,
  lineId: string,
  lang: string,
  text: string,
  session: ReviewerSession,
  durationMs?: number,
): Sja {
  if (!(session.role === 'language' && session.lang === lang)) throw new Error('Only a language reviewer of this language can correct the text.');
  const next = clone(sja);
  const line = getLine(next, lineId);
  const entry = line.byLang[lang];
  if (!entry || !text.trim()) throw new Error('Nothing to correct.');
  for (const f of entry.flags) {
    if (f.status === 'open') {
      f.reviewerVerdict = { kind: 'confirmed', reason: 'Corrected by the reviewer.' };
      resolve(f, 'reviewer', 'reviewer', 'corrected');
    }
  }
  const re = checkLineRules({ lineId, source: line.textNb, target: text.trim(), lang, critical: line.critical }, ctx.pack);
  entry.text = text.trim();
  entry.source = 'reviewerCorrected';
  entry.verification = 'languageChecked';
  entry.checkState = 'checked';
  entry.checkedSource = line.textNb;
  entry.error = undefined;
  entry.flags.push(...re.flags);
  ctx.log({ actor: 'reviewer', type: 'line_corrected', step: 'checking', lineId, languagePair: `nb-${lang}`, durationMs, timeCategory: 'reviewer' });
  ctx.trace({ kind: 'human', step: 'review', title: 'Reviewer corrected the target text', detail: `${lineId} → ${lang}. Deterministic re-check: ${re.flags.length} flag(s).`, data: { text: text.trim() } });
  return finish(ctx, next);
}

// ---------- step 5: understanding (D7, brief v3) ----------

/** Misunderstandings go to the anonymous log with the template line, so they can be fed back to the template. */
function misunderstandingEvent(sja: Sja, lineId: string, source: 'teachBack' | 'observation'): LogInput {
  const line = sja.lines.find((l) => l.lineId === lineId);
  return { actor: 'foreman', type: 'misunderstanding', step: source === 'observation' ? 'observation' : 'understanding', lineId: line?.templateLineId ?? 'job-specific', templateId: sja.templateId, route: source };
}

/**
 * One worker's check: the foreman's judgement of the teach-back and the worker's first
 * answer to the scenario question. `lang` is empty when the check was done orally.
 */
export function recordWorkerCheck(ctx: FlowCtx, sja: Sja, lang: string, check: WorkerCheck): Sja {
  if (isSigned(sja)) throw new Error('This SJA is signed. Workers are checked before sign-off.');
  if (!sja.understanding.required) throw new Error('An understanding check is not required for this SJA.');
  const next = clone(sja);
  const misunderstood = check.teachBack === 'rebriefed' ? [...new Set(check.misunderstood)].filter((id) => next.understanding.keyLineIds.includes(id)) : [];
  next.understanding = recordWorker(next.understanding, { ...check, misunderstood });
  const right = check.answers.filter((a) => a.correct).length;
  // The log and the trace say that a worker was checked, and by which mode. They do not say which language,
  // which outcome or which points: on a small crew that would be one person's result. The counts are in the SJA.
  const path = check.path ?? 'conversation';
  ctx.log({ actor: 'worker', type: 'respondent_done', step: 'understanding', route: lang ? 'phone' : 'oral', count: right });
  if (check.teachBack !== 'none') ctx.log({ actor: 'foreman', type: `teach_back_${check.teachBack}`, step: 'understanding' });
  for (const id of misunderstood) ctx.log(misunderstandingEvent(next, id, 'teachBack'));
  ctx.trace({
    kind: 'human',
    step: 'understanding',
    title:
      path === 'conversation'
        ? 'A worker was checked: teach-back judged by the foreman, and one scenario question'
        : path === 'written'
          ? 'A worker was checked: written explanation, machine-translated and judged by the foreman, and one scenario question'
          : 'A worker was checked by multiple-choice questions only (no explanation judged)',
    detail: `${lang ? 'On the phone' : 'Orally'}. Workers checked so far: ${next.understanding.respondents}. No name and no per-person result is recorded; the counts are in the understanding section of the record.`,
  });
  next.status = deriveStatus(next, ctx.pack);
  return next;
}

/**
 * U2: a worker's written explanation, translated into Norwegian for the foreman to judge (P7).
 * The model translates only; the foreman decides. The text is not kept: the trace says that a
 * translation was made, not what it said, and the server keeps no copy outside the test bench.
 * Returns the translation for display; it is not stored in the SJA.
 */
export async function translateWorkerAnswer(ctx: FlowCtx, sja: Pick<Sja, 'sjaId'>, lang: string, items: P7Input['items']): Promise<P7Output['items']> {
  const started = Date.now();
  try {
    const res = await ctx.client.call<P7Output>('P7', { lang, items }, { runId: sja.sjaId });
    ctx.log({ actor: 'ai', type: 'model_call', step: 'understanding', durationMs: res.call.durationMs, promptVersion: res.call.promptVersion, modelId: res.call.model });
    ctx.trace({ kind: 'model', step: 'understanding', title: `P7 ${TASK_TITLES.P7}`, detail: 'A worker’s written explanation was translated into Norwegian for the foreman. The text is not kept.' });
    return res.parsed.items;
  } catch (err) {
    ctx.log({ actor: 'system', type: 'model_error', step: 'understanding', durationMs: Date.now() - started });
    ctx.trace({ kind: 'system', step: 'understanding', title: 'P7 failed', detail: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export function confirmRebrief(ctx: FlowCtx, sja: Sja, questionId: string): Sja {
  const next = clone(sja);
  const p = next.understanding.perQuestion.find((x) => x.questionId === questionId);
  if (p) p.rebriefConfirmed = true;
  next.understanding.completed = isComplete(next.understanding);
  ctx.log({ actor: 'foreman', type: 'rebrief_confirmed', step: 'understanding' });
  ctx.trace({ kind: 'human', step: 'understanding', title: 'Foreman re-briefed and confirmed with a teach-back', detail: questionId });
  next.status = deriveStatus(next, ctx.pack);
  return next;
}

/**
 * After sign-off: what the foreman saw when the job started. An empty list means nothing
 * was misunderstood. Recorded once; it does not change the signed content or the status.
 */
export function recordObservation(ctx: FlowCtx, sja: Sja, lineIds: string[], notFollowedIds: string[] = []): Sja {
  if (sja.status !== 'signed' && sja.status !== 'signedWithFallback') throw new Error('The start of the job is observed after sign-off.');
  if (sja.observation) throw new Error('The observation is already recorded.');
  const next = clone(sja);
  const known = (id: string) => next.lines.some((l) => l.lineId === id);
  const ids = [...new Set(lineIds)].filter(known);
  // I4: "understood but not followed" (e.g. protective equipment taken off) is kept apart from "misunderstood".
  const notFollowed = [...new Set(notFollowedIds)].filter(known).filter((id) => !ids.includes(id));
  next.observation = { at: nowIso(), lineIds: ids, ...(notFollowed.length ? { notFollowed } : {}) };
  ctx.log({ actor: 'foreman', type: 'start_observed', step: 'observation', count: ids.length + notFollowed.length });
  for (const id of ids) ctx.log(misunderstandingEvent(next, id, 'observation'));
  for (const id of notFollowed) {
    const line = next.lines.find((l) => l.lineId === id);
    ctx.log({ actor: 'foreman', type: 'rule_not_followed', step: 'observation', lineId: line?.templateLineId ?? 'job-specific', templateId: next.templateId, route: 'observation' });
  }
  const parts = [ids.length ? `Misunderstood: ${ids.join(', ')}.` : '', notFollowed.length ? `Understood but not followed: ${notFollowed.join(', ')}.` : ''].filter(Boolean);
  ctx.trace({ kind: 'human', step: 'observation', title: 'Foreman watched the start of the job', detail: parts.length ? `${parts.join(' ')} Logged without names and fed back to the template.` : 'Nothing was misunderstood, and the rules were followed.' });
  return next;
}

// ---------- step 6: sign (D5) ----------

export function sign(ctx: FlowCtx, sja: Sja, role: string): Sja {
  if (!canSign(sja, ctx.pack)) throw new Error('The sign-off gate is not clear.');
  const next = clone(sja);
  next.status = hasFallback(next) ? 'signedWithFallback' : 'signed';
  next.signoff = { role, at: nowIso() };
  ctx.log({ actor: 'foreman', type: 'signed', step: 'sign', route: next.status });
  ctx.trace({ kind: 'human', step: 'sign', title: `Foreman signed (${next.status})`, detail: 'A recorded confirmation. Not a legally valid signature.' });
  return next;
}

export function flagCounts(sja: Sja) {
  const refs = allFlags(sja);
  const open = refs.filter((r) => r.flag.status === 'open');
  return {
    red: open.filter((r) => r.flag.severity === 'red').length,
    amber: open.filter((r) => r.flag.severity === 'amber').length,
    total: refs.length,
  };
}
