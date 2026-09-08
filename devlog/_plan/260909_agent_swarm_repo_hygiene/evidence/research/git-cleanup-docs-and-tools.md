# Git branch/worktree cleanup: official docs, CLI tools, and GitHub Actions

Research date: **2026-09-09** (KST). Read-only browsing. All star counts and release dates observed on 2026-09-09 via the GitHub REST API and confirmed against rendered pages. Anything not directly opened is marked **UNVERIFIED**.

Doc version note: git-scm.com served **"git-worktree last updated in 2.54.0"** at the time of reading; the git-config / git-gc / git-branch / git-fetch pages were read from the same "Latest version" channel.

---

## Part 1 — Official git documentation

### 1.1 `git worktree` — https://git-scm.com/docs/git-worktree

**Synopsis (verbatim):**

```
git worktree add [-f] [--detach] [--checkout] [--lock [--reason <string>]]
         [--orphan] [(-b | -B) <new-branch>] <path> [<commit-ish>]
git worktree list [-v | --porcelain [-z]]
git worktree lock [--reason <string>] <worktree>
git worktree move <worktree> <new-path>
git worktree prune [-n] [-v] [--expire <expire>]
git worktree remove [-f] <worktree>
git worktree repair [<path>…]
git worktree unlock <worktree>
```

#### `prune`

> **Remove worktree information in `$GIT_DIR/worktrees` for worktrees whose working trees are missing. Useful after manually removing a working tree that is no longer needed (but use "git worktree remove" next time you want to do so). Also, if you _moved_ a working tree elsewhere causing the worktree information to become dangling, see "git worktree repair" to reconnect the worktree to the new working tree location.**

Key semantic: `prune` operates on **administrative metadata**, not on your files. It deletes entries under `$GIT_DIR/worktrees` whose working tree directory no longer exists. It does not delete branches and it does not delete a worktree that is still on disk.

From the DESCRIPTION, the automatic path:

> If a working tree is deleted without using `git worktree remove`, then its associated administrative files, which reside in the repository (see "DETAILS" below), will eventually be removed automatically (see `gc.worktreePruneExpire` in git-config[1]), or you can run `git worktree prune` in the main or any linked worktree to clean up any stale administrative files.

Related flags on the same page:

> `-n` / `--dry-run` — **With `prune`, do not remove anything; just report what it would remove.**

> `-v` / `--verbose` — **With `prune`, report all removals.**
> With `list`, output additional information about worktrees (see below).

#### `--expire <time>`

> **With `prune`, only prune missing worktrees if older than `<time>`.**
>
> **With `list`, annotate missing worktrees as prunable if they are older than `<time>`.**

So `--expire` is a grace period gate with two distinct effects depending on the subcommand: it suppresses deletion in `prune`, and it changes the `prunable` annotation threshold in `list`.

#### `lock` / `unlock`

`lock`:

> **If a worktree is on a portable device or network share which is not always mounted, lock it to prevent its administrative files from being pruned automatically. This also prevents it from being moved or deleted. Optionally, specify a reason for the lock with `--reason`.**

`unlock`:

> **Unlock a worktree, allowing it to be pruned, moved or deleted.**

Mechanism, from DETAILS (this is the part that matters for scripting):

