# 001 — Loop / Goalplan / Quality-Gate State

Gap class: HARNESS (durable state) · evidence: explorer Darwin

> omo's loop is a durable plan with per-criterion evidence and a real quality gate.
> codexclaw's loop is a single FSM plus prose. This is the substrate every other loop
> reinforcement (Stop depth, evidence gate) builds on.

## Parity table

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 |
| --- | --- | --- | --- |
| `ulw-loop/src/domain-types.ts:58` (`UlwLoopPlan`: briefPath/goalsPath/ledgerPath/activeGoalId/goals[]/aggregateCompletion) | `pabcd-state/src/state.ts:18` (`State`: phase + flags + counters) | omo has a goal list / work-item graph; codexclaw has only the FSM | add a separate durable `.codexclaw/goalplan.json`; `UserPromptSubmit` mutates steering, `Stop` reads remaining work-phases |
| `domain-types.ts:12` (criterion: scenario/userModel/expectedEvidence/capturedEvidence/status/capturedAt/notes) | `freeze.ts:28` (`acceptanceCriteria: string[]`) | omo carries per-criterion runtime status + evidence slots; codexclaw has bare strings | `PostToolUse` appends criterion evidence receipts; `Stop` blocks D-close until required criteria met |
| `domain-types.ts:101` + `quality-gate.ts:140` (codeReview/manualQa/gateReview/iteration/criteriaCoverage, artifact non-empty check) | `goalplan/SKILL.md:15` (prose "quality gate") | omo validates artifact existence + non-empty in code; codexclaw has no schema/validator | a `.codexclaw/quality-gate.json` read just before D; `Stop` validates artifact paths non-empty before allowing close |
| `ulw-loop/src/checkpoint.ts:154` (evidence non-empty, goal snapshot reconcile, ledger append) | `state.ts:35` (phase-transition log only) | omo has a checkpoint object; codexclaw has a thin transition ledger | append checkpoint JSON before `D` entry |
| `steering-types.ts:25` + `steering.ts:106` (proposal/audit: evidence/rationale/before/after/idempotencyKey/invariant; rejects protected payload + weakened completion) | `goalplan/SKILL.md:17` (prose) | omo rejects weakening edits in code; codexclaw only asks in prose | `UserPromptSubmit` parses a `cxc goalplan steer:` directive, mutates plan, logs rejects to ledger |
| `checkpoint.ts:94` (blocker signature/occurrence/external-decision/`needs_user_decision` promotion) | `state.ts:35` (no blocker accumulation) | omo states repeated blockers; codexclaw does not | `Stop` counts repeated blockers from the goalplan ledger; promotes reason to "needs decision" at threshold |

## Reinforcement shape (no-server)

A durable `.codexclaw/goalplan.json` (project-local, never the goal DB):

```
goalplan.json
  objective, activeWorkPhaseId
  workPhases[]: { id, title, status, tasks[], criteria[] }
  criteria[]:  { id, scenario, expectedEvidence, capturedEvidence?, status }
  ledger[]:    append-only { kind, at, evidence?, rejectReason? }
```

- Written by the orchestrate CLI + `PostToolUse` receipts; read by `Stop`.
- codexclaw stays read-only on `thread_goals`; goalplan is a parallel local artifact.

## Enforcement tier

E2 (Stop block on remaining work) + E8 (a `cxc goalplan validate` gate). Prose alone
(current state) is E7 and cannot hold the completion bar.

## Depends on / feeds

Substrate for `002` (evidence receipts) and `003` (Stop depth). Connects the dead
`freeze.ts` acceptance-criteria scaffolding to a live runtime.
