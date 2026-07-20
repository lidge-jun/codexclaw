# messenger-bridge — Phase 4 lifecycle signals (Telegram pin + Discord reactions)

Status: P (design) · class C3 · implementation not started

## Loop-spec header

- **Loop archetype:** spec-satisfaction
- **Goal:** mark attended turn lifecycle on the user's triggering message:
  Telegram silently pins it while its turn owns the topic lifecycle, while
  Discord gateway turns transition an own-bot reaction from running to exactly
  one terminal outcome.
- **Non-goals:** Discord interaction reactions; reacting to command/configuration
  messages; changing queue/session keys; requiring lifecycle signals for turn
  delivery; granting or probing admin permissions automatically.
- **Verifier:** `npm test` + `npm run build` from the repository root, followed
  by group/topic pin and gateway-reaction manual verification.

## Chosen direction

Treat lifecycle signals as best-effort side effects around the existing turn
promise. They never gate queue admission, runner execution, progress, approval,
or final delivery, and their failures are logged without replacing the primary
turn result.

Telegram gets a small per-adapter lifecycle manager keyed by
`chatId + topicId`. It records pending leases in queue order so overlapping
accepted turns in one topic do not fight over the pin. Only the head lease may
own a pin. When it finishes, it unpins its exact owned message id and promotes
the next lease. All outcomes use the same `finally` cleanup: success, error,
cancel, queue rejection, and adapter/controller shutdown.

Before mutating Telegram pin state, the manager performs a conservative
`getChat` preflight. If the triggering message is already the reported pinned
message, it is classified `preExisting`, never repinned, and never unpinned. If
another pin is reported, this phase leaves it untouched and skips lifecycle
pinning for that lease. If preflight fails, pinning is skipped because ownership
cannot be proved safely. A successful `pinChatMessage` after a clear preflight
creates the only `owned` state eligible for unpin. This favors preserving
administrator/user pin state over guaranteed decoration.

Telegram group/supergroup pinning requires the bot to be an administrator with
`can_pin_messages`. Calls use `disable_notification: true`. Permission or API
failure is best-effort and never blocks the turn.

Discord is narrower: gateway `MESSAGE_CREATE` only. The local interaction model
contains token/channel fields but no originating user-message id
(`plugins/codexclaw/components/messenger-bridge/src/discord-interactions.ts:32-39`),
so slash commands and component retry are explicitly outside reaction scope.
Gateway turns react to the original `DiscordMessageEvent.id` in
`DiscordMessageEvent.channelId` (`discord-gateway.ts:31-39`), even if the answer
is routed into an auto-created `replyChannelId` thread.

## Diff-level change map

### Telegram API and lifecycle

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-api.ts`

Types/functions: new `TgChat`, `TgMessage.chat` typing, and new
`TelegramApi.getChat()`, `pinChatMessage()`, `unpinChatMessage()`.

Before: the client can send/edit/delete messages but has no pin methods
(`telegram-api.ts:157-203`), and `TgMessage.chat` has only inline basic fields
(`telegram-api.ts:25-37`).

After:

- Introduce `TgChat` with existing `id/type/is_forum` fields plus optional
  `pinned_message?: TgMessage`; type `TgMessage.chat` as `TgChat`.
- Add `getChat(chatId)` for the ownership preflight.
- Add:

  ```ts
  pinChatMessage(params: {
    chatId: string | number;
    messageId: number;
    disableNotification?: boolean;
  }): Promise<TgResponse<boolean>>

  unpinChatMessage(
    chatId: string | number,
    messageId: number,
  ): Promise<TgResponse<boolean>>
  ```
- Map fields exactly to `chat_id`, `message_id`, and
  `disable_notification`. Lifecycle callers always pass true when pinning.
- `unpinChatMessage` always sends `message_id`. No overload or optional id is
  allowed because omitting it unpins the most recent message and can damage
  unrelated pin state.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-api.test.ts`

Add request-shape tests for `getChat`, silent pin, explicit-id unpin, success,
permission error, 429 retry, and fetch failure/token-redacted error. Assert the
unpin body always contains `message_id`.

