# L7 (Decade 070) -- Build and Verification

Status: DONE
Cluster: 1 - Phase: 1 - Shorthand: cxc
Source-of-record: 070_packaging.md; 070.1_pass7_P_plan.md; 029_phase1_verification.md; 029.1_phase1_verification_done.md; STATUS.md

## Goal (one slice)
Close Phase 1 by building the plugin artifacts, validating the single-plugin layout, and proving S1-S5
with fresh offline evidence.

## Why now / dependencies
L7 depends on L1-L6 because it aggregates their shipped artifacts: state hooks, goal gate, skills,
roles, config activation, provider bridge no-op, and MCP no-tool server. It is the Phase 1 D-gate.

## Scope (decision-complete)
- Files added/edited:
  - `plugins/codexclaw/scripts/build.mjs`
  - `plugins/codexclaw/components/*/dist/**`
  - `plugins/codexclaw/test/build.test.mjs`
  - `plugins/codexclaw/components/provider-bridge/src/cli.ts`
  - `plugins/codexclaw/components/subagent-config/src/mcp.ts`
  - `plugins/codexclaw/.codex-plugin/plugin.json`
  - `plugins/codexclaw/.mcp.json`
  - `devlog/_plan/260629_codexclaw_mvp/029.1_phase1_verification_done.md`
  - `devlog/_plan/260629_codexclaw_mvp/029_phase1_verification.md`
  - `devlog/_plan/260629_codexclaw_mvp/070_packaging.md`
  - `devlog/_plan/260629_codexclaw_mvp/STATUS.md`
- Build behavior:
  - compile component `src/*.ts` to `dist/*.js` with Node 24 `stripTypeScriptTypes`.
  - rewrite relative `.ts` import specifiers to `.js`.
  - validate hook command paths, MCP args, skills, and placeholder markers.
  - commit `dist/` so marketplace install does not need a post-clone build.
- Component entries built:
  - `pabcd-state`
  - `config-guard`
  - `provider-bridge`
  - `subagent-config`
- Phase 1 gate mapping:
  - S1 install + skill discovery: layout and 13 skills.
  - S2 IPABCD directive injection: compiled hook emits context and writes active state.
  - S3 pilot dev skill routes: `dev` implicit, routers and `pabcd` non-implicit.
  - S4 config.toml guard: config-guard tests prove offline backup/revert/drift behavior.
  - S5 subagent config: role TOMLs are default-model spawn-valid with inline contract.
- Must-NOT-Have:
  - No network marketplace install in the offline gate.
  - No GUI build.
  - No ocx provider runtime beyond safe SessionStart no-op.
  - No placeholder markers in shipped runtime sources or dist.

## IPABCD micro-cycle
- I (if interview-bearing): not interview-bearing; this is the Phase 1 verification loop.
- P: planned a zero-dependency Node 24 build, idempotency test, compiled hook smoke, MCP handshake,
  and S1-S5 evidence notes.
- A: audit found four blockers: invalid `stripTypeScriptTypes` mode, S2 overclaiming FSM advance,
  provider/MCP stubs on runtime paths, and S5 overclaiming live spawn; all were corrected.
- B: implemented build/validation, generated 12 dist files, replaced provider placeholder with a safe
  no-op, and upgraded subagent-config to a valid no-tool stdio MCP server.
- C: `npm test` passed 73/73: pabcd-state 52/52, config-guard 15/15, build 6/6; `npm run build`
  compiled 12 files and validated layout.
- D: done = Phase 1 closure was reconciled after B1/B2/B3 wiring-gap fixes, including PreToolUse
  manifest wiring, root `cxc` config-guard delegation, and `pabcd` non-implicit policy.

## Acceptance (1-3 testable criteria)
- `npm run build` exits 0, compiles 12 files, and validates the plugin layout.
- `npm test` exits 0 with 73/73 pass.
- B1/B2/B3 wiring gaps are closed: PreToolUse hook registered, root CLI delegates config-guard, and
  `pabcd` has `allow_implicit_invocation:false`.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `npm test` -> 73/73 pass.
- `npm run build` -> 12 files compiled, layout validated, exit 0.
- Build tests cover idempotent dist, manifest dist paths, `.ts` to `.js` rewrite, compiled hook smoke,
  MCP initialize handshake, and placeholder scan.

## Commit unit (one atomic conventional commit)
One verification/build commit plus one wiring-gap correction commit; the final as-built closure is the
post-ba20b64 Phase 1 state.

## Blocked-on (jun decision id, if any)
None for Phase 1. Phase 2 and Phase 3 decisions remain outside L7.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/070_packaging.md`
- `devlog/_plan/260629_codexclaw_mvp/070.1_pass7_P_plan.md`
- `devlog/_plan/260629_codexclaw_mvp/029_phase1_verification.md`
- `devlog/_plan/260629_codexclaw_mvp/029.1_phase1_verification_done.md`
- `devlog/_plan/260629_codexclaw_mvp/160_pass1_7_completeness_audit.md`
- `plugins/codexclaw/scripts/build.mjs`
- `plugins/codexclaw/test/build.test.mjs`
- `plugins/codexclaw/.codex-plugin/plugin.json`
- `bin/codexclaw.mjs`
- codex-rs plugin hook execution and marketplace install behavior cited in 070.1.
