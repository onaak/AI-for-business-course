// Metric definitions (specification 10.7). All results are counts with their denominators.
import { activeLines, allFlags } from './flags';
import type { Flag, LogEvent, ReviewerJudgements, Sja, Template, TimeCategory } from './types';

export const TIME_CATEGORIES: TimeCategory[] = ['input', 'machine', 'contentReview', 'flagResolution', 'understanding', 'signoff', 'reviewer'];
/** The ten-minute criterion covers these four. The understanding check is reported separately (SC-12). */
export const FOREMAN_CATEGORIES: TimeCategory[] = ['input', 'contentReview', 'flagResolution', 'signoff'];

export interface Count {
  n: number;
  of: number;
}

/** C1: lines reused or parameter-filled, out of all lines in the SJA. */
export function reuseRate(sja: Pick<Sja, 'lines'>): { reused: number; total: number } {
  const lines = activeLines(sja as Sja);
  return { reused: lines.filter((l) => l.origin === 'reused' || l.origin === 'parameterFilled').length, total: lines.length };
}

/**
 * Pilot measure 2 (share of SJAs built from a verified template), for one SJA: of the lines taken from
 * the template, how many have a translation that lacks one of the two keys in a crew language.
 */
export function unverifiedReuse(sja: Pick<Sja, 'lines' | 'languages'>): { total: number; unverified: number } {
  const reused = activeLines(sja as Sja).filter((l) => l.origin === 'reused' || l.origin === 'parameterFilled');
  const entries = (l: Sja['lines'][number]) => sja.languages.map((lang) => l.byLang[lang]).filter(Boolean);
  const withText = reused.filter((l) => entries(l).length > 0);
  return { total: withText.length, unverified: withText.filter((l) => entries(l).some((e) => e.verification !== 'verified')).length };
}

export function timeByCategory(events: LogEvent[], runId?: string): Record<TimeCategory, number> {
  const out = Object.fromEntries(TIME_CATEGORIES.map((c) => [c, 0])) as Record<TimeCategory, number>;
  for (const e of events) {
    if (runId && e.runId !== runId) continue;
    if (e.type === 'time' && e.timeCategory && e.durationMs) out[e.timeCategory] += e.durationMs;
    if (e.timeCategory === 'reviewer' && e.type !== 'time' && e.durationMs) out.reviewer += e.durationMs;
  }
  return out;
}

export function foremanTime(t: Record<TimeCategory, number>): number {
  return FOREMAN_CATEGORIES.reduce((sum, c) => sum + t[c], 0);
}

/**
 * Brief v3, pilot measure 1: total time per signed SJA, counting drafting, checking and
 * correction. Everything from the first input to the signature, including waiting for
 * the machine and a reviewer. The understanding check is reported separately.
 */
export const TOTAL_CATEGORIES: TimeCategory[] = ['input', 'machine', 'contentReview', 'reviewer', 'flagResolution', 'signoff'];
export type TimePhase = 'drafting' | 'checking' | 'correction' | 'signoff' | 'understanding';
export const PHASE_OF: Record<TimeCategory, TimePhase> = {
  input: 'drafting',
  machine: 'drafting',
  contentReview: 'checking',
  reviewer: 'checking',
  flagResolution: 'correction',
  signoff: 'signoff',
  understanding: 'understanding',
};

export function totalTime(t: Record<TimeCategory, number>): number {
  return TOTAL_CATEGORIES.reduce((sum, c) => sum + (t[c] ?? 0), 0);
}

/** Misunderstandings in the anonymous log, per template and template line (brief v3: fed back into the template). */
export function misunderstandingCounts(events: LogEvent[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const e of events) {
    if (e.type !== 'misunderstanding' || !e.templateId || !e.lineId) continue;
    out[e.templateId] ??= {};
    out[e.templateId][e.lineId] = (out[e.templateId][e.lineId] ?? 0) + 1;
  }
  return out;
}

export function assists(events: LogEvent[], runId: string): number {
  return events.filter((e) => e.runId === runId && e.type === 'assist').length;
}

