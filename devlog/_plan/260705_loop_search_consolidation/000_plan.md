# 000 — Loop/Search Consolidation Plan

**Unit:** `260705_loop_search_consolidation`
**Created:** 2026-07-05
**Objective:** Eliminate skill overlap by merging goalplan into loop and ultraresearch into search; improve goal-mode work-phase automation.
**Work Class:** C3 (cross-skill refactor with CLI surface changes + runtime FSM modification)

## Problem Statement

Three confirmed issues in the current codexclaw skill/runtime design:

1. **loop + goalplan overlap:** Both skills describe the same work-phase lifecycle (one
   PABCD cycle per work-phase, D closes to IDLE, agent re-enters P). goalplan has the
   runtime data model (`workPhases[]`, `criteria[]`, `activeWorkPhaseId`) while loop
   has the prose contract (terminal outcomes, continuation doctrine, divergence/collapse).
   Neither one drives state transitions — the agent must manually coordinate both.

2. **Goal creation gap:** Nothing connects `cxc goalplan init` to the host `create_goal`.
   The `GoalplanHostLink.armed` field is dead provenance metadata that nothing writes.
   The agent often creates one without the other.

3. **search + ultraresearch overlap:** ultraresearch is 80 lines of Tier-3 protocol
   (EXPAND/wave/journal/claim-ledger) that `cxc-search` already describes and points to.
   Two separate skills for what is functionally one tiered capability.

## Decisions (from Interview)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Merge scope | Skill + runtime both | CLI surface unified under `cxc loop`; goalplan.ts code stays but is consumed by loop CLI |
| Goal rule | Loop skill prose only | 5000-char detailed objective rule added to HOTL entry procedure; no hook enforcement |
| CLI rename | `cxc loop init/show/validate` | `cxc goalplan *` becomes deprecated alias |
| D auto-advance | Yes, in orchestrate-apply.ts | D transition auto-advances goalplan activeWorkPhaseId + marks previous work-phase done |
| sparksearch | Keep separate | Has unique Spark-model hardcoding + parallel fan-out shape |
| ultraresearch fate | Merge into search Tier 3 | Inline as Tier 3 Deep Research Protocol section |

## Dependency-Ordered Work Phases

### Phase 1: Skill Document Consolidation

Merge goalplan SKILL.md content into loop SKILL.md. Remove goalplan from public
skill exposure (move to `_internal/` or strip from plugin manifest). Merge
ultraresearch SKILL.md content into search SKILL.md as a Tier 3 section.

**Files:**
- MODIFY `skills/loop/SKILL.md` — absorb goalplan contract, add 5000-char goal rule,
  add CLI surface docs (`cxc loop init/show/validate`)
- MODIFY `skills/search/SKILL.md` — inline ultraresearch as Tier 3 section, remove
  pointer to external `$cxc-ultraresearch` skill
- MODIFY `skills/goalplan/SKILL.md` — add deprecation header, redirect to loop
- MODIFY `skills/ultraresearch/SKILL.md` — add deprecation header, redirect to search

**Verifier:** Skills pass content review — no broken cross-references, all goalplan
concepts present in loop, all ultraresearch concepts present in search.

### Phase 2: CLI Surface Unification

Rename `cxc goalplan` CLI to `cxc loop` with deprecated `goalplan` alias.

**Files:**
- MODIFY `components/pabcd-state/src/cli.ts` — add `loop` as primary kind routing
  to goalplan-cli.ts logic; keep `goalplan` as deprecated alias
- MODIFY `components/pabcd-state/src/goalplan-cli.ts` — rename exported types/functions
  to loop-prefixed names (GoalplanCliArgs -> LoopCliArgs etc.), update output labels
  from `[codexclaw goalplan:` to `[codexclaw loop:`

**Verifier:** `cxc loop init --objective "test"` works; `cxc goalplan init` still works
as deprecated alias. Existing tests pass after adaptation.

### Phase 3: D-Close Auto-Advance

When `cxc orchestrate D` closes a PABCD cycle, automatically advance the goalplan's
`activeWorkPhaseId` to the next pending work-phase and mark the completed one as `done`.

**Files:**
- MODIFY `components/pabcd-state/src/orchestrate-apply.ts` — in the D transition handler,
  after phase->IDLE, read the session-bound goalplan (via `state.slug`), mark current
  work-phase `done`, advance `activeWorkPhaseId` to next pending, write goalplan + ledger
- MODIFY `components/pabcd-state/src/goalplan.ts` — add `advanceWorkPhase(plan)` helper
  that marks current `activeWorkPhaseId` done and sets next pending as active

**Verifier:** Unit test: D-close with a session-bound goalplan auto-advances the
work-phase. Manual test: multi-phase loop runs with automatic work-phase progression.

