// Components for SJA content: badges, flag cards, the gate checklist.
import { useState, type ReactNode } from 'react';
import { allowedRoutes, routeDisabled, type FlagRef } from '../core/flags';
import type { GateCondition } from '../core/rules/gate';
import type { Flag, HazardList, Origin, Route, Sja, SjaLine, VerificationState } from '../core/types';
import { LANG_NAMES } from '../core/util';
import { useT, useUiLang } from '../i18n';
import { useApp } from '../state/stores';
import { HelpEn } from './HelpEn';
import { Button, Card, Chip, Icon, inputClass } from './ui';

export function OriginBadge({ origin }: { origin: Origin }) {
  const t = useT();
  const tone = { reused: 'slate', parameterFilled: 'blue', changed: 'amber', new: 'amber', removed: 'red' }[origin] as 'slate' | 'blue' | 'amber' | 'red';
  return <Chip tone={tone}>{t(`origin.${origin}`)}</Chip>;
}

export function VerificationChip({ state }: { state: VerificationState }) {
  const t = useT();
  const tone = { draft: 'slate', languageChecked: 'blue', technicallyChecked: 'blue', verified: 'green' }[state] as 'slate' | 'blue' | 'green';
  return (
    <Chip tone={tone}>
      {state === 'verified' && <Icon name="check" className="h-3 w-3" />}
      {t(`verif.${state}`)}
    </Chip>
  );
}

export function CriticalMark() {
  const t = useT();
  return (
    <Chip tone="red" title={t('line.criticalTitle')}>
      <Icon name="warn" className="h-3 w-3" /> {t('line.critical')}
    </Chip>
  );
}

/** `quiet`: say nothing when a line has no source. The foreman only needs the warning on a line the AI added. */
export function SourceRef({ hazardRef, hazards, quiet = false }: { hazardRef: string | null; hazards?: HazardList; quiet?: boolean }) {
  const t = useT();
  const entry = hazards?.entries.find((h) => h.hazardId === hazardRef);
  if (!entry) return quiet ? null : <span className="text-xs font-semibold text-slate-600">{t('line.unsourced')}</span>;
  const source = hazards?.sources.find((s) => s.sourceId === entry.sourceId);
  return (
    <span className="text-xs text-slate-600" title={source?.title}>
      {t('line.source')}: {source?.publisher ?? entry.sourceId}, {entry.sourceDetail}
    </span>
  );
}

/** A flag is never only colour: it carries an icon and a word (8.4). */
export function SeverityMark({ flag }: { flag: Pick<Flag, 'severity' | 'status'> }) {
  const t = useT();
  if (flag.status === 'resolved') {
    return (
      <Chip tone="green">
        <Icon name="check" className="h-3 w-3" /> {t('flag.resolved')}
      </Chip>
    );
  }
  if (flag.severity === 'red') {
    return (
      <Chip tone="red">
        <Icon name="flag" className="h-3 w-3" /> {t('flag.red')}
      </Chip>
    );
  }
  return (
    <Chip tone="amber">
      <Icon name="warn" className="h-3 w-3" /> {t('flag.amber')}
    </Chip>
  );
}

