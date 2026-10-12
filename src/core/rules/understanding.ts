// D7 Understanding-check trigger and bookkeeping (specification F-10, as changed by
// service brief v3, step 4 and "What verified means in practice").
//
// v3: understanding is "not a signature or a quiz score". Each worker explains the
// key hazard and the safety measure in their own words (teach-back) and answers ONE
// "what do you do if …" question. The foreman then watches the start of the job.
// Results are counts. No names, no per-person results.
import { activeLines } from '../flags';
import type { Question, Sja, SjaLine, Template, UnderstandingResult } from '../types';

export function understandingTrigger(sja: Pick<Sja, 'lines' | 'crewFlags'>): { required: boolean; reason: string[] } {
  const reason: string[] = [];
  if (sja.lines.some(isTodaysChange)) reason.push('criticalChanged');
  if (sja.crewFlags.newWorker) reason.push('newWorker');
  if (sja.crewFlags.firstTimeJobType) reason.push('firstTimeJobType');
  return { required: reason.length > 0, reason };
}

/** v3: one scenario question per worker (v2 asked three). */
export const QUESTIONS_PER_CHECK = 1;
/** More points than this is more than a foreman can listen for in one explanation. */
export const MAX_KEY_LINES = 5;

export const NO_CHECK: UnderstandingResult = {
  required: false,
  reason: [],
  questionIds: [],
  keyLineIds: [],
  respondents: 0,
  teachBack: { ok: 0, rebriefed: 0 },
  misunderstood: [],
  perQuestion: [],
  completed: true,
};

const isTodaysChange = (l: SjaLine) => l.origin !== 'removed' && l.critical && (l.origin === 'changed' || l.origin === 'new');

/** Pre-approved questions only. The one that tests a changed line comes first, then critical ones. */
export function selectQuestions(sja: Pick<Sja, 'lines'>, template: Template): Question[] {
  const changed = new Set(
    sja.lines.filter((l) => l.origin === 'changed' && l.templateLineId).map((l) => l.templateLineId as string),
  );
  const score = (q: Question) => (q.linkedLineIds.some((id) => changed.has(id)) ? 0 : q.critical ? 1 : 2);
  return [...template.questions].sort((a, b) => score(a) - score(b)).slice(0, QUESTIONS_PER_CHECK);
}

/**
 * What a correct explanation should cover. Today's changed or new safety-critical
 * lines are the key points. If nothing critical changed (the check is needed because
 * of a new worker or a first-time job), it is the first hazard, the lines the scenario
 * question tests and the first control.
 */
export function keyLines(sja: Pick<Sja, 'lines'>, questions: Question[]): string[] {
  const active = sja.lines.filter((l) => l.origin !== 'removed');
  const changed = active.filter(isTodaysChange);
  if (changed.length > 0) return changed.slice(0, MAX_KEY_LINES).map((l) => l.lineId);
  const linked = new Set(questions.flatMap((q) => q.linkedLineIds));
  const firstCritical = (section: SjaLine['section']) => active.find((l) => l.section === section && l.critical)?.lineId;
  const picked = new Set([firstCritical('hazards'), firstCritical('controls'), ...active.filter((l) => l.templateLineId && linked.has(l.templateLineId)).map((l) => l.lineId)]);
  return active.filter((l) => picked.has(l.lineId)).slice(0, 4).map((l) => l.lineId);
}

/** What a check covers. If this changes after workers were checked, their checks no longer cover today's SJA. */
function basisOf(sja: Pick<Sja, 'lines'>, keyLineIds: string[], questionIds: string[]): string {
  return JSON.stringify([keyLineIds.map((id) => [id, sja.lines.find((l) => l.lineId === id)?.textNb ?? '']), questionIds]);
}

const fresh = (questionId: string) => ({ questionId, respondents: 0, correctFirst: 0, rebriefConfirmed: false });

export function initUnderstanding(sja: Sja, template: Template): UnderstandingResult {
  const trigger = understandingTrigger(sja);
  if (!trigger.required) return { ...NO_CHECK, teachBack: { ok: 0, rebriefed: 0 }, misunderstood: [] };
  const prev = sja.understanding;
  const questions = selectQuestions(sja, template);
  const questionIds = questions.map((q) => q.questionId);
  const keyLineIds = keyLines(sja, questions);
  const basis = basisOf(sja, keyLineIds, questionIds);
  // A check recorded in the older format never carries over.
  const comparable = prev.required && !Array.isArray(prev.teachBack) && !prev.legacyTeachBack;
  // Workers were checked against the key lines and the question as they were then. If the foreman has since
  // changed any of them, those checks do not cover today's SJA: they are set aside and the check starts again.
  const changedSinceChecked = comparable && prev.respondents > 0 && prev.basis !== undefined && prev.basis !== basis;
  const keep = comparable && !changedSinceChecked;
  return {
    required: true,
    reason: trigger.reason,
    questionIds,
    keyLineIds,
    respondents: keep ? prev.respondents : 0,
    teachBack: keep ? { ...prev.teachBack } : { ok: 0, rebriefed: 0 },
    misunderstood: keep ? prev.misunderstood.filter((m) => keyLineIds.includes(m.lineId)).map((m) => ({ ...m })) : [],
    perQuestion: questionIds.map((id) => (keep && prev.perQuestion.find((p) => p.questionId === id)) || fresh(id)),
    completed: false,
    basis,
    ...(changedSinceChecked || (comparable && prev.recheck && prev.respondents === 0) ? { recheck: true } : {}),
  };
}

