// Foreman wizard, steps 3 (Content) and 4 (Language check).
import { useEffect, useRef, useState } from 'react';
import { CriticalMark, FlagCard, langName, OriginBadge, SectionHeading, SourceRef, SummaryBar } from '../../components/sja';
import { ActionBar, Button, Card, Chip, ErrorBox, Icon, inputClass, Notice, Spinner } from '../../components/ui';
import { activeLines, allFlags, isBlocking, sortFlags } from '../../core/flags';
import { HelpEn } from '../../components/HelpEn';
import * as flow from '../../core/flow';
import { unverifiedReuse } from '../../core/metrics';
import { supportedLangs } from '../../core/rules/diff';
import { SECTIONS, type DataPack, type Flag, type HazardList, type Route, type Section, type Sja, type SjaLine } from '../../core/types';
import { useT, useUiLang } from '../../i18n';
import { useApp, useLog, useSjas } from '../../state/stores';
import type { useWizard } from './useWizard';

type Wizard = ReturnType<typeof useWizard>;

function LineRow({ line, w, hazards }: { line: SjaLine; w: Wizard; hazards?: HazardList }) {
  const t = useT();
  const sja = w.sja;
  const ui = useUiLang();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(line.textNb);
  const [reason, setReason] = useState('');
  const busy = Boolean(w.busy);
  const removed = line.origin === 'removed';
  const quiet = line.origin === 'reused' || line.origin === 'parameterFilled';
  const ambiguous = line.flags.filter((f) => f.type === 'SOURCE_AMBIGUOUS' && f.status === 'open');
  const removedFlag = line.flags.find((f) => f.type === 'CRITICAL_LINE_REMOVED' && f.status === 'open');
  const needsAction = line.techRecheck === 'open' || line.aiSuggestion === 'open' || ambiguous.length > 0 || Boolean(removedFlag);
  const edit = (value: string) => w.act('edit', (ctx, s) => flow.editLine(ctx, s, line.lineId, value));

  // Reused lines are visually quieter than changed ones (8.3): one compact row, opened by a tap.
  if (quiet && !needsAction && !open && !removed) {
    return (
      <li id={`line-${line.lineId}`} data-testid={`line-${line.lineId}`}>
        <button type="button" onClick={() => setOpen(true)} aria-expanded="false" className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left">
          <span className="min-w-0 flex-1 text-[15px] text-slate-600">
            {line.textNb}
            <HelpEn nb={line.textNb} line={line} sja={sja} />
          </span>
          {line.critical && <Icon name="warn" className="h-4 w-4 text-slate-600" />}
          {line.techRecheck === 'confirmed' && <Icon name="check" className="h-4 w-4 text-emerald-700" />}
          <span className="shrink-0 text-xs font-semibold text-slate-600">{t(`origin.${line.origin}`)}</span>
        </button>
      </li>
    );
  }

  return (
    <li id={`line-${line.lineId}`} data-testid={`line-${line.lineId}`} className={`rounded-lg border bg-white p-3 ${needsAction ? 'border-l-8 border-amber-500' : quiet ? 'border-slate-200' : 'border-l-8 border-blue-500'}`}>
      {editing ? (
        <div className="space-y-2">
          <textarea className={inputClass} rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label={t('s3.editLabel')} data-testid={`edit-text-${line.lineId}`} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!text.trim() || busy} onClick={async () => { await edit(text); setEditing(false); }} data-testid={`edit-save-${line.lineId}`}>
              {t('common.save')}
            </Button>
            <Button onClick={() => { setText(line.textNb); setEditing(false); }}>{t('common.cancel')}</Button>
          </div>
        </div>
      ) : (
        <p className={`${quiet ? 'text-base text-slate-600' : 'text-base font-semibold text-slate-950'} ${removed ? 'line-through decoration-2' : ''}`}>
          {line.textNb}
          <HelpEn nb={line.textNb} line={line} sja={sja} className="font-normal" />
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <OriginBadge origin={line.origin} />
        {line.critical && <CriticalMark />}
        {line.addedBy === 'foreman' && <Chip tone="slate">{t('s3.addedByForeman')}</Chip>}
        {line.techRecheck === 'confirmed' && (
          <Chip tone="green">
            <Icon name="check" className="h-3 w-3" /> {t('s3.recheckConfirmed')}
          </Chip>
        )}
        {line.aiSuggestion === 'accepted' && <Chip tone="slate">{t('s3.aiAccepted')}</Chip>}
        <SourceRef hazardRef={line.hazardRef} hazards={hazards} quiet={line.addedBy !== 'ai'} />
      </div>

      {line.techRecheck === 'open' && !removed && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3" data-testid={`recheck-${line.lineId}`}>
          <p className="flex items-start gap-2 text-sm font-semibold text-amber-950">
            <Icon name="warn" /> {t('s3.recheck')}
          </p>
          <Button variant="primary" className="mt-2" disabled={busy} onClick={() => w.act('recheck', (ctx, s) => flow.confirmTechRecheck(ctx, s, line.lineId))} data-testid={`recheck-confirm-${line.lineId}`}>
            {t('s3.recheckConfirm')}
          </Button>
        </div>
      )}

      {line.aiSuggestion === 'open' && !removed && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3" data-testid={`ai-suggestion-${line.lineId}`}>
          <p className="flex items-start gap-2 text-sm font-semibold text-amber-950">
            <Icon name="warn" /> {line.flags.find((f) => f.type === 'AI_ADDED_CONTENT')?.explanation[ui] ?? t('s3.aiSuggestion')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} onClick={() => w.act('ai', (ctx, s) => flow.decideSuggestion(ctx, s, line.lineId, true))} data-testid={`ai-accept-${line.lineId}`}>
              {t('s3.aiAccept')}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => w.act('ai', (ctx, s) => flow.decideSuggestion(ctx, s, line.lineId, false))} data-testid={`ai-reject-${line.lineId}`}>
              {line.templateLineId ? t('s3.aiRevert') : t('s3.aiDelete')}
            </Button>
          </div>
        </div>
      )}

      {ambiguous.map((f) => (
        <div key={f.flagId} className={`mt-3 rounded-lg p-3 ${f.severity === 'red' ? 'bg-rose-50' : 'bg-amber-50'}`} data-testid={`ambiguous-${line.lineId}`}>
          <p className="flex items-start gap-2 text-sm font-bold">
            <Icon name="warn" /> {f.reason === 'model_error' ? t('s3.checkFailed') : t('flagType.SOURCE_AMBIGUOUS')}
            {line.critical && f.reason !== 'model_error' ? ` – ${t('s3.ambiguousBlocks')}` : ''}
          </p>
          <p className="mt-1 text-sm">{f.explanation[ui]}</p>
          {f.evidence.suggestion && (
            <p className="mt-2 rounded bg-white p-2 text-sm">
              <span className="font-semibold">{t('flag.suggestion')}:</span> {f.evidence.suggestion}
              <HelpEn nb={f.evidence.suggestion} />
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {f.evidence.suggestion && (
              <Button variant="primary" disabled={busy} onClick={() => edit(f.evidence.suggestion!)} data-testid={`use-suggestion-${line.lineId}`}>
                {t('s3.useSuggestion')}
              </Button>
            )}
            <Button disabled={busy} onClick={() => { setText(line.textNb); setEditing(true); }}>
              {t('s3.writeOwn')}
            </Button>
            {f.reason === 'model_error' && line.baselineNb !== null && line.textNb !== line.baselineNb && (
              <Button disabled={busy} onClick={() => edit(line.baselineNb!)} data-testid={`use-template-${line.lineId}`}>
                {t('s3.useTemplate')}
              </Button>
            )}
            {f.reason === 'model_error' && (
              <Button variant="danger" disabled={busy} onClick={() => w.act('ambiguity', (ctx, s) => flow.runAmbiguity(ctx, { ...s, lines: s.lines.map((l) => (l.lineId === line.lineId ? { ...l, flags: l.flags.filter((x) => x.reason !== 'model_error') } : l)) }, [line.lineId]), { machine: true })}>
                {t('common.retry')}
              </Button>
            )}
          </div>
        </div>
      ))}

      {removedFlag && (
        <div className="mt-3 rounded-lg bg-rose-50 p-3" data-testid={`removed-critical-${line.lineId}`}>
          <p className="flex items-start gap-2 text-sm font-bold text-rose-950">
            <Icon name="flag" /> {removedFlag.explanation[ui]}
          </p>
          <input className={`${inputClass} mt-2`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('s3.removalReason')} aria-label={t('s3.removalReason')} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} onClick={() => w.act('restore', (ctx, s) => flow.restoreLine(ctx, s, line.lineId))} data-testid={`restore-${line.lineId}`}>
              {t('s3.restore')}
            </Button>
            <Button disabled={busy || !reason.trim()} onClick={() => w.act('reason', (ctx, s) => flow.giveRemovalReason(ctx, s, line.lineId, reason))}>
              {t('s3.saveReason')}
            </Button>
          </div>
        </div>
      )}
      {removed && line.removalReason && <p className="mt-2 text-sm text-slate-700">{t('rec.removalReason')}: {line.removalReason}</p>}
      {line.origin === 'changed' && line.baselineNb && !editing && (
        <p className="mt-2 text-sm text-slate-600" data-testid={`was-${line.lineId}`}>
          {t('s3.was')}: «{line.baselineNb}»
          <HelpEn nb={line.baselineNb} line={{ templateLineId: line.templateLineId, textNb: line.baselineNb, baselineNb: line.baselineNb }} sja={sja} />
        </p>
      )}

      {line.plainSuggestion && !removed && !editing && (
        <p className="mt-2 text-sm text-slate-700">
          {t('s3.plain')}: «{line.plainSuggestion}»{' '}
          <HelpEn nb={line.plainSuggestion} />
          <button type="button" className="min-h-11 font-semibold text-blue-800 underline" disabled={busy} onClick={() => edit(line.plainSuggestion!)}>
            {t('s3.usePlain')}
          </button>
        </p>
      )}

      {line.origin === 'parameterFilled' && <p className="mt-1 text-xs text-slate-600">{t('s3.paramHint')}</p>}
      {!editing && (
        <div className="mt-1 flex flex-wrap gap-1">
          {!removed && line.origin !== 'parameterFilled' && line.aiSuggestion !== 'open' && (
            <Button variant="ghost" className="!px-2 text-sm" disabled={busy} onClick={() => { setText(line.textNb); setEditing(true); }} data-testid={`edit-${line.lineId}`}>
              {t('s3.edit')}
            </Button>
          )}
          {!removed && line.origin !== 'parameterFilled' && line.aiSuggestion !== 'open' && (
            <Button variant="ghost" className="!px-2 text-sm" disabled={busy} onClick={() => w.act('remove', (ctx, s) => flow.removeLine(ctx, s, line.lineId))} data-testid={`remove-${line.lineId}`}>
              {t('s3.remove')}
            </Button>
          )}
          {removed && !removedFlag && (
            <Button variant="ghost" className="!px-2 text-sm" disabled={busy} onClick={() => w.act('restore', (ctx, s) => flow.restoreLine(ctx, s, line.lineId))}>
              {t('s3.restore')}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function Step3({ w, hazards }: { w: Wizard; hazards?: HazardList }) {
  const t = useT();
  const replay = useApp((s) => s.config?.mode === 'replay');
  const sja = w.sja!;
  const draft = unverifiedReuse(sja);
  const [section, setSection] = useState<Section>('controls');
  const [newText, setNewText] = useState('');
  const [tried, setTried] = useState(false);
  const b = flow.contentBlockers(sja);
  const blocked = b.aiSuggestions + b.techRecheck + b.ambiguousCritical + b.criticalRemoved + b.checkErrors > 0;
  const redOpen = allFlags(sja).filter((r) => r.flag.status === 'open' && r.flag.severity === 'red').length;
  const attention = sja.lines.filter(
    (l) => (l.origin !== 'removed' && (l.techRecheck === 'open' || l.aiSuggestion === 'open' || l.flags.some((f) => f.type === 'SOURCE_AMBIGUOUS' && f.status === 'open'))) || l.flags.some((f) => f.type === 'CRITICAL_LINE_REMOVED' && f.status === 'open'),
  );
  const go = (id: string) => document.getElementById(`line-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const count = (key: string, n: number) => (n === 1 ? t(`${key}.one`) : t(key, { n }));

  const confirm = async () => {
    setTried(true);
    await w.act('confirmContent', (ctx, s) => flow.confirmContent(ctx, s), { machine: true });
  };

  return (
    <div className="space-y-4">
      <SummaryBar sja={sja} redOpen={redOpen} />
      {attention.length > 0 && (
        <Card tone="amber" className="space-y-2">
          <h2 className="text-base font-bold">{t('s3.attention', { n: attention.length })}</h2>
          <ul className="space-y-1">
            {attention.map((l) => (
              <li key={l.lineId}>
                <button type="button" className="min-h-11 text-left text-sm font-semibold text-blue-800 underline" onClick={() => go(l.lineId)}>
                  {l.flags.some((f) => f.type === 'CRITICAL_LINE_REMOVED' && f.status === 'open') ? t('flagType.CRITICAL_LINE_REMOVED') : l.flags.some((f) => f.reason === 'model_error' && f.status === 'open') ? t('s3.checkFailed') : l.flags.some((f) => f.type === 'SOURCE_AMBIGUOUS' && f.status === 'open') ? t('flagType.SOURCE_AMBIGUOUS') : l.aiSuggestion === 'open' ? t('flagType.AI_ADDED_CONTENT') : t('flagType.TECH_RECHECK')}
                  : {l.textNb.slice(0, 60)}
                  {l.textNb.length > 60 ? '…' : ''}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="flex items-start gap-2 text-sm text-slate-700" data-testid="lines-legend">
        <Icon name="info" className="mt-0.5 h-4 w-4 text-slate-600" />
        <span>
          {t('s3.legend')} <Icon name="warn" className="h-4 w-4 text-slate-600" /> <span className="sr-only">{t('line.critical')}: </span>
          {t('s3.legendCritical')}
        </span>
      </p>
      {draft.total > 0 && draft.unverified > 0 && (
        <Notice tone="amber">
          <span data-testid="template-draft-note">{draft.unverified === draft.total ? t('s3.templateDraft') : t('s3.templatePartly', { n: draft.unverified, total: draft.total })}</span>
        </Notice>
      )}
      {replay && <Notice tone="violet">{t('s3.demoNote')}</Notice>}

      {SECTIONS.map((sec) => {
        const lines = sja.lines.filter((l) => l.section === sec);
        if (lines.length === 0) return null;
        return (
          <div key={sec}>
            <SectionHeading>{t(`section.${sec}`)}</SectionHeading>
            <ul className="mt-2 space-y-2">
              {lines.map((l) => (
                <LineRow key={l.lineId} line={l} w={w} hazards={hazards} />
              ))}
            </ul>
          </div>
        );
      })}

      <Card tone="quiet" className="space-y-2">
        <h3 className="text-sm font-bold">{t('s3.addLine')}</h3>
        <select className={inputClass} value={section} onChange={(e) => setSection(e.target.value as Section)} aria-label={t('rec.section')}>
          {SECTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`section.${s}`)}
            </option>
          ))}
        </select>
        <textarea className={inputClass} rows={2} value={newText} onChange={(e) => setNewText(e.target.value)} placeholder={t('s3.addPlaceholder')} data-testid="add-line-text" />
        <Button disabled={!newText.trim() || Boolean(w.busy)} onClick={async () => { await w.act('add', (ctx, s) => flow.addLine(ctx, s, section, newText)); setNewText(''); }} data-testid="add-line">
          {t('s3.add')}
        </Button>
      </Card>

      {blocked && (
        <Notice tone="amber">
          <strong>{t('s3.blockedTitle')}</strong>
          <ul className="ml-5 list-disc">
            {b.techRecheck > 0 && <li>{count('s3.blockRecheck', b.techRecheck)}</li>}
            {b.aiSuggestions > 0 && <li>{count('s3.blockAi', b.aiSuggestions)}</li>}
            {b.ambiguousCritical > 0 && <li>{count('s3.blockAmbiguous', b.ambiguousCritical)}</li>}
            {b.criticalRemoved > 0 && <li>{count('s3.blockRemoved', b.criticalRemoved)}</li>}
            {b.checkErrors > 0 && <li>{count('s3.blockErrors', b.checkErrors)}</li>}
          </ul>
        </Notice>
      )}
      {tried && blocked && !w.busy && <Notice tone="red">{t('s3.notConfirmed')}</Notice>}
      {w.busy === 'confirmContent' && <Spinner label={t('busy.ambiguity')} />}
      {w.error && <ErrorBox message={w.error.message} onRetry={w.error.retry} retryLabel={t('common.retry')} />}
      <p className="text-sm text-slate-700">{t('s3.confirmHint')}</p>
      <ActionBar
        note={
          blocked && attention.length > 0 ? (
            <span className="flex items-center justify-between gap-3 font-semibold text-amber-950">
              <span className="flex items-center gap-2">
                <Icon name="warn" /> {attention.length === 1 ? t('s3.todo.one') : t('s3.todo', { n: attention.length })}
              </span>
              <button type="button" className="shrink-0 rounded px-2 py-1 font-semibold text-blue-800 underline" onClick={() => go(attention[0].lineId)} data-testid="go-next-attention">
                {t('s3.showNext')}
              </button>
            </span>
          ) : undefined
        }
      >
        <Button onClick={() => w.goStep(2)} disabled={Boolean(w.busy)}>
          {t('common.back')}
        </Button>
        <Button variant="primary" className="flex-1" disabled={Boolean(w.busy) || blocked} onClick={confirm} data-testid="confirm-content">
          {t('s3.confirm')}
        </Button>
      </ActionBar>
    </div>
  );
}

const inFlight = new Set<string>();

export function needsLanguageCheck(sja: Sja, pack: DataPack): boolean {
  if (!sja.contentConfirmed) return false;
  if (!sja.languageCheckDone) return true;
  const langs = supportedLangs(sja, pack);
  return activeLines(sja).some(
    (l) =>
      (l.origin === 'changed' || l.origin === 'new') &&
      langs.some((lang) => {
        const e = l.byLang[lang];
        return !e || (e.checkState === 'pending' && !e.oralFallback);
      }),
  );
}

export function Step4({ w, pack }: { w: Wizard; pack: DataPack }) {
  const t = useT();
  const ui = useUiLang();
  const sja = w.sja!;
  const started = useRef(false);

  useEffect(() => {
    if (started.current || inFlight.has(sja.sjaId) || !needsLanguageCheck(sja, pack)) return;
    started.current = true;
    inFlight.add(sja.sjaId);
    void w.act('languageCheck', (ctx, s) => flow.runLanguageCheck(ctx, s), { machine: true }).finally(() => inFlight.delete(sja.sjaId));
  }, [sja, pack, w]);

  const langs = supportedLangs(sja, pack);
  const refs = sortFlags(allFlags(sja).filter((r) => r.flag.type !== 'AI_ADDED_CONTENT' && r.flag.type !== 'CRITICAL_LINE_REMOVED' && (r.lang !== 'nb' || r.flag.status === 'open')));
  const openRefs = refs.filter((r) => r.flag.status === 'open');
  const doneRefs = refs.filter((r) => r.flag.status === 'resolved');
  const blocking = openRefs.filter((r) => isBlocking(r.flag, Boolean(r.line?.critical))).length;
  const checked = activeLines(sja).filter((l) => l.origin === 'changed' || l.origin === 'new');
  const errors = checked.flatMap((l) => langs.filter((lang) => l.byLang[lang]?.checkState === 'error' && !l.byLang[lang]?.oralFallback).map((lang) => ({ line: l, lang })));
  const reusedCount = activeLines(sja).length - checked.length;
  const busyCheck = w.busy === 'languageCheck';

  const onRoute = (flag: Flag, route: Route, payload?: { text?: string; reason?: string }) => void w.act('route', (ctx, s) => flow.applyRoute(ctx, s, flag.flagId, route, payload), { machine: route === 'approvedTerm' || route === 'rewrite' });

  const next = () => {
    if (!sja.understanding.required) {
      // D7: skipped, with the reason in the log (AC-14).
      useLog.getState().add({ runId: sja.sjaId, testId: sja.testId, arm: 'flagship', actor: 'system', type: 'understanding_not_required', step: 'understanding', packVersion: sja.packVersion });
      useSjas.getState().addTrace(sja.sjaId, { kind: 'rule', step: 'understanding', title: 'D7 understanding check not required', detail: 'No safety-critical line is changed or new, no new worker, and not the first time for this crew.' });
      w.goStep(6);
    } else w.goStep(5);
  };

  return (
    <div className="space-y-4">
      {busyCheck && (
        <Card tone="blue" className="space-y-2">
          <Spinner label={t('s4.working')} />
          <p className="text-sm text-slate-800">{t('s4.workingDetail')}</p>
          {w.progress && (
            <>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-blue-700 transition-all" style={{ width: `${w.progress.total ? (100 * w.progress.done) / w.progress.total : 100}%` }} />
              </div>
              <p className="text-sm font-semibold">{t('s4.progress', { done: w.progress.done, total: w.progress.total })}</p>
            </>
          )}
        </Card>
      )}

      {!busyCheck && sja.languageCheckDone && (
        <>
          <Card className="space-y-1" tone={blocking || errors.length ? 'plain' : 'green'}>
            <p className="text-base font-semibold" data-testid="check-summary">
              {t(checked.length === 1 ? 's4.summary.one' : 's4.summary', { lines: checked.length, langs: langs.length, reused: reusedCount })}
            </p>
            <p className="text-sm text-slate-700" data-testid="open-flag-count">
              {blocking === 1 ? t('s4.blocking.one') : blocking > 0 ? t('s4.blocking', { n: blocking }) : t('s4.noBlocking')}
              {openRefs.length > blocking ? ` ${openRefs.length - blocking === 1 ? t('s4.optional.one') : t('s4.optional', { n: openRefs.length - blocking })}` : ''}
            </p>
          </Card>

          {errors.map(({ line, lang }) => (
            <Card key={`${line.lineId}-${lang}`} tone="red" className="space-y-2">
              <p className="flex items-start gap-2 text-base font-bold" data-testid={`line-error-${line.lineId}-${lang}`}>
                <Icon name="warn" /> {t('s4.lineError')} ({langName(lang, ui)})
              </p>
              <p className="text-sm">{line.textNb}</p>
              <HelpEn nb={line.textNb} line={line} sja={sja} />
              <p className="text-sm text-slate-700">{line.byLang[lang]?.error}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={Boolean(w.busy)} onClick={() => w.act('retry', (ctx, s) => flow.retryLine(ctx, s, line.lineId, lang), { machine: true })} data-testid="retry-line">
                  {t('common.retry')}
                </Button>
                <Button disabled={Boolean(w.busy)} onClick={() => w.act('oral', (ctx, s) => flow.oralForLine(ctx, s, line.lineId, lang))} data-testid="oral-line">
                  {t('route.oral')}
                </Button>
              </div>
            </Card>
          ))}

          {openRefs.length > 0 && <h2 className="text-base font-bold">{t('s4.openFlags', { n: openRefs.length })}</h2>}
          {openRefs.map((r) => (
            <FlagCard key={r.flag.flagId} fref={r} actions={{ onRoute, busy: Boolean(w.busy) }} />
          ))}
          {w.busy === 'route' && <Spinner label={t('s4.recheck')} />}

          {doneRefs.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="min-h-11 cursor-pointer text-base font-semibold">{t('s4.handled', { n: doneRefs.length })}</summary>
              <div className="mt-2 space-y-2">
                {doneRefs.map((r) => (
                  <FlagCard key={r.flag.flagId} fref={r} readOnly />
                ))}
              </div>
            </details>
          )}

          <details className="rounded-xl border border-slate-200 bg-white p-3">
            <summary className="min-h-11 cursor-pointer text-base font-semibold">{t('s4.showTranslations')}</summary>
            <div className="mt-2 space-y-3">
              {checked.map((l) => (
                <div key={l.lineId} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <p className="font-semibold">{l.textNb}</p>
                  <HelpEn nb={l.textNb} line={l} sja={sja} />
                  {langs.map((lang) => (
                    <p key={lang} className="mt-1">
                      <span className="font-semibold">{langName(lang, ui)}:</span> <span lang={lang}>{l.byLang[lang]?.oralFallback ? `(${t('rec.oral')})` : l.byLang[lang]?.text || '–'}</span>
                      {l.byLang[lang]?.backTranslation && (
                        <span className="block text-slate-600">
                          {t('flag.backTranslation')}: {l.byLang[lang]?.backTranslation}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              ))}
              {checked.length === 0 && <p className="text-sm text-slate-700">{t('s4.nothingChanged')}</p>}
            </div>
          </details>
        </>
      )}

      {w.error && <ErrorBox message={w.error.message} onRetry={w.error.retry} retryLabel={t('common.retry')} />}
      <ActionBar
        note={
          sja.languageCheckDone && !busyCheck && blocking + errors.length > 0 ? (
            <span className="flex items-start gap-2 font-semibold text-amber-950" data-testid="step4-open-note">
              <Icon name="warn" /> {t('s4.openNote')}
            </span>
          ) : undefined
        }
      >
        <Button onClick={() => w.goStep(3)} disabled={Boolean(w.busy)}>
          {t('common.back')}
        </Button>
        <Button variant={blocking + errors.length > 0 ? 'secondary' : 'primary'} className="flex-1" disabled={Boolean(w.busy) || !sja.languageCheckDone} onClick={next} data-testid="step4-continue">
          {sja.understanding.required ? t('s4.toUnderstanding') : t('s4.toSign')}
        </Button>
      </ActionBar>
    </div>
  );
}
