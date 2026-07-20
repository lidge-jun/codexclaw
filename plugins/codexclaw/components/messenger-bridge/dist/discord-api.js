/**
 * discord-api.ts — minimal Discord REST client over global fetch (Phase 4).
 *
 * Zero deps (no discord.js). Only the handful of REST calls the bridge needs:
 * send a message (2000-char limit, split by the caller), trigger typing, and
 * fetch the gateway URL. Auth header is `Authorization: Bot <token>`; the token
 * never appears in thrown errors.
 */


export const DISCORD_API = "https://discord.com/api/v10";
export const DISCORD_MAX_MESSAGE = 2000;
export const DISCORD_EMBED_DESC_MAX = 4096;
export const DISCORD_EMBED_TOTAL_MAX = 6000;



























export class DiscordApi {
          token        ;
          fetchImpl           ;

  constructor(token        , fetchImpl            = fetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

          async call   (method        , path        , body          )                               {
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
      const header = (name        ) => res.headers?.get?.(name) ?? null;
      if (res.status === 429) {
        const retryAfterSeconds = Number(header("Retry-After") ?? "0");
        if (retryAfterSeconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
        }
        res = await this.fetchImpl(url, init);
      }
      const postRetryHeader = (name        ) => res.headers?.get?.(name) ?? null;
      if (postRetryHeader("X-RateLimit-Remaining") === "0") {
        const resetAfter = postRetryHeader("X-RateLimit-Reset-After") ?? "unknown";
        console.warn(`[discord] rate limit bucket exhausted; reset after ${resetAfter}s`);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, status: res.status, error: `${method} ${safePath} → ${res.status} ${text.slice(0, 200)}` };
      }
      const data = (await res.json().catch(() => undefined))                 ;
      return { ok: true, status: res.status, data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: `${method} ${safePath} request failed: ${reason}` };
    }
  }

          async callMultipart   (
    method        ,
    path        ,
    body            ,
    boundary        ,
  )                               {
    const safePath = redactDiscordPath(path);
    const init = {
      method,
      headers: {
        authorization: `Bot ${this.token}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body                       ,
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
      const data = (await res.json().catch(() => undefined))                 ;
      return { ok: true, status: res.status, data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: `${method} ${safePath} request failed: ${reason}` };
    }
  }

  sendMessage(
    channelId        ,
    content        ,
    options                                      = {},
  )                                            {
    return this.call("POST", `/channels/${channelId}/messages`, {
      content,
      ...(options.suppressNotifications ? { flags: 4096 } : {}),
    });
  }

  sendEmbed(
    channelId        ,
    content        ,
    embeds                ,
    components            ,
    options                                      = {},
  )                                            {
    return this.call("POST", `/channels/${channelId}/messages`, {
      content,
      embeds,
      components,
      ...(options.suppressNotifications ? { flags: 4096 } : {}),
    });
  }

  triggerTyping(channelId        )                                     {
    return this.call("POST", `/channels/${channelId}/typing`);
  }

  getGatewayUrl()                                             {
    return this.call("GET", "/gateway/bot");
  }

  /** Validate the token by fetching the bot's own user. */
  getMe()                                                              {
    return this.call("GET", "/users/@me");
  }

  createInteractionResponse(id        , token        , response         )                                     {
    return this.call("POST", `/interactions/${id}/${token}/callback`, response);
  }

  editOriginalInteractionResponse(
    appId        ,
    token        ,
    data         ,
  )                                            {
    return this.call("PATCH", `/webhooks/${appId}/${token}/messages/@original`, data);
  }

  registerGlobalCommands(appId        , commands           )                                       {
    return this.call("PUT", `/applications/${appId}/commands`, commands);
  }

  startThread(
    channelId        ,
    name        ,
    messageId         ,
  )                                                          {
    const path = messageId
      ? `/channels/${channelId}/messages/${messageId}/threads`
      : `/channels/${channelId}/threads`;
    return this.call("POST", path, { name, auto_archive_duration: 60 });
  }

  startForumThread(
    channelId        ,
    name        ,
    message                                              ,
    tags           = [],
  )                                                          {
    const body                          = { name, auto_archive_duration: 60, message };
    if (tags.length > 0) body.applied_tags = tags;
    return this.call("POST", `/channels/${channelId}/threads`, body);
  }

  archiveThread(channelId        , archived = true)                                                               {
    return this.call("PATCH", `/channels/${channelId}`, { archived });
  }

  sendFile(channelId        , content        , files               )                                            {
    const boundary = `codexclaw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const enc = new TextEncoder();
    const chunks               = [];
    const pushText = (part        ) => chunks.push(enc.encode(part));
    const pushData = (data                     ) => {
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
    channelId        ,
    messageId        ,
    content        ,
    embeds                 ,
    components            ,
  )                                            {
    return this.call("PATCH", `/channels/${channelId}/messages/${messageId}`, { content, embeds, components });
  }
}

function escapeMultipartName(name        )         {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r|\n/g, "_");
}

async function discordRetryAfterSeconds(res          )                  {
  const header = Number(res.headers?.get?.("Retry-After") ?? "0");
  if (header > 0) return header;
  const body = await res.json().catch(() => null)                                   ;
  return Number(body?.retry_after ?? 0);
}

export function redactDiscordPath(path        )         {
  return path
    .replace(/(\/interactions\/[^/]+\/)[^/]+(\/callback)/g, "$1***$2")
    .replace(/(\/webhooks\/[^/]+\/)[^/]+(?=\/)/g, "$1***");
}

/** Split a reply into Discord's 2000-char messages on line/space boundaries. */
export function chunkDiscordMessage(text        , limit = DISCORD_MAX_MESSAGE)           {
  const raw = String(text || "");
  if (raw.length <= limit) return [raw];
  const chunks           = [];
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
export function chunkEmbedDescription(text        , limit = DISCORD_EMBED_DESC_MAX)           {
  const raw = String(text || "");
  if (raw.length <= limit) return raw ? [raw] : [];
  const chunks           = [];
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
