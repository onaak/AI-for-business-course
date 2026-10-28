// Shared data model. Follows implementation_plan.md section 6, with the small
// additions listed in ASSUMPTIONS.md (parameter defaults, per-language check state).

export type Lang = 'nb' | 'en' | 'pl' | 'lt' | 'ru';
/** A crew language. May be a code outside Lang, which D4 then reports as unsupported. */
export type CrewLang = string;

export type Role = 'language' | 'technical';

export interface KeyState {
  given: boolean;
  role?: Role;
  outsideGroup?: boolean;
  date?: string;
}

export type VerificationState = 'draft' | 'languageChecked' | 'technicallyChecked' | 'verified';

export interface DataPack {
  version: number; // raised by hand when a revision is complete (SC-10)
  hash: string; // content hash, stored in every run
  /** Hash of the seed data last merged into this working pack (new templates, languages, fields). */
  seedHash?: string;
  languages: Lang[]; // supported target languages = listed here (SC-03)
  glossary: GlossaryTerm[];
  templates: Template[];
}

export interface GlossaryLangEntry {
  approved: string;
  /** All must appear in the line (SC-07). "a|b" means either alternative. Matched at word start. */
  stems: string[];
  /** Known wrong terms, as stems. */
  forbidden: string[];
  keyLanguage: KeyState;
}

export interface GlossaryTerm {
  termId: string;
  conceptEn: string;
  definition: string;
  critical: boolean;
  /** Matched as substrings so compounds are found. A leading "=" means whole word only. */
  nbForms: string[];
  byLang: Partial<Record<Lang, GlossaryLangEntry>>;
  keyTechnical: KeyState;
}

export type LangText = Partial<Record<Lang, string>>;

export type Parameter =
  | { key: string; label: LangText; type: 'number'; unitSymbol: string; min: number; max: number; default: number }
  | { key: string; label: LangText; type: 'choice'; options: { key: string; label: LangText }[]; default: string };

export type Section = 'steps' | 'hazards' | 'controls' | 'ppe' | 'stop' | 'emergency';
export const SECTIONS: Section[] = ['steps', 'hazards', 'controls', 'ppe', 'stop', 'emergency'];

/** Classification for the rules library (B1). A line can carry several. */
export type Tag = 'height' | 'lifting' | 'painting' | 'chemicals' | 'dust' | 'noise' | 'vibration' | 'fire' | 'concrete' | 'electrical' | 'ppe' | 'emergency';
export const TAGS: Tag[] = ['height', 'lifting', 'painting', 'chemicals', 'concrete', 'dust', 'noise', 'vibration', 'fire', 'electrical', 'ppe', 'emergency'];
/** Green: low, yellow: moderate, red: high risk, as the interviewed firm grades risk (B2). */
export type RiskLevel = 'green' | 'yellow' | 'red';
/** GHS hazard pictograms (CLP). Language-independent, shown to workers next to product lines (K3). */
export type Ghs = 'GHS01' | 'GHS02' | 'GHS03' | 'GHS04' | 'GHS05' | 'GHS06' | 'GHS07' | 'GHS08' | 'GHS09';

export interface TemplateLine {
  lineId: string;
  section: Section;
  textNb: string; // parameters only after a colon (SC-05)
  parameterRefs: string[];
  dependsOnParameters: string[]; // drives TECH_RECHECK
  critical: boolean;
  sourceRef: string | null; // hazard-list id; null shows as "unsourced"
  termIds: string[];
  keyTechnical: KeyState;
  translations: Partial<Record<Lang, { text: string; keyLanguage: KeyState }>>;
  tags?: Tag[];
  riskLevel?: RiskLevel;
  /** Pictograms shown next to the line (product lines). */
  ghs?: Ghs[];
  /** The line is in the SJA only when the foreman picked this product (K1). */
  onlyWithProduct?: string;
}

/**
 * A product used in today's job (K1). SYNTHETIC examples in the prototype: the names are
 * invented, the hazard classes are typical of the product type. Not a real product's data sheet.
 */
