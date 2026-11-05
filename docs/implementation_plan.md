# SJA Forstått: Implementation Plan

| | |
|---|---|
| **Version** | 1.0 (5 October 2026) |
| **Status** | Plan only. No application code exists yet. |
| **Based on** | Course assignment PDF (v25082026b); Service Brief v2 (28 Sep 2026); instructor feedback; `SJA_Forstatt_Prototype_Specification.md` v1.0 |
| **Relation to the specification** | The specification says *what* the prototype must do. This plan says *how* to build it, and changes the specification in 16 places (section 2). Where the two differ, this plan wins. |

Identifiers such as F-07, D1, P4, T6, AC-10, CR-11 and TR-09 refer to the specification.

---

## 1. Analysis

### 1.1 What the prototype must demonstrate

One mechanism, end to end: a foreman adapts a reusable SJA template to today's job; AI translates only what changed and checks the translation; a person resolves every flag; workers show what they understood; the foreman signs.

It must produce evidence on six claims: reuse (C1), detection (C2), resolution by a foreman who cannot read the target language (C3), total time including checking (C4), understanding (C5) and repeatability (C6).

C2 is the riskiest claim and the cheapest to test, because it needs no foreman and no site visit. The build therefore starts with the check engine.

### 1.2 Mandatory features

Grouped into five modules. Everything in this table must work before anything in 1.3 is started.

| Module | Contains (specification features) | Why it is mandatory |
|---|---|---|
| **A. Data pack** | F-01 | Nothing runs without templates and a glossary. Shows true verification state (CR-18). |
| **B. Check engine and test bench** | F-07, F-14, F-13 (call log) | Tests C2. Unlocks T4, T6, T7. |
| **C. Foreman flow** | F-02, F-03, F-04, F-05, F-06, F-08, F-09, F-11, F-16 | The central mechanism (CR-01). Unlocks T1–T3. |
| **D. People in the loop** | F-10, F-12 | Understanding (TR-04) and what "verified" means (TR-03). Unlocks T5. |
| **E. Evidence** | F-13 (timing), F-15, F-17, F-18 | Appendix A and B, time counts (TR-09), presentation (CR-20). |

### 1.3 Secondary features

| Feature | Decision |
|---|---|
| F-19 Baseline timer | Build in milestone 4. Small, and T5 and T8 are weaker without it. |
| F-20 English output language | Build if the glossary's English column is complete. Costs no code, only data. |
| F-21 Third template | Data work only. After the first two have both keys in one language. |
| F-22 Plain-language suggestions | Build last. One extra field in the P3 output. |
| F-23 Audio | Moved to COULD (see SC-11). |
| F-24 Second translation | Dropped (see SC-11). |
| Voice input, own-phone worker link, new-job-type drafting | COULD. Not planned. |

### 1.4 Main user journeys

| # | Journey | Who | Tests |
|---|---|---|---|
| J1 | Reuse a template for today's job, through to a signed record | Foreman | T1, T2, T3 |
| J2 | Answer the understanding check on a shared device | Workers, foreman | T5 |
| J3 | Give a language or technical key; correct a line; judge a flag | Reviewers | T1, T6 |
| J4 | Run a fixture through the check engine and export the result | Group | T4, T6, T7 |
| J5 | Time the firm's current practice in the same categories | Observer | T5, T8 |
| J6 | Open a saved run and step through it without network | Group | Presentation |

### 1.5 Screens

Eight routes, down from the specification's twelve screens. Details in section 7.

### 1.6 Data required, and what can be mocked

| Data | Status | Note |
|---|---|---|
| SJA templates (2) | Mock content, written for the prototype | Hazard and control lines must cite a real public source, or show as "unsourced". |
| Glossary (about 40 terms, NO, EN, PL, LT) | Real terms, draft translations | From the prototype kit if it is shared; otherwise drafted and marked as draft. |
| Scenario questions (3 or more per template) | Mock | Need a native-speaker check before use with workers. |
| Job descriptions, seeded errors, clean controls, ambiguous lines | Mock by design | Seeded errors and controls must be confirmed by a native speaker before T6 counts. |
| Header fields (site, date, foreman role) | Mock | Never sent to a model. |
| The firm's job types and minutes per SJA today | Real | Collected in interviews. Kept outside the tool. |
| Timings, flags, routes, answers | Real measurements | The prototype's actual evidence. Never mocked. |
| Model responses | Real in tests. Recorded and replayed in the presentation and in automated tests. | Replay is labelled as replay on screen. |

### 1.7 Business logic required

Seven deterministic rules (D1–D7) and six model tasks (P1–P6), plus the two-key verification state and the metric calculations. Section 6 and section 9 list them with the changes from section 2.

### 1.8 Appropriate architecture

A browser application plus one small server process, run locally. The server exists for three reasons only: to keep the API key out of the browser, to keep the prompts in one place, and to write evidence files to disk. All rules live in a pure library with no interface and no network, so they can be tested without a model.

### 1.9 Prototype versus production

| Built | Not built, and why it is acceptable |
|---|---|
| Local, single device | No hosting, scaling or uptime. The group brings the device to the firm. |
| Role chosen from a menu | No accounts or permissions. No claim depends on them. |
| JSON files and browser storage | No database. Data volumes are a few hundred lines. |
| A recorded confirmation | No legally valid signature. |
| "Send to reviewer" changes a status | No real interpreter or reviewer workflow. A group member plays the reviewer. |
| A version number on the data pack and on each prompt | No version history browser. Git holds history. |
| Synthetic content with a "not a valid SJA" banner | No DPIA, no data agreement, no real site data. |

