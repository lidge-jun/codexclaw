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

A durable `.codexclaw/goalplan.json` (project-local; the decomposed work-item state, NOT a
replacement for the thin host goal record):

```
goalplan.json
  objective, activeWorkPhaseId
  workPhases[]: { id, title, status, tasks[], criteria[] }
  criteria[]:  { id, scenario, expectedEvidence, capturedEvidence?, status }
  ledger[]:    append-only { kind, at, evidence?, rejectReason? }
```

- Written by the orchestrate CLI + `PostToolUse` receipts; read by `Stop`.
- goalplan is a parallel local artifact, NOT the host goal. The host `thread_goals` record only
  carries `{objective, status, token_budget}` — it has no workPhase/task/criterion/evidence shape,
  so goalplan stays the local backbone even when a host goal exists.

## Enforcement tier

E2 (Stop block on remaining work) + E8 (a `cxc goalplan validate` gate). Prose alone
(current state) is E7 and cannot hold the completion bar.

## Depends on / feeds

Substrate for `002` (evidence receipts) and `003` (Stop depth). Connects the dead
`freeze.ts` acceptance-criteria scaffolding to a live runtime.

---

## cxc-loop integration (ADDED 2026-07-01) — goalplan is the loop backbone

User decision: fold goalplan INTO `$cxc-loop` so "set a goal, then run the loop" is one
contract, not two disconnected pieces. The `loop/SKILL.md` prose contract (work-phase = one
PABCD cycle, D closes to IDLE, the agent self-advances) gets a durable state file behind it.

### The layering (what the codex-rs sweep settled)

The runtime exposes a real `setGoal` path — `Session::set_thread_goal`
(`core/src/goals.rs:435`, create-or-update; `create_thread_goal` at `:582`), reachable two
ways: the model tools `create_goal`/`update_goal`/`get_goal`
(`core/src/tools/handlers/goal/*`) and the **programmatic** app-server JSON-RPC
`thread/goal/{set,get,clear}` (`app-server/src/request_processors/thread_goal_processor.rs:30`,
params `ThreadGoalSetParams{thread_id, objective?, status?, token_budget?}`). The TUI `/goal`
slash rides the same set path. Constraints: `Feature::Goals` must be enabled, and a set is
bound to the current `conversation_id` (you arm your own thread's goal, not an arbitrary one).

So the earlier "codexclaw is read-only on the goal DB / cannot write it" framing was wrong on
capability — codexclaw simply does not write it today; the channel exists (the same app-server
route chat-search used for `thread/search`).

### Two layers, one loose coupling (LOCKED)

1. Host goal record = the **activation signal** (active / not) + `{objective, status,
   token_budget}`. Thin by design.
2. `.codexclaw/goalplan.json` = the **decomposition + evidence** (workPhases/tasks/criteria/
   ledger). The host has no field for any of this, so goalplan remains the backbone.

Coupling is **one-directional and loose**, NOT 1:1:
- goal active (host) → the cxc-loop contract fires; `Stop` reads goalplan remaining work.
- goalplan present (local) → `Stop` reads it; a host goal is NOT required (pure-HOTL local loop
  still runs).
- Never "goal active REQUIRES a goalplan" and never "goalplan REQUIRES a host goal." Either can
  exist alone; when both exist, the host record is the gate and goalplan is the content.

### Who may write the host goal (the gated exception)

`$cxc-loop` MAY call `thread/goal/set` ONLY at the interview **freeze approval boundary** — the
existing HITL gate where the user has already approved the frozen objective + acceptance
criteria. At freeze: persist the objective to the host goal (set), seed `goalplan.json` from the
frozen workPhases/criteria, and from then on the host goal-active signal drives the PABCD loop.

- NO mid-loop self-arming of a host goal. The whole guard stack (interview hard-deny,
  goal-budget gate) assumes "a goal means user-approved autonomy (HOTL)". Arming a goal without
  approval would blur that HITL boundary; freeze is the one place approval already exists.
- This realizes the user's model exactly: `$cxc-loop` sets the goal (at freeze), and a set/active
  `/goal` is what makes PABCD loop.

### Open decisions (for the L14 interview / before `$loop`)

1. goalplan init trigger: `$cxc-loop` skill entry, first `cxc orchestrate P`, or an explicit
   `cxc goalplan init`? (Leaning: seed at freeze, allow `cxc goalplan init` for the no-interview
   local-loop path.)
2. Roadmap numbering: absorb this into 030/040, or pin the `$cxc-loop` integration as its own
   decade (e.g. 035)? See roadmap.html footer.
3. `thread/goal/set` reach from codexclaw: confirm the app-server client used by `cxc-ops`
   (chat-search era) can issue `thread/goal/set` with the current `thread_id`, and gate on
   `Feature::Goals` being enabled (graceful skip if off).

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
