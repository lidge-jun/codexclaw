# Per-role first fallback

All three subagent roles gain an optional first fallback from the existing catalog. Exhaustion returns work to the main agent; independent review remains outstanding. Existing global/project role inheritance and primary selections remain intact.

Loop: satisfy-spec, C3 feature with careful persistent-dispatch boundary validation. Trigger: Jun requested implementation with cxc-loop. Goal: configurable, executable primary -> fallback -> main-direct decision chain. Non-goals: round robin, OCX settings changes, installs, paid probes, push/merge/deploy. Stop: all criteria verified and cycle closed. Evidence: this unit and session goalplan. Outcome: DONE only with passing checks; missing host delivery is reported as a limitation, not automatic execution proof. Escalation: main reclaims failed delegated slices; scope changes amend this plan first. No user token/time cap; bounded local commands only.

One integrated PABCD cycle covers this feature. Main owns dispatch lifecycle and integration; executor owns configuration and GUI with disjoint files after audit. Existing module homes are reused: subagent-config/src, subagent-config/test, gui/src/pages, gui/test. No AGENTS.md or POLICY.md was present in this checkout. Baseline is local origin/dev 6e97e73, adopted in the current managed worktree; no remote mutation.

Verification: `CODEXCLAW_HOME=/tmp/cxc-first-fallback/empty-home node --test --test-concurrency=1 'plugins/codexclaw/components/subagent-config/test/*.test.ts'` reads the exact module tests: baseline 228 passed, exit 0. Unisolated invocation had 11 global-config contamination failures. Build via package script compiles src recursively into dist and checks manifest. GUI interaction will be rendered after implementation; it has not yet been verified.

See 010_implementation.md for field chain and failure activation cases. Architecture/SoT updates: docs-site/src/content/docs/guides/subagents.md and skills/pabcd/references/delegation.md.

## Progress
A: Inspector returned GO-WITH-FIXES (4 blockers). All accepted: parent SessionStart affordance, canonical native-string decoder with unknown-error stop, OCX rewrite limits, and exact model duplicate semantics. B started with persisted A>B near-pass attestation. Main owns dispatch code and executor owns settings/UI. Initial dispatch tests: 4 pass, 5 failures awaiting the independent store fallback implementation; not a final verification result. GUI baseline tsc exited 0. Offline npm ci used the existing lockfile and completed without changing dependencies.

B ownership adjustment: executor implemented the store contract; remaining CLI/MCP/GUI work is reclaimed by main to remove the serial integration wait. Executor was asked to stop outside store and return current edits before main touches its previous write scope. This is a handoff, not evidence of agent failure. Main dispatch tests reached 14/14 and targeted strict tsc passed after the store became available. Code reviewer Auditor returned PASS for the dispatch scope; its nonblocking startup/null-tool-ID/root notes were folded into code/tests.
