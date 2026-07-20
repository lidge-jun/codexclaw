# messenger-bridge — Phase 1 thread progress UX

Status: P (design) · class C3 · implementation not started

## Loop-spec header

- **Loop archetype:** spec-satisfaction
- **Goal:** give Telegram users one useful, rate-safe progress surface during
  every attended turn, including group/forum-topic webhook turns and `/retry`,
  while keeping the durable final answer as a separate message.
- **Non-goals:** migrating the runner to Codex app-server; token-level assistant
  streaming; changing session-key semantics; pinning user messages; redesigning
  Discord interactions; changing autonomous heartbeat delivery.
- **Verifier:** `npm test` + `npm run build` from the repository root, followed by
  the manual forum-topic checklist below.

Local RCA and external constraints are recorded in
`devlog/_plan/260720_messenger_multithread_progress/001_research.md`; this document
contains only the Phase 1 implementation design.

## Chosen direction

Use a single per-turn Telegram progress controller with two rendering lanes:

1. A rich-supported private chat continues to use the existing ephemeral draft
   API.
2. Every other attended Telegram turn — group, supergroup/forum topic, or a
   private chat without draft support — sends one silent `🔄 Working…` message,
   then edits that same message no more often than once every 2 seconds.

The editable status body has two independent sections:

```text
🔄 Working…

Latest
<latest completed assistant-message item, truncated>

Activity
<rolling last five thinking/tool/file/status lines>
```

`Latest` is item-level, not token-level: the current runner emits assistant text
only after an `agent_message` item completes. `Activity` updates throughout tool
execution. Empty sections are omitted.

The controller never turns the status message into the answer. On completion it
stops typing, drains or cancels pending edits, deletes the transient status
message when one exists, and lets the existing formatted-output path send the
durable final answer normally. Intermediate status creation uses
`disable_notification: true`; final answers omit that flag and therefore retain
normal notification behavior. Approval prompts also remain outside this silent
progress lane.

All status edits are serialized and coalesced. While an edit is in flight, newer
events replace the pending snapshot rather than creating parallel API calls. A
429 suspends edits for `retry_after`, preserves only the newest pending snapshot,
and schedules one flush after the backoff. Typing actions start immediately and
refresh every 4 seconds until finish, independent of status-edit suspension.

## Diff-level change map

### NEW `plugins/codexclaw/components/messenger-bridge/src/telegram-progress.ts`

Own the shared attended-turn progress lifecycle now duplicated or missing across
Telegram ingresses.

- Export `createTelegramTurnProgress(options)` returning `start()`,
  `onEvent(event)`, and `finish()`.
- Select the draft lane only when `chatType === "private" && richSupported`;
  otherwise select the one-message edit lane.
- Reuse `createDraftProgressState()` and `sendDraftProgress()` for the private
  lane; do not duplicate rich-draft formatting or its failure state.
- Maintain `latestAssistantText`, a deduplicated rolling five-line activity
  window, status message id, one in-flight flush, one pending snapshot, last edit
  timestamp, and `suspendedUntil` for 429 handling.
- Send the status message once with `messageThreadId` and
  `disableNotification: true`; edit only that message. Never create a second
  status message after an edit failure during the same turn.
- Apply `TELEGRAM_PROGRESS_EDIT_MS = 2_000`, truncate rendered text below
  Telegram’s 4,096-character ceiling, and expose injectable clock/timer seams for
  deterministic tests.
- Start and refresh `sendChatAction(..., messageThreadId)` every 4 seconds; clear
  the interval in `finish()` even if status creation or deletion fails.
- `finish()` waits for status creation, prevents post-finish edits, deletes the
  transient status message, and leaves durable final/error delivery to the
  caller.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-api.ts`

Before: `SendMessageParams` supports text, parse mode, and thread id; status sends
cannot request silent delivery.

After: add `disableNotification?: boolean` and map it to Telegram’s
`disable_notification` payload field. Do not default it globally: progress sends
set it explicitly, while final output and approvals retain notification behavior.
Keep the existing 429 retry path; the progress controller additionally coalesces
events while a call is delayed and handles a returned 429 after the API client’s
single retry.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-adapter.ts`

Before: `runTurn()` owns draft/status state inline; groups get a 1.5-second,
last-five-line bubble, assistant text takes a separate edit path, and the code is
not reusable by webhook or command turns.

After: replace the inline status/draft/typing block in `runTurn()` with one
`createTelegramTurnProgress()` instance. Call `start()` before
`handleIncoming()`, pass `progress.onEvent`, and call `finish()` in a `finally`
before existing final/error delivery. The resulting group/topic UI uses the
shared two-section renderer and 2-second edit throttle.

