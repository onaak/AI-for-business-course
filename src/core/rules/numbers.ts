// D2 Number and unit-symbol parity (specification F-07 step 3; plan SC-06).
// Numbers must match exactly. Unit symbols must match exactly. Unit words are not checked.
import type { Flag } from '../types';
import { makeFlag } from '../util';

export const UNIT_SYMBOLS = ['km/t', 'km/h', 'm/s', 'mm', 'cm', 'kg', 'kN', '°C', '%', 'm', 't', 'l'];

/**
 * The same unit written another way. Russian writes units in Cyrillic ("2 м", "25 кг"),
 * and Norwegian "km/t" is "km/h" elsewhere. Without this, a correct Russian line would be
 * flagged as a number or unit mismatch (R3).
 */
export const UNIT_ALIASES: Record<string, string> = {
  'km/t': 'km/h',
  'км/ч': 'km/h',
  'м/с': 'm/s',
  мм: 'mm',
  см: 'cm',
  кг: 'kg',
  кН: 'kN',
  м: 'm',
  т: 't',
  л: 'l',
};
const canonicalUnit = (u: string) => UNIT_ALIASES[u] ?? u;
const ALL_UNITS = [...new Set([...UNIT_SYMBOLS, ...Object.keys(UNIT_ALIASES)])].sort((a, b) => b.length - a.length);

export interface NumberToken {
  value: string; // canonical: decimal point
  unit: string | null;
}

const unitAlt = ALL_UNITS.map((u) => u.replace(/\//g, '\\/')).join('|');
const numberRe = new RegExp(`(\\d+(?:[.,]\\d+)?)(?:\\s?(${unitAlt})(?![\\p{L}\\p{N}]))?`, 'gu');

export function extractNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of text.matchAll(numberRe)) {
    const value = String(parseFloat(m[1].replace(',', '.')));
    out.push({ value, unit: m[2] ? canonicalUnit(m[2]) : null });
  }
  return out;
}

function multiset(items: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return map;
}

function sameMultiset(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

export function numbersMatch(source: string, target: string): { ok: boolean; expected: string; found: string } {
  const s = extractNumbers(source);
  const t = extractNumbers(target);
  const show = (xs: NumberToken[]) => xs.map((x) => (x.unit ? `${x.value} ${x.unit}` : x.value)).join(', ') || '–';
  const expected = show(s);
  const found = show(t);
  if (!sameMultiset(multiset(s.map((x) => x.value)), multiset(t.map((x) => x.value)))) {
    return { ok: false, expected, found };
  }
  // Every number that carries a unit symbol in the source must carry the same symbol in the target.
  const sourceUnits = multiset(s.filter((x) => x.unit).map((x) => `${x.value} ${x.unit}`));
  const targetUnits = multiset(t.filter((x) => x.unit).map((x) => `${x.value} ${x.unit}`));
  for (const [k, v] of sourceUnits) if ((targetUnits.get(k) ?? 0) < v) return { ok: false, expected, found };
  return { ok: true, expected, found };
}

export function checkNumbers(args: { lineId: string; source: string; target: string; lang: string }): Flag[] {
  const r = numbersMatch(args.source, args.target);
  if (r.ok) return [];
  return [
    makeFlag({
      lineId: args.lineId,
      lang: args.lang,
      type: 'NUMBER_UNIT_MISMATCH',
      severity: 'red',
      raisedBy: 'D2',
      nb: 'Tall eller enhet er ikke likt i originalen og oversettelsen.',
      en: 'A number or unit differs between the original and the translation.',
      evidence: { source: args.source, target: args.target, expected: r.expected, found: r.found },
    }),
  ];
}
