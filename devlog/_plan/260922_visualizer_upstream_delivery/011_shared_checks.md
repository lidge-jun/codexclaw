# wp1 checks and conclusion

The shared visualizer is implemented and locally verified. Preserve source-only
review for simple static edits; do not infer publication readiness from PDF existence.
Next direction: port this verified source to Aside, run its own acceptance checks,
then integrate/publish both with the already-merged v1 prompt fix.

- Full suite at code891c415c:3480 total,3476pass,4existing environment skips,0fail.
- Focused report/exhibit/packaging:235pass,0fail,0skip; source-bound test receipt.
- Build:183 emitted files, no committed dist drift. Gate/inventory pass. Published
  test count updated to measured3480 (documentation-only after the full run).
- Independent E/R/L/X correctness reviews all PASS after recorded repairs.
- Bilingual visible-prose review PASS; separate PDF oracles both PASS.
- Actual source-only/malformed/empty/unknown/repeat CLI and absent-tools/A4/Letter/
  wrong-paper scenarios recorded in QA receipt. Missing tools BLOCKED3, malformed
  input FAIL1, wrong paper REVIEW2, valid source/PDF PASS0.
- Real Chrome153 Playwright export produced two-page A4/Letter fixtures, no page
  errors, browser closed. Every page geometry and actual glyphs/long labels checked.
- Chrome CLI on this host writes PDF but may not exit; timeout is FAIL, old destination
  preserved, subprocess tree killed. This limitation is not reclassified as success;
  an explicit other-engine export + QA-only path is verified. No browser migration.
- Ten exporter boundary regressions, nine research regressions and locale orphan/
  date negatives failed before repairs. Exhibit mutations dropping bounds/checks
  were detected. Structural metadata checks are not semantic source truth.
- Peer PR228 merge0943bec3 included; its delegation and audit hashes match handoff.

Evidence is under .codexclaw/evidence/01a0c7e9-f184-7913-a61e-9b216d85c15a/:
shared-tests.log, full-shared-tests.log, build.log, pdf-render.log, qa receipt and
visualizer-smoke artifacts. No private account documents were used. The fixture
PDFs are QA outputs, not a user report or a promise of account installation.
