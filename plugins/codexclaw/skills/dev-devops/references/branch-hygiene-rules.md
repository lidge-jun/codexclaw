## §2.9 Branch Lifecycle Hygiene (STRICT)

This section guides explicitly requested branch-lifecycle work. A review or routine
feature change does not authorize changing host settings, creating scheduled jobs,
or deleting refs. Propose missing automation first; enact it only when authorized.

Delivery repositories accumulate dead refs, and the cost is not disk. Stale
branches make `git branch -r` unusable for triage, keep superseded heads
reachable by tooling that resolves names, and hide the handful of branches that
actually still matter. Treat branch lifecycle as delivery infrastructure.

| Rule | Severity | Statement |
|------|----------|-----------|
| `DEVOPS-BRANCH-AUTODELETE-01` | STRICT | Enable host-side head deletion on merge (`delete_branch_on_merge` on GitHub) **and** close the gap it leaves. That setting fires only on merge; a pull request closed without merging keeps its head branch forever, so the closed-PR case needs its own scheduled automation. |
| `DEVOPS-BRANCH-DELETE-EVIDENCE-01` | STRICT | Never bulk-prune. Before deleting any ref, prove per branch that it is not protected, not an open PR head, not the base of an open PR, not a fork head, and not carrying unique commits. A name pattern is not evidence. |
| `DEVOPS-BRANCH-SNAPSHOT-01` | STRICT | Snapshot `git for-each-ref` (SHA + refname) for every local and remote ref to scratch space before the first deletion. Deleted remote branches are restorable with `git push origin <sha>:refs/heads/<name>` only while you still hold the SHA. |
| `DEVOPS-WORKTREE-DIRTY-01` | STRICT | Check every attached worktree for uncommitted work before removing it, and remove worktrees **before** their branches — an attached branch cannot be deleted, and `--force` on a dirty tree discards work no reflog will return. |
| `DEVOPS-BRANCH-NAMESPACE-01` | STRICT | Automation deletes only inside a declared disposable namespace (planner default `codex/`, `ingw/`; a repository may add prefixes such as `agent/`) and only when the branch tip still equals a closed PR's head SHA. A name match is not evidence; a reused name is new work. |
| `DEVOPS-REPO-BOOTSTRAP-01` | DEFAULT | A repository that receives agent PRs is set up ruleset-first: protected integration lines, auto-delete on merge, closed-PR cleanup job, merge-method policy, PR limits, labels and template, each verified by a read-back command. Owner: `repo-bootstrap.md`. |
| `DEVOPS-AGENT-INTAKE-01` | DEFAULT | Agent-authored PRs enter through a declared intake policy (weak, medium or strong) that names identity, draft rule, review budget, supersede procedure and close conditions. Owner: `agent-pr-intake.md`. |
| `DEVOPS-LOCAL-GC-01` | STRICT | Local worktree and branch GC uses PR state as merge truth, snapshots first, audits dirty trees, never touches the active or a locked worktree, and defaults to dry-run. Owner: `local-gc.md`. |

**Why stacked PRs break naive cleanup.** A stacked child PR targets its parent's
head branch. Deleting a closed parent *closes the open child*, so "the PR that
owned this branch is closed" is insufficient grounds for deletion. The base of
any open PR is protected regardless of its own PR state.

**Fork heads are out of scope, and identity is by repo id.** A fork's head lives
in the contributor's repository; deleting refs there is neither permitted nor
intended. Compare repository **ids**, not names — a fork commonly carries the
same branch names as upstream, so name comparison silently misclassifies it.

Mechanics, the deletion-plan algorithm, and a worked audit live in
`branch-lifecycle.md`. Setup, intake and local GC have their own owner
files, listed in Modular References above.
