import { describe, expect, it } from 'vitest';
import { allowedRoutes, isBlocking, routeDisabled } from '../../src/core/flags';
import * as flow from '../../src/core/flow';
import { benchSummary, misunderstandingCounts, reuseRate, totalTime, unverifiedReuse, type PairFixture, type PairResult } from '../../src/core/metrics';
import { checkLineRules } from '../../src/core/pipeline/checkLine';
import { canSign, deriveStatus, gateConditions, hasFallback } from '../../src/core/rules/gate';
import { isSupported } from '../../src/core/rules/languages';
import { buildP1, buildP2, buildP3, buildP4, buildP5, buildP6 } from '../../src/core/rules/payload';
import { initUnderstanding, MAX_KEY_LINES, needsObservation, nextQuestionIds, QUESTIONS_FALLBACK, understandingTrigger, upgradeSja, type WorkerCheck } from '../../src/core/rules/understanding';
import { inputSchemas } from '../../src/core/schemas';
import type { Flag, ModelClient, ReviewerSession, Sja } from '../../src/core/types';
import { clone, makeFlag } from '../../src/core/util';
import { approve, deriveState, editSourceLine, editTargetLine, verificationSummary } from '../../src/core/verification';
import { HEADER, hazards, makeCtx, seedPack, startJob } from '../helpers';

const noModel: ModelClient = {
  async call() {
    throw new Error('no model in unit tests');
  },
};
const flag = (over: Partial<Flag> & Pick<Flag, 'type' | 'severity'>): Flag => ({
  ...makeFlag({ lineId: 'x', lang: 'pl', type: over.type, severity: over.severity, raisedBy: 'D1', nb: '', en: '' }),
  ...over,
});

describe('D4 supported languages (SC-03)', () => {
  const pack = seedPack();
  it('supports a language that has a glossary column, with no reviewer recorded', () => {
    expect(isSupported('pl', pack)).toBe(true);
    expect(isSupported('lt', pack)).toBe(true);
    expect(isSupported('ro', pack)).toBe(false);
    expect(isSupported('nb', pack)).toBe(false);
  });
  it('an unsupported language raises UNSUPPORTED_LANGUAGE and nothing else (AC-09)', () => {
    const r = checkLineRules({ lineId: 'x', source: 'Minst 2 personer. Fare: kranen velter.', target: 'Cel puțin 3 persoane.', lang: 'ro', critical: true }, pack);
    expect(r.flags.map((f) => f.type)).toEqual(['UNSUPPORTED_LANGUAGE']);
    expect(r.stop).toBe(true);
  });
});

describe('Flag routes (F-08)', () => {
  it('offers the four routes and no route that dismisses a red language flag (AC-11)', () => {
    const red = flag({ type: 'GLOSSARY_MISMATCH', severity: 'red' });
    expect(allowedRoutes(red, true)).toEqual(['approvedTerm', 'rewrite', 'reviewer', 'oral']);
    expect(allowedRoutes(flag({ type: 'MEANING_SHIFT', severity: 'red' }), true)).toEqual(['rewrite', 'reviewer', 'oral']);
    expect(allowedRoutes(flag({ type: 'MEANING_SHIFT', severity: 'red' }), true)).not.toContain('acknowledged');
  });
  it('lets only an amber flag on a non-critical line be acknowledged', () => {
    expect(allowedRoutes(flag({ type: 'MEANING_SHIFT', severity: 'amber' }), false)).toContain('acknowledged');
    expect(allowedRoutes(flag({ type: 'MEANING_SHIFT', severity: 'amber' }), true)).not.toContain('acknowledged');
  });
  it('disables "use the approved term" after two attempts (AC-12)', () => {
    const f = flag({ type: 'GLOSSARY_MISMATCH', severity: 'red', autoAttempts: 2 });
    expect(routeDisabled(f, 'approvedTerm')).toBe(true);
    expect(routeDisabled(f, 'rewrite')).toBe(false);
    expect(routeDisabled(f, 'reviewer')).toBe(false);
    expect(routeDisabled(f, 'oral')).toBe(false);
  });
  it('one blocking rule (SC-08): any open flag on a critical line, and any open red flag', () => {
    expect(isBlocking(flag({ type: 'MEANING_SHIFT', severity: 'amber' }), true)).toBe(true);
    expect(isBlocking(flag({ type: 'MEANING_SHIFT', severity: 'amber' }), false)).toBe(false);
    expect(isBlocking(flag({ type: 'NUMBER_UNIT_MISMATCH', severity: 'red' }), false)).toBe(true);
    expect(isBlocking(flag({ type: 'NUMBER_UNIT_MISMATCH', severity: 'red', status: 'resolved' }), true)).toBe(false);
  });
});

