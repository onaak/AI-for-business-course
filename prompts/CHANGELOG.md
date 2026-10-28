# Prompt changelog

Each prompt file carries its own version header. Raise the version when a prompt changes, and
note the change here with the date and the test result that led to it (course requirement CR-12).
Replay fixtures are keyed by prompt version, so a version raise makes the old fixtures stop matching by design.

| Date | Prompt | Version | Change | Reason |
|---|---|---|---|---|
| 2026-10-05 | P1–P6 | 1.0.0 | First version, written by the builder (an AI coding assistant) from the specification's prompt contracts (section 11.2). | Initial build. Not yet run against a live model. |
| 2026-10-26 | P4 | 1.1.0 | Takes up to three verified translations of similar lines as examples (`examples`), and is told to reuse their wording only where it fits. | Translation memory (task L2, team suggestion "the model should learn from provided translations"). Only pairs with both keys are ever sent. Not yet run against a live model. |
| 2026-10-26 | P7 | 1.0.0 | New: translates a worker's written explanation into Norwegian for the foreman. Translates only; never judges. | Decision of 26 Oct 2026: a check without conversation may end in "signed" if the worker answers open questions in writing (U2). Not yet run against a live model. |
