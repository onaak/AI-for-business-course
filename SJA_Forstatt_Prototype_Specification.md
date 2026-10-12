# SJA Forstått: Prototype Specification

| | |
|---|---|
| **Version** | 1.0 (5 October 2026) |
| **Status** | Specification only. Nothing is built yet. |
| **Purpose** | Primary specification for building the flagship prototype of the AI for Business group assignment |
| **Sources read** | (1) *AI for Business Group Assignment 2026 v25082026b* (course PDF). (2) *Service Brief v2*, 28 Sep 2026 (project proposal). (3) The instructor's written feedback on the proposal. |
| **Not available** | *SJA_Forstatt_Prototype_Kit.xlsx* and the *Service Portfolio Draft* are referenced in the proposal but were not provided. Their contents are assumed from the proposal's description (see Assumptions Made). |

The instructor's feedback was not on the list of documents to analyse, but it is in the project and it changes what the prototype has to prove. It is treated here as a third source, ranked between the course PDF and the proposal.

---

## 0. How to read this document

**Precedence when sources conflict:** course requirements > instructor feedback > client and user needs > project proposal > assumptions in this specification.

**Priority labels**

| Label | Meaning |
|---|---|
| **MUST** | Needed to meet a course requirement or to test a core claim. The prototype is not acceptable without it. |
| **SHOULD** | Clearly strengthens the evidence or the presentation. Build after every MUST works. |
| **COULD** | Nice to have. Build only if it costs almost nothing. |
| **OUT** | Explicitly out of scope. Do not build. |

**Identifier prefixes**

| Prefix | Refers to |
|---|---|
| CR | Course requirement (from the PDF) |
| TR | Instructor ("teacher") requirement from the written feedback |
| PR | Proposal or client requirement (from Service Brief v2) |
| CH | Challenge to a decision in the proposal |
| F | Feature |
| D | Deterministic rule (code, no AI) |
| P | Prompt contract (AI step) |
| T | Test |
| AC | Acceptance criterion |
| A | Assumption |

**Roles used throughout**

| Role | Who | Language assumption |
|---|---|---|
| Foreman (*bas*) | Direct user. Describes the job, resolves flags, signs. Accountable. | Reads Norwegian. Does **not** read the crew languages. |
| Worker | End user. Reads or hears the SJA and answers the understanding check. | Reads one target language; limited or no Norwegian. |
| Language reviewer | Native or fluent speaker of a target language. Holds the language key (see 10.4). | Target language plus Norwegian or English. |
| Technical reviewer | Person with trade or HSE competence. Holds the technical key. | Norwegian or English. |
| Observer | A group member running a test session and noting what happens. | n/a |

---

## 1. Project context and objective

### 1.1 The problem

Small construction and craft subcontractors in Oslo (5–20 employees) run crews that speak two to four languages. Since 1 January 2024 the building-site regulations (byggherreforskriften §19 and §19a) require that relevant written safety documentation is available so that each worker understands it well, and that communication on site is not a safety risk. On City of Oslo contracts, Oslomodellen requirement N repeats the duty. These firms have no safety staff to write, simplify, translate and check a safe job analysis (SJA) before each high-risk job.

Existing HMS apps translate. None of them checks that the translation is correct or that the worker understood it. The proposal's own evidence notes that one vendor warns its users about AI translation errors.

The realistic current practice, and the legal minimum, is a Norwegian SJA explained orally by a bilingual colleague. The prototype is competing with that, not with nothing.

### 1.2 Target users

| Person | Relation to the prototype |
|---|---|
| Owner or general manager | Decides whether the firm joins. Not a prototype user, but the time figures the prototype produces are what would convince them. |
| Foreman | Primary user. |
| Workers | End users. |
| Main contractor and City of Oslo | Downstream recipients of the record. |
| Centre adviser and reviewers | Back-office users (set-up, verification). In the prototype these roles are played by group members and outside reviewers. |

### 1.3 What the prototype is intended to demonstrate

The course asks for a prototype that "demonstrates the service's central AI-supported mechanism" and says to "build only enough to test your main claim". The central mechanism is:

> A foreman adapts a verified SJA template to today's job. AI translates only what changed, checks the translation against a verified glossary and by back-translation, and flags problems. A human resolves every flag, workers show what they understood, and the foreman signs.

### 1.4 The claims the prototype must put to the test

| # | Claim | Why it matters |
|---|---|---|
| C1 | **Reuse.** Adapting a verified template leaves most lines untouched, so only a few lines need a new language check. | The proposal's speed and cost argument depends on it. |
| C2 | **Detection.** The check catches safety-critical translation errors before sign-off, without burying the foreman in false flags. | This is the "verified" in the service's name. |
| C3 | **Resolution.** A foreman who cannot read the target language can still resolve or escalate every flag correctly. | If not, the human sign-off is a rubber stamp. |
| C4 | **Time.** Total time to a signed SJA, counting checking and correction, is no more than current practice. | The instructor asked for exactly this count (TR-01, TR-09). |
| C5 | **Understanding.** Workers answer safety-critical questions at least as well as after the current oral briefing. | The proposal names this as the assumption the service most depends on. |
| C6 | **Repeatability.** The foreman needs less help on the second SJA than on the first. | The instructor asked whether staff learn a repeatable way of working with AI (TR-02). |

A prototype that shows C2 or C5 to be false is still a successful prototype for the course, as long as the result is documented and the recommendation follows from it.

---

## 2. Decisions that change the proposal

The proposal is not reproduced as written. The following points were found during analysis. Each one is resolved in this specification.

| ID | Problem in the proposal | Why it matters | Decision in this specification |
|---|---|---|---|
| CH-01 | Templates and glossary are called "verified", but the proposal states that the Polish and Lithuanian glossary entries are unverified drafts. | The course forbids presenting unverified material as evidence (CR-18). The instructor asked what "verified" means in practice (TR-03). | Verification is a recorded state with two separate keys (10.4). The interface shows the true state of every line. The word "verified" appears only where both keys exist. |
| CH-02 | "The foreman resolves every red flag", but the foreman cannot read Polish or Lithuanian. | He cannot judge whether a translation is right. A sign-off on that basis proves nothing (C3). | Flags are explained in Norwegian. The foreman chooses between four routes that need no knowledge of the target language (F-08). He cannot dismiss a language flag. |
| CH-03 | Back-translation is the main check. If the same model translates forward and back, a wrong term often translates back to the original word, so the error is invisible. | The check would pass the errors it exists to catch (C2). | Three layers: deterministic glossary and number checks, back-translation in an isolated call that never sees the source, then a structured comparison (F-07). |
| CH-04 | Test 6 passes if at least 8 of 10 seeded errors are flagged. A checker that flags every line passes. | The result would say nothing about usefulness, and false flags are what consume the foreman's time (C4). | Add clean control lines and a false-flag threshold. At least four seeded errors must be of a kind the glossary cannot catch (T6). |
| CH-05 | Understanding is recorded as three completed questions. | The instructor asked for more than "a signature or a completed set of questions" (TR-04). | Scenario questions about what to do, a teach-back step, and a re-brief loop when an answer is wrong (F-10). The result is an action for the foreman, not a score for the worker. |
| CH-06 | Test 5 briefs a real crew for a real job using the prototype's SJA. | An unverified student prototype would be steering real high-risk work. | Test 5 is a tabletop exercise on a hypothetical job. The firm's own SJA process stays in force for all real work. Every output carries a "not a valid SJA" banner (F-16). |
| CH-07 | The prototype kit is a spreadsheet of prompts run by hand in a chat tool. | A foreman cannot operate it, so the "signed SJA in 10 minutes" criterion would measure the group's copy-and-paste speed. | A thin single-page web tool. The spreadsheet's glossary, cases and seeded errors become its seed data (13). |
| CH-08 | "Only what changed needs checking again." A changed parameter, such as working height, can make an unchanged line technically wrong. | Reuse is safe for language but not automatically for technical content. | The language check covers changed lines only. The foreman confirms the whole Norwegian text, and lines that depend on a changed parameter are marked for a technical re-check (D3, F-09). |
| CH-09 | Five job types in three languages. | Each template needs two reviewers per language. The instructor asked for manageable examples (TR-05). | Two templates and two target languages are MUST. A third template and English are SHOULD. Five job types remains the pilot scope, not the prototype scope. |
| CH-10 | "Low confidence goes to an interpreter." Low confidence is not defined, and a model's own confidence is poorly calibrated. | Test 4 cannot be passed or failed without a definition. | Low confidence is defined by four observable conditions (10.6). No model-reported confidence score is used. |
| CH-11 | No answer to what happens on site while an escalation is pending. | A foreman at the morning briefing cannot wait for an interpreter. | Every blocked line offers an oral-fallback route: brief that line through a bilingual colleague, and the record says so (F-08, F-11). |
| CH-12 | The pilot threshold accepts 80% of errors caught, while a hard condition says no critical mistranslation in a signed SJA. | The two only fit together if the human step catches the rest. | The prototype reports two separate numbers: the AI catch rate before review, and residual critical errors after review (10.7). |
| CH-13 | "AI drafts each SJA from Arbeidstilsynet and EBA guidance." | Free drafting invites invented hazards and controls. A chatbot may not be cited as a source (CR-21). | Template content comes from a curated hazard list with a public source reference per line. Anything the AI adds is marked as an unverified suggestion (F-04). |
| CH-14 | Site details go into the job description. | Site, client and personal names could reach an external AI tool (CR-17). | Header fields never leave the device. Only the job-specific description is sent to the model (D6). |
| CH-15 | Three services are described. | The instructor said a second prototype is not needed (TR-10). | Only the flagship mechanism is prototyped. Services 1 and 3 are OUT. |
| CH-16 | Time saved (15–45 minutes per SJA) is an assumption, and template set-up and reviewer time are not counted. | The instructor asked for checking and correction time as well as drafting time (TR-09). | The tool logs time by category for foreman, reviewer and machine, including set-up (F-13). |

