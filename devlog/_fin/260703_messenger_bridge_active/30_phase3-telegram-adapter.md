# messenger_bridge — Phase 3: Telegram adapter

Status: SHIPPED (D closed 2026-07-03; 44/44 messenger-bridge suite, gate OK)
· class C3 (remote ingress; allowlist = C4) · zero deps: raw Bot API over
global fetch

## A audit (2026-07-03): FAIL → fixes applied

1. editMessageText lacks parse_mode — N/A: status edits send plain `$ cmd`
   text, not HTML, so no raw-tag rendering. Left plain by design.
2. deleteWebhook now takes `dropPending`; cold start (persisted offset 0) drops
   the pending backlog so a first boot never replays a pile of full-perm execs.
3. caption already included (gate reads `msg.text ?? msg.caption`).
4. Doc previously claimed markdown link conversion — NEITHER cli-jaw nor
   telegram-format.ts implements it; claim removed (below).
5. **Offset was memory-only → crash could redeliver a started full-perm exec.**
   Fixed: schema v3 `channels.poll_offset`, persisted BEFORE dispatch and
   reloaded on start (`db.getPollOffset`/`setPollOffset`).

## D record (2026-07-03)

- Built: `telegram-api.ts` (typed Bot API over fetch, token-redacting errors),
  `telegram-format.ts` (md→HTML + safe chunking, ported from cli-jaw),
  `telegram-adapter.ts` (poll loop, allowlist/mention/handshake gating, typing
  + status-edit + chunked-answer UX, 409 backoff, offset persistence, shutdown
  reaping via AgentService). db v2 (handshake window) + v3 (poll_offset). Serve
  wiring in cli.ts starts the adapter when telegram is the active channel.
- Tests: telegram-format (6), telegram-adapter (5, offline scripted fetch),
  db-migration (2, v1→v3 upgrade of a legacy db). Suite 44/44; gate OK.
- KEY LEARNING (test harness): a mock fetch that returns resolved promises in a
  hot poll loop starves the macrotask timer (microtask starvation) → the loop
  never yields. Mocks must park on a pending promise or a setTimeout-delayed
  resolve to mirror a real network boundary.
- NOTE: this is the message-content dependency-free path; link markdown is NOT
  converted to HTML anchors (parity with cli-jaw). Add later only if requested.

---
(original plan below)

Status: P DRAFT (2026-07-03; enters A after Phase 2 closes D) · class C3
(remote ingress surface — allowlist slice gets C4 care) · zero deps: raw Bot
API over global fetch (grammY from the stub is replaced per 00_plan
Dependencies decision)

## Part 1 — plain

