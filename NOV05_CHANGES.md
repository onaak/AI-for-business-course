# Changes of 5 November 2026: reading aloud, the worker's own confirmation, the SJA document

> **Student prototype. Synthetic content. Not a valid SJA. Do not use to plan or carry out real work.**

Three additions to the understanding check and the record, and specific company and person names removed from the repository.

## Read this first

- **Still replay mode with scripted answers.** Nothing here needs a model, and nothing here is evidence.
- **More unchecked wording.** The worker confirmation (4 strings) and the whole SJA document (22 strings) are new in Polish, Lithuanian and Russian, written by the builder. Each needs a native speaker.
- **The document stores, per worker, the language they confirmed in and the time.** Until now the tool kept no per-worker detail (ASSUMPTIONS 37). On a crew with one Russian reader, "Worker 2 · Russian · 07:42" points at one person. It is kept in the SJA and its document only, never in the log or the trace, and no name is stored; the names are written by hand on paper. The group should decide whether that is acceptable.
- **Removing names from the files does not remove them from GitHub.** The earlier commits still hold them. See "Names" below.

## 1. What changed

| Asked for | Built | Where |
|---|---|---|
| **Read the SJA aloud before the phone check** | Step 5 now starts with "1. Les SJA-en høyt for laget": the whole SJA in Norwegian, each line with the crew languages underneath (or "the foreman explains orally" where a line has no checked text), and the lines for today's job highlighted. The foreman ticks "Jeg har lest SJA-en høyt for laget". Until then the phone check and the oral check cannot start, and sign-off is closed. If any line's Norwegian text changes afterwards, it must be read again. | `ReadAloud` in `Steps56.tsx`; `markReadAloud` in `flow.ts`; `readAloud` in the understanding record |
| **The worker confirms in their own language** | After the question, the worker sees "I have understood the SJA – sign" in their language. The tap saves a number (worker 1, 2 …), the language and the time; no name. The link back to the foreman is hidden until then. "I have a question – get the foreman" leads to the foreman, who explains and hands the phone back. After a wrong answer, the foreman goes through the point again on the phone first; that also closes the re-brief in step 5. A worker checked without the phone is confirmed by the foreman ticking "the worker has said they understood". Sign-off needs a confirmation for every worker checked. | Kiosk phases `reexplain` and `confirm` in `Worker.tsx`; `recordConfirmation` in `flow.ts`; `isComplete` |
| **The full SJA as a document, one section per language** | `/runs/:id/document`: a short head, then one section per language (Norwegian original first, then each crew language), each with job, date and site, all lines by section with today's lines highlighted, "Confirmed digitally" (read aloud, foreman signed, worker 1, worker 2 … with times; oral confirmations in the Norwegian section), and a table with blank lines for role, name, signature and time. "Download as a file" gives a standalone HTML file that opens and prints in any browser; when the foreman signs, the same file is also saved next to the record. | `SjaDocument.tsx`, `DocumentScreen.tsx`, `src/i18n/document.ts` |
| **Owner → Records** | The "Leder / Manager" tab is now **"Eier / Owner"**. Its list of signed SJAs is called **"Protokoller / Records"**, and each row opens the SJA document, the main-contractor summary or the record. The signed screen and the record also link to the document. | `Home.tsx` |
| **The signed screen** | "Go through the SJA with the crew" (advice after signing) is replaced by "Share the SJA document", since the reading now happens before the check. | `s6.next1` |

The record and the main-contractor summary also say whether the SJA was read aloud and how many workers confirmed.

## 2. Names

Every mention of the interviewed company, its staff and its software vendor is removed from the code, data, tests and documents in the repository, and replaced by "the interviewed main contractor" or "the interviewee". The group's task list of 26 October quoted the interview at length; it is no longer in the repository. On Ona's computer it was moved to `private/`, which Git now ignores.

The commits already on GitHub still contain the names. To remove them there, the history must be replaced (see the README of this change in the chat, or ask the builder). Anyone who cloned or forked the repository before that keeps a copy.

## 3. Checks run

113 tests without a browser and 19 browser tests in replay mode at 375 px, all passing; type check. The browser tests now read aloud before every check, confirm every worker, and the main path opens the document and downloads it.
