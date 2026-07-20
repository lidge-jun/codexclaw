# messenger-bridge — Phase 2 Discord interaction-turn progress

Status: P (design) · class C3 · implementation not started

## Loop-spec header

- **Loop archetype:** spec-satisfaction
- **Goal:** give Discord `/ask`, `/review`, and component `retry` turns an
  event-driven progress surface that remains correct when queue wait plus turn
  runtime outlives Discord's 15-minute interaction token.
- **Non-goals:** changing gateway-message progress; adding tool-progress user
  settings (Phase 3); using webhook followups after token expiry; changing
  command semantics, queueing, final-answer formatting, or approval cards.
- **Verifier:** `npm test` + `npm run build` from the repository root, followed
  by the interaction-token handoff checklist below.

## Chosen direction

Add a dedicated interaction progress controller, adapted from
`createProgressWindow()` in
`plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts:334-377`.
It starts on the already-deferred original interaction response, renders
runner events there, and owns one pre-expiry handoff timer.

The interaction token is treated as unavailable after 15 minutes. At about
14 minutes from receipt, before the token can expire, the controller sends a
bot-authenticated channel progress message, checks that send result, edits the
interaction original to point to that message, checks that edit result, and
then uses only `DiscordApi.editMessage()` for progress and terminal state.
`sendMessage`/`editMessage` are authenticated channel APIs and therefore do not
depend on the interaction token. A webhook followup is explicitly not a
post-expiry fallback.

Before handoff, event snapshots edit the original interaction response. After
handoff, they edit the channel progress message. Updates are serialized,
coalesced, and throttled using the gateway progress-window doctrine; a forced
terminal edit drains the latest state. The durable answer remains a fresh,
normally notifying channel message through `sendFormattedDiscordOutput()`.

Every Discord API result is checked. This closes the current silent failure in
`deferReply()` and `editDeferredReply()`
(`plugins/codexclaw/components/messenger-bridge/src/discord-interactions.ts:96-107`)
as well as unchecked original-response edits in `runTurnFromInteraction()`
(`plugins/codexclaw/components/messenger-bridge/src/discord-commands.ts:246-264`).

### Phase 3 mode-gating seam

`createDiscordInteractionProgress()` accepts
`shouldRenderEvent?: (event: RunnerEvent) => boolean`. Phase 2 defaults it to
`() => true`, preserving all currently renderable runner stages. `onEvent()`
applies the predicate before rendering or scheduling an edit. Phase 3 replaces
the default at each call site with the agent's `tool_progress` policy; no
controller rewrite is required.

## Diff-level change map

### NEW `plugins/codexclaw/components/messenger-bridge/src/discord-interaction-progress.ts`

Own interaction-original rendering, token-expiry handoff, and terminal cleanup.

- Export `DISCORD_INTERACTION_HANDOFF_MS = 14 * 60 * 1_000` and
  `createDiscordInteractionProgress(options)`.
- Options include `api`, `applicationId`, `interactionToken`, `channelId`,
  `log`, optional `shouldRenderEvent`, and injectable clock/timer functions.
- Return `start()`, `onEvent(event)`, and `finish(result)`.
- `start()` immediately edits the deferred original to a running embed, checks
  `DiscordApiResult`, and arms one handoff timer measured from controller
  creation. A failed initial edit is logged and does not prevent the turn.
- Reuse/export the existing Discord `progressFromEvent()` and embed renderer
  rather than inventing a second stage vocabulary. Keep a latest-snapshot slot,
  one in-flight edit, last-edit time, and a closed flag.
- `onEvent()` first applies `shouldRenderEvent` (default true), maps accepted
  events to stages, and performs a serialized/coalesced edit against the active
  target: interaction original before handoff, channel message after handoff.
