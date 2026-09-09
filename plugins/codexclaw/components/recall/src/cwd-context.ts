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
import { openIndexReadOnly, indexPath } from "./index-db.ts";
import { isSyntheticUserText } from "./rollout.ts";

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
 * List recent main sessions for exactly this cwd, newest first.
 *
 * Returns null when the index cannot be opened, which the caller treats as "use
 * the old path" rather than "no history". Never throws.
 */
export function listCwdSessions(
  cwd: string,
  topN: number,
  opts: { indexPath?: string; excerptChars?: number } = {},
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
    // Exact cwd only: automatic injection never federates across directories, and
    // a child path is a different project surface.
    const rows = db
      .prepare(
        `SELECT path, thread_id, date FROM files
          WHERE cwd = ? AND source = 'main'
          ORDER BY date DESC, path DESC LIMIT ?`,
      )
      .all(cwd, Math.max(topN * 2, topN)) as Array<Record<string, unknown>>;

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
