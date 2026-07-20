# messenger-bridge — Phase 3 tool-progress modes and notification policy

Status: P (design) · class C3 · implementation not started

## Loop-spec header

- **Loop archetype:** spec-satisfaction
- **Goal:** add Hermes-parity `tool_progress` modes (`off`, `new`, `all`,
  `verbose`) as a persisted named-agent setting, backed by lifecycle-aware
  runner events and enforced consistently by every attended Telegram and
  Discord progress renderer and retry path.
- **Non-goals:** token-level assistant streaming; changing Codex execution
  transport; per-binding overrides; adding the setting to `connect-routes.ts`
  or `cli.ts`; changing heartbeat/autonomous delivery.
- **Verifier:** `npm test` + `npm run build` from the repository root, followed
  by the four-mode cross-platform checklist below.

## Chosen direction

First make runner tool events lifecycle-complete. The current union has only
`{ kind: "tool_call"; name; input }` and `parseExecEvent()` maps both
`item.started` and `item.completed` to that same shape
(`plugins/codexclaw/components/messenger-bridge/src/runner.ts:21-29,111-123`).
Renderer filtering cannot produce four honest modes until events carry phase,
stable identity, and completion data.

After that schema change, store one named-agent mode with default `new`. A
single pure policy function converts `RunnerEvent` plus mode into zero or one
transport-neutral progress line. Telegram and Discord retain their own
coalescing/rate-limit mechanics but consume the same policy output. Legacy
single-channel bindings with no named agent also resolve to `new`.

The default `new` gives one visible line when each tool begins without doubling
normal traffic. `all` adds completion lines. `verbose` adds bounded completion
summaries. `off` suppresses all runner-event status rendering: only transport
typing/acknowledgement and the durable final remain.

Intermediate progress is silent. Telegram status sends use
`disable_notification: true`; Discord channel progress sends use message flag
`SUPPRESS_NOTIFICATIONS` (4096). Edits are non-notifying updates. Durable final
answers and approval prompts do not set suppression and therefore notify under
normal platform/user settings.

## Exact mode contract

| Mode | Accepted runner lifecycle | Telegram rendering | Discord gateway rendering | Discord interaction rendering |
|------|---------------------------|--------------------|---------------------------|-------------------------------|
| `off` | none | Typing/draft acknowledgement may continue, but the editable progress bubble has no event lines; final is a separate notifying message. | Typing may continue; no event-driven progress embed is sent. Final answer is notifying. | Deferred acknowledgement/original remains a generic working state; no event edits. Pre-expiry handoff, if needed, carries only generic working state; final answer notifies. |
| `new` | each distinct `tool_call` with `phase: "started"` once by `callId` | Append `▶ <tool> <input summary>` once to the rolling activity window. | Edit the one progress embed to show the newly started tool line. | Edit the original or handed-off channel progress message with the newly started tool line. |
| `all` | `started` and `completed`, once per `(callId, phase)` | Append `▶ <tool> …` then `✓ <tool>` or `✗ <tool>` without result body. | Show start then completion state/detail in the same progress embed. | Same as gateway, against the current interaction progress target. |
| `verbose` | same as `all` | Completion line includes a sanitized, single-line bounded result summary. | Completion embed detail includes the same bounded summary. | Same as gateway, before or after handoff. |

Thinking, generic status, file-change, and partial/completed assistant-message
events do not create activity lines in any mode. Their useful effects are
already represented by tool lifecycle or the durable final; this rule keeps
the setting name and traffic semantics exact. Terminal success/error state is
not a tool event and is always rendered when a progress surface exists.

## Diff-level change map

