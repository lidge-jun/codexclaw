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

export interface DiscordFile {
  name: string;
  data: string | Uint8Array | ArrayBuffer;
  contentType?: string;
}

export class DiscordApi {
  private token: string;
  private fetchImpl: FetchImpl;

  constructor(token: string, fetchImpl: FetchImpl = fetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<DiscordApiResult<T>> {
    const safePath = redactDiscordPath(path);
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
      const header = (name: string) => res.headers?.get?.(name) ?? null;
      if (res.status === 429) {
        const retryAfterSeconds = Number(header("Retry-After") ?? "0");
        if (retryAfterSeconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
        }
        res = await this.fetchImpl(url, init);
      }
      const postRetryHeader = (name: string) => res.headers?.get?.(name) ?? null;
      if (postRetryHeader("X-RateLimit-Remaining") === "0") {
        const resetAfter = postRetryHeader("X-RateLimit-Reset-After") ?? "unknown";
        console.warn(`[discord] rate limit bucket exhausted; reset after ${resetAfter}s`);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, status: res.status, error: `${method} ${safePath} → ${res.status} ${text.slice(0, 200)}` };
      }
      const data = (await res.json().catch(() => undefined)) as T | undefined;
      return { ok: true, status: res.status, data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: `${method} ${safePath} request failed: ${reason}` };
    }
  }

  private async callMultipart<T>(
    method: string,
    path: string,
    body: Uint8Array,
    boundary: string,
  ): Promise<DiscordApiResult<T>> {
    const safePath = redactDiscordPath(path);
    const init = {
      method,
      headers: {
        authorization: `Bot ${this.token}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body as unknown as BodyInit,
    };
    try {
      let res = await this.fetchImpl(`${DISCORD_API}${path}`, init);
      if (res.status === 429) {
        const retryAfterSeconds = await discordRetryAfterSeconds(res);
        if (retryAfterSeconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
        }
        res = await this.fetchImpl(`${DISCORD_API}${path}`, init);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, status: res.status, error: `${method} ${safePath} → ${res.status} ${text.slice(0, 200)}` };
      }
      const data = (await res.json().catch(() => undefined)) as T | undefined;
      return { ok: true, status: res.status, data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: `${method} ${safePath} request failed: ${reason}` };
    }
  }

  sendMessage(
    channelId: string,
    content: string,
    options: { suppressNotifications?: boolean } = {},
  ): Promise<DiscordApiResult<{ id: string }>> {
    return this.call("POST", `/channels/${channelId}/messages`, {
      content,
      ...(options.suppressNotifications ? { flags: 4096 } : {}),
    });
  }

  sendEmbed(
    channelId: string,
    content: string,
    embeds: DiscordEmbed[],
    components?: unknown[],
    options: { suppressNotifications?: boolean } = {},
  ): Promise<DiscordApiResult<{ id: string }>> {
    return this.call("POST", `/channels/${channelId}/messages`, {
      content,
      embeds,
      components,
      ...(options.suppressNotifications ? { flags: 4096 } : {}),
    });
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

  createInteractionResponse(id: string, token: string, response: unknown): Promise<DiscordApiResult<unknown>> {
    return this.call("POST", `/interactions/${id}/${token}/callback`, response);
  }

  editOriginalInteractionResponse(
    appId: string,
    token: string,
    data: unknown,
  ): Promise<DiscordApiResult<{ id: string }>> {
    return this.call("PATCH", `/webhooks/${appId}/${token}/messages/@original`, data);
  }

  registerGlobalCommands(appId: string, commands: unknown[]): Promise<DiscordApiResult<unknown[]>> {
    return this.call("PUT", `/applications/${appId}/commands`, commands);
  }

  startThread(
    channelId: string,
    name: string,
    messageId?: string,
  ): Promise<DiscordApiResult<{ id: string; name: string }>> {
    const path = messageId
      ? `/channels/${channelId}/messages/${messageId}/threads`
      : `/channels/${channelId}/threads`;
    return this.call("POST", path, { name, auto_archive_duration: 60 });
  }

  startForumThread(
    channelId: string,
    name: string,
    message: { content: string; embeds?: DiscordEmbed[] },
    tags: string[] = [],
  ): Promise<DiscordApiResult<{ id: string; name: string }>> {
    const body: Record<string, unknown> = { name, auto_archive_duration: 60, message };
    if (tags.length > 0) body.applied_tags = tags;
    return this.call("POST", `/channels/${channelId}/threads`, body);
  }

  archiveThread(channelId: string, archived = true): Promise<DiscordApiResult<{ id: string; archived: boolean }>> {
    return this.call("PATCH", `/channels/${channelId}`, { archived });
  }

  sendFile(channelId: string, content: string, files: DiscordFile[]): Promise<DiscordApiResult<{ id: string }>> {
    const boundary = `codexclaw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const pushText = (part: string) => chunks.push(enc.encode(part));
    const pushData = (data: DiscordFile["data"]) => {
      if (typeof data === "string") chunks.push(enc.encode(data));
      else if (data instanceof ArrayBuffer) chunks.push(new Uint8Array(data));
      else chunks.push(data);
    };

    pushText(`--${boundary}\r\n`);
    pushText(`Content-Disposition: form-data; name="payload_json"\r\n`);
    pushText("Content-Type: application/json\r\n\r\n");
    pushText(JSON.stringify({ content, attachments: files.map((file, id) => ({ id, filename: file.name })) }));
    pushText("\r\n");

    for (const [id, file] of files.entries()) {
      pushText(`--${boundary}\r\n`);
      pushText(`Content-Disposition: form-data; name="files[${id}]"; filename="${escapeMultipartName(file.name)}"\r\n`);
      pushText(`Content-Type: ${file.contentType ?? "application/octet-stream"}\r\n\r\n`);
      pushData(file.data);
      pushText("\r\n");
    }
    pushText(`--${boundary}--\r\n`);

    const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return this.callMultipart("POST", `/channels/${channelId}/messages`, body, boundary);
  }

  editMessage(
    channelId: string,
    messageId: string,
    content: string,
    embeds?: DiscordEmbed[],
    components?: unknown[],
  ): Promise<DiscordApiResult<{ id: string }>> {
    return this.call("PATCH", `/channels/${channelId}/messages/${messageId}`, { content, embeds, components });
  }
}

function escapeMultipartName(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r|\n/g, "_");
}

async function discordRetryAfterSeconds(res: Response): Promise<number> {
  const header = Number(res.headers?.get?.("Retry-After") ?? "0");
  if (header > 0) return header;
  const body = await res.json().catch(() => null) as { retry_after?: number } | null;
  return Number(body?.retry_after ?? 0);
}

export function redactDiscordPath(path: string): string {
  return path
    .replace(/(\/interactions\/[^/]+\/)[^/]+(\/callback)/g, "$1***$2")
    .replace(/(\/webhooks\/[^/]+\/)[^/]+(?=\/)/g, "$1***");
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
