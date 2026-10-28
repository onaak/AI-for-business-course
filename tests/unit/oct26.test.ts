// Tests for the update of 26 October 2026 (team feedback and the Gravitas interview).
// Pure rules and data: no model, no browser.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeSeed } from '../../server/data';
import { keepsText } from '../../server/gateway';
import * as flow from '../../src/core/flow';
import { checkLineRules } from '../../src/core/pipeline/checkLine';
import { filterRules, EMPTY_FILTER, ruleRows, rulesCsv } from '../../src/core/rules/library';
import { exactMatch, memoryPairs, similarPairs } from '../../src/core/rules/memory';
import { checkNumbers } from '../../src/core/rules/numbers';
import { buildP4 } from '../../src/core/rules/payload';
import { inputSchemas } from '../../src/core/schemas';
import type { DataPack, ModelClient, SjaLine } from '../../src/core/types';
import { clone } from '../../src/core/util';
import { addTermForms, promoteLine } from '../../src/core/verification';
import { dataDir, fixtures, hazards, HEADER, makeCtx, makeGateway, seedPack, startJob } from '../helpers';

const noModel: ModelClient = {
  async call() {
    throw new Error('no model in unit tests');
  },
};
const KEY = { given: true, role: 'language' as const, outsideGroup: false, date: '2026-10-26' };
const TKEY = { given: true, role: 'technical' as const, outsideGroup: false, date: '2026-10-26' };

/** A pack in which one line is verified (both keys) in Russian. */
function packWithVerified(lineId = 'h-09'): DataPack {
  const pack = clone(seedPack());
  const line = pack.templates.find((t) => t.templateId === 'work-at-height')!.lines.find((l) => l.lineId === lineId)!;
  line.keyTechnical = { ...TKEY };
  line.translations.ru!.keyLanguage = { ...KEY };
  return pack;
}

describe('Russian (R2, R3)', () => {
  const pack = seedPack();
  it('is a supported language with a glossary column for every term', () => {
    expect(pack.languages).toEqual(['pl', 'lt', 'ru', 'en']);
    expect(pack.glossary.every((t) => t.byLang.ru)).toBe(true);
  });
  it('treats Cyrillic unit symbols as the same unit (D2)', () => {
    expect(checkNumbers({ lineId: 'x', source: 'Arbeidshøyde: 4 m', target: 'Рабочая высота: 4 м', lang: 'ru' })).toEqual([]);
    expect(checkNumbers({ lineId: 'x', source: 'Vindgrense: 12 m/s', target: 'Предел по ветру: 12 м/с', lang: 'ru' })).toEqual([]);
    expect(checkNumbers({ lineId: 'x', source: 'Lastens vekt: 500 kg', target: 'Масса груза: 500 кг', lang: 'ru' })).toEqual([]);
    expect(checkNumbers({ lineId: 'x', source: 'Minst 2 personer.', target: 'Не менее 3 человек.', lang: 'ru' })).toHaveLength(1);
    expect(checkNumbers({ lineId: 'x', source: 'Arbeidshøyde: 4 m', target: 'Рабочая высота: 4 кг', lang: 'ru' })).toHaveLength(1);
  });
  it('finds a forbidden Russian term and accepts the approved one (D1)', () => {
    const source = 'Bruk fallsikringssele festet til godkjent forankringspunkt der rekkverk mangler.';
    const wrong = checkLineRules({ lineId: 'x', source, target: 'Там, где нет защитного ограждения, используйте предохранительный пояс, пристёгнутый к утверждённой точке крепления.', lang: 'ru', critical: true }, pack);
    expect(wrong.flags.map((f) => f.type)).toContain('FORBIDDEN_TERM');
    const right = checkLineRules({ lineId: 'x', source, target: 'Там, где нет защитного ограждения, используйте страховочную привязь, пристёгнутую к утверждённой точке крепления.', lang: 'ru', critical: true }, pack);
    expect(right.flags).toEqual([]);
  });
  it('ships 10 Russian seeded errors and 10 controls for T6 (R4)', () => {
    const f = fixtures();
    expect(f['seeded-errors.ru'].pairs).toHaveLength(10);
    expect(f['controls.ru'].pairs).toHaveLength(10);
    expect(f['seeded-errors.ru'].pairs.filter((p: any) => p.glossaryCatchable === false).length).toBeGreaterThanOrEqual(4);
    // Every control is clean under the deterministic rules.
    for (const p of f['controls.ru'].pairs) expect(checkLineRules({ lineId: p.id, source: p.source, target: p.target, lang: 'ru', critical: p.critical }, pack).flags).toEqual([]);
  });
});

