# L23 (Decade 230) -- Provider Bridge (ocx detect / graceful skip)

Status: PLANNED (Q-P2-2 resolved; detect-only, impl pending)
Cluster: 4 - Phase: 2 - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/031_provider_bridge.md, 030_phase2_overview.md, 000_research.md

## Goal (one slice)
Add the SessionStart provider bridge that detects optional opencodex (`ocx`),
reads the external subagent/model list when available, and otherwise keeps
codexclaw usable on the native Codex catalog with no session failure.

## Why now / dependencies
- Upstream: depends on L6 install/activation so the SessionStart hook is active,
  and on the Phase-1 subagent roles from L5 so default-model subagents already
  exist without ocx.
- Downstream: unblocks L25 catalog population and L27 link-bar visibility. L28
  uses this loop as the S6 verification source.

## Scope (decision-complete)
- Files to add/edit:
  - `plugins/codexclaw/components/provider-bridge/src/cli.ts`
  - `plugins/codexclaw/components/provider-bridge/test/cli.test.ts`
  - `plugins/codexclaw/hooks/session-start-ensuring-provider-bridge.json`
  - generated `dist/` output for the provider bridge component
- Exact behavior:
  - Detect `ocx` by PATH first and, if needed, by the known local service
    surface used by opencodex.
  - Present path: report detected ocx and read its external subagent/model list.
  - Absent path: return exit 0 and leave codexclaw on the native Codex catalog.
  - Emit machine-readable status for later catalog and GUI checks.
  - Use `cxc doctor` wording for diagnostics when the bridge cannot execute.
- Must-NOT-Have:
  - No vendored opencodex code or copied GUI assets.
  - No substitute provider when ocx is absent beyond Codex's native catalog.
  - No session failure merely because ocx is not installed.
  - No hidden mutation of Codex config or auto-ensure behavior.

## IPABCD micro-cycle
- I: not interview-bearing; the only open question is the Q-P2-2 fork below.
- P: add a small provider-bridge CLI with detect/read/status branches and wire
  the SessionStart hook to call it.
- A: audit angle = "does missing ocx degrade to default model without masking a
  real detection/read failure?" Reviewer checks absent, present-success, and
  present-failure stdout/stderr behavior.
- B: implement detection, read external model/subagent data only when present,
  add status output, and compile the component dist.
- C: run node:test with PATH-stubbed ocx present/absent cases; run the hook
  command directly and capture CLI stdout.
- D: done = S6 passes: ocx present is detected and read; ocx absent exits
  cleanly and native-catalog codexclaw still starts.

## Acceptance (1-3 testable criteria)
1. With a stub `ocx` on PATH, provider bridge detects it, reads fixture
   subagent/model data, and exits 0 when the stub succeeds.
2. With no `ocx` on PATH and no detected service, provider bridge exits 0 and
   reports native-catalog mode for downstream consumers.
3. If ocx is detected but its list read fails, the bridge reports that failure
   clearly without silently pretending multi-provider mode is active.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test path: `plugins/codexclaw/components/provider-bridge/test/cli.test.ts`
- CLI stdout: SessionStart command and `cxc doctor` provider section.

## Commit unit (one atomic conventional commit)
`feat(provider): add optional ocx detect bridge`

## Blocked-on (jun decision id, if any)
None. Q-P2-2 resolved: ocx is detect-only in MVP, with any explicit ensure
command deferred to a future `cxc` command outside MVP scope.

## Resolved (jun 2026-06-30)
Q-P2-2/Q5 resolved the bridge as detect-only: do not auto-run the ocx setup
command from
SessionStart. Q3 resolved absent-ocx catalog behavior as Codex-native
multi-model, not single-model: opencodex `src/codex-catalog.ts:43` documents the
native fallback and `src/codex-catalog.ts:44` defines `NATIVE_OPENAI_MODELS =
["gpt-5.5","gpt-5.4","gpt-5.4-mini","gpt-5.3-codex-spark"]`, sourced from the
Codex live catalog cache (`CODEX_MODELS_CACHE_PATH`) through the allowlist.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/031_provider_bridge.md
- 260629_codexclaw_mvp/030_phase2_overview.md (S6, Q-P2-2)
- 260629_codexclaw_mvp/000_research.md (ocx optional provider proxy; never vendored)
- plugins/codexclaw/components/provider-bridge/src/cli.ts
- plugins/codexclaw/hooks/session-start-ensuring-provider-bridge.json