/** Complete when at least one worker has been checked and no wrong answer is waiting for a new walkthrough. */
export function isComplete(u: UnderstandingResult): boolean {
  if (!u.required) return true;
  if (u.respondents < 1) return false;
  return !u.perQuestion.some((p) => p.respondents - p.correctFirst > 0 && !p.rebriefConfirmed);
}

/** One worker's check. `misunderstood` lists the key points the worker got wrong before the new walkthrough. */
export interface WorkerCheck {
  teachBack: 'ok' | 'rebriefed';
  misunderstood: string[];
  answers: { questionId: string; correct: boolean }[];
}

/**
 * Records one worker. A worker is only recorded once the explanation is right, straight
 * away or after a new walkthrough, so a teach-back never leaves anything open. A wrong
 * answer to the scenario question does: it opens a re-brief for the foreman.
 */
export function recordWorker(u: UnderstandingResult, check: WorkerCheck): UnderstandingResult {
  const misunderstood = u.misunderstood.map((m) => ({ ...m }));
  if (check.teachBack === 'rebriefed') {
    for (const lineId of new Set(check.misunderstood)) {
      const row = misunderstood.find((m) => m.lineId === lineId);
      if (row) row.count += 1;
      else misunderstood.push({ lineId, count: 1 });
    }
  }
  // Someone has been checked again, so the note about the earlier checks being set aside has done its job.
  const { recheck: _setAside, ...rest } = u;
  const next: UnderstandingResult = {
    ...rest,
    respondents: u.respondents + 1,
    teachBack: { ok: u.teachBack.ok + (check.teachBack === 'ok' ? 1 : 0), rebriefed: u.teachBack.rebriefed + (check.teachBack === 'rebriefed' ? 1 : 0) },
    misunderstood,
    perQuestion: u.perQuestion.map((p) => {
      const a = check.answers.find((x) => x.questionId === p.questionId);
      if (!a) return p;
      return {
        ...p,
        respondents: p.respondents + 1,
        correctFirst: p.correctFirst + (a.correct ? 1 : 0),
        // A new miss re-opens the re-brief.
        rebriefConfirmed: a.correct ? p.rebriefConfirmed : false,
      };
    }),
  };
  next.completed = isComplete(next);
  return next;
}

/** The start of the job is observed for every SJA that needed the v3 check. Runs signed before v3 are left as they were. */
export function needsObservation(sja: Pick<Sja, 'status' | 'understanding' | 'observation'>): boolean {
  const signed = sja.status === 'signed' || sja.status === 'signedWithFallback';
  return signed && sja.understanding.required && !sja.understanding.legacyTeachBack && !sja.observation;
}

export function linesForQuestion(sja: Pick<Sja, 'lines'>, q: Question) {
  return activeLines(sja as Sja).filter((l) => l.templateLineId && q.linkedLineIds.includes(l.templateLineId));
}

/**
 * Brings an SJA stored before the v3 check into the current shape. A signed run keeps
 * what was recorded, marked as the earlier format. An unsigned one starts its check again.
 */
export function upgradeSja(sja: Sja, opts: { keepCounts?: boolean } = {}): Sja {
  const u = sja.understanding as unknown as (Omit<UnderstandingResult, 'teachBack'> & { teachBack: unknown }) | undefined;
  if (!u || !Array.isArray(u.teachBack)) return sja;
  const legacy = u.teachBack as { lineId: string; outcome: string }[];
  if (!u.required) return { ...sja, understanding: { ...NO_CHECK, teachBack: { ok: 0, rebriefed: 0 }, misunderstood: [] } };
  const base = { required: true, reason: u.reason ?? [], keyLineIds: legacy.map((t) => t.lineId).filter((id) => id !== '*'), teachBack: { ok: 0, rebriefed: 0 }, misunderstood: [] };
  // A signed run, or a saved file that is only being shown, keeps exactly what was recorded.
  if (opts.keepCounts || sja.status === 'signed' || sja.status === 'signedWithFallback') {
    return { ...sja, understanding: { ...base, questionIds: u.questionIds ?? [], respondents: u.respondents ?? 0, perQuestion: u.perQuestion ?? [], completed: Boolean(u.completed), legacyTeachBack: legacy } };
  }
  const questionIds = (u.questionIds ?? []).slice(0, QUESTIONS_PER_CHECK);
  return {
    ...sja,
    status: sja.status === 'readyToSign' ? 'contentConfirmed' : sja.status,
    understanding: { ...base, keyLineIds: keyLines(sja, []), questionIds, respondents: 0, perQuestion: questionIds.map(fresh), completed: false },
  };
}
