# 061 — wp7: the `60a07328` recovery decision

## Decision

**Defer the publication recovery. Ship #181 alone in this phase, and keep #199 and #200
open with this document as the reason.**

## What the recovery is

Commit `60a07328` carries a publication implementation that HEAD does not:
`reference/report-pipeline.md`, `scripts/report-contract.mjs` (schema v1 with claim
kinds `observation`, `inference`, `hypothesis`, `recommendation`, `attribution`),
`assets/report-model.example.json`, `reference/page-role-catalog.md`,
`scripts/quality-gate.mjs`, `scripts/report-fonts.mjs`, `scripts/report-pdf-tools.mjs`,
plus `test/report-contract.test.mjs`, `test/report-quality-gate.test.mjs`,
`test/report-fonts.test.mjs`, `test/report-pdf-tools.test.mjs` and a
`report-export.test.mjs`.

Measured span between that commit and current `dev` across the visualizer and its tests:
**24 files, +529 / −1152**. Read in the direction of recovery, that is roughly 1,150
lines of implementation and test coverage to bring back.

Both the cluster advisor and the architect independently reached the same conclusion:
#199 and #200 extend exactly those files, so building a second evidence model beside the
existing one is the specific failure that this unit's G0-equivalent gate exists to
prevent. The attached 2026-09-19 roadmap calls this PR-01 and makes it the precondition
for its PR-03/04/06.

## Why it is deferred anyway

The architect named the risk precisely: wp7 would hide a **publication-runtime
migration** inside an issue cluster. Recovery is not a documentation import. It changes
exporter behaviour — the Chromium CLI fallback becomes a BLOCKED/3 outcome, and final
publication starts requiring separate review receipts. Those are user-visible delivery
semantics arriving under a commit message about closing #199.

Three specific reasons this does not ride inside an issue sweep:

1. **It needs its own acceptance matrix**, not a green suite: legacy inputs, exporter
   exit behaviour, missing browser and font tooling, receipt validation, and an isolated
   standalone install. A passing `npm test` would not observe any of those.
2. **Its historical test receipts are not fresh proof.** They were measured on that
   branch, against that tree. Importing them as evidence would be exactly the
   false-completion pattern several issues in this backlog are about.
3. **It would make #199 and #200 unreviewable.** A reviewer asked to judge a research
   handoff would instead be judging a runtime migration.

## What ships instead

#181, which is genuinely independent of the recovery: the exporter never prepared its
output directory, so a missing one reached Chromium and surfaced as
`chrome print failed`, naming the wrong cause. Fixed with a directory preflight that
also rejects a regular file sitting at the parent path, because `existsSync` alone
returns true for that and merely defers the same failure with a worse message.

If the recovery lands later, the same guard belongs before that version's staged-output
creation; its exporter has the same gap, and the fix must not be lost in the merge. Its
existing `report-export.test.mjs` should then absorb these cases rather than be replaced,
preserving its invalid-argument, input-overwrite and missing-PDF-tool regressions.

## Consequences recorded honestly

- #199 and #200 **stay open**. Deferral is not completion, and `000_plan.md` does not
  allow size alone as a closure reason.
- #182 and #183 (wp7c) do not depend on the recovery and remain deliverable.
- The next unit that picks this up starts here, with the selected-change table and the
  acceptance matrix, not by re-deriving the question.
