# 040 — WP5 / L4: chat index freshness (#144)

Layer: `codex/fix-chat-index-freshness` based on L3 `codex/fix-recall-cli-arg-hygiene`.
Issue: #144. Criterion: `c-7` in [000_plan.md](000_plan.md).
Checkout verified at `6aae1c97` (`codex/memory-recall-roadmap`).

## Thesis

`--status` and the SessionStart banner must compare the sidecar index to the source JSONL **read-only**, counting source files that are missing from the index **and** source files whose `(mtime_ms, size)` no longer match the `files` row. `last_ingest_at` may advance only when ingest actually changed rows (`ingested + appended + pruned > 0`). SessionStart search stays `noRefresh: true`; it reports staleness instead of ingesting.

## Current behavior (this tree)

Issue body paths are `components/recall/src/...`. Real paths are under `plugins/codexclaw/`. Line numbers cited in #144 still match this checkout; the fuller spans below are what the implementer edits.

`indexStatus` counts index rows only. It never lists source JSONL and never stats:

`plugins/codexclaw/components/recall/src/index-db.ts:163-168` and `:207-213`:

```ts
export type IndexStatus = {
  path: string;
  files: number;
  msgs: number;
  lastIngestAt: string | null;
};

export function indexStatus(db: RwDb, path: string): IndexStatus {
  const files = (db.prepare("SELECT COUNT(*) AS n FROM files").get() as { n: number }).n;
  const msgs = (db.prepare("SELECT COUNT(*) AS n FROM msgs").get() as { n: number }).n;
  const last = db.prepare("SELECT value FROM meta WHERE key = 'last_ingest_at'").get() as
    | { value: string }
    | undefined;
  return { path, files, msgs, lastIngestAt: last?.value ?? null };
}
```

`--status` prints that object. `indexStatusLine` (the SessionStart banner payload) is the same counts. #144's `cli.ts` L213 citation is this return:

`plugins/codexclaw/components/recall/src/cli.ts:169-196` and `:206-220` and `:231-235`:

```ts
      const status = indexStatus(db, path);
      process.stdout.write(
        values.json === true
          ? `${JSON.stringify(status, null, 2)}\n`
          : `index: ${status.path}\nfiles: ${status.files}, messages: ${status.msgs}, last ingest: ${status.lastIngestAt ?? "never"}\n`,
      );

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

      out = handleSessionStart(indexStatusLine(), payload.cwd ?? process.cwd(), payload.source);
```

Search metadata uses **count difference**, so a grown file with an unchanged path count is never stale:

`plugins/codexclaw/components/recall/src/chat-search.ts:117-124` and `:251-260`:

```ts
  index?: {
    lastIngestAt: string | null;
    files: number;
    sourceFiles: number;
    staleFiles: number;
    readOnly: boolean;
  };

    const status = indexStatus(db, path);
    const sourceFiles = listRolloutFiles(shared.home, 0).length;
    result.index = {
      lastIngestAt: status.lastIngestAt,
      files: status.files,
      sourceFiles,
      staleFiles: Math.max(0, sourceFiles - status.files),
      readOnly,
    };
```

Ingest already knows the right fingerprint (`ingest.ts:114-116`) but always stamps `last_ingest_at` even on a no-op (`ingest.ts:193-195`):

```ts
    const prev = known.get(file.path);
    const mtimeMs = Math.floor(st.mtimeMs);
    if (prev && prev.mtime_ms === mtimeMs && prev.size === st.size) continue;

  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_ingest_at', ?)").run(
    new Date().toISOString(),
  );
```

SessionStart CWD search does not refresh. #144's `hook.ts` L501-505 citation still matches. The banner interpolates the status string at `hook.ts:633`:

`plugins/codexclaw/components/recall/src/hook.ts:501-505` and `:632-634`:

```ts
    const localChat = deps.searchChat(cwdName, {
      cwd,
      days: 7,
      limit: 8,
      noRefresh: true,
      source: "main",

  rows.push(recoveryLine(cxc, dedicatedTools));
  if (status !== "") rows.push(`Index: ${status}. Details: $cxc-recall.`);
  else rows.push("Details: $cxc-recall.");
```

`listRolloutFiles` (`rollout.ts:127-170`) returns `{ path, date }` only. It does not stat. Freshness must stat, using the same `Math.floor(mtimeMs)` as ingest. `IndexFreshness` / `measureIndexFreshness` do not exist.

## Contradictions vs #144

