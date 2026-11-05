// Translation memory (L1, L2): the system improves from human-verified translations, not by
// training. Only template lines that hold BOTH keys (a language reviewer and a technical
// reviewer) count. Machine output never enters the memory: a line gets into a template only
// through a reviewer (L4), and it counts here only once both keys are given.
import type { DataPack } from '../types';
import { deriveState } from '../verification';

export interface MemoryPair {
  nb: string;
  target: string;
  templateId: string;
  lineId: string;
}

/** Every verified pair for one language. Lines with a value from step 1 are left out: their text changes per job. */
export function memoryPairs(pack: DataPack, lang: string): MemoryPair[] {
  const out: MemoryPair[] = [];
  for (const t of pack.templates) {
    for (const l of t.lines) {
      if (l.parameterRefs.length > 0) continue;
      const tr = l.translations[lang as keyof typeof l.translations];
      if (!tr || deriveState(tr.keyLanguage, l.keyTechnical) !== 'verified') continue;
      out.push({ nb: l.textNb, target: tr.text, templateId: t.templateId, lineId: l.lineId });
    }
  }
  return out;
}

const norm = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ');

/** L1: the same Norwegian sentence, already verified in this language. Then no model call is needed. */
export function exactMatch(pack: DataPack, textNb: string, lang: string): MemoryPair | null {
  const want = norm(textNb);
  return memoryPairs(pack, lang).find((p) => norm(p.nb) === want) ?? null;
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3));

/** L2: up to three verified pairs most like this line (word overlap), as examples for the translation prompt. */
export function similarPairs(pack: DataPack, textNb: string, lang: string, n = 3, minScore = 0.2): { nb: string; target: string }[] {
  const a = words(textNb);
  if (a.size === 0) return [];
  const want = norm(textNb);
  return memoryPairs(pack, lang)
    .filter((p) => norm(p.nb) !== want)
    .map((p) => {
      const b = words(p.nb);
      const shared = [...a].filter((w) => b.has(w)).length;
      return { p, score: shared / (a.size + b.size - shared) };
    })
    .filter((x) => x.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, n)
    .map(({ p }) => ({ nb: p.nb, target: p.target }));
}
