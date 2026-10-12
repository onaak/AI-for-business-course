// The foreman wizard: six steps, one category of time per step (plan 7.2).
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, Icon, Layout, Spinner } from '../components/ui';
import { gateConditions } from '../core/rules/gate';
import type { TimeCategory } from '../core/types';
import { useT, useUiLang } from '../i18n';
import { useApp, useLog } from '../state/stores';
import { timing } from '../state/timing';
import { Step1, Step2 } from './foreman/Steps12';
import { Step3, Step4 } from './foreman/Steps34';
import { Step5, Step6 } from './foreman/Steps56';
import { useWizard } from './foreman/useWizard';

const STEP_CATEGORY: Record<number, TimeCategory> = { 1: 'input', 2: 'input', 3: 'contentReview', 4: 'flagResolution', 5: 'understanding', 6: 'signoff' };
const STEP_NAME: Record<number, string> = { 1: 'job', 2: 'understood', 3: 'content', 4: 'languageCheck', 5: 'understanding', 6: 'sign' };

/** Small control for the test observer or adviser: counts the times help was given, and pauses timing (F-13, SC-14). */
function ObserverControl({ assists, onAssist, runId }: { assists: number; onAssist: () => void; runId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => timing.subscribe(() => force((n) => n + 1)), []);
  const paused = timing.isPaused();
  return (
    <div className="no-print relative shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="observer-toggle" className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold underline underline-offset-2 ${paused ? 'bg-amber-200 text-amber-950' : 'text-slate-600'}`}>
        <Icon name="clock" className="h-4 w-4" /> {paused ? t('obs.paused') : t('obs.title')}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-64 space-y-2 rounded-xl border border-slate-400 bg-white p-3 shadow-lg">
          <p className="text-sm text-slate-700">{t('obs.hint')}</p>
          <Button className="w-full" onClick={onAssist} data-testid="assist-button">
            {t('obs.assist')} ({assists})
          </Button>
          <Button className="w-full" onClick={() => (paused ? timing.resume() : timing.pause())}>
            {paused ? t('obs.resume') : t('obs.pause')}
          </Button>
          <Link to={`/runs/${runId}`} className="block min-h-11 py-2 text-center text-sm font-semibold text-blue-800 underline">
            {t('obs.trace')}
          </Link>
        </div>
      )}
    </div>
  );
}

