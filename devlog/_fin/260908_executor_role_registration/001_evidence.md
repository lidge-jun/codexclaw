# Evidence

Base dev commit: 6d70ef4. Native session cwd is /home/jun/tmp (not a Git repository); FSM records work here and source proof is taken directly from the isolated worktree, not attributed to the native cwd.

Plan audit: independent reviewer 01a07f87-2006-7662-959e-6df91491f290, native runtime model anthropic/claude-fable-5-1 / high. First GO-WITH-FIXES (3): hook matcher trust/inventory, actual native role/exit proof, registration prerequisite vs fallback. First two folded; automatic fallback rebutted for canonical naming requirement; reviewer re-audit VERDICT: PASS.

Baseline: existing wrapper+CLI 37 passed; spawn/exit/review boundaries 143 passed. Direct probe: inferRole(executor, implementation)=explorer; with review word=reviewer; executor not in exit gate.

RED: new regressions failed before production edits (wrong executor model, wrong role, missing evidence block, executor accepted as review signoff). GREEN: same regressions with affected suites: 176 tests passed, 0 failed. Logs: /home/jun/tmp/cxc-update-20260908-01a07d17/executor-{red,green}.log.

Temp-home native app-server strict config/read accepted template but returned agents:null. This is NOT proof of native role discovery. Replaced with fresh-session live evidence requirement.

Implementation delegation: worker 01a07f8d-8805-7d33-addc-d475379dbf97 spent approximately eight minutes investigating without edits. Closed and confirmed no output files; main reclaimed the now-blocking small registration slice rather than dispatching another idle-dependent lane (host critical-path preference). No worker result claimed as implementation evidence.
