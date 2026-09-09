# 070 — Merge plan for the agent-swarm hygiene chain

Status: PLANNED
Trigger: user instruction 2026-09-09, "머지까지 전부 진행" — merge authority for #94-#97.
Class: C3 (external state change on the integration branch; four PRs, reversible only by revert).

## Reader summary

The chain #94 → #95 → #96 → #97 is a manual dependent chain, so merging is not one
operation. Each layer merges into its own base, and a child cannot go to `dev` until its
parent has landed there. This document fixes the order, the retarget step between merges,
what counts as proof that a layer landed, and what to do when the host refuses.

## State at plan time (2026-09-09)

| PR | Base | Head | mergeable | state |
|----|------|------|-----------|-------|
| #94 | `dev` | 46a9bc9d | MERGEABLE / CLEAN | OPEN |
| #95 | `codex/agent-swarm-hygiene-l1` | 3e7302ec | MERGEABLE / CLEAN | OPEN, title prefixed `[WRONG BRANCH]` |
| #96 | `codex/agent-swarm-hygiene-l2` | 6ca0c3d8 | MERGEABLE / CLEAN | OPEN, prefixed |
| #97 | `codex/agent-swarm-hygiene-l3` | ccfdf7fd → re-read | MERGEABLE / CLEAN | OPEN, prefixed |

This document lands on `codex/agent-swarm-hygiene-l4`, so #97's head advances past
`ccfdf7fd`; step 4 re-reads it and pins the new SHA with `--match-head-commit`. The
merge receipt (080) cannot ride the same branch — it needs #97's own merge SHA — so it
goes out as a small follow-up PR against `dev` after the chain lands.

Repository: `allow_merge_commit` true, `allow_squash_merge` true, `allow_rebase_merge`
true, `allow_auto_merge` false, `delete_branch_on_merge` **false**. Rulesets:
`protect-main` (branch) and `protect-release-tags` (tag) only — **`dev` carries no
ruleset**, so no required review or status check blocks these merges. `origin/dev` is at
`6e97e73d` and has not moved since the chain was cut.

## Merge method

Merge commit (`--merge`), matching the repository's existing `dev` history
("Merge pull request #93 from …"). Squash is wrong here: it rewrites each layer into a
new commit, so `git merge-base --is-ancestor 46a9bc9d origin/dev` would exit 1 and the
ancestry proof criterion c-2 requires collapses. It also makes every retargeted child
re-show its parent's files, since the parent's original commits never reach `dev`.

## Order and procedure

Bottom-up, one layer at a time (`DEV-STACK-04`: manual chains merge into their named
parent, so each child must be retargeted after its parent lands).

1. **#94 → `dev`.** Base is already `dev`. Confirm `mergeStateStatus` is `CLEAN` and
   every check has concluded successfully on `46a9bc9d`, then
   `gh pr merge 94 --merge --match-head-commit 46a9bc9dfa4e44c381a169645b0b850f3b8f1fa8`.
2. **#95.** Its base branch `codex/agent-swarm-hygiene-l1` still exists (auto-delete is
   off), but the layer below has landed, so retarget: `gh pr edit 95 --base dev`. This
   fires `enforce-pr-target.yml`, which removes the `[WRONG BRANCH]` prefix and updates
   its comment once the base is `dev` (the `pull_request_target: edited` path; no human
   title edit is needed). Wait for that run to finish, re-read
   `mergeable`/`mergeStateStatus` (retargeting recomputes them), re-read the PR diff and
   confirm it lists only this layer's files, then merge with
   `--match-head-commit 3e7302ec616d5d95d788d25495d86ce140c2981f`.
3. **#96.** Same sequence, head `6ca0c3d88861d2ed3b6096d7b820681bf41cea95`.
4. **#97.** Same sequence, retarget to `dev`, head
   `fcfb55a60a06a8247fd3deec66b43a681133e2ac` (this plan document is on that branch, so
   the head moved past `ccfdf7fd`). Re-read it once more before merging: any further
   commit here, including a plan amendment, moves it again.

