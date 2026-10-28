// The foreman's side of the teach-back (service brief v3, step 4). The worker explains
// the key hazard and the safety measure in their own words. The foreman listens for the
// points listed here and records the outcome. Shown in the foreman's language. A worker
// is only recorded once the explanation is right, straight away or after a new walkthrough.
import { useState } from 'react';
import type { Sja, SjaLine } from '../core/types';
import { useT } from '../i18n';
import { HelpEn } from './HelpEn';
import { Button, Icon } from './ui';

export interface TeachBackResult {
  teachBack: 'ok' | 'rebriefed';
  /** The points the worker got wrong before the new walkthrough. May be empty. */
  misunderstood: string[];
}

export function KeyPoints({ lines, sja }: { lines: SjaLine[]; sja?: Pick<Sja, 'templateId' | 'parameterValues'> }) {
  const t = useT();
  return (
    <ul className="space-y-1" data-testid="key-points">
      {lines.map((l) => (
        <li key={l.lineId} className="rounded-lg border border-slate-300 bg-white p-2 text-[15px] leading-snug">
          <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-600">{t(`section.${l.section}`)}</span>
          {l.textNb}
          <HelpEn nb={l.textNb} line={l} sja={sja} />
        </li>
      ))}
    </ul>
  );
}

export function TeachBackJudge({ lines, onDone, sja }: { lines: SjaLine[]; onDone: (r: TeachBackResult) => void; sja?: Pick<Sja, 'templateId' | 'parameterValues'> }) {
  const t = useT();
  const [missed, setMissed] = useState<null | string[]>(null);
  const toggle = (id: string) => setMissed((m) => (m ?? []).includes(id) ? (m ?? []).filter((x) => x !== id) : [...(m ?? []), id]);

  if (missed !== null) {
    return (
      <div className="space-y-3" data-testid="teach-judge">
        <p className="text-base font-bold">{t('teach.which')}</p>
        <div className="space-y-1">
          {lines.map((l) => (
            <label key={l.lineId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white p-2">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={missed.includes(l.lineId)} onChange={() => toggle(l.lineId)} data-testid={`teach-point-${l.lineId}`} />
              <span className="text-[15px] leading-snug">
                {l.textNb}
                <HelpEn nb={l.textNb} line={l} sja={sja} />
              </span>
            </label>
          ))}
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-950">
          <Icon name="voice" /> {t('teach.again')}
        </p>
        <Button variant="primary" className="w-full" onClick={() => onDone({ teachBack: 'rebriefed', misunderstood: missed })} data-testid="teach-rebriefed">
          {t('teach.rebriefed')}
        </Button>
        <Button variant="ghost" onClick={() => setMissed(null)}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="teach-judge">
      <div>
        <p className="mb-1 text-sm font-bold">{t('teach.listenFor')}</p>
        <KeyPoints lines={lines} sja={sja} />
        <p className="mt-1 text-sm text-slate-700">{t('teach.interpreter')}</p>
      </div>
      <div className="grid gap-2">
        <Button variant="success" onClick={() => onDone({ teachBack: 'ok', misunderstood: [] })} data-testid="teach-ok">
          <Icon name="check" /> {t('teach.ok')}
        </Button>
        <Button onClick={() => setMissed([])} data-testid="teach-missed">
          {t('teach.missed')}
        </Button>
      </div>
    </div>
  );
}
