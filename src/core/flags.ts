// Flag taxonomy helpers (specification 10.5, F-08; plan SC-08).
import type { Flag, FlagType, Route, Sja, SjaLine } from './types';

export const LANGUAGE_FLAGS: FlagType[] = [
  'GLOSSARY_MISMATCH',
  'FORBIDDEN_TERM',
  'TERM_NOT_IN_GLOSSARY',
  'NUMBER_UNIT_MISMATCH',
  'MEANING_SHIFT',
  'OMISSION_ADDITION',
  'UNSUPPORTED_LANGUAGE',
];

export const MAX_AUTO_ATTEMPTS = 2;

/**
 * Routes a foreman may choose. None of them needs knowledge of the target
 * language, and none of them dismisses a red language flag (CH-02, AC-11).
 */
export function allowedRoutes(flag: Flag, lineCritical: boolean): Route[] {
  if (flag.status !== 'open') return [];
  if (flag.type === 'UNSUPPORTED_LANGUAGE') return ['oral'];
  if (flag.type === 'SOURCE_AMBIGUOUS') return lineCritical ? ['rewrite'] : ['rewrite', 'acknowledged'];
  if (!LANGUAGE_FLAGS.includes(flag.type)) return [];
  const routes: Route[] = [];
  if (flag.type === 'GLOSSARY_MISMATCH' || flag.type === 'FORBIDDEN_TERM') routes.push('approvedTerm');
  routes.push('rewrite', 'reviewer', 'oral');
  // Amber flags on lines that are not safety-critical can be acknowledged with a reason.
  if (flag.severity === 'amber' && !lineCritical) routes.push('acknowledged');
  return routes;
}

export function routeDisabled(flag: Flag, route: Route): boolean {
  return route === 'approvedTerm' && flag.autoAttempts >= MAX_AUTO_ATTEMPTS;
}

/** One rule (SC-08): any open flag, red or amber, on a safety-critical line blocks; so does any open red flag. */
export function isBlocking(flag: Flag, lineCritical: boolean): boolean {
  if (flag.status !== 'open') return false;
  if (flag.severity === 'marker') return false;
  return flag.severity === 'red' || lineCritical;
}

export interface FlagRef {
  flag: Flag;
  line: SjaLine | null;
  lang: string;
}

export function activeLines(sja: Sja): SjaLine[] {
  return sja.lines.filter((l) => l.origin !== 'removed');
}

/** Every flag of an SJA: source flags, language flags and whole-SJA flags. */
export function allFlags(sja: Sja): FlagRef[] {
  const out: FlagRef[] = [];
  for (const f of sja.sjaFlags) out.push({ flag: f, line: null, lang: f.lang });
  for (const line of sja.lines) {
    for (const f of line.flags) out.push({ flag: f, line, lang: 'nb' });
    if (line.origin === 'removed') continue;
    for (const [lang, entry] of Object.entries(line.byLang)) {
      if (!sja.languages.includes(lang)) continue;
      for (const f of entry.flags) out.push({ flag: f, line, lang });
    }
  }
  return out;
}

export function languageFlags(sja: Sja): FlagRef[] {
  return allFlags(sja).filter((r) => r.lang !== 'nb');
}

export function findFlag(sja: Sja, flagId: string): FlagRef | undefined {
  return allFlags(sja).find((r) => r.flag.flagId === flagId);
}

const severityRank = { red: 0, amber: 1, marker: 2 } as const;
export function sortFlags(refs: FlagRef[]): FlagRef[] {
  return [...refs].sort(
    (a, b) =>
      (a.flag.status === 'open' ? 0 : 1) - (b.flag.status === 'open' ? 0 : 1) ||
      severityRank[a.flag.severity] - severityRank[b.flag.severity],
  );
}
