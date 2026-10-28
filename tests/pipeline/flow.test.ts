// Whole flows without a model: the gateway runs in replay mode on the stored
// (scripted) responses. These tests show the software does what the plan says.
// They are not evidence for any claim about translation quality.
import { describe, expect, it } from 'vitest';
import { allFlags, routeDisabled } from '../../src/core/flags';
import * as flow from '../../src/core/flow';
import { benchSummary, type PairFixture, type PairResult } from '../../src/core/metrics';
import { checkLine } from '../../src/core/pipeline/checkLine';
import { canSign, gateConditions } from '../../src/core/rules/gate';
import type { ModelCall, ModelClient, Sja } from '../../src/core/types';
import { clientFor, fixtures, HEADER, makeCtx, makeGateway, seedPack, settle, startJob } from '../helpers';

const openLang = (s: Sja) => allFlags(s).filter((r) => r.lang !== 'nb' && r.flag.status === 'open');

async function toLanguageCheck(id: string, templateId: string, calls: ModelCall[], over = {}) {
  const env = makeCtx(templateId, clientFor(makeGateway(), calls));
  let s = startJob(env.ctx, id, over);
  s = await flow.runNormalise(env.ctx, s);
  s = await flow.runAdapt(env.ctx, s);
  return { ...env, s };
}

