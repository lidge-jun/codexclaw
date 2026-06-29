# L24 (Decade 240) -- Subagent Config Store

Status: PLANNED
Cluster: 4 - Phase: 2 - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/032_subagent_config_store.md, 030_phase2_overview.md, 000_research.md

## Goal (one slice)
Persist per-role subagent model and prompt override settings in
`.codexclaw/subagents.json`, and make spawned explorer/reviewer/executor
subagents honor that file.

## Why now / dependencies
- Upstream: depends on L5 role definitions and the existing subagent-config
  component stub. It does not require ocx; default-model mode must work alone.
- Downstream: unblocks L25 catalog selection, L27 GUI editing, and L28
  verification for S8 and S10.

## Scope (decision-complete)
- Files to add/edit:
  - `plugins/codexclaw/components/subagent-config/src/mcp.ts`
  - `plugins/codexclaw/components/subagent-config/src/store.ts`
  - `plugins/codexclaw/components/subagent-config/test/store.test.ts`
  - `plugins/codexclaw/components/subagent-config/test/mcp.test.ts`
  - generated `dist/` output for the subagent-config component
  - role spawn integration at the smallest existing Phase-1 subagent boundary
- Store shape:
  - `.codexclaw/subagents.json`
  - `roles.explorer`, `roles.reviewer`, and `roles.executor`
  - each role has `mode`, `model`, and `promptOverride`
  - `mode` is `default` or `model`
- Exact behavior:
  - Missing file returns defaults for all roles.
  - `mode: default` ignores `model` and uses the main Codex model.
  - `mode: model` requires a selected model from the catalog.
  - `promptOverride` appends or replaces only the role prompt segment defined by
    this component, not unrelated system instructions.
  - Writes are atomic enough for a local config file: write temp file then rename.
- Must-NOT-Have:
  - No global Codex config mutation.
  - No ocx requirement for default-model subagents.
  - No role names beyond the shipped Phase-1 roles unless a later loop adds them.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: define schema, default factory, read/write API, validation errors, and the
  MCP/tool surface needed by GUI and spawn integration.
- A: audit angle = "can a malformed config break every subagent spawn?"
  reviewer verifies fallback, validation, and error messages.
- B: implement store module, expose read/update methods, connect spawn-time role
  resolution, and add tests for defaults and overrides.
- C: node:test store and MCP tests; CLI or data dump showing a written mapping
  read back and applied to a role spawn request.
- D: done = S8 and S10 have a persistence source: role model assignment persists
  and role prompt override is applied on spawn.

## Acceptance (1-3 testable criteria)
1. Missing `.codexclaw/subagents.json` resolves explorer/reviewer/executor to
   `mode: default`, `model: null`, and `promptOverride: null`.
2. Updating reviewer to `mode: model` with a selected model persists to disk and
   is read back exactly.
3. A spawned role receives the configured model mode and prompt override while
   default-mode roles continue to use the main model.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test path: `plugins/codexclaw/components/subagent-config/test/store.test.ts`
- node:test path: `plugins/codexclaw/components/subagent-config/test/mcp.test.ts`
- Data dump: normalized `.codexclaw/subagents.json` before and after update.

## Commit unit (one atomic conventional commit)
`feat(subagents): persist per-role model and prompt config`

## Blocked-on (jun decision id, if any)
None. The store is ocx-optional by design; Q-P2-2 only affects which non-default
models L25 may offer.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/032_subagent_config_store.md
- 260629_codexclaw_mvp/030_phase2_overview.md (S8, S10)
- 260629_codexclaw_mvp/000_research.md (ocx-free users still get default-model subagents)
- plugins/codexclaw/components/subagent-config/src/mcp.ts
- plugins/codexclaw/agents/explorer.toml
- plugins/codexclaw/agents/reviewer.toml
- plugins/codexclaw/agents/executor.toml