const normWord = (w: string) => w.toLowerCase().replace(/[.,;:!?«»"()]/g, '');

/** Word-level difference between two Norwegian sentences, so the foreman can see what moved. */
export function wordDiff(a: string, b: string): { a: { text: string; changed: boolean }[]; b: { text: string; changed: boolean }[] } {
  const x = a.split(/\s+/).filter(Boolean);
  const y = b.split(/\s+/).filter(Boolean);
  const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      dp[i][j] = normWord(x[i]) === normWord(y[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const outA = x.map((text) => ({ text, changed: true }));
  const outB = y.map((text) => ({ text, changed: true }));
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (normWord(x[i]) === normWord(y[j])) {
      outA[i].changed = false;
      outB[j].changed = false;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { a: outA, b: outB };
}

export function DiffPair({ source, back }: { source: string; back: string }) {
  const t = useT();
  const d = wordDiff(source, back);
  const identical = d.a.every((w) => !w.changed) && d.b.every((w) => !w.changed);
  return (
    <dl className="mt-2 space-y-2 text-base">
      <div>
        <dt className="text-xs font-bold uppercase tracking-wide text-slate-600">{t('flag.original')}</dt>
        <dd>
          {d.a.map((w, k) => (
            <span key={k}>{w.changed ? <del className="diff">{w.text}</del> : w.text} </span>
          ))}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-bold uppercase tracking-wide text-slate-600">{t('flag.backTranslation')}</dt>
        <dd>
          {d.b.map((w, k) => (
            <span key={k}>{w.changed ? <ins className="diff">{w.text}</ins> : w.text} </span>
          ))}
          {identical && <span className="ml-1 text-sm text-slate-600">({t('flag.sameWords')})</span>}
        </dd>
      </div>
      <p className="text-sm text-slate-600">{t('flag.backHint')}</p>
    </dl>
  );
}

export function langName(lang: string, ui: 'nb' | 'en') {
  return LANG_NAMES[lang]?.[ui] ?? lang;
}

export interface FlagActions {
  onRoute: (flag: Flag, route: Route, payload?: { text?: string; reason?: string }) => void;
  busy: boolean;
}

export function FlagCard({ fref, actions, readOnly = false }: { fref: FlagRef; actions?: FlagActions; readOnly?: boolean }) {
  const t = useT();
  const ui = useUiLang();
  const { flag, line, lang } = fref;
  const [mode, setMode] = useState<null | 'rewrite' | 'acknowledged'>(null);
  const [text, setText] = useState(line?.textNb ?? '');
  const [reason, setReason] = useState('');
  const critical = Boolean(line?.critical);
  const routes = readOnly ? [] : allowedRoutes(flag, critical);
  const target = line && lang !== 'nb' ? line.byLang[lang]?.text : undefined;
  const waiting = flag.status === 'open' && flag.route === 'reviewer';
  const replay = useApp((s) => s.config?.mode === 'replay');
  const failedCheck = flag.reason === 'model_error';
  const tone = flag.status === 'resolved' ? 'green' : flag.severity === 'red' ? 'red' : 'amber';

  return (
    <Card tone={tone} className="space-y-2" >
      <div className="flex flex-wrap items-center gap-2" data-testid={`flag-${flag.type}-${lang}`}>
        <SeverityMark flag={flag} />
        <strong className="text-base">{failedCheck ? t('s3.checkFailed') : t(`flagType.${flag.type}`)}</strong>
        {lang !== 'nb' && <Chip tone="slate">{langName(lang, ui)}</Chip>}
        {critical && <CriticalMark />}
        <Chip tone="slate" title={`${t('flag.raisedByTitle')} (${flag.raisedBy})`}>
          {t('flag.foundBy')} {t(`foundBy.${flag.raisedBy}`)}
        </Chip>
      </div>
      <p className="text-base font-medium">{flag.explanation[ui]}</p>

      {line && (
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{t('flag.line')}:</span> {line.textNb}
          <HelpEn nb={line.textNb} line={line} />
        </p>
      )}
      {flag.evidence.backTranslation && flag.evidence.source && <DiffPair source={flag.evidence.source} back={flag.evidence.backTranslation} />}
      {(flag.evidence.expected || flag.evidence.found) && (
        <p className="text-sm">
          {flag.evidence.expected && (
            <>
              <span className="font-semibold">{t('flag.expected')}:</span> {flag.evidence.expected}{' '}
            </>
          )}
          {flag.evidence.found && (
            <>
              <span className="font-semibold">{t('flag.found')}:</span> {flag.evidence.found}
            </>
          )}
        </p>
      )}
      {flag.evidence.suggestion && flag.status === 'open' && (
        <p className="rounded-lg bg-slate-50 p-2 text-sm">
          <span className="font-semibold">{t('flag.suggestion')}:</span> {flag.evidence.suggestion}
          <HelpEn nb={flag.evidence.suggestion} />
        </p>
      )}
      {target && (
        <p className="text-sm text-slate-600">
          <span className="font-semibold">
            {t('flag.target')} ({langName(lang, ui)}):
          </span>{' '}
          <span lang={lang}>{target}</span>
        </p>
      )}

      {flag.status === 'resolved' && (
        <p className="text-sm font-semibold text-emerald-900">
          {t('flag.handledBy')}: {flag.route ? t(`route.${flag.route}`) : t('flag.settled')} · {t(`actor.${flag.resolvedBy ?? 'system'}`)}
          {flag.reason && flag.reason !== 'corrected' ? ` · ${flag.reason}` : ''}
          {flag.reviewerVerdict ? ` · ${t(`verdict.${flag.reviewerVerdict.kind}`)}` : ''}
        </p>
      )}
      {waiting && (
        <p className="flex items-center gap-2 rounded-lg bg-violet-50 p-2 text-sm font-semibold text-violet-950">
          <Icon name="clock" /> {t('flag.waitingReviewer')}
        </p>
      )}
      {flag.status === 'open' && flag.reviewerVerdict?.kind === 'confirmed' && (
        <p className="rounded-lg bg-rose-50 p-2 text-sm font-semibold text-rose-950">
          {t('flag.reviewerConfirmed')}: {flag.reviewerVerdict.reason}
        </p>
      )}
      {flag.autoAttempts > 0 && flag.status === 'open' && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-950">
          {t('flag.attempts', { n: flag.autoAttempts })} {t('flag.attemptsHint')}
        </p>
      )}

      {routes.length > 0 && actions && mode === null && <p className="pt-1 text-sm font-bold text-slate-900">{t('flag.choose')}</p>}
      {routes.length > 0 && actions && mode === null && (
        <div className="grid gap-2 sm:grid-cols-2">
          {routes.map((route) => {
            const disabled = routeDisabled(flag, route) || actions.busy || (route === 'reviewer' && waiting);
            const click = () => {
              if (route === 'rewrite') {
                setText(flag.type === 'SOURCE_AMBIGUOUS' && flag.evidence.suggestion ? flag.evidence.suggestion : (line?.textNb ?? ''));
                setMode('rewrite');
              } else if (route === 'acknowledged') setMode('acknowledged');
              else actions.onRoute(flag, route);
            };
            return (
              <Button key={route} variant={route === 'approvedTerm' ? 'primary' : 'secondary'} disabled={disabled} onClick={click} data-testid={`route-${route}`} className="flex-col !items-start">
                <span>{t(route === 'oral' && flag.type === 'UNSUPPORTED_LANGUAGE' ? 'route.oralWhole' : `route.${route}`)}</span>
                <span className="text-xs font-normal opacity-90">{routeDisabled(flag, route) ? t('route.disabledAfterTwo') : t(`route.${route}.desc`)}</span>
              </Button>
            );
          })}
        </div>
      )}

      {mode === 'rewrite' && actions && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <label className="block text-sm font-semibold" htmlFor={`rw-${flag.flagId}`}>
            {t('rewrite.label')}
          </label>
          <textarea id={`rw-${flag.flagId}`} className={inputClass} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          {replay && <p className="text-sm text-violet-950">{t('rewrite.demoNote')}</p>}
          {line?.plainSuggestion && (
            <Button variant="ghost" onClick={() => setText(line.plainSuggestion ?? '')} data-testid="use-plain">
              {t('rewrite.usePlain')}: «{line.plainSuggestion}»
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={actions.busy || !text.trim() || text.trim() === line?.textNb} onClick={() => { actions.onRoute(flag, 'rewrite', { text }); setMode(null); }} data-testid="rewrite-save">
              {t('rewrite.save')}
            </Button>
            <Button onClick={() => setMode(null)}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}
      {mode === 'acknowledged' && actions && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <label className="block text-sm font-semibold" htmlFor={`ack-${flag.flagId}`}>
            {t('ack.label')}
          </label>
          <input id={`ack-${flag.flagId}`} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('ack.placeholder')} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={actions.busy || !reason.trim()} onClick={() => { actions.onRoute(flag, 'acknowledged', { reason }); setMode(null); }} data-testid="ack-save">
              {t('ack.save')}
            </Button>
            <Button onClick={() => setMode(null)}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function GateChecklist({ conditions, onGo }: { conditions: GateCondition[]; onGo?: (step: number) => void }) {
  const t = useT();
  const stepFor: Record<string, number> = { contentConfirmed: 3, aiSuggestions: 3, techRecheck: 3, sourceFlags: 3, languageCheck: 4, flags: 4, understanding: 5 };
  // What is missing comes first and stands out. What is in order is a quiet tick.
  const sorted = [...conditions].sort((a, b) => Number(a.ok) - Number(b.ok));
  return (
    <ul className="space-y-1" data-testid="gate-checklist">
      {sorted.map((c) =>
        c.ok ? (
          <li key={c.id} className="flex items-start gap-2 px-1 py-1 text-[15px] text-slate-800" data-testid={`gate-${c.id}-ok`}>
            <Icon name="check" className="mt-0.5 h-5 w-5 text-emerald-700" />
            <span>
              {t(`gate.${c.id}`)} <span className="sr-only">– {t('gate.ok')}</span>
            </span>
          </li>
        ) : (
          <li key={c.id} className="flex items-start gap-2 rounded-lg border-2 border-rose-400 bg-rose-50 p-3" data-testid={`gate-${c.id}-open`}>
            <Icon name="lock" className="mt-0.5 h-5 w-5 text-rose-800" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-rose-950">
                {t(`gate.${c.id}.open`)}
                {c.open > 1 ? ` (${c.open})` : ''}
              </p>
              {onGo && (
                <button type="button" className="mt-1 min-h-11 text-base font-semibold text-blue-800 underline" onClick={() => onGo(stepFor[c.id])}>
                  {t('gate.goTo', { n: stepFor[c.id] })}
                </button>
              )}
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

export function SummaryBar({ sja, redOpen }: { sja: Sja; redOpen: number }) {
  const t = useT();
  const c = { reused: 0, parameterFilled: 0, changed: 0, new: 0, removed: 0 };
  for (const l of sja.lines) c[l.origin] += 1;
  const total = sja.lines.length - c.removed;
  const fresh = c.changed + c.new;
  const item = (n: number, label: string, strong = false) => (
    <span className={`whitespace-nowrap ${strong ? 'font-bold text-slate-900' : ''}`}>
      {n} {label}
    </span>
  );
  return (
    <div className="rounded-xl border border-slate-300 bg-white px-3 py-3">
      <p className="text-base font-semibold" data-testid="summary-lead">
        {fresh === 0 ? t('summary.leadNone', { total }) : fresh === 1 ? t('summary.lead.one', { same: total - fresh, total }) : t('summary.lead', { same: total - fresh, total, fresh })}
      </p>
      <div data-testid="summary-bar" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
        {item(c.reused, t(c.reused === 1 ? 'summary.reused.one' : 'summary.reused'))}
        {item(c.parameterFilled, t(c.parameterFilled === 1 ? 'summary.parameterFilled.one' : 'summary.parameterFilled'))}
        {item(c.changed, t(c.changed === 1 ? 'summary.changed.one' : 'summary.changed'), c.changed > 0)}
        {item(c.new, t(c.new === 1 ? 'summary.new.one' : 'summary.new'), c.new > 0)}
        {c.removed > 0 && item(c.removed, t('summary.removed'), true)}
        <span className={`whitespace-nowrap font-bold ${redOpen ? 'text-rose-800' : 'text-emerald-800'}`}>
          <Icon name={redOpen ? 'flag' : 'check'} className="h-4 w-4" /> {redOpen} {t(redOpen === 1 ? 'summary.redFlags.one' : 'summary.redFlags')}
        </span>
      </div>
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-slate-600">{children}</h3>;
}

export function lineLabel(line: SjaLine) {
  return line.textNb;
}
