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

---

## cli-jaw orchestrator internals (second sweep, folded from 011)

Evidence: 2 explorers reading `cli-jaw/src/orchestrator/*` against `pabcd-state/`.

> The attest gate is already DONE — codexclaw's `fsm.ts`/`attest.ts` are equal-or-stricter
> parity with cli-jaw's `attestation.ts` (same 4 forward edges P>A/A>B/B>C/C>D, same
> placeholder rejection; codexclaw additionally flips `auditPassed/checkPassed` only on a
> passing attest, which cli-jaw doesn't). The remaining items are the orchestrator
> *context* cli-jaw carries. Framed by the host-native boundary: cli-jaw is its own
> orchestrator/server, so it holds this context in a live `OrcContext` + DB. codexclaw is
> a Codex plugin, so the same context can only live as **project-local files + hook
> directives** — never a server, never a worker-monitor.

| cli-jaw 실측 | codexclaw 유무 | no-server import path |
| --- | --- | --- |
| `friction.ts:11-72` sha256(tool:error) ledger, count>=2 escalate / >=3 stop, oscillation `verdictHistory` | absent (grep 0) | **PostToolUse hook already fires** (`hook.ts:450`); replace the in-memory Map with `.codexclaw/friction.jsonl`, read verdict in Stop/PreToolUse. The one item that becomes a real E1/E2 runtime gate |
| `seed.ts:1-107` OntologyEntity/Field/Relationship + acceptanceCriteria/exitConditions + render + buildSeedFromEvidence | label only (`interview.ts:20` has the string `"ontology"`) | pure data transform; add `ontologySchema` to the interview tracker + port the render fn (feeds the freeze acceptance-criteria scaffolding above) |
| `workspace-context.ts:25-136` resolveWorkspaceRoot + buildResolvedPathHints (token->abs + exists/symlink-outside) + authoritative root block | absent (grep 0); prose in `pabcd/SKILL.md:98` | **NOT a project-root registry** (Codex owns cwd, host-native). The only residual is the *dispatch* path-hint: when the main agent spawns a subagent, resolve repo-path tokens to absolute + flag symlink-escape, injected via the spawn payload / UserPromptSubmit. Pure `existsSync`/`realpathSync` |
| `pipeline.ts:171-185` `## Approved Plan (authoritative)` auto-inlined into each dispatch (`orchestrate.ts:356`) | doctrine only (`20_pabcd_dispatch_doctrine.md:33`) | **runtime force is impossible** — a hook cannot author a subagent task body. Ceiling: persist the frozen plan to `.codexclaw/`, B-phase directive says "read the Approved Plan and inline it into every spawn", plus cli-jaw's 5-point consistency-guard text. E4+E7, never E3 |

### The three cleanest imports (pure function + file IO)

1. **Friction signature ledger + oscillation** — highest leverage. The PostToolUse hook is
   already wired and firing, so swapping cli-jaw's in-memory Map for `.codexclaw/friction.jsonl`
   restores retry->escalate->stop + the done/needs_fix oscillation guard. Becomes a real
   E1 (deny the repeat) / E2 (Stop escalate-block) gate, not prose.
2. **Workspace-context dispatch path-hint** — `existsSync`/`realpathSync` only; rides the
   spawn payload. Grounds the subagent in absolute paths without a project registry.
3. **Seed ontology schema + render** — absorb into the interview tracker as an
   `ontologySchema` field; makes the interview's "ontology" dimension a real artifact.

### Enforcement tier (orchestrator internals)

- Friction ledger -> **E1 + E2** (the real win; the rest is context, not enforcement).
- Workspace-context path-hint -> E5 (spawn payload) / E4 (directive).
- Seed schema -> E7 artifact feeding the existing freeze gate (E1).
- Plan auto-inject -> E4 directive + E7 guard text (runtime force impossible, stated plainly).

These fold into the same `L27` loop as the goalplan substrate above: friction first
(only new runtime gate, hook already exists), then workspace-context path-hint, then seed.
