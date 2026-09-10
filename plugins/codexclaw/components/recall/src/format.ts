/**
 * format.ts — render chat/memory search results as jaw-style text or JSON.
 *
 * Text shape mirrors `jaw dashboard chat search` output so agents trained on the
 * cli-jaw directive can read ours without relearning:
 *   # <n> hits (<scanned>/<total> files scanned, <ms>ms)
 *   [<ts>] (<role>) [tool_log] <title> {cwd}
 *   <excerpt up to 300 chars>
 *   ---
 */
import type { ChatSearchResult, ChatHit } from "./chat-search.ts";
import type { MemoryHit, MemorySearchResult } from "./memory-search.ts";

const EXCERPT = 300;

function clip(text: string, n: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= n ? flat : `${flat.slice(0, n)}…`;
}

function chatHitHeader(hit: ChatHit): string {
  const field = hit.matchField === "tool_log" ? " [tool_log]" : "";
  const title = hit.title ? ` «${clip(hit.title, 60)}»` : "";
  const cwd = hit.cwd ? ` {${hit.cwd}}` : "";
  const src = hit.source === "subagent" ? " (subagent)" : "";
  return `[${hit.ts}] (${hit.role})${field}${src}${title}${cwd}`;
}

export function formatChatResult(result: ChatSearchResult): string {
  const lines: string[] = [];
  lines.push(
    `# ${result.hits.length} hits (${result.scannedFiles}/${result.totalFiles} files scanned, ${result.elapsedMs}ms)`,
  );
  if (result.hits.length === 0) lines.push("(no matches)");
  for (const hit of result.hits) {
    lines.push("");
    lines.push(chatHitHeader(hit));
    if (hit.context.length > 0) {
      for (const c of hit.context) {
        const prefix = c.isMatch ? ">> " : "   ";
        lines.push(`${prefix}[${c.ts}] (${c.role}) ${clip(c.text, 200)}`);
      }
    } else {
      lines.push(clip(hit.text, EXCERPT));
    }
    lines.push("---");
  }
  appendWarnings(lines, result.warnings);
  return lines.join("\n");
}

/**
 * Tokens distinctive enough to say two hits are about the same thing: versions,
 * source filenames, CamelCase symbols. Ordinary words are deliberately excluded —
 * a shared "the" must never make one memory look like a correction of another.
 */
const TOPIC_TOKEN =
  /\b\d+\.\d+(?:\.\d+)?\b|\b[\w.-]+\.(?:ts|tsx|js|mjs|json|md)\b|\b[A-Z][a-zA-Z]*[A-Z][A-Za-z0-9]*\b/g;

/** Whole days between `updatedAt` and now; null when there is no usable stamp. */
export function ageDays(updatedAt: string | null, nowMs: number): number | null {
  if (!updatedAt) return null;
  const stamp = Date.parse(updatedAt);
  if (!Number.isFinite(stamp)) return null;
  return Math.max(0, Math.floor((nowMs - stamp) / 86_400_000));
}

function topicTokens(hit: MemoryHit): Set<string> {
  const bag = `${hit.relpath} ${hit.excerpt}`;
  const out = new Set<string>();
  TOPIC_TOKEN.lastIndex = 0;
  for (const match of bag.matchAll(TOPIC_TOKEN)) out.add(match[0].toLowerCase());
  return out;
}

function sharesTopic(mine: Set<string>, theirs: Set<string>): boolean {
  for (const token of mine) if (theirs.has(token)) return true;
  return false;
}

/**
 * The newest same-topic hit that sits in a DIFFERENT file, or null.
 *
 * Memory accumulates corrections: a 2.48 note and a 2.49 note both match
 * "provenance", and relevance alone can rank the superseded one first. Ranking
 * stays exactly as `rankAndTrim` left it — this only labels, so the reader can
 * see that a fresher record of the same subject is in the same result set.
 */
export function newerRelpath(hit: MemoryHit, hits: readonly MemoryHit[]): string | null {
  if (!hit.updatedAt) return null;
  const mine = Date.parse(hit.updatedAt);
  if (!Number.isFinite(mine)) return null;
  const myTopic = topicTokens(hit);
  if (myTopic.size === 0) return null;
  let best: MemoryHit | null = null;
  let bestStamp = mine;
  for (const other of hits) {
    if (other === hit || other.relpath === hit.relpath || !other.updatedAt) continue;
    const stamp = Date.parse(other.updatedAt);
    if (!Number.isFinite(stamp) || stamp <= bestStamp) continue;
    if (!sharesTopic(myTopic, topicTokens(other))) continue;
    best = other;
    bestStamp = stamp;
  }
  return best ? best.relpath : null;
}

export function formatMemoryResult(result: MemorySearchResult, nowMs = Date.now()): string {
  const lines: string[] = [];
  lines.push(`# ${result.hits.length} memory hits (${result.scannedFiles} files scanned, ${result.elapsedMs}ms)`);
  if (result.hits.length === 0) lines.push("(no matches)");
  for (const hit of result.hits) {
    lines.push("");
    const loc = hit.startLine !== null ? `${hit.relpath}:${hit.startLine}` : hit.relpath;
    const when = hit.updatedAt ? ` [${hit.updatedAt}]` : "";
    const cwd = hit.cwd ? ` {${hit.cwd}}` : "";
    // The ISO stamp says when; the age says how long ago, which is what decides
    // whether a stored claim can still be asserted without checking it live.
    const age = ageDays(hit.updatedAt, nowMs);
    const ageBit = age === null ? "" : ` [age: ${age}d]`;
    const newer = newerRelpath(hit, result.hits);
    const newerBit = newer ? ` [newer: ${newer}]` : "";
    lines.push(`(${hit.origin}/${hit.kind}) ${loc}${when}${cwd}${ageBit}${newerBit}`);
    lines.push(clip(hit.excerpt, EXCERPT));
    lines.push("---");
  }
  appendWarnings(lines, result.warnings);
  return lines.join("\n");
}

function appendWarnings(lines: string[], warnings: string[]): void {
  if (warnings.length === 0) return;
  lines.push("");
  lines.push("--- warnings ---");
  for (const w of warnings) lines.push(w);
}

const JSON_TEXT_CAP = 500;

function clipField(s: string): { text: string; truncated: boolean } {
  return s.length <= JSON_TEXT_CAP
    ? { text: s, truncated: false }
    : { text: `${s.slice(0, JSON_TEXT_CAP)}…`, truncated: true };
}

/**
 * Bound JSON payloads (tool outputs and thread titles can be huge): clip every
 * hit text/title/context text to 500 chars and mark clipped hits. `--full`
 * skips this entirely.
 */
export function clipChatResultForJson(result: ChatSearchResult): ChatSearchResult & { clipped: boolean } {
  let clipped = false;
  const hits = result.hits.map((h) => {
    const text = clipField(h.text);
    const title = h.title !== null ? clipField(h.title) : null;
    const context = h.context.map((c) => {
      const t = clipField(c.text);
      clipped = clipped || t.truncated;
      return { ...c, text: t.text };
    });
    clipped = clipped || text.truncated || (title?.truncated ?? false);
    return { ...h, text: text.text, title: title ? title.text : null, context };
  });
  return { ...result, hits, clipped };
}
