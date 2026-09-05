# Native stack merge CLI pitfall

User-requested addendum before merging CodexClaw PR #64, 2026-09-05.
This extends guidance only; it does not change the runtime or authorize OpenCodex writes.

The supplied transcript attempted sequential `gh pr merge --merge --admin
--match-head-commit` calls for OpenCodex #3589/#3591/#3593/#3595/#3596 under `set -e`.
The first command exited 1 with a `mergePullRequest` GraphQL error requiring the
asynchronous merge REST API. Later calls in that shell sequence did not run.
A subsequent GET of #3596 returned `state: open` and `mergeable_state: blocked`;
that is not evidence of a successful merge. This task did not reproduce the write.

Correction resides in the canonical `DEV-STACK-04` reference, reachable from both
global guidance and the existing DevOps pointer:

- Recognize the exact legacy-GraphQL error even when `--admin` is present.
- Select the highest authorized member once; avoid a per-layer legacy merge loop.
- Use the documented PUT `merge-async` and GET UUID-result routes, retaining the
  requested-head SHA guard and checking all affected PRs before and after.
- Distinguish transport support, asynchronous completion and branch-rule permission.
  No invented REST admin flag, automatic retry, stack dissolution or CI waiver.

Primary source opened for endpoint/field/result verification:
[GitHub async merge and result API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously).
The command shown in the canonical reference is an operational example, not a claim
that a live native-stack merge was performed. Existing code verification remains in
`011_verification.md`; this follow-up uses document/gate checks and current-head PR CI.
