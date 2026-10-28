# Requirement checklist

Built and checked on 5 October 2026. Updated on 6 October 2026 for service brief v3 and for usability (section 10, and `V3_CHANGES.md`), and on 26 October 2026 for the team's suggestions and the Gravitas interview (section 11, and `OCT26_CHANGES.md`). Sources: `SJA_Forstatt_Prototype_Specification.md` v1.0 (what) and `docs/implementation_plan.md` v1.0 (how; it wins where they differ).

**How to read the last column**

| Mark | Meaning |
|---|---|
| ✅ | Built, and checked by running it. The check is named. |
| ⚠️ | Built, but checked only in replay mode with scripted answers, or only against a stand-in. Not yet seen working with a real model or real people. |
| ❌ | Not done, or cannot be checked from here. The reason is given. |

Checks that were run (numbers as of 26 October; on 6 October they were 83 and 15): 112 automated tests without a browser (`npm test`: rules, contracts, pipeline in replay mode); 18 browser tests in replay mode at 375 px width, with an axe accessibility check on five screens (`npm run test:e2e`); a type check; the seed-data check; a production build; a fresh install in an empty copy of the folder followed by all of the above; live and record mode through the real server against a local stand-in endpoint; and a print-to-PDF of the record.

**None of these checks is evidence for the report.** They show that the software does what the plan says.

## 1. What has not been verified

Read this section before the rest.

| Item | Status | Why |
|---|---|---|
| Any call to a real language model | ❌ | No API key was available. Both adapters were exercised against a local stand-in server only. |
| Quality of prompts P1–P6 | ❌ | Never run. Written from the prompt contracts. Expect to revise them after the first live run. |
| Machine time (target: about one minute for five changed lines in two languages) | ❌ | Replay answers return at once. This is the plan's stop rule before M2 and it is still open. |
| Whether the check catches real errors (claim C2) | ❌ | The T6 counts on screen in replay mode come from scripted answers. The rules layer (D1, D2) is real code running on unconfirmed fixtures. |
| Tests T1–T8 with a foreman, workers or reviewers | ❌ | Group activity (plan milestone M5). |
| Norwegian, Polish, Lithuanian and Russian wording | ❌ | All drafted by the builder. No native speaker has checked any of it. |
| Technical correctness of the four templates, their tags, risk levels and source references | ❌ | No technical reviewer. Paragraphs were mapped by the builder; 20 lines are "Firmapraksis". |
| Whether a foreman can judge a written explanation from its machine translation (U4) | ❌ | Needs a live model and a person. Until then the written path ending in "signed" rests on an untested assumption. |
| Seeded errors and controls confirmed by a native speaker | ❌ | Files carry `"status": "unconfirmed"`, and the bench says so. |
| A happy-path run recorded from a live model (plan section 10) | ❌ | Needs a key. A scripted demo run is shipped in its place, labelled. |
| An existing blank SJA form from a public source (T8 fixture) | ❌ | None was available. A marked placeholder is in `data/fixtures/`. |
| AC-02 (first-time user starts an SJA in under two minutes) | n/a | Removed from build acceptance by the plan (SC-13). An observation for T1. |
| The prototype on the group's own computers | ❌ | Built and run in a Linux build environment. Needs Node 20.19 or newer. |

## 2. Features

