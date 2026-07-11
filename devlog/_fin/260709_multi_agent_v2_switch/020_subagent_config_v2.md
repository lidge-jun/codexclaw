# 020 — subagent-config v2 payloads

## Scope

IN: `components/subagent-config/src/spawn-wrapper.ts`, `test/spawn-wrapper.test.ts`.
OUT: `spawn-attach-hook.ts` behavior (already v1+v2 safe: message mention channel,
`isFullHistoryFork` handles v2 `fork_turns`; verified against source this unit) —
only its header comment gets a one-line doctrine update if needed. `store.ts`
unchanged (effort validation is surface-agnostic).

## Verified constraints (codex-rs)

- v2 `spawn_agent` params: required `task_name` (lowercase letters/digits/underscores)
  + `message` (encrypted); optional `agent_type`, `fork_turns` ("none"|"all"|"N"),
  `model`, `reasoning_effort`, `service_tier`. `deny_unknown_fields`: `items` rejected.
- Full-history fork (fork_turns omitted/"all") rejects model/effort/agent_type
  overrides — hook guard already covers this.

## Diffs

### MODIFY spawn-wrapper.ts

1. NEW `taskNameForRole(role, task)` — derive a v2-legal task_name:
   sanitize `${role}_${first 3 task words}` to `[a-z0-9_]`, collapse repeats,
   trim `_`, cap ~40 chars, fallback `${role}_task`. Pure, deterministic.
2. MODIFY `SpawnPayload`: add `task_name: string` (required going forward);
   `items?` field stays typed but DEPRECATED for dispatch (v2 rejects it).
3. MODIFY `buildSpawnPayload`: also set `task_name: taskNameForRole(role, task)`
   AND `fork_turns: "none"` (AUDIT FOLD-BACK, blocker 1): v2 defaults `fork_turns`
   to full-history, and a full-history fork REJECTS `agent_type`/`model`/
   `reasoning_effort` overrides (multi_agents_v2/spawn.rs fork_mode +
   reject_full_fork_spawn_overrides). codexclaw role dispatches are fresh-context
   spawns (role prompt + task travel in `message`), so `"none"` both preserves the
   v1 fresh-spawn semantics and keeps the role's agent_type/model/effort legal.
   `SpawnPayload` gains `fork_turns: "none"` as a fixed field of the builder path.
4. MODIFY `resolveSpawnPayloadWithSkills`: STOP attaching `items`; instead prepend
   `buildSkillMentionBlock(...)` (+ path-hint text from `buildPathHints`) to
   `message`. Same skills, v2-legal channel. `buildSpawnItems` stays exported for
   the v1 fallback path but its doc comment states v2-primary policy.
5. MODIFY `routeDispatch` (AUDIT FOLD-BACK, blocker 2): the intent dispatcher
   currently returns a v1 `{ role, items }` shape (spawn-wrapper.ts:442-456). It
   switches to returning the v2 payload from the amended
   `resolveSpawnPayloadWithSkills` (mention-block message, task_name,
   fork_turns:"none", no items). Its tests (spawn-wrapper.test.ts:291+) update to
   assert the v2 shape.

### MODIFY test/spawn-wrapper.test.ts

- NEW cases: `taskNameForRole` sanitization (spaces/Korean/symbols -> `_`, cap,
  fallback); `buildSpawnPayload` includes v2-legal `task_name`;
  `resolveSpawnPayloadWithSkills` has NO `items`, mentions present in `message`,
  role prompt still first; every builder payload carries `fork_turns: "none"`.
- MODIFY the two L15 items-in-payload assertions to the mention-channel shape.
- MODIFY routeDispatch cases to the v2 payload shape (no items).

## Activation scenario

`bun test` drives `resolveSpawnPayloadWithSkills` and asserts `"items" in payload
=== false` plus mention block present — that IS the trigger for the new branch.