describe('Painting and concrete templates, products (J1, J2, K1–K5)', () => {
  it('product lines come only with the picked product', () => {
    const { ctx } = makeCtx('painting', noModel);
    const none = startJob(ctx, 'jd-10', { products: [] });
    const picked = startJob(ctx, 'jd-10', { products: ['pr-2k-pu'] });
    expect(none.lines.some((l) => l.lineId === 'p-24')).toBe(false);
    expect(picked.lines.filter((l) => ['p-24', 'p-25'].includes(l.lineId))).toHaveLength(2);
    expect(picked.lines.some((l) => l.lineId === 'p-23')).toBe(false); // another product's line
    expect(picked.products).toEqual(['pr-2k-pu']);
  });
  it('product lines show only their product’s pictograms; every template has a substance-index line', () => {
    const pack = seedPack();
    for (const id of ['painting', 'concrete']) {
      const t = pack.templates.find((x) => x.templateId === id)!;
      expect(t.products!.length).toBeGreaterThanOrEqual(2);
      expect(t.lines.some((l) => l.parameterRefs.includes('stoffkartotek'))).toBe(true); // K4
      for (const l of t.lines.filter((x) => x.onlyWithProduct)) {
        const p = t.products!.find((x) => x.productId === l.onlyWithProduct)!;
        expect(p).toBeTruthy();
        // A line never shows a pictogram its product does not carry.
        for (const g of l.ghs ?? []) expect(p.ghs, `${l.lineId}/${g}`).toContain(g);
      }
      expect(t.questions.length).toBeGreaterThanOrEqual(8); // Q2
    }
  });
  it('the question banks hold 8 or more questions per template, in every language', () => {
    const pack = seedPack();
    for (const t of pack.templates) {
      expect(t.questions.length).toBeGreaterThanOrEqual(8);
      for (const q of t.questions) for (const l of ['nb', 'en', 'pl', 'lt', 'ru'] as const) expect(q.byLang[l], `${t.templateId}/${q.questionId}/${l}`).toBeTruthy();
    }
  });
  it('every rule line has a source or is marked firm practice (Q1); only values from step 1 have none', () => {
    const pack = seedPack();
    const hz = hazards();
    for (const t of pack.templates) {
      for (const l of t.lines) {
        if (l.parameterRefs.length > 0) continue;
        expect(l.sourceRef, `${t.templateId}/${l.lineId}`).toBeTruthy();
        const e = hz.find((h) => h.templateId === t.templateId)!.entries.find((x) => x.hazardId === l.sourceRef)!;
        expect(e.sourceId === 'FIRMA' || e.sourceId === 'SDS' || Boolean(e.paragraph) || e.sourceId.startsWith('AT-') || e.sourceId.startsWith('HSE')).toBe(true);
      }
    }
  });
});

describe('Translation memory (L1, L2)', () => {
  it('holds only lines with both keys', () => {
    expect(memoryPairs(seedPack(), 'ru')).toEqual([]);
    const pack = packWithVerified();
    expect(memoryPairs(pack, 'ru').map((p) => p.lineId)).toEqual(['h-09']);
    expect(memoryPairs(pack, 'lt')).toEqual([]); // the Lithuanian key was not given
  });
  it('gives verified examples to the translator only when they exist, so replay keys stay the same until then', () => {
    const text = 'Bruk fallsikringssele festet til forankringspunkt der rekkverket er tatt ned.';
    expect(buildP4(text, 'ru', seedPack(), false, 0)).not.toHaveProperty('examples');
    const p4 = buildP4(text, 'ru', packWithVerified(), false, 0);
    expect(p4.examples).toHaveLength(1);
    expect(p4.examples![0].target).toContain('страховочную привязь');
    expect(inputSchemas.P4.safeParse(p4).success).toBe(true);
    expect(similarPairs(packWithVerified(), 'Bestill pizza til lunsj.', 'ru')).toEqual([]);
  });
  it('reuses an exactly matching verified translation with no model call', async () => {
    const pack = packWithVerified('h-10');
    const { ctx } = makeCtx('work-at-height', noModel);
    ctx.pack = pack;
    ctx.template = pack.templates.find((t) => t.templateId === 'work-at-height')!;
    const verifiedText = ctx.template.lines.find((l) => l.lineId === 'h-10')!.textNb;
    expect(exactMatch(pack, verifiedText, 'ru')?.lineId).toBe('h-10');
    let s = startJob(ctx, 'jd-09', { languages: ['ru'] });
    // A foreman adds a line that says exactly what a verified line says.
    s = flow.addLine(ctx, s, 'controls', verifiedText);
    s = { ...s, contentConfirmed: true };
    s = await flow.runLanguageCheck(ctx, s); // noModel would throw if a model were called
    const added = s.lines.find((l) => l.addedBy === 'foreman') as SjaLine;
    expect(added.byLang.ru).toMatchObject({ source: 'memory', verification: 'verified', checkState: 'checked' });
  });
});