export interface Product {
  productId: string;
  name: LangText;
  ghs: Ghs[];
  /** H-statements (CLP), as codes. */
  hCodes: string[];
  /** Where the lines come from: "Sikkerhetsdatablad, eksempel, revisjon …". */
  sdsNote: string;
}

export interface Question {
  questionId: string;
  linkedLineIds: string[];
  critical: boolean;
  byLang: Partial<Record<Lang, { text: string; options: string[]; keyLanguage: KeyState }>>;
  correctIndex: number;
  keyTechnical: KeyState;
}

export interface Template {
  templateId: string;
  jobType: LangText;
  parameters: Parameter[];
  lines: TemplateLine[];
  questions: Question[];
  products?: Product[];
  /** Questions for the stand-alone set (test 5). Default: the first four. */
  standaloneQuestionIds?: string[];
}

export interface HazardSource {
  sourceId: string;
  title: string;
  publisher: string;
  url: string;
}

export interface HazardEntry {
  hazardId: string;
  section: Section;
  textNb: string;
  critical: boolean;
  sourceId: string;
  sourceDetail: string;
  /** Paragraph-level reference (Q1), e.g. "§ 17-1". Absent for firm practice. */
  paragraph?: string;
  /** Link to the paragraph or section. */
  url?: string;
  tags?: Tag[];
  riskLevel?: RiskLevel;
}

export interface HazardList {
  templateId: string;
  note: string;
  /** When the references were last read against the source. */
  checkedAt?: string;
  sources: HazardSource[];
  entries: HazardEntry[];
}

export type Origin = 'reused' | 'parameterFilled' | 'changed' | 'new' | 'removed';

export type FlagType =
  | 'GLOSSARY_MISMATCH'
  | 'FORBIDDEN_TERM'
  | 'TERM_NOT_IN_GLOSSARY'
  | 'NUMBER_UNIT_MISMATCH'
  | 'MEANING_SHIFT'
  | 'OMISSION_ADDITION'
  | 'SOURCE_AMBIGUOUS'
  | 'UNSUPPORTED_LANGUAGE'
  | 'AI_ADDED_CONTENT'
  | 'CRITICAL_LINE_REMOVED'
  | 'TECH_RECHECK';

export type Severity = 'red' | 'amber' | 'marker';
export type Layer = 'D1' | 'D2' | 'D3' | 'D4' | 'P3' | 'P4' | 'P6';
export type Route = 'approvedTerm' | 'rewrite' | 'reviewer' | 'oral' | 'acknowledged';

export interface Flag {
  flagId: string;
  lineId: string; // '*' for a flag on the whole SJA in one language
  lang: CrewLang | 'nb';
  type: FlagType;
  severity: Severity;
  raisedBy: Layer; // SC-16
  explanation: { nb: string; en: string };
  evidence: {
    source?: string;
    target?: string;
    backTranslation?: string;
    expected?: string;
    found?: string;
    suggestion?: string;
  };
  status: 'open' | 'resolved';
  route?: Route;
  resolvedBy?: 'foreman' | 'reviewer' | 'system';
  resolvedAt?: string;
  reason?: string;
  autoAttempts: number; // approved-term route disabled at 2
  reviewerVerdict?: { kind: 'confirmed' | 'falseAlarm'; reason: string };
  termId?: string;
}

/** 'memory': a changed or new line whose exact Norwegian text is already verified elsewhere (L1). */
export type TargetSource = 'verifiedReuse' | 'draftReuse' | 'machineNew' | 'reviewerCorrected' | 'memory';
export type CheckState = 'reused' | 'pending' | 'checked' | 'error' | 'blocked';

export interface SjaLineLang {
  text: string;
  source: TargetSource;
  /** Verification state copied from the template at the moment of reuse. */
  verification: VerificationState;
  oralFallback: boolean;
  flags: Flag[];
  checkState: CheckState;
  /** The Norwegian text this target was produced and checked from. */
  checkedSource?: string;
  backTranslation?: string;
  error?: string;
  missingConcepts?: string[];
}

