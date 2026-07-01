# L2 / 020 — FSM Legal-Transition Table + Four-Transition Attest Gate

Status: DONE (impl shipped + tested) · 2026-06-30 · mvp_hard loop L2 · class C3 (persistence + cross-session FSM contract)

> Prereq for L3 (the `$cxc-orchestrate` wire). The wire is only safe once the FSM
> refuses illegal jumps and the attest gate covers all four forward edges.

## Goal

Bring codexclaw's pure FSM to cli-jaw parity on two axes:
1. **Adjacency** — port cli-jaw `VALID_TRANSITIONS` so `canEnter()` rejects illegal
   jumps (`IDLE->A`, `IDLE->B`, `P->C`, ...). Today `canEnter("A")` / `canEnter("C")`
   are unconditionally `{ ok: true }`, so the only thing stopping a jump is the
   flag gates on B and D — A and C are wide open.
2. **Evidence gate** — extend `GATED_TRANSITIONS` from `{A>B, C>D}` to all four
   forward edges `{P>A, A>B, B>C, C>D}`, matching cli-jaw `attestation.ts`. This is
   the agent-facing structural gate; the human free-pass bypass lands in L3 (actor
   split), NOT here.

## Reference (verified, file:line)

- cli-jaw `VALID_TRANSITIONS` ([state-machine.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/orchestrator/state-machine.ts:600)):
  `IDLE:[I,P] · I:[P,IDLE] · P:[I,A] · A:[I,B] · B:[I,C] · C:[I,D,B,P] · D:[I,IDLE]`.
- cli-jaw gated transitions `P>A, A>B, B>C, C>D` ([attestation.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/orchestrator/attestation.ts:36)).
- codexclaw current `canEnter` (A/C open) ([fsm.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/fsm.ts:8)).
- codexclaw current `GATED_TRANSITIONS = {A>B, C>D}` ([attest.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/attest.ts:30)).

## File change map (IN scope)

1. `plugins/codexclaw/components/pabcd-state/src/fsm.ts`
   - Add `export const VALID_TRANSITIONS: Readonly<Record<Phase, readonly Phase[]>>`
     mirroring the cli-jaw table above.
   - Add `export function isLegalEdge(from: Phase, to: Phase): boolean`.
   - `canEnter(to, state)` gains an adjacency precheck: if `!isLegalEdge(state.phase, to)`
     return `{ ok:false, reason:"illegal transition <from>-><to>" }` BEFORE the
     existing flag-gate switch. Keep flag gates (B needs auditPassed, D needs
     checkPassed, I->P needs interview) layered on top so behavior for legal edges
     is unchanged.
   - `transition()` is unchanged in shape — it already calls `canEnter` after the
     attest gate; the adjacency check rides inside `canEnter`.
2. `plugins/codexclaw/components/pabcd-state/src/attest.ts`
   - `GATED_TRANSITIONS` becomes `{P>A, A>B, B>C, C>D}`.
   - `validateAttest` unchanged otherwise (C>D still the only one needing checkOutput).
3. Tests:
   - `test/fsm.test.ts` — add adjacency cases: `IDLE->A` illegal, `IDLE->B` illegal,
     `P->C` illegal, `A->D` illegal; legal-edge sanity (`IDLE->P`, `P->A`, `C->B`,
     `C->P`, `D->IDLE`). Confirm flag gates still fire on legal-but-gated edges.
   - `test/attest.test.ts` — update the `GATED_TRANSITIONS` deep-equal to the 4-edge
     set; add `P>A`/`B>C` now-required-attest cases.

## Scope boundary

- IN: `fsm.ts`, `attest.ts`, their tests.
- OUT (later loops): the `$cxc-orchestrate` parser + hook wire (L3), the CLI (L4),
  the human-vs-agent actor split / free-pass bypass (L3), ledger-on-transition (L5),
  Stop-continuation (L6), goalplan/loop (L7). L2 does NOT change `transition()`'s
  public signature and does NOT add an actor parameter.

