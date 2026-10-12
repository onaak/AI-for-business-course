// Writes the demo replay fixtures (origin "scripted") by driving the real pipeline
// through the real gateway in record mode, with the scripted provider in place of a
// model. Run: npm run fixtures:demo
//
// These fixtures are NOT model output and are NOT evidence. See scripts/demo-script.ts.
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures, loadHazards, loadSeedPack } from '../server/data';
import { Gateway } from '../server/gateway';
import { allFlags, routeDisabled } from '../src/core/flags';
import * as flow from '../src/core/flow';
import type { PairFixture } from '../src/core/metrics';
import { checkLine } from '../src/core/pipeline/checkLine';
import { translateAndCheck } from '../src/core/pipeline/translate';
import { buildP3 } from '../src/core/rules/payload';
import type { ModelClient, Sja, Task } from '../src/core/types';
import { registerBenchPairs, SCRIPTED_MODEL, scriptedProvider } from './demo-script';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const fixturesDir = path.join(dataDir, 'fixtures', 'llm');

const models = Object.fromEntries(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((t) => [t, SCRIPTED_MODEL])) as Record<Task, string>;
const gw = new Gateway({
  mode: 'record',
  provider: scriptedProvider,
  models,
  temperature: null,
  promptsDir: path.join(root, 'prompts'),
  fixturesDir,
  evidenceDir: mkdtempSync(path.join(os.tmpdir(), 'sja-fixtures-')),
  recordOrigin: 'scripted',
});
// Remove earlier scripted fixtures. Recorded ones (from a live model) are kept.
const removed = gw.store.removeByOrigin('scripted');

const client: ModelClient = {
  async call<T>(task: Task, input: unknown, meta: { runId: string }) {
    const call = await gw.call(task, input, meta.runId);
    return { parsed: call.parsed as T, call };
  },
};

const pack = loadSeedPack(dataDir);
const hazards = loadHazards(dataDir);
const fixtures = loadFixtures(dataDir) as any;
const jobs = fixtures['job-descriptions'] as any[];

function ctxFor(templateId: string): flow.FlowCtx {
  return {
    pack,
    template: pack.templates.find((t) => t.templateId === templateId)!,
    hazards: hazards.find((h) => h.templateId === templateId),
    client,
    log: () => {},
    trace: () => {},
  };
}
function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`fixtures:demo assertion failed: ${message}`);
}
function start(id: string, extraLangs: string[] = []) {
  const job = jobs.find((j) => j.id === id);
  const ctx = ctxFor(job.templateId);
  const sja = flow.createSja(
    pack,
    ctx.template,
    {
      header: { siteLabel: 'Demo', date: '2026-10-05', foremanRole: 'Bas' },
      parameterValues: job.parameterValues,
      freeText: job.freeText,
      languages: [...job.languages, ...extraLangs],
      crewFlags: job.crewFlags,
      fixtureId: id,
    },
    `fixture-${id}`,
  );
  return { ctx, sja };
}
function settleContent(ctx: flow.FlowCtx, s: Sja): Sja {
  for (const l of s.lines.filter((x) => x.aiSuggestion === 'open')) s = flow.decideSuggestion(ctx, s, l.lineId, true);
  for (const l of s.lines.filter((x) => x.techRecheck === 'open')) s = flow.confirmTechRecheck(ctx, s, l.lineId);
  return s;
}
const openLang = (s: Sja) => allFlags(s).filter((r) => r.lang !== 'nb' && r.flag.status === 'open');