export interface SjaLine {
  lineId: string;
  templateLineId: string | null;
  section: Section;
  origin: Origin;
  textNb: string;
  /** Text of the template line with parameters filled in (null for new lines). */
  baselineNb: string | null;
  critical: boolean;
  addedBy: 'template' | 'ai' | 'foreman';
  hazardRef: string | null;
  techRecheck: 'none' | 'open' | 'confirmed';
  aiSuggestion: 'none' | 'open' | 'accepted';
  /** Norwegian text that last passed through the ambiguity check (P3). */
  ambiguityCheckedNb?: string;
  plainSuggestion?: string; // F-22
  removalReason?: string;
  flags: Flag[]; // flags on the Norwegian source (lang 'nb')
  byLang: Record<string, SjaLineLang>;
}

export interface Specific {
  text: string;
  status: 'clear' | 'unclear';
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: string[];
  answer?: string;
}

export type SjaStatus =
  | 'draft'
  | 'contentConfirmed'
  | 'flagsOpen'
  | 'readyToSign'
  | 'signed'
  | 'signedWithFallback'
  | 'escalated';

/**
 * The understanding check (brief v3, step 4): each worker explains the key hazard and
 * the safety measure in their own words (teach-back) and answers one "what do you do
 * if …" question. Counts only: no names, no per-person results.
 */
export interface UnderstandingResult {
  required: boolean;
  reason: string[];
  /** One pre-approved scenario question. */
  questionIds: string[];
  /** The lines a correct explanation should cover: today's key hazard and measure. */
  keyLineIds: string[];
  /** Workers checked. */
  respondents: number;
  /** Teach-back: one outcome per worker checked. */
  teachBack: { ok: number; rebriefed: number };
  /** Points a worker got wrong in the teach-back, as counts per line. */
  misunderstood: { lineId: string; count: number }[];
  perQuestion: { questionId: string; respondents: number; correctFirst: number; rebriefConfirmed: boolean }[];
  completed: boolean;
  /** What the recorded checks covered: the key lines with their Norwegian text, and the question. */
  basis?: string;
  /** True when the SJA changed after workers were checked, so the earlier checks were set aside. */
  recheck?: boolean;
  /** Only on runs signed before the v3 check: the earlier line-level teach-back, kept as recorded. */
  legacyTeachBack?: { lineId: string; outcome: string }[];
  /** How the workers were checked (U1): talk with the foreman, written answers, or multiple choice only. Counts. */
  paths?: Record<CheckPath, number>;
  /** Why the conversation was not possible, as counts (U1). */
  fallbackReasons?: Record<string, number>;
}

/**
 * U1 (decided 26 Oct 2026): conversation first. If it is not possible, the worker writes the
 * explanation in his own language, the model translates it, and the foreman judges it; this
 * may end in "signed". Multiple choice alone is the last resort and ends in "signed with fallback".
 */
export type CheckPath = 'conversation' | 'written' | 'questionsOnly';
export const CHECK_PATHS: CheckPath[] = ['conversation', 'written', 'questionsOnly'];
export const FALLBACK_REASONS = ['noCommonLanguage', 'lateArrival', 'other'] as const;
export type FallbackReason = (typeof FALLBACK_REASONS)[number];

/** What the foreman saw when the job started (brief v3, step 4). An empty list means nothing was misunderstood. */
export interface StartObservation {
  at: string;
  /** Lines that were misunderstood. */
  lineIds: string[];
  /** Lines that were understood but not followed, e.g. protective equipment taken off (I4). */
  notFollowed?: string[];
}