/** C5: correct first answers on critical questions, out of all first answers. */
export function criticalAnswersCorrect(sja: Pick<Sja, 'understanding'>, template: Template | undefined): Count {
  let n = 0;
  let of = 0;
  for (const p of sja.understanding.perQuestion) {
    const q = template?.questions.find((x) => x.questionId === p.questionId);
    if (q && !q.critical) continue;
    n += p.correctFirst;
    of += p.respondents;
  }
  return { n, of };
}

// ---------- test bench (T6) ----------

export interface PairFixture {
  id: string;
  lang: string;
  kind: 'seeded' | 'control';
  source: string;
  target: string;
  critical: boolean;
  /** What was seeded: glossary, forbidden, number, negation, obligation, direction, condition, omission, similar-word */
  errorType?: string;
  /** False for errors a glossary lookup cannot catch. At least four per language (CH-04). */
  glossaryCatchable?: boolean;
  note?: string;
}

export interface PairResult {
  id: string;
  flags: Flag[];
  backTranslation?: string;
  error?: string;
  callOrigins: string[];
}

export interface BenchSummary {
  lang: string;
  seeded: number;
  caughtRulesOnly: number; // SC-16: rules alone
  caughtAll: number; // rules plus back-translation
  nonGlossary: number;
  nonGlossaryCaught: number;
  controls: number;
  controlsFlaggedRed: number;
  reviewerFalseAlarms: number;
  falseFlags: number;
  missed: string[];
  errors: number;
}

const DETERMINISTIC = ['D1', 'D2', 'D4'];
const counts = (f: Flag) => f.reviewerVerdict?.kind !== 'falseAlarm';

export function benchSummary(fixtures: PairFixture[], results: Record<string, PairResult | undefined>, lang: string): BenchSummary {
  const s: BenchSummary = {
    lang,
    seeded: 0,
    caughtRulesOnly: 0,
    caughtAll: 0,
    nonGlossary: 0,
    nonGlossaryCaught: 0,
    controls: 0,
    controlsFlaggedRed: 0,
    reviewerFalseAlarms: 0,
    falseFlags: 0,
    missed: [],
    errors: 0,
  };
  for (const fx of fixtures.filter((f) => f.lang === lang)) {
    const r = results[fx.id];
    const flags = r?.flags ?? [];
    if (r?.error) s.errors += 1;
    const valid = flags.filter(counts);
    const hasFalseAlarm = flags.some((f) => f.reviewerVerdict?.kind === 'falseAlarm');
    if (fx.kind === 'seeded') {
      s.seeded += 1;
      const caught = valid.length > 0;
      if (valid.some((f) => DETERMINISTIC.includes(f.raisedBy))) s.caughtRulesOnly += 1;
      if (caught) s.caughtAll += 1;
      else if (r) s.missed.push(fx.id);
      if (fx.glossaryCatchable === false) {
        s.nonGlossary += 1;
        if (caught) s.nonGlossaryCaught += 1;
      }
      if (hasFalseAlarm) {
        s.reviewerFalseAlarms += 1;
        s.falseFlags += 1;
      }
    } else {
      s.controls += 1;
      const red = flags.some((f) => f.severity === 'red');
      if (red) s.controlsFlaggedRed += 1;
      if (hasFalseAlarm && !red) s.reviewerFalseAlarms += 1;
      if (red || hasFalseAlarm) s.falseFlags += 1;
    }
  }
  return s;
}

// ---------- reviewer-judged metrics (C2, C3) ----------

export function judgedCounts(sja: Sja, j: ReviewerJudgements | undefined) {
  const terms = Object.values(j?.terms ?? {});
  const residual = Object.values(j?.residual ?? {});
  const routes = Object.values(j?.routes ?? {});
  const handled = allFlags(sja).filter((r) => r.lang !== 'nb' && r.flag.resolvedBy === 'foreman').length;
  return {
    termAccuracy: { n: terms.filter(Boolean).length, of: terms.length },
    residualCritical: { n: residual.filter(Boolean).length, of: residual.length },
    correctRoute: { n: routes.filter(Boolean).length, of: routes.length },
    flagsHandledByForeman: handled,
  };
}

export function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
