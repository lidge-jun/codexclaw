# 020 — wp3 / L2: memory search semantics (#142, #143)

Date: 2026-09-11 (KST). Worktree HEAD `6aae1c97` (branch `codex/memory-recall-roadmap`). This is the copy-paste-executable PRD for layer L2. Do not patch production code from this document until it is rebased onto L1 (`codex/fix-recall-cwd-normalization`); re-verify every path:line at that tip before applying (DIFFLEVEL-ROADMAP-01 stale check).

Issues: #142 (cross-blank-line AND dropped to zero hits; `matchedThreadIds` recorded before any hit was kept), #143 (chat fallback drops `synonyms` / `any`).
Roadmap: [000_plan.md](000_plan.md) wp3 / c-3 / c-4. Branch: `codex/fix-memory-search-semantics`, base L1.

Line numbers below were read with a 1-based counter against this checkout, not copied from the 0.2.24 issue bodies. Issue citations that still match are marked KEEP; the one that does not is in section 3.

## 1. Purpose and scope

### IN

A markdown memory file that satisfies AND at file level must still produce a hit when the query tokens live in different blank-separated paragraphs. `matchedThreadIds` may record a thread only after this file actually kept a hit. The chat backfill must forward memory's synonym default (on) and the caller's `any` flag, because chat's own default for synonyms is off.

### OUT

