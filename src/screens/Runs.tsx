// Saved runs (/runs) and the traceable record of one run (/runs/:runId).
// A saved run file is self-contained: opening it and stepping through its trace
// needs no model and no internet (F-18, AC-25).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type RunSummary } from '../api';
import { CriticalMark, langName, OriginBadge, SectionHeading, SourceRef, sourceText } from '../components/sja';
import { HelpEn } from '../components/HelpEn';
import { TracePanel } from '../components/TracePanel';
import { Button, Card, Chip, Collapsible, download, ErrorBox, Icon, Layout, Notice, Spinner } from '../components/ui';
import { activeLines, allFlags } from '../core/flags';
import { FOREMAN_CATEGORIES, fmtDuration, foremanTime, judgedCounts, PHASE_OF, TIME_CATEGORIES, TOTAL_CATEGORIES, totalTime, unverifiedReuse } from '../core/metrics';
import { findSourceTerms } from '../core/rules/glossary';
import { linesForQuestion, needsObservation, upgradeSja } from '../core/rules/understanding';
import { observationUnsaved, saveRun } from './foreman/useWizard';
import { SECTIONS, type ReviewerJudgements, type RunRecord } from '../core/types';
import { useT, useUiLang } from '../i18n';
import { buildRunRecord, lineLangLabel, modeLabel, recordToMarkdown } from '../record';
import { PrivacyPanel } from '../components/Privacy';
import { useApp, useFieldMode, useSjas } from '../state/stores';

