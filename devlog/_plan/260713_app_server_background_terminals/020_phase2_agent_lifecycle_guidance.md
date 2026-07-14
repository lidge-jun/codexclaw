# Phase 2 — agent lifecycle guidance

## Loop-spec header

- Inherits: `000_plan.md` loop specification.
- Depends on: phase 1 completed and `structure/60_native_capabilities.md` carries the audited terms from `001_codex_rs_runtime_guide.md`.
- Trigger: agents can create a long-lived unified-exec session but lack a durable decision tree for the app-server lifecycle surface.
- Goal: add compact routing in `cxc-dev` and a detailed operational reference.
- Non-goals: no app-server client, CLI command, process scanner, scheduler, or hook.
- Verifier: focused contract search plus the repository build.
- Stop condition: create/I-O/inventory/terminate/clean paths and fallback behavior are unambiguous.
- Memory artifact: new reference plus this phase record.
- Expected outcomes: `DONE`, or `BLOCKED` if phase 1 terminology has drifted.
- Next dependency: phase 3 turns these terms into a drift gate and fresh probe protocol.

## Outcome

Teach `cxc-dev` how to manage long-lived terminal processes without conflating a known unified-exec session, an app-server inventory API, and a durable job.

## Files

### NEW `plugins/codexclaw/skills/dev/references/background-terminals.md`

Create a focused reference distilled from `001_codex_rs_runtime_guide.md` with these sections:

1. decision table: create, interact, inventory, terminate one, clean all;
2. capability detection: visible model tool vs app-server client method;
3. same-instance/loaded-thread rule;
4. exact JSON request/response shapes;
5. safe teardown and post-termination re-list;
6. failure interpretation;
7. upstream ownership: core type `UnifiedExecProcessManager`, session field `unified_exec_manager`, and separate app-server `CommandExecManager`;
8. non-goals: durability, scheduler, arbitrary PID control, `command/exec` inventory;
9. upstream source links pinned to the merge commit plus a current-main drift note.

The reference stays operational and concise. The long historical/source walkthrough remains in this devlog research document.

### MODIFY `plugins/codexclaw/skills/dev/SKILL.md`

Add one modular-reference pointer near the execution/verification rules:

```md
| `references/background-terminals.md` | A task starts, polls, lists, or terminates a long-lived terminal process | Unified-exec vs app-server ownership, same-instance rule, safe teardown |
```

Add a bounded lifecycle rule:

```md
### Background terminal lifecycle

- Creation and I/O remain `exec_command` + `write_stdin`.
- When the current host exposes `thread/backgroundTerminals/*`, list by current thread, terminate by returned `processId`, then re-list to verify teardown.
- If those methods are not callable, manage only the known unified-exec session handle; do not start a second app-server and claim it owns the current thread.
- `turn/interrupt` is not cleanup. Do not guess OS PIDs or use blind `kill` when a scoped lifecycle handle exists.
- Background terminals are not durable tasks; recurring/restart-safe work stays with goals/automations/schedulers.
```

The section links the reference instead of embedding the full protocol guide in the always-loaded skill.

## Conditional paths and activation scenarios

| Branch | Activation | Observable proof |
|---|---|---|
| App-server lifecycle callable | Current tool/client surface exposes all required method calls and current thread ID | List returns the created process; terminate returns true; re-list is empty. |
| Only unified-exec session handle available | `exec_command` returns a live session ID but no lifecycle RPC is callable | Empty `write_stdin` poll returns a later heartbeat; `Ctrl-C`/termination closes the session. |
| Separate app-server receives current Desktop ID | Probe launches a new app-server and calls list without loading the thread | Exact `thread not found` error is documented as same-instance evidence, not retried blindly. |
| Process already gone | Re-list omits it or terminate returns false | Agent reports already absent/unknown and does not issue an OS-wide kill. |

## Must not change

- PABCD phase mechanics.
- Subagent waiting semantics.
- Scheduler/goal ownership.
- Tool schemas or plugin hooks.

## Acceptance

1. The always-loaded section is short enough not to turn `cxc-dev` into an app-server manual.
2. The detailed reference contains every method, the exact `UnifiedExecProcessManager` / `unified_exec_manager` identifiers, and every safety boundary.
3. No wording promises that codexclaw can attach to the Desktop stdio process.

## Check

```bash
rg -n "Background terminal lifecycle|background-terminals.md|turn/interrupt|same app-server" \
  plugins/codexclaw/skills/dev/SKILL.md \
  plugins/codexclaw/skills/dev/references/background-terminals.md
npm run build
```
