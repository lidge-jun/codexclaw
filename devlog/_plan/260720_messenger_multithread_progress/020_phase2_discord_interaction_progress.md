# messenger-bridge — Phase 2 Discord interaction-turn progress

Status: P (design) · class C3 · implementation not started

## Loop-spec header

- **WP2 D as-built (2026-07-20):** implemented as specced — NEW
  `src/discord-interaction-progress.ts` (+test; stage renderer/mapper moved
  into this module to avoid a circular import, as the doc permitted), MODIFY
  `discord-commands.ts` / `discord-interactions.ts` / `discord-adapter.ts`
  (checked defers) / `output-formatter.ts` (checked aggregate). Fresh gates:
  `npm test` 1173/1173, `npm run build` exit 0.
  `dist/discord-interaction-progress.js` force-tracked (L19 convention).
- **WP2 P stale check (2026-07-20, post-WP1 tree):** `createProgressWindow()`
  moved to `discord-adapter.ts:364` (was :334-377); `runTurnFromInteraction()`
  still at `discord-commands.ts:240`; `discord-interactions.ts` anchors
  unchanged. All other design content verified current. WP1 also shipped the
  shared `progressFilter` seam shape (`full|summary|drop`, per-kind table in
  010) — the mode-gating seam declared below MUST use the same shape.
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
`progressFilter?: (event: RunnerEvent) => "full" | "summary" | "drop"` — the
exact WP1 seam shape (`telegram-progress.ts:12-13,109-126`). Phase 2 defaults
it to absent, preserving all currently renderable runner stages (equivalent to
`full`). `onEvent()` applies the filter BEFORE rendering or scheduling an
edit: `full` = current stage rendering; `summary` per kind — status/thinking
→ stage label only, tool_call → tool name only, file_change → path only;
`drop` = excluded. `message` events BYPASS the filter (the Writing-stage
latest text keeps updating). Phase 3 replaces the default at each call site
with the agent's `tool_progress` policy; no controller rewrite is required.

## Diff-level change map

### NEW `plugins/codexclaw/components/messenger-bridge/src/discord-interaction-progress.ts`

Own interaction-original rendering, token-expiry handoff, and terminal cleanup.

- Export `DISCORD_INTERACTION_HANDOFF_MS = 14 * 60 * 1_000` and
  `createDiscordInteractionProgress(options)`.
- Options include `api`, `applicationId`, `interactionToken`, `channelId`,
  `guildId` (from the existing `interaction.guild_id`), `log`, optional
  `progressFilter`, and injectable clock/timer functions. A factory/deps seam
  on `InteractionContext`/`runTurnFromInteraction()` lets integration tests
  inject the clock without wall-clock waits.
- Return `start()`, `onEvent(event)`, and `finish(result)`.
- `start()` immediately edits the deferred original to a running embed, checks
  `DiscordApiResult`, and arms one handoff timer measured from controller
  creation. A failed initial edit is logged and does not prevent the turn.
- Reuse/export the existing Discord `progressFromEvent()` and embed renderer
  rather than inventing a second stage vocabulary. Keep a latest-snapshot slot,
  one in-flight edit, last-edit time, and a closed flag.
- `onEvent()` first applies `progressFilter` (default `full`; `message`
  events bypass), maps accepted events to stages, and performs a
  serialized/coalesced edit against the active
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
- ALL mutations (progress edits, handoff channel-message create, pointer edit,
  terminal edit) run on ONE serialized lane with an explicit `handoffPromise`.
- `finish()` marks the controller closed (admission stops), clears the handoff
  timer (cancels a not-yet-started handoff), JOINS an already-started handoff
  (`await handoffPromise`), chooses the terminal target ONCE from the joined
  state (original vs channel message), and issues EXACTLY ONE terminal edit to
  success or error. It checks and logs the terminal result. Rejected API
  promises and failed 401/unknown-token results are caught and logged without
  rejecting `finish()` or suppressing durable delivery. It never sends the
  durable answer itself.

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

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts`

Functions: `deferNativeInteraction()` (:149-152), `rejectInteraction()`, and
the private `progressFromEvent()`/stage-embed renderer (:544-565).

Before: the production gateway path defers native interactions by DISCARDING
the `createInteractionResponse()` result, then reports `deferred: true` — a
failed ack still executes `/ask`, `/review`, and component retry.
`progressFromEvent()` and the embed renderer are private to the adapter.

After:

- `deferNativeInteraction()` and `rejectInteraction()` CHECK the callback
  result and fail the turn on a failed ack (no execution after failed defer).
- `progressFromEvent()` and the stage-embed renderer are EXPORTED (or moved to
  the new controller module) so the interaction controller reuses the exact
  stage vocabulary; the adapter's own progress window keeps using them.
- Regression coverage: a failed-defer case in
  `test/discord-adapter.test.ts` (extend :662-707) proves no turn executes.

### MODIFY `plugins/codexclaw/components/messenger-bridge/src/output-formatter.ts`

Function: `sendFormattedDiscordOutput()` (:100-116).

Before: returns `Promise<void>` and only LOGS failed `sendFile`/`sendMessage`
results — callers cannot distinguish delivered from undelivered finals.

After: returns a checked aggregate `{ ok: boolean; error?: string }` (`ok`
only when every required chunk/file send succeeded). All existing callers
keep working (the value is ignorable); `runTurnFromInteraction()` consumes it
as the delivery override in its single real-outcome variable. Covered by a
formatter contract test (success aggregate, first-failure aggregate).

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

Unit-test the controller independently: `progressFilter` modes — `full`
(default, all stages render), `summary` per kind (status/thinking → stage
label, tool_call → name only, file_change → path only), `drop` (excluded),
and `message`-event bypass (Writing stage keeps updating under `drop`);
stage mapping, throttled last-write-wins edits, initial-edit failure,
13:59 no handoff, 14:00 handoff, send failure, pointer-edit failure, atomic
target switch, post-handoff edits, success/error finish, concurrent finish and
in-flight handoff (join semantics, exactly one terminal edit), result checking,
and timer cleanup.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/discord-adapter.test.ts`

