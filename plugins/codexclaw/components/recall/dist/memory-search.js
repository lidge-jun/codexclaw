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
import { join, relative, resolve, sep, posix as posixPath, win32 as win32Path } from "node:path";
import { codexHome, memoriesDir, memoriesDbPath, stateDbPath } from "./paths.js";
import { openReadOnlyDb, loadThreadMeta,                 } from "./threads-db.js";
import { cwdMatches, normalizeCwd, FOLD_CWD_CASE } from "./rollout.js";
import {
  normalizeRepoKey,
  repoKeyForCwd,
  repoKeysEqual,
  readOriginUrl,

} from "./repo-key.js";
import {
  splitQueryWordsRaw,
  termIndexOf,
  termIncludes,
  countTermOccurrences,
  hasBoundaryTerm,
  relaxGroupsAt,
  dropStopwords,
  compileMatchPlan,
  planMatches,
  allGroups,
  MAX_WORDS,


} from "./query-words.js";
import { expandQueryWords } from "./synonyms.js";
import { splitLines } from "./text-lines.js";
// Type-only: erased by the type-stripping build, so memory search still ships
// with no runtime edge to chat-search.ts. The function itself arrives through
// MemorySearchOptions.searchChat (the RecallContextDeps pattern in hook.ts).




export const DEFAULT_MEMORY_LIMIT = 20;































/**
 * Memory artifact kind, derived from the Codex memories layout. Mirrors the
 * cli-jaw kind-priority model (profile/shared/procedure/semantic/episode)
 * mapped onto Codex-native artifacts.
 */

























/** Hits from the same file beyond this cap are dropped so one fat file (MEMORY.md) cannot consume every slot. */
const PER_FILE_CAP = 2;

/**
 * Score penalty applied to substring-only hits from the relaxed retry. One
 * coverage unit is +2, so this puts a relaxed hit a full group behind anything
 * a strict pass could have produced — the "low-confidence fallback" ordering
 * survives even if a future caller merges the two passes.
 */
const RELAXED_PENALTY = 2;

/**
 * Score added to a hit recorded under the requested project (`--cwd`). Worth one
 * coverage group, so an in-project hit outranks an equally relevant hit from
 * another project without overriding text relevance: a five-group match
 * elsewhere still beats a one-group match here.
 */
export const CWD_BOOST = 2;