- At the timer, call `sendMessage(channelId, "Working…")` and require
  `ok && data.id`; this is the explicit bot-authenticated handoff creation
  path. Only after obtaining the channel message id, edit the
  interaction original to a handoff embed containing a Discord message link
  (`https://discord.com/channels/<guild-or-@me>/<channel>/<message>` when the
  available context can construct it; otherwise a plain channel-message
  pointer). Check this edit too. Then atomically switch the active target to
  `editMessage(channelId, messageId, ...)`. All subsequent progress and the
  terminal state use `editMessage`; webhook followups are never substituted.
- If channel-message creation fails, log it, keep the original as the active
  target while still pre-expiry, and do not schedule a webhook followup. If the
  pointer edit fails but channel-message creation succeeded, switch to the
  channel message anyway and log that the original may be stale.
- `finish()` marks the controller closed, clears the handoff timer, waits for
  creation/in-flight work, and force-edits exactly the active progress target
  to success or error. It checks and logs the terminal result. It never sends
  the durable answer itself.

Before: no reusable progress lifecycle exists for interaction turns.

After: interaction progress has one owner with a deterministic pre-expiry
transition from webhook-authenticated original edits to bot-authenticated
channel edits.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-commands.ts`

Functions: `runTurnFromInteraction()` and its `/ask` and `/review` callers at
`discord-commands.ts:43-60`.

Before: `runTurnFromInteraction()` writes one unchecked `Working` embed,
invokes `handleIncoming()` without `onEvent`, sends a fresh answer, then writes
one unchecked terminal embed (`discord-commands.ts:240-265`). Queue and runner
events are invisible, and a late terminal edit can use an expired token.

After:

- Create `createDiscordInteractionProgress()` before invoking
  `handleIncoming()` and call `start()`.
- Pass `onEvent: progress.onEvent` into `handleIncoming()` alongside the
  existing approval callback.
- Keep `/ask` and `/review` prompt construction unchanged; both receive the
  lifecycle because both already call `runTurnFromInteraction()`.
- Send the durable result through the existing formatted channel-output path.
  Check/log delivery failures at that boundary.
- Call `progress.finish(result)` in `finally`, including thrown runner errors
  and cancellation results, so the handoff timer and pending edits cannot leak.
- Do not attempt interaction webhook followups after handoff or expiry.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-interactions.ts`

Functions: `handleInteraction()`, `deferReply()`, `editDeferredReply()`, and
`handleComponentInteraction()` retry branch.

Before: defer and edit helpers discard `DiscordApiResult`; command/component
catch paths can silently fail. Component retry at
`discord-interactions.ts:147-157` reaches the same event-blind interaction turn.

After:

- Make `deferReply()` and `editDeferredReply()` inspect the result and throw a
  redacted transport error when `ok` is false. This ensures command routing
  does not proceed after a failed acknowledgement and allows existing catch/log
  boundaries to report failed edits while the token remains usable.
- Ensure `handleInteraction()` checks direct PING/unsupported response results
  as well, so every defer/edit/callback result in this module is accounted for.
- Keep the component retry lookup unchanged, but route the recovered prompt to
  the updated `runTurnFromInteraction()`; it therefore receives identical
  progress, event plumbing, handoff, and cleanup.
- In command/component catch blocks, check the attempted error edit. If that
  edit also fails, log both failures; do not recurse or send a webhook followup.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-commands.test.ts`

Before: `/ask` asserts only the initial/final original edits and fresh answer.

After: add `/ask` and `/review` cases proving `IncomingRequest.onEvent` is
present, event stages edit the original before 14 minutes, final output remains
a separate channel message, injected time triggers channel handoff, post-handoff
events and terminal state use `editMessage`, and no webhook operation occurs
after handoff. Cover failed handoff send, failed pointer edit, thrown turn, and
failed final delivery without timer leakage.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-interactions.test.ts`

Before: interaction tests assume all callback/defer/edit calls succeed; retry
checks only prompt replay and final answer.

After: assert defer/edit failures are observed, double-failure catch handling
logs without recursion, and component retry carries `onEvent` through the same
pre-expiry/handoff lifecycle as slash commands. Use fake timers; no wall-clock
14-minute test waits.

