# A-gate round 2 synthesis

Reviewer verdict: `FAIL`.

## Remaining blocker and disposition

1. **High — copied tree lacks independent Git metadata. Accepted.**
   - Root cause: freshness and packaging derive the shipped set with `git ls-files`; excluding `.git` makes both gates structurally fail even when bytes are correct.
   - Plan change: create a local `--no-hardlinks` clone at a temporary path, overlay the current dirty/untracked/ignored workspace while excluding only the real `.git` and dependency cache, and verify both worktree root and Git dir resolve inside the temp directory before any gate. The copied repo therefore owns independent metadata and cannot discover or mutate the real repository.
   - The ignored diagnostic-preservation step remains temp-only and occurs after the overlay, before the destructive build.

## Cross-round check

This change closes only the verifier topology. It does not alter the round-1 state publication, parser, test, GitHub, or scope decisions. The temporary clone sees the same tracked dist inventory as the real checkout while its overlay supplies every current source/test/manifest change and the ignored diagnostic artifact.

Round 3 reuses the same reviewer. A third FAIL requires a return to P under LOOP-REPAIR-01.
