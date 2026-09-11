# 010 — L1: branch-lifecycle drift fix and §2.9 rule table

Status: PLANNED
Branch: `codex/agent-swarm-hygiene-l1` (base `dev` @ 6e97e73d)
Thesis (PR title): "dev-devops: align branch-lifecycle keep rules with the shipped planner; register swarm-era rule IDs"
Class: C2 (single-skill prose, two files) inside a C3 unit.

## Why this layer exists

`branch-lifecycle.md` §2 lists 8 keep rules; the shipped OpenCodex planner has 10
`KEEP_REASONS` plus one out-of-scope `continue` (ledger 1.1). The three missing
outcomes were added by `59d9bc95f` after a real reused-branch deletion risk (ledger
1.3). This layer fixes that, adds the squash-merge truth statement (ledger 1.5/1.6),
and registers the four rule IDs that L2-L4 own — so every upper layer's rule pointer
resolves at its own tip (DEV-STACK-03). Modular References rows for the three new files
are added by the layer that creates each file (audit blocker 8: manifest-policy.test.mjs
asserts `existsSync` on router targets for the folders it lists, and stack layers must
stand alone).

## File change map

### MODIFY `plugins/codexclaw/skills/dev-devops/references/branch-lifecycle.md`

Line numbers are from the file at 6e97e73d (193 lines).

**Line 3:**
```diff
-Last reviewed: 2026-08-26
+Last reviewed: 2026-09-09
```

**Line 40 — the filter is not strictly ordered in the planner (cross-repository is
tested before merged/open, cjs:165-175); drop the word:**
```diff
-still referenced. Apply them as an ordered filter over candidate branches.
+still referenced. Apply every rule to each candidate; any one that matches keeps
+the branch. The planner evaluates them in the order below.
```

**Lines 42-51 — replace the 8-row table with 11 rows, in planner evaluation order
(cjs:157-224); the last row is the out-of-scope `continue`, not a keep reason:**
```diff
 | # | Keep when | Because |
 |---|---|---|
 | 1 | Branch is protected (`main`, `dev`, `preview`, `gh-pages`, or host-marked protected) | Integration and release lines are never candidates |
-| 2 | **Any** PR that ever used it as a head is merged | Reopening a PR whose head branch is gone cannot restore commits |
-| 3 | **Any** PR that ever used it as a head is open | Deleting an open PR's head closes the PR |
-| 4 | It is the **base** of an open PR | Deleting a stack parent closes the open child |
-| 5 | Any related PR is cross-repository (fork) | The ref lives in the contributor's repository |
-| 6 | `closed_at` is missing on a related closed PR | Cannot compute eligibility; fail closed |
-| 7 | Newest `closed_at` is inside the grace period | Leaves room to reopen a mistaken close |
-| 8 | No PR ever used it as a head | No recorded terminal decision; out of automation scope |
+| 2 | Any related PR is cross-repository (fork) | The ref lives in the contributor's repository |
+| 3 | **Any** PR that ever used it as a head is merged | Reopening a PR whose head branch is gone cannot restore commits |
+| 4 | **Any** PR that ever used it as a head is open | Deleting an open PR's head closes the PR |
+| 5 | It is the **base** of an open PR | Deleting a stack parent closes the open child |
+| 6 | `closed_at` is missing on a related closed PR | Cannot compute eligibility; fail closed |
+| 7 | Newest `closed_at` is inside the grace period | Leaves room to reopen a mistaken close |
+| 8 | The name is outside the repository's declared **disposable namespace** (planner default `codex/`, `ingw/`) | A human-named branch with closed PRs may be parked work; only namespaces declared disposable are automation's to delete |
+| 9 | The branch's current tip SHA is unknown, or no related closed PR reports a head SHA (`unknown-head-sha`) | Cannot prove the branch is the one the PR closed; fail closed |
+| 10 | The tip is not the head SHA of any related closed PR (`branch-moved-since-close`) | A reused name inherits every earlier PR's closed state; deleting by name destroys the new work |
+| — | No PR ever used it as a head | Not a keep rule: the planner skips the branch (`continue`) as out of automation scope |
```