For Telegram `/retry`, create the same controller in the parsed-command branch,
pass its callback through `CommandContext`, and finish it around command
execution. Other commands do not create a progress message.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-webhook.ts`

Before: `acceptMessage()` creates draft state for every turn but wires events
only when `msg.chat.type === "private"`; group/topic turns pass `undefined`.

After: create and start the shared progress controller for every accepted
ordinary-message turn, pass `progress.onEvent` without the private-chat gate,
and finish it before `sendTurnResult()`. The controller, rather than webhook
ingress, chooses draft versus editable-message rendering. Move the existing
private event-to-text helper out with the duplicated rendering logic.

Apply the same lifecycle to webhook `/retry` by passing the controller callback
through the command context. Preserve asynchronous webhook acknowledgement: the
turn and progress lifecycle remain attached to `enqueued.result`, not the HTTP
response.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-commands.ts`

Before: `CommandContext` cannot carry runner events, so `handleGateway("retry")`
cannot connect the retry turn to transport progress.

After: add optional `onEvent` to `CommandContext` using the existing
`IncomingRequest["onEvent"]` type and forward it from `handleGateway()` into
`dispatchGatewayCommand()`. Only ingress code deciding to run `/retry` supplies
the callback.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/gateway-commands.ts`

Before: `GatewayCommandContext` has `onApprovalRequest` but no `onEvent`, and
`handleRetry()` starts a full turn without event delivery.

After: add optional `onEvent: IncomingRequest["onEvent"]` and pass
`onEvent: ctx.onEvent` in `handleRetry()`. No other gateway command consumes the
field.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts`

Before: ordinary Discord messages use `createProgressWindow()`, but
`!cxc retry` enters `handleGatewayTextCommand()` without that window.

After: for the textual `retry` command only, create the existing Discord
progress window, pass `progress.onEvent` into `dispatchGatewayCommand()`, and
finish the window after dispatch. This closes the shared gateway retry gap
without changing Discord’s established embed renderer.

### Discord interaction decision — OUT for Phase 1

`plugins/codexclaw/components/messenger-bridge/src/discord-commands.ts`
interaction turns (`/ask`, `/review`) and component retry remain unchanged in
this phase. They have a visible deferred “Working” response, although it is not
event-driven, and fixing them requires an interaction-token progress lifecycle
rather than the Telegram topic renderer. Record that as a separate parity unit;
do not hide the known gap or claim all Discord ingresses are healthy.

### NEW `plugins/codexclaw/components/messenger-bridge/test/telegram-progress.test.ts`

Add isolated fake-clock/fake-API tests for renderer selection, content,
serialization, throttle, cleanup, and 429 backoff.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-adapter.test.ts`

Before: asserts the private draft path and legacy group status path.

After: keep private-draft coverage; update group expectations to one silent
status send, coalesced edits at the 2-second boundary, rolling activity plus
latest assistant text, deletion before the separate final answer, and topic id
preservation.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-webhook.test.ts`

Before: covers private draft progress but does not require group/topic event UX.

After: add webhook group/forum-topic coverage proving `onEvent` is present, the
single status message is silent and thread-scoped, edits occur, cleanup precedes
the separately sent final, and private supported/unsupported lanes select draft
or status correctly.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/gateway-commands.test.ts`

Before: retry behavior is tested without runner-event forwarding.

After: assert `handleRetry()` passes the exact supplied `onEvent` callback to
`AgentService.handleIncoming()` and leaves it absent when the caller supplies
none.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-adapter.test.ts`

Before: covers ordinary message progress embeds but not `!cxc retry` events.

After: assert textual retry reuses one progress embed and edits it from runner
events. Do not add slash-interaction expectations in this phase.

## Activation scenarios

