# #253 — Release an unbound active goal at IDLE

An active host goal alone must not make an IDLE PABCD session block Stop. The IDLE arming block applies only when `state.slug` resolves to a bound goalplan. A missing state or empty slug releases without creating state or advancing a counter.

Current anchors: `plugins/codexclaw/components/pabcd-state/src/hook.ts:1392`, `plugins/codexclaw/components/pabcd-state/src/hook.ts:1787`, `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts:506`, `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts:567`.

## File change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`

`handleStop` reads virtual state at `:1774`, determines `goalActive` and `inFlight` at `:1781-1782`, then calls `bumpStopCounter` for every active IDLE goal at `:1787-1793`. `safeReadBoundGoalplan` (`:1392-1396`) is the existing path-safe reader. Put its check before context-pressure inspection and counter write. This treats a stale/nonexistent slug as unbound rather than generating a false block.

```diff
 if (!inFlight) {
   if (!goalActive) return "";
+  if (!state.slug || !safeReadBoundGoalplan(payload.cwd, state.slug)) return "";
   if (isContextPressureTail(readTranscriptTail(payload.transcript_path))) return "";
   if (bumpStopCounter(payload.cwd, state) === "release") return "";
   return buildGoalIdleBlock(payload.cwd, state, payload.session_id, platform);
 }
```

Update the stale comments at `hook.ts:1646-1653,1760-1766` so they no longer say unbound goals receive `cxc loop init` or that the Stop counter bootstraps state. Bound empty goalplans remain bound and continue to get the “register workPhases” guidance (`hook.ts:1687`). Do not change the in-flight B/C continuation branch at `:1801-1815`.

### MODIFY `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts`

- Replace `GOAL-IDLE-CONTINUE-01: active goal at IDLE blocks with the arming command` at `:506-529` with `GOAL-IDLE-CONTINUE-01: active goal without bound plan releases without state write`. Keep the active host goal fixture, assert `handleStop(...) === ""`, `existsSync(join(cwd, ".codexclaw")) === false`, and a second call remains silent. This fails before the fix because the first call blocks and writes state.
- Existing win32 and bounded tests at `:535-565` currently use unbound state. Bind a real plan/slug before calling Stop; retain their platform and cap assertions. Otherwise they would contradict the new contract.
- Keep the bound-plan case at `:567-587` and the bound-empty case at `:589-600`. Add `GOAL-IDLE-CONTINUE-01: stale slug releases without counter write`: write state with a nonexistent slug and `stopBlockTotal: 7`, call Stop, assert empty output and unchanged total.

## Activation and bypass record

Exercise no state, unbound state, stale slug, bound populated plan, bound empty plan, active/inactive goal, win32 recipe, and in-flight phase. Tier: Stop-hook continuation control. Executing surface: `handleStop`. Known bypass: other hooks or host goal policies can continue a turn independently. Residual risk: unreadable plan releases because it cannot establish a binding. Wording: “PABCD's IDLE block requires a resolvable bound plan.” Final enforcement layer: Stop handler. Out of scope: changing host-goal completion semantics or `GOAL-COMPLETE-GATE-01`.
