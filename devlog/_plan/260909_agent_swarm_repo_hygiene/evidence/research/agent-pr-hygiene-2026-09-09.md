# Agent-PR Hygiene Report

**Date:** 2026-09-09
**Scope:** (1) X/Twitter discourse on maintainers handling AI-agent PR floods, (2) `lidge-jun/opencodex` repo PR + ruleset configuration, (3) 2026 GitHub changelog entries on PR/branch/ruleset/agent tooling.
**Mode:** read-only. No repository setting was changed.

---

## 1. X/Twitter: maintainers vs. the AI-agent PR flood

Searched signed-in as `@claudeebum` across both **Latest** and **Top** for: `AI agent PRs maintainers`, `Copilot coding agent PR spam`, `auto-close AI PR`, `agentic PR triage`, `Claude Code PR flood`, `codex PR policy`, plus 15 follow-on queries (`AI slop pull requests maintainer`, `disable pull requests AI open source`, `yt-dlp AI PR label close`, `CODEOWNERS AI agent contributions`, `merge queue AI agents`, `bot account AI PR require issue`, `curl AI slop bug bounty`, `"good first issue" label removed AI PR spam`, etc.). 518 unique posts collected, 87 on-topic, 12 selected below for concreteness of the policy/tooling signal.

### The 12 posts

| # | Author | Date | Gist | Permalink |
|---|---|---|---|---|
| 1 | **@taylorotwell** (Taylor Otwell, Laravel) | 2026-09-03 | Disabled GitHub Issues on most Laravel packages: report a bug by having a coding agent investigate and open a PR instead; the PR itself becomes the bug report. | https://x.com/taylorotwell/status/2095516796748996843 |
| 2 | **@sebastienlorber** (Seb, ThisWeekInReact) | 2026-09-04 | Opened an issue, got 2 AI-generated PRs from random bots within 5 minutes; traced it to the `good first issue` label. | https://x.com/sebastienlorber/status/2095806439646224590 |
| 3 | **@izutorishima** | 2026-09-06 | yt-dlp labels PRs whose prose/code "smells AI" and closes them instantly. | https://x.com/izutorishima/status/2096682561330446635 |
| 4 | **@pushpak1300** (Laravel contributor) | 2026-09-03 | Backs Otwell: an LLM opens a slop issue, someone else's LLM "fixes" it without understanding, maintainers absorb the cost. | https://x.com/pushpak1300/status/2095574277626159465 |
| 5 | **@mhashemi** (Mahmoud Hashemi, boltons/glom) | 2026-09-08 | "So many driveby PRs that contribs by past committers get buried"; added a PR template asking whether the bug came from real use, and which harness/models/prompts were used. | https://x.com/mhashemi/status/2097345740968435952 |
| 6 | **@grok** (replying about an OSS tool) | 2026-08-01 | Describes `agent-pr-gate`: a GitHub Action merge gate for agent PRs, driven by a `gate.json` policy (`evidence_file`, `allowed_paths`, `required_checks`) and wired in as a **required check in branch rulesets**. | https://x.com/grok/status/2083394673473732683 |
| 7 | **@MaxForAI** | 2026-09-06 | "Model PR Gate": a cyber-turnstile for repos that only passes PRs carrying a trusted signed model attestation (Astra / Fable 5.1 by default, allowlist editable). | https://x.com/MaxForAI/status/2096469085324562489 |
| 8 | **@uzairansar** | 2026-09-06 | Shares his `AGENTS.md` PR clause: agent never pushes/opens/merges a PR unbidden; strict `one issue → one issue/<n>-slug branch → one PR` mapping, `chore/`/`fix/` for approved no-issue work. | https://x.com/uzairansar/status/2096671768786198645 |
| 9 | **@myui** | 2026-09-08 | Notes that some AI-native OSS projects (incl. Vercel AI) are now **disabling pull requests entirely**; asks what happens to "community over code". | https://x.com/myui/status/2097166579201130501 |
| 10 | **@sam_commonly** | 2026-09-07 | 205 PRs merged in one week, 2 humans and 33 named agents; what broke first was not code quality but decision provenance ("who decided this and what did they rule out"). | https://x.com/sam_commonly/status/2096918753900650856 |
| 11 | **@timerringX** | 2026-09-06 | Closes PRs outright when the description is pure raw agent output copy-pasted at the maintainer; part of a wider @xuanwo/@leon7hao thread where trust, not authorship, is the merge criterion. | https://x.com/timerringX/status/2096663454350537036 |
| 12 | **@SystemArch_AI** | 2026-09-07 | On Copilot approving PRs (shipped Sep 1): off by default, approval dismisses on new commits like a human's, "decide the policy before the demo". | https://x.com/SystemArch_AI/status/2096919223528300922 |

