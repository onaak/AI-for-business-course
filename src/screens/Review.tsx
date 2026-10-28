// Library and review (F-01, F-12): templates, glossary, questions and flagged lines.
// A reviewer states role, language and whether they are outside the group, then
// gives keys, corrects, marks false alarms or rejects. Without a role the screen is
// the read-only library. Group- and reviewer-facing: English only.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { DiffPair, VerificationChip } from '../components/sja';
import { Button, Card, Chip, download, ErrorBox, Icon, inputClass, Layout, Notice } from '../components/ui';
import { allFlags } from '../core/flags';
import * as flow from '../core/flow';
import { checkLineRules } from '../core/pipeline/checkLine';
import { findSourceTerms } from '../core/rules/glossary';
import type { DataPack, Flag, KeyState, Lang, ReviewerSession, Role } from '../core/types';
import { clone, fillParams, LANG_NAMES } from '../core/util';
import { addTermForms, approve, deriveState, editGlossaryTerm, editQuestion, editSourceLine, editTargetLine, promoteLine, reject, type ItemRef, verificationSummary } from '../core/verification';
import { feedbackEvents, fmtDuration, misunderstandingCounts } from '../core/metrics';
import { verificationSummaryMarkdown } from '../record';
import { makeFlowCtx } from '../state/ctx';
import { useApp, useLog, useSjas } from '../state/stores';

type Tab = 'templates' | 'glossary' | 'questions' | 'queue' | 'promote' | 'summary';
const today = () => new Date().toISOString().slice(0, 10);

function KeyChip({ label, k }: { label: string; k: KeyState | undefined }) {
  if (!k?.given) return <Chip tone="slate">{label}: not given</Chip>;
  return (
    <Chip tone="green" title={k.date}>
      <Icon name="check" className="h-3 w-3" /> {label}: given ({k.outsideGroup ? 'outside the group' : 'inside the group'}
      {k.date ? `, ${k.date}` : ''})
    </Chip>
  );
}

