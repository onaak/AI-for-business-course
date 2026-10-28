# Team suggestions and the Gravitas interview: prototype tasks

26 October 2026. **Inputs:** the team's seven suggestions; the interview with the Gravitas CFO (20 Oct 2026, 38 min); gravitasbygg.no; Arbeidstilsynet's stoffkartotek page; the prototype as recorded in `claude/prototype_build_status.md` and `V3_CHANGES.md`. Timestamps (≈mm:ss) point into the interview transcript.

---

## 0. Settle these four points before building anything

**1. For this firm, the interview weakens the core problem.** Gravitas handles language risk by how it organises work. Teams speak one language, the project managers speak the crews' languages, and each meeting is held in the language of the people attending (≈20:00). Byggherreforskriften §19a asks for exactly that: at least one person on each team who can communicate with the others. Gravitas reports no accidents in 5–6 years. Loreta places the language problem on large sites with 200–300 people (≈20:40). The pain she actually named is **compliance**, not comprehension. Workers wear goggles while someone watches and take them off when nobody does (≈17:00). In her words, the signature "just proves to the government that you actually did something" (≈18:14).
→ Gravitas is a weak test of claim C5 (understanding) and a good test of the record, reuse and subcontractor angles. Do not present this interview as confirming the language problem.

**2. Gravitas is not in the target segment.** It has 45 people and is the main contractor (totalentreprise). The segment is subcontractors with 5–20 employees. Gravitas is still useful from the other side: as main contractor it must collect its subcontractors' risk assessments, and those "go in manually" (≈12:30–13:40). Gravitas is therefore the **receiver** of the segment's SJA records. Use it as the main contractor's view and as the outside perspective (CR-13), not as the pilot firm.

**3. Their real alternative is a chatbot they already use.** The administration uses ChatGPT, Claude, Gemini and DeepSeek. A project risk assessment went from about one day to 1–2 hours (≈25:50–27:10, her estimate). Workers use a translate button built into their messaging app, and about 20% of workers use AI (≈29:48). Drafting and translating are therefore not where the service adds value. The value has to be what a chatbot does not give: checked terminology, flagged lines, evidence that workers understood, and a record. The prototype and T8 must show this against a chatbot, not against paper.

**4. The live model has still never run.** In replay mode, nothing below that involves "learning", better translations or Russian produces anything you can measure. Replay mode is fine for showing the flow to Loreta, but it is not evidence for the report. **Task 0: run a real model for free (no paid key, decided 26 Oct; see 0.1), run T6 live, and measure how long the machine steps take.**

### 0.1 A real model without paying

The server already has an "openai-compatible" adapter (`server/providers/openai-compatible.ts`), so both options below need only `.env` changes, no new code.