---

## 2. Challenges to the specification

The specification was reviewed again before planning. Sixteen changes follow. Three of them (SC-03, SC-04, SC-05) fix errors that would have broken the build.

| ID | Specification item | Problem | Change adopted in this plan |
|---|---|---|---|
| SC-01 | 16 MUST features, 12 screens, 28 acceptance criteria | Too large for a course prototype. The course says to build only enough to test the main claim. | Regrouped into five modules and eight routes. Library and reviewer queue become one screen. Home, Clarify and Sign-off become steps in one wizard. |
| SC-02 | One Review screen for both Norwegian content and language flags (7.2, 8.3) | The model would translate before the foreman has finished editing the Norwegian. Every edit then triggers new translation and checking. It also makes "content review" and "flag resolution" time impossible to separate. | Two steps. The foreman confirms the Norwegian first. Translation and checking start only after that. |
| SC-03 | D4: a language is supported only if "at least one reviewer is recorded" | **Logic error.** The seed data has no reviewers, so every language would be unsupported and nothing would run. | A language is supported if the data pack has a glossary column for it. Reviewers affect the verification state, not support. |
| SC-04 | 10.4: "any edit to a line removes both keys" | **Contradiction** with F-12, where a reviewer's correction is itself an approval. | Editing the Norwegian source clears the technical key and every language key. A correction by a language reviewer sets that language's key and leaves the technical key. An edit to a target text by anyone else clears that language's key. |
| SC-05 | F-06: parameter values are inserted into stored translations by code | **Fails for text values and for inflected languages.** A Norwegian equipment name pasted into a Lithuanian sentence is wrong, and even a translated name may need a different case ending. | Parameters are either a number with a unit symbol, or a choice from a fixed list whose labels are stored in every language. Template lines place a parameter after a colon ("Arbeidshøyde: {height} m"), never inside a sentence. Anything else goes in the free-text specifics and becomes a changed line. |
| SC-06 | D2: number **and unit** parity | Unit words change form across languages ("meter", "metrów", "metrų"). Reliable matching would need a unit dictionary per language. | Numbers must match exactly. Unit symbols (m, cm, kg, %) must match exactly. Unit words are not checked. Templates and the translation prompt use symbols only. |
| SC-07 | D1: a list of accepted inflected forms per term per language | Heavy data work: 40 terms, two languages, many case endings. | Each term stores one or more **stems** per language (a prefix of each word). A term matches when all its stems appear in the line. Stems are derived automatically on import and can be edited in the review screen. False flags are expected at first and are measured. |
| SC-08 | 10.6 rule 4 on low confidence | Hard to read and hard to implement. | One rule: any open flag, red or amber, on a safety-critical line blocks sign-off for that language. A critical line with no flag can be signed and is labelled "machine-checked". |
| SC-09 | F-17 trace panel and F-18 replay are SHOULD | With the server logging every model call, both are almost free. Replay is also what makes automated tests possible. | Both promoted to mandatory. |
| SC-10 | F-12: reviewer approval creates new template and glossary versions | A version-management feature inside a prototype. | One working data pack with a version number. The number is raised by a button when the group decides a revision is complete. Each run stores the pack version and a content hash. Git keeps history. |
| SC-11 | F-23 audio (SHOULD), F-24 second translation (SHOULD) | Browser voices for Lithuanian are rarely installed, so audio cannot be relied on in a test. A second translation doubles model calls for an unmeasured gain. | Audio moved to COULD. Second translation dropped. |
| SC-12 | T2: "signed in 10 minutes or less" | Unclear whether the understanding check is included. Passing a device round four workers can take ten minutes by itself. | The ten-minute criterion covers input, content review, flag resolution and sign-off. The understanding check is timed and reported separately, in both arms. |
| SC-13 | AC-02: a first-time user starts an SJA in under two minutes | A usability observation, not something a build can be checked against. | Removed from build acceptance. Recorded as an observation in T1. |
| SC-14 | F-13: seven time categories | The flow now has one step per category (SC-02), so timing is taken from step transitions. | No timers inside the foreman flow. Reviewer time runs from opening an item to deciding it. Idle time inflates this, so the observer can mark a pause. |
| SC-15 | Section 13: "web application", hosting left open | Hosting adds accounts, deployment and key handling for no gain in evidence. | Local first: the tool runs on a group laptop or tablet. Hosting is optional, after milestone 4. Phone-width layout is still required and tested. |
| SC-16 | T6 reports one catch count | It cannot show whether back-translation adds anything over a glossary lookup, which is the proposal's central technical claim. | Every flag records which layer raised it. The bench reports the catch count for rules alone and for rules plus back-translation. |

Unchanged and confirmed: the two-key model, the four flag routes, the rule that a foreman cannot dismiss a language flag, the tabletop design of T5, and the banner.

---

