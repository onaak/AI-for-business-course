import { describe, expect, it } from 'vitest';
import { checkNumbers, extractNumbers, numbersMatch } from '../../src/core/rules/numbers';

describe('D2 number and unit-symbol parity', () => {
  it('treats decimal comma and decimal point as the same', () => {
    expect(numbersMatch('Arbeidshøyde: 4,5 m', 'Wysokość robocza: 4.5 m').ok).toBe(true);
  });
  it('flags a changed number (AC-09)', () => {
    const flags = checkNumbers({ lineId: 'x', source: 'Minst 2 personer.', target: 'Co najmniej 3 osoby.', lang: 'pl' });
    expect(flags.map((f) => [f.type, f.severity, f.raisedBy])).toEqual([['NUMBER_UNIT_MISMATCH', 'red', 'D2']]);
  });
  it('flags a unit symbol that was lost or changed', () => {
    expect(numbersMatch('Vindgrense: 12 m/s', 'Limit wiatru: 12 km/h').ok).toBe(false);
    expect(numbersMatch('Lastens vekt: 850 kg', 'Masa ładunku: 850').ok).toBe(false);
    expect(numbersMatch('Høyde: 4 m', 'Wysokość: 4 metry').ok).toBe(false);
  });
  it('does not check unit words in the source (SC-06)', () => {
    expect(numbersMatch('Hold 2 meter avstand.', 'Zachowaj 2 metry odstępu.').ok).toBe(true);
  });
  it('compares numbers as a multiset', () => {
    expect(numbersMatch('Ring 113. Minst 2 personer.', 'Minimum 2 osoby. Zadzwoń pod 113.').ok).toBe(true);
    expect(numbersMatch('Ring 113.', 'Zadzwoń pod 113 lub 112.').ok).toBe(false);
  });
  it('extracts numbers with their unit symbols', () => {
    expect(extractNumbers('850 kg, 6 m og 12 m/s, 50 %')).toEqual([
      { value: '850', unit: 'kg' },
      { value: '6', unit: 'm' },
      { value: '12', unit: 'm/s' },
      { value: '50', unit: '%' },
    ]);
  });
});