---

## 3. Course requirements

The course PDF contains no grading rubric. "Evaluation criteria" are therefore inferred from the stated requirements, the submission rules and the instructor's feedback.

### 3.1 Mandatory requirements that affect the prototype

| ID | Requirement (course PDF) | How the prototype reflects it |
|---|---|---|
| CR-01 | The prototype must demonstrate the central AI-supported mechanism of the flagship (Minimum scope; Part 2). | The foreman flow F-02 to F-11 runs end to end on at least two job types. |
| CR-02 | AI must play a defined and meaningful role. Advising firms to "use AI" is not sufficient. | Six named AI tasks with defined inputs and outputs (11.2). |
| CR-03 | Translate the mechanism into a chain: inputs and data; AI task; model or tool; output; human decision or action; feedback or monitoring. | The chain table in 11.1. Each run stores the chain as it actually executed (F-13, F-17). |
| CR-04 | Build a working or demonstrable prototype. Existing tools, no-code, spreadsheets, mock data or code are allowed. No model training is expected. | A thin web tool on an existing language model with synthetic data. No training, no fine-tuning. |
| CR-05 | Show human review, escalation, correction, and the points where an accountable person makes or confirms a decision. | Flag resolution (F-08), reviewer view (F-12), sign-off gate (F-11, D5). The AI cannot approve anything. |
| CR-06 | Identify failure modes and show how errors are detected, corrected and escalated. | Flag taxonomy (10.5), low-confidence rules (10.6), escalation and oral fallback (F-08), failure tests T3, T4, T6, T7. |
| CR-07 | Identify data, documents and knowledge required: availability, quality, ownership, language, sensitivity, update needs. | Data inventory in 10.1, with real versus mock clearly separated. |
| CR-08 | Name the AI capability used and explain why it fits. | Capability column in 11.2. |
| CR-09 | Compare with at least one non-AI alternative. | Baseline arm of T5 (oral briefing by a bilingual colleague) and T8 (existing template plus human translation). The tool times both arms in the same categories (F-19). |
| CR-10 | Define one or more measurable success criteria. | Pass criteria per test (12.2) and metric definitions (10.7). |
| CR-11 | At least five structured tests: two typical, two difficult, edge or failure, and one challenging the key assumption. Compare with criteria and record errors. | Eight tests: T1–T2 typical, T3–T4 and T6–T7 edge or failure, T5 key assumption, T8 comparison. Test bench F-14. |
| CR-12 | Revise at least one element of the service or prototype after testing. | Prompts, glossary and rules are versioned. Each log line carries the versions, so a before-and-after pair can be shown (F-13, F-15). |
| CR-13 | One perspective from outside the group. | Reviewer view records each reviewer's role and whether they are inside or outside the group (F-12). |
| CR-14 | Appendix A test log with the fields: number, case type, scenario or input, expected outcome, observed result, learning or revision. | Test bench exports rows in exactly these columns (F-15). |
| CR-15 | Appendix B: tools and versions, what they were used for, core prompts or workflows, how outputs were checked, dates of use; five verified claims. | One versioned prompt file; automatic record of model name, version and dates (F-15). The five verifications are a group task. |
| CR-16 | Prototype evidence: screenshots, sample inputs and outputs, workflow logic, test results. Must stay understandable if a link is unavailable. | Each run exports as a self-contained file (F-15). |
| CR-17 | No personal data, confidential information or sensitive case material in an external AI tool. Use public, synthetic or anonymised data. | Synthetic seed data only. Header fields stay local (D6). No worker names anywhere. Input notice (F-16). |
| CR-18 | Do not fabricate facts, test results or feedback. Label assumptions. Separate evidence, prototype findings, assumptions and recommendations. | True verification state on every line (CH-01). Observed results are entered by a person, never generated. Thresholds are labelled as assumptions. |
| CR-19 | All group members must be able to explain and defend the prototype. | Simple architecture, prompts readable in one file, English interface toggle, per-run trace (F-17). |
| CR-20 | Ten-minute presentation focused on the flagship, prototype and strongest test evidence. | Replay of a saved run without network (F-18). |
| CR-21 | Do not cite a chatbot as an academic, legal, market or contextual source. | Every hazard and control line carries a public source reference, or is marked unsourced (F-01, F-04). |
| CR-22 | Four to six measures that let the authority judge value. | The prototype computes the same measures as the proposal's pilot measures 1–3, in the same units (10.7). |

### 3.2 Instructor feedback

Treated as binding guidance on priorities.

| ID | Feedback | How the prototype reflects it |
|---|---|---|
| TR-01 | Show whether the service reduces preparation and checking time. | Timing by category (F-13), tests T2 and T8. |
| TR-02 | Show whether staff learn a repeatable way of working with AI. | Assist counter per session; T2 compares the second run with the first (C6). |
| TR-03 | Explain what "verified" means: who can check both the language and the technical meaning. | Two-key verification model (10.4), reviewer view (F-12). |
| TR-04 | Assess understanding beyond a signature or a completed set of questions. | Scenario questions, teach-back and re-brief loop (F-10). |
| TR-05 | Keep examples and languages manageable. | Two templates, two target languages (CH-09). |
| TR-06 | Get relevant outside feedback on the outputs. | Reviewer view marks outside reviewers; evidence export lists who held each key (F-12, F-15). |
| TR-07 | Include an ambiguous instruction or a problematic translation, to test how the review process handles it. | T7 (ambiguous source) and T6 (seeded mistranslations). Source ambiguity check F-05. |
| TR-08 | Compare with existing templates and with human translation or explanation. | T5 (human explanation) and T8 (existing template plus human translation). |
| TR-09 | Count checking and correction time as well as drafting time. | Separate timers for input, machine, content review, flag resolution, understanding check, sign-off and reviewer work (F-13). |
| TR-10 | Concentrate on testing the flagship workflow. Do not broaden. No second prototype. | Services 1 and 3 are OUT (5.3). |

### 3.3 Recommendations and signals (not mandatory)

| Source | Recommendation | Consequence |
|---|---|---|
| Course PDF | "A polished interface is optional; build only enough to test your main claim." | Plain, legible interface. No branding work. |
| Course PDF | A finished software product is not expected. | No accounts, no database server, no HMS integration. |
| Course PDF | Use ranges and scenarios, not false precision. | Results are reported as counts ("7 of 10"), not percentages from tiny samples. |
| Course PDF | Verify important interpretations when using translation tools, and state language limitations. | English toggle so non-Norwegian-speaking group members can check what the foreman sees. Language limits are recorded in the evidence export. |
| Proposal | The glossary, test set and method should be open and independent of the Centre's tool. | Data in open formats. The check engine can test any translation pair, including one produced by another tool (F-07, F-14). |

---

## 4. Prototype goals

### 4.1 What the prototype must enable

1. A foreman can go from "today's job" to a signed, multilingual SJA record in one sitting, without help from a developer.
2. The group can run all eight tests in 12.2 and export the evidence in the Appendix A format.
3. Every claim C1–C6 produces a number or an observation that can be compared with a threshold set in advance.
4. A reader of the report can see, for any run, what the AI did, what a person decided, and what state of verification each line had.

### 4.2 What counts as a successful prototype

- All MUST features meet their acceptance criteria (section 14).
- T1–T8 have been run, with observed results entered by a person.
- At least one element was revised after the first round, and the before-and-after results are both in the log.
- No output claims a verification that did not happen.

Passing every test is **not** a success condition. A clear negative result on C2 or C5 is valid evidence for a "revise and retest" recommendation.

---

## 5. Prototype scope

### 5.1 MUST

| ID | Feature | Main reason |
|---|---|---|
| F-01 | Seed library and glossary with true verification status | CR-07, CR-18, TR-03 |
| F-02 | New SJA input: job type, parameters, specifics, crew languages | CR-01 |
| F-03 | Input normalisation with clarifying questions | CR-06, T3 |
| F-04 | Template adaptation with a code-level diff | C1, CH-08, CH-13 |
| F-05 | Source ambiguity check | TR-07, T7 |
| F-06 | Translation of changed lines under glossary constraints | CR-02 |
| F-07 | Translation check engine, usable on its own | C2, CH-03 |
| F-08 | Flag list and four resolution routes | C3, CR-05, CH-02, CH-11 |
| F-09 | Foreman review of the Norwegian content, with technical re-check markers | CH-08 |
| F-10 | Understanding check: worker view, scenario questions, teach-back, re-brief loop | C5, TR-04 |
| F-11 | Sign-off gate and traceable record | CR-05, PR-04, PR-06 |
| F-12 | Reviewer view with two-key verification | TR-03, TR-06, CR-13 |
| F-13 | Event log and timing by category | TR-01, TR-09, CR-03 |
| F-14 | Test bench with fixtures | CR-11 |
| F-15 | Evidence export | CR-14, CR-15, CR-16 |
| F-16 | Prototype banner and data guardrails | CR-17, CH-06 |