describe('J1 happy path (jd-01, replay)', () => {
  it('goes from input to a signed record; translates changed lines only', async () => {
    const calls: ModelCall[] = [];
    let { ctx, s, events, pack } = await toLanguageCheck('jd-01', 'lifting', calls);

    expect(flow.originCounts(s)).toEqual({ reused: 19, parameterFilled: 4, changed: 1, new: 2, removed: 0 });
    expect(s.lines.filter((l) => l.techRecheck === 'open').map((l) => l.lineId)).toEqual(['l-01', 'l-09']);
    // AC-07 / SC-02: nothing is translated before the foreman confirms the Norwegian.
    expect(calls.filter((c) => c.task === 'P4')).toHaveLength(0);
    expect(calls.filter((c) => c.task === 'P3')).toHaveLength(3);

    // Sign-off stays closed until each marker is confirmed (AC-13).
    const early = await flow.confirmContent(ctx, s);
    expect(early.contentConfirmed).toBe(false);
    s = settle(ctx, s);
    s = await flow.confirmContent(ctx, s);
    expect(s.contentConfirmed).toBe(true);
    s = await flow.runLanguageCheck(ctx, s);

    // AC-08: three changed lines, two languages → exactly three lines per language are sent for translation.
    const p4 = calls.filter((c) => c.task === 'P4');
    expect(p4).toHaveLength(6);
    expect(p4.filter((c) => (c.input as any).targetLang === 'pl')).toHaveLength(3);
    expect(p4.filter((c) => (c.input as any).targetLang === 'lt')).toHaveLength(3);

    // AC-10: the back-translation request holds the target text and not the original source.
    const p5 = calls.filter((c) => c.task === 'P5');
    expect(p5).toHaveLength(6);
    const sources = s.lines.filter((l) => l.origin === 'changed' || l.origin === 'new').map((l) => l.textNb);
    for (const c of p5) {
      expect(Object.keys(c.input as object).sort()).toEqual(['lang', 'text']);
      for (const src of sources) expect(JSON.stringify(c.input)).not.toContain(src);
    }

    // AC-03: no header field value in any logged model request.
    const everything = JSON.stringify(calls.map((c) => c.input));
    for (const v of Object.values(HEADER)) expect(everything).not.toContain(v);

    // Flags appear only on changed lines; one red glossary flag in Lithuanian.
    const open = openLang(s);
    expect(open.map((r) => [r.lang, r.flag.type, r.flag.severity, r.flag.raisedBy, r.line?.origin])).toEqual([['lt', 'GLOSSARY_MISMATCH', 'red', 'D1', 'changed']]);
    expect(allFlags(s).every((r) => r.line?.origin === 'changed' || r.line?.origin === 'new')).toBe(true);
    expect(canSign(s, pack)).toBe(false);
    expect(s.status).toBe('flagsOpen');
    // Reused lines kept their stored translations untouched.
    const reused = s.lines.find((l) => l.lineId === 'l-11')!;
    expect(reused.byLang.lt).toMatchObject({ checkState: 'reused', source: 'draftReuse', verification: 'draft' });

    // Route: use the approved term → re-translated with the term enforced, re-check is clean.
    s = await flow.applyRoute(ctx, s, open[0].flag.flagId, 'approvedTerm');
    expect(openLang(s)).toHaveLength(0);
    const resolved = allFlags(s).find((r) => r.flag.flagId === open[0].flag.flagId)!.flag;
    expect(resolved).toMatchObject({ status: 'resolved', route: 'approvedTerm', resolvedBy: 'foreman', autoAttempts: 1 });
    expect(s.lines.find((l) => l.lineId === 'l-12')!.byLang.lt.text).toContain('pavojingą zoną');

    // D7 (brief v3): required because a safety-critical line changed. One scenario question; the three
    // changed or new safety-critical lines are what each worker should be able to explain.
    expect(s.understanding).toMatchObject({ required: true, reason: ['criticalChanged'], keyLineIds: ['ny-1', 'l-12', 'ny-2'] });
    expect(s.understanding.questionIds[0]).toBe('q-l3'); // the question about today's changed line comes first (Q3)
    expect(gateConditions(s, pack).filter((c) => !c.ok).map((c) => c.id)).toEqual(['understanding']);

    s = flow.recordWorkerCheck(ctx, s, 'pl', { teachBack: 'ok', misunderstood: [], answers: [{ questionId: 'q-l3', correct: true }] });
    expect(canSign(s, pack)).toBe(true);
    s = flow.recordWorkerCheck(ctx, s, 'lt', { teachBack: 'rebriefed', misunderstood: ['ny-2'], answers: [{ questionId: 'q-l3', correct: false }] });
    expect(s.understanding).toMatchObject({ respondents: 2, teachBack: { ok: 1, rebriefed: 1 }, misunderstood: [{ lineId: 'ny-2', count: 1 }] });
    expect(canSign(s, pack)).toBe(false); // the question was missed: re-brief still open (AC-15)
    s = flow.confirmRebrief(ctx, s, 'q-l3');
    expect(canSign(s, pack)).toBe(true);

    s = flow.sign(ctx, s, 'Bas');
    expect(s.status).toBe('signed');
    expect(s.versions.prompts).toMatchObject({ P1: '1.0.0', P4: '1.1.0', P6: '1.0.0' });
    expect(s.versions.fixtureOrigins).toEqual(['replay:scripted']);

    // The anonymous log holds no free text and no names (AC-22).
    const logText = JSON.stringify(events);
    for (const l of s.lines) expect(logText).not.toContain(l.textNb);
    for (const v of Object.values(HEADER)) expect(logText).not.toContain(v);
    expect(events.some((e) => e.type === 'signed')).toBe(true);
  });

  it('English works as an output language when selected (F-20)', async () => {
    const calls: ModelCall[] = [];
    let { ctx, s } = await toLanguageCheck('jd-01', 'lifting', calls, { languages: ['en'] });
    s = await flow.confirmContent(ctx, settle(ctx, s));
    s = await flow.runLanguageCheck(ctx, s);
    expect(openLang(s)).toHaveLength(0);
    expect(s.lines.find((l) => l.lineId === 'l-12')!.byLang.en.text).toMatch(/danger zone/);
    expect(s.lines.find((l) => l.lineId === 'l-11')!.byLang.en.text).toBe('Nobody may stand under a suspended load.');
  });
});

