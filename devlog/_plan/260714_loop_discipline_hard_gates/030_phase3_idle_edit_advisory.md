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
- Frequency guard: inject at most once per N tool calls (counter in state file,
  reuse the stop-block counter pattern, N=5) to avoid drowning the transcript.

## ADD hook registration `plugins/codexclaw/hooks/pre-tool-use-advising-idle-edit.json`

Matcher `^(apply_patch|Write|Edit)$`, PreToolUse, pointing at the new dist entry —
mirror the shape of `pre-tool-use-linting-apply-patch.json` (verify exact envelope/
command form from that file at B).

## TESTS

`test/idle-edit.test.ts`: IDLE + loopArmSeen → advisory injected; IDLE without
loopArmSeen and no goal → silent; phase B → silent; counter suppresses repeat; IO
error → silent (fail-open). `test/hook.test.ts`: loop-arm prompt sets `loopArmSeen`.

## Verification (C)

bun test; rebuild; standalone: feed a PreToolUse payload (tool_name apply_patch) with a
doctored IDLE+loopArmSeen state file → output contains `IDLE-EDIT`; exit 0 both ways.
