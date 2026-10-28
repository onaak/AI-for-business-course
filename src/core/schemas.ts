import { z } from 'zod';
import type { Task } from './types';

// ---------- Data pack ----------

const keyState = z.object({
  given: z.boolean(),
  role: z.enum(['language', 'technical']).optional(),
  outsideGroup: z.boolean().optional(),
  date: z.string().optional(),
});

const lang = z.enum(['nb', 'en', 'pl', 'lt', 'ru']);
const langText = z.partialRecord(lang, z.string());
const section = z.enum(['steps', 'hazards', 'controls', 'ppe', 'stop', 'emergency']);
const tag = z.enum(['height', 'lifting', 'painting', 'chemicals', 'dust', 'noise', 'vibration', 'fire', 'concrete', 'electrical', 'ppe', 'emergency']);
const riskLevel = z.enum(['green', 'yellow', 'red']);
const ghs = z.enum(['GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09']);

const glossaryLangEntry = z.object({
  approved: z.string().min(1),
  stems: z.array(z.string().min(1)),
  forbidden: z.array(z.string().min(1)),
  keyLanguage: keyState,
});

export const glossaryTermSchema = z.object({
  termId: z.string().min(1),
  conceptEn: z.string().min(1),
  definition: z.string().min(1),
  critical: z.boolean(),
  nbForms: z.array(z.string().min(1)).min(1),
  byLang: z.partialRecord(lang, glossaryLangEntry),
  keyTechnical: keyState,
});

const parameter = z.discriminatedUnion('type', [
  z.object({
    key: z.string(),
    label: langText,
    type: z.literal('number'),
    unitSymbol: z.string(),
    min: z.number(),
    max: z.number(),
    default: z.number(),
  }),
  z.object({
    key: z.string(),
    label: langText,
    type: z.literal('choice'),
    options: z.array(z.object({ key: z.string(), label: langText })).min(2),
    default: z.string(),
  }),
]);

const templateLine = z.object({
  lineId: z.string().min(1),
  section,
  textNb: z.string().min(1),
  parameterRefs: z.array(z.string()),
  dependsOnParameters: z.array(z.string()),
  critical: z.boolean(),
  sourceRef: z.string().nullable(),
  termIds: z.array(z.string()),
  keyTechnical: keyState,
  translations: z.partialRecord(lang, z.object({ text: z.string().min(1), keyLanguage: keyState })),
  tags: z.array(tag).optional(),
  riskLevel: riskLevel.optional(),
  ghs: z.array(ghs).optional(),
  onlyWithProduct: z.string().optional(),
});

const product = z.object({
  productId: z.string().min(1),
  name: langText,
  ghs: z.array(ghs),
  hCodes: z.array(z.string()),
  sdsNote: z.string(),
});

const question = z.object({
  questionId: z.string().min(1),
  linkedLineIds: z.array(z.string()).min(1),
  critical: z.boolean(),
  byLang: z.partialRecord(lang, z.object({ text: z.string(), options: z.array(z.string()).min(3).max(4), keyLanguage: keyState })),
  correctIndex: z.number().int().min(0),
  keyTechnical: keyState,
});

export const templateSchema = z.object({
  templateId: z.string().min(1),
  jobType: langText,
  parameters: z.array(parameter),
  lines: z.array(templateLine).min(1),
  questions: z.array(question),
  products: z.array(product).optional(),
  standaloneQuestionIds: z.array(z.string()).optional(),
});

export const dataPackSchema = z.object({
  version: z.number().int().min(1),
  hash: z.string(),
  seedHash: z.string().optional(),
  languages: z.array(lang),
  glossary: z.array(glossaryTermSchema),
  templates: z.array(templateSchema),
});

export const hazardListSchema = z.object({
  templateId: z.string(),
  note: z.string(),
  checkedAt: z.string().optional(),
  sources: z.array(z.object({ sourceId: z.string(), title: z.string(), publisher: z.string(), url: z.string() })),
  entries: z.array(
    z.object({
      hazardId: z.string(),
      section,
      textNb: z.string(),
      critical: z.boolean(),
      sourceId: z.string(),
      sourceDetail: z.string(),
      paragraph: z.string().optional(),
      url: z.string().optional(),
      tags: z.array(tag).optional(),
      riskLevel: riskLevel.optional(),
    }),
  ),
});

// ---------- Model task inputs: the D6 allow-list ----------
// Every object is strict. A field that is not listed here (for example a header
// field) makes the server reject the request before any prompt is built.

