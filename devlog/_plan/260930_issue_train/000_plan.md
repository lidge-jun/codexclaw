# Issue train 2026-09-30: dispatch verifier coverage, verifier effects, assumption provenance, decision options, release 0.2.40

Codexclaw has one confirmed defect among its 20 open issues: a dispatch receipt can satisfy a packet that requires two verifier commands with one unrelated passing result (#276). Three contained improvements need no maintainer decision and add no hooks: optional verifier write-effect declarations with a pure preflight (#277), provenance for Interview assumptions so inferred ones are not handed to Plan as agreed requirements (#275), and the `options[]` half of goalplan decisions that #271 left out (#262). This unit fixes and ships those, records a decision for every open issue (001), closes the ones that would grow hooks or depend on host signals the plugin cannot see, and releases the result as 0.2.40 from `main`.

Reader: a maintainer deciding whether to merge these changes and publish 0.2.40; familiarity with the dispatch contract, the Interview skill and the goalplan CLI is assumed.

## Loop contract

- Loop archetype: satisfy-spec HOTL, docs-first (LOOP-DOCS-FIRST-01).
- Trigger: the user's request on 2026-09-30 to fix the worthwhile open issues without bloating hooks, run it through cxc-loop, merge to `dev` and `main`, release, close issues at the agent's judgment, and verify each phase against the PABCD initiative rules with parallel inherited-model subagents.
- Goal: `#276`, `#277`, `#275` fixed and closed; `#262` options shipped; every open issue dispositioned; v0.2.40 published from `main` with verified assets.
- Non-goals: new hooks or hook injections; Codex core or Desktop changes; other repositories; #273's CLI verb; #274's schema (maintainer placement decision); #262 `withdrawn`; the installed plugin cache and SSH hosts.
- Verifier: per phase the focused tests in each decade doc, then `npm run build`, focused tests through `cxc receipt test`, `npm test` (TAP total), `inventory.mjs --check --tests <total>`, `gate.mjs`, `platform-smoke.mjs`; hosted CI on each PR head; for the release, `check-versions.mjs 0.2.40`, main exact-SHA CI, the `release.yml` dry run and publish, `shasum -a 256 -c SHA256SUMS` and payload comparison with `git archive`. Skill prose is read by no test; its review is human (PLAN-VERIFIER-REAL-01).
- Stop condition: all goalplan criteria met with fresh evidence, or a real blocker after root-cause work.
- Memory artifact: this unit, the goalplan `.codexclaw/goalplans/codexclaw-issue-train-2026-09-30-repo-lidge-jun/`, and `.codexclaw/evidence/01a0ee0f-ea9e-7273-91fe-0c4188c2cae6/`.
- Expected terminal outcomes: DONE (merged, released, dispositioned); BLOCKED (CI infrastructure, branch protection or credentials outside scope); NEEDS_HUMAN (a default-on behavior change or maintainer-owned schema choice); UNSAFE (a change would weaken a safety gate).
- Escalation: main owns the plan, FSM, git and delivery. Subagents are leaves; a packet two distinct agents fail is reclaimed by main (DISPATCH-RETIRE-01).
- Resource bounds: this checkout (`/Users/jun/.codex/worktrees/639c/codexclaw`), `gh` with the user's credentials, V1 subagents inheriting this session's model. Writes limited to the IN scope below. No token or wall-clock bound was stated; host limits apply. The initiative's loop-engineering rule asks for a token and wall-clock bound on C4 work; the release (040) is C4, and the user authorized it explicitly without a bound, so this is a disclosed gap rather than an invented budget.
- Review independence: every subagent inherits this session's model, as the user asked, so REVIEW-DECORRELATE-01's different-family review is not established; independence here is separate context only.

## Review and verification lanes

At every phase's A, one read-only reviewer (`cxc-dev-code-reviewer`, `cxc-search`) audits the plan, and in parallel an inherited-model verifier checks the phase against the PABCD initiative rules at `/Users/jun/Developer/new/700_projects/pabcd_initiative/skills/dev-pabcd/SKILL.md` (DIFFLEVEL-ROADMAP-01, PHASE-SPLIT-01, LEXICO-SPLIT-01, UNIT-RESIDENCE-01, SOT-SYNC-01, C-ACTIVATION-GROUNDING-01, PLAN-VERIFIER-REAL-01, PLAN-FIELD-CHAIN-01, PLAN-BYPASS-NAMED-01, review rules). At every C, a fresh implementation reviewer and an initiative verifier run in parallel against the diff and fresh gate output. Verdicts are recorded in each decade doc's review section and in criterion c-9.

## Scope and file map

IN (details in each decade doc):

```
plugins/codexclaw/components/subagent-config/{src,dist,test}/dispatch-contract.*   010 (#276, #277)
plugins/codexclaw/skills/pabcd/references/delegation.md                           010
structure/INDEX.md (subagent-config section)                                      010 SoT sync
plugins/codexclaw/skills/interview/{SKILL.md,references/mind-dispatch.md}         020 (#275)
plugins/codexclaw/skills/loop/references/durable-goalplan.md                      020, 030
plugins/codexclaw/components/pabcd-state/{src,dist}/goalplan{,-cli}.*, test/goalplan-public-surface.test.ts   030 (#262)
plugins/codexclaw/skills/dev/references/async-questions.md                        030
README*.md badges, inventory.json, version files, CHANGELOG.md                     each phase (badges), 040 (release)
```

OUT: `plugins/codexclaw/hooks/*`, hook handlers and injected directive text (`pabcd-state/src/hook.ts`), `interview.ts`/`freeze*.ts` schema, Codex core/Desktop, anything deferred or declined in 001.

## Ordered work phases

Build order follows dependencies, not effort (PHASE-SPLIT-01). The three implementation phases touch disjoint code; the one shared file is `durable-goalplan.md`, edited by 020 (line 40) and 030 (lines 60 and 98), so 030 runs after 020 and re-anchors its doc edits. Their order is set by delivery safety: the contract defect first, then guidance, then the goalplan schema extension, whose reviver change carries the most read-path risk and benefits from landing on a `dev` that already contains the other two.

| Doc | Goalplan id | Phase | Depends on |
|---|---|---|---|
| 000-002 | wp1 | docs-only roadmap: this plan, triage, architect consultation | — |
| 010 | wp2 | dispatch contract: #276 verifier coverage, #277 verifier effects | wp1 |
| 020 | wp3 | Interview assumption provenance guidance (#275) | wp1 |
| 030 | wp5 | goalplan decision options (#262 follow-up) | wp1 |
| 040 | wp4 | delivery, issue disposition, main promotion, release 0.2.40 | wp2, wp3, wp5 |

The goalplan id `wp5` was appended at this P as a LOOP-UNIT-CHAIN-01 amendment after triage found #262's options half small and self-contained; `wp4` gained `dependsOn: wp5` by a recorded hand edit (the CLI does not edit dependencies after creation).

Delivery: one ordinary PR per implementation phase into `dev`, merged with a merge commit after hosted CI passes on its head, then the release PR, the `dev` -> `main` promotion and the release (040). No native stacks.

## Issue acceptance mapping

| Issue | Decision | Where |
|---|---|---|
| #276 | fix | 010 |
| #277 | implement | 010 |
| #275 | implement guidance | 020 |
| #262 | implement options; keep open for `withdrawn` | 030 |
| #209, #213, #247, #258, #259, #263, #264, #265, #266, #267, #268 | close as not planned | 001, 040 |
| #255, #256, #257, #260, #273, #274 | keep open with a comment | 001, 040 |

## SoT sync targets (SOT-SYNC-01)

`structure/INDEX.md` (subagent-config file list, 010), `skills/interview/SKILL.md` (canonical owner of Interview rules, 020), `skills/loop/references/durable-goalplan.md` (goalplan schema and CLI, 020 and 030), `CHANGELOG.md` (040).
