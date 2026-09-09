# GitHub Settings Audit — lidge-jun repositories

**Date of audit:** 2026-09-09 (Asia/Seoul)
**Signed-in account:** `lidge-jun` (verified via `gh auth status` → "Logged in to github.com account lidge-jun"; token scopes `gist`, `read:org`, `repo`, `user`, `workflow`)
**Scope:** `lidge-jun/opencodex`, `lidge-jun/codexclaw`, `lidge-jun/cli-jaw`, `lidge-jun/ima2-gen`
**Mode:** READ-ONLY. No setting was changed, no checkbox toggled, no form saved. Where a collapsed "Show additional settings" disclosure had to be expanded to read nested values, only the disclosure was toggled (a client-side visibility control) and **no Save button was ever pressed**.

**Method / evidence basis:** Every page listed below was opened in the signed-in browser and read from the live accessibility tree, so all quoted wording is verbatim UI text. Each value was additionally cross-checked against the REST API (`gh api`) as an independent second source. **Page and API agreed on every single field across all four repositories** — no discrepancies found.

---

## 0. Executive summary

| Repo | Merge / Squash / Rebase | Auto-merge | Delete head branches | Rulesets | Classic protection | Labels | Open PRs | Open issues |
|---|---|---|---|---|---|---|---|---|
| opencodex | ✅ / ✅ / ❌ | ✅ | ✅ | 4 (all Active) | none | 36 | 72 | 69 |
| codexclaw | ✅ / ✅ / ✅ | ❌ | ❌ | 2 (all Active) | none | 11 | 1 | 0 |
| cli-jaw | ✅ / ✅ / ✅ | ❌ | ✅ | 0 | 1 (`main`) | 33 | 0 | 1 |
| ima2-gen | ✅ / ✅ / ✅ | ❌ | ✅ | 1 (Active) | none | 23 | 1 | 1 |

Notable findings are collected in §7.

---

## 1. General → Pull Requests section

Page header wording is identical on all four repos:

> "When merging pull requests, you can allow any combination of merge commits, squashing, or rebasing. At least one option must be enabled. If you have linear history requirement enabled on any protected branch, you must enable squashing or rebasing."

### 1.1 `lidge-jun/opencodex` — https://github.com/lidge-jun/opencodex/settings

| Setting | State | Verbatim UI description |
|---|---|---|
| Allow merge commits | **CHECKED** | "Add all commits from the head branch to the base branch with a merge commit." |
| → Default commit message | **"Default message"** | "Presented when merging a pull request with merge." |
| Allow squash merging | **CHECKED** | "Combine all commits from the head branch into a single commit in the base branch." |
| → Default commit message | **"Default message"** | "Presented when merging a pull request with squash." |
| Allow rebase merging | **UNCHECKED** | "Add all commits from the head branch onto the base branch individually." |
| Always suggest updating pull request branches | **UNCHECKED** | "Whenever there are new changes available in the base branch, present an “update branch” option in the pull request." |
| Allow auto-merge | **CHECKED** | "Waits for merge requirements to be met and then merges automatically." |
| Automatically delete head branches | **CHECKED** | "Deleted branches will still be able to be restored." |

API cross-check: `allow_merge_commit: true`, `allow_squash_merge: true`, `allow_rebase_merge: false`, `allow_update_branch: false`, `allow_auto_merge: true`, `delete_branch_on_merge: true`.

**Note on the "Default message" button label.** The button renders the same visible label "Default message" for both merge and squash, but the underlying API values differ and are *not* both plain defaults:
- merge commit: `merge_commit_title: "MERGE_MESSAGE"`, `merge_commit_message: "PR_TITLE"`
- squash: `squash_merge_commit_title: "COMMIT_OR_PR_TITLE"`, `squash_merge_commit_message: "COMMIT_MESSAGES"`

This same pattern (identical "Default message" button label, identical API values) holds on all four repos, so the four repos are configured identically on commit-message defaults.

### 1.2 `lidge-jun/codexclaw` — https://github.com/lidge-jun/codexclaw/settings

