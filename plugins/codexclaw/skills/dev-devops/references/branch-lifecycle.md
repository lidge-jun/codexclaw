# Branch Lifecycle — Cleanup, Automation, and Deletion Evidence

Last reviewed: 2026-09-09
Applies to: GitHub repositories with pull-request workflows; git worktrees
When to read: Stale branch/worktree cleanup, or automating branch deletion
Canonical owner: dev-devops §2.9

---

## §1 The Two Halves of Branch Deletion

GitHub's repository setting `delete_branch_on_merge` covers exactly one case:
the head branch of a **merged** pull request. It does nothing for a pull request
closed without merging, and nothing for a branch that never had a pull request.

```bash
# What the host already handles
gh api repos/OWNER/REPO --jq .delete_branch_on_merge   # true => merged heads auto-delete
```

| Branch origin | Handled by `delete_branch_on_merge` | Needs automation |
|---|---|---|
| Head of a merged PR | Yes | No |
| Head of a PR closed unmerged | **No** | Yes — scheduled job |
| Never had a PR | No | No — human judgment, not automation |

The third row is deliberate. A branch with no pull request has no recorded
terminal decision, so no rule can infer that its work was abandoned. Automating
it deletes work that was merely parked.

> **Verified case:** OpenCodex had `delete_branch_on_merge` enabled and still
> accumulated 59 deletable remote branches. Enabling the setting and calling
> branch hygiene done is the single most common version of this mistake.

---

## §2 Deletion Plan — Keep Rules

Every keep rule below exists because the opposite behavior destroys work that is
still referenced. Apply every rule to each candidate; any one that matches keeps
the branch. The planner evaluates them in the order below.

| # | Keep when | Because |
|---|---|---|
| 1 | Branch is protected (`main`, `dev`, `preview`, `gh-pages`, or host-marked protected) | Integration and release lines are never candidates |
| 2 | Any related PR is cross-repository (fork) | The ref lives in the contributor's repository |
| 3 | **Any** PR that ever used it as a head is merged | Reopening a PR whose head branch is gone cannot restore commits |
| 4 | **Any** PR that ever used it as a head is open | Deleting an open PR's head closes the PR |
| 5 | It is the **base** of an open PR | Deleting a stack parent closes the open child |
| 6 | `closed_at` is missing on a related closed PR | Cannot compute eligibility; fail closed |
| 7 | Newest `closed_at` is inside the grace period | Leaves room to reopen a mistaken close |
| 8 | The name is outside the repository's declared **disposable namespace** (planner default `codex/`, `ingw/`) | A human-named branch with closed PRs may be parked work; only namespaces declared disposable are automation's to delete |
| 9 | The branch's current tip SHA is unknown, or no related closed PR reports a head SHA (`unknown-head-sha`) | Cannot prove the branch is the one the PR closed; fail closed |
| 10 | The tip is not the head SHA of any related closed PR (`branch-moved-since-close`) | A reused name inherits every earlier PR's closed state; deleting by name destroys the new work |
| — | No PR ever used it as a head | Not a keep rule: the planner skips the branch (`continue`) as out of automation scope |

Rules 3 and 4 quantify over **every** PR that used the branch as a head, not the
most recent one. A branch reused across several PRs is common, and one merged or
open PR anywhere in that set is enough to keep it.

Rule 2 compares repository **ids**:

```js
// Correct: a fork commonly reuses upstream branch names
const isCrossRepository =
  !pr.head || !pr.head.repo || pr.head.repo.id !== pr.base.repo.id;

// Wrong: name comparison silently misclassifies same-name forks
// const isCrossRepository = pr.head.label.startsWith(owner) === false;
```

Re-check host branch protection at delete time, not only at plan time. The plan
is a snapshot; protection is authoritative.