export interface Sja {
  sjaId: string;
  templateId: string;
  packVersion: number;
  packHash: string;
  createdAt: string;
  testId?: string;
  fixtureId?: string;
  /** Made in the clean view: nothing from it is fed back into the templates (no promotion, no misunderstanding counts). */
  cleanView?: boolean;
  header: { siteLabel: string; date: string; foremanRole: string }; // local only (D6)
  parameterValues: Record<string, number | string>;
  freeText: string;
  specifics: Specific[];
  questions: ClarifyingQuestion[];
  questionsAsked: number;
  specificsConfirmed: boolean;
  languages: CrewLang[];
  crewFlags: { newWorker: boolean; firstTimeJobType: boolean };
  /** Products picked for today's job (K1). */
  products?: string[];
  lines: SjaLine[];
  sjaFlags: Flag[]; // flags on the whole SJA (unsupported language)
  contentConfirmed: boolean;
  languageCheckDone: boolean;
  understanding: UnderstandingResult;
  step: number; // 1..6
  status: SjaStatus;
  signoff?: { role: string; at: string };
  /** Recorded after sign-off, once the job has started. */
  observation?: StartObservation;
  versions: { prompts: Record<string, string>; models: Record<string, string>; mode: string; fixtureOrigins: string[] };
  assists: number;
}

export type TimeCategory =
  | 'input'
  | 'machine'
  | 'contentReview'
  | 'flagResolution'
  | 'understanding'
  | 'signoff'
  | 'reviewer';

/** Anonymous log: no names, no text content (PR-08). */
export interface LogEvent {
  eventId: string;
  runId: string;
  testId?: string;
  arm: 'flagship' | 'baseline';
  at: string;
  actor: 'foreman' | 'worker' | 'reviewer' | 'system' | 'ai' | 'observer';
  type: string;
  step?: string;
  timeCategory?: TimeCategory;
  durationMs?: number;
  lineId?: string;
  /** Set on misunderstanding events, so they can be fed back to the template. */
  templateId?: string;
  languagePair?: string;
  flagType?: FlagType;
  route?: string;
  packVersion: number;
  promptVersion?: string;
  modelId?: string;
  count?: number;
}

export type Task = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7';

/** Evidence store: synthetic content only. */
export interface ModelCall {
  callId: string;
  runId: string;
  task: Task;
  promptVersion: string;
  model: string;
  mode: 'live' | 'record' | 'replay';
  /** For replay: 'recorded' from a live model, or 'scripted' (written by the builder). */
  fixtureOrigin?: 'recorded' | 'scripted';
  input: unknown;
  rawOutput: string;
  parsed: unknown;
  durationMs: number;
  retries: number;
  /** Part of durationMs spent waiting after "too many requests" (free tiers). Absent when there was no wait. */
  rateLimitWaitMs?: number;
  at: string;
  error?: string;
}

/** One entry of the per-run trace (F-17). Content is synthetic. */
export interface TraceEntry {
  seq: number;
  at: string;
  kind: 'model' | 'rule' | 'human' | 'system';
  step: string;
  title: string;
  detail?: string;
  call?: ModelCall;
  data?: unknown;
}

export interface ModelClient {
  call<T = unknown>(task: Task, input: unknown, meta: { runId: string }): Promise<{ parsed: T; call: ModelCall }>;
}

export interface ReviewerSession {
  role: Role;
  lang: Lang;
  outsideGroup: boolean;
}

export interface RunRecord {
  runId: string;
  savedAt: string;
  banner: string;
  sja: Sja;
  templateJobType: LangText;
  events: LogEvent[];
  trace: TraceEntry[];
  timings: Record<TimeCategory, number>;
  metrics: { reuseRate: { reused: number; total: number } };
  judgements?: ReviewerJudgements;
  note?: string;
}

export interface ReviewerJudgements {
  /** key `${lineId}|${lang}|${termId}` → correct? (term accuracy, C2) */
  terms: Record<string, boolean>;
  /** key `${lineId}|${lang}` → a safety-critical error remains after review (C2, C3) */
  residual: Record<string, boolean>;
  /** key flagId → the foreman's route led to a correct outcome (C3) */
  routes: Record<string, boolean>;
  by?: { role: Role; lang: Lang; outsideGroup: boolean; date: string };
}

export const BANNER_EN = 'Student prototype. Synthetic content. Not a valid SJA. Do not use to plan or carry out real work.';
export const BANNER_NB =
  'Studentprototype. Syntetisk innhold. Ikke en gyldig SJA. Skal ikke brukes til å planlegge eller utføre reelt arbeid.';