| Setting | State |
|---|---|
| Allow merge commits | **CHECKED** |
| → Default commit message | "Default message" (`MERGE_MESSAGE` / `PR_TITLE`) |
| Allow squash merging | **CHECKED** |
| → Default commit message | "Default message" (`COMMIT_OR_PR_TITLE` / `COMMIT_MESSAGES`) |
| Allow rebase merging | **CHECKED** |
| Always suggest updating pull request branches | **UNCHECKED** |
| Allow auto-merge | **UNCHECKED** |
| Automatically delete head branches | **UNCHECKED** |

API cross-check: `allow_rebase_merge: true`, `allow_auto_merge: false`, `delete_branch_on_merge: false`, `allow_update_branch: false`.

### 1.3 `lidge-jun/cli-jaw` — https://github.com/lidge-jun/cli-jaw/settings

| Setting | State |
|---|---|
| Allow merge commits | **CHECKED** |
| → Default commit message | "Default message" (`MERGE_MESSAGE` / `PR_TITLE`) |
| Allow squash merging | **CHECKED** |
| → Default commit message | "Default message" (`COMMIT_OR_PR_TITLE` / `COMMIT_MESSAGES`) |
| Allow rebase merging | **CHECKED** |
| Always suggest updating pull request branches | **UNCHECKED** |
| Allow auto-merge | **UNCHECKED** |
| Automatically delete head branches | **CHECKED** |

API cross-check: `allow_rebase_merge: true`, `allow_auto_merge: false`, `delete_branch_on_merge: true`, `allow_update_branch: false`.

### 1.4 `lidge-jun/ima2-gen` — https://github.com/lidge-jun/ima2-gen/settings

| Setting | State |
|---|---|
| Allow merge commits | **CHECKED** |
| → Default commit message | "Default message" (`MERGE_MESSAGE` / `PR_TITLE`) |
| Allow squash merging | **CHECKED** |
| → Default commit message | "Default message" (`COMMIT_OR_PR_TITLE` / `COMMIT_MESSAGES`) |
| Allow rebase merging | **CHECKED** |
| Always suggest updating pull request branches | **UNCHECKED** |
| Allow auto-merge | **UNCHECKED** |
| Automatically delete head branches | **CHECKED** |

API cross-check: `allow_rebase_merge: true`, `allow_auto_merge: false`, `delete_branch_on_merge: true`, `allow_update_branch: false`.

**Cross-repo observation:** "Always suggest updating pull request branches" is **UNCHECKED on all four repos**. opencodex is the only repo with auto-merge enabled, and the only one with rebase merging disabled.

---

## 2. Rulesets (`/settings/rules`)

### 2.1 opencodex — 4 rulesets, all Active

