# Repository Bootstrap — Ruleset-First Setup for Agent-Facing Repositories

Last reviewed: 2026-09-09
Applies to: GitHub repositories (REST rulesets API; the docs example uses `X-GitHub-Api-Version: 2026-03-10`)
When to read: A new repository, or an existing one about to receive agent pull requests; any request naming branch protection, rulesets, auto-delete, auto-merge, required checks, or pull request limits
Canonical owner: dev-devops §2.9 (`DEVOPS-REPO-BOOTSTRAP-01`)

---

## §0 Authority

Reading this file authorizes nothing. Every `PATCH` and `POST` below changes external
state and needs the same explicit approval as a push (`DEV-GIT-PUSH-01` class). The
default mode is **check**: run §7, fill the expected-state table, and propose the
delta. Apply only when the user named the repository and the settings to change.

## §1 Branch model

| Branch | Role | PR base for | Notes |
|---|---|---|---|
| `main` | Release line and default branch | promotion PRs from `dev` (or `preview`) only | Scheduled workflows run **only** from the default branch (`branch-lifecycle.md` §3); a cleanup job landed on `dev` does nothing until promoted |
| `preview` | Release candidate | promotion PRs from `dev` | Optional; same protection as `main` |
| `dev` | Integration | every feature/fix PR | Enforce with a PR-target workflow: any PR whose base is not `dev` and is not the promotion path gets a title prefix, a draft conversion and a comment (opencodex/codexclaw `enforce-pr-target.yml`). A manual PR chain (`DEV-STACK-*`) needs an exemption for same-repository open-PR heads, or the upper layers are flagged |

## §2 Ruleset-first (`DEVOPS-RULESET-FIRST-01`, DEFAULT)

Use repository rulesets, not classic branch protection. GitHub offers a "Convert to
ruleset" button for legacy rules (changelog 2026-08-11) and ships ruleset-only rules:
required reviewer (GA 2026-02-17), restrict review dismissal (2026-07-07), user bypass
actors and in-scope branch renaming (2026-05-07), push-rule path exceptions
(2026-08-25). Keeping a classic rule beside rulesets leaves two sources of truth. The
opposite failure is one classic rule and no rulesets at all — cli-jaw on 2026-09-09 —
where deleting that rule leaves `main` unprotected; GitHub offers Convert to ruleset on it.

Rule IDs in this file (`DEVOPS-RULESET-FIRST-01`, `DEVOPS-MERGE-SETTINGS-01`,
`DEVOPS-PR-LIMITS-01`) are reference-local sub-rules under `DEVOPS-REPO-BOOTSTRAP-01`,
which is the row registered in `dev-devops` §2.9.

One ruleset per integration line. Shape verified against the REST reference (read
2026-09-09):

```json
{
  "name": "Protect dev",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
  ],
  "conditions": { "ref_name": { "include": ["refs/heads/dev"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge", "squash"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [ { "context": "ci-aggregate" } ] } }
  ]
}
```

Role `actor_id` values are not documented as constants here — read them back from an
existing ruleset (`gh api "repos/$OWNER/$REPO/rulesets/$RULESET_ID"`) before reusing an example. `bypass_mode:
"pull_request"` limits the bypass to PR merges; `"always"` also bypasses direct
pushes and deletions — do not grant `always` to deploy keys on a release line (opencodex
`main`/`preview` did on 2026-09-09; `dev` did not).

A tag ruleset for releases:

```json
{ "name": "Protect release tags", "target": "tag", "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" } ] }
```

A tag ruleset can also carry an `update` rule (parameter `update_allows_fetch_and_merge`);
its behaviour on tag targets is **unverified** here — read a created ruleset back before
relying on it.

Create with `gh api --method POST "repos/$OWNER/$REPO/rulesets" --input ruleset.json`;
list with `gh api "repos/$OWNER/$REPO/rulesets"`; a ruleset is updated with
`gh api --method PUT "repos/$OWNER/$REPO/rulesets/$RULESET_ID" --input ruleset.json`.

Facts that change the design:

- **Restrict deletions applies to targeted refs only.** A ruleset whose `include` is
  `refs/heads/dev` does not stop a workflow from deleting `codex/*`; the closed-PR
  cleanup job (`branch-lifecycle.md` §3) keeps working. Targeting `~ALL` changes that,
  and then the cleanup identity must be a bypass actor. A custom GitHub App
  (`actor_type: "Integration"`) is the documented route. Whether the built-in
  `github-actions` app can be selected as a bypass actor in the UI is **unverified**
  (docs do not say; community reports conflict) — do not plan on it.
- **`required_signatures` breaks agents that do not sign.** Copilot cloud agent signs
  commits (changelog 2026-04-03); Claude Code GitHub Actions signs only with
  `use_commit_signing`/`ssh_signing_key`; Codex cloud is unverified. Enable only after
  checking every agent path the repository accepts (`agent-pr-intake.md` §1).
- **`merge_queue` requires CI on `merge_group`.** Without `on: merge_group:` the queue's
  required checks never report and every queued PR stalls.
- **`require_last_push_approval`** interacts with agent pushes: the approval must cover
  the last push and come from someone other than the agent.
- **"Require an additional approval for unattributed Copilot pull requests"** is a
  ruleset option worth enabling where Copilot cloud agent is in use.

## §3 Repository merge settings (`DEVOPS-MERGE-SETTINGS-01`, DEFAULT)

```bash
gh api --method PATCH "repos/$OWNER/$REPO" \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=true \
  -F allow_update_branch=true \
  -F allow_merge_commit=true \
  -F allow_squash_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  -F allow_rebase_merge=false
```

| Field | Why |
|---|---|
| `delete_branch_on_merge` | Deletes the head of a **merged** PR. A PR closed without merging keeps its branch (`branch-lifecycle.md` §1); pair with the scheduled cleanup job |
| `allow_auto_merge` | Lets a reviewed PR land when checks pass. Only safe with required status checks in the ruleset; auto-merge + one approval + no required check is a fast path around CI (opencodex state on 2026-09-09) |
| `allow_update_branch` | Shows "Update branch" so a PR does not merge green against a stale base; all four lidge-jun repositories had it off on 2026-09-09 (settings audit) |
| `allow_rebase_merge=false` | Under squash-by-default, rebase merges only add a third ancestry shape for cleanup tools to misread |
| squash title/message | Keeps PR number and body in the single squash commit, which is the provenance local GC later joins on |

## §4 Closed-PR cleanup job

