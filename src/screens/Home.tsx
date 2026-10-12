// Home. No login. One main thing to do (make today's SJA), then the tools for
// reviewers and for the project group, kept apart so they do not distract a foreman
// during a timed test (8.2).
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Chip, Icon, Layout, ModeChip, Notice, type IconName } from '../components/ui';
import { needsObservation } from '../core/rules/understanding';
import type { Sja } from '../core/types';
import { uid } from '../core/util';
import { useT } from '../i18n';
import { useApp, useLog, useSjas } from '../state/stores';

function Tile({ to, title, text, icon, testid }: { to: string; title: string; text: string; icon: IconName; testid: string }) {
  return (
    <Link to={to} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-slate-300 bg-white p-3 text-left shadow-sm hover:border-blue-600" data-testid={testid}>
      <Icon name={icon} className="h-6 w-6 text-blue-800" />
      <span className="min-w-0">
        <span className="block text-base font-bold">{title}</span>
        <span className="block text-sm text-slate-700">{text}</span>
      </span>
    </Link>
  );
}

function Group({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{title}</h2>
      <p className="text-sm text-slate-700">{hint}</p>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const isSigned = (s: Sja) => s.status === 'signed' || s.status === 'signedWithFallback';

export default function Home() {
  const t = useT();
  const ui = useApp((s) => s.lang);
  const navigate = useNavigate();
  const { config, pack, loadError } = useApp();
  const sjas = Object.values(useSjas((s) => s.sjas)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const clearSjas = useSjas((s) => s.clear);
  const clearLog = useLog((s) => s.clear);
  const jobName = (s: Sja) => pack?.templates.find((x) => x.templateId === s.templateId)?.jobType[ui] ?? s.templateId;
  const when = (s: Sja) => s.createdAt.slice(0, 16).replace('T', ' ');
  const inProgress = sjas.filter((s) => !isSigned(s));
  const toObserve = sjas.filter(needsObservation).slice(0, 2);
  const steps = [1, 2, 3, 4, 5, 6];

  return (
    <Layout back={false}>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">SJA Forstått</h1>
          <p className="mt-1 text-base text-slate-700">{t('home.intro')}</p>
        </header>

        {loadError && <Notice tone="red">{t('home.loadError')} {loadError}</Notice>}
        {config?.mode === 'replay' && <Notice tone="violet">{t('home.demoNote')}</Notice>}
        {config && config.mode !== 'replay' && !config.configured && <Notice tone="red">{t('home.noKeyNote')}</Notice>}

        <section className="space-y-3" aria-label={t('home.start')}>
          {toObserve.map((s) => (
            <Link key={s.sjaId} to={`/foreman/${s.sjaId}`} className="flex items-center gap-3 rounded-xl border-2 border-amber-500 bg-amber-50 p-3" data-testid="home-observe">
              <Icon name="eye" className="h-6 w-6 text-amber-900" />
              <span className="min-w-0">
                <span className="block text-base font-bold">{t('home.observe')}</span>
                <span className="block text-sm text-slate-800">{jobName(s)} · {t('home.signedAt')} {s.signoff?.at.slice(0, 16).replace('T', ' ')}</span>
              </span>
            </Link>
          ))}
          {inProgress.slice(0, 1).map((s) => (
            <Link key={s.sjaId} to={`/foreman/${s.sjaId}`} className="flex items-center gap-3 rounded-xl border-2 border-blue-700 bg-white p-3" data-testid="home-resume">
              <Icon name="arrow" className="h-6 w-6 text-blue-800" />
              <span className="min-w-0">
                <span className="block text-base font-bold">{t('home.resumeTitle')}</span>
                <span className="block text-sm text-slate-800">{jobName(s)} · {t('wizard.stepOf', { n: s.step })} · {when(s)}</span>
              </span>
            </Link>
          ))}
          <button type="button" onClick={() => navigate(`/foreman/${uid('sja')}`)} className="flex w-full items-center gap-3 rounded-xl bg-blue-700 p-4 text-left text-white shadow hover:bg-blue-800" data-testid="tile-foreman">
            <Icon name="doc" className="h-8 w-8" />
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-bold">{t('home.start')}</span>
              <span className="block text-sm text-blue-100">{t('home.startText')}</span>
            </span>
            <Icon name="arrow" className="h-6 w-6" />
          </button>
        </section>

        <Card tone="quiet" className="space-y-2">
          <h2 className="text-base font-bold">{t('home.howTitle')}</h2>
          <ol className="space-y-1.5">
            {steps.map((n) => (
              <li key={n} className="flex items-start gap-2 text-[15px]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-900">{n}</span>
                <span>
                  <strong>{t(`wizard.title${n}`)}</strong> <span className="text-slate-700">– {t(`home.how${n}`)}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-2 text-[15px] text-slate-700">
            <Icon name="eye" className="mt-0.5 h-5 w-5 text-slate-600" /> {t('home.howAfter')}
          </p>
        </Card>

        {sjas.length > 0 && (
          <Card className="space-y-2">
            <h2 className="text-base font-bold">{t('home.onDevice')}</h2>
            <ul className="divide-y divide-slate-200">
              {sjas.slice(0, 12).map((s) => {
                const signed = isSigned(s);
                return (
                  <li key={s.sjaId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0 text-sm">
                      <strong>{jobName(s)}</strong> · {when(s)} · {t(`status.${s.status}`)}
                      {s.testId ? ` · ${s.testId}` : ''}
                    </span>
                    <Link to={signed ? `/runs/${s.sjaId}` : `/foreman/${s.sjaId}`} className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">
                      {signed ? t('home.openRecord') : t('home.resume', { n: s.step })}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Group title={t('home.groupReview')} hint={t('home.groupReviewHint')}>
          <Tile to="/review" title={t('home.reviewer')} text={t('home.reviewerText')} icon="check" testid="tile-review" />
          <Tile to="/review?view=library" title={t('home.library')} text={t('home.libraryText')} icon="info" testid="tile-library" />
        </Group>

        <Group title={t('home.groupProject')} hint={t('home.groupProjectHint')}>
          <Tile to="/bench" title={t('home.bench')} text={t('home.benchText')} icon="flag" testid="tile-bench" />
          <Tile to="/runs" title={t('home.runs')} text={t('home.runsText')} icon="doc" testid="tile-runs" />
          <Tile to="/baseline" title={t('home.baseline')} text={t('home.baselineText')} icon="clock" testid="tile-baseline" />
          {pack?.templates.map((tpl) => (
            <Tile key={tpl.templateId} to={`/worker/questions/${tpl.templateId}`} title={`${t('home.worker')}: ${tpl.jobType[ui] ?? tpl.jobType.nb}`} text={t('home.workerText')} icon="voice" testid={`tile-worker-${tpl.templateId}`} />
          ))}
        </Group>

        {config && (
          <details className="rounded-xl border border-slate-200 bg-white p-3">
            <summary className="min-h-11 cursor-pointer text-sm font-semibold">
              {t('home.gateway')}: <ModeChip />
            </summary>
            <p className="mt-1 text-sm text-slate-700">
              {config.mode === 'replay' ? t('home.replayNote', { n: config.fixtures.total, scripted: config.fixtures.scripted }) : config.configured ? t('home.liveNote', { provider: config.provider }) : t('home.noKeyNote')}
            </p>
            {pack && (
              <p className="mt-2">
                <Chip tone="slate">
                  {t('home.pack')} v{pack.version} · {pack.hash.slice(0, 8)}
                </Chip>
              </p>
            )}
          </details>
        )}

        <details className="rounded-xl border border-slate-200 bg-white p-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">{t('home.localData')}</summary>
          <p className="mt-1 text-sm text-slate-700">{t('home.localDataText')}</p>
          <Button variant="danger" className="mt-2" onClick={() => { if (window.confirm(t('home.clearConfirm'))) { clearSjas(); clearLog(); } }} data-testid="clear-local">
            {t('home.clear')}
          </Button>
        </details>
      </div>
    </Layout>
  );
}