### Policy / tooling mentioned, aggregated

| Mechanism | Who / where | Notes |
|---|---|---|
| **Disable Issues entirely** | Laravel (Otwell #1, echoed by @apnahive, @rseroter) | Forces bug reports into PR form. Inverts the classic "file an issue first" gate. |
| **Disable Pull Requests entirely** | Vercel AI and other AI-native projects (#9) | The strongest form; contributions move to issues/discussions only. |
| **Remove attractant labels** | @sebastienlorber (#2) | Deleted `good first issue`, `hacktoberfest`, `status: accepting PRs` because bots scrape them. Direct, low-cost, and immediately actionable. |
| **AI-detection label + instant close** | yt-dlp (#3), @timerringX (#11) | Label-then-close on stylistic AI tells in the PR body. |
| **PR template as a provenance form** | @mhashemi (#5) | Asks: was the bug found in real use? which harness, models, prompts? |
| **Required-check merge gate for agent PRs** | `agent-pr-gate` (#6) | `gate.json` with `evidence_file` / `allowed_paths` / `required_checks`, enforced as a **required status check inside a branch ruleset**. This is the ruleset-native pattern. |
| **Signed-model attestation allowlist** | Model PR Gate (#7) | Only PRs with a trusted model signature pass; allowlist is repo-editable. |
| **Agent-side constitution (`AGENTS.md`)** | @uzairansar (#8) | Branch-naming convention + never-push-unbidden + one-issue-one-PR. Prevention at the source rather than triage at the door. |
| **Copilot as an approving reviewer** | GitHub, shipped 2026-09-01 (#12) | Counts toward merge requirements when enabled; auto-dismisses on new commits. @mirajobs' reply flags the obvious risk: a PR can merge with zero human sign-off. |
| **Auto-review / pre-triage bots to unload maintainers** | @_olegpulatov, CodeRabbit, OpenInspect Autofix, Linear autofix loop | Shift review load to bots; OpenInspect has the PR-authoring session pick up its own review comments. |
| **Trust-graph merging (social, not tooling)** | @xuanwo (#11 thread) | Known contributor's PR: read intent, merge. Stranger's PR: full audit. Refusing to communicate outside agent output destroys trust accumulation. |

### Cross-cutting reading

Three distinct camps, and they are not converging:

1. **Restrict the funnel** (yt-dlp, @sebastienlorber, Vercel AI): fewer entry points, faster closes, remove bot bait.
2. **Invert the funnel** (Laravel/Otwell): issues are the noise, PRs at least carry a diff, so demand PRs.
3. **Gate mechanically** (agent-pr-gate, Model PR Gate, ruleset required checks): let the flood in but make evidence, path scope, and model provenance a merge precondition.

The recurring theme across all three is that **the bottleneck moved from code production to attention and provenance**, not to code quality. @sam_commonly (#10) states it most sharply: quality held; auditability broke.

**Prior context worth noting:** the pattern predates 2026 agent PRs. curl shut down its HackerOne bug bounty in January 2026 after AI slop reports hit ~20% of submissions with zero valid AI reports (https://x.com/momika233/status/2014284645106639293, https://x.com/S1r1u5_/status/2013449185807474941). Fedora went the other direction in Oct 2025 with an explicit AI-Assisted Contributions Policy permitting AI assistance (https://x.com/LundukeJournal/status/1981422231470199154).

---

## 2. `lidge-jun/opencodex` repository configuration

Read at https://github.com/lidge-jun/opencodex/settings and `/settings/rules` on 2026-09-09. **Nothing was modified.**

### 2a. Settings → General → Pull Requests

| Setting | State |
|---|---|
| Allow merge commits | **Enabled** |
| Allow squash merging | **Enabled** |
| Allow rebase merging | **Disabled** |
| Always suggest updating pull request branches | **Disabled** |
| Allow auto-merge | **Enabled** |
| Automatically delete head branches | **Enabled** |

Adjacent settings picked up in the same section, relevant to agent hygiene:

- Pull requests feature: enabled; **PR creation allowed by: All users**.
- Require contributors to sign off on web-based commits (DCO): disabled.
- Limit how many branches/tags can be updated in a single push (Preview): disabled.
- Auto-close issues with merged linked pull requests: enabled.

Repo scale at time of reading: **69 open issues, 72 open pull requests**, plus an active **Agents** tab.

### 2b. Settings → Rulesets

Four rulesets, all **Active**.

| Ruleset | Target | Rules | Bypass |
|---|---|---|---|
| **Protect dev** | branch `refs/heads/dev` | Restrict deletions; Block force pushes (non-fast-forward); Require a PR before merging | Maintain role + Repository admin, both "pull requests only" |
| **Protect main** | branch `refs/heads/main` | Restrict deletions; Block force pushes; Require a PR before merging | DeployKey (**always**) + Repository admin (pull requests only) |
| **Protect preview** | branch `refs/heads/preview` | Restrict deletions; Block force pushes; Require a PR before merging | DeployKey (**always**) + Repository admin (pull requests only) |
| **Protect release tags** | tags `refs/tags/v*` (100+ tags) | Restrict deletions; Block force pushes; **Restrict updates** | **None** — nobody can bypass, including the owner |

The three branch rulesets share an identical "Require a pull request before merging" configuration:

- Required approvals: **1**
- Dismiss stale approvals on new commits: **off**
- Require review from specific teams: **off**
- **Require review from Code Owners: ON**
- Require approval of most recent reviewable push: off
- Require conversation resolution before merging: off
- **Require an additional approval for unattributed Copilot pull requests (Preview): ON** — when Copilot opens a PR without a human collaborator, one extra approving review is required
- Allowed merge methods: **Merge, Squash** (matches the repo-level rebase-off setting)

Rules **not** enabled on any branch ruleset: Restrict creations, Restrict updates, Require linear history, Require deployments to succeed, Require signed commits, **Require status checks to pass**, Require code scanning results, Require code quality results, Restrict code coverage, **Automatically request Copilot code review**.

### 2c. Observations against the section-1 findings (no action taken)

- The **unattributed-Copilot-PR extra-approval** rule is already on across dev/main/preview. That is the single most agent-specific control GitHub currently ships, and this repo has it enabled on all three protected branches.
- **`Require status checks to pass` is off on every ruleset.** That is exactly the hook the `agent-pr-gate` / Model PR Gate patterns (§1 #6, #7) rely on. With no required check, a gate workflow's verdict is advisory only.
- **`Automatically request Copilot code review` is off** on all three, while the repo carries 72 open PRs against a one-maintainer review budget.
- **`Always suggest updating pull request branches` is off** while `Allow auto-merge` is on. Auto-merge waits on requirements without a stale-base nudge.
- **`Dismiss stale approvals on new commits` is off** and `Require approval of most recent reviewable push` is off. An approval survives subsequent pushes, which is a wider window than the Copilot-approval behavior described in §1 #12.
- `Automatically delete head branches` is on, which is the right default for agent-generated branch churn.
- `Protect main` and `Protect preview` grant a **DeployKey an "always" bypass**, i.e. it is not limited to pull requests. `Protect dev` does not.

---

## 3. GitHub Changelog: 2026 entries

Retrieved via the month archives `https://github.blog/changelog/2026/MM/` for 01 through 09; each date verified on both the archive listing and the entry page.

| Date | Title | Topic | URL |
|---|---|---|---|
| 2026-08-25 | Push rules in rulesets now support path exceptions | Rulesets | https://github.blog/changelog/2026-08-25-push-rules-in-rulesets-now-support-path-exceptions |
| 2026-08-11 | Automatically migrate branch protection rules to repository rulesets | Rulesets | https://github.blog/changelog/2026-08-11-automatically-migrate-branch-protection-rules-to-repository-rulesets |
| 2026-07-07 | Restrict who can dismiss reviews in rulesets | Rulesets / PR review | https://github.blog/changelog/2026-07-07-restrict-who-can-dismiss-reviews-in-rulesets |
| 2026-05-07 | Repository rulesets: User bypass and branch renaming | Rulesets / branch management | https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming |
| 2026-04-03 | Copilot cloud agent signs its commits | Agent attribution | https://github.blog/changelog/2026-04-03-copilot-cloud-agent-signs-its-commits |
| 2026-02-26 | Enterprise AI Controls & agent control plane now generally available | Agent identities / governance | https://github.blog/changelog/2026-02-26-enterprise-ai-controls-agent-control-plane-now-generally-available |
| 2026-02-17 | Required reviewer rule is now generally available | Rulesets | https://github.blog/changelog/2026-02-17-required-reviewer-rule-is-now-generally-available |
| 2026-01-26 | Introducing the Agents tab in your repository | Agent sessions | https://github.blog/changelog/2026-01-26-introducing-the-agents-tab-in-your-repository |

### One-line summaries

1. **Push rules path exceptions (08-25)** — public preview; "Restrict file paths" and "Restrict file size" push rules gain an **Allowed exceptions** field for path patterns.
2. **Branch protection → ruleset migration (08-11)** — a **Convert to ruleset** button in Settings → Branches maps classic protections (required reviews, status checks, push restrictions) into equivalent ruleset rules.
3. **Restrict review dismissal (07-07)** — GA; inside "Require a pull request before merging" you can name exactly which users, teams, and apps may dismiss PR reviews (UI + REST + GraphQL).
4. **User bypass & branch renaming (05-07)** — individual users can be ruleset bypass actors, and admins can rename ruleset-covered branches when the new name stays in scope of every applicable rule.
5. **Copilot cloud agent signs commits (04-03)** — the agent signs every commit so it shows `Verified`, unblocking it in repos enforcing "Require signed commits".
6. **Enterprise AI Controls / agent control plane GA (02-26)** — `actor_is_agent` audit identifiers, `agent_session.task` events, agent session search across third-party agents, and a 1-click push rule protecting `.github/agents/*.md`.
7. **Required reviewer rule GA (02-17)** — GA of the required-reviewer ruleset rule, now supporting `!` negation patterns to exclude files/folders from a team review requirement.
8. **Agents tab (01-26)** — a repo-level **Agents** tab consolidating Copilot coding agent sessions beside code/PRs/issues, with redesigned session logs, archiving, and "Continue in Copilot CLI".

### Verified 2026 absences (searched, genuinely not there)

- **Branch deletion / stale-branch cleanup: zero 2026 entries.** All results are older ("Automatically delete head branches of pull requests" etc.). Closest 2026 item is branch *renaming* (05-07).
- **Stale pull requests / PR staleness: zero 2026 entries.** Only the Stale Repos Action post and stale *code scanning configurations*.
- **Merge queue: zero 2026 entries.** Everything is 2022–2024 beta/GA-era.
- **Copilot coding agent branch/PR *naming conventions*: zero 2026 entries.** Plenty of 2026 agent PR *behavior* (signed commits 04-03, PR title generation 02-25, Copilot-authored PRs in author search 06-18), but the only 2026 naming-convention entry is for **Dependabot** ("Customize Dependabot pull request branch names", 2026-08-04).
- **"Agents HQ"** does not appear in the changelog; GitHub brands it "Agent HQ" (singular) and it lives under `/news-insights/company-news/`.

Near-misses deliberately excluded: 2026-03-05 "Discover and manage agent activity with new session filters"; 2026-07-16 "Repository admins can archive pull requests" (archiving is admin-initiated, not staleness-driven); the four "Rule insights" dashboard entries (dashboards, not rules).

### Method notes

- Working route: **month archives** `github.blog/changelog/2026/MM/`, the only route giving complete coverage.
- Broken: the main `/changelog/` page collapses months into accordions and only exposes the current one; `?s=` on the changelog path is ignored (`/changelog/?s=ruleset` returns "Nothing to see here... yet!"); `?label=pull-requests` returns the empty state (real slugs are `collaboration-tools`, `platform-governance`, etc.).
- Partially useful: blog-wide `github.blog/?s=<term>` works but is undated and old-post-weighted, so it is only good for confirming absences.

---

## Appendix: what would close the gap

Not applied. Listed only because §1 and §2 line up so directly.

1. Turn on **Require status checks to pass** in the three branch rulesets so an agent-PR gate workflow becomes blocking rather than advisory (§1 #6/#7 depend on this).
2. Turn on **Dismiss stale pull request approvals when new commits are pushed**, given `Allow auto-merge` is on and approvals currently survive later pushes.
3. Consider **Automatically request Copilot code review** as first-pass triage against the 72-PR backlog (§1: @_olegpulatov, CodeRabbit, OpenInspect).
4. Audit labels for bot bait per @sebastienlorber (§1 #2): `good first issue` and similar draw agent PRs within minutes.
5. Narrow the **DeployKey "always" bypass** on `Protect main` / `Protect preview` to pull-requests-only, matching `Protect dev`.
6. Add a provenance PR template per @mhashemi (§1 #5): found in real use? which harness/model/prompt?

---

*Sources: X/Twitter search as `@claudeebum` (518 posts collected, 87 on-topic); github.com/lidge-jun/opencodex settings UI + GitHub REST rulesets API as `lidge-jun`; github.blog changelog 2026 month archives.*
