# SJA Forstått: prototype

> **Student prototype. Synthetic content. Not a valid SJA. Do not use to plan or carry out real work.**

A foreman adapts a reusable SJA template to today's job. AI translates only what changed, checks the translation against a glossary and by back-translation, and flags problems. A person resolves every flag, each worker explains the hazard and the measure in their own words, and the foreman signs.

Built from `SJA_Forstatt_Prototype_Specification.md` (what it must do) and `docs/implementation_plan.md` (how). Where the two differ, the plan wins. **Updated on 6 October 2026 for service brief v3 and for usability: see `V3_CHANGES.md`.** The specification and the plan still describe the v2 understanding check (three questions); the code follows v3.

## Read this first

- **Out of the box the prototype runs in replay mode with scripted answers.** No API key is needed, but the "model answers" were written by the builder, not produced by a model. They are labelled on screen and in every export. **Nothing produced in this mode is evidence for the report.**
- **Live mode is built but has not been run against a real model.** No API key was available during the build. The adapters were tested against a local stand-in server only. Expect to adjust prompts after the first live run.
- **Every Norwegian, Polish and Lithuanian text is an unchecked draft.** The interface shows this honestly ("Draft: not verified"). Nothing is verified until reviewers give keys.

`ASSUMPTIONS.md` lists the decisions made during the build. `docs/requirements_checklist.md` maps every requirement to its implementation and to how it was checked. `V3_CHANGES.md` records what changed for brief v3.

## 1. Install

You need **Node.js 20.19 or newer** (22 recommended). Check with `node -v`.

```bash
npm install
```

## 2. Start

```bash
npm run dev
```

Open **http://localhost:5173**. One process serves both the interface and the local API. Stop it with Ctrl+C.

On a phone or tablet on the same network, open `http://<the laptop's address>:5173`.

## 3. Try it (replay mode)

On the Home screen choose **Lag dagens SJA** and pick a demo job at the top of step 1. Use the NO / EN switch at any time. Each step says what to do, and the next action stays at the bottom of the screen.

| Test job | What it shows |
|---|---|
| `jd-01` | The main path. Three lines change, one glossary flag in Lithuanian, cleared with "use the approved term". Then the understanding check: each worker reads, explains to the foreman, and answers one question. Sign, then note what you saw when the job started. Record. |
| `jd-02` | An unsourced AI suggestion. A meaning shift in Polish that only back-translation finds. A flag that survives two automatic attempts. Reviewer and oral routes. |
| `jd-03` | Slang with typos: two clarifying questions. Pick "Gjennom porten" and "Anhukeren kontrollerer løftestroppene før bruk". |
| `jd-04` | An ambiguous safety-critical line (use the suggested wording), a concept missing from the glossary, and an unsupported language. |
| `jd-09` | Parameters only. Needs no model in any mode. Pure reuse. |
| `jd-05` to `jd-08` | Live mode only. |

In replay mode ("demo mode" on screen), text you type yourself has no stored answer. Your own free text on step 1 gives a visible error with a retry button, a line you add on step 3 cannot be checked, and a rewrite on step 4 is not applied. The screens say so. That is the intended behaviour of replay.

Other screens, all from Home. For reviewers: **Kontroller og godkjenn** (keys, corrections, the queue of lines a foreman sent, and the lines workers misunderstood) and **Bibliotek og ordliste**. For the project group: **Testbenk** (T3, T4, T6, T7, the Appendix A test log, exports), **Signerte SJA-er og protokoller** (open a record and step through its trace), **Stoppeklokke uten verktøyet** (baseline arm for T5 and T8) and **Bare kontrollspørsmål** (the question set on its own, for T5).

## 4. Live mode (needed for any evidence)

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Meaning |
|---|---|
| `GATEWAY_MODE` | `replay` (default), `live`, or `record` (live, and each answer is stored as a replay fixture) |
| `LLM_PROVIDER` | `anthropic` or `openai-compatible` |
| `LLM_API_KEY` | Your key. It stays on the server and never reaches the browser. |
| `LLM_BASE_URL` | Only for `openai-compatible` endpoints |
| `MODEL_DEFAULT` | Model name for all tasks. Check your provider's current list. |
| `MODEL_BACKTRANSLATE` | Optional different model for back-translation (P5). Recommended. |
| `MODEL_P1` … `MODEL_P6` | Optional per-task overrides |
| `LLM_TEMPERATURE` | `0` for least randomness. Leave empty if the model rejects the setting. |
| `PORT` | Default 5173 |

