# Worktree source binding

Satisfy-spec repair requested by the user: reproduce the worktree false-negative, patch the installed plugin and publish an ordinary PR to dev. Stop after a reviewed patch, regression evidence, local installation and PR. No merge, release, native database edits or mutation of the reported Lina session. Evidence lives in this unit and task-local temporary logs. Main owns integration and publication; worker owns the source-binding module/CLI/tests. Escalate only a scope-changing or irreversible requirement; reclaim a failed delegation locally.

## Cause and competing hypotheses

H1: no implementation occurred; falsified by a real linked-worktree commit while native HEAD is unchanged. H2: CXC captures the wrong source root; test with identical temp repository state except explicit source binding, expecting B-to-C and Check to observe the linked worktree. H3: native identity is wrong; native SQLite fixture resolves the expected ID and native root, while the source-root mismatch persists.

## Boundary decision

Keep native identity, state, goalplans, review metadata and receipt storage at the original cwd. Add immutable session-specific source binding to a linked Git worktree in the same common Git directory. Preserve exact native cwd corroboration. Do not infer source from branch names, newest files, sibling sessions or arbitrary command cwd. Removing SOURCE-DELTA-01 or moving native DB state would erase useful checks and is rejected.

Assets: session ownership, B baseline and check receipts. CLI/file input crosses the boundary; accidental cross-session commands and corrupt/redirected files are in scope. Hostile same-user edits of all evidence/native DB are outside existing CXC trust model. Bind before B, fail closed for damaged/removed/replaced worktrees, and preserve existing evidence. A bind must never make a new source count as implementation by itself.

One cohesive module repair; details in 010_implementation.md. No new dependencies or UI. Existing session/source/receipt owners are reused. Source metadata is an additive optional sourceRoot in identities produced for explicitly bound sessions. Creation: captureSessionSourceIdentity; serialization: existing JSON writes; parsing: state, source-receipt, goalplan revivers; consumers: CLI/chat B gate, receipt producer, Check gate, final goal validation. Legacy unbound identities remain unchanged.

Enforcement: local runtime CLI/chat/check/goal validation, not hostile-user authentication. A user can manually forge local state/receipts or edit the plugin; no claim of tamper-proof provenance. Native identity checks remain intact.