## Accept criteria (testable)

- `canEnter` returns `ok:false` with an "illegal transition" reason for every edge
  NOT in `VALID_TRANSITIONS`; returns the existing behavior for legal edges.
- `transition(IDLE-state, "A")` now fails on adjacency (was: passed canEnter, only
  blocked later by nothing) — illegal jumps are fail-closed.
- `GATED_TRANSITIONS` deep-equals `["A>B","B>C","C>D","P>A"].sort()`.
- `transition(P-state,"A")` without attest is rejected; with a real `did` it passes
  and moves to A.
- `npm test` stays green at 223+ (new cases add, none regress); `npm run build` idempotent.

## Risk / rollback

- Risk: tightening `canEnter` could break an existing legal path a test relied on.
  Mitigation: the legal table is a strict superset of what the current flag gates
  allowed for legal edges, so legal-edge behavior is preserved; only previously-open
  illegal jumps (A,C entry from anywhere) now close. Backward edges `C->B`, `C->P`
  are explicitly legal per the cli-jaw table, so re-plan/re-build from C still works.
- Rollback: revert the two source files + test additions; pure functions, no state
  migration, no persisted-schema change.

## Audit focus (for A gate)

- Does adding `P>A`/`B>C` to the gate break any current caller that advances those
  edges without attest? (Today only the test-suite and `transition()` direct calls
  hit them; no hook/CLI caller exists yet — that's L3+. Confirm no production caller
  silently advances P>A.)
- Is `C->P` / `C->B` backward re-entry preserved (loop re-plan)?
- Does `D->IDLE` (cycle close, ungated) stay ungated?

## Audit verdict (A gate — independent reviewer, 2026-06-30)

Verdict: **PLAN OK with fixes**. No HIGH blockers; no production caller advances
`P>A`/`B>C` without attest (the hook still never calls `transition()`; `handleStop`
is passive). Adjacency table confirmed byte-faithful to cli-jaw `state-machine.ts:600`.
Folded-in fixes (now part of the build scope):

1. **Known-red existing tests to update** (these assume the old open/2-edge model):
   - `attest.test.ts:5-9` — `GATED_TRANSITIONS` deep-equal expects only `A>B,C>D`.
   - `fsm.test.ts:15` — "A is always enterable" runs from default phase `I`; `I->A`
     is now illegal. Rewrite to assert `P->A` legal and `I->A` illegal.
   - `fsm.test.ts:19` — `canEnter("B", auditPassed:true)` from default `I`: now illegal
     by adjacency. Re-base from phase `A` (legal `A->B`).
   - `fsm.test.ts:24` — `canEnter("D", checkPassed:true)` from default `I`: now illegal.
     Re-base from phase `C` (legal `C->D`).
2. **Added coverage** (accept criteria extended):
   - `transition(B,"C")` rejected without attest; accepted with a real `did`.
   - illegal-to-IDLE adjacency: `P->IDLE`, `A->IDLE`, `B->IDLE`, `C->IDLE` all illegal
     (guards that the adjacency precheck runs BEFORE the unconditional `canEnter("IDLE")`).
   - flag-does-not-bypass-adjacency: `I->B` with `auditPassed:true` illegal; `I->D`
     with `checkPassed:true` illegal.
   - exact `VALID_TRANSITIONS` deep-equal invariant; every `nextPhase()` output is a
     legal edge of its from-state.
3. **Ordering confirmed safe**: adjacency precheck must be the FIRST thing in
   `canEnter()`. `IDLE->I` (sets interview=false then legal) and `D->IDLE` (legal then
   close/reset) both verified clean under the new order.
4. **Stale-comment cleanup**: `hook.ts:9` header comment says `canEnter("A")` is open;
   update it (or explicitly note it's superseded) so the doc-truth matches L2.
5. `nextPhase()` stays a linear ORDER helper (not table-driven); `C->B`/`C->P` are
   replan/reject edges, not "next" edges — confirmed, no change there.
