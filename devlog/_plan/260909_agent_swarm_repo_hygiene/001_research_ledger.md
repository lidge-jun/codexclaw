# Research ledger

Sources gathered 2026-09-09 by three Opus-5 read-only subagents (skill audit, external
SOTA, local inventory) and six Aside browser runs on the signed-in profile. Raw reports
are copied verbatim under `evidence/research/`. Each claim below carries its status:
**V** verified by opening the primary source in this session; **A** observed from live
API/UI in this session; **U** unverified — must not appear as fact in a skill file.

## L1 — branch-lifecycle drift

| # | Claim | Status | Source |
|---|---|---|---|
| 1.1 | opencodex planner has 10 keep reasons evaluated in this order: protected, cross-repository, merged, open, base-of-open, missing-closed-at, within-grace, outside-disposable-namespace, unknown-head-sha, branch-moved-since-close; "no PR ever" is a `continue`, not a keep reason | A | `/Users/jun/Developer/new/700_projects/opencodex/.github/scripts/closed-pr-branch-cleanup.cjs` lines 60-71 (KEEP_REASONS), 157-224 (filter) |
| 1.2 | `DISPOSABLE_BRANCH_PREFIXES = ["codex/", "ingw/"]`, `DEFAULT_GRACE_DAYS = 14` | A | same file lines 20, 23 |
| 1.3 | Commit `59d9bc95f` (2026-08-27) "fix: stop deleting reused branches": name-only matching deleted a branch reused for new work whose historical PRs were all closed | A | `git show 59d9bc95f` in opencodex |
| 1.4 | `cleanup-orphaned-workflows.yml` uses `push: branches: [main]` in addition to schedule, with a bootstrap rationale comment | A | subagent A audit; file in opencodex `.github/workflows/` |
| 1.5 | `git branch --merged` is a reachability test; `git merge --squash` records no MERGE_HEAD so the merge base does not move; squash-merged branches are never listed | V | https://git-scm.com/docs/git-branch, https://git-scm.com/docs/git-merge, https://git-scm.com/docs/gitfaq (quoted in evidence/research/git-cleanup-docs-and-tools.md §1.3) |
| 1.6 | `git cherry` equivalence is per-commit patch-id; a multi-commit branch squashed to one commit has no per-commit match | V | https://git-scm.com/docs/git-cherry |

## L2 — repository bootstrap

| # | Claim | Status | Source |
|---|---|---|---|
| 2.1 | "Automatically delete head branches" deletes only merged PR heads; a closed-unmerged PR keeps its branch; manual Delete button on closed PR | V | https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/closing-a-pull-request ; https://github.blog/changelog/2019-07-30-automatically-delete-head-branches-of-pull-requests/ |
| 2.2 | REST: `PATCH /repos/{owner}/{repo}` fields `delete_branch_on_merge`, `allow_auto_merge`, `allow_update_branch`, `allow_squash_merge`, `allow_merge_commit`, `allow_rebase_merge`, `squash_merge_commit_title` | V | https://docs.github.com/en/rest/repos/repos (quoted in evidence/research/github-rulesets-and-agent-conventions.md §1d) |
| 2.3 | Rulesets: `POST /repos/{owner}/{repo}/rulesets` with `target`, `enforcement`, `bypass_actors[]`, `conditions.ref_name.include/exclude`, `rules[]` of types `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks`, `merge_queue`, `required_signatures`, `required_linear_history` | V | https://docs.github.com/en/rest/repos/rules (full example in evidence §1c) |
| 2.4 | "Restrict deletions" applies only to refs the ruleset targets; a ruleset on `~DEFAULT_BRANCH` does not stop a workflow deleting `codex/*`; `~ALL` targeting changes that | V | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets (evidence §1a) |
| 2.5 | Bypass actors: roles, teams, GitHub Apps (`actor_type: Integration`), deploy keys, individual users (since 2026-05-07); whether the built-in `github-actions` app is selectable in the UI | V for the list, **U** for github-actions selectability | https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming ; evidence §1b |
| 2.6 | Merge queue is a ruleset rule; CI must listen to `merge_group` or required checks never report for queued PRs | V | https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue |
| 2.7 | Classic branch protection can be converted to a ruleset with a "Convert to ruleset" button (2026-08-11) | V | https://github.blog/changelog/2026-08-11-automatically-migrate-branch-protection-rules-to-repository-rulesets |
| 2.8 | Pull request limits (2026-06-18): per-user cap on open PRs for users without write access; agent PRs count; drafts do not; bypass list; issue limits in development; PR archiving shipped 2026-07-16 | V | https://github.blog/open-source/maintainers/how-pull-request-limits-are-cutting-down-the-noise/ ; https://github.blog/changelog/2026-07-16 (archive PRs, per Aside changelog pass) |
| 2.9 | Ruleset rule "Require an additional approval for unattributed Copilot pull requests" exists and is on for opencodex dev/main/preview | A | evidence/research/agent-pr-hygiene-2026-09-09.md §2b |
| 2.10 | `good first issue`-style labels attract agent PRs within minutes | A (one first-hand X report) | https://x.com/sebastienlorber/status/2095806439646224590 |
| 2.11 | Push rules path exceptions (2026-08-25); required reviewer rule GA (2026-02-17); restrict review dismissal (2026-07-07) | V | github.blog changelog month archives, evidence §3 |
| 2.12 | Live settings of lidge-jun repos (auto-delete off on codexclaw; cli-jaw classic protection only; ima2-gen force-push allowed; opencodex DeployKey "always" bypass on main/preview; no repo requires status checks at ruleset level except codexclaw; `allow_update_branch` false on all four) | A | evidence/research/lidge-jun-repos-settings-audit.md (lines 44, 65, 80, 95 for update-branch) |
| 2.13 | `enforce-pr-target.yml` exists in both opencodex and codexclaw (`pull_request_target`; base must be `dev` except `dev -> main`; wrong base gets title prefix, draft conversion and a comment) | A | codexclaw `.github/workflows/enforce-pr-target.yml` lines 1-8, 186-200; opencodex same file |

