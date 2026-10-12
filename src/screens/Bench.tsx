// Test bench (F-14) and evidence exports (F-15). Group-facing: English only.
// The "observed result" and "learning or revision" fields are typed by a person.
// The tool never fills them in.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, modelClient } from '../api';
import { Button, Card, Chip, download, ErrorBox, inputClass, Layout, Notice, Spinner } from '../components/ui';
import { benchSummary, type PairFixture, type PairResult } from '../core/metrics';
import { checkLine } from '../core/pipeline/checkLine';
import { translateAndCheck } from '../core/pipeline/translate';
import { buildP1, buildP3 } from '../core/rules/payload';
import type { P1Output, P3Output } from '../core/schemas';
import type { Flag, ModelCall, ModelClient, RunRecord } from '../core/types';
import { LANG_NAMES, mapLimit, nowIso, uid } from '../core/util';
import { aiUseSummary, benchMarkdown, promptsExport, testLogCsv, testLogMarkdown, verificationSummaryMarkdown } from '../record';
import { useApp, useLog, type BenchRun, type TestLogRow } from '../state/stores';

function recording(): { client: ModelClient; calls: ModelCall[] } {
  const calls: ModelCall[] = [];
  return {
    calls,
    client: {
      async call<T>(task: Parameters<ModelClient['call']>[0], input: unknown, meta: { runId: string }) {
        const r = await modelClient.call<T>(task, input, meta);
        calls.push(r.call);
        return r;
      },
    },
  };
}
const originsOf = (calls: ModelCall[]) => [...new Set(calls.map((c) => (c.mode === 'replay' ? `replay:${c.fixtureOrigin ?? 'recorded'}` : c.mode)))];

