/**
 * cwd-context.ts — enumerate recent sessions for ONE working directory.
 *
 * The hook used to find sessions by searching chat text for basename(cwd), which
 * only matches when the directory name happens to appear in the conversation. Hash
 * worktree names ("1fa9") essentially never do, so those checkouts got no context
 * at all. The sidecar index already stores cwd per file, so sessions can be listed
 * directly: no text match, no FTS, and one indexed lookup per session for the
 * opening user message.
 *
 * Everything here is best-effort and READ-ONLY. A missing or unreadable index
 * yields null so the caller can fall back to the previous search path.
 */
import { openIndexReadOnly, indexPath, filesHasColumn } from "./index-db.ts";
import { isSyntheticUserText, FOLD_CWD_CASE } from "./rollout.ts";
import { readdirSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { codexHome, memoriesDir, stateDbPath } from "./paths.ts";
import { loadThreadMeta } from "./threads-db.ts";
import {
  normalizeRepoKey,
  repoKeyForCwd,
  repoKeysEqual,
  readOriginUrl,
  type ReadOriginUrl,
} from "./repo-key.ts";

export type CwdSession = {
  /** Rollout file path (index primary key). */
  path: string;
  threadId: string | null;
  /** YYYY-MM-DD from the session directory structure. */
  date: string;
  /** First real user utterance, or "" when only harness text was found. */
  excerpt: string;
};

/**
 * Harness-authored openers that are NOT flagged synthetic at ingest time.
 *
 * `synthetic` is decided during ingest from SYNTHETIC_PREFIXES, and the plugin
 * catalog block below is the single most common first user message in the corpus
 * (331 of 400 recent main sessions sampled). Adding it to SYNTHETIC_PREFIXES would
 * change what the stored flag means and force a full reindex of a multi-gigabyte
 * cache, so it is skipped at READ time instead, where it costs nothing.
 */
const EXTRA_HARNESS_PREFIXES: readonly string[] = [
  "<recommended_plugins>",
  "<hook_prompt",
  "<realtime_delegation>",
  "<codex_internal_context",
  "<in-app-browser-context",
  "<send_user_message_question_reply>",
  "# Files mentioned by the user:",
  "# Files pasted by the user:",
  "# Browser comments:",
  "## Referenced chats with Codex:",
];

function isHarnessText(text: string): boolean {
  const head = text.trimStart();
  if (head === "") return true;
  if (isSyntheticUserText(head)) return true;
  return EXTRA_HARNESS_PREFIXES.some((p) => head.startsWith(p));
}

/** Collapse whitespace so one session always renders as one line. */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Bound on the thread-id IN list; see index-search.ts for the same reasoning.
 */
const MAX_REPO_THREAD_IDS = 5_000;

/**
 * List recent main sessions for this project, newest first.
 *
 * "This project" is the exact cwd plus any session recorded against the SAME
 * git remote — a managed worktree under ~/.codex/worktrees and the main
 * checkout of one repository share an origin, and a fresh slot has no history
 * of its own to show. A directory with no origin keeps the exact-cwd behaviour,
 * so unrelated checkouts still never leak into each other.
 *
 * Returns null when the index cannot be opened, which the caller treats as "use
 * the old path" rather than "no history". Never throws.
 */
export function listCwdSessions(
  cwd: string,
  topN: number,
  opts: {
    indexPath?: string;
    excerptChars?: number;
    /** Codex home for the threads join (default $CODEX_HOME ?? ~/.codex). */
    home?: string;
    /** git origin reader; injected by tests so no real repository is needed. */
    readOriginUrl?: ReadOriginUrl;
  } = {},
): CwdSession[] | null {
  if (!cwd || topN <= 0) return null;
  const excerptChars = opts.excerptChars ?? 100;
  let db: ReturnType<typeof openIndexReadOnly>;
  try {
    db = openIndexReadOnly(opts.indexPath ?? indexPath());
  } catch {
    return null; // no index yet, or unreadable — caller falls back
  }
  try {
    // Exact cwd, or the same remote. A child path stays a different project
    // surface; automatic injection still never federates across repositories.
    const repoKey = repoKeyForCwd(cwd, opts.readOriginUrl ?? readOriginUrl);
    const conds: string[] = ["cwd = ?"];
    const params: unknown[] = [cwd];
    if (FOLD_CWD_CASE) {
      conds.push("lower(cwd) = lower(?)");
      params.push(cwd);
    }
    if (repoKey !== null) {
      if (filesHasColumn(db, "repo_key")) {
        conds.push("(repo_key IS NOT NULL AND repo_key = ?)");
        params.push(repoKey);
      }
      // An index written before wp4 has no column to read, so the same-origin
      // thread ids from the Codex state db stand in for it.
      const ids = sameOriginThreadIds(opts.home ?? codexHome(), repoKey);
      if (ids.length > 0) {
        conds.push(`thread_id IN (${ids.map(() => "?").join(",")})`);
        params.push(...ids);
      }
    }
    const rows = db
      .prepare(
        `SELECT path, thread_id, date FROM files
          WHERE (${conds.join(" OR ")}) AND source = 'main'
          ORDER BY date DESC, path DESC LIMIT ?`,
      )
      .all(...params, Math.max(topN * 2, topN)) as Array<Record<string, unknown>>;

    const sessions: CwdSession[] = [];
    for (const row of rows) {
      if (sessions.length >= topN) break;
      const path = String(row.path);
      // A few rows deep: the real opener often sits behind harness-injected text.
      const msgs = db
        .prepare(
          `SELECT text FROM msgs
            WHERE path = ? AND role = 'user' AND synthetic = 0
            ORDER BY ord LIMIT 4`,
        )
        .all(path) as Array<Record<string, unknown>>;
      let excerpt = "";
      for (const msg of msgs) {
        const text = String(msg.text ?? "");
        if (isHarnessText(text)) continue;
        const flat = flatten(text);
        if (flat === "") continue;
        excerpt = flat.length > excerptChars ? `${flat.slice(0, excerptChars - 3)}...` : flat;
        break;
      }
      sessions.push({
        path,
        threadId: typeof row.thread_id === "string" ? row.thread_id : null,
        date: String(row.date ?? ""),
        excerpt,
      });
    }
    return sessions;
  } catch {
    return null;
  } finally {
    try {
      db.close();
    } catch {
      /* already closed */
    }
  }
}

/** Thread ids recorded against `repoKey`; empty on any failure (fail-soft). */
function sameOriginThreadIds(home: string, repoKey: string): string[] {
  const ids: string[] = [];
  try {
    const meta = loadThreadMeta(stateDbPath(home));
    for (const [id, thread] of meta.byId) {
      if (repoKeysEqual(repoKey, normalizeRepoKey(thread.gitOriginUrl))) {
        ids.push(id);
        if (ids.length >= MAX_REPO_THREAD_IDS) break;
      }
    }
  } catch {
    // No state db, or unreadable: the exact-cwd condition still applies.
  }
  return ids;
}

export type SummaryEntry = { relpath: string; title: string };

/** Frontmatter head size: thread_id/cwd sit in the first few lines, the title right after. */
const SUMMARY_HEAD_BYTES = 1200;

/**
 * Index rollout summaries by thread id, mapping to their first markdown heading.
 *
 * These are human-written one-line summaries of what a session accomplished, which
 * is better context than anything derivable from the transcript. Only the head of
 * each file is read (measured at ~37ms for 256 files), and the join is by thread
 * id, so a session without a summary simply does not get this line. Coverage is
 * uneven across directories, which makes this a bonus tier rather than the main
 * material. Returns an empty map on any failure.
 */
export function loadSummaryIndex(home = codexHome()): Map<string, SummaryEntry> {
  const out = new Map<string, SummaryEntry>();
  const dir = join(memoriesDir(home), "rollout_summaries");
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".md"));
  } catch {
    return out; // no summaries on this machine
  }
  for (const name of names) {
    let fd: number;
    try {
      fd = openSync(join(dir, name), "r");
    } catch {
      continue;
    }
    try {
      const buf = Buffer.alloc(SUMMARY_HEAD_BYTES);
      const len = readSync(fd, buf, 0, SUMMARY_HEAD_BYTES, 0);
      const head = buf.toString("utf8", 0, len);
      const threadId = /^thread_id:\s*(\S+)\s*$/m.exec(head);
      const title = /^#\s+(.+)$/m.exec(head);
      if (!threadId || !title) continue;
      out.set(threadId[1], { relpath: name, title: title[1].trim() });
    } catch {
      /* unreadable file contributes nothing */
    } finally {
      try {
        closeSync(fd);
      } catch {
        /* already closed */
      }
    }
  }
  return out;
}