### 5.2 SHOULD, in priority order

| ID | Feature | Why |
|---|---|---|
| F-17 | Trace panel: "how this run worked" | Shows the AI chain live in the presentation (CR-03, CR-19). |
| F-18 | Replay of a saved run without network | Presentation safety (CR-20). |
| F-19 | Baseline timer for the non-AI arm | Same time categories for both arms (CR-09, TR-09). |
| F-20 | English as a third output language | The group can read and check it themselves. |
| F-21 | Third job-type template | More variety for T1 and T2. |
| F-22 | Plain-language rewrite suggestions for the Norwegian source | The problem statement includes "simplify". |
| F-23 | Read-aloud audio in the worker view | In the proposal (PR-05). Browser voices for Lithuanian are unreliable, so not MUST. |
| F-24 | Second independent translation, flagged where the two disagree | Extra detection layer for C2. |

### 5.3 COULD

- Voice input for the job description (PR-12). Test 3 needs typed slang, not speech.
- Worker answers on their own phone through a link or QR code. Requires shared state between devices.
- Drafting a template for a job type that is not in the library.
- Images in glossary entries.

### 5.4 OUT of scope

| Item | Reason |
|---|---|
| Service 1 (10-minute language check) and Service 3 (day-90 review) | TR-10. Described in the report, not built. |
| User accounts, login, roles with permissions | Not needed to test any claim. Roles are switched by a menu. |
| Integration with Proresult, Duro, Svenn or any HMS system | Pilot activity from month 7. |
| Retrieval over the full Arbeidstilsynet or EBA guidance | Replaced by a curated hazard list (CH-13). |
| Model training or fine-tuning | CR-04. |
| Legally valid electronic signature | The sign-off is a recorded confirmation only. |
| Real company documents, real site names sent to a model, real worker names | CR-17. |
| Vendor certification or ranking | Excluded by the proposal itself. |
| Value case, cost model, roadmap, governance | Report content, not prototype content. |
| Any use of an output to plan or carry out real work | CH-06. |

### 5.5 Build order

Build in this order so that the riskiest claim is testable first and something demonstrable exists at every stage.

| Phase | Contents | Tests unlocked |
|---|---|---|
| 1 | Seed data, check engine, test bench, event log (F-01, F-07, F-13, F-14) | T4, T6, T7 as desk tests |
| 2 | Foreman flow (F-02 to F-06, F-08, F-09, F-11, F-16) | T1, T2, T3 |
| 3 | Worker and reviewer views (F-10, F-12) | T5, T8 |
| 4 | Export and SHOULD items (F-15, then F-17 onward) | Evidence package, presentation |

If time runs out after phase 1, the group still has a working demonstration of the checking method and three of the eight tests.

---

## 6. Core functionality

Each feature lists what it does, how the user interacts, inputs, outputs and expected behaviour.

### F-01 Seed library and glossary (MUST)

- **Does:** loads templates, glossary, hazard list, question sets and test fixtures from open-format files at start-up. Shows a read-only library screen.
- **Inputs:** the data files described in 10.2.
- **Outputs:** a list of job-type templates and a searchable glossary table. Every line and term shows its verification state (10.4) and version.
- **Behaviour:** a template whose target-language lines lack either key is labelled "Draft: not verified" in that language. Nothing is ever shown as verified by default.

### F-02 New SJA input (MUST)

- **Interaction:** the foreman picks a job type, fills the template's parameters (for example working height, lifting equipment, weather exposure), types today's specifics as free text, and ticks the crew's languages. He also ticks any of: "new worker on the crew", "first time this crew does this job type".
- **Inputs:** job type; parameter values with units; free text up to 600 characters; one or more target languages; header fields (site label, date, foreman role label).
- **Outputs:** a draft SJA instance in state `draft`.
- **Behaviour:** header fields are stored locally and never sent to the model (D6). A notice next to the free-text field says: no names of people, companies, clients or addresses. Choosing a language outside the supported set is allowed, and leads to D4.

### F-03 Input normalisation and clarifying questions (MUST)

- **Does:** turns messy free text (slang, mixed Norwegian and English, typos) into structured specifics.
- **AI task:** P1.
- **Outputs:** a short list of understood specifics shown back to the foreman in plain Norwegian, plus up to three clarifying questions where safety-relevant information is missing or unclear.
- **Behaviour:** the model must ask, not guess. If a safety-relevant detail is unclear, the flow stops until the foreman answers or removes the detail. The foreman confirms the understood specifics before continuing.

### F-04 Template adaptation with a code-level diff (MUST)

- **Does:** adapts the chosen template to today's specifics.
- **AI task:** P2 returns a list of operations on template lines: `keep`, `fill_parameter`, `modify`, `add`, `remove`. It never returns the full rewritten document.
- **Deterministic step:** D3 applies the operations and computes each line's origin itself. Lines marked `keep` are copied byte-for-byte from the template together with their stored translations.
- **Outputs:** the Norwegian SJA with an origin badge per line: *reused*, *parameter filled*, *changed*, *new*, *removed*.
- **Behaviour:**
  - The model's own statement about what it changed is not trusted. The code compares text.
  - A new or changed line must either map to an entry in the curated hazard list, or it is marked "AI suggestion: no source" and the foreman must accept or delete it.
  - Removing a safety-critical line always raises a flag (`CRITICAL_LINE_REMOVED`).

### F-05 Source ambiguity check (MUST)

- **Does:** checks new and changed Norwegian lines before translation for wording that cannot be translated or acted on safely: undefined conditions ("if needed"), missing quantity or threshold, unclear actor, pronoun with no referent, idiom or slang.
- **AI task:** P3.
- **Outputs:** amber `SOURCE_AMBIGUOUS` flags with a one-sentence reason and a suggested clearer wording.
- **Behaviour:** an ambiguity flag on a safety-critical line blocks translation of that line until the foreman rewrites it or confirms the suggested wording. On other lines it is advisory.

### F-06 Translation of changed lines (MUST)

- **Does:** translates only lines with origin *changed* or *new* into each selected language. Lines with origin *reused* keep their stored translations. Lines with origin *parameter filled* get the parameter value inserted into the stored translation by code.
- **AI task:** P4, with the relevant glossary entries supplied as required terminology.
- **Outputs:** target-language text per line with origin `machine_new`.
- **Behaviour:** each line is translated in its own call or as a clearly keyed batch, so a failure in one line cannot corrupt another.

### F-07 Translation check engine (MUST)

The core of the prototype. It takes any pair of source line and target line and returns flags. It is used inside the foreman flow and on its own in the test bench, so it can also check a translation produced by another tool.

It runs in this order:

1. **D4 language support.** If the target language is not in the supported set, stop and raise `UNSUPPORTED_LANGUAGE`.
2. **D1 glossary check.** For every glossary term found in the source line, the target line must contain one of the accepted forms for that language. A missing form raises `GLOSSARY_MISMATCH`. A listed wrong term raises `FORBIDDEN_TERM`. A safety-critical concept in the source with no glossary entry raises `TERM_NOT_IN_GLOSSARY`.
3. **D2 number and unit parity.** Every number and unit in the source must appear unchanged in the target. Otherwise `NUMBER_UNIT_MISMATCH`.
4. **P5 back-translation.** An isolated call that receives only the target text and returns Norwegian. It never sees the original source.
5. **P6 comparison.** A separate call compares the original with the back-translation against a fixed checklist: negation, obligation level (must, should, may), numbers, direction and position, conditions, omissions, additions, changed object or tool. It returns a category and a one-sentence explanation in Norwegian and English. It does not return a confidence score.

- **Outputs:** zero or more flags (10.5), each with evidence: source, target, back-translation, expected term, found term, explanation.
- **Behaviour:** a line is *clean* only if all five steps raise nothing. Deterministic flags (D1, D2, D4) cannot be overridden by the model's opinion in P6.

### F-08 Flag list and resolution routes (MUST)

- **Interaction:** flags appear in a panel next to the document, red first. Each flag card shows, in Norwegian with an English toggle: which line, what the problem is, the original, the back-translation with the difference highlighted, and the routes available.
- **Routes the foreman can choose:**

| Route | What happens | Available when |
|---|---|---|
| **Use the approved term** | The line is translated again with the glossary term enforced, then checked again. After two failed attempts the route is disabled. | `GLOSSARY_MISMATCH`, `FORBIDDEN_TERM` |
| **Rewrite the Norwegian** | The foreman simplifies the source line. Translation and check run again. | All language flags, `SOURCE_AMBIGUOUS` |
| **Send to reviewer** | The line goes to the reviewer queue (F-12). The SJA cannot be signed as checked in that language until the reviewer decides. | All flags |
| **Brief this line orally** | The line is marked "to be explained by a bilingual colleague". The record states this. Sign-off becomes possible with status `signed_with_fallback`. | All red flags |

- **Behaviour:**
  - The foreman cannot dismiss a red language flag. He has no basis for it (CH-02).
  - Amber flags on lines that are not safety-critical can be acknowledged with a reason.
  - Only a language reviewer can mark a flag as a false alarm. This is counted (10.7).
  - Every choice is logged with a timestamp and the actor's role.

