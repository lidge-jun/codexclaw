import { chunkDiscordMessage, type DiscordApi, type DiscordEmbed, type DiscordFile } from "./discord-api.ts";
import { chunkTelegramMessage, escapeHtmlTg, stripTelegramHtml } from "./telegram-format.ts";
import type { TelegramApi, InputRichMessage } from "./telegram-api.ts";

export interface OutputSegment {
  type: "text" | "code" | "diff" | "file_ref" | "image_ref";
  content: string;
  language?: string;
}

export interface TelegramFormattedOutput {
  richHtml: string;
  files: Array<{ name: string; content: string }>;
}

export interface DiscordFormattedOutput {
  content: string;
  embeds: DiscordEmbed[];
  files: Array<{ name: string; data: Buffer; contentType?: string }>;
}

export interface DiscordOutputResult {
  ok: boolean;
  error?: string;
}

const LONG_OUTPUT_LINES = 100;
const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;
const DIFF_RE = /^(diff --git|--- |\+\+\+ |@@ |\+{3} |- {3})/m;

export function segmentOutput(text: string): OutputSegment[] {
  const raw = String(text || "");
  if (!raw) return [];
  const segments: OutputSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
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

export function shouldSendAsFile(segment: OutputSegment): boolean {
  return segment.type === "diff" || isDiffLanguage(segment.language ?? "") || lineCount(segment.content) > LONG_OUTPUT_LINES;
}

export function formatForTelegram(segments: OutputSegment[]): TelegramFormattedOutput {
  const htmlParts: string[] = [];
  const files: Array<{ name: string; content: string }> = [];
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

export function formatForDiscord(segments: OutputSegment[]): DiscordFormattedOutput {
  const contentParts: string[] = [];
  const files: Array<{ name: string; data: Buffer; contentType?: string }> = [];
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
  api: DiscordApi,
  channelId: string,
  text: string,
  log: (line: string) => void = () => {},
): Promise<DiscordOutputResult> {
  const formatted = formatForDiscord(segmentOutput(text));
  if (formatted.files.length > 0) {
    try {
      const sent = await api.sendFile(channelId, formatted.content || "Attached output.", formatted.files as DiscordFile[]);
      if (sent.ok) return { ok: true };
      const error = sent.error ?? `Discord error ${sent.status}`;
      log(`[discord] file send failed ${channelId}: ${error}`);
      return { ok: false, error };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log(`[discord] file send failed ${channelId}: ${error}`);
      return { ok: false, error };
    }
  }
  let firstError: string | undefined;
  for (const chunk of chunkDiscordMessage(formatted.content || (formatted.files.length ? "" : "Done."))) {
    if (!chunk.trim()) continue;
    try {
      const sent = await api.sendMessage(channelId, chunk);
      if (!sent.ok) {
        const error = sent.error ?? `Discord error ${sent.status}`;
        firstError ??= error;
        log(`[discord] message send failed ${channelId}: ${error}`);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      firstError ??= error;
      log(`[discord] message send failed ${channelId}: ${error}`);
    }
  }
  return firstError ? { ok: false, error: firstError } : { ok: true };
}

export async function sendFormattedTelegramOutput(params: {
  api: TelegramApi;
  chatId: string;
  richSupported: boolean;
  chatType: string;
  messageThreadId?: number;
  text: string;
}): Promise<void> {
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
        richMessage: { html: chunk } as InputRichMessage,
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
  api: TelegramApi,
  chatId: string,
  html: string,
  messageThreadId?: number,
): Promise<void> {
  for (const chunk of chunkTelegramMessage(html)) {
    const sent = await api.sendMessage({ chatId, text: chunk, parseMode: "HTML", messageThreadId });
    if (!sent.ok) {
      await api.sendMessage({ chatId, text: stripTelegramHtml(chunk), messageThreadId });
    }
  }
}

function pushTextSegment(segments: OutputSegment[], content: string): void {
  const text = content.trim();
  if (!text) return;
  const type = /^\[(Image|File): .+\]$/m.test(text) ? (text.startsWith("[Image:") ? "image_ref" : "file_ref") : "text";
  segments.push({ type, content: text });
}

function lineCount(value: string): number {
  if (!value) return 0;
  return value.split(/\r\n|\r|\n/).length;
}

function isDiffLanguage(language: string): boolean {
  return /^(diff|patch)$/i.test(language.trim());
}

function outputFileName(index: number, segment: OutputSegment): string {
  const ext = segment.type === "diff" || isDiffLanguage(segment.language ?? "") ? "patch" : "txt";
  return `codex-output-${index}.${ext}`;
}
