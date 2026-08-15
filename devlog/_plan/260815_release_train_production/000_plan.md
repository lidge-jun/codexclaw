# 260815 — Release gate + release train, production grade

Status: PLANNED

## Objective

Close the gap the 2026-08-15 state assessment identified: `main` is an 8.2-grade
harness while the published product is a 6.3-grade artifact from 2026-07-06. This
unit makes the release channel itself the deliverable — inventory truth generated
instead of hand-maintained, a release gate that actually refuses bad candidates,
a CI matrix that tests the *installed* product, and a release train that publishes
from an exact head SHA.

Parent evidence: the user-supplied assessment (P0 release truth -> P1 packed-install
lifecycle -> P2 cost measurement -> P3 public eval). This unit executes P0 and P1 plus
the release-train channel; P2/P3 stay out of scope except where the release gate needs
a receipt slot for them.

## Work classification

C4 — cross-module change touching CI, release publication, generated docs, and a
shipped gate component. Full PABCD per work-phase, docs-first roadmap cycle first.

## Dependency-ordered phase map (PHASE-SPLIT-01)

Each phase consumes the verified output of the previous one. No effort bucketing.

| Doc | Work-phase | Consumes | Produces |
| --- | --- | --- | --- |
| `010` | Release truth | current repo state | correct published numbers, resolved PR #1 ancestry |
| `020` | Inventory SOT generator + set drift gate | 010 corrected numbers | `generated/inventory.json`, injected doc blocks, set-comparison gate |
| `030` | Executable release gate | 020 inventory hash | candidate manifest producer + fail-closed `cxc release` CLI |
| `040` | Release train channel | 030 gate CLI | macOS CI, packed-install lifecycle job, `release.yml` |
| `050` | Publish + close channel | 040 green runs | published `v0.2.0-beta.1`, closed issues/PRs |

Ordering rationale: the generator cannot be trusted until the numbers it must
reproduce are known-correct (010 -> 020); the release gate inventoryHash receipt is
meaningless without a generator (020 -> 030); the release workflow calls the gate CLI
(030 -> 040); publication requires the workflow to have run green (040 -> 050).

## Scope boundary

IN: `.github/workflows/*`, `plugins/codexclaw/scripts/*`,
`plugins/codexclaw/components/*/src|test`, `.codex-plugin/plugin.json`,
`package.json`, `README*.md`, `structure/*.md`, `docs-site/src/*`, `docs/*`,
this devlog unit.

OUT: skill-architecture changes, PABCD semantics, new dev routers, the public
comparative eval corpus (P3), recall subsystem redesign, force-push or history rewrite.

## Research documents

- `001_ancestry_and_counts.md` — PR #1 ancestry resolution and the real test count
- `002_inventory_drift_map.md` — every published number vs. reality
- `003_release_channel_state.md` — the release channel today vs. a production train

## Implementation documents

- `010_release_truth.md`
- `020_inventory_sot_generator.md`
- `030_executable_release_gate.md`
- `040_release_train_channel.md`
- `050_publish_and_close.md`

## Terminal outcome expectations

DONE requires a published release whose gate manifest links green exact-head CI runs
on three platforms plus a packed-install lifecycle receipt. BLOCKED only if GitHub
authorization fails after retry. Anything requiring force-push or secret exposure is
UNSAFE and stops the loop.
