# 062 — wp7b: the recovery selection table and acceptance matrix

`061` decided to defer the `60a07328` publication recovery. This document is what the
architect named as the early warning for that decision: the selected change set and the
acceptance matrix, produced now so the recovery can run as its own unit instead of being
re-derived from scratch.

**#199 and #200 remain open. Nothing here closes them.**

## Measured span

`git diff --stat 60a07328 dev -- skills/dev-visualizer test`: **24 files, +633 / −1144**.
Read in the direction of recovery that is roughly 1,144 lines to restore.

## Selection table

"Take" means bring it back; "review" means it changes runtime behaviour and needs its own
judgement; "leave" means current `dev` is already correct or better.

| Path | Δ | Disposition | Why |
| --- | --- | --- | --- |
| `reference/report-pipeline.md` | 123 | **take** | The evidence-model-before-storyline contract. #199 and #200 both extend it; rebuilding it would create the second model the G0 gate exists to prevent. |
| `scripts/report-contract.mjs` | 52 | **take** | Schema v1 with the existing claim kinds. The research handoff extends this rather than replacing it. |
| `reference/page-role-catalog.md` | 33 | **take** | Page roles own layout; the exhibit recipes own analysis. Keeping them separate is why #200 does not turn into a layout change. |
| `scripts/quality-gate.mjs` | 49 | **take** | Supplies the semantic-review receipts #199 needs a producer for. |
| `reference/source-patterns.md` | 28 | **take** | Referenced by the shipped skill; its absence is part of why #182 pointers dangle. |
| `assets/report-model.example.json` | 16 | **take** | Carries the corrected nonrandom/short-observation limitations. |
| `assets/paged-report.html` | 358 | **review** | Largest single delta. Keep the corrected allocation wording; preserve the contradictory version as a negative fixture for #200, not as the live example. |
| `scripts/export-paged-report.mjs` | 341 | **review — the migration** | Where the Chromium CLI fallback becomes BLOCKED/3 and final publication starts requiring receipts. This is the user-visible semantics change, and the reason the recovery is its own unit. |
| `scripts/report-browser.mjs` | 102 | **review** | Browser readiness detection; interacts with the exporter change above. |
| `scripts/report-pdf-tools.mjs` | 95 | **review** | PDF tool discovery; decides what NOT RUN means. |
| `scripts/report-fonts.mjs` | 49 | **review** | Font binding; its failure mode must not become a silent pass. |
| `assets/consulting-ko.css`, `assets/font-spec.example.json` | 81 | **take** | Assets with no runtime branch. |
| `SKILL.md`, `reference/document-pdf.md`, `reference/report-writing.md`, `reference/visual-design.md` | 137 | **review** | Current `dev` already carries the #181 directory-behaviour note and the #196-era wording. Merge, do not overwrite. |
| `test/report-export.test.mjs` | 108 | **merge, do not replace** | Both sides have one. Keep its invalid-argument, input-overwrite and missing-tool regressions AND the four #181 preflight cases now on `dev`. Reconcile expectations with BLOCKED/3. |
| `test/report-contract.test.mjs`, `report-quality-gate.test.mjs`, `report-fonts.test.mjs`, `report-pdf-tools.test.mjs` | 126 | **take** | The verification machinery for everything above. |
| `test/report-browser.smoke.mjs` | 53 | **take, with a caveat** | **Not covered by the `package.json` test glob** — it is a `.smoke.mjs`, and the glob matches `*.test.mjs`. Recovering it without wiring it up would add a file nobody runs. |
| `test/hook-e2e.test.mjs` | 26 | **leave** | Current `dev` is ahead here. |

## Acceptance matrix

Each row must be observed on the recovered tree. A green `npm test` satisfies none of
them on its own, which is the entire reason this list exists.

| # | Condition | How it is observed | Fails if |
| --- | --- | --- | --- |
| A1 | A legacy v1 report model still validates | Run `report-contract.mjs` against the pre-recovery example | A document that validated before now fails, i.e. a silent breaking change |
| A2 | A v1 document is not silently upgraded | Validate a legacy file and inspect the result | It is reported as research-complete without a handoff section |
| A3 | Exporter exit semantics are stated, not discovered | Run the exporter with a working browser, a missing browser, and missing PDF tools | Any path exits 0 while the artifact is unverified, or BLOCKED/3 appears undocumented |
| A4 | The #181 preflight survives the merge | Run the four preflight cases on the recovered exporter | A missing directory reaches the browser again |
| A5 | Missing font tooling fails loudly | Remove the font path and export | A missing font check renders as a pass |
| A6 | Receipts bind to the artifact actually produced | Regenerate the PDF, re-read the receipt | A stale hash validates against a new artifact |
| A7 | NOT RUN never becomes PASS | Export with poppler absent | The verdict is PASS while checks were skipped |
| A8 | Standalone install still resolves | Copy `dev-visualizer/` alone and resolve every required link | Any required link escapes the skill root (this is #183's test, and it must keep passing) |
| A9 | `report-browser.smoke.mjs` is either wired into a runner or deleted | Read `package.json` scripts | It exists and nothing runs it |
| A10 | #200's competing instructions are all removed | Grep the recovered tree for answer-first and claim-heading mandates | `report-pipeline.md:15`, its editorial-review action row, or `SKILL.md:75-76` still impose one storyline on every genre |
| A11 | #199's receipt has a producer, a schema and a verifier | Follow route, contract version and check status through the model | Any of the three is undefined |

A10 and A11 are the reviewer's blockers 4 and 5 against `060`. They are unresolved by
design: resolving them requires the recovery, and the recovery is this document's subject
rather than its content.

## Order for the next unit

1. Take the **take** rows and run A1, A2, A8.
2. Merge the **review** rows one at a time, exporter last, running A3–A7 after each.
3. Only then start #199 (A11), then #200 (A10) — in that order, so the genre work can be
   compared against a research-only baseline rather than both changing at once.

Historical test receipts from that branch are not evidence for any row here. They were
measured on a different tree.