**Lines 53-55 — renumber the prose that names rules 2 and 3:**
```diff
-Rules 2 and 3 quantify over **every** PR that used the branch as a head, not the
+Rules 3 and 4 quantify over **every** PR that used the branch as a head, not the
```

**Line 57:**
```diff
-Rule 5 compares repository **ids**:
+Rule 2 compares repository **ids**:
```

**After line 69 (the closing paragraph "Re-check host branch protection ... protection
is authoritative."), insert — outer fence is four backticks because it embeds a
three-backtick block:**
````markdown

Rules 8-10 are the ones a name-only planner misses. They were added after the planner
nearly deleted reused branches (lidge-jun/opencodex `59d9bc95f`, 2026-08-27, "stop
deleting reused branches"): a `codex/`-style name reused for new work inherited the
closed history of every earlier PR that had used it. Rule 8 makes the disposable
namespace an explicit allowlist (`DISPOSABLE_BRANCH_PREFIXES`); a repository adopting
the planner declares its own. Rules 9-10 bind deletion to the exact commit a closed PR
pointed at. The shipped check, last because it is the most expensive
(`.github/scripts/closed-pr-branch-cleanup.cjs` 207-224, shape preserved, variable
names as in source):

```js
const currentOid = existing.get(branch) || null;
if (!currentOid) { keep(KEEP_REASONS.UNKNOWN_HEAD_SHA); continue; }
const closedOids = new Set(related.map((pr) => normalizeOid(pr && pr.headRefOid)).filter(Boolean));
if (closedOids.size === 0) { keep(KEEP_REASONS.UNKNOWN_HEAD_SHA); continue; }
if (!closedOids.has(currentOid)) { keep(KEEP_REASONS.MOVED_SINCE_CLOSE); continue; }
```

### Merge truth is PR state, not ancestry

`git branch --merged` and `git branch -d` test reachability: "branches whose tips are
reachable from `<commit>`". `git merge --squash` does "not actually make a commit,
move the HEAD, or record `$GIT_DIR/MERGE_HEAD`", so a squash-merged branch tip is
never an ancestor of the target and `--merged` never lists it. Rebase merges rewrite
SHAs and fail the same test. `git cherry` compares per-commit patch ids, so it catches
rebase and cherry-pick but not a multi-commit branch collapsed into one squash commit.
On a repository that allows squash or rebase merging, the forge's PR state
(`mergedAt`, `mergeCommit`) is the reliable merge truth; ancestry is a secondary
confirmation only. Sources: git-branch, git-merge, gitfaq and git-cherry manuals at
git-scm.com/docs, read 2026-09-09.
````

**Lines 94-95 — extend the test list:**
```diff
-destroyed: merged head, open head, stacked base, fork head, grace period,
-missing timestamp, protected branch.
+destroyed: merged head, open head, stacked base, fork head, grace period,
+missing timestamp, protected branch, branch outside the disposable namespace,
+reused branch whose tip moved after close, closed PR with no recorded head SHA.
```

The §3 trigger table is **unchanged**: the ref-deleting job stays schedule-only (the
shipped workflow carries an explicit "No workflow_dispatch" comment). Audit blocker 6
withdrew the planned bootstrap-trigger row; `cleanup-orphaned-workflows.yml` holds
`actions: write`, not `contents: write`, so it is not a precedent for this table.

**§5 anti-pattern table — add two rows before the "Fork branch matching by name" row
(line 180):**
```diff
+| Deleting by name match alone | A reused name inherits every earlier PR's closed state | Rules 9-10: tip must equal a closed PR head |
+| Treating every closed-PR branch as disposable | Human-named branches may be parked work with a closed PR | Rule 8: declared disposable namespace only |
 | Fork branch matching by name | Same-name forks get misclassified as local | Compare repo ids |
```

**§6 Source — append after line 193:**
```markdown

Rules 8-10 were reconciled against the live planner on 2026-09-09
(`closed-pr-branch-cleanup.cjs` `KEEP_REASONS`, lines 60-71 and 157-224; commit
`59d9bc95f`); this document had lagged the code by one commit since 2026-08-27.
```

### MODIFY `plugins/codexclaw/skills/dev-devops/SKILL.md`

**Frontmatter line 3 — append triggers before the closing quote:**
```diff
-... '브랜치 정리', '브랜치 삭제', '워크트리 정리'."
+... '브랜치 정리', '브랜치 삭제', '워크트리 정리', 'repo bootstrap', 'branch protection', 'ruleset', 'PR limits', 'agent PR', 'agent PRs', 'AI PR policy', 'superseded PR', 'worktree gc', '저장소 세팅', '브랜치 보호', '에이전트 PR', 'PR 정책'."
```
**Line 5:** `last-verified: "2026-09-09"`.

**§2.9 rule table (lines 229-233) — append four rows after `DEVOPS-WORKTREE-DIRTY-01`:**
```diff
 | `DEVOPS-WORKTREE-DIRTY-01` | STRICT | ... |
+| `DEVOPS-BRANCH-NAMESPACE-01` | STRICT | Automation deletes only inside a declared disposable namespace (for example `codex/`, `agent/`, `ingw/`) and only when the branch tip still equals a closed PR's head SHA. A name match is not evidence; a reused name is new work. |
+| `DEVOPS-REPO-BOOTSTRAP-01` | DEFAULT | A repository that receives agent PRs is set up ruleset-first: protected integration lines, auto-delete on merge, closed-PR cleanup job, merge-method policy, PR limits, labels and template, each verified by a read-back command. Owner: `references/repo-bootstrap.md` (arrives with L2 of the 260909 chain). |
+| `DEVOPS-AGENT-INTAKE-01` | DEFAULT | Agent-authored PRs enter through a declared intake policy (weak, medium or strong) that names identity, draft rule, review budget, supersede procedure and close conditions. Owner: `references/agent-pr-intake.md` (L3). |
+| `DEVOPS-LOCAL-GC-01` | STRICT | Local worktree and branch GC uses PR state as merge truth, snapshots first, audits dirty trees, never touches the active or a locked worktree, and defaults to dry-run. Owner: `references/local-gc.md` (L4). |
```

**Lines 256-257:**
```diff
-Mechanics, the deletion-plan algorithm, and a worked audit live in
-`references/branch-lifecycle.md`.
+Mechanics, the deletion-plan algorithm, and a worked audit live in
+`references/branch-lifecycle.md`. Setup, intake and local GC have their own owner
+files; each is registered in Modular References by the chain layer that adds it.
```

The Modular References table is **not** edited in L1 (blocker 8); L2, L3 and L4 each
add their own row.

## Scope boundary

IN: the two files above. OUT: the three new references and their router rows
(L2-L4), pointers in other skills (L4), CHANGELOG (L4).

## Accept criteria

| # | Criterion | Evidence |
|---|---|---|
| A1 | §2 table has 10 keep rows + 1 out-of-scope row; rows 1-10 map 1:1 onto the ten `KEEP_REASONS` values in cjs 60-71 in evaluation order | reviewer diff |
| A2 | `59d9bc95f` cited with date and title; js block matches cjs 207-224 shape | grep + reviewer |
| A3 | "Merge truth" subsection quotes git docs and names PR state as truth | reviewer |
| A4 | SKILL.md §2.9 has 8 rule rows; Modular References still 13 rows | grep count |
| A5 | `node plugins/codexclaw/scripts/gate.mjs` exit 0; `node --test plugins/codexclaw/test/skill-catalog.test.mjs plugins/codexclaw/test/manifest-policy.test.mjs` exit 0 (10 pass) at L1 tip | receipt |
| A6 | Opus-5 audit at A: no blocker on rule wording drift from the planner | attest |

## Conditional paths (C-ACTIVATION-GROUNDING-01)

None — prose only. The gate's forbidden-claims scan activates on any line matching
`hook ... loads|reads|injects the`; verify by running the gate at the tip.

