# V3 changes

> **Student prototype. Synthetic content. Not a valid SJA. Do not use to plan or carry out real work.**

6 October 2026. The existing prototype was changed in place. Nothing was rebuilt. This file records what service brief v3 changed against v2, which of those changes reached the prototype, the usability problems found, and what was done about them.

## Read this first

- **Nobody outside the build has used the new screens.** "Easier to understand" rests on my own walkthroughs and one automated cold walkthrough by a second agent that had not seen the code. No foreman, worker or reviewer has tried it. Treat the usability claims as untested until test T1.
- **Still replay mode with scripted answers.** No API key, so nothing here is evidence. The v3 changes needed no new model call: the replay fixtures are unchanged.
- **More unchecked wording.** In Norwegian and in English, 190 interface strings are new and 55 are reworded. In Polish and in Lithuanian, 9 worker strings are new and 1 is reworded. All are drafts.
- **The specification and the plan still describe the v2 check** (D7, F-10: three questions). They were inputs, so I did not edit them. This file, `ASSUMPTIONS.md` (items 30 to 44) and `docs/requirements_checklist.md` (section 10) say where the code now differs.

## 1. v2 → v3: what changed, and what I did

### Changed in the brief and changed in the prototype

| Brief v3 | Prototype before | Now |
|---|---|---|
| **Step 4, Check understanding.** v2: three pre-approved questions per worker. v3: each worker explains the key hazard and the safety measure in their own words (teach-back) and answers **one** "what do you do if …" question. | Quiz first: three multiple-choice questions per worker. Teach-back only per line, for new critical lines without a question, judged once for the whole crew. | Per worker: read → explain to the foreman → one question. The foreman's part of the screen lists what to listen for and records "explained correctly" or "something was misunderstood → walked through again → explained correctly now", with the points missed. One question, the one that tests a changed line first. Also possible without the phone ("record a worker orally"), which replaces the old interpreter fallback. |
| **"The foreman watches the start of the job and notes anything misunderstood."** New in v3. | Not there. | After sign-off the foreman records "nothing was misunderstood" or ticks the lines. Home reminds him. It is added to the saved run without losing its trace. No free text, no names. |
| **"Misunderstandings are logged anonymously and fed back into the template."** New in v3. | Not there. | Logged as events with template and line only. The review screen marks those template lines ("misunderstood on site: 2×"), can filter to them, and the verification summary export lists them. |
| **"Understanding: not a signature or a quiz score."** New in v3. | The record led with "correct first answers on safety-critical questions". | The record leads with the workers' own explanations, then the one question, then the observation, and says so in one sentence. The answer count is still shown. |
| **Measure 1:** total minutes per signed SJA, counting drafting, checking and correction, against e.g. templates plus human translation. | One "foreman time" total (four categories). | The record and the baseline timer show **total time to signature** (drafting + checking + correction, including waiting for the tool and a reviewer), grouped by phase. The foreman's own time is kept for the ten-minute criterion. Baseline wording says to time both methods through checking and correction. |
| **Measure 5:** share of foremen who run the workflow without adviser help (replaces "starts a second AI use case"). | An assist counter existed, shown only as a number. | The record states "Completed without help: yes / no". The observer control is labelled as being for the observer or adviser. |
| **"What verified means in practice"**: language reviewer + technical reviewer, two keys, then the foreman signs. New section. | Two keys existed. The explanation was one sentence on the review screen. | The review screen opens with a short "What verified means here". Role help uses the brief's wording. Step 3 now tells the foreman when the template is still a draft, and the record states "Built from a verified template: yes / no (n of m lines)". |

### Changed in the brief, outside what the prototype covers

Service 3 renamed "Day-90 Review and Next Step", second AI use case made optional; the journey "from interest, to testing, to using one AI workflow"; set-up wording. The prototype covers the flagship only, so nothing changed. Test definitions T5 and T8 (`data/fixtures/tests.json`) were reworded to match v3's comparison text.

### Already in the prototype before v3

Two-key verification with a language and a technical key; the ambiguity check before translation; timing by category with checking and correction; the baseline timer with a human-translation category; the assist counter. These came in through the teacher feedback in the specification. Left as they were.

### Unchanged between v2 and v3, and left alone

Steps 1–3, 5 and 6; the trigger ("new worker, a new job type or a changed SJA", built as: a changed or new safety-critical line, a new worker, or a first-time job type); the tests; the guardrails. **Gaps against both briefs were not filled, because v3 did not change them:** no audio, no 2-minute briefing script, no clean hand-out per language, newly verified lines do not join the library automatically, services 1 and 3 are not built.

### Where v3 contradicts itself

- Step 4 says one scenario question. The set-up still says "prepares three check questions" and test 5 still says "workers answer the three check questions". I followed step 4. The templates keep four approved questions, of which one is asked. The stand-alone question set (for test 5, both arms) still asks all of them.
- The table puts the observation inside "Check understanding", before "Sign and brief". A job starts after it is signed, so the observation is recorded after sign-off and does not block signing.

