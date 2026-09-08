# Agent PR Intake — Identity, Draft-First, Supersede, Policy Strengths

Last reviewed: 2026-09-09
Applies to: GitHub repositories receiving pull requests or issues from coding agents — Copilot cloud agent, Codex cloud, Claude Code GitHub Actions, and human-driven agent sessions pushing from a personal account
When to read: Many agent PRs or issues; designing or auditing an intake policy; a superseded or duplicate PR; deciding what to auto-close
Canonical owner: dev-devops §2.9 (`DEVOPS-AGENT-INTAKE-01`)

---

## §0 The scarce resource is review

Three projects that took the flood seriously state the same economics. LLVM: "a
contribution should be worth more to the project than the time it takes to review
it." OpenSSL: "Review, not authorship, is the scarce resource in this project."
dotnet/runtime after ten months with Copilot coding agent: "One person with good
judgment and a phone can generate PRs faster than a team can review them." Ghostty
names the mechanism: agentic programming "eliminated the natural effort-based
backpressure." A policy therefore prices reviewer attention; it does not police who
typed the code.

Volume looks different from what a bot filter expects. On lidge-jun/opencodex on
2026-09-09, 0 of 72 open PRs were authored by a bot account, while 37 carried
machine-style branch names (24 in the `codex/`, `copilot/`, `claude/` family plus 13
`agent/<slug>-<date>`) pushed from human accounts, and 56 were drafts.

## §1 Identity tiers (`DEVOPS-AGENT-IDENTITY-01`, DEFAULT)

Declare in CONTRIBUTING which tier the repository observes; enforce only what it can see.

