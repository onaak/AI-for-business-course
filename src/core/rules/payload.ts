// D6 Model calls receive only: job type, parameter values, confirmed specifics,
// line texts and glossary entries. Never header fields.
// These builders are the only place where a model payload is assembled in the
// browser. The server enforces the same allow-list again (schemas.ts, strict objects).
import type { P1Input, P2Input, P3Input, P4Input, P5Input, P6Input } from '../schemas';
import type { DataPack, HazardList, Sja, SjaLine, Template } from '../types';
import { formatNumber } from '../util';
import { glossaryForLine } from './glossary';

export function buildP1(sja: Pick<Sja, 'parameterValues' | 'freeText' | 'questions'>, template: Template): P1Input {
  return {
    jobType: template.jobType.nb ?? template.templateId,
    parameters: template.parameters.map((p) => {
      const v = sja.parameterValues[p.key] ?? p.default;
      const value =
        p.type === 'number'
          ? `${formatNumber(Number(v), 'nb')} ${p.unitSymbol}`.trim()
          : (p.options.find((o) => o.key === v)?.label.nb ?? String(v));
      return { label: p.label.nb ?? p.key, value };
    }),
    freeText: sja.freeText.trim(),
    answers: sja.questions.filter((q) => q.answer).map((q) => ({ question: q.question, answer: q.answer as string })),
  };
}

export function buildP2(
  sja: Pick<Sja, 'specifics'>,
  template: Template,
  baselineLines: SjaLine[],
  hazards: HazardList | undefined,
): P2Input {
  return {
    jobType: template.jobType.nb ?? template.templateId,
    lines: baselineLines.map((l) => ({ lineId: l.lineId, section: l.section, text: l.textNb, critical: l.critical })),
    specifics: sja.specifics.filter((s) => s.status === 'clear').map((s) => s.text),
    hazards: (hazards?.entries ?? []).map((h) => ({ hazardId: h.hazardId, section: h.section, text: h.textNb })),
  };
}

export function buildP3(lines: Pick<SjaLine, 'lineId' | 'textNb' | 'critical'>[]): P3Input {
  return { lines: lines.map((l) => ({ lineId: l.lineId, text: l.textNb, critical: l.critical })) };
}

export function buildP4(sourceNb: string, lang: string, pack: DataPack, enforce: boolean, attempt: number): P4Input {
  return {
    targetLang: lang,
    text: sourceNb,
    glossary: glossaryForLine(sourceNb, lang, pack),
    enforceApprovedTerms: enforce,
    attempt,
  };
}

/** The back-translation payload is built from the target text alone. It has no parameter for the source. */
export function buildP5(lang: string, targetText: string): P5Input {
  return { lang, text: targetText };
}

export function buildP6(source: string, backTranslation: string, critical: boolean): P6Input {
  return { source, backTranslation, critical };
}
