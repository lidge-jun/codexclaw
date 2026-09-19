# Plan output contract

Read for C2+ P-phase plans, including plan-only requests. Begin the plan with a
compact loop-spec header making all nine concepts below explicit. A short sentence
may cover several fields; no verbose fixed format is required, but brevity must
not silently remove a field.

| Field | Required content |
| --- | --- |
| Loop archetype | The loop shape selected for the problem, such as satisfy-spec or open-ended optimization. |
| Trigger | The actual request or condition starting this scoped work. |
| Goal | The user-visible outcome. |
| Non-goals | What this plan excludes, including explicit execution restrictions. |
| Verifier | The command/gate and what it observes. Name reachable triggers and observable effects for planned conditional paths. |
| Stop condition | When the authorized work ends; plan-only stops after returning the requested plan. |
| Memory artifact | Where the plan/evidence is recorded. For a no-file request, name this returned plan rather than creating a file. Authorized persistent execution still follows the implementation-unit record rules. |
| Expected terminal outcomes | What success, unresolved requirements or blocked execution would mean for this scope. Report outcomes are not new FSM phases or host goal statuses. |
| Escalation condition | What requires main/user direction. Delegation plans follow DISPATCH-RETIRE-01: without managed dispatch, main reclaims after two distinct agents fail the same packet, once prior work is stopped. With [configured first fallback](delegation.md#configured-first-fallback), the returned action governs recovery: only `main-direct` permits reclaim; `reconcile`/`stop` permit neither reclaim nor replacement. Pushing a slice to a worker requires a P-phase amendment, never a mid-B improvisation. |

HOTL goal plans also state the cxc-loop resource bounds. Follow the live host
goal-tool contract; do not invent a token or time budget that the user did not set.

Scope restrictions remain authoritative. If a plan-only/no-tests request forbids
running a proposed verifier, record NOT RUN and the reason; do not fabricate an
exit code or treat the plan as implementation proof. Likewise, naming a memory
artifact or escalation path does not authorize a file write, host goal, dispatch,
phase transition or external action.

## Architect consultation

Formal P follows the [Plan phase owner](phase-plan.md#architect-consultation-for-formal-p),
including C2 compact and plan-only P plans. Keep a compact record in the existing
plan, using summaries and evidence references rather than copying conversation
transcripts:

- The actual returned architect handle and proposal reference, with its design
  decision IDs.
- Main's acceptance, rejection or amendment of each decision, with a short reason.
- The concrete executable-plan path/revision sent to that same architect.
- The reflection response reference, `ALIGNED` or `MISALIGNED`, and any remaining
  gaps with main's dispositions. Resolve material gaps before independent A audit.

An explicit user limit such as no delegation is a disclosed consultation gap.
A failed call or unavailable required role remains unmet consultation; recording
the reason does not make it complete. Follow the existing
[routing and failure owner](delegation.md#architect-context-and-routing).
C0/C1 fast-path work requires neither consultation nor this record. Main owns
the executable plan and final decisions; architect reflection is not A review.

## Reader summary

A C2+ unit's `000_plan.md` opens with a reader-facing summary per
[Reader documents](../../dev/references/reader-documents.md) READER-DOC-02: the
problem, the answer this unit gives, and what changes for whom, in one short
paragraph before the loop-spec fields. Research and evidence stay in the 00x docs
and evidence/ (LEXICO-SPLIT-01 is unchanged); the summary links them.

Before returning the plan, check the nine concepts and the phase-plan owner's
file map, scope, conditional-path evidence and source-of-truth requirements.
Reading this reference is not proof that those requirements appear in the result.
