// Trace panel (F-17): "how this run worked". Each step in order: prompt used, model,
// raw output, deterministic checks, human action. Read-only. Can be stepped through
// for the presentation (F-18).
import { useState } from 'react';
import type { TraceEntry } from '../core/types';
import { useT } from '../i18n';
import { Button, Chip } from './ui';

const tone = { model: 'violet', rule: 'blue', human: 'green', system: 'slate' } as const;

function Entry({ e, open }: { e: TraceEntry; open: boolean }) {
  const t = useT();
  const c = e.call;
  return (
    <li className={`rounded-lg border bg-white p-3 ${open ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200'}`} data-testid={`trace-${e.kind}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-500">{e.seq}</span>
        <Chip tone={tone[e.kind]}>{t(`trace.kind.${e.kind}`)}</Chip>
        <strong className="text-sm">{e.title}</strong>
        {c && (
          <Chip tone={c.mode === 'replay' ? 'violet' : 'green'}>
            {c.mode === 'replay' ? `${t('mode.replay')}: ${c.fixtureOrigin === 'scripted' ? t('mode.scripted') : t('mode.recorded')}` : t('mode.live')}
          </Chip>
        )}
      </div>
      {e.detail && <p className="mt-1 text-sm text-slate-700">{e.detail}</p>}
      {c && (
        <p className="mt-1 text-xs text-slate-600">
          {t('rec.promptVersion')} {c.promptVersion} · {t('rec.model')}: {c.model} · {c.durationMs} ms{c.retries ? ` · ${c.retries} retry` : ''}
        </p>
      )}
      {(c || e.data !== undefined) && (
        <details className="mt-1" open={open}>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-800">{t('trace.details')}</summary>
          {c && (
            <>
              <p className="text-xs font-bold uppercase text-slate-600">{t('trace.input')}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{JSON.stringify(c.input, null, 2)}</pre>
              <p className="mt-2 text-xs font-bold uppercase text-slate-600">{t('trace.rawOutput')}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{c.rawOutput}</pre>
            </>
          )}
          {e.data !== undefined && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{JSON.stringify(e.data, null, 2)}</pre>}
        </details>
      )}
    </li>
  );
}

export function TracePanel({ trace }: { trace: TraceEntry[] }) {
  const t = useT();
  const [stepping, setStepping] = useState(false);
  const [index, setIndex] = useState(0);
  const [kind, setKind] = useState<'all' | TraceEntry['kind']>('all');
  if (trace.length === 0) return <p className="text-sm text-slate-700">{t('trace.empty')}</p>;
  const list = kind === 'all' ? trace : trace.filter((e) => e.kind === kind);
  const shown = stepping ? list.slice(0, index + 1) : list;
  const counts = { model: 0, rule: 0, human: 0, system: 0 };
  for (const e of trace) counts[e.kind] += 1;

  return (
    <div className="space-y-3" data-testid="trace-panel">
      <p className="text-sm text-slate-700">{t('trace.intro')}</p>
      <div className="no-print flex flex-wrap items-center gap-2">
        {(['all', 'model', 'rule', 'human', 'system'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setIndex(0); }} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${kind === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'}`}>
            {k === 'all' ? `${t('trace.all')} (${trace.length})` : `${t(`trace.kind.${k}`)} (${counts[k]})`}
          </button>
        ))}
      </div>
      <div className="no-print flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
        <Button variant={stepping ? 'primary' : 'secondary'} onClick={() => { setStepping(!stepping); setIndex(0); }} data-testid="trace-step-toggle">
          {stepping ? t('trace.showAll') : t('trace.stepThrough')}
        </Button>
        {stepping && (
          <>
            <Button disabled={index === 0} onClick={() => setIndex(index - 1)}>
              {t('trace.prev')}
            </Button>
            <Button variant="primary" disabled={index >= list.length - 1} onClick={() => setIndex(index + 1)} data-testid="trace-next">
              {t('trace.next')}
            </Button>
            <span className="text-sm font-semibold" data-testid="trace-position">
              {index + 1} / {list.length}
            </span>
          </>
        )}
      </div>
      <ol className="space-y-2">
        {shown.map((e, i) => (
          <Entry key={e.seq} e={e} open={stepping && i === shown.length - 1} />
        ))}
      </ol>
    </div>
  );
}
