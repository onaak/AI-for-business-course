// D5 Sign-off gate (specification F-11; plan SC-08). No route leads from a model call to a signed state.
import { activeLines, allFlags, isBlocking } from '../flags';
import type { DataPack, Sja, SjaStatus } from '../types';
import { supportedLangs } from './diff';

export type GateConditionId =
  | 'contentConfirmed'
  | 'aiSuggestions'
  | 'techRecheck'
  | 'sourceFlags'
  | 'languageCheck'
  | 'flags'
  | 'understanding';

export interface GateCondition {
  id: GateConditionId;
  ok: boolean;
  open: number;
}

export function gateConditions(sja: Sja, pack: DataPack): GateCondition[] {
  const lines = activeLines(sja);
  const langs = supportedLangs(sja, pack);
  const flags = allFlags(sja);

  const openSuggestions = lines.filter((l) => l.aiSuggestion === 'open').length;
  const openRecheck = lines.filter((l) => l.techRecheck === 'open').length;
  const openSource = flags.filter(
    (r) => r.lang === 'nb' && r.flag.type !== 'AI_ADDED_CONTENT' && isBlocking(r.flag, Boolean(r.line?.critical)),
  ).length;

  let unchecked = 0;
  for (const line of lines) {
    if (line.origin !== 'changed' && line.origin !== 'new') continue;
    for (const lang of langs) {
      const e = line.byLang[lang];
      if (e?.oralFallback) continue;
      if (!e || e.checkState !== 'checked' || e.checkedSource !== line.textNb) unchecked += 1;
    }
  }
  const openLanguage = flags.filter((r) => r.lang !== 'nb' && isBlocking(r.flag, Boolean(r.line?.critical))).length;
  const u = sja.understanding;

  return [
    { id: 'contentConfirmed', ok: sja.contentConfirmed, open: sja.contentConfirmed ? 0 : 1 },
    { id: 'aiSuggestions', ok: openSuggestions === 0, open: openSuggestions },
    { id: 'techRecheck', ok: openRecheck === 0, open: openRecheck },
    { id: 'sourceFlags', ok: openSource === 0, open: openSource },
    { id: 'languageCheck', ok: sja.contentConfirmed && unchecked === 0, open: unchecked },
    { id: 'flags', ok: openLanguage === 0, open: openLanguage },
    { id: 'understanding', ok: !u.required || u.completed, open: !u.required || u.completed ? 0 : 1 },
  ];
}

export function canSign(sja: Sja, pack: DataPack): boolean {
  return gateConditions(sja, pack).every((c) => c.ok);
}

export function hasFallback(sja: Sja): boolean {
  const unsupported = sja.sjaFlags.some((f) => f.type === 'UNSUPPORTED_LANGUAGE');
  const oral = activeLines(sja).some((l) => Object.entries(l.byLang).some(([lang, e]) => sja.languages.includes(lang) && e.oralFallback));
  // A worker checked by multiple choice alone, with no explanation judged by anyone (U1).
  const questionsOnly = (sja.understanding.paths?.questionsOnly ?? 0) > 0;
  return unsupported || oral || questionsOnly;
}

export function deriveStatus(sja: Sja, pack: DataPack): SjaStatus {
  if (sja.status === 'signed' || sja.status === 'signedWithFallback') return sja.status;
  const flags = allFlags(sja);
  if (flags.some((r) => r.flag.status === 'open' && r.flag.route === 'reviewer')) return 'escalated';
  if (!sja.contentConfirmed) return 'draft';
  if (canSign(sja, pack)) return 'readyToSign';
  if (flags.some((r) => isBlocking(r.flag, Boolean(r.line?.critical)))) return 'flagsOpen';
  return 'contentConfirmed';
}