/** Where the foreman is, what this step is for, and what comes next. */
function StepIndicator({ step, skipped5, onGo, locked, signed, observer, unfinished }: { step: number; skipped5: boolean; onGo: (n: number) => void; locked: boolean; signed: boolean; observer?: ReactNode; unfinished: Set<number> }) {
  const t = useT();
  const ui = useUiLang();
  const nextStep = step === 4 && skipped5 ? 6 : step + 1;
  return (
    <nav aria-label={t('wizard.steps')} className="no-print mb-4">
      <ol className="flex gap-1">
        {[1, 2, 3, 4, 5, 6].map((n) => {
          // A step the foreman has passed is only ticked when nothing in it is still open.
          const open = !signed && n < step && unfinished.has(n);
          const state = signed ? 'done' : n === step ? 'current' : open ? 'open' : n < step ? 'done' : 'todo';
          const skip = n === 5 && skipped5;
          return (
            <li key={n} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={locked || n >= step}
                onClick={() => onGo(n)}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={`${t('wizard.stepOf', { n })}: ${t(`wizard.step${n}`)}${skip ? ` (${t('wizard.skipped')})` : ''}${open ? ` (${t('wizard.unfinished')})` : ''}`}
                data-state={state}
                data-testid={`step-pill-${n}`}
                className={`flex min-h-11 w-full flex-col items-center justify-center rounded-lg border px-0.5 text-xs font-bold ${state === 'current' ? 'border-blue-700 bg-blue-700 text-white' : state === 'open' ? 'border-amber-600 bg-amber-50 text-amber-950' : state === 'done' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-500'}`}
              >
                <span>{state === 'open' ? <Icon name="warn" className="h-4 w-4" /> : state === 'done' && !skip ? <Icon name="check" className="h-4 w-4" /> : n}</span>
                <span className="w-full truncate text-center text-[10px] font-semibold leading-tight sm:text-[11px]">{skip ? t('wizard.skipped') : t(`wizard.step${n}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <h1 className="mt-3 text-xl font-bold" data-testid="step-title">
        {signed ? t('wizard.signedTitle') : `${t('wizard.stepOf', { n: step })}: ${t(`wizard.title${step}`)}`}
      </h1>
      <p className="mt-0.5 text-[15px] text-slate-700" data-testid="step-help">
        {signed ? t('wizard.helpSigned') : t(`wizard.help${step}`)}
      </p>
      {ui === 'en' && (signed || step >= 2) && (
        <p className="mt-1 text-[13px] italic text-slate-500" data-testid="help-en-note">
          {t('help.note')}
        </p>
      )}
      {!signed && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">{step < 6 ? `${t('wizard.next')}: ${t(`wizard.title${nextStep}`)}` : ''}</p>
          {observer}
        </div>
      )}
    </nav>
  );
}

export default function Foreman() {
  const t = useT();
  const { sjaId = '' } = useParams();
  const [search] = useSearchParams();
  const pack = useApp((s) => s.pack);
  const hazards = useApp((s) => s.hazards);
  const w = useWizard(sjaId);
  const sja = w.sja;
  const step = sja?.step ?? 1;
  const signed = sja?.status === 'signed' || sja?.status === 'signedWithFallback';
  const assists = useLog((s) => s.events.filter((e) => e.runId === sjaId && e.type === 'assist').length);

  // Timing is taken from step transitions (SC-14).
  useEffect(() => {
    if (signed) timing.close();
    else timing.enter(sjaId, STEP_CATEGORY[step], STEP_NAME[step]);
  }, [sjaId, step, signed]);
  useEffect(() => () => timing.close(), [sjaId]);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, and React treats an effect's return value as its clean-up.
    window.scrollTo({ top: 0 });
  }, [step, signed]);

  if (!pack) {
    return (
      <Layout title={t('wizard.title')}>
        <Spinner label={t('common.loading')} />
      </Layout>
    );
  }
  const template = pack.templates.find((x) => x.templateId === sja?.templateId);
  const view = signed ? 6 : step;
  const stepOf: Record<string, number> = { contentConfirmed: 3, aiSuggestions: 3, techRecheck: 3, sourceFlags: 3, languageCheck: 4, flags: 4, understanding: 5 };
  const unfinished = new Set(sja && template ? gateConditions(sja, pack).filter((c) => !c.ok).map((c) => stepOf[c.id]) : []);

  return (
    <Layout title={t('wizard.title')}>
      <StepIndicator
        step={view}
        skipped5={Boolean(sja && sja.languageCheckDone && !sja.understanding.required)}
        onGo={w.goStep}
        locked={signed || Boolean(w.busy)}
        signed={signed}
        unfinished={unfinished}
        observer={!signed ? <ObserverControl assists={assists} onAssist={w.assist} runId={sjaId} /> : undefined}
      />
      {(view === 1 || !sja || !template) && <Step1 w={w} sjaId={sjaId} pack={pack} testId={search.get('test') ?? undefined} fixtureId={search.get('fixture') ?? undefined} />}
      {sja && template && view === 2 && <Step2 w={w} />}
      {sja && template && view === 3 && <Step3 w={w} hazards={hazards.find((h) => h.templateId === sja.templateId)} />}
      {sja && template && view === 4 && <Step4 w={w} pack={pack} />}
      {sja && template && view === 5 && <Step5 w={w} template={template} pack={pack} />}
      {sja && template && view === 6 && <Step6 w={w} pack={pack} />}
    </Layout>
  );
}