Copy `.github/workflows/cleanup-closed-pr-branches.yml`, `.github/scripts/closed-pr-branch-cleanup.cjs`
and its test from lidge-jun/opencodex (merged as `bae100aa7`, reused-name fix `59d9bc95f`).
Set two values for the new repository: `DISPOSABLE_BRANCH_PREFIXES` (the namespaces
agents create under — see `agent-pr-intake.md` §1 for each agent's prefix) and
`GRACE_DAYS`. Keep the trigger schedule-only. Remember it runs from the default branch.

## §5 Pull request limits and archiving (`DEVOPS-PR-LIMITS-01`, DEFAULT)

GitHub's pull request limits (2026-06-18) cap how many PRs a user **without write
access** can have open at once; PRs opened by Copilot or another agent count; **draft
PRs do not count**; trusted contributors go on a bypass list. Admins can archive PRs
(2026-07-16). Issue limits and smarter bypass signals (prior merged PR, account age) were
announced as in development. Configure under repository settings; a REST endpoint for the
limit is **unverified** — treat it as UI-configured until checked. The draft exemption is
the natural incentive for draft-first intake (`agent-pr-intake.md` §2).

## §6 Labels and templates

Minimum label set for agent intake: `agent`, `superseded`, `needs-info`, `stale`,
`duplicate`, `no-ci`, `human-ack`. Create with `gh label create <name> -R $OWNER/$REPO`.

Labels are also bait. One maintainer reported two agent PRs within five minutes of
opening an issue labelled `good first issue` (first-hand X report, 2026-09-04). Keep
`good first issue`, `help wanted` and `hacktoberfest` only where that intake is wanted.

PR template provenance fields (pattern from the boltons/glom maintainer, 2026-09-08):
was the bug found in real use; which harness, model and prompt; linked issue; what was
run to verify. These fields cost a human nothing and give the reviewer the one thing an
agent PR body usually lacks.

## §7 Bootstrap check (read-only)

```bash
DEFAULT=$(gh api "repos/$OWNER/$REPO" --jq .default_branch)
gh api "repos/$OWNER/$REPO" --jq '{default_branch,delete_branch_on_merge,allow_auto_merge,allow_update_branch,allow_squash_merge,allow_merge_commit,allow_rebase_merge}'
gh api "repos/$OWNER/$REPO/rulesets" --jq 'map({id,name,target,enforcement})'
gh api "repos/$OWNER/$REPO/branches/$DEFAULT/protection" >/dev/null 2>&1 && echo "classic protection present: convert to ruleset"
gh label list -R "$OWNER/$REPO" --json name --jq 'map(.name)'
ls .github/workflows | grep -i -E 'cleanup|stale|enforce'
```

Fill this before proposing anything:

| Control | Expected | Observed | Delta |
|---|---|---|---|
| Rulesets on `main`/`preview`/`dev` | deletion, non_fast_forward, pull_request, required_status_checks | | |
| Tag ruleset `v*` | deletion, non_fast_forward, update; no bypass | | |
| Classic protection | none | | |
| `delete_branch_on_merge` | true | | |
| `allow_auto_merge` + required checks | true + present | | |
| `allow_update_branch` | true | | |
| Closed-PR cleanup workflow | present, schedule-only | | |
| PR limits | on, drafts exempt | | |
| Labels | §6 set | | |

## §8 Anti-patterns

| Banned | Why | Fix |
|---|---|---|
| Classic protection left beside rulesets | Two sources of truth; ruleset-only rules unavailable | Convert, then delete the classic rule |
| Auto-merge with one approval and no required check | Code lands without CI | Add `required_status_checks` before enabling auto-merge |
| Deploy key with `bypass_mode: always` on a release line | Bypasses deletion and force-push protection | `pull_request` mode, or no bypass |
| `required_signatures` enabled by reflex | Unsigned agent paths silently fail | Check each agent's signing default first |
| Force-push allowed on `main` | Release history rewritable | `non_fast_forward` rule |
| Bait labels on a repository that does not want agent PRs | Agent PRs arrive within minutes | Remove or rename the labels |

## §9 Sources (read 2026-09-09)

- Repository REST fields: https://docs.github.com/en/rest/repos/repos
- Rulesets REST and rule types: https://docs.github.com/en/rest/repos/rules
- Available rules for rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- Merge queue: https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- Auto-delete head branches (merged only): https://github.blog/changelog/2019-07-30-automatically-delete-head-branches-of-pull-requests/ ; closed PR keeps its branch: https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/closing-a-pull-request
- Classic → ruleset migration: https://github.blog/changelog/2026-08-11-automatically-migrate-branch-protection-rules-to-repository-rulesets
- User bypass and branch renaming: https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming
- Required reviewer rule GA: https://github.blog/changelog/2026-02-17-required-reviewer-rule-is-now-generally-available ; restrict review dismissal: https://github.blog/changelog/2026-07-07-restrict-who-can-dismiss-reviews-in-rulesets ; push rule path exceptions: https://github.blog/changelog/2026-08-25-push-rules-in-rulesets-now-support-path-exceptions
- Pull request limits: https://github.blog/open-source/maintainers/how-pull-request-limits-are-cutting-down-the-noise/
- Copilot cloud agent signs commits: https://github.blog/changelog/2026-04-03-copilot-cloud-agent-signs-its-commits
- Bait-label report: https://x.com/sebastienlorber/status/2095806439646224590 ; provenance template: https://x.com/mhashemi/status/2097345740968435952
- Live repository audit and planner: `devlog/_plan/260909_agent_swarm_repo_hygiene/001_research_ledger.md` 2.x
