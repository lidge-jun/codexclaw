 /**
  * telegram-rich-send.ts — capability-gated rich message dispatcher (Phase E1).
  *
  * Sends Codex output via Bot API 10.1 sendRichMessage when available, falling
  * back to the legacy sendMessage + parse_mode:'HTML' path. The probe runs once
  * on adapter start and the result is cached for the adapter's lifetime.
  *
  * sendRichMessageDraft streaming is only attempted for private chats (Bot API
  * 10.1 restriction: chat_id must be a numeric user id Integer).
  */

 import { markdownToTelegramHtml, markdownToRichHtml, chunkTelegramMessage, stripTelegramHtml } from "./telegram-format.js";









 /**
  * Probe whether the bot's API version supports sendRichMessage.
  *
  * Strategy: call sendRichMessage with the bot's own user id and a minimal
  * payload. Error classification:
  * - 400 "Bad Request" → method exists (param validation error) → supported
  * - 404 or "Not Found" or "method not found" → API too old → unsupported
  * - Any other error (network, 500) → assume unsupported (fail closed)
  */
 export async function probeRichSupport(api             , botUserId        )                   {
   try {
     const res = await api.sendRichMessage({
       chatId: botUserId,
       richMessage: { html: " " }                    ,
     });
     // If it somehow succeeds (unlikely with " "), it's definitely supported.
     if (res.ok) return true;
     // 400 = method exists, just bad params → supported
     if (res.error_code === 400) return true;
     // 404 or "not found" → method doesn't exist → unsupported
     if (res.error_code === 404) return false;
     const desc = (res.description ?? "").toLowerCase();
     if (desc.includes("not found") || desc.includes("method not found")) return false;
     // Unknown error → fail closed
     return false;
   } catch {
     return false;
   }
 }

 /**
  * Send final answer: rich if supported, legacy HTML fallback otherwise.
  * Chunks the output under Telegram's 4096-char limit in both paths.
  */
 export async function sendRichOrFallback(ctx                 , markdown        )                {
   if (ctx.richSupported) {
     const html = markdownToRichHtml(markdown);
     const chunks = chunkTelegramMessage(html, undefined, true);
     for (const chunk of chunks) {
       const sent = await ctx.api.sendRichMessage({
         chatId: ctx.chatId,
         richMessage: { html: chunk }                    ,
         messageThreadId: ctx.messageThreadId,
       });
       // If rich send fails (e.g. unsupported tag), fall back to legacy for this chunk.
       if (!sent.ok) {
         const legacy = markdownToTelegramHtml(markdown);
         const legacyChunks = chunkTelegramMessage(legacy);
         for (const lc of legacyChunks) {
           const ls = await ctx.api.sendMessage({ chatId: ctx.chatId, text: lc, parseMode: "HTML", messageThreadId: ctx.messageThreadId });
           if (!ls.ok) {
             await ctx.api.sendMessage({ chatId: ctx.chatId, text: stripTelegramHtml(lc), messageThreadId: ctx.messageThreadId });
           }
         }
         return; // Already sent the full message via fallback
       }
     }
     return;
   }

   // Legacy path
   const html = markdownToTelegramHtml(markdown);
   for (const chunk of chunkTelegramMessage(html)) {
     const sent = await ctx.api.sendMessage({
       chatId: ctx.chatId,
       text: chunk,
       parseMode: "HTML",
       messageThreadId: ctx.messageThreadId,
     });
     if (!sent.ok) {
       await ctx.api.sendMessage({
         chatId: ctx.chatId,
         text: stripTelegramHtml(chunk),
         messageThreadId: ctx.messageThreadId,
       });
     }
   }
 }

 /**
  * Stream progress via sendRichMessageDraft.
  * ONLY works for private chats (Bot API 10.1 restriction) and when richSupported.
  * No-op otherwise.
  */
 export async function sendDraftProgress(
   ctx                 ,
   draftId        ,
   partialMarkdown        ,
 )                {
   if (!ctx.richSupported) return;
   if (ctx.chatType !== "private") return;

   const chatIdNum = Number(ctx.chatId);
   if (!Number.isFinite(chatIdNum)) return;

   const html = markdownToRichHtml(partialMarkdown);
   await ctx.api.sendRichMessageDraft({
     chatId: chatIdNum,
     draftId,
     richMessage: { html }                    ,
   });
 }