`--match-head-commit` is the safety pin: if anything pushed to a layer between plan and
merge, the merge is refused rather than landing an unreviewed head. It goes to the merge
API's `sha` field and is compared literally, so it must be the **full 40-character SHA**;
an abbreviation is not expanded and the merge fails.

After each merge, fetch and confirm the layer head is an ancestor of `origin/dev` before
starting the next layer. Do not batch the four merges.

## Expected diff shape

Each layer's PR diff shrinks to its own delta once its parent lands, because the parent's
commits are then already in `dev`. If a retargeted PR shows more than its own layer's
files, stop: that means a layer landed out of order or `dev` moved.

## Refusal handling

| Refusal | Meaning | Response |
|---|---|---|
| `mergeStateStatus: BLOCKED` | A rule or required review appeared | Report the rule; do not use `--admin`, do not change repository settings |
| `mergeStateStatus: UNSTABLE` | A check is still running, or a non-required check failed | Wait until every check has concluded; merge only when all are green. Never merge on pending |
| `mergeStateStatus: BEHIND` or `DIRTY` | `dev` moved under the chain | Update the layer branch from `dev`, re-run gate and skill tests, re-verify CI, then merge |
| `--match-head-commit` mismatch | The head moved after the plan | Re-read the new head, re-verify its checks, update this document, then merge |
| Merge API error | Transport or transient | Re-read PR state before retrying; never retry blind, a merge may have landed |

Nothing here authorizes bypassing a gate. A red or missing required check is a stop, not
an exception.

## Post-merge verification (m6)

- `gh pr view <n> --json state,mergeCommit` reports `MERGED` for all four.
- `git fetch origin dev` then `git merge-base --is-ancestor <layer head> origin/dev`
  exits 0 for 46a9bc9d, 3e7302ec, 6ca0c3d8, and `fcfb55a6` — the #97 head pinned in
  step 4. `ccfdf7fd` alone would prove nothing about the merged head.

## Pre-merge state (read 2026-09-09, immediately before step 1)

| PR | Head (full) | mergeable | mergeStateStatus |
|----|-------------|-----------|------------------|
| #94 | 46a9bc9dfa4e44c381a169645b0b850f3b8f1fa8 | MERGEABLE | CLEAN |
| #95 | 3e7302ec616d5d95d788d25495d86ce140c2981f | MERGEABLE | CLEAN |
| #96 | 6ca0c3d88861d2ed3b6096d7b820681bf41cea95 | MERGEABLE | CLEAN |
| #97 | fcfb55a60a06a8247fd3deec66b43a681133e2ac | MERGEABLE | UNSTABLE (CI re-running on the amended head) |

#97 is UNSTABLE only because its checks restarted on this plan's own commits. Step 4
waits for every check to conclude green before merging, per the refusal table.
- `git diff --stat origin/dev codex/agent-swarm-hygiene-l4 -- <the touched paths>` is
  empty, proving the merged tree equals the reviewed L4 content for those files.
- `node plugins/codexclaw/scripts/gate.mjs` exit 0 and `node --test` skill-catalog +
  manifest-policy 10/10 on a checkout of merged `dev`.
- `080_merge_receipt.md` records merge commit SHAs, PR states, and the check evidence
  that was green at merge time.

## Out of scope

Merging `dev` into `main`; any release; changing `delete_branch_on_merge` or any other
repository setting; deleting the four layer branches (they stay until the user asks);
force-push or history rewrite.

## Branch cleanup note

With `delete_branch_on_merge` false, the four `codex/agent-swarm-hygiene-l*` branches
survive the merges. That is exactly the accumulation `branch-lifecycle.md` §1 describes,
and the setting is deliberately left as found — changing it is a repository-settings
action this goal excludes. Cleanup is a separate authorized action.