### F-09 Foreman review of the Norwegian content (MUST)

- **Does:** shows the full Norwegian SJA grouped by section (job steps, hazards, controls, protective equipment, stop rules, emergency). A summary bar reads, for example: "18 lines reused, 2 parameters filled, 3 lines changed, 2 red flags".
- **Technical re-check markers:** when a parameter changes, every line that references that parameter, or that the template lists as dependent on it, gets a `TECH_RECHECK` marker (D3). The foreman confirms each marked line or edits it.
- **Behaviour:** the foreman must confirm the Norwegian content as a whole before sign-off. This confirmation is about technical correctness for today's job, and it is separate from the language check.

### F-10 Understanding check (MUST)

- **When it is required (D7):** any safety-critical line is *changed* or *new*; or the foreman ticked "new worker"; or the foreman ticked "first time this crew does this job type". Otherwise the tool logs "understanding check not required" and moves on.
- **Worker view:** the worker picks a language, reads the SJA in that language in large type, then answers three scenario questions. Scenario questions ask what to do in a situation ("The wind picks up while the load is in the air. What do you do?"), with three or four plausible options. Yes-or-no questions and "did you understand?" are not allowed.
- **Device mode:** MUST is kiosk mode, where one phone or tablet is passed from worker to worker. No name is asked. The tool counts respondents only.
- **Questions:** taken from the template's pre-approved set, each linked to the lines it tests. The AI does not write questions during a job. If a changed or new safety-critical line has no approved question, the tool requires teach-back for that line.
- **Teach-back:** the foreman, through a bilingual colleague, asks the worker to explain the line in their own words and records one of two outcomes for the crew as a whole: "explained correctly" or "needed re-brief".
- **Re-brief loop:** a wrong answer never ends the flow. The worker sees "Talk to your foreman about this point before you start". The foreman sees which line was misunderstood and how many respondents missed it, re-briefs, and confirms the re-brief with a teach-back.
- **Standalone mode:** the question set can be run without showing the SJA. Needed for the baseline arm of T5, where workers answer after the firm's usual oral briefing.
- **Guardrails:** no names, no per-person results, no ranking. Results are stored per SJA as counts per question.

### F-11 Sign-off gate and traceable record (MUST)

- **Gate (D5):** the sign button is enabled only when: Norwegian content is confirmed (F-09); no red flag is open; every `TECH_RECHECK` marker is confirmed; and the understanding check is completed or not required.
- **Interaction:** the foreman reads a short statement, ticks a confirmation box and presses sign. English wording of the statement: "I have read this SJA. Every flag has been handled as shown below. I am responsible for briefing the crew before work starts." The Norwegian wording needs a native-speaker check.
- **Record contents:** template and version; glossary, prompt and model versions; per line its origin and verification state; every flag with type, route chosen and who resolved it by role; lines briefed orally; understanding-check counts and re-briefs; timings; sign-off role and time.
- **Statuses:** `signed` (all selected languages checked), `signed_with_fallback` (one or more lines briefed orally), `escalated` (waiting for a reviewer).
- **Behaviour:** the AI has no route to any signed state. The record states that it documents how the employer handled language risk and that the duty stays with the employer. It contains no worker names. Every page carries the prototype banner (F-16).

### F-12 Reviewer view and two-key verification (MUST)

- **Interaction:** a reviewer selects their role (language or technical), their language, and whether they are inside or outside the group. They see a queue of lines, glossary terms and questions awaiting their key.
- **For each item:** source, target, back-translation, flags, the glossary definition of each term. Actions: approve; correct (edit the text, which triggers a re-check); mark a flag as false alarm with a reason; reject with a reason.
- **Outputs:** key state per item (10.4), reviewer role, inside or outside, date, and time spent per item.
- **Behaviour:** a correction to a glossary term creates a new glossary version and is offered as an added accepted form. Newly approved lines can be added to the template as a new template version (PR-13). The reviewer's time is logged as set-up or checking time (F-13).

### F-13 Event log and timing (MUST)

- **Does:** records every step as an event (10.3) and measures time in categories:

| Category | Starts and stops |
|---|---|
| Input | From opening New SJA to submitting specifics, including clarifying questions |
| Machine | Each AI and deterministic processing step |
| Content review | Foreman reading and confirming the Norwegian text |
| Flag resolution | From opening the first flag to closing the last |
| Understanding check | From starting the worker view to the last re-brief confirmation |
| Sign-off | From enabled gate to signed |
| Reviewer | Per item in the reviewer view, tagged set-up or checking |

- **Two stores:**
  - an **anonymous event log** with no content and no names, mirroring what the pilot would collect (PR-08);
  - a **run evidence record** holding the synthetic inputs and outputs of each run, for the appendix.
- **Assist counter:** the observer taps a button each time they have to help the foreman. Stored per session (C6).

### F-14 Test bench and fixtures (MUST)

- **Interaction:** a group member picks a test (T1–T8) and a fixture, runs it, and sees expected against observed side by side.
- **Pair-check mode:** load a list of source and target pairs and run the check engine on each. Used for T6 with seeded errors and clean controls, and able to accept translations pasted from any other tool.
- **Outputs:** per item, the flags raised; per batch, catch count, false-flag count and missed items.
- **Behaviour:** the "observed result" and "learning or revision" fields are typed by a person. The tool never fills them in.

### F-15 Evidence export (MUST)

- Test log as a table with the exact Appendix A columns.
- Per-run evidence file that reads on its own: inputs, outputs in each language, flags, routes, timings, versions.
- The prompt file as used, with version history.
- An AI-use summary: model names and versions, dates of use, which step each model served.
- A verification summary: who held which key, by role, and whether they were outside the group.

### F-16 Prototype banner and data guardrails (MUST)

- A fixed banner on every screen, record and export: "Student prototype. Synthetic content. Not a valid SJA. Do not use to plan or carry out real work."
- Header fields excluded from model calls (D6).
- No field anywhere asks for a worker's name.
- The free-text notice in F-02.

### SHOULD features in brief

| ID | Behaviour |
|---|---|
| F-17 | A panel listing, for the current run, each step in order: prompt used, model, raw output, deterministic checks, human action. Read-only. |
| F-18 | Any saved run can be reopened and stepped through without a network connection. |
| F-19 | A plain timer with the same categories as F-13, for timing the firm's current practice and a human translation. Results land in the same log with arm = baseline. |
| F-20 | English added as a selectable output language with its own glossary column. |
| F-21 | A third template, added only after the first two have both keys in at least one language. |
| F-22 | For each new or changed Norwegian line, an optional shorter wording. The foreman accepts or ignores it. |
| F-23 | A play button per line and per question in the worker view, using the device's speech voices. Hidden if no voice exists for the language. |
| F-24 | A second translation from a different model or an independent call. Lines where the two differ in meaning get `TRANSLATIONS_DISAGREE`. |

---

## 7. User journeys and key workflows

### 7.1 Set-up, once per job type (group, reviewers)

1. A group member writes the Norwegian template from the curated hazard list, with a source reference per line.
2. The tool translates all lines and runs the check engine.
3. The language reviewer works through the queue in each target language.
4. The technical reviewer confirms the Norwegian content and the glossary concepts.
5. Lines with both keys become verified. The template gets version 1.
6. Reviewer time is logged as set-up time.

### 7.2 Happy path: reuse on a familiar job (foreman, about ten minutes)

1. Foreman opens the tool and picks "New SJA".
2. Picks a job type, fills three or four parameters, types two sentences of specifics, ticks Polish and Lithuanian.
3. Confirms the understood specifics. No clarifying questions.
4. Sees the Norwegian SJA. Summary bar shows most lines reused and a few changed.
5. Confirms two technical re-check markers.
6. One red flag: a glossary mismatch in Lithuanian. Chooses "Use the approved term". The re-check is clean.
7. The understanding check is required because a safety-critical line changed. Passes the tablet round the crew. One question is missed by two respondents. Foreman re-briefs through a bilingual colleague and confirms.
8. Confirms the Norwegian content, ticks the statement, signs.
9. Opens the record and exports it.

### 7.3 Alternative paths

| Situation | What the tool does |
|---|---|
| Slang, typos or mixed-language input (T3) | F-03 shows what it understood and asks about anything safety-relevant that is unclear. It does not guess. |
| Ambiguous Norwegian instruction (T7) | F-05 flags the line before translation and proposes clearer wording. A safety-critical line is not translated until fixed. |
| Unsupported language selected (T4) | No worker-facing document is produced in that language. The record says "interpreter required" and offers oral briefing for the whole SJA in that language. |
| Safety-critical concept missing from the glossary (T4) | `TERM_NOT_IN_GLOSSARY`, red. Routes: rewrite, send to reviewer, or brief orally. |
| Flag still red after two automatic attempts | "Use the approved term" is disabled. The remaining routes are rewrite, reviewer, oral. |
| Reviewer not available before work starts | Foreman chooses "Brief this line orally" and signs with fallback. |
| Model returns malformed output, or the call fails | One automatic retry. Then a visible error on that step with a retry button. Nothing is silently skipped, and the line stays unchecked and blocking. |
| Foreman deletes a safety-critical line | Red `CRITICAL_LINE_REMOVED`. He must restore it or give a reason, which goes in the record. |
| Worker answers wrongly | Re-brief loop (F-10). |
| A changed safety-critical line has no approved question | Teach-back is required for that line. |