| ID | Task | Size |
|---|---|---|
| F1 | **Gemini free tier (recommended for the evidence).** Create a key in Google AI Studio without enabling billing. `.env`: `GATEWAY_MODE=record`, `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, `MODEL_DEFAULT=` a Flash model from Google's current free list. Two catches. First, on the free tier Google may use what you send to improve its products. That is acceptable only because every input is synthetic (CR-17), and Appendix B must say so. Second, check that the free tier works from Norway when you create the key. | S |
| F2 | **Ollama on your Mac (no account, nothing leaves the laptop).** Install Ollama and pull one model. `.env`: `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_API_KEY=ollama` (any text; the server only calls a provider when the key is not empty), `MODEL_…=` the model name. Small local models translate Lithuanian, Polish and Russian noticeably worse, and a MacBook Air is slow. Best used as the **second model for back-translation** (`MODEL_BACKTRANSLATE`), which gives you the independent P5 the specification asks for (section 13) at no cost. | S |
| F3 | **Handle free-tier limits.** The gateway retries once and then shows an error. It has no wait on HTTP 429 ("too many requests"), and free tiers limit requests per minute. An SJA with 5 changed lines in 2 languages makes about 30 calls. Add a wait-and-retry on 429 that does not count as the one retry, and limit parallel calls to 2–3. Machine time measured on a free tier is slower than paid; report it as an upper bound. | S |
| F4 | **Use `record` mode, not `live`.** Every real answer is then saved as a replay fixture. The scripted demo answers can be replaced by real ones (build status, next step 4), and the shared demo (V5) runs on real recorded output without calling the model. | S |
| F5 | **Report the model-free part now.** The glossary and number checks (D1, D2) need no model. Their T6 catch and false-flag counts can be reported today, labelled "deterministic checks only". | S |

---

## 1. The team's suggestions: verdict and adjusted tasks

### 1.1 "The model should learn from itself and from provided translations"

**What's wrong:** "Learning from itself" means feeding unreviewed machine output back in. That reinforces the model's own errors and empties "verified" of meaning, and "verified" is the one thing the teacher asked you to define. Fine-tuning is also outside what the course expects (CR-04) and could not be shown in the time left.

**Defensible version:** the system improves through a memory of human-verified translations, not through training. Only lines and terms that hold both keys feed back. This is PR-13, which is already in the specification and not yet built (build status, item 11).

| ID | Task | Size |
|---|---|---|
| L1 | **Translation memory.** Store every line pair that holds both keys (`data/working/tm.json`: textNb, lang, text, keys, template version). When a changed line's Norwegian text exactly matches a stored entry, reuse it without a model call (origin "from memory"). | M |
| L2 | **Examples in the prompt.** For a changed line, put the 3 most similar verified pairs from memory into the P4 prompt. Simple word overlap is enough; no vector database. Raise the P4 version. | S |
| L3 | **Reviewer corrections → glossary.** When a language reviewer corrects a term, offer to add the corrected form to `stems` and the wrong one to `forbidden`, as a new glossary version. F-12 does part of this; finish it. | S |
| L4 | **Promote verified lines into the template** as a new template version, through a reviewer button. Not automatic. | M |
| L5 | **Measure it.** Run T6 and one T2 job with an empty memory, then a filled one. Report model calls per SJA, flags per SJA and term accuracy. This also gives you the before-and-after revision that CR-12 asks for. | S |

**Never:** write model output to memory without both keys, or let P6 or any model mark something verified.

### 1.2 "More questions, and show where the information comes from"

**Partly right, with three catches:**
- Lines without a source: 8 of 22 (work at height) and 11 of 24 (lifting) have no `sourceRef`, and the rest cite a chapter, not a paragraph. Unless sourcing is fixed first, "show the source" will show "no source" for about 40% of lines.
- Who can read the source: a worker cannot read a Norwegian regulation. The source belongs on the foreman's and manager's screens and in the record. The worker should see the SJA line, in his own language, that the question tests.
- What more questions do: more questions per worker slides back toward the quiz that the teacher and brief v3 moved away from.

**Adjusted:** a larger question bank, with the same small number asked of each worker.

| ID | Task | Size |
|---|---|---|
| Q1 | **Source every line.** Fill `sourceRef` for all 46 lines down to the paragraph (e.g. Forskrift om utførelse av arbeid §17-x), with the URL and the date checked. A line with no public source is labelled "firm practice". The technical reviewer checks. | M |
| Q2 | **Grow the bank** to 8–10 questions per template (now 4). Each one links to lines, and through them to sources. Each new question needs a translation and a language key in every language; that is the real cost. | M |
| Q3 | **Rotate questions.** Give each worker a different question, favouring today's changed lines. In kiosk mode the same phone is passed round, so today everyone gets the same question and has just heard the previous worker's answer. | S |
| Q4 | **After the answer**, the worker sees "This is in your SJA:" and the linked line in his language. The foreman's screen and the record show question → line → source (title, §, link). | S |
| Q5 | Keep **1 question plus teach-back** as now. In the written-explanation path (U2), 1 question as well. Ask **3** only in the multiple-choice fallback (U1). | S |

### 1.3 "Option to skip the conversation with the worker and use multiple choice instead"

**This is the weakest suggestion.** The teacher asked how you assess understanding "beyond recording a signature or a completed set of questions". Teach-back is your answer to that, and brief v3 is built on it. Loreta adds that the signature only shows the authorities that something was done. A conversation that can be skipped turns the tool back into that signature. Gravitas also has little reason to skip it, because its project managers speak the crews' languages.

**The real problem behind the suggestion:** the foreman cannot judge an explanation given in a language he does not speak. `V3_CHANGES.md` §6 lists this as still weak. Fix that problem instead of removing the step.

| ID | Task | Size |
|---|---|---|
**Decided (26 Oct):** when the conversation is not possible, the worker answers **open-ended questions** in his own language, and that path may end in a plain "signed". Multiple choice alone may not.

**The weak point of this decision:** the foreman cannot read the answers. If the AI judged them, the AI would be deciding whether someone may start high-risk work, which the service says it never does (PR-04). So the AI only translates; the foreman judges. Also, writing is harder than talking for some workers, and a short written answer can hide a misunderstanding that a conversation would reveal. Keep the conversation as the default, and record which path was used.

| ID | Task | Size |
|---|---|---|
| U1 | **Three paths, in this order, each recorded.** (1) Conversation (teach-back), as now. (2) If the foreman taps "The conversation is not possible now" and gives a reason (nobody speaks the language / the worker arrived late / other): the written explanation (U2), which can end in "signed". (3) Only if the worker cannot write either: 3 multiple-choice questions, and the record states "Understanding: questions only, no explanation" with the weaker status (`signed_with_fallback`). Count how often each path is used; that count is evidence on whether teach-back is practical. | M |
| U2 | **Written explanation, now required (was COULD).** On the phone the worker answers two open questions in his own language: "What is the main danger in this job?" and "What do you do to stay safe from it?", then one scenario question. The model translates the answers into Norwegian. The foreman sees the translation next to the key points to listen for and marks "explained correctly" or "something was misunderstood". A wrong or empty answer leads to the existing re-brief loop. The AI does not grade, score or suggest a verdict. | L |
| U3 | **Guardrails for U2.** A note on the worker screen: "Do not write names." Only the foreman's verdict is kept by default; the answer text and its translation are discarded after the decision, except in test runs with synthetic answers. The screen labels the Norwegian text "machine translation of the worker's answer, not checked". The record states "Understanding: written explanation, machine-translated". It must also work with a Cyrillic keyboard. | S |
| U4 | **Test it.** In T5 or a desk test, give 6–10 written answers (some right, some subtly wrong, in LT and RU) to a foreman-role person who doesn't read those languages. Count how many he judges correctly from the translation. If the translation hides wrong answers, this path cannot end in "signed", and the decision must be reversed. | M |

### 1.4 Turkish and Russian (decided: Russian only, no Turkish)

**What the interview says:** the company's languages are Norwegian, English, Russian and Lithuanian. Subcontractors add Polish and Turkish, with "one Turkish" (≈2:52). The Russian speakers come from Moldova and hold Romanian passports, and Russian is not their native language either (≈23:26). So Russian is supported by the interview, and Turkish means one subcontractor.

**Cost per language:** 46 glossary terms, 46 lines, 8 or more questions, the worker interface strings, 10 seeded errors plus 10 controls for T6, and a native reviewer for the language key. Without that reviewer every line stays "Draft". That is honest, but each new language adds another draft language, against the teacher's "keep languages manageable" (TR-05). With both new templates (1.5) and Russian, about 220 new line translations need a language key (46 existing lines into Russian, about 44 new lines into four languages), plus new glossary terms and questions.

**Decided (26 Oct): Russian only. No Romanian, no Turkish.** Add Russian fully. The remaining risk: for the Moldovan workers Russian is a second language, so a wrong answer in Russian may reflect their Russian, not the safety point. Note this in the report as a limitation. Lithuanian group members who read Russian could hold the key, labelled "inside the group". Turkish can still serve as the T4 unsupported-language case, which needs no translation work: the tool simply shows "interpreter required".

| ID | Task | Size |
|---|---|---|
| R2 | **Add `ru`** to the pack languages, glossary `byLang`, template translations, question `byLang`, `src/i18n/ru.ts` (worker strings only) and `LANG_NAMES`. | M |
| R3 | **Fix matching for Cyrillic** in D1 and D2. Russian inflects heavily, so it needs several stems per term (the same issue as Lithuanian and Polish). Add unit tests with Cyrillic text. | S |
| R4 | **T6 fixtures:** `seeded-errors.ru.json` and `controls.ru.json` (10 + 10, at least 4 errors that are not glossary errors), confirmed by a Russian reader. | M |
| R5 | **Check Cyrillic** on the worker screen at 375 px: font, line length, no overflow. | S |

### 1.5 Gravitas-specific jobs and the stoffkartotek

**What Gravitas does:** the website lists carpentry and joinery (tømrer, snekker), concrete casting (støp), masonry (mur), painting (maling) and electrical work (elektriker). The projects are new builds and full renovations of houses and flats, and renovation or conversion of commercial buildings. In the interview, Loreta mentioned risk assessments for concrete work, work at height with a harness, electrical tools, "warm" work (hot work), goggles when cutting, and health checks for vibration, hearing and breathing.

The current templates (work at height, lifting) fit only in part. **Do not add five templates:** each one multiplies by every language and reviewer. **Decided (26 Oct): add both J1 and J2.** That makes four templates against the specification's two (CH-09) and the teacher's "keep examples manageable". One way to keep it in hand: write the two new templates in Norwegian, Lithuanian, Russian and English (languages the group can check) and leave Polish to the original two templates.

| ID | Task | Size |
|---|---|---|
| J1 | **"Maling og overflatebehandling innendørs"** (indoor painting and surface treatment): solvents, isocyanates in two-component products, ventilation, sanding dust, ladders and trestles. This also covers suggestion 6 and the stoffkartotek. | L |
| J2 | **"Betongstøp"** (concrete casting): wet cement burns to skin and eyes, chromate, formwork collapse, hand-arm vibration from the vibrating poker, the pump hose. Loreta named concrete work explicitly. | L |
| J3 | **Check the content with Loreta**, not the choice: send her the hazard list for both jobs and ask what her project managers would add or remove. | S |

Not added: hot work (decided 26 Oct) and electrical work, which falls under a separate regime for authorised electricians.

**What the stoffkartotek rules say** (Arbeidstilsynet): an employer who uses or stores hazardous chemicals must set up a stoffkartotek before the chemicals are used. It holds the safety data sheets, **must be in Norwegian**, must be easy to reach where the chemicals are used, and must be kept up to date. Workers must be trained to find it and understand it. The legal basis is Forskrift om utførelse av arbeid, chapter 2; check the paragraph numbers on Lovdata before citing them.

**Where the tool fits:** the stoffkartotek is in Norwegian, yet the worker has to understand its protective measures. That gap is the tool's job. The tool must **not** become a stoffkartotek: that belongs in Holte or a similar system, and an outdated copy is a liability.

| ID | Task | Size |
|---|---|---|
| K1 | **Product step** in the painting (and concrete) SJA: the foreman picks today's products from a short list of 2–4 synthetic or public products. Each product holds GHS pictograms, H-phrase codes, protective equipment (SDS section 8), first aid (section 4), handling, storage and spills (sections 6–7), and "Kilde: sikkerhetsdatablad [produkt], revisjon [dato]". | M |
| K2 | **These become SJA lines**, with `sourceRef` set to the SDS section, translated and checked like any other line. The EU publishes official translations of the H and P phrases in every EU language, which could serve as pre-verified text for PL and LT (not RU). Check this before relying on it. | M |
| K3 | **GHS pictograms on the worker screen** next to the lines. They do not depend on language. | S |
| K4 | A fixed line: "Stoffkartoteket ligger i [system/sted]. Spør [rolle] hvis du ikke finner det." This covers the training duty in the regulation. | S |
| K5 | **Questions on chemicals**, e.g. "You get paint with solvent in your eye. What do you do first?", linked to SDS section 4. | S |

### 1.6 Painting and chemical questions, plus a tagged rule list for the manager

**The tags and filters are cheap and useful.** The "database of all rules" is where it goes wrong:
- Gravitas already has to use Holte, which provides procedures and keeps them updated (≈10:30). A second rule list competes with a system they are obliged to use.
- A student-made list of "all rules" will be incomplete and will go out of date. A manager who relies on it is worse off than one who doesn't.
- The teacher said not to broaden the scope.

**Adjusted:** a browsable library of the SJA lines you already have, with tags and sources. It should also show what Holte does not: how often each line was misunderstood on site.

| ID | Task | Size |
|---|---|---|
| B1 | **Add `tags[]`** to hazard entries and template lines, from a fixed list: Høyde, Løft, Maling, Kjemikalier, Støv, Støy, Vibrasjon, Varme arbeider, Betong, Elektro, Verneutstyr, Nødprosedyre. A line can have several tags. | S |
| B2 | **Add `riskLevel`** (green / yellow / red), which matches how Gravitas grades risk (≈26:00). | S |
| B3 | **A library screen, "Regler og tiltak"**, filtered by tag, job type, risk level and verification state, with search. Each row shows the Norwegian line, its source (title, §, link, date checked), the languages it is verified in, and "misunderstood on site: n×". | M |
| B4 | **Screen header:** "Utdrag brukt i SJA-malene. Ikke en fullstendig regeloversikt. Sjekk gjeldende regelverk.", with the date the sources were last checked. | S |
| B5 | **Export** the filtered list as CSV or PDF, so a manager can put it into Holte. | S |

### 1.7 A "normal version" without the database, test pages and English

**Right, and needed before Loreta gets a link.** Two cautions:
- Keep the prototype banner (CH-06). Someone outside the group will be looking at it.
- "Accessible" here means the clean view the team described (decided 26 Oct). A light accessibility check is added as V4; a full WCAG audit is not.

| ID | Task | Size |
|---|---|---|
| V1 | **An app-mode flag**, `VITE_APP_MODE=field|lab` (or `?mode=field`). In field mode, Home shows only "Lag dagens SJA" and the worker entry. Field mode hides the test bench, baseline timer, saved runs, reviewer queue, observer link, trace panel, English help lines, technical status, and demo-mode notices written in technical terms. A route guard stops anyone reaching hidden pages by URL. | M |
| V2 | **A separate reviewer address** (`/review`), so reviewers can still work while field mode is on. | S |
| V3 | **Keep in field mode:** the banner and the "what is sent to the AI" panel (I3). | S |
| V4 | **Light accessibility, not a full WCAG audit.** Add an automatic accessibility check (axe) to the Playwright tests and fix what it finds: contrast, button labels. Keep worker text at 18 px or more (already in place). A full WCAG audit is not worth the time for this prototype. | S |
| V5 | **Share localhost for free (decided 26 Oct: no paid hosting).** (a) For a live session: run `npm run dev`, then `cloudflared tunnel --url http://localhost:5173`. It needs no Cloudflare account and gives a temporary `trycloudflare.com` address. The address works only while your laptop is on and the command runs, and it changes every time. If the page shows "Blocked request. This host is not allowed", add `.trycloudflare.com` to `server.allowedHosts` in `vite.config.ts`. ngrok's free plan works the same way but needs an account and shows a warning page first. (b) For Loreta to look at in her own time: a 3–4 minute screen recording of the foreman and worker flow on a phone-sized window, plus the exported record as a PDF. This does not depend on your laptop being on, and it is what to send first. | S |
| V6 | **Before opening a tunnel:** set `GATEWAY_MODE=replay`, so nobody with the link can use your model quota or send text to a model. Use field mode (V1). Remember that anyone with the address can use the app and write to `data/working` and `evidence/`. Stop the tunnel after the session, and don't put the address anywhere public. Test it on a phone first. | S |

