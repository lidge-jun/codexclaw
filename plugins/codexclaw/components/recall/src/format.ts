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
import type { MemorySearchResult } from "./memory-search.ts";

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

export function formatMemoryResult(result: MemorySearchResult): string {
  const lines: string[] = [];
  lines.push(`# ${result.hits.length} memory hits (${result.scannedFiles} files scanned, ${result.elapsedMs}ms)`);
  if (result.hits.length === 0) lines.push("(no matches)");
  for (const hit of result.hits) {
    lines.push("");
    const loc = hit.startLine !== null ? `${hit.relpath}:${hit.startLine}` : hit.relpath;
    const when = hit.updatedAt ? ` [${hit.updatedAt}]` : "";
    lines.push(`(${hit.origin}) ${loc}${when}`);
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
