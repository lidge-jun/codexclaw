/**
 * memory-search.ts — search the Codex memory store: markdown files under
 * memories/ (MEMORY.md, raw_memories.md, rollout_summaries/*.md, extensions)
 * plus the stage1_outputs table in memories_<N>.sqlite (read-only, fail-soft).
 *
 * cli-jaw's memory search runs FTS5 over structured chunks; this WP1 pass is a
 * paragraph-chunk scan with the same AND-word matching used for chat search.
 * Unlike cli-jaw, `days` filtering is supported here too (file mtime /
 * source_updated_at).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { codexHome, memoriesDir, memoriesDbPath } from "./paths.js";
import { openReadOnlyDb } from "./threads-db.js";
import { splitQueryWords } from "./chat-search.js";

export const DEFAULT_MEMORY_LIMIT = 20;



















/** Hits from the same file beyond this cap are dropped so one fat file (MEMORY.md) cannot consume every slot. */
const PER_FILE_CAP = 2;

/**
 * Relevance score for a matched chunk (evaluator round-1 gap #2): word coverage
 * dominates, occurrence density and exact-phrase/heading boosts break ties.
 */
export function scoreChunk(lowerText        , words          , lowerPhrase        )         {
  let score = 0;
  for (const w of words) {
    let at = lowerText.indexOf(w);
    if (at === -1) continue;
    score += 2; // coverage
    let occ = 0;
    while (at !== -1 && occ < 5) {
      occ += 1;
      at = lowerText.indexOf(w, at + w.length);
    }
    score += occ - 1; // density, capped
  }
  if (words.length > 1 && lowerPhrase !== "" && lowerText.includes(lowerPhrase)) score += 5;
  if (lowerText.startsWith("#")) score += 1;
  return score;
}

/** Rank candidates: score desc, then recency desc; cap per-file, then limit. */
function rankAndTrim(candidates             , limit        )              {
  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return (a.updatedAt ?? "") < (b.updatedAt ?? "") ? 1 : -1;
  });
  const perFile = new Map                ();
  const out              = [];
  for (const hit of candidates) {
    const n = perFile.get(hit.relpath) ?? 0;
    if (n >= PER_FILE_CAP) continue;
    perFile.set(hit.relpath, n + 1);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}








function listMarkdownFiles(root        )           {
  if (!existsSync(root)) return [];
  const out           = [];
  const walk = (dir        ) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out;
}

function frontmatterThreadId(content        )                {
  const m = /^thread_id:\s*(\S+)/m.exec(content.slice(0, 2_000));
  return m ? m[1] : null;
}

/** Paragraph chunks with their 1-based start line, for jump-to-source output. */
export function paragraphChunks(content        )                                             {
  const chunks                                             = [];
  // CRLF-safe: strip the trailing \r so Windows-authored markdown chunks cleanly.
  const lines = content.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  let buf           = [];
  let start = 1;
  for (let i = 0; i <= lines.length; i++) {
    const line = i < lines.length ? lines[i] : "";
    if (line.trim() === "") {
      if (buf.length > 0) {
        chunks.push({ text: buf.join("\n"), startLine: start });
        buf = [];
      }
      start = i + 2;
    } else {
      if (buf.length === 0) start = i + 1;
      buf.push(line);
    }
  }
  return chunks;
}

function matches(lowerText        , words          , anyMode         )          {
  return anyMode ? words.some((w) => lowerText.includes(w)) : words.every((w) => lowerText.includes(w));
}

function excerptAround(text        , word        , span        )         {
  const lower = text.toLowerCase();
  const at = lower.indexOf(word);
  if (at === -1) return text.slice(0, span);
  const from = Math.max(0, at - Math.floor(span / 2));
  return text.slice(from, from + span);
}