---

## 2. Tasks from the interview that the team's list misses

| ID | Task | Why | Size |
|---|---|---|---|
| I1 | **Export for the main contractor.** A one-page PDF "SJA-oppsummering" that a subcontractor can send to the main contractor or attach in Holte: job, date, template version, languages, flags handled, understanding result, sign-off. Do not build an integration (it stays out of scope). Ask Loreta what she needs to see in a subcontractor's SJA before she accepts it. | Gravitas collects subcontractor risk assessments by hand (≈12:30–13:40). | M |
| I2 | **Add a chatbot arm to T8:** (iv) the manager drafts the SJA with ChatGPT or Claude and translates it with a chatbot, which is how Gravitas works now. Time it, including checking, then run the chatbot's translation through pair-check mode (F-14 already accepts any translation) and count the errors the check finds. | This is the comparison that shows whether the service adds anything for a firm that already uses AI. | M |
| I3 | **Privacy panel** on step 1 and in the record: "Sendt til AI-modellen: jobbtype, verdier, dagens beskrivelse, linjetekster. Aldri sendt: byggeplass, kunde, navn." D6 already enforces this; the panel makes it visible. | Loreta named data safety as the main reason firms don't use AI (≈30:48, 32:31). Cheap, and it answers the top barrier she named. | S |
| I4 | **Separate "not understood" from "not followed."** In the foreman's observation after the job starts, add "regel ikke fulgt (f.eks. verneutstyr)" next to "misforstått". The record then keeps the two apart. Do not build a daily reminder system; that is out of scope. | Her pain is compliance, not comprehension. This keeps the tool honest about what it cannot fix. | S |
| I5 | **Use Loreta as the main-contractor reviewer (decided 26 Oct).** She is the CFO, not a foreman, so ask her about I1, the library, the record and the privacy panel (CR-13, outside perspective). Ask whether one project manager could try the foreman flow: that is useful feedback, but not T1 in the segment. | She agreed to look at the prototype (≈36:44). | S |
| I8 | **Ask Loreta to introduce one of her subcontractors** with 5–20 employees as the pilot firm for T1, T2 and T5. If none agrees, run the desk variants and say so in the report. | With Gravitas as reviewer, the tests still need a firm in the segment. Her subcontractors are exactly that firm. | S |
| I6 | **Label her figures as her estimates:** 45 staff, of whom 10 work in administration; about 20% of workers use AI; a risk assessment took about 1 day and now takes 1–2 hours with AI; health checks are needed at least every third year. | They are interview statements, not measurements (CR-18). | S |
| I7 | **Check the legal date.** Loreta said the language requirement came in "1 August last year". The specification says 1 January 2024 for byggherreforskriften §19a. Arbeidstilsynet's page lists the regulation's last amendment as FOR-2023-08-29-1367. Check on Lovdata before the report. | Avoid repeating an unchecked date. | S |

