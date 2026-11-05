// Seed self-check: validates the data pack and runs the deterministic rules (D1, D2)
// over every stored translation. A flag here means either a draft translation is
// wrong or a glossary stem needs tuning. Run: npm run data:check
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHazards, loadSeedPack } from '../server/data';
import { checkLineRules } from '../src/core/pipeline/checkLine';
import { findSourceTerms } from '../src/core/rules/glossary';
import { fillParams } from '../src/core/util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = loadSeedPack(path.join(root, 'data'));
const hazards = loadHazards(path.join(root, 'data'));
let problems = 0;

for (const t of pack.templates) {
  const defaults = Object.fromEntries(t.parameters.map((p) => [p.key, p.default]));
  const haz = hazards.find((h) => h.templateId === t.templateId);
  for (const line of t.lines) {
    const found = findSourceTerms(line.textNb, pack.glossary).map((m) => m.term.termId).join(',');
    if (found !== line.termIds.join(',')) {
      problems += 1;
      console.log(`termIds differ  ${t.templateId}/${line.lineId}: stored [${line.termIds}] found [${found}]`);
    }
    if (line.sourceRef && !haz?.entries.some((h) => h.hazardId === line.sourceRef)) {
      problems += 1;
      console.log(`unknown sourceRef ${t.templateId}/${line.lineId}: ${line.sourceRef}`);
    }
    for (const lang of pack.languages) {
      const tr = line.translations[lang];
      if (!tr) {
        problems += 1;
        console.log(`missing translation ${t.templateId}/${line.lineId} ${lang}`);
        continue;
      }
      const source = fillParams(line.textNb, t.parameters, defaults, 'nb');
      const target = fillParams(tr.text, t.parameters, defaults, lang);
      const { flags } = checkLineRules({ lineId: line.lineId, source, target, lang, critical: line.critical }, pack);
      for (const f of flags) {
        problems += 1;
        console.log(`${f.type}  ${t.templateId}/${line.lineId} ${lang}: ${f.evidence.expected ?? ''} | ${f.evidence.found ?? ''}\n    ${target}`);
      }
    }
  }
  for (const q of t.questions) {
    for (const lang of ['nb', ...pack.languages] as const) {
      if (!q.byLang[lang]) {
        problems += 1;
        console.log(`missing question text ${t.templateId}/${q.questionId} ${lang}`);
      }
    }
    for (const id of q.linkedLineIds) {
      if (!t.lines.some((l) => l.lineId === id)) {
        problems += 1;
        console.log(`question ${q.questionId} links unknown line ${id}`);
      }
    }
  }
}
const counts = pack.templates.map((t) => `${t.templateId}: ${t.lines.length} lines, ${t.questions.length} questions`).join('; ');
console.log(`\nPack: ${pack.glossary.length} glossary terms, languages ${pack.languages.join(', ')}; ${counts}`);
console.log(problems === 0 ? 'Seed check passed: no deterministic flags on stored translations.' : `Seed check found ${problems} problem(s).`);
process.exit(problems === 0 ? 0 : 1);