export function RunsList() {
  const t = useT();
  const ui = useUiLang();
  const pack = useApp((s) => s.pack);
  const jobName = (templateId: string) => pack?.templates.find((x) => x.templateId === templateId)?.jobType[ui] ?? templateId;
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const local = Object.values(useSjas((s) => s.sjas));
  const load = () => api.runs().then(setRuns).catch((e) => setError(String(e.message ?? e)));
  useEffect(() => {
    void load();
  }, []);
  const unsaved = local.filter((s) => !(runs ?? []).some((r) => r.runId === s.sjaId));

  return (
    <Layout title={t('runs.title')} wide>
      <div className="space-y-4">
        <p className="text-base text-slate-700">{t('runs.intro')}</p>
        {error && <ErrorBox message={error} onRetry={load} retryLabel={t('common.retry')} />}
        {!runs && !error && <Spinner label={t('common.loading')} />}
        {runs && runs.length === 0 && <Notice>{t('runs.none')}</Notice>}
        <ul className="space-y-2" data-testid="runs-list">
          {(runs ?? []).map((r) => (
            <li key={r.runId}>
              <Link to={`/runs/${r.runId}`} className="block rounded-xl border border-slate-300 bg-white p-3 hover:border-blue-600" data-testid="run-link">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-base">{jobName(r.templateId)} · {r.savedAt.slice(0, 16).replace('T', ' ')}</strong>
                  <Chip tone={r.status.startsWith('signed') ? 'green' : 'amber'}>{t(`status.${r.status}`)}</Chip>
                  {r.testId && <Chip tone="blue">{r.testId}</Chip>}
                  {r.fixtureId && <Chip tone="slate">{r.fixtureId}</Chip>}
                  {r.fixtureOrigins.map((o) => (
                    <Chip key={o} tone={o.startsWith('replay') ? 'violet' : 'green'}>
                      {o === 'replay:scripted' ? `${t('mode.replay')}: ${t('mode.scripted')}` : o === 'replay:recorded' ? `${t('mode.replay')}: ${t('mode.recorded')}` : t('mode.live')}
                    </Chip>
                  ))}
                </span>
                <span className="mt-1 block text-sm text-slate-700">
                  {r.languages.map((l) => langName(l, ui)).join(', ')} · {r.templateId} · {r.runId}
                  {r.note ? ` · ${r.note}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {unsaved.length > 0 && (
          <Card tone="quiet">
            <h2 className="text-base font-bold">{t('runs.unsaved')}</h2>
            <ul className="mt-1 space-y-1">
              {unsaved.map((s) => (
                <li key={s.sjaId}>
                  <Link to={`/runs/${s.sjaId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 underline">
                    {jobName(s.templateId)} · {s.createdAt.slice(0, 16).replace('T', ' ')} · {t(`status.${s.status}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function Judgements({ rec, onSave }: { rec: RunRecord; onSave: (j: ReviewerJudgements) => void }) {
  const t = useT();
  const ui = useUiLang();
  const reviewer = useApp((s) => s.reviewer);
  const pack = useApp((s) => s.pack);
  const [j, setJ] = useState<ReviewerJudgements>(rec.judgements ?? { terms: {}, residual: {}, routes: {} });
  const counts = judgedCounts(rec.sja, j);
  const lang = reviewer?.lang;
  const lines = activeLines(rec.sja).filter((l) => (l.origin === 'changed' || l.origin === 'new') && lang && l.byLang[lang]?.text);
  const flags = allFlags(rec.sja).filter((r) => r.lang === lang && r.flag.resolvedBy === 'foreman');
  const tri = (value: boolean | undefined, set: (v: boolean) => void, yes: string, no: string) => (
    <span className="inline-flex overflow-hidden rounded-lg border border-slate-400">
      <button type="button" aria-pressed={value === true} onClick={() => set(true)} className={`min-h-11 px-3 text-sm font-semibold ${value === true ? 'bg-emerald-700 text-white' : 'bg-white'}`}>
        {yes}
      </button>
      <button type="button" aria-pressed={value === false} onClick={() => set(false)} className={`min-h-11 px-3 text-sm font-semibold ${value === false ? 'bg-rose-700 text-white' : 'bg-white'}`}>
        {no}
      </button>
    </span>
  );

  return (
    <div className="no-print space-y-3" data-testid="judgements">
      <p className="text-sm text-slate-700">{t('judge.intro')}</p>
      <ul className="text-sm">
        <li>{t('rec.termAccuracy')}: <strong>{counts.termAccuracy.n} {t('common.of')} {counts.termAccuracy.of}</strong></li>
        <li>{t('rec.residual')}: <strong>{counts.residualCritical.n} {t('common.of')} {counts.residualCritical.of}</strong></li>
        <li>{t('rec.correctRoute')}: <strong>{counts.correctRoute.n} {t('common.of')} {counts.correctRoute.of}</strong></li>
      </ul>
      {reviewer?.role !== 'language' || !lang ? (
        <Notice tone="amber">{t('judge.needReviewer')}</Notice>
      ) : (
        <>
          <p className="text-sm font-semibold">
            {t('judge.as')}: {langName(lang, ui)} · {reviewer.outsideGroup ? t('judge.outside') : t('judge.inside')}
          </p>
          {lines.map((l) => {
            const terms = pack ? findSourceTerms(l.textNb, pack.glossary) : [];
            return (
              <div key={l.lineId} className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold">{l.textNb}</p>
                <p lang={lang}>{l.byLang[lang]!.text}</p>
                {terms.map(({ term }) => {
                  const key = `${l.lineId}|${lang}|${term.termId}`;
                  return (
                    <p key={key} className="flex flex-wrap items-center gap-2">
                      <span>
                        {t('judge.term')} «{term.nbForms[0].replace(/^=/, '')}» → {term.byLang[lang]?.approved}:
                      </span>
                      {tri(j.terms[key], (v) => setJ({ ...j, terms: { ...j.terms, [key]: v } }), t('judge.correct'), t('judge.wrong'))}
                    </p>
                  );
                })}
                {l.critical && (
                  <p className="flex flex-wrap items-center gap-2">
                    <span>{t('judge.residual')}</span>
                    {tri(j.residual[`${l.lineId}|${lang}`], (v) => setJ({ ...j, residual: { ...j.residual, [`${l.lineId}|${lang}`]: v } }), t('common.yes'), t('common.no'))}
                  </p>
                )}
              </div>
            );
          })}
          {flags.map((r) => (
            <p key={r.flag.flagId} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
              <span>
                {r.flag.type} · {r.flag.lineId} · {r.flag.route ? t(`route.${r.flag.route}`) : ''}: {t('judge.route')}
              </span>
              {tri(j.routes[r.flag.flagId], (v) => setJ({ ...j, routes: { ...j.routes, [r.flag.flagId]: v } }), t('common.yes'), t('common.no'))}
            </p>
          ))}
          <Button variant="primary" onClick={() => onSave({ ...j, by: { role: reviewer.role, lang, outsideGroup: reviewer.outsideGroup, date: new Date().toISOString().slice(0, 10) } })} data-testid="save-judgements">
            {t('judge.save')}
          </Button>
        </>
      )}
    </div>
  );
}

export function RunRecordScreen() {
  const { runId = '' } = useParams();
  const t = useT();
  const ui = useUiLang();
  const pack = useApp((s) => s.pack);
  const hazardsAll = useApp((s) => s.hazards);
  const localSja = useSjas((s) => s.sjas[runId]);
  const field = useFieldMode();
  const [saved, setSaved] = useState<RunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .runIfSaved(runId)
      // A saved file is shown as it was recorded: a run from before brief v3 keeps its counts, marked as the earlier format.
      .then((r) => setSaved(r ? { ...r, sja: upgradeSja(r.sja, { keepCounts: true }) } : null))
      .catch(() => setSaved(null))
      .finally(() => setLoading(false));
  }, [runId]);

  // An observation recorded on this device that never reached the file (no connection at the time) is written now.
  const localObserved = Boolean(localSja?.observation);
  useEffect(() => {
    let live = true;
    if (localObserved)
      void observationUnsaved(runId).then(async (unsaved) => {
        if (!unsaved || (await saveRun(runId)) || !live) return;
        api.run(runId).then((r) => live && setSaved({ ...r, sja: upgradeSja(r.sja, { keepCounts: true }) })).catch(() => undefined);
      });
    return () => {
      live = false;
    };
  }, [localObserved, runId]);

  // A run that is still on this device shows its live state; otherwise the saved file is shown.
  const localIsNewer = localSja && (!saved || (localSja.status !== saved.sja.status && !saved.sja.status.startsWith('signed')));
  const rec = useMemo(() => (localIsNewer && localSja ? { ...buildRunRecord(localSja), judgements: saved?.judgements } : saved), [localIsNewer, localSja, saved]);

  if (loading) return <Layout title={t('rec.title')}><Spinner label={t('common.loading')} /></Layout>;
  if (!rec) return <Layout title={t('rec.title')}><Notice tone="amber">{t('common.notFound')}</Notice></Layout>;

  // The observation is added after sign-off. If the file on disk does not hold it yet, show the copy on this device.
  const sja = !rec.sja.observation && localSja?.observation ? { ...rec.sja, observation: localSja.observation } : rec.sja;
  const template = pack?.templates.find((x) => x.templateId === sja.templateId);
  const hazards = hazardsAll.find((h) => h.templateId === sja.templateId);
  const flags = allFlags(sja);
  const openFlags = flags.filter((r) => r.flag.status === 'open').length;
  const u = sja.understanding;
  const signed = sja.status.startsWith('signed');
  const oral = activeLines(sja).flatMap((line) => Object.entries(line.byLang).filter(([l, e]) => sja.languages.includes(l) && e.oralFallback).map(([l]) => ({ line, l })));
  const scripted = sja.versions.fixtureOrigins.includes('replay:scripted');
  const assists = rec.events.filter((e) => e.type === 'assist').length;
  const reuse = unverifiedReuse(sja);
  const flagLine = flags.length === 0 ? t('rec.noFlags') : openFlags > 0 ? t('rec.flagsOpen', { n: flags.length, open: openFlags }) : flags.length === 1 ? t('rec.flagsHandled.one') : t('rec.flagsHandled', { n: flags.length });
  const lineText = (id: string) => sja.lines.find((l) => l.lineId === id)?.textNb ?? id;
  const understandingLine = !u.required
    ? t('rec.understandingNotRequiredShort')
    : u.legacyTeachBack
      ? `${t('s5.respondents')}: ${u.respondents} · ${t('rec.legacyShort')}`
      : `${t('s5.respondents')}: ${u.respondents} · ${t('s5.teachCounts', { ok: u.teachBack.ok, rebriefed: u.teachBack.rebriefed })}`;
  const observationLine = !u.required || (u.legacyTeachBack && !sja.observation) ? '–' : !sja.observation ? t('rec.observationPending') : sja.observation.lineIds.length === 0 ? t('obsv.none') : sja.observation.lineIds.length === 1 ? t('obsv.noted.one') : t('obsv.noted', { n: sja.observation.lineIds.length });

  const save = async (next: RunRecord) => {
    try {
      await api.saveRun(next);
      setSaved(next);
      setMessage(t('rec.savedOk'));
    } catch (e) {
      setMessage(`${t('s6.saveFailed')} ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const exportMd = async () => {
    const md = recordToMarkdown({ ...rec, sja }, ui, hazards, template);
    const name = `run-${rec.runId}.${ui}.md`;
    download(name, md, 'text/markdown;charset=utf-8');
    try {
      const r = await api.saveExport(name, md);
      setMessage(`${t('rec.exported')} ${r.file}`);
    } catch {
      setMessage(t('rec.exportedLocal'));
    }
  };
  const exportJson = () => download(`run-${rec.runId}.json`, JSON.stringify({ ...rec, sja }, null, 2), 'application/json');
  const fact = (label: string, value: ReactNode, testid?: string) => (
    <>
      <dt className="font-semibold text-slate-700">{label}</dt>
      <dd className="mb-2 sm:mb-0" data-testid={testid}>{value}</dd>
    </>
  );

  return (
    <Layout title={t('rec.title')} wide>
      <article className="space-y-4" data-testid="record">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">
            {t('rec.title')}: {rec.templateJobType[ui] ?? sja.templateId}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={signed ? 'green' : 'amber'}>
              <span data-testid="record-status">{t(`status.${sja.status}`)}</span>
            </Chip>
            {sja.testId && <Chip tone="blue">{sja.testId}</Chip>}
            <Chip wrap tone={sja.versions.fixtureOrigins.some((o) => o.startsWith('replay')) ? 'violet' : 'slate'}>{modeLabel(sja, ui)}</Chip>
            {!saved && <Chip tone="amber">{t('rec.notSaved')}</Chip>}
          </div>
          <p className="text-sm text-slate-700">{t('rec.statement')}</p>
          {scripted && <Notice tone="violet">{t('rec.scriptedNotice')}</Notice>}
        </header>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">{t('rec.summary')}</h2>
          <dl className="grid text-[15px] sm:grid-cols-[15rem_1fr] sm:gap-x-4 sm:gap-y-1.5" data-testid="record-summary">
            {fact(t('rec.signedBy'), sja.signoff ? `${sja.signoff.role} · ${sja.signoff.at.slice(0, 16).replace('T', ' ')}` : t('rec.notSigned'), 'record-signoff')}
            {fact(t('rec.languages'), sja.languages.map((l) => langName(l, ui)).join(', '))}
            {fact(t('rec.reuseRate'), <><span data-testid="record-reuse">{rec.metrics.reuseRate.reused} {t('common.of')} {rec.metrics.reuseRate.total}</span> {t('rec.reuseLines')}</>)}
            {fact(t('rec.verifiedTemplate'), reuse.total === 0 ? '–' : reuse.unverified === 0 ? t('common.yes') : t('rec.verifiedTemplateNo', { n: reuse.total - reuse.unverified, total: reuse.total }), 'record-verified-template')}
            {fact(t('rec.flags'), flagLine)}
            {fact(
              t('rec.memory'),
              <span data-testid="record-memory">
                {t('rec.memoryValue', {
                  memory: activeLines(sja).reduce((a, l) => a + Object.values(l.byLang).filter((e) => e.source === 'memory').length, 0),
                  calls: rec.events.filter((e) => e.type === 'model_call').length,
                })}
              </span>,
            )}
            {fact(t('rec.oralLines'), oral.length === 0 ? t('rec.none') : String(oral.length))}
            {fact(t('rec.understanding'), understandingLine)}
            {fact(t('rec.observation'), observationLine, 'record-observation')}
            {fact(t('rec.totalTime'), <><strong>{fmtDuration(totalTime(rec.timings))}</strong> <span className="text-slate-600">({t('rec.totalTimeHint')})</span></>)}
            {!field && fact(t('rec.withoutHelp'), <>{assists === 0 ? t('common.yes') : t('common.no')} <span className="text-slate-600">({t('rec.assists')}: <span data-testid="record-assists">{assists}</span>)</span></>)}
          </dl>
          {needsObservation(sja) && localSja && (
            <Link to={`/foreman/${runId}`} className="no-print flex items-center gap-2 rounded-lg border-2 border-amber-500 bg-amber-50 p-3 text-base font-semibold text-slate-900" data-testid="record-observe-link">
              <Icon name="eye" /> {t('home.observe')}
            </Link>
          )}
        </Card>

        <div className="no-print flex flex-wrap gap-2">
          <Link to={`/runs/${runId}/summary`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-base font-semibold text-white hover:bg-blue-800" data-testid="open-summary">
            <Icon name="doc" /> {t('rec.summaryLink')}
          </Link>
          <Button onClick={exportMd} data-testid="export-md">{t('rec.exportMd')}</Button>
          {!field && <Button onClick={exportJson} data-testid="export-json">{t('rec.exportJson')}</Button>}
          <Button onClick={() => window.print()}>{t('rec.print')}</Button>
          {localSja && (!saved || !signed) && <Button onClick={() => save(buildRunRecord(localSja))} data-testid="save-run">{t('rec.saveNow')}</Button>}
          {localSja && !signed && (
            <Link to={`/foreman/${runId}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-blue-800 underline">
              {t('rec.backToWizard')}
            </Link>
          )}
        </div>
        {message && <Notice tone="green">{message}</Notice>}
        <p className="no-print text-sm text-slate-600">{t('rec.sectionsHint')}</p>

        <Collapsible title={t('rec.lines')} summary={t('rec.linesSummary', { n: activeLines(sja).length, langs: sja.languages.map((l) => langName(l, ui)).join(', ') })} testid="record-lines">
          {SECTIONS.map((sec) => {
            const lines = sja.lines.filter((l) => l.section === sec);
            if (!lines.length) return null;
            return (
              <div key={sec}>
                <SectionHeading>{t(`section.${sec}`)}</SectionHeading>
                <ul className="mt-1 divide-y divide-slate-200">
                  {lines.map((l) => {
                    const h = hazards?.entries.find((e) => e.hazardId === l.hazardRef);
                    return (
                      <li key={l.lineId} className="py-2" data-testid={`record-line-${l.lineId}`}>
                        <p className={`text-base ${l.origin === 'removed' ? 'line-through' : ''}`}>{l.textNb}</p>
                        <span className="no-print">
                          <HelpEn nb={l.textNb} line={l} sja={sja} />
                        </span>
                        <p className="mt-1 flex flex-wrap items-center gap-2">
                          <OriginBadge origin={l.origin} />
                          {l.critical && <CriticalMark />}
                          {l.techRecheck !== 'none' && <Chip wrap tone={l.techRecheck === 'confirmed' ? 'green' : 'amber'}>{t('rec.techRecheck')}: {t(`recheck.${l.techRecheck}`)}</Chip>}
                          {l.aiSuggestion === 'accepted' && <Chip tone="slate">{t('s3.aiAccepted')}</Chip>}
                          <SourceRef hazardRef={h ? l.hazardRef : null} hazards={hazards} paramLine={Boolean(template?.lines.find((x) => x.lineId === l.templateLineId)?.parameterRefs.length)} />
                        </p>
                        {l.removalReason && <p className="text-sm">{t('rec.removalReason')}: {l.removalReason}</p>}
                        {l.origin !== 'removed' &&
                          sja.languages.map((lang) => {
                            const e = l.byLang[lang];
                            if (!e) return null;
                            return (
                              <p key={lang} className="mt-1 text-sm text-slate-800">
                                <span className="font-semibold">{langName(lang, ui)}:</span> <span lang={lang}>{e.oralFallback ? '—' : e.text}</span>{' '}
                                <Chip wrap tone={e.oralFallback ? 'amber' : e.verification === 'verified' ? 'green' : 'slate'}>
                                  {e.oralFallback && <Icon name="voice" className="h-3 w-3" />}
                                  {lineLangLabel(e, ui)}
                                </Chip>
                              </p>
                            );
                          })}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {sja.sjaFlags.filter((f) => f.type === 'UNSUPPORTED_LANGUAGE').map((f) => (
            <Notice key={f.flagId} tone="amber">
              <strong>{langName(f.lang, ui)}:</strong> {t('rec.interpreterRequired')}
            </Notice>
          ))}
        </Collapsible>

        <Collapsible title={`${t('rec.flags')} (${flags.length})`} summary={flagLine} defaultOpen={openFlags > 0} testid="record-flags-section">
          {flags.length === 0 ? (
            <p className="text-sm">{t('rec.noFlags')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[640px] text-left text-sm" data-testid="record-flags">
                <thead>
                  <tr className="border-b border-slate-300">
                    {[t('flag.line'), t('rec.language'), t('rec.type'), t('rec.severity'), t('flag.raisedBy'), t('rec.route'), t('rec.resolvedBy'), t('rec.verdict')].map((h) => (
                      <th key={h} className="whitespace-nowrap py-1 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flags.map((r) => (
                    <tr key={r.flag.flagId} className="border-b border-slate-100 align-top">
                      <td className="max-w-[16rem] py-1 pr-3" title={r.flag.lineId}>{r.line?.textNb ?? r.flag.lineId}</td>
                      <td className="py-1 pr-3">{langName(r.lang, ui)}</td>
                      <td className="py-1 pr-3">{t(`flagType.${r.flag.type}`)}</td>
                      <td className="py-1 pr-3">{t(`flag.${r.flag.severity}`)}</td>
                      <td className="py-1 pr-3">{t(`foundBy.${r.flag.raisedBy}`)} ({r.flag.raisedBy})</td>
                      <td className="py-1 pr-3">{r.flag.route ? t(`route.${r.flag.route}`) : r.flag.status === 'open' ? t('rec.open') : t('flag.settled')}{r.flag.reason && r.flag.reason !== 'corrected' ? ` (${r.flag.reason})` : ''}</td>
                      <td className="py-1 pr-3">{r.flag.resolvedBy ? t(`actor.${r.flag.resolvedBy}`) : '–'}</td>
                      <td className="py-1 pr-3">{r.flag.reviewerVerdict ? `${t(`verdict.${r.flag.reviewerVerdict.kind}`)}: ${r.flag.reviewerVerdict.reason}` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="mt-3 text-base font-bold">{t('rec.oralLines')}</h3>
          {oral.length === 0 ? <p className="text-sm">{t('rec.none')}</p> : (
            <ul className="ml-5 list-disc text-sm" data-testid="record-oral">
              {oral.map(({ line, l }) => <li key={`${line.lineId}-${l}`}>{langName(l, ui)}: {line.textNb}</li>)}
            </ul>
          )}
        </Collapsible>

        <Collapsible title={t('rec.understanding')} summary={understandingLine} defaultOpen={u.required} testid="record-understanding-section">
          {!u.required ? <p className="text-sm" data-testid="record-understanding">{t('rec.understandingNotRequired')}</p> : (
            <div className="space-y-2 text-sm" data-testid="record-understanding">
              <p>{t('s5.why')}: {u.reason.map((r) => t(`reason.${r}`)).join('; ')}. {t('rec.noNames')}</p>
              <p><strong>{t('s5.respondents')}: {u.respondents}</strong></p>
              {u.legacyTeachBack ? (
                <p>{t('rec.legacy')}{u.legacyTeachBack.length ? ` ${u.legacyTeachBack.map((x) => `${x.lineId}: ${t(`legacy.${x.outcome}`)}`).join('; ')}.` : ''}</p>
              ) : (
                <>
                  <p>{t('rec.teachBack')}: {t('s5.teachCounts', { ok: u.teachBack.ok, rebriefed: u.teachBack.rebriefed })}</p>
                  <div>
                    <p className="font-semibold">{t('s5.keyTitle')}</p>
                    <ul className="ml-5 list-disc">{u.keyLineIds.map((id) => <li key={id}>{lineText(id)}</li>)}</ul>
                  </div>
                  {u.misunderstood.length > 0 && (
                    <div>
                      <p className="font-semibold">{t('s5.misunderstoodTitle')}</p>
                      <ul className="ml-5 list-disc">{u.misunderstood.map((m) => <li key={m.lineId}>{lineText(m.lineId)} ({m.count})</li>)}</ul>
                    </div>
                  )}
                </>
              )}
              {u.paths && (
                <div data-testid="record-paths">
                  <p className="font-semibold">{t('rec.paths')}</p>
                  <p>{t('s5.pathCounts', { conversation: u.paths.conversation, written: u.paths.written, questionsOnly: u.paths.questionsOnly })}</p>
                  {u.fallbackReasons && Object.keys(u.fallbackReasons).length > 0 && (
                    <p>
                      {t('rec.reasons')}: {Object.entries(u.fallbackReasons).map(([r, n]) => `${t(`reason.${r}`)} (${n})`).join('; ')}
                    </p>
                  )}
                </div>
              )}
              <div>
                <p className="font-semibold">{t('s5.questionTitle')}</p>
                <ul className="ml-5 list-disc" data-testid="record-questions">
                  {u.perQuestion.filter((p) => p.respondents > 0).map((p) => {
                    const q = template?.questions.find((x) => x.questionId === p.questionId);
                    const linked = q ? linesForQuestion(sja, q) : [];
                    return (
                      <li key={p.questionId}>
                        {q?.byLang[ui === 'nb' ? 'nb' : 'en']?.text ?? p.questionId}
                        <br />
                        {t('s5.rightFirst')}: <strong>{p.correctFirst} {t('common.of')} {p.respondents}</strong>
                        {p.respondents - p.correctFirst > 0 ? ` · ${p.rebriefConfirmed ? t('rec.rebriefDone') : t('rec.open')}` : ''}
                        {linked.map((l) => {
                          const src = sourceText(hazards, l.hazardRef, ui);
                          return (
                            <span key={l.lineId} className="block text-xs text-slate-700">
                              → {l.textNb}
                              {src ? ` (${t('line.source')}: ${src.label})` : ''}
                            </span>
                          );
                        })}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="font-semibold">{t('rec.observation')}</p>
                <p>{observationLine}{sja.observation ? ` · ${sja.observation.at.slice(0, 16).replace('T', ' ')}` : ''}</p>
                {sja.observation && sja.observation.lineIds.length > 0 && <ul className="ml-5 list-disc">{sja.observation.lineIds.map((id) => <li key={id}>{lineText(id)}</li>)}</ul>}
              </div>
              <p className="text-xs text-slate-600">{t('rec.understandingNote')}</p>
            </div>
          )}
        </Collapsible>

        <Collapsible title={t('rec.timings')} summary={`${t('rec.totalTime')}: ${fmtDuration(totalTime(rec.timings))}`} testid="record-time">
          <table className="mt-2 text-sm" data-testid="record-timings">
            <tbody>
              {TIME_CATEGORIES.filter((c) => c !== 'understanding').sort((a, b) => TOTAL_CATEGORIES.indexOf(a) - TOTAL_CATEGORIES.indexOf(b)).map((c) => (
                <tr key={c} data-testid={`timing-${c}`} data-ms={rec.timings[c] ?? 0}>
                  <td className="py-0.5 pr-4 text-xs font-bold uppercase tracking-wide text-slate-600">{t(`phase.${PHASE_OF[c]}`)}</td>
                  <td className="py-0.5 pr-6">{t(`cat.${c}`)}</td>
                  <td className="py-0.5 text-right font-mono">{fmtDuration(rec.timings[c] ?? 0)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-bold">
                <td className="py-1 pr-4" colSpan={2}>{t('rec.totalTime')}</td>
                <td className="py-1 text-right font-mono" data-testid="timing-total">{fmtDuration(totalTime(rec.timings))}</td>
              </tr>
              <tr data-testid="timing-understanding" data-ms={rec.timings.understanding ?? 0}>
                <td className="py-0.5 pr-4 pt-3 text-xs font-bold uppercase tracking-wide text-slate-600">{t('phase.understanding')}</td>
                <td className="py-0.5 pr-6 pt-3">{t('cat.understanding')}</td>
                <td className="py-0.5 pt-3 text-right font-mono">{fmtDuration(rec.timings.understanding ?? 0)}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-4" colSpan={2}>{t('rec.foremanTime')}</td>
                <td className="py-0.5 text-right font-mono">{fmtDuration(foremanTime(rec.timings))}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-600">{t('rec.totalTimeNote')}</p>
          <p className="mt-1 text-xs text-slate-600">{t('rec.foremanTimeNote', { cats: FOREMAN_CATEGORIES.map((c) => t(`cat.${c}`)).join(' + ') })}</p>
          <p className="mt-2 text-sm">{t('rec.events')}: {rec.events.length}</p>
        </Collapsible>

        <Collapsible title={t('rec.identity')} summary={t('rec.identitySummary')} testid="record-details">
          <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]">
            <dt className="font-semibold">{t('rec.runId')}</dt><dd>{rec.runId}</dd>
            <dt className="font-semibold">{t('rec.template')}</dt><dd>{sja.templateId} · {t('rec.packVersion')} {sja.packVersion} · hash {sja.packHash}</dd>
            <dt className="font-semibold">{t('rec.versions')}</dt>
            <dd data-testid="record-versions">{Object.keys(sja.versions.prompts).sort().map((k) => `${k} v${sja.versions.prompts[k]} (${sja.versions.models[k]})`).join('; ') || t('rec.noModel')}</dd>
            <dt className="font-semibold">{t('rec.headerLocal')}</dt><dd>{sja.header.siteLabel || '–'} · {sja.header.date} · {sja.header.foremanRole}</dd>
            <dt className="font-semibold">{t('rec.parameters')}</dt><dd>{Object.entries(sja.parameterValues).map(([k, v]) => `${k} = ${v}`).join(', ')}</dd>
            <dt className="font-semibold">{t('rec.specifics')}</dt><dd>{sja.specifics.map((s) => s.text).join(' / ') || '–'}</dd>
          </dl>
        </Collapsible>

        <Collapsible title={t('rec.privacyTitle')} summary={t('privacy.title')} testid="record-privacy">
          <PrivacyPanel testid="privacy-record" />
        </Collapsible>

        {!field && (
          <div className="no-print">
            <Collapsible title={t('rec.judgements')} summary={t('rec.judgementsSummary')} testid="record-judgements">
              <Judgements rec={{ ...rec, sja }} onSave={(j) => save({ ...rec, sja, judgements: j, savedAt: new Date().toISOString() })} />
            </Collapsible>
          </div>
        )}

        {!field && (
          <Collapsible title={t('rec.trace')} summary={t('rec.traceSummary', { n: rec.trace.length })} testid="record-trace">
            <TracePanel trace={rec.trace} />
          </Collapsible>
        )}
      </article>
    </Layout>
  );
}