- Path prefix: issue says `components/recall/src/...`; checkout uses `plugins/codexclaw/components/recall/src/...`.
- Line numbers cited in the issue body (index-db 207-213, cli 213, hook 501-505, chat-search 258, ingest 193-195) are still correct on this tree. Do not copy the issue's abbreviated snippets as the whole function; use the spans above.
- The banner is assembled in two places: `cli.ts:213` builds the string, `hook.ts:633` prefixes `Index: `. Changing only hook.ts cannot see source JSONL.
- `hook.ts:505` `noRefresh: true` is evidence, not a defect to flip. SessionStart must keep skipping ingest.

## Helper to create

`measureIndexFreshness` does not exist. Create it in `ingest.ts` (that file already owns the fingerprint and already imports `listRolloutFiles`). Do **not** put it in `index-db.ts`: that module has no rollout/stat dependency (`index-db.ts:13-16`) and must stay sqlite-only.

Do not invent a second public search shape. `ChatSearchResult.index` already has `sourceFiles` and `staleFiles` (`chat-search.ts:118-124`); this layer changes how `staleFiles` is computed and adds the same numbers to `--status` / the banner.

## Change 1 — MODIFY `plugins/codexclaw/components/recall/src/ingest.ts`

### 1a. Export the freshness snapshot (NEW exports, same file)

Insert after `IngestResult` (`ingest.ts:27-34`). `KnownFile` at line 36 stays private and keeps `bytes_ingested` / `last_ord` for the write path.

After (add):

```ts
export type IndexFreshness = {
  /** `listRolloutFiles(home, 0)` entries that `statSync` could read. */
  sourceFiles: number;
  /** rows in `files`. */
  indexedFiles: number;
  /** on disk, no `files` row. */
  missingFiles: number;
  /** on disk and in `files`, but `(mtime_ms, size)` differs. */
  changedFiles: number;
  /** in `files`, not on disk. */
  extraFiles: number;
  /** `missingFiles + changedFiles + extraFiles` — what a `days=0` ingest would touch. */
  staleFiles: number;
};

function fingerprintMatches(prev: { mtime_ms: number; size: number }, st: { mtimeMs: number; size: number }): boolean {
  return prev.mtime_ms === Math.floor(st.mtimeMs) && prev.size === st.size;
}

/**
 * Read-only comparison of the `files` table against source JSONL.
 * Stats only; never parses JSONL, never writes, never bumps `last_ingest_at`.
 * Unreadable sources are skipped the same way ingest skips them (`ingest.ts:109-112`).
 */
export function measureIndexFreshness(home: string, db: RwDb, days = 0): IndexFreshness {
  const onDisk = listRolloutFiles(home, days);
  const known = new Map<string, { mtime_ms: number; size: number }>();
  for (const row of db
    .prepare("SELECT path, mtime_ms, size FROM files")
    .all() as Array<Record<string, unknown>>) {
    known.set(String(row.path), { mtime_ms: Number(row.mtime_ms), size: Number(row.size) });
  }
  let sourceFiles = 0;
  let missingFiles = 0;
  let changedFiles = 0;
  const seen = new Set<string>();
  for (const file of onDisk) {
    // Match ingest.ts:106-112: mark seen before stat so an unreadable source
    // is not treated as extra/prunable.
    seen.add(file.path);
    let st: { mtimeMs: number; size: number };
    try {
      st = statSync(file.path);
    } catch {
      continue;
    }
    sourceFiles += 1;
    const prev = known.get(file.path);
    if (!prev) missingFiles += 1;
    else if (!fingerprintMatches(prev, st)) changedFiles += 1;
  }
  let extraFiles = 0;
  if (days === 0) {
    for (const path of known.keys()) {
      if (!seen.has(path)) extraFiles += 1;
    }
  }
  return {
    sourceFiles,
    indexedFiles: known.size,
    missingFiles,
    changedFiles,
    extraFiles,
    staleFiles: missingFiles + changedFiles + extraFiles,
  };
}
```

`days !== 0` must not count extras (same rule as prune at `ingest.ts:175-176`). `--status`, the banner, and search metadata always pass `days = 0`.

### 1b. Use the same fingerprint in the ingest skip

Before (`ingest.ts:114-116`):

```ts
    const prev = known.get(file.path);
    const mtimeMs = Math.floor(st.mtimeMs);
    if (prev && prev.mtime_ms === mtimeMs && prev.size === st.size) continue;
```

After:

```ts
    const prev = known.get(file.path);
    const mtimeMs = Math.floor(st.mtimeMs);
    if (prev && fingerprintMatches(prev, st)) continue;
```

