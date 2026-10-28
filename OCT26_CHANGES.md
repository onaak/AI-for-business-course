# Changes of 26 October 2026: team suggestions and the Gravitas interview

> **Student prototype. Synthetic content. Not a valid SJA. Do not use to plan or carry out real work.**

The prototype was changed in place to carry out `docs/team_feedback_and_interview_tasks.md` with the group's five decisions of 26 October (Russian only; a written explanation can end in "signed"; painting and concrete both; the clean view plus a light accessibility check; Gravitas as main-contractor reviewer). This file says what was built for each task, what was not, and where the code departs from the task list.

## Read this first

- **Still nothing measured.** The live model has never run. The free set-up (Gemini free tier, Ollama, waits on "too many requests") is configuration plus code tested against a stand-in, not against Google or Ollama. Translation memory, the written explanation, Russian and the new templates all run on **scripted** replay answers. **Task 0 in the task list is still open, and it is the one that decides whether any of this is evidence.**
- **A lot more unchecked text.** About 250 new line translations (Russian for the two old templates; Polish, Lithuanian, Russian and English for the two new ones), 14 new glossary terms and a Russian column for all 60, 25 new questions in five languages, about 100 new Norwegian and English interface strings, 28 Russian worker strings. All written by the builder. All show "Draft: not verified". Each needs a language key from a native speaker.
- **Polish was added to the new templates as well.** The task list suggested leaving Polish to the two old templates to keep the review work in hand. It was added so that the concrete demo job could have a Polish crew. If the group has no Polish reviewer for painting and concrete, delete those translations rather than leave 51 Polish drafts nobody will check.
- **Four templates, where the specification allows two** (CH-09) and the teacher asked to keep examples manageable. This was the group's decision; the report should say why.
- **Sources were mapped to paragraphs by the builder.** Paragraph titles were checked against Arbeidstilsynet's English edition of the regulation on 26 October. Nobody with HSE competence has checked that each line says what its paragraph says. 20 lines are marked "Firmapraksis" (no public source; the firm must confirm), 11 cite a product's safety data sheet (synthetic products), and 6 still cite a chapter or a guidance page rather than a paragraph.
- **The written-explanation path rests on a test nobody has run (U4).** If machine translation hides a wrong answer from a foreman, this path must not end in "signed". The test screen is built; in replay mode the "translations" were written by the builder, so running it now proves nothing.

## 1. What was built, task by task

✅ built and covered by an automated test · ⚠️ built, replay mode only or untested with people · ❌ not done here

### 0.1 A real model without paying

