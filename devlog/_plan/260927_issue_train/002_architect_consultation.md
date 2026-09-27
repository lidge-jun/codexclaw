# Architect consultation record

Handle: `01a0e32b-c89d-7901-8a08-4af390a8081d` (gpt-6-sol, CXC-ROLE: architect, read-only), dispatched 2026-09-27 for the agent-thread permission design. The same handle performs the reflection check on the submitted roadmap.

## Proposal and main dispositions

| Decision | Summary | Main disposition |
|---|---|---|
| AD-1 | New module `pabcd-state/src/agent-thread-permissions.ts`, two hook verbs dispatched before the subagent early exit; allow or no decision, never deny | Accepted |
| AD-2 | Opt-in `permissions.agentCreatedThreadAutoAllow` in user-global `$CODEXCLAW_HOME/config.json`; project files cannot enable it | Accepted |
| AD-3 | Eligibility from the first bounded line of `transcript_path` (session_meta id match, thread_source agent_created_thread), `permission_mode=default`, no agent fields, top-level never plus danger-full-access in CODEX_HOME config, any profile means unknown | Accepted; forked threads stay out until measured |
| AD-4 | Matcher `*`, self-filter Bash, write_stdin, apply_patch, request_permissions and `mcp__` names; exact allow JSON | Accepted |
| AD-5 | SessionStart advisory regardless of opt-in, claims only degraded approval mode | Accepted; advisory itself stays read-only under 011's directory-creation rule |
| AD-6 | Guidance: create_worktree plus a subagent that passes the worktree as shell workdir; threads stay the surface for lanes needing their own goal | Accepted |
| AD-7 | Bypass record: C4, PermissionRequest hook, opt-in allow suppresses user approval, residual risks listed | Accepted |

Rejected alternatives recorded by the architect: rewriting the approval policy at startup, enabling from a repository file, treating unknown tool names as MCP, trusting config text as runtime proof, claiming a subagent's native cwd changes.

Upstream gap: complete coverage needs Codex to expose the resolved sandbox state and an approval action kind in PermissionRequest input. The shipped hook is scoped to what the payload proves today.

## Reflection

## Main dispositions of builder-doc questions

- 011: a bound `cxc loop init --session cli` keeps the existing standalone-terminal exception, matching the reserved `cli` key in orchestrate; every other bound id requires native verification before any write.
- 030: the decision record stays the smaller `open|decided` contract. Issue #262's `options[]` and `withdrawn` are not adopted; a withdrawn question is decided with an answer that says so.


## Reflection result (same handle, 2026-09-27)

Verdict: MISALIGNED on AD-3 wording and AD-4 MCP scope; AD-1, AD-2, AD-5, AD-6, AD-7 ALIGNED. Gaps and main dispositions:

1. The success claim said the hook proves full access; it only sees top-level config evidence and a tool-name convention. Folded: 020's success line now says "explicit top-level config evidence" and names the `mcp__<server>__<tool>` convention, and states the exact guarantee needs upstream fields.
2. Cross-phase invariants were unpinned. Folded: both permission verbs stay active under `CODEXCLAW_PABCD=off` (020 dependency line, 012 note), and 020 requires a built-CLI integration test with the switch off and a fresh cwd that asserts the advisory produces output without creating `<cwd>/.codexclaw` when called alone. When PABCD policy is enabled, the separate generic SessionStart hook still creates state and the ignore file. The CLI hook-observation write goes to `CODEX_HOME`, which 011's rule allows.
3. Build and inventory order. Folded: build first, then focused tests, then full `npm test`, then `inventory.mjs --write/--check --tests <measured-total>` and gate.

No further module-ownership conflicts were found across 010-016, 020 and 030.

## Re-plan after audit round 3

Three audit rounds returned **FAIL**. The root cause was the proposed lazy SessionStart state creation: stateless sessions would change the executor evidence gate and the goal-complete gate (`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:215-236`), and the proposed `writeExistingState` guard did not settle atomic conditional publication against `writeState`'s temporary-file rename (`state.ts:607-617`). The earlier no-parent-state executor release was especially unsafe.

Main changed #255 to a low-severity **partial fix** using the reporter's offered `.codexclaw/.gitignore` alternative. SessionStart and CLI identity behavior stay as shipped; `011_issue255_codexclaw_gitignore.md` now routes first-directory writers through one exclusive ignore-file helper. Lazy state creation, `verifiedCreateState`, `sessionStateFileExists`, `writeExistingState`, missing-state hook suppression, and no-parent-state evidence release were dropped from this train and deferred for a separate design. The revised 010/013/014/015/020 contracts follow that decision.


## Audit record

Reviewer handle `01a0e340-8900-7930-99db-9101bd95d661` (gpt-6-sol, CXC-ROLE: reviewer) audited every round.

| Round | Verdict | Blockers | Disposition |
|---|---|---|---|
| 1 | FAIL | 8 (4 High) | All folded into 011, 012, 015, 016, 020, 030 |
| 2 | FAIL | 4 (1 High) | Folded; narrowed native verification to missing-state creation |
| 3 | FAIL | 3 (1 High) | Root cause: lazy state creation reaches the executor evidence gate, the goal-complete gate and publication atomicity. Returned to P and re-planned #255 as a partial fix |
| 4 | GO-WITH-FIXES | 4 (Medium) | Folded as "Audit round 4" amendments in 011 (parent ignore limit, atomic staging rename, self-contained helper copies with drift test, build order) and 016 (structural explanatory framing) |

A>B exited as near-pass on round 4 with every blocker folded.