> To prevent a `$GIT_DIR/worktrees` entry from being pruned (which can be useful in some situations, such as when the entry's worktree is stored on a portable device), use the `git worktree lock` command, which adds a file named `locked` to the entry's directory. The file contains the reason in plain text. For example, if a linked worktree's `.git` file points to `/path/main/.git/worktrees/test-next` then a file named `/path/main/.git/worktrees/test-next/locked` will prevent the `test-next` entry from being pruned.

Interaction with `--force` (three-way escalation, verbatim):

> By default, `add` refuses to create a new worktree when `<commit-ish>` is a branch name and is already checked out by another worktree, or if `<path>` is already assigned to some worktree but is missing (for instance, if `<path>` was deleted manually). This option overrides these safeguards. **To add a missing but locked worktree path, specify `--force` twice.**
>
> `move` refuses to move a locked worktree unless `--force` is specified twice.
>
> `remove` refuses to remove an unclean worktree unless `--force` is used. **To remove a locked worktree, specify `--force` twice.**

Also on `--lock` as an `add` flag:

> **Keep the worktree locked after creation. This is the equivalent of `git worktree lock` after `git worktree add`, but without a race condition.**

And `remove` itself:

> Remove a worktree. Only clean worktrees (no untracked files and no modification in tracked files) can be removed. Unclean worktrees or ones with submodules can be removed with `--force`. **The main worktree cannot be removed.**

#### `repair [<path>…]`

> **Repair worktree administrative files, if possible, if they have become corrupted or outdated due to external factors.**
>
> For instance, if the main worktree (or bare repository) is moved, linked worktrees will be unable to locate it. Running `repair` in the main worktree will reestablish the connection from linked worktrees back to the main worktree.
>
> Similarly, if the working tree for a linked worktree is moved without using `git worktree move`, the main worktree (or bare repository) will be unable to locate it. Running `repair` within the recently-moved worktree will reestablish the connection. If multiple linked worktrees are moved, running `repair` from any worktree with each tree's new `<path>` as an argument, will reestablish the connection to all the specified paths.
>
> If both the main worktree and linked worktrees have been moved or copied manually, then running `repair` in the main worktree and specifying the new `<path>` of each linked worktree will reestablish all connections in both directions.

**`prune` vs `repair` is the critical distinction:** a moved worktree and a deleted worktree look identical from the repository's point of view (dangling `gitdir` pointer). `prune` throws the metadata away; `repair` rebuilds the pointer. Run `prune -n` first, and if a "missing" worktree was actually just moved, use `repair` instead.

`repair` also has a `--relative-paths` interaction:

> **With `repair`, the linking files will be updated if there's an absolute/relative mismatch, even if the links are correct.**

#### `list` annotations (how to see what prune would target)

> The command also shows annotations for each worktree, according to its state. These annotations are:
> - `locked`, if the worktree is locked.
> - `prunable`, if the worktree can be pruned via `git worktree prune`.

Verbose mode surfaces the reason, e.g. from the doc's own example output:

```
/path/to/locked-worktree-with-reason  1234abcd (brancha)
    locked: worktree path is mounted on a portable device
/path/to/prunable-worktree            5678abc1 (detached HEAD)
    prunable: gitdir file points to non-existent location
```

Porcelain form for scripting is `git worktree list --porcelain -z`, with `locked` and `prunable` as attribute labels.

#### `gc.worktreePruneExpire`

Identical text appears on both **git-config** and **git-gc** (the git-gc page selectively includes it from git-config). Verbatim:

> **When `git gc` is run, it calls `git worktree prune --expire 3.months.ago`. This config variable can be used to set a different grace period. The value "now" may be used to disable the grace period and prune `$GIT_DIR/worktrees` immediately, or "never" may be used to suppress pruning.**

Sources: https://git-scm.com/docs/git-config and https://git-scm.com/docs/git-gc

Practical reading: **the default is a 3-month grace period, and it happens automatically inside `git gc`.** Stale worktree metadata therefore disappears on its own eventually. Set `now` for aggressive cleanup, `never` to freeze it. Compare the sibling variable `gc.pruneExpire`, which is a different thing (unreachable objects, `2.weeks.ago`):

> When `git gc` is run, it will call `prune --expire 2.weeks.ago` (and `repack --cruft --cruft-expiration 2.weeks.ago` if using cruft packs via `gc.cruftPacks` or `--cruft`). Override the grace period with this config variable. The value "now" may be used to disable this grace period and always prune unreachable objects immediately, or "never" may be used to suppress pruning.

---

### 1.2 `git config` — fetch/remote pruning — https://git-scm.com/docs/git-config

#### `fetch.prune`

> **If true, fetch will automatically behave as if the `--prune` option was given on the command line. See also `remote.<name>.prune` and the PRUNING section of git-fetch[1].**

#### `fetch.pruneTags`

> **If true, fetch will automatically behave as if the `refs/tags/*:refs/tags/*` refspec was provided when pruning, if not set already. This allows for setting both this option and `fetch.prune` to maintain a 1=1 mapping to upstream refs. See also `remote.<name>.pruneTags` and the PRUNING section of git-fetch[1].**

#### `remote.<name>.prune`

> **When set to true, fetching from this remote by default will also remove any remote-tracking references that no longer exist on the remote (as if the `--prune` option was given on the command line). Overrides `fetch.prune` settings, if any.**

Companion variable, for completeness:

> `remote.<name>.pruneTags` — When set to true, fetching from this remote by default will also remove any local tags that no longer exist on the remote if pruning is activated in general via `remote.<name>.prune`, `fetch.prune` or `--prune`. Overrides `fetch.pruneTags` settings, if any.

**Precedence:** `remote.<name>.prune` overrides `fetch.prune`. So a global `fetch.prune=true` can be turned off for one remote, and vice versa.

#### The PRUNING section of git-fetch — the part people get wrong

From https://git-scm.com/docs/git-fetch:

> Git has a default disposition of keeping data unless it's explicitly thrown away; this extends to holding onto local references to branches on remotes that have themselves deleted those branches.
>
> If left to accumulate, these stale references might make performance worse on big and busy repos that have a lot of branch churn, and e.g. make the output of commands like `git branch -a --contains <commit>` needlessly verbose, as well as impacting anything else that'll work with the complete set of known references.

One-off equivalents, quoted from the doc:

```
# While fetching
$ git fetch --prune <name>

# Only prune, don't fetch
$ git remote prune <name>
```

> To prune references as part of your normal workflow without needing to remember to run that, set `fetch.prune` globally, or `remote.<name>.prune` per-remote in the config. See git-config[1].

And the footgun, verbatim:

> **Here's where things get tricky and more specific. The pruning feature doesn't actually care about branches, instead it'll prune local ←→ remote-references as a function of the refspec of the remote (see `<refspec>` and CONFIGURED REMOTE-TRACKING BRANCHES above).**
>
> **Therefore if the refspec for the remote includes e.g. `refs/tags/*:refs/tags/*`, or you manually run e.g. `git fetch --prune <name> "refs/tags/*:refs/tags/*"` it won't be stale remote tracking branches that are deleted, but any local tag that doesn't exist on the remote.**
>
> **This might not be what you expect, i.e. you want to prune remote `<name>`, but also explicitly fetch tags from it, so when you fetch from it you delete all your local tags, most of which may not have come from the `<name>` remote in the first place.**
>
> **So be careful when using this with a refspec like `refs/tags/*:refs/tags/*`, or any other refspec which might map references from multiple remotes to the same local namespace.**

> Since keeping up-to-date with both branches and tags on the remote is a common use-case the `--prune-tags` option can be supplied along with `--prune` to prune local tags that don't exist on the remote, and force-update those tags that differ. Tag pruning can also be enabled with `fetch.pruneTags` or `remote.<name>.pruneTags` in the config.

The `--prune-tags` option warning on the same page:

> Before fetching, remove any local tags that no longer exist on the remote if `--prune` is enabled. **This option should be used more carefully, unlike `--prune` it will remove any local references (local tags) that have been created.**

`git remote prune` (https://git-scm.com/docs/git-remote):

> Delete stale references associated with `<name>`. By default, stale remote-tracking branches under `<name>` are deleted, but depending on global configuration and the configuration of the remote we might even prune local tags that haven't been pushed there. Equivalent to `git fetch --prune <name>`, except that no new references will be fetched.
>
> **With `--dry-run` option, report what branches would be pruned, but do not actually prune them.**

**Scope note:** all of the above prunes **remote-tracking refs** (`refs/remotes/...`), never your local branches. Deleting `origin/feature` leaves local `feature` alone. That is why every tool in Part 2 exists.

---

### 1.3 `git branch --merged` — https://git-scm.com/docs/git-branch

Option definition, verbatim:

> **`--merged [<commit>]` — Only list branches whose tips are reachable from `<commit>` (`HEAD` if not specified). Implies `--list`.**

> `--no-merged [<commit>]` — Only list branches whose tips are not reachable from `<commit>` (`HEAD` if not specified). Implies `--list`.

Intent, from the NOTES section:

> The options `--contains`, `--no-contains`, `--merged` and `--no-merged` serve four related but different purposes:
>
> - `--contains <commit>` is used to find all branches which will need special attention if `<commit>` were to be rebased or amended, since those branches contain the specified `<commit>`.
> - `--no-contains <commit>` is the inverse of that, i.e. branches that don't contain the specified `<commit>`.
> - **`--merged` is used to find all branches which can be safely deleted, since those branches are fully contained by HEAD.**
> - `--no-merged` is used to find branches which are candidates for merging into HEAD, since those branches are not fully contained by HEAD.

Combination rule:

> When combining multiple `--merged` and `--no-merged` filters, only references that are reachable from at least one of the `--merged` commits and from none of the `--no-merged` commits are shown.

Same reachability model backs `-d`:

> **`-d` / `--delete` — Delete a branch. The branch must be fully merged in its upstream branch, or in HEAD if no upstream was set with `--track` or `--set-upstream-to`.**
>
> `-D` — Shortcut for `--delete --force`.

#### Why squash-merged branches are not detected

This is the load-bearing point, and it follows directly from the quoted definition. **`--merged` is a pure commit-reachability (ancestry) test — "branches whose tips are reachable from `<commit>`".** It never compares content. A squash merge produces a brand-new commit that is not a descendant of the branch tip, so the branch tip is not reachable from `HEAD`, so `--merged` never lists it and `git branch -d` refuses to delete it.

The git docs state the mechanism in two places, though never in the words "squash-merged branches are not detected by `--merged`":

`git merge --squash` (https://git-scm.com/docs/git-merge), verbatim:

> **Produce the working tree and index state as if a real merge happened (except for the merge information), but do not actually make a commit, move the HEAD, or record `$GIT_DIR/MERGE_HEAD` (to cause the next `git commit` command to create a merge commit). This allows you to create a single commit on top of the current branch whose effect is the same as merging another branch (or more in case of an octopus).**

gitfaq (https://git-scm.com/docs/gitfaq), under "What kinds of problems can occur when merging long-lived branches with squash merges?", verbatim:

> When Git does a normal merge between two branches, it considers exactly three points: the two branches and a third commit, called the merge base, which is usually the common ancestor of the commits. The result of the merge is the sum of the changes between the merge base and each head. When you merge two branches with a regular merge commit, this results in a new commit which will end up as a merge base when they're merged again, because there is now a new common ancestor. Git doesn't have to consider changes that occurred before the merge base, so you don't have to re-resolve any conflicts you resolved before.
>
> **When you perform a squash merge, a merge commit isn't created; instead, the changes from one side are applied as a regular commit to the other side. This means that the merge base for these branches won't have changed, and so when Git goes to perform its next merge, it considers all of the changes that it considered the last time plus the new changes.**

Chain of reasoning, stated plainly:

1. `--merged` filters on "tips are **reachable from** `<commit>`" — an ancestry walk.
2. A squash merge deliberately does **not** create a merge commit and does **not** record `MERGE_HEAD`, so the base branch gains **no parent link** to the topic branch tip.
3. The merge base therefore "won't have changed" (gitfaq), i.e. the topic tip stays outside `HEAD`'s ancestry.
4. So `--merged` cannot see it, and `-d` ("must be fully merged") refuses. You need `-D`.

The same applies to **rebase merges**: rebasing copies commits to new SHAs, so the original tip is not an ancestor of `HEAD` either.

**The tooling answer is content equivalence rather than ancestry.** git's own primitive for that is `git cherry` (https://git-scm.com/docs/git-cherry), verbatim:

> Determine whether there are commits in `<head>..<upstream>` that are equivalent to those in the range `<limit>..<head>`.
>
> **The equivalence test is based on the diff, after removing whitespace and line numbers. `git-cherry` therefore detects when commits have been "copied" by means of git-cherry-pick[1], git-am[1] or git-rebase[1].**
>
> Outputs the SHA1 of every commit in `<limit>..<head>`, prefixed with `-` for commits that have an equivalent in `<upstream>` and `+` for commits that do not.

Note the boundary: `git cherry` is patch-id based and so catches **rebase/cherry-pick** equivalence per commit. A multi-commit branch collapsed into **one** squash commit still has no per-commit patch-id match, which is exactly why the tools in Part 2 either synthesize a squashed copy first (git-trim, git-delete-merged-branches `--effort=3`) or abandon git entirely and ask the GitHub PR API (gh-poi, gh-clean-merged, gh-tidy-branches).

---

## Part 2 — CLI tools

Metrics observed 2026-09-09 via GitHub REST API.

### Overview

| Tool | Detection method | Squash | Rebase | Worktrees | Latest release | Stars | License |
|---|---|---|---|---|---|---|---|
| **gh-poi** (seachicken) | GitHub PR API + local HEAD SHA ∈ PR commit list | Yes (stated purpose) | Not documented | **Deletes them**; extensive handling | `v0.18.4` / 2026-08-30 | 1,011 | MIT |
| **git-trim** (foriequal0) | Pure git: `rev-list --cherry-pick`, `branch --merged`, synthetic squash commit | Yes, documented | Yes, documented | **Protects/skips**; removal is an open request | `v0.4.3` / 2022-12-23 (tag+crates `0.4.4` / 2022-12-28) | 548 | MIT |
| **git-delete-merged-branches** (hartwork) | `git branch --merged` → `git cherry` → squashed-copy `git cherry`, by `--effort` level | Yes, but **only at `--effort=3`** (default is 2) | Yes | Skips checked-out branches (code, not README) | `7.6.1` / 2026-07-22 | 914 | GPL-3.0 |
| **git-branchless** (arxanas) | patch-ID commit dedup vs upstream | **Not documented** | Yes (patch-ID) | Only `git test --strategy worktree` | `v0.11.1` / 2026-05-21 | 4,124 | Apache-2.0 |
| **gh-clean-merged** (maastrich) | GitHub PR state via batched GraphQL, by branch name | Yes, headline feature | Yes | Skipped (never touched) | `v0.5.1` / 2026-08-25 | 0 | MIT |
| **gh-tidy-branches** (teamleaderleo) | PR API + **exact head-SHA equality** | Yes, headline feature | Yes | Explicit non-goal | `v0.1.0-rc.3` / 2026-07-26 | 0 | MIT |

---

### 2.1 `gh poi` — seachicken/gh-poi

https://github.com/seachicken/gh-poi · MIT · 1,011 stars · last push 2026-08-30 · `gh extension install seachicken/gh-poi`

**How it decides "merged":** the README never states the algorithm. Motivation section, verbatim:

> Daily development makes it difficult to know which branch is active when there are many unnecessary branches left locally, which causes a small amount of stress. **If you squash merge a pull request, there is no history of the merge to the default branch, so you have to force delete the branch to clean it up**, and you have to be careful not to accidentally delete the active branch.
>
> We have made it possible to automatically determine which branches have been merged and clean up the local environment without worry.

The `--scan` modes, verbatim:

> `quick`: Fast; checks "origin" and "upstream" remotes. Identifies PRs using only the latest commit on each branch
> `deep`: Comprehensive; scans all registered remotes. Performs a deeper history check to link branches to PRs, ensuring no potential matches are missed across multiple forks
> Note: poi ensures safe deletion in both modes

The actual mechanism comes from source (`cmd/root.go`), **not** the README: **GitHub PR API state plus commit-OID membership**, with no merge-base and no patch-id. `isFullyMerged` checks PR state, then tests whether the local HEAD OID appears in the PR's commit list.

**Squash:** yes, it is the stated reason the tool exists (quote above). Maintainer statement in issue #170:

> `poi` searches for PRs using the SHA from just before the merge, even if the SHAs of the merge commits don't match, so it can be deleted even using `squash-and-merge`.

Caveat worth carrying: issue #170 "Squash-merged branches are not deleted" (opened 2026-04-06, closed 2026-08-30) documents a real failure mode where local HEAD diverges from the PR commit list, and quick mode then returns not-merged.

**Rebase:** no explicit README claim. Because detection is PR-API based rather than ancestry based, it is not vulnerable the way `git branch --merged` is, but there is nothing quotable.

**Worktrees: this is the only tool in the survey that actively deletes worktrees.** Not in the README; visible in release notes and code (`shared/worktree.go`, `conn/command.go: GetWorktrees(...)`):
- v0.16.4 "Exclude main worktree from deletion", "Skip deletion if linked worktree has uncommitted changes"
- v0.17.1 "Do not delete worktree with untracked files"
- v0.18.0 "Run worktree prune for cleanup"
- v0.18.1 "Support deleting worktrees that include submodules"
- v0.18.2 "Prevent errors when deleting worktrees locked with a reason"
- v0.18.4 "Handle errors when pruning branches and worktrees"
- Feature request #143 "Delete associated worktrees when removing stale branches" — closed 2026-01-18

**Safety**, verbatim from README:

> - `gh poi --dry-run` Show branches to delete without actually deleting it
> - `gh poi lock <branchname>...` Lock branches to prevent them from being deleted
> - `gh poi unlock <branchname>...` Unlock branches to allow them to be deleted

No interactive confirmation prompt was found in `main.go` / `cmd/root.go` — it deletes directly unless `--dry-run`. Branches are held back if locked, if the worktree is locked / is the main worktree / has untracked or tracked changes, or if no PR is associated.

---

### 2.2 `git-trim` — foriequal0/git-trim

https://github.com/foriequal0/git-trim · MIT · 548 stars · last push 2026-02-05 · `cargo install git-trim`

**How it decides "merged"**, README FAQ "What kind of merge styles that `git-trim` support?", verbatim:

> - A classic merge with a merge commit with `git merge --no-ff`
> - **A rebase merge with `git merge --ff-only` (With `git cherry` equivalents)**
> - **A squash merge with `git merge --squash` (With this method: https://stackoverflow.com/a/56026209)**

FAQ "What is different to `git fetch --prune`?", verbatim:

> `git-trim` does detect whether the upstream branches are merged into the upstream of the base branch. It knows whether it is safe to delete, and even knows that you forgot to delete the remote branch after the merge.
>
> - It inspects the upstream of tracking branches whether they are 'fully' merged, not just whether they are gone.
> - **It is merge styles agnostic. It can detect common merge styles such as merge with a merge commit, rebase/ff merge and squash merge.**

Definition it works to:

> A merged branch is a branch whose upstream branch is fully merged onto the upstream of the base branch so you're not going to lose the changes.

Implementation matches the README: `git rev-list --cherry-pick --right-only --no-merges -n1 <base>...<commit>` for cherry-pick equivalence, `git branch --merged <base>` for no-ff merges, and for squash it builds a **synthetic dangling commit** of the branch tree parented on the merge base and runs the same rev-list check (`src/merge_tracker.rs`, `src/subprocess.rs`).

**Squash:** yes, explicitly. Its README also states the problem this report's Part 1 derives:

> **They are tedious to delete manually. `git branch --merged`'ll likely to betray you when branches are rebase merged or squash merged.**

**Rebase:** yes, explicitly.

> If you use rebase merge, you might have to use scary `--force` flag such as `git branch --delete --force`.

**Worktrees: protects, does not remove.** No README mention. `src/core.rs` has `pub fn preserve_worktree(&mut self, repo: &Repository)` with `reason: format!("worktree at {}", path)`. Issue #109 "Protect worktree branches" closed 2020-08-02. Issue #216 "Option to remove worktrees?" (opened 2025-03-14) is **still open**:

> I'm starting to use more temporary worktrees, but unfortunately `git-trim` won't remove them when merged:
> ```
> te [merged non-tracking, but: worktree at /Users/maximilian/workspace/xarray/.worktrees/te]
> ```
> I'd definitely use an option to delete these.

**Safety**, from README and `docs/git-trim.man`:

> You can also `git trim --dry-run` when you don't trust me.

> It is enough to type just `git trim` and hit the `y` key once.

> `--no-confirm`  Do not ask confirm [config: trim.confirm]
> `--no-detach`  Do not detach when HEAD is about to be deleted [config: trim.detach]
> `--dry-run`  Do not delete branches, show what branches will be deleted
> `-p, --protected=protected`  Comma separated multiple glob patterns (e.g. `release-*`, `feature/*`) of branches that should never be deleted. [config: trim.protected]

Its own caution:

> Use with caution when you are using other than `merged`. It might lose changes, and even nuke repositories.

**Release ambiguity to note:** GitHub Releases tops out at **`v0.4.3` (2022-12-23)**, but a **`v0.4.4` git tag exists (2022-12-28)** and crates.io max_version is **0.4.4 (2022-12-28)**. I confirmed the `v0.4.4` tag exists via the API. Either way the project is effectively dormant: no release in ~3.7 years.

---

### 2.3 `git-delete-merged-branches` — hartwork

https://github.com/hartwork/git-delete-merged-branches · GPL-3.0 · 914 stars · last push 2026-09-06 · `pip install git-delete-merged-branches`

**How it decides "merged"**, README Features, verbatim:

> Detects multiple forms of de-facto merges
>   (rebase merges,
>   **squash merges (needs `--effort=3`)**,
>   single or range cherry-picks…
>   leveraging `git cherry`)

The `--effort` help text (`_cli.py`, same text in the man page), verbatim:

> level of effort to put into finding merged branches; **level 1 uses nothing but "git branch --merged", level 2 adds use of "git cherry", level 3 adds use of "git cherry" on temporary squashed copies (default level: 2)**

This is the cleanest published statement of the three-tier detection ladder in the whole survey, and it maps exactly onto Part 1: level 1 = ancestry (blind to squash), level 2 = patch-id equivalence (catches rebase/cherry-pick), level 3 = synthesized squash copy (catches squash). Engine docstring:

> Tries to detect a squashed merge, i.e. where a single commit … The implementation creates a temporary squashed copy of those commits and then asks `git cherry` if that squashed commit has an equivalent

**No GitHub PR API at all.** README: "Provider agnostic: Works with GitHub, GitLab, Gitea and any other Git hosting".

**Squash: yes — but not by default.** `--effort=3` is required and the default is level 2. This is the single most actionable gotcha in Part 2.

**Worktrees:** no README mention, handled in code. `_git.py` runs `git worktree list --porcelain` (`# requires Git >=2.7.0`); `_engine.py` adds every worktree-checked-out branch to the excluded set and prints `Skipped branch {working_tree_branch!r} because it is currently checked out.` Issue #43 (skip linked-worktree branches) closed 2021-08-26; issue #252 "Worktree removal support" closed 2025-09-03, i.e. it does **not** remove worktrees. **Issue #325 is open**: "[worktrees] Crashes trying to pull a branch that is checked out in a worktree", reported against 7.6.1.

**Safety**, README "Safety" section, verbatim:

> - No branches are deleted without confirmation or passing `--yes`.
> - Confirmation defaults to "no"; plain `[Enter]`/`[Return]` does not delete.
> - `git push` is used with `--force-with-lease` so if the server and you have a different understanding of that branch, it is not deleted.
> - There is no use of `os.system` or shell code to go wrong.
> - With `--dry-run` you can get a feel for the changes that `git-delete-merged-branches` would be making to your branches.
> - Show any Git commands run using `--verbose`.

Also supports **multiple required merge targets** — "only delete branches that have been merged to *all* of `master`, `dev` and `staging`" — via repeatable `--branch/-b`, plus `--exclude/-x` and `--include-regex`. Note release 7.6.1's notes are "Affecting Runtime Behavior: n/a" (packaging/test only).

---

### 2.4 `git-branchless` — arxanas

https://github.com/arxanas/git-branchless · Apache-2.0 · 4,124 stars · last push 2026-09-01 · `cargo install --locked git-branchless` then `git branchless init`

**Framing correction:** this is not a branch-cleanup tool. It is a stacked-diff workflow suite; branch deletion is a side effect of `git sync` / `git move`. It is the highest-starred repo here and the weakest fit for the task.

**How it decides "merged":** patch-ID commit deduplication, not PR state. `git-branchless-opts/src/lib.rs`, `--no-deduplicate-commits`, verbatim:

> **Don't attempt to deduplicate commits. Normally, a commit with the same contents as another commit which has already been applied to the target branch is skipped. If set, this flag skips that check.**

CHANGELOG:

> `git move` will skip applying commits which have already been applied upstream, and delete their corresponding branches.

Wiki (`Command:-git-submit`):

> If your own commit was merged into the remote main branch, then `git sync` will automatically clean it up for you locally.

**Squash: UNVERIFIED / not documented.** No sentence in README, wiki, or CHANGELOG asserts squash-merge branch cleanup. Patch-ID dedup catches rebase/cherry-pick equivalents, but a multi-commit branch collapsed into one squash commit has no per-commit patch-ID match. Do not assume it handles the squash case.

**Worktrees:** no README mention. Wiki mentions worktrees only as a `git test` execution strategy:

> `--strategy worktree`: Run in a worktree managed by git-branchless.

Four open worktree bugs: #215, #771, #1154, #1524.

**Safety:** `git undo` ("a general-purpose undo command"; undoes "Branch creations, updates, and deletions") is the standout. But note the project status, verbatim:

> `git-branchless` is currently in **alpha**. Be prepared for breaking changes… It's believed that there are no major bugs, but it has not yet been comprehensively battle-tested.

And a behavior change to watch (#1152):

> Previously, `git hide` would not delete branches pointing to the hidden commits unless `-D`/`--delete-branches` was passed. **Now, deleting branches is the default behavior.**

Release cadence is lumpy: v0.11.1 on 2026-05-21, v0.11.0 the same day, and before that v0.10.0 on 2024-10-14 — a 19-month gap.

---

### 2.5 gh extensions that delete squash-merged branches by PR state

Search notes: `gh search repos --topic gh-extension` crossed with `branch` / `squash` / `merged`, plus direct lookups. **`davidsbond/gh-prune` and `matt-bartel/gh-clean-branches` return HTTP 404 — they do not exist.** `mislav/gh-branch` (275 stars, Unlicense, last push 2024-07-16, no releases) is fuzzy-find/switch/delete with no PR-state logic. **`davidraviv/gh-clean-branches`** (189 stars, MIT, `v1.0` on 2026-06-19) is the popular one but deletes only branches with **no upstream** — no PR API, no squash logic — so it does not qualify.

The two genuine matches are both brand new and have **0 stars**. Weight them accordingly.

#### `maastrich/gh-clean-merged` — local branches

MIT · **0 stars** · `v0.5.1` / 2026-08-25 · `gh extension install maastrich/gh-clean-merged`

Detection: GitHub PR state via batched GraphQL, looked up by branch name. Verbatim:

> A GitHub CLI extension that deletes the local branches left behind by finished pull requests — **including branches merged by squash or rebase, which `git branch --merged` cannot see.**

> This extension asks GitHub instead. A branch that still exists on the remote is shared work and is left alone; what remains is judged on its pull request, and anything with no pull request at all is reported rather than deleted.

> Pull requests are looked up by branch name, in batches, so a branch merged long ago resolves the same as one merged this morning. Pull requests opened from a fork never match a local branch, even when the branch names are identical.

Its README states the Part 1 mechanism almost exactly as this report derived it:

> **`git branch -d` refuses to delete a squash-merged branch: squashing creates a brand new commit on the base branch with no ancestry link to the branch, so git has no way to tell that the work landed.** Repositories with "Squash and merge" enabled therefore accumulate stale local branches forever, and clearing them by hand means checking each one against GitHub.

> Branches whose merge left ancestry behind are removed with `git branch -d`. Squash merges, rebase merges and abandoned branches need `git branch -D`, because git itself cannot see those merges — which is why the output states the pull request behind each deletion.

Worktrees, one line:

> **The current branch, the base branch, branches checked out in another worktree and anything matching `--protected` are never touched.**

Safety: `-n/--dry-run` ("List what would be deleted and exit"), confirm-by-default, `-y/--yes`, repeatable `--protected` globs, `--keep-closed`, `--base`, `--remote`, `--no-fetch`, `-v/--verbose`. Conservative fallback, verbatim: "**No remote branch and no pull request?** Then nothing outside this machine knows about it, so it is never deleted — only listed."

#### `teamleaderleo/gh-tidy-branches` — remote branches

MIT · **0 stars** · `v0.1.0-rc.3` / 2026-07-26 (still a release candidate) · `gh extension install teamleaderleo/gh-tidy-branches --pin v0.1.0-rc.3`

Detection: PR API **plus exact head-SHA equality** — the strictest criterion in this survey. Verbatim:

> Tidy Branches is a GitHub CLI extension for cleaning up remote branches after their pull requests merge. **It verifies that each branch still points to the exact commit recorded by the merged pull request**, shows you the complete candidate list, and rechecks every branch immediately before deletion.

Its six safe-default conditions, verbatim:

> 1. Its pull request merged directly into the repository's current default branch.
> 2. The pull request came from a branch in the same repository, not a fork.
> 3. The remote branch still exists.
> 4. The branch still points to the exact pull request head SHA recorded at merge time.
> 5. The branch is not the default branch or a protected branch.
> 6. No open pull request currently uses the branch as a head or base.

On squash:

> GitHub can automatically delete branches after future pull request merges, but it does not clean an existing backlog. **Local Git cleanup commands also struggle with squash merges, rebase merges, reused branch names, forks, and repositories that are not cloned on your machine.**

> **With squash and rebase merges, the original pre-merge commit topology is not represented identically on the default branch.** That is why Tidy Branches requires exact-SHA evidence, always previews the candidate set, and records an undo receipt.

Worktrees are an explicit non-goal:

> Tidy Branches does **not** automatically delete closed-unmerged branches, arbitrary stale branches, local branches, worktrees, or tags.

Safety: `-n/--preview` (`--dry-run` alias), confirm-by-default, live revalidation ("The repository, open pull requests, branch protection, and exact branch ref are checked again immediately before deletion"), and an undo receipt ("After a successful deletion, Tidy Branches writes an atomic local receipt containing the previous branch names and exact SHAs").

---

## Part 3 — GitHub Actions for branch cleanup

### 3.1 `actions/stale` — PR-specific inputs

https://github.com/actions/stale · MIT · **1,708 stars** · 433 forks · not archived · last push 2026-09-03 · latest release **`v11.0.0` / 2026-07-28**

Sources: `https://raw.githubusercontent.com/actions/stale/main/action.yml` and `.../README.md`

| Input | action.yml description (verbatim) | Default |
|---|---|---|
| `days-before-pr-stale` | "The number of days old a pull request can be before marking it stale. Set to -1 to never mark pull requests as stale automatically. Override \"days-before-stale\" option regarding only the pull requests." | **unset** (no `default:` key) → falls back to `days-before-stale` = `60` |
| `days-before-pr-close` | "The number of days to wait to close a pull request after it being marked stale. Set to -1 to never close stale pull requests. Override \"days-before-close\" option regarding only the pull requests." | **unset** → falls back to `days-before-close` = `7` |
| `exempt-pr-labels` | "The labels that mean a pull request is exempt from being marked as stale. Separate multiple labels with commas (eg. \"label1,label2\")." | `''` |
| `stale-pr-label` | "The label to apply when a pull request is stale." | `'Stale'` |
| `delete-branch` | "Delete the git branch after closing a stale pull request." | `'false'` |

README detail sections, verbatim:

**`days-before-pr-stale`:**
> Useful to override [days-before-stale](#days-before-stale) but only for the idle number of days before marking the pull requests as stale.
> Default value: unset

**`days-before-pr-close`:**
> Override [days-before-close](#days-before-close) but only for the idle number of days before closing the stale pull requests.
> Default value: unset

**`exempt-pr-labels`:**
> Comma separated list of labels that can be assigned to pull requests to exclude them from being marked as stale
> (e.g: `need-help,WIP`)
> If unset (or an empty string), this option will not alter the stale workflow.
> Default value: unset

**`stale-pr-label`:**
> The label that will be added to the pull requests when automatically marked as stale.
> If you wish to speedup the stale workflow for the pull requests, you can add this label manually to mark as stale.
> Default value: `Stale`
> Required Permission: `pull-requests: write`

**`delete-branch`:**
> **If set to `true`, the stale workflow will automatically delete the GitHub branches related to the pull requests automatically closed by the stale workflow.**
> Default value: `false`
> Required Permission: `pull-requests: write` and `contents: write`

Permissions note from the README's example workflow:

```yaml
contents: write # only for delete-branch option
```

**Reading:** `delete-branch` is deliberately narrow. It only touches branches of PRs that **this workflow itself** closed as stale. It will not sweep an existing backlog, and it is off by default. `-1` is the documented "never" sentinel for both PR day counts.

### 3.2 Three marketplace actions that delete branches

| Action | Scope | dry-run default | Protected/default branch handling | Stars | Latest release | License |
|---|---|---|---|---|---|---|
| `SvanBoxel/delete-merged-branch` | Branch of a just-closed PR | **none at all** | UNVERIFIED (not stated) | 334 | `1.4.3` / 2023-01-23 | ISC |
| `fpicalausa/remove-stale-branches` | Any stale branch, repo-wide | **`false` (destructive)** | `exempt-protected-branches: true`, `exempt-branches-regex: ^(main\|master)$` | 52 | `v2.6.1` / 2026-05-06 | MIT |
| `beatlabs/delete-old-branches-action` | Any old branch (+ tags), repo-wide | **`true` (safe)** | `default_branches: main,master` + GitHub protected branches | 67 | `v0.0.11` / 2025-03-19 | Apache-2.0 |

---

#### 1. `SvanBoxel/delete-merged-branch` — "Delete merged branch"

https://github.com/SvanBoxel/delete-merged-branch · Marketplace: https://github.com/marketplace/actions/delete-merged-branch (listed; usage shown as `SvanBoxel/delete-merged-branch@main`)
ISC · **334 stars** · not archived · last push 2024-02-16 · latest release `1.4.3` / 2023-01-23

README, verbatim:

> A GitHub app built with [Probot](https://github.com/probot/probot) that automatically deletes a branch after it's merged. That's it, enjoy!

> **This GitHub app listens to the `pull_request.closed` webhook. If a pull request is closed and the connected branch is merged, it will delete the branch.**

Inputs (verbatim from `action.yml` — **neither declares a default**):

```yaml
inputs:
  exclude:
    description: 'list of branches that should not be automatically deleted after a merge. Wildcards supported.'
    required: false
  delete_closed_pr:
    description: 'whether or not a branch should be deleted if PR is closed without merging'
    required: false
```

Also configurable via `.github/delete-merged-branch-config.yml`:

> - `exclude` _(array)_ - list of branches that should not be automatically deleted after a merge. Wildcards supported.
> - `delete_closed_pr` _(bool)_ whether or not a branch should be deleted if PR is closed without merging

**Safety posture: no dry-run mode at all.** Its safety is structural — it is event-scoped to a single just-closed PR's head branch, so it can never sweep a backlog. Closed-but-unmerged PRs are **not** touched unless you opt in with `delete_closed_pr`. Exclusions support wildcards.

Two caveats. It runs on the deprecated `node16` runtime with no commits since Feb 2024. And **UNVERIFIED**: explicit protected/default-branch handling is not stated in either the README or `action.yml` (the `src/` dir 404s via API; bundled `dist/index.js` was not read).

The README itself says you may not need it:

> You may not need this app as GitHub [recently added this feature](https://github.blog/changelog/2019-07-31-automatically-delete-head-branches-of-pull-requests/) natively to their platform.

---

#### 2. `fpicalausa/remove-stale-branches` — "Remove Stale Branches"

https://github.com/fpicalausa/remove-stale-branches · Marketplace: https://github.com/marketplace/actions/remove-stale-branches
MIT · **52 stars** · not archived · last push **2026-09-07** (most actively maintained of the three) · latest release `v2.6.1` / 2026-05-06 · runs on `node24`

README, verbatim:

> This GitHub Action will identify stale branches and mark them for deletion after a set period.

Inputs (verbatim descriptions from `action.yml`):

| Input | Description | Default |
|---|---|---|
| `github-token` | "PAT for GitHub API authentication." | `${{ github.token }}` |
| `dry-run` | "Flag that prevents this action from doing any modification to the repository." | `"false"` |
| `exempt-organization` | "Name of a GitHub organization. Branches for which the latest committer belongs to this organization will be exempt from cleanup." | — |
| `restrict-branches-regex` | "Regular expression defining branch names that are eligible for cleanup. Defaults to all." | — (README: `^.*$`) |
| `exempt-branches-regex` | "Regular expression defining branch names that are exempt from cleanup, out of the ones selected for cleanup using `restrict-branches-regex`. Defaults to `^(main\|master)$`." | `"^(main\|master)$"` |
| `exempt-protected-branches` | "Whether protected branches are exempted" | `"true"` |
| `exempt-authors-regex` | "Regular expression defining authors who are exempt from cleanup. By default, no author is exempted." | — |
| `stale-branch-message` | Comment template: "@{author} Your branch [{branchName}]({branchUrl}) hasn't been updated in the last {daysBeforeBranchStale} days and is marked as stale. It will be removed in {daysBeforeBranchDelete} days." | as shown |
| `days-before-branch-stale` | "Number of days since the last commit before a branch is considered stale. Once stale, this action will leave a comment on the last commit, marking the branch as stale." | `"90"` |
| `days-before-branch-delete` | "Number of days before a stale branch is removed." | `"7"` |
| `operations-per-run` | "Maximum number of stale branches to look at in any run of this action." | `"10"` |
| `ignore-unknown-authors` | "Whether to abort early when a commit author cannot be identified…" | `"false"` |
| `default-recipient` | "A string corresponding to the username to be tagged on stale branches from unknown authors" | `""` |
| `ignore-branches-with-open-prs` | "Whether to ignore branches with open pull requests." | `"false"` |
| `remap-authors` | "A JSON mapping overriding some commit authors to GitHub usernames. The remapped names will be used in the comments." | — |
| `repository` | "Target repository in the format `owner/repo`. Defaults to the repository the workflow is running in." | — |

Outputs: `scanned_branches`, `removed_branches`, `removed_branches_count`, `new_stale_branches`, `new_stale_branches_count`, `existing_stale_branches_count`.

**Safety posture: destructive by default.** `dry-run` exists but defaults to `false`. The README says so in its own words:

> ## ⚠️💣 CAUTION
> **Without setting `dry_run: true`, this action will remove branches. Consider setting `dry_run: true` until you are happy with how this action works.**

Mitigations that *are* on by default: `exempt-protected-branches: true` and `exempt-branches-regex: ^(main|master)$`. Plus a real grace period — it comments on the branch first and deletes 7 days later, and `operations-per-run: 10` caps blast radius per run.

**Second gotcha:** `ignore-branches-with-open-prs` defaults to **`false`**, so branches with open PRs are in scope unless you explicitly opt out.

---

#### 3. `beatlabs/delete-old-branches-action` — "Delete old branches"

https://github.com/beatlabs/delete-old-branches-action · Marketplace: https://github.com/marketplace/actions/delete-old-branches
Apache-2.0 · **67 stars** · not archived · last push 2025-03-19 · latest release `v0.0.11` / 2025-03-19

README, verbatim:

> This simple GitHub Action will delete branches and optionally tags that haven't received a commit recently. The time since last commit is configurable.

Inputs (verbatim from `action.yml`):

| Input | Description | Default |
|---|---|---|
| `repo_token` | "The GITHUB_TOKEN secret" | required: true |
| `date` | "A git-log compatible date format" | required: true |
| `dry_run` | "Run in dry-run mode so no branches are deleted" | **`true`** |
| `delete_tags` | "Also look for tags to delete" | `false` |
| `minimum_tags` | "Minimum number of tags to keep" | `false` |
| `default_branches` | "Default branch(es) to exclude" | `main,master` |
| `extra_protected_branch_regex` | "grep extended (ERE) compatible regex for additional branches to exclude" | — |
| `extra_protected_tag_regex` | "grep extended (ERE) compatible regex for additional tags to exclude" | — |
| `exclude_open_pr_branches` | "Exclude branches that have an open pull request" | **`true`** |

Outputs: `was_dry_run`, `deleted_branches`.

**Safety posture: the safest of the three.** `dry_run` defaults to `true`, and `exclude_open_pr_branches` defaults to `true`. README, verbatim:

> The default behaviour is to exclude the default branch (main or master) and the Github protected branches. Default branch(es) can be overriden using the `default_branches` variable…

> **Always** run the GitHub action in dry-run mode to ensure that it will do the right thing before you actually let it do it. Also make sure that you have a full copy of the repository (`git clone --mirror ...`) in case something goes bad

Note the marketplace listing page also links the `icyak/delete-old-branches-action` fork alongside beatlabs, so the canonical slug maps a little oddly, but the listing exists and references beatlabs.

---

### 3.3 Candidates checked and rejected

| Repo | Stars | State | Why rejected |
|---|---|---|---|
| `jessfraz/branch-cleanup-action` | 422 | not archived, last push 2022-03-02 | **Has no `action.yml` or `action.yaml`** (both 404). README documents the obsolete HCL `workflow {}`/`action {}` syntax. **Not on Marketplace** (slug 404). Dead despite the star count. Its README does state: "This will **never** delete the repository's default branch or protected branches. If the pull request is closed _without_ merging, it will **not** delete it." |
| `cbrgm/cleanup-stale-branches-action` | 16 | active, last push 2026-09-06 | **Best-in-class safety** (`dry-run` default `'true'`, `rate-limit` default `'true'`, excludes default/protected/open-PR branches), on Marketplace, actively maintained — but 16 stars loses the "popular" criterion. Latest `v1.2.13` / 2026-09-01. Worth using anyway if safety beats popularity. |
| `phpdocker-io/github-actions-delete-abandoned-branches` | 24 | last push 2024-03-08 | Good model (`dry_run` is `required: true` with **no default**, forcing an explicit choice; excludes default/protected/open-PR). On Marketplace. Lower stars + stale. |
| `dawidd6/action-delete-branch` | 12 | **ARCHIVED** (2021-04-29) | Archived and tiny. |
| `etiennemartin/stale-branch-action` | 1 | — | Too small. |
| `kaushikkalyan/delete-branch-on-close` / "delete-branch-on-close" | — | — | **UNVERIFIED / not found.** `gh search repos "delete branch on close"` returned zero results and no marketplace slug resolves. The name most likely comes from `SvanBoxel`'s own example workflow, which is literally named `delete branch on close pr`. |

---

## Practical synthesis

**The single mechanism behind everything above.** `git branch --merged` and `git branch -d` are pure ancestry tests — "branches whose tips are reachable from `<commit>`". `git merge --squash` explicitly does "not actually make a commit, move the HEAD, or record `$GIT_DIR/MERGE_HEAD`", so no parent link is created and the merge base "won't have changed". Result: squash-merged (and rebase-merged) branches are invisible to `--merged` forever. Every tool in Parts 2 and 3 is a workaround for exactly this, and each picks one of three strategies:

1. **Patch-id / content equivalence** (`git cherry`, `rev-list --cherry-pick`) — catches rebase and cherry-pick. git-trim, gdmb `--effort=2`, git-branchless.
2. **Synthesized squash commit + equivalence check** — catches true squash merges. git-trim, gdmb `--effort=3`. Both cite the same StackOverflow method.
3. **Ask the forge** (GitHub PR API/GraphQL) — catches everything the forge recorded, at the cost of GitHub-only. gh-poi, gh-clean-merged, gh-tidy-branches.

**Worktree cleanup is barely solved.** Of everything surveyed, **only `gh poi` actually deletes worktrees** (and it built that up across v0.16.4 → v0.18.4 with careful guards for main worktree, uncommitted changes, untracked files, submodules, and locked worktrees). git-trim, gdmb, and gh-clean-merged all merely **skip** branches checked out in a worktree; gh-tidy-branches lists worktrees as an explicit non-goal; git-branchless has four open worktree bugs. git-trim issue #216 asking for worktree removal has been open since 2025-03-14. For the rest, plain `git worktree prune` (plus `gc.worktreePruneExpire`, default `3.months.ago`) is the mechanism.

**Three defaults that will bite you:**
- `git-delete-merged-branches` needs **`--effort=3`** for squash detection; the default is level 2.
- `fpicalausa/remove-stale-branches` ships `dry-run: false` and `ignore-branches-with-open-prs: false`.
- `actions/stale`'s `delete-branch` is `false`, and even when true only touches PRs that workflow itself closed.

**Recommended stack for a GitHub-centric repo:**
- Server side: enable GitHub's native auto-delete-head-branches; add `beatlabs/delete-old-branches-action` (or `cbrgm/cleanup-stale-branches-action`) for the backlog, both dry-run-by-default; `actions/stale` with `delete-branch: true` only if you want stale-PR branches swept too.
- Local side: `gh poi --dry-run` first, since it is the only one that also cleans up worktrees, is actively maintained (v0.18.4, 2026-08-30), and has 1,011 stars.
- Forge-agnostic local side (GitLab/Gitea/self-hosted): `git-delete-merged-branches --effort=3 --dry-run`, which is provider agnostic and has the most explicit safety documentation.
- Config hygiene everywhere: `git config --global fetch.prune true`. Leave `fetch.pruneTags` **off** unless you have read the PRUNING footgun above, because a `refs/tags/*:refs/tags/*` refspec will delete local tags that never came from that remote.

---

## Verification notes

- Star counts, push dates, archive state, licenses, and latest release tags/dates for all 12 repos were confirmed directly against the GitHub REST API on 2026-09-09, not taken from rendered pages alone.
- `foriequal0/git-trim`'s `v0.4.4` tag was confirmed present via `repos/foriequal0/git-trim/tags` while `releases/latest` returns `v0.4.3` — hence the dual figure in this report.
- README quotes for `maastrich/gh-clean-merged`, `teamleaderleo/gh-tidy-branches`, `seachicken/gh-poi`, and `hartwork/git-delete-merged-branches` were re-pulled from raw sources and grep-confirmed verbatim.
- Explicitly marked **UNVERIFIED**: git-branchless squash-merge branch cleanup (no supporting doc sentence found anywhere); `SvanBoxel/delete-merged-branch` protected/default-branch handling (`src/` 404s, bundled `dist/index.js` not read); the existence of any action literally named `delete-branch-on-close`.
