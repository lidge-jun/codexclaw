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
import { codexHome, memoriesDir, memoriesDbPath } from "./paths.ts";
import { openReadOnlyDb } from "./threads-db.ts";
import { splitQueryWords } from "./chat-search.ts";
import { expandQueryWords } from "./synonyms.ts";

export const DEFAULT_MEMORY_LIMIT = 20;

export type MemorySearchOptions = {
  limit?: number;
  days?: number;
  any?: boolean;
  home?: string;
  /** curated ko/en synonym expansion (default true); false = raw words only. */
  synonyms?: boolean;
  /** clock override for deterministic recency ranking in tests. */
  nowMs?: number;
};

/**
 * Memory artifact kind, derived from the Codex memories layout. Mirrors the
 * cli-jaw kind-priority model (profile/shared/procedure/semantic/episode)
 * mapped onto Codex-native artifacts.
 */
export type MemoryKind =
  | "summary" // memory_summary.md — always-injected routing summary
  | "handbook" // MEMORY.md — curated grep-friendly handbook
  | "skill" // skills/** — reusable procedures
  | "extension" // extensions/** — extension resources
  | "raw" // raw_memories.md — merged phase-1 raw input
  | "rollout" // rollout_summaries/** — per-thread episodic summaries
  | "stage1" // stage1_outputs rows — episodic, pre-consolidation
  | "other";

export type MemoryHit = {
  origin: "file" | "stage1";
  kind: MemoryKind;
  relpath: string;
  threadId: string | null;
  updatedAt: string | null;
  excerpt: string;
  startLine: number | null;
  /** final relevance score (text score + kind priority + recency boost). */
  score: number;
};

/** Hits from the same file beyond this cap are dropped so one fat file (MEMORY.md) cannot consume every slot. */
const PER_FILE_CAP = 2;

/** Classify a memories-root relpath into its artifact kind. */
export function kindOfRelpath(relpath: string, origin: "file" | "stage1" = "file"): MemoryKind {
  if (origin === "stage1") return "stage1";
  if (relpath === "memory_summary.md") return "summary";
  if (relpath === "MEMORY.md") return "handbook";
  if (relpath === "raw_memories.md") return "raw";
  if (relpath.startsWith("skills/")) return "skill";
  if (relpath.startsWith("extensions/")) return "extension";
  if (relpath.startsWith("rollout_summaries/")) return "rollout";
  return "other";
}

/**
 * Kind priority (cli-jaw indexing.ts kindPriority, sign-inverted: codexclaw
 * sorts higher-is-better while cli-jaw ranks bm25 lower-is-better).
 * summary/handbook are the curated stores; rollout/stage1 are episodic.
 */
export const KIND_PRIORITY: Record<MemoryKind, number> = {
  summary: 4,
  handbook: 3,
  skill: 2.5,
  extension: 2,
  raw: 0.5,
  rollout: 0,
  stage1: 0,
  other: 0,
};

/** Per-kind recency half-life (cli-jaw HALF_LIFE_HOURS shape): episodic kinds decay, curated kinds never do. */
export const HALF_LIFE_HOURS: Record<MemoryKind, number> = {
  rollout: 24 * 7,
  stage1: 24 * 7,
  other: 24 * 7,
  raw: 24 * 30,
  extension: 24 * 90,
  summary: Infinity,
  handbook: Infinity,
  skill: Infinity,
};

/**
 * Recency boost in [-2.0, +1.5]: fresh episodic hits gain up to +1.5 with
 * exponential half-life decay; rollout/stage1 older than 2x half-life take a
 * growing staleness penalty (cli-jaw stale-episode rule, sign-inverted).
 * Future/invalid timestamps clamp to age 0; unknown timestamps get no boost.
 */
export function recencyBoost(kind: MemoryKind, updatedAtMs: number | null, nowMs: number): number {
  const halfLife = HALF_LIFE_HOURS[kind];
  if (halfLife === Infinity || updatedAtMs === null || !Number.isFinite(updatedAtMs)) return 0;
  const ageHours = Math.max(0, (nowMs - updatedAtMs) / 3_600_000);
  const boost = 1.5 * Math.exp((-Math.LN2 * ageHours) / halfLife);
  if ((kind === "rollout" || kind === "stage1") && ageHours > halfLife * 2) {
    return boost - Math.min(2.0, (ageHours - halfLife * 2) / (halfLife * 2));
  }
  return boost;
}