describe('Alternative paths (replay)', () => {
  it('jd-02: unsourced AI suggestion blocks; back-translation finds a meaning shift; two failed attempts disable the route (AC-06, AC-12)', async () => {
    const calls: ModelCall[] = [];
    let { ctx, s, pack } = await toLanguageCheck('jd-02', 'work-at-height', calls);
    const suggestion = s.lines.find((l) => l.aiSuggestion === 'open')!;
    expect(suggestion.flags[0].type).toBe('AI_ADDED_CONTENT');
    expect((await flow.confirmContent(ctx, s)).contentConfirmed).toBe(false);
    s = await flow.confirmContent(ctx, settle(ctx, s));
    s = await flow.runLanguageCheck(ctx, s);

    const shift = openLang(s).find((r) => r.flag.type === 'MEANING_SHIFT' && r.flag.severity === 'red')!;
    expect(shift.flag).toMatchObject({ raisedBy: 'P6', lang: 'pl' });
    expect(shift.flag.evidence.backTranslation).toContain('etter at arbeidet har startet');
    expect(shift.flag.explanation.nb).toContain('før arbeidet starter');

    const amber = openLang(s).find((r) => r.flag.severity === 'amber')!;
    expect(amber.line!.critical).toBe(false);
    expect(gateConditions(s, pack).find((c) => c.id === 'flags')!.open).toBe(2); // the amber one does not block

    const lt = openLang(s).find((r) => r.lang === 'lt')!;
    s = await flow.applyRoute(ctx, s, lt.flag.flagId, 'approvedTerm');
    s = await flow.applyRoute(ctx, s, lt.flag.flagId, 'approvedTerm');
    const still = allFlags(s).find((r) => r.flag.flagId === lt.flag.flagId)!.flag;
    expect(still).toMatchObject({ status: 'open', autoAttempts: 2 });
    expect(routeDisabled(still, 'approvedTerm')).toBe(true);
    await expect(flow.applyRoute(ctx, s, lt.flag.flagId, 'approvedTerm')).rejects.toThrow(/not available/);

    // Reviewer route: only a language reviewer of that language can call it a false alarm.
    s = await flow.applyRoute(ctx, s, lt.flag.flagId, 'reviewer');
    expect(s.status).toBe('escalated');
    expect(() => flow.reviewerVerdict(ctx, s, lt.flag.flagId, 'falseAlarm', 'ok', { role: 'language', lang: 'pl', outsideGroup: false })).toThrow();
    s = flow.reviewerVerdict(ctx, s, lt.flag.flagId, 'falseAlarm', '"Skylė" is an everyday word for the same thing.', { role: 'language', lang: 'lt', outsideGroup: true });
    expect(allFlags(s).find((r) => r.flag.flagId === lt.flag.flagId)!.flag).toMatchObject({ status: 'resolved', resolvedBy: 'reviewer', reviewerVerdict: { kind: 'falseAlarm' } });

    // Oral fallback on the Polish meaning shift → signed with fallback, and the record lists the line.
    s = await flow.applyRoute(ctx, s, shift.flag.flagId, 'oral');
    expect(s.lines.find((l) => l.lineId === shift.line!.lineId)!.byLang.pl.oralFallback).toBe(true);
    s = await flow.applyRoute(ctx, s, amber.flag.flagId, 'acknowledged', { reason: 'Kurset er obligatorisk uansett.' });
    s = flow.recordWorkerCheck(ctx, s, 'pl', { teachBack: 'ok', misunderstood: [], answers: s.understanding.questionIds.map((questionId) => ({ questionId, correct: true })) });
    expect(flow.sign(ctx, s, 'Bas').status).toBe('signedWithFallback');
  });

  it('jd-02: the rewrite route runs the ambiguity check, then translation and check in all languages', async () => {
    const calls: ModelCall[] = [];
    let { ctx, s } = await toLanguageCheck('jd-02', 'work-at-height', calls);
    s = await flow.confirmContent(ctx, settle(ctx, s));
    s = await flow.runLanguageCheck(ctx, s);
    const shift = openLang(s).find((r) => r.flag.type === 'MEANING_SHIFT' && r.flag.severity === 'red')!;
    const before = calls.length;
    s = await flow.applyRoute(ctx, s, shift.flag.flagId, 'rewrite', { text: shift.line!.plainSuggestion });
    expect(calls.slice(before).map((c) => c.task).sort()).toEqual(['P3', 'P4', 'P4', 'P5', 'P5', 'P6', 'P6']);
    const line = s.lines.find((l) => l.lineId === shift.line!.lineId)!;
    expect(line.byLang.pl.flags.filter((f) => f.status === 'open')).toHaveLength(0);
    expect(line.byLang.pl.flags.find((f) => f.flagId === shift.flag.flagId)).toMatchObject({ status: 'resolved', route: 'rewrite' });
  });

  it('jd-03 (T3): slang gives clarifying questions in place of a guess, and the flow waits (AC-04)', async () => {
    const env = makeCtx('lifting', clientFor(makeGateway()));
    let s = await flow.runNormalise(env.ctx, startJob(env.ctx, 'jd-03'));
    expect(s.questions).toHaveLength(2);
    expect(flow.specificsBlockers(s)).toEqual({ openQuestions: 2, unclear: 2 });
    await expect(flow.runAdapt(env.ctx, s)).rejects.toThrow(/still open/);
    // Removing the unclear details is the other way forward.
    let removed = s;
    while (removed.specifics.some((x) => x.status === 'unclear')) removed = flow.removeSpecific(env.ctx, removed, removed.specifics.findIndex((x) => x.status === 'unclear'));
    expect(flow.specificsBlockers(removed).unclear).toBe(0);
    s = flow.answerQuestion(s, s.questions[0].id, 'Gjennom porten');
    s = flow.answerQuestion(s, s.questions[1].id, 'Anhukeren kontrollerer løftestroppene før bruk');
    s = await flow.runNormalise(env.ctx, s);
    expect(flow.specificsBlockers(s)).toEqual({ openQuestions: 0, unclear: 0 });
    expect(s.questionsAsked).toBeLessThanOrEqual(3);
  });

  it('jd-04 (T4, T7): ambiguous critical line is flagged before translation; missing term is red; unsupported language gets no text', async () => {
    const calls: ModelCall[] = [];
    let { ctx, s, pack } = await toLanguageCheck('jd-04', 'work-at-height', calls);
    const amb = allFlags(s).find((r) => r.flag.type === 'SOURCE_AMBIGUOUS')!;
    expect(amb.flag).toMatchObject({ raisedBy: 'P3', severity: 'amber', status: 'open' });
    expect(calls.some((c) => c.task === 'P4')).toBe(false); // AC-07: flagged before any translation
    const blocked = await flow.confirmContent(ctx, settle(ctx, s));
    expect(blocked.contentConfirmed).toBe(false);
    expect(flow.contentBlockers(blocked).ambiguousCritical).toBe(1);

    s = flow.editLine(ctx, s, amb.line!.lineId, amb.flag.evidence.suggestion!);
    s = await flow.confirmContent(ctx, settle(ctx, s));
    expect(s.contentConfirmed).toBe(true);
    s = await flow.runLanguageCheck(ctx, s);
    expect(calls.filter((c) => c.task === 'P4').every((c) => (c.input as any).text !== 'Bruk sele ved behov.')).toBe(true);

    // T4a: no worker-facing text in Romanian, an interpreter is required.
    expect(s.sjaFlags.map((f) => [f.type, f.lang, f.raisedBy])).toEqual([['UNSUPPORTED_LANGUAGE', 'ro', 'D4']]);
    expect(s.lines.every((l) => l.byLang.ro === undefined)).toBe(true);
    expect(calls.some((c) => JSON.stringify(c.input).includes('"ro"'))).toBe(false);

    // T4b: safety concept with no glossary entry → red, blocks.
    const missing = openLang(s).filter((r) => r.flag.type === 'TERM_NOT_IN_GLOSSARY');
    expect(missing.map((r) => [r.lang, r.flag.severity, r.flag.raisedBy])).toEqual([['pl', 'red', 'P4'], ['lt', 'red', 'P4']]);
    expect(canSign(s, pack)).toBe(false);

    // Oral routes for everything → signed with fallback.
    for (const r of openLang(s)) s = await flow.applyRoute(ctx, s, r.flag.flagId, 'oral');
    s = flow.recordWorkerCheck(ctx, s, 'pl', { teachBack: 'ok', misunderstood: [], answers: s.understanding.questionIds.map((questionId) => ({ questionId, correct: true })) });
    expect(s.understanding.reason).toContain('newWorker');
    expect(flow.sign(ctx, s, 'Bas').status).toBe('signedWithFallback');
  });

  it('removing a safety-critical line needs a restore or a reason', async () => {
    const env = makeCtx('work-at-height', clientFor(makeGateway()));
    let s = startJob(env.ctx, 'jd-09');
    s = flow.removeLine(env.ctx, s, 'h-09');
    expect(flow.contentBlockers(s).criticalRemoved).toBe(1);
    const restored = flow.restoreLine(env.ctx, s, 'h-09');
    expect(restored.lines.find((l) => l.lineId === 'h-09')!.origin).toBe('reused');
    expect(flow.contentBlockers(restored).criticalRemoved).toBe(0);
    s = flow.giveRemovalReason(env.ctx, s, 'h-09', 'Rekkverk på alle sider. Ingen arbeider utenfor.');
    expect(flow.contentBlockers(s).criticalRemoved).toBe(0);
    expect(s.lines.find((l) => l.lineId === 'h-09')!.removalReason).toMatch(/Rekkverk/);
  });

  it('model connection cut: the line shows an error, stays unchecked and blocks; retry works (AC-28)', async () => {
    const calls: ModelCall[] = [];
    const gw = makeGateway();
    let cut = false;
    const real = clientFor(gw, calls);
    const client: ModelClient = { call: (task, input, meta) => (cut && task === 'P4' ? Promise.reject(new Error('fetch failed')) : real.call(task, input, meta)) };
    const env = makeCtx('lifting', client);
    let s = startJob(env.ctx, 'jd-01');
    s = await flow.runNormalise(env.ctx, s);
    s = await flow.runAdapt(env.ctx, s);
    s = await flow.confirmContent(env.ctx, settle(env.ctx, s));
    cut = true;
    s = await flow.runLanguageCheck(env.ctx, s);
    const errored = s.lines.flatMap((l) => Object.entries(l.byLang).filter(([, e]) => e.checkState === 'error').map(([lang]) => `${l.lineId}:${lang}`));
    expect(errored).toHaveLength(6);
    expect(gateConditions(s, env.pack).find((c) => c.id === 'languageCheck')).toMatchObject({ ok: false, open: 6 });
    cut = false;
    for (const key of errored) {
      const [lineId, lang] = key.split(':');
      s = await flow.retryLine(env.ctx, s, lineId, lang);
    }
    expect(gateConditions(s, env.pack).find((c) => c.id === 'languageCheck')!.ok).toBe(true);
  });
});

