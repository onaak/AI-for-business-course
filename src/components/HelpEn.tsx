// English help line under a Norwegian SJA text, shown only when the interface is in
// English. It is for readers who do not read Norwegian (the project group, the teacher).
// It is NOT part of the SJA: never checked, never shown to workers, never in the record's
// SJA text. Sources, in order:
//   1. a line still worded as in the template: the template's own English text;
//   2. the stored help translations for the demo jobs (data/fixtures/help-en.json);
//   3. live mode only: one extra model request (P4, target English), logged under the
//      run id "help-translation", kept on this device so it is asked once per text.
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { modelClient } from '../api';
import { buildP4 } from '../core/rules/payload';
import type { P4Output } from '../core/schemas';
import type { Sja, SjaLine } from '../core/types';
import { fillParams } from '../core/util';
import { useT, useUiLang } from '../i18n';
import { useApp } from '../state/stores';

interface HelpState {
  texts: Record<string, string>;
  pending: Record<string, boolean>;
  failed: Record<string, boolean>;
  put: (nb: string, en: string) => void;
  mark: (nb: string, key: 'pending' | 'failed', on: boolean) => void;
}

const useHelp = create<HelpState>()(
  persist(
    (set) => ({
      texts: {},
      pending: {},
      failed: {},
      put: (nb, en) => set((s) => ({ texts: { ...s.texts, [nb]: en } })),
      mark: (nb, key, on) => set((s) => ({ [key]: { ...s[key], [nb]: on } }) as Partial<HelpState>),
    }),
    {
      name: 'sja-forstatt-help-en',
      storage: createJSONStorage(() => ({
        getItem: (k: string) => {
          try {
            return localStorage.getItem(k);
          } catch {
            return null;
          }
        },
        setItem: (k: string, v: string) => {
          try {
            localStorage.setItem(k, v);
          } catch {
            /* full or blocked: the help line is fetched again next time */
          }
        },
        removeItem: (k: string) => {
          try {
            localStorage.removeItem(k);
          } catch {
            /* nothing to do */
          }
        },
      })),
      partialize: (s) => ({ texts: s.texts }) as HelpState,
    },
  ),
);

/** The English help text for a Norwegian text, or null if there is none (yet). */
function useHelpText(nb: string, line?: Pick<SjaLine, 'templateLineId' | 'textNb' | 'baselineNb'> | null, sja?: Pick<Sja, 'templateId' | 'parameterValues'> | null): { en: string | null; state: 'ok' | 'pending' | 'none' } {
  const pack = useApp((s) => s.pack);
  const config = useApp((s) => s.config);
  const stored = (useApp((s) => s.fixtures)?.['help-en'] as { texts?: Record<string, string> } | undefined)?.texts;
  const cached = useHelp((s) => s.texts[nb]);
  const pending = useHelp((s) => s.pending[nb]);
  const failed = useHelp((s) => s.failed[nb]);
  const ui = useUiLang();

  let fromTemplate: string | null = null;
  if (line?.templateLineId && sja && line.textNb === line.baselineNb && pack) {
    const template = pack.templates.find((t) => t.templateId === sja.templateId);
    const tl = template?.lines.find((l) => l.lineId === line.templateLineId);
    const en = tl?.translations.en?.text;
    if (template && en) fromTemplate = fillParams(en, template.parameters, sja.parameterValues, 'en');
  }
  const known = fromTemplate ?? stored?.[nb] ?? cached ?? null;
  const live = Boolean(config && config.mode !== 'replay' && config.configured);
  const ask = ui === 'en' && !known && live && Boolean(pack) && Boolean(nb.trim()) && !pending && !failed;

  useEffect(() => {
    if (!ask || !pack) return;
    const { mark, put } = useHelp.getState();
    mark(nb, 'pending', true);
    modelClient
      .call<P4Output>('P4', buildP4(nb, 'en', pack, false, 0), { runId: 'help-translation' })
      .then((r) => put(nb, r.parsed.text))
      .catch(() => mark(nb, 'failed', true))
      .finally(() => mark(nb, 'pending', false));
  }, [ask, nb, pack]);

  return { en: known, state: known ? 'ok' : pending || ask ? 'pending' : 'none' };
}

/**
 * The help line itself. Renders nothing when the interface is in Norwegian.
 * `line` and `sja` let a line that is still worded as in the template use the template's English.
 */
export function HelpEn({ nb, line, sja, className = '' }: { nb: string; line?: Pick<SjaLine, 'templateLineId' | 'textNb' | 'baselineNb'> | null; sja?: Pick<Sja, 'templateId' | 'parameterValues'> | null; className?: string }) {
  const t = useT();
  const ui = useUiLang();
  const { en, state } = useHelpText(nb, line, sja);
  if (ui !== 'en' || !nb.trim()) return null;
  return (
    <span lang="en" className={`mt-0.5 block text-[13px] italic leading-snug text-slate-500 ${className}`} data-testid="help-en" title={t('help.title')}>
      <span className="not-italic font-semibold uppercase tracking-wide text-[10px] text-slate-400">{t('help.label')}</span>{' '}
      {state === 'ok' ? en : state === 'pending' ? t('help.pending') : t('help.none')}
    </span>
  );
}
