/**
 * telegram-format.ts — markdown→Telegram-HTML + safe chunking (Phase 3 + E1).
 *
 * Ported from cli-jaw src/telegram/forwarder.ts (the pure functions only): the
 * Telegram HTML parse_mode supports a small tag subset, so we escape first then
 * re-introduce tags, and split long messages under the 4096-char limit without
 * cutting inside a tag or leaving a tag unbalanced.
 *
 * Phase E1: adds markdownToRichHtml for Bot API 10.1 sendRichMessage (headings,
 * lists, tables, details blocks), plus attributeful tag-balance checking.
 */

/** Tags supported by legacy parse_mode:'HTML'. */
const TELEGRAM_LEGACY_TAGS = new Set(["pre", "code", "b", "i", "s", "a", "u", "blockquote"]);

/** Tags supported by Bot API 10.1 sendRichMessage rich_message.html. */
export const TELEGRAM_RICH_TAGS = new Set([
  ...TELEGRAM_LEGACY_TAGS,
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "table", "tr", "td", "th", "thead", "tbody",
  "details", "summary",
  "br", "hr", "p",
]);

/** Active tag set for balance checking — set by the caller's context. */
let activeTags              = TELEGRAM_LEGACY_TAGS;

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

/** Check if rich HTML tags are present in the text. */
export function containsRichTags(html        )          {
  const richOnly = new Set([...TELEGRAM_RICH_TAGS].filter((t) => !TELEGRAM_LEGACY_TAGS.has(t)));
  const tagRe = /<\/?([a-z][a-z0-9]*)(?:\s[^>]*)?\s*>/gi;
  let match                        ;
  while ((match = tagRe.exec(html)) !== null) {
    const tag = String(match[1] || "").toLowerCase();
    if (richOnly.has(tag)) return true;
  }
  return false;
}

function tagBalanceDelta(chunk        , tags              = activeTags)         {
  let balance = 0;
  // Attributeful regex: matches <tag>, <tag attr="val">, </tag>
  const tagRe = /<\/?([a-z][a-z0-9]*)(?:\s[^>]*)?\s*>/gi;
  let match                        ;
  while ((match = tagRe.exec(chunk)) !== null) {
    const full = match[0];
    const tag = String(match[1] || "").toLowerCase();
    if (!tags.has(tag)) continue;
    balance += full.startsWith("</") ? -1 : 1;
  }
  return balance;
}

function isBalancedTelegramHtml(chunk        , tags              = activeTags)          {
  return tagBalanceDelta(chunk, tags) === 0;
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

/**
 * Split HTML into chunks under the limit without breaking tags.
 * When `rich` is true, uses the expanded rich tag set for balance checking.
 */
export function chunkTelegramMessage(html        , limit = TELEGRAM_MAX_MESSAGE, rich = false)           {
  const prevTags = activeTags;
  activeTags = rich ? TELEGRAM_RICH_TAGS : TELEGRAM_LEGACY_TAGS;
  const raw = String(html || "");
  if (raw.length <= limit) {
    activeTags = prevTags;
    return [raw];
  }
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
  activeTags = prevTags;
  return chunks;
}

/** Strip Telegram HTML tags → plain text fallback when parse_mode send fails. */
export function stripTelegramHtml(html        )         {
  return String(html || "").replace(/<[^>]+>/g, "");
}

// ── Rich HTML conversion (Bot API 10.1) ─────────────────────────────────

/**
 * Convert markdown to the RICH HTML subset supported by sendRichMessage.
 * Supports headings, lists, tables, details, code blocks, inline formatting,
 * and links. This produces richer output than markdownToTelegramHtml.
 */
export function markdownToRichHtml(md        )         {
  if (!md) return "";
  // Process in order: code fences first (protect their content), then block elements, then inline.
  const fences           = [];
  let html = String(md);

  // 1. Extract and protect code fences
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang        , code        ) => {
    const idx = fences.length;
    const escaped = escapeHtmlTg(code);
    fences.push(lang ? `<pre><code class="language-${escapeHtmlTg(lang)}">${escaped}</code></pre>` : `<pre><code>${escaped}</code></pre>`);
    return `\x00FENCE${idx}\x00`;
  });

  // 2. Escape remaining HTML
  html = escapeHtmlTg(html);

  // 3. Restore fences (they were already escaped internally)
  html = html.replace(/\x00FENCE(\d+)\x00/g, (_m, idx        ) => fences[Number(idx)] ?? "");

  // 4. Block elements (before inline to avoid conflicts)
  // Headings: lines starting with # (1-6)
  html = html.replace(/^(#{1,6})\s+(.+)$/gm, (_m, hashes        , text        ) => {
    const level = hashes.length;
    return `<h${level}>${text.trim()}</h${level}>`;
  });

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");

  // Unordered lists (lines starting with - or *)
  html = html.replace(/(?:^[*-]\s+.+$\n?)+/gm, (block) => {
    const items = block.trim().split("\n").map((line) =>
      `<li>${line.replace(/^[*-]\s+/, "").trim()}</li>`
    );
    return `<ul>${items.join("")}</ul>`;
  });

  // Ordered lists (lines starting with digits.)
  html = html.replace(/(?:^\d+\.\s+.+$\n?)+/gm, (block) => {
    const items = block.trim().split("\n").map((line) =>
      `<li>${line.replace(/^\d+\.\s+/, "").trim()}</li>`
    );
    return `<ol>${items.join("")}</ol>`;
  });

  // Blockquotes (lines starting with >)
  html = html.replace(/(?:^&gt;\s?.*$\n?)+/gm, (block) => {
    const text = block.replace(/^&gt;\s?/gm, "").trim();
    return `<blockquote>${text}</blockquote>`;
  });

  // 5. Inline formatting
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  html = html.replace(/(?<![*])\*(?![*])(.+?)(?<![*])\*(?![*])/g, "<i>$1</i>");
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m        , text        , href        ) =>
      `<a href="${href.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")}">${text}</a>`,
  );

  return html;
}