Keep `mtimeMs` for the INSERT below (`ingest.ts:135`, `:156`).

### 1c. Stamp `last_ingest_at` only when rows changed

Before (`ingest.ts:193-195`):

```ts
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_ingest_at', ?)").run(
    new Date().toISOString(),
  );
```

After:

```ts
  if (result.ingested + result.appended + result.pruned > 0) {
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_ingest_at', ?)").run(
      new Date().toISOString(),
    );
  }
```

`backfillRepoKeysFromThreads` (`ingest.ts:213-249`) is **not** a last_ingest_at trigger. It rewrites `files.repo_key` without re-parsing JSONL. A backfill-only pass stays `ingested + appended + pruned === 0` and must leave the stamp alone. That matches the existing wp4 migration test (`test/index.test.ts:356-357`).

## Change 2 — MODIFY `plugins/codexclaw/components/recall/src/chat-search.ts`

Import `measureIndexFreshness` next to `ingest` (`chat-search.ts:29`).

Before (`chat-search.ts:29`):

```ts
import { ingest } from "./ingest.ts";
```

After:

```ts
import { ingest, measureIndexFreshness } from "./ingest.ts";
```

Before (`chat-search.ts:251-260`):

```ts
    const status = indexStatus(db, path);
    const sourceFiles = listRolloutFiles(shared.home, 0).length;
    result.index = {
      lastIngestAt: status.lastIngestAt,
      files: status.files,
      sourceFiles,
      staleFiles: Math.max(0, sourceFiles - status.files),
      readOnly,
    };
```

After:

```ts
    const status = indexStatus(db, path);
    const fresh = measureIndexFreshness(shared.home, db, 0);
    result.index = {
      lastIngestAt: status.lastIngestAt,
      files: status.files,
      sourceFiles: fresh.sourceFiles,
      staleFiles: fresh.staleFiles,
      readOnly,
    };
```

Do not add `missingFiles` / `changedFiles` / `extraFiles` onto `ChatSearchResult.index`. That object is the existing public search contract; only the meaning of `staleFiles` changes.

`listRolloutFiles` stays imported: the scan path still uses it (`chat-search.ts:308`).

## Change 3 — MODIFY `plugins/codexclaw/components/recall/src/cli.ts`

Import the helper. `codexHome` is already imported (`cli.ts:17`).

Before (`cli.ts:16`):

```ts
import { ingest } from "./ingest.ts";
```

After:

```ts
import { ingest, measureIndexFreshness, type IndexFreshness } from "./ingest.ts";
```

`IndexStatus` stays sqlite-only. Compose at the CLI:

```ts
function statusReport(db: ReturnType<typeof openIndexReadOnly>, path: string, home: string) {
  const status = indexStatus(db, path);
  const fresh: IndexFreshness = measureIndexFreshness(home, db, 0);
  return { ...status, sourceFiles: fresh.sourceFiles, staleFiles: fresh.staleFiles, missingFiles: fresh.missingFiles, changedFiles: fresh.changedFiles, extraFiles: fresh.extraFiles };
}

function formatStatusText(report: ReturnType<typeof statusReport>): string {
  return `index: ${report.path}\nfiles: ${report.files}, messages: ${report.msgs}, source files: ${report.sourceFiles}, stale: ${report.staleFiles}, last ingest: ${report.lastIngestAt ?? "never"}\n`;
}
```

Put those two locals above `runChatIndex`. They are CLI-private; tests go through `--status` and the exported banner helper.

### 3a. `runChatIndex` --status output

Keep the read-only open (`cli.ts:174-177`). L3 (wp4) will short-circuit `--help` before this function does work; do not revert that when rebasing. `statusOnly` must still skip `ingest`.

Before (`cli.ts:190-195`):

```ts
      const status = indexStatus(db, path);
      process.stdout.write(
        values.json === true
          ? `${JSON.stringify(status, null, 2)}\n`
          : `index: ${status.path}\nfiles: ${status.files}, messages: ${status.msgs}, last ingest: ${status.lastIngestAt ?? "never"}\n`,
      );
```

After:

```ts
      const report = statusReport(db, path, home);
      process.stdout.write(
        values.json === true ? `${JSON.stringify(report, null, 2)}\n` : formatStatusText(report),
      );
```

Existing text matcher `/files: \d+, messages: \d+/` (`test/index.test.ts:224`) still holds.

### 3b. Export the banner line so tests can hit production formatting