List page (https://github.com/lidge-jun/opencodex/settings/rules) shows:
- "Protect dev" — Active — "3 branch rules • targeting 1 branch"
- "Protect main" — Active — "3 branch rules • targeting 1 branch"
- "Protect preview" — Active — "3 branch rules • targeting 1 branch"
- "Protect release tags" — Active — "3 tag rules • targeting 100+ tags"

#### 2.1.1 "Protect dev" (id 20763889)
- **Target:** branch
- **Targeted refs:** include `refs/heads/dev`; exclude: none. Page: "Applies to 1 target: dev."
- **Enforcement:** Active
- **Bypass list (2 actors):**
  - "Maintain — Roles — Allow for pull requests only"
  - "Repository admin — Roles — Allow for pull requests only"
  - (Signed-in user's effective bypass: `pull_requests_only`)
- **Enabled rules:**
  - ✅ **Restrict deletions** — "Only allow users with bypass permissions to delete matching refs."
  - ✅ **Require a pull request before merging** — "Require all commits be made to a non-target branch and submitted via a pull request before they can be merged."
    - Required approvals: **1**
    - Dismiss stale pull request approvals when new commits are pushed: **UNCHECKED**
    - Require review from specific teams: **UNCHECKED**
    - Require review from Code Owners: **CHECKED**
    - Require approval of the most recent reviewable push: **UNCHECKED**
    - Require conversation resolution before merging: **UNCHECKED**
    - Require an additional approval for unattributed Copilot pull requests (Preview): **CHECKED**
    - Allowed merge methods: **"Merge, Squash"** (rebase excluded)
  - ✅ **Block force pushes** — "Prevent users with push access from force pushing to refs."
- **Not enabled:** Restrict creations, Restrict updates, Require linear history, Require deployments to succeed, Require signed commits, Require status checks to pass, Require code scanning results, Require code quality results, Restrict code coverage, Automatically request Copilot code review
- **Merge queue:** not enabled (no merge queue rule present)

*(Last updated 2026-09-06 per API — the most recently touched opencodex ruleset.)*

#### 2.1.2 "Protect main" (id 20764415)
- **Target:** branch
- **Targeted refs:** include `refs/heads/main`. Page: "Applies to 1 target: main."
- **Enforcement:** Active
- **Bypass list (2 actors) — DIFFERENT from Protect dev:**
  - **"Deploy keys — Other — Always allow"** ← unconditional bypass, not PR-scoped
  - "Repository admin — Roles — Allow for pull requests only"
  - (Maintain role is **not** on main's bypass list, unlike dev)
- **Enabled rules:** identical rule set to Protect dev —
  - ✅ Restrict deletions
  - ✅ Require a pull request before merging (required approvals **1**; Require review from Code Owners **CHECKED**; extra approval for unattributed Copilot PRs **CHECKED**; allowed merge methods **Merge, Squash**; dismiss-stale / last-push-approval / conversation-resolution / specific-teams all off)
  - ✅ Block force pushes
- **Not enabled:** linear history, signed commits, status checks, restrict creations/updates, deployments, code scanning/quality/coverage, Copilot auto-review
- **Merge queue:** not enabled

#### 2.1.3 "Protect preview" (id 20764486)
- **Target:** branch
- **Targeted refs:** include `refs/heads/preview`. Page: "Applies to 1 target: preview."
- **Enforcement:** Active
- **Bypass list (2 actors):**
  - **"Deploy keys — Other — Always allow"**
  - "Repository admin — Roles — Allow for pull requests only"
- **Enabled rules:** ✅ Restrict deletions, ✅ Require a pull request before merging (approvals **1**, Code Owners **CHECKED**, unattributed-Copilot extra approval **CHECKED**, merge methods **Merge, Squash**), ✅ Block force pushes
- **Not enabled:** linear history, signed commits, status checks, restrict creations/updates, deployments, code scanning/quality/coverage, Copilot auto-review
- **Merge queue:** not enabled

#### 2.1.4 "Protect release tags" (id 20769150)
- **Target:** **tag**
- **Targeted refs:** include `refs/tags/v*`. Page: "Applies to 100+ targets including v2.48.0, v2.48.0-preview.20260908, v2.47.0, v2.47.0-preview.20260908, v2.46.0, v2.46.0-preview.20260907, v2.45.0, v2.45.0-preview.20260907, v2.44.0, v2.44.0-preview.20260907 and others."
- **Enforcement:** Active
- **Bypass list:** **"Bypass list is empty"** (verbatim page heading). Effective bypass for signed-in user: `never`.
- **Enabled rules:**
  - ✅ **Restrict updates** — "Only allow users with bypass permission to update matching refs."
  - ✅ **Restrict deletions**
  - ✅ **Block force pushes**
- **Require PR / approvals / status checks / linear history / signed commits / merge queue:** none (not applicable to tag rulesets in this config)

### 2.2 codexclaw — 2 rulesets, all Active

List page shows:
- "protect-main" — Active — "3 branch rules • targeting 1 branch"
- "protect-release-tags" — Active — "3 tag rules • targeting 25 tags"

#### 2.2.1 "protect-main" (id 20884837)
- **Target:** branch
- **Targeted refs:** include `refs/heads/main`. Page: "Applies to 1 target: main."
- **Enforcement:** Active
- **Bypass list:** **"Bypass list is empty"**. Effective bypass for signed-in user: `never` — i.e. **the owner cannot bypass this ruleset.**
- **Enabled rules:**
  - ✅ **Restrict deletions**
  - ✅ **Require status checks to pass** — "Choose which status checks must pass before the ref is updated. When enabled, commits must first be pushed to another ref where the checks pass."
    - Require branches to be up to date before merging: **UNCHECKED**
    - Do not require status checks on creation: **CHECKED** ("Allow repositories and branches to be created if a check would otherwise prohibit it.")
    - **Required status checks (9, all source "GitHub Actions"):**
      1. `test (ubuntu-latest, false)`
      2. `test (windows-latest, false)`
      3. `test (macos-latest, false)`
      4. `test (windows-latest, true)`
      5. `artifact (ubuntu-latest)`
      6. `artifact (windows-latest)`
      7. `artifact (macos-latest)`
      8. `install (ubuntu-latest)`
      9. `install (macos-latest)`
  - ✅ **Block force pushes**
- **Require a pull request before merging: NOT ENABLED** — required approvals therefore not applicable.
- **Not enabled:** require PR, linear history, signed commits, restrict creations/updates, deployments, code scanning/quality/coverage, Copilot auto-review
- **Merge queue:** not enabled

#### 2.2.2 "protect-release-tags" (id 20884836)
- **Target:** **tag**
- **Targeted refs:** include `refs/tags/v*`. Page: "Applies to 25 targets including v0.2.24, v0.2.23, v0.2.22, v0.2.21, v0.2.20, v0.2.19, v0.2.18, v0.2.17, v0.2.16, v0.2.13 and others."
- **Enforcement:** Active
- **Bypass list:** **"Bypass list is empty"**
- **Enabled rules:** ✅ Restrict updates, ✅ Restrict deletions, ✅ Block force pushes
- **Merge queue / PR / approvals / status checks / linear history / signed commits:** none

### 2.3 cli-jaw — 0 rulesets

https://github.com/lidge-jun/cli-jaw/settings/rules renders the empty state, verbatim:

> "You haven't created any rulesets"
> "Define whether collaborators can delete or force push and set requirements for any pushes, such as passing status checks or a linear commit history."

API confirms: `[]`. All protection on this repo is via a **classic** rule (see §3).

### 2.4 ima2-gen — 1 ruleset, Active

List page shows: "Preserve main preview dev" — Active — "1 branch rule • targeting 3 branches"

#### 2.4.1 "Preserve main preview dev" (id 22470316)
- **Target:** branch
- **Targeted refs:** include `refs/heads/main`, `refs/heads/preview`, `refs/heads/dev`; exclude: none. Page: "Applies to 3 targets including dev, main, and preview."
- **Enforcement:** Active
- **Bypass list:** **"Bypass list is empty"**
- **Enabled rules:**
  - ✅ **Restrict deletions** — this is the **only** rule enabled.
- **Not enabled:** require PR (and therefore no required approvals), required status checks, require linear history, **block force pushes**, require signed commits, restrict creations, restrict updates, deployments, code scanning/quality/coverage, Copilot auto-review
- **Merge queue:** not enabled

*(Created and last updated 2026-09-08 per API — the newest ruleset in the set.)*

---

## 3. Classic branch protection (`/settings/branches`)

### 3.1 opencodex — none
Verbatim page text: **"Classic branch protections have not been configured"**. API `branches?protected` returns no protected branches. All protection is ruleset-based.

### 3.2 codexclaw — none
Verbatim: **"Classic branch protections have not been configured"**.
Note: the branch listing API reports `main` as `protected: true`, but `GET /branches/main/protection` returns **404 "Branch not protected"** — the `protected` flag reflects the *ruleset*, not a classic rule. No classic rule exists.

### 3.3 cli-jaw — **1 remaining classic rule** ⚠️
The page lists one rule under "Branch protection rules":
- Pattern **`main`** — "Currently applies to 1 branch", with a **"Convert to ruleset"** button offered.

Rule detail (https://github.com/lidge-jun/cli-jaw/settings/branch_protection_rules/81762763):

| Option | State |
|---|---|
| Branch name pattern | **`main`** ("Applies to 1 branch: main") |
| Require a pull request before merging | **UNCHECKED** |
| Require status checks to pass before merging | **CHECKED** |
| → Require branches to be up to date before merging | **UNCHECKED** |
| → Status checks that are required | **`ci-aggregate`** (source: GitHub Actions) |
| Require conversation resolution before merging | **UNCHECKED** |
| Require signed commits | **UNCHECKED** |
| Require linear history | **UNCHECKED** |
| Require deployments to succeed before merging | **UNCHECKED** |
| Lock branch | **UNCHECKED** |
| Do not allow bypassing the above settings | **UNCHECKED** |
| Allow force pushes | **UNCHECKED** (force pushes blocked) |
| Allow deletions | **UNCHECKED** (deletions blocked) |

API cross-check: `required_status_checks.strict: false`, `contexts: ["ci-aggregate"]`, `enforce_admins.enabled: false`, `required_signatures.enabled: false`, `required_linear_history.enabled: false`, `allow_force_pushes.enabled: false`, `allow_deletions.enabled: false`, `required_conversation_resolution.enabled: false`, `lock_branch.enabled: false`.

The banner on the edit page reads: "Rulesets are the recommended replacement for classic branch protections. They support rule layering, evaluate mode, and organization-wide policies."

### 3.4 ima2-gen — none
Verbatim: **"Classic branch protections have not been configured"**.
Note: `dev`, `main`, and `preview` are reported `protected: true` in the branch listing, but `/protection` returns **404 "Branch not protected"** for each — again the ruleset, not a classic rule.

---

## 4. Labels (`/labels`)

Counts below are the page's own "N labels" heading, and each list was scraped from the rendered page (including page 2 where present). All four match the API exactly.

### 4.1 opencodex — page heading "36 labels" (Active (36) / Archived (0)); 2 pages
```
account-pool, attribution-approved, bug, catalog, chore, cli,
dependency-change-approved, documentation, dont-merge, duplicate, enhancement,
generated-change-approved, gui, gui-screenshot-waived, help wanted, install,
intake: hygiene-blocked, invalid, landed-via-maintainer, maintainer-sponsored,
needs-design, needs-info, platform, provider, provider-compatibility, proxy,
review-ready, roadmap, service, stale, streaming, suppression-approved,
test-exception-approved, tools, upstream-tracking, wontfix
```

### 4.2 codexclaw — page heading "11 labels" (Active (11) / Archived (0)); 1 page
```
bug, documentation, duplicate, enhancement, good first issue, help wanted,
invalid, mlb-1.0, question, roadmap, wontfix
```
(`mlb-1.0` description: "MLB 1.0 native-thin harness target"; `roadmap`: "Multi-issue product roadmap". The rest are GitHub's stock label descriptions.)

### 4.3 cli-jaw — page heading "33 labels"; 2 pages
```
area:browser, area:docs, area:messaging, area:multi-instance, area:orchestrator,
area:telegram, area:tui, area:web-ui, bug, ci, documentation, duplicate,
enhancement, fin, good first issue, help wanted, i18n, in progress, in-progress,
installer, invalid, needs-repro, priority:P0, priority:P1, priority:P2,
priority:P3, qa, question, runtime, security, service, windows, wontfix
```
⚠️ Contains a **near-duplicate pair**: `in progress` (space) and `in-progress` (hyphen).

### 4.4 ima2-gen — page heading "23 labels"; 1 page
```
area: canvas, area: gallery, area: mobile, area: settings, area: typescript, bug,
dependencies, documentation, duplicate, enhancement, github_actions,
good first issue, help wanted, invalid, javascript, needs: design, priority: p0,
priority: p1, priority: p2, question, status: split, type: ux, wontfix
```

**Naming-convention drift across repos:** cli-jaw uses colon-no-space + uppercase (`area:browser`, `priority:P0`), ima2-gen uses colon-plus-space + lowercase (`area: canvas`, `priority: p0`), and opencodex mostly uses bare hyphenated names with one colon exception (`intake: hygiene-blocked`).

---

## 5. Open pull requests and issues

Counts taken from the live pages on 2026-09-09 and cross-checked with the search API.

| Repo | `/pulls?q=is:open` | `/issues?q=is:open` (as displayed) | True open **issues** (`is:open is:issue`) |
|---|---|---|---|
| opencodex | **72 Open** | "Open (141)" | **69** |
| codexclaw | **1 Open** | "Open (1)" | **0** |
| cli-jaw | **0 Open** | "Open (1)" | **1** |
| ima2-gen | **1 Open** | "Open (2)" | **1** |

⚠️ **Important caveat on `/issues?q=is:open`.** The literal query you asked for (`is:open` with no type qualifier) is run through GitHub's new unified issues/search experience, which **counts pull requests as well as issues**. On opencodex it reports "Open (141)", which is 72 PRs + 69 issues. Adding `is:issue` gives the true open-issue count. Both numbers are reported above so nothing is hidden. (The repo nav tab independently showed "Issues (69)" and "Pull requests (72)" for opencodex, corroborating the split.)

### 5.1 opencodex — 72 open PRs

- **Drafts: 56 of 72** (78%). Non-draft/ready: 16.
- **Bot accounts: 0.** No open PR is authored by an account of GitHub type `Bot`, and no author login contains "bot" (checked across all four repos — zero everywhere). All 72 are `type: "User"`.
- **Branch-name keyword matches (open PRs):**
  - contains `codex` (case-insensitive): **23**, of which **19 are drafts**
  - contains `copilot`: **1** — `feat/github-copilot-context-tier-dev` (#3282, author `Simon-Opopeee`, draft)
  - contains `claude`: **0**
  - **union of codex/copilot/claude: 24 branches, 20 of them drafts**
- **Additional agent-style pattern not in your keyword list:** **13** open PRs use an `agent/…` branch prefix (e.g. `agent/effort-cap-validation-20260909`), 6 of which are drafts. All 13 are authored by the single account `luvs01`. These are human-account PRs with machine-style dated branch names, so they do not show up under a bot-account or `codex`/`copilot`/`claude` filter, but they look like the same automated pipeline and are worth counting.
- **Top authors of open PRs:** `luvs01` (13), `yansigit` (9), `cb8010d6` (5), `harryzhou2000` (4), `x3M3x` (3), `y2ambition-ai` (2), `omarjson` (2), `lidge-jun` (2), `chilung-cgu` (2), `Ingwannu` (2), remainder 1 each.
- **The two `lidge-jun`-authored open PRs are #3914 `sponsors/orcarouter` and #3915 `sponsors/packycode`** — both non-draft, still open.
- Closed PRs on this repo: **2,900**.

Full open-PR branch list with author and draft state (number / draft / author / head ref):

```
4044 draft  x3M3x            codex/combo-sidecar-image-advertising
4043 draft  luvs01           agent/effort-cap-validation-20260909
4042 draft  Vocllum          feat/usage-ledger-retention-v2
4041 draft  luvs01           agent/idle-deadline-reset-fixture-20260908
4040 ready  cb8010d6         feat/decode-throughput-metric
4039 ready  luvs01           agent/toml-overlapping-terminator-20260908
4036 draft  luvs01           agent/port-reclaim-verifier-rejection-20260908
4034 ready  luvs01           agent/v1-delegation-guidance-20260908
4033 draft  harryzhou2000    feat/usage-api-list-price
4025 draft  luvs01           agent/main-hard-lock-startup-20260908
4022 draft  rmsff            feat/guardrails-refresh-248
4020 draft  alexalok         alex/account-auto-switch-main
4018 draft  cb8010d6         feat/decode-tokps
4016 draft  omarjson         fix/muse-spark-free-wire
4015 ready  luvs01           agent/retained-stdio-owner-20260908
4014 ready  luvs01           agent/prompt-probe-close-barrier-20260908
4012 ready  luvs01           agent/native-probe-timeout-proof-20260908
4008 draft  cb8010d6         fix/preserve-spark-quota-windows
4006 draft  luvs01           agent/journal-hashless-restore-20260908
4004 ready  luvs01           agent/client-transaction-child-bound-20260908
3997 draft  luvs01           agent/caller-main-cooldown-fallback-20260908
3987 ready  cb8010d6         feat/codex-client-compaction-v2
3984 draft  yansigit         codex/upstream-model-feedback-20260908
3983 draft  yansigit         codex/upstream-stream-diagnostics-20260908
3982 draft  yansigit         codex/upstream-usage-accessibility-20260908
3981 draft  yansigit         codex/upstream-catalog-invalidation-20260908
3980 draft  yansigit         codex/upstream-cli-stale-port-20260908
3979 draft  yansigit         codex/upstream-web-search-terminal-20260908
3964 ready  ildunari         fix/muse-spark-meta-web-search-strip
3963 draft  luvs01           agent/dashboard-capture-retention-20260908
3954 ready  omarjson         fix/opencode-free-session-id
3952 draft  yxr1995-maker    openai-chat-compat
3920 draft  cb8010d6         fix/repair-ocx1-native-history
3915 ready  lidge-jun        sponsors/packycode
3914 ready  lidge-jun        sponsors/orcarouter
3901 draft  jingzxy          codex/provider-proxy-phase1-ready
3897 draft  parkjs101        codex/router-selection-capture
3863 ready  x3M3x            codex/fix-combo-archive-terra
3848 draft  shaun0927        fix/codex-quota-registration-3846
3833 draft  rrmlima          feat/command-code-client-integration
3810 draft  waxiangzi        dev-go
3748 ready  yansigit         codex/upstream-local-telemetry-ledger
3742 ready  yansigit         codex/upstream-cursor-pool-kernel
3741 draft  yansigit         codex/upstream-provider-tls-profile
3738 draft  y2ambition-ai    feat/codex-strict-quota-switch
3709 draft  sbrusse-git      codex/account-priority-recheck
3663 draft  y2ambition-ai    feat/codex-context-history
3652 draft  itismyfield      feat/drop-codex-safety-buffering-headers
3648 draft  Muki182          windows-perf-cred-fix-candidate
3639 draft  chrisoro         entraid
3463 draft  drakonkat        feat/request-transforms
3458 draft  Ingwannu         improved-remote-control
3389 draft  Yum-wu           feat/zero-output-midstream-refetch-dev
3283 draft  vanch007         feat/google-antigravity-pool-and-gemini-3.8
3282 draft  Simon-Opopeee    feat/github-copilot-context-tier-dev
3080 draft  x3M3x            codex/dashboard-session-persistence
3025 draft  randomix777      feature/manager-ui
2921 draft  Warexpor         feat/outbound-socks5
2881 draft  wonny-log        codex/reset-window-account-pool
2805 ready  Ingwannu         ingw/type-safety-registry-modularization
2562 draft  roy6732856       feat/google-antigravity-pool-clean
2527 draft  harryzhou2000    feat/auto-review-model-override
2462 draft  kwannz           codex/newapi-console
2366 draft  chilung-cgu      feat/issue-1217-stream-timeline-and-failure-attribution
2362 draft  chilung-cgu      fix/issue-1809-custom-provider-responses-terminal-repair
2355 draft  harryzhou2000    feat/config-divergence-warning
2351 draft  harryzhou2000    feat/config-mutation-audit
2280 draft  cristph          feat/model-scoped-synthetic-max
2244 draft  ZSN12            feat/workbuddy-provider
2230 draft  ppvia            feat/gemini-oauth-accounts
2213 draft  louis-tepe       codex/grok-direct-first
1645 draft  waw4303          pr/vision-chat-sidecar
```

### 5.2 codexclaw — 1 open PR, 0 open issues
- #91 — author `thisisjun786` (User) — branch `fix/executor-role-registration` — **not a draft**
- Drafts: **0**. Bot authors: **0**. codex/copilot/claude in branch name: **0**.
- The "Open (1)" shown on `/issues?q=is:open` is this pull request; there are **zero** true open issues.

### 5.3 cli-jaw — 0 open PRs, 1 open issue
- Open PRs: **0** (so drafts 0, bots 0, keyword matches 0).
- Open issues: **1**.

### 5.4 ima2-gen — 1 open PR, 1 open issue
- #229 — author `datell1357` (User) — branch `feat/gpt6-astra-defaults` — **not a draft**
- Drafts: **0**. Bot authors: **0**. codex/copilot/claude in branch name: **0**.
- `/issues?q=is:open` shows "Open (2)" = 1 PR + 1 issue.

---

## 6. UNVERIFIED items

**None.** Every page named in the request was opened successfully in the signed-in browser and read directly:

- 4× `/settings` (General → Pull Requests) ✅
- 4× `/settings/rules` ✅ and 7× individual ruleset detail pages ✅ (opencodex 4, codexclaw 2, ima2-gen 1; cli-jaw has zero rulesets and its empty state was read)
- 1× classic branch protection detail page (cli-jaw `main`) ✅, plus 4× `/settings/branches` ✅
- 4× `/labels` (incl. page 2 for opencodex and cli-jaw) ✅
- 4× `/pulls?q=is:open` and 4× `/issues?q=is:open` ✅

Two points of interpretation rather than non-verification:
1. The "Default commit message" buttons render a single visible label ("Default message") without exposing the underlying enum in the accessibility tree; the precise enum values were read from the API and are reported in §1.
2. `/issues?q=is:open` counts PRs too (see §5); both the literal displayed number and the PR-excluded number are reported.

---

## 7. Observations worth acting on (no changes made)

1. **cli-jaw is the only repo still on classic branch protection**, and GitHub is actively offering "Convert to ruleset" on that rule. It is also the only repo with **no rulesets at all**, so if that classic rule is ever deleted, `main` becomes completely unprotected.
2. **cli-jaw's classic rule does not require a pull request.** It requires the `ci-aggregate` status check and blocks force pushes/deletions, but direct pushes to `main` that pass CI are allowed.
3. **ima2-gen is by far the weakest protected.** Its single ruleset enables **only "Restrict deletions"** across `main`, `preview`, and `dev` — no required PR, no required approvals, **no block-force-pushes**, no status checks. Force-pushing `main` is currently permitted.
4. **codexclaw's `protect-main` requires 9 status checks but does not require a pull request.** Combined with an empty bypass list, this means nobody (including the owner) can bypass the checks, but changes can still land on `main` without review.
5. **opencodex `Protect main` and `Protect preview` grant "Deploy keys — Always allow"** — an unconditional bypass of restrict-deletions, require-PR, and block-force-pushes for any deploy key on the repo. `Protect dev` does not have this; it uses PR-scoped bypasses only. If a deploy key with write access exists, that is the widest hole in the opencodex configuration and worth reviewing.
6. **opencodex `Protect dev` additionally grants the Maintain role a PR-scoped bypass** that `Protect main` does not. dev is therefore slightly more permissive on actors while main is more permissive on deploy keys.
7. **No repo requires signed commits, and no repo requires linear history.** No repo uses a merge queue.
8. **No repo enables required status checks on opencodex branches** — the three opencodex branch rulesets rely on review (1 approval + Code Owners) with no CI gate at the ruleset level.
9. **opencodex allows auto-merge while requiring only 1 approval and no status checks** on protected branches. Auto-merge plus a single approval and no CI gate is a fast path to landing code; worth confirming this is intended.
10. **opencodex has 56 draft PRs out of 72 open** — a large standing backlog, dominated by two accounts (`luvs01` 13, `yansigit` 9) using dated machine-style branch names.
11. **cli-jaw has both `in progress` and `in-progress` labels**, which will fragment filtering.
12. **`Always suggest updating pull request branches` is off everywhere**, and `Require branches to be up to date before merging` is off in both codexclaw's ruleset and cli-jaw's classic rule — so a PR can merge green against a stale base on every repo.
13. **opencodex is the only repo with rebase merging disabled**; the other three allow all three merge methods. opencodex's rulesets additionally restrict allowed merge methods to "Merge, Squash", consistent with that.
14. **Head-branch cleanup is inconsistent:** codexclaw is the only repo with "Automatically delete head branches" off.
