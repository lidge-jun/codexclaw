# Decision: This Is Pure Gap, Not A User Fork

Status: DECIDED
Date: 2026-07-07
Related goalplan:
`.codexclaw/goalplans/codexclaw-messenger-bridge-telegram-discord-diff/goalplan.json`

## Question

Does Jun need to choose a direction before implementation, or is the
Telegram/Discord messenger bridge gap already clear from competitor research?

## Decision

No user decision is required for the baseline direction.

The researched gap is not mainly taste, branding, or product-positioning. It is a
capability gap against OpenClaw, Hermes, Claude Code Channels, and the platform
APIs themselves.

Default direction:

- Upgrade Telegram from mostly text exchange to command menu, inline keyboard,
  callback query, rich draft streaming, media input, and file output.
- Upgrade Discord from prefix-style message handling to slash commands,
  interactions, components, embeds, threads, deferred responses, and attachments.
- Keep `codex exec --json` as the execution substrate.
- Build messenger-native control commands that manipulate codexclaw bindings,
  agents, jobs, and child processes.

## Why This Is A Gap

The current bridge already contains several platform API primitives but does not
use them in adapters:

- `telegram-api.ts`: `sendMessageWithKeyboard`, `answerCallbackQuery`,
  `setMyCommands`, `sendPhoto`, `sendDocument`, `sendVoice`, `getFile`,
  `downloadFile`, `sendRichMessage`, and `sendRichMessageDraft`.
- `discord-api.ts`: `sendEmbed` exists, but the adapter mostly sends plain
  content chunks.
- `discord-gateway.ts`: gateway message lifecycle exists, but there is no
  `INTERACTION_CREATE` handling.
- `agent-service.ts`: per-binding serialized execution exists, but there is no
  explicit cancellation/control command layer.

Competitor baseline from the research:

- OpenClaw exposes native Telegram commands, inline keyboards, topic-aware
  routing, Discord components, thread-bound sessions, richer streaming, media
  handling, and dedicated rate-limit schedulers.
- Hermes exposes gateway commands such as `/new`, `/model`, `/retry`,
  `/status`, `/stop`, `/sethome`, `/background`, `/voice`, `/rollback`, and
  `/help`, plus model pickers, clarify buttons, thread sessions, and media
  routing.
- Claude Code Channels proves that chat-channel control should be a remote
  control layer for a local coding agent, with pairing, allowlists, reactions,
  message edits, history fetch, and permission relay.

## What Jun Would Need To Decide Later

Only one later strategic fork may need explicit input:

- Minimal remote-control bridge: keep small `/status`, `/new`, `/stop`, `/model`
  control surface.
- Rich gateway: expose full platform-native controls, approvals, media, threads,
  and background flows.

Current recommendation: rich gateway.

Reason: the codebase already has enough API substrate that this is mostly
adapter/command/routing work, not a philosophical rewrite.

## Diff-Level Consequence

Implementation should proceed with the following work-phase ordering from the
goalplan:

```text
WP1 Telegram interactive surface
WP2 Discord interaction engine
WP8 GUI observability
WP3 Gateway command unification
WP5 Streaming + progress display
WP7 Media I/O
WP4 Forum/thread routing
WP6 Approval/permission relay
WP9 Telegram webhook mode
```

No patch should begin by adding a generic PTY relay. The gap is platform-native
controls over the existing bridge model.