`indexStatusLine` is currently private and takes no home. Export it, pass the Codex home used for JSONL discovery, and keep fail-open as `""`.

Before (`cli.ts:206-220`):

```ts
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
```

After:

```ts
/** Read-only one-line index status for hook injection ("" when unavailable). */
export function indexStatusLine(home = codexHome(), path = indexPath()): string {
  try {
    const db = openIndexReadOnly(path);
    try {
      const report = statusReport(db, path, home);
      return `${report.files} files / ${report.msgs} messages, ${report.sourceFiles} source, ${report.staleFiles} stale, last ingest ${report.lastIngestAt ?? "never"}`;
    } finally {
      db.close();
    }
  } catch {
    return "";
  }
}
```

Call site `cli.ts:235` stays `handleSessionStart(indexStatusLine(), ...)` (defaults).

The function must use `openIndexReadOnly`. It must not call `ingest`.

## Change 4 — MODIFY `plugins/codexclaw/components/recall/src/hook.ts`

No behavior change. Keep `noRefresh: true` at `hook.ts:505`. Add a comment so L5 (`detectRecallIntent` at `hook.ts:86`) does not treat this block as free to flip:

Before (`hook.ts:501-511`):

```ts
    const localChat = deps.searchChat(cwdName, {
      cwd,
      days: 7,
      limit: 8,
      noRefresh: true,
      source: "main",
      includeTools: false,
      // Auto-injection summarizes "recent work", and the dedup below keeps the
      // first hit per thread — so this path stays on time order regardless of
      // what explicit search defaults to.
      order: "recent",
    });
```

After:

```ts
    const localChat = deps.searchChat(cwdName, {
      cwd,
      days: 7,
      limit: 8,
      // SessionStart must not ingest. Staleness is reported by indexStatusLine
      // (cli.ts) on the banner; flipping this to false would parse JSONL during
      // every session start (issue #144).
      noRefresh: true,
      source: "main",
      includeTools: false,
      // Auto-injection summarizes "recent work", and the dedup below keeps the
      // first hit per thread — so this path stays on time order regardless of
      // what explicit search defaults to.
      order: "recent",
    });
```

`sessionNotice` already prints `Index: ${status}` (`hook.ts:633`). Once `indexStatusLine` carries source/stale, the banner does too. Do not parse the status string here.

## Change 5 — `plugins/codexclaw/components/recall/src/index-db.ts`

**No production change.** `indexStatus` stays a sqlite COUNT. Extending it to stat JSONL would import `rollout.ts` into the sqlite module. Schema version stays `"2"` (`index-db.ts:18`). Do not ADD COLUMN, do not bump `INDEX_SCHEMA_VERSION`.

## Tests

Convention: `import test from "node:test"`, `assert` from `node:assert/strict`, temp dirs via `mkdtempSync(join(tmpdir(), ...))`, rollouts via `buildCodexHome` / `dateParts` / `utimesSync` as in `test/index.test.ts:1-12` and `:136-176`. Runner: `plugins/codexclaw/scripts/test.mjs` (globs of `*.test.ts`).

`buildCodexHome` writes four JSONL files (main, subagent, 40-day, archived) — `test/index.test.ts:34`.

### NEW `plugins/codexclaw/components/recall/test/index-freshness.test.ts`

Shared setup: `buildCodexHome(home)`, `openIndex(idx)`, `ingest(home, db, 0)` once in `test.before` except where a test needs a pre-ingest db.

1. **`measureIndexFreshness: a grown file is stale even when the path count is unchanged`**
   - Input: after the baseline ingest, append one JSONL line to the main-thread file and `utimesSync` it into the future, same pattern as `test/index.test.ts:151-159`. Do **not** ingest again.
   - Assert: `fresh.sourceFiles === fresh.indexedFiles`, `fresh.changedFiles === 1`, `fresh.missingFiles === 0`, `fresh.staleFiles === 1`.
   - Fails today: there is no helper, and `Math.max(0, sourceFiles - status.files)` at `chat-search.ts:258` is 0 whenever the counts match. This is the #144 repro (the 3 grown files).

2. **`measureIndexFreshness: a new JSONL path counts as missing/stale`**
   - Input: write a fifth rollout into today's sessions dir (new thread id, one user message). No ingest.
   - Assert: `fresh.sourceFiles === fresh.indexedFiles + 1`, `fresh.missingFiles === 1`, `fresh.staleFiles === 1`.
   - Fails today: no helper; `--status` does not mention source files at all (`cli.ts:194`).