## 2. Usability problems found

**"What do I do next?"**
1. Home showed eight equal tiles. Nothing said where to start, or that six of them are not for a foreman.
2. Steps were six numbers without names. No step said what it was for.
3. The next action was at the bottom of long pages (26 lines on step 3). When it was disabled, the reason was somewhere else.
4. "Continue" stayed bright on steps 4 and 5 when the SJA could not be signed. The dead end only showed on step 6.
5. The signed screen had one button and no word about briefing the crew or what comes after.
6. The step indicator ticked steps that still had open flags.

**Words and marks**
7. Step 2 "Forstått" and step 5 "Forståelse" (and the product name) are almost the same word.
8. Internal terms on the foreman's screens: "Raised by D1", "Parameter filled", "Technical re-check", "Replay", "Unsourced" on ordinary template lines.
9. A red warning triangle on almost every reused line. Nothing said it means "safety-critical", or that a grey line opens on a tap.
10. In a flag, differing words in "the original" were struck through, which reads as deleted. "Back-translation" was never explained.
11. Counts that disagreed: "2 flags must be handled" under "Open flags (3)". Plural errors ("1 flags").
12. A floating clock button with no label sat on top of form fields.

**Forms and choices**
13. Step 1 was one long list: seven language boxes, the local-only fields last and unexplained, a notice about "replay" in technical terms.
14. Nothing told the foreman that the template is an unverified draft, while Home said templates are approved before use.
15. Removing a detail on step 2 could not be undone.
16. An AI suggestion showed "Delete the line" and "Remove" side by side. A changed line did not show what the template said.

**Results**
17. The record was one scroll of about 17,800 px on a phone, with the trace, reviewer tools and identifiers mixed into the SJA.
18. Workers read 26 lines with nothing showing which three were new today.
19. A worker who answered wrongly still ended on a large green tick.

## 3. Usability changes made

- **Home.** One main button ("Lag dagens SJA"), a "continue where you left off" card, a six-line "how it works", then two labelled groups: for reviewers, and for the project group. Technical status is folded away.
- **Every step** has a name, one sentence on what to do, and what comes next. Step 2 is now "Detaljer", step 5 "Forstått / Har arbeiderne forstått?".
- **The next action stays at the bottom of the screen** on every step. When it is not available it says why, with "Show me" to jump to the thing that is missing. On steps 4 and 5 it turns from primary to secondary while something still blocks signing.
- **The step indicator** shows a warning instead of a tick on a passed step that still has something open.
- **Step 1** is in four numbered groups (the job, the crew, what is special today, for the record). Unsupported languages are folded away. Demo mode is explained in plain words where the choice is made, and jobs that need a live model cannot be picked. A half-filled form survives a reload. An invalid form scrolls to the first error.
- **Step 3** opens with one sentence ("23 of 26 lines come straight from the template. Read the 3 that are new or changed today"), then what must be decided, then a legend. A changed line shows the template's wording. The template's draft status is stated.
- **Step 4.** Plain "Found by the glossary check". "Choose how to handle it". Differing words are highlighted, not struck through, and back-translation is explained. One sentence says what blocks signing and what does not.
- **Step 5** starts with the count and the start button, then how the check works, then what to listen for.
- **Step 6** shows what is missing first, in red with a link to the step, and what is in order as quiet ticks. After signing: "What do you do now?", the observation, a new SJA.
- **The record** opens with "In short" (nine facts). Everything else is a section that opens on a tap: about 2,650 px in place of 17,800. Print and export still include everything.
- **Workers** see "new or changed today" first, in a marked block. A wrong answer ends on "talk to your foreman", not a tick.
- **Wording.** "Value from step 1" for "Parameter filled", "Check that the line still fits" for "Technical re-check", "Waiting for the tool" for "Machine". Singular forms where a count is 1.
- Each screen opens at its top. The observer control is a small labelled link in the step header.

## 4. Defects found while testing, and fixed

Found by the walkthroughs and by a code review of the change.

