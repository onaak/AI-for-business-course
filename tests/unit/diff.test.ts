import { describe, expect, it } from 'vitest';
import { applyOperations, changedParameters, setLineText } from '../../src/core/rules/diff';
import { fillParams } from '../../src/core/util';
import { hazards, seedPack } from '../helpers';

const pack = seedPack();
const tpl = pack.templates.find((t) => t.templateId === 'work-at-height')!;
const haz = hazards().find((h) => h.templateId === 'work-at-height');
const langs = ['pl', 'lt'] as const;
const apply = (values: Record<string, number | string>, operations: any[] = []) =>
  applyOperations({ template: tpl, values, operations, hazards: haz, pack, langs: [...langs] });

describe('D3 diff, origins and markers', () => {
  it('parameter-only run: every non-parameter line is byte-identical to the template in all languages (AC-05)', () => {
    const values = { height: 7, access: 'scaffold', wind: 12 };
    const { lines } = apply(values);
    for (const tl of tpl.lines) {
      const line = lines.find((l) => l.lineId === tl.lineId)!;
      if (tl.parameterRefs.length === 0) {
        expect(line.origin).toBe('reused');
        expect(line.textNb).toBe(tl.textNb);
        for (const lang of langs) expect(line.byLang[lang].text).toBe(tl.translations[lang]!.text);
      } else {
        expect(line.origin).toBe('parameterFilled');
        for (const lang of langs) expect(line.byLang[lang].text).toBe(fillParams(tl.translations[lang]!.text, tpl.parameters, values, lang));
      }
    }
    expect(lines.find((l) => l.lineId === 'h-01')!.byLang.pl.text).toBe('Wysokość robocza: 7 m');
  });

  it('marks TECH_RECHECK on lines that reference or depend on a changed parameter (AC-13)', () => {
    expect(changedParameters(tpl, { height: 6, access: 'scaffold', wind: 15 })).toEqual(['height']);
    const { lines } = apply({ height: 6, access: 'scaffold', wind: 15 });
    expect(lines.filter((l) => l.techRecheck === 'open').map((l) => l.lineId)).toEqual(['h-01', 'h-09']);
    expect(apply({ height: 4, access: 'scaffold', wind: 15 }).lines.every((l) => l.techRecheck === 'none')).toBe(true);
  });

  it('does not trust the model: a "modify" that returns the template text stays reused', () => {
    const same = tpl.lines.find((l) => l.lineId === 'h-10')!.textNb;
    const { lines } = apply({}, [{ op: 'modify', lineId: 'h-10', text: same }]);
    expect(lines.find((l) => l.lineId === 'h-10')!.origin).toBe('reused');
  });

  it('a changed line loses its stored translations and waits for a new check', () => {
    const { lines } = apply({}, [{ op: 'modify', lineId: 'h-10', text: 'Sperr av fortauet under stillaset.', hazardRef: 'hh-04' }]);
    const line = lines.find((l) => l.lineId === 'h-10')!;
    expect(line.origin).toBe('changed');
    expect(line.aiSuggestion).toBe('none');
    expect(line.byLang.pl).toMatchObject({ text: '', checkState: 'pending', source: 'machineNew' });
  });

  it('a new or changed line with no hazard-list reference is an unverified AI suggestion (AC-06)', () => {
    const { lines } = apply({}, [
      { op: 'add', text: 'Bruk hørselvern.', section: 'ppe', hazardRef: null },
      { op: 'add', text: 'Rullestillas skal låses.', section: 'controls', hazardRef: 'hh-09' },
      { op: 'modify', lineId: 'h-11', text: 'Sikre verktøy med snor.', hazardRef: 'not-a-real-ref' },
    ]);
    const unsourced = lines.find((l) => l.textNb === 'Bruk hørselvern.')!;
    expect(unsourced.origin).toBe('new');
    expect(unsourced.aiSuggestion).toBe('open');
    expect(unsourced.flags.map((f) => [f.type, f.severity, f.raisedBy])).toEqual([['AI_ADDED_CONTENT', 'amber', 'D3']]);
    const sourced = lines.find((l) => l.textNb === 'Rullestillas skal låses.')!;
    expect(sourced.aiSuggestion).toBe('none');
    expect(sourced.hazardRef).toBe('hh-09');
    expect(lines.find((l) => l.lineId === 'h-11')!.aiSuggestion).toBe('open');
  });

  it('removing a safety-critical line raises CRITICAL_LINE_REMOVED', () => {
    const { lines } = apply({}, [{ op: 'remove', lineId: 'h-09' }, { op: 'remove', lineId: 'h-16' }]);
    expect(lines.find((l) => l.lineId === 'h-09')!.flags.map((f) => [f.type, f.severity])).toEqual([['CRITICAL_LINE_REMOVED', 'red']]);
    expect(lines.find((l) => l.lineId === 'h-16')!.flags).toEqual([]);
  });

  it('ignores operations on unknown lines and reports them', () => {
    const r = apply({}, [{ op: 'modify', lineId: 'nope', text: 'x' }]);
    expect(r.warnings).toHaveLength(1);
  });

  it('an edit back to the template text restores the reused state', () => {
    const { lines } = apply({});
    const line = lines.find((l) => l.lineId === 'h-10')!;
    const original = line.textNb;
    setLineText(line, 'Noe annet.', tpl, {}, [...langs], pack);
    expect(line.origin).toBe('changed');
    setLineText(line, original, tpl, {}, [...langs], pack);
    expect(line.origin).toBe('reused');
    expect(line.byLang.lt.text).toBe(tpl.lines.find((l) => l.lineId === 'h-10')!.translations.lt!.text);
  });
});