### NEW `plugins/codexclaw/components/messenger-bridge/src/telegram-turn-lifecycle.ts`

Own pin leases, overlap ordering, exact-id cleanup, and shutdown cleanup.

- Export `createTelegramTurnLifecycleManager({ api, log })` returning
  `begin(msg)`, `cleanupAll()`, and test-only/injectable scheduling seams.
- `begin(msg)` returns a lease with `finish()` and immediately registers it
  under key `${chat.id}:${telegramTopicId(msg) ?? "plain"}`. Registration is
  synchronous; preflight/pin work is asynchronous and best-effort.
- Maintain one active lease plus FIFO pending leases per key. Only the active
  lease performs `getChat` and may pin. A pending lease that finishes due to
  queue rejection is removed without ever pinning.
- Active lease states are `preflighting`, `owned`, `preExisting`, `skipped`,
  and `finished`. Store the exact triggering `message_id` on the lease.
- Preflight policy:
  - reported `pinned_message.message_id === trigger id`: `preExisting`; no pin,
    no unpin;
  - any other reported pinned message: `skipped`; preserve it;
  - failed/ambiguous `getChat`: `skipped`; log and continue the turn;
  - no reported pin: call `pinChatMessage` with
    `disableNotification: true`; only `ok && result === true` becomes `owned`.
- `finish()` is idempotent. It waits for its own pin attempt, and if `owned`
  calls `unpinChatMessage(chatId, exactMessageId)`. It logs but absorbs unpin
  failure, marks finished, then promotes the next non-finished lease.
- `cleanupAll()` atomically closes admission, marks pending leases finished,
  awaits active attempts, and best-effort unpins every exact owned id. It never
  calls unpin without an id and is safe to call twice.
- Different topics have independent keys and can own pins concurrently.

Before: neither ingress has shared pin ownership state.

After: pin mutation is serialized per topic, pre-existing state is preserved,
and all owned ids have one exact cleanup path.

### NEW `plugins/codexclaw/components/messenger-bridge/test/telegram-turn-lifecycle.test.ts`

Cover clear preflight → silent pin → exact unpin; already-pinned trigger;
different pre-existing pin; preflight failure; missing permission; pin failure;
unpin failure; duplicate `finish`; finish racing pin; two queued turns in one
topic; pending queue rejection; independent topics; `cleanupAll()` during
preflight/active/pending states; and no id-less unpin call.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-adapter.ts`

Functions: `createTelegramAdapter()`, `runTurn()`, and returned `stop()`.

Before: `runTurn()` starts typing/progress and awaits
`AgentService.handleIncoming()` (`telegram-adapter.ts:291-410`) with no pin
lifecycle; `stop()` only stops polling (`telegram-adapter.ts:467-475`).

After:

- Create one `TelegramTurnLifecycleManager` per adapter.
- In `runTurn()`, call `const lifecycle = manager.begin(msg)` immediately before
  progress/queue handling. Wrap the entire `handleIncoming` plus final-delivery
  path in `try/finally`; `await lifecycle.finish()` in the outer `finally`.
- This same wrapper covers the Phase 1 `/retry` attended-turn path when it has a
  real triggering `CommandContext.msg`; non-turn commands are not pinned.
- Track the asynchronous `cleanupAll()` promise on `stop()` and invoke it even
  though shared `AgentService.shutdown()` remains controller-owned. Adapter
  stop must not terminate another agent's turn.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/telegram-webhook.ts`

Types/functions: `TelegramWebhookHandler`, `createWebhookHandler()`, and
`acceptMessage()`.

Before: `acceptMessage()` calls `enqueueIncoming()` and attaches final/media
cleanup only (`telegram-webhook.ts:148-169`); the handler has no shutdown hook.

After:

- Create one lifecycle manager inside `createWebhookHandler()`.
- For every accepted ordinary or `/retry` turn, begin a lease before enqueue.
  Attach `await lifecycle.finish()` to the result promise's outer `finally`,
  including immediate queue-full `{ ok: false }`, rejection, cancellation,
  final-delivery error, and media cleanup.