/** Final ranking score: text relevance + kind priority + recency. */
export function finalScore(textScore: number, kind: MemoryKind, updatedAtMs: number | null, nowMs: number): number {
  return textScore + KIND_PRIORITY[kind] + recencyBoost(kind, updatedAtMs, nowMs);
}

/**
 * Relevance score for a matched chunk (evaluator round-1 gap #2): group coverage
 * dominates, occurrence density (on the best-present member of each OR-group)
 * and exact-phrase/heading boosts break ties.
 */
export function scoreChunk(lowerText: string, groups: string[][], lowerPhrase: string): number {
  let score = 0;
  for (const group of groups) {
    // Density rides on the best-present member (C-gate blocker #1: a synonym
    // hit must not score below the same text queried by its literal word).
    let bestOcc = 0;
    for (const member of group) {
      let at = lowerText.indexOf(member);
      if (at === -1) continue;
      let occ = 0;
      while (at !== -1 && occ < 5) {
        occ += 1;
        at = lowerText.indexOf(member, at + member.length);
      }
      if (occ > bestOcc) bestOcc = occ;
    }
    if (bestOcc === 0) continue;
    score += 2; // coverage
    score += bestOcc - 1; // density, capped
  }
  if (groups.length > 1 && lowerPhrase !== "" && lowerText.includes(lowerPhrase)) score += 5;
  if (lowerText.startsWith("#")) score += 1;
  return score;
}

