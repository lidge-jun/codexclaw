# Executor role registration

CXC displays and stores executor but emits worker and only recognizes worker at its spawn/exit boundaries. Make executor the canonical registered implementation role, retaining worker solely as a legacy input alias. Explicit setup must preserve user configuration and require a new Codex session to discover the role.

- Class: C4 (role registration and exit verification boundary); one satisfy-spec PABCD cycle.
- Trigger: Jun authorized local implementation, local installation and an ordinary PR.
- Goal: executor remains executor from UI/store through native dispatch and evidence verification.
- Non-goals: no UI redesign, model changes, automatic hook trust, deployment/merge, blanket renaming of generic worker prose or historical records.
- Verifiers: Node tests for subagent-config and affected pabcd-state hooks, shipped CLI temporary-home registration, build/gate, full npm test, native Codex role discovery/live dispatch if the current host can refresh roles. Existing wrapper+CLI tests ran: 37 pass, 0 fail; direct test paths observe the owners. New tests are proposed until implemented. Preserve real-host limitations in delivery.
- Stop: passing review/checks, local patch and role registration verified, PR published; unresolved host discovery is reported, never claimed tested.
- Memory/evidence: this unit and task-local evidence outside tracked source for large logs.
- Outcomes: verified PR plus local install; or explicit blocking finding with implementation preserved.
- Escalation: existing executor collision cannot be overwritten. Two failed delegated attempts return implementation to main; any new delegation scope first amends this plan.

## Repository and structure
No repository AGENTS.md/POLICY.md found. Follow existing Node24 TS source + generated dist, node:test and numbered devlog conventions.
`subagent-config/{src,test}` owns CLI/store/spawn; `pabcd-state/{src,test}` owns exit evidence; `hooks/` selects exits; `agents/` is the prompt source. `agents/README.md` and README installation are source-of-truth targets.
No new dependency, daemon, automatic mutation hook or framework. Configuration alone cannot fix inferRole(executor) returning explorer; reuse existing CLI and canonical TOML prompt. Add a colocated registration module because safely publishing a user-role file is distinct from routing.

## Threat boundary
Assets: user role files/model settings and delegated verification. Explicit registration reads only the shipped executor template, writes only CODEX_HOME/agents/executor.toml (default ~/.codex), no model/effort/sandbox/approval overrides. Reject symlink/non-file destinations and symlink agents directory, preserve conflicting existing file, publish without overwrite, repeat exact content idempotently. No role removal or worker deletion. Malicious project text cannot trigger registration; only explicit CLI command can. Local same-user filesystem races are residual risk; do not claim hostile-user isolation.
Guard layer: hook early validation; surface: spawn and SubagentStop. Bypass: disabled/untrusted hooks or direct host call. Residual: host controls actual permissions. Wording: early validation, not unbypassable enforcement; final layer: native Codex permission policy.

## Delegation
Main owns role mapping, prompt/README/skill call guidance, model routing tests, integration, local patch and PR. During B one worker owns registration module + CLI wiring + their tests only. Independent reviewer audits plan now and another fresh review checks final code. No shared write paths and no child FSM mutations.

## Previous cycle
Previous cycle fixed source worktree binding and ended IDLE. This distinct cycle fixes role identity; no old worktree/phase evidence is reused as proof.

## Delivery conclusion
Implementation and local registration are complete; PR https://github.com/lidge-jun/codexclaw/pull/91 targets dev. Canonical executor naming, legacy compatibility and configuration-preserving registration passed independent review and local checks. Final local payload covers18files after documentation follow-up. No merge/release performed. Normal user hook reapproval is still required before claiming changed native SubagentStop activation; this is an explicit handoff prerequisite, not a passing hook-delivery claim. CI is tracked on the PR separately from local proof. CXC cycle closed to IDLE after verified local checks.
