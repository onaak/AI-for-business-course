# Assumptions and decisions made during the build

Built on 5 October 2026 from `SJA_Forstatt_Prototype_Specification.md` v1.0 and `docs/implementation_plan.md` v1.0. Where the two differ, the plan was followed (it says so itself, and lists 16 changes, SC-01 to SC-16).

## The ones that matter most

| # | Assumption or decision | Why | What changes it |
|---|---|---|---|
| 1 | **No API key was available, so the default mode is replay with scripted answers.** The answers in `data/fixtures/llm/` were written by the builder (`scripts/demo-script.ts`) and carry `origin: "scripted"`. They are not model output. | Plan question Q1, default: "build against the gateway with replay; add the provider adapter when the key exists". Both adapters were built anyway. | A key. Set `GATEWAY_MODE=record`, run the flows, and the scripted answers are replaced by recorded ones. |
| 2 | **Scripted answers behave the way each prompt contract says the model should**, with one deliberate miss per language in the T6 fixture (a wrong word that translates back to the original word), so that the "missed items" list is exercised. | Test doubles should show the mechanism, including its known blind spot (specification CH-03). | Irrelevant once live. The scripted counts (5 of 10 by rules, 9 of 10 with back-translation) must never be reported. |
| 3 | **All seed content was drafted by the builder**: 46 glossary terms, two templates, eight questions, nine test jobs, 20 seeded errors, 20 controls. Every key is "not given". | Plan Q2 default: "the builder drafts all seed data, marked as draft". The prototype kit spreadsheet was not provided. | The kit, or native-speaker and technical review. |
| 4 | **Source references point to paragraph headings** in *Forskrift om utførelse av arbeid* chapters 17 and 18 and to one Arbeidstilsynet guidance page, read on arbeidstilsynet.no on 5 October 2026. No one has checked that each line matches its reference. Lines with no reference show as "unsourced". EBA guidance was not available. | The course forbids citing a chatbot as a source (CR-21) and fabricating references (CR-18). | A technical reviewer's check. |
| 5 | **Job types: work at height, and lifting with a crane. Languages: Polish, Lithuanian, plus English.** | Plan Q4 default. English added because it costs data only (F-20). | The firm's real job types and crew languages. |
| 6 | **The Norwegian interface text is an unchecked draft**, including the sign-off statement. | The specification says it needs a native-speaker check. | One Norwegian speaker reviewing `src/i18n/nb.ts`. |

## Product behaviour where the documents left a choice

| # | Decision | Reason |
|---|---|---|
| 7 | A parameter counts as "changed" when its value differs from the template's default. Lines that reference or depend on it get a technical re-check marker. | The documents say "when a parameter changes" without saying against what. A default per parameter was added to the data model. |
| 8 | Content cannot be confirmed in step 3 until every re-check marker is confirmed, every AI suggestion is accepted or deleted, every ambiguous safety-critical line is reworded and every removed safety-critical line is restored or given a reason. The sign-off gate checks the same conditions again. | Keeps all Norwegian-content decisions in the step whose time is "content review", and avoids translating a line that may still be deleted. |
| 9 | With no free text, P1 and P2 are skipped and every line is kept. | A parameter-only run then needs no model at all, which makes AC-05 demonstrable in any mode. |
| 10 | The ambiguity check (P3) is one call per line. | A failure in one line cannot affect another, and replay stays stable. |
| 11 | A new line is safety-critical if its hazard-list entry is, or the model marks it so, or it contains a safety-critical glossary term. A line the foreman adds by hand is always treated as safety-critical. | Conservative, and decided mostly by code. |
| 12 | Choosing "brief this line orally" settles every open flag on that line in that language. | The whole line is then explained by a bilingual colleague. |
| 13 | A reviewer can only mark a false alarm, or correct a text, in their own language. "Reject" returns the flag to the foreman with the reviewer's reason. | Specification F-08: only a language reviewer can mark a false alarm. |
| 14 | *Replaced on 6 October 2026 by items 30 to 37 (service brief v3).* Was: up to three questions per check, teach-back only for a new safety-critical line with no approved question. | Brief v3 changed step 4. |
| 15 | Clarifying questions may carry answer options. | Faster for the foreman, and it lets the slang test run in replay. |
| 16 | False-flag count in the bench = controls flagged red, plus pairs with a reviewer false-alarm verdict. A seeded error counts as caught only if at least one of its flags is not a false alarm. | Makes AC-21 ("the count changes accordingly") well defined. |
| 17 | Glossary Norwegian forms match as substrings. A form written `=bas` matches a whole word only. A match inside a longer match of another term is dropped ("kran" inside "kranfører"). Stems match at the start of a word; `a|b` accepts either. | Needed to keep false flags down with substring matching (SC-07). |
| 18 | Reviewer judgements after a run (term accuracy, residual critical errors, correct route) are entered on the run's record by a language reviewer. | The specification defines these metrics as reviewer-judged but gives them no screen. |
| 19 | Term accuracy, residual errors and correct-route counts are shown only as entered. Nothing is estimated. | CR-18. |