### Phase 4: Tests + Integration Verification

Update existing tests, add new tests for the merged surfaces, and run the full gate.

**Files:**
- MODIFY relevant test files in `components/pabcd-state/test/`
- NEW test for D-close auto-advance
- NEW test for `cxc loop` CLI routing

**Verifier:** `npm test` passes. `scripts/gate.mjs` passes.

### Phase 5: Additional Skill Overlap Resolution

Address the 5 newly discovered overlaps from the explorer investigation, plus
the 3 contradictions found.

**Overlaps to resolve:**
1. `pabcd` vs `orchestrate` — orchestrate is a strict subset of pabcd phase-control.
   Merge orchestrate into pabcd as a "Control Surfaces" subsection; deprecate
   orchestrate SKILL.md.
2. `pabcd` vs `interview` — interview is the I-phase extracted. This is intentional
   as an entry surface, but pabcd restates the same I-phase rules. Deduplicate:
   pabcd references interview skill for I-phase detail instead of inlining it.
3. `dev-frontend` vs `dev-uiux-design` — design rules duplicated in both. Clean
   boundary: dev-frontend strips design-judgment rules and points to dev-uiux-design;
   dev-uiux-design strips implementation rules and points to dev-frontend.
4. `dev-backend` vs `dev-devops` — deployment/rollback/observability overlap. Backend
   retains app-level hooks only; points to devops for delivery mechanics.
5. `dev` vs `skill-hub` — dual routing catalogs. Merge skill-hub routing into dev hub;
   deprecate skill-hub as standalone.

**Contradictions to fix:**
1. `search` self-contradiction on implicit visibility (lines 11 vs 211)
2. `dev` vs `skill-hub` vs `search` disagree on default implicit set
3. `pabcd` stale "self-advances" wording (line 56) — align with loop's "agent must
   explicitly run `cxc orchestrate`"

**Files:**
- MODIFY `skills/pabcd/SKILL.md` — absorb orchestrate, reference interview, fix
  self-advances wording
- MODIFY `skills/orchestrate/SKILL.md` — deprecation header, redirect to pabcd
- MODIFY `skills/interview/SKILL.md` — remove pabcd-duplicated paragraphs
- MODIFY `skills/dev-frontend/SKILL.md` — strip design-judgment rules, add pointer
- MODIFY `skills/dev-uiux-design/SKILL.md` — strip implementation rules, add pointer
- MODIFY `skills/dev-backend/SKILL.md` — strip deployment/delivery sections, add pointer
- MODIFY `skills/dev/SKILL.md` — absorb skill-hub routing, fix implicit visibility
- MODIFY `skills/skill-hub/SKILL.md` — deprecation header, redirect to dev
- MODIFY `skills/search/SKILL.md` — fix self-contradicting implicit visibility

**Verifier:** No cross-reference breaks. Each deprecated skill has a redirect header.
Implicit visibility claim is consistent across dev, search, skill-hub.

## Scope Boundary

**IN:**
- loop + goalplan skill merge (docs + CLI + D-auto-advance)
- ultraresearch -> search skill merge (docs only, inline as Tier 3)
- Goal-setting rule (5000-char objective) added to loop prose
- 5 additional skill overlaps resolved (pabcd+orchestrate, pabcd+interview,
  dev-frontend+dev-uiux-design, dev-backend+dev-devops, dev+skill-hub)
- 3 contradictions fixed (search implicit visibility, implicit set disagreement,
  pabcd self-advances wording)

**OUT:**
- Stop hook arming logic changes (already works correctly)
- GoalplanHostLink.armed automation (stays provenance-only for now)
- sparksearch changes
- New hook enforcement for goal rule

## Success Criteria

1. `cxc loop init/show/validate` CLI works end-to-end
2. `cxc goalplan *` works as deprecated alias
3. D-close auto-advances goalplan work-phases
4. loop SKILL.md contains all goalplan concepts (work-phases, criteria, checkpoint, evidence)
5. search SKILL.md contains ultraresearch protocol inline (Tier 3 section)
6. goalplan + ultraresearch SKILL.md marked deprecated with redirects
7. All existing tests pass after adaptation
8. All 5 discovered overlaps resolved with clear ownership boundaries
9. All 3 contradictions fixed with consistent claims across skills
10. orchestrate + skill-hub SKILL.md marked deprecated with redirects

## Loop Spec Header

- **Loop archetype:** Spec-satisfaction (pass/fail: tests + gate)
- **Verifier:** `npm test` + `scripts/gate.mjs`
- **Stop condition:** All tests pass, gate passes, skills read correctly
- **Expected terminal outcome:** DONE
- **Escalation:** If D-auto-advance breaks existing FSM invariants, revert to agent-manual