Before: native-interaction defer path assumes successful callbacks.

After: add a failed-defer regression (extend :662-707) proving no turn
executes after a failed `createInteractionResponse()`; existing textual
`!cxc retry` tests (:513-619) stay unchanged.

### MODIFY `plugins/codexclaw/components/messenger-bridge/test/output-formatter.test.ts`

Before: Discord formatted-output delivery results are unobservable.

After: contract tests for the checked aggregate — all-chunks-success returns
`{ ok: true }`; a failed chunk/send returns `{ ok: false, error }` while
later chunks still attempt delivery per existing policy.

## Activation scenarios

| Trigger | Expected evidence |
|---------|-------------------|
| `/ask` or `/review` completes before 14 minutes | Deferred original advances through event-driven stage embeds; fresh channel answer is delivered; original ends success/error. |
| Component `retry` finds a previous prompt | The replayed turn exposes the same `onEvent` stages and final lifecycle as slash commands. |
| Queue wait plus turn reaches about 14 minutes | Bot-authenticated channel progress message is created; original points to it; all later progress and terminal edits target that message id. |
| Handoff channel send fails | Failure is logged; no target switch and no webhook followup; the turn and durable answer continue. |
| Handoff pointer edit fails after channel message creation | Failure is logged; channel message becomes authoritative and receives all later updates. |
| Defer fails | Handler does not start the turn; checked error reaches the interaction boundary/log. |
| Runner emits an event the `progressFilter` marks `drop` | No edit is scheduled for that event; `summary` events render per-kind reduced text; `message` events bypass the filter and keep updating the Writing stage; default Phase 2 configuration renders all events `full`. |
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
`test/discord-interactions.test.ts`, `test/discord-adapter.test.ts`
(failed-defer regression), and `test/output-formatter.test.ts` (aggregate
contract). Fake clock assertions must prove the
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

1. Should the existing nested gateway `createProgressWindow()` be extracted to
   share coalescing primitives, or should Phase 2 copy only its behavior? Prefer
   no extraction unless tests show a stable transport-neutral state machine;
   WP2 and WP1 are parallel renderer phases, not a code dependency.
2. Discord documents a 15-minute token lifetime, but the exact safety margin is
   policy. Start at 14 minutes and make only the timer injectable, not a user
   setting.

## WP2 A-audit amendments (round 1, reviewer VERDICT: FAIL → all accepted)

1. **Production defer path hardened.** Change map gains MODIFY
   `discord-adapter.ts`: `deferNativeInteraction()` (:149-152) and
   `rejectInteraction()` must CHECK the `createInteractionResponse()` result
   and fail the turn on a failed ack (no execution after failed defer).
   Regression coverage in `test/discord-adapter.test.ts` (extend :662-707).
2. **Checked delivery boundary.** Change map gains MODIFY
   `output-formatter.ts`: `sendFormattedDiscordOutput()` returns a checked
   aggregate `{ ok, error? }` instead of `Promise<void>` (it currently only
   logs failed sends at :100-116). `runTurnFromInteraction()` keeps ONE real
   outcome variable across resolved queue failure, promise rejection,
   cancellation, and the delivery override, and finishes progress with it.
3. **Handoff/finish ownership protocol.** The controller runs ALL mutations
   (edits, handoff create, pointer edit, terminal edit) on a single
   serialized lane with an explicit `handoffPromise`. `finish()` (a) closes
   admission of new work, (b) cancels a not-yet-started handoff (clears the
   timer), (c) JOINS an already-started handoff (`await handoffPromise`),
   (d) chooses the terminal target ONCE (original vs channel message,
   whichever the joined state dictates), and (e) issues EXACTLY ONE terminal
   edit. Rejected API promises and failed 401/unknown-token results are
   caught and logged without rejecting `finish()` or suppressing durable
   delivery.
4. **Mode seam aligned with WP1.** The seam is
   `progressFilter?: (event: RunnerEvent) => "full" | "summary" | "drop"`
   (NOT a boolean): `full` = current rendering; `summary` per kind —
   status/thinking → stage label only, tool_call → name only, file_change →
   path only; `drop` = excluded. `message` events BYPASS the filter (the
   Writing-stage latest text keeps updating), matching
   `telegram-progress.ts:12-13,109-126`. Tests cover all three modes plus
   message bypass. Open question 1 is CLOSED: `Interaction.guild_id` already
   exists (`discord-interactions.ts:32-39`) — pass it straight into the
   controller; no type churn.
5. **Change-map completeness.** MODIFY `discord-adapter.ts` also EXPORTS (or
   moves to the controller module) `progressFromEvent()` and the stage-embed
   renderer (currently private at :544-565) so the interaction controller
   reuses the exact stage vocabulary.
6. **Test plan corrections.** Declare a controller factory/deps seam through
   `InteractionContext`/`runTurnFromInteraction()` so integration tests
   inject fake time; extend the API fakes in `discord-commands.test.ts`
   (:70-94) and `discord-interactions.test.ts` (:48-70) with `editMessage`
   stubs; intentionally update the three legacy terminal assertions
   (`discord-commands.test.ts:153-155`, `discord-interactions.test.ts:118-120`,
   `:168-170`); add resolved queue-full and rejected-promise cases; add the
   adapter defer-failure test. Existing textual `!cxc retry` tests
   (`discord-adapter.test.ts:513-619`) stay unchanged.
