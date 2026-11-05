// Reads the seed data pack and reads/writes the working data pack (plan section 5).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dataPackSchema, glossaryTermSchema, hazardListSchema, templateSchema } from '../src/core/schemas';
import type { DataPack, HazardList, Lang } from '../src/core/types';
import { canonicalJson } from '../src/core/util';

const LANG_ORDER: Lang[] = ['pl', 'lt', 'ru', 'en'];
/** The order of the templates on screen. Templates not listed come last. */
const TEMPLATE_ORDER = ['work-at-height', 'lifting', 'painting', 'concrete'];

export function packHash(pack: Pick<DataPack, 'languages' | 'glossary' | 'templates'>): string {
  return createHash('sha256')
    .update(canonicalJson({ languages: pack.languages, glossary: pack.glossary, templates: pack.templates }))
    .digest('hex')
    .slice(0, 16);
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function loadSeedPack(dataDir: string): DataPack {
  const seed = path.join(dataDir, 'seed');
  const glossary = glossaryTermSchema.array().parse(readJson(path.join(seed, 'glossary.json')));
  const order = (f: string) => {
    const i = TEMPLATE_ORDER.indexOf(f.replace(/\.json$/, ''));
    return i < 0 ? TEMPLATE_ORDER.length : i;
  };
  const templates = readdirSync(path.join(seed, 'templates'))
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((f) => templateSchema.parse(readJson(path.join(seed, 'templates', f))));
  // A language is supported if the glossary has a column for it (SC-03).
  const languages = LANG_ORDER.filter((l) => glossary.some((t) => t.byLang[l]));
  const pack = { version: 1, hash: '', languages, glossary, templates } as DataPack;
  pack.hash = packHash(pack);
  return dataPackSchema.parse(pack) as DataPack;
}

export function workingPackPath(dataDir: string) {
  return path.join(dataDir, 'working', 'pack.json');
}

export function loadPack(dataDir: string): DataPack {
  const file = workingPackPath(dataDir);
  const seed = loadSeedPack(dataDir);
  if (existsSync(file)) {
    const working = dataPackSchema.parse(readJson(file)) as DataPack;
    if (working.seedHash === seed.hash) return working;
    // The seed data has changed since this working pack was made (a new template, a new language,
    // new fields). Add what is new, keep every reviewer key and edit. Nothing is removed or overwritten.
    return savePack(dataDir, mergeSeed(working, seed));
  }
  return savePack(dataDir, { ...seed, seedHash: seed.hash });
}

const byId = <T,>(items: T[], id: (x: T) => string) => new Map(items.map((x) => [id(x), x]));

/**
 * Additive merge of new seed content into a working pack. Adds: languages, glossary terms and
 * their missing language entries, templates, template lines (at their seed position), missing
 * translations, questions and their missing languages, parameters, products, and the optional
 * fields tags, riskLevel, ghs, onlyWithProduct and a source reference where the working line has
 * none. Never removes anything and never overwrites a text, a key or a reviewer's edit.
 */
export function mergeSeed(working: DataPack, seed: DataPack): DataPack {
  const out = JSON.parse(JSON.stringify(working)) as DataPack;
  out.languages = LANG_ORDER.filter((l) => out.languages.includes(l) || seed.languages.includes(l));

  const terms = byId(out.glossary, (t) => t.termId);
  for (const st of seed.glossary) {
    const wt = terms.get(st.termId);
    if (!wt) {
      out.glossary.push(JSON.parse(JSON.stringify(st)));
      continue;
    }
    for (const [lang, entry] of Object.entries(st.byLang)) {
      if (!wt.byLang[lang as Lang]) wt.byLang[lang as Lang] = JSON.parse(JSON.stringify(entry));
    }
  }

  const templates = byId(out.templates, (t) => t.templateId);
  for (const stpl of seed.templates) {
    const wtpl = templates.get(stpl.templateId);
    if (!wtpl) {
      out.templates.push(JSON.parse(JSON.stringify(stpl)));
      continue;
    }
    for (const p of stpl.parameters) if (!wtpl.parameters.some((x) => x.key === p.key)) wtpl.parameters.push(JSON.parse(JSON.stringify(p)));
    if (stpl.products) {
      wtpl.products ??= [];
      for (const pr of stpl.products) if (!wtpl.products.some((x) => x.productId === pr.productId)) wtpl.products.push(JSON.parse(JSON.stringify(pr)));
    }
    if (stpl.standaloneQuestionIds && !wtpl.standaloneQuestionIds) wtpl.standaloneQuestionIds = [...stpl.standaloneQuestionIds];
    // Lines: insert missing ones after the seed line that comes before them.
    stpl.lines.forEach((sl, i) => {
      const wl = wtpl.lines.find((x) => x.lineId === sl.lineId);
      if (!wl) {
        const prevId = stpl.lines[i - 1]?.lineId;
        const at = prevId ? wtpl.lines.findIndex((x) => x.lineId === prevId) + 1 : 0;
        wtpl.lines.splice(at > 0 ? at : prevId ? wtpl.lines.length : 0, 0, JSON.parse(JSON.stringify(sl)));
        return;
      }
      for (const [lang, tr] of Object.entries(sl.translations)) {
        if (!wl.translations[lang as Lang]) wl.translations[lang as Lang] = JSON.parse(JSON.stringify(tr));
      }
      if (sl.tags && !wl.tags) wl.tags = [...sl.tags];
      if (sl.riskLevel && !wl.riskLevel) wl.riskLevel = sl.riskLevel;
      if (sl.ghs && !wl.ghs) wl.ghs = [...sl.ghs];
      if (sl.onlyWithProduct && !wl.onlyWithProduct) wl.onlyWithProduct = sl.onlyWithProduct;
      if (sl.sourceRef && !wl.sourceRef) wl.sourceRef = sl.sourceRef;
    });
    const questions = byId(wtpl.questions, (q) => q.questionId);
    for (const sq of stpl.questions) {
      const wq = questions.get(sq.questionId);
      if (!wq) {
        wtpl.questions.push(JSON.parse(JSON.stringify(sq)));
        continue;
      }
      for (const [lang, v] of Object.entries(sq.byLang)) if (!wq.byLang[lang as Lang]) wq.byLang[lang as Lang] = JSON.parse(JSON.stringify(v));
    }
  }
  out.seedHash = seed.hash;
  return out;
}

export function savePack(dataDir: string, input: unknown): DataPack {
  const pack = dataPackSchema.parse(input) as DataPack;
  pack.hash = packHash(pack);
  mkdirSync(path.dirname(workingPackPath(dataDir)), { recursive: true });
  writeFileSync(workingPackPath(dataDir), `${JSON.stringify(pack, null, 2)}\n`);
  return pack;
}

export function resetPack(dataDir: string): DataPack {
  const seed = loadSeedPack(dataDir);
  return savePack(dataDir, { ...seed, seedHash: seed.hash });
}

export function loadHazards(dataDir: string): HazardList[] {
  const dir = path.join(dataDir, 'seed', 'hazards');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => hazardListSchema.parse(readJson(path.join(dir, f))) as HazardList);
}

export function loadFixtures(dataDir: string): Record<string, unknown> {
  const dir = path.join(dataDir, 'fixtures');
  const out: Record<string, unknown> = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    out[f.replace(/\.json$/, '')] = readJson(path.join(dir, f));
  }
  return out;
}