**Out of scope even though the interview mentions them:** health checks, courses and certificates, integration with Holte, and customers using AI in disputes.

---

## 3. Order of work

| Tier | Tasks | Why this order |
|---|---|---|
| 0 | F1 (or F2), F3, F4, live T6, machine time; F5 now | Without these, nothing below produces evidence. All free. |
| 1: before sending the link to Loreta | V1, V2, V4, V5, V6, I3, I1, I8, Q1, B1–B3 (minimal) | What she will see, and what she is best placed to judge. |
| 2: content | J1 and J2 with K1–K5, then J3; R2–R5; Q2–Q4; U1–U3 | Gravitas-relevant content and the agreed language. |
| 3: evidence | U4, L1–L5, I2, I4 | Before-and-after revision (CR-12) and the chatbot comparison. |
| COULD | Full WCAG audit | Only if time is left. |

## 4. Decisions (made 26 October)

| # | Question | Decision | Consequence |
|---|---|---|---|
| 1 | Which extra languages | Russian only. No Romanian, no Turkish. | 1.4. For the Moldovan workers Russian is a second language; note it as a limitation. |
| 2 | Can a check without conversation end in "signed"? | Yes, with open-ended written answers. Multiple choice alone cannot. | U1–U4. The AI translates and the foreman judges; U4 tests whether that works. |
| 3 | Which Gravitas jobs | Both: painting (J1) and concrete casting (J2). No hot work. | Four templates. Consider leaving Polish to the original two. |
| 4 | Clean view or WCAG | Clean view (V1); it is what the team described. Plus a light accessibility check (V4), no full audit. | V1, V4. |
| 5 | Gravitas's role | Main-contractor reviewer. | I5, I8: a pilot firm in the segment is still needed, ideally one of Gravitas's subcontractors. |

## Sources

- AI for Business interview with the Gravitas CFO, 20 Oct 2026 (project file)
- [Gravitas Bygg](https://gravitasbygg.no/)
- [Arbeidstilsynet: Stoffkartotek](https://www.arbeidstilsynet.no/risikofylt-arbeid/kjemikalier/stoffkartotek/)
- [Arbeidstilsynet: Byggherreforskriften §19a, language proficiency](https://arbeidstilsynet.no/en/laws-and-regulations/regulations/construction-client-regulations/4/section19a)
- [Google: Gemini Developer API pricing (free tier)](https://ai.google.dev/gemini-api/docs/pricing)
- [Google: Gemini API OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Ollama: OpenAI compatibility](https://ollama.ai/blog/openai-compatibility)
- [Cloudflare: Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [EG acquires Holte](https://global.eg.dk/news/2020/march/eg-acquires-holte) (the "Holte / EG Holte" that Loreta named)