### 7.4 Reviewer path

1. Reviewer opens the queue, states role, language and inside or outside the group.
2. For each item reads source, target and back-translation and decides.
3. A correction triggers a re-check and a new version.
4. A false-alarm decision is recorded with a reason.

### 7.5 Test path

1. Group member opens the test bench and selects a test and fixture.
2. Runs it. Sees expected against observed.
3. Types the observed result and the learning.
4. Exports the Appendix A row and the run evidence file.

---

## 8. UI and UX requirements

### 8.1 Screens

| # | Screen | Used by | Main content |
|---|---|---|---|
| 1 | Home | All | Role choice: Foreman, Worker, Reviewer, Test bench, Library. Banner. |
| 2 | New SJA | Foreman | Job type, parameters, specifics, languages, two tick-boxes. |
| 3 | Clarify | Foreman | Understood specifics, up to three questions. |
| 4 | Review | Foreman | Norwegian SJA with origin badges, summary bar, flag panel. |
| 5 | Flag card | Foreman | Problem, evidence, route buttons. |
| 6 | Understanding check: control | Foreman | Start kiosk mode, see counts per question, re-brief confirmations. |
| 7 | Worker view | Worker | Language choice, SJA text, three questions, feedback. |
| 8 | Sign-off | Foreman | Checklist of gate conditions, statement, sign button. |
| 9 | Record | Foreman, downstream | The traceable record. Print and export. |
| 10 | Reviewer queue | Reviewers | Items awaiting a key. |
| 11 | Library and glossary | All | Read-only templates and terms with state and version. |
| 12 | Test bench | Group | Tests, fixtures, pair-check mode, export. |

### 8.2 Navigation

- The foreman flow is linear: screens 2, 3, 4, 6, 8, 9, with a step indicator. Back is always possible before sign-off.
- Role is switched from the Home screen. No login.
- The test bench and the library are reachable from Home only, so they do not distract a foreman during a timed test.

### 8.3 Information hierarchy on the Review screen

1. Summary bar: reuse counts and open red flags.
2. Red flags.
3. Lines marked for technical re-check.
4. The rest of the document, grouped by section, reused lines visually quieter than changed ones.
5. Amber flags.

### 8.4 Usability requirements

| Requirement | Reason |
|---|---|
| Foreman interface in Norwegian (bokmål), with an English toggle | The foreman is the test user. The group must be able to read and defend it (CR-19). |
| Worker view in the worker's language only; short sentences; body text at least 18 px | End users with limited Norwegian. |
| Usable one-handed on a phone 375 px wide; tap targets at least 44 px | Site use. |
| A language flag is never shown only as foreign text | The foreman cannot read it (CH-02). |
| Colour is never the only signal; flags also carry an icon and a word | Legibility outdoors and for colour-blind users. |
| The sign button shows which gate conditions are still open | The foreman should see why he cannot sign. |
| No more than three clarifying questions per SJA | A foreman who is interrogated will stop using the tool. |
| Machine waiting time shows what is happening | Waiting is part of the measured time. |
| All interface strings in one table per language | Lets a native speaker check them in one pass. |

---

## 9. Client and user requirements from the proposal

| ID | Requirement in the proposal | How the prototype represents it |
|---|---|---|
| PR-01 | A checked multilingual SJA in minutes; signed in 10 minutes or less on a reused template | Linear foreman flow, timing by category, T2. |
| PR-02 | A library of verified templates, reused; only changed lines are checked again | F-04 code-level diff, origin badges. Modified by CH-08. |
| PR-03 | Translation, back-translation and glossary match; mismatches flagged red | F-06, F-07. Strengthened by CH-03. |
| PR-04 | The foreman is accountable and signs every SJA; the AI never approves | D5, F-11. |
| PR-05 | Understanding check only when needed, pre-approved questions, on a phone, with audio | D7, F-10. Audio is SHOULD (F-23). Redesigned by CH-05. |
| PR-06 | A traceable record of how language risk was handled, documenting the employer's diligence | F-11. |
| PR-07 | Understanding results per SJA, never used to rank or discipline workers | No names, counts per question only. |
| PR-08 | Anonymous event log: event type, language pair, review time; no names or content | The anonymous store in F-13. |
| PR-09 | Low confidence goes to an interpreter | 10.6 and the reviewer and oral routes. Modified by CH-10, CH-11. |
| PR-10 | No personal data or company documents in AI tools; synthetic cases | F-16, D6. |
| PR-11 | Narrow scope in job types and languages | Two templates, two target languages (CH-09). |
| PR-12 | Voice or text input | Text is MUST. Voice is COULD. |
| PR-13 | Newly verified lines join the library and the shared glossary | Reviewer approval creates new template and glossary versions (F-12). |
| PR-14 | Glossary, test set and method are open and do not depend on the Centre's tool | Open file formats; pair-check mode accepts any translation (F-14). |
| PR-15 | Everything testable with one construction company and the group itself | Every test has a desk variant with synthetic fixtures (12.2). |

---

## 10. Data and logic requirements

### 10.1 Data inventory

| Data | Real or mock in the prototype | Source and owner | Language | Sensitivity | Quality and update need |
|---|---|---|---|---|---|
| Curated hazard and control list per job type | **Real public content**, selected by the group | Public guidance from Arbeidstilsynet and EBA; reference stored per line | Norwegian | None | Must be checked by the technical reviewer. Update when guidance changes. |
| SJA templates | **Synthetic**, written by the group from the hazard list | Group | Norwegian source; Polish, Lithuanian targets | None | Draft until both keys exist. Versioned. |
| Glossary (about 40 terms) | **Real terms**, draft translations | Prototype kit; group | NO, EN, PL, LT | None | PL and LT are unverified drafts today. Needs accepted forms for inflected languages. Versioned. |
| Scenario question sets | **Synthetic**, written by the group | Group | All | None | Need the language key and a pilot run for clarity. |
| Job descriptions (8) | **Synthetic** | Prototype kit | Norwegian, some slang | None | Should resemble how a foreman writes. Check with the firm in visit 1. |
| Seeded mistranslations (10) and clean controls (10 or more) | **Synthetic by design** | Prototype kit; group | PL, LT | None | Must be confirmed as wrong, or as right, by a native speaker before T6 counts. |
| The firm's job types, parameters, minutes per SJA today | **Real**, collected in interviews | The firm | n/a | Business information | Kept outside the tool. Only generic job types enter the tool. |
| Worker answers | **Real but anonymous**: counts only | n/a | n/a | Low | No names, no per-person data. |
| Header fields (site label, date, foreman role) | **Mock or generic** | n/a | Norwegian | Could be confidential if real | Never sent to a model. |
| Timings and events | **Real measurements** | Group | n/a | None | This is the prototype's main evidence. |

### 10.2 Data files and structures

Open formats (JSON or CSV), so the same files can serve as the "public goods" described in the proposal.

**Glossary term**

| Field | Description |
|---|---|
| `term_id` | Stable identifier |
| `concept_en` | English gloss |
| `definition` | One plain sentence saying which object or action is meant, so a reviewer who is not a tradesperson picks the right word |
| `nb.forms[]` | Norwegian forms to look for in the source, including the stem that appears inside compound words |
| `<lang>.approved` | Approved target term |
| `<lang>.accepted_forms[]` | Inflected forms or stems that count as a match |
| `<lang>.forbidden[]` | Known wrong terms (for example the word for a simple belt where a fall-arrest harness is meant) |
| `critical` | True if a wrong term could cause injury |
| `<lang>.key_language`, `<lang>.key_technical` | Each: state, reviewer role, inside or outside the group, date |
| `version` | Glossary version in which the entry last changed |

**Template**

| Field | Description |
|---|---|
| `template_id`, `job_type`, `version` | Identity |
| `parameters[]` | `key`, label, type, unit, allowed range |
| `lines[]` | `line_id`, `section`, `text_nb`, `parameter_refs[]`, `depends_on_parameters[]`, `critical`, `source_ref`, `term_ids[]`, `translations{lang: {text, key_language, key_technical}}` |
| `questions[]` | `question_id`, `linked_line_ids[]`, text and options per language, correct option, `critical`, key states |

**SJA instance**

| Field | Description |
|---|---|
| `sja_id`, `template_id`, `template_version`, `created_at` | Identity |
| `header` | Local only |
| `parameter_values`, `specifics_confirmed` | Inputs |
| `languages[]` | Selected targets |
| `lines[]` | `line_id`, `origin`, `text_nb`, `tech_recheck` and its confirmation, `translations{lang: {text, origin, flags[]}}` |
| `understanding` | Required or not and why; per question: respondents, correct count, re-brief confirmed |
| `signoff` | Role, time, status |
| `versions` | Glossary, prompts, models |

**Flag**

| Field | Description |
|---|---|
| `flag_id`, `line_id`, `lang`, `type`, `severity` | Identity |
| `explanation_nb`, `explanation_en` | One sentence each |
| `evidence` | Source, target, back-translation, expected term, found term |
| `raised_by` | Rule identifier (D1…) or prompt identifier (P6…) |
| `resolution` | Route, actor role, time, reason where required |
| `reviewer_verdict` | Confirmed error, or false alarm, with reason |

### 10.3 Event log fields

