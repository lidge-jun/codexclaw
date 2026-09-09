# Formal P architect lifecycle

Status: VERIFIED
Depends on: roles; consumes configured architect and existing native handles.

## Exact change map

MODIFY `plugins/codexclaw/skills/pabcd/references/phase-plan.md`: before current executable plan instructions add formal-P sequence: main gathers evidence; architect read-only proposal; main executable plan; same architect reflection check; independent A. C0/C1 fast path remains as owned by dev. Proposal lists stable decision IDs for module responsibility/data/interface/flow, file evidence, alternatives/tradeoffs and assumptions. Reflection returns aligned/misaligned plus decision-to-plan mapping and gaps. Main records disposition and owns final decision. Missing proposal/check cannot be recorded complete.

MODIFY `plugins/codexclaw/skills/pabcd/references/phase-audit.md`: retain independent reviewer. When audit resolution changes a recorded design decision, main names ID and before/after, sends revision to same architect for reflection before audit completion; text or test clarification alone does not reinvoke. Never replace reviewer with architect or main self-review.

MODIFY `plugins/codexclaw/skills/pabcd/references/delegation.md`: describe read-only architect logical role and the general read-only routing header (architect/reviewer/explorer) when explorer transport is required; keep CXC-ROLE lines out of promptOverride because repeated raw hook injection can shift logical role, a routing-hygiene limitation rather than a permission boundary; native agent_type only if exposed. Same plan reuses actual returned handle; new plan gets fresh context. Existing failure retirement rules apply, exact failure returned to main; no silent model switch/registration/bypass. If unavailable, report unmet consultation and stop dependent completion; user limits still win.

MODIFY `plugins/codexclaw/agents/README.md`: add architect -> explorer, no write, dev/dev-architecture row; explain configured model rather than hardcoded provider, prompt source not installed registration.

MODIFY `structure/20_pabcd_dispatch_doctrine.md`: extend operating role mapping with architect -> explorer; formal P sequence and boundary-owned lifecycle pointer. Explicitly guidance, no new PABCD phase/hook enforcement. Preserve all invariants in `structure/00_philosophy.md`, which remains unchanged.

MODIFY current role descriptions in `README.md`/`structure/INDEX.md` only where current three-role inventory would contradict shipped fourth role; do not rewrite historical plans. Existing `plugins/codexclaw/test/manifest-policy.test.mjs` and spawn-wrapper tests compare shipped TOML/skill paths with runtime roles; extend those owners if coverage is missing. Do not add prose phrase tests or a parallel workflow test file. Independent semantic review covers consultation meaning and lifecycle, which has no runtime enforcement counterpart. Generated dist is rebuilt only if runtime changes require it.

## Acceptance and final proof

Independent semantic audit traces proposal -> main plan -> reflection -> A and changed-decision recheck. Verify no new skills, no philosophy changes, no global/config/provider/cache installation diff. Run affected suites and full relevant existing gates from isolated worktree, with negative paths from 010. Observe GUI screenshot and state change, complete source-bound receipts and final review. Commit locally; record exact tests and native/provider limitations. Archive unit only after all cycles are complete.

Architecture guidance is E7 agent-followed. Executing surface: skill/role instructions. Known bypass: model ignores consultation or unreadable payload. Residual risk: prose cannot enforce that a call happened. Wording: guidance only. Final enforcement layer: none; existing attest requires real evidence but cannot authenticate prose provenance.

## A audit synthesis and observer boundary

Reviewer 01a082ab-3488-74e2-b6de-337fe2851229 returned FAIL with two blockers. Accept missing Dashboard ROLE_META entry; 010 now specifies it. Accept observer diagnostic interaction but retain existing observer unchanged: review-observer.ts:95-107 logs any unsigned non-worker exit while a plan_audit round is in flight. This diagnostic is factually true (a child exited without reviewer sign-off), not an approval/failure or evidence of a broken gate. Document this expected noise when architect rechecks overlap A, record architect output separately, and never interpret that row as architect failure or independent A evidence. Prefer completing reviewer return before architect revision/re-audit; do not open a new review-round until reflection completes. If an earlier round remains in flight, record the diagnostic's known cause instead of fabricating LAUNCH/VERDICT. Architect must never emit reviewer sign-off. No new hook branch or actor registry is justified to silence a diagnostic.

Non-blocking note: explicit agent_type handling is conditional on host schema (actual current host exposes reviewer/executor; architect is not installed). Keep role marker in payload for idempotence; unlike a one-use recursion grant it carries no authority.

Ship the observer diagnostic explanation in `skills/pabcd/references/phase-audit.md` alongside the recheck sequence. Native role note above is observed live host schema (registered agent_type entries), not a universal built-in assertion; stale attest.ts wording does not override an exposed host tool schema. No installed architect role is claimed.

A revalidation at d38c6c0: reviewer 01a082ab PASS with required routing-hygiene fold-in accepted above. Main judges near-pass with that concrete amendment; no design decision changed. Current inventory owners: README:42, structure/INDEX:96,139,310 and role table. Existing attest error vocabulary is pre-existing runtime debt outside this docs-only cycle.

C review 01a082cb found missed README translation propagation. Accepted: MODIFY README.ko.md and README.zh.md role inventory plus translated formal-P paragraph; update docs-site reference/commands.md, reference/api-mcp.md, guides/subagents.md and gui/README.md where they enumerate the changed role contract. No new behavior/design decision; C repair remains documentation propagation. Also clarify main-plan reflection, E7 qualifier, optional review-round timing and plugin registration wording. structure/00_philosophy.md:140 remains an unchanged historical example under the explicit user constraint; current inventory is INDEX and role store.

C closure: independent reviewer 01a082cb PASS at 4bc45a7, no blockers. Accepted small final clarifications: capitalize sentence, attach existing skills in architect example, name unreadable-marker fallback limitation, sync docs/native-thin-harness.md current logical-role inventory. docs/roadmap-mlb-1.0.md remains historical phase intent; current role contract is store/INDEX. No new design decision.