Restart `npm run dev`. The Home screen shows the mode. A chat subscription does not include API access: you need an API key from the provider's developer console.

To prepare the presentation: set `GATEWAY_MODE=record`, run the main path once, then set it back to `replay`. The run then replays from real recorded answers.

## 5. Tests

```bash
npm test             # 83 rule, contract and pipeline tests (no model, no browser)
npm run typecheck
npm run data:check   # runs the deterministic rules over every stored translation
npx playwright install chromium   # once, for the browser tests
npm run test:e2e     # 15 browser tests in replay mode, foreman flow at 375 px width
```

The browser tests use a private copy of `data/` and a private evidence folder under `test-results/`. They rewrite the images in `docs/screenshots/`.

These tests show that the software does what the plan says. They are not evidence for the report. Only the test bench in live mode and tests T1–T8 with people are.

## 6. Where things are

```
data/seed/            glossary (46 terms), two templates, hazard lists with public source references
data/fixtures/        test jobs, seeded errors, controls, ambiguous lines, test definitions
data/fixtures/llm/    replay fixtures, one file per task (origin: scripted or recorded)
data/working/pack.json   seed plus reviewer edits, with version (created on first start)
prompts/              P1–P6, each with a version header; CHANGELOG.md
server/               index.ts (three route groups), gateway.ts, providers/, evidence.ts, data.ts
src/core/             pure library: rules D1–D7, check engine, flow, flags, verification, metrics
src/screens/          Home, Foreman (six steps), Worker, Review, Bench, Runs, Baseline
src/i18n/             nb.ts and en.ts (foreman), pl.ts and lt.ts (worker)
evidence/runs/        one self-contained JSON file per saved run
evidence/calls/       one line-delimited log of model calls per run
evidence/exports/     Appendix A, summaries, records
tests/                unit, pipeline, e2e
scripts/              check-seed.ts, build-demo-fixtures.ts, demo-script.ts
```

The foreman's site label, date and role stay in the browser and in the run file. They are never sent to a model: the server accepts only a fixed list of fields per task and rejects anything else.

## 7. Before using it with people

1. Get an API key and run the test bench (T6) in live mode. Measure machine time: the ten-minute criterion depends on it.
2. Have a native speaker confirm the seeded errors and the controls, then set `"status": "confirmed"` in the four files in `data/fixtures/`.
3. Have a Norwegian speaker check `src/i18n/nb.ts` and both templates. Have Polish and Lithuanian speakers check `pl.ts`, `lt.ts`, the template translations and the questions.
4. Have a person with trade or HSE competence check the templates and the source references in `data/seed/hazards/`.
5. Replace `data/fixtures/blank-sja-form.md` with a real form before T8.
6. Delete the demo run in `evidence/runs/` and `evidence/calls/` once a real run exists.
7. Put the folder under Git (`git init`) and commit after every test session. `.env` is ignored.

## 8. Good to know

- **Updating from the first version.** Nothing to do: run `npm install` and `npm run dev` as before. SJAs kept in the browser by the first version are converted when the app loads. A signed one keeps what was recorded, marked "recorded with the earlier check"; an unsigned one starts its understanding check again. `data/working/pack.json` is unchanged in shape.
- **Resetting.** Home → "Data på denne enheten" clears browser storage. Review → Summary → "Reset to seed data" restores the data pack.
- **Changing a prompt** makes the stored replay answers stop matching, by design: raise the prompt's version, note it in `prompts/CHANGELOG.md`, and record again (`npm run fixtures:demo` rebuilds the scripted demo set from the seed data).
- **Changing a glossary term in the review screen** changes what is sent to the translator for lines that use that term, so those lines stop matching in replay. Reset to seed data before a replay demonstration.
- **Port in use.** Set `PORT` in `.env`.
- **Not built** (see the checklist): audio, the 2-minute briefing script, a hand-out per language, a third template, a second independent translation, accounts, hosting, HMS integrations.
