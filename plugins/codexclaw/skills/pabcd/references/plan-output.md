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
| Escalation condition | What requires main/user direction. If delegation is planned, state both directions: main reclaims a slice after two distinct agents fail its packet (DISPATCH-RETIRE-01); pushing a slice to a worker requires a P-phase amendment, never a mid-B improvisation. |

HOTL goal plans also state the cxc-loop resource bounds. Follow the live host
goal-tool contract; do not invent a token or time budget that the user did not set.

Scope restrictions remain authoritative. If a plan-only/no-tests request forbids
running a proposed verifier, record NOT RUN and the reason; do not fabricate an
exit code or treat the plan as implementation proof. Likewise, naming a memory
artifact or escalation path does not authorize a file write, host goal, dispatch,
phase transition or external action.

Before returning the plan, check the nine concepts and the phase-plan owner's
file map, scope, conditional-path evidence and source-of-truth requirements.
Reading this reference is not proof that those requirements appear in the result.
