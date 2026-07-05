# messenger_bridge — Phase E1: Rich Message + Enhanced Output

Status: A (audit fixes folded) · class C3 · zero new runtime deps · PABCD active

## Loop-spec header

- **Loop archetype:** spec-satisfaction repair (verifier = test suite + live capability check)
- **Trigger:** user request "텔레그램/디스코드 연결 강화"
- **Goal:** Telegram output uses Bot API 10.1 `sendRichMessage` as default (headings,
  lists, tables, details blocks), with capability-gated fallback to legacy
  `parse_mode:'HTML'`. Discord output uses embeds for structured/long outputs.
  `sendRichMessageDraft` enables streaming progress.
- **Non-goals:** Telegram webhook mode, Discord slash commands, media file upload/download
  (those are separate phases E2/E3). No grammY dependency (raw fetch stays).
- **Verifier:** `npm test` (messenger-bridge suite) + tsc + manual capability probe
- **Stop condition:** all tests pass, capability gate works for both API 10.1+ and <10.1
- **Memory artifact:** this file + devlog decade doc
- **Expected outcomes:** DONE
- **Escalation:** if Telegram rejects the rich_message payload shape in tests → Tier 2 re-verify

## Dependency order

Phase 1 (this): API methods + format + adapter routing + tests

---

## Diff-level plan

### MODIFY `src/telegram-api.ts`

Add methods (after existing media methods already added in prev turn):

```typescript
// Bot API 10.1 rich message — exactly one of html/markdown (union type, not both-optional)
export type InputRichMessage = { html: string } | { markdown: string };

sendRichMessage(params: {
  chatId: string | number;
  richMessage: InputRichMessage;
  messageThreadId?: number;
}): Promise<TgResponse<TgMessage>>

// sendRichMessageDraft: PRIVATE CHATS ONLY (Bot API 10.1 restriction).
// chatId must be a numeric user id (Integer), not a string username or group id.
// The adapter guards this: draft streaming is attempted only when chat.type === "private".
sendRichMessageDraft(params: {
  chatId: number;   // Integer only — private chat user id
  draftId: number;
  richMessage: InputRichMessage;
}): Promise<TgResponse<boolean>>
```

**Audit fix #3:** `InputRichMessage` is a discriminated union (`{ html: string } | { markdown: string }`),
not `{ html?: string; markdown?: string }`. This prevents both-set and both-empty payloads at the type level.

### MODIFY `src/telegram-format.ts`

Expand `markdownToTelegramHtml` → rename concept to `markdownToRichHtml`:
- New function `markdownToRichHtml(md)`: converts full markdown (headings, lists,
  tables, code blocks, details) to the RICH HTML subset (`<h1>`-`<h6>`, `<ul>/<ol>/<li>`,
  `<table>/<tr>/<td>`, `<details>/<summary>`, `<pre>/<code>`, `<b>/<i>/<s>/<a>`).
- Keep existing `markdownToTelegramHtml` as the LEGACY fallback (classic tags only).
- Add `TELEGRAM_RICH_TAGS` set for tag-balance checking in the chunker.
- Update chunker to handle the new tags.

### NEW `src/telegram-rich-send.ts`

Capability-gated output dispatcher (same pattern as cli-jaw `sendRichOrHtml`):

```typescript
export interface RichSendContext {
  api: TelegramApi;
  chatId: string;
  richSupported: boolean; // probed once on adapter start
  chatType: string;       // "private" | "group" | "supergroup" | "channel"
  messageThreadId?: number;
}

/**
 * Probe: attempt sendRichMessage with a valid chat_id (the bot's own id from getMe)
 * and a minimal { html: " " } payload. If the API returns error_code 400 with
 * description containing "Bad Request" (param validation), rich messages are supported
 * (the method exists but the content is invalid). If error_code 404 or description
 * contains "method not found" / "Not Found", the API version is too old → fallback.
 * Any other error (network, 500) → assume unsupported (fail closed).
 *
 * Audit fix #2: this is NOT an empty probe; it uses a real bot chat_id and
 * classifies the specific error to distinguish "method exists but bad params"
 * from "method does not exist."
 */
export async function probeRichSupport(api: TelegramApi, botUserId: number): Promise<boolean>

/** Send final answer: rich if supported, legacy HTML fallback otherwise. */
export async function sendRichOrFallback(ctx: RichSendContext, markdown: string): Promise<void>

/**
 * Stream progress via sendRichMessageDraft.
 * Audit fix #1: ONLY attempted when chatType === "private" (Bot API 10.1 restriction).
 * No-op for groups/supergroups/channels, and no-op when richSupported is false.
 */
export async function sendDraftProgress(ctx: RichSendContext, draftId: number, partialMd: string): Promise<void>
```

### MODIFY `src/telegram-adapter.ts`

