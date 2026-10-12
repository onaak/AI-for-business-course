// Reads the seed data pack and reads/writes the working data pack (plan section 5).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dataPackSchema, glossaryTermSchema, hazardListSchema, templateSchema } from '../src/core/schemas';
import type { DataPack, HazardList, Lang } from '../src/core/types';
import { canonicalJson } from '../src/core/util';

const LANG_ORDER: Lang[] = ['pl', 'lt', 'en'];

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
  const templates = readdirSync(path.join(seed, 'templates'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse() // work-at-height first
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
  if (existsSync(file)) return dataPackSchema.parse(readJson(file)) as DataPack;
  const pack = loadSeedPack(dataDir);
  savePack(dataDir, pack);
  return pack;
}

export function savePack(dataDir: string, input: unknown): DataPack {
  const pack = dataPackSchema.parse(input) as DataPack;
  pack.hash = packHash(pack);
  mkdirSync(path.dirname(workingPackPath(dataDir)), { recursive: true });
  writeFileSync(workingPackPath(dataDir), `${JSON.stringify(pack, null, 2)}\n`);
  return pack;
}

export function resetPack(dataDir: string): DataPack {
  return savePack(dataDir, loadSeedPack(dataDir));
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
