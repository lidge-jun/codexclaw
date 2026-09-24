# Architect consultation

Architect handle 01a0d14c-2ee0-7dc2-9091-b6c01f5d9809 (gpt-6-sol, V1 transport, CXC-ROLE: architect, cxc-dev and cxc-dev-architecture attached). The full proposal is kept outside the checkout at .codexclaw/evidence/01a0d143-ac30-70c0-b494-27e596c0c7a7/architect-proposal.md. It read 001_research.md, the three issues and the owning source; it changed no files.

## Decisions and main dispositions

| ID | Proposal | Disposition |
|---|---|---|
| D2.1 | Optional completion probe in `runTool`, used only by `printPdf`: poll ~250 ms, `%PDF-` head, `%%EOF` in the last 1 KiB followed only by whitespace, size and mtime unchanged ~1500 ms; kill the owned tree, await exit, record `completedBy: "stage-stable"` per pass. Deadline unchanged; a racing nonzero exit stays a failure. | Accepted. CDP printing rejected as a larger surface. |
| D2.2 | Cleanup failure or no exit within a bounded post-kill grace fails the pass and the stage is not promoted. | Accepted, grace 5000 ms. |
| D2.3 | Text summary prints each FAIL/BLOCKED/NOT_RUN check id and reason once; report-pipeline.md timeout sentence updated. | Accepted. |
| D3.1 | Contents grid `max-content minmax(0, 1fr) 8mm`; keep `@page` literals with a translator comment naming them and the cover date. | Accepted. Exporter-generated `@page` CSS rejected: a second source of layout truth for a problem a comment and a lint cover. |
| D3.2 | P2 lint when `<html lang>` is present and not Korean and an `@page` `content` string holds Hangul or a `YYYY. M. D.` date; missing `lang` is reported, not guessed. | Accepted. Missing `lang` becomes a named not-run note. |
| D3.3 | DIAGRAM-LAYOUT-01 paint-order and halo sentence. | Accepted. |
| D3.4 | Separate bounded `--dump-dom` pass on a copy of the final print HTML with an injected measurement script; later-painted stroked line/polyline/path crossing a text box (shrunk 1 px) in the same SVG is P2; failures are named not-run, never FAIL; `--qa-only` reports it cannot run; fixture learns `--dump-dom`; one opt-in real-Chrome smoke. | Accepted. |
| D4.1 | Per-verb allowed flag sets; unknown flags, stray positionals and missing values rejected before any write; `--surface` only on `add-criterion`. | Accepted. |
| D5.1 | Validate `artifact-identity.json` at QA ingress; digest manifest of the validated files in the QA receipt, verified when consumed; fail closed for desktop artifact rows. | Amended: validation runs whenever an identity file is referenced and whenever the verdict declares desktop artifact rows; the consumer verifies the manifest when present and fails closed only for plans whose desktop criteria depend on an artifact. Legacy receipts stay readable. |
| D5.2 | Explicit criterion attribute for a presented native surface; C advisory checks for a native observation row (CUA naming a native app, or `view_image` of a declared screenshot); no extension inference; stays a soft fail-open advisory. | Amended: the attribute is set with `add-criterion --surface desktop --presented native` and stored as `presented: "native"`; wp5 adds `--presented` to the add-criterion flag set that wp4 introduces. |
| D5.3 | Standalone behavioral lipo oracle under dev-devops/scripts: run the candidate argv on the good artifact and on a negative thin slice; accept only pass/fail respectively; fake lipo on Linux; opt-in real-toolchain test. | Accepted. |
| D6.1 | Release after all phases, following the 0.2.37 sequence with fresh evidence; new scripts change inventory, new tests change the badge. | Accepted. |

Split advice: the architect suggested splitting wp3 and wp5 if review size grows. Main keeps six work-phases and uses sequential builders inside wp3 (both parts edit the exporter) and disjoint parallel builders inside wp5.

## Writer questions resolved by main

Four gpt-6-sol writers drafted 010-040 (handles 01a0d150-56f3-7a90-bcde-ec12020dee9c, 01a0d150-5a6d-7231-a89d-634a0540f2f4, 01a0d150-5c1f-75a2-896f-492c10a98e8c after one 429 retry, 01a0d150-5ef9-7df2-9dde-66857de740d8). Two decisions came back open:

- 020: no `--no-svg-geometry` opt-out; the diagnostic is bounded and never fails a report.
- 040: a desktop criterion is artifact-dependent unless it declares `presented: "native"`; the final-gate compatibility cost is stated in the CHANGELOG.

## Reflection

Round 1 (same handle): MISALIGNED with seven gaps. The locale and DOM failure paths used `report.notRun`, which quality-gate.mjs:31-34 turns into BLOCKED. The crossing test used inclusive bounds. No malformed-result fixture existed. The identity schema was incomplete. The native advisory returned before its branch whenever no web artifact changed. Two helpers were undefined. The final-gate signal differed from the validator's. Folds are recorded in 020 and 040 under "Reflection round 1 folds"; notes moved to a nonblocking `report.notes` array, which main chose deliberately over `report.notRun`.

Round 2 (same handle): gaps 1-6 folded. Gap 7 was partly folded: the manifest does not bind an identity to a specific criterion. Two new contradictions were found: `unsigned` signing and a required `bundleIdentifier` widened the schema, and the native advisory was limited to the active phase. Main dispositions are in 040 under "Reflection round 2 dispositions": the gap 7 residual is accepted and disclosed, the schema now matches the reference, and the active-phase limit applies only when that phase links criteria. The independent A audit reviews the result.
