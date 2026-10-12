import type { Flag, FlagType, Lang, Layer, Parameter, Severity } from './types';

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${rand}${counter.toString(36)}`;
}

export const nowIso = () => new Date().toISOString();

export function norm(s: string): string {
  return s.normalize('NFC').toLowerCase();
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** JSON with sorted keys, so the same data always gives the same string (replay keys, hashes). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export function formatNumber(value: number, lang: Lang): string {
  const s = String(value);
  return lang === 'en' ? s : s.replace('.', ',');
}

/** Insert parameter values into a template text. Parameters are numbers or fixed choices (SC-05). */
export function fillParams(
  text: string,
  parameters: Parameter[],
  values: Record<string, number | string>,
  lang: Lang,
): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const p = parameters.find((x) => x.key === key);
    if (!p) return whole;
    const v = values[key] ?? p.default;
    if (p.type === 'number') return formatNumber(Number(v), lang);
    const opt = p.options.find((o) => o.key === v);
    return opt?.label[lang] ?? opt?.label.nb ?? String(v);
  });
}

export function makeFlag(args: {
  lineId: string;
  lang: string;
  type: FlagType;
  severity: Severity;
  raisedBy: Layer;
  nb: string;
  en: string;
  evidence?: Flag['evidence'];
  termId?: string;
}): Flag {
  return {
    flagId: uid('flag'),
    lineId: args.lineId,
    lang: args.lang,
    type: args.type,
    severity: args.severity,
    raisedBy: args.raisedBy,
    explanation: { nb: args.nb, en: args.en },
    evidence: args.evidence ?? {},
    status: 'open',
    autoAttempts: 0,
    termId: args.termId,
  };
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export const LANG_NAMES: Record<string, { nb: string; en: string; own: string }> = {
  nb: { nb: 'Norsk', en: 'Norwegian', own: 'Norsk' },
  en: { nb: 'Engelsk', en: 'English', own: 'English' },
  pl: { nb: 'Polsk', en: 'Polish', own: 'Polski' },
  lt: { nb: 'Litauisk', en: 'Lithuanian', own: 'Lietuvių' },
  ro: { nb: 'Rumensk', en: 'Romanian', own: 'Română' },
  uk: { nb: 'Ukrainsk', en: 'Ukrainian', own: 'Українська' },
  ru: { nb: 'Russisk', en: 'Russian', own: 'Русский' },
};