### Work item 1 — runner event contract (must land first)

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/runner.ts`

Functions/types: `RunnerEvent`, `parseExecEvent()`, `firstString()`, and a new
bounded result-summary helper.

Before: started and completed tools are indistinguishable; there is no call id,
result, or success/failure signal (`runner.ts:111-123`).

After:

- Change the tool variant to:

  ```ts
  {
    kind: "tool_call";
    phase: "started" | "completed";
    callId: string;
    name: string;
    input: string;
    outcome?: "success" | "error";
    resultSummary?: string;
  }
  ```
- Map `item.started` only to `phase: "started"` and `item.completed` only to
  `phase: "completed"`.
- Extract a stable call id from the verified Codex item identity field, preserve
  name/input on both phases, derive outcome only when supported by payload, and
  summarize completion output/result/error to a sanitized single line capped
  at 300 characters. Never place raw multi-kilobyte tool output in a
  `RunnerEvent`.
- Continue emitting file changes as `file_change`; they are not reclassified as
  tools.
- Keep `spawnOnce()` forwarding events unchanged apart from accepting the richer
  union.

**UNVERIFIED local payload shape:** repository fixtures prove event type and
tool name/arguments, but do not prove the real `codex exec --json` fields for
item id, completion result/output, or outcome
(`plugins/codexclaw/components/messenger-bridge/test/runner.test.ts:58-82`).
The first B step must capture a real harmless command and MCP call with
`codex exec --json`, retain redacted started/completed JSONL as a test fixture,
and record the exact identity/result fields. If current Codex emits no stable
identity, B must introduce a stateful parser that assigns sequence ids and
correlates completions by verified payload fields/FIFO; it must not fake a
stable id inside the current pure parser. This is a build gate, not an optional
follow-up.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/runner.test.ts`

Before: one started MCP fixture expects the old event; no paired completion.

After: add redacted real-payload fixtures for command and MCP started/completed
pairs; assert identical `callId`, correct phases, preserved name/input,
success/error outcome when present, bounded result summary, malformed/missing
result handling, and duplicate tool names with distinct ids.

### NEW `plugins/codexclaw/components/messenger-bridge/src/tool-progress.ts`

Own the enum, default, event gate, deduplication keys, and transport-neutral
line format.

- Export `TOOL_PROGRESS_MODES = ["off", "new", "all", "verbose"] as const`,
  `ToolProgressMode`, and `DEFAULT_TOOL_PROGRESS = "new"`.
- Export `createToolProgressPolicy(mode)` returning
  `render(event): ToolProgressLine | null` and `reset()`.
- Deduplicate starts by `callId` and completions by `(callId, phase)`.
- Sanitize tool/input/result text, collapse whitespace, cap the input summary
  and result summary, and never emit mentions or raw secrets beyond the
  runner-provided bounded summary.
- Enforce the exact mode table above; render terminal success/error separately
  in each progress controller.

### NEW `plugins/codexclaw/components/messenger-bridge/test/tool-progress.test.ts`

Table-test all four modes, duplicate suppression, repeated tool names with
different ids, completion success/error, verbose truncation/sanitization, and
non-tool event rejection.

### Work item 2 — persistence and public API

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/db.ts`

Types/functions: `AgentRow`, `AgentPatch`, exported setting enum, migration
runner, and `BridgeDb.updateAgent()`.

Before: `AgentRow`/`AgentPatch` end at `thread_mode`; v9 is already occupied by
`agent_pairing_codes` (`db.ts:411-432`); `updateAgent()` allowlists columns at
`db.ts:728-759`.

After:

- Import/re-export or colocate the canonical `ToolProgressMode` without
  duplicating literals; expose `AGENT_TOOL_PROGRESS_MODES` for route/command
  validation.
- Add `tool_progress: ToolProgressMode` to `AgentRow` and optional
  `tool_progress?: ToolProgressMode` to `AgentPatch`.
- Add the setting to the `updateAgent()` column allowlist.
- Add **v10**, not v9:
  `ALTER TABLE agents ADD COLUMN tool_progress TEXT NOT NULL DEFAULT 'new'
  CHECK (tool_progress IN ('off','new','all','verbose'))`, then set
  `PRAGMA user_version = 10` inside the existing transaction pattern.
- Keep the migration guarded by `if (version < 10)`. The migration is
  version-guarded, not intrinsically idempotent: `ALTER TABLE ... ADD COLUMN`
  has no `IF NOT EXISTS`, matching the repository's current migration model.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/db-migration.test.ts`