| ID | Status | What and where |
|---|---|---|
| F1 Gemini free tier | ⚠️ | `.env.example` block A. No code needed beyond F3. Not run: no key. |
| F2 Ollama | ⚠️ | Block B, and block C: Gemini for everything, Ollama only for back-translation (`BACKTRANSLATE_BASE_URL`, `BACKTRANSLATE_API_KEY`, `MODEL_BACKTRANSLATE`). The gateway now holds a provider per task. Not run. |
| F3 Free-tier limits | ✅ | HTTP 429, 503 and 529 make the gateway wait (the server's `Retry-After`, else 2, 4, 8 … s, at most 60 s per wait) and try again, up to `LLM_RATE_LIMIT_WAITS` times (default 5). Waits do not count as the one ordinary retry. At most `LLM_MAX_PARALLEL` calls at once (default 3) and `LLM_MIN_INTERVAL_MS` between call starts. Each call's waiting time is logged with the call (`rateLimitWaitMs`), so machine time can be reported with and without it; the count is under "Technical: model connection" on Home (lab mode). `server/gateway.ts`; unit tests in `tests/pipeline/gateway.test.ts`. |
| F4 Record mode | ✅ (existed) | The free blocks set `GATEWAY_MODE=record`. One change: the worker's written answers (P7) are never stored as fixtures, see U3. |
| F5 Rules-only T6 count | ✅ | The bench shows "Seeded errors flagged, rules alone (D1, D2)" per language. Reportable once a native speaker confirms the fixtures. |

### 1.1 Translation memory (L1–L5)

| ID | Status | What and where |
|---|---|---|
| L1 | ✅ | A changed line whose Norwegian text exactly matches a template line with **both keys** reuses that translation with no model call. Origin "from memory", shown as verified, still run through the glossary and number rules. `src/core/rules/memory.ts`, `runLanguageCheck` in `flow.ts`. **Different from the task list:** there is no separate `tm.json`. The memory is read from the working data pack, so a line drops out of memory the moment an edit clears a key. |
| L2 | ✅ | Up to 3 verified pairs with the most word overlap go into the P4 request. P4 raised to 1.1.0. When memory is empty the request is exactly as before, so stored replay answers still match. |
| L3 | ✅ | Review → glossary: a language reviewer adds an accepted form and a forbidden word to a term; it takes that reviewer's key. `addTermForms` in `verification.ts`. |
| L4 | ✅ | Review → "Add to template": a line written for one job in a signed SJA on this device becomes a template line, as a draft without keys. Only translations that passed the check go with it. `promoteLine`. |
| L5 | ❌ | Measuring before and after needs a live model and reviewers who have given keys. With the seed data nothing has both keys, so the memory is empty. The working data pack on Ona's computer (29 keys, all kept by the merge) has two Lithuanian lines with both keys (h-03, h-06): the memory starts with those two. |

### 1.2 Questions and sources (Q1–Q5)

| ID | Status | What and where |
|---|---|---|
| Q1 | ⚠️ | Every rule line now has a source: a paragraph, a guidance page, a safety data sheet or "Firmapraksis". Only lines that hold a value from step 1 have none. See "Read this first" for what is unchecked. |
| Q2 | ✅ | 8 questions for work at height, lifting and concrete, 9 for painting (was 4 and 4). |
| Q3 | ✅ | Each worker gets the question fewest workers in this check have had so far; on a tie, a question that tests today's changed lines comes first. `nextQuestionIds` in `rules/understanding.ts`. |
| Q4 | ✅ | After answering, the worker sees "This is in your SJA:" and the lines the question tests, in his language. The foreman's screen and the record show question → line → source. |
| Q5 | ✅ | One question plus the explanation, in conversation and in writing. Three questions only in the multiple-choice fallback. |

### 1.3 Without a conversation (U1–U4)

| ID | Status | What and where |
|---|---|---|
| U1 | ✅ | Three paths, in this order: conversation; "The conversation is not possible now" with a reason (no common language / arrived late / other) → written explanation; "cannot write either" → three multiple-choice questions, which signs only as "Signert med reserveløsning". The path counts are on step 5 and in the record. |
| U2 | ⚠️ | On the phone: two open questions in the worker's language, then one scenario question. A new task, P7, only translates the answers into Norwegian ("keep mistakes, do not correct"). The foreman sees the translation next to the points to listen for and decides. The AI gives no verdict. Replay only. |
| U3 | ✅ | "Do not write names" on the worker screen; P7 accepts nothing but the language and the two answers; the text is not kept in the call log (shown as "[worker text not kept]") or in fixtures, except in bench runs with sample answers; the kiosk drops the text once the foreman decides; the label "machine translation, not checked"; the record states the path. ❌ Not tried with a real Cyrillic phone keyboard. |
| U4 | ⚠️ | Test bench → "U4 Written explanations": 10 sample answers (Lithuanian, Polish, Russian; some subtly wrong) are translated, a person judges each from the translation alone, then the intended answer is revealed and the score shown. Needs a live model and a person. |

### 1.4 Russian (R2–R5)

| ID | Status | What and where |
|---|---|---|
| R2 | ✅ | `ru` in the pack, glossary, all four templates, questions, `src/i18n/ru.ts` (worker screens), language names, the field version. |
| R3 | ✅ | Cyrillic units (м, мм, км/ч, м/с, кг, кН …) count as the same unit as their Latin form; Russian stems for every term. Unit tests with Cyrillic text in `tests/unit/oct26.test.ts`. |
| R4 | ⚠️ | `seeded-errors.ru.json` and `controls.ru.json`, 10 + 10, at least 4 errors no glossary catches. Marked unconfirmed until a Russian reader confirms them. |
| R5 | ✅ | The browser test checks for horizontal scroll on the Russian worker screen at 375 px; see `docs/screenshots/27-…` and `28-…`. Not looked at on a real phone. |

### 1.5 Painting, concrete, products (J1–J3, K1–K5)

| ID | Status | What and where |
|---|---|---|
| J1 | ⚠️ | "Maling og overflatebehandling innendørs": 26 lines, 9 questions. Demo job `jd-10` (Russian and Lithuanian crew, two-component varnish). |
| J2 | ⚠️ | "Betongstøp": 25 lines, 8 questions. Demo job `jd-11` (Russian and Polish crew, pump and formwork). |
| J3 | ❌ | Send both hazard lists to Loreta. A people task. |
| K1 | ✅ | Step 1 lists 2–4 synthetic products per template, each with pictograms, H codes and "synthetic example, not a real safety data sheet". |
| K2 | ✅ | A picked product brings its own lines (protective equipment, first aid, handling), which are translated and checked like any other line. ❌ The EU's official translations of H and P phrases were not used. |
| K3 | ✅ | GHS pictograms next to the lines on the worker screen, with names in the worker's language. Simplified drawings, not the official artwork. |
| K4 | ⚠️ | A fixed line in both templates: "Les sikkerhetsdatabladet … Stoffkartoteket finner du: {stoffkartotek}", where the place is a step-1 value. ❌ "Whom to ask" is not in the line yet; adding it means new translations in four languages. |
| K5 | ✅ | Questions on solvent in the eye, isocyanates, wet cement on skin and similar, linked to the SDS lines. |

### 1.6 Rules library (B1–B5)

| ID | Status | What and where |
|---|---|---|
| B1, B2 | ✅ | Every line and hazard entry has tags from the fixed list and a risk level (green / yellow / red). Values are the builder's; a technical reviewer should check them. |
| B3 | ✅ | `/rules`, "Regler og tiltak": filter by tag, job type, risk, verification, text; "only what went wrong on site" puts lines misunderstood or not followed first. Each row: the line, its source (title, §, link, date checked), the languages it is verified in, and both counts. |
| B4 | ✅ | The header: "Utdrag brukt i SJA-malene. Ikke en fullstendig regeloversikt. Sjekk gjeldende regelverk." with the date sources were checked. |
| B5 | ✅ | CSV of the filtered list (the header line comes first), and print to PDF. |

### 1.7 The clean version and sharing (V1–V6)

| ID | Status | What and where |
|---|---|---|
| V1 | ✅ | An eye switch in the header, next to NO / EN: **Full** or **Ren / Clean**, kept on this device. With `APP_MODE=field` on the server the clean view is fixed and the switch is hidden. Home shows "Lag dagens SJA", the worker entry and the rules library. Hidden, and closed by URL: the test bench, baseline timer, saved-runs list, stand-alone question set. Also hidden: trace panel, technical status and observer link. **Changed after review (26 Oct, evening):** the clean view keeps NO / EN (with English help lines under the Norwegian SJA text when EN is chosen), and there is no separate `?mode=` address any more. |
| V2 | ✅ | The review pages open in both views, from the Reviewer tab on Home (changed in the evening: before, the clean view did not link to them). |
| V3 | ✅ | The banner and the privacy panel stay. |
| V4 | ✅ | axe runs in the browser tests on five screens (field Home, rules library, step 1, Russian worker screen, main-contractor summary) and fails on serious or critical findings. It found low contrast on grey text, now fixed. Not a WCAG audit. |
| V5 | ⚠️ | `npm run share` builds and starts the clean version, then you run `cloudflared tunnel --url http://localhost:5173`. `.trycloudflare.com` and ngrok addresses are allowed. ❌ The screen recording for Loreta is a people task. |
| V6 | ✅ | `npm run share` forces replay mode, field mode and a **read-only data pack**: nobody with the address can change or reset the reviewers' keys. Anyone with the address can still create SJAs and write runs to `evidence/`. |

### 2. From the interview

| ID | Status | What and where |
|---|---|---|
| I1 | ✅ | "SJA-oppsummering" for the main contractor: one printable page from the record (job, date, template version, languages, flags handled, how understanding was checked, observation, sign-off). No integration. |
| I2 | ✅ | T8 has a fourth arm: a chatbot draft and chatbot translation, whose translation goes through "Check any translation" on the bench. |
| I3 | ✅ | "Sent to the AI model / never sent" on step 1 and in the record. |
| I4 | ✅ | The observation now has "misunderstood" and "rule not followed" per line. Separate events; the rules library counts both. |
| I5, I6, I7, I8 | ❌ | People and report tasks: questions for Loreta, label her figures as estimates, check the §19a date on Lovdata, ask her for a subcontractor as pilot firm. |

## 1b. Changed after review (26 October, evening)

| Asked for | Done |
|---|---|
| Keep NO / EN in the clean view | Done. With EN, the English help lines show under the Norwegian SJA text, as in the full view. |
| Full / clean view switched like the language, with an eye icon, not by a separate address | An eye switch in the header next to NO / EN: **Full** and **Ren / Clean**. `?mode=` is gone. Hidden when the server fixes the clean view (`npm run share`). Not called "Demo": the app already uses "demo" for the stored AI answers, which both views have. |
| The help translation without the "Help translation:" label | Only the smaller grey italic English text under the Norwegian line. The note at the top of each step explains it once. |
| Tabs for the different people who use the tool | Home has a tab per role: **Bas / Foreman**, **Arbeider / Worker**, **Leder / Manager**, **Kontrollør / Reviewer**, and in the full view **Prosjektgruppe / Project group**. Each tab opens with one sentence on who it is for and what they do there. The worker tab explains the four steps on the phone and lists SJAs waiting for the workers; the manager tab has the rules library, signed SJAs with the main-contractor summary, and what is sent to the AI. The tab you chose is kept on this device. |
| A clearer clean view | Besides the tabs: "Show the translations and back-translations" now reads "Show the translations and how they were checked"; the help-line note is reworded. The six foreman steps were walked through in both languages and otherwise left as they were. |

## 1c. The clean view without templates (29 October)

Asked for: in the clean view, the SJA should look like the foreman's own, with no mention of templates anywhere; only the yellow prototype banner stays. It must still work, and nothing may be saved back into the templates.

| Where | Full view (unchanged) | Clean view now |
|---|---|---|
| Step 3, top | "23 of 26 lines come straight from the template…", counts of reused, changed and new lines | "Your SJA has 26 lines. 3 of them are written for today's job: read those first." Counts: lines for today's job, values from step 1, red flags |
| Step 3, "You need to decide on these" list | Shown | Gone. Each line that depends on a changed value still asks "Is it right for today's job?" on the line itself, and the bar at the bottom still says how many are left, with "Show me" |
| Step 3, legend, "The template is a draft", demo-mode note | Shown | Gone |
| Line badges | Reused / Changed / New | No badge on standard lines; "For today's job" on the others |
| "In the template: «…»" under a changed line | Shown | Gone. "Use the template text again" reads "Use the previous wording" |
| Home, step help texts, step 4 summary, step 5 and 6 wording, rules library header, role tabs | Mention the template, or "changed" lines | Reworded around "today's job" (`src/i18n/clean.ts`) |
| Record and main-contractor summary | "Built from the template", "Built from a verified template", template and data-pack version, translation memory, markdown export | Hidden |
| Feeding back | Misunderstandings and lines written for one job feed the reviewers | An SJA made in the clean view is marked `cleanView`. Its lines are not offered to reviewers for the template, and its misunderstandings and "not followed" counts are left out of the review screen and the rules library |

**What did not change:** the six steps work exactly as before, the demo job picker on step 1 stays (in demo mode only those jobs work), and the review pages (English, for reviewers) still talk about templates, because that is what reviewers approve. A browser test walks the whole clean flow in Norwegian and checks every screen for "template", "mal", "gjenbrukt" and "reused".

## 1d. Step 2 in demo mode (29 October)

A foreman answering the clarifying questions in demo mode could pick an answer with no stored AI reply, then got a technical error and could not go on or change the answer. Now: choices without a stored reply are greyed out ("Ikke med i demoen") before anyone picks them, typed own answers are not offered in demo mode, "Endre svarene / Change the answers" brings the questions back, and if a reply is still missing the error says so in plain words. The server answers which inputs have a stored reply (`POST /api/llm/available`); in live mode every choice is open.

**Later the same day:** every combination of answers to jd-03's two questions now has stored answers, through the whole flow (4 combinations, checked by `npm run fixtures:demo` up to a language check with no flags). "Over gjerdet" gives a cordon line for both sides of the fence; "De er ikke kontrollert ennå" adds a safety-critical line that the slinger checks slings and shackles before the lift. 20 new scripted fixtures, 4 new Polish and Lithuanian draft translations. The greying-out stays for any other case without a stored answer. Removing a detail on step 2 and then building the SJA still needs a stored answer for exactly the details that are left, so in demo mode that path can still stop with the plain-language message.

## 2. Things you may trip over

- **Your working data pack is kept.** On start, new seed content (Russian, the new templates, new questions, tags) is merged into `data/working/pack.json`. Nothing you edited and no key you gave is overwritten. "Reset to seed data" still exists.
- **Stored replay answers.** P4 is now version 1.1.0, and all scripted fixtures were rebuilt. Answers recorded with P4 1.0.0 will not match.
- **The oral check now rotates questions,** so two workers in one check usually get different questions.

## 3. Checks run

112 tests without a browser (29 more than before this update), 18 browser tests in replay mode at 375 px (3 new), type check, seed-data check (every stored translation in four languages passes the deterministic rules), a check that the read-only data pack refuses writes. **None of this is evidence for the report.**
