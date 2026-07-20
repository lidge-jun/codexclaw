# messenger-bridge — Multi-thread progress UX research

Status: P (research) · class C3 · docs-only

## Scope and symptom

The reported symptom is specific and reproducible in the Telegram webhook
group/topic ingress: after a user starts a Codex turn in multi-thread mode, the
chat shows neither intermediate assistant output nor tool activity; only the
durable final answer arrives. The webhook starts typing once, then explicitly
passes `onEvent: undefined` for every non-private chat
(`plugins/codexclaw/components/messenger-bridge/src/telegram-webhook.ts:148-160`),
while final delivery remains unconditional after the queued turn resolves
(`plugins/codexclaw/components/messenger-bridge/src/telegram-webhook.ts:162-169`,
`plugins/codexclaw/components/messenger-bridge/src/telegram-webhook.ts:239-251`).

This is not the behavior of every Telegram runtime mode. The long-poll adapter
has a weaker but non-zero group/topic progress path, documented below.

## Exhaustive ingress inventory

Search basis: every direct call to `AgentService.handleIncoming()` or
`AgentService.enqueueIncoming()` under
`plugins/codexclaw/components/messenger-bridge/src/*.ts`. `handleIncoming()` is
itself only a convenience wrapper over `enqueueIncoming()`
(`plugins/codexclaw/components/messenger-bridge/src/agent-service.ts:123-166`),
and `IncomingRequest.onEvent` is forwarded unchanged to the runner
(`plugins/codexclaw/components/messenger-bridge/src/agent-service.ts:247-264`).

| Direct caller | Platform and entry path | `onEvent` wiring | Resulting progress UX |
|---|---|---|---|
| `plugins/codexclaw/components/messenger-bridge/src/telegram-webhook.ts:94-170` | Telegram webhook ordinary message → `acceptMessage()` → `enqueueIncoming()` at `:150` | Private chats receive `sendWebhookDraftProgress`; the gate at `:158-160` passes `undefined` for groups and supergroups. | Private: draft events when rich drafts are usable. Group/topic: all runner events are dropped; one initial typing action is the only transient signal, then the final answer. This is the primary match for “nothing at all.” |
| `plugins/codexclaw/components/messenger-bridge/src/telegram-adapter.ts:291-406` | Telegram long-poll ordinary message → adapter `runTurn()` → `handleIncoming()` at `:383` | Always wires the local `onEvent` at `:391`; `draftStreaming` is restricted to rich-supported private chats at `:297`. | Private + draft support: draft progress. Group/topic or unsupported draft: one `🔄` status message, created/edited at `:312-335`; events are coalesced by the 1,500 ms constant at `:58`, retain the last five activity lines at `:378-380`, and the status is deleted at turn end at `:394-396`. This is a weak bubble, not zero progress. |
| `plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts:380-449` | Discord gateway `MESSAGE_CREATE` → `handleMessage()` → `handleIncoming()` at `:425` | Wires `progress.onEvent` at `:432`. `progressFromEvent()` maps thinking/tool/file/status/message events at `:518-533`. | Healthy message-gateway path: one progress embed starts before the turn, is edited with Thinking/Coding/Writing stages, and is finalized separately from the answer (`plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts:334-377`). |
| `plugins/codexclaw/components/messenger-bridge/src/discord-commands.ts:240-265` | Discord `/ask` and `/review` handlers at `:43-60`, plus component retry from `plugins/codexclaw/components/messenger-bridge/src/discord-interactions.ts:147-157`, all enter `runTurnFromInteraction()` → `handleIncoming()` at `:249` | No `onEvent` field is passed at `:249-256`. | Zero runner-event progress. The interaction response says “Working” before the call and “Done” afterward, but does not change from actual tool/message events. |
| `plugins/codexclaw/components/messenger-bridge/src/gateway-commands.ts:366-380` | Shared `/retry`: Telegram command dispatch reaches the gateway at `plugins/codexclaw/components/messenger-bridge/src/telegram-commands.ts:132-143`; Discord `!cxc retry` reaches the same handler through `plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts:284-295` | `GatewayCommandContext` has approval but no event callback at `plugins/codexclaw/components/messenger-bridge/src/gateway-commands.ts:21-30`; `handleRetry()` therefore passes no `onEvent` at `:371-379`. | Zero runner-event progress on both Telegram and Discord retry turns. This bypasses the Telegram adapter’s ordinary-message bubble and the Discord message-gateway embed. |
| `plugins/codexclaw/components/messenger-bridge/src/heartbeat.ts:113-155` | Autonomous heartbeat → `runAgent()` → `handleIncoming()` at `:133` | No `onEvent` at `:133-139`. | Intentional unattended exception: the turn is recorded, silent results are discarded, and only a completed non-silent result is fanned out at `:144-152`; there is no user waiting on an initiating message. |