describe('Rules library (B1–B5)', () => {
  const rows = ruleRows(seedPack(), hazards());
  it('lists rule lines from every template, without the lines that only hold a value', () => {
    expect(new Set(rows.map((r) => r.templateId))).toEqual(new Set(['work-at-height', 'lifting', 'painting', 'concrete']));
    expect(rows.some((r) => r.line.lineId === 'h-01')).toBe(false);
    expect(rows.every((r) => r.tags.length > 0)).toBe(true);
  });
  it('filters by tag, risk and text, and puts what was misunderstood on site first', () => {
    const chem = filterRules(rows, { ...EMPTY_FILTER, tags: ['chemicals'] });
    expect(chem.length).toBeGreaterThan(10);
    expect(chem.every((r) => r.tags.includes('chemicals'))).toBe(true);
    const red = filterRules(rows, { ...EMPTY_FILTER, risk: 'red', search: 'pumpe' });
    expect(red.map((r) => r.line.lineId)).toEqual(expect.arrayContaining(['c-12', 'c-21']));
    const counted = ruleRows(seedPack(), hazards(), { misunderstood: { lifting: { 'l-12': 2 } }, notFollowed: { painting: { 'p-16': 1 } } });
    const first = filterRules(counted, { ...EMPTY_FILTER, onlyFromSite: true });
    expect(first.map((r) => r.key)).toEqual(['lifting/l-12', 'painting/p-16']);
  });
  it('exports a CSV with the banner first', () => {
    const csv = rulesCsv(rows.slice(0, 2), { tag: (t) => t, risk: (r) => r, lang: 'nb', banner: 'BANNER' }).split('\n');
    expect(csv[0]).toBe('"BANNER"');
    expect(csv[1]).toContain('"Kilde"');
    expect(csv).toHaveLength(5);
  });
});

describe('Working data pack: new seed content is merged, nothing is lost', () => {
  it('adds languages, templates, lines, questions and fields, and keeps every key and edit', () => {
    const seed = seedPack();
    // An old working pack: the first two templates only, no Russian, one key given and one text edited.
    const old = clone(seed);
    old.languages = ['pl', 'lt', 'en'];
    old.templates = old.templates.filter((t) => ['work-at-height', 'lifting'].includes(t.templateId));
    for (const t of old.templates) {
      t.questions = t.questions.slice(0, 4);
      for (const l of t.lines) {
        delete l.translations.ru;
        delete l.tags;
      }
    }
    for (const g of old.glossary) delete g.byLang.ru;
    old.glossary = old.glossary.slice(0, 46);
    const h09 = old.templates[0].lines.find((l) => l.lineId === 'h-09')!;
    h09.keyTechnical = { ...TKEY };
    h09.translations.lt = { text: 'Redaguotas tekstas.', keyLanguage: { ...KEY } };
    const merged = mergeSeed(old, seed);
    expect(merged.languages).toEqual(['pl', 'lt', 'ru', 'en']);
    expect(merged.templates.map((t) => t.templateId)).toEqual(['work-at-height', 'lifting', 'painting', 'concrete']);
    expect(merged.glossary).toHaveLength(seed.glossary.length);
    const m09 = merged.templates[0].lines.find((l) => l.lineId === 'h-09')!;
    expect(m09.keyTechnical.given).toBe(true);
    expect(m09.translations.lt).toEqual({ text: 'Redaguotas tekstas.', keyLanguage: KEY });
    expect(m09.translations.ru?.text).toContain('привязь');
    expect(m09.tags).toEqual(['height']);
    expect(merged.templates[0].questions).toHaveLength(seed.templates[0].questions.length);
    expect(merged.seedHash).toBe(seed.hash);
  });
});