| Requirement | Implementation | Verified |
|---|---|---|
| F-01 Seed library and glossary with true verification status | `data/seed/`, `server/data.ts`, Review screen (`/review?view=library`). State derived by `deriveState()`, never stored. | ✅ unit "nothing is verified (AC-01)"; browser "library" |
| F-02 New SJA input: job type, parameters, specifics, languages, two tick-boxes, header | Wizard step 1 (`Steps12.tsx`). Range validation, 600-character limit, no-names notice, header marked as local. | ✅ browser happy path (validation, notices) |
| F-03 Input normalisation with clarifying questions, at most three | P1; `runNormalise`, `specificsBlockers`; step 2. The flow stops on an open question or an unclear detail. | ⚠️ browser "slang input"; pipeline jd-03. Whether a real model asks in place of guessing is untested. |
| F-04 Template adaptation with a code-level diff | P2 returns operations; `applyOperations` (D3) computes origins by text comparison. Unsourced additions become "AI suggestion: no source". | ✅ unit D3 (8 tests); ⚠️ P2 itself only scripted |
| F-05 Source ambiguity check before translation | P3, one call per line; `runAmbiguity`; blocks content confirmation on a critical line. | ⚠️ pipeline jd-04; browser "ambiguous critical line" |
| F-06 Translation of changed lines only | `runLanguageCheck`, `translateAndCheck`; reused lines copied byte for byte; parameters inserted by code. | ✅ call counts in pipeline and browser tests (AC-08); ⚠️ P4 only scripted |
| F-07 Check engine, usable on its own | `checkLine()`: D4 → D1 → D2 → P5 → P6. Used by the wizard and the bench. | ✅ rules; ⚠️ P5 and P6 only scripted |
| F-08 Flag list and four routes | `FlagCard`, `allowedRoutes`, `applyRoute`. No control dismisses a red language flag. | ✅ unit "Flag routes"; browser jd-01, jd-02 |
| F-09 Foreman review of the Norwegian, technical re-check markers | Step 3; `changedParameters`, `confirmTechRecheck`; summary bar. | ✅ unit and browser (AC-13) |
| F-10 Understanding check: kiosk, scenario questions, teach-back, re-brief loop, standalone mode | **Changed for brief v3 (section 10).** Per worker: teach-back judged by the foreman, then one scenario question. `Worker.tsx`, `components/TeachBack.tsx`, step 5, `rules/understanding.ts`. Counts only, no names. | ✅ unit D7 (16 tests); browser happy path, jd-02, jd-04 and baseline |
| F-11 Sign-off gate and traceable record | `gateConditions` (D5), step 6, `/runs/:runId`, `recordToMarkdown`. | ✅ unit D5; browser happy path, jd-02, jd-04 |
| F-12 Reviewer view with two-key verification | `Review.tsx`, `verification.ts`. Role, language, inside or outside the group. Queue of lines sent by a foreman. | ✅ unit (4 tests); browser "review", "reviewer corrects a line" |
| F-13 Event log, timing by category, assist counter | `state/timing.ts` (step transitions, machine time split out), `useLog`, observer control in the step header. | ✅ browser happy path (a duration for each category; no text in the log) |
| F-14 Test bench with fixtures and pair-check mode | `Bench.tsx`; counts by layer; pasted pairs from any tool. | ✅ mechanics in browser "test bench"; ⚠️ counts are scripted in replay |
| F-15 Evidence export | Appendix A (Markdown, CSV), per-run record (Markdown, JSON), prompts with versions, AI-use summary, verification summary, bench result. Written to `evidence/exports/` and downloaded. | ✅ browser tests read the downloaded files |
| F-16 Banner and data guardrails | `Banner` on every screen; repeated on every printed page; first line of every export; server allow-list per task. | ✅ browser; gateway test "D6" |
| F-17 Trace panel (promoted to mandatory, SC-09) | `TracePanel.tsx`: every model call, rule check and human action in order. | ✅ browser happy path |
| F-18 Replay of a saved run (promoted, SC-09) | `/runs`, self-contained run files, step-through. One labelled demo run is shipped. | ✅ browser "a saved run reopens … no external network and no model call" |
| F-19 Baseline timer | `Baseline.tsx`: same categories, arm = baseline, both arms in one table, CSV export. | ✅ browser "baseline arm" |
| F-20 English as an output language | Glossary column and stored translations for both templates. | ⚠️ pipeline "English works as an output language" (scripted, jd-01 only) |
| F-22 Shorter wording for a Norwegian line | P3 returns `plain`; offered in step 3 and in the rewrite route. | ⚠️ pipeline "rewrite route" (scripted) |
| F-21 Third template | Not built. | ❌ by plan: only after two templates have both keys in one language |
| F-23 Audio | Not built. | ❌ by plan (SC-11, COULD) |
| F-24 Second independent translation | Not built. | ❌ dropped by plan (SC-11) |