## Technical choices

| # | Decision | Reason |
|---|---|---|
| 20 | One process on one port: the Express server mounts Vite as middleware in development. | Easiest to run and to explain. The plan asks for "one small server process". |
| 21 | Replay fixtures are one JSON file per task, keyed by a hash of task, prompt version and input. | Readable and diffable; six files instead of hundreds. |
| 22 | The flow logic lives in `src/core/flow.ts` rather than in `pipeline/normalise.ts` and `pipeline/adapt.ts`. `pipeline/` holds the check engine and translation. | Same layering as the plan, fewer files. |
| 23 | The three stores are in `src/state/stores.ts`. Screens are one file per route (the foreman wizard has a folder). | Size. |
| 24 | Reviewer, bench, runs-list trace labels and baseline screens are **English only**, with their strings in the screen files. Foreman and record strings are in `nb.ts` and `en.ts`; worker strings in `pl.ts`, `lt.ts` and `en.ts`. | The plan requires Norwegian with an English toggle for the foreman. Reviewers read "the target language plus Norwegian or English". |
| 25 | The Appendix A **CSV** carries no banner line, so that it stays a clean six-column table. The Markdown export of the same log carries the banner. | AC-24 and AC-26 pull in different directions for CSV. |
| 26 | Signed runs are saved to `evidence/runs/` automatically. After a successful save the trace is dropped from browser storage to keep it small; the record screen reads it from the file. | Browser storage is limited to a few megabytes. |
| 27 | Model names have no default in code. `.env.example` gives example names only. | "Model names are configuration" (plan). Names change. |
| 28 | Dependencies are current major versions (React 19, Vite 8, Tailwind 4, Zod 4, Express 5, Vitest 5). Node 20.19 or newer is required. | The plan names the libraries, not versions. |
| 29 | Git is not initialised and nothing is committed. | Left to the group. `.gitignore` is in place. |

## Service brief v3 and the usability pass (6 October 2026)

The brief's v3 changed step 4 ("Check understanding") and added "What verified means in practice". The prototype was changed in place. `V3_CHANGES.md` has the comparison. The specification and the plan were not edited, so D7 and F-10 there still describe the v2 check.