`event_id`, `run_id`, `test_id` (optional), `arm` (flagship or baseline), `timestamp`, `actor_role` (foreman, worker, reviewer, system, ai), `event_type`, `time_category`, `duration_ms`, `sja_id`, `line_id`, `language_pair`, `flag_type`, `route`, `glossary_version`, `prompt_version`, `model_id`.

No names and no text content in this log.

### 10.4 Verification model: what "verified" means

Two independent keys per line, per glossary term and per question, in each target language.

| Key | Held by | What the holder confirms |
|---|---|---|
| **Language key** | A native or fluent speaker of the target language who can read the source or its English rendering | The target says the same thing as the source, in words a worker on site would understand. |
| **Technical key** | A person with trade or HSE competence, for example the foreman or the firm's HMS responsible | The Norwegian source is technically right for the job type, and each glossary concept is the right object or action. |

States shown in the interface:

| State | Condition |
|---|---|
| Draft | Neither key |
| Language-checked | Language key only |
| Technically checked | Technical key only |
| **Verified** | Both keys |

Rules:

- One person may hold both keys only if they genuinely have both competences, for example a bilingual tradesperson. The keys are still recorded separately.
- A key given by a group member is valid, and it is labelled "inside the group". It does not count as the outside perspective (CR-13).
- Any edit to a line removes both keys for that language.
- The technical key on the Norwegian source applies to all languages. The language key is per language.

### 10.5 Flag taxonomy

| Type | Raised by | Default severity | Meaning |
|---|---|---|---|
| `GLOSSARY_MISMATCH` | D1 | Red if the term is critical, else amber | A glossary term in the source has no accepted form in the target. |
| `FORBIDDEN_TERM` | D1 | Red | A listed wrong term appears in the target. |
| `TERM_NOT_IN_GLOSSARY` | D1 with P4 | Red if the line is critical | A safety-critical concept has no glossary entry. |
| `NUMBER_UNIT_MISMATCH` | D2 | Red | A number or unit differs between source and target. |
| `MEANING_SHIFT` | P6 | Red if the line is critical, else amber | Negation, obligation level, direction, condition or object changed. |
| `OMISSION_ADDITION` | P6 | Red if the line is critical, else amber | Content missing or added. |
| `SOURCE_AMBIGUOUS` | P3 | Amber; blocks translation on critical lines | The Norwegian cannot be translated or acted on safely as written. |
| `UNSUPPORTED_LANGUAGE` | D4 | Red | The target language is outside the supported set. |
| `AI_ADDED_CONTENT` | D3 | Amber | A new line has no entry in the hazard list. |
| `CRITICAL_LINE_REMOVED` | D3 | Red | A safety-critical template line was removed. |
| `TECH_RECHECK` | D3 | Marker, blocks sign-off | A line depends on a changed parameter. |
| `TRANSLATIONS_DISAGREE` | F-24 | Amber | Two independent translations differ in meaning. |

### 10.6 Low confidence, defined

A line is low confidence in a language, and must go to a reviewer or be briefed orally, when any of the following holds:

1. the language is outside the supported set;
2. a safety-critical concept has no glossary entry;
3. a red flag remains after two automatic re-translation attempts;
4. the line is safety-critical and its target text has no language key and is newly machine-translated with any flag at all.

A newly machine-translated safety-critical line with **no** flags may be signed, and the record marks it "machine-checked, not reviewer-verified". This is the residual risk the report must argue is proportionate.

### 10.7 Deterministic rules and metric definitions

**Rules**

| ID | Rule |
|---|---|
| D1 | Glossary check as in F-07 step 2. Matching is case-insensitive and by stem or listed form. Norwegian terms are matched inside compound words. |
| D2 | Extract numbers with their units from source and target. The multisets must be equal. Decimal comma and point are treated as the same. |
| D3 | Apply the adaptation operations in code. Compute origin by comparing text with the template. Mark `TECH_RECHECK` on lines whose `parameter_refs` or `depends_on_parameters` include a changed parameter. Raise `AI_ADDED_CONTENT` and `CRITICAL_LINE_REMOVED`. |
| D4 | Supported target languages are those with a glossary column and at least one reviewer recorded. Anything else is unsupported. |
| D5 | Sign-off gate as in F-11. |
| D6 | Model calls receive only: job type, parameter values, confirmed specifics, line texts and glossary entries. Never header fields. |
| D7 | Understanding check trigger as in F-10. |

**Metrics**

| Metric | Definition | Claim |
|---|---|---|
| Reuse rate | Lines with origin *reused* or *parameter filled*, divided by all lines in the SJA | C1 |
| AI catch count | Seeded errors that received a flag on the correct line, out of all seeded errors | C2 |
| False-flag count | Clean control lines that received a red flag, out of all control lines | C2 |
| Residual critical errors | Safety-critical errors still present after flag resolution, as judged by the language reviewer. Target: zero. | C2, C3 |
| Term accuracy | Glossary-term occurrences judged correct by the language reviewer after review, out of all occurrences | C2 |
| Correct-route count | Flags where the foreman chose a route that led to a correct outcome, out of all flags he handled | C3 |
| Time per signed SJA | Sum of foreman categories; machine time and reviewer time reported separately | C4 |
| Set-up time per template | Total reviewer and author time until both keys exist | C4 |
| Safety-critical answers correct | Per arm, correct first answers on critical questions, out of all first answers | C5 |
| Assists | Observer assists per session, first run against second run | C6 |

All results are reported as counts with their denominators.

---

## 11. AI chain and prompt contracts

### 11.1 The chain (CR-03)

| Stage | In the prototype |
|---|---|
| Inputs and data | Job type, parameters, typed specifics, crew languages; template, glossary, hazard list |
| AI tasks | Normalise input; adapt template; check source for ambiguity; translate changed lines; back-translate; compare |
| Model or tool | One general-purpose multilingual language model through its API; a second model or an isolated call for back-translation; deterministic code for D1–D7 |
| Output | Norwegian SJA with origin per line; target-language text; flags with evidence |
| Human decision or action | Foreman confirms specifics, confirms Norwegian content, picks a route for each flag, runs the understanding check, signs. Reviewers hold the keys. |
| Feedback or monitoring | Reviewer verdicts update glossary and templates as new versions; the event log produces the metrics in 10.7 |

### 11.2 Prompt contracts

Each prompt lives in one versioned file. All return structured data that the code validates. Use the lowest randomness setting the model offers.

| ID | AI task | Capability and why it fits | Receives | Must return | Must never |
|---|---|---|---|---|---|
| P1 | Normalise the foreman's text | Extraction. Free text holds a few structured facts. | Job type, parameter list, free text | Structured specifics; up to three clarifying questions | Guess a missing safety-relevant detail |
| P2 | Adapt the template | Constrained generation. The output is a small set of edits, not a new document. | Template lines with identifiers, confirmed specifics, hazard-list entries for the job type | Operations per line: keep, fill parameter, modify, add, remove; a hazard-list reference for each added or modified line | Return the whole document; reword a kept line |
| P3 | Check the source for ambiguity | Classification. Fixed categories of unclear wording. | New and changed Norwegian lines | Per line: clear, or a category, a reason and a clearer wording | Change meaning in its suggested wording |
| P4 | Translate | Generation under terminology constraints. | One line, target language, the glossary entries that apply | Target text; list of glossary terms used; any safety concept with no glossary entry | Use a term other than the approved one where an entry applies |
| P5 | Back-translate | Generation, isolated. | Target text only | Norwegian text | See or infer the original |
| P6 | Compare original with back-translation | Classification against a checklist. | Original, back-translation, line criticality | Per checklist item: same or different; a category; one-sentence explanation in Norwegian and English | Return a confidence number; override a deterministic flag |

If the model's output fails validation: one retry, then a visible error (7.3).

---

## 12. Test support and protocol

### 12.1 Fixtures the tool must ship with

| Fixture | Count | Used in |
|---|---|---|
| Templates with scenario question sets, of comparable length and difficulty | 2 (a third is SHOULD) | T1, T2, T5 |
| Synthetic job descriptions | 8, of which at least 1 in mixed slang with typos | T1–T3 |
| Seeded mistranslations | 10 per target language, of which at least 4 are **not** glossary-term errors: dropped negation, "must" turned into "may", changed number or unit, reversed direction, omitted condition | T6 |
| Clean control lines, correct translations | At least 10 per target language | T6 |
| Unsupported-language case | 1 | T4 |
| Missing-glossary-term case | 1 | T4 |
| Ambiguous Norwegian instructions | At least 2, for example "Sikre området før løft" (secure the area before lifting: how, by whom, how far?) and "Bruk sele ved behov" (use a harness if needed: when is it needed?) | T7 |
| Existing blank SJA form from a public source | 1 | T8 |

Seeded errors and controls must be confirmed by a native speaker before T6 results are reported. Until then the results are labelled "unconfirmed fixtures".

### 12.2 Tests

Thresholds marked * come from the proposal. The others are proposed here. All are the group's assumptions, set before testing, and must be labelled as such in the report.