| Tier | Signal | Reliability | Notes |
|---|---|---|---|
| 0 | Human account, machine-style branch prefix (`codex/`, `agent/`, `claude/`, `copilot/`) | Heuristic only | Codex cloud's prefix is a user setting (`codex/{feature}`); a ruleset keyed on it can be defeated by changing the setting |
| 1 | Commit trailer: `Assisted-by: <agent>:<model>` or `Co-authored-by:` | Contested | OpenSSL mandates `Assisted-by`; Linux kernel, Fedora and LLVM recommend it; Kubernetes bans trailers and wants PR-description prose; Crossplane discourages attribution trailers as statistics pollution. Pick the form your upstreams accept |
| 2 | Bot or App identity (`copilot-swe-agent[bot]`; `claude[bot]`, the Claude action's default `bot_name` input; a custom App) plus `actor_is_agent` in audit logs (enterprise agent control plane, GA 2026-02-26) | Strong | Only tier that a ruleset or a required check can key on safely |

Agent conventions as documented on 2026-09-09:

| | Copilot cloud agent | Codex cloud | Claude Code GitHub Actions |
|---|---|---|---|
| Branch prefix | `copilot/` (fixed) | `codex/{feature}` (user setting; `{date}`, `{time}` tags) | `claude/` (`branch_prefix` input) |
| Opens the PR? | Yes, as **draft** | User clicks "Create Pull Request" (draft default unverified) | No — pushes a branch, returns a prefilled PR link |
| Can mark ready / approve / merge? | No; requester's approval does not count | n/a | n/a |
| Commit author | Copilot; human as co-author; **signed** by default (2026-04-03) | unverified | `claude[bot]` or the token owner; signing opt-in (`use_commit_signing`) |
| Workflow gate | "Approve and run workflows" required by default; admin toggle "Require approval for workflow runs" with a documented secret-exposure warning | n/a | `GITHUB_TOKEN` pushes do not trigger workflows; use the Claude App or a custom App token |
| Instruction files | `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md`, `AGENTS.md`, `CLAUDE.md` | `AGENTS.override.md` → `AGENTS.md`, root-down, 32 KiB cap | `CLAUDE.md` from the base branch; `AGENTS.md` unsupported |

Cells marked unverified come from the ledger; do not tighten them without a source.

## §2 Draft-first (`DEVOPS-DRAFT-FIRST-01`, DEFAULT)

Agent PRs open as drafts; a human, or a gate check, marks them ready. Copilot cloud
agent already behaves this way and cannot mark its own PR ready. GitHub's pull request
limits exempt drafts from the per-user cap, so draft-first is also the cheapest way for
an agent to stay under the cap while work is in progress (`repo-bootstrap.md` §5).

Keep the workflow-approval gate on. GitHub's own warning on the admin toggle: allowing
workflows to run without approval "may allow unreviewed code written by Copilot to gain
write access to your repository or access your GitHub Actions secrets."

## §3 Supersede procedure (`DEVOPS-PR-SUPERSEDE-01`, STRICT)

1. Classify each candidate as LIVE, PARTIAL or SUPERSEDED from implementation evidence
   — what the replacement actually lands — never from age or file overlap.
2. Carry credit into the replacement: `Co-authored-by:` trailer or a CREDITS entry
   naming the original author and PR.
3. Comment on the superseded PR: the replacement PR number, what was carried, what was
   dropped and why.
4. Label `superseded`, then close. Keep PARTIAL work open with a `needs-info` or a
   focused replacement request instead of closing it.
5. The closed head branch is now a candidate for the closed-PR cleanup job and is
   protected by keep rules 8-10 in `branch-lifecycle.md` (namespace, tip SHA).
6. A superseded **stack parent** stays until no open child targets it
   (`branch-lifecycle.md` rule 5; `stacked-prs.md` DEV-STACK-04).

## §4 Policy strengths (`DEVOPS-AGENT-INTAKE-01`, DEFAULT)

Pick one column, write it into CONTRIBUTING, and wire only the controls it names. Values
in parentheses are what the cited project used; this file does not choose a number.

| Control | Weak | Medium | Strong |
|---|---|---|---|
| Identity | tier 0 label (`agent`) | tier 1 or 2, disclosed in PR body | tier 2 required |
| Draft rule | none | draft-first (§2) | draft-first; human marks ready |
| Linked issue | optional | recommended | required, and the issue carries an accepted label (ghostty; llama.cpp: "features must begin with an issue, not a PR") |
| PR limits | off | on, drafts exempt (GitHub, 2026-06) | on with a low cap (OpenSSL 3-4 open; llama.cpp 1 for new contributors) |
| Size | none | guidance in template | cap (Kubernetes: "large AI generated PRs … not allowed"; Godot: one self-contained change) |
| Auto-close | never | no CI green or no activity after N days (dotnet/runtime: 30 days; 44% of its closed agent PRs) | plus "cannot explain the change" (Kubernetes, LLVM) and unlinked issue |
| Supersede | manual `superseded` label | §3 | §3 plus a bot comment linking the replacement |
| Review | human | Copilot code review or CodeRabbit first pass, then human (dotnet/runtime, Kubernetes) | required status check acting as a gate (evidence file, allowed paths, required checks — the `agent-pr-gate` pattern) plus human |
| Trust tier | none | merged-PR count relaxes limits (Godot: ≤3 merged = new contributor; GitHub "smarter bypass signals" roadmap) | same, plus vouch list (ghostty) |
| Autonomous submission | allowed | allowed with disclosure | banned — a human must submit and be able to explain (LLVM, Godot, OpenSSF BCP draft) |

Four disagreements the sources do not settle; record which side the repository takes:

- **Disclosure.** ghostty, LLVM, Kubernetes, OpenSSL require it, and Godot's June 2026
  blog post does too (its CONTRIBUTING rule is commented out and not in force); Crossplane
  explicitly does not ("everyone uses AI, the signal is worthless").
- **Trailer.** `Assisted-by:` mandated (OpenSSL), recommended (kernel, Fedora, LLVM),
  accepted (KubeVirt), banned (Kubernetes), discouraged (Crossplane).
- **Is the flood permanent?** Godot, Ladybird and Zig treat it as structural. curl's
  2026-04-22 follow-up says "the slop situation is not a problem anymore" after the bug
  bounty was suspended on 2026-01-31 (HackerOne reporting later resumed) — removing the
  incentive worked where banning the tool would not.
  Do not cite curl as proof that AI reports are worthless.
- **Ban the tool or cap the rate.** Zig, QEMU, Gentoo and Servo judge AI-ness (total
  bans in the policy table); Godot's ban is announced but not yet in its CONTRIBUTING. OpenSSL,
  llama.cpp, GitHub and Crossplane cap concurrency regardless of provenance. GitHub's
  implementation is the tell: agent PRs count toward the limit, drafts do not.

The one sentence that recurs across otherwise opposed policies: **if you cannot
explain your change without the AI, it is closed** (ghostty, Kubernetes,
elasticsearch-py, Home Assistant, Fedora, Node.js, Trickster).

## §5 Issues

Issues attract agent PRs. Laravel disabled Issues on most packages (2026-09-03) and asks
for a PR from an agent instead, on the reasoning that a PR at least carries a diff.
GitHub announced per-user issue limits as in development. The medium option is a
`needs-info` label with a stale-close workflow (opencodex `stale-needs-info.yml`) and
removal of bait labels (`repo-bootstrap.md` §6).

## §6 Anti-patterns

| Banned | Why | Fix |
|---|---|---|
| Bot-account filter as the only agent detector | 0 hits on a repository with 37 machine-branch PRs | Tier 0 branch heuristics plus a declared tier |
| Auto-approving workflow runs for agent pushes | Unreviewed code reaches secrets (GitHub's own warning) | Keep "Require approval for workflow runs" |
| `required_signatures` without checking each agent path | Claude Actions unsigned by default; Codex unverified | `repo-bootstrap.md` §2 |
| Requiring a trailer an upstream bans | Contributors cannot satisfy both | Choose per upstream; document it |
| Closing PARTIAL work as superseded | Discards contributor work silently | §3 step 4 |
| Quoting an X post as a project policy | It is one maintainer's report | Cite it as a first-hand report only |

## §7 Sources (read 2026-09-09)

- Copilot cloud agent: https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations ; https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/configuring-agent-settings ; https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github
- Codex cloud branch format: live settings UI at chatgpt.com/codex/cloud/settings/general; PR author identity and draft default were searched in the Codex docs and not found (negative result recorded in `evidence/research/github-rulesets-and-agent-conventions.md` §2.2)
- Claude Code GitHub Actions: action inputs and docs as summarized in `devlog/_plan/260909_agent_swarm_repo_hygiene/evidence/research/github-rulesets-and-agent-conventions.md` §2.3
- Agent control plane GA (`actor_is_agent`): https://github.blog/changelog/2026-02-26-enterprise-ai-controls-agent-control-plane-now-generally-available ; Agents tab: https://github.blog/changelog/2026-01-26-introducing-the-agents-tab-in-your-repository
- Pull request limits: https://github.blog/open-source/maintainers/how-pull-request-limits-are-cutting-down-the-noise/
- Practitioner policies (LLVM, OpenSSL, dotnet/runtime, ghostty, Godot, Kubernetes, Crossplane, llama.cpp, curl, Zig, Ladybird, OpenSSF): `evidence/research/agent-pr-flood-practitioner-writeups.md` and `evidence/research/oss-ai-contribution-policies.md` in the same unit, each entry with its URL
- Laravel Issues decision: https://x.com/taylorotwell/status/2095516796748996843 (first-hand report)
- Live opencodex numbers: `evidence/research/lidge-jun-repos-settings-audit.md` §5.1