describe('Reviewer teaches the glossary, and promotes a line (L3, L4)', () => {
  const session = { role: 'language' as const, lang: 'ru' as const, outsideGroup: false };
  it('adds an accepted form and a forbidden word, with the reviewer’s key', () => {
    const pack = clone(seedPack());
    expect(addTermForms(pack, 'harness', 'ru', { accepted: 'страховочн привяз', forbidden: 'страховочный ремень' }, session, '2026-10-26')).toBe(true);
    const e = pack.glossary.find((t) => t.termId === 'harness')!.byLang.ru!;
    expect(e.stems[0]).toBe('привяз|страховочн привяз');
    expect(e.forbidden).toContain('страховочный ремень');
    expect(e.keyLanguage.given).toBe(true);
    expect(() => addTermForms(pack, 'harness', 'lt', { accepted: 'x' }, session, '2026-10-26')).toThrow(/language reviewer of this language/);
  });
  it('adds a line written for one job to its template as a draft, with checked translations only', () => {
    const pack = clone(seedPack());
    const line: SjaLine = {
      lineId: 'ny-1', templateLineId: null, section: 'controls', origin: 'new', textNb: 'Sperr av fortauet under stillaset med gjerde.', baselineNb: null, critical: true, addedBy: 'ai', hazardRef: 'hh-04', techRecheck: 'none', aiSuggestion: 'none', flags: [],
      byLang: {
        pl: { text: 'Wygrodź chodnik pod rusztowaniem płotem.', source: 'machineNew', verification: 'draft', oralFallback: false, flags: [], checkState: 'checked', checkedSource: '' },
        lt: { text: 'x', source: 'machineNew', verification: 'draft', oralFallback: false, flags: [], checkState: 'error' },
      },
    };
    const id = promoteLine(pack, 'work-at-height', line, hazards().find((h) => h.templateId === 'work-at-height'), 'h-10');
    const t = pack.templates.find((x) => x.templateId === 'work-at-height')!;
    const at = t.lines.findIndex((l) => l.lineId === id);
    expect(t.lines[at - 1].lineId).toBe('h-10');
    expect(t.lines[at]).toMatchObject({ textNb: line.textNb, sourceRef: 'hh-04', keyTechnical: { given: false } });
    expect(Object.keys(t.lines[at].translations)).toEqual(['pl']);
    expect(() => promoteLine(pack, 'work-at-height', line, undefined, null)).toThrow(/already has/);
  });
});

describe('Written explanation and site observation (U2, U3, I4)', () => {
  it('P7 accepts only the language and the two answers: there is no field for a name', () => {
    expect(inputSchemas.P7.safeParse({ lang: 'ru', items: [{ key: 'hazard', text: 'x' }, { key: 'measure', text: 'y' }] }).success).toBe(true);
    expect(inputSchemas.P7.safeParse({ lang: 'ru', items: [{ key: 'hazard', text: 'x' }], worker: 'Ivan' }).success).toBe(false);
  });
  it('the worker’s text is not kept in the call log outside the test bench', async () => {
    expect(keepsText('P7', 'sja-123')).toBe(false);
    expect(keepsText('P7', 'bench-u4-1')).toBe(true);
    expect(keepsText('P4', 'sja-123')).toBe(true);
    const gw = makeGateway();
    const sample = fixtures()['written-answers'].answers[0];
    const call = await gw.call('P7', { lang: sample.lang, items: [{ key: 'hazard', text: sample.hazard }, { key: 'measure', text: sample.measure }] }, 'sja-999');
    expect((call.parsed as any).items[0].textNb).toBe(sample.translation.hazard); // the screen gets the translation
    const logged = readFileSync(path.join(gw.cfg.evidenceDir, 'calls', 'sja-999.jsonl'), 'utf8');
    expect(logged).not.toContain(sample.hazard);
    expect(logged).not.toContain(sample.translation.hazard);
    expect(logged).toContain('[worker text not kept]');
  });
  it('"understood but not followed" is logged apart from "misunderstood", without names', () => {
    const env = makeCtx('work-at-height', noModel);
    let s = flow.editLine(env.ctx, startJob(env.ctx, 'jd-09'), 'h-10', 'Sperr av fortauet under stillaset.');
    s = { ...s, status: 'signed' };
    s = flow.recordObservation(env.ctx, s, ['h-10'], ['h-15', 'h-10']);
    expect(s.observation).toMatchObject({ lineIds: ['h-10'], notFollowed: ['h-15'] });
    expect(env.events.filter((e) => e.type === 'rule_not_followed')).toEqual([{ actor: 'foreman', type: 'rule_not_followed', step: 'observation', lineId: 'h-15', templateId: 'work-at-height', route: 'observation' }]);
    expect(JSON.stringify(env.events)).not.toContain(HEADER.siteLabel);
  });
  it('ships 10 written sample answers in Lithuanian, Polish and Russian, some subtly wrong (U4)', () => {
    const a = fixtures()['written-answers'].answers as any[];
    expect(a).toHaveLength(10);
    expect(new Set(a.map((x) => x.lang))).toEqual(new Set(['lt', 'pl', 'ru']));
    expect(a.filter((x) => x.intended === 'subtlyWrong').length).toBeGreaterThanOrEqual(3);
  });
});

it('data dir is the project data dir', () => {
  expect(dataDir.endsWith('data')).toBe(true);
});