async function main() {
  // jd-01: happy path
  {
    let { ctx, sja: s } = start('jd-01', ['en']);
    s = await flow.runNormalise(ctx, s);
    s = await flow.runAdapt(ctx, s);
    assert(flow.originCounts(s).changed === 1 && flow.originCounts(s).new === 2, 'jd-01: one changed and two new lines');
    s = settleContent(ctx, s);
    s = await flow.confirmContent(ctx, s);
    assert(s.contentConfirmed, 'jd-01: content confirmed');
    s = await flow.runLanguageCheck(ctx, s);
    const open = openLang(s);
    assert(open.length === 1 && open[0].lang === 'lt' && open[0].flag.type === 'GLOSSARY_MISMATCH', `jd-01: exactly one Lithuanian glossary flag (got ${open.map((o) => `${o.lang}:${o.flag.type}`).join(', ')})`);
    s = await flow.applyRoute(ctx, s, open[0].flag.flagId, 'approvedTerm');
    assert(openLang(s).length === 0, 'jd-01: re-check is clean');
    assert(s.understanding.required, 'jd-01: understanding check required');
  }
  // jd-02: AI suggestion, meaning shift, two failed attempts
  {
    let { ctx, sja: s } = start('jd-02');
    s = await flow.runNormalise(ctx, s);
    s = await flow.runAdapt(ctx, s);
    assert(s.lines.some((l) => l.aiSuggestion === 'open'), 'jd-02: an unsourced AI suggestion');
    s = settleContent(ctx, s);
    s = await flow.confirmContent(ctx, s);
    s = await flow.runLanguageCheck(ctx, s);
    const base = s;
    const lt = openLang(base).find((r) => r.lang === 'lt' && r.flag.type === 'GLOSSARY_MISMATCH');
    const pl = openLang(base).find((r) => r.lang === 'pl' && r.flag.type === 'MEANING_SHIFT' && r.line?.critical);
    const amber = openLang(base).find((r) => r.lang === 'pl' && r.flag.severity === 'amber');
    assert(lt && pl && amber, 'jd-02: Lithuanian glossary flag, Polish meaning shift (red) and an amber flag');
    let b1 = await flow.applyRoute(ctx, base, lt.flag.flagId, 'approvedTerm');
    b1 = await flow.applyRoute(ctx, b1, lt.flag.flagId, 'approvedTerm');
    const after = allFlags(b1).find((r) => r.flag.flagId === lt.flag.flagId)!;
    assert(after.flag.status === 'open' && routeDisabled(after.flag, 'approvedTerm'), 'jd-02: route disabled after two failed attempts');
    const plain = pl.line!.plainSuggestion;
    assert(plain, 'jd-02: a shorter wording is offered');
    const b2 = await flow.applyRoute(ctx, base, pl.flag.flagId, 'rewrite', { text: plain });
    assert(!openLang(b2).some((r) => r.lang === 'pl' && r.line?.lineId === pl.line!.lineId), 'jd-02: rewrite clears the Polish flag');
  }
  // jd-03: slang, clarifying questions
  {
    let { ctx, sja: s } = start('jd-03');
    s = await flow.runNormalise(ctx, s);
    assert(s.questions.length === 2 && flow.specificsBlockers(s).unclear === 2, 'jd-03: two questions, two unclear details');
    s = flow.answerQuestion(s, s.questions[0].id, 'Gjennom porten');
    s = flow.answerQuestion(s, s.questions[1].id, 'Anhukeren kontrollerer løftestroppene før bruk');
    s = await flow.runNormalise(ctx, s);
    assert(flow.specificsBlockers(s).unclear === 0 && flow.specificsBlockers(s).openQuestions === 0, 'jd-03: clear after answers');
    s = await flow.runAdapt(ctx, s);
    s = settleContent(ctx, s);
    s = await flow.confirmContent(ctx, s);
    s = await flow.runLanguageCheck(ctx, s);
    assert(openLang(s).length === 0, 'jd-03: no language flags');
  }
  // jd-04: ambiguous line, missing glossary term, unsupported language
  {
    let { ctx, sja: s } = start('jd-04');
    s = await flow.runNormalise(ctx, s);
    s = await flow.runAdapt(ctx, s);
    const amb = allFlags(s).find((r) => r.flag.type === 'SOURCE_AMBIGUOUS' && r.flag.status === 'open');
    assert(amb?.line && amb.flag.evidence.suggestion, 'jd-04: ambiguity flag with a suggestion');
    const blocked = await flow.confirmContent(ctx, settleContent(ctx, s));
    assert(!blocked.contentConfirmed, 'jd-04: content cannot be confirmed while a critical line is ambiguous');
    s = flow.editLine(ctx, s, amb.line.lineId, amb.flag.evidence.suggestion!);
    s = settleContent(ctx, s);
    s = await flow.confirmContent(ctx, s);
    assert(s.contentConfirmed, 'jd-04: content confirmed after rewrite');
    s = await flow.runLanguageCheck(ctx, s);
    assert(s.sjaFlags.some((f) => f.type === 'UNSUPPORTED_LANGUAGE' && f.lang === 'ro'), 'jd-04: Romanian is unsupported');
    assert(openLang(s).filter((r) => r.flag.type === 'TERM_NOT_IN_GLOSSARY').length === 2, 'jd-04: missing glossary term flagged in both languages');
  }
  // Test bench: pairs, edge cases, ambiguous lines
  const pairs: PairFixture[] = ['seeded-errors.pl', 'seeded-errors.lt', 'controls.pl', 'controls.lt'].flatMap((k) => fixtures[k].pairs);
  registerBenchPairs(pairs);
  for (const p of pairs) {
    await checkLine(client, pack, { lineId: p.id, source: p.source, target: p.target, lang: p.lang, critical: p.critical }, { runId: 'fixture-bench' });
  }
  const edge = fixtures['edge-cases'];
  await translateAndCheck(client, pack, { lineId: edge.missingGlossaryTerm.id, source: edge.missingGlossaryTerm.source, lang: 'pl', critical: true, enforce: false, attempt: 0 }, { runId: 'fixture-bench' });
  for (const a of fixtures['ambiguous-lines'] as any[]) {
    await client.call('P3', buildP3([{ lineId: a.id, textNb: a.text, critical: a.critical }]), { runId: 'fixture-bench' });
  }
  const n = gw.store.count();
  console.log(`Removed ${removed} old scripted fixtures. Store now holds ${n.total} fixtures (${n.scripted} scripted, ${n.recorded} recorded).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