/** Rank candidates: score desc, then recency desc; cap per-file, then limit. */
function rankAndTrim(candidates: MemoryHit[], limit: number): MemoryHit[] {
  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return (a.updatedAt ?? "") < (b.updatedAt ?? "") ? 1 : -1;
  });
  const perFile = new Map<string, number>();
  const out: MemoryHit[] = [];
  for (const hit of candidates) {
    const n = perFile.get(hit.relpath) ?? 0;
    if (n >= PER_FILE_CAP) continue;
    perFile.set(hit.relpath, n + 1);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

export type MemorySearchResult = {
  hits: MemoryHit[];
  warnings: string[];
  scannedFiles: number;
  elapsedMs: number;
};

function listMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
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

function frontmatterThreadId(content: string): string | null {
  const m = /^thread_id:\s*(\S+)/m.exec(content.slice(0, 2_000));
  return m ? m[1] : null;
}

/** Paragraph chunks with their 1-based start line, for jump-to-source output. */
export function paragraphChunks(content: string): Array<{ text: string; startLine: number }> {
  const chunks: Array<{ text: string; startLine: number }> = [];
  // CRLF-safe: strip the trailing \r so Windows-authored markdown chunks cleanly.
  const lines = content.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  let buf: string[] = [];
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

/** AND across groups, OR within a group; anyMode = any member of any group. */
function matches(lowerText: string, groups: string[][], anyMode: boolean): boolean {
  const groupHit = (group: string[]) => group.some((w) => lowerText.includes(w));
  return anyMode ? groups.some(groupHit) : groups.every(groupHit);
}

/** First group member actually present in the text (excerpt anchor), else the lead word. */
function firstPresentMember(lowerText: string, groups: string[][]): string {
  for (const group of groups) {
    const w = group.find((member) => lowerText.includes(member));
    if (w !== undefined) return w;
  }
  return groups[0][0];
}

function excerptAround(text: string, word: string, span: number): string {
  const lower = text.toLowerCase();
  const at = lower.indexOf(word);
  if (at === -1) return text.slice(0, span);
  const from = Math.max(0, at - Math.floor(span / 2));
  return text.slice(from, from + span);
}

export function searchMemory(query: string, opts: MemorySearchOptions = {}): MemorySearchResult {
  const started = Date.now();
  const home = opts.home ?? codexHome();
  const limit = Math.max(opts.limit ?? DEFAULT_MEMORY_LIMIT, 1);
  const anyMode = opts.any ?? false;
  const days = opts.days ?? 0;
  // One clock capture per search: recency boosts must not drift mid-ranking.
  const nowMs = opts.nowMs ?? Date.now();
  const cutoffMs = days > 0 ? nowMs - days * 86_400_000 : null;
  const words = splitQueryWords(query);
  const groups = (opts.synonyms ?? true) ? expandQueryWords(words) : words.map((w) => [w]);
  const lowerPhrase = query.toLowerCase().replace(/\s+/g, " ").trim();
  const warnings: string[] = [];
  const candidates: MemoryHit[] = [];
  const matchedThreadIds = new Set<string>();
  let scannedFiles = 0;

  if (words.length === 0) {
    warnings.push("empty query");
    return { hits: [], warnings, scannedFiles, elapsedMs: Date.now() - started };
  }

  const root = memoriesDir(home);
  for (const file of listMarkdownFiles(root)) {
    let content: string;
    let mtimeMs: number;
    try {
      content = readFileSync(file, "utf8");
      mtimeMs = statSync(file).mtimeMs;
    } catch {
      warnings.push(`unreadable memory file: ${file}`);
      continue;
    }
    if (cutoffMs && mtimeMs < cutoffMs) continue;
    scannedFiles += 1;
    if (!matches(content.toLowerCase(), groups, anyMode)) continue;
    const threadId = frontmatterThreadId(content);
    if (threadId) matchedThreadIds.add(threadId);
    const relpath = relative(root, file).split(sep).join("/");
    const kind = kindOfRelpath(relpath, "file");
    for (const chunk of paragraphChunks(content)) {
      const lower = chunk.text.toLowerCase();
      if (!matches(lower, groups, anyMode)) continue;
      candidates.push({
        origin: "file",
        kind,
        // Forward-slash relpaths on every platform (Codex memory backend parity).
        relpath,
        threadId,
        updatedAt: new Date(mtimeMs).toISOString(),
        excerpt: excerptAround(chunk.text, firstPresentMember(lower, groups), 400),
        startLine: chunk.startLine,
        score: finalScore(scoreChunk(lower, groups, lowerPhrase), kind, mtimeMs, nowMs),
      });
    }
  }

  searchStage1(home, groups, anyMode, cutoffMs, lowerPhrase, nowMs, candidates, matchedThreadIds, warnings);

  const hits = rankAndTrim(candidates, limit);
  return { hits, warnings, scannedFiles, elapsedMs: Date.now() - started };
}

/** stage1_outputs holds per-thread raw_memory + rollout_summary; read-only, fail-soft. */
function searchStage1(
  home: string,
  groups: string[][],
  anyMode: boolean,
  cutoffMs: number | null,
  lowerPhrase: string,
  nowMs: number,
  candidates: MemoryHit[],
  matchedThreadIds: Set<string>,
  warnings: string[],
): void {
  const dbPath = memoriesDbPath(home);
  if (!dbPath) {
    warnings.push("memories db not found (stage1 search off)");
    return;
  }
  let db: ReturnType<typeof openReadOnlyDb> | null = null;
  try {
    db = openReadOnlyDb(dbPath);
    // One bound LIKE parameter per group member (injection-safe: terms never
    // enter SQL text); OR within a group, AND/OR across groups per anyMode.
    const params: string[] = [];
    const conds = groups.map((group) => {
      const members = group.map((w) => {
        params.push(`%${w}%`);
        const n = params.length;
        return `(lower(raw_memory) LIKE ?${n} OR lower(rollout_summary) LIKE ?${n})`;
      });
      return `(${members.join(" OR ")})`;
    });
    const where = conds.join(anyMode ? " OR " : " AND ");
    const sql = `SELECT thread_id, raw_memory, rollout_summary, source_updated_at FROM stage1_outputs
      WHERE ${where} ORDER BY source_updated_at DESC`;
    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const threadId = typeof r.thread_id === "string" ? r.thread_id : null;
      if (threadId && matchedThreadIds.has(threadId)) continue; // already hit via its md file
      const updatedSec = typeof r.source_updated_at === "number" ? r.source_updated_at : null;
      if (cutoffMs && updatedSec !== null && updatedSec * 1000 < cutoffMs) continue;
      const body = `${String(r.raw_memory ?? "")}\n${String(r.rollout_summary ?? "")}`;
      const updatedMs = updatedSec !== null ? updatedSec * 1000 : null;
      candidates.push({
        origin: "stage1",
        kind: "stage1",
        relpath: `stage1_outputs/${threadId ?? "unknown"}`,
        threadId,
        updatedAt: updatedMs !== null ? new Date(updatedMs).toISOString() : null,
        excerpt: excerptAround(body, firstPresentMember(body.toLowerCase(), groups), 400),
        startLine: null,
        score: finalScore(scoreChunk(body.toLowerCase(), groups, lowerPhrase), "stage1", updatedMs, nowMs),
      });
    }
  } catch (err) {
    warnings.push(`memories db unreadable (${err instanceof Error ? err.message : String(err)})`);
  } finally {
    db?.close();
  }
}
