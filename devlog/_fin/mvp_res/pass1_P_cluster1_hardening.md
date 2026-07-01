# Pass 1 (P) — Cluster 1 (L8–L11) jawdev-grade hardening plan

Status: P · Goal 45ab94c7-ba6 · 2026-06-30 · cxc
Scope: harden `devlog/_plan/mvp_res/` Cluster-1 loop docs (080–112) + index hygiene to
decision-complete (jawdev) quality. Docs-only pass; no component source/test changes.

## Concurrency note
Commit `4e6539f` (parallel session) already: expanded the status legend (added DEFERRED, banned
`RESOLVED` as a doc Status — now 0), flipped L9/L11/111/112 heads to FROZEN, flipped 230/260→PLANNED
and 290/300→DEFERRED, and flipped L18 search to on-demand. This pass builds ON that commit — do not
revert it. Remaining gaps below are what `4e6539f` did NOT close.

## Remaining gaps (from gpt-5.5 audit 019f1500, measured post-4e6539f)
G1. `000_BUILD_LOG.md` referenced by INDEX:191 + pass1 — still MISSING. → create it.
G2. `023_goal_creation_gate.md` dangling in 110:112, 111:55, 112:56 — real file is
    `023_goal_convention_port.md`. → fix 3 refs.
G3. INDEX:95 L22 table cell still says `RESOLVED (ast-grep only)` → change to `PLANNED (Q resolved)`.
G4. L8/L8.1/L8.3 — no exact `InterviewTracker`/`Contradiction`/`Assumption` schema; no numeric array
    caps; replay/operation IDs optional not named. → pin schema + caps (default 50) + op-id fields.
G5. L9/L9.1/L9.2/L9.4 — Mind prompt text is summarized not exact; routing thresholds undefined;
    correlation field unnamed; nested-session detection is a menu. → name correlationId, fix source
    order, mark exact-prompt authoring as the L9.1 deliverable with a concrete contract.
G6. L10/L10.2/L10.3 — auto-mode counter/max-round/reset undefined; freeze manifest path/name/schema
    and goal-start integration unnamed; `ledger_only` closure has no ledger owner/path. → pin freeze
    manifest at `.codexclaw/interview/freeze.json`, define auto-mode caps, resolve ledger scope.
G7. L11/L11.2 — PreToolUse matcher path is a placeholder; existing matcher is
    `plugins/codexclaw/hooks/pre-tool-use-guarding-goal-budget.json` (registered from
    `.codex-plugin/plugin.json`). → pin the exact path + add-second-hook strategy + fail-closed rule.

## Plan (diff-level, surgical)
1. Create `000_BUILD_LOG.md` (subagent authoring provenance) → resolves G1.
2. Fix 3 dangling refs G2 + 1 INDEX cell G3.
3. L8 set: pin full TS schemas for InterviewTracker/Dimension/Contradiction/Assumption; numeric caps
   (`MAX_TRACKER_ARRAY = 50`) and truncation direction (drop-oldest); name replay fields
   (`roundId`, `contradictionId`, `planEditId`, `freezeId`).
4. L9 set: name `correlationId` field; fix nested-session detection to single source + fallback
   order; state that exact Mind prompt text is L9.1's shipped artifact (not summary).
5. L10 set: pin freeze manifest `.codexclaw/interview/freeze.json` + schema + slug rule; pin
   auto-mode `MAX_AUTO_ROUNDS` + counter persistence/reset; resolve `ledger_only` (defer ledger →
   replace with `assumptions_only` closure, no hidden ledger).
6. L11 set: pin PreToolUse matcher to a NEW dedicated hook file
   `plugins/codexclaw/hooks/pre-tool-use-guarding-interview-in-goal.json` (separate from goal-budget
   to keep safety-critical deny isolated); fail-closed rule explicit.
7. One atomic docs commit.

## A-gate audit (DONE)
gpt-5.5 reviewer 019f1500 → FAIL with the line-anchored gaps above; report at
`.omo/evidence/cluster1-plan-audit-code-review.md`. This revised plan closes every listed blocker.

## Acceptance (Pass 1 D)
1. `000_BUILD_LOG.md` exists; no dangling refs in Cluster-1 docs (`grep 023_goal_creation_gate` = 0).
2. No `RESOLVED` token as a status anywhere in mvp_res (table cells included).
3. Each L8–L11 doc has exact paths/schemas/caps; re-audit by gpt-5.5 returns decision-complete.

## QA channel
- `grep -rn 023_goal_creation_gate devlog/_plan/mvp_res/` → 0
- `grep -rn 'RESOLVED' devlog/_plan/mvp_res/000_INDEX.md` → 0
- `test -f devlog/_plan/mvp_res/000_BUILD_LOG.md`
- gpt-5.5 C-gate re-audit verdict.

## Commit unit
`docs(plan): harden Cluster-1 (L8-L11) loop docs to decision-complete grade`
