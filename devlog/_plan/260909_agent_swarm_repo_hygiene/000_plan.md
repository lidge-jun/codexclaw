# Agent-swarm repository hygiene — roadmap

## Reader summary

Codexclaw's skills teach an agent how to clean a repository that is already full of
dead branches, but not how to set one up so it stays clean, and nothing at all about
running a repository where dozens of coding agents open pull requests at once. This
unit closes both gaps in `cxc-dev-devops` and delivers the change as a four-layer
manual PR chain on `dev`. After it lands, an agent asked to bootstrap a repository,
triage a flood of agent PRs, or garbage-collect worktrees and branches has one owner
file per topic, numbered rules, and citations it can re-verify.

Loop-spec: satisfy-spec; trigger: user's 2026-09-09 request ("devops 스킬 업데이트 ...
stacked pr로 올려줘, cxc-loop, pabcd 여러 번") after the research round in this session.
Goal: `dev-devops` owns repository bootstrap, agent-PR intake, and local GC guidance,
with the branch-lifecycle reference brought back in line with the shipped OpenCodex
implementation. Non-goals: implementing `cxc worktree gc`; changing any GitHub
setting; deleting any ref or worktree; merging or releasing; touching opencodex,
cli-jaw or ima2-gen; GitHub native stacks (DEV-STACK-OPT-IN-01 — user asked for
"stacked pr", which is a manual chain). Verifier: `node plugins/codexclaw/scripts/gate.mjs`
(exit 0 on 2026-09-09 at 6e97e73d; reads every `skills/**/SKILL.md` and nested
`references/*.md` for false-enforcement prose — checkForbiddenClaims in gate.mjs:159)
and `node --test plugins/codexclaw/test/skill-catalog.test.mjs
plugins/codexclaw/test/manifest-policy.test.mjs` (10 pass; reads
`skills/README.md` catalog block and every SKILL.md frontmatter). Neither verifier reads
reference prose for correctness; citation accuracy and rule consistency are human/reviewer
review rows. Stop: five goalplan criteria met and wp6 D closes. Memory artifact: this unit
plus `.codexclaw/evidence/<session>/`. Outcomes: DONE = four PRs open with green CI on
final heads; NEEDS_HUMAN = merge; BLOCKED = push refused by hook/ruleset; UNSAFE = never
delete refs. Escalation: main reclaims a slice after two distinct leaf failures; a new
worker scope is amended here before dispatch. Resource bounds: user granted unlimited
Opus-5 subagents and Aside exec; no token or wall-clock cap was set; push and PR
creation are authorized in this session, merge is not.

Class C3: cross-skill guidance contract spanning four reference files, one router, and
pointers in three other skills; no runtime code. Six work-phases, one PABCD cycle each.
This first cycle is docs-only (LOOP-DOCS-FIRST-01): research ledger and diff-level
decade docs; no skill edits.

## Problem statement

Three observed facts drive the unit (evidence in `001_research_ledger.md`):

