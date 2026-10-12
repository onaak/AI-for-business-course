import { describe, expect, it } from 'vitest';
import { checkGlossary, deriveStems, findSourceTerms, stemPresent } from '../../src/core/rules/glossary';
import { seedPack } from '../helpers';

const pack = seedPack();
const ids = (s: string) => findSourceTerms(s, pack.glossary).map((m) => m.term.termId);
const check = (source: string, target: string, lang: string) => checkGlossary({ lineId: 'x', source, target, lang, pack });

describe('D1 glossary check', () => {
  it('finds Norwegian terms inside compound and inflected words', () => {
    expect(ids('Rullestillaset skal låses.')).toContain('mobile-scaffold');
    expect(ids('Kranen skal stå på støttebena.')).toEqual(['crane', 'outrigger']);
  });

  it('drops a match that lies inside a longer match of another term', () => {
    expect(ids('Kranføreren skal stanse straks.')).toEqual(['crane-operator']); // not also "crane"
    expect(ids('Hjelm med hakestropp.')).toEqual(['helmet', 'chin-strap']); // not also "sling"
  });

  it('matches "=bas" as a whole word only', () => {
    expect(ids('Varsle basen.')).toEqual(['foreman']);
    expect(ids('Dette er basert på en plan.')).toEqual([]);
  });

  it('accepts Polish and Lithuanian inflected forms through stems', () => {
    const src = 'Bruk fallsikringssele festet til godkjent forankringspunkt der rekkverk mangler.';
    expect(check(src, 'Tam, gdzie nie ma balustrady ochronnej, używaj szelek bezpieczeństwa przypiętych do zatwierdzonego punktu kotwiczenia.', 'pl')).toEqual([]);
    expect(check(src, 'Kur nėra apsauginių turėklų, naudokite viso kūno saugos diržus, pritvirtintus prie patvirtinto tvirtinimo taško.', 'lt')).toEqual([]);
    // Lithuanian consonant change t → č in the genitive
    expect(check('Arbeidshøyde: 4 m', 'Darbo aukščio: 4 m', 'lt')).toEqual([]);
  });

  it('raises GLOSSARY_MISMATCH, red for a critical term and amber otherwise', () => {
    const red = check('Sperr av faresonen rundt løftet.', 'Aptverkite pavojaus vietą aplink kėlimo vietą.', 'lt');
    expect(red.map((f) => [f.type, f.severity, f.raisedBy])).toEqual([['GLOSSARY_MISMATCH', 'red', 'D1']]);
    const amber = check('Bruk vernesko og hansker.', 'Noś obuwie ochronne.', 'pl');
    expect(amber.map((f) => [f.type, f.severity])).toEqual([['GLOSSARY_MISMATCH', 'amber']]);
  });

  it('raises FORBIDDEN_TERM for a listed wrong term (AC-09)', () => {
    const flags = check('Fare: kranen velter.', 'Zagrożenie: dźwig przewraca się.', 'pl');
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe('FORBIDDEN_TERM');
    expect(flags[0].severity).toBe('red');
    expect(flags[0].evidence.expected).toBe('żuraw');
  });

  it('matches stems at the start of a word only, with alternatives', () => {
    expect(stemPresent('Zapas bezpieczeństwa', 'pas bezpiecz')).toBe(false);
    expect(stemPresent('z wysuniętymi podporami', 'podpor|podpór')).toBe(true);
    expect(stemPresent('bez podpór', 'podpor|podpór')).toBe(true);
  });

  it('derives stems from an approved term', () => {
    expect(deriveStems('szelki bezpieczeństwa')).toEqual(['szel', 'bezpieczeńst']);
    expect(deriveStems('dopuszczalne obciążenie robocze (DOR)')).toHaveLength(3);
  });
});
