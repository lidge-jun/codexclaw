# L28 (Decade 280) -- Phase 2 Integration and Verification

Status: PLANNED
Cluster: 4 - Phase: 2 - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/036_phase2_verification.md, 030_phase2_overview.md, 000_research.md

## Goal (one slice)
Run the Phase-2 integration gate and prove success criteria S6 through S10 for
multi-model subagents and the GUI.

## Why now / dependencies
- Upstream: depends on L23 provider bridge, L24 subagent config store, L25 model
  catalog, L26 GUI scaffold, and L27 Subagents page.
- Downstream: closes Cluster 4 and allows later scheduled-work loops to assume
  that multi-model and GUI configuration are stable.

## Scope (decision-complete)
- Files to add/edit:
  - `plugins/codexclaw/test/phase2.test.mjs`
  - `plugins/codexclaw/test/fixtures/phase2/`
  - `plugins/codexclaw/gui` test/smoke scripts if L26/L27 place them there
  - `devlog/_fin/` done note only when implementation actually completes
- Exact behavior verified:
  - S6: ocx present runs `ocx ensure`; ocx absent gracefully skips.
  - S7: catalog equals ocx-provided models plus the main/default model.
  - S8: assigning a model to explorer/reviewer/executor persists and spawned
    subagent config honors it.
  - S9: GUI link bar to `http://localhost:10100` appears only when ocx is
    detected.
  - S10: per-role prompt override is editable in GUI and applied on spawn.
  - GUI builds and launches through `cxc gui`.
- Must-NOT-Have:
  - No Phase-2 DONE claim while Q-P2-1 or Q-P2-2 remains unresolved for shipped
    behavior.
  - No real provider credentials in fixtures or logs.
  - No vendored ocx assets.
  - No index edit from this loop unless a separate owner updates it.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: write an integration matrix that exercises ocx absent and fixture-present
  states, config persistence, spawn config resolution, GUI build, and link-bar
  gating.
- A: audit angle = "does every S6-S10 criterion have executable evidence?"
  reviewer compares the matrix against Phase-2 overview before marking done.
- B: implement integration tests, fixture ocx command/status, GUI smoke script,
  and verification output collection.
- C: run targeted node:test files, GUI build, `cxc gui` smoke, and data dumps for
  catalog/config. Record stdout paths or summary in the done note.
- D: done = all S6-S10 checks pass and Phase 2 has an evidence bundle.

## Acceptance (1-3 testable criteria)
1. `plugins/codexclaw/test/phase2.test.mjs` covers S6, S7, S8, S9, and S10 with
   deterministic fixtures.
2. GUI build and `cxc gui` smoke both pass without requiring ocx to be installed.
3. The verification output includes absent-ocx and present-ocx evidence without
   exposing credentials or vendoring ocx.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test path: `plugins/codexclaw/test/phase2.test.mjs`
- GUI build output from `plugins/codexclaw/gui`
- CLI stdout: `cxc gui` startup and provider bridge fixture runs.
- Data dump: catalog JSON and `.codexclaw/subagents.json` roundtrip.

## Commit unit (one atomic conventional commit)
`test(phase2): verify multi-model subagents and gui gate`

## Blocked-on (jun decision id, if any)
None for the verification plan. Execution cannot mark Phase 2 done until
Q-P2-1 and Q-P2-2 have selected shipped behavior for L26 and L23.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/036_phase2_verification.md
- 260629_codexclaw_mvp/030_phase2_overview.md (S6-S10)
- 260629_codexclaw_mvp/000_research.md (ocx optional, GUI at 10100, no vendoring)
- devlog/_plan/mvp_res/230_L23_provider_bridge.md
- devlog/_plan/mvp_res/240_L24_subagent_config_store.md
- devlog/_plan/mvp_res/250_L25_model_catalog.md
- devlog/_plan/mvp_res/260_L26_gui_scaffold.md
- devlog/_plan/mvp_res/270_L27_gui_subagent_page.md
