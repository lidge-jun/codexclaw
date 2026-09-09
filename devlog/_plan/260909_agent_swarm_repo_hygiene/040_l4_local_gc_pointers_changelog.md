# 040 — L4: local GC reference, pointers, CHANGELOG

Status: PLANNED
Branch: `codex/agent-swarm-hygiene-l4` (base `codex/agent-swarm-hygiene-l3`)
Thesis (PR title): "dev-devops: add local-gc reference (worktree/branch GC contract), cross-skill pointers, changelog"
Class: C2 (one NEW reference, one router row, five small MODIFY pointers, CHANGELOG).

## Why this layer exists

Local state is invisible to GitHub Actions; the 2026-09-09 inventory
(`evidence/research/local-inventory-2026-09-09.md`) shows 133 worktrees and 530 local
branches with no GC command and no schedule. The skill has a manual procedure
(`branch-lifecycle.md` §4) but no convention for what automated local GC may do. This
file is the contract a future `cxc worktree gc` implements; the command is out of scope.

## NEW `plugins/codexclaw/skills/dev-devops/references/local-gc.md`

Full body (B copies verbatim):

````markdown
# Local GC — Worktree and Branch Garbage Collection Conventions

Last reviewed: 2026-09-09
Applies to: git 2.x linked worktrees; GitHub-backed repositories; Codex-app managed worktrees under `~/.codex/worktrees`
When to read: Local worktree or branch cleanup; a scheduled local cleanup; specifying or using a GC command
Canonical owner: dev-devops §2.9 (`DEVOPS-LOCAL-GC-01`)

---

## §1 Merge truth (`DEVOPS-LOCAL-GC-01` a)