- Extend the callable `TelegramWebhookHandler` type with
  `cleanup(): Promise<void>` and attach manager `cleanupAll()` to it. HTTP call
  shape stays callable, so `server.ts` routing does not change.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/bridge-controller.ts`

Functions: `buildAdapterEntry()`, `createWebhookAdapter()`, and `stop()`.

Before: webhook entries use a status-only synthetic adapter and controller stop
cannot clean webhook-owned side effects (`bridge-controller.ts:205-233,298-305,356-366`).

After: create the webhook handler before its synthetic adapter and pass the
handler cleanup into `createWebhookAdapter(cleanup)`. Its `stop()` marks stopped
and starts/records cleanup. `BridgeController.stop()` invokes every adapter stop
before shared `AgentService.shutdown()` as today; cleanup is idempotent and may
also be awaited by controller test seams. No webhook request is admitted after
cleanup closes the manager.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-adapter.test.ts`

Test ordinary and `/retry` start/finish, success/error/cancel, queue-full
result, pin failure, exact cleanup, overlap in one topic, concurrency across
topics, and stop cleanup.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/telegram-webhook.test.ts`

Test lifecycle start after HTTP acceptance, asynchronous
success/error/rejection cleanup, immediate queue-full cleanup, overlapping
enqueued turns, and handler cleanup on shutdown.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/bridge-controller.test.ts`

Test that webhook reload/stop invokes handler cleanup before discarding the
entry and does not shut down another adapter early.

### Discord reaction API and gateway lifecycle

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-api.ts`

Functions: new `DiscordApi.createReaction()` and
`DiscordApi.deleteOwnReaction()`.

Before: the REST client ends with message editing and has no reaction calls
(`discord-api.ts:229-237`).

After:

```ts
createReaction(channelId: string, messageId: string, emoji: string)
deleteOwnReaction(channelId: string, messageId: string, emoji: string)
```

- Call `PUT` and `DELETE` respectively on
  `/channels/:channel/messages/:message/reactions/:emoji/@me`.
- Apply `encodeURIComponent(emoji)` exactly once to the path segment; do not
  encode channel/message ids as emoji or double-encode `%`.
- Reuse `DiscordApi.call()` and return `DiscordApiResult<unknown>`; 204/no JSON
  remains a successful result.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-adapter.test.ts`

Extend the existing fetch recorder with direct API assertions for PUT/DELETE,
encoded `👀`, `✅`, and `❌`, 204 handling, 429 retry, and failure results. If
API tests are split during B, use NEW `test/discord-api.test.ts`; do not duplicate
transport fixtures across both files.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts`

Functions: `handleMessage()` and new nested
`createReactionLifecycle(originalChannelId, originalMessageId)`.

Before: `handleMessage()` routes answers/progress to `replyChannelId` after
auto-threading (`discord-adapter.ts:420-440`) and has no reaction lifecycle.

After:

- Only after bot/dedupe/allowlist/mention/command gates accept an ordinary
  gateway turn, create the reaction lifecycle with **`msg.channelId` and
  `msg.id`**. Do this before `replyChannelForMessage()`; never pass
  `replyChannelId` or a bot progress/final message id.
- `start()` attempts `createReaction(originalChannelId, originalMessageId,
  "👀")` and checks/logs the result without delaying turn execution beyond the
  awaited best-effort call.
- Track terminal outcome initialized to error. Set it to success only when the
  attended turn result is `ok`; queue rejection, cancellation, thrown runner,
  media failure, or delivery failure remain error.
- In the outermost `finally`, independently attempt
  `deleteOwnReaction(..., "👀")`, then exactly one
  `createReaction(..., terminal === success ? "✅" : "❌")`.
- Check/log each result separately. A failed running add still leads to remove
  and one terminal add; a failed remove still leads to one terminal add; a
  failed terminal add is logged and never retried with the other emoji.
- Keep interaction handlers untouched: `Interaction` has no original user
  message id, so `/ask`, `/review`, and component retry receive no reactions.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-adapter.test.ts`

Add gateway tests for success (`👀` remove then `✅`), result error/queue reject,
runner throw/cancel/final-delivery failure (`❌`), auto-threading target identity,
and interaction non-activation. Test partial failures independently: running
add fails, running delete fails, terminal add fails. Assert each path attempts
exactly one terminal emoji and primary answer/error delivery is unchanged.

