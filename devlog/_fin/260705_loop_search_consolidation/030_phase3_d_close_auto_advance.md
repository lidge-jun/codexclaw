# 030 — Phase 3: D-Close Auto-Advance

## Objective
When `cxc orchestrate D` closes a PABCD cycle, automatically advance the
goalplan's work-phase cursor so the agent doesn't have to manually update it.

## File Change Map

### MODIFY `components/pabcd-state/src/goalplan.ts`

**NEW function after `validateGoalplan` (after line ~284):**
```typescript
/**
 * Advance the goalplan's work-phase cursor: mark the current activeWorkPhaseId
 * as `done` and set the next pending work-phase as active. Returns the mutated
 * plan (pure — caller persists). Returns null when there is nothing to advance
 * (no active phase, or no remaining phases).
 */
export function advanceWorkPhase(plan: Goalplan): Goalplan | null {
  if (!plan.activeWorkPhaseId) return null;
  const current = plan.workPhases.find((wp) => wp.id === plan.activeWorkPhaseId);
  if (!current) return null;

  // Mark current work-phase done, mark all its tasks done.
  current.status = "done";
  for (const task of current.tasks) task.status = "done";

  // Find the next pending work-phase.
  const next = plan.workPhases.find(
    (wp) => wp.status === "pending" && wp.id !== current.id
  );

  return {
    ...plan,
    activeWorkPhaseId: next?.id ?? null,
    workPhases: plan.workPhases.map((wp) => {
      if (wp.id === current.id) return { ...current };
      if (next && wp.id === next.id) return { ...wp, status: "in_progress" as const };
      return wp;
    }),
  };
}
```

### MODIFY `components/pabcd-state/src/orchestrate-cli.ts`

**Current D-close block (lines ~156-167):**
```typescript
  if (to === "D") {
    writeState(args.cwd, { ...clearedIdle(state), stopBlockPhase: null, stopBlockCount: 0 });
    appendLedger(args.cwd, {
      ts: new Date().toISOString(),
      sessionId: state.sessionId,
      from: state.phase,
      to: "IDLE",
      reason: "done",
      ...(args.attest?.did ? { evidence: args.attest.did } : {}),
    });
    return { code: 0, output: `orchestrate D: ${state.phase} -> IDLE (cycle closed, session ${sessionId})` };
  }
```

**After — add goalplan auto-advance after the D-close state write:**
```typescript
  if (to === "D") {
    writeState(args.cwd, { ...clearedIdle(state), stopBlockPhase: null, stopBlockCount: 0 });
    appendLedger(args.cwd, {
      ts: new Date().toISOString(),
      sessionId: state.sessionId,
      from: state.phase,
      to: "IDLE",
      reason: "done",
      ...(args.attest?.did ? { evidence: args.attest.did } : {}),
    });

    // D-close auto-advance: if a session-bound goalplan exists, mark the current
    // work-phase done and advance to the next pending one. FAIL-OPEN: a missing
    // or unreadable goalplan is silently skipped (the D-close still succeeds).
    if (state.slug) {
      try {
        const plan = readGoalplan(args.cwd, state.slug);
        if (plan) {
          const advanced = advanceWorkPhase(plan);
          if (advanced) {
            writeGoalplan(args.cwd, advanced);
            appendGoalplanLedger(args.cwd, state.slug, {
              ts: new Date().toISOString(),
              slug: state.slug,
              event: "workphase_done",
              detail: `auto-advanced from ${plan.activeWorkPhaseId ?? "none"} to ${advanced.activeWorkPhaseId ?? "none"}`,
            });
          }
        }
      } catch {
        // FAIL-OPEN: goalplan advance failure must not block the D-close.
      }
    }

    return { code: 0, output: `orchestrate D: ${state.phase} -> IDLE (cycle closed, session ${sessionId})` };
  }
```

**New imports at top of orchestrate-cli.ts:**
```typescript
import { readGoalplan, writeGoalplan, appendGoalplanLedger, advanceWorkPhase } from "./goalplan.ts";
```

### MODIFY `components/pabcd-state/src/orchestrate-apply.ts`

**Same auto-advance in the human D-close path (line ~93, the `to === "D"` block):**

The human D-close currently returns `{ ok: true, control: "done", state: clearedIdle(state) }`.
This is a PURE function that returns state for the caller to persist, so the auto-advance
must happen in the caller (hook.ts `handleOrchestrateCommand`), not here. But the caller
already persists state and ledger. Add the goalplan auto-advance after the state write in
`handleOrchestrateCommand` when `result.control === "done"`.

**In hook.ts `handleOrchestrateCommand` (after line ~288 where state is written for "done"):**
```typescript
  // done: chat D-close.
  if (result.control === "done") {
    // ... existing state write + ledger append ...

    // D-close auto-advance (same logic as orchestrate-cli.ts D path).
    if (state.slug) {
      try {
        const plan = readGoalplan(payload.cwd, state.slug);
        if (plan) {
          const advanced = advanceWorkPhase(plan);
          if (advanced) {
            writeGoalplan(payload.cwd, advanced);
            appendGoalplanLedger(payload.cwd, state.slug, {
              ts: new Date().toISOString(),
              slug: state.slug,
              event: "workphase_done",
              detail: `auto-advanced from ${plan.activeWorkPhaseId ?? "none"} to ${advanced.activeWorkPhaseId ?? "none"}`,
            });
          }
        }
      } catch {
        // FAIL-OPEN
      }
    }

    return buildContextOutput("UserPromptSubmit", withFooter(phaseDirective("D"), "IDLE"));
  }
```

**New imports in hook.ts:**
```typescript
import { readGoalplan, writeGoalplan, appendGoalplanLedger, advanceWorkPhase } from "./goalplan.ts";
```
(readGoalplan, nextOpenTask, unmetCriteria are already imported — add writeGoalplan,
appendGoalplanLedger, advanceWorkPhase.)

## Scope Boundary
- IN: goalplan.ts new function, orchestrate-cli.ts D-path, hook.ts D-path
- OUT: Stop hook enrichment (already works via readStopWorkContext), P-entry auto-start

## Accept Criteria
1. `advanceWorkPhase()` returns advanced plan with current phase done + next in_progress
2. `advanceWorkPhase()` returns null when no active phase or no remaining phases
3. `cxc orchestrate D` with a session-bound goalplan auto-advances the work-phase
4. `cxc orchestrate D` without a goalplan works identically to current behavior
5. Chat `orchestrate d` also auto-advances (human path)
6. Goalplan ledger records `workphase_done` event on auto-advance
7. FAIL-OPEN: goalplan read/write errors don't block the D-close
