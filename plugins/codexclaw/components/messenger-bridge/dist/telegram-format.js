/**
 * telegram-format.ts — markdown→Telegram-HTML + safe chunking (Phase 3).
 *
 * Ported from cli-jaw src/telegram/forwarder.ts (the pure functions only): the
 * Telegram HTML parse_mode supports a small tag subset, so we escape first then
 * re-introduce <pre>/<code>/<b>/<i>/<s>, and split long messages under the
 * 4096-char limit without cutting inside a tag or leaving a tag unbalanced.
 */
const TELEGRAM_SUPPORTED_TAGS = new Set(["pre", "code", "b", "i", "s", "a"]);
export const TELEGRAM_MAX_MESSAGE = 4096;

export function escapeHtmlTg(text        )         {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function markdownToTelegramHtml(md        )         {
  if (!md) return "";
  let html = escapeHtmlTg(md);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  html = html.replace(/(?<![*])\*(?![*])(.+?)(?<![*])\*(?![*])/g, "<i>$1</i>");
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");
  // Markdown links: [text](url) → <a href="url">text</a>
  // Runs after escaping; un-escape the href so the URL is valid.
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m        , text        , href        ) =>
      `<a href="${href.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")}">${text}</a>`,
  );
  return html;
}

function tagBalanceDelta(chunk        )         {
  let balance = 0;
  const tagRe = /<\/?([a-z]+)>/gi;
  let match                        ;
  while ((match = tagRe.exec(chunk)) !== null) {
    const full = match[0];
    const tag = String(match[1] || "").toLowerCase();
    if (!TELEGRAM_SUPPORTED_TAGS.has(tag)) continue;
    balance += full.startsWith("</") ? -1 : 1;
  }
  return balance;
}

function isBalancedTelegramHtml(chunk        )          {
  return tagBalanceDelta(chunk) === 0;
}

function isInsideTagToken(text        , index        )          {
  const lastLt = text.lastIndexOf("<", index - 1);
  const lastGt = text.lastIndexOf(">", index - 1);
  return lastLt > lastGt;
}

function findHtmlSafeSplit(raw        , limit        )         {
  if (isInsideTagToken(raw, limit)) {
    const close = raw.indexOf(">", limit);
    if (close >= 0) return close + 1;
  }
  const candidates           = [];
  for (let i = Math.min(limit, raw.length); i > 0; i -= 1) {
    const ch = raw[i - 1];
    if (ch !== "\n" && ch !== " " && ch !== ">") continue;
    if (isInsideTagToken(raw, i)) continue;
    candidates.push(i);
  }
  candidates.push(limit);
  for (const candidate of candidates) {
    if (candidate < limit * 0.3 && candidate !== limit) continue;
    if (isBalancedTelegramHtml(raw.slice(0, candidate))) return candidate;
  }
  return limit;
}

export function chunkTelegramMessage(html        , limit = TELEGRAM_MAX_MESSAGE)           {
  const raw = String(html || "");
  if (raw.length <= limit) return [raw];
  const chunks           = [];
  let remaining = raw;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    const splitAt = findHtmlSafeSplit(remaining, limit);
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

/** Strip Telegram HTML tags → plain text fallback when parse_mode send fails. */
export function stripTelegramHtml(html        )         {
  return String(html || "").replace(/<[^>]+>/g, "");
}