export function searchMemory(query        , opts                      = {})                     {
  const started = Date.now();
  const home = opts.home ?? codexHome();
  const limit = Math.max(opts.limit ?? DEFAULT_MEMORY_LIMIT, 1);
  const anyMode = opts.any ?? false;
  const days = opts.days ?? 0;
  const cutoffMs = days > 0 ? Date.now() - days * 86_400_000 : null;
  const words = splitQueryWords(query);
  const lowerPhrase = query.toLowerCase().replace(/\s+/g, " ").trim();
  const warnings           = [];
  const candidates              = [];
  const matchedThreadIds = new Set        ();
  let scannedFiles = 0;

  if (words.length === 0) {
    warnings.push("empty query");
    return { hits: [], warnings, scannedFiles, elapsedMs: Date.now() - started };
  }

  const root = memoriesDir(home);
  for (const file of listMarkdownFiles(root)) {
    let content        ;
    let mtimeMs        ;
    try {
      content = readFileSync(file, "utf8");
      mtimeMs = statSync(file).mtimeMs;
    } catch {
      warnings.push(`unreadable memory file: ${file}`);
      continue;
    }
    if (cutoffMs && mtimeMs < cutoffMs) continue;
    scannedFiles += 1;
    if (!matches(content.toLowerCase(), words, anyMode)) continue;
    const threadId = frontmatterThreadId(content);
    if (threadId) matchedThreadIds.add(threadId);
    for (const chunk of paragraphChunks(content)) {
      const lower = chunk.text.toLowerCase();
      if (!matches(lower, words, anyMode)) continue;
      candidates.push({
        origin: "file",
        // Forward-slash relpaths on every platform (Codex memory backend parity).
        relpath: relative(root, file).split(sep).join("/"),
        threadId,
        updatedAt: new Date(mtimeMs).toISOString(),
        excerpt: excerptAround(chunk.text, words[0], 400),
        startLine: chunk.startLine,
        score: scoreChunk(lower, words, lowerPhrase),
      });
    }
  }

  searchStage1(home, words, anyMode, cutoffMs, lowerPhrase, candidates, matchedThreadIds, warnings);

  const hits = rankAndTrim(candidates, limit);
  return { hits, warnings, scannedFiles, elapsedMs: Date.now() - started };
}

/** stage1_outputs holds per-thread raw_memory + rollout_summary; read-only, fail-soft. */
function searchStage1(
  home        ,
  words          ,
  anyMode         ,
  cutoffMs               ,
  lowerPhrase        ,
  candidates             ,
  matchedThreadIds             ,
  warnings          ,
)       {
  const dbPath = memoriesDbPath(home);
  if (!dbPath) {
    warnings.push("memories db not found (stage1 search off)");
    return;
  }
  let db                                           = null;
  try {
    db = openReadOnlyDb(dbPath);
    const conds = words.map((_, i) => `(lower(raw_memory) LIKE ?${i + 1} OR lower(rollout_summary) LIKE ?${i + 1})`);
    const where = conds.join(anyMode ? " OR " : " AND ");
    const sql = `SELECT thread_id, raw_memory, rollout_summary, source_updated_at FROM stage1_outputs
      WHERE ${where} ORDER BY source_updated_at DESC`;
    const rows = db.prepare(sql).all(...words.map((w) => `%${w}%`))                                  ;
    for (const r of rows) {
      const threadId = typeof r.thread_id === "string" ? r.thread_id : null;
      if (threadId && matchedThreadIds.has(threadId)) continue; // already hit via its md file
      const updatedSec = typeof r.source_updated_at === "number" ? r.source_updated_at : null;
      if (cutoffMs && updatedSec !== null && updatedSec * 1000 < cutoffMs) continue;
      const body = `${String(r.raw_memory ?? "")}\n${String(r.rollout_summary ?? "")}`;
      candidates.push({
        origin: "stage1",
        relpath: `stage1_outputs/${threadId ?? "unknown"}`,
        threadId,
        updatedAt: updatedSec !== null ? new Date(updatedSec * 1000).toISOString() : null,
        excerpt: excerptAround(body, words[0], 400),
        startLine: null,
        score: scoreChunk(body.toLowerCase(), words, lowerPhrase),
      });
    }
  } catch (err) {
    warnings.push(`memories db unreadable (${err instanceof Error ? err.message : String(err)})`);
  } finally {
    db?.close();
  }
}
