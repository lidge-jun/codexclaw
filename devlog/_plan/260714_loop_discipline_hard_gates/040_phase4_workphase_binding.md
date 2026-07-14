# 040 — Phase 4: attest workPhaseId Binding + B-Directive Context Starvation (wp4)

Goal: make batching visible and expensive at the tool boundary. Each gated edge names
the ONE work-phase it advances; the B directive shows only that work-phase.

STALENESS NOTE: heaviest drift risk — attest.ts/orchestrate-cli.ts will have changed in
wp2. Re-verify every anchor at this phase's P.

wp4-cycle P re-verification (2026-07-14, post wp2/wp3): session→goalplan binding is
`state.slug` (set by `cxc loop init --session`; D-close already reads
`readGoalplan(args.cwd, state.slug)` at orchestrate-cli.ts:289-291). Gated-edge
detection: `GATED_TRANSITIONS.has(\`${state.phase}>${to}\`)` (attest.ts export).
`validateWorkPhaseBinding` stays PURE in attest.ts (id passed in — allowed by its
no-IO contract); orchestrate-cli loads the goalplan fail-open (IO error → binding
check skipped, HITL unchanged). hook.ts already imports readGoalplan (line 28);
`phaseDirective(phase)` call sites to extend with opts: hook.ts:431 (mode 1),
:502 (mode 2 passive re-inject), :616 (mode 3) — B-only starvation line, fail-open.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/attest.ts`

`Attestation` gains `workPhaseId?: string` (coerced). New pure check in
`validateAttest`: when a goalplan is BOUND to the session (pass its
`activeWorkPhaseId` in as an argument — keep attest.ts fs-free; orchestrate-cli
supplies it), every gated edge requires `workPhaseId === activeWorkPhaseId`:

AUDIT ROUND 1 (wp4) High fold — the naive `activeWorkPhaseId: string | null` signature
is VACUOUS in the standard flow: `loop init` seeds the cursor null, no CLI verb or
directive step sets it, and `advanceWorkPhase` no-ops on null — so null→ok would
free-pass the entire loop. Adopted design = option (b), implicit cursor:

- NEW pure helper in goalplan.ts:
  `effectiveActiveWorkPhaseId(plan): string | null` = explicit cursor (ONLY when it
  names a live, non-done work-phase — a stale/ghost/done cursor falls through, round-2
  Low #2) ?? first `in_progress` work-phase ?? first `pending` work-phase ?? null
  (null only when no open work-phase exists). A bound, registered goalplan therefore
  ALWAYS yields a binding target — "bound but cursorless" can no longer dodge the gate.
- `advanceWorkPhase` adopts the same implicit start: when cursor is null and
  workPhases exist, it operates on the effective active phase (marks it done, moves
  to next pending, persists the now-explicit cursor). D-close ledger call sites
  (orchestrate-cli.ts:300, hook.ts:597) log the EFFECTIVE closed id, not the
  pre-advance explicit cursor — no more "closed none" rows (round-2 Low #3).
- The gate check stays pure in attest.ts:

```ts
export function validateWorkPhaseBinding(att: Attestation | null, activeWorkPhaseId: string | null): AttestResult {
  if (activeWorkPhaseId == null) return { ok: true };            // no goalplan bound / empty plan → HITL unchanged
  if (!att?.workPhaseId) return { ok: false, reason:
    `A goalplan is bound (active work-phase ${activeWorkPhaseId}); pass "workPhaseId" in the attest. One work-phase = one cycle.` };
  if (att.workPhaseId !== activeWorkPhaseId) return { ok: false, reason:
    `attest.workPhaseId=${att.workPhaseId} but the active work-phase is ${activeWorkPhaseId}. Close this cycle through D before touching another unit (LOOP-UNIT-CHAIN-01).` };
  return { ok: true };
}
```

orchestrate-cli passes `effectiveActiveWorkPhaseId(readGoalplan(...))` — computed
fail-open (null on any IO/parse failure). Accepted evasion class (audit Low #4): an
agent that deletes/corrupts the goalplan or never binds a slug disengages the gate —
consistent with the attest.ts threat model (adversary is laziness/hallucination, not
malice; same class as deleting .codexclaw wholesale).

Discoverability (audit Med #2): extend the A/B/D help examples in
renderOrchestrateHelp with `"workPhaseId":"wp1"`, and add one clause to
LOOP_ARM_DIRECTIVE step 4: include the active workPhaseId in every gated attest when
a goalplan is bound.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`

- Load the bound goalplan (existing session→slug binding from `cxc loop init`), pass
  `activeWorkPhaseId` into `validateWorkPhaseBinding` for the four gated edges.
- D-close already advances the cursor one step; unchanged.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts` — B directive starvation

`PHASE_DIRECTIVES.B` is static. Make B (and only B) dynamic: when a goalplan is bound,
append one line naming ONLY the active work-phase:

```
"ACTIVE WORK-PHASE: <id> — <title>. This cycle implements THIS slice only; other
work-phases are out of scope until D closes (LOOP-UNIT-CHAIN-01)."
```

Implementation: `phaseDirective(phase, opts?: { activeWorkPhase?: {id,title} })`; the
hook's directive-injection call sites (hook.ts:431 mode 1, :502 mode 2, :616
chat-orchestrate injection — relabeled per audit Low #3; mode 3's stage header stays
lean by design) load the bound goalplan read-only/fail-open via state.slug and pass
the EFFECTIVE active work-phase. No other phases change.

## TESTS

`test/attest.test.ts`: binding null → ok; bound + missing id → fail; mismatch → fail;
match → ok. `test/hook.test.ts`: B directive contains "ACTIVE WORK-PHASE" iff bound.
`test/orchestrate-cli.test.ts` (or integration test): gated edge with wrong id → non-zero.
`test/goalplan.test.ts` (round-2 Medium): effectiveActiveWorkPhaseId — explicit cursor
wins; stale/done explicit cursor falls through; in_progress preferred over pending;
empty/all-done plan → null. advanceWorkPhase implicit start: null cursor + pending
phases → first pending closed + explicit cursor persisted (pins the semantics change
next to the existing :204 empty-plan case).

## Verification (C)

bun test; rebuild; standalone: with this session's goalplan bound, attempt
`cxc orchestrate A --attest '{"workPhaseId":"wp999",...}'` → rejected with
LOOP-UNIT-CHAIN-01 reason; correct id advances. Capture outputs.