Add v9-to-v10 upgrade coverage, default preservation for existing agents,
constraint rejection for invalid values, `user_version = 10`, and a reopen
case proving the version guard prevents a second `ALTER TABLE`.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/db.test.ts`

Assert new-agent default `new`, update allowlist persistence for all four
values, and typed row round-trip.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/agent-routes.ts`

Functions: `publicAgent()` and `/api/agents/update` handler.

Before: public output includes `threadMode` but not tool progress
(`agent-routes.ts:33-52`); PATCH-like update validation ends with `threadMode`
(`agent-routes.ts:103-188`).

After: expose `toolProgress: a.tool_progress`; accept `toolProgress` only when
it is one of `AGENT_TOOL_PROGRESS_MODES`; map it to
`patch.tool_progress`. Invalid values return HTTP 400 and do not mutate the
row. No adapter reload is needed because renderers resolve the current named
agent setting at turn start.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/agent-routes.test.ts`

Assert list/create/update public shapes, all valid values, invalid 400/no-write,
and token redaction remains unchanged.

### Work item 3 — command and picker surfaces

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/gateway-commands.ts`

Functions: `GATEWAY_COMMANDS`, `handleStatus()`, `handleAgent()`, and new
`handleToolProgress()`.

Before: registry/status have no tool-progress setting; `handleMode()` at
`gateway-commands.ts:508-525` is the closest named-agent setter pattern.

After:

- Register `/toolprogress` with syntax
  `/toolprogress [off|new|all|verbose]`.
- Add `tool_progress: <effective mode>` to `/status` and tool progress to the
  `/agent` settings payload/text.
- Implement `handleToolProgress()` mirroring `handleMode()`: require a named
  agent, show current/default when no arg, validate against the canonical enum,
  call `updateAgent(agent.id, { tool_progress: target })`, and return mode plus
  agent id. Legacy bindings report that the fixed effective mode is `new`.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/gateway-commands.test.ts`

Cover registry/help, `/status`, `/agent`, query/set/invalid/legacy behavior,
and persistence for every mode.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-commands.ts`

Functions: `buildCommandDefs()` and new `handleToolProgress()`.

Before: Telegram registers mode/model/effort but no tool-progress command
(`telegram-commands.ts:72-102`).

After: register `toolprogress`; with an argument dispatch the shared setter;
without an argument dispatch query state and return
`buildToolProgressPicker(current, binding.id)`. This picker fits the existing
model/effort/mode no-argument pattern, so it is in scope.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-interactive.ts`

Functions/types: `CallbackAction`, `CALLBACK_TAGS`, `buildToolProgressPicker()`,
`handleCallback()`, `callbackBindingId()`, and new
`handleToolProgressSelect()`.

Before: callback kinds and handlers cover model, effort, and thread mode
(`telegram-interactive.ts:12-40,121-132,187-249`).

After: add compact `tool_progress_select` callback encoding, four-button
picker, binding/agent authorization, canonical enum validation, agent update,
and callback message edit. Never update a binding-level override.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-commands.test.ts`

Assert menu registration, argument dispatch, no-argument picker, invalid and
legacy responses, and `/status` output.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-interactive.test.ts`

Assert callback round-trip/64-byte bound, picker labels, authorization,
all four updates, stale binding, invalid mode, and named-agent requirement.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-commands.ts`

Functions: `COMMANDS`, interaction setter helper, and gateway reply wiring.

Before: slash choices/pickers exist for effort and mode
(`discord-commands.ts:131-178`), but not tool progress.

