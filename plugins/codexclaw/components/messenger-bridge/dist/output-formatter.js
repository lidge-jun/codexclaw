import { chunkDiscordMessage,                                                      } from "./discord-api.js";
import { chunkTelegramMessage, escapeHtmlTg, stripTelegramHtml } from "./telegram-format.js";



















const LONG_OUTPUT_LINES = 100;
const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;
const DIFF_RE = /^(diff --git|--- |\+\+\+ |@@ |\+{3} |- {3})/m;

export function segmentOutput(text        )                  {
  const raw = String(text || "");
  if (!raw) return [];
  const segments                  = [];
  let cursor = 0;
  let match                        ;
  while ((match = FENCE_RE.exec(raw)) !== null) {
    const before = raw.slice(cursor, match.index);
    pushTextSegment(segments, before);
    const language = match[1].trim();
    const content = match[2] ?? "";
    segments.push({
      type: isDiffLanguage(language) || DIFF_RE.test(content) ? "diff" : "code",
      content,
      language: language || undefined,
    });
    cursor = match.index + match[0].length;
  }
  pushTextSegment(segments, raw.slice(cursor));
  if (segments.length === 1 && segments[0].type === "text" && DIFF_RE.test(segments[0].content)) {
    return [{ ...segments[0], type: "diff" }];
  }
  return segments;
}

export function shouldSendAsFile(segment               )          {
  return segment.type === "diff" || isDiffLanguage(segment.language ?? "") || lineCount(segment.content) > LONG_OUTPUT_LINES;
}

export function formatForTelegram(segments                 )                          {
  const htmlParts           = [];
  const files                                           = [];
  let fileIndex = 1;
  for (const segment of segments) {
    if (shouldSendAsFile(segment)) {
      const name = outputFileName(fileIndex, segment);
      fileIndex += 1;
      files.push({ name, content: segment.content });
      htmlParts.push(`Attached <code>${escapeHtmlTg(name)}</code>.`);
      continue;
    }
    if (segment.type === "code") {
      htmlParts.push(`<pre><code>${escapeHtmlTg(segment.content)}</code></pre>`);
    } else if (segment.type === "file_ref" || segment.type === "image_ref") {
      htmlParts.push(`<code>${escapeHtmlTg(segment.content)}</code>`);
    } else {
      htmlParts.push(escapeHtmlTg(segment.content));
    }
  }
  return { richHtml: htmlParts.filter(Boolean).join("\n\n"), files };
}

export function formatForDiscord(segments                 )                         {
  const contentParts           = [];
  const files                                                              = [];
  let fileIndex = 1;
  for (const segment of segments) {
    if (shouldSendAsFile(segment)) {
      const name = outputFileName(fileIndex, segment);
      fileIndex += 1;
      files.push({ name, data: Buffer.from(segment.content), contentType: "text/plain; charset=utf-8" });
      contentParts.push(`Attached ${name}.`);
      continue;
    }
    if (segment.type === "code") {
      const language = segment.language ? segment.language : "";
      contentParts.push(`\`\`\`${language}\n${segment.content}\n\`\`\``);
    } else {
      contentParts.push(segment.content);
    }
  }
  return { content: contentParts.filter(Boolean).join("\n\n"), embeds: [], files };
}

export async function sendFormattedDiscordOutput(
  api            ,
  channelId        ,
  text        ,
  log                         = () => {},
)                {
  const formatted = formatForDiscord(segmentOutput(text));
  if (formatted.files.length > 0) {
    const sent = await api.sendFile(channelId, formatted.content || "Attached output.", formatted.files                 );
    if (!sent.ok) log(`[discord] file send failed ${channelId}: ${sent.error ?? sent.status}`);
    return;
  }
  for (const chunk of chunkDiscordMessage(formatted.content || (formatted.files.length ? "" : "Done."))) {
    if (!chunk.trim()) continue;
    const sent = await api.sendMessage(channelId, chunk);
    if (!sent.ok) log(`[discord] message send failed ${channelId}: ${sent.error ?? sent.status}`);
  }
}

export async function sendFormattedTelegramOutput(params






 )                {
  const formatted = formatForTelegram(segmentOutput(params.text));
  for (const file of formatted.files) {
    await params.api.sendDocument({
      chatId: params.chatId,
      document: file,
      messageThreadId: params.messageThreadId,
    });
  }
  if (!formatted.richHtml.trim()) return;
  if (params.richSupported) {
    for (const chunk of chunkTelegramMessage(formatted.richHtml, undefined, true)) {
      const sent = await params.api.sendRichMessage({
        chatId: params.chatId,
        richMessage: { html: chunk }                    ,
        messageThreadId: params.messageThreadId,
      });
      if (!sent.ok) {
        await sendTelegramHtmlFallback(params.api, params.chatId, formatted.richHtml, params.messageThreadId);
        return;
      }
    }
    return;
  }
  await sendTelegramHtmlFallback(params.api, params.chatId, formatted.richHtml, params.messageThreadId);
}

async function sendTelegramHtmlFallback(
  api             ,
  chatId        ,
  html        ,
  messageThreadId         ,
)                {
  for (const chunk of chunkTelegramMessage(html)) {
    const sent = await api.sendMessage({ chatId, text: chunk, parseMode: "HTML", messageThreadId });
    if (!sent.ok) {
      await api.sendMessage({ chatId, text: stripTelegramHtml(chunk), messageThreadId });
    }
  }
}

function pushTextSegment(segments                 , content        )       {
  const text = content.trim();
  if (!text) return;
  const type = /^\[(Image|File): .+\]$/m.test(text) ? (text.startsWith("[Image:") ? "image_ref" : "file_ref") : "text";
  segments.push({ type, content: text });
}

function lineCount(value        )         {
  if (!value) return 0;
  return value.split(/\r\n|\r|\n/).length;
}

function isDiffLanguage(language        )          {
  return /^(diff|patch)$/i.test(language.trim());
}

function outputFileName(index        , segment               )         {
  const ext = segment.type === "diff" || isDiffLanguage(segment.language ?? "") ? "patch" : "txt";
  return `codex-output-${index}.${ext}`;
}
