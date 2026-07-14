# 030 — Phase 3: IDLE-Edit PreToolUse Advisory (wp3)

Goal: editing files while the FSM is un-armed becomes VISIBLE. Advisory first (inject
context, never deny) — promoted to deny only after observation, because legitimate
C0/C1 fast-path edits outside ceremony are allowed by UNIT-RESIDENCE-01.

STALENESS NOTE: re-verify against tree after wp1/wp2 land.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/comment-lint.ts` — NO

Wrong home: comment lint is deliberately fail-open and FSM-blind (R-9 note, line ~10).
Keep separation.

## ADD `plugins/codexclaw/components/pabcd-state/src/idle-edit.ts`

```ts
/** IDLE-EDIT-ADVISORY-01: PreToolUse on apply_patch/Write/Edit. Reads the session's
 *  FSM state; when phase===IDLE && !orchestrationActive AND a native goal is active
 *  OR the session saw a loop-arm request this session (state flag from wp1's
 *  detectLoopArmRequest hit, persisted as `loopArmSeen: true`), inject additionalContext:
 *  "[codexclaw IDLE-EDIT] You are editing files with the PABCD FSM un-armed while a
 *  loop/goal is expected. If this edit belongs to loop work, arm first:
 *  cxc orchestrate status --session <id> -> P. C0/C1 fast-path edits: leave the
 *  numbered record doc (UNIT-RESIDENCE-01)." Never denies; fail-open on IO errors. */
```

Key design points:

- Persist `loopArmSeen` in the session state file when `detectLoopArmRequest` fires
  (MODIFY `state.ts` schema + `hook.ts` UserPromptSubmit branch): the advisory then
  targets exactly the sessions where the user asked for a loop — no noise on ordinary
  patch turns. Goal-active is the second trigger (covers HOTL).
- AUDIT ROUND 1 blocker #6: `readState` does STRICT reconstruction (state.ts:137) —
  unknown keys are dropped. `loopArmSeen` must be wired into `defaultState` AND the
  reconstruction block, or it is silently discarded on every read. Old session files
  read as `false` (backward-compatible). Also: the loop-arm hook branch persists state
  only when `turn_id` is truthy (hook.ts:443) — decide at this phase's P whether to
  persist the flag outside that guard or accept the turnless-payload loss.
- wp3-cycle P DECISIONS (anchors re-verified 2026-07-14): (a) persist `loopArmSeen`
  OUTSIDE the turn guard — the un-armed loop-arm branch (hook.ts:449-455) writes state
  whenever `loopArmRequested`, with `injectedTurns` still turn-guarded; (b) second
  state field `idleEditNudges: number` implements the frequency guard (inject on
  count % 5 === 0, increment every gated edit call); (c) new fail-open cli.ts event
  `pre-tool-use-idle-edit` (mirrors `pre-tool-use-lint` at cli.ts:184), registered by
  new hooks/pre-tool-use-advising-idle-edit.json with matcher `^(apply_patch|Write|Edit)$`;
  (d) goal-active trigger reads goal-active.ts read-only, fail-open.
- Frequency guard: inject at most once per N tool calls (counter in state file,
  reuse the stop-block counter pattern, N=5) to avoid drowning the transcript.

## ADD hook registration `plugins/codexclaw/hooks/pre-tool-use-advising-idle-edit.json`

Matcher `^(apply_patch|Write|Edit)$`, PreToolUse, pointing at the new dist entry —
mirror the shape of `pre-tool-use-linting-apply-patch.json` (verify exact envelope/
command form from that file at B).

AUDIT ROUND 2 (wp3 round 1, FAIL) folds:

- **Activation wiring (High)**: the JSON file alone is INERT — `plugin.json`'s hooks
  array is the activation authority. Required: plugin.json hooks entry, hook-e2e
  `manifest.hooks.length` 14 → 15, and `cxc hooks retrust` before live verification
  at C (config.toml trust hashes).
- **Mode-1 precedence (Med)**: set `loopArmSeen` in the trigger-branch write
  (hook.ts:430-441) too, whenever `loopArmRequested` — "plan this and loop until
  done" must not drop the flag.
- **Lifecycle (Med)**: `cxc orchestrate reset` (CLI + chat) CLEARS both fields
  (operator stand-down = advisory off); D-close RETAINS `loopArmSeen` (multi-cycle
  re-arm nudge is the feature) and resets `idleEditNudges`.
- **Envelope (Low, PINNED)**: output MUST be
  `hookSpecificOutput { hookEventName: "PreToolUse", permissionDecision: "allow",
  additionalContext: "[codexclaw IDLE-EDIT] ..." }` — allow+permissionDecisionReason
  (friction-gate shape) is model-INVISIBLE; only additionalContext reaches the model
  on non-deny (proven against codex-rs pre_tool_use.rs:226-230 / hook_runtime.rs:196,595).
- **Fail-open mapping (Low)**: goal-active "unreadable" counts as INACTIVE (silent) —
  inverts goal-active.ts's fail-closed caller note, deliberately. Short-circuit: read
  session state first; open sqlite only when phase===IDLE && !orchestrationActive &&
  !loopArmSeen.
- **Counter race (Low, accepted)**: last-writer-wins on parallel edits may lose an
  increment or duplicate one advisory — cosmetic, fail-open, no locking.

## Ship/track requirements (round-2 residual, wp2-High-#2 class)

`dist/` is gitignored wholesale and dist-freshness skips untracked files. At D:
`git add -f plugins/codexclaw/components/pabcd-state/dist/idle-edit.js`; at C:
`git ls-files --error-unmatch` on that file — otherwise a fresh clone's
`dist/cli.js` import of `./idle-edit.js` breaks EVERY hook event.

## TESTS (audit round folds applied)

- `test/idle-edit.test.ts` (NEW): IDLE + loopArmSeen → advisory injected
  (additionalContext, allow); IDLE without loopArmSeen and no goal → silent; phase
  B → silent; counter suppresses (only every 5th); IO error → silent (fail-open).
- `test/hook.test.ts`: loop-arm prompt sets `loopArmSeen` on BOTH the un-armed branch
  and the mode-1 trigger branch.
- `test/state.test.ts`: update hand-written State literals (deepEqual asserts) for the
  two new fields; reconstruction cases — old file without fields reads loopArmSeen=false
  / idleEditNudges=0; invalid values coerced to defaults.
- `plugins/codexclaw/test/hook-e2e.test.mjs`: hooks length 14 → 15.

## Verification (C)

bun test; rebuild; standalone: feed a PreToolUse payload (tool_name apply_patch) with a
doctored IDLE+loopArmSeen state file → output contains `IDLE-EDIT`; exit 0 both ways.
