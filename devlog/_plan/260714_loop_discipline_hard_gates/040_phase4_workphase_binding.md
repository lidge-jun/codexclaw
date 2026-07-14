# 040 — Phase 4: attest workPhaseId Binding + B-Directive Context Starvation (wp4)

Goal: make batching visible and expensive at the tool boundary. Each gated edge names
the ONE work-phase it advances; the B directive shows only that work-phase.

STALENESS NOTE: heaviest drift risk — attest.ts/orchestrate-cli.ts will have changed in
wp2. Re-verify every anchor at this phase's P.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/attest.ts`

`Attestation` gains `workPhaseId?: string` (coerced). New pure check in
`validateAttest`: when a goalplan is BOUND to the session (pass its
`activeWorkPhaseId` in as an argument — keep attest.ts fs-free; orchestrate-cli
supplies it), every gated edge requires `workPhaseId === activeWorkPhaseId`:

```ts
export function validateWorkPhaseBinding(att: Attestation, activeWorkPhaseId: string | null): AttestResult {
  if (activeWorkPhaseId == null) return { ok: true };            // no goalplan bound → HITL unchanged
  if (!att.workPhaseId) return { ok: false, reason:
    `A goalplan is bound (active work-phase ${activeWorkPhaseId}); pass "workPhaseId" in the attest. One work-phase = one cycle.` };
  if (att.workPhaseId !== activeWorkPhaseId) return { ok: false, reason:
    `attest.workPhaseId=${att.workPhaseId} but the active work-phase is ${activeWorkPhaseId}. Close this cycle through D before touching another unit (LOOP-UNIT-CHAIN-01).` };
  return { ok: true };
}
```

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
hook's directive-injection call site loads the bound goalplan (read-only, fail-open)
and passes it. No other phases change.

## TESTS

`test/attest.test.ts`: binding null → ok; bound + missing id → fail; mismatch → fail;
match → ok. `test/hook.test.ts`: B directive contains "ACTIVE WORK-PHASE" iff bound.
`test/orchestrate-cli.test.ts` (or integration test): gated edge with wrong id → non-zero.

## Verification (C)

bun test; rebuild; standalone: with this session's goalplan bound, attempt
`cxc orchestrate A --attest '{"workPhaseId":"wp999",...}'` → rejected with
LOOP-UNIT-CHAIN-01 reason; correct id advances. Capture outputs.