Rules 8-10 are the ones a name-only planner misses. They were added after the planner
nearly deleted reused branches (lidge-jun/opencodex `59d9bc95f`, 2026-08-27, "stop
deleting reused branches"): a `codex/`-style name reused for new work inherited the
closed history of every earlier PR that had used it. Rule 8 makes the disposable
namespace an explicit allowlist (`DISPOSABLE_BRANCH_PREFIXES`); a repository adopting
the planner declares its own. Rules 9-10 bind deletion to the exact commit a closed PR
pointed at. The shipped check, last because it is the most expensive
(`.github/scripts/closed-pr-branch-cleanup.cjs` 206-220, shape preserved, variable
names as in source):

```js
const currentOid = existing.get(branch) || null;
if (!currentOid) { keep(KEEP_REASONS.UNKNOWN_HEAD_SHA); continue; }
const closedOids = new Set(related.map((pr) => normalizeOid(pr && pr.headRefOid)).filter(Boolean));
if (closedOids.size === 0) { keep(KEEP_REASONS.UNKNOWN_HEAD_SHA); continue; }
if (!closedOids.has(currentOid)) { keep(KEEP_REASONS.MOVED_SINCE_CLOSE); continue; }
```

### Merge truth is PR state, not ancestry

`git branch --merged` and `git branch -d` test reachability — the manual lists
branches whose tips are reachable from the specified commit. `git merge --squash` does "not actually make a commit,
move the HEAD, or record `$GIT_DIR/MERGE_HEAD`", so a squash-merged branch tip is
never an ancestor of the target and `--merged` never lists it. Rebase merges rewrite
SHAs and fail the same test. `git cherry` compares per-commit patch ids, so it catches
rebase and cherry-pick but not a multi-commit branch collapsed into one squash commit.
On a repository that allows squash or rebase merging, the forge's PR state
(`mergedAt`, `mergeCommit`) is the reliable merge truth; ancestry is a secondary
confirmation only. Sources: git-branch, git-merge, gitfaq and git-cherry manuals at
git-scm.com/docs, read 2026-09-09.

---

## §3 Scheduled Automation Shape

A closed-PR cleanup job is a scheduled workflow with a narrow token, and its
trigger surface is a security boundary.

| Property | Setting | Why |
|---|---|---|
| Trigger | `schedule` only | A branch-selected `workflow_dispatch` would run *that branch's* body with `contents: write`, bypassing default-branch review |
| Workflow `permissions` | `{}` | Grant at job level only |
| Job `permissions` | `contents: write`, `pull-requests: read` | Delete refs; read PR state the keep rules need |
| Third-party actions | Full commit SHA pins + version comment | Mutable refs are a supply-chain hole |
| Planning logic | Pure module, unit-tested | Keep rules must be testable without Actions or a live repository |
| Delete errors | Treat 404/422 as "already gone" | The ref can move between plan and delete |

> **Scheduled workflows run only from the repository default branch.** Landing
> the workflow on an integration branch like `dev` does not start it. It begins
> running when the change is promoted to the default branch — say so explicitly
> in the PR, or the job's silence reads as a defect.

Extract the deletion plan as a pure function so the keep rules can be tested
directly. Each rule in §2 deserves a test whose failure means real work is
destroyed: merged head, open head, stacked base, fork head, grace period,
missing timestamp, protected branch, branch outside the disposable namespace,
reused branch whose tip moved after close, closed PR with no recorded head SHA.

---

## §4 Manual Cleanup Procedure

For a one-time cleanup of an already-degraded repository, work in this order.
Order matters: worktrees hold branches, and a held branch cannot be deleted.

**1. Snapshot first (`DEVOPS-BRANCH-SNAPSHOT-01`).**

```bash
CLEANUP_DIR="$(mktemp -d)"   # or a gitignored .tmp/ path in the worktree
git for-each-ref --format='%(objectname) %(refname)' refs/heads refs/remotes \
  > "$CLEANUP_DIR/refs-snapshot.txt"
git worktree list --porcelain > "$CLEANUP_DIR/worktrees-snapshot.txt"
gh pr list --state all --limit 1000 \
  --json number,state,headRefName,baseRefName,mergedAt,closedAt,isCrossRepository \
  > "$CLEANUP_DIR/prs.json"
```

Restoring a deleted remote branch needs only its SHA:

```bash
git push origin <sha>:refs/heads/<name>
```

**2. Classify every ref against live PR state**, not against name patterns.
Join branches to PRs by head ref, then apply §2. `git branch -r --merged` alone
is insufficient: squash-merge rewrites commits, so a squash-merged branch is not
an ancestor of the target and reads as unmerged.

**3. Audit worktrees before removing them (`DEVOPS-WORKTREE-DIRTY-01`).**

```bash
git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r wt; do
  n="$(git -C "$wt" status --porcelain --untracked-files=no 2>/dev/null | wc -l)"
  [ "$n" != "0" ] && echo "DIRTY $n $wt"
done
```

A detached-HEAD worktree needs its own check: if its commit is reachable from no
branch and sits ahead of the integration line, it holds unique work.

```bash
git branch -a --contains <sha>            # empty => referenced by no branch
git rev-list --count origin/dev..<sha>    # >0 => carries commits dev does not
```

**4. Delete in order:** worktrees, then remote branches, then local branches.

```bash
git worktree remove --force <path>          # only after the dirty audit
git push --no-verify origin ':branch-a' ':branch-b'
git branch -D branch-a branch-b
```

`--no-verify` is often required because a pre-push hook that assumes a pushed
ref will reject a delete refspec. `git branch -D` (not `-d`) is correct for a
squash-merged branch, since `-d` demands ancestry the squash destroyed — but
only after §2 supplied independent evidence.

**5. Set `fetch.prune`** so future upstream deletions clean local tracking refs:

```bash
git config fetch.prune true
```

Note that `git remote prune <fork>` removes only *local tracking* refs for
branches already deleted upstream. It does not, and must not, touch the fork.

---

## §5 Anti-Patterns

| Banned | Why | Fix |
|--------|-----|-----|
| `delete_branch_on_merge` alone, called done | Closed-unmerged PRs still accumulate forever | Add the scheduled closed-PR job (§3) |
| Bulk-prune by name pattern | Patterns do not encode PR state, stacks, or forks | Per-branch evidence (§2) |
| `git branch -r --merged` as sole merge proof | Squash-merge breaks ancestry; merged branches read unmerged | Join to live PR state |
| Deleting a closed stack parent | Closes the open child PR | Keep any base of an open PR |
| `git worktree remove --force` before a dirty check | Discards uncommitted work irrecoverably | Audit every worktree first |
| Deleting refs with no snapshot | Remote deletions are unrecoverable without the SHA | `for-each-ref` snapshot first |
| `workflow_dispatch` on a `contents: write` cleanup job | Runs a chosen branch's body with write scope | Schedule-only trigger |
| Deleting by name match alone | A reused name inherits every earlier PR's closed state | Rules 9-10: tip must equal a closed PR head |
| Treating every closed-PR branch as disposable | Human-named branches may be parked work with a closed PR | Rule 8: declared disposable namespace only |
| Fork branch matching by name | Same-name forks get misclassified as local | Compare repo ids |

---

## §6 Source

OpenCodex branch and worktree cleanup, 2026-08-26. The repository carried 101
remote branches, 228 local branches, and 67 worktrees; 59 remote, 177 local, and
59 worktrees were removed against per-branch evidence, with open PRs, protected
lines, dirty worktrees, and one unreferenced detached commit preserved.

The automation gap in §1 was found during that cleanup and closed by
`.github/workflows/cleanup-closed-pr-branches.yml` with the plan extracted to
`.github/scripts/closed-pr-branch-cleanup.cjs` (lidge-jun/opencodex#2664,
merged as `bae100aa7`).

Rules 8-10 were reconciled against the live planner on 2026-09-09
(`closed-pr-branch-cleanup.cjs` `KEEP_REASONS`, lines 60-71 and 157-224; commit
`59d9bc95f`); this document had lagged the code by one commit since 2026-08-27.
