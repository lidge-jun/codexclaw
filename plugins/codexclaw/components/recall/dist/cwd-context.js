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
import { openIndexReadOnly, indexPath } from "./index-db.js";
import { isSyntheticUserText } from "./rollout.js";
import { readdirSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { codexHome, memoriesDir } from "./paths.js";











/**
 * Harness-authored openers that are NOT flagged synthetic at ingest time.
 *
 * `synthetic` is decided during ingest from SYNTHETIC_PREFIXES, and the plugin
 * catalog block below is the single most common first user message in the corpus
 * (331 of 400 recent main sessions sampled). Adding it to SYNTHETIC_PREFIXES would
 * change what the stored flag means and force a full reindex of a multi-gigabyte
 * cache, so it is skipped at READ time instead, where it costs nothing.
 */
const EXTRA_HARNESS_PREFIXES                    = [
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

function isHarnessText(text        )          {
  const head = text.trimStart();
  if (head === "") return true;
  if (isSyntheticUserText(head)) return true;
  return EXTRA_HARNESS_PREFIXES.some((p) => head.startsWith(p));
}

/** Collapse whitespace so one session always renders as one line. */
function flatten(text        )         {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * List recent main sessions for exactly this cwd, newest first.
 *
 * Returns null when the index cannot be opened, which the caller treats as "use
 * the old path" rather than "no history". Never throws.
 */
export function listCwdSessions(
  cwd        ,
  topN        ,
  opts                                                = {},
)                      {
  if (!cwd || topN <= 0) return null;
  const excerptChars = opts.excerptChars ?? 100;
  let db                                      ;
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
      .all(cwd, Math.max(topN * 2, topN))                                  ;

    const sessions               = [];
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
        .all(path)                                  ;
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
export function loadSummaryIndex(home = codexHome())                            {
  const out = new Map                      ();
  const dir = join(memoriesDir(home), "rollout_summaries");
  let names          ;
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".md"));
  } catch {
    return out; // no summaries on this machine
  }
  for (const name of names) {
    let fd        ;
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