| # | Decision | Reason | What changes it |
|---|---|---|---|
| 30 | **One check per worker: teach-back, then one scenario question.** The foreman judges the explanation ("explained correctly", or "something was misunderstood", then a new walkthrough, then "explained correctly now"). A worker is only recorded once the explanation is right. | Brief v3, step 4. v3 also says "three check questions" in two other places; step 4 is the newer text. | The group deciding the other reading. `QUESTIONS_PER_CHECK` in `rules/understanding.ts`. |
| 31 | **The same one question for every worker in a check**: the approved question that tests a changed line, else a safety-critical one. The templates keep four approved questions. | Questions are approved once, not generated (brief, "Why this is faster and safer"). | More approved questions per template. |
| 32 | **What the worker should explain** is today's changed or new safety-critical lines, at most five. If none changed (new worker, first-time job), it is the first hazard, the first control and the lines the question tests. | The brief says "the key hazard and the safety measure" without saying which. What changed today is what a routine briefing would miss. | A reviewer marking key lines in the template. |
| 33 | **The observation of the start of the job is recorded after sign-off and does not block it.** It is asked for only when the check was required. Lines are ticked; there is no free text. | The brief lists it under step 4, before "Sign and brief", but a job starts after it is signed. No free text keeps names out (PR-08). | If the firm signs after work has started, move the gate. |
| 34 | **The check is complete when at least one worker is checked and no wrong answer is waiting for a re-brief.** | The tool holds no names and does not know the crew size. | A crew-size field. |
| 35 | **Checks are set aside if the SJA changes afterwards**: when the key lines, their Norwegian text or the question change after a worker was checked, the counts go back to zero and the foreman is told. | A worker was checked against the SJA as it was then. Without this a foreman could add a safety-critical line after the check and still sign. | Nothing. This is a safety rule. |
| 36 | **"Fed back into the template" is a marker for reviewers.** Each misunderstanding is one event with template and template line (or "job-specific" for a line written for one job). The review screen counts them per line from the log on this device. Nothing rewrites a template. A crew checked again after a change is counted again. | Smallest thing that closes the loop the brief describes, with no names and no text. | A shared store, if the prototype is ever hosted. |
| 37 | **The log and the trace do not say which language, which outcome or which points a single worker had.** They say that a worker was checked, on the phone or orally. | With one speaker of a language on a crew, a line per worker with language and outcome is that person's result. The earlier version logged the language with the answer count. | Nothing. |
| 38 | **A worker is never shown a translation with an open blocking flag.** The line reads "your foreman will explain this point". | The earlier version showed the flagged text if the foreman went on before handling the flag. | Nothing. |
| 39 | **Total time to signature** = input + waiting for the tool + content review + reviewer + flag resolution + sign-off. The understanding check is shown separately. The foreman's own time (four categories) is kept for the ten-minute criterion. | Brief v3, measure 1: "counting drafting, checking and correction". | The group's own definition of the measure. |
| 40 | **"Built from a verified template"** is reported per SJA as yes or no, with the number of template lines that have both keys in every crew language. With the seed data it is always no, and step 3 tells the foreman. | Measure 2 exists in both briefs; the foreman was not told that the template is a draft. | Reviewers giving keys. |
| 41 | **The trigger was not widened.** "A changed SJA" still means a changed or new safety-critical line. A run with changed values only needs no check. | The brief's wording is the same in v2 and v3, and the specification narrowed it (D7). | The group deciding that any change needs a check. |
| 42 | **The stand-alone question set still asks every approved question**, with no teach-back. | It is for test 5, where both briefings must be followed by the same set. | A v3 definition of test 5. |
| 43 | **In replay mode a rewrite that cannot be checked is not applied**, in any mode a failed check is headed "could not be checked", and a template line can be set back to the template's wording. | A line that can neither be checked nor undone was a dead end. | Irrelevant in live mode unless a call fails. |
| 44 | **A half-filled step 1 form is kept in the browser tab's session storage** until the SJA is created. | A reload emptied the form. It never leaves the device. | Nothing. |
| 45 | **English help lines** under Norwegian SJA text when the interface is in English. Template wording uses the template's English; demo texts use `data/fixtures/help-en.json`; in live mode one extra P4 request (target English) per new text, logged as `help-translation`. Never part of the SJA, the record's printed text, exports or worker screens. | The project group and the teacher do not read Norwegian. | Drop it once everyone reading the screens reads Norwegian. |

## Not built, on purpose

| Item | Why |
|---|---|
| Audio (F-23), second translation (F-24) | Moved to COULD or dropped by the plan (SC-11). |
| The 2-minute briefing script and a clean hand-out per language (brief, step 5 and "What the firm gets") | In both v2 and v3 of the brief, in neither the specification nor the plan. Not added in the v3 update, which changed only what v3 changed. The signed screen points to the record instead. |
| Third template (F-21) | The plan allows it only after the first two have both keys in one language. |
| Promoting a reviewed SJA line into the template | The plan reduces versioning to one working pack with a version number (SC-10). Reviewers can edit and approve template lines, glossary terms and questions. |
| Accounts, database, hosting, HMS integration, legally valid signature | Out of scope in both documents. |
| A real blank SJA form for T8 | None was available. `data/fixtures/blank-sja-form.md` is a marked placeholder. |
| One recorded happy-path run from a live model | Needs a key. A scripted demo run is shipped in its place, labelled. |