describe('Test bench (T6, replay with scripted responses: mechanics only)', () => {
  it('produces catch counts by layer, a false-flag count and missed items per language (AC-23)', async () => {
    const pack = seedPack();
    const client = clientFor(makeGateway());
    const fx = fixtures();
    const pairs: PairFixture[] = ['seeded-errors.pl', 'seeded-errors.lt', 'controls.pl', 'controls.lt'].flatMap((k) => fx[k].pairs);
    const results: Record<string, PairResult> = {};
    for (const p of pairs) {
      const r = await checkLine(client, pack, { lineId: p.id, source: p.source, target: p.target, lang: p.lang, critical: p.critical }, { runId: 'bench-test' });
      results[p.id] = { id: p.id, flags: r.flags, backTranslation: r.backTranslation, callOrigins: [] };
    }
    for (const lang of ['pl', 'lt']) {
      const s = benchSummary(pairs, results, lang);
      expect(s).toMatchObject({ seeded: 10, controls: 10, nonGlossary: 6, caughtRulesOnly: 5, caughtAll: 9, nonGlossaryCaught: 5, controlsFlaggedRed: 0, falseFlags: 0, missed: [`${lang}-s10`] });
    }
    // Deterministic flags stand whatever the comparison says.
    const dzwig = results['pl-s01'].flags;
    expect(dzwig.map((f) => f.type)).toEqual(['FORBIDDEN_TERM']);
  });

  it('checks a pair in an unsupported language without calling a model (AC-09)', async () => {
    const calls: ModelCall[] = [];
    const e = fixtures()['edge-cases'].unsupportedLanguage;
    const r = await checkLine(clientFor(makeGateway(), calls), seedPack(), { lineId: e.id, source: e.source, target: e.target, lang: e.lang, critical: true }, { runId: 'bench-test' });
    expect(r.flags.map((f) => f.type)).toEqual(['UNSUPPORTED_LANGUAGE']);
    expect(calls).toHaveLength(0);
  });
});
