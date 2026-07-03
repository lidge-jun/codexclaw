/**
 * telegram-api.ts — thin typed Telegram Bot API client over global fetch (Phase 3).
 *
 * Zero deps (no grammy). One POST per call to
 * https://api.telegram.org/bot<token>/<method>. The token never appears in
 * thrown errors or logs — only method + error_code + description. fetchImpl is
 * injectable so the adapter tests run fully offline.
 */






























const API_BASE = "https://api.telegram.org";

export class TelegramApi {
          token        ;
          fetchImpl           ;

  constructor(token        , fetchImpl            = fetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async call             (
    method        ,
    payload                          = {},
    timeoutMs = 15_000,
    signal              ,
  )                         {
    const url = `${API_BASE}/bot${this.token}/${method}`;
    const controller = signal ? undefined : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: signal ?? controller?.signal,
      });
      const body = (await res.json().catch(() => ({})))                 ;
      return body;
    } catch (err) {
      // Redact the URL (contains the token) — surface method + reason only.
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, description: `${method} request failed: ${reason}` };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  getMe()                                                         {
    return this.call("getMe");
  }

  getUpdates(offset        , timeoutSec        , signal              )                                  {
    return this.call            (
      "getUpdates",
      { offset, timeout: timeoutSec, allowed_updates: ["message"] },
      (timeoutSec + 10) * 1000,
      signal,
    );
  }

  sendMessage(params                   )                                 {
    const payload                          = { chat_id: params.chatId, text: params.text };
    if (params.parseMode) payload.parse_mode = params.parseMode;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call           ("sendMessage", payload);
  }

  editMessageText(
    chatId                 ,
    messageId        ,
    text        ,
  )                                 {
    return this.call           ("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
    });
  }

  deleteMessage(chatId                 , messageId        )                               {
    return this.call         ("deleteMessage", { chat_id: chatId, message_id: messageId });
  }

  sendChatAction(chatId                 , messageThreadId         )                               {
    const payload                          = { chat_id: chatId, action: "typing" };
    if (messageThreadId !== undefined) payload.message_thread_id = messageThreadId;
    return this.call         ("sendChatAction", payload);
  }

  deleteWebhook(dropPending = false)                               {
    return this.call         ("deleteWebhook", { drop_pending_updates: dropPending });
  }
}
