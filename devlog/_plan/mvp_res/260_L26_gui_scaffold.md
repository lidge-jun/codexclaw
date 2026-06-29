# L26 (Decade 260) -- GUI Scaffold (Vite + React)

Status: PLANNED (Q-P2-1 resolved; layout-ref only, impl pending)
Cluster: 4 - Phase: 2 - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/034_gui_scaffold.md, 030_phase2_overview.md, 000_research.md

## Goal (one slice)
Create the codexclaw local GUI scaffold and `cxc gui` launcher so Phase 2 has a
web surface for subagent model and prompt configuration.

## Why now / dependencies
- Upstream: depends on L6 for the `cxc` binary entry and on L24 for the config
  API the GUI reads and writes.
- Downstream: unblocks L27 Subagents page and L28 GUI launch/build verification.
  L26 does not require ocx to be installed.

## Scope (decision-complete)
- Files to add/edit:
  - `plugins/codexclaw/gui/package.json`
  - `plugins/codexclaw/gui/index.html`
  - `plugins/codexclaw/gui/src/main.tsx`
  - `plugins/codexclaw/gui/src/App.tsx`
  - `plugins/codexclaw/gui/src/api.ts`
  - `plugins/codexclaw/gui/src/styles.css`
  - `plugins/codexclaw/gui/README.md`
  - `cli/package.json` and CLI launcher wiring for `cxc gui`
- Exact behavior:
  - Use Vite + React, matching the opencodex stack for contributor familiarity.
  - Use opencodex GUI only as a layout/structure reference; implement
    codexclaw content and endpoints in this repo.
  - `cxc gui` starts the local dashboard and prints the URL.
  - GUI reads/writes only through codexclaw APIs; it does not shell out to ocx.
  - The app shell loads without requiring ocx and without requiring an existing
    `.codexclaw/subagents.json`.
  - Full `codexclaw gui` may be documented once; examples use `cxc gui`.
- Must-NOT-Have:
  - No vendored opencodex source.
  - No TUI or install wizard.
  - No global Codex config mutation from the GUI.
  - No hidden dependency on the opencodex dashboard at `localhost:10100`.

## IPABCD micro-cycle
- I: not interview-bearing; Q-P2-1 resolved opencodex as layout/structure
  reference only.
- P: scaffold Vite + React app, wire local dev/build scripts, add `cxc gui`
  launcher, and provide API stubs against L24/L25.
- A: audit angle = "does the GUI stay its own app while avoiding duplicated ocx
  maintenance burden?" Reviewer checks dependency list, launcher, and API
  boundaries.
- B: create app shell, route container, API client, static styles, launcher, and
  smoke test or build check.
- C: run GUI build; run `cxc gui` in a short-lived process and verify the page
  loads with no console errors.
- D: done = the dashboard launches locally and is ready for the L27 Subagents
  page.

## Acceptance (1-3 testable criteria)
1. `cxc gui` starts the codexclaw dashboard and prints a local URL.
2. GUI build completes successfully from `plugins/codexclaw/gui`.
3. The app shell loads in ocx-absent state without console errors.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- CLI stdout: `cxc gui` startup URL and clean shutdown.
- GUI build output from `plugins/codexclaw/gui`.
- Browser/console smoke check for the app shell.

## Commit unit (one atomic conventional commit)
`feat(gui): scaffold codexclaw dashboard launcher`

## Blocked-on (jun decision id, if any)
None. Q-P2-1 resolved: opencodex GUI is a layout/structure reference only; do
not copy, vendor, or import opencodex GUI files.

## Resolved (jun 2026-06-30)
Q-P2-1 resolved GUI reuse policy: codexclaw builds its own Vite/React GUI and
borrows only layout patterns from opencodex. opencodex GUI is API-driven (for
example, `gui/src/pages/Subagents.tsx` fetches `/api/*`), so codexclaw implements
new content and codexclaw endpoints while keeping the acceptance requirement
that no opencodex GUI files are copied.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/034_gui_scaffold.md
- 260629_codexclaw_mvp/030_phase2_overview.md (Q-P2-1)
- 260629_codexclaw_mvp/000_research.md (opencodex gui/ is Vite + React; codexclaw ships own GUI)
- plugins/codexclaw/gui/README.md
- cli/package.json