- `paragraphChunks` contract and start-line numbering for paragraphs that already match. Existing test `paragraphChunks: tracks 1-based start lines across blank separators` (memory-search.test.ts:27) must stay green.
- `chat-search.ts` defaults. Explicit `cxc chat search` keeps `synonyms` off (chat-search.ts:8, :64, :158). This layer only forwards flags on the memory to chat hop.
- `cli.ts`. CLI already passes `any` and `synonyms` into `searchMemory` (cli.ts:151-152). L3 owns CLI flag hygiene (#139, #140).
- `normalizeCwd`, `FOLD_CWD_CASE`, index SQL, `query-words.ts`, the synonym table, `hook.ts`, provider-bridge, session-binding, config-guard, source-identity, session-source.

### Chosen shape

Issue 142 allows either a file-span hit or an adjacent-paragraph merge retry. This layer implements a file-span fallback: if the file passed `planMatches(lowerFile, plan)` and no paragraph passed `planMatches`, emit one file-origin hit scored on the whole file. Adjacent merge is rejected because tokens in paragraph 1 and paragraph 3 (non-adjacent) would still drop, and changing `paragraphChunks` would move start lines for files that already match.

## 2. Current code (this checkout)

### 2.1 Blank-line chunking — KEEP issue 142 L371-373

memory-search.ts:362-383

```ts
export function paragraphChunks(content: string): Array<{ text: string; startLine: number }> {
  const chunks: Array<{ text: string; startLine: number }> = [];
  // CRLF-safe: Windows-authored markdown chunks cleanly.
  const lines = splitLines(content);
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
```

A single blank line is a hard chunk boundary. `# Memory Handbook\n\nNo groups consolidated yet.` becomes two chunks. Do not change this function.

### 2.2 File-level AND, then immediate thread recording — KEEP issue 142 L473-475

memory-search.ts:471-502

```ts
      const lowerFile = content.toLowerCase();
      if (tallyPresence) markGroupPresence(lowerFile, groups, present);
      if (!planMatches(lowerFile, plan)) continue;
      const threadId = frontmatterThreadId(content);
      if (threadId) matchedThreadIds.add(threadId);
      const relpath = relative(root, file).split(sep).join("/");
      const kind = kindOfRelpath(relpath, "file");
      const threadMeta = threadId ? scope?.threadCwd.get(threadId) : undefined;
      const fileCwd = frontmatterCwd(content) ?? threadMeta?.cwd ?? null;
      const fileRepoKey = normalizeRepoKey(threadMeta?.gitOriginUrl);
      for (const chunk of paragraphChunks(content)) {
        const lower = chunk.text.toLowerCase();
        if (!planMatches(lower, plan)) continue;
        const scoped = scopeAdjust(scope, fileCwd, lower, fileRepoKey);
        if (!scoped.keep) continue;
        candidates.push({
          origin: "file",
          kind,
          relpath,
          threadId,
          updatedAt: new Date(mtimeMs).toISOString(),
          excerpt: excerptAround(chunk.text, firstPresentMember(lower, active), 400),
          startLine: chunk.startLine,
          cwd: fileCwd,
          score: finalScore(scoreChunk(lower, active, lowerPhrase), kind, mtimeMs, nowMs) + scoped.bonus,
        });
      }
```

`planMatches` is AND across groups unless `anyMode` (query-words.ts:289-294). File AND can pass while every paragraph fails. `thread_id` is recorded on file AND success, before any `candidates.push`.

### 2.3 Paragraph AND — KEEP issue 142 L487-488

Same block, lines 485-487: each chunk is a fresh AND. That is the drop for `Handbook` + `consolidated` split by a blank line.

### 2.4 Stage1 skip is not the chat fallback — KEEP issue 142 L710 as code, CORRECT the issue's label

memory-search.ts:708-710

```ts
    for (const r of rows) {
      const threadId = typeof r.thread_id === "string" ? r.thread_id : null;
      if (threadId && matchedThreadIds.has(threadId)) continue; // already hit via its md file
```

This is `searchStage1`, not `backfillFromChat`. The comment claims a kept markdown hit that may not exist. Chat backfill never reads `matchedThreadIds` (memory-search.ts:569-625).

### 2.5 Chat fallback omits synonyms/any — KEEP issue 143 L585-601 (object ends at :601)

memory-search.ts:585-602

```ts
    const result = chat(query, {
      home,
      days,
      limit: want,
      noRefresh: true,
      includeTools: opts.chatIncludeTools === true,
      source: "main",
      context: 0,
      readOriginUrl: opts.readOriginUrl,
      cwd: scope?.only ? scope.prefix : null,
    });
```

Receiver (chat-search.ts:54-64, :156-158):

```ts
  any?: boolean;
  synonyms?: boolean;  // default OFF for explicit chat search
  // ...
  const anyMode = opts.any ?? false;
  const plan = chatMatchPlan(query, anyMode, opts.synonyms === true);
```

Memory's own default is the opposite (memory-search.ts:54-55, :434-436): `(opts.synonyms ?? true)`. Synonym group `memory / memories / 메모리 / 기억` is synonyms.ts:43.

`ChatSearchOptions` already has `synonyms` and `any`. Do not invent a new API and do not change `searchChat`.

### 2.6 Helpers that already exist (reuse, do not duplicate)

- `planMatches` — query-words.ts:289 — file AND and paragraph AND
- `frontmatterThreadId` — memory-search.ts:260-263 — `^thread_id:\s*(\S+)` in first 2000 chars
- `scopeAdjust` — memory-search.ts:347-360 — keep/bonus. L1 does not touch `memory-search.ts`; L2 is this file's first writer and calls `scopeAdjust` as it sits here
- `excerptAround` / `firstPresentMember` / `scoreChunk` / `finalScore` — memory-search.ts:400-415, :201-218, :192-194 — file-span hit fields
- `splitLines` — text-lines.ts:16-18 — CRLF-safe line walk for startLine
- `groupHit` — memory-search.ts:385-387 — first matching line
- `PER_FILE_CAP` — memory-search.ts:110, rankAndTrim :221-235 — cap 2; a single file-span hit is inside the cap
- `searchChat` injection — MemorySearchOptions.searchChat :72 — no runtime import of chat-search.ts

No helper exists today that turns a failed paragraph pass into a file-span hit, and none that delays `matchedThreadIds`. Create both locally in `memory-search.ts`.

## 3. Contradictions vs the issue bodies

1. Issue 142 L371-373, L473-475, L487-488, L710, issue 143 L585-601 and chat-search.ts L158 all still sit at those lines on `6aae1c97`. The blank-line `if` is :371; `chunks.push` is :373; the object in issue 143 continues through `cwd` at :601.
2. Issue 142 labels L710 as chat fallback. It is `searchStage1`. Chat backfill is `backfillFromChat` and does not consult `matchedThreadIds`. The empty chat result in the `Handbook consolidated` repro is a missing memory hit plus a chat corpus that does not contain those two words, not a `matchedThreadIds` skip.
3. Issue 142's MEMORY.md repro has no `thread_id`. File-span fallback is what restores that hit. Delaying `matchedThreadIds` restores stage1 for a different case: file AND passed, no file hit kept (scope drop), same thread still in stage1.
4. L1 (wp2 / #138) does not touch `memory-search.ts`. `scopeAdjust` stays at :347-360 and `cwdMatches` at :354-356 on this checkout. L2 writes `memory-search.ts` first; L3 writes it after. Do not hedge on an L1 rewrite of `scopeAdjust`, and do not restore a different `scopeAdjust` body.

## 4. Changes

Production: MODIFY `plugins/codexclaw/components/recall/src/memory-search.ts` only.
Generated: MODIFY `plugins/codexclaw/components/recall/dist/memory-search.js` by `npm run build`, then `git add -f` that path (`.gitignore:2` ignores `dist/`; the component dist is tracked).
Tests: MODIFY the two test files in section 5.
`chat-search.ts`: no edit.

### 4.1 NEW private helper, immediately after `paragraphChunks` (after :383)

NEW (no current code). Place it next to `groupHit` so start-line numbering shares `splitLines` with chunking.

```ts
/** 1-based line of the first query-group hit in the file; 1 if none (should not happen after file AND). */
function firstMatchStartLine(content: string, groups: QueryGroup[]): number {
  const lines = splitLines(content);
  for (let i = 0; i < lines.length; i++) {
    if (groups.some((g) => groupHit(lines[i].toLowerCase(), g))) return i + 1;
  }
  return 1;
}
```

Do not export it. Tests go through `searchMemory`.

### 4.2 MODIFY collect() file loop — delay `matchedThreadIds`, add file-span fallback

File: `plugins/codexclaw/components/recall/src/memory-search.ts`
Op: MODIFY
Anchor: the block starting at :471 (file AND + thread add + paragraph loop), inside `collect`.

BEFORE (current :471-502):

```ts
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
```

AFTER:

```ts
      const lowerFile = content.toLowerCase();
      if (tallyPresence) markGroupPresence(lowerFile, groups, present);
      if (!planMatches(lowerFile, plan)) continue;
      const threadId = frontmatterThreadId(content);
      const relpath = relative(root, file).split(sep).join("/");
      const kind = kindOfRelpath(relpath, "file");
      // Frontmatter first, then the thread join: a summary states its own cwd,
      // and a file that only carries a thread_id still resolves through state.
      const threadMeta = threadId ? scope?.threadCwd.get(threadId) : undefined;
      const fileCwd = frontmatterCwd(content) ?? threadMeta?.cwd ?? null;
      // The remote can only come from the thread join: a summary's frontmatter
      // records cwd, never the origin URL.
      const fileRepoKey = normalizeRepoKey(threadMeta?.gitOriginUrl);
      const keptBefore = candidates.length;
      let paragraphMatches = 0;
      for (const chunk of paragraphChunks(content)) {
        const lower = chunk.text.toLowerCase();
        if (!planMatches(lower, plan)) continue;
        paragraphMatches += 1;
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
      // File AND passed, every blank-separated paragraph failed AND: keep one
      // file-span hit so split tokens still surface. Do not merge paragraphs
      // and do not run this when a paragraph matched but cwd-only dropped it.
      if (paragraphMatches === 0) {
        const scoped = scopeAdjust(scope, fileCwd, lowerFile, fileRepoKey);
        if (scoped.keep) {
          candidates.push({
            origin: "file",
            kind,
            relpath,
            threadId,
            updatedAt: new Date(mtimeMs).toISOString(),
            // excerptAround (memory-search.ts:409-414) slices the original
            // string, so pass LF-normalized text: a CRLF file would otherwise
            // keep \r and fail Test A's no-\r assertion (same invariant as
            // memory-search.test.ts:60). Paragraph chunks already join with
            // "\n" via splitLines(...).join("\n") in paragraphChunks.
            excerpt: excerptAround(splitLines(content).join("\n"), firstPresentMember(lowerFile, active), 400),
            startLine: firstMatchStartLine(content, active),
            cwd: fileCwd,
            score: finalScore(scoreChunk(lowerFile, active, lowerPhrase), kind, mtimeMs, nowMs) + scoped.bonus,
          });
        }
      }
      // Record the thread only if this file actually kept a hit (paragraph or
      // file-span). Recording on file AND was lying to stage1.
      if (threadId && candidates.length > keptBefore) matchedThreadIds.add(threadId);
```

Rules the implementer must not weaken:

- Do not add `threadId` at file AND time.
- File-span runs only when `paragraphMatches === 0`, not when paragraphs matched and `scopeAdjust` dropped them. cwd-only path-mention stays per-chunk for files that already have a matching paragraph.
- File-span still goes through `scopeAdjust` on `lowerFile`. Out-of-scope files stay out.
- File-span excerpt is taken from `splitLines(content).join("\n")`, not raw `content`. Keep Test A's excerpt-without-`\r` assertion; do not relax it.
- `matchedThreadIds.add` is `candidates.length > keptBefore` (kept hits, after scope), so a scoped-out file does not suppress stage1.
- No new warning on a successful file-span hit. Issue 142's complaint is a silent empty result; a successful hit needs no apology.
- `collect` is also the relaxed-retry body (:533). File-span and delayed thread ids apply there automatically. Do not special-case the retry.

### 4.3 MODIFY stage1 skip comment

File: `plugins/codexclaw/components/recall/src/memory-search.ts`
Op: MODIFY
Anchor: :710

BEFORE:

```ts
      if (threadId && matchedThreadIds.has(threadId)) continue; // already hit via its md file
```

AFTER:

```ts
      if (threadId && matchedThreadIds.has(threadId)) continue; // already kept a file hit for this thread
```

No other change in `searchStage1`.

### 4.4 MODIFY `backfillFromChat` options

File: `plugins/codexclaw/components/recall/src/memory-search.ts`
Op: MODIFY
Anchor: the `chat(query, { ... })` object at :585-602

BEFORE:

```ts
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
```

AFTER:

```ts
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
      // Memory defaults synonyms on; chat defaults them off. Dropping the flag
      // here re-zeroes a Korean query the memory path just failed to answer.
      synonyms: opts.synonyms ?? true,
      any: opts.any === true,
    });
```

Do not pass `nowMs`, `scan`, `order`, or `includeTools` beyond what is already there. Do not change `backfillFromChat`'s trigger (`hits.length > threshold`).

## 5. Tests

Runner: `plugins/codexclaw/scripts/test.mjs` then `node --test` on `*.test.ts`. Style: `import test from "node:test"`, `assert` from `node:assert/strict`, isolated `mkdtempSync` homes (do not mutate the shared `buildCodexHome` used by memory-search.test.ts:18-21 — ranking tests freeze those mtimes).

### 5.1 MODIFY `plugins/codexclaw/components/recall/test/memory-search.test.ts`

Add `mkdirSync`, `writeFileSync` from `node:fs` and `DatabaseSync` from `node:sqlite` to the existing imports. Append the three tests below after the current last test (`cli main: routes chat/memory search, rejects empty query, prints usage otherwise`, memory-search.test.ts:93-115). The append point is after line 115, not after the `test(` opener at :93. Do not change the shared `home` fixture tests.

#### Test A

- Name: `file-level AND still hits when tokens sit on opposite sides of a blank line`
- Input: isolated home; `memories/MEMORY.md` contents exactly:

```
# Memory Handbook

No groups consolidated yet.
```

  Call `searchMemory("Handbook consolidated", { home })`. Also call the same query against a CRLF twin `memories/windows-span.md` written as `"# Memory Handbook\r\n\r\nNo groups consolidated yet.\r\n"` in the same home (or a second home — either is fine as long as both encodings are asserted).
- Expected:
  - `r.hits.length >= 1`
  - a hit with `origin === "file"`, `relpath === "MEMORY.md"`
  - `startLine === 1` (line of Handbook)
  - excerpt matches `/Handbook/` or `/consolidated/`
  - warnings does not need a new string; it must not be used as a substitute for a hit
  - CRLF file also yields `origin === "file"` and excerpt without `\r` (same invariant as memory-search.test.ts:60)
  - control: `searchMemory("Handbook", { home })` still hits; `searchMemory("Handbook missingtokenxyz", { home })` is 0 (file AND still required)
- Why it fails today: file AND passes (memory-search.ts:473), both paragraphs fail AND (:487), `candidates` stays empty. This is issue 142's `hits: []` with no warning.

#### Test B

- Name: `same-paragraph AND still uses the paragraph start line`
- Input: isolated home; `memories/MEMORY.md` = `"# Title\n\n## Task 1: ship the trigram sidecar index\n"`. `searchMemory("trigram sidecar", { home })`.
- Expected: one file hit, `startLine === 3` (not 1). Proves file-span does not fire when a paragraph already matches, so memory-search.test.ts:39-44 (`startLine > 1` on the shared fixture) stays meaningful.
- Why it fails today: it does not fail today. It is a lock so section 4.2 cannot be implemented by stopping blank-line splits.

#### Test C

- Name: `matchedThreadIds records a thread only after a file hit is kept`
- Input: isolated home modelled on cwd-scope.test.ts:39-76:
  - `memories/rollout_summaries/other.md`:

```
thread_id: 019f3333-0000-7000-8000-00000000aaaa
cwd: /proj/other

# Memory Handbook

No groups consolidated yet.
```

  - `state_1.sqlite` threads row for that id with `cwd = /proj/here` (frontmatter cwd wins for the file; the join cwd wins for stage1 — same split as cwd-scope.test.ts:36-37).
  - `memories_1.sqlite` `stage1_outputs` row for the same thread_id, `raw_memory = "Handbook consolidated in the scoped project"`, `rollout_summary = "span"`.
  - `searchMemory("Handbook consolidated", { home, cwd: "/proj/here", cwdOnly: true, readOriginUrl: () => null })`.
- Expected:
  - `hits.length === 1`
  - `hits[0].origin === "stage1"`
  - `hits[0].threadId === "019f3333-0000-7000-8000-00000000aaaa"`
  - no file hit for `rollout_summaries/other.md`
  - control without `cwdOnly`: a file hit is kept (file-span) and stage1 for that thread is absent (dedupe still works when a hit was kept). This is the same contract as memory-search.test.ts:47-50 (md-covered thread must not duplicate via stage1).
- Why it fails today: file AND records the thread at :474-475, every paragraph fails AND, cwd-only drops a file-span that does not exist yet, stage1 skips at :710. Result: `hits: []`. After section 4.2 without the delayed add, file-span is also dropped by cwd-only (`fileCwd === /proj/other`) and stage1 would still skip if the add stayed on file AND. Both halves of section 4.2 are required for this test.

### 5.2 MODIFY `plugins/codexclaw/components/recall/test/chat-fallback.test.ts`

Append after `the fallback excludes tool logs and never triggers an ingest` (:81) or at the end of the file. Reuse `emptyHome` and `stubChat`.

#### Test D

- Name: `the chat fallback forwards synonyms and any`
- Input: `emptyHome("recall-fallback-syn-")` (no markdown, so backfill always fires). Three `searchMemory` calls with `searchChat: stub`:
  1. `searchMemory("기억", { home, searchChat: def.fn })`
  2. `searchMemory("기억", { home, searchChat: orMode.fn, any: true })`
  3. `searchMemory("기억", { home, searchChat: raw.fn, synonyms: false })`
- Expected:
  1. `def.calls[0].synonyms === true` and `def.calls[0].any === false` (memory default on; `any` default off)
  2. `orMode.calls[0].any === true` and `orMode.calls[0].synonyms === true`
  3. `raw.calls[0].synonyms === false` and `raw.calls[0].any === false`
  - Existing assertions in :81-98 stay: `includeTools === false`, `noRefresh === true`, `days === 0`.
- Why it fails today: the options object at :585-601 does not mention `synonyms` or `any`, so both are `undefined`. `assert.equal(calls[0].synonyms, true)` throws. This is the gap issue 143 names: `chat-fallback.test.ts` pins `days`/`tools`/`cwd` and never `synonyms`.

Do not add a live-engine Korean test in this layer. The stub is the contract issue 143 asked for; a 12GB-index behavioral test is out of scope.

### 5.3 Tests that must remain green (do not edit)

- memory-search.test.ts:27 `paragraphChunks: tracks 1-based start lines across blank separators` — chunker unchanged
- memory-search.test.ts:47 `memory search reaches stage1_outputs and dedupes md-covered threads` — kept file hit still suppresses stage1
- memory-search.test.ts:63 `memory search supports korean and AND semantics` — file AND still required
- chat-fallback.test.ts:81 `the fallback excludes tool logs and never triggers an ingest` — extra keys must not break existing option asserts
- chat-fallback.test.ts:101 `a memory result that already answered is left alone` — a real paragraph hit still disables backfill

## 6. Verification

From repo root `C:\Users\super\.codex\worktrees\b74b\codexclaw`. PowerShell: check native status with `$LASTEXITCODE`, not `$?`. Do not use `&&`.

Red on L1 tip, before the patch (expected failures):

```powershell
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/recall/test/memory-search.test.ts plugins/codexclaw/components/recall/test/chat-fallback.test.ts
```

Proof the layer is needed: Test A reports `hits.length >= 1` failed (actual 0); Test C reports `origin === "stage1"` failed (actual 0 hits); Test D reports `synonyms` expected `true` got `undefined`.

Green at this layer's tip:

```powershell
npm run build
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/recall/test/memory-search.test.ts plugins/codexclaw/components/recall/test/chat-fallback.test.ts
npm test
```

Layer is proven when:

1. `npm run build` exits 0 and `plugins/codexclaw/components/recall/dist/memory-search.js` contains `synonyms: opts.synonyms ?? true` (or the compiled equivalent) and no `matchedThreadIds.add(threadId)` immediately after `frontmatterThreadId`.
2. Focused test run exits 0 and prints the four new names (A-D) as pass.
3. `npm test` exits 0 with those names visible; the five tests in section 5.3 still pass.
4. Red-green: A/C/D failed on the parent tip and pass here. A layer whose new tests never ran red is not proven (000_plan.md verification contract).

## 7. What this layer must not touch

- `plugins/codexclaw/components/recall/src/chat-search.ts` (read-only evidence).
- `plugins/codexclaw/components/recall/src/cli.ts` (L3 / #139 #140).
- `plugins/codexclaw/components/recall/src/query-words.ts`, `synonyms.ts`, `hook.ts`, `index-search.ts`, `rollout.ts`, `cwd-context.ts`.
- The exported `paragraphChunks` behavior.
- `provider-bridge/`, `session-binding.ts`, `config-guard/`, `source-identity.ts`, `session-source.ts` (peer session 01a08fba).
- GitHub native stacks, merge, push (unless the parent later asks), `dev` recreation.

## 8. Layer interactions

Below — L1 / wp2 / #138 (`codex/fix-recall-cwd-normalization`): owns `normalizeCwd` extended-length/UNC strip and `FOLD_CWD_CASE` including `win32`. L1 does not touch `memory-search.ts`. This layer bases on L1. Test C uses `cwdOnly`; it must be run on L1's normalized cwd, not against a restored HEAD `normalizeCwd`.

This layer — L2 / wp3 / #142 #143: first writer of `memory-search.ts`. Owns the collect() thread set, the file-span fallback, and the backfill option bag. Closes #142 and #143.

Above — L3 / wp4 / #139 #140 (`codex/fix-recall-cli-arg-hygiene`): writes `memory-search.ts` after L2, plus `cli.ts`. Rebase onto this tip so L3's `memory-search.ts` edits land after L2's, not against a parallel rewrite. Does not need this layer's private helpers.

Above — L4 / wp5 / #144: `cli.ts` `--status` plus `hook.ts` banner. No overlap with section 4 if this layer stays out of those files.

wp8: publishes this branch as PR base L1, title `fix(recall): keep cross-paragraph AND hits and forward synonyms to the chat fallback (#142, #143)`, `Closes #142` and `Closes #143` only on this PR.
