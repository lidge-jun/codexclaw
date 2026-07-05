/**
 * discord-api.ts — minimal Discord REST client over global fetch (Phase 4).
 *
 * Zero deps (no discord.js). Only the handful of REST calls the bridge needs:
 * send a message (2000-char limit, split by the caller), trigger typing, and
 * fetch the gateway URL. Auth header is `Authorization: Bot <token>`; the token
 * never appears in thrown errors.
 */
export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export const DISCORD_API = "https://discord.com/api/v10";
export const DISCORD_MAX_MESSAGE = 2000;
export const DISCORD_EMBED_DESC_MAX = 4096;
export const DISCORD_EMBED_TOTAL_MAX = 6000;

export interface DiscordApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export interface DiscordEmbed {
  title?: string;
  /** Discord caps embed descriptions at 4096 characters. */
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    /** Discord caps embed field values at 1024 characters. */
    value: string;
    inline?: boolean;
  }>;
}

export class DiscordApi {
  private token: string;
  private fetchImpl: FetchImpl;

  constructor(token: string, fetchImpl: FetchImpl = fetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<DiscordApiResult<T>> {
    try {
      const url = `${DISCORD_API}${path}`;
      const init = {
        method,
        headers: {
          authorization: `Bot ${this.token}`,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      };
      let res = await this.fetchImpl(url, init);
      if (res.status === 429) {
        const retryAfterSeconds = Number(res.headers.get("Retry-After") ?? "0");
        if (retryAfterSeconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
        }
        res = await this.fetchImpl(url, init);
      }
      if (res.headers.get("X-RateLimit-Remaining") === "0") {
        const resetAfter = res.headers.get("X-RateLimit-Reset-After") ?? "unknown";
        console.warn(`[discord] rate limit bucket exhausted; reset after ${resetAfter}s`);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, status: res.status, error: `${method} ${path} → ${res.status} ${text.slice(0, 200)}` };
      }
      const data = (await res.json().catch(() => undefined)) as T | undefined;
      return { ok: true, status: res.status, data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: `${method} ${path} request failed: ${reason}` };
    }
  }

  sendMessage(channelId: string, content: string): Promise<DiscordApiResult<{ id: string }>> {
    return this.call("POST", `/channels/${channelId}/messages`, { content });
  }

  sendEmbed(channelId: string, content: string, embeds: DiscordEmbed[]): Promise<DiscordApiResult<{ id: string }>> {
    return this.call("POST", `/channels/${channelId}/messages`, { content, embeds });
  }

  triggerTyping(channelId: string): Promise<DiscordApiResult<unknown>> {
    return this.call("POST", `/channels/${channelId}/typing`);
  }

  getGatewayUrl(): Promise<DiscordApiResult<{ url: string }>> {
    return this.call("GET", "/gateway/bot");
  }

  /** Validate the token by fetching the bot's own user. */
  getMe(): Promise<DiscordApiResult<{ id: string; username: string }>> {
    return this.call("GET", "/users/@me");
  }
}

/** Split a reply into Discord's 2000-char messages on line/space boundaries. */
export function chunkDiscordMessage(text: string, limit = DISCORD_MAX_MESSAGE): string[] {
  const raw = String(text || "");
  if (raw.length <= limit) return [raw];
  const chunks: string[] = [];
  let remaining = raw;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = remaining.lastIndexOf(" ", limit);
    if (cut < limit * 0.5) cut = limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\s/, "");
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/** Split text into Discord embed-description chunks on line/space boundaries. */
export function chunkEmbedDescription(text: string, limit = DISCORD_EMBED_DESC_MAX): string[] {
  const raw = String(text || "");
  if (raw.length <= limit) return raw ? [raw] : [];
  const chunks: string[] = [];
  let remaining = raw;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = remaining.lastIndexOf(" ", limit);
    if (cut < limit * 0.5) cut = limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\s/, "");
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
