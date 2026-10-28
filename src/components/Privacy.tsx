// What leaves the device, and what never does (I3). D6 already enforces this on the
// server (a fixed list of fields per task); this panel makes it visible, because data
// safety was the main reason the interviewed firm gave for companies not using AI.
import { useT } from '../i18n';
import { useApp } from '../state/stores';
import { Icon } from './ui';

export function PrivacyPanel({ compact = false, testid = 'privacy-panel' }: { compact?: boolean; testid?: string }) {
  const t = useT();
  const mode = useApp((s) => s.config?.mode);
  const body = (
    <div className="space-y-2 text-sm">
      <p>
        <strong>{t('privacy.sentTitle')}</strong> {t('privacy.sent')}
      </p>
      <p>
        <strong>{t('privacy.neverTitle')}</strong> {t('privacy.never')}
      </p>
      <p className="text-slate-700">{t('privacy.workers')}</p>
      <p className="text-slate-700">{mode === 'replay' ? t('privacy.replay') : t('privacy.live')}</p>
    </div>
  );
  if (compact) {
    return (
      <details className="rounded-xl border border-slate-300 bg-white p-3" data-testid={testid}>
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <Icon name="lock" className="h-4 w-4" /> {t('privacy.title')}
        </summary>
        <div className="mt-2">{body}</div>
      </details>
    );
  }
  return (
    <section className="space-y-2 rounded-xl border border-slate-300 bg-slate-50 p-3" data-testid={testid}>
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Icon name="lock" className="h-4 w-4" /> {t('privacy.title')}
      </h2>
      {body}
    </section>
  );
}