describe('D5 sign-off gate', () => {
  const { ctx, pack } = makeCtx('work-at-height', noModel);
  const base = (): Sja => {
    // Parameters only: no model needed, nothing changed.
    let s = startJob(ctx, 'jd-09');
    s.specificsConfirmed = true;
    return s;
  };
  const open = (s: Sja) => gateConditions(s, pack).filter((c) => !c.ok).map((c) => c.id);

  it('is closed until the content is confirmed and every marker is confirmed (AC-13, AC-18)', async () => {
    let s = base();
    expect(open(s)).toEqual(['contentConfirmed', 'techRecheck', 'languageCheck']);
    expect(canSign(s, pack)).toBe(false);
    for (const l of s.lines.filter((x) => x.techRecheck === 'open')) s = flow.confirmTechRecheck(ctx, s, l.lineId);
    s = await flow.confirmContent(ctx, s);
    s = await flow.runLanguageCheck(ctx, s);
    expect(open(s)).toEqual([]);
    expect(deriveStatus(s, pack)).toBe('readyToSign');
    expect(s.understanding.required).toBe(false);
    const signed = flow.sign(ctx, s, 'Bas');
    expect(signed.status).toBe('signed');
  });

  it('refuses to sign while a condition is open', () => {
    expect(() => flow.sign(ctx, base(), 'Bas')).toThrow();
  });

  it('a red flag blocks; the reviewer route gives "escalated"; the oral route gives signed with fallback', async () => {
    let s = base();
    for (const l of s.lines.filter((x) => x.techRecheck === 'open')) s = flow.confirmTechRecheck(ctx, s, l.lineId);
    s = await flow.confirmContent(ctx, s);
    s = await flow.runLanguageCheck(ctx, s);
    const f = flag({ type: 'MEANING_SHIFT', severity: 'red', lineId: 'h-10', lang: 'pl', raisedBy: 'P6' });
    s = clone(s);
    s.lines.find((l) => l.lineId === 'h-10')!.byLang.pl.flags.push(f);
    expect(open(s)).toEqual(['flags']);
    expect(deriveStatus(s, pack)).toBe('flagsOpen');
    const escalated = await flow.applyRoute(ctx, s, f.flagId, 'reviewer');
    expect(escalated.status).toBe('escalated');
    expect(canSign(escalated, pack)).toBe(false);
    const oral = await flow.applyRoute(ctx, escalated, f.flagId, 'oral');
    expect(canSign(oral, pack)).toBe(true);
    expect(flow.sign(ctx, oral, 'Bas').status).toBe('signedWithFallback');
    await expect(flow.applyRoute(ctx, s, f.flagId, 'acknowledged', { reason: 'fine' })).rejects.toThrow();
  });
});