| Defect | Fix |
|---|---|
| A worker could be shown a translation that the tool had flagged red and nobody had handled (possible before this change too). | A flagged line is shown to the worker as "your foreman will explain this point". Step 5 says how many such lines there are. |
| After workers were checked, the foreman could add a safety-critical line, or change the line they were asked about, and still sign. An open re-brief could disappear the same way. | If the key lines, their text or the question change after a check, the earlier checks are set aside, the foreman is told, and signing is blocked until a worker is checked again. |
| Saving the observation could replace the saved trace with a one-entry trace if reading the file failed once. | One save routine: read the file, append, write. If the file cannot be read, nothing is written. |
| An observation whose save failed could not be saved later. | Step 6 and the record check for it and finish the save. |
| The worker screens still accepted checks on a signed SJA (browser Back). | Refused in the core rule and on the screen. |
| The log and the trace held one line per worker with language, outcome and the points missed. With one speaker of a language on the crew, that is one person's result. | Per-worker entries no longer hold language, outcome or points. Counts are kept in the SJA. |
| In demo mode a rewrite on step 4 left a line that could neither be checked nor undone. | A rewrite that cannot be checked is not applied; the screen says so before and after. |
| A check that could not run was headed "The Norwegian text is ambiguous". | Headed "The line could not be checked", with a way back to the template's wording. |
| The record scrolled sideways on a phone when the line list was open, and in English always. | Long chips wrap. |
| A browser error was logged on every sign-off (a lookup for a file that did not exist yet). | The lookup no longer counts as an error. |

## 5. Decisions you may want to overrule

1. The observation comes **after** sign-off and does not block it.
2. The check is complete when **at least one** worker is checked and no wrong answer is waiting for a re-brief. The tool does not know the crew size, so it cannot require everyone.
3. **One** question for the whole check, the same for each worker.
4. "Fed back into the template" is a **marker for reviewers**, counted from the log on this device. Nothing rewrites a template by itself. Checking the same crew again after a change counts their misunderstandings again.
5. The trigger was **not** widened to any changed line.
6. Data saved by the earlier version is converted when the app loads. A signed run keeps what was recorded, marked "recorded with the earlier check". An unsigned one starts its check again.

## 6. Still weak

- Step 3 is still a long page. The reused lines are compact, not hidden.
- In demo mode a foreman cannot usefully add or reword a line. The screen now says so, but a first-time user will still try.
- On a phone the flags table in the record scrolls sideways inside its own box.
- Reloading the page while a worker holds the phone discards that worker's unfinished check (nothing is recorded).
- The reviewer, test bench and baseline screens got less attention than the foreman's journey. They are English only and dense.
- The foreman's part of the teach-back screen shows the Norwegian lines. A foreman who does not speak the worker's language is told to use a bilingual colleague; the tool gives no other help.

## 7. How it was checked

- 83 automated tests without a browser (was 70): the v3 rules, the reset after a change, the observation, the data conversion, the totals.
- 15 browser tests in replay mode at phone width (was 14): the full journey with three workers (two on the phone, one orally), the observation, the feedback on the review screen, the print-everything record, demo-mode honesty.
- Type check, seed-data check, production build.
- Walkthroughs in Norwegian and English at 375 px and 1280 px with no console or page errors, a 12-page print of the record with the banner on every page, and a conversion of data stored by the earlier version.

None of this is evidence for the report. It shows the software does what this file says.

## 8. Added on 8 October: English help lines

With the interface in English, every Norwegian SJA text the foreman sees (details, clarifying questions, lines, suggestions, flags, key points, observation) gets a grey line underneath marked "Help translation". A note under each step title says these lines are not part of the SJA and are not checked. They never appear in Norwegian, on worker screens, in the printed record or in exports.

Where the English comes from: a line still worded as in the template uses the template's own English; other texts in the demo jobs use `data/fixtures/help-en.json` (41 texts, written by me, unchecked); in live mode anything else costs one extra model request, logged under the run id `help-translation` and kept on the device. In demo mode, text you type yourself shows "no help translation in demo mode".

## 9. Fixed on 8 October: page reloads

- **Approving in the review screen reloaded the page** and jumped to the top. Cause: the development server watched the folders the app writes to (`data/working`, `evidence`). Every save, including every approval, model call and sign-off, counted as a code change and reloaded the browser, which is also what left white screens between steps. Those folders are no longer watched (`vite.config.ts`), and the style tool no longer scans them.
- **If a screen ever fails to draw**, it now reloads itself, up to three times a minute. Only if it still fails does it show Reload and Home buttons, so a real fault cannot loop forever.
- Checked: approving keeps the scroll position with no reload, and the whole foreman journey runs with no reload. A unit test guards the setting. The browser tests could not reproduce the original reload, because their data folder was never watched.

## 10. Fixed on 8 October: "destroy is not a function"

- **Cause of most remaining crashes, including the worker test on the phone.** Three screens scrolled to the top after each step with a one-line effect. Newer browsers return a promise from scrolling; React took that as a clean-up function and crashed on the next step. In the worker test this happened right after choosing a language, and reloading lost the choice, so it went back to the language list.
- **Fix:** the three effects (`src/main.tsx`, `src/screens/Worker.tsx`, `src/screens/Foreman.tsx`) no longer return anything.
- **Checked:** all browser tests now run with scrolling made to behave like the newer browsers (`tests/e2e/helpers.ts`). The old code fails with the same error; the new code opens the worker test in the chosen language. 84 unit tests and 15 browser tests pass.
