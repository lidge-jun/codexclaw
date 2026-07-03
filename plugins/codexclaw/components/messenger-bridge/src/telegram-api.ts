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
}

export interface TgMessage {
  message_id: number;
  text?: string;
  caption?: string;
  chat: { id: number; type: string };
  from?: { id: number; username?: string };
  message_thread_id?: number;
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
}