| New conditional path | C-phase trigger | Expected evidence |
|---|---|---|
| Private + rich draft supported | Fake/probed rich support `true`, `chat.type = private`, emit tool then message events in both long-poll and webhook tests. | Draft API receives progress; no persistent status message is sent; final remains a normal formatted message. |
| Private + draft unsupported | Set rich support `false` for a private chat in both ingresses. | Exactly one silent status message is sent and edited; no draft call occurs. |
| Group/forum topic | Use `chat.type = supergroup`, `is_forum = true`, and a non-null `message_thread_id`; emit tool, file, and message events. | One status send and all final output target the same topic; status contains rolling activity/latest text and is deleted before final delivery. |
| Webhook runtime | Configure a webhook handler and dispatch a signed update. | `enqueueIncoming()` receives `onEvent` for private and group/topic turns; progress continues after HTTP acknowledgement. |
| Long-poll runtime | Dispatch the same message through the adapter. | `handleIncoming()` receives the same controller callback and produces equivalent lane behavior. |
| 429 backoff | Fake an edit response with `error_code: 429` and `retry_after: 3`, then emit several events during suspension. | No edit occurs before 3 seconds; one post-backoff edit contains only the newest coalesced snapshot; no extra status message is created. |
| Edit throttle | Emit multiple events around 1,999 ms and 2,000 ms with an injected clock. | No early edit; one edit at the boundary; concurrent edits never overlap. |
| Telegram `/retry` | Seed a previous job and invoke `/retry` through webhook and long-poll command branches. | Shared gateway handler receives the callback and the same progress lane runs for the retried turn. |
| Discord `!cxc retry` | Seed a previous job and emit runner events through the text command. | Existing Discord progress embed starts once and receives event-driven edits. |

## Rate-limit budget

- Status creation costs exactly one new Telegram message per attended turn. The
  controller never rolls over to another status message during that turn.
- The final answer remains the existing formatted output, normally one message
  but potentially multiple chunks. Progress therefore adds one new message to
  the documented 20-message/minute group budget, rather than one message per
  event. For ordinary one-chunk answers, the turn creates two messages total:
  one transient status and one durable final.
- Edits do not create additional chat messages, but Telegram publishes no
  numeric edit limit. Use a minimum 2,000 ms edit interval, one in-flight request,
  last-write-wins coalescing, and no burst catch-up after delays.
- On 429, wait the server-provided `retry_after`; events during the wait update
  one pending snapshot. Resume with one edit, not a replay queue.
- Typing keepalive uses `sendChatAction` every 4 seconds. It is independent of
  status-message count and stops deterministically at turn completion.

## Test and verification plan

### Unit and integration tests

1. `plugins/codexclaw/components/messenger-bridge/test/telegram-progress.test.ts`:
   lane selection; initial silent send; topic id;
   latest-text/activity rendering; deduplication; five-line roll; 4,096-character
   bound; 2-second throttle; serialized last-write-wins edits; 429
   `retry_after`; no second status message; finish/delete; timer cleanup; no
   post-finish edit.
2. `plugins/codexclaw/components/messenger-bridge/test/telegram-adapter.test.ts`:
   private draft, private fallback, group/topic
   status, separate final, and `/retry` callback wiring in long-poll mode.
3. `plugins/codexclaw/components/messenger-bridge/test/telegram-webhook.test.ts`:
   signed webhook private/group/topic lanes,
   asynchronous acknowledgement, separate final, and `/retry` callback wiring.
4. `plugins/codexclaw/components/messenger-bridge/test/gateway-commands.test.ts`:
   callback propagation through `handleRetry()`.
5. `plugins/codexclaw/components/messenger-bridge/test/discord-adapter.test.ts`:
   event-driven progress for textual retry and no
   regression in ordinary message progress.
6. Run `npm test` and require zero failures.
7. Run `npm run build` and require exit code 0.

### Manual Telegram forum-topic checklist

1. Configure one Telegram agent in webhook mode and one in long-poll mode, each
   admitted to a forum supergroup with thread mode enabled.
2. In a non-General topic, send a prompt that causes at least two tool calls and
   one file change.
3. Confirm typing appears promptly and is refreshed during a long turn.
4. Confirm exactly one `🔄` status message appears in the initiating topic, is
   updated in place no faster than every 2 seconds, and displays latest assistant
   item text plus rolling activity without leaking into another topic.
5. Confirm intermediate updates are silent and the final answer produces the
   normal notification.
6. Confirm the status message is removed and the final answer remains as a
   separate durable message.
7. Repeat with `/retry`; confirm the same progress behavior.
8. Inject or observe a 429; confirm updates pause for `retry_after`, then resume
   with the newest state and without duplicate bubbles.
9. Repeat in a private chat with draft support enabled, then disabled; confirm
   draft and editable-message lanes activate respectively.

## Open questions for later phases

- Should group and topic session identity move toward Hermes-style per-user keys
  so concurrent users in one shared surface do not share transcript, queue, or
  interrupt state? This changes persistence and session semantics and is not a
  progress-renderer concern.
- Should Telegram pin the triggering user message for the duration of a turn?
  Pinning can improve target clarity but requires permission handling, pin-state
  restoration, and a policy for concurrent topic turns; evaluate it separately.
- Should Discord interaction turns receive the same event-driven parity as
  gateway messages, using edits to the deferred interaction response? That is
  the next known ingress gap after this Phase 1 scope.