After: add `/toolprogress` with four static choices. An explicit value uses the
shared gateway setter. No value shows current state plus a Discord select
component. Keep command registration result checking.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-components.ts`

Add `buildToolProgressSelect(modes, current)` following
`buildEffortSelect()` (`discord-components.ts:139-142`) with custom id
`tool_progress_select`.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-interactions.ts`

Extend `handleComponentInteraction()` with `tool_progress_select`: validate the
selected canonical value, resolve the named agent from the binding, update it,
and checked-edit the deferred response. This is included because the existing
Discord no-argument command pattern is interactive.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-commands.test.ts`

Assert registered choices, query picker, explicit set, invalid/legacy response,
and `/status` exposure.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-components.test.ts`

Assert select custom id, four options, selected/current label, and Discord
component limits.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-interactions.test.ts`

Assert component selection authorization, all four updates, invalid value,
missing/legacy agent, and checked reply failure.

### Work item 4 — renderer gating and notification policy

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-progress.ts` (Phase 1 NEW file)

Functions: `createTelegramTurnProgress()` and activity renderer.

Before Phase 3: the Phase 1 controller's extension seam defaults to all
renderable events.

After: accept a `ToolProgressMode` or policy instance, render only policy lines,
and preserve typing/final cleanup in `off`. Initial editable status sends remain
silent. Webhook, long-poll, and Telegram `/retry` call sites resolve the named
agent's mode once at turn start and pass it to the controller.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-adapter.ts`

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-webhook.ts`

Functions: ordinary attended-turn and `/retry` controller creation paths
defined by Phase 1.

Before Phase 3: every runner event reaches the Phase 1 default seam.

After: resolve `agent.tool_progress ?? DEFAULT_TOOL_PROGRESS` at turn start and
pass it to ordinary and retry controllers. Do not read the DB on every event.
Final output and approval sends omit `disable_notification`; intermediate
editable progress explicitly sets it.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts`

Functions: `createProgressWindow()`, `handleMessage()`, and
`handleGatewayTextCommand()` retry path.

Before: `progressFromEvent()` maps thinking/tool/file/status/message events and
ordinary gateway turns always create a progress embed
(`discord-adapter.ts:334-377,420-436,518-534`).

After: use `createToolProgressPolicy()` in ordinary and textual retry progress
windows. In `off`, keep typing but do not create an event progress message; if a
terminal error needs a user-visible status, send the normal error/final path,
not a silent orphan. Other modes use one silent progress embed and policy
lines. Final answers and approvals remain unsuppressed.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-interaction-progress.ts` (Phase 2 NEW file)

Functions: `createDiscordInteractionProgress()` mode seam.

Before Phase 3: `shouldRenderEvent` defaults true.

After: replace the broad predicate at `/ask`, `/review`, and component retry
call sites with a policy instance. `off` retains generic deferred/handoff state
but emits no event stage; `new`/`all`/`verbose` follow the exact mode table.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-api.ts`

Functions: `sendMessage()` and `sendEmbed()`.

Before: channel message/embed sends cannot request silent delivery
(`discord-api.ts:125-136`).

After: add optional `{ suppressNotifications?: boolean }` to both methods; map
true to Discord message `flags: 4096`. Do not default suppression globally.
Progress windows and the Phase 2 `sendMessage` interaction handoff set it;
final output and approval cards do not.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-progress.test.ts` (Phase 1 NEW file)

Test the controller/policy boundary for all four modes, deduplication, `off`
typing/final cleanup, and silent intermediate payloads.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-adapter.test.ts`

Test all modes on ordinary and `/retry` long-poll paths, one mode resolution per
turn, silent progress, and unsuppressed final/approval delivery.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-webhook.test.ts`

Test the same matrix for webhook ordinary and `/retry` turns, including queued
turns retaining their turn-start policy.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-adapter.test.ts`

