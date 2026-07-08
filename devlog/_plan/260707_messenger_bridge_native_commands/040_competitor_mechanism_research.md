# Competitor Mechanism Research — WP4/WP5/WP6/WP9 parameter feed

Date: 2026-07-07. Source: gpt-5.5-xhigh explorer "Lovelace" (web + source reads of
openclaw@1437512 and NousResearch/hermes-agent@05cbddc). Feeds P-phase specs of the
wp5/wp7 and wp4/wp6 and wp9 batches. Full citations in agent transcript; key URLs inline.

## Adopted parameters (diff-level defaults)

### WP5 Streaming/Progress
- Model: single progress message, `send -> edit -> final` ProgressWindow.
- Telegram: edit throttle >= 1000ms (OpenClaw default; min 250ms), parse 429
  `parameters.retry_after` and SUSPEND edits during flood (max 60s), treat
  "message is not modified" as success, stop previews after 3 consecutive failures.
  Early `sendChatAction` typing. (openclaw extensions/telegram/src/draft-stream.ts:36,
  network-errors.ts:236)
- Discord: edit throttle >= 1200ms, 2000-char cap, no mentions during progress,
  FINAL as a FRESH message (unread behavior; openclaw CHANGELOG "Discord streamed
  finals"), honor 429 retry_after. Interaction defer = entry ack only; long runs
  switch to bot-token channel messages (3s ack window, 15-min token).
- Hermes contrast: 0.8s edit interval + exponential flood backoff to 10s;
  editMessageText kept as reliable path for groups/forum topics (draft API is
  private-chat only) — matches our existing sendDraftProgress private-chat gate.
- AMENDS WP5 spec: telegram-rich-send throttle becomes 1000ms (spec said 500ms);
  add retry_after suspension + not-modified-is-success to the throttle diff.

### WP6 Approval Relay
- Buttons: allow-once / allow-always / deny (OpenClaw trio) — spec's approve/deny
  upgraded to include allow-always bound to exact command+session+cwd (binding
  scheme per openclaw src/infra/system-run-approval-binding.ts:96).
- Fallback text command: `/approve <id> allow-once|allow-always|deny` (both platforms).
- Timeout: fail-closed DENY (OpenClaw 30min default, Hermes 60s) — adopt
  configurable default 10min; on timeout the turn receives denial, not abort.
- Unauthorized clicker: acknowledge with denial text, do not resolve.
- Clear reply markup / disable buttons on resolve or expiry.

### WP4 Forum/Thread Routing
- Telegram: topic id is first-class; General topic = id 1; session key
  `<chatId>:topic:<message_thread_id|1>`; propagate message_thread_id on ALL sends
  including typing.
- Discord: never collapse guild scope; thread id as session discriminator;
  auto-thread-per-task with auto_archive_duration=60 (minutes) default; sweep
  bindings on idle/max-age/archive/delete (openclaw thread-bindings.manager.ts:131)
  — adopt 24h idle sweep in-memory + db row.
- Hermes session key shape for reference: `agent:main:discord:group:<id>:thread_<id>`.

### WP9 Telegram Webhook
- Opt-in only; long-poll stays default (both competitors agree).
- MUST validate `X-Telegram-Bot-Api-Secret-Token` header; register via setWebhook
  with secret_token; ack 200 only after update is accepted (durable spool in
  OpenClaw; for us: enqueue via existing queue before 200).
- Update dedup: persist last_update_id + dedup by update_id (poll path already
  persists offset; webhook path needs the same discipline).
- Fallback: non-transient registration failure -> deleteWebhook(drop_pending=false)
  -> long-poll resume.

## New competitor capabilities since gap analysis (recheck list)
- OpenClaw v2026.6.11 (2026-06-30): TG progress bubble cleanup, webhook restart
  continuity, stuck-chat recovery, topic cron alerts, external-channel exec approval
  result routing, DC progress-preview reliability.
- OpenClaw post-Q2 changelog: TG Codex /login pairing+steering, TG multi-lane
  progress summaries, stable multi-line progress window, DC fresh final messages.
- Hermes docs: TG private-chat topics, native draft streaming, rich messages,
  status-bubble edits, pin-as-working indicator.
- Disposition: fold "fresh final message" + retry_after discipline into WP5 spec
  (done above); /login pairing + multi-lane summaries + pin-as-working recorded as
  POST-wp9 backlog candidates, NOT scope creep into current goal (criteria fixed at P).