Join local branches to the forge's PR state (`gh pr list --state all --limit 1000
--json number,state,headRefName,baseRefName,mergedAt,closedAt,mergeCommit,headRefOid,isCrossRepository`)
by `headRefName`. A `MERGED` PR whose merge commit is on the integration line is the
primary proof; `git merge-base --is-ancestor <tip> origin/dev` is a secondary
confirmation that fails under squash and rebase merging (`branch-lifecycle.md`
"Merge truth is PR state, not ancestry"). Snapshot 2026-09-09: opencodex carried 43
branches whose PR was MERGED but whose tip was not an ancestor of `dev` — all squash
merges, all invisible to `git branch --merged`.

Prior art, surveyed 2026-09-09: `gh poi` (v0.18.4, 2026-08-30) decides merged via the
PR API plus local head-SHA membership and is the only surveyed tool that removes
worktrees, with guards for the main worktree, uncommitted and untracked files,
submodules and locked trees; `git-trim` and `git-delete-merged-branches` (squash needs
`--effort=3`) compare a synthesized squash commit and only skip worktree-checked-out
branches; `gh-clean-merged` and `gh-tidy-branches` use PR state and never touch
worktrees. Use them as references for behaviour; do not add them as dependencies.

## §2 Candidate classes

| Class | Test | Automation may delete |
|---|---|---|
| Integrated | tip is an ancestor of `origin/dev` or `origin/main`; not checked out in any worktree | yes |
| PR-merged (squash/rebase) | PR `MERGED`; tip equals the PR's `headRefOid`; not checked out | yes |
| Upstream gone, PR merged | `git branch -vv` shows `: gone]`; PR `MERGED` as above | yes |
| Upstream gone, PR closed | `: gone]`; every PR `CLOSED`; inside the disposable namespace; tip equals a closed PR head (`branch-lifecycle.md` rules 8-10) | yes |
| Disposable namespace, no PR | `codex/`, `agent/`, `ingw/`, `claude/`, `copilot/` with no PR ever | report only |
| Human-named, no PR | anything else | never |
| `backup/`, `archive/`, `wip/` | prefix | never; retention is a human policy |
| Any class, checked out in a worktree | `git worktree list --porcelain` names it | never, until the worktree is removed under §3 |

## §3 Worktree rules (`DEVOPS-LOCAL-GC-01` b)

Order: snapshot → dirty audit → worktrees → remote branches → local branches
(`branch-lifecycle.md` §4). Exclusions, each STRICT:

| Never remove | Source |
|---|---|
| The active session's worktree, its slot directory, or any ancestor of `cwd` | `worktree-guardian` WG-NEVER-01 |
| Any `~/.codex/worktrees/<slot>` the user did not name — another live thread may be bound to it | WG-NEVER-01 |
| A **locked** worktree (`locked` line in `git worktree list --porcelain`); `git worktree prune` skips them and so does GC | git-worktree manual: lock "prevents its administrative files from being pruned automatically … also prevents it from being moved or deleted" |
| A **dirty** worktree: `git status --porcelain --untracked-files=no` non-empty | `DEVOPS-WORKTREE-DIRTY-01` |
| A detached-HEAD worktree whose commit is reachable from no branch and is ahead of the integration line | `branch-lifecycle.md` §4 step 3 |

`git worktree prune` removes only administrative entries under `$GIT_DIR/worktrees`
for working trees that no longer exist on disk; it deletes no files and no branches.
`--expire <time>` limits it to entries older than that; `git gc` runs it with
`gc.worktreePruneExpire` (default `3.months.ago`; `now` or `never` to override).
Always dry-run first (`git worktree prune -n`).

Worktrees under `/private/tmp` or `/var/folders` do not survive a reboot. A dirty one
is a **recovery** candidate (commit or stash in place, then move under a durable root
with `git worktree move` — never the active one, WG-MOVE-01); it is never a deletion
candidate. Snapshot 2026-09-09: 70 of 133 worktrees across four repositories sat under
`/private/tmp` or `/var`; 25 worktrees overall were dirty.

## §4 Config hygiene

- `git config fetch.prune true` per repository, so a branch deleted on the remote
  disappears from `refs/remotes` on the next fetch. Two of four audited repositories had
  it unset on 2026-09-09; the `: gone]` test in §2 is only as fresh as the last prune.
- Leave `fetch.pruneTags` off unless the refspec is understood: with a
  `refs/tags/*:refs/tags/*` refspec it deletes local tags that never came from that
  remote (git-fetch PRUNING section).
- Leave `gc.worktreePruneExpire` at its default.

## §5 Scheduled runs (`DEVOPS-LOCAL-GC-SCHEDULE-01`, DEFAULT)

A scheduled local job produces a **dry-run report** and deletes nothing. Deletion is a
separate human-approved invocation. On macOS use a LaunchAgent; wrap the command in
`perl -e 'alarm shift; exec @ARGV' <seconds>` and `shlock` because `timeout` and
`flock` are not in the base system. The report, written to a fixed path, contains: one
§2 table per repository, the dirty list, the reboot-fragile list, disk usage per root,
and the snapshot path it would use.

## §6 `cxc worktree gc` — contract only (not implemented)

This section specifies the command a future unit implements; nothing in the plugin
provides it today.

| Subcommand | Behaviour |
|---|---|
| `cxc worktree list [--repo <path>]` | Classify every worktree and local branch per §2/§3; no changes |
| `cxc worktree gc` | Same as `--dry-run`: write the §5 report; exit 2 if candidates exist, 0 if none |
| `cxc worktree gc --apply --repo <path> [--namespace <prefix>]...` | Delete only §2 "yes" rows whose name starts with a named namespace; remote first, then local |
| `cxc worktree gc --apply --worktrees --repo <path>` | Remove only worktrees that are clean, unlocked, not under `~/.codex/worktrees`, not the cwd or its ancestor, and whose branch is a §2 "yes" row; `git worktree remove` without `--force` |

Preconditions for `--apply`: the `for-each-ref` and `worktree list --porcelain`
snapshot is written and its path printed (`DEVOPS-BRANCH-SNAPSHOT-01`); `gh auth
status` succeeds; `fetch.prune` is set for the repository or `--no-fetch-check` is
passed; a fresh `git fetch --prune` ran in this invocation. Exit codes: 0 done or
nothing to do; 2 dry-run found candidates; 3 precondition refused. `--apply` in a
scheduled job is a violation of §5.

## §7 Anti-patterns

| Banned | Why | Fix |
|---|---|---|
| `git branch --merged` as the only merge proof | Squash and rebase merges are invisible to it | §1 PR-state join |
| `rm -rf <worktree>` | Leaves `.git/worktrees` admin state; skips the dirty check | `git worktree remove`, then `prune -n` |
| `git worktree unlock` inside GC | The lock is a human statement of intent | Report locked trees; never unlock |
| Deleting a managed `~/.codex/worktrees` slot | Another thread may be bound to it | WG-NEVER-01 |
| `--apply` from a scheduled job | Unattended deletion | §5 dry-run only |
| `fetch.pruneTags` by reflex | Deletes local tags | §4 |
| Treating `/private/tmp` worktrees as disposable | Dirty ones hold unrecovered work | §3 recovery first |

## §8 Sources (read 2026-09-09)

- git-worktree (`prune`, `--expire`, `lock`/`unlock`, `repair`): https://git-scm.com/docs/git-worktree
- `gc.worktreePruneExpire`, `fetch.prune`, `fetch.pruneTags`, `remote.<name>.prune`: https://git-scm.com/docs/git-config ; PRUNING: https://git-scm.com/docs/git-fetch
- `git branch --merged`, `git merge --squash`, gitfaq squash section, `git cherry`: https://git-scm.com/docs/git-branch , https://git-scm.com/docs/git-merge , https://git-scm.com/docs/gitfaq , https://git-scm.com/docs/git-cherry
- Tool survey (gh-poi, git-trim, git-delete-merged-branches, git-branchless, gh-clean-merged, gh-tidy-branches; marketplace cleanup actions): `devlog/_plan/260909_agent_swarm_repo_hygiene/evidence/research/git-cleanup-docs-and-tools.md`
- Local inventory snapshot: `devlog/_plan/260909_agent_swarm_repo_hygiene/evidence/research/local-inventory-2026-09-09.md`
- Codex managed worktrees: `worktree-guardian` §2 (developers.openai.com/codex/environments/git-worktrees)
````

## MODIFY `plugins/codexclaw/skills/dev-devops/SKILL.md` — Modular References table

After the `references/agent-pr-intake.md` row:
```diff
+| `references/local-gc.md` | Local worktree/branch garbage collection; scheduled local cleanup | PR-state merge truth, candidate classes, worktree exclusions, config hygiene, dry-run schedule, `cxc worktree gc` contract |
```

## MODIFY pointers

`plugins/codexclaw/skills/worktree-guardian/SKILL.md` — after line 67 ("`git worktree
prune` (dry-run first).") insert:
```diff
+Automated or bulk cleanup of other worktrees follows `cxc-dev-devops`
+`references/local-gc.md` (DEVOPS-LOCAL-GC-01); the never-list above still wins.
```

`plugins/codexclaw/skills/dev/references/stacked-prs.md` — in DEV-STACK-04, after the
bullet "Never reorder or drop a layer that has already merged — reconstruct forward
instead." insert a bullet:
```diff
+- **A superseded layer** is closed with the supersede procedure in `cxc-dev-devops`
+  `references/agent-pr-intake.md` (DEVOPS-PR-SUPERSEDE-01); keep a superseded parent
+  branch while any child PR is open.
```

`plugins/codexclaw/skills/dev-devops/references/agent-infra-safety.md` — append at end:
```diff
+
+## Pull-request intake
+This file governs agents operating infrastructure. Agents *contributing* pull
+requests are governed by `agent-pr-intake.md` (DEVOPS-AGENT-INTAKE-01); the approval
+classes above do not map onto PR review.
```

`plugins/codexclaw/skills/dev-devops/references/ci-cd-deploy.md` — anti-pattern table,
after the "Bulk-pruning branches by name pattern" row (line 264):
```diff
+| Repository accepting agent PRs with no intake policy | Review budget is consumed by volume, not by risk | `DEVOPS-AGENT-INTAKE-01`, `agent-pr-intake.md` |
+| Local worktree cleanup by ancestry alone under squash merging | Merged branches read as unmerged; reused names get deleted | `DEVOPS-LOCAL-GC-01`, `local-gc.md` |
```

`plugins/codexclaw/skills/dev/references/skill-ownership.md` — after the "Operational
gates" row:
```diff
+| Repository bootstrap (rulesets, merge settings, PR limits) | `dev-devops` `references/repo-bootstrap.md` | `dev-devops` §2.9 |
+| Agent PR intake and supersede (`DEVOPS-AGENT-*`, `DEVOPS-PR-SUPERSEDE-01`) | `dev-devops` `references/agent-pr-intake.md` | `dev` stacked-prs, `dev-devops` agent-infra-safety, ci-cd-deploy |
+| Local worktree/branch GC (`DEVOPS-LOCAL-GC-*`) | `dev-devops` `references/local-gc.md` | `worktree-guardian` §4, `dev-devops` ci-cd-deploy |
```

## MODIFY `CHANGELOG.md` — insert after line 5, before `## [0.2.24] - 2026-09-08`:
```markdown
## [Unreleased]

### Added

- Agent-swarm repository hygiene in `cxc-dev-devops`: `references/repo-bootstrap.md`
  (ruleset-first setup, merge settings, PR limits, labels), `references/agent-pr-intake.md`
  (identity tiers, draft-first, supersede procedure, weak/medium/strong policy options
  with sources), `references/local-gc.md` (worktree/branch GC conventions and the
  `cxc worktree gc` contract); rule IDs `DEVOPS-BRANCH-NAMESPACE-01`,
  `DEVOPS-REPO-BOOTSTRAP-01`, `DEVOPS-AGENT-INTAKE-01`, `DEVOPS-LOCAL-GC-01` and
  their sub-rules.

### Fixed

- `branch-lifecycle.md` keep rules now match the shipped OpenCodex closed-PR planner
  (ten keep reasons in evaluation order, including disposable namespace,
  unknown-head-sha and branch-moved-since-close from lidge-jun/opencodex `59d9bc95f`)
  and state that PR state, not ancestry, is merge truth under squash merging.

```

## Scope boundary

IN: files above. OUT: implementing the command; any deletion.

## Accept criteria

| # | Criterion | Evidence |
|---|---|---|
| A1 | Rule IDs `DEVOPS-LOCAL-GC-01`, `DEVOPS-LOCAL-GC-SCHEDULE-01` defined once; §6 headed "contract only (not implemented)" | grep |
| A2 | Every §3 exclusion row cites its source | reviewer |
| A3 | Five pointer edits present; each named target file exists at L4 tip | `rg` + `ls` |
| A4 | skill-ownership.md has three new rows; Modular References 16 rows | grep |
| A5 | gate + catalog/manifest tests exit 0 at L4 tip | receipt |
| A6 | Opus-5 audit: no contract clause that would delete a managed or locked worktree | attest |
