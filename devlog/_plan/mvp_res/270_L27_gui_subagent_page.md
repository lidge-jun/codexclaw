# L27 (Decade 270) -- GUI Subagent Page and 10100 Link Bar

Status: PLANNED
Cluster: 4 - Phase: 2 - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/035_gui_subagent_page.md, 030_phase2_overview.md, 000_research.md

## Goal (one slice)
Implement the main Phase-2 GUI page: per-role model selection, per-role prompt
override editing, and an opencodex link bar shown only when ocx is detected.

## Why now / dependencies
- Upstream: depends on L24 config persistence, L25 model catalog, and L26 GUI
  scaffold. L23 provider status controls ocx detection and link-bar visibility.
- Downstream: L28 verifies this loop for S9 and S10, and also uses it as the
  user-facing proof for S7 and S8.

## Scope (decision-complete)
- Files to add/edit:
  - `plugins/codexclaw/gui/src/pages/Subagents.tsx`
  - `plugins/codexclaw/gui/src/components/ModelSelect.tsx`
  - `plugins/codexclaw/gui/src/components/PromptOverrideEditor.tsx`
  - `plugins/codexclaw/gui/src/components/OcxLinkBar.tsx`
  - `plugins/codexclaw/gui/src/api.ts`
  - GUI tests or smoke fixtures under `plugins/codexclaw/gui/src/`
  - subagent-config API additions only if L24/L25 did not expose enough shape
- Exact behavior:
  - Show explorer, reviewer, and executor rows/cards.
  - Model selector is populated from L25 catalog.
  - Default/main model remains selectable even when ocx is present.
  - Prompt override editor persists nullable per-role override text.
  - Save writes to `.codexclaw/subagents.json` through L24 API.
  - Link bar to `http://localhost:10100` is visible only when L23 reports ocx
    detected.
  - When ocx is absent, hide the link bar and keep selector limited to default.
- Must-NOT-Have:
  - No direct edits to Codex global config.
  - No direct shell calls to `ocx` from React.
  - No assumption that ocx exists for default-model subagent editing.
  - No role prompt override that replaces unrelated system or dev-skill content.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: build Subagents page around catalog/config API contracts; add link-bar
  gating from provider status; add save/load and empty/error states.
- A: audit angle = "does GUI state match actual spawn config and ocx detection?"
  reviewer checks roundtrip persistence, hidden link bar, and prompt override
  application path.
- B: implement components, API calls, optimistic or explicit save state, error
  rendering, and smoke tests.
- C: run GUI build; run browser smoke for ocx absent and fixture-present states;
  inspect `.codexclaw/subagents.json` after save.
- D: done = S9 and S10 pass, and the page demonstrates S7/S8 through the user
  surface.

## Acceptance (1-3 testable criteria)
1. Saving a reviewer model selection updates `.codexclaw/subagents.json` and a
   reload shows the same value.
2. Saving a prompt override persists and is returned by the spawn-time config
   reader.
3. The `http://localhost:10100` link bar appears only when provider status says
   ocx is detected.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- GUI build output from `plugins/codexclaw/gui`.
- Browser smoke check for Subagents page with ocx absent and ocx present fixtures.
- Data dump: `.codexclaw/subagents.json` after model and prompt edits.

## Commit unit (one atomic conventional commit)
`feat(gui): add subagent model and prompt settings page`

## Blocked-on (jun decision id, if any)
None. The page uses the L26 GUI direction once Q-P2-1 is resolved, but the page
behavior is planned and independent of whether the scaffold is fresh or reused.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/035_gui_subagent_page.md
- 260629_codexclaw_mvp/030_phase2_overview.md (S9, S10)
- 260629_codexclaw_mvp/000_research.md (10100 link bar; ocx optional and external)
- plugins/codexclaw/gui/README.md
- plugins/codexclaw/components/subagent-config/src/mcp.ts