3. **`measureIndexFreshness: a vanished source file counts as extra/stale`**
   - Input: `rmSync` the archived JSONL after ingest (path from `fixtures.ts:126`).
   - Assert: `fresh.extraFiles === 1`, `fresh.staleFiles === 1`, `fresh.sourceFiles === fresh.indexedFiles - 1`.
   - Fails today: count-diff is `max(0, source - indexed)`, so extras report as 0 stale (`chat-search.ts:258`).

4. **`ingest: no-op does not advance last_ingest_at`**
   - Input: ingest twice with no file changes. Read `meta.last_ingest_at` after each.
   - Assert: second result has `ingested + appended + pruned === 0` and the stamp string equals the first stamp.
   - Fails today: `ingest.ts:193-195` always INSERT OR REPLACE, so the second ISO time differs.

5. **`ingest: a real append advances last_ingest_at`**
   - Input: capture stamp, append+utimes as in test 1, ingest again.
   - Assert: `appended === 1` and the new stamp !== the old stamp.
   - Fails today: cannot distinguish from the always-update bug. After 1c this is the positive control.

6. **`cli --status is read-only and reports source/stale`**
   - Input: baseline ingest, then the grown-file setup from test 1. Capture stdout from `main(["chat", "index", "--home", home, "--index-path", idx, "--status"])` and again with `--json`. Re-read `last_ingest_at` and `COUNT(*) FROM files`.
   - Assert: exit 0; text matches `/source files: \d+/` and `/stale: 1/`; JSON `staleFiles === 1`, `changedFiles === 1`, `sourceFiles === files`; stamp and file count unchanged.
   - Fails today: text is `files: N, messages: M, last ingest: ...` with no source/stale (`cli.ts:194`); JSON has only `path/files/msgs/lastIngestAt` (`index-db.ts:163-168`).

7. **`cli --status --json after a full ingest reports staleFiles 0`**
   - Input: ingest, then `--status --json` with no dirty files.
   - Assert: `staleFiles === 0`, `sourceFiles === files`.
   - Fails today: JSON has no `staleFiles` key.

8. **`searchChat noRefresh reports grown-file staleFiles > 0`**
   - Input: same grown file as test 1. `searchChat("trigram", { home, indexPath: idx, noRefresh: true })`.
   - Assert: `mode === "index"`, `index.readOnly === true`, `index.sourceFiles === index.files`, `index.staleFiles === 1`.
   - Fails today: `staleFiles` is `max(0, sourceFiles - files) === 0` (`chat-search.ts:258`).

9. **`indexStatusLine names source and stale; SessionStart interpolates it`**
   - Input: grown-file setup; `const line = indexStatusLine(home, idx)`; `handleSessionStart(line, undefined, undefined, { dedicatedTools: false })`.
   - Assert: `line` matches `/\d+ source, 1 stale/`; parsed `additionalContext` matches `/Index: .*1 stale/`. Empty status still omits `Index:` (`test/hook.test.ts:92`).
   - Fails today: `indexStatusLine` is not exported and its string has no source/stale (`cli.ts:213`).

### EXTEND `plugins/codexclaw/components/recall/test/index.test.ts`

10. **existing `ingest: builds, is incremental, and prunes deleted files`** (`test/index.test.ts:30-44`)
    - After `first`, read `meta.last_ingest_at` into `stamp1`. After `second = ingest(...)` with `ingested === 0`, read `stamp2` and `assert.equal(stamp2, stamp1)`. Today's `assert.ok(status.lastIngestAt !== null)` stays; it is too weak to catch the bug.

11. **existing `cli: chat index --status and --rebuild work against --index-path`** (`test/index.test.ts:215-231`)
    - Keep `/files: \d+, messages: \d+/`. Add `/source files: \d+/` and `/stale: \d+/` on the `--status` capture.

### EXTEND `plugins/codexclaw/components/recall/test/round2.test.ts`

12. **existing `gap7: refreshing queries also carry freshness metadata`** (`test/round2.test.ts:49-55`)
    - Keep `staleFiles === 0` after refresh-on-query. That must remain true under the new definition (ingest just synced).

13. **existing `gap1: --no-refresh opens the index read-only and reports freshness`** (`test/round2.test.ts:31-38`)
    - Keep as a floor. Do not change the weak inequality; the grown-file case lives in test 8.

### EXTEND `plugins/codexclaw/components/recall/test/hook.test.ts`