function FlagList({ flags, onFalseAlarm }: { flags: Flag[]; onFalseAlarm?: (flag: Flag, reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  if (flags.length === 0) return <span className="font-semibold text-slate-600">no flag</span>;
  return (
    <ul className="space-y-1">
      {flags.map((f) => (
        <li key={f.flagId}>
          <Chip tone={f.reviewerVerdict?.kind === 'falseAlarm' ? 'slate' : f.severity === 'red' ? 'red' : 'amber'}>
            {f.type} · {f.raisedBy}
          </Chip>
          {f.reviewerVerdict && <span className="ml-1 text-xs font-semibold">false alarm: {f.reviewerVerdict.reason}</span>}
          <span className="block text-xs text-slate-700">{f.explanation.en}</span>
          {onFalseAlarm && !f.reviewerVerdict && (
            open === f.flagId ? (
              <span className="mt-1 flex flex-wrap gap-1">
                <input className={`${inputClass} !min-h-9 !py-1 text-sm`} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="bench-fa-reason" />
                <Button className="!min-h-9 text-sm" variant="primary" disabled={!reason.trim()} onClick={() => { onFalseAlarm(f, reason); setOpen(null); setReason(''); }} data-testid="bench-fa-save">
                  Save
                </Button>
              </span>
            ) : (
              <button type="button" className="min-h-9 text-xs font-semibold text-blue-800 underline" onClick={() => setOpen(f.flagId)} data-testid="bench-false-alarm">
                Mark false alarm (language reviewer)
              </button>
            )
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Bench() {
  const { pack, config, fixtures, reviewer } = useApp();
  const { benchRuns, addBenchRun, updateBenchRun, testLog, setTestLog } = useLog();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [langSel, setLangSel] = useState<'both' | 'pl' | 'lt'>('both');
  const [pasted, setPasted] = useState('Sperr av området under arbeidsstedet. | Wygrodź teren nad miejscem pracy.');
  const [pasteLang, setPasteLang] = useState('pl');
  const [pasteCritical, setPasteCritical] = useState(true);
  const [p3, setP3] = useState<{ id: string; text: string; out?: P3Output['lines'][number]; error?: string; origin?: string }[] | null>(null);
  const [p1, setP1] = useState<{ out?: P1Output; error?: string; origin?: string } | null>(null);

  const pairs: PairFixture[] = useMemo(() => (fixtures ? ['seeded-errors.pl', 'seeded-errors.lt', 'controls.pl', 'controls.lt'].flatMap((k) => fixtures[k]?.pairs ?? []) : []), [fixtures]);
  const confirmed = fixtures ? ['seeded-errors.pl', 'seeded-errors.lt', 'controls.pl', 'controls.lt'].every((k) => fixtures[k]?.status === 'confirmed') : false;
  if (!pack || !config || !fixtures) return <Layout title="Test bench" english>Loading …</Layout>;

  const replay = config.mode === 'replay';
  const base = (kind: BenchRun['kind'], langs: string[]): BenchRun => ({ benchId: uid('bench'), at: nowIso(), kind, packVersion: pack.version, packHash: pack.hash, promptVersions: config.promptVersions, mode: config.mode, origins: [], langs, results: {} });

  const runPairs = async (list: PairFixture[], kind: BenchRun['kind']) => {
    const langs = [...new Set(list.map((p) => p.lang))];
    const run = base(kind, langs);
    const { client, calls } = recording();
    setBusy(kind);
    setError(null);
    const started = Date.now();
    let done = 0;
    try {
      await mapLimit(list, 4, async (p) => {
        const mark = calls.length;
        try {
          const r = await checkLine(client, pack, { lineId: p.id, source: p.source, target: p.target, lang: p.lang, critical: p.critical }, { runId: run.benchId });
          run.results[p.id] = { id: p.id, flags: r.flags, backTranslation: r.backTranslation, callOrigins: originsOf(calls.slice(mark)) };
        } catch (e) {
          run.results[p.id] = { id: p.id, flags: [], error: e instanceof Error ? e.message : String(e), callOrigins: [] };
        }
        done += 1;
        setProgress(`${done} of ${list.length} pairs checked`);
      });
      run.origins = originsOf(calls);
      run.extra = { totalMs: Date.now() - started, pairs: list.length, fixtures: kind === 'pasted' ? list : undefined };
      addBenchRun(run);
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  const latest = (kind: BenchRun['kind']) => benchRuns.find((b) => b.kind === kind);
  const t6 = latest('pairs');
  const pastedRun = latest('pasted');
  const edgeRun = latest('edge');
  const pastedFixtures = ((pastedRun?.extra as any)?.fixtures ?? []) as PairFixture[];

  const markFalseAlarm = (run: BenchRun, pairId: string, lang: string) =>
    reviewer?.role === 'language' && reviewer.lang === lang
      ? (flag: Flag, reason: string) => {
          const next: BenchRun = { ...run, results: { ...run.results, [pairId]: { ...(run.results[pairId] as PairResult), flags: run.results[pairId]!.flags.map((f) => (f.flagId === flag.flagId ? { ...f, reviewerVerdict: { kind: 'falseAlarm' as const, reason } } : f)) } } };
          updateBenchRun(next);
          useLog.getState().add({ runId: run.benchId, testId: 'T6', arm: 'flagship', actor: 'reviewer', type: 'flag_false_alarm', step: 'bench', languagePair: `nb-${lang}`, flagType: flag.type, packVersion: pack.version });
        }
      : undefined;

  const parsePasted = (): PairFixture[] =>
    pasted
      .split('\n')
      .map((l) => l.split('|').map((x) => x.trim()))
      .filter((p) => p.length >= 2 && p[0] && p[1])
      .map((p, i) => ({ id: `paste-${i + 1}`, lang: pasteLang.trim(), kind: 'control' as const, source: p[0], target: p[1], critical: pasteCritical }));

  const runEdge = async () => {
    const run = base('edge', ['ro', 'pl']);
    const { client, calls } = recording();
    setBusy('edge');
    setError(null);
    const e = fixtures['edge-cases'];
    try {
      const u = e.unsupportedLanguage;
      const r1 = await checkLine(client, pack, { lineId: u.id, source: u.source, target: u.target, lang: u.lang, critical: true }, { runId: run.benchId });
      run.results[u.id] = { id: u.id, flags: r1.flags, callOrigins: [] };
      const m = e.missingGlossaryTerm;
      try {
        const r2 = await translateAndCheck(client, pack, { lineId: m.id, source: m.source, lang: m.lang, critical: true, enforce: false, attempt: 0 }, { runId: run.benchId });
        run.results[m.id] = { id: m.id, flags: r2.flags, backTranslation: `${r2.text} ← ${r2.backTranslation ?? ''}`, callOrigins: originsOf(calls) };
      } catch (err) {
        run.results[m.id] = { id: m.id, flags: [], error: err instanceof Error ? err.message : String(err), callOrigins: [] };
      }
      run.origins = originsOf(calls);
      addBenchRun(run);
    } finally {
      setBusy(null);
    }
  };

  const runAmbiguity = async () => {
    setBusy('ambiguity');
    const lines = fixtures['ambiguous-lines'] as { id: string; text: string; critical: boolean }[];
    const out: NonNullable<typeof p3> = [];
    for (const l of lines) {
      try {
        const r = await modelClient.call<P3Output>('P3', buildP3([{ lineId: l.id, textNb: l.text, critical: l.critical }]), { runId: 'bench-ambiguity' });
        out.push({ id: l.id, text: l.text, out: r.parsed.lines[0], origin: originsOf([r.call])[0] });
      } catch (e) {
        out.push({ id: l.id, text: l.text, error: e instanceof Error ? e.message : String(e) });
      }
    }
    setP3(out);
    setBusy(null);
  };

  const runSlang = async () => {
    setBusy('slang');
    const job = (fixtures['job-descriptions'] as any[]).find((j) => j.id === 'jd-03');
    const template = pack.templates.find((t) => t.templateId === job.templateId)!;
    try {
      const r = await modelClient.call<P1Output>('P1', buildP1({ parameterValues: job.parameterValues, freeText: job.freeText, questions: [] }, template), { runId: 'bench-slang' });
      setP1({ out: r.parsed, origin: originsOf([r.call])[0] });
    } catch (e) {
      setP1({ error: e instanceof Error ? e.message : String(e) });
    }
    setBusy(null);
  };

  // ---- Appendix A test log ----
  const tests = fixtures.tests as { id: string; type: string; scenario: string; expected: string; where: string; fixtureIds: string[] }[];
  const addRows = (round: number) =>
    setTestLog([...testLog, ...tests.map((x): TestLogRow => ({ rowId: uid('row'), number: round > 1 ? `${x.id} (round ${round})` : x.id, caseType: x.type, scenario: x.scenario, expected: x.expected, observed: '', learning: '' }))]);
  const setRow = (rowId: string, patch: Partial<TestLogRow>) => setTestLog(testLog.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));

  const save = async (name: string, content: string, mime = 'text/markdown;charset=utf-8') => {
    download(name, content, mime);
    try {
      const r = await api.saveExport(name, content);
      setNote(`Saved to ${r.file} and downloaded.`);
    } catch {
      setNote('Downloaded. (Could not write to evidence/exports on the server.)');
    }
  };
  const exportAiUse = async () => {
    setBusy('export');
    try {
      const [list, prompts] = await Promise.all([api.runs(), api.prompts()]);
      const records = (await Promise.all(list.map((r) => api.run(r.runId).catch(() => null)))).filter((r): r is RunRecord => Boolean(r));
      await save('ai-use-summary.md', aiUseSummary(records, benchRuns, config, prompts.prompts));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };
  const exportPrompts = async () => {
    const p = await api.prompts();
    await save('prompts-as-used.md', promptsExport(p.prompts, p.changelog));
  };

  const jobs = fixtures['job-descriptions'] as any[];
  const selected = pairs.filter((p) => langSel === 'both' || p.lang === langSel);

  return (
    <Layout title="Test bench" wide english>
      <div className="space-y-5">
        {replay ? (
          <Notice tone="violet">
            <strong>Replay mode: nothing on this screen is a test result.</strong> The rules layer (D1 glossary, D2 numbers, D4 language) is computed here and now by code. The back-translation and comparison answers are stored responses
            {config.fixtures.recorded === 0 ? ', written by the builder (scripted), not produced by a model' : ''}. Use this mode to learn the bench and to check that it works. Evidence for the report needs live mode with an API key.
          </Notice>
        ) : (
          <Notice tone="green">Live mode ({config.provider}). Results are computed with real model calls and logged with model name and prompt version.</Notice>
        )}
        {!confirmed && <Notice tone="amber"><strong>Unconfirmed fixtures.</strong> No native speaker has confirmed that each seeded error is wrong and each control is right. Label any T6 result accordingly.</Notice>}
        {error && <ErrorBox message={error} />}
        {note && <Notice tone="green">{note}</Notice>}

        {/* ---------- T6 ---------- */}
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">T6 Pair check: seeded errors and clean controls</h2>
          <p className="text-sm text-slate-700">Runs the check engine on each source and target pair. Pass marks set in advance: at least 8 of 10 seeded errors flagged; at most 2 of 10 controls flagged red; at least 2 of the non-glossary errors flagged.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${inputClass} !w-auto`} value={langSel} onChange={(e) => setLangSel(e.target.value as 'both')} aria-label="Language" data-testid="bench-lang">
              <option value="both">Polish and Lithuanian</option>
              <option value="pl">Polish</option>
              <option value="lt">Lithuanian</option>
            </select>
            <Button variant="primary" disabled={Boolean(busy)} onClick={() => runPairs(selected, 'pairs')} data-testid="bench-run-t6">
              Run {selected.length} pairs
            </Button>
            {busy === 'pairs' && <Spinner label={progress || 'Checking …'} />}
          </div>

          {t6 && (
            <div className="space-y-3" data-testid="bench-t6-result">
              <p className="text-sm text-slate-700">
                Run {t6.at.slice(0, 19).replace('T', ' ')} · pack v{t6.packVersion} · prompts {Object.entries(t6.promptVersions).filter(([k]) => k === 'P5' || k === 'P6').map(([k, v]) => `${k} ${v}`).join(', ')} · mode {t6.mode}
                {t6.origins.length ? ` (${t6.origins.join(', ')})` : ''} · machine time {(((t6.extra as any)?.totalMs ?? 0) / 1000).toFixed(1)} s for {(t6.extra as any)?.pairs} pairs
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {t6.langs.map((lang) => {
                  const s = benchSummary(pairs, t6.results, lang);
                  return (
                    <div key={lang} className="rounded-lg border border-slate-300 p-3 text-sm" data-testid={`bench-summary-${lang}`}>
                      <h3 className="text-base font-bold">{LANG_NAMES[lang]?.en}</h3>
                      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                        <dt>Seeded errors flagged, rules alone (D1, D2)</dt><dd className="font-bold" data-testid={`caught-rules-${lang}`}>{s.caughtRulesOnly} of {s.seeded}</dd>
                        <dt>Seeded errors flagged, rules plus back-translation</dt><dd className="font-bold" data-testid={`caught-all-${lang}`}>{s.caughtAll} of {s.seeded}</dd>
                        <dt>Non-glossary errors flagged</dt><dd className="font-bold">{s.nonGlossaryCaught} of {s.nonGlossary}</dd>
                        <dt>Controls flagged red</dt><dd className="font-bold">{s.controlsFlaggedRed} of {s.controls}</dd>
                        <dt>Pairs with a reviewer false-alarm verdict</dt><dd className="font-bold">{s.reviewerFalseAlarms}</dd>
                        <dt>False flags (controls flagged red, plus reviewer false alarms)</dt><dd className="font-bold" data-testid={`false-flags-${lang}`}>{s.falseFlags}</dd>
                        <dt>Missed</dt><dd className="font-bold" data-testid={`missed-${lang}`}>{s.missed.join(', ') || 'none'}</dd>
                        {s.errors > 0 && (<><dt className="text-rose-800">Pairs that could not be checked</dt><dd className="font-bold text-rose-800">{s.errors}</dd></>)}
                      </dl>
                    </div>
                  );
                })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="whitespace-nowrap py-1 pr-2">Pair</th><th className="whitespace-nowrap pr-2">Seeded error</th><th className="pr-2">Source</th><th className="pr-2">Target</th><th className="pr-2">Back-translation</th><th>Flags (type · layer)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.filter((p) => t6.langs.includes(p.lang)).map((p) => {
                      const r = t6.results[p.id];
                      return (
                        <tr key={p.id} className="border-b border-slate-100 align-top" data-testid={`bench-row-${p.id}`}>
                          <td className="py-1 pr-2 font-semibold">{p.id}<br /><Chip tone={p.kind === 'seeded' ? 'amber' : 'slate'}>{p.kind}</Chip></td>
                          <td className="whitespace-nowrap pr-2">{p.errorType ?? '–'}</td>
                          <td className="pr-2">{p.source}</td>
                          <td className="pr-2" lang={p.lang}>{p.target}</td>
                          <td className="pr-2">{r?.backTranslation ?? '–'}</td>
                          <td>{r?.error ? <span className="font-semibold text-rose-800">Error: {r.error}</span> : <FlagList flags={r?.flags ?? []} onFalseAlarm={markFalseAlarm(t6, p.id, p.lang)} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {reviewer?.role !== 'language' && <p className="text-xs text-slate-600">To mark a flag as a false alarm, start a language-reviewer session on the Review screen first. Only a language reviewer of that language can do this.</p>}
              <Button onClick={() => save(`bench-${t6.benchId}.md`, benchMarkdown(t6, pairs, confirmed))} data-testid="bench-export">Export this result</Button>
            </div>
          )}

          {benchRuns.filter((b) => b.kind === 'pairs').length > 1 && (
            <details>
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">Earlier runs (before-and-after evidence for a revision)</summary>
              <table className="mt-1 w-full text-left text-sm">
                <thead><tr className="border-b border-slate-300"><th className="py-1 pr-2">When</th><th className="pr-2">Pack</th><th className="pr-2">Prompts</th><th className="pr-2">Mode</th><th>Flagged (rules alone → with back-translation), false flags</th></tr></thead>
                <tbody>
                  {benchRuns.filter((b) => b.kind === 'pairs').map((b) => (
                    <tr key={b.benchId} className="border-b border-slate-100">
                      <td className="py-1 pr-2">{b.at.slice(0, 19).replace('T', ' ')}</td><td className="pr-2">v{b.packVersion}</td>
                      <td className="pr-2">{Object.entries(b.promptVersions).map(([k, v]) => `${k} ${v}`).join(', ')}</td><td className="pr-2">{b.mode}</td>
                      <td>{b.langs.map((l) => { const s = benchSummary(pairs, b.results, l); return `${l}: ${s.caughtRulesOnly} → ${s.caughtAll} of ${s.seeded}, ${s.falseFlags} false`; }).join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </Card>

        {/* ---------- pasted pairs ---------- */}
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Check any translation (pasted pairs)</h2>
          <p className="text-sm text-slate-700">One pair per line: Norwegian source, a vertical bar, then the translation. The translation can come from any other tool.</p>
          <textarea className={inputClass} rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} data-testid="paste-pairs" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold">Language code <input className={`${inputClass} !inline-block !w-24`} value={pasteLang} onChange={(e) => setPasteLang(e.target.value)} data-testid="paste-lang" /></label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={pasteCritical} onChange={(e) => setPasteCritical(e.target.checked)} /> Safety-critical</label>
            <Button variant="primary" disabled={Boolean(busy) || parsePasted().length === 0} onClick={() => runPairs(parsePasted(), 'pasted')} data-testid="paste-run">Check</Button>
            {busy === 'pasted' && <Spinner label={progress || 'Checking …'} />}
          </div>
          {pastedRun && (
            <ul className="space-y-2" data-testid="paste-result">
              {pastedFixtures.map((p) => {
                const r = pastedRun.results[p.id];
                return (
                  <li key={p.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                    <p><strong>{p.source}</strong> → <span lang={p.lang}>{p.target}</span> ({p.lang})</p>
                    {r?.backTranslation && <p className="text-slate-700">Back-translation: {r.backTranslation}</p>}
                    {r?.error ? <p className="font-semibold text-rose-800">Error: {r.error}</p> : <FlagList flags={r?.flags ?? []} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ---------- T4, T7, T3 ---------- */}
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">T4 Edge cases: unsupported language, missing glossary term</h2>
          <Button variant="primary" disabled={Boolean(busy)} onClick={runEdge} data-testid="bench-run-edge">Run both cases</Button>
          {edgeRun && (
            <ul className="space-y-2 text-sm" data-testid="bench-edge-result">
              {[fixtures['edge-cases'].unsupportedLanguage, fixtures['edge-cases'].missingGlossaryTerm].map((c: any) => {
                const r = edgeRun.results[c.id];
                return (
                  <li key={c.id} className="rounded-lg bg-slate-50 p-2">
                    <p className="font-semibold">{c.note}</p>
                    <p>{c.source} {c.target ? `→ ${c.target}` : ''} ({c.lang})</p>
                    {r?.backTranslation && <p className="text-slate-700">Translation ← back-translation: {r.backTranslation}</p>}
                    {r?.error ? <p className="font-semibold text-rose-800">Error: {r.error}</p> : <FlagList flags={r?.flags ?? []} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">T7 Ambiguous Norwegian instructions</h2>
          <p className="text-sm text-slate-700">Each line goes through the ambiguity check (P3) on its own. In the foreman flow this happens before any translation, and a safety-critical line is not translated until it is reworded.</p>
          <Button variant="primary" disabled={Boolean(busy)} onClick={runAmbiguity} data-testid="bench-run-ambiguity">Run the ambiguity check</Button>
          {p3 && (
            <ul className="space-y-2 text-sm" data-testid="bench-ambiguity-result">
              {p3.map((l) => (
                <li key={l.id} className="rounded-lg bg-slate-50 p-2">
                  <p className="font-semibold">{l.text}</p>
                  {l.error ? <p className="font-semibold text-rose-800">Error: {l.error}</p> : (
                    <>
                      <Chip tone={l.out?.status === 'ambiguous' ? 'amber' : 'green'}>{l.out?.status === 'ambiguous' ? `SOURCE_AMBIGUOUS · ${l.out.category ?? ''}` : 'clear'}</Chip> <span className="text-xs text-slate-600">{l.origin}</span>
                      {l.out?.reasonEn && <p>{l.out.reasonEn}</p>}
                      {l.out?.suggestion && <p>Suggested wording: {l.out.suggestion}</p>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">T3 Slang and typos</h2>
          <p className="text-sm text-slate-700">«{jobs.find((j) => j.id === 'jd-03')?.freeText}»</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={Boolean(busy)} onClick={runSlang} data-testid="bench-run-slang">Run input normalisation (P1)</Button>
            <Link to={`/foreman/${uid('sja')}?test=T3&fixture=jd-03`} className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">Or run it through the foreman flow</Link>
          </div>
          {p1 && (p1.error ? <ErrorBox message={p1.error} /> : (
            <div className="rounded-lg bg-slate-50 p-2 text-sm" data-testid="bench-slang-result">
              <p className="text-xs text-slate-600">{p1.origin}</p>
              <ul className="ml-5 list-disc">{p1.out?.specifics.map((s, i) => <li key={i}>{s.text} {s.status === 'unclear' && <Chip tone="amber">unclear: not guessed</Chip>}</li>)}</ul>
              <p className="mt-1 font-semibold">Clarifying questions: {p1.out?.questions.length ?? 0}</p>
              <ul className="ml-5 list-disc">{p1.out?.questions.map((q, i) => <li key={i}>{q.question} [{q.options.join(' / ')}]</li>)}</ul>
            </div>
          ))}
        </Card>

        {/* ---------- foreman tests ---------- */}
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">T1, T2, T5, T8 Tests with people</h2>
          <p className="text-sm text-slate-700">Start a foreman run with a test number, so that its log events and its saved record carry that number. Use the observer control in the corner of the foreman screens to count assists. T5 and T8 use the baseline timer and the standalone question set.</p>
          <ul className="space-y-1">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1"><strong>{j.id}</strong> {j.title.en} <Chip tone={j.replay === 'live-only' ? 'slate' : 'violet'}>{j.replay === 'scripted' ? 'stored responses' : j.replay === 'no-model' ? 'no model needed' : 'live mode only'}</Chip></span>
                {(j.tests as string[]).filter((x) => x === 'T1' || x === 'T2').map((x) => (
                  <Link key={x} to={`/foreman/${uid('sja')}?test=${x}&fixture=${j.id}`} className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline" data-testid={`start-${x}-${j.id}`}>Start as {x}</Link>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-sm"><Link to="/baseline" className="font-semibold text-blue-800 underline">Baseline timer (T5, T8)</Link></p>
        </Card>

        {/* ---------- Appendix A ---------- */}
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Test log (Appendix A)</h2>
          <p className="text-sm text-slate-700">Six columns, exactly as the course asks. Type what you observed and what you learned. These two fields start empty and the tool never fills them in.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => addRows(testLog.length === 0 ? 1 : Math.floor(testLog.length / tests.length) + 1)} data-testid="testlog-add">
              {testLog.length === 0 ? 'Create rows T1–T8' : 'Add rows for another round'}
            </Button>
            <Button variant="primary" disabled={testLog.length === 0} onClick={() => save('appendix-a-test-log.md', testLogMarkdown(testLog))} data-testid="testlog-export-md">Export Markdown</Button>
            <Button disabled={testLog.length === 0} onClick={() => save('appendix-a-test-log.csv', testLogCsv(testLog), 'text/csv;charset=utf-8')} data-testid="testlog-export-csv">Export CSV</Button>
          </div>
          {testLog.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm" data-testid="testlog-table">
                <thead><tr className="border-b border-slate-300">{['Number', 'Case type', 'Scenario or input', 'Expected outcome', 'Observed result', 'Learning or revision'].map((h) => <th key={h} className="py-1 pr-2">{h}</th>)}<th /></tr></thead>
                <tbody>
                  {testLog.map((r) => (
                    <tr key={r.rowId} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2 font-semibold">{r.number}</td><td className="pr-2">{r.caseType}</td>
                      <td className="pr-2"><textarea className={`${inputClass} text-sm`} rows={4} value={r.scenario} onChange={(e) => setRow(r.rowId, { scenario: e.target.value })} aria-label={`Scenario ${r.number}`} /></td>
                      <td className="pr-2"><textarea className={`${inputClass} text-sm`} rows={4} value={r.expected} onChange={(e) => setRow(r.rowId, { expected: e.target.value })} aria-label={`Expected ${r.number}`} /></td>
                      <td className="pr-2"><textarea className={`${inputClass} text-sm`} rows={4} value={r.observed} onChange={(e) => setRow(r.rowId, { observed: e.target.value })} placeholder="Typed by a person" aria-label={`Observed ${r.number}`} data-testid="testlog-observed" /></td>
                      <td className="pr-2"><textarea className={`${inputClass} text-sm`} rows={4} value={r.learning} onChange={(e) => setRow(r.rowId, { learning: e.target.value })} placeholder="Typed by a person" aria-label={`Learning ${r.number}`} data-testid="testlog-learning" /></td>
                      <td><button type="button" className="min-h-11 text-xs font-semibold text-rose-800 underline" onClick={() => setTestLog(testLog.filter((x) => x.rowId !== r.rowId))}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ---------- other exports ---------- */}
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Evidence exports (Appendix B and report)</h2>
          <p className="text-sm text-slate-700">Each file is downloaded and also written to <code>evidence/exports/</code>. Each starts with the prototype banner. Per-run evidence files are exported from a run's record.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={Boolean(busy)} onClick={exportAiUse} data-testid="export-ai-use">AI-use summary</Button>
            <Button onClick={exportPrompts} data-testid="export-prompts">Prompts as used, with versions</Button>
            <Button onClick={() => save('verification-summary.md', verificationSummaryMarkdown(pack))}>Verification summary</Button>
            <Link to="/runs" className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">Saved runs</Link>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
