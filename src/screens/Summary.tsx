// I1: a one-page summary that a subcontractor can send to the main contractor, or attach
// in the main contractor's HSE system. No integration: print it, or save it as PDF from the
// print dialog. Interviewed main contractor: subcontractors' risk assessments "go in manually".
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { GhsRow } from '../components/Ghs';
import { Button, Layout, Notice, Spinner } from '../components/ui';
import { activeLines, allFlags } from '../core/flags';
import { reuseRate, unverifiedReuse } from '../core/metrics';
import { upgradeSja } from '../core/rules/understanding';
import { BANNER_EN, BANNER_NB, type Sja } from '../core/types';
import { LANG_NAMES } from '../core/util';
import { useT, useUiLang } from '../i18n';
import { useApp, useSjas } from '../state/stores';

export function SummaryScreen() {
  const { runId = '' } = useParams();
  const t = useT();
  const ui = useUiLang();
  const pack = useApp((s) => s.pack);
  const local = useSjas((s) => s.sjas[runId]);
  const [saved, setSaved] = useState<Sja | null>(null);
  const [loading, setLoading] = useState(!local);

  useEffect(() => {
    if (local) return;
    api
      .runIfSaved(runId)
      .then((r) => setSaved(r ? upgradeSja(r.sja, { keepCounts: true }) : null))
      .catch(() => setSaved(null))
      .finally(() => setLoading(false));
  }, [runId, local]);

  const sja = local ?? saved;
  if (loading) return <Layout title={t('sum.title')}><Spinner label={t('common.loading')} /></Layout>;
  if (!sja || !pack) return <Layout title={t('sum.title')}><Notice tone="amber">{t('common.notFound')}</Notice></Layout>;

  const template = pack.templates.find((x) => x.templateId === sja.templateId);
  const flags = allFlags(sja);
  const open = flags.filter((r) => r.flag.status === 'open').length;
  const red = flags.filter((r) => r.flag.severity === 'red').length;
  const oral = activeLines(sja).filter((l) => Object.entries(l.byLang).some(([lang, e]) => sja.languages.includes(lang) && e.oralFallback)).length;
  const unsupported = sja.sjaFlags.filter((f) => f.type === 'UNSUPPORTED_LANGUAGE').map((f) => LANG_NAMES[f.lang]?.[ui] ?? f.lang);
  const u = sja.understanding;
  const rr = reuseRate(sja);
  const vr = unverifiedReuse(sja);
  const signed = sja.status === 'signed' || sja.status === 'signedWithFallback';
  const products = (sja.products ?? []).map((id) => template?.products?.find((p) => p.productId === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const row = (label: string, value: ReactNode, testid?: string) => (
    <tr className="border-b border-slate-200 align-top">
      <th scope="row" className="w-[42%] py-1.5 pr-3 text-left text-sm font-semibold text-slate-700">{label}</th>
      <td className="py-1.5 text-sm" data-testid={testid}>{value}</td>
    </tr>
  );

  return (
    <Layout title={t('sum.title')}>
      <article className="space-y-3" data-testid="summary">
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => window.print()} data-testid="summary-print">
            {t('sum.print')}
          </Button>
          <Link to={`/runs/${runId}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-blue-800 underline">
            {t('sum.fullRecord')}
          </Link>
        </div>
        <p className="no-print text-sm text-slate-700">{t('sum.hint')}</p>
        <header className="border-b-2 border-slate-800 pb-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{t('sum.kicker')}</p>
          <h1 className="text-xl font-bold">{template?.jobType[ui] ?? sja.templateId}</h1>
          <p className="text-sm">
            {sja.header.siteLabel || '–'} · {sja.header.date || '–'}
          </p>
        </header>
        <table className="w-full">
          <tbody>
            {row(t('sum.status'), <strong data-testid="summary-status">{t(`status.${sja.status}`)}</strong>)}
            {row(t('rec.signedBy'), sja.signoff ? `${sja.signoff.role} · ${sja.signoff.at.slice(0, 16).replace('T', ' ')}` : t('rec.notSigned'))}
            {row(t('rec.template'), `${sja.templateId} · ${t('rec.packVersion')} ${sja.packVersion}`)}
            {row(t('rec.verifiedTemplate'), vr.total === 0 ? '–' : vr.unverified === 0 ? t('common.yes') : t('rec.verifiedTemplateNo', { n: vr.total - vr.unverified, total: vr.total }))}
            {row(t('rec.reuseRate'), `${rr.reused} ${t('common.of')} ${rr.total} ${t('rec.reuseLines')}`)}
            {row(t('rec.languages'), [...sja.languages.filter((l) => !unsupported.includes(LANG_NAMES[l]?.[ui] ?? l)).map((l) => LANG_NAMES[l]?.[ui] ?? l), ...unsupported.map((n) => `${n} (${t('sum.interpreter')})`)].join(', '))}
            {products.length > 0 &&
              row(
                t('s1.products'),
                <span className="flex flex-col gap-1">
                  {products.map((p) => (
                    <span key={p.productId} className="flex items-center gap-2">
                      <GhsRow codes={p.ghs} lang={ui} size={22} /> {p.name[ui] ?? p.name.nb}
                    </span>
                  ))}
                </span>,
              )}
            {row(t('sum.flags'), flags.length === 0 ? t('rec.noFlags') : t('sum.flagsValue', { n: flags.length, red, open }), 'summary-flags')}
            {row(t('rec.oralLines'), oral === 0 ? t('rec.none') : String(oral))}
            {row(
              t('rec.understanding'),
              !u.required ? (
                t('rec.understandingNotRequiredShort')
              ) : (
                <span data-testid="summary-understanding">
                  {t('s5.respondents')}: {u.respondents}
                  {u.paths && <> · {t('s5.pathCounts', { conversation: u.paths.conversation, written: u.paths.written, questionsOnly: u.paths.questionsOnly })}</>}
                  {u.misunderstood.length > 0 && <> · {t('sum.rebriefed', { n: u.misunderstood.reduce((a, m) => a + m.count, 0) })}</>}
                </span>
              ),
            )}
            {row(
              t('rec.observation'),
              !sja.observation ? (signed && u.required ? t('rec.observationPending') : '–') : sja.observation.lineIds.length === 0 && !(sja.observation.notFollowed ?? []).length ? t('obsv.none') : t('sum.observed', { mis: sja.observation.lineIds.length, not: (sja.observation.notFollowed ?? []).length }),
            )}
          </tbody>
        </table>
        <p className="text-xs text-slate-700">{t('rec.statement')}</p>
        <p className="text-xs text-slate-700">{t('sum.privacy')}</p>
        <p className="rounded bg-amber-200 px-2 py-1 text-center text-xs font-bold text-slate-950">{ui === 'nb' ? BANNER_NB : BANNER_EN}</p>
      </article>
    </Layout>
  );
}