export const inputSchemas = {
  P1: z.strictObject({
    jobType: z.string(),
    parameters: z.array(z.strictObject({ label: z.string(), value: z.string() })),
    freeText: z.string().max(600),
    answers: z.array(z.strictObject({ question: z.string(), answer: z.string() })),
  }),
  P2: z.strictObject({
    jobType: z.string(),
    lines: z.array(z.strictObject({ lineId: z.string(), section, text: z.string(), critical: z.boolean() })),
    specifics: z.array(z.string()),
    hazards: z.array(z.strictObject({ hazardId: z.string(), section, text: z.string() })),
  }),
  P3: z.strictObject({
    lines: z.array(z.strictObject({ lineId: z.string(), text: z.string(), critical: z.boolean() })),
  }),
  P4: z.strictObject({
    targetLang: z.string(),
    text: z.string(),
    glossary: z.array(z.strictObject({ nb: z.string(), approved: z.string(), definition: z.string() })),
    enforceApprovedTerms: z.boolean(),
    attempt: z.number().int(),
    // L2: up to three verified translations of similar lines, as examples. Absent when there are none.
    examples: z.array(z.strictObject({ nb: z.string(), target: z.string() })).max(3).optional(),
  }),
  // P5 receives the target text only. There is no field for the source (architectural rule 3).
  P5: z.strictObject({ lang: z.string(), text: z.string() }),
  P6: z.strictObject({ source: z.string(), backTranslation: z.string(), critical: z.boolean() }),
  // P7 (U2): a worker's written explanation, translated into Norwegian for the foreman to judge.
  // The worker's text only: no name field exists, and the model is not told what the right answer is.
  P7: z.strictObject({
    lang: z.string(),
    items: z.array(z.strictObject({ key: z.enum(['hazard', 'measure']), text: z.string().max(500) })).min(1).max(2),
  }),
} satisfies Record<Task, z.ZodType>;

export type P1Input = z.infer<typeof inputSchemas.P1>;
export type P2Input = z.infer<typeof inputSchemas.P2>;
export type P3Input = z.infer<typeof inputSchemas.P3>;
export type P4Input = z.infer<typeof inputSchemas.P4>;
export type P5Input = z.infer<typeof inputSchemas.P5>;
export type P6Input = z.infer<typeof inputSchemas.P6>;
export type P7Input = z.infer<typeof inputSchemas.P7>;

// ---------- Model task outputs ----------

const sameOrDifferent = z.enum(['same', 'different']);

export const outputSchemas = {
  P1: z.object({
    specifics: z.array(z.object({ text: z.string().min(1), status: z.enum(['clear', 'unclear']) })),
    questions: z.array(z.object({ question: z.string().min(1), options: z.array(z.string()).max(4).default([]) })).max(3),
  }),
  P2: z.object({
    operations: z.array(
      z.object({
        op: z.enum(['keep', 'fill_parameter', 'modify', 'add', 'remove']),
        lineId: z.string().optional(),
        text: z.string().optional(),
        section: section.optional(),
        afterLineId: z.string().optional(),
        hazardRef: z.string().nullable().optional(),
        critical: z.boolean().optional(),
      }),
    ),
  }),
  P3: z.object({
    lines: z.array(
      z.object({
        lineId: z.string(),
        status: z.enum(['clear', 'ambiguous']),
        category: z.enum(['undefined_condition', 'missing_quantity', 'unclear_actor', 'pronoun', 'idiom']).optional(),
        reasonNb: z.string().optional(),
        reasonEn: z.string().optional(),
        suggestion: z.string().optional(),
        plain: z.string().optional(), // F-22: optional shorter wording
      }),
    ),
  }),
  P4: z.object({
    text: z.string().min(1),
    termsUsed: z.array(z.string()).default([]),
    missingConcepts: z.array(z.string()).default([]),
  }),
  P5: z.object({ text: z.string().min(1) }),
  P6: z.object({
    checks: z.object({
      negation: sameOrDifferent,
      obligation: sameOrDifferent,
      numbers: sameOrDifferent,
      direction: sameOrDifferent,
      condition: sameOrDifferent,
      omission: sameOrDifferent,
      addition: sameOrDifferent,
      object: sameOrDifferent,
    }),
    category: z.enum(['NONE', 'MEANING_SHIFT', 'OMISSION_ADDITION']),
    explanationNb: z.string(),
    explanationEn: z.string(),
  }),
  P7: z.object({
    items: z.array(
      z.object({
        key: z.enum(['hazard', 'measure']),
        textNb: z.string(),
        // True when the text cannot be translated: empty, not in the stated language, or unreadable. Not a judgement of the content.
        unreadable: z.boolean().default(false),
      }),
    ),
  }),
} satisfies Record<Task, z.ZodType>;

export type P1Output = z.infer<typeof outputSchemas.P1>;
export type P2Output = z.infer<typeof outputSchemas.P2>;
export type P3Output = z.infer<typeof outputSchemas.P3>;
export type P4Output = z.infer<typeof outputSchemas.P4>;
export type P5Output = z.infer<typeof outputSchemas.P5>;
export type P6Output = z.infer<typeof outputSchemas.P6>;
export type P7Output = z.infer<typeof outputSchemas.P7>;

export const TASKS: Task[] = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
