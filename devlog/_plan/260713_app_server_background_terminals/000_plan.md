# App-server background terminal lifecycle patch plan

Date: 2026-07-13  
Status: PLAN READY, implementation not started  
Work class: C3 — upstream experimental API, runtime/process lifecycle, cross-session guidance

## Loop specification

- Loop archetype: satisfy-spec repair. Replace a stale capability claim with an upstream- and runtime-proven lifecycle contract.
- Trigger: Codex `0.140.0` added app-server background-terminal list/terminate APIs, and a live Codex Desktop `0.144.0-alpha.4` task successfully exposed a model-created unified-exec process.
- Goal: codexclaw must teach the exact create → list → poll/write → terminate/clean lifecycle without claiming that a plugin can attach to the Desktop app's private stdio connection.
- Non-goals: no durable scheduler replacement, no detached/reattached CLI shell feature, no process supervisor, no direct modification of `openai/codex`, no rewriting historical `_fin/` records, and no fake wrapper that launches a second app-server then claims it controls the Desktop thread.
- Verifier: `node --test plugins/codexclaw/test/background-terminal-doc-sync.test.mjs` proves the contract is synchronized; `npm run build` and `npm test` prove the plugin still builds; a manual app-server probe proves the experimental method gate and same-instance rule.
- Stop condition: live doctrine names all three methods, experimental negotiation, loaded-thread/same-instance scope, the separate `command/exec` registry, `turn/interrupt` behavior, safe termination, and fallback behavior when the RPC surface is not callable.
- Memory artifact: this unit, especially `001_codex_rs_runtime_guide.md`; once implemented and checked, move the whole folder to `devlog/_fin/`.
- Expected terminal outcomes: `DONE` after docs, skill guidance, and drift test land; `BLOCKED` if upstream removes or renames the v2 methods; `NEEDS_HUMAN` if a host-controlled endpoint is required for a future operator client.
- Escalation: the main agent keeps documentation and contract ownership. Any future runtime-client slice must be amended into P before delegation; after two failed implementations the main agent reclaims it. No worker may improvise a Desktop stdio attachment in B.

## Baseline and contradiction

The current durable record says terminal processes are managed only through `exec_command` plus `write_stdin`, and that server-owned background management is absent:

- `devlog/_fin/mvp_res/202_L20.2_bgtask_spawn_wait_polling.md`
- `devlog/_fin/260629_codexclaw_mvp/090_clijaw_command_mapping.md`
- `structure/60_native_capabilities.md`

That statement was accurate before upstream PR #26041. It is now incomplete:

- The model-visible tool path remains `exec_command` / `write_stdin`.
- The app-server client path can now list and terminate the thread's surviving unified-exec processes.
- This is process lifecycle management, not durable job scheduling or a detach/reattach shell contract.
- The API is usable only from an initialized experimental app-server connection that owns or has loaded the target thread.

Historical `_fin/` files remain immutable evidence of the old decision. The patch updates current doctrine instead of editing history.

## Dependency-ordered work phases

| Stage | Document | Outcome |
|---|---|---|
| Research prerequisite | `001_codex_rs_runtime_guide.md` | Pins the upstream type names, call graph, runtime constraints, and reproducible probe sequence used by every later phase. |
| 1. Capability truth sync | `010_phase1_capability_truth_sync.md` | General source of truth distinguishes model tools, app-server lifecycle APIs, and schedulers. |
| 2. Agent lifecycle guidance | `020_phase2_agent_lifecycle_guidance.md` | `cxc-dev` contains a safe, executable decision tree and links the detailed guide. |
| 3. Drift gate and live probe | `030_phase3_contract_gate.md` | A text-contract test prevents regression and the manual probe records exact runtime behavior. |

Each work phase runs its own P→A→B→C→D cycle. This current cycle is design-only: it writes and audits all phase plans but does not enter B.

## Planned file map

```text
devlog/_plan/260713_app_server_background_terminals/
  000_plan.md                                  NEW — master plan and lifecycle ledger
  001_codex_rs_runtime_guide.md                NEW — upstream source map and operator guide
  003_live_probe_evidence.md                   NEW in phase 3 — redacted request/response and teardown evidence
  010_phase1_capability_truth_sync.md          NEW — phase 1 diff plan
  020_phase2_agent_lifecycle_guidance.md       NEW — phase 2 diff plan
  030_phase3_contract_gate.md                  NEW — phase 3 diff plan

structure/60_native_capabilities.md            MODIFY in phase 1
plugins/codexclaw/skills/dev/SKILL.md           MODIFY in phase 2
plugins/codexclaw/skills/dev/references/
  background-terminals.md                      NEW in phase 2
plugins/codexclaw/test/
  background-terminal-doc-sync.test.mjs        NEW in phase 3
```

## Scope boundary

### In