Test all modes on gateway ordinary and textual retry paths, `off` typing/final
only, and `flags: 4096` on progress but not final/approval sends.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-interaction-progress.test.ts` (Phase 2 NEW file)

Test all modes before and after token handoff, policy-state continuity, and
suppression on the bot-authenticated handoff progress send.

## Explicitly out of scope

- `plugins/codexclaw/components/messenger-bridge/src/connect-routes.ts`
- `plugins/codexclaw/components/messenger-bridge/src/cli.ts`

The setting is named-agent state exposed through agent routes and messenger
commands. Legacy channel connection and CLI setup surfaces are intentionally
unchanged.

## Activation scenarios

| Trigger | Expected evidence |
|---------|-------------------|
| Existing DB at v9 opens | One v10 migration adds `tool_progress='new'`; reopen performs no second ALTER. |
| `/toolprogress verbose` or API update | Named agent persists `verbose`; `/status`, `/agent`, Telegram picker, and Discord picker report it. |
| Invalid API/command/component value | 400 or platform validation message; database value is unchanged. |
| `off` attended turn on any ingress/retry | Typing/defer remains; no runner-event progress lines; final and approvals notify normally. |
| `new` tool emits started then completed | Exactly one start line; completion is suppressed. |
| `all` tool emits started then completed | One start and one bounded completion line without result body. |
| `verbose` completion carries output/error | Completion line includes sanitized bounded summary; duplicate completion is suppressed. |
| Discord interaction crosses handoff | Mode policy remains unchanged; post-handoff edits continue on the bot-authenticated progress message. |
| Intermediate Telegram/Discord progress is created | Telegram has `disable_notification`; Discord has flag 4096; final and approval sends lack suppression. |

## Failure cleanup rules

1. Migration v10 is transactional and version-guarded; rollback leaves
   `user_version` at 9 if the ALTER fails.
2. Invalid persisted input never reaches a renderer; DB CHECK, API validation,
   command validation, and component validation share one canonical enum.
3. Policy instances are per turn and reset/discarded in progress-controller
   `finish()`; call-id dedupe state cannot leak between turns.
4. Result summaries are bounded and sanitized before transport rendering.
5. Progress-send/edit failures remain best-effort and cannot mask runner/final
   delivery; each platform's Phase 1/2 cleanup still runs in `finally`.
6. Notification suppression is opt-in only for intermediates. Finals and
   approvals never inherit progress options accidentally.

## Test plan

The B order is mandatory: capture/verify runner JSON → land runner schema/tests
→ land policy → migration/API → command surfaces → renderer gates.

Run from the repository root:

```bash
npm test
npm run build
```

The suite must include tests for runner, policy, DB migration/CRUD, agent API,
gateway command, Telegram registration/picker/callback/webhook/long-poll/retry,
Discord registration/picker/component/gateway/retry/interaction/handoff, and
notification flags. A renderer-only test matrix does not satisfy this phase.

## Manual verification checklist

1. Capture a real redacted `codex exec --json` tool start/completion pair and
   confirm stable id and result fields match the committed parser fixture.
2. Upgrade a copy of a v9 DB; inspect schema/default/check and reopen it.
3. Set each mode via API, Telegram, and Discord; verify `/status` and `/agent`.
4. Run one two-tool turn through Telegram long-poll, Telegram webhook, Discord
   gateway, `/ask`, `/review`, and both retry paths; compare exact mode table.
5. Cross the shortened interaction handoff threshold and confirm policy state
   survives target switching.
6. Inspect raw outbound payloads: intermediates are silent; final answers and
   approval prompts are not suppressed.
7. Restart the bridge and confirm the persisted mode remains active.

## Open questions

1. Which real Codex JSON fields carry item identity, result, and outcome? This
   is intentionally UNVERIFIED until the mandatory first B capture.
2. If real completion events omit input/name, should the stateful parser retain
   start metadata by call id? Yes unless the verified payload supplies both;
   tests should lock the chosen correlation.
3. Should verbose summaries expose command stdout at all, or only exit/result
   metadata? Default to the bounded sanitized summary above; tighten further if
   the payload audit reveals secret-bearing fields.
