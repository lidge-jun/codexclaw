/**
 * rollout.ts — date-pruned discovery + lazy parsing of Codex rollout JSONL files.
 *
 * A rollout file lives at sessions/YYYY/MM/DD/rollout-<ts>-<threadId>.jsonl and holds
 * one JSON object per line: session_meta, turn_context, event_msg, response_item.
 * Chat content lives in response_item payloads:
 *   - type "message"              -> role user|assistant|developer, content[].text
 *   - type "function_call"        -> tool invocation (name + arguments)
 *   - type "function_call_output" -> tool output text
 *
 * Parsing is the hot path over a multi-GB corpus, so callers are expected to run the
 * cheap file-level prefilter (see matchesFilePrefilter) before parseRollout.
 */
import { readdirSync, readFileSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";

export type RolloutSource = "main" | "subagent";

export type RolloutMeta = {
  threadId: string | null;
  cwd: string | null;
  source: RolloutSource;
  nickname: string | null;
  originator: string | null;
};

export type ChatEntry = {
  ts: string;
  role: string;
  text: string;
  matchField: "content" | "tool_log";
  synthetic: boolean;
};

export type RolloutFile = {
  path: string;
  /** YYYY-MM-DD taken from the directory structure. */
  date: string;
};

/** User-message prefixes injected by the harness rather than typed by a person. */
export const SYNTHETIC_PREFIXES: readonly string[] = [
  "<environment_context>",
  "<ENVIRONMENT_CONTEXT>",
  "<skill>",
  "<subagent_notification>",
  "<turn_aborted>",
  "<permissions instructions>",
  "<INSTRUCTIONS>",
  "<user_instructions>",
  "<system-reminder>",
  "# AGENTS.md instructions",
  "## Workspace Context",
  "[Recent Context]",
];

export function isSyntheticUserText(text: string): boolean {
  const head = text.trimStart();
  return SYNTHETIC_PREFIXES.some((p) => head.startsWith(p));
}

/** All rollout files under sessions/, newest directory-date first, pruned to `days` (0 = all). */
export function listRolloutFiles(home: string, days: number): RolloutFile[] {
  const root = join(home, "sessions");
  if (!existsSync(root)) return [];
  const cutoff = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
  const out: RolloutFile[] = [];
  for (const year of safeDirs(root)) {
    for (const month of safeDirs(join(root, year))) {
      for (const day of safeDirs(join(root, year, month))) {
        const date = `${year}-${month}-${day}`;
        if (cutoff && new Date(`${date}T23:59:59Z`) < cutoff) continue;
        const dir = join(root, year, month, day);
        for (const name of readdirSync(dir)) {
          if (name.endsWith(".jsonl")) out.push({ path: join(dir, name), date });
        }
      }
    }
  }
  // Newest first: directory date, then the timestamped filename, both sort lexically.
  out.sort((a, b) => (a.path < b.path ? 1 : a.path > b.path ? -1 : 0));
  return out;
}

function safeDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Parse only the head of the file to classify it (session_meta is the first line). */
export function readRolloutMeta(path: string): RolloutMeta {
  const firstLine = readFirstLine(path);
  const fallback: RolloutMeta = { threadId: null, cwd: null, source: "main", nickname: null, originator: null };
  try {
    const j = JSON.parse(firstLine);
    if (j?.type !== "session_meta") return fallback;
    const p = j.payload ?? {};
    const isSub = p.thread_source === "subagent" || p.source?.subagent !== undefined;
    return {
      threadId: typeof p.id === "string" ? p.id : null,
      cwd: typeof p.cwd === "string" ? p.cwd : null,
      source: isSub ? "subagent" : "main",
      nickname: typeof p.agent_nickname === "string" ? p.agent_nickname : null,
      originator: typeof p.originator === "string" ? p.originator : null,
    };
  } catch {
    return fallback;
  }
}

/**
 * session_meta first lines carry full instruction payloads (22–44KB observed),
 * so grow the head read until a newline appears (capped at 1MB).
 */
function readFirstLine(path: string): string {
  const fd = openSync(path, "r");
  try {
    let size = 32_768;
    const cap = 1_048_576;
    for (;;) {
      const buf = Buffer.alloc(size);
      const n = readSync(fd, buf, 0, size, 0);
      const head = buf.subarray(0, n).toString("utf8");
      const nl = head.indexOf("\n");
      if (nl !== -1) return head.slice(0, nl);
      if (n < size || size >= cap) return head;
      size = Math.min(size * 4, cap);
    }
  } finally {
    closeSync(fd);
  }
}

/**
 * File-level prefilter: one lowercase pass, no line split / JSON.parse.
 * AND mode requires every word; OR mode any word.
 */
export function matchesFilePrefilter(lowerContent: string, words: string[], anyMode: boolean): boolean {
  if (words.length === 0) return false;
  return anyMode
    ? words.some((w) => lowerContent.includes(w))
    : words.every((w) => lowerContent.includes(w));
}

/** Extract the full ordered chat/tool entry list from a rollout file's content. */
export function parseRollout(content: string, includeTools: boolean): ChatEntry[] {
  const entries: ChatEntry[] = [];
  for (const line of content.split("\n")) {
    if (line === "") continue;
    // Cheap structural prefilter: skip lines that cannot be response_items.
    if (!line.includes('"response_item"')) continue;
    let j: any; // eslint-disable-line -- JSONL payloads are heterogeneous by design
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    if (j.type !== "response_item" || !j.payload) continue;
    const p = j.payload;
    const ts = typeof j.timestamp === "string" ? j.timestamp : "";
    if (p.type === "message") {
      const role = typeof p.role === "string" ? p.role : "unknown";
      const text = (Array.isArray(p.content) ? p.content : [])
        .filter((c: any) => c && (c.type === "input_text" || c.type === "output_text"))
        .map((c: any) => String(c.text ?? ""))
        .join("\n")
        .trim();
      if (text === "") continue;
      entries.push({
        ts,
        role,
        text,
        matchField: "content",
        synthetic: role === "user" ? isSyntheticUserText(text) : role === "developer",
      });
    } else if (includeTools && p.type === "function_call") {
      const text = `${String(p.name ?? "tool")} ${String(p.arguments ?? "")}`.trim();
      entries.push({ ts, role: "tool", text, matchField: "tool_log", synthetic: false });
    } else if (includeTools && p.type === "function_call_output") {
      const text = String(p.output ?? "").trim();
      if (text === "") continue;
      entries.push({ ts, role: "tool", text, matchField: "tool_log", synthetic: false });
    }
  }
  return entries;
}
