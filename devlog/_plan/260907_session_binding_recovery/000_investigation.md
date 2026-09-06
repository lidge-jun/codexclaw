# Session binding investigation

C4 satisfy-spec (cross-session state and release). Trigger: missing SessionStart
binding reported in worktree fork 592d. Goal: explain the failure and provide safe,
explicit current-session recovery, PR, release and the established four-host deployment.
Non-goals: modify Codex Rust, restart active apps, reset other FSMs, change unrelated
checkout work, broaden hook permissions or run repository-wide local test suites.
Verifier: focused Node regression tests and build; exact-head CI/WSL/packed install;
real current-session recovery and installed file hashes. Stop after all deliveries
verified; otherwise retain concrete remaining work. No user token/cost/time bound.
Memory: this numbered unit. Escalate only new access or destructive action; main
reclaims a failed delegated packet. Existing git/gh/SSH/plugin tools are in scope.

## Hypotheses and falsifiers
H1: forks skip SessionStart. Falsifier: native source invokes startup for Forked,
or a nonfork fresh session has the same missing binding.
H2: plugin hooks are disabled, untrusted or stale in the live process. Falsifier:
current resolved payload and live-process hook invocation proof both healthy.
H3: binding was created in a different cwd or lost only from context. Falsifier:
no exact-ID state exists in native cwd and no emitted binding exists in rollout.

## Evidence before implementation
Affected rollout metadata identifies 01a0778a-a6f8-7230-b8d7-a3c0bfada062 as forked
from 01a07771-2150-78b2-af60-097dfb58db64, cwd592d, Desktop0.153.4.
Current nonfork session01a078a0-f386-7790-a16e-922f2269103c also has no binding.
Native state_5.sqlite read-only rows agree with both exact native IDs/cwds.
Bare cxc resolves old dirty source0.2.16 and status selects an unrelated latest
session01a07024-547c-7b40-a469-86e47919a03e. Latest-source doctor0.2.20 passes all
24 hook hashes and installed-root checks. Disk config is enabled; this does not
prove the already-running app loaded those hooks. No SessionStart binding was
present in either examined rollout's developer items. Native lifecycle evidence
is being independently inspected. A missing-hook cause in the app process remains
unproven until a live log establishes it.

Existing ensureState is exclusive-create and preserves resumed files. Existing
orchestrate rejects unknown IDs for writes but status calls readState, which can
render default IDLE even when a file is absent. Identity guidance accepts only a
SessionStart text line, with no supported recovery if that line is missing.

## Preflight limitation
The current skill's SESSION-IDENTITY-01 prohibits selecting a native ID without
SessionStart, and no binding exists here. No existing FSM has been mutated and
no Stop-continuation claim is made. The authorized repair proceeds with manual
P/A/B/C/D artifacts until the reviewed recovery command can establish real state.

## Native source verification
Independent explorer verified121_openai-codex dd2d5b70241f and120_codex-cli94cbbddafc17.
core/src/session/session.rs:1612 maps New/Forked to Startup;1635 queues it.
core/src/session/turn.rs:286 consumes it on next turn; state/session.rs:355 pops
before handler selection, so absent handlers consume startup without later replay.
core/src/unified_exec/process_manager.rs:1368 overwrites CODEX_THREAD_ID with actual
thread ID. Hook commands instead receive session_id in stdin; subagents share root
session_id, so CLI fallback MUST NOT be reused as a hook identity resolver.
H1 blanket fork suppression rejected. Effective disk hooks flag is true for both
Codex0.153.2 CLI and Desktop0.153.4. plugin_hooks is a removed compatibility key;
its presence is not evidence of runtime enablement. Doctor current payload passes.
H2 live-process discovery remains open; H3 simple context-only loss insufficient
because state files are also absent. Latest explicit status falsely prints default
IDLE for a nonexistent exact-ID file; `session current` currently exits1 unknown.