- Correct current capability doctrine.
- Document upstream Rust ownership and call flow at the merge commit and current `main`.
- Give copy-paste JSON-RPC examples for stdio and explicit WebSocket app-server instances.
- Define list/terminate/clean safety behavior and verification.
- Add a drift test over the live doctrine and skill reference.

### Out

- `cxc terminal list|terminate|clean` CLI commands.
- Connecting to `/Applications/ChatGPT.app`'s existing private stdio stream.
- Reusing `command/exec` as a substitute for thread unified exec.
- Promising OS PID, CPU, or RSS data; these fields remain nullable and are currently emitted as `null`.
- Equating a background terminal with a durable task, goal, scheduler job, subagent, or automation.

## Future adapter gate

A codexclaw operator client becomes a separate implementation unit only when at least one of these is true:

1. the host exposes `thread/backgroundTerminals/*` as callable tools to the model;
2. the host injects an authenticated app-server WebSocket/Unix endpoint for the current Desktop process; or
3. codexclaw itself owns the app-server process and thread lifecycle end to end.

Until then, a CLI wrapper would control only its own app-server instance and would misrepresent the current Desktop task. This plan forbids that shortcut.

## Acceptance criteria

1. The source of truth names `list`, `terminate`, and `clean`, and states that all are experimental app-server v2 methods.
2. The guide shows `initialize` with `capabilities.experimentalApi=true`, `initialized`, thread load/start, process creation, list, terminate, and final empty-list verification.
3. The guide explicitly distinguishes the core `UnifiedExecProcessManager` type and session field `unified_exec_manager` from app-server `CommandExecManager`.
4. The guide states that `turn/interrupt` does not terminate background terminals.
5. The dev skill chooses the current-session tool when available, uses `write_stdin` as the model-tool fallback, and refuses unsafe PID guessing or blind `kill`.
6. A text-contract test fails if the method names, experimental gate, same-instance rule, or `command/exec` separation disappear.
7. Phase 3 writes the redacted runtime evidence to the exact numbered path `devlog/_plan/260713_app_server_background_terminals/003_live_probe_evidence.md`; no secrets, auth material, full environment, or unrelated process data are retained.
8. No historical `_fin/` file is modified.

## Verification commands for the implementation cycles

```bash
node --test plugins/codexclaw/test/background-terminal-doc-sync.test.mjs
npm run build
npm test
git diff --check
EVIDENCE=devlog/_plan/260713_app_server_background_terminals/003_live_probe_evidence.md
test -s "$EVIDENCE"
rg -n "Experimental-gate|Same-instance|final empty-list|command/exec|turn/interrupt|Teardown receipt" "$EVIDENCE"
if rg -n '(Authorization:|Bearer |sk-[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|/Users/[^/]+/\.codex)' "$EVIDENCE"; then exit 1; fi
if rg -n '[ \t]+$' "$EVIDENCE"; then exit 1; fi
if ps ax -o command= | rg '[b]ackground-probe'; then exit 1; fi
# When the WebSocket probe path was used:
if lsof -nP -iTCP:8765 -sTCP:LISTEN | rg .; then exit 1; fi
rg -n "thread/backgroundTerminals/(list|terminate|clean)|experimentalApi|CommandExecManager|UnifiedExecProcessManager|unified_exec_manager" \
  structure/60_native_capabilities.md \
  plugins/codexclaw/skills/dev/SKILL.md \
  plugins/codexclaw/skills/dev/references/background-terminals.md
```

## Plan-phase evidence

- Upstream source: OpenAI Codex PR #26041, merge commit `a1a8807e9d67fad4b95f2730a9669eca5a9d27d0`.
- Release containment: annotated tag `rust-v0.140.0` resolves to commit `6506579001c322927a3e4bd440563267a7ac6c1f`; GitHub compare reports the merge commit as its merge base and the tag commit 145 commits ahead.
- Local binary: Codex Desktop bundles `codex-cli 0.144.0-alpha.4` and generates all three experimental schemas.
- Ephemeral live observation, not durable proof: a separate app-server accepted experimental initialization and recognized `thread/backgroundTerminals/list`, then returned `thread not found` for a thread owned by the Desktop app-server. In the actual Desktop task, unified-exec session `46623` appeared in the background-terminal list and was subsequently stopped with `Ctrl-C`. Phase 3 requires a fresh redacted transcript and makes that artifact authoritative.

## Audit ledger

- Round 1: `FAIL`. Blocker B1 corrected the phantom shortened manager identifier to upstream type `UnifiedExecProcessManager` and field `unified_exec_manager`. Medium/low amendments added fresh-connection capability testing, source links for loaded-thread lookup, nullable metrics, phase-local loop headers, bounded probes, wider drift assertions, and durable-evidence requirements.
- Round 2: `PASS` (Luna independent read-only audit). All High/Medium findings were rechecked against the merge commit and current `main`; only non-blocking closeout prose remained, and this ledger update resolves it. No transition to B was requested or performed.
