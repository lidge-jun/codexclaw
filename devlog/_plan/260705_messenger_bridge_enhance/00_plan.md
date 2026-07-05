 # messenger_bridge — Enhancement Plan (Post-MVP Hardening + Feature Expansion)
 
 Status: PLAN · 6 phases, each independent PABCD cycle
 Base: all 9 original phases SHIPPED (2026-07-03); suite 65/65; production-ready
 behind loopback+allowlist boundary.
 
 ## Motivation
 
 The shipped bridge handles text-in/text-out cleanly, but a production
 messenger bot needs richer interactions: media, commands, resilience under
 load, and better UX affordances. This plan adds those layers incrementally
 without touching the security boundary (already hardened in Phase 9).
 
 ---
 
 ## Phase E1 — Rich Media Support (Telegram + Discord)
 
 **Goal:** Send and receive images, files, voice, and structured content.
 
 ### Telegram
 - `sendPhoto` / `sendDocument` / `sendVoice` in `telegram-api.ts`
 - Receive photo/document/voice updates: extract `file_id`, download via
   `getFile` + fetch, save to a temp dir, pass the local path to Codex as
   context (image description prompt wrapper).
 - Outbound: when Codex produces a file path (detected via pattern), upload it
   via the appropriate `send*` method instead of text.
 - Inline keyboard support: `reply_markup` in `sendMessage` for structured
   choices (confirm/cancel patterns).
 - Link rendering: markdown `[text](url)` → `<a href="url">text</a>` in
   `telegram-format.ts`.
 
 ### Discord
 - File attachments via multipart/form-data in `discord-api.ts`.
 - Receive attachments from MESSAGE_CREATE: download URL → temp → Codex.
 - Embed support: send rich embeds (title, description, color, fields) for
   structured Codex outputs (code blocks > 2000 chars, summaries).
 
 ### Tests
 - telegram-api: sendPhoto/sendDocument mock round-trips.
 - telegram-format: link conversion, attachment detection.
 - discord-api: multipart upload mock.
 - adapter integration: file-path-in-result → upload path exercised.
 
 ---
 
 ## Phase E2 — Slash Commands & Interactive Controls
 
 **Goal:** Native platform commands and button interactions.
 
 ### Telegram
 - Register bot commands via `setMyCommands` on adapter start:
   `/start`, `/id`, `/status`, `/reset`, `/model`, `/help`.
 - `/status` → current binding thread info, model, effort, queue depth.
 - `/reset` → clear binding thread_id (fresh session next message).
 - `/model <name>` → per-binding model override (persisted in bindings table).
 - `/help` → brief capability summary.
 - Callback query handling for inline keyboards (Phase E1 buttons):
   `answerCallbackQuery` + dispatch.
 
 ### Discord
 - Application commands (slash commands) registration via REST
   `PUT /applications/{app}/commands`.
 - `/status`, `/reset`, `/model`, `/help` — same semantics.
 - Button components (action rows) for structured Codex tool approvals
   (future: when full-access is off, Codex can ask for confirmation).
 - Interaction endpoint handling in the gateway dispatch.
 
 ### Tests
 - Command dispatch routing.
 - Callback/interaction response formatting.
 
 ---
 
 ## Phase E3 — Resilience & Rate Limiting
 
 **Goal:** Survive API rate limits, transient failures, and high throughput
 without data loss.
 
 ### Telegram
 - Respect `retry_after` in 429 responses: exponential backoff with the
   server-specified delay.
 - Per-chat send queue with rate awareness (Telegram: 1 msg/sec per chat,
   30 msg/sec global for bots).
 - Webhook mode option: `setWebhook` + incoming HTTP handler as an
   alternative to long-poll (better for high-traffic bots, saves a persistent
   connection).
 
 ### Discord
 - Rate limit headers (`X-RateLimit-*`): parse bucket/remaining/reset,
   queue sends per bucket.
 - Gateway rate limit (120 events / 60s): command sends are already sparse,
   but add a guard.
 - Reconnect with jittered backoff on 4000-4014 close codes (currently
   reconnects instantly — add graduated delay).
 
 ### General
 - Circuit breaker pattern: if an API returns 5xx N times in a row, pause
   sends for that adapter and log a warning (avoid thundering herd on
   platform outages).
 - Health endpoint enhancement: `/api/health` reports per-adapter rate-limit
   headroom and circuit-breaker state.
 
 ### Tests
 - Rate-limit simulation (429 → backoff → resume).
 - Circuit breaker trip/recovery.
 - Webhook ingress mock.
 
 ---
 
 ## Phase E4 — Conversation UX Enhancements
 
 **Goal:** Richer conversation experience for end users.
 
 ### Multi-turn Context Display
 - `/context` command: show the last N turns summarized (from jobs table).
 - Quote/reply support: when a user replies to a specific bot message,
   include that message's context in the prompt (Telegram:
   `reply_to_message`; Discord: `message_reference`).
 
 ### Thread Management
 - Telegram forum topics: respect `message_thread_id` for topic-based routing
   (already partially implemented — extend to create topics automatically for
   new bindings in supergroups with topics enabled).
 - Discord threads: when a guild channel has threading enabled, create a
   thread per binding instead of replying in the main channel (cleaner
   history).
 
 ### Typing & Progress
 - Progress bar for long Codex runs: periodic status edits show elapsed time
   + last tool call (Telegram already does this; Discord currently only fires
   typing — add an ephemeral progress message that self-deletes on completion).
 - Streaming partial responses: as `item.completed` events with text arrive,
   append to a live-edited message (Telegram edit + Discord edit, throttled
   to avoid rate limits).
 
 ### Tests
 - Reply-to-context extraction.
 - Thread creation mock.
 - Streaming edit throttle.
 
 ---
 
 ## Phase E5 — Observability & Diagnostics
 
 **Goal:** Production visibility into bridge health and usage.
 
 ### Metrics API
 - `/api/metrics` endpoint: messages processed, turns completed, errors,
   avg response time, queue depth, per-agent breakdown.
 - SQLite-backed rolling counters (hourly buckets, 7-day retention).
 
 ### Event Log
 - Structured JSON log file (`~/.codexclaw/bridge-events.jsonl`): every
   incoming message, dispatch result, error, rate-limit hit, reconnect.
 - Log rotation: max 50MB, 3 files.
 - `/api/events` endpoint: last N events (GUI consumption).
 
 ### Health Monitoring
 - Adapter liveness probe: if no poll response in 2x poll timeout (Telegram)
   or no heartbeat ACK in 2x interval (Discord), mark adapter "degraded" and
   attempt recovery.
 - GUI status badge: green/yellow/red per adapter based on liveness +
   rate-limit headroom.
 - Optional external webhook notification on adapter failure (configurable
   URL in agent settings).
 
 ### Tests
 - Metrics accumulation.
 - Log rotation.
 - Liveness detection.
 
 ---
 
 ## Phase E6 — Multi-Chat & Group Enhancements
 
 **Goal:** Better support for group conversations and multi-chat workflows.
 
 ### Group Intelligence
 - Per-group system prompt: an agent can have a different personality/context
   per paired chat (stored in allowlist table — new `system_prompt` column).
 - Selective response in groups: beyond @mention, support a configurable
   trigger prefix (e.g. `!ask ...`) so users don't need to type the full
   bot name.
 - Message threading in groups: Telegram reply-to-bot-message threading so
   conversations don't interleave.
 
 ### Multi-Chat Routing
 - One agent, multiple paired chats: currently works (allowlist admits
   multiple), but the heartbeat only targets the first chat. Extend heartbeat
   to broadcast to ALL paired chats (configurable: all vs. first).
 - Cross-chat context: optional shared binding mode where multiple chats
   share one Codex thread (useful for a team channel + DM scenario).
 
 ### Admin Controls
 - `/kick` command (admin-only): remove a chat from the allowlist without
   revoking the bot token.
 - `/pause` / `/resume`: temporarily suspend an agent's auto-response
   without disabling it (useful during maintenance).
 - Rate limiting per user in group chats: prevent one user from flooding
   the bot with requests.
 
 ### Tests
 - Multi-chat heartbeat broadcast.
 - Trigger prefix routing.
 - Admin command ACL.
 
 ---
 
 ## Execution Order
 
 E1 → E3 → E4 → E2 → E5 → E6
 
 Rationale: Media (E1) is the most user-visible gap. Resilience (E3) protects
 the expanded surface before adding more interactive complexity. UX (E4) and
 commands (E2) layer on the stable base. Observability (E5) is valuable but
 not blocking; group enhancements (E6) are the most situational.
 
 ## Shared Constraints
 
 - ZERO new runtime deps (maintain the build soundness contract).
 - All new API methods injectable (fetch/ws) for offline tests.
 - Security boundary unchanged: loopback + allowlist + at-most-once.
 - Each phase passes the full existing 65-test suite + its own new tests.