## 3. Rules and prompts

| Requirement | Implementation | Verified |
|---|---|---|
| D1 Glossary check by stems; forbidden stems (SC-07) | `rules/glossary.ts`. Substring match in compounds, whole-word forms, overlap suppression, stem alternatives. | ✅ unit (8 tests, Polish and Lithuanian inflection) |
| D2 Numbers and unit symbols; decimal comma = point (SC-06) | `rules/numbers.ts` | ✅ unit (6 tests) |
| D3 Apply operations, origin by text comparison, markers | `rules/diff.ts` | ✅ unit (8 tests) |
| D4 Supported = glossary column exists (SC-03) | `rules/languages.ts` | ✅ unit; browser jd-04 and pasted Romanian pair |
| D5 Sign-off gate; one blocking rule (SC-08) | `rules/gate.ts` | ✅ unit (3 tests) |
| D6 Field allow-list per task, enforced on the server | `schemas.ts` strict inputs; `gateway.ts` rejects before a prompt is built | ✅ unit and gateway tests |
| D7 Understanding-check trigger | `rules/understanding.ts` | ✅ unit |
| P1–P6 prompt files with version headers | `prompts/*.md`, `CHANGELOG.md`; loaded at start-up | ✅ loaded and rendered in tests; ❌ never sent to a model |
| P5 built from the target text alone | The P5 input schema has two fields: `lang`, `text` | ✅ unit, pipeline and browser (AC-10) |
| Output validation; one retry, then a visible error | `gateway.ts`; Zod output schemas | ✅ gateway tests; browser "model connection cut" |
| Gateway modes live, record, replay | `gateway.ts`, `providers/` | ✅ replay; ⚠️ live and record against a stand-in endpoint only |
| Deterministic flags cannot be removed by a model | `checkLine` appends model flags to rule flags | ✅ pipeline bench test |
| Core library has no interface and no network code | `src/core/` | ✅ no `fetch`, `document`, `window` or storage reference in the folder |

## 4. Screens and journeys

| Requirement | Implementation | Verified |
|---|---|---|
| `/` Home: role tiles, banner, language toggle | `Home.tsx`. Since 6 October: one main action, then two labelled groups (reviewers; project group). | ✅ browser |
| `/foreman/:sjaId` six-step wizard | `Foreman.tsx`, `foreman/Steps12.tsx`, `Steps34.tsx`, `Steps56.tsx` | ✅ browser |
| `/worker/:sjaId`, `/worker/questions/:templateId` | `Worker.tsx` | ✅ browser |
| `/review` library and review | `Review.tsx` | ✅ browser |
| `/bench` | `Bench.tsx` | ✅ browser |
| `/runs`, `/runs/:runId` | `Runs.tsx` | ✅ browser |
| `/baseline` | `Baseline.tsx` | ✅ browser |
| J1 Foreman reuse, to a signed record | jd-01 | ⚠️ browser happy path (scripted answers) |
| J1 alternatives: unclear input, ambiguous line, unsupported language, two failed attempts, reviewer unavailable, rewrite, model failure | jd-02, jd-03, jd-04; route interception | ⚠️ browser, 7 tests |
| J2 Worker kiosk | | ✅ browser |
| J3 Reviewer: key, correct, false alarm, reject | | ✅ browser, 3 tests |
| J4 Bench: run, see by layer, type result, export | | ✅ mechanics |
| J5 Baseline timer | | ✅ browser |
| J6 Open a saved run and step through it | | ✅ browser |
| Foreman interface in Norwegian with an English toggle | `src/i18n/nb.ts`, `en.ts` (594 keys each; the compiler rejects a missing key) | ✅ browser (toggle); ❌ Norwegian not checked by a native speaker |
| Worker interface in the worker's language only, body text 18 px or more | `pl.ts`, `lt.ts`; 19 px | ✅ browser measures the font size |
| Usable at 375 px, no horizontal scrolling, tap targets 44 px | Tailwind, `min-h-11` on controls | ✅ browser checks every foreman step and the kiosk |
| A flag is never only colour and never only foreign text | Icon and word on every flag; Norwegian or English explanation; back-translation shown | ✅ browser (text assertions) |
| Reviewer, bench and baseline screens | English only (see ASSUMPTIONS 24) | ✅ |

