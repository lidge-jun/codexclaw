# 030 — Phase 3: `/delete` chat teardown

Class: C2 with a C4-promotion trigger (data deletion) → confirmation step required
(DEV-ESCALATE-01 handled in-band: the USER confirms in chat, two-step).

## Behavior spec

- `/delete` → reply "This will remove this chat's session, history, and pairing.
  Send `/delete confirm` within 60s to proceed." (record pending flag in-memory
  per chatId with expiry — same in-adapter state style as `paused`). TTL is
  configurable via new `deleteConfirmTtlMs?` adapter option (audit finding 6)
  so tests can use a 1ms TTL. Known/accepted: pending flag is chat-scoped, so a
  confirm from another topic of the same supergroup counts (finding 8).
- `/delete confirm` (with fresh pending flag):
  1. `db.deleteBindingCascade(binding.id)` — NEW db method: delete jobs rows for
     the binding, then the binding row.
  2. Allowlist removal: `removeAgentAllowlist(agentId, chatId)` / legacy variant
     (reuse the `/kick` branch logic).
  3. If the message came from a forum topic (`msg.message_thread_id` set and chat
     is supergroup): call NEW `api.deleteForumTopic(chatId, threadId)` — best
     effort; on failure (no can_delete_messages right) reply that state is wiped
     but the topic must be deleted manually.
  4. Else reply "Chat deleted — pairing and history removed on the bot side.
     Reconnecting requires a new pairing window from the desktop." (audit
     finding 7: /start only works while a handshake window is open — do not
     promise it.)
- Expired/absent pending flag on `/delete confirm` → treat as fresh `/delete` step 1.

## Diff plan

### MODIFY `src/db.ts`

```ts
deleteBindingCascade(id: number): void {
  this.db.exec("BEGIN");
  try {
    this.db.prepare("DELETE FROM jobs WHERE binding_id = ?").run(id);
    this.db.prepare("DELETE FROM bindings WHERE id = ?").run(id);
    this.db.exec("COMMIT");
  } catch (err) {
    this.db.exec("ROLLBACK");
    throw err;
  }
}
```

(Precedent: deleteAgent wraps its cascade in BEGIN/COMMIT/ROLLBACK, db.ts:547-559
— audit finding 4.)

### MODIFY `src/telegram-api.ts`

```ts
deleteForumTopic(chatId: string | number, messageThreadId: number): Promise<TgResponse<boolean>> {
  return this.call<boolean>("deleteForumTopic", { chat_id: chatId, message_thread_id: messageThreadId });
}
```

### MODIFY `src/telegram-adapter.ts`

- `pendingDeletes = new Map<string, number>()` (chatId → expiry epoch ms; 60s TTL).
- `handleDelete(chatId, msg, rawText)`; dispatch entry AFTER allowlist gate,
  BEFORE `/kick` (both start with `/` but distinct prefixes — chain order only
  matters for readability). Add to `setMyCommands` + `/help`.

## Tests

- `/delete` then `/delete confirm` → binding row gone, jobs gone, allowlist gone,
  confirmation reply sent.
- `/delete confirm` without pending → re-prompts, deletes nothing.
- Pending expiry (inject clock or 0-TTL) → re-prompts.
- Topic message variant → deleteForumTopic called with thread id (scripted fetch
  captures the call); failure response still wipes local state. Harness: extend
  `makeFetch` with a per-method response override (finding 5) since unknown
  methods currently always answer `{ok:true}`.
- db test: deleteBindingCascade removes jobs + binding, leaves other bindings.

## Accept criteria

- `npm test` green; two-step confirm provably gates every destructive path.