## 3. Technology stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript throughout | One language for interface, rules and server. Types catch data-shape errors, which are the most likely bugs here. |
| Interface | React with Vite | Fast to build and widely understood. No framework conventions to explain. |
| Styling | Tailwind CSS | Responsive layout without a design system. |
| Routing | React Router | Eight routes. |
| State | Zustand with browser-storage persistence | Small. Survives a page reload during a test. |
| Validation | Zod | One schema per data file and per model output. Invalid model output is caught, not rendered. |
| Server | Node 20 or newer with Express, one file plus the model gateway | Holds the key, the prompts and the evidence writer. |
| Model access | A provider-neutral gateway with adapters for Anthropic and for any OpenAI-compatible endpoint, plus a replay adapter | The group has not yet said which key it has. Model names are configuration, chosen at build time. |
| Tests | Vitest for rules and pipeline; one Playwright run of the happy path in replay mode | Rules are pure functions, so tests are cheap. |
| Data | JSON files in the repository | Open format, readable, diffable. |
| Export | Markdown and CSV for tables; print-friendly pages saved as PDF by the browser | No document library. |
| Version control | Git | History for prompts and data pack, which the course's revision requirement needs. |

**Rejected**

| Option | Why not |
|---|---|
| Spreadsheet plus chat tool (the proposal's kit) | A foreman cannot operate it, so time cannot be measured. |
| Streamlit | Quick to write, but weak on phone-width layout, kiosk mode and step timing. |
| Next.js or another full framework | More conventions than the prototype needs. Vite plus one server file is easier for every group member to explain. |
| A database | Nothing here needs queries or concurrency. |
| A published Claude artifact with built-in model access | Worth reconsidering only if no API key can be obtained (see unresolved question Q1). It would remove the server and the key, at the cost of one model family only. Its sharing limits would need checking first. |

---

## 4. Architecture

### 4.1 Layers

```
┌──────────────────────────── Browser ────────────────────────────┐
│  Screens (React)                                                │
│     Foreman wizard · Worker kiosk · Review · Bench · Runs       │
│                          │                                      │
│  State (Zustand): current SJA, data pack, event log             │
│                          │                                      │
│  Core library (pure TypeScript, no interface, no network)       │
│     rules D1–D7 · pipeline · flags · verification · metrics     │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP (local)
┌──────────────────────────┴──────────── Server ──────────────────┐
│  /api/llm      gateway: load prompt → call model → validate     │
│                → log call → return                              │
│                modes: live · record · replay                    │
│  /api/data     read seed data pack; write working data pack     │
│  /api/evidence write runs, call logs and exports to disk        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        prompts/   data/   evidence/   (plain files in the repo)
```

### 4.2 Processing pipeline

```
Foreman input
   └─► P1 normalise ─► [foreman confirms what was understood]
         └─► P2 adapt ─► D3 diff and markers ─► P3 ambiguity check
               └─► [foreman edits and confirms the Norwegian]
                     └─► for each changed line × each language, in parallel:
                           P4 translate
                             └─► D1 glossary ─► D2 numbers
                             └─► P5 back-translate (target text only)
                                   └─► P6 compare ─► flags
                     └─► [foreman picks a route for each flag]
                           └─► D7 ─► [understanding check, if required]
                                 └─► D5 gate ─► [foreman signs] ─► record
```

Square brackets are human decisions. Nothing after a bracket runs until the person has acted.

### 4.3 Architectural rules

1. **The core library never calls a model directly.** It receives a client object. Tests pass a fake one.
2. **Prompts are assembled on the server.** The browser sends a task name and data. This is how D6 is enforced: the server accepts only a fixed list of fields per task and rejects anything else. Header fields have no way in.
3. **P5 is built from the target text alone.** The server function for P5 has no parameter for the source.
4. **Every model call is logged** with task, prompt version, model, input, raw output, validated output, duration and mode. The trace panel and the replay adapter both read this log.
5. **Replay is keyed** by task, prompt version and a hash of the input. A replayed response is marked as such on screen and in the log.
6. **Deterministic flags cannot be removed by a model result.**
7. **No route leads from a model call to a signed state.**

### 4.4 Gateway modes

| Mode | Behaviour | Used for |
|---|---|---|
| `live` | Calls the model. Logs the call. | Tests with people. |
| `record` | As live, and stores the response as a replay fixture. | Preparing the presentation run and automated tests. |
| `replay` | Returns the stored response. Fails visibly if none exists. | Automated tests, presentation, development without a key. |

Results from replay mode are never reported as test results.

---

## 5. Project structure

```
(repository root = the "AI for business course" folder)
├─ docs/
│  └─ implementation_plan.md
├─ SJA_Forstatt_Prototype_Specification.md
├─ data/
│  ├─ seed/
│  │  ├─ glossary.json
│  │  ├─ templates/            work-at-height.json, lifting.json
│  │  └─ hazards/              one sourced hazard list per job type
│  ├─ fixtures/
│  │  ├─ job-descriptions.json
│  │  ├─ seeded-errors.pl.json, seeded-errors.lt.json
│  │  ├─ controls.pl.json, controls.lt.json
│  │  ├─ ambiguous-lines.json
│  │  └─ llm/                  recorded model responses for replay
│  └─ working/
│     └─ pack.json             seed plus reviewer edits, with version
├─ prompts/
│  ├─ P1_normalise.md … P6_compare.md     each with a version header
│  └─ CHANGELOG.md
├─ server/
│  ├─ index.ts                 Express app, three route groups
│  ├─ gateway.ts               modes, validation, retry, logging
│  ├─ providers/               anthropic.ts, openai-compatible.ts, replay.ts
│  └─ evidence.ts              file writers
├─ src/
│  ├─ core/                    pure library, shared with the server
│  │  ├─ types.ts, schemas.ts
│  │  ├─ rules/                glossary.ts (D1), numbers.ts (D2), diff.ts (D3),
│  │  │                        languages.ts (D4), gate.ts (D5),
│  │  │                        payload.ts (D6), understanding.ts (D7)
│  │  ├─ pipeline/             normalise.ts, adapt.ts, translate.ts, checkLine.ts
│  │  ├─ flags.ts, verification.ts, metrics.ts
│  ├─ state/                   sjaStore.ts, packStore.ts, logStore.ts
│  ├─ screens/                 one folder per route
│  ├─ components/
│  ├─ i18n/                    nb.ts, en.ts, pl.ts, lt.ts
│  └─ main.tsx
├─ evidence/
│  ├─ runs/                    one JSON file per run
│  ├─ calls/                   one line-delimited log per run
│  └─ exports/                 Appendix A rows, summaries
├─ tests/
│  ├─ unit/                    one file per rule
│  ├─ pipeline/                replay-mode tests
│  └─ e2e/                     happy path
├─ .env.example                provider, key, model names, mode
└─ package.json
```

`.env` is never committed. `evidence/` and `data/working/` are committed, because they are the course evidence.

---

## 6. Data model

The specification's structures (its section 10.2) apply, with these changes from section 2.

```ts
type Lang = 'nb' | 'en' | 'pl' | 'lt';
type KeyState = { given: boolean; role?: 'language' | 'technical';
                  outsideGroup?: boolean; date?: string };

interface DataPack {
  version: number;               // raised by hand when a revision is complete (SC-10)
  hash: string;                  // content hash, stored in every run
  languages: Lang[];             // supported = listed here (SC-03)
  glossary: GlossaryTerm[];
  templates: Template[];
}

interface GlossaryTerm {
  termId: string;
  conceptEn: string;
  definition: string;            // which object or action is meant
  critical: boolean;
  nbForms: string[];             // matched as substrings, so compounds are found
  byLang: Record<Lang, {
    approved: string;
    stems: string[];             // all must appear in the line (SC-07)
    forbidden: string[];         // known wrong terms, as stems
    keyLanguage: KeyState;
  }>;
  keyTechnical: KeyState;        // one per concept, not per language
}

type Parameter =
  | { key: string; label: Record<Lang, string>; type: 'number';
      unitSymbol: string; min: number; max: number }
  | { key: string; label: Record<Lang, string>; type: 'choice';
      options: { key: string; label: Record<Lang, string> }[] };   // SC-05

interface TemplateLine {
  lineId: string;
  section: 'steps' | 'hazards' | 'controls' | 'ppe' | 'stop' | 'emergency';
  textNb: string;                // parameters only after a colon (SC-05)
  parameterRefs: string[];
  dependsOnParameters: string[]; // drives TECH_RECHECK
  critical: boolean;
  sourceRef: string | null;      // null shows as "unsourced"
  termIds: string[];
  keyTechnical: KeyState;
  translations: Partial<Record<Lang, { text: string; keyLanguage: KeyState }>>;
}

interface Question {
  questionId: string;
  linkedLineIds: string[];
  critical: boolean;
  byLang: Partial<Record<Lang, { text: string; options: string[];
                                 keyLanguage: KeyState }>>;
  correctIndex: number;
}

interface Template {
  templateId: string; jobType: Record<Lang, string>;
  parameters: Parameter[]; lines: TemplateLine[]; questions: Question[];
}

type Origin = 'reused' | 'parameterFilled' | 'changed' | 'new' | 'removed';

interface SjaLine {
  lineId: string; origin: Origin; textNb: string; critical: boolean;
  techRecheck: 'none' | 'open' | 'confirmed';
  aiSuggestion: 'none' | 'open' | 'accepted';
  byLang: Partial<Record<Lang, {
    text: string;
    source: 'verifiedReuse' | 'draftReuse' | 'machineNew' | 'reviewerCorrected';
    oralFallback: boolean;
    flags: Flag[];
  }>>;
}

interface Flag {
  flagId: string; lineId: string; lang: Lang | 'nb';
  type: FlagType; severity: 'red' | 'amber' | 'marker';
  raisedBy: 'D1' | 'D2' | 'D3' | 'D4' | 'P3' | 'P4' | 'P6';      // SC-16
  explanation: { nb: string; en: string };
  evidence: { source?: string; target?: string; backTranslation?: string;
              expected?: string; found?: string };
  status: 'open' | 'resolved';
  route?: 'approvedTerm' | 'rewrite' | 'reviewer' | 'oral' | 'acknowledged';
  autoAttempts: number;          // route disabled at 2
  reviewerVerdict?: { kind: 'confirmed' | 'falseAlarm'; reason: string };
}

interface Sja {
  sjaId: string; templateId: string; packVersion: number; packHash: string;
  header: { siteLabel: string; date: string; foremanRole: string };  // local only
  parameterValues: Record<string, number | string>;
  specifics: string[];           // confirmed after P1
  languages: Lang[];
  crewFlags: { newWorker: boolean; firstTimeJobType: boolean };
  lines: SjaLine[];
  understanding: { required: boolean; reason: string;
                   perQuestion: { questionId: string; respondents: number;
                                  correctFirst: number; rebriefConfirmed: boolean }[];
                   teachBack: { lineId: string; outcome: 'ok' | 'rebriefed' }[] };
  status: 'draft' | 'contentConfirmed' | 'flagsOpen' | 'readyToSign'
        | 'signed' | 'signedWithFallback' | 'escalated';
  signoff?: { role: string; at: string };
  versions: { prompts: Record<string, string>; models: Record<string, string> };
}

interface LogEvent {             // anonymous: no names, no text content
  eventId: string; runId: string; testId?: string;
  arm: 'flagship' | 'baseline';
  at: string; actor: 'foreman' | 'worker' | 'reviewer' | 'system' | 'ai' | 'observer';
  type: string; step?: string; durationMs?: number;
  lineId?: string; languagePair?: string; flagType?: FlagType; route?: string;
  packVersion: number; promptVersion?: string; modelId?: string;
}

interface ModelCall {            // evidence store: synthetic content only
  callId: string; runId: string; task: 'P1'|'P2'|'P3'|'P4'|'P5'|'P6';
  promptVersion: string; model: string; mode: 'live' | 'record' | 'replay';
  input: unknown; rawOutput: string; parsed: unknown;
  durationMs: number; retries: number; at: string;
}
```

**Verification state** is derived, never stored: *Verified* when both keys are given, *Language-checked* or *Technically checked* when one is, *Draft* otherwise. Key changes follow SC-04.

---

## 7. Screens and components

### 7.1 Routes

| Route | Screen | Replaces (specification screens) | Milestone |
|---|---|---|---|
| `/` | Home: role tiles, banner, language toggle | 1 | 0 |
| `/foreman/:sjaId` | Foreman wizard, six steps (7.2) | 2, 3, 4, 5, 6, 8 | 2 |
| `/worker/:sjaId` and `/worker/questions/:templateId` | Worker kiosk; standalone question mode | 7 | 3 |
| `/review` | Library and review: templates, glossary, questions, flagged lines; role selector | 10, 11 | 0 (read-only), 3 (keys) |
| `/bench` | Test bench: fixtures, pair check, results, Appendix A export | 12 | 1 |
| `/runs` | List of saved runs; replay | new | 4 |
| `/runs/:runId` | Record, trace panel, export | 9 | 2 (record), 4 (trace) |
| `/baseline` | Baseline timer | F-19 | 4 |

### 7.2 Foreman wizard steps

| Step | Shows | Foreman does | Time category |
|---|---|---|---|
| 1. Job | Job type, parameters, crew languages, two tick-boxes, free-text specifics with the no-names notice | Fills in, continues | Input |
| 2. Understood | What P1 extracted; up to three clarifying questions | Answers, confirms | Input |
| 3. Content | Norwegian SJA by section; origin badges; summary bar; ambiguity flags; AI suggestions; technical re-check markers | Edits, accepts or deletes suggestions, confirms markers, confirms content | Content review |
| 4. Language check | Progress while the machine works; then flag cards, red first | Picks a route per flag | Flag resolution (machine time logged separately) |
| 5. Understanding | Whether required and why; start kiosk; counts per question; re-brief and teach-back confirmations | Runs the check, re-briefs, confirms | Understanding check |
| 6. Sign | Gate checklist with open conditions; statement; sign button | Signs; opens record | Sign-off |

Step 5 is skipped with a logged reason when D7 says it is not required.

### 7.3 Components

`Banner` · `LangToggle` · `StepIndicator` · `SummaryBar` · `LineRow` (origin badge, verification chip, edit) · `FlagCard` (explanation, evidence with highlighted difference, route buttons) · `GateChecklist` · `QuestionCard` · `KioskFrame` (next worker, respondent count) · `KeyChip` and `KeyDialog` · `PairCheckTable` · `TracePanel` · `StepTimer` (invisible; emits events on step change) · `AssistButton` (small corner control for the observer) · `ExportMenu`.

### 7.4 Interface rules

- Foreman interface in Norwegian with an English toggle. Worker interface in the worker's language only.
- Usable at 375 px wide. Tap targets at least 44 px. Worker body text at least 18 px.
- A flag is never only colour and never only foreign text.
- All strings in `src/i18n/`, one file per language, so a native speaker can check them in one pass.

---

## 8. User flows

**J1 Foreman, reuse (happy path)**
1. Home → Foreman → step 1: picks "Lifting", sets three parameters, ticks Polish and Lithuanian, types two sentences.
2. Step 2: confirms what was understood.
3. Step 3: sees most lines reused, three changed. Confirms two technical re-check markers. Confirms content.
4. Step 4: waits about half a minute. One red glossary flag in Lithuanian. Chooses "Use the approved term". Re-check is clean.
5. Step 5: required because a critical line changed. Passes the tablet round. One question missed by two respondents. Re-briefs, confirms teach-back.
6. Step 6: gate is clear. Signs. Opens and exports the record.

**J1 alternatives**

| Situation | Flow |
|---|---|
| Unclear or slang input | Step 2 asks. The flow does not continue on a guess. |
| Ambiguous critical line | Step 3 blocks "confirm content" until the line is reworded. |
| Unsupported language | Step 4 produces no worker text for it. Record says "interpreter required". |
| Flag survives two automatic attempts | "Use the approved term" is disabled. Rewrite, reviewer or oral remain. |
| Reviewer not available | "Brief this line orally". Sign-off gives `signedWithFallback`. |
| Rewrite route chosen | That one line returns to step 3 logic: ambiguity check, then translation and check in all languages. |
| Model call fails | One retry, then an error on that line with a retry button. The line stays unchecked and blocking. |

**J2 Worker (kiosk):** language → SJA text → three scenario questions → either "done, pass the device on" or "talk to your foreman about this point". No name asked.

**J3 Reviewer:** `/review` → states role, language, inside or outside the group → works through items → approve, correct, mark false alarm, or reject.

**J4 Bench:** pick test and fixture → run → expected and observed side by side, catch count by layer → type the observed result and the learning → export.

**J5 Baseline:** pick arm and test → tap the category being timed → stop → saved to the same log.

**J6 Replay:** `/runs` → pick a saved run → step through with the trace panel open.

---

## 9. Functionality to implement

| Area | Function | Specification reference | Change |
|---|---|---|---|
| Data | Load and validate the data pack; show library with derived verification state | F-01 | SC-03, SC-10 |
| Data | Save reviewer edits to the working pack; raise version on demand | F-12, PR-13 | SC-10 |
| Rules | D1 glossary check by stems; forbidden stems | F-07 | SC-07 |
| Rules | D2 number and unit-symbol parity; decimal comma equals point | F-07 | SC-06 |
| Rules | D3 apply operations, compute origin by text comparison, set markers | F-04, F-09 | SC-05 |
| Rules | D4 supported-language check | F-07 | SC-03 |
| Rules | D5 sign-off gate | F-11 | SC-08 |
| Rules | D6 field allow-list per model task, enforced on the server | F-16 | none |
| Rules | D7 understanding-check trigger | F-10 | none |
| Model | Gateway with live, record and replay modes; validation; one retry; call log | section 13, F-13 | SC-09 |
| Model | P1–P6 prompt files with version headers | 11.2 | P3 also returns an optional shorter wording (F-22) |
| Pipeline | `checkLine(source, target, lang)` usable alone | F-07 | SC-16 |
| Pipeline | Translate changed lines only, in parallel | F-06 | SC-02 |
| Flags | Taxonomy, severity, allowed routes per type, two-attempt limit | F-08, 10.5 | SC-08 |
| Verification | Key logic and derived states | 10.4 | SC-04 |
| Understanding | Kiosk, scenario questions, teach-back, re-brief loop, standalone mode | F-10 | none |
| Record | Traceable record with banner; print layout | F-11 | none |
| Timing | Step-transition timing; reviewer item timing; assist counter | F-13 | SC-14 |
| Metrics | Reuse rate, catch count by layer, false-flag count, term accuracy, time per SJA, answers correct, assists | 10.7 | SC-16 |
| Evidence | Run files, call logs, Appendix A export, AI-use summary, verification summary | F-15 | none |
| Evidence | Trace panel; replay of saved runs | F-17, F-18 | SC-09 |
| Baseline | Category timer for the non-AI arm | F-19 | none |

---

## 10. Mocked data requirements

Writing and checking this content is the largest piece of work in the project, and it is not coding. It starts on day one, in parallel with milestone 0.

| Item | Amount | Written by | Must be checked by | Needed by |
|---|---|---|---|---|
| Hazard and control list per job type, each line with a public source reference | 2 job types | Group, from Arbeidstilsynet and EBA public guidance | Technical reviewer | M2 |
| Norwegian templates: about 20–25 lines each, 3–5 parameters, critical lines marked, parameters after a colon | 2 | Drafted by the builder from the hazard list | Technical reviewer; a Norwegian speaker for wording | M2 |
| Template translations into Polish and Lithuanian | 2 × 2 | Machine, through the tool's own pipeline | Language reviewer per language | M3 |
| Glossary: definition, critical mark, Norwegian forms, approved term, stems, forbidden stems | About 40 terms | Kit if shared; otherwise drafted | Language reviewer per language; technical reviewer for concepts | M1 |
| Scenario questions with plausible wrong options | At least 3 per template, ideally 5 | Group | Language reviewer; one trial with an outsider for clarity | M3 |
| Job descriptions, including one in mixed slang with typos | 8 | Kit or builder | A Norwegian speaker, for realism | M2 |
| Seeded mistranslations, at least 4 that are not glossary errors | 10 per language | Kit plus builder | **Native speaker must confirm each is wrong** | M1 |
| Clean control translations | At least 10 per language | Builder | **Native speaker must confirm each is right** | M1 |
| Ambiguous Norwegian lines | At least 2 | Specification gives two | Technical reviewer | M1 |
| Interface strings | Norwegian, English; worker strings in Polish, Lithuanian | Builder | One native speaker per language | M2, M3 |
| Recorded model responses for one happy-path run | 1 run | Recorded from a live run | n/a | M4 |

Until a native speaker has confirmed the seeded errors and controls, T6 results are labelled "unconfirmed fixtures". Until both keys exist, nothing is labelled verified.

---

## 11. Implementation order

Each milestone ends with something that can be shown and with named acceptance criteria passing.

| Milestone | Build | Exit condition | Tests unlocked | Size |
|---|---|---|---|---|
| **M0 Skeleton** | Repository, types, schemas, data pack loader, read-only library, banner, language toggle, gateway with replay adapter and call log | `npm run dev` shows the library with every target line as "Draft". Schema tests pass. AC-01, AC-26. | none | Small |
| **M1 Check engine and bench** | D1, D2, D4; P5, P6; `checkLine`; pair-check table; fixtures; catch and false-flag counts by layer; live provider adapter | T6 fixture runs live and gives counts per language and per layer. AC-09, AC-10, AC-23. **First measurement of machine time per line.** | T4, T6, T7 (desk) | Medium |
| **M2 Foreman flow** | Wizard steps 1–4 and 6; P1–P4; D3, D5, D6; flag cards and routes; record; step timing; event log | A synthetic job goes from input to a signed record without developer help. AC-03 to AC-08, AC-11 to AC-13, AC-18, AC-19, AC-22, AC-27, AC-28. | T1, T2, T3 | Large |
| **M3 People in the loop** | Worker kiosk, standalone questions, teach-back, re-brief loop, D7; review screen with keys, corrections, false-alarm verdicts | A reviewer can take a line from Draft to Verified. A wrong kiosk answer blocks sign-off until re-brief. AC-14 to AC-17, AC-20, AC-21. | T5, T8 | Medium |
| **M4 Evidence and presentation** | Exports, trace panel, runs list and replay, baseline timer, one recorded happy-path run, Playwright happy path | Appendix A export has the six required columns. A saved run replays with the network off. AC-24, AC-25. | Presentation | Medium |
| **M5 Test rounds** | No new features. Round 1 of T1–T8, at least one revision with a version raise, round 2 of the affected tests. | Both rounds in the log with versions. | CR-11, CR-12 | Group activity |

**Stop rules**

- If the deadline is close after M1: stop building. Run T4, T6 and T7, have a group member operate the engine for T1 and T2, and state that foreman time was not measured.
- If machine time in M1 exceeds about one minute for five lines in two languages: fix that before M2 (batching, a faster model, fewer comparison calls). The ten-minute criterion depends on it.
- No COULD item is started before M5 round 1 is complete.

---

## 12. Testing approach

| Level | What | How | When |
|---|---|---|---|
| 1. Rule tests | D1–D7, verification logic, metrics | Vitest, table-driven. Includes Polish and Lithuanian inflection cases, decimal comma, byte-identical reuse, the gate, and a test that no header field can appear in a model payload (AC-03). | With each rule, M0–M2 |
| 2. Contract tests | Every prompt's output against its schema | Replay fixtures validated by Zod. A malformed fixture proves the retry-then-error path (AC-28). | M1, M2 |
| 3. Pipeline tests | Whole flows without a model | Replay mode. Assert: translate calls equal changed lines times languages (AC-08); the P5 payload contains no source text (AC-10); a critical flag blocks the gate. | M2 |
| 4. Happy-path browser test | J1 from Home to record | Playwright in replay mode, at 375 px width. | M4 |
| 5. Prompt evaluation | Does the check engine catch errors | The T6 bench, live. Run before and after every prompt or glossary change. Results are stored per version, which gives the revision evidence for CR-12 at no extra cost. | From M1, repeatedly |
| 6. Acceptance walkthrough | The specification's acceptance criteria, minus AC-02 | A person works through the list at each milestone exit. | Each milestone |
| 7. Course tests | T1–T8 with real people | The protocol in the specification's section 12, with an observer and the assist counter. Observed results typed by a person. | M5 |

Levels 1–4 show the software does what the plan says. Only levels 5 and 7 are evidence for the report.

---

## 13. Course-requirement traceability

| Requirement | Where it is built | Milestone | Evidence it produces |
|---|---|---|---|
| CR-01 Central mechanism | Foreman wizard, pipeline | M2 | Signed record of T1 and T2 |
| CR-02 Meaningful AI role | P1–P6 | M1, M2 | Prompt files |
| CR-03 Full chain | Call log, trace panel | M1, M4 | Trace of one run |
| CR-04 Working prototype on existing tools | Whole stack | M2 | Running tool |
| CR-05 Human review, escalation, accountable decision | Flag routes, review screen, gate | M2, M3 | Record: routes and resolver roles |
| CR-06 Failure modes handled | Flag taxonomy, retry-then-error, oral route | M1, M2 | T3, T4, T6, T7 rows |
| CR-07 Data described | Data pack, section 10 | M0 | Data table for the report |
| CR-08 AI capability named | Prompt headers | M1 | Prompt files |
| CR-09 Non-AI comparison | Standalone questions, baseline timer | M3, M4 | T5 and T8 rows, both arms |
| CR-10 Measurable criteria | `metrics.ts`, bench | M1 | Counts with denominators |
| CR-11 Five or more structured tests | Bench and fixtures | M1–M5 | Appendix A export |
| CR-12 One documented revision | Version numbers on pack and prompts | M5 | Two bench results, two versions |
| CR-13, TR-06 Outside perspective on the outputs | Reviewer "outside the group" mark | M3 | Verification summary |
| CR-14 Appendix A format | Export | M4 | Six-column table |
| CR-15 Appendix B content | Prompt files, call log | M4 | AI-use summary: models, versions, dates |
| CR-16 Evidence without a link | Files in `evidence/`, replay | M4 | Self-contained run files |
| CR-17 No personal data in AI tools | Server allow-list, no name fields | M2 | Payload test; call log |
| CR-18 No fabrication | Derived verification state; typed observed results; replay marked | M0, M4 | "Draft" labels in screenshots |
| CR-19 Everyone can explain it | Small stack, pure rules, English toggle, trace | M0–M4 | Trace walkthrough |
| CR-20 Presentation | Recorded run, replay | M4 | Replay with network off |
| CR-21 No chatbot as source | `sourceRef` per line; "unsourced" label | M0, M2 | Template files |
| CR-22 Measures for the authority | Metrics in the pilot's units | M1 | Bench output |
| TR-01, TR-09 Time including checking | Step timing, reviewer timing | M2, M3 | Time by category |
| TR-02 Repeatable way of working | Assist counter | M2 | T1 against T2 |
| TR-03 What "verified" means | Two keys, review screen | M3 | Verification summary |
| TR-04 Understanding beyond a quiz | Scenario questions, teach-back, re-brief | M3 | T5 |
| TR-05 Manageable scope | Two templates, two languages | M0 | Data pack |
| TR-07 Ambiguous instruction, bad translation | P3, seeded fixtures | M1, M2 | T6, T7 |
| TR-08 Compare with templates and human translation | Baseline timer | M4 | T8 |
| TR-10 No broadening | Scope in 1.2 and 1.3 | all | n/a |

---

## 14. Decisions, open questions, assumptions and risks

### Decisions made

1. TypeScript, React with Vite, one small Express server, JSON files. No database, no accounts, no hosting.
2. Local first: the tool runs on a group laptop or tablet that is taken to the firm.
3. Model access through a provider-neutral gateway with live, record and replay modes. Model names are configuration.
4. All rules in a pure library, tested without a model.
5. The foreman confirms the Norwegian before anything is translated (SC-02).
6. Parameters are numbers or fixed choices, placed after a colon (SC-05).
7. Glossary matching by stems; number matching by digits and unit symbols (SC-06, SC-07).
8. Trace panel and replay are mandatory; audio and second translation are not built (SC-09, SC-11).
9. The ten-minute criterion excludes the understanding check, which is reported separately (SC-12).
10. The bench reports what back-translation adds over rules alone (SC-16).
11. Check engine and bench are built first.

### Unresolved questions

| # | Question | Why it matters | Default if unanswered |
|---|---|---|---|
| Q1 | Which model API key can the group get, and is there a small budget? A chat subscription does not include API access. | Without a key only replay mode works, and replay is not evidence. | Build against the gateway with replay; add the provider adapter when the key exists. Full test use should cost little, likely a few US dollars, but this is an estimate. |
| Q2 | Can the prototype kit spreadsheet be shared? | It holds the glossary, job descriptions and seeded errors. | The builder drafts all seed data, marked as draft. |
| Q3 | Who are the reviewers: a Polish speaker, a Norwegian speaker, someone with trade or HSE competence? | Without them nothing can be called verified, and Norwegian screens go unchecked. | Polish stays "Draft"; verified claims are made for Lithuanian only. |
| Q4 | What are the firm's job types, crew languages and visit dates? | They set the two templates and the deadline for M2 and M3. | Work at height and lifting; Polish and Lithuanian. |
| Q5 | What is the submission date, and how many build sessions are available? | Decides how far past M1 to go. | Follow the stop rules in section 11. |
| Q6 | Does every group member's computer have Node 20 or newer, and is internet available at the firm? | Local running and live model calls. | One prepared laptop with a phone hotspot. |

### Assumptions

1. The group, or an AI agent working for it, can build and run a TypeScript project.
2. The specification's assumptions still hold, in particular A-06 (a Lithuanian speaker in the group), A-12 (two visits to one firm) and A-15 (an unflagged machine-checked line may be signed).
3. A general multilingual model handles Norwegian, Polish and Lithuanian well enough for short safety sentences. M1 tests this before anything else is built.
4. Kiosk mode on one shared device is acceptable for the understanding check.
5. The instructor accepts a locally run tool with recorded evidence in place of a public link.

### Potential risks

| Risk | Effect | Mitigation |
|---|---|---|
| Content work is the long pole: templates, sources, stems, questions, native checks | Code is ready but nothing can be tested or called verified | Start content on day one. Two templates only. Honest "Draft" labels. |
| No API key, or late | No live tests | Replay for development; resolve Q1 this week. |
| Machine time too long | Ten-minute criterion fails for a technical reason | Measure in M1; parallel calls; stop rule. |
| Many false flags in Polish and Lithuanian | Foreman time rises; C2 and C4 look worse | Expected in round 1. Stem tuning is the documented revision. |
| Model output varies between runs | Results not reproducible | Lowest randomness setting; every call logged; report counts from logged runs. |
| Norwegian wording unchecked | A Norwegian foreman reads awkward screens and templates | One Norwegian speaker reviews the string file and both templates before visit 2. |
| Scope creep | M2 never finishes | Stop rules; no COULD before M5 round 1. |
| Evidence lost | Appendix cannot be assembled | Server writes files to `evidence/`; commit after every test session. |
| No internet at the firm | Live test impossible on site | Hotspot; if that fails, run T5 on paper printouts prepared beforehand and say so. |
| The tests need people, not code | T5 and T8 stay undone | Book reviewers and the firm now; every test has a desk variant. |