## 5. Acceptance criteria

| ID | Criterion (short) | Verified |
|---|---|---|
| AC-01 | Library shows two templates and the glossary; no item "Verified" with seed data | ✅ unit; browser |
| AC-02 | Start in under two minutes | n/a, removed by SC-13 |
| AC-03 | No header value in any logged model request | ✅ unit; pipeline; browser reads the server's call log |
| AC-04 | Slang: correct specifics or a question; never proceeds on a guess | ⚠️ the stop is tested; the model's behaviour is not |
| AC-05 | Parameter-only run: non-parameter lines byte-identical, "reused" | ✅ unit; browser "parameters only" |
| AC-06 | AI line with no reference shows "AI suggestion: no source" and blocks | ✅ unit; browser jd-02 |
| AC-07 | Ambiguous line flagged before any translation of it | ⚠️ pipeline and browser jd-04 |
| AC-08 | Three changed lines → exactly three per language sent for translation | ✅ pipeline; browser |
| AC-09 | Changed number, forbidden term, unsupported language raise the right flag | ✅ unit; browser bench |
| AC-10 | Back-translation request holds the target text only | ✅ unit; pipeline; browser |
| AC-11 | No control dismisses a red language flag; four routes work | ✅ unit; browser |
| AC-12 | After two failed attempts the automatic route is disabled | ⚠️ pipeline and browser jd-02 |
| AC-13 | Changed parameter marks lines; sign-off closed until confirmed | ✅ unit; browser |
| AC-14 | Understanding required or skipped, with the reason in the log | ✅ unit; browser |
| AC-15 | Wrong answer: worker message, foreman sees line and count, blocked until re-brief | ✅ unit; browser |
| AC-16 | No screen asks a worker's name; counts only | ✅ unit; browser |
| AC-17 | Question set runs without the SJA | ✅ browser |
| AC-18 | Sign button disabled while a condition is open; conditions listed | ✅ unit; browser |
| AC-19 | Record shows origin, state, flags, routes, resolver, versions, timings, oral lines | ✅ browser |
| AC-20 | One approval sets one key; "Verified" needs both; edits clear keys as in SC-04 | ✅ unit; browser |
| AC-21 | Reviewer false alarm changes the bench count | ✅ unit; browser |
| AC-22 | A duration for every category that occurred; no free text or names in the log | ✅ browser; pipeline |
| AC-23 | T6 gives catch count, false-flag count and missed items per language | ✅ mechanics; ⚠️ scripted numbers |
| AC-24 | Test log has exactly six columns; observed result empty until typed | ✅ browser reads the CSV and Markdown |
| AC-25 | A run evidence file reads with no network | ✅ browser; Markdown and JSON are plain files |
| AC-26 | Banner on every screen, record and export | ✅ except the Appendix A CSV, kept as a clean six-column table (ASSUMPTIONS 25) |
| AC-27 | 375 px, no horizontal scrolling; English toggle | ✅ browser |
| AC-28 | Connection cut: error, retry control, line stays blocking | ✅ gateway; pipeline; browser |

## 6. The plan's changes to the specification