function Editor({ initial, rows = 2, onSave, onCancel, label }: { initial: string; rows?: number; onSave: (v: string) => void; onCancel: () => void; label: string }) {
  const [v, setV] = useState(initial);
  return (
    <div className="mt-2 space-y-2">
      <textarea className={inputClass} rows={rows} value={v} onChange={(e) => setV(e.target.value)} aria-label={label} data-testid="review-editor" />
      <div className="flex gap-2">
        <Button variant="primary" disabled={!v.trim() || v === initial} onClick={() => onSave(v)} data-testid="review-editor-save">
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function Review() {
  const [search] = useSearchParams();
  const library = search.get('view') === 'library';
  const { pack, setPack, reviewer, setReviewer } = useApp();
  const session = library ? null : reviewer;
  const [tab, setTab] = useState<Tab>('templates');
  const [templateId, setTemplateId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recheck, setRecheck] = useState<Record<string, Flag[]>>({});
  const [draft, setDraft] = useState<{ role: Role; lang: Lang; outsideGroup: boolean }>({ role: 'language', lang: 'lt', outsideGroup: false });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [onlyOpen, setOnlyOpen] = useState(false);
  const allEvents = useLog((s) => s.events);
  const reviewEvents = allEvents.filter((e) => e.actor === 'reviewer' && e.timeCategory === 'reviewer');
  // Brief v3: misunderstandings are logged anonymously and fed back into the template.
  const sjasAll = useSjas((s) => s.sjas);
  const misunderstood = useMemo(() => misunderstandingCounts(feedbackEvents(allEvents, sjasAll)), [allEvents, sjasAll]);
  const [onlyMisunderstood, setOnlyMisunderstood] = useState(false);
  const sjas = useSjas((s) => s.sjas);
  const log = useLog((s) => s.add);

  // Reviewer time runs from opening an item to deciding it; the observer can mark a pause (SC-14).
  const timers = useRef(new Map<string, number>());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const touch = (key: string) => {
    if (!timers.current.has(key)) timers.current.set(key, Date.now());
  };
  const spent = (key: string) => {
    const start = timers.current.get(key);
    timers.current.delete(key);
    return start ? Math.max(0, (pausedAt ?? Date.now()) - start) : 0;
  };
  const togglePause = () => {
    if (pausedAt === null) return setPausedAt(Date.now());
    const shift = Date.now() - pausedAt;
    for (const [k, v] of timers.current) timers.current.set(k, v + shift);
    setPausedAt(null);
  };

  const queue = useMemo(
    () =>
      Object.values(sjas).flatMap((sja) =>
        allFlags(sja)
          .filter((r) => r.flag.status === 'open' && r.flag.route === 'reviewer' && r.line)
          .map((r) => ({ sja, ...r })),
      ),
    [sjas],
  );

  // L4: lines written for one job, in signed SJAs on this device, that the template does not have yet.
  const promotable = useMemo(
    () =>
      pack
        ? Object.values(sjas)
            .filter((sja) => (sja.status === 'signed' || sja.status === 'signedWithFallback') && !sja.cleanView)
            .flatMap((sja) =>
              sja.lines
                .filter((l) => l.origin === 'new' && l.aiSuggestion !== 'open')
                .filter((l) => !pack.templates.find((t) => t.templateId === sja.templateId)?.lines.some((x) => x.textNb === l.textNb))
                .map((line) => ({ sja, line })),
            )
        : [],
    [sjas, pack],
  );
  const hazardsAll = useApp((s) => s.hazards);
  const packReadOnly = useApp((s) => Boolean(s.config?.packReadOnly));
  const [forms, setForms] = useState<Record<string, { accepted: string; forbidden: string }>>({});

  if (!pack) return <Layout title="Review" english>Loading …</Layout>;
  const template = pack.templates.find((t) => t.templateId === templateId) ?? pack.templates[0];
  const langs: Lang[] = session?.role === 'language' ? [session.lang] : pack.languages;

  const mutate = async (key: string, type: string, kind: 'setup' | 'checking', fn: (p: DataPack) => void, lang?: string) => {
    setError(null);
    const next = clone(pack);
    fn(next);
    try {
      setPack(await api.savePack(next));
      log({ runId: 'review', arm: 'flagship', actor: 'reviewer', type, step: kind, timeCategory: 'reviewer', durationMs: spent(key.split('|')[0]), languagePair: lang ? `nb-${lang}` : undefined, packVersion: pack.version });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const actions = (key: string, ref: ItemRef, opts: { hasKey: boolean; onCorrect?: () => void; correctLabel?: string }): ReactNode => {
    if (!session) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="primary" disabled={opts.hasKey} onClick={() => mutate(key, 'review_approve', 'setup', (p) => approve(p, ref, session, today()), session.lang)} data-testid={`approve-${key}`}>
          {session.role === 'language' ? 'Approve: give language key' : 'Approve: give technical key'}
        </Button>
        {opts.onCorrect && (
          <Button onClick={() => { touch(key); opts.onCorrect!(); }} data-testid={`correct-${key}`}>
            {opts.correctLabel ?? 'Correct'}
          </Button>
        )}
        <Button variant="danger" disabled={!opts.hasKey} onClick={() => mutate(key, 'review_reject', 'setup', (p) => reject(p, ref, session), session.lang)}>
          Reject: withdraw key
        </Button>
      </div>
    );
  };

  const tabs: [Tab, string][] = [
    ['templates', 'Templates'],
    ['glossary', `Glossary (${pack.glossary.length})`],
    ['questions', 'Questions'],
    ['queue', `Flagged lines (${queue.length})`],
    ['promote', `Lines from jobs (${promotable.length})`],
    ['summary', 'Summary and version'],
  ];

  return (
    <Layout title={library ? 'Library and glossary' : 'Review'} wide english>
      <div className="space-y-4">
        <details className="rounded-xl border border-slate-200 bg-white p-3" open={!session || undefined} data-testid="verified-means">
          <summary className="min-h-11 cursor-pointer text-base font-bold">What "verified" means here</summary>
          <ul className="ml-5 mt-1 list-disc space-y-1 text-sm text-slate-800">
            <li><strong>Language key.</strong> A language reviewer, who speaks Norwegian and the crew language and knows construction terms, checks that each line says the same in both languages.</li>
            <li><strong>Technical key.</strong> A technical reviewer (the foreman or the firm's HMS lead) checks that the hazards and measures fit the job, and fixes Norwegian that is ambiguous before it is translated.</li>
            <li><strong>Two keys.</strong> A line, term or question is "Verified" only when both reviewers have approved it. The foreman then signs each job's SJA.</li>
            <li><strong>Understanding</strong> is checked on site, not here: each worker explains the hazard and the measure in their own words and answers one scenario question, and the foreman watches the start of the job. What was misunderstood comes back to this screen, marked on the template line.</li>
          </ul>
        </details>

        {!library && packReadOnly && (
          <Notice tone="amber">This copy is shared for viewing. Keys and corrections cannot be saved here; review on the group's own computer.</Notice>
        )}
        {library ? (
          <Notice>Read-only library. Every line and term shows its true verification state. With the seed data as delivered, nothing is verified.</Notice>
        ) : session ? (
          <Card tone="blue" className="flex flex-wrap items-center gap-2">
            <Icon name="person" />
            <span className="text-base font-semibold" data-testid="reviewer-session">
              Reviewing as: {session.role} reviewer{session.role === 'language' ? `, ${LANG_NAMES[session.lang]?.en}` : ''}, {session.outsideGroup ? 'outside the group' : 'inside the group'}
            </span>
            <Button onClick={togglePause}>{pausedAt === null ? 'Pause timing' : 'Resume timing'}</Button>
            <Button variant="danger" onClick={() => setReviewer(null)}>
              Stop reviewing
            </Button>
          </Card>
        ) : (
          <Card className="space-y-3">
            <h2 className="text-lg font-bold">Who is reviewing?</h2>
            <p className="text-sm text-slate-700">
              Pick the role you hold. A language reviewer speaks Norwegian and the crew language and knows construction terms. A technical reviewer is the foreman or the firm's HMS lead. No names are stored: only role, language, inside or outside the group, and the date.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-semibold">
                Role
                <select className={inputClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })} data-testid="reviewer-role">
                  <option value="language">Language reviewer</option>
                  <option value="technical">Technical reviewer</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Language
                <select className={inputClass} value={draft.lang} onChange={(e) => setDraft({ ...draft, lang: e.target.value as Lang })} disabled={draft.role === 'technical'} data-testid="reviewer-lang">
                  {pack.languages.map((l) => (
                    <option key={l} value={l}>
                      {LANG_NAMES[l]?.en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5" checked={draft.outsideGroup} onChange={(e) => setDraft({ ...draft, outsideGroup: e.target.checked })} data-testid="reviewer-outside" />
                Outside the group
              </label>
            </div>
            <Button variant="primary" onClick={() => setReviewer(draft as ReviewerSession)} data-testid="reviewer-start">
              Start reviewing
            </Button>
          </Card>
        )}

        <div className="flex flex-wrap gap-2" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`tab-${id}`} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${tab === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'}`}>
              {label}
            </button>
          ))}
        </div>
        {error && <ErrorBox message={error} />}
        {session && tab !== 'queue' && tab !== 'summary' && (
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} data-testid="only-open" />
            Show only items still awaiting my key
          </label>
        )}

        {(tab === 'templates' || tab === 'questions') && (
          <select className={inputClass} value={template.templateId} onChange={(e) => { setTemplateId(e.target.value); setOnlyMisunderstood(false); }} aria-label="Template" data-testid="review-template">
            {pack.templates.map((t) => (
              <option key={t.templateId} value={t.templateId}>
                {t.jobType.en} ({t.lines.length} lines, {t.questions.length} questions)
              </option>
            ))}
          </select>
        )}

        {tab === 'templates' && Object.keys(misunderstood[template.templateId] ?? {}).length > 0 && (
          <Card tone="amber" className="space-y-2" >
            <p className="text-base font-bold" data-testid="misunderstood-summary">
              Fed back from use: workers misunderstood {Object.keys(misunderstood[template.templateId]).filter((k) => k !== 'job-specific').length} line(s) of this template.
              {misunderstood[template.templateId]['job-specific'] ? ` A further ${misunderstood[template.templateId]['job-specific']} misunderstanding(s) were on lines written for one job.` : ''}
            </p>
            <p className="text-sm text-slate-700">Logged without names, from the teach-back and from the foreman's observation of the start of the job. Look at the wording of these lines, their translations and the scenario question first.</p>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5" checked={onlyMisunderstood} onChange={(e) => setOnlyMisunderstood(e.target.checked)} data-testid="only-misunderstood" />
              Show only these lines
            </label>
          </Card>
        )}

        {tab === 'templates' && (
          <ul className="space-y-2" data-testid="library-lines">
            {template.lines.filter((line) => !onlyMisunderstood || Boolean(misunderstood[template.templateId]?.[line.lineId])).filter((line) => !onlyOpen || !session || (session.role === 'technical' ? !line.keyTechnical.given : !line.translations[session.lang]?.keyLanguage.given)).map((line) => {
              const ref = { kind: 'line' as const, templateId: template.templateId, lineId: line.lineId };
              const key = `${template.templateId}/${line.lineId}`;
              return (
                <li key={line.lineId} className="rounded-xl border border-slate-200 bg-white p-3" onClick={() => touch(key)} data-testid={`lib-line-${line.lineId}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">{line.lineId}</span>
                    <Chip tone="slate">{line.section}</Chip>
                    {line.critical && <Chip tone="red">safety-critical</Chip>}
                    <KeyChip label="Technical key" k={line.keyTechnical} />
                    <span className="text-xs text-slate-600">{line.sourceRef ? `source: ${line.sourceRef}` : 'unsourced'}</span>
                    {misunderstood[template.templateId]?.[line.lineId] && (
                      <Chip tone="amber" title="From the teach-back and the foreman's observation. No names.">
                        <Icon name="warn" className="h-3 w-3" /> misunderstood on site: {misunderstood[template.templateId][line.lineId]}×
                      </Chip>
                    )}
                  </div>
                  <p className="mt-1 text-base font-semibold">{line.textNb}</p>
                  {editing === `${key}|nb` && <Editor label="Norwegian source" initial={line.textNb} onCancel={() => setEditing(null)} onSave={(v) => mutate(key, 'review_edit_source', 'setup', (p) => editSourceLine(p, ref, v))} />}
                  {session?.role === 'technical' && editing !== `${key}|nb` && actions(key, ref, { hasKey: line.keyTechnical.given, onCorrect: () => setEditing(`${key}|nb`), correctLabel: 'Edit the Norwegian (clears every key)' })}
                  <div className="mt-2 space-y-2">
                    {langs.map((l) => {
                      const tr = line.translations[l];
                      if (!tr) return null;
                      const state = deriveState(tr.keyLanguage, line.keyTechnical);
                      const flags = recheck[`${key}|${l}`];
                      return (
                        <div key={l} className="rounded-lg bg-slate-50 p-2" data-testid={`lib-line-${line.lineId}-${l}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold">{LANG_NAMES[l]?.en}</span>
                            <span data-testid={`state-${line.lineId}-${l}`} data-state={state}>
                              <VerificationChip state={state} />
                            </span>
                            <KeyChip label="Language key" k={tr.keyLanguage} />
                          </div>
                          <p className="mt-1 text-base" lang={l}>{tr.text}</p>
                          {flags && <p className={`mt-1 text-sm font-semibold ${flags.length ? 'text-rose-800' : 'text-emerald-800'}`}>Re-check (rules D1, D2): {flags.length ? flags.map((f) => f.type).join(', ') : 'clean'}</p>}
                          {editing === `${key}|${l}` && (
                            <Editor
                              label={`Target text ${l}`}
                              initial={tr.text}
                              onCancel={() => setEditing(null)}
                              onSave={(v) => {
                                const values = Object.fromEntries(template.parameters.map((p) => [p.key, p.default]));
                                const r = checkLineRules({ lineId: line.lineId, source: fillParams(line.textNb, template.parameters, values, 'nb'), target: fillParams(v, template.parameters, values, l), lang: l, critical: line.critical }, pack);
                                setRecheck((x) => ({ ...x, [`${key}|${l}`]: r.flags }));
                                void mutate(key, 'review_correct', 'setup', (p) => editTargetLine(p, ref, l, v, session, today()), l);
                              }}
                            />
                          )}
                          {session?.role === 'language' && session.lang === l && editing !== `${key}|${l}` && actions(`${key}|${l}`, ref, { hasKey: tr.keyLanguage.given, onCorrect: () => setEditing(`${key}|${l}`), correctLabel: 'Correct (this sets your language key)' })}
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {tab === 'glossary' && (
          <>
            <input className={inputClass} placeholder="Search the glossary: Norwegian, English, Polish or Lithuanian" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="glossary-search" />
            <ul className="space-y-2" data-testid="glossary-list">
              {pack.glossary
                .filter((term) => !onlyOpen || !session || (session.role === 'technical' ? !term.keyTechnical.given : !term.byLang[session.lang]?.keyLanguage.given))
                .filter((term) => !query.trim() || JSON.stringify([term.nbForms, term.conceptEn, Object.values(term.byLang).map((e) => e?.approved)]).toLowerCase().includes(query.trim().toLowerCase()))
                .map((term) => {
                  const ref = { kind: 'term' as const, termId: term.termId };
                  return (
                    <li key={term.termId} className="rounded-xl border border-slate-200 bg-white p-3" onClick={() => touch(term.termId)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-base">{term.nbForms.map((f) => f.replace(/^=/, '')).join(', ')}</strong>
                        <span className="text-sm text-slate-700">— {term.conceptEn}</span>
                        {term.critical && <Chip tone="red">critical</Chip>}
                        <KeyChip label="Technical key" k={term.keyTechnical} />
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{term.definition}</p>
                      {session?.role === 'technical' && actions(term.termId, ref, { hasKey: term.keyTechnical.given })}
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        {langs.map((l) => {
                          const e = term.byLang[l];
                          if (!e) return null;
                          const k = `${term.termId}|${l}`;
                          return (
                            <div key={l} className="rounded-lg bg-slate-50 p-2 text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold">{LANG_NAMES[l]?.en}</span>
                                <VerificationChip state={deriveState(e.keyLanguage, term.keyTechnical)} />
                              </div>
                              <p className="mt-1 text-base font-semibold" lang={l}>{e.approved}</p>
                              <p className="text-xs text-slate-600">stems: {e.stems.join(' + ')}</p>
                              {e.forbidden.length > 0 && <p className="text-xs text-rose-800">forbidden: {e.forbidden.join(', ')}</p>}
                              {editing === k && (
                                <Editor
                                  label="Approved term; stems; forbidden"
                                  rows={3}
                                  initial={`${e.approved}\n${e.stems.join(', ')}\n${e.forbidden.join(', ')}`}
                                  onCancel={() => setEditing(null)}
                                  onSave={(v) => {
                                    const [approved, stems, forbidden] = v.split('\n');
                                    const list = (s?: string) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
                                    void mutate(k, 'review_correct_term', 'setup', (p) => editGlossaryTerm(p, term.termId, l, { approved: approved.trim(), stems: stems?.trim() ? list(stems) : undefined, forbidden: list(forbidden) }, session, today()), l);
                                  }}
                                />
                              )}
                              {editing === k && <p className="text-xs text-slate-600">Line 1: approved term. Line 2: stems, comma-separated (leave empty to derive them). Line 3: forbidden terms.</p>}
                              {session?.role === 'language' && session.lang === l && editing !== k && actions(k, ref, { hasKey: e.keyLanguage.given, onCorrect: () => setEditing(k), correctLabel: 'Correct term or stems' })}
                            </div>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </>
        )}

        {tab === 'questions' && (
          <ul className="space-y-2">
            {template.questions.filter((q) => !onlyOpen || !session || (session.role === 'technical' ? !q.keyTechnical.given : !q.byLang[session.lang]?.keyLanguage.given)).map((q) => {
              const ref = { kind: 'question' as const, templateId: template.templateId, questionId: q.questionId };
              return (
                <li key={q.questionId} className="rounded-xl border border-slate-200 bg-white p-3" onClick={() => touch(q.questionId)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">{q.questionId}</span>
                    <Chip tone="slate">tests {q.linkedLineIds.join(', ')}</Chip>
                    <KeyChip label="Technical key" k={q.keyTechnical} />
                  </div>
                  <p className="mt-1 text-base font-semibold">{q.byLang.nb?.text}</p>
                  <ol className="ml-5 list-decimal text-sm">
                    {q.byLang.nb?.options.map((o, i) => (
                      <li key={i} className={i === q.correctIndex ? 'font-bold text-emerald-900' : ''}>
                        {o}
                        {i === q.correctIndex ? ' (correct)' : ''}
                      </li>
                    ))}
                  </ol>
                  {session?.role === 'technical' && actions(q.questionId, ref, { hasKey: q.keyTechnical.given })}
                  {langs.map((l) => {
                    const e = q.byLang[l];
                    if (!e) return null;
                    const k = `${q.questionId}|${l}`;
                    return (
                      <div key={l} className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{LANG_NAMES[l]?.en}</span>
                          <VerificationChip state={deriveState(e.keyLanguage, q.keyTechnical)} />
                        </div>
                        <p className="mt-1 text-base" lang={l}>{e.text}</p>
                        <ol className="ml-5 list-decimal" lang={l}>
                          {e.options.map((o, i) => (
                            <li key={i}>{o}</li>
                          ))}
                        </ol>
                        {editing === k && (
                          <Editor label="Question and options, one per line" rows={5} initial={[e.text, ...e.options].join('\n')} onCancel={() => setEditing(null)} onSave={(v) => { const [text, ...options] = v.split('\n').map((x) => x.trim()).filter(Boolean); void mutate(k, 'review_correct_question', 'setup', (p) => editQuestion(p, ref, l, { text, options }, session, today()), l); }} />
                        )}
                        {session?.role === 'language' && session.lang === l && editing !== k && actions(k, ref, { hasKey: e.keyLanguage.given, onCorrect: () => setEditing(k), correctLabel: 'Correct' })}
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        )}

        {tab === 'queue' && (
          <div className="space-y-3" data-testid="review-queue">
            {queue.length === 0 && <Notice>No lines are waiting for a reviewer. A foreman sends a line here with the route "Send to reviewer".</Notice>}
            {queue.map(({ sja, flag, line, lang }) => {
              const k = `q|${flag.flagId}`;
              const mine = session?.role === 'language' && session.lang === lang;
              const entry = line!.byLang[lang];
              const terms = findSourceTerms(line!.textNb, pack.glossary);
              const run = (fn: (s: typeof sja) => typeof sja) => {
                try {
                  useSjas.getState().put(fn(useSjas.getState().sjas[sja.sjaId]));
                  setEditing(null);
                  setError(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              };
              return (
                <Card key={flag.flagId} tone={flag.severity === 'red' ? 'red' : 'amber'} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2" onClick={() => touch(k)}>
                    <Chip tone="red">{flag.type}</Chip>
                    <Chip tone="slate">{LANG_NAMES[lang]?.en ?? lang}</Chip>
                    <Chip tone="slate">raised by {flag.raisedBy}</Chip>
                    {line!.critical && <Chip tone="red">safety-critical</Chip>}
                  </div>
                  <p className="text-base font-medium">{flag.explanation.en}</p>
                  <p className="text-sm"><span className="font-semibold">Source (Norwegian):</span> {line!.textNb}</p>
                  <p className="text-sm"><span className="font-semibold">Target:</span> <span lang={lang}>{entry?.text}</span></p>
                  {entry?.backTranslation && <DiffPair source={line!.textNb} back={entry.backTranslation} />}
                  {flag.evidence.expected && <p className="text-sm"><span className="font-semibold">Approved term:</span> {flag.evidence.expected}</p>}
                  {terms.length > 0 && (
                    <ul className="rounded-lg bg-slate-50 p-2 text-sm">
                      {terms.map(({ term }) => (
                        <li key={term.termId}>
                          <strong>{term.nbForms[0].replace(/^=/, '')}</strong> ({term.conceptEn}): {term.definition} Approved: <span lang={lang}>{term.byLang[lang as Lang]?.approved}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!mine ? (
                    <Notice tone="amber">Only a language reviewer for {LANG_NAMES[lang]?.en ?? lang} can decide this item.</Notice>
                  ) : editing === k ? (
                    <div className="space-y-2">
                      <Editor
                        label="Corrected target text"
                        initial={entry?.text ?? ''}
                        onCancel={() => setEditing(null)}
                        onSave={(v) => {
                          const f = forms[k];
                          run((s) => flow.reviewerCorrect(makeFlowCtx(s), s, line!.lineId, lang, v, session!, spent(k)));
                          // L3: the correction can also teach the glossary.
                          if (flag.termId && f && (f.accepted.trim() || f.forbidden.trim())) {
                            void mutate(`${k}|forms`, 'review_glossary_forms', 'checking', (p) => void addTermForms(p, flag.termId!, lang as Lang, f, session!, today()), lang);
                          }
                        }}
                      />
                      {flag.termId && (
                        <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-2" data-testid="glossary-forms">
                          <p className="text-sm font-semibold">
                            Also teach the glossary (optional): term «{pack.glossary.find((x) => x.termId === flag.termId)?.nbForms[0].replace(/^=/, '')}»
                          </p>
                          <label className="block text-sm">
                            Accepted form or stem you used (it is added as an alternative to the first stem)
                            <input className={inputClass} value={forms[k]?.accepted ?? ''} onChange={(e) => setForms({ ...forms, [k]: { accepted: e.target.value, forbidden: forms[k]?.forbidden ?? '' } })} data-testid="form-accepted" />
                          </label>
                          <label className="block text-sm">
                            Wrong word to forbid (from the machine translation)
                            <input className={inputClass} value={forms[k]?.forbidden ?? ''} onChange={(e) => setForms({ ...forms, [k]: { accepted: forms[k]?.accepted ?? '', forbidden: e.target.value } })} data-testid="form-forbidden" />
                          </label>
                          <p className="text-xs text-slate-600">Saved as a new glossary state with your language key. The working pack's version is raised by hand on the Summary tab when a revision is complete.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input className={inputClass} placeholder="Reason (required for a false alarm or a rejection)" value={reasons[k] ?? ''} onChange={(e) => { touch(k); setReasons({ ...reasons, [k]: e.target.value }); }} data-testid="queue-reason" />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="primary" disabled={!(reasons[k] ?? '').trim()} onClick={() => run((s) => flow.reviewerVerdict(makeFlowCtx(s), s, flag.flagId, 'falseAlarm', reasons[k], session!, spent(k)))} data-testid="queue-false-alarm">
                          False alarm: the translation is right
                        </Button>
                        <Button onClick={() => { touch(k); setEditing(k); }} data-testid="queue-correct">
                          Correct the text
                        </Button>
                        <Button variant="danger" disabled={!(reasons[k] ?? '').trim()} onClick={() => run((s) => flow.reviewerVerdict(makeFlowCtx(s), s, flag.flagId, 'confirmed', reasons[k], session!, spent(k)))} data-testid="queue-reject">
                          Reject: real error, back to the foreman
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {tab === 'promote' && (
          <div className="space-y-3" data-testid="review-promote">
            <Notice>
              Lines written for one job (by the AI from the hazard list, or by a foreman) in signed SJAs on this device. Adding one puts it in its template as a new <strong>draft</strong> line, with the
              translations that were checked and not flagged. It counts as verified, and goes into the translation memory, only after both reviewers give their keys on the Templates tab.
              Nothing is added automatically.
            </Notice>
            {promotable.length === 0 && <Notice tone="amber">No new lines in signed SJAs on this device.</Notice>}
            {promotable.map(({ sja, line }) => {
              const k = `p|${sja.sjaId}|${line.lineId}`;
              const tpl = pack.templates.find((t) => t.templateId === sja.templateId);
              const idx = sja.lines.findIndex((l) => l.lineId === line.lineId);
              const before = sja.lines.slice(0, idx).reverse().find((l) => l.templateLineId)?.templateLineId ?? null;
              return (
                <Card key={k} className="space-y-2" >
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="blue">{tpl?.jobType.en ?? sja.templateId}</Chip>
                    <Chip tone="slate">{line.section}</Chip>
                    {line.critical && <Chip tone="red">safety-critical</Chip>}
                    <Chip tone="slate">added by {line.addedBy}</Chip>
                    {!line.hazardRef && <Chip tone="amber">no source in the hazard list</Chip>}
                  </div>
                  <p className="text-base">{line.textNb}</p>
                  <ul className="text-sm text-slate-700">
                    {Object.entries(line.byLang).map(([l, e]) => (
                      <li key={l}>
                        {LANG_NAMES[l]?.en ?? l}: <span lang={l}>{e.text || '—'}</span> {e.checkState !== 'checked' || e.flags.some((f) => f.status === 'open') ? '(not carried over: not checked, or flagged)' : ''}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="primary"
                    disabled={!session}
                    onClick={() => mutate(k, 'review_promote_line', 'setup', (p) => void promoteLine(p, sja.templateId, line, hazardsAll.find((h) => h.templateId === sja.templateId), before))}
                    data-testid="promote-line"
                  >
                    Add to the template as a draft line
                  </Button>
                  {!session && <p className="text-xs text-slate-600">Start reviewing (above) to add lines.</p>}
                </Card>
              );
            })}
          </div>
        )}

        {tab === 'summary' && (
          <Card className="space-y-3" >
            <h2 className="text-lg font-bold">Verification summary</h2>
            <p className="text-base" data-testid="pack-version">
              Data pack version <strong>{pack.version}</strong> · content hash {pack.hash}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm" data-testid="verification-counts">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-1 pr-3">Items</th><th className="pr-3">Draft</th><th className="pr-3">Language-checked</th><th className="pr-3">Technically checked</th><th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(verificationSummary(pack).counts).map(([k, c]) => (
                    <tr key={k} className="border-b border-slate-100" data-testid={`counts-${k}`} data-verified={c.verified}>
                      <td className="py-1 pr-3 font-semibold">{k}</td><td>{c.draft}</td><td>{c.languageChecked}</td><td>{c.technicallyChecked}</td><td className="font-bold">{c.verified}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm">
              Keys given: {verificationSummary(pack).rows.length}, of which outside the group: {verificationSummary(pack).rows.filter((r) => r.outsideGroup).length}. A key from a group member is valid but is not the outside perspective the course asks for.
            </p>
            <p className="text-sm" data-testid="reviewer-time">
              Reviewer time logged on this device (C4): set-up {fmtDuration(reviewEvents.filter((e) => e.step === 'setup').reduce((a, e) => a + (e.durationMs ?? 0), 0))} over {reviewEvents.filter((e) => e.step === 'setup').length} decisions; checking {fmtDuration(reviewEvents.filter((e) => e.step === 'checking').reduce((a, e) => a + (e.durationMs ?? 0), 0))} over {reviewEvents.filter((e) => e.step === 'checking').length} decisions. Time runs from opening an item to deciding it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={async () => { const md = verificationSummaryMarkdown(pack, allEvents); download('verification-summary.md', md, 'text/markdown;charset=utf-8'); await api.saveExport('verification-summary.md', md).catch(() => undefined); }} data-testid="export-verification">
                Export verification summary
              </Button>
              {!library && (
                <>
                  <Button variant="primary" onClick={() => mutate('version', 'pack_version_raised', 'setup', (p) => { p.version += 1; })} data-testid="raise-version">
                    Raise version to {pack.version + 1} (a revision is complete)
                  </Button>
                  <Button variant="danger" onClick={async () => { if (window.confirm('Reset the working data pack to the seed data? Every key and correction is lost.')) setPack(await api.resetPack()); }} data-testid="reset-pack">
                    Reset to seed data
                  </Button>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
