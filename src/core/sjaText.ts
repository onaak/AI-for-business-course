// What a reader of one language sees for one line of the SJA. Shared by the worker screens,
// the read-aloud view in step 5 and the SJA document, so that they always agree.
import { activeLines, isBlocking } from './flags';
import { SECTIONS, type Section, type Sja, type SjaLine } from './types';

/**
 * The checked text of a line in a crew language, or null when the foreman must explain the line
 * orally: no text, an oral route, a check that failed or is not done, or a flag nobody has handled.
 * Norwegian ('nb') is the original and is always usable.
 */
export function usableText(line: SjaLine, lang: string): string | null {
  if (lang === 'nb') return line.textNb;
  const e = line.byLang[lang];
  if (!e || e.oralFallback || !e.text) return null;
  if (e.checkState === 'error' || e.checkState === 'pending' || e.checkState === 'blocked') return null;
  if (e.flags.some((f) => isBlocking(f, line.critical))) return null;
  return e.text;
}

/** Lines written for today's job (changed or new), the ones the read-aloud view and the document highlight. */
export const isToday = (l: SjaLine) => l.origin === 'changed' || l.origin === 'new';

/** The SJA's active lines, by section, in the fixed section order. */
export function bySection(sja: Pick<Sja, 'lines'>): { section: Section; lines: SjaLine[] }[] {
  const lines = activeLines(sja as Sja);
  return SECTIONS.map((section) => ({ section, lines: lines.filter((l) => l.section === section) })).filter((g) => g.lines.length > 0);
}
