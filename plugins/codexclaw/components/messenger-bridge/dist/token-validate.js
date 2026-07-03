/**
 * token-validate.ts — shared bot-token validation (extracted from connect-routes
 * in slice 40 so agent-routes can reuse it; injectable in tests).
 */

import { TelegramApi } from "./telegram-api.js";
import { DiscordApi } from "./discord-api.js";









export async function validateToken(kind             , token        )                           {
  if (kind === "telegram") {
    const me = await new TelegramApi(token).getMe();
    if (me.ok && me.result) return { ok: true, username: me.result.username };
    return { ok: false, error: me.description ?? "invalid telegram token" };
  }
  const me = await new DiscordApi(token).getMe();
  if (me.ok && me.data) return { ok: true, username: me.data.username };
  return { ok: false, error: me.error ?? "invalid discord token" };
}
