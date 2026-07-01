# L25 (Decade 250) -- Model Catalog (native catalog + ocx)

Status: DONE
Cluster: 4 - Phase: 2 - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/033_model_catalog.md, 030_phase2_overview.md, 000_research.md

## Goal (one slice)
Build the selectable model catalog from Codex's native catalog plus any models
exposed by the optional ocx provider bridge, with no duplicate entries.

## Why now / dependencies
- Upstream: depends on L23 provider status and on L24 config schema so selected
  model IDs have a stable destination.
- Downstream: unblocks L27 model selector population and L28 verification for
  S7. L24 can ship first with native-catalog values.

## Scope (decision-complete)
- Files to add/edit:
  - `plugins/codexclaw/components/subagent-config/src/catalog.ts`
  - `plugins/codexclaw/components/subagent-config/src/mcp.ts`
  - `plugins/codexclaw/components/subagent-config/test/catalog.test.ts`
  - provider-bridge status reader if L23 exposes catalog metadata there
  - generated `dist/` output for changed components
- Exact behavior:
  - Always include Codex-native catalog entries as first-class choices.
  - When ocx is detected and exposes a catalog, include ocx models after the
    native entries.
  - Deduplicate by stable model ID; keep native entries first.
  - When ocx is absent, return Codex-native catalog entries.
  - Return enough metadata for the GUI to label default vs ocx-backed entries.
  - If the exact ocx catalog interface is not available, expose a clear
    unsupported-catalog state rather than inventing a path.
- Must-NOT-Have:
  - No vendored ocx catalog files.
  - No network fetch to arbitrary providers from codexclaw.
  - No selected-model write from this loop; L24 owns persistence.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: add a catalog module that combines native catalog metadata with the ocx
  source chosen by L23, then expose it through the config/MCP boundary.
- A: audit angle = "does the catalog fabricate models or hide default mode?"
  reviewer checks ocx-absent, ocx-present, duplicate, and unsupported-interface
  cases.
- B: implement catalog normalization, default-first dedupe, status/error shape,
  and tests with fixture ocx outputs.
- C: node:test catalog fixtures; CLI/data dump of catalog JSON for absent and
  present ocx states.
- D: done = S7 passes: GUI/API sees native+n choices when ocx has n models, and
  native catalog choices when ocx is absent.

## Acceptance (1-3 testable criteria)
1. With ocx absent, catalog output contains Codex-native entries from the
   allowlisted live catalog source.
2. With fixture ocx catalog of n distinct models, output contains native entries
   plus those n models, with native entries first.
3. Duplicate model IDs are collapsed without removing native entries.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test path: `plugins/codexclaw/components/subagent-config/test/catalog.test.ts`
- Data dump: catalog JSON for ocx absent, ocx present, and duplicate fixtures.

## Commit unit (one atomic conventional commit)
`feat(subagents): expose native-plus-ocx model catalog`

## Blocked-on (jun decision id, if any)
None. Q3 resolved absent ocx as Codex-native catalog mode, while ocx-present
adds external provider models on top.

## Resolved (jun 2026-06-30)
Q3 resolved that multi-model works without ocx through Codex's native catalog,
not a single fallback model. Ground truth: opencodex
`src/codex-catalog.ts:43` documents the native fallback and
`src/codex-catalog.ts:44` defines `NATIVE_OPENAI_MODELS =
["gpt-5.5","gpt-5.4","gpt-5.4-mini","gpt-5.3-codex-spark"]`, read from the
Codex live catalog cache (`CODEX_MODELS_CACHE_PATH`) through the allowlist.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/033_model_catalog.md
- 260629_codexclaw_mvp/030_phase2_overview.md (S7)
- 260629_codexclaw_mvp/000_research.md (ocx provider proxy; default model remains available)
- plugins/codexclaw/components/provider-bridge/src/cli.ts
- plugins/codexclaw/components/subagent-config/src/mcp.ts
