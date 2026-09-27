# Architect consultation record

Handle: `01a0e32b-c89d-7901-8a08-4af390a8081d` (gpt-6-sol, CXC-ROLE: architect, read-only), dispatched 2026-09-27 for the agent-thread permission design. The same handle performs the reflection check on the submitted roadmap.

## Proposal and main dispositions

| Decision | Summary | Main disposition |
|---|---|---|
| AD-1 | New module `pabcd-state/src/agent-thread-permissions.ts`, two hook verbs dispatched before the subagent early exit; allow or no decision, never deny | Accepted |
| AD-2 | Opt-in `permissions.agentCreatedThreadAutoAllow` in user-global `$CODEXCLAW_HOME/config.json`; project files cannot enable it | Accepted |
| AD-3 | Eligibility from the first bounded line of `transcript_path` (session_meta id match, thread_source agent_created_thread), `permission_mode=default`, no agent fields, top-level never plus danger-full-access in CODEX_HOME config, any profile means unknown | Accepted; forked threads stay out until measured |
| AD-4 | Matcher `*`, self-filter Bash, write_stdin, apply_patch, request_permissions and `mcp__` names; exact allow JSON | Accepted |
| AD-5 | SessionStart advisory regardless of opt-in, claims only degraded approval mode | Accepted; must obey 011's no-write SessionStart rule |
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
2. Cross-phase invariants were unpinned. Folded: both permission verbs stay active under `CODEXCLAW_PABCD=off` (020 dependency line, 012 note), and 020 requires a built-CLI integration test with the switch off and a fresh cwd that asserts output and no `<cwd>/.codexclaw`. The CLI hook-observation write goes to `CODEX_HOME`, which 011's rule allows.
3. Build and inventory order. Folded: build first, then focused tests, then full `npm test`, then `inventory.mjs --write/--check --tests <measured-total>` and gate.

No further module-ownership conflicts were found across 010-016, 020 and 030.
