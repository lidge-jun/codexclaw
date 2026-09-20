# 000 — dev-visualizer: verify in proportion, then reinstall from dev

## Problem

`DIAGRAM-RENDER-VERIFY-01` was written as one unconditional obligation: render the
final artifact, read the screenshot, inspect the longest labels at 320/736px and the
desktop size. It was authored when a visual usually meant a standalone file nobody had
looked at yet. Most requests now are an inline conversation visualization or a small
static page, and for those the reader sees the render before a screenshot could reach
the agent. The rule survived as a gate that buys nothing and costs a round trip on
every small artifact.

The relief that already existed — `REPORT-ASSURANCE-01` profiles — applies only to
reports with a PDF receipt. Nothing covered "a diagram in the chat" or "one static
HTML page".

## Change

`VIZ-VERIFY-SCALE-01` replaces the flat obligation with four tiers keyed to how the
artifact can fail:

| Tier | Required |
|---|---|
| Inline visual / host-rendered diagram | reread the source, send it |
| Small static HTML/SVG in ordinary flow | reread the source, save, return the link |
| Computed result (data marks, derived geometry, runtime library, interaction) | `DIAGRAM-RENDER-VERIFY-01` in full |
| Leaves the conversation as a file (PDF, print, multi-page, published) | `DIAGRAM-RENDER-VERIFY-01` plus a stated assurance profile |

Two invariants keep the relief honest: an unrun check is never written up as a passed
one, and a reported or observed defect promotes the artifact to the rendered tier for
every further fix. `DIAGRAM-RENDER-VERIFY-01` keeps its ID and its full procedure —
other skills cite it — and now names the tiers that call for it.

`DIAGRAM-A11Y-01` splits the same way: the composition decisions (names, heading
order, text alternatives, non-color meaning, contrast, reduced motion) still apply to
the smallest inline visual; only the separate inspection pass moves to the tiers that
already render.

## Scope

Skill documentation only. No component, hook or script behavior changes. The manifest
cachebuster is bumped so `codex plugin add` re-copies the payload, and
`inventory.json` follows it.

## Proof

- `npm run gate` — OK.
- `node --test plugins/codexclaw/test/visualizer-packaging.test.mjs
  plugins/codexclaw/test/visualize-inspection.test.mjs` — 6/6.
- `npm test` — full suite.

## Reinstall

Every ssh host with codexclaw installed reinstalls from `dev` using
`plugins/codexclaw/scripts/remote-dev-install.sh`. Scope is the four hosts surveyed in
`260920_thread_dispatch_loop/040`: macmini, macbookpro-2, suji, mini. A host without an
install stays out of scope, and an unreachable host is reported unreachable. Per-host
results are recorded in `001_reinstall_evidence.md` after the run, from each host's own
reported version.