## Activation scenarios

| Trigger | Expected evidence |
|---------|-------------------|
| Telegram group/topic turn with no existing pin and sufficient admin right | Triggering `message_id` is silently pinned; the same exact id is unpinned in final cleanup. |
| Triggering Telegram message is already reported pinned | No pin or unpin mutation; pre-existing pin remains. |
| Another Telegram pin exists or preflight/permission fails | Lifecycle is skipped/logged; turn progress and final delivery continue. |
| Two Telegram turns queue in one topic | First lease owns its pin; second stays pending; first exact unpin precedes second preflight/pin. |
| Telegram queue rejects, turn cancels/errors, or adapter shuts down | Pending lease is removed or exact owned id is unpinned through the same idempotent cleanup. |
| Discord ordinary gateway message succeeds, including auto-threading | `👀` is added to original `msg.channelId/msg.id`, then removed and replaced by one `✅` on that same original message. |
| Discord gateway turn errors/cancels/queue-rejects/delivery-fails | Running reaction is removed and exactly one `❌` is attempted on the original message. |
| Discord slash or component interaction runs | No reaction API call; interaction progress remains Phase 2's responsibility. |
| Any lifecycle API operation fails | Failure is logged; progress/final/approval delivery and remaining cleanup attempts continue. |

## Failure cleanup rules

1. Telegram unpin always includes the exact lease-owned `message_id`; no API or
   helper permits id omission.
2. Telegram pre-existing or ambiguous pin state is never claimed as owned and
   therefore never unpinned.
3. Telegram lease `finish()` and manager `cleanupAll()` are idempotent and close
   admission before awaiting network calls.
4. Per-topic FIFO promotion happens only after prior exact cleanup; pending
   rejected leases cannot become active later.
5. Discord terminal outcome defaults to error and is upgraded only by a fully
   successful turn/result-delivery path.
6. Discord cleanup attempts running delete and one terminal add independently;
   no reaction failure masks or rewrites the primary turn result.

## Test plan

Run from the repository root:

```bash
npm test
npm run build
```

Required automated coverage includes API request shapes, Telegram ownership
state machine and overlap, long-poll/webhook/retry/queue-reject/shutdown paths,
Discord original-message targeting, auto-threading, interaction exclusion, and
all reaction partial-failure permutations.

## Manual verification checklist

1. Give a Telegram bot `can_pin_messages` in a forum supergroup; send a turn in
   two topics and verify silent independent pin/unpin on exact trigger ids.
2. Pre-pin the trigger and then a different message; verify both conservative
   pre-existing cases leave administrator pin state unchanged.
3. Queue two turns in one topic; verify pin ownership transitions in FIFO order
   without id-less unpinning.
4. Remove Telegram pin permission and repeat success/error/cancel; verify turn
   delivery works and logs show best-effort failure.
5. Stop/reload long-poll and webhook agents with active/pending turns; verify all
   exact owned pins are cleaned and no pending lease activates afterward.
6. Send a Discord gateway message that auto-creates a thread; verify all three
   reaction operations target the original channel/message, while progress and
   answer go to the thread.
7. Exercise success, error, cancel, and simulated partial REST failures; verify
   one terminal emoji at most is attempted and answer delivery is unaffected.
8. Invoke `/ask`, `/review`, and component retry; verify no reaction calls.

## Open questions

1. Telegram `getChat.pinned_message` exposes the reported pinned message, not a
   complete pin history. The conservative policy therefore skips when any pin
   is reported. If B proves topic-scoped behavior can safely distinguish all
   existing pins, the manager may narrow this skip without weakening ownership.
2. `ChannelAdapter.stop()` is synchronous today. B should either track webhook
   cleanup promises in a controller-owned drain list or evolve stop to awaitable
   in one focused change; it must not fire-and-forget cleanup without a testable
   shutdown barrier.
3. Should Discord terminal success mean runner success or final-delivery
   success? This plan chooses end-to-end delivery success; a failed answer send
   produces `❌` even if Codex completed.