## L3 — agent-PR intake

| # | Claim | Status | Source |
|---|---|---|---|
| 3.1 | Copilot cloud agent: `copilot/` prefix fixed; draft PR; cannot mark ready, approve or merge; requester's approval does not count; "Approve and run workflows" gate default on, admin toggle "Require approval for workflow runs"; commits signed (2026-04-03) | V | https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations ; .../configuring-agent-settings ; https://github.blog/changelog/2026-04-03-copilot-cloud-agent-signs-its-commits |
| 3.2 | Codex cloud: branch template `codex/{feature}` is a user setting with `{feature}`,`{date}`,`{time}`; PR author identity and draft behavior | A for template (live settings UI), **U** for author/draft | evidence/research/github-rulesets-and-agent-conventions.md §2.2 |
| 3.3 | Claude Code GitHub Actions: `claude/` prefix configurable; pushes a branch and returns a PR link, does not open the PR; `claude[bot]` identity; signing opt-in (`use_commit_signing`) | V | evidence §2.3 (action.yml and docs opened) |
| 3.4 | Enterprise AI controls / agent control plane GA (2026-02-26): `actor_is_agent` audit identifier; Agents tab (2026-01-26) | V | github.blog changelog entries in evidence §3 |
| 3.5 | Practitioner mechanisms: per-contributor cap (OpenSSL 3-4, llama.cpp 1 for newcomers), trust tier by merged-PR count (Godot ≤3), required accepted issue (ghostty, llama.cpp), auto-close after 30 days inactivity (dotnet/runtime, 44% of closed agent PRs), "cannot explain → closed" (Kubernetes, LLVM), diff size caps, `Assisted-by:` trailer mandated (OpenSSL) / recommended (LLVM, Fedora, kernel) / banned (Kubernetes) / discouraged (Crossplane), autonomous-agent bans (LLVM, Godot, OSSF BCP), Copilot instructions file raised dotnet success 38%→69% | V (pages opened; some dates U) | evidence/research/agent-pr-flood-practitioner-writeups.md; oss-ai-contribution-policies.md |
| 3.6 | curl 2026-04-22: "slop situation is not a problem anymore" after bounty removal; do not cite curl as proof AI reports are worthless | V | evidence writeups §5 |
| 3.6a | "Must be able to explain your change" rule verbatim in ghostty, elasticsearch-py ("You must understand your code … the PR will be closed"), Kubernetes, Home Assistant, Fedora, Node.js, Trickster ("can defend the contribution under reasonable technical scrutiny") | V | evidence/research/oss-ai-contribution-policies.md lines 552, 595, 641 |
| 3.7 | X discourse: Laravel disabled Issues (2026-09-03); yt-dlp label-and-close; `agent-pr-gate` as required check; provenance PR template (boltons) | A | evidence/research/agent-pr-hygiene-2026-09-09.md §1 |
| 3.8 | opencodex live: 72 open PRs, 56 drafts, 0 bot authors, 24 `codex/copilot/claude` branches + 13 `agent/` branches from human accounts | A | lidge-jun-repos-settings-audit.md §5.1 |

## L4 — local GC

| # | Claim | Status | Source |
|---|---|---|---|
| 4.1 | `git worktree prune` removes only admin metadata for missing trees; `--expire <time>`; locked worktrees are skipped; `gc.worktreePruneExpire` default `3.months.ago`, `now`/`never` | V | https://git-scm.com/docs/git-worktree ; https://git-scm.com/docs/git-config |
| 4.2 | `fetch.prune` / `remote.<name>.prune`; `fetch.pruneTags` can delete local tags under a `refs/tags/*:refs/tags/*` refspec | V | https://git-scm.com/docs/git-config ; git-fetch PRUNING section |
| 4.3 | gh-poi (v0.18.4, 2026-08-30, 1,011 stars) decides "merged" via PR API + local head SHA in PR commit list, and deletes worktrees with guards (main worktree, uncommitted, untracked, submodules, locked); git-trim/gdmb/gh-clean-merged only skip worktree branches; gdmb needs `--effort=3` for squash | V | evidence/research/git-cleanup-docs-and-tools.md §2 |
| 4.4 | Marketplace cleanup actions: `beatlabs/delete-old-branches-action` dry_run default true; `fpicalausa/remove-stale-branches` dry-run default false; `actions/stale` `delete-branch` default false | V | evidence §3 |
| 4.5 | Local inventory: 133 worktrees across four repos, 70 under `/private/tmp` (15G), 25 dirty, cli-jaw has 4 locked worktrees whose paths are gone; opencodex 314 local branches, 94 upstream-gone, 43 PR-merged branches not ancestors of dev (squash); `fetch.prune` unset in codexclaw and cli-jaw; no cron/LaunchAgent GC | A (dated snapshot, not script-reproduced) | `evidence/research/local-inventory-2026-09-09.md` |
| 4.6 | Codex managed worktrees: per-thread slots under `~/.codex/worktrees`, auto-deleted on archive, latest N retained | V (already in worktree-guardian §2 with source) | developers.openai.com/codex/environments/git-worktrees |

## Items explicitly NOT to state as fact

- Whether `github-actions` appears as a selectable bypass actor in the ruleset UI.
- Codex cloud PR author account and draft default.
- Ruleset bypass honored by async auto-merge (third-party bug report only).
- Exact last-changed dates for Kubernetes and Rust AI policies.
- Any HackerOne "was AI used" checkbox for curl (not found).