| # | Type | Scenario | Run by | Pass if | Desk variant |
|---|---|---|---|---|---|
| T1 | Typical | The firm's most common high-risk job, crew's first language | Foreman with observer | Every hazard-list item relevant to the specifics is present; no unsourced control accepted unnoticed; term accuracy at least 95%* after review | Group member plays the foreman with a synthetic description |
| T2 | Typical | A second job reusing a template | Foreman | Signed in 10 minutes* or less of foreman time; flags appear only on changed lines; fewer assists than in T1 | Same |
| T3 | Edge | Mixed Norwegian-English slang with typos | Group | Correct specifics, or a clarifying question in place of a guess* | Is a desk test |
| T4 | Edge or failure | (a) Unsupported language. (b) Safety-critical term missing from the glossary. | Group | (a) No worker-facing document; record says interpreter required. (b) Red flag; line cannot be signed as checked.* | Is a desk test |
| T5 | Key assumption | Tabletop: the same people, two hypothetical jobs of comparable difficulty. One briefed the firm's usual way, one with the flagship. Order swapped for the second group or visit. Same question format after each. | Foreman, bilingual worker or workers, observer | Flagship gets at least as many safety-critical first answers right, in no more foreman time.* If the oral briefing does as well, the value case rests on time and record, and the recommendation is revised.* | Bilingual volunteers outside the firm, with a group member briefing |
| T6 | Quality | 10 seeded errors plus at least 10 clean controls, per language, in pair-check mode | Group, then the language reviewer confirms | At least 8 of 10 seeded errors flagged*; at most 2 of 10 controls flagged red; at least 2 of the 4 non-glossary errors flagged | Is a desk test |
| T7 | Failure (added, TR-07) | Ambiguous Norwegian instruction on a safety-critical line | Group, ideally with the foreman | Flagged before translation; the line is not translated until rewritten; the foreman's rewrite removes the ambiguity as judged by the technical reviewer | Group member rewrites |
| T8 | Comparison (added, TR-08) | The same job done three ways: (i) a blank existing form filled in by hand in Norwegian, (ii) that text translated by a human who speaks the language, (iii) the flagship. All timed in the same categories, **including checking and correction**. | Group and a native speaker | No pass mark. Report the three totals and where the time went. | Is a desk test |

Notes for whoever runs the tests:

- T5 uses hypothetical jobs only. Nobody carries out work on the basis of the prototype's output (CH-06).
- With one firm and a handful of people, T5 is an indication, not proof. The report must say so.
- After the first round, change at least one element (a prompt, a glossary entry, a rule, a question), raise its version, re-run the affected test, and keep both results (CR-12).

---

## 13. Technical and implementation guidance

**Constraints that come from the documents**

- Existing AI tools only. No training (CR-04).
- Synthetic or public data only in model calls (CR-17).
- Evidence must survive without a live link (CR-16).
- Every group member must be able to explain it (CR-19).

Neither the course nor the proposal prescribes a technology. The following is guidance.

| Topic | Guidance |
|---|---|
| Form | One single-page web application, responsive, no login. Role chosen on the Home screen. |
| State | Kept on the device and exportable as files. No database server is needed for the MUST scope, because kiosk mode keeps foreman and workers on one device. |
| Model access | One provider through a small server-side relay or a hosting platform's built-in model access. Never put an API key in client code. |
| Models | Translator and back-translator are separate configuration entries. Use a different model for back-translation if one is available. If not, use the same model in a fresh, isolated call and state this limitation in the evidence. |
| Reproducibility | Lowest randomness setting. Log the model identifier, prompt version and raw output of every call into the run evidence record. |
| Speed | Run per-line and per-language calls in parallel. Target: an adapted SJA with five changed lines in two languages is checked in about a minute. Without this, the ten-minute criterion cannot be met. |
| Structured output | Validate every model response against its expected structure. One retry, then a visible error. |
| Data files | Glossary, templates, hazard list, questions and fixtures as JSON or CSV in one folder, importable from the prototype kit spreadsheet. |
| Prompts | One file, versioned, loaded at start-up. It is copied into Appendix B as is. |
| Interface text | One string table per language. |
| Exports | Print-friendly pages or plain files. No document-signing library. |

**Do not build:** accounts, a database server, HMS integrations, retrieval pipelines, model fine-tuning, a design system, analytics dashboards beyond the test bench.

---

## 14. Acceptance criteria

Each criterion can be checked by a person with the running prototype.

| ID | Feature | Criterion |
|---|---|---|
| AC-01 | F-01 | Opening the library shows two templates and the glossary. Every target-language line shows one of the four states in 10.4. With seed data as delivered, no Polish or Lithuanian item shows "Verified". |
| AC-02 | F-02 | A new SJA can be started with job type, at least three parameters, free text and two languages in under two minutes by a first-time user. |
| AC-03 | F-02, F-16 | Inspecting the logged model calls for a run shows no header field value in any request. |
| AC-04 | F-03 | Given the slang fixture, the tool shows its understood specifics and either they are correct or it asks a clarifying question. It never proceeds on a guessed safety-relevant detail. |
| AC-05 | F-04 | For a run where only parameters changed, every non-parameter line is byte-identical to the template in all languages, and its origin badge reads "reused". |
| AC-06 | F-04 | A line added by the AI with no hazard-list reference appears with "AI suggestion: no source" and cannot be signed until accepted or deleted. |
| AC-07 | F-05 | Each ambiguous fixture line receives a `SOURCE_AMBIGUOUS` flag before any translation of that line is produced. |
| AC-08 | F-06 | In a run with three changed lines and twenty reused lines, exactly three lines per language are sent for translation. |
| AC-09 | F-07 | In pair-check mode, a pair with a changed number raises `NUMBER_UNIT_MISMATCH`; a pair with a forbidden term raises `FORBIDDEN_TERM`; a pair in an unsupported language raises `UNSUPPORTED_LANGUAGE` and nothing else. |
| AC-10 | F-07 | The back-translation request, as logged, contains the target text and not the original source. |
| AC-11 | F-08 | A foreman-role user has no control that dismisses a red language flag. The four routes are present and each changes the flag's state as specified. |
| AC-12 | F-08 | After two failed "Use the approved term" attempts on one flag, that route is disabled and the others remain. |
| AC-13 | F-09 | Changing a parameter marks every line that references or depends on it with `TECH_RECHECK`, and sign-off stays disabled until each is confirmed. |
| AC-14 | F-10 | With a changed safety-critical line, the understanding check is required. With no change and neither tick-box set, it is skipped and the log says why. |
| AC-15 | F-10 | A wrong answer shows the worker the "talk to your foreman" message, shows the foreman the affected line with a count, and sign-off stays disabled until a re-brief is confirmed. |
| AC-16 | F-10 | No screen asks for a worker's name, and the stored result contains counts only. |
| AC-17 | F-10 | The question set can be run in standalone mode without displaying the SJA. |
| AC-18 | F-11 | The sign button is disabled while any gate condition is open, and the screen lists the open conditions. |
| AC-19 | F-11 | The record of a run shows, per line, origin and verification state; per flag, type, route and resolver role; all versions; and timings. A line briefed orally is listed as such. |
| AC-20 | F-12 | A reviewer approval sets exactly one key. A line shows "Verified" only when both keys exist. Editing the line clears both keys for that language. |
| AC-21 | F-12 | A reviewer can mark a flag as a false alarm with a reason, and the false-flag count in the test bench changes accordingly. |
| AC-22 | F-13 | After a complete run, the log holds a duration for every time category that occurred in that run, and the anonymous log contains no free text and no names. |
| AC-23 | F-14 | Running the T6 fixture produces a catch count, a false-flag count and a list of missed items, for each language. |
| AC-24 | F-15 | The exported test log has exactly the six Appendix A columns, and the observed-result field is empty until a person types in it. |
| AC-25 | F-15 | A run evidence file opened on a computer with no network shows inputs, outputs, flags, routes and timings. |
| AC-26 | F-16 | The banner appears on every screen, on the record and on every export. |
| AC-27 | 8.4 | The foreman flow works on a 375 px wide screen with no horizontal scrolling. An English toggle changes every foreman-facing string. |
| AC-28 | 7.3 | With the model connection cut, the affected step shows an error and a retry control, and the line stays unchecked and blocking. |

---

## 15. Course compliance checklist

| Course requirement | Covered by | Verified through |
|---|---|---|
| CR-01 Central AI mechanism demonstrated | F-02 to F-11 | T1, T2; AC-05, AC-08, AC-18 |
| CR-02 Defined and meaningful AI role | P1–P6 | 11.2 |
| CR-03 Full chain from input to feedback | 11.1, F-13, F-17 | AC-22 |
| CR-04 Working prototype on existing tools | Section 13 | Running prototype |
| CR-05 Human review, escalation, correction, accountable decision | F-08, F-11, F-12 | AC-11, AC-18, AC-20 |
| CR-06 Failure modes detected, corrected, escalated | 10.5, 10.6, F-08 | T3, T4, T6, T7; AC-09, AC-12, AC-28 |
| CR-07 Data described | 10.1 | Table copied into the report |
| CR-08 AI capability named and justified | 11.2 | Table copied into the report |
| CR-09 Non-AI comparison | F-10 standalone mode, F-19 | T5, T8; AC-17 |
| CR-10 Measurable success criteria | 10.7, 12.2 | Thresholds fixed before testing |
| CR-11 Five or more structured tests of the required types | F-14 | T1–T8; AC-23 |
| CR-12 One documented revision | Versioning in F-13, F-15 | Before-and-after rows in the log |
| CR-13 Outside perspective | F-12 | Verification summary in F-15 |
| CR-14 Appendix A format | F-15 | AC-24 |
| CR-15 Appendix B content | F-15 | Prompt file and AI-use summary |
| CR-16 Evidence readable without a link | F-15, F-18 | AC-25 |
| CR-17 No personal or confidential data in AI tools | F-16, D6 | AC-03, AC-16 |
| CR-18 No fabrication; assumptions labelled | 10.4, F-14 | AC-01, AC-24 |
| CR-19 Every member can explain it | 8.4, F-17, section 13 | AC-27 |
| CR-20 Presentation focused on prototype and evidence | F-18 | Replay run |
| CR-21 No chatbot as a source | F-01, F-04 | AC-06 |
| CR-22 Measures for the authority | 10.7 | Same units as the pilot measures |
| TR-01, TR-09 Time including checking and correction | F-13 | T2, T8; AC-22 |
| TR-02 Repeatable way of working with AI | Assist counter | T1 against T2 |
| TR-03 What "verified" means | 10.4, F-12 | AC-20 |
| TR-04 Understanding beyond a completed quiz | F-10 | T5; AC-15 |
| TR-05 Manageable scope | 5.1, CH-09 | Two templates, two languages |
| TR-06 Outside feedback on outputs | F-12 | Verification summary |
| TR-07 Ambiguous instruction, problematic translation | F-05, F-07 | T6, T7; AC-07 |
| TR-08 Compare with templates and human translation | F-19 | T5, T8 |
| TR-10 No broadening | 5.4 | Services 1 and 3 not built |

