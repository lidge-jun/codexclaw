/**
 * telegram-api.ts — thin typed Telegram Bot API client over global fetch (Phase 3).
 *
 * Zero deps (no grammy). One POST per call to
 * https://api.telegram.org/bot<token>/<method>. The token never appears in
 * thrown errors or logs — only method + error_code + description. fetchImpl is
 * injectable so the adapter tests run fully offline.
 */
export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface TgResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface TgMessage {
  message_id: number;
  text?: string;
  caption?: string;
  chat: { id: number; type: string };
  from?: { id: number; username?: string };
  message_thread_id?: number;
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
  document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };
  voice?: { file_id: string; file_unique_id: string; duration: number; file_size?: number };
  reply_to_message?: TgMessage;
}

export interface TgCallbackQuery {
  id: string;
  from: { id: number; username?: string };
  message?: TgMessage;
  data?: string;
}

export interface SendMessageParams {
  chatId: string | number;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  messageThreadId?: number;
}

const API_BASE = "https://api.telegram.org";

export class TelegramApi {
  private token: string;
  private fetchImpl: FetchImpl;

  constructor(token: string, fetchImpl: FetchImpl = fetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async call<T = unknown>(
    method: string,
    payload: Record<string, unknown> = {},
    timeoutMs = 15_000,
    signal?: AbortSignal,
  ): Promise<TgResponse<T>> {
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
      const body = (await res.json().catch(() => ({}))) as TgResponse<T>;
      return body;
    } catch (err) {
      // Redact the URL (contains the token) — surface method + reason only.
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, description: `${method} request failed: ${reason}` };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  getMe(): Promise<TgResponse<{ id: number; username?: string }>> {
    return this.call("getMe");
  }

  getUpdates(offset: number, timeoutSec: number, signal?: AbortSignal): Promise<TgResponse<TgUpdate[]>> {
    return this.call<TgUpdate[]>(
      "getUpdates",
      { offset, timeout: timeoutSec, allowed_updates: ["message"] },
      (timeoutSec + 10) * 1000,
      signal,
    );
  }

  sendMessage(params: SendMessageParams): Promise<TgResponse<TgMessage>> {
    const payload: Record<string, unknown> = { chat_id: params.chatId, text: params.text };
    if (params.parseMode) payload.parse_mode = params.parseMode;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call<TgMessage>("sendMessage", payload);
  }

  editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
  ): Promise<TgResponse<TgMessage>> {
    return this.call<TgMessage>("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
    });
  }

  deleteMessage(chatId: string | number, messageId: number): Promise<TgResponse<boolean>> {
    return this.call<boolean>("deleteMessage", { chat_id: chatId, message_id: messageId });
  }

  sendChatAction(chatId: string | number, messageThreadId?: number): Promise<TgResponse<boolean>> {
    const payload: Record<string, unknown> = { chat_id: chatId, action: "typing" };
    if (messageThreadId !== undefined) payload.message_thread_id = messageThreadId;
    return this.call<boolean>("sendChatAction", payload);
  }

  deleteWebhook(dropPending = false): Promise<TgResponse<boolean>> {
    return this.call<boolean>("deleteWebhook", { drop_pending_updates: dropPending });
  }

  // ── Rich media methods (Phase E1) ──────────────────────────────────────

  /** Send a photo by file_id, URL, or multipart upload. */
  sendPhoto(params: {
    chatId: string | number;
    photo: string;
    caption?: string;
    parseMode?: "HTML" | "MarkdownV2";
    messageThreadId?: number;
    replyMarkup?: unknown;
  }): Promise<TgResponse<TgMessage>> {
    const payload: Record<string, unknown> = { chat_id: params.chatId, photo: params.photo };
    if (params.caption) payload.caption = params.caption;
    if (params.parseMode) payload.parse_mode = params.parseMode;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    if (params.replyMarkup) payload.reply_markup = params.replyMarkup;
    return this.call<TgMessage>("sendPhoto", payload);
  }

  /** Send a document by file_id, URL, or multipart upload path. */
  sendDocument(params: {
    chatId: string | number;
    document: string;
    caption?: string;
    parseMode?: "HTML" | "MarkdownV2";
    messageThreadId?: number;
  }): Promise<TgResponse<TgMessage>> {
    const payload: Record<string, unknown> = { chat_id: params.chatId, document: params.document };
    if (params.caption) payload.caption = params.caption;
    if (params.parseMode) payload.parse_mode = params.parseMode;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call<TgMessage>("sendDocument", payload);
  }

  /** Send a voice message by file_id or URL. */
  sendVoice(params: {
    chatId: string | number;
    voice: string;
    caption?: string;
    messageThreadId?: number;
  }): Promise<TgResponse<TgMessage>> {
    const payload: Record<string, unknown> = { chat_id: params.chatId, voice: params.voice };
    if (params.caption) payload.caption = params.caption;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call<TgMessage>("sendVoice", payload);
  }

  /** Get file path for downloading via https://api.telegram.org/file/bot<token>/<path>. */
  getFile(fileId: string): Promise<TgResponse<TgFile>> {
    return this.call<TgFile>("getFile", { file_id: fileId });
  }

  /** Download a file given its file_path from getFile. Returns the raw bytes. */
  async downloadFile(filePath: string): Promise<{ ok: boolean; data?: ArrayBuffer; error?: string }> {
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
  setMyCommands(commands: Array<{ command: string; description: string }>): Promise<TgResponse<boolean>> {
    return this.call<boolean>("setMyCommands", { commands });
  }

  /** Answer a callback query (inline keyboard button press). */
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<TgResponse<boolean>> {
    const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;
    return this.call<boolean>("answerCallbackQuery", payload);
  }

  // ── Bot API 10.1 Rich Message methods (Phase E1) ──────────────────────

  /** Send a rich message (Bot API 10.1+). Requires exactly one of html/markdown. */
  sendRichMessage(params: {
    chatId: string | number;
    richMessage: InputRichMessage;
    messageThreadId?: number;
  }): Promise<TgResponse<TgMessage>> {
    const payload: Record<string, unknown> = {
      chat_id: params.chatId,
      rich_message: params.richMessage,
    };
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call<TgMessage>("sendRichMessage", payload);
  }

  /**
   * Send a rich message draft for streaming preview (Bot API 10.1+).
   * PRIVATE CHATS ONLY — chatId must be a numeric user id (Integer).
   * The draft is ephemeral (30s), must be finalized with sendRichMessage.
   */
  sendRichMessageDraft(params: {
    chatId: number;
    draftId: number;
    richMessage: InputRichMessage;
  }): Promise<TgResponse<boolean>> {
    return this.call<boolean>("sendRichMessageDraft", {
      chat_id: params.chatId,
      draft_id: params.draftId,
      rich_message: params.richMessage,
    });
  }

  /** Send a message with an inline keyboard. */
  sendMessageWithKeyboard(params: {
    chatId: string | number;
    text: string;
    parseMode?: "HTML" | "MarkdownV2";
    messageThreadId?: number;
    inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
  }): Promise<TgResponse<TgMessage>> {
    const payload: Record<string, unknown> = {
      chat_id: params.chatId,
      text: params.text,
      reply_markup: { inline_keyboard: params.inlineKeyboard },
    };
    if (params.parseMode) payload.parse_mode = params.parseMode;
    if (params.messageThreadId !== undefined) payload.message_thread_id = params.messageThreadId;
    return this.call<TgMessage>("sendMessage", payload);
  }
}

/** Telegram file object from getFile. */
export interface TgFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

// ── Bot API 10.1 Rich Message types ─────────────────────────────────────

/** Exactly one of html or markdown (discriminated union). */
export type InputRichMessage = { html: string } | { markdown: string };