| ID | Change | Verified |
|---|---|---|
| SC-01 | Five modules, eight routes, one wizard | ✅ |
| SC-02 | Norwegian confirmed first; translation only afterwards | ✅ pipeline: no P4 call before confirmation |
| SC-03 | Supported = glossary column | ✅ |
| SC-04 | Key rules on edits | ✅ |
| SC-05 | Parameters are numbers or fixed choices, after a colon | ✅ both templates; choice labels stored in every language |
| SC-06 | Numbers and unit symbols only | ✅ |
| SC-07 | Stems, derived automatically, editable in review | ✅ `deriveStems`; glossary editor |
| SC-08 | One blocking rule; "machine-checked" label | ✅ |
| SC-09 | Trace and replay mandatory | ✅ |
| SC-10 | One working pack, version raised by a button, hash in every run | ✅ browser "review" |
| SC-11 | No audio, no second translation | ✅ not built |
| SC-12 | Ten-minute criterion excludes the understanding check | ✅ "foreman time" on the record and in the baseline table |
| SC-13 | AC-02 removed | n/a |
| SC-14 | Timing from step transitions; reviewer item timing; pause | ✅ |
| SC-15 | Local first | ✅ |
| SC-16 | Each flag records its layer; bench reports rules alone and rules plus back-translation | ✅ unit; browser |

## 7. Technology and structure (plan sections 3–5)

| Requirement | Implementation | Verified |
|---|---|---|
| TypeScript throughout; React with Vite; Tailwind; React Router; Zustand with persistence; Zod; Express | As listed in `package.json` | ✅ type check; build; fresh install |
| Provider-neutral gateway: Anthropic, OpenAI-compatible, replay | `server/providers/` | ⚠️ stand-in endpoint only |
| Vitest for rules and pipeline; one Playwright happy path | 70 + 14 tests | ✅ |
| JSON data files; Markdown and CSV exports; print to PDF | | ✅ |
| Git | `.gitignore` only; not initialised | ❌ left to the group |
| `.env` never committed; `.env.example` provided | | ✅ |
| Runs locally with one command | `npm run dev` | ✅ fresh install in an empty folder |

## 8. Data (plan section 10)

| Item | Delivered | Verified |
|---|---|---|
| Hazard list per job type with a public source reference per entry | 2 lists, 16 entries, 3 sources | ❌ not checked by a technical reviewer |
| Norwegian templates, 20–25 lines, 3–5 parameters, critical lines marked | 22 and 24 lines; 3 and 4 parameters | ✅ schema and seed check; ❌ wording and content unchecked |
| Template translations into Polish and Lithuanian (and English) | All lines, written by the builder, not by the tool's own pipeline | ✅ pass D1 and D2; ❌ no language key |
| Glossary, about 40 terms, four languages, stems, forbidden terms | 46 terms | ❌ draft |
| Scenario questions, at least 3 per template | 4 per template, four languages | ❌ draft |
| Job descriptions, 8, one in slang | 8 plus one parameter-only; 4 have stored answers | ✅ |
| Seeded errors, 10 per language, at least 4 not glossary errors | 10 per language; 6 are not glossary errors | ❌ unconfirmed |
| Clean controls, at least 10 per language | 10 per language (stored template lines) | ❌ unconfirmed |
| Ambiguous lines, at least 2 | 2 | ✅ |
| Unsupported-language case, missing-term case | 1 each | ✅ |
| Interface strings | nb, en; worker pl, lt, en | ❌ native check |
| Recorded responses for one happy-path run | Scripted, not recorded | ❌ |
| Blank SJA form from a public source | Placeholder | ❌ |

## 9. Course requirements the prototype supports

The specification's section 15 maps CR-01 to CR-22 and TR-01 to TR-10 to features. The features exist (sections 2–5 above). Whether each course requirement is *met* depends on evidence the group still has to produce: live runs, tests T1–T8 with people, at least one documented revision, and reviewers from outside the group. The tool is ready to record all of that; none of it has been recorded.

## 10. Service brief v3 (6 October 2026)

The specification was written from brief v2. Brief v3 changed step 4 and added "What verified means in practice". This section lists each v3 statement that bears on the prototype. `V3_CHANGES.md` has the full comparison, including what was already there and what was left alone.