---

## 16. Final consistency check

| Question | Result |
|---|---|
| Does every important course requirement appear in the specification? | Yes. CR-01 to CR-22 are each mapped in section 15. Requirements that concern the report only (benchmark, value case, roadmap, roles, risks, team statements) are deliberately excluded and listed in 5.4. |
| Does the prototype address the stated problem? | Yes for checking translation and for evidencing understanding. Only partly for "write and simplify": plain-language rewriting is SHOULD (F-22). |
| Are the core user needs represented? | Foreman: yes. Worker: yes, with the limit that audio is SHOULD. Owner: indirectly, through the time figures. Downstream recipients: through the record. |
| Are the most important features prioritised? | Yes. The build order in 5.5 puts the check engine first, because C2 is the riskiest claim and the cheapest to test. |
| Are requirements specific enough to implement? | Yes for logic and data. The concrete template content, glossary forms and question sets are data that must be written and reviewed, not specified here. |
| Contradictions between course requirements and proposal? | Five were found and resolved: CH-01 (unverified material called verified), CH-06 (real work steered by a prototype), CH-13 (unsourced AI drafting), CH-14 (site details sent to a model), CH-15 (scope beyond the flagship). |
| Are all major assumptions documented? | Yes, in the final section. |

**Issues that this specification cannot remove**

1. **T5 is weak evidence whatever the tool does.** One firm, a few workers, hypothetical jobs. The tool makes the comparison fair and timed; it cannot make it representative.
2. **"Verified" depends on finding reviewers.** Without an outside native speaker for a language, no line in that language may be called verified. The specification makes this visible. It cannot supply the person.
3. **The technical correctness of the Norwegian templates rests on the technical key.** If no one with trade or HSE competence reviews them, the hazard content is a sourced draft and must be described as such.
4. **Glossary matching will produce false flags in Polish and Lithuanian** until accepted forms are filled in by a native speaker. The first T6 round will probably show this. That is a legitimate first revision for CR-12.
5. **A machine-checked line with no flags can still be wrong.** Section 10.6 lets such a line be signed and labels it honestly. The report has to argue that this residual risk is proportionate, or the rule must be tightened so that every safety-critical machine translation needs a language key, which would slow the service and weaken C4.

---

## Assumptions Made

| ID | What was assumed | Why | Affects | Would change if |
|---|---|---|---|---|
| A-01 | The instructor's written feedback counts as a binding source, ranked above the proposal. | It is in the project, it comes from the person who assesses the work, and it names specific things the prototype must show. | Sections 3.2, 6 (F-05, F-10, F-12, F-13), tests T7 and T8 | The instructor says otherwise, or newer feedback replaces it. |
| A-02 | The prototype kit spreadsheet contains what the proposal says: prompts, a 40-term glossary in four languages, 8 synthetic job descriptions, 10 seeded mistranslations and a test log. | The file was not provided. | 10.1, 12.1, section 13 | The kit differs. Its real structure then defines the import format and may already cover some fixtures. |
| A-03 | The Polish and Lithuanian glossary entries are still unverified drafts. | The proposal says so as of 28 September. | CH-01, AC-01, 10.4 | A native speaker has already reviewed them. Their keys should then be recorded in the seed data with role and date. |
| A-04 | The foreman reads Norwegian and does not read the crew languages. | It is the typical case in the segment and the case in which the service is needed. | CH-02, F-08, 8.4 | The pilot firm's foreman is himself bilingual. Then C3 is easier, he could hold a language key, and T5's baseline changes. |
| A-05 | Target languages are Polish and Lithuanian, and the source is Norwegian bokmål. | The proposal's prototype uses them and its evidence points to these groups. | F-06, fixtures, reviewer needs | The firm's crew speaks other languages. The language set is configuration, but each language needs a glossary column and a reviewer. |
| A-06 | The group includes a native Lithuanian speaker who can hold the Lithuanian language key, and no confirmed Polish reviewer exists yet. | Needed to judge whether verification is feasible in each language. A group member's key is valid but is not outside feedback. | 10.4, T6, issue 2 in section 16 | No Polish reviewer can be found: Polish stays in the tool as "draft" and all verified claims are made for Lithuanian only. An outside Lithuanian reviewer is found: use them for CR-13. |
| A-07 | Two templates are enough, and the default job types are work at height and lifting with a crane or hoist. | Two typical tests and two comparable jobs for T5 need exactly two. The proposal's evidence highlights falls and being struck by objects. | F-01, 12.1, CH-09 | Visit 1 shows the firm's common high-risk jobs are different. Replace the defaults with the firm's job types, rewritten as synthetic cases. |
| A-08 | A public hazard checklist or guidance text exists from Arbeidstilsynet or EBA for the chosen job types, from which a sourced hazard list can be built. | The proposal refers to an "EBA checklist" as the test standard, and it was not provided. | F-04, T1, CR-21 | No suitable public source exists for a job type. Then choose another job type, or mark the content as the group's own draft. |
| A-09 | A small web tool is preferable to the spreadsheet-and-chat workflow. | Time criteria and foreman-run tests need something a foreman can operate (CH-07). The course allows either. | Section 13, most of section 8 | The group has no means to host or build a web tool. Fallback: build phase 1 only (check engine and test bench), run T1–T2 with a group member operating it, and state that foreman time was not measured directly. |
| A-10 | No technology is prescribed, and the builder can call a general multilingual language model through an API or a hosting platform. | Neither document names a stack or tool. | Section 13 | The course or the group requires a specific tool, or forbids API costs. |
| A-11 | Kiosk mode (one shared device) is acceptable for the understanding check. | It removes the need for shared state between devices, and no claim depends on workers using their own phones. | F-10, section 13 | The firm insists on own-phone use, or sharing a device proves impractical on site. Then the own-phone link moves from COULD to MUST and a small shared store is needed. |
| A-12 | The firm will take part in two visits and can supply a foreman and at least one bilingual worker. | The proposal plans this, and says the tests are not yet run. | T1, T2, T5, C6 | Access falls through. Every test has a desk variant (12.2), and T5 runs with bilingual volunteers. The evidence is then weaker and must be described as such. |
| A-13 | Running T5 as a tabletop exercise on hypothetical jobs is acceptable to the instructor as the key-assumption test. | A real-job test would let an unverified prototype steer high-risk work (CH-06). | T5, F-16 | The instructor wants a real-work comparison. This should be resisted on safety grounds unless the firm's own SJA process runs in full alongside. |
| A-14 | Thresholds that are not in the proposal are reasonable starting points: at most 2 of 10 control lines flagged; at least 2 of 4 non-glossary errors caught; about one minute of machine time; three clarifying questions at most; two automatic re-translation attempts. | Tests need pass marks set in advance, and the proposal gives none for these. | T6, F-03, F-08, section 13 | The first test round shows a threshold is unrealistic. Change it before the second round, record the change, and never after seeing the results it applies to. |
| A-15 | A newly machine-translated safety-critical line with no flags may be signed without a language key, labelled as machine-checked. | Otherwise every changed line needs a reviewer before work starts and the service cannot deliver "in minutes". | 10.6, C4, issue 5 in section 16 | T6 shows the check misses too many errors, or the instructor or a legal view rejects the residual risk. Then require a language key or oral briefing for every such line. |
| A-16 | Services 1 and 3 need no prototype. | The instructor said a second prototype is not needed, and the course asks for one flagship in depth. | 5.4 | The instructor asks to see the diagnostic working. A static mock-up would suffice. |
| A-17 | The foreman interface must be in Norwegian with an English toggle. | The test user is a Norwegian-speaking foreman, and the group must be able to read and defend every screen. | 8.4, AC-27 | The pilot firm's foreman prefers English, or every group member reads Norwegian. Either would let one language be dropped. |
| A-18 | The course PDF has no separate grading rubric, so evaluation priorities were inferred. | None appears in the document provided. | Prioritisation in section 5 | A rubric or weighting exists. Priorities should then be re-ranked against it. |
