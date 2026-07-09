# 260707 gjc/jawcode harness adoption triage

Status: shipped (docs-only cycle)
Owner: Boss
Work class: C2 docs-only
Session: 019f352b-5a13-7c51-a970-29dd4f6cb971

## Question

Compared against upstream gajae-code (gjc, chase clone at
`../jawcode/devlog/_gjc_chase/gajae-code`) and the jawcode fork's validated devlog
work, what should codexclaw adopt — and is the current harness "enough"?

## Evidence

Two parallel gpt-5.5 explorer dispatches (2026-07-07):

- **gjc upstream scan** — 13 capabilities ranked by plugin-adoptability
  (workflow stop-state, planning mutation guard, deep-interview ambiguity gate,
  ralplan consensus loop, ultragoal ledger/quality gate, anti-give-up guards,
  skill chaining handoff, team tmux, subagent fanout discipline, role/model
  routing, compaction/context promotion, project memory, delegation plugin).
- **jawcode devlog scan** — 9 validated ideas not yet in codexclaw
  (negative-review synthesis gate, durable actor reuse, failed-actor fresh
  fallback, plan-folder recovery, goal interrupt suppression, context
  maintenance, compaction threshold, cache-friendly compaction, hidden utility
  skills).

## Decisions

### Adopted (this cycle, E7 prose only — owner decision: no new guards/hooks)

1. **REVIEW-SYNTHESIS-01** — after a reviewer FAIL, the main session records a
   synthesis (per-blocker RCA, cross-blocker conflicts, accept/rebut decisions)
   before re-patching or re-dispatching; synthesis-free re-dispatch counts as a
   failed repair under LOOP-REPAIR-01.
   Patched: `plugins/codexclaw/skills/pabcd/references/loop-engineering.md` §11.3
   (canonical), `plugins/codexclaw/skills/pabcd/SKILL.md` (§11 stub + A-phase
   fold-back sentence), `plugins/codexclaw/skills/loop/SKILL.md` (pointer).
   Lineage: `../jawcode/devlog/_fin/260615_pabcd_synthesis_review_loops/`
   (design-note lineage — NOT production-validated; adopted on reasoning merit).
2. **DISPATCH-ACTOR-01 / DISPATCH-RETIRE-01** — reuse the same-role agent across
   follow-up rounds (`send_input`/`resume_agent`) for context preservation, with
   a fresh-reviewer carve-out for the final C adversarial gate and contaminated
   reviewers; retire failed agent ids after one retry (`close_agent` +
   fresh-spawn with failure summary).
   Patched: `structure/20_pabcd_dispatch_doctrine.md` §3 (normative),
   `plugins/codexclaw/skills/loop/SKILL.md` (pointer).
   Lineage: `../jawcode/devlog/_fin/260614_subagent_cache_actor_lifecycle/`
   + `../jawcode/devlog/_plan/260616_actor_fresh_fallback/` (implementation-verified).

### Rejected — owner decision (2026-07-07): "우리는 가드를 넣지 않는다"

- Planning-phase mutation guard (gjc `deep-interview-mutation-guard.ts`) — was the
  top E2-promotable candidate; vetoed as a class ("no new guards").
- Anti-give-up ask/pause guards, fanout spawn-plan gates as enforcement.

### Rejected — philosophy violations (00_philosophy.md)

- Compaction internals / context promotion / cache-friendly summary — runtime fork
  surface; a plugin cannot own context rewrite. Useful only as upstream proposals.
- Team tmux orchestration — resident workers/server shape; violates no-server.
- Same-turn skill chaining handoff — needs runtime dispatch support.
- Compaction threshold fix — codex-rs internals, not plugin surface.

### Deferred (worth a future cycle, not blocked)

- Plan-folder recovery ladder before asking the user (jawcode 260614 prompt
  discipline) — pure prose, pairs with cxc-recall.
- Subagent fanout discipline (spawn-plan above N tasks; caller verifies once).
- Hidden-utility skill inventory refinement.

## Sufficiency verdict

Skeleton parity with gjc is real (FSM+attest, Stop continuation, goalplan evidence
ledger, subagent role/model routing, recall, repo-map). The two genuine gaps were
(a) I/P/A read-only being prose-only — closed by owner veto, accepted as E7 —
and (b) review-loop quality discipline — closed this cycle. Remaining gjc
advantages are fork-only surfaces a plugin should not chase.

## Audit trail

Reviewer (gpt-5.5 explorer, reused actor) verdict: FAIL with 3 blockers, all
folded: (1) same-reviewer reuse needs the fresh-C-gate carve-out; (2) normative
lifecycle rules live in doctrine §3, loop SKILL points; (3) synthesis lineage is
design-note only, actor rules are implementation-verified — cite accordingly.