14. **existing `session-start advertises recall with and without index status`** (`test/hook.test.ts:79-93`)
    - Keep the canned string `"1769 files / 354798 messages, last ingest X"` — that test pins interpolation, not production formatting.
    - Add a sibling: `handleSessionStart("4 files / 20 messages, 5 source, 1 stale, last ingest X", undefined, undefined, { dedicatedTools: false })` matches `/Index: 4 files \/ 20 messages, 5 source, 1 stale/`.

15. **NEW `cwd fallback searchChat is called with noRefresh: true`**
    - Input: `buildCwdContext("/repo/current", { searchChat: recordingMock as never })` with `listCwdSessions` omitted so the fallback at `hook.ts:501` runs (same style as `test/hook.test.ts:130-134`). The mock must capture its second argument.
    - Assert: recorded options have `noRefresh === true`.
    - Fails today: nothing pins the flag; the new comment is not enough without this.

## Verification (this layer)

From repo root `C:/Users/super/.codex/worktrees/b74b/codexclaw`:

```
npm run build
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/recall/test/index-freshness.test.ts plugins/codexclaw/components/recall/test/index.test.ts plugins/codexclaw/components/recall/test/round2.test.ts plugins/codexclaw/components/recall/test/hook.test.ts
npm test
```

Layer is proven when:

- `npm run build` exits 0 and `plugins/codexclaw/components/recall/dist/{ingest,chat-search,cli,hook}.js` contain `measureIndexFreshness` / `source files` / the `noRefresh` comment. `index-db.js` is unchanged in behavior (COUNT only).
- The focused run prints the nine new names from `index-freshness.test.ts` as pass, plus the extended assertions.
- Red-green: on the parent tip, test 1 (grown-file stale) and test 4 (no-op stamp) fail; at this layer they pass. Paste both outputs.
- `npm test` exits 0 with the new names visible.
- `cxc receipt test` for the bound session (000_plan verification contract item 4).

## Must not touch

- Peer session files: `provider-bridge/`, `session-binding.ts`, `config-guard/`, `source-identity.ts`, `session-source.ts`, powershell-landmines corpus.
- L1 / #138: `normalizeCwd`, `FOLD_CWD_CASE`, `index-search.ts` SQL. Freshness keys on file path, not cwd.
- L2 / #142 #143: `memory-search.ts`, `chat-fallback.test.ts`, AND/thread bookkeeping, synonym forwarding.
- L3 / #139 #140: `--help` short-circuit, dash-leading path rejection, missing `--home` exit code. Rebase onto L3; do not restore ingest-on-help.
- L5 / #137: `detectRecallIntent` (`hook.ts:86`) and `skills/recall/SKILL.md`.
- L6 / #135 #136 #141: `pabcd-state` write gate.
- `INDEX_SCHEMA_VERSION`, FTS triggers, `openIndexReadOnly` semantics.
- Flipping SessionStart `noRefresh` to false.
- Parsing JSONL inside `--status` or the banner.
- `ChatSearchResult.index` extra keys.
- `format.ts` / memory age labels (`test/format-freshness.test.ts` is wp6 of a previous cycle, unrelated).

## Layer interactions

- **Below (L3 / wp4).** `cli.ts` is shared. L3 makes `chat index --help` a no-op usage print so `--status` is safe to call. This layer adds fields to that status path. On rebase, keep L3's help-before-work; only replace the status body at `cli.ts:190-195` and `indexStatusLine`.
- **Below (L1 / wp2).** No shared helper. Do not wait on cwd fixtures.
- **Above (L5 / wp6).** Shared file `hook.ts`, different region: this layer owns the `searchChat` call at `hook.ts:501-511`; L5 owns the intent regex near line 86. Leave that regex untouched so the cascade is a rebase, not a merge conflict of two regex edits.
- **Above (wp8).** Branch name `codex/fix-chat-index-freshness`, PR base `codex/fix-recall-cli-arg-hygiene`, title already listed in `070_wp8_integration_stack_publish.md`. `Closes #144` only on this PR.
- New test file has no `dist/`. Modified `src/*.ts` already have tracked `dist/*.js`; `npm run build` updates them in place (no `git add -f` unless a brand-new src file is added — this layer should not add one).

## Done when

`--status` and the SessionStart banner, on a read-only open, show source JSONL count and a `stale` count that includes missing, changed-`(mtime,size)`, and extra index rows. A no-op ingest leaves `last_ingest_at` unchanged. SessionStart still searches with `noRefresh: true`. Tests 1, 4, 6, and 8 are the acceptance core for `c-7`.
