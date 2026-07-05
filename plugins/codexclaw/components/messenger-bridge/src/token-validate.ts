/**
 * token-validate.ts — shared bot-token validation (extracted from connect-routes
 * in slice 40 so agent-routes can reuse it; injectable in tests).
 */
import type { ChannelKind } from "./db.ts";
import { TelegramApi } from "./telegram-api.ts";
import { DiscordApi } from "./discord-api.ts";

export interface TokenValidation {
  ok: boolean;
  username?: string;
  /** Bot's own user id (Discord needs it for the OAuth invite URL). */
  botId?: string;
  error?: string;
}

export type ValidateTokenFn = (kind: ChannelKind, token: string) => Promise<TokenValidation>;

export async function validateToken(kind: ChannelKind, token: string): Promise<TokenValidation> {
  if (kind === "telegram") {
    const me = await new TelegramApi(token).getMe();
    if (me.ok && me.result) return { ok: true, username: me.result.username, botId: String(me.result.id) };
    return { ok: false, error: me.description ?? "invalid telegram token" };
  }
  const me = await new DiscordApi(token).getMe();
  if (me.ok && me.data) return { ok: true, username: me.data.username, botId: me.data.id };
  return { ok: false, error: me.error ?? "invalid discord token" };
}
