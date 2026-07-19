# 001 — Spec research (lunasearch swarm, 2026-07-05)

Swarm: 5 Luna explorer lanes spawned (hardcoded gpt-5.3-codex-luna). 3 returned;
2 died to context exhaustion (GitHub-ecosystem lane, security lane) — findings below
marked accordingly. Verification: main-session claims cross-checked against the
returned primary URLs (core.telegram.org) per cxc-search proof handoff.

## Verified findings (primary: core.telegram.org/bots/api)

1. **Forum topics**: `createForumTopic`/`editForumTopic`/`closeForumTopic`/
   `reopenForumTopic`/`deleteForumTopic` exist since Bot API 6.3 (2022-11-05).
   Supergroup use requires bot admin + `can_manage_topics`; `deleteForumTopic`
   requires `can_delete_messages`. `Chat.is_forum` flags topic-enabled supergroups.
   Private-chat topic support added 2025-12-31 (Bot API 10.x): `deleteForumTopic`
   is documented for "forum supergroup or private chat with a user".
2. **Deletion limits**: `deleteMessage` <48h + permission-dependent; there is NO
   clear-DM-history Bot API method. `deleteForumTopic` deletes a whole topic
   including messages. `leaveChat` is group/supergroup/channel only.
3. **Polling**: `getUpdates` offset = last_update_id + 1 acknowledges; single
   long-poller per token (409 conflict otherwise) — confirms one-adapter-per-token
   design; multi-session must live INSIDE one adapter.
4. **Command UX**: commands `/keyword` ≤32 chars latin; `setMyCommands` up to 100,
   scoped via BotCommandScope; `callback_data` ≤64 bytes; `/cmd@BotName` form in
   groups; deep-link `/start <payload>` ≤64 chars. Status updates via
   `editMessageText`; flood control returns `retry_after` (respect-then-retry).

## Unverified leads (lane died before return)

- GitHub ecosystem lane: existing bridges (chatgpt-telegram-bot, claude-code TG
  bridges) commonly use per-chat session maps and `/new`-style lifecycle commands —
  consistent with local prior art already in-repo (../jawcode topic-per-session).
- Security lane: realpath confinement + allowed-roots is the standard pattern for
  remote dir selection (mirrors ../jawcode workspace-path-confinement.ts, which we
  read directly in-repo — local evidence, not web).

## Local code evidence (read directly)

- exec cwd flows adapter → `handleIncoming(req.workdir)` → `runTurn({workdir})` →
  `spawn(..., { cwd })` (runner.ts:164). Binding row already persists `workdir`
  (schema v4) but agent-service currently passes `req.workdir` (adapter static
  value) to runTurn — binding.workdir is write-once cosmetic today.
- `/kick` precedent for chat-scoped teardown commands; `handleReset` precedent for
  binding mutation commands; telegram-adapter command dispatch is a startsWith chain.
- jawcode contrast: parser-enforced "no cwd from Telegram" (lifecycle-control-
  runtime.ts:113) — our user explicitly chose the opposite posture (000 decision).