### NEW `plugins/codexclaw/components/messenger-bridge/test/discord-interaction-progress.test.ts`

Unit-test the controller independently: default mode gate, rejected gate,
stage mapping, throttled last-write-wins edits, initial-edit failure,
13:59 no handoff, 14:00 handoff, send failure, pointer-edit failure, atomic
target switch, post-handoff edits, success/error finish, concurrent finish and
handoff, result checking, and timer cleanup.

## Activation scenarios

| Trigger | Expected evidence |
|---------|-------------------|
| `/ask` or `/review` completes before 14 minutes | Deferred original advances through event-driven stage embeds; fresh channel answer is delivered; original ends success/error. |
| Component `retry` finds a previous prompt | The replayed turn exposes the same `onEvent` stages and final lifecycle as slash commands. |
| Queue wait plus turn reaches about 14 minutes | Bot-authenticated channel progress message is created; original points to it; all later progress and terminal edits target that message id. |
| Handoff channel send fails | Failure is logged; no target switch and no webhook followup; the turn and durable answer continue. |
| Handoff pointer edit fails after channel message creation | Failure is logged; channel message becomes authoritative and receives all later updates. |
| Defer fails | Handler does not start the turn; checked error reaches the interaction boundary/log. |
| Runner emits an event rejected by `shouldRenderEvent` | No edit is scheduled; default Phase 2 configuration accepts all renderable events. |
| Runner/final delivery throws or cancellation ends the turn | `finally` clears timers and force-writes one terminal state to the active reachable target. |

## Failure cleanup rules

1. The handoff timer is armed once and cleared in `finish()` on every outcome.
2. `finish()` closes event admission before awaiting in-flight edits; late runner
   events cannot resurrect progress.
3. Handoff target changes only after a channel message id exists. A pointer-edit
   failure cannot orphan the known channel progress message.
4. Every `createInteractionResponse`, original edit, channel send, and channel
   edit result is checked. Progress failures are logged and never mask runner or
   durable-answer results.
5. After handoff, no interaction-token API is used. A webhook followup is never
   treated as an expiry fallback.
6. Approval messages remain independent, normally notifying channel messages;
   their cleanup registration is unchanged.

## Test plan

Run from the repository root:

```bash
npm test
npm run build
```

Focused development runs should cover
`test/discord-interaction-progress.test.ts`, `test/discord-commands.test.ts`,
and `test/discord-interactions.test.ts`. Fake clock assertions must prove the
14-minute transition and absence of post-finish timers. API stubs must return
both successful and failed `DiscordApiResult` values; a call-count-only test is
insufficient.

## Manual verification checklist

1. Register commands and invoke `/ask` with a turn that emits thinking, tool,
   file-change, and assistant-message events; verify one edited original and a
   separate final channel answer.
2. Invoke `/review` and component `retry`; verify identical progress behavior.
3. In a test build with the handoff constant reduced, hold a turn across the
   threshold; verify the original points to one channel progress message and
   all later stages/final state edit that message.
4. Simulate a handoff send failure and pointer-edit failure independently;
   verify the answer still arrives and logs identify the failed operation.
5. Simulate defer and original-edit failures; verify no silent success and no
   repeated webhook fallback loop.
6. Cancel and force a runner error before and after handoff; verify timers stop
   and exactly one terminal state is attempted on the active target.

## Open questions

1. Should `Interaction` gain optional guild metadata solely to construct a
   canonical message URL, or should the pointer text avoid a URL when `guild_id`
   is absent? B should choose the smallest representation supported by fixtures.
2. Should the existing nested gateway `createProgressWindow()` be extracted to
   share coalescing primitives, or should Phase 2 copy only its behavior? Prefer
   no extraction unless tests show a stable transport-neutral state machine;
   WP2 and WP1 are parallel renderer phases, not a code dependency.
3. Discord documents a 15-minute token lifetime, but the exact safety margin is
   policy. Start at 14 minutes and make only the timer injectable, not a user
   setting.
