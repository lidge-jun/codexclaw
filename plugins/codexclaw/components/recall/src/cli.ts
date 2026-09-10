/**
 * cli.ts — `recall` entry point. Argv contract from bin/codexclaw.mjs:
 *   [kind, "search", ...queryAndFlags]   kind ∈ chat | memory
 *
 * Read-only over CODEX_HOME (~/.codex); never writes. Unknown subcommands print
 * usage and exit 0 (informational, matching cxc-ops convention).
 */
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { searchChat, DEFAULT_DAYS, DEFAULT_LIMIT, type ChatSearchOptions } from "./chat-search.ts";
import { searchMemory, DEFAULT_MEMORY_LIMIT, type MemorySearchOptions } from "./memory-search.ts";
import { formatChatResult, formatMemoryResult, clipChatResultForJson } from "./format.ts";
import { openIndex, openIndexReadOnly, indexPath, indexStatus } from "./index-db.ts";
import { ingest } from "./ingest.ts";
import { codexHome } from "./paths.ts";
import {
  handleUserPromptSubmit,
  handleSessionStart,
  handlePostCompact,
  type UserPromptSubmitPayload,
} from "./hook.ts";

const USAGE = [
  "cxc chat search \"<query>\" [--days N] [--cwd PATH] [--role r] [--source main|subagent|all]",
  "                           [--limit N] [--context N] [--any] [--all] [--no-tools]",
  "                           [--recent] [--scan] [--no-refresh] [--synonyms] [--json]",
  "cxc chat index [--rebuild] [--status] [--json]",
  "cxc memory search \"<query>\" [--days N] [--limit N] [--any] [--no-synonyms]",
  "                             [--cwd PATH] [--cwd-only PATH] [--no-chat] [--json]",
  "",
  `  --days N     restrict to the last N days (chat default ${DEFAULT_DAYS}, 0 = full history)`,
  "  --cwd PATH   scope to PATH and to other checkouts of the same git origin",
  "               (chat: only those sessions; memory: rank those hits first)",
  "  --cwd-only PATH  memory search: drop hits recorded outside that project",
  "  --role r     only messages with this role (user|assistant|tool)",
  "  --source s   main (default) | subagent | all",
  `  --limit N    max hits (chat default ${DEFAULT_LIMIT}, memory default ${DEFAULT_MEMORY_LIMIT})`,
  "  --context N  include N neighbouring messages around each hit",
  "  --any        OR the query words (default: AND)",
  "  --all        include harness-injected synthetic messages",
  "  --no-tools   skip tool call/output (tool_log) matching",
  "  --recent     order by time instead of relevance (index engine default: relevance)",
  "  --rank       order by relevance (the default; accepted for explicitness)",
  "  --no-chat    memory search: do not fall back to raw chat when nothing matches",
  "  --scan       force the raw JSONL scan path (skip the sidecar index)",
  "  --no-refresh skip refresh-on-query ingest (fastest, index may be stale)",
  "  --no-synonyms memory search: raw words only — no ko/en synonyms, no korean stem",
  "  --synonyms   chat search: expand ko/en synonyms + korean stems (default off)",
  "  --json       machine-readable output (text fields clipped at 500 chars)",
  "  --full       with --json: emit unclipped text fields",
  "  --home PATH  search an alternate Codex home (default $CODEX_HOME ?? ~/.codex)",
].join("\n");

type ParsedFlags = {
  values: Record<string, unknown>;
  positionals: string[];
};

function parseFlags(args: string[]): ParsedFlags {
  const { values, positionals } = parseArgs({
    args,
    options: {
      days: { type: "string", short: "d" },
      limit: { type: "string", short: "l" },
      context: { type: "string", short: "c" },
      role: { type: "string" },
      cwd: { type: "string" },
      "cwd-only": { type: "string" },
      source: { type: "string" },
      any: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      "no-tools": { type: "boolean", default: false },
      rank: { type: "boolean", default: false },
      recent: { type: "boolean", default: false },
      scan: { type: "boolean", default: false },
      "no-refresh": { type: "boolean", default: false },
      "no-synonyms": { type: "boolean", default: false },
      synonyms: { type: "boolean", default: false },
      "no-chat": { type: "boolean", default: false },
      full: { type: "boolean", default: false },
      rebuild: { type: "boolean", default: false },
      status: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      home: { type: "string" },
      "index-path": { type: "string" },
    },
    strict: false,
    allowPositionals: true,
  });
  return { values: values as Record<string, unknown>, positionals: positionals.map(String) };
}