/** Classify a memories-root relpath into its artifact kind. */
export function kindOfRelpath(relpath        , origin                      = "file")             {
  if (origin === "stage1") return "stage1";
  if (origin === "chat") return "chat";
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
export const KIND_PRIORITY                             = {
  summary: 4,
  handbook: 3,
  skill: 2.5,
  extension: 2,
  raw: 0.5,
  rollout: 0,
  stage1: 0,
  // Raw conversation is the least consolidated source there is; it only ever
  // appears when nothing else answered, so its priority only orders the
  // backfill against itself.
  chat: -1,
  other: 0,
};

/** Per-kind recency half-life (cli-jaw HALF_LIFE_HOURS shape): episodic kinds decay, curated kinds never do. */
export const HALF_LIFE_HOURS                             = {
  rollout: 24 * 7,
  stage1: 24 * 7,
  other: 24 * 7,
  chat: 24 * 7,
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
export function recencyBoost(kind            , updatedAtMs               , nowMs        )         {
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
export function finalScore(textScore        , kind            , updatedAtMs               , nowMs        )         {
  return textScore + KIND_PRIORITY[kind] + recencyBoost(kind, updatedAtMs, nowMs);
}

/**
 * Relevance score for a matched chunk (evaluator round-1 gap #2): group coverage
 * dominates, occurrence density (on the best-present member of each OR-group)
 * and exact-phrase/heading boosts break ties.
 */
export function scoreChunk(lowerText        , groups              , lowerPhrase        )         {
  let score = 0;
  for (const group of groups) {
    // Density rides on the best-present member (C-gate blocker #1: a synonym
    // hit must not score below the same text queried by its literal word).
    let bestOcc = 0;
    for (const member of group) {
      const occ = countTermOccurrences(lowerText, member, 5);
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

/**
 * `cwd:` from a file's leading frontmatter block — the contiguous `key: value`
 * lines before the first blank line.
 *
 * Reading `^cwd:` anywhere near the top instead is wrong on the live store:
 * `raw_memories.md` concatenates 448 per-thread blocks, each with its own
 * `cwd:`, and the first one would label the whole file with a single project.
 * All 256 rollout summaries carry cwd in their leading block, so the accurate
 * reading costs nothing there. Chunks inside an aggregate file still reach the
 * scope through the path mention in their own body.
 */
function frontmatterCwd(content        )                {
  for (const line of splitLines(content.slice(0, 2_000))) {
    if (line.trim() === "") return null; // end of the leading block
    const m = /^([a-z_]+):\s*(\S+)/.exec(line);
    if (!m) return null; // a heading or prose: this file has no frontmatter
    if (m[1] === "cwd") return m[2];
  }
  return null;
}

/**
 * Project scope for one search. Holds the normalized prefix, whether it filters
 * or only boosts, and the thread metadata used to give stage1 rows a cwd —
 * `stage1_outputs` has no cwd column, so the only accurate source is a
 * thread_id join against the Codex state db.
 */














function buildCwdScope(home        , opts                     , warnings          )                  {
  const raw = opts.cwd ?? null;
  if (raw === null || raw.trim() === "") return null;
  // Relative input resolves against the process cwd so `--cwd .` means this
  // directory; an absolute path is left alone, because resolve() rewrites its
  // separators to the host style while stored cwds keep the style of whatever
  // platform recorded them. Absoluteness is judged under both path flavors: a
  // POSIX path is still absolute when read on Windows, and vice versa.
  const absolute = posixPath.isAbsolute(raw) || win32Path.isAbsolute(raw);
  const prefix = normalizeCwd(absolute ? raw : resolve(raw));
  // The join only pays for itself when a scope is requested: loading 12,908
  // thread rows costs ~90ms against a search budget measured in tens of ms.
  const meta = loadThreadMeta(stateDbPath(home));
  if (meta.warning) warnings.push(meta.warning);
  // One git call per search: the remote of the requested directory cannot
  // change mid-query, and calling it per hit would dominate the search budget.
  const repoKey = repoKeyForCwd(prefix, opts.readOriginUrl ?? readOriginUrl);
  // Prose carries whatever separator its author typed, so both spellings count.
  const lower = prefix.toLowerCase();
  return {
    prefix,
    lowerPrefixes: [lower, lower.replace(/\//g, "\\")],
    only: opts.cwdOnly === true,
    threadCwd: meta.byId,
    repoKey,
  };
}

/**
 * How one candidate relates to the requested project.
 *
 * A structured `cwd` (summary frontmatter, or threads.cwd for a stage1 row) is
 * the strong signal. Curated files carry no cwd at all, so a chunk that names
 * the path in prose — MEMORY.md writes `applies_to: cwd=/...` — counts as a
 * weaker one at half the boost. Without that second signal `--cwd-only` would
 * discard the handbook entirely, which is where project rules actually live.
 *
 * A hit recorded under a different path but the SAME git remote is the strong
 * signal too, at the same boost: a managed worktree and the main checkout of
 * one repository are one project, not two.
 */
function scopeAdjust(
  scope                 ,
  hitCwd               ,
  lowerText        ,
  hitRepoKey                = null,
)                                   {
  if (scope === null) return { keep: true, bonus: 0 };
  const cwdHit =
    hitCwd !== null && hitCwd !== "" && cwdMatches(hitCwd, scope.prefix, { caseInsensitive: FOLD_CWD_CASE });
  if (cwdHit || repoKeysEqual(scope.repoKey, hitRepoKey)) return { keep: true, bonus: CWD_BOOST };
  const mentioned = scope.lowerPrefixes.some((p) => lowerText.includes(p));
  if (mentioned) return { keep: true, bonus: CWD_BOOST / 2 };
  return { keep: !scope.only, bonus: 0 };
}

/** Paragraph chunks with their 1-based start line, for jump-to-source output. */
export function paragraphChunks(content        )                                             {
  const chunks                                             = [];
  // CRLF-safe: Windows-authored markdown chunks cleanly.
  const lines = splitLines(content);
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

function groupHit(lowerText        , group            )          {
  return group.some((term) => termIncludes(lowerText, term));
}

/**
 * Record which groups occur anywhere in this text (independently of the other
 * groups). Drives the per-group relaxed retry: only a boundary group that is
 * absent from the WHOLE corpus is opened to substring matching.
 */
function markGroupPresence(lowerText        , groups              , present           )       {
  for (let i = 0; i < groups.length; i++) {
    if (!present[i] && groupHit(lowerText, groups[i])) present[i] = true;
  }
}

/** First group member actually present in the text (excerpt anchor), else the lead word. */
function firstPresentMember(lowerText        , groups              )                {
  for (const group of groups) {
    const term = group.find((member) => termIncludes(lowerText, member));
    if (term !== undefined) return term;
  }
  return groups[0][0];
}

function excerptAround(text        , term               , span        )         {
  const lower = text.toLowerCase();
  const at = termIndexOf(lower, term);
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
  // One clock capture per search: recency boosts must not drift mid-ranking.
  const nowMs = opts.nowMs ?? Date.now();
  const cutoffMs = days > 0 ? nowMs - days * 86_400_000 : null;
  // Original case survives to expansion: the uppercase-acronym rule is the only
  // thing separating `CI` from a two-letter fragment (query-words.ts).
  const rawAll = splitQueryWordsRaw(query);
  // Padding removal and the relaxation threshold are both wp5. The threshold is
  // judged on the ORIGINAL count so dropping `그` or `문제` cannot move it: the
  // 9-word release query still relaxes after losing its one stopword.
  const words = dropStopwords(rawAll);
  const relax = rawAll.length > MAX_WORDS;
  const groups               = (opts.synonyms ?? true)
    ? expandQueryWords(words)
    : expandQueryWords(words).map((group) => [group[0]]);
  const lowerPhrase = query.toLowerCase().replace(/\s+/g, " ").trim();
  const warnings           = [];
  let scannedFiles = 0;

  if (words.length === 0) {
    warnings.push("empty query");
    return { hits: [], warnings, scannedFiles, elapsedMs: Date.now() - started };
  }

  const root = memoriesDir(home);
  const files = listMarkdownFiles(root);
  const scope = buildCwdScope(home, opts, warnings);

  const present            = groups.map(() => false);
  const collect = (active              , tallyPresence         )              => {
    // Recompiled per pass on purpose: the relaxed retry below hands in groups
    // whose boundary flags were dropped, and a plan captured once before that
    // retry would still be matching on token boundaries.
    const plan = compileMatchPlan(active, words, anyMode, relax);
    const candidates              = [];
    const matchedThreadIds = new Set        ();
    scannedFiles = 0;
    for (const file of files) {
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
      const lowerFile = content.toLowerCase();
      if (tallyPresence) markGroupPresence(lowerFile, groups, present);
      if (!planMatches(lowerFile, plan)) continue;
      const threadId = frontmatterThreadId(content);
      if (threadId) matchedThreadIds.add(threadId);
      const relpath = relative(root, file).split(sep).join("/");
      const kind = kindOfRelpath(relpath, "file");
      // Frontmatter first, then the thread join: a summary states its own cwd,
      // and a file that only carries a thread_id still resolves through state.
      const threadMeta = threadId ? scope?.threadCwd.get(threadId) : undefined;
      const fileCwd = frontmatterCwd(content) ?? threadMeta?.cwd ?? null;
      // The remote can only come from the thread join: a summary's frontmatter
      // records cwd, never the origin URL.
      const fileRepoKey = normalizeRepoKey(threadMeta?.gitOriginUrl);
      for (const chunk of paragraphChunks(content)) {
        const lower = chunk.text.toLowerCase();
        if (!planMatches(lower, plan)) continue;
        const scoped = scopeAdjust(scope, fileCwd, lower, fileRepoKey);
        if (!scoped.keep) continue;
        candidates.push({
          origin: "file",
          kind,
          // Forward-slash relpaths on every platform (Codex memory backend parity).
          relpath,
          threadId,
          updatedAt: new Date(mtimeMs).toISOString(),
          excerpt: excerptAround(chunk.text, firstPresentMember(lower, active), 400),
          startLine: chunk.startLine,
          cwd: fileCwd,
          score: finalScore(scoreChunk(lower, active, lowerPhrase), kind, mtimeMs, nowMs) + scoped.bonus,
        });
      }
    }
    searchStage1(
      home,
      plan,
      active,
      cutoffMs,
      lowerPhrase,
      nowMs,
      candidates,
      matchedThreadIds,
      warnings,
      scope,
    );
    return candidates;
  };

  let candidates = collect(groups, true);
  // Relaxed retry (per group, 260910 wp2): a symbol query that lands nowhere on
  // token boundaries is better answered with low-confidence substring hits than
  // with nothing — `3956` written as `PR3956` has no boundary in front of the
  // digits. Only the boundary groups absent from the whole corpus are relaxed;
  // a group that does hit somewhere keeps its precision (c-4: `LSP` must not
  // start matching NaiControlsPanel because another group missed).
  if (candidates.length === 0 && hasBoundaryTerm(groups)) {
    fillStage1Presence(home, groups, present, cutoffMs, warnings);
    const miss = new Set        ();
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].some((t) => t.boundary) && !present[i]) miss.add(i);
    }
    if (miss.size > 0) {
      candidates = collect(relaxGroupsAt(groups, miss), false);
      if (candidates.length > 0) {
        for (const hit of candidates) hit.score -= RELAXED_PENALTY;
        warnings.push("no word-boundary matches — showing substring matches (lower confidence)");
      }
    }
  }
  const hits = rankAndTrim(candidates, limit);
  const backfilled = backfillFromChat(query, hits, opts, home, scope, limit, nowMs, days, warnings);
  // Only advise widening the scope when nothing at all came back; the chat
  // backfill answers within the same scope and carries its own warning.
  if (backfilled.length === 0 && scope?.only) {
    warnings.push(`no matches inside --cwd-only ${scope.prefix} — retry with --cwd to rank it first instead`);
  }
  return { hits: backfilled, warnings, scannedFiles, elapsedMs: Date.now() - started };
}

/** Chat backfill excerpt length, matching the memory excerpt window. */
const CHAT_EXCERPT = 400;

/**
 * Backfill an empty memory result from the chat corpus.
 *
 * The memory store is consolidated and therefore lags: a topic discussed an
 * hour ago has no summary yet, and the honest answer "no memories" hides a
 * conversation that does exist. Chat hits are labelled `chat/chat` and
 * announced in the warnings so a backfilled answer is never mistaken for a
 * curated one.
 *
 * Tool logs are excluded. They are the measured pollution source — command text
 * and file dumps match almost any query — and a backfill exists to surface what
 * was said, not what was executed.
 *
 * The call is skipped entirely unless the caller injected searchChat, so the
 * memory path keeps its cost when nothing needs backfilling.
 */
function backfillFromChat(
  query        ,
  hits             ,
  opts                     ,
  home        ,
  scope                 ,
  limit        ,
  nowMs        ,
  days        ,
  warnings          ,
)              {
  const chat = opts.searchChat;
  const threshold = Math.max(opts.chatFallbackBelow ?? 0, 0);
  if (chat === undefined || hits.length > threshold) return hits;
  const want = Math.min(limit, 5);
  try {
    const result = chat(query, {
      home,
      // Full history by default: a backfill that inherited chat's 7-day window
      // would go looking for old context and find only the last week of it.
      days,
      limit: want,
      // Never trigger ingest here — a refresh over the multi-GB index would
      // dwarf the entire memory search it is standing in for.
      noRefresh: true,
      includeTools: opts.chatIncludeTools === true,
      source: "main",
      context: 0,
      // Same injection point, so a hermetic memory test stays hermetic when the
      // backfill runs.
      readOriginUrl: opts.readOriginUrl,
      // A hard memory scope stays hard in the backfill; a boost does not filter.
      cwd: scope?.only ? scope.prefix : null,
    });
    const out              = result.hits.slice(0, want).map((hit) => {
      const updatedMs = Date.parse(hit.ts);
      return {
        origin: "chat",
        kind: "chat",
        relpath: hit.file,
        threadId: hit.threadId,
        updatedAt: hit.ts,
        excerpt: hit.text.slice(0, CHAT_EXCERPT),
        startLine: null,
        cwd: hit.cwd,
        score: finalScore(0, "chat", Number.isFinite(updatedMs) ? updatedMs : null, nowMs),
      };
    });
    if (out.length === 0) return hits;
    warnings.push(
      `no memory artifacts matched — ${out.length} raw session message(s) shown instead (tool logs excluded)`,
    );
    return out;
  } catch (err) {
    warnings.push(`chat fallback unavailable (${err instanceof Error ? err.message : String(err)})`);
    return hits;
  }
}

/** stage1_outputs holds per-thread raw_memory + rollout_summary; read-only, fail-soft. */
function fillStage1Presence(
  home        ,
  groups              ,
  present           ,
  cutoffMs               ,
  warnings          ,
)       {
  if (present.every(Boolean)) return;
  const dbPath = memoriesDbPath(home);
  if (!dbPath) return;
  let db                                           = null;
  try {
    db = openReadOnlyDb(dbPath);
    const rows = db
      .prepare("SELECT raw_memory, rollout_summary, source_updated_at FROM stage1_outputs")
      .all()                                  ;
    for (const r of rows) {
      const updatedSec = typeof r.source_updated_at === "number" ? r.source_updated_at : null;
      if (cutoffMs && updatedSec !== null && updatedSec * 1000 < cutoffMs) continue;
      const body = `${String(r.raw_memory ?? "")}\n${String(r.rollout_summary ?? "")}`.toLowerCase();
      markGroupPresence(body, groups, present);
      if (present.every(Boolean)) return;
    }
  } catch (err) {
    warnings.push(`memories db unreadable (${err instanceof Error ? err.message : String(err)})`);
  } finally {
    db?.close();
  }
}

/** stage1_outputs holds per-thread raw_memory + rollout_summary; read-only, fail-soft. */
function searchStage1(
  home        ,
  plan           ,
  groups              ,
  cutoffMs               ,
  lowerPhrase        ,
  nowMs        ,
  candidates             ,
  matchedThreadIds             ,
  warnings          ,
  scope                 ,
)       {
  const dbPath = memoriesDbPath(home);
  if (!dbPath) {
    warnings.push("memories db not found (stage1 search off)");
    return;
  }
  let db                                           = null;
  try {
    db = openReadOnlyDb(dbPath);
    // One bound LIKE parameter per group member (injection-safe: terms never
    // enter SQL text); OR within a group, AND/OR across groups per anyMode.
    //
    // LIKE stays substring even for boundary-gated terms: SQL has no word
    // boundary and adding one would mean shipping a custom collation. It is a
    // prefilter, and the row body is re-checked with the same `matches`
    // predicate the file path uses, so boundary semantics hold either way.
    const params           = [];
    const groupCond = (group            )         => {
      const members = group.map((w) => {
        params.push(`%${w.text}%`);
        const n = params.length;
        return `(lower(raw_memory) LIKE ?${n} OR lower(rollout_summary) LIKE ?${n})`;
      });
      return members.length > 0 ? `(${members.join(" OR ")})` : "1";
    };
    // Required groups only. The optional quota is enforced by planMatches
    // below; ANDing optional groups here is what kept the long release query at
    // zero hits, and a plan with no required group prefilters nothing at all —
    // `WHERE 1`, never an empty condition list that would be invalid SQL.
    const where = plan.anyMode
      ? allGroups(plan).map(groupCond).join(" OR ") || "1"
      : plan.required.length > 0
        ? plan.required.map(groupCond).join(" AND ")
        : "1";
    const sql = `SELECT thread_id, raw_memory, rollout_summary, source_updated_at FROM stage1_outputs
      WHERE ${where} ORDER BY source_updated_at DESC`;
    const rows = db.prepare(sql).all(...params)                                  ;
    for (const r of rows) {
      const threadId = typeof r.thread_id === "string" ? r.thread_id : null;
      if (threadId && matchedThreadIds.has(threadId)) continue; // already hit via its md file
      const updatedSec = typeof r.source_updated_at === "number" ? r.source_updated_at : null;
      if (cutoffMs && updatedSec !== null && updatedSec * 1000 < cutoffMs) continue;
      const body = `${String(r.raw_memory ?? "")}\n${String(r.rollout_summary ?? "")}`;
      const lowerBody = body.toLowerCase();
      // The LIKE prefilter above ignores boundaries and skips the optional
      // groups; the plan predicate enforces both here.
      if (!planMatches(lowerBody, plan)) continue;
      // stage1_outputs has no cwd column (schema dump, 011 4.3); threads.cwd is
      // the accurate substitute and it covered all 516 rows in the live store.
      const rowThread = threadId ? scope?.threadCwd.get(threadId) : undefined;
      const rowCwd = rowThread?.cwd ?? null;
      const scoped = scopeAdjust(scope, rowCwd, lowerBody, normalizeRepoKey(rowThread?.gitOriginUrl));
      if (!scoped.keep) continue;
      const updatedMs = updatedSec !== null ? updatedSec * 1000 : null;
      candidates.push({
        origin: "stage1",
        kind: "stage1",
        relpath: `stage1_outputs/${threadId ?? "unknown"}`,
        threadId,
        updatedAt: updatedMs !== null ? new Date(updatedMs).toISOString() : null,
        excerpt: excerptAround(body, firstPresentMember(lowerBody, groups), 400),
        startLine: null,
        cwd: rowCwd,
        score: finalScore(scoreChunk(lowerBody, groups, lowerPhrase), "stage1", updatedMs, nowMs) + scoped.bonus,
      });
    }
  } catch (err) {
    warnings.push(`memories db unreadable (${err instanceof Error ? err.message : String(err)})`);
  } finally {
    db?.close();
  }
}