- On `start()`: after `getMe()`, call `probeRichSupport(api, botUserId)` → store
  `richSupported` flag. Pass the bot's own numeric user id to the probe.
- `runTurn()` output path: replace direct `sendMessage` with `sendRichOrFallback`.
  Pass `chatType` from the message's `chat.type` into the RichSendContext.
- Status edits during turns: use `sendRichMessageDraft` ONLY for private chats
  (chat.type === "private") when richSupported is true.
  Audit fix #1: groups/supergroups/channels keep the existing editMessageText pattern.

### MODIFY `src/discord-api.ts`

Add embed send with size-aware chunking:

```typescript
export interface DiscordEmbed {
  title?: string;
  description?: string;  // max 4096 chars
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;  // value max 1024 chars
}

export const DISCORD_EMBED_DESC_MAX = 4096;
export const DISCORD_EMBED_TOTAL_MAX = 6000;  // all text in all embeds per message

sendEmbed(channelId: string, content: string, embeds: DiscordEmbed[]): Promise<DiscordApiResult<{ id: string }>>

/**
 * Audit fix #5: chunk a long embed description into multiple embeds,
 * each respecting the 4096-char description limit and 6000-char total limit.
 */
export function chunkEmbedDescription(text: string, limit?: number): string[]
```

### MODIFY `src/discord-adapter.ts`

- When result text > 2000 chars AND contains code fences: split into content (summary)
  + embed (the code/details). Use `sendEmbed` with pre-chunked descriptions
  (via `chunkEmbedDescription`) so each embed stays within Discord's 4096/6000 limits.
  Audit fix #5: never send an oversize embed; pre-split client-side.
- Fallback: if embed send fails (e.g. missing embed perms in a channel), fall back
  to existing chunk strategy.

### NEW tests

- `test/telegram-rich-send.test.ts`:
  - probeRichSupport mock: 400 "Bad Request" → supported; 404 "Not Found" → unsupported;
    network error → unsupported (fail closed).
  - sendRichOrFallback: rich path sends sendRichMessage with `{ html: ... }`;
    fallback path sends sendMessage with parse_mode:'HTML'.
  - sendDraftProgress: private chat → calls sendRichMessageDraft; group chat → no-op;
    richSupported=false → no-op.
- Update `test/telegram-format.test.ts`: add rich HTML conversion tests (headings `<h1>`,
  lists `<ul>/<ol>/<li>`, tables `<table>/<tr>/<td>`, details `<details>/<summary>`,
  links `<a href>`). Chunker test: attributeful tags like `<ol start="3">`,
  `<details open>` balanced correctly.
  Audit fix #4: tag-balance regex updated to strip attributes before matching tag name.
- Update `test/telegram-adapter.test.ts`: adapter mock must track sendRichMessage calls
  separately from sendMessage. Existing reply assertions updated to check either
  sendRichMessage or sendMessage depending on richSupported flag.
  Audit fix #6: mock no longer silently accepts unknown method names.
- Update `test/discord-adapter.test.ts`: embed routing for long code-fenced outputs,
  pre-chunked embed description, fallback on embed send failure.

### MODIFY `src/telegram-format.ts` (chunker)

Audit fix #4: update `tagBalanceDelta` and `isBalancedTelegramHtml` to handle
tags with attributes. The tag regex changes from `/<\/?([a-z]+)>/gi` to
`/<\/?([a-z]+)(?:\s[^>]*)?\s*>/gi` so `<ol start="3">` matches as `ol`,
`<details open>` matches as `details`, etc. The `TELEGRAM_SUPPORTED_TAGS` set
is expanded to include `h1`-`h6`, `ul`, `ol`, `li`, `table`, `tr`, `td`, `th`,
`details`, `summary`, `a`, `blockquote`. A separate `TELEGRAM_RICH_TAGS` set
is exported for the rich-send module to check whether rich formatting is present.

## Audit record

Reviewer: gpt-5.5 explorer subagent (Parfit), 2026-07-05.
Verdict: FAIL → 6 issues, all addressed above:
1. [high] sendRichMessageDraft private-chat-only restriction → guarded
2. [high] probe underspecified → error-classification probe with real bot id
3. [medium] InputRichMessage both-optional → discriminated union type
4. [medium] chunker attribute-blind → regex updated
5. [medium] Discord embed size limits → pre-chunking added
6. [low] adapter test coverage gap → mock strictness + new assertions

## Scope boundary

- **IN:** sendRichMessage, sendRichMessageDraft, rich HTML format, Discord embeds,
  capability gate, fallback path, tests for all above.
- **OUT:** Media upload/download (Phase E1 media — separate pass), webhook mode,
  slash commands, inline keyboards callbacks (Phase E2), rate limiting (E3).

## Audit-folded plan accepted — ready for B.
