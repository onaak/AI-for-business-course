// /runs/:runId/document – the signed SJA as a document, one section per language (5 Nov 2026).
// Opened from Owner → Records and from the signed screen. Print it, or download it as a file
// that opens in any browser.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { SjaDocument, sjaDocumentHtml } from '../components/SjaDocument';
import { Button, download, Layout, Notice, Spinner } from '../components/ui';
import { upgradeSja } from '../core/rules/understanding';
import type { Sja } from '../core/types';
import { useT } from '../i18n';
import { useApp, useSjas } from '../state/stores';

export function DocumentScreen() {
  const { runId = '' } = useParams();
  const t = useT();
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
  if (loading) return <Layout title={t('doc.title')}><Spinner label={t('common.loading')} /></Layout>;
  if (!sja || !pack) return <Layout title={t('doc.title')}><Notice tone="amber">{t('common.notFound')}</Notice></Layout>;
  const template = pack.templates.find((x) => x.templateId === sja.templateId);
  const signed = sja.status === 'signed' || sja.status === 'signedWithFallback';
  const fileName = `sja-${sja.header.date || 'udatert'}-${sja.sjaId.replace(/^sja-/, '')}.html`;

  return (
    <Layout title={t('doc.title')}>
      <div className="space-y-3">
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => download(fileName, sjaDocumentHtml(sja, template), 'text/html;charset=utf-8')} data-testid="doc-download">
            {t('doc.download')}
          </Button>
          <Button onClick={() => window.print()} data-testid="doc-print">
            {t('doc.print')}
          </Button>
          <Link to={`/runs/${runId}/summary`} className="inline-flex min-h-11 items-center px-2 font-semibold text-blue-800 underline">
            {t('rec.summaryLink')}
          </Link>
          <Link to={`/runs/${runId}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-blue-800 underline">
            {t('sum.fullRecord')}
          </Link>
        </div>
        <p className="no-print text-sm text-slate-700">{t('doc.hint')}</p>
        {!signed && <Notice tone="amber">{t('doc.notSigned')}</Notice>}
        <div className="rounded-xl border border-slate-300 bg-white p-3">
          <SjaDocument sja={sja} template={template} />
        </div>
      </div>
    </Layout>
  );
}