The inventory has six direct call sites: one `enqueueIncoming()` caller and five
`handleIncoming()` callers. No other caller exists in the scoped source glob.

## Telegram runtime-mode asymmetry

For each Telegram agent, `BridgeController.buildAdapterEntry()` first attempts a
webhook when `agent.webhook_url` is non-empty and returns a webhook adapter on
success (`plugins/codexclaw/components/messenger-bridge/src/bridge-controller.ts:205-233`).
Only if no valid webhook is configured, or registration fails, does it create
the long-poll adapter (`plugins/codexclaw/components/messenger-bridge/src/bridge-controller.ts:234-264`).
These are mutually exclusive adapter entries for that agent.

Consequently:

- webhook + group/topic reproduces the exact “no intermediate response or tool
  output” symptom because `onEvent` is absent;
- long-poll + group/topic produces the transient, last-five-line `🔄` bubble;
- `/retry` produces no event-driven progress in either runtime because it enters
  through the shared command handler rather than ordinary-message `runTurn()`.

## Runner event model

`RunnerEvent` includes thread, status, thinking, tool call, file change, message,
done, and failure variants
(`plugins/codexclaw/components/messenger-bridge/src/runner.ts:21-29`). The runner
spawns stock `codex exec`/`codex exec resume` with `--json`
(`plugins/codexclaw/components/messenger-bridge/src/runner.ts:4-16`,
`plugins/codexclaw/components/messenger-bridge/src/runner.ts:67-95`) and parses its
JSONL stream.

The local parser accepts item-started and item-completed records for reasoning,
tool calls, and file changes, but emits an assistant `message` only when an
`agent_message` reaches `item.completed`
(`plugins/codexclaw/components/messenger-bridge/src/runner.ts:97-153`). Therefore
the current transport can expose tool/status activity and completed assistant
message items, but it cannot provide token-level assistant deltas.

## Externally sourced survey

This entire section is externally sourced. URLs point to the source read during
this research pass; quoted fragments are intentionally short.

### NousResearch/hermes-agent

- Sessions use deterministic keys across DMs, groups, and topics. The sessions
  guide gives `agent:main:<platform>:group:<chat_id>:<thread_id>` and says groups
  are “Per-user inside the group”; it also documents `group_sessions_per_user:
  true`. Source: <https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/sessions.md>.
- Discord supports `discord.auto_thread`, isolated concurrent user histories,
  and tool-progress controls. The guide says auto-threading “creates a new
  thread” and that the progress setting “Controls whether the bot sends progress
  messages.” Its `/verbose` control cycles `off → new → all → verbose`. Source:
  <https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/discord.md>.
- Telegram coalesces recurring status into one message: the guide says it
  “edits the existing bubble on subsequent emits.” It also pins the incoming
  message “for the duration of the turn.” Source:
  <https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/telegram.md>.
- Telegram notification mode `important` makes tool progress, streaming, and
  status silent while finals and approvals notify; the guide describes these as
  “delivered with `disable_notification=true`.” Source:
  <https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/telegram.md#push-notification-volume>.

### openai/codex

- App-server defines “Thread: A conversation between a user and the Codex
  agent” and exposes
  `thread/start`, `thread/resume`, and `thread/fork`; archive documentation says
  the persisted rollout is “stored as a JSONL file on disk.” Source:
  <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md>.
