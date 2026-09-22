# Visualizer maintenance: codexclaw first, Aside follows

Shared behavior is maintained in
[codexclaw's dev-visualizer](https://github.com/lidge-jun/codexclaw/tree/dev/plugins/codexclaw/skills/dev-visualizer).
[aside-visualizer](https://github.com/lidge-jun/aside-visualizer) consumes selected,
verified changes and owns its Aside adapters. This is the maintenance direction,
not a claim about which project historically originated every part of the skill.

## Fix, port, verify, close

1. Map the Aside issue's acceptance criteria to shared behavior and host-specific
   adaptations. Reuse the existing report model, exporter and checks; do not build
   a second evidence or quality-gate engine.
2. Fix shared behavior in codexclaw and verify the exact changed revision. Record
   the upstream commit/PR and check results. Distinguish a work branch, merged
   `dev`, merged `main`, a published release, and the actually loaded consumer version.
3. Port the verified changes into Aside. Preserve its bundled reader references,
   source-only authoring and no-system-Chrome PDF path. Adapt host-specific work
   there instead of adding an Aside runtime dependency to codexclaw.
4. Verify the downstream revision against every applicable acceptance criterion,
   using isolated fixtures. Record the upstream SHA, downstream SHA, consumer
   version (or unknown), intentional differences, and completed/skipped checks.
5. Close the Aside issue only after the port is merged into its delivery branch
   and downstream evidence satisfies the full issue. Verify installation too when
   the issue promises installed behavior. Keep partial ports open. An upstream
   issue closing, a green unrelated suite, or a document describing a fix is not
   downstream completion. In upstream PRs use a reference, not a cross-repository
   auto-closing directive for the Aside issue.

Track four states separately: implemented, documented-only, intentionally
different, and pending. The downstream README owns the issue-to-port ledger;
codexclaw records shared changes and their proof rather than maintaining a second
Aside backlog. A checksum or version receipt records provenance, not semantic
correctness. Unexecuted required checks never count as passed checks.

This workflow applies when maintenance is requested. It grants no implicit
cross-repository push, publication, installation, issue closure or independent
loop. Artifact requests retain VIZ-SCOPE-01 and proportionate assurance profiles.

## Historical boundary before the 2026-09-22 fixes

At codexclaw `main` 1914fb679b2f625989be5af2322eec8a749663d4 and `dev`
d9d8a086a1da586008d88c8c9328b781f43e4ca0, the visualizer sources were identical.
The report model, research handoff and standalone receipt gate existed, but the
exporter still ignored NOT RUN. The pipeline described an unshipped Playwright/font
migration. This is the pre-fix baseline, not current capability documentation.
Current commands and limitations belong in report-pipeline.md; downstream acceptance
and the exact ported revision belong in the Aside README and provenance manifest.