| Brief v3 says | Implementation | Verified |
|---|---|---|
| Each worker explains the key hazard and the safety measure in their own words (teach-back) | Kiosk phase "explain" in `Worker.tsx`; the foreman's part (`TeachBackJudge`) lists what to listen for and records the outcome. `recordWorkerCheck` in `flow.ts`. | ✅ unit "records one worker"; browser happy path (Polish and Lithuanian workers) |
| … and answers one "what do you do if …" question | `QUESTIONS_PER_CHECK = 1`; the question that tests a changed line comes first. A wrong answer opens a re-brief that blocks signing. | ✅ unit "asks ONE scenario question"; browser |
| At the morning briefing or on a phone | Step 5 "record a worker orally": the foreman records the explanation and the answer. Used also when no crew language is supported. | ✅ unit "done orally"; browser happy path (third worker) and jd-04 |
| … with audio | Not built (audio was dropped by the plan, SC-11). | ❌ |
| The foreman watches the start of the job and notes anything misunderstood | `recordObservation`; step 6 after signing; reminder on Home; added to the saved run by `saveRun` without losing the trace. After sign-off, does not block it (ASSUMPTIONS 33). | ✅ unit "comes after sign-off, once"; browser happy path reads the saved file |
| Misunderstandings are logged anonymously | Event `misunderstanding` with template and template line only. No language, outcome or points per worker in the log or the trace (ASSUMPTIONS 37). | ✅ unit (2 tests); browser reads the saved events |
| … and fed back into the template | `misunderstandingCounts`; the review screen marks and filters the lines; the verification summary lists them. A marker for reviewers; nothing rewrites a template (ASSUMPTIONS 36). | ✅ browser happy path (review screen) |
| Understanding is not a signature or a quiz score | The record leads with the explanations, then the question, then the observation. | ✅ browser (record text) |
| A template counts as verified only when both reviewers have approved it; the foreman then signs | Two keys were there (F-12). New: "What verified means here" on the review screen; step 3 says when the template is a draft; the record states "Built from a verified template". | ✅ unit "Built from a verified template"; browser |
| Measure 1: total minutes per signed SJA, counting drafting, checking and correction | `totalTime`, `PHASE_OF` in `metrics.ts`; record and baseline table. | ✅ unit; browser "baseline arm" |
| Measure 5: foremen who run the workflow without adviser help | "Completed without help: yes / no" in the record, from the assist counter. | ✅ browser happy path |
| Both methods are timed from drafting through checking and correction | Baseline timer wording and totals; T5 and T8 definitions. | ✅ browser |

Rules added because of defects found while testing the change:

| Rule | Implementation | Verified |
|---|---|---|
| Checks made before the SJA changed are set aside | `basis` and `recheck` in `initUnderstanding` | ✅ unit (2 tests) |
| A worker is never shown a flagged translation | `WorkerLine` in `Worker.tsx` | ✅ browser jd-02 |
| No check can be recorded on a signed SJA | `recordWorkerCheck`; kiosk guard | ✅ unit; browser happy path |
| A save never replaces the saved trace with a shorter one | `saveRun` in `useWizard.ts` reads, appends, writes | ✅ browser happy path (trace length and numbering after the observation). ❌ the failure path (file unreadable) is covered by reading the code only |
| Data stored by the first version is converted | `upgradeSja`; persist version 2 in `stores.ts` | ✅ unit; a manual run with data from the first version |

Not verified for this update: any of it with a real model (none of it needs one), with a foreman or workers, or on a real phone. The Norwegian, Polish and Lithuanian wording of the new screens is unchecked.

## 11. Team suggestions and the Gravitas interview (26 October 2026)

From `docs/team_feedback_and_interview_tasks.md` and the group's five decisions. `OCT26_CHANGES.md` has the detail per task, including what was not done.