- The `codex exec --json` schema contains `thread.started`, `turn.started`,
  `item.started`, `item.updated`, `item.completed`, and `turn.completed`; the
  source labels these “Top-level JSONL events emitted by codex exec.” Source:
  <https://github.com/openai/codex/blob/main/codex-rs/exec/src/exec_events.rs>.
- Agent-message deltas are an app-server notification, where
  `item/agentMessage/delta` “appends streamed text for the agent message.” No
  corresponding agent-message delta event exists in the exec JSONL enum.
  Source: <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#agentmessage>
  and <https://github.com/openai/codex/blob/main/codex-rs/exec/src/exec_events.rs>.

The capability implication is bounded: `codex exec --json` is sufficient for
tool-status and completed-item progress UX; token-level answer streaming requires
an app-server event surface.

### Telegram Bot API

- `sendMessageDraft` was added in Bot API 9.3 on 2025-12-31, and Bot API 9.5 on
  2026-03-01 “Allowed all bots” to use it. Source:
  <https://core.telegram.org/bots/api-changelog#december-31-2025> and
  <https://core.telegram.org/bots/api-changelog#march-1-2026>.
- Both `sendMessageDraft` and `sendRichMessageDraft` define `chat_id` as the
  “target private chat.” `message_thread_id` does not broaden that chat-type
  constraint. Drafts are an ephemeral “temporary 30-second preview.” Source:
  <https://core.telegram.org/bots/api#sendmessagedraft> and
  <https://core.telegram.org/bots/api#sendrichmessagedraft>.
- Telegram’s FAQ says to avoid “more than one message per second” in one chat
  and states groups cannot send “more than 20 messages per minute.” Source:
  <https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this>.
- A 429 response can carry `ResponseParameters.retry_after`, defined as the
  “number of seconds left to wait” before retry. Source:
  <https://core.telegram.org/bots/api#responseparameters>.
- The Bot API publishes no numeric `editMessageText` rate limit. That absence is
  not evidence that edits are unlimited.

### Comparable bots

- OpenClaw’s Telegram `progress` mode “keeps one editable status draft” and uses
  normal final delivery; its reasoning preview “is deleted after final
  delivery.” Source:
  <https://github.com/openclaw/openclaw/blob/main/docs/channels/telegram.md>.
- `grinev/opencode-telegram-bot` advertises a “pinned message ... updated in real
  time” and subagent activity including “current task, agent, model, and active
  tool step.” Source: <https://github.com/grinev/opencode-telegram-bot>.
- `littlebearapps/untether` binds workspace forum topics to a project/branch and
  shows “tool calls, file changes, and elapsed time.” Source:
  <https://github.com/littlebearapps/untether>.
- OpenACP says “Each conversation gets its own thread/topic” and users can “See
  agent thinking, tool calls, and output as they happen.” Source:
  <https://github.com/Open-ACP/OpenACP>.

## Confidence

### Verified

- All six local ingress call sites and their current `onEvent` arguments were
  read in the current tree.
- Webhook-versus-poll selection, the private-only webhook gate, the long-poll
  fallback bubble, Discord message embeds, interaction gap, retry gap, and
  heartbeat exception are anchored to current source lines.
- The runner’s local parser behavior and upstream exec/app-server event split
  were checked against current source.
- Telegram draft chat-type constraints, changelog dates, FAQ message limits,
  draft lifetime, and `retry_after` semantics were checked against Telegram’s
  official documentation.

### Unverified or version-sensitive

- Telegram publishes no numeric edit-message limit, so an exact safe edit rate
  cannot be claimed from official documentation.
- GitHub `main` documentation and source can lead packaged releases. The surveyed
  Hermes, Codex, OpenClaw, and comparable-bot features are verified on the linked
  current pages, not against every published package version.
- No live Telegram forum-topic turn was executed in this docs-only research unit;
  the symptom classification is source-level RCA, not a fresh production-bot
  recording.
