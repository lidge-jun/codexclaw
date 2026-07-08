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
      // 429 rate limit: wait retry_after seconds, then retry once.
      if (body.error_code === 429 && body.parameters?.retry_after) {
        const waitMs = body.parameters.retry_after * 1000;
        await new Promise      ((r) => { const t = setTimeout(r, waitMs); (t                          ).unref?.(); });
        const retryRes = await this.fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: signal ?? controller?.signal,
        });
        return (await retryRes.json().catch(() => ({})))                 ;
      }
      return body;
    } catch (err) {
      // Redact the URL (contains the token) — surface method + reason only.
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, description: `${method} request failed: ${reason}` };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

          async callMultipart             (
    method        ,
    fields                                                       ,
    file                                              ,
    timeoutMs = 15_000,
    signal              ,
  )                         {
    const url = `${API_BASE}/bot${this.token}/${method}`;
    const boundary = `codexclaw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const body = buildMultipartBody(boundary, fields, file);
    const controller = signal ? undefined : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const init = {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body: body                       ,
      signal: signal ?? controller?.signal,
    };
    try {
      const res = await this.fetchImpl(url, init);
      const parsed = (await res.json().catch(() => ({})))                 ;
      if (parsed.error_code === 429 && parsed.parameters?.retry_after) {
        await sleepMs(parsed.parameters.retry_after * 1000);
        const retryRes = await this.fetchImpl(url, init);
        return (await retryRes.json().catch(() => ({})))                 ;
      }
      return parsed;
    } catch (err) {
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
      { offset, timeout: timeoutSec, allowed_updates: ["message", "callback_query"] },
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

  editMessageReplyMarkup(
    chatId                 ,
    messageId        ,
    inlineKeyboard                                                                       = [],
  )                                 {
    return this.call           ("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }

  /** Delete a whole forum topic (supergroup: needs admin + can_delete_messages). */
  deleteForumTopic(chatId                 , messageThreadId        )                               {
    return this.call         ("deleteForumTopic", {
      chat_id: chatId,
      message_thread_id: messageThreadId,
    });
  }

  sendChatAction(chatId                 , messageThreadId         )                               {
    const payload                          = { chat_id: chatId, action: "typing" };
    if (messageThreadId !== undefined) payload.message_thread_id = messageThreadId;
    return this.call         ("sendChatAction", payload);
  }

  deleteWebhook(dropPending = false)                               {
    return this.call         ("deleteWebhook", { drop_pending_updates: dropPending });
  }

  setWebhook(url        , secretToken        )                               {
    return this.call         ("setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
    });
  }

  // ── Rich media methods (Phase E1) ──────────────────────────────────────

  /** Send a photo by file_id, URL, or multipart upload. */
  sendPhoto(params






   )                                 {
    const payload                          = { chat_id: params.chatId, photo: params.photo };
    if (params.caption) payload.caption = params.caption;
    if (params.parseMode) payload.parse_mode = params.parseMode;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    if (params.replyMarkup) payload.reply_markup = params.replyMarkup;
    return this.call           ("sendPhoto", payload);
  }

  /** Send a document by file_id, URL, or multipart upload path. */
  sendDocument(params





   )                                 {
    if (typeof params.document !== "string") {
      return this.callMultipart           (
        "sendDocument",
        {
          chat_id: params.chatId,
          caption: params.caption,
          parse_mode: params.parseMode,
          message_thread_id: params.messageThreadId,
        },
        { field: "document", value: params.document },
      );
    }
    const payload                          = { chat_id: params.chatId, document: params.document };
    if (params.caption) payload.caption = params.caption;
    if (params.parseMode) payload.parse_mode = params.parseMode;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call           ("sendDocument", payload);
  }

  /** Send a voice message by file_id or URL. */
  sendVoice(params




   )                                 {
    const payload                          = { chat_id: params.chatId, voice: params.voice };
    if (params.caption) payload.caption = params.caption;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call           ("sendVoice", payload);
  }

  /** Get file path for downloading via https://api.telegram.org/file/bot<token>/<path>. */
  getFile(fileId        )                              {
    return this.call        ("getFile", { file_id: fileId });
  }

  /** Download a file given its file_path from getFile. Returns the raw bytes. */
  async downloadFile(filePath        )                                                               {
    const url = `${API_BASE}/file/bot${this.token}/${filePath}`;
    try {
      const res = await this.fetchImpl(url, {});
      if (!res.ok) return { ok: false, error: `download failed: ${res.status}` };
      const data = await res.arrayBuffer();
      return { ok: true, data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `download failed: ${reason}` };
    }
  }

  /** Register bot commands for the command menu. */
  setMyCommands(commands                                                 )                               {
    return this.call         ("setMyCommands", { commands });
  }

  /** Answer a callback query (inline keyboard button press). */
  answerCallbackQuery(callbackQueryId        , text         )                               {
    const payload                          = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;
    return this.call         ("answerCallbackQuery", payload);
  }

  // ── Bot API 10.1 Rich Message methods (Phase E1) ──────────────────────

  /** Send a rich message (Bot API 10.1+). Requires exactly one of html/markdown. */
  sendRichMessage(params



   )                                 {
    const payload                          = {
      chat_id: params.chatId,
      rich_message: params.richMessage,
    };
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call           ("sendRichMessage", payload);
  }

  /**
   * Send a rich message draft for streaming preview (Bot API 10.1+).
   * PRIVATE CHATS ONLY — chatId must be a numeric user id (Integer).
   * The draft is ephemeral (30s), must be finalized with sendRichMessage.
   */
  sendRichMessageDraft(params



   )                               {
    return this.call         ("sendRichMessageDraft", {
      chat_id: params.chatId,
      draft_id: params.draftId,
      rich_message: params.richMessage,
    });
  }

  /** Send a message with an inline keyboard. */
  sendMessageWithKeyboard(params





   )                                 {
    const payload                          = {
      chat_id: params.chatId,
      text: params.text,
      reply_markup: { inline_keyboard: params.inlineKeyboard },
    };
    if (params.parseMode) payload.parse_mode = params.parseMode;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call           ("sendMessage", payload);
  }
}

export function telegramTopicId(msg                                                                    )                {
  if (msg.chat.type !== "supergroup") return null;
  if (msg.is_topic_message !== true && msg.chat.is_forum !== true) return null;
  return String(msg.message_thread_id ?? 1);
}

export function telegramReplyThreadId(msg                                                                    )                     {
  const topicId = telegramTopicId(msg);
  return topicId === null ? msg.message_thread_id : Number(topicId);
}

/** Telegram file object from getFile. */







// ── Bot API 10.1 Rich Message types ─────────────────────────────────────

/** Exactly one of html or markdown (discriminated union). */


function buildMultipartBody(
  boundary        ,
  fields                                                       ,
  file                                              ,
)             {
  const enc = new TextEncoder();
  const chunks               = [];
  const pushText = (part        ) => chunks.push(enc.encode(part));
  const pushData = (data                               ) => {
    if (typeof data === "string") chunks.push(enc.encode(data));
    else if (data instanceof ArrayBuffer) chunks.push(new Uint8Array(data));
    else chunks.push(data);
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    pushText(`--${boundary}\r\n`);
    pushText(`Content-Disposition: form-data; name="${escapeMultipartName(key)}"\r\n\r\n`);
    pushText(String(value));
    pushText("\r\n");
  }
  pushText(`--${boundary}\r\n`);
  pushText(
    `Content-Disposition: form-data; name="${escapeMultipartName(file.field)}"; filename="${escapeMultipartName(file.value.name)}"\r\n`,
  );
  pushText(`Content-Type: ${file.value.contentType ?? "text/plain; charset=utf-8"}\r\n\r\n`);
  pushData(file.value.content);
  pushText("\r\n");
  pushText(`--${boundary}--\r\n`);

  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function escapeMultipartName(name        )         {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r|\n/g, "_");
}

function sleepMs(ms        )                {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}