function numFlag(values: Record<string, unknown>, key: string): number | undefined {
  const raw = values[key];
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

function runChatSearch(args: string[]): number {
  const { values, positionals } = parseFlags(args);
  const query = positionals.join(" ").trim();
  if (query === "") {
    process.stdout.write(`${USAGE}\n`);
    return 1;
  }
  const source = typeof values.source === "string" ? values.source : "main";
  if (source !== "main" && source !== "subagent" && source !== "all") {
    process.stderr.write(`invalid --source: ${source} (use main|subagent|all)\n`);
    return 1;
  }
  const opts: ChatSearchOptions = {
    days: numFlag(values, "days"),
    limit: numFlag(values, "limit"),
    context: numFlag(values, "context"),
    any: values.any === true,
    // Default off: chat is the raw corpus, and expanding every word there
    // widens a multi-GB scan (memory search defaults the other way).
    synonyms: values.synonyms === true,
    role: typeof values.role === "string" ? values.role : null,
    cwd: typeof values.cwd === "string" ? values.cwd : null,
    source,
    includeSynthetic: values.all === true,
    includeTools: values["no-tools"] !== true,
    order: values.recent === true && values.rank !== true ? "recent" : "relevance",
    scan: values.scan === true,
    noRefresh: values["no-refresh"] === true,
    home: typeof values.home === "string" ? values.home : undefined,
    indexPath: typeof values["index-path"] === "string" ? values["index-path"] : undefined,
  };
  const result = searchChat(query, opts);
  const jsonBody = values.full === true ? result : clipChatResultForJson(result);
  process.stdout.write(
    values.json === true ? `${JSON.stringify(jsonBody, null, 2)}\n` : `${formatChatResult(result)}\n`,
  );
  return 0;
}

function runMemorySearch(args: string[]): number {
  const { values, positionals } = parseFlags(args);
  const query = positionals.join(" ").trim();
  if (query === "") {
    process.stdout.write(`${USAGE}\n`);
    return 1;
  }
  const opts: MemorySearchOptions = {
    days: numFlag(values, "days"),
    limit: numFlag(values, "limit"),
    any: values.any === true,
    synonyms: values["no-synonyms"] !== true,
    home: typeof values.home === "string" ? values.home : undefined,
    // --cwd-only carries its own path, so `--cwd-only PATH` needs no second flag.
    // Bare `--cwd-only` (parsed as a boolean) hardens an accompanying --cwd.
    cwd: typeof values["cwd-only"] === "string" ? values["cwd-only"] : typeof values.cwd === "string" ? values.cwd : null,
    cwdOnly: values["cwd-only"] !== undefined && values["cwd-only"] !== false,
    // Injected rather than imported by memory-search: the module keeps no edge
    // to chat-search, and the fallback is one flag away from being off.
    searchChat: values["no-chat"] === true ? undefined : searchChat,
  };
  const result = searchMemory(query, opts);
  process.stdout.write(
    values.json === true ? `${JSON.stringify(result, null, 2)}\n` : `${formatMemoryResult(result)}\n`,
  );
  return 0;
}

function runChatIndex(args: string[]): number {
  const { values } = parseFlags(args);
  const home = typeof values.home === "string" ? values.home : codexHome();
  const path = typeof values["index-path"] === "string" ? values["index-path"] : indexPath();
  try {
    // --status alone is a pure read: open read-only so it works on read-only
    // filesystems and never touches WAL/schema (evaluator round-1 gap #1).
    const statusOnly = values.status === true && values.rebuild !== true;
    const db = statusOnly ? openIndexReadOnly(path) : openIndex(path);
    try {
      if (values.rebuild === true) {
        db.exec("DELETE FROM msgs; DELETE FROM files;");
      }
      if (!statusOnly) {
        const r = ingest(home, db, 0);
        if (values.json !== true) {
          process.stdout.write(
            `ingested ${r.ingested}/${r.scanned} files, ${r.appended} appended (${r.msgs} messages, ${r.pruned} pruned, ${r.elapsedMs}ms)\n`,
          );
        }
      }
      const status = indexStatus(db, path);
      process.stdout.write(
        values.json === true
          ? `${JSON.stringify(status, null, 2)}\n`
          : `index: ${status.path}\nfiles: ${status.files}, messages: ${status.msgs}, last ingest: ${status.lastIngestAt ?? "never"}\n`,
      );
      return 0;
    } finally {
      db.close();
    }
  } catch (err) {
    process.stderr.write(`chat index failed: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

/** Read-only one-line index status for hook injection ("" when unavailable). */
function indexStatusLine(): string {
  try {
    const path = indexPath();
    const db = openIndexReadOnly(path);
    try {
      const s = indexStatus(db, path);
      return `${s.files} files / ${s.msgs} messages, last ingest ${s.lastIngestAt ?? "never"}`;
    } finally {
      db.close();
    }
  } catch {
    return "";
  }
}


/** Hook entry: read the Codex hook JSON payload from stdin, print the injection line. */
async function runHook(event: string): Promise<number> {
  try {
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;
    let out = "";
    if (event === "user-prompt-submit") {
      out = handleUserPromptSubmit(JSON.parse(raw) as UserPromptSubmitPayload);
    } else if (event === "session-start") {
      // `source` distinguishes a fresh start from a post-compaction restart; the
      // runtime re-fires SessionStart with source "compact" after compacting.
      const payload = raw.trim() ? JSON.parse(raw) as { cwd?: string; source?: string } : {};
      out = handleSessionStart(indexStatusLine(), payload.cwd ?? process.cwd(), payload.source);
    } else if (event === "post-compact") {
      const payload = raw.trim() ? JSON.parse(raw) as { cwd?: string } : {};
      // Always "" — PostCompact output is universal-only (see handlePostCompact).
      out = handlePostCompact(payload.cwd ?? process.cwd());
    }
    if (out !== "") process.stdout.write(out);
    return 0;
  } catch {
    return 0; // FAIL-OPEN: a broken payload must never block the session.
  }
}
export function main(argv: string[]): number | Promise<number> {
  const kind = argv[0] ?? "help";
  const sub = argv[1] ?? "";
  if ((kind === "chat" || kind === "memory") && sub === "search") {
    return kind === "chat" ? runChatSearch(argv.slice(2)) : runMemorySearch(argv.slice(2));
  }
  if (kind === "chat" && sub === "index") {
    return runChatIndex(argv.slice(2));
  }
  if (kind === "hook") {
    return runHook(sub);
  }
  process.stdout.write(`${USAGE}\n`);
  return 0;
}

// Direct-exec guard: run only when invoked as a script, not when imported by tests.
// Realpath both sides: symlinked installs (plugin cache, npm global) otherwise miss.
function realOrSelf(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const invokedPath = process.argv[1] ? realOrSelf(resolve(process.argv[1])) : "";
const selfPath = realOrSelf(fileURLToPath(import.meta.url));
if (invokedPath === selfPath) {
  Promise.resolve(main(process.argv.slice(2))).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`recall error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
