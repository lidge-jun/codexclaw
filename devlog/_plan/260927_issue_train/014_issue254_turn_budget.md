# #254 — Reset the absolute Stop cap per genuine user turn

Keep `MAX_STOP_BLOCKS_TOTAL = 24`, but count within one real user turn. A new `UserPromptSubmit` `turn_id` resets the total once; Stop-hook continuations do not reset it. On the 25th attempted block, release with one nonblocking `systemMessage` explaining the cap.

Current anchors: `plugins/codexclaw/components/pabcd-state/src/state.ts:136`, `plugins/codexclaw/components/pabcd-state/src/hook.ts:624`, `plugins/codexclaw/components/pabcd-state/src/hook.ts:1459`, `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts:1036`.

## Runtime proof

Codex Stop converts `decision:block` to continuation fragments (`/tmp/cxc-perm/codex-src/codex-rs/hooks/src/events/stop.rs:319-391`). The core records those fragments as a response item and continues the same turn (`/tmp/cxc-perm/codex-src/codex-rs/core/src/session/turn.rs:666-683`). UserPromptSubmit is invoked for `TurnInput::UserInput`; a `ResponseItem` receives no such hook (`/tmp/cxc-perm/codex-src/codex-rs/core/src/hook_runtime.rs:682-707`). Thus resetting on a changed UserPromptSubmit `turn_id` excludes Stop continuations in this runtime. The persisted turn ID still protects against duplicate prompt events. If a future native runtime changes this routing, a continuation-origin flag must be added before changing the budget rule.

## File change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/state.ts`

Add `stopBlockTurnId: string | null` next to `stopBlockTotal` in `State` (`:135-137`), default it to `null` beside `stopBlockTotal: 0` (`:299-301`), and reconstruct a nonempty string or `null` beside `:551-554`. `writeState` already serializes the whole state (`:607-615`); no new writer needed. Old files reconstruct `null`, and a missing `turn_id` does not reset an existing budget.

```diff
 stopBlockTotal: number;
+/** Last genuine UserPromptSubmit turn whose total was reset. */
+stopBlockTurnId: string | null;

 stopBlockTotal: 0,
+stopBlockTurnId: null,

 stopBlockTotal:
   typeof parsed.stopBlockTotal === "number" && Number.isFinite(parsed.stopBlockTotal) && parsed.stopBlockTotal >= 0
     ? Math.floor(parsed.stopBlockTotal) : 0,
+stopBlockTurnId: typeof parsed.stopBlockTurnId === "string" && parsed.stopBlockTurnId.length > 0
+  ? parsed.stopBlockTurnId : null,
```

The numeric branch above is the existing inline validation at `state.ts:551-554`.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`

In `handleUserPromptSubmit` at `:629-653`, read state before branch-specific writes. After the existing memory-write marker step (which may update state), re-read state, then reset only when `turn !== ""`, the state file already exists, and `state.stopBlockTurnId !== turn`. Persist `{ ...state, stopBlockTotal: 0, stopBlockTurnId: turn }`, then use this fresh snapshot in the rest of the handler. Do the reset before the `injectedTurns` dedupe, but the persisted turn ID makes a duplicate event a no-op. Do not clear `stopBlockCount`, `stopMetricCursor`, or work-phase progress. For a fresh cwd without a session file, honor #255: no reset write; first verified mutation creates default state, and a later genuine prompt stamps the next turn.

```ts
let state = readState(payload.cwd, payload.session_id);
if (turn && sessionStateFileExists(payload.cwd, payload.session_id) && state.stopBlockTurnId !== turn) {
  state = { ...state, stopBlockTotal: 0, stopBlockTurnId: turn };
  writeState(payload.cwd, state);
}
if (turn && state.injectedTurns.includes(turn)) return "";
```

Use `sessionStateFileExists` added in `011`; do not infer existence from `readState`, which returns a default for absent files (`state.ts:486-603`). Place the reset after `hook.ts:643-651` memory marker so a later spread cannot overwrite either field. `bumpStopCounter` at `hook.ts:1459-1479` continues to increment `stopBlockTotal` for each Stop and release when `nextTotal > MAX_STOP_BLOCKS_TOTAL`. Change its return to distinguish `"phase-cap"` and `"total-cap"`, so only the absolute-cap release emits a message. Every caller at `hook.ts:1791,1810` must handle either release code.

```diff
-if (nextCount > MAX_STOP_BLOCKS || nextTotal > MAX_STOP_BLOCKS_TOTAL) {
+if (nextCount > MAX_STOP_BLOCKS || nextTotal > MAX_STOP_BLOCKS_TOTAL) {
   writeState(cwd, { ...state, ...carry, stopBlockPhase: null, stopBlockWorkPhaseId: null, stopBlockCount: 0 });
-  return "release";
+  return nextTotal > MAX_STOP_BLOCKS_TOTAL ? "total-cap" : "phase-cap";
 }
```

For `total-cap`, return `JSON.stringify({ systemMessage: "CodexClaw Stop continuation cap (24) reached for this user turn; releasing." })` plus newline. Do not include `decision:block`, `continue:false`, or `stopReason`. The universal Stop output accepts `systemMessage` (`/tmp/cxc-perm/codex-src/codex-rs/hooks/src/schema.rs:90-99,455-464`); the runtime records it as a Warning without blocking (`/tmp/cxc-perm/codex-src/codex-rs/hooks/src/events/stop.rs:277-293`). A phase-cap returns `""` as before.

### MODIFY tests

- `plugins/codexclaw/components/pabcd-state/test/state.test.ts`: extend the exact default object at `:34-62` with `stopBlockTurnId: null`; add `stopBlockTurnId round trips and malformed value becomes null`. This fails before the field exists.
- `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts`: update `050 S10/S14: the absolute cap holds against forged progress` at `:1036-1053` to parse the 25th output as a nonblocking `systemMessage`, assert no `decision`, assert `stopBlockTotal === 25`, and ensure earlier 24 blocks remain bounded even with improving metrics.
- Add `absolute Stop cap resets once on new real UserPromptSubmit turn`: seed an existing session with total 24 and turn `old`; send prompt with `turn_id: new`; assert total 0 and `stopBlockTurnId === "new"`; repeat same prompt and assert total stays after a Stop; another new turn resets again. This fails today because total never resets.
- Add `Stop continuation never invokes reset path`: call Stop repeatedly with the same turn but no new UserPromptSubmit, including progress records, assert 25th releases. This is the local behavioral approximation of the native routing proof above.

## Activation and bypass record

Exercise absent turn ID, duplicate turn ID, new turn ID, old-schema state, missing state, same-turn continuation, per-phase cap, and absolute cap. Tier: PABCD Stop-hook limit. Executing surface: UserPromptSubmit bookkeeping plus Stop decision. Known bypass: direct state edits or a native implementation that routes internal response items as user input; residual risk: future Codex runtime routing drift. Wording: “24 blocks per observed genuine user turn on the verified runtime.” Final enforcement layer: Stop `bumpStopCounter`. Out of scope: changing the 24/3 constants, host model retry budgets, or native Codex code.
