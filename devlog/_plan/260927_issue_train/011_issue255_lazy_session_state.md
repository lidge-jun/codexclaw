# #255 — Create session state on the first verified mutation

`SessionStart` must leave a new repository without `.codexclaw`. The first `cxc session bind`, `cxc orchestrate <mutating verb> --session <native-id>`, or `cxc loop init --session <native-id>` creates the state after the same native identity check. Reads and failed verification remain read-only.

Current anchors: `plugins/codexclaw/components/pabcd-state/src/hook.ts:572`, `plugins/codexclaw/components/pabcd-state/src/state.ts:368`, `plugins/codexclaw/components/pabcd-state/src/session-cli.ts:76`, `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:538`, `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:675`.

## File change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`

At `handleSessionStart` (`:567-576`), replace `ensureState(payload.cwd, payload.session_id)` with a read-only existing-file check, or simply remove it: the handler has no refresh work today. Keep its empty output. `ensureState` at `state.ts:368-410` creates `.codexclaw/sessions`; `readState` supplies a virtual default without writing (`state.ts:486-603`). Do not call `writeState` from SessionStart. If the hook needs to refresh an existing file in a later change, check existence and preserve its contents.

```diff
 export function handleSessionStart(payload: SessionStartPayload): string {
   if (payload.hook_event_name !== "SessionStart") return "";
-  ensureState(payload.cwd, payload.session_id);
   return "";
 }
```

Also protect ordinary UserPromptSubmit from minting state: `hook.ts:643-653` currently writes a memory-request marker before it knows whether a state file exists, and `:698-705` writes `loopArmSeen`. At `:630`, compute `const stateExists = sessionStateFileExists(payload.cwd, payload.session_id)` using the new read-only helper below. Guard each `writeState` in this handler with `stateExists`; on a missing file, allow context-only guidance but never persist `injectedTurns`, `loopArmSeen`, or the memory marker. A memory request still has to be enforced separately by the independent PreToolUse memory gate; the no-state case must deny rather than silently authorize. Add a test that a fresh normal prompt and a fresh loop-arm prompt leave `.codexclaw` absent. An explicit chat `orchestrate` command is a mutating hook path at `hook.ts:659-662`; on missing state it must emit a “run cxc session bind or verified cxc orchestrate” instruction and avoid calling `handleOrchestrateCommand`, which otherwise writes an unverified state.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/state.ts`

Expose a read-only existence helper beside private `statePath` (`:320-322`); `existsSync` is already imported. This prevents callers from accidentally defaulting a missing file into a write.

```ts
export function sessionStateFileExists(cwd: string, sessionId: string): boolean {
  return isCanonicalSessionId(sessionId) && existsSync(statePath(cwd, sessionId));
}
```

Do not change the exclusive-create `ensureState` algorithm (`:368-410`).

### MODIFY `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`

`runOrchestrateCli` requires explicit `--session` (`:519-535`) and currently rejects a missing file (`:538-548`). Replace only that missing-file branch. Reuse `resolveNativeSession(args.cwd, nativeEnv)` from `session-binding.ts:41-109`; require `native.ok`, exact `native.sessionId === sessionId`, and exact native cwd. Then call `ensureState(native.cwd, native.sessionId)` and inspect/read it. A reserved standalone `cli` key keeps its existing behavior. A mismatch, absent `CODEX_THREAD_ID`, missing/archived/subagent native row, wrong cwd, or malformed existing state fails before any mutation. `session-cli.ts:76-91` is the reference for verify → exclusive create → inspect. Status at `orchestrate-cli.ts:499-517` remains read-only.

Replace `orchestrate-cli.ts:543-548` with this complete block:

```ts
if (args.session && !sessionFileExists(args.cwd, sessionId) && !RESERVED_SESSION_KEYS.has(sessionId)) {
  const native = resolveNativeSession(args.cwd, nativeEnv);
  if (!native.ok || native.sessionId !== sessionId) {
    return { code: 1, output: `orchestrate ${args.verb}: native session verification failed; nothing was written` };
  }
  try { ensureState(native.cwd, native.sessionId); }
  catch { return { code: 1, output: `orchestrate ${args.verb}: could not create session state; nothing was written` }; }
  const checked = inspectState(native.cwd, native.sessionId);
  if (!checked.ok || !checked.stateExists) {
    return { code: 1, output: `orchestrate ${args.verb}: session state invalid after creation; nothing was written` };
  }
}
```

`inspectState` is currently private (`session-cli.ts:13`); export it and import it into `orchestrate-cli.ts`, along with `ensureState`. This reuses the raw regular-file/symlink and session-id checks that `session bind` performs. Do not invent a second native verifier. Preserve `resolveSessionSource` before phase writes (`orchestrate-cli.ts:568-572`).

### MODIFY `plugins/codexclaw/components/pabcd-state/src/session-cli.ts`

Change `function inspectState` at `:13` to `export function inspectState` without changing its body. `session bind` already calls it before and after exclusive creation (`:76-91`).

### MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts`

