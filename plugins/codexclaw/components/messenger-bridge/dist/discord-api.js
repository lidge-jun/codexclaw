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








export class DiscordApi {
          token        ;
          fetchImpl           ;

  constructor(token        , fetchImpl            = fetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

          async call   (method        , path        , body          )                               {
    try {
      const res = await this.fetchImpl(`${DISCORD_API}${path}`, {
        method,
        headers: {
          authorization: `Bot ${this.token}`,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, status: res.status, error: `${method} ${path} → ${res.status} ${text.slice(0, 200)}` };
      }
      const data = (await res.json().catch(() => undefined))                 ;
      return { ok: true, status: res.status, data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: `${method} ${path} request failed: ${reason}` };
    }
  }

  sendMessage(channelId        , content        )                                            {
    return this.call("POST", `/channels/${channelId}/messages`, { content });
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