describe('D6 payload allow-list', () => {
  const { ctx, pack } = makeCtx('lifting', noModel);
  const sja = startJob(ctx, 'jd-01');
  sja.specifics = [{ text: 'Løft over gangvei.', status: 'clear' }];
  const payloads = [
    buildP1(sja, ctx.template),
    buildP2(sja, ctx.template, sja.lines, hazards().find((h) => h.templateId === 'lifting')),
    buildP3(sja.lines.slice(0, 2)),
    buildP4('Sperr av faresonen.', 'pl', pack, false, 0),
    buildP5('pl', 'Wygrodź strefę niebezpieczną.'),
    buildP6('Sperr av faresonen.', 'Sperr av faresonen.', true),
  ];
  it('no header field value appears in any model payload (AC-03)', () => {
    const all = JSON.stringify(payloads);
    for (const v of Object.values(HEADER)) expect(all).not.toContain(v);
  });
  it('every payload passes its strict schema, and an extra field is rejected', () => {
    (['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const).forEach((t, i) => expect(inputSchemas[t].safeParse(payloads[i]).success).toBe(true));
    expect(inputSchemas.P1.safeParse({ ...payloads[0], siteLabel: 'x' }).success).toBe(false);
    expect(inputSchemas.P4.safeParse({ ...payloads[3], header: HEADER }).success).toBe(false);
  });
  it('the back-translation payload has no place for the source (AC-10)', () => {
    expect(Object.keys(payloads[4]).sort()).toEqual(['lang', 'text']);
    expect(inputSchemas.P5.safeParse({ lang: 'pl', text: 'x', source: 'Sperr av faresonen.' }).success).toBe(false);
  });
});

describe('D7 understanding check (service brief v3: teach-back, one scenario question, observation)', () => {
  const { ctx, events } = makeCtx('work-at-height', noModel);
  const right = (s: Sja, over: Partial<WorkerCheck> = {}): WorkerCheck => ({ teachBack: 'ok', misunderstood: [], answers: nextQuestionIds(s.understanding, ctx.template, null).map((questionId) => ({ questionId, correct: true })), ...over });

  it('is not required when nothing critical changed and no box is ticked (AC-14)', () => {
    expect(understandingTrigger(startJob(ctx, 'jd-09'))).toEqual({ required: false, reason: [] });
  });
  it('is required for a new worker, a first-time job or a changed critical line (AC-14)', () => {
    expect(understandingTrigger(startJob(ctx, 'jd-09', { crewFlags: { newWorker: true, firstTimeJobType: false } })).reason).toEqual(['newWorker']);
    const s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    expect(understandingTrigger(s).reason).toEqual(['criticalChanged']);
  });
  it('asks each worker ONE scenario question, the one that tests the changed line first, then rotates (v3; Q3)', () => {
    let s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    // The pool holds every approved question for lines in today's SJA, the one about the changed line first.
    expect(s.understanding.questionIds[0]).toBe('q-h3');
    expect(s.understanding.questionIds.length).toBeGreaterThanOrEqual(8);
    expect(s.understanding.perQuestion).toHaveLength(s.understanding.questionIds.length);
    expect(nextQuestionIds(s.understanding, ctx.template, 'pl')).toEqual(['q-h3']);
    // The next worker on the same phone gets a different question.
    s = flow.recordWorkerCheck(ctx, s, 'pl', right(s));
    const second = nextQuestionIds(s.understanding, ctx.template, 'lt');
    expect(second).toHaveLength(1);
    expect(second[0]).not.toBe('q-h3');
    // The multiple-choice fallback asks three (U1).
    expect(nextQuestionIds(s.understanding, ctx.template, 'ru', QUESTIONS_FALLBACK)).toHaveLength(3);
  });
  it('records how each worker was checked, and a questions-only check makes the SJA a fallback (U1)', () => {
    let s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    s = flow.recordWorkerCheck(ctx, s, 'pl', right(s));
    s = flow.recordWorkerCheck(ctx, s, 'ru', right(s, { path: 'written', reason: 'noCommonLanguage' }));
    expect(s.understanding.paths).toEqual({ conversation: 1, written: 1, questionsOnly: 0 });
    expect(hasFallback(s)).toBe(false); // a written explanation judged by the foreman may end in "signed"
    const qs = nextQuestionIds(s.understanding, ctx.template, 'lt', QUESTIONS_FALLBACK);
    s = flow.recordWorkerCheck(ctx, s, 'lt', { teachBack: 'none', misunderstood: [], answers: qs.map((questionId) => ({ questionId, correct: true })), path: 'questionsOnly', reason: 'lateArrival' });
    expect(s.understanding.paths).toEqual({ conversation: 1, written: 1, questionsOnly: 1 });
    expect(s.understanding.teachBack).toEqual({ ok: 2, rebriefed: 0 }); // nobody judged an explanation in the questions-only path
    expect(s.understanding.fallbackReasons).toEqual({ noCommonLanguage: 1, lateArrival: 1 });
    expect(hasFallback(s)).toBe(true); // multiple choice alone: "signed with fallback"
  });
  it('lists what the worker should explain: today\'s changed critical lines, or the main hazard and controls', () => {
    const changed = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    expect(changed.understanding.keyLineIds).toEqual(['h-10']);
    const added = flow.addLine(ctx, startJob(ctx, 'jd-09'), 'controls', 'Ingen går ut på taket uten sele.');
    expect(added.understanding.keyLineIds).toEqual(['egen-1']);
    // Nothing critical changed: the check is there because of a new worker.
    const fresh = flow.confirmTechRecheck(ctx, startJob(ctx, 'jd-09', { crewFlags: { newWorker: true, firstTimeJobType: false } }), 'h-01');
    const key = fresh.understanding.keyLineIds.map((id) => fresh.lines.find((l) => l.lineId === id)!);
    expect(key.length).toBeGreaterThanOrEqual(2);
    expect(key.length).toBeLessThanOrEqual(4);
    expect(key.every((l) => l.critical)).toBe(true);
    expect(key.some((l) => l.section === 'hazards')).toBe(true);
    expect(key.some((l) => l.section === 'controls')).toBe(true);
  });
  it('records one worker: the teach-back outcome and the first answer. Counts only (AC-16)', () => {
    let s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    const [q] = s.understanding.questionIds;
    expect(s.understanding.completed).toBe(false); // nobody checked yet
    s = flow.recordWorkerCheck(ctx, s, 'pl', right(s));
    expect(s.understanding).toMatchObject({ respondents: 1, teachBack: { ok: 1, rebriefed: 0 }, misunderstood: [], completed: true });
    // Second worker: got a point wrong in the explanation, and answered the question wrongly.
    s = flow.recordWorkerCheck(ctx, s, 'lt', { teachBack: 'rebriefed', misunderstood: ['h-10', 'no-such-line'], answers: [{ questionId: q, correct: false }] });
    expect(s.understanding.teachBack).toEqual({ ok: 1, rebriefed: 1 });
    expect(s.understanding.misunderstood).toEqual([{ lineId: 'h-10', count: 1 }]);
    expect(s.understanding.perQuestion[0]).toEqual({ questionId: q, respondents: 2, correctFirst: 1, rebriefConfirmed: false });
    expect(s.understanding.completed).toBe(false); // a wrong answer opens a re-brief (AC-15)
    s = flow.confirmRebrief(ctx, s, q);
    expect(s.understanding.completed).toBe(true);
    expect(Object.keys(s.understanding).sort()).toEqual(['basis', 'completed', 'fallbackReasons', 'keyLineIds', 'misunderstood', 'paths', 'perQuestion', 'questionIds', 'reason', 'required', 'respondents', 'teachBack']);
    expect(JSON.stringify(s.understanding)).not.toMatch(/name|navn/i);
  });
  it('logs a misunderstanding without names or text, against the template line, so it can be fed back', () => {
    const env = makeCtx('work-at-height', noModel);
    const s = flow.editLine(env.ctx, startJob(env.ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    flow.recordWorkerCheck(env.ctx, s, 'lt', right(s, { teachBack: 'rebriefed', misunderstood: ['h-10'] }));
    const logged = env.events.filter((e) => e.type === 'misunderstanding');
    expect(logged).toEqual([{ actor: 'foreman', type: 'misunderstanding', step: 'understanding', lineId: 'h-10', templateId: 'work-at-height', route: 'teachBack' }]);
    const counts = misunderstandingCounts(logged.map((e, i) => ({ ...e, eventId: `e${i}`, runId: 'r', at: '', arm: 'flagship' as const, packVersion: 1 })));
    expect(counts).toEqual({ 'work-at-height': { 'h-10': 1 } });
    expect(JSON.stringify(env.events)).not.toContain('fortauet');
  });
  it('does not log or trace which language or which outcome a single worker had (a small crew would identify the person)', () => {
    const env = makeCtx('work-at-height', noModel);
    const s = flow.editLine(env.ctx, startJob(env.ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    flow.recordWorkerCheck(env.ctx, s, 'lt', right(s, { teachBack: 'rebriefed', misunderstood: ['h-10'] }));
    const perWorker = env.events.filter((e) => e.type === 'respondent_done' || e.type.startsWith('teach_back_'));
    expect(perWorker).toHaveLength(2);
    expect(perWorker.every((e) => e.languagePair === undefined && e.lineId === undefined)).toBe(true);
    const entry = env.trace.find((e) => e.step === 'understanding' && e.kind === 'human')!;
    expect(`${entry.title} ${entry.detail}`).not.toMatch(/\blt\b|h-10|rebrief|correct/i);
  });
  it('checks made before the SJA changed are set aside: a new safety-critical line re-opens the check', () => {
    let s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    s = flow.recordWorkerCheck(ctx, s, 'pl', right(s, { teachBack: 'rebriefed', misunderstood: ['h-10'] }));
    expect(s.understanding).toMatchObject({ respondents: 1, completed: true });
    // An edit that touches neither a key line nor the question keeps the counts.
    s = flow.editLine(ctx, s, 'h-16', 'Bruk vernesko, hansker og vernebriller.');
    expect(s.understanding).toMatchObject({ respondents: 1, completed: true, keyLineIds: ['h-10'] });
    expect(s.understanding.recheck).toBeUndefined();
    // A new safety-critical line: the worker was never asked about it.
    s = flow.addLine(ctx, s, 'controls', 'Ingen går ut på taket uten sele.');
    expect(s.understanding.keyLineIds).toEqual(['h-10', 'egen-1']);
    expect(s.understanding).toMatchObject({ respondents: 0, teachBack: { ok: 0, rebriefed: 0 }, misunderstood: [], completed: false, recheck: true });
    expect(gateConditions(s, ctx.pack).find((c) => c.id === 'understanding')!.ok).toBe(false);
    // Checking a worker again clears the note.
    s = flow.recordWorkerCheck(ctx, s, 'pl', right(s));
    expect(s.understanding).toMatchObject({ respondents: 1, completed: true });
    expect(s.understanding.recheck).toBeUndefined();
  });
  it('an open re-brief is never lost when the SJA changes: the check starts again instead', () => {
    let s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    const [q] = s.understanding.questionIds;
    s = flow.recordWorkerCheck(ctx, s, 'lt', { teachBack: 'ok', misunderstood: [], answers: [{ questionId: q, correct: false }] });
    expect(s.understanding.completed).toBe(false);
    s = flow.editLine(ctx, s, 'h-10', 'Sperr av fortauet og gangveien under stillaset.'); // the key line itself is reworded
    expect(s.understanding).toMatchObject({ respondents: 0, completed: false, recheck: true });
  });
  it('listens for at most MAX_KEY_LINES points', () => {
    let s = startJob(ctx, 'jd-09');
    for (let i = 0; i < MAX_KEY_LINES + 2; i++) s = flow.addLine(ctx, s, 'controls', `Egen sikkerhetslinje nummer ${i + 1}.`);
    expect(s.understanding.keyLineIds).toHaveLength(MAX_KEY_LINES);
  });
  it('refuses to record a worker on a signed SJA, or when no check is required', () => {
    const s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    expect(() => flow.recordWorkerCheck(ctx, { ...s, status: 'signed' }, 'pl', right(s))).toThrow(/signed/);
    const plain = startJob(ctx, 'jd-09');
    expect(() => flow.recordWorkerCheck(ctx, plain, 'pl', { teachBack: 'ok', misunderstood: [], answers: [] })).toThrow(/not required/);
  });
  it('a misunderstanding of a line written for one job is logged as job-specific, not against a template line', () => {
    const env = makeCtx('work-at-height', noModel);
    const s = flow.addLine(env.ctx, startJob(env.ctx, 'jd-09'), 'controls', 'Ingen går ut på taket uten sele.');
    flow.recordWorkerCheck(env.ctx, s, 'pl', right(s, { teachBack: 'rebriefed', misunderstood: ['egen-1'] }));
    expect(env.events.find((e) => e.type === 'misunderstanding')).toMatchObject({ lineId: 'job-specific', templateId: 'work-at-height' });
  });
  it('with no supported crew language the check is done orally, through an interpreter', () => {
    const s = startJob(ctx, 'jd-09', { languages: ['ro'], crewFlags: { newWorker: true, firstTimeJobType: false } });
    const u = initUnderstanding(s, ctx.template);
    expect(u).toMatchObject({ required: true, respondents: 0, completed: false });
    const asked = nextQuestionIds(u, ctx.template, null);
    expect(asked).toHaveLength(1); // asked orally; the foreman records the answer
    const done = flow.recordWorkerCheck(ctx, { ...s, understanding: u }, '', { teachBack: 'ok', misunderstood: [], answers: [{ questionId: asked[0], correct: true }] });
    expect(done.understanding.completed).toBe(true);
  });
  it('the observation of the start of the job comes after sign-off, once', () => {
    const env = makeCtx('work-at-height', noModel);
    const s = flow.editLine(env.ctx, startJob(env.ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    expect(needsObservation(s)).toBe(false); // not signed yet
    expect(() => flow.recordObservation(env.ctx, s, [])).toThrow(/after sign-off/);
    const signed: Sja = { ...s, status: 'signed', signoff: { role: 'Bas', at: '2026-10-06T08:00:00.000Z' } };
    expect(needsObservation(signed)).toBe(true);
    const seen = flow.recordObservation(env.ctx, signed, ['h-10', 'h-10', 'nope']);
    expect(seen.observation?.lineIds).toEqual(['h-10']);
    expect(seen.status).toBe('signed'); // the signed content and status do not change
    expect(needsObservation(seen)).toBe(false);
    expect(() => flow.recordObservation(env.ctx, seen, [])).toThrow(/already recorded/);
    expect(flow.recordObservation(env.ctx, signed, []).observation?.lineIds).toEqual([]);
    expect(env.events.filter((e) => e.type === 'misunderstanding' && e.route === 'observation')).toHaveLength(1);
    expect(env.events.filter((e) => e.type === 'start_observed').map((e) => e.count)).toEqual([1, 0]);
    // No observation is asked for when no check was required, or on a run signed before v3.
    expect(needsObservation({ ...startJob(env.ctx, 'jd-09'), status: 'signed' })).toBe(false);
    expect(needsObservation({ ...signed, understanding: { ...signed.understanding, legacyTeachBack: [] } })).toBe(false);
  });
  it('a reviewer decision after sign-off does not touch what was recorded about understanding', () => {
    const s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    const checked = flow.recordWorkerCheck(ctx, s, 'pl', right(s));
    const signed: Sja = { ...checked, status: 'signed', understanding: { ...checked.understanding, legacyTeachBack: [{ lineId: 'ny-1', outcome: 'ok' }] } };
    const after = flow.confirmTechRecheck(ctx, signed, 'h-01'); // any flow action that recomputes state
    expect(after.understanding).toEqual(signed.understanding);
    expect(after.status).toBe('signed');
  });
  it('an SJA stored before v3 is brought into the new shape', () => {
    const s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    const old = { required: true, reason: ['criticalChanged'], questionIds: ['q-h3', 'q-h1', 'q-h2'], respondents: 2, perQuestion: [{ questionId: 'q-h3', respondents: 2, correctFirst: 2, rebriefConfirmed: false }], teachBack: [{ lineId: 'ny-1', outcome: 'ok' }], completed: true };
    // Signed: what was recorded is kept and marked as the earlier format.
    const signed = upgradeSja({ ...s, status: 'signed', understanding: old as any });
    expect(signed.understanding).toMatchObject({ respondents: 2, completed: true, teachBack: { ok: 0, rebriefed: 0 }, legacyTeachBack: [{ lineId: 'ny-1', outcome: 'ok' }] });
    // Not signed: the check starts again under the v3 rules, and the SJA is no longer ready to sign.
    const open = upgradeSja({ ...s, status: 'readyToSign', understanding: old as any });
    expect(open.understanding).toMatchObject({ respondents: 0, completed: false, questionIds: ['q-h3'] });
    expect(open.status).toBe('contentConfirmed');
    expect(upgradeSja(s)).toBe(s); // already in the new shape
    expect(upgradeSja(upgradeSja(open))).toEqual(upgradeSja(open)); // idempotent
    // A saved file that is only being shown keeps its counts even if it was never signed.
    const shown = upgradeSja({ ...s, status: 'readyToSign', understanding: old as any }, { keepCounts: true });
    expect(shown.understanding).toMatchObject({ respondents: 2, legacyTeachBack: [{ lineId: 'ny-1', outcome: 'ok' }] });
    expect(shown.status).toBe('readyToSign');
    // No check was required: there is nothing to carry over.
    const none = upgradeSja({ ...startJob(ctx, 'jd-09'), understanding: { required: false, reason: [], questionIds: [], respondents: 0, perQuestion: [], teachBack: [], completed: true } as any });
    expect(none.understanding).toMatchObject({ required: false, completed: true, teachBack: { ok: 0, rebriefed: 0 }, keyLineIds: [] });
    expect(none.understanding.legacyTeachBack).toBeUndefined();
  });
});

describe('Built from a verified template (pilot measure 2)', () => {
  it('counts template lines whose translation lacks a key in a crew language; with the seed data none is verified', () => {
    const { ctx } = makeCtx('work-at-height', noModel);
    const s = startJob(ctx, 'jd-09');
    const r = unverifiedReuse(s);
    expect(r.total).toBe(22);
    expect(r.unverified).toBe(22);
    // Both keys on one line in every crew language → that line counts as verified.
    const one = clone(s);
    for (const lang of one.languages) one.lines[0].byLang[lang].verification = 'verified';
    expect(unverifiedReuse(one)).toEqual({ total: 22, unverified: 21 });
  });
});

describe('Time totals (service brief v3, pilot measure 1)', () => {
  it('total time counts drafting, checking and correction up to the signature, not the understanding check', () => {
    expect(totalTime({ input: 10, machine: 5, contentReview: 20, reviewer: 7, flagResolution: 30, signoff: 3, understanding: 1000 })).toBe(75);
  });
});

describe('Two-key verification (10.4, SC-04)', () => {
  const lang: ReviewerSession = { role: 'language', lang: 'lt', outsideGroup: true };
  const tech: ReviewerSession = { role: 'technical', lang: 'lt', outsideGroup: false };
  const ref = { kind: 'line' as const, templateId: 'lifting', lineId: 'l-11' };
  const line = (p: ReturnType<typeof seedPack>) => p.templates.find((t) => t.templateId === 'lifting')!.lines.find((l) => l.lineId === 'l-11')!;
  const state = (p: ReturnType<typeof seedPack>, l: 'lt' | 'pl') => deriveState(line(p).translations[l]!.keyLanguage, line(p).keyTechnical);

  it('with the seed data as delivered, nothing is verified (AC-01)', () => {
    const { rows, counts } = verificationSummary(seedPack());
    expect(rows).toEqual([]);
    for (const bucket of Object.values(counts)) {
      expect(bucket.verified).toBe(0);
      expect(bucket.languageChecked).toBe(0);
      expect(bucket.technicallyChecked).toBe(0);
    }
  });
  it('an approval sets exactly one key; verified needs both (AC-20)', () => {
    const p = seedPack();
    approve(p, ref, lang, '2026-10-05');
    expect(state(p, 'lt')).toBe('languageChecked');
    expect(state(p, 'pl')).toBe('draft');
    approve(p, ref, tech, '2026-10-05');
    expect(state(p, 'lt')).toBe('verified');
    expect(state(p, 'pl')).toBe('technicallyChecked'); // the technical key applies to all languages
    expect(verificationSummary(p).rows).toHaveLength(2);
    expect(verificationSummary(p).rows.find((r) => r.role === 'language')!.outsideGroup).toBe(true);
  });
  it('editing the Norwegian source clears the technical key and every language key', () => {
    const p = seedPack();
    approve(p, ref, lang, 'd');
    approve(p, ref, tech, 'd');
    editSourceLine(p, ref, 'Ingen skal stå under hengende last.');
    expect(state(p, 'lt')).toBe('draft');
    expect(line(p).keyTechnical.given).toBe(false);
  });
  it('a correction by the language reviewer sets that language key and leaves the technical key; any other edit clears it', () => {
    const p = seedPack();
    approve(p, ref, tech, 'd');
    editTargetLine(p, ref, 'lt', 'Niekas negali stovėti po pakabintu kroviniu.', lang, 'd');
    expect(state(p, 'lt')).toBe('verified');
    editTargetLine(p, ref, 'lt', 'Kažkas kita.', tech, 'd');
    expect(state(p, 'lt')).toBe('technicallyChecked');
    editTargetLine(p, ref, 'lt', 'Dar kas nors.', null, 'd');
    expect(line(p).translations.lt!.keyLanguage.given).toBe(false);
  });
});

describe('Metrics (10.7, SC-16)', () => {
  const fx: PairFixture[] = [
    { id: 's1', lang: 'pl', kind: 'seeded', source: '', target: '', critical: true, glossaryCatchable: true },
    { id: 's2', lang: 'pl', kind: 'seeded', source: '', target: '', critical: true, glossaryCatchable: false },
    { id: 's3', lang: 'pl', kind: 'seeded', source: '', target: '', critical: true, glossaryCatchable: false },
    { id: 'c1', lang: 'pl', kind: 'control', source: '', target: '', critical: true },
    { id: 'c2', lang: 'pl', kind: 'control', source: '', target: '', critical: true },
  ];
  const res = (id: string, flags: Flag[]): PairResult => ({ id, flags, callOrigins: [] });
  const d1 = () => flag({ type: 'GLOSSARY_MISMATCH', severity: 'red', raisedBy: 'D1' });
  const p6 = () => flag({ type: 'MEANING_SHIFT', severity: 'red', raisedBy: 'P6' });

  it('reports the catch count for rules alone and for rules plus back-translation', () => {
    const s = benchSummary(fx, { s1: res('s1', [d1()]), s2: res('s2', [p6()]), s3: res('s3', []), c1: res('c1', []), c2: res('c2', [p6()]) }, 'pl');
    expect(s).toMatchObject({ seeded: 3, caughtRulesOnly: 1, caughtAll: 2, nonGlossary: 2, nonGlossaryCaught: 1, controls: 2, controlsFlaggedRed: 1, falseFlags: 1, missed: ['s3'] });
  });
  it('a reviewer false-alarm verdict changes the counts (AC-21)', () => {
    const judged = p6();
    judged.reviewerVerdict = { kind: 'falseAlarm', reason: 'acceptable synonym' };
    const before = benchSummary(fx, { s2: res('s2', [p6()]) }, 'pl');
    const after = benchSummary(fx, { s2: res('s2', [judged]) }, 'pl');
    expect([before.caughtAll, before.falseFlags]).toEqual([1, 0]);
    expect([after.caughtAll, after.falseFlags, after.reviewerFalseAlarms]).toEqual([0, 1, 1]);
  });
  it('reuse rate counts reused and parameter-filled lines over all lines', () => {
    const { ctx } = makeCtx('work-at-height', noModel);
    const s = flow.editLine(ctx, startJob(ctx, 'jd-09'), 'h-10', 'Noe annet.');
    expect(reuseRate(s)).toEqual({ reused: 21, total: 22 });
  });
});