1. **Doc/implementation drift with data-loss consequence.** `branch-lifecycle.md` §2
   lists 8 keep rules. The shipped OpenCodex planner
   (`.github/scripts/closed-pr-branch-cleanup.cjs`, `KEEP_REASONS`) has 10. The two
   missing rules — outside-disposable-namespace and branch-moved-since-close /
   unknown-head-sha — were added by commit `59d9bc95f` (2026-08-27, "stop deleting
   reused branches") one day after the doc's last review. A reader porting the doc to
   another repository reproduces the bug that commit fixed.
2. **No bootstrap guidance.** The skill reads `delete_branch_on_merge` but never sets
   it; rulesets, required checks, auto-merge, PR limits, labels and templates are
   undocumented. The skill's own home repository (codexclaw) has auto-delete and
   auto-merge off; cli-jaw still runs classic branch protection; ima2-gen permits
   force-push to main.
3. **No agent-PR intake policy.** opencodex holds 72 open PRs (56 drafts), 0 authored
   by bot accounts, 37 with machine-style branch names (`codex/`, `agent/`) from human
   accounts. `pr-labeler.cjs` recognizes only `github-actions[bot]`. Locally, four
   repos carry 133 worktrees (70 under `/private/tmp`, 25 dirty) and 530 local branches,
   with no GC command in `cxc` and no scheduled job.

## Baseline (observed 2026-09-09)

- Worktree `/Users/jun/.codex/worktrees/cd7a/codexclaw` on branch
  `codex/agent-swarm-hygiene-l1` at origin/dev `6e97e73d` (main `bb852272`, v0.2.24).
  FSM session `01a081ad-197a-7e53-a2b1-c6ebad0818ed`, goalplan slug
  `update-the-codexclaw-skill-set-repo-lidge-jun-co`.
- `dev-devops/SKILL.md` 444 lines; §2.9 rule table has 4 rules
  (`DEVOPS-BRANCH-AUTODELETE-01`, `-DELETE-EVIDENCE-01`, `-SNAPSHOT-01`,
  `DEVOPS-WORKTREE-DIRTY-01`); Modular References table at lines 33-45 (13 rows).
- `references/branch-lifecycle.md` 193 lines, "Last reviewed: 2026-08-26".
- `worktree-guardian/SKILL.md` 96 lines; §4 has a "Cleanup of other worktrees" paragraph.
- `dev/references/stacked-prs.md` — no supersede pointer; `skill-ownership.md` lists
  `dev-devops` as owner of "Operational gates" only.
- Gate and skill tests green at baseline (exit 0).

## Work-phase map (dependency order, PHASE-SPLIT-01)

| WP | Layer | Branch (base) | Doc | Delivers |
|----|-------|---------------|-----|----------|
| wp1 | — | `codex/agent-swarm-hygiene-l1` (dev) | this unit | roadmap, research ledger, decade docs |
| wp2 | L1 | `codex/agent-swarm-hygiene-l1` (dev) | 010 | branch-lifecycle drift fix; §2.9 rule table rows for the new rule IDs; triggers |
| wp3 | L2 | `codex/agent-swarm-hygiene-l2` (L1) | 020 | `references/repo-bootstrap.md` + its Modular References row |
| wp4 | L3 | `codex/agent-swarm-hygiene-l3` (L2) | 030 | `references/agent-pr-intake.md` + its row |
| wp5 | L4 | `codex/agent-swarm-hygiene-l4` (L3) | 040 | `references/local-gc.md` + its row, pointers, CHANGELOG |
| wp6 | — | all four | 050 | push, four PRs with stack maps, CI on final heads |

Why this order: L1 fixes the canonical file every later reference cites, so it must
land first. L2 (bootstrap) is the prevention layer the intake policy (L3) assumes
exists — intake rules refer to rulesets and PR limits defined in L2. L4 (local GC)
consumes the keep rules from L1 and the namespace conventions from L2/L3. Each layer
has one thesis and passes gate + catalog tests at its own tip (DEV-STACK-03). The
roadmap docs live on L1 so every upper layer inherits them.

Stack decision (DEV-STACK-01): four files with real dependency order, each reviewable
alone, total prose well over one sitting — stack. Manual chain only; no native
registration.

Known publish-time interaction: codexclaw's `enforce-pr-target.yml`
(`pull_request_target`) prefixes `[WRONG BRANCH] `, converts to draft and comments on
any PR whose base is not `dev` and is not the `dev -> main` promotion. L2-L4 will be
flagged. 050 pre-declares this; the user was asked (async, 2026-09-09) whether to add a
same-repository open-PR-head exemption in L1, leave the flags in place, or open all four
against `dev`. Until answered, the plan keeps the chain and accepts the flags. CI itself
runs on every PR: `ci.yml` has a bare `pull_request:` trigger with no base filter.

## Source-of-truth sync (SOT-SYNC-01)

- `dev/references/skill-ownership.md`: add rows for the three new rule areas
  (repository bootstrap, agent-PR intake, local branch/worktree GC) with owner
  `dev-devops` and stub locations. Done in wp5 with the other pointers.
- `CHANGELOG.md` Unreleased section: one Added entry, wp5.

## Verifiers (PLAN-VERIFIER-REAL-01)

| Command | Exit at baseline | Reads the change target? |
|---|---|---|
| `node plugins/codexclaw/scripts/gate.mjs` | 0 | yes — walks `skills/*/SKILL.md` and `skills/*/references/**/*.md` (gate.mjs checkForbiddenClaims, line 159) for false-enforcement phrases; catches a new reference claiming a hook enforces it |
| `node --test plugins/codexclaw/test/skill-catalog.test.mjs plugins/codexclaw/test/manifest-policy.test.mjs` | 0 | yes for SKILL.md frontmatter and the catalog block; does not read reference bodies |
| `git merge-base --is-ancestor <lower> <upper>` | n/a | yes — chain proof for wp6 |
| `gh pr checks <n>` | n/a | yes — CI on each PR head, wp6 |
| Citation accuracy, rule-ID uniqueness, UNVERIFIED labeling | — | **no command observes this**; human/Opus-5 reviewer row at A for wp2-wp5 |

## Bypass register (PLAN-BYPASS-NAMED-01)

The unit adds guidance, not enforcement. Every rule ID introduced is prose an agent
reads; the executing surface is the agent, the bypass path is not reading the file,
and the residual risk is the same as for every other `DEVOPS-*` rule. Tier: E1
(documentation). No wording claims hook backing.

## Open assumptions carried from the session

- Trailer-based agent identity (`Assisted-by:` / `Co-authored-by:`) is documented as an
  option, not a default: sources conflict (OpenSSL mandates, Kubernetes bans).
- Numeric thresholds (auto-close days, diff caps) are recorded as ranges with the
  source that used each value; the skill does not pick one.
- `cxc worktree gc` is specified as a contract in `local-gc.md`; implementation is a
  separate future unit (LOOP-UNIT-CHAIN-01 candidate, not appended here).
