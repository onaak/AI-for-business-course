// The translation check engine (specification F-07). Usable on its own: it takes
// any source line and target line and returns flags, so it can also check a
// translation produced by another tool.
import { checkGlossary } from '../rules/glossary';
import { isSupported, unsupportedFlag } from '../rules/languages';
import { checkNumbers } from '../rules/numbers';
import { buildP5, buildP6 } from '../rules/payload';
import type { P5Output, P6Output } from '../schemas';
import type { DataPack, Flag, ModelCall, ModelClient } from '../types';
import { makeFlag } from '../util';

export interface CheckInput {
  lineId: string;
  source: string;
  target: string;
  lang: string;
  critical: boolean;
  /** Safety concepts the translator reported as missing from the glossary (P4). */
  missingConcepts?: string[];
}

export interface CheckResult {
  flags: Flag[];
  backTranslation?: string;
  calls: ModelCall[];
  /** Deterministic steps that ran, for the trace. */
  rules: { rule: 'D4' | 'D1' | 'D2'; flags: number }[];
}

/** Deterministic layer only: D4, D1, D2. Pure and synchronous. */
export function checkLineRules(input: CheckInput, pack: DataPack): { flags: Flag[]; rules: CheckResult['rules']; stop: boolean } {
  if (!isSupported(input.lang, pack)) {
    // Unsupported language: stop, and raise this flag and nothing else (AC-09).
    return { flags: [unsupportedFlag(input.lang, input.lineId)], rules: [{ rule: 'D4', flags: 1 }], stop: true };
  }
  const d1 = checkGlossary({ lineId: input.lineId, source: input.source, target: input.target, lang: input.lang, pack });
  for (const concept of input.missingConcepts ?? []) {
    d1.push(
      makeFlag({
        lineId: input.lineId,
        lang: input.lang,
        type: 'TERM_NOT_IN_GLOSSARY',
        severity: input.critical ? 'red' : 'amber',
        raisedBy: 'P4',
        nb: `Sikkerhetsbegrepet «${concept}» finnes ikke i ordlisten. Oversettelsen av det er ikke kontrollert mot et godkjent ord.`,
        en: `The safety concept "${concept}" has no glossary entry. Its translation could not be checked against an approved term.`,
        evidence: { source: input.source, target: input.target, found: concept },
      }),
    );
  }
  const d2 = checkNumbers({ lineId: input.lineId, source: input.source, target: input.target, lang: input.lang });
  return {
    flags: [...d1, ...d2],
    rules: [
      { rule: 'D4', flags: 0 },
      { rule: 'D1', flags: d1.length },
      { rule: 'D2', flags: d2.length },
    ],
    stop: false,
  };
}

const CHECK_LABELS: Record<string, { nb: string; en: string }> = {
  negation: { nb: 'nektelse', en: 'negation' },
  obligation: { nb: 'pliktnivå (skal/bør/kan)', en: 'obligation level (must/should/may)' },
  numbers: { nb: 'tall', en: 'numbers' },
  direction: { nb: 'retning eller plassering', en: 'direction or position' },
  condition: { nb: 'betingelse', en: 'condition' },
  omission: { nb: 'utelatt innhold', en: 'omitted content' },
  addition: { nb: 'tilføyd innhold', en: 'added content' },
  object: { nb: 'gjenstand eller verktøy', en: 'object or tool' },
};

/** Turn the P6 checklist into flags. The model returns no confidence score and cannot remove a deterministic flag. */
export function flagsFromComparison(input: CheckInput, backTranslation: string, cmp: P6Output): Flag[] {
  const different = Object.entries(cmp.checks)
    .filter(([, v]) => v === 'different')
    .map(([k]) => k);
  if (cmp.category === 'NONE' && different.length === 0) return [];
  const onlyOmissionAddition = different.length > 0 && different.every((k) => k === 'omission' || k === 'addition');
  const type =
    cmp.category === 'OMISSION_ADDITION' || (cmp.category === 'NONE' && onlyOmissionAddition) ? 'OMISSION_ADDITION' : 'MEANING_SHIFT';
  const items = different.length ? different : ['object'];
  const nbItems = items.map((k) => CHECK_LABELS[k]?.nb ?? k).join(', ');
  const enItems = items.map((k) => CHECK_LABELS[k]?.en ?? k).join(', ');
  return [
    makeFlag({
      lineId: input.lineId,
      lang: input.lang,
      type,
      severity: input.critical ? 'red' : 'amber',
      raisedBy: 'P6',
      nb: `${cmp.explanationNb || 'Tilbakeoversettelsen sier noe annet enn originalen.'} (Avvik: ${nbItems}.)`,
      en: `${cmp.explanationEn || 'The back-translation says something different from the original.'} (Differs in: ${enItems}.)`,
      evidence: { source: input.source, target: input.target, backTranslation },
    }),
  ];
}

/**
 * Runs in this order: D4 language support, D1 glossary, D2 numbers,
 * P5 back-translation (target text only), P6 comparison.
 * A line is clean only if all five steps raise nothing.
 */
export async function checkLine(
  client: ModelClient,
  pack: DataPack,
  input: CheckInput,
  meta: { runId: string },
): Promise<CheckResult> {
  const det = checkLineRules(input, pack);
  if (det.stop) return { flags: det.flags, calls: [], rules: det.rules };

  const calls: ModelCall[] = [];
  const p5 = await client.call<P5Output>('P5', buildP5(input.lang, input.target), meta);
  calls.push(p5.call);
  const backTranslation = p5.parsed.text;
  const p6 = await client.call<P6Output>('P6', buildP6(input.source, backTranslation, input.critical), meta);
  calls.push(p6.call);

  // Deterministic flags first. Nothing the model says removes them.
  const flags = [...det.flags, ...flagsFromComparison(input, backTranslation, p6.parsed)];
  for (const f of flags) if (f.raisedBy !== 'P6') f.evidence.backTranslation = backTranslation;
  return { flags, backTranslation, calls, rules: det.rules };
}