With a bot token saved and telegram active, cxc serve long-polls the Telegram
Bot API. A chat gets in by pressing /start while the GUI connect wizard is
waiting (Phase 5/7) — or is already on the allowlist. Every allowlisted text
message runs through the Phase 2 agent-service: the bot shows "typing…", edits
a single status message with live tool activity, then replaces it with the
final Codex answer (chunked under Telegram's 4096-char limit). Non-allowlisted
chats are ignored silently. Group chats require an @mention of the bot.

## Part 2 — diff-level

### NEW `components/messenger-bridge/src/telegram-api.ts`

Thin typed fetch wrapper (unit-testable via injectable fetch):
- `tgCall(token, method, payload, fetchImpl?)` → POST
  `https://api.telegram.org/bot<token>/<method>`, JSON body, returns
  `{ ok, result?, description?, error_code? }`. Never logs the token; errors
  carry `error_code` + description only.
- Convenience: `getMe`, `getUpdates({offset, timeoutSec})` (long poll, request
  timeout = timeoutSec + 10s via AbortSignal), `sendMessage({chatId, text,
  parseMode?, messageThreadId?, replyMarkup?})`, `editMessageText`,
  `deleteMessage`, `sendChatAction(typing)`.

### NEW `components/messenger-bridge/src/telegram-format.ts`

Pure (ported behavior from cli-jaw `src/telegram/forwarder.ts` reference):
- `markdownToTelegramHtml(text)` — code fences/inline code/bold/italic/links →
  Telegram HTML subset, everything else escaped.
- `chunkTelegramMessage(html, max = 4096)` — split on paragraph/code-fence
  boundaries, never inside a tag; returns ≥1 chunk.

### NEW `components/messenger-bridge/src/telegram-adapter.ts`

`createTelegramAdapter({ db, token, workdir, agentService, fetchImpl?, log? })`
→ `{ start(), stop(), status() }`:
- Poll loop: `getUpdates(offset, 50)`; on each update dispatch async
  (per-chat ordering comes from agent-service's per-binding queue); offset =
  update_id + 1 acknowledged BEFORE dispatch so a crashed turn is not
  re-delivered (at-most-once — a lost turn beats a duplicate full-perm exec).
- 409 defense (another poller holds the token): backoff retry 5s→10s→20s→30s
  cap, max 3 consecutive → stop with status "conflict" (mirrors cli-jaw
  `src/telegram/bot.ts:712-727` semantics without grammY).
- Network errors: log + 2s backoff, never crash the loop; stop() aborts the
  in-flight getUpdates via AbortController and ends the loop.
- Handshake: `/start` in a NON-allowlisted chat → if a handshake window is
  open (db-backed flag set by the Phase 5 connect flow), add chat to
  allowlist + reply "connected"; else reply nothing (silent). `/start` in an
  allowlisted chat → friendly "already connected" reply.
- `/id` → replies the chat id (parity with cli-jaw, aids manual allowlisting).
- Gate order for message updates: allowlist check → group @mention gate
  (chat.type group/supergroup requires @<botUsername> in text; strip it) →
  text non-empty.
- Turn UX: `sendChatAction typing` immediately + every 4s while running;
  status message: first status event → `sendMessage("🔄 <label>")`, later
  events → `editMessageText` (coalesced ≥1.5s apart, last 5 labels); on final
  → delete status message, send chunked HTML answer (fallback: strip tags on
  parse error re-send); on error → "❌ <message>".
- Handshake window storage: reuse channels table — `handshake_open_until`
  ISO column added via schema v2 migration in db.ts (single ALTER TABLE).

### MODIFY `src/db.ts`

- Migration v2: `ALTER TABLE channels ADD COLUMN handshake_open_until TEXT`
  + `openHandshake(kind, seconds)`, `isHandshakeOpen(kind)`,
  `closeHandshake(kind)`.

### MODIFY `src/cli.ts` (serve wiring)

- After server listen: if active channel = telegram AND token present, build
  agent-service (Phase 2) + start adapter; log lifecycle lines. Adapter
  restart on `setActiveChannel` changes arrives with Phase 5 (routes call
  `bridge.reload()`); Phase 3 wires start/stop on boot/shutdown only.

### NEW tests (injectable fetch — NO network)

- `test/telegram-format.test.ts`: md→HTML escaping, fence preservation,
  4096 chunking on boundaries, tag-safe splits.
- `test/telegram-adapter.test.ts`: scripted fetch fixture feeding updates —
  handshake open: /start adds allowlist + replies; closed: silent;
  non-allowlisted message ignored; allowlisted message → fake agent-service
  called, typing fired, status sent then edited then deleted, final chunked;
  group message without @mention ignored / with mention stripped; 409 →
  backoff → recovery; stop() ends loop.
- `test/db.test.ts`: v1→v2 migration on an existing Phase 1 db file;
  handshake open/expiry/close.

## Verification (C gate)

- Unit suites green (hermetic).
- Live smoke (requires a real bot token in env `CXC_SMOKE_TG_TOKEN`, manual):
  save token → activate telegram → serve → /start from the user's own chat
  with handshake window opened via sqlite update → send "1+1?" → answer
  arrives; verify allowlist row + binding thread_id persisted.

## Security notes (C4 slice)

- Token never appears in logs or error text (tgCall redacts URL on error).
- Silent-ignore for unknown chats (no "you are not allowed" oracle).
- At-most-once dispatch (offset-first ack) — never replay a full-perm exec.