The bound `init` path checks source identity at `:669-679`, then writes the plan and finally writes default session state at `:681-699`. Move native verification plus exclusive state creation before `writeGoalplan` so rejected identities leave neither plan nor state. Use the same `resolveNativeSession` contract and exact session/cwd match; skip this step for unbound `init` to preserve its local-artifact behavior (`:672-674`). After creation, preserve source identity checking and the existing slug binding. The `runGoalplanCli` signature needs injectable `nativeEnv: NodeJS.ProcessEnv = process.env` for focused tests, or a shared verified-create helper that both CLIs call. A helper belongs in `session-binding.ts`, which already owns native verification; no copy of SQLite logic.

Change the `runGoalplanCli` signature at `:651` to `runGoalplanCli(args: GoalplanCliArgs, nativeEnv: NodeJS.ProcessEnv = process.env)`. Replace the bound-session check block at `:675-680` with this complete block, leaving `writeGoalplan` at `:686` and slug binding at `:695-698` in place:

```ts
if (typeof args.session === "string" && args.session.length > 0) {
  const native = resolveNativeSession(args.cwd, nativeEnv);
  if (!native.ok || native.sessionId !== args.session) {
    return { output: "loop init: native session verification failed; nothing was written", code: 1 };
  }
  const before = inspectState(native.cwd, native.sessionId);
  if (!before.ok) return { output: `loop init: ${before.error}; nothing was written`, code: 1 };
  const gate = checkBoundSourceIdentity(args.cwd, args.session);
  if (!gate.ok) return { output: `loop init: ${gate.reason}\nNothing was written.`, code: 1 };
  try { ensureState(native.cwd, native.sessionId); }
  catch { return { output: "loop init: could not create session state; nothing was written", code: 1 }; }
  const after = inspectState(native.cwd, native.sessionId);
  if (!after.ok || !after.stateExists) {
    return { output: "loop init: state invalid after creation; nothing was written", code: 1 };
  }
}
```

Import `resolveNativeSession` from `session-binding.ts`, `inspectState` from `session-cli.ts`, and `ensureState` from `state.ts` at `goalplan-cli.ts:40-48`. Existing `cli.ts:171` passes no second argument and therefore uses the live environment. Any synthetic-ID `loop init --session` tests must create a native fixture or expect rejection; only unbound init retains its old no-native path.

### READ ONLY `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts`

`runMapAffordanceSessionStart` is context-only (`:296-337`) and does not call `recoveryPath`. `recoveryPath` can create `.codexclaw/affordance-recovery` at `:241-249` only for `runPostCompactAffordance` (`:257-265`), not SessionStart. Keep this distinction and add a regression check; no production diff needed unless the branch discovers another SessionStart call to `recoveryPath(..., true)`.

### No production change: recall and bg-wake

Recall SessionStart builds context at `recall/src/hook.ts:699-737`; its index writes are under the user's home, not the cwd `.codexclaw` (`recall/src/index-db.ts:5-22,93`). `bg-wake/src/hook.ts:114-127` calls orphan adoption. `bg-wake/src/registry.ts:236-249` only writes when `listRecords` finds an existing terminal undelivered record, so a cwd with no `.codexclaw` creates nothing; retain adoption because it preserves completed background work across restart. Assert empty-directory behavior in tests. `cxc-ops` PostCompact marker is a separate event and may still create a recovery directory (`map-affordance.ts:257-265`).

### MODIFY tests

- `plugins/codexclaw/components/pabcd-state/test/state.test.ts:27-68`: rename the test to `ensureState: first verified mutation creates exact default state`; keep its exact default/temporary-file assertions. Add `SessionStart: fresh cwd remains without .codexclaw`, call `handleSessionStart`, assert empty output and `existsSync(join(cwd, STATE_DIR)) === false`; this fails before the fix.
- `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts`: `missing native state is created by matching verified orchestrate mutation`; `unknown explicit id or wrong cwd leaves .codexclaw absent`; `status missing state stays read-only`. Each must inspect exact state file and exit code. Existing native fixture helpers should be reused.
- `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`: `bound loop init verifies native identity before plan/state writes`; assert wrong ID leaves both paths absent and matching ID creates both. This fails today because the bound path writes a default state without native verification.
- `plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts`, `plugins/codexclaw/components/bg-wake/test/hook.test.ts`: call SessionStart in an empty cwd and assert no `.codexclaw` exists.

## Activation and bypass record

Fresh SessionStart, resumed SessionStart with an existing state, fresh prompt, first valid mutation, invalid native ID/cwd/source, two concurrent creators, and empty bg/recall/map hooks must each be exercised. Native verification tier: CLI boundary; executing surface: `session bind`, orchestrate, bound loop init; known bypass: a direct library caller can still call `writeState`, and hook payloads are not independently authenticated; residual risk: same-user tampering with the native DB/env; wording: “verified CLI first mutation,” not a universal security boundary. Final enforcement layer is each mutating CLI entry. No relocation of `.codexclaw`, blanket ignore rule, or new SessionStart write.