| Task | Implementation | Verified |
|---|---|---|
| F3 Waits on "too many requests"; parallel limit | `Gateway.complete`, `Pacer`, `RateLimitError`; `rateLimitWaitMs` per logged call | ✅ unit (4 tests, including a stand-in server answering 429) |
| F1, F2 Free models (Gemini, Ollama, a second provider for back-translation) | `.env.example` blocks A–C; `providerFor` | ⚠️ unit with a stand-in only; never run against Google or Ollama |
| F5 Rules-only T6 count | Bench, per language | ✅ browser "test bench" |
| L1 Reuse of verified translations | `rules/memory.ts`; `runLanguageCheck` | ✅ unit "reuses … with no model call" |
| L2 Verified examples in P4 (1.1.0) | `buildP4`; gateway falls back to the request without examples in replay | ✅ unit |
| L3 Reviewer adds forms to the glossary | `addTermForms`; Review → glossary | ✅ unit |
| L4 Promote a job line into the template | `promoteLine`; Review → "Add to template" | ✅ unit |
| L5 Measure memory before and after | — | ❌ needs a live model and keys |
| Q1 A source on every rule line | `sourceRef` → paragraph, SDS or "Firmapraksis" | ✅ unit (every line); ❌ content unchecked |
| Q2 8–10 questions per template | Seed data | ✅ unit |
| Q3 Rotation | `nextQuestionIds` | ✅ unit; browser (oral check gets the next question) |
| Q4 "This is in your SJA" and question → line → source | `Worker.tsx`, record | ✅ browser |
| U1 Three paths, counted | `recordWorkerCheck` paths and reasons; gate: multiple choice only → "Signert med reserveløsning" | ✅ unit; browser painting job |
| U2 Written explanation, translated by P7, judged by the foreman | `translateWorkerAnswer`, kiosk, `prompts/P7_worker_answer.md` | ⚠️ browser in replay mode only |
| U3 No names, text not kept | P7 schema; `keepsText`/`redact` in the gateway; kiosk | ✅ unit (schema, call log); browser. ❌ Cyrillic phone keyboard |
| U4 Written-answers test | `BenchU4.tsx`, `written-answers.json` | ⚠️ built; not run with a person or a model |
| R2, R3 Russian; Cyrillic in D1 and D2 | i18n `ru.ts`, glossary stems, `UNIT_ALIASES` | ✅ unit with Cyrillic text; seed check passes in Russian |
| R4 Russian T6 fixtures | `seeded-errors.ru.json`, `controls.ru.json` | ✅ unit (controls clean); ❌ not confirmed by a Russian reader |
| R5 Russian at 375 px | Browser test checks for horizontal scroll | ✅ browser; ❌ real phone |
| J1, J2 Painting and concrete | Templates, hazards, `jd-10`, `jd-11` | ✅ browser painting job; ❌ content unchecked (J3) |
| K1–K5 Products, SDS lines, pictograms, substance index, chemical questions | `templateLinesFor`, `Ghs.tsx`, step 1 | ✅ unit; browser. K4 lacks "whom to ask" |
| B1–B5 Tags, risk, library, header, CSV | `rules/library.ts`, `Rules.tsx` | ✅ unit; browser |
| V1–V3 Clean view (eye switch in the header, NO / EN kept), role tabs on Home, `/review`, banner and privacy panel kept | `ViewToggle` in `ui.tsx`, tabs in `Home.tsx`, `APP_MODE`, `LabOnly` | ✅ browser "clean view" (tabs, axe) |
| V4 Light accessibility check | axe in the browser tests, five screens | ✅ browser (serious and critical only) |
| V5, V6 Sharing for free, safely | `npm run share` (replay, field, `PACK_READONLY=1`); `allowedHosts` | ✅ the read-only pack refuses writes (run by hand); ❌ not tried through a real tunnel from a phone |
| I1 Main-contractor summary | `Summary.tsx`, `/runs/:runId/summary` | ✅ browser |
| I2 Chatbot arm in T8 | `tests.json` | ✅ (text) |
| I3 Privacy panel | `Privacy.tsx`, step 1 and record | ✅ browser |
| I4 "Not followed" apart from "misunderstood" | `recordObservation`, event `rule_not_followed` | ✅ unit; browser |
| J3, I5–I8 | People and report tasks | ❌ |

Not verified for this update: anything with a real model, with people, on a real phone, or through a real tunnel. Every new text in every language is a draft.
