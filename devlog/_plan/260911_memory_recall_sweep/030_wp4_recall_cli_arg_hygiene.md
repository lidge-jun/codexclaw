# wp4 / L3 — recall CLI arg hygiene (#139, #140)

Branch: `codex/fix-recall-cli-arg-hygiene` based on L2 (`codex/fix-memory-search-semantics`).
Docs-only this cycle. Implementation later copies the diffs below.
Class: C2 (CLI contract + focused tests). `--help` changing from "do the write" to "print usage" is the public-contract slice; pin it with tests. Do not widen into a default-behavior rewrite of bare `chat index` (see §3).

Thesis: the recall CLI answers `--help`/`-h` before any parse or work, so `chat index --help` cannot ingest; a dash-leading token is never a path value for `--cwd` / `--cwd-only` / `--home` / `--index-path`; an explicit `--home` that does not exist exits non-zero; `memories/` missing and `memories_<N>.sqlite` missing each warn once and are distinguishable.

## 1. Files this layer changes

| Path | Op | Why |
|---|---|---|
| `plugins/codexclaw/components/recall/src/cli.ts` | MODIFY | Help-first, `strict: true`, reject flag-like path values, missing `--home` → exit 1 |
| `plugins/codexclaw/components/recall/src/memory-search.ts` | MODIFY | One warning per missing root; stop duplicating the db-missing warning on the relaxed retry |
| `plugins/codexclaw/components/recall/src/paths.ts` | unchanged | See §2. `memoriesDir` is a join; it does not warn and should not |
| `plugins/codexclaw/components/recall/test/cli-arg-hygiene.test.ts` | NEW | CLI help / path / missing-home / unknown-flag regressions |
| `plugins/codexclaw/components/recall/test/memory-search.test.ts` | MODIFY | Tighten the existing missing-db test; add the retry-duplication pin |
| `plugins/codexclaw/components/recall/dist/cli.js` | MODIFY | `npm run build` output; already tracked |
| `plugins/codexclaw/components/recall/dist/memory-search.js` | MODIFY | `npm run build` output; already tracked |

No other production file. If USAGE gains a new `--flag` token, `plugins/codexclaw/skills/recall/SKILL.md` and `plugins/codexclaw/test/recall-skill-synopsis.test.mjs` will fail — this layer must not add a new `--flag` token to the USAGE string (help still prints the existing USAGE).

## 2. Verified current tree (HEAD `6aae1c97`)

Issue bodies quote 0.2.24 line numbers. Checked against this checkout. Every citation below was read here.

### 2.1 `--help` is not a flag; `strict: false` drops it; `chat index` then ingests

`plugins/codexclaw/components/recall/src/cli.ts:61-92` — `parseFlags` has no `help` option and sets `strict: false`:

```ts
function parseFlags(args: string[]): ParsedFlags {
  const { values, positionals } = parseArgs({
    args,
    options: {
      // ...
      cwd: { type: "string" },
      "cwd-only": { type: "string" },          // L70
      home: { type: "string" },                // L86
      "index-path": { type: "string" },        // L87
    },
    strict: false,                            // L89
    allowPositionals: true,                   // L90
  });
  return { values: values as Record<string, unknown>, positionals: positionals.map(String) };
}
```

`plugins/codexclaw/components/recall/src/cli.ts:169-183` — `runChatIndex` treats anything other than `--status` (without `--rebuild`) as a write + ingest. `--help` is not `status`, so it opens the sidecar read-write and ingests:

```ts
function runChatIndex(args: string[]): number {
  const { values } = parseFlags(args);
  const home = typeof values.home === "string" ? values.home : codexHome();
  const path = typeof values["index-path"] === "string" ? values["index-path"] : indexPath();
  try {
    const statusOnly = values.status === true && values.rebuild !== true; // L176
    const db = statusOnly ? openIndexReadOnly(path) : openIndex(path);     // L177
    try {
      if (values.rebuild === true) {
        db.exec("DELETE FROM msgs; DELETE FROM files;");
      }
      if (!statusOnly) {
        const r = ingest(home, db, 0);                                     // L183
```

Default sidecar path is not under `~/.codex`. `plugins/codexclaw/components/recall/src/index-db.ts:25-26`: `indexPath()` joins `codexclawHome()` with `recall/index.sqlite` (`CODEXCLAW_HOME ?? ~/.codexclaw`).

`plugins/codexclaw/components/recall/src/cli.ts:247-260` — `main` routes `chat`+`index` before any help check. `chat --help` happens to fall through to USAGE/exit 0 (unknown sub). `chat index --help` does not. `memory search --help` is dropped by `strict: false`, becomes an empty query, prints USAGE, **exits 1** (`cli.ts:144-146`).

Header lie: `cli.ts:5-6` says "never writes". `runChatIndex` writes. Do not "fix" that by making bare `chat index` read-only in this layer; just stop lying if you touch the comment.

### 2.2 Path flags swallow the next token

`cli.ts:70`, `cli.ts:86`, `cli.ts:89`, `cli.ts:154-157` match issue #140. Node `parseArgs` `type: "string"` consumes the next argv token even when it starts with `-`. `strict: true` does **not** stop that (the next token is a legal string value).

```ts
    cwd: typeof values["cwd-only"] === "string" ? values["cwd-only"] : typeof values.cwd === "string" ? values.cwd : null, // L156
    cwdOnly: values["cwd-only"] !== undefined && values["cwd-only"] !== false, // L157
```

The comment at `cli.ts:154-155` documents a second shape: bare `--cwd-only` parsed as boolean, hardening an accompanying `--cwd`. USAGE already says `--cwd-only PATH` (`cli.ts:36`). Issue #140 makes a valueless `--cwd-only` an error. This layer follows the issue: drop the boolean-hardener.

Relative path resolution that turns a swallowed flag into a plausible absolute path: `plugins/codexclaw/components/recall/src/memory-search.ts:306-315` (`buildCwdScope`). Issue cited L314-315; still correct:

```ts
  const absolute = posixPath.isAbsolute(raw) || win32Path.isAbsolute(raw); // L314
  const prefix = normalizeCwd(absolute ? raw : resolve(raw));              // L315
```

Fix this at CLI parse time so `searchMemory` never sees `cwd: "--no-chat"`. Do not change `buildCwdScope` / `normalizeCwd` (L1 owns cwd normalization).

### 2.3 Missing `--home` is fail-soft exit 0; db-missing warning is pushed per `collect` pass

`plugins/codexclaw/components/recall/src/cli.ts:141-166` — `runMemorySearch` always `return 0` after `searchMemory`. No `existsSync` on `--home`. `cli.ts` currently imports `realpathSync` only (`cli.ts:11`); it does not import `existsSync`.

`plugins/codexclaw/components/recall/src/paths.ts:23-25` is only:

```ts
export function memoriesDir(home: string): string {
  return join(home, "memories");
}
```

`paths.ts:27-29` is a **different** function, `latestVersionedDb`:

```ts
function latestVersionedDb(home: string, prefix: string): string | null {
  if (!existsSync(home)) return null; // L29
}
```

`memoriesDbPath` (`paths.ts:45-47`) uses that. Two roots, two absences:

- Markdown root: `{home}/memories/` via `memoriesDir` (`paths.ts:23-25`).
- Stage1 db: `{home}/memories_<N>.sqlite` via `memoriesDbPath` (`paths.ts:45-47`), **not** inside `memories/`.

`memory-search.ts:245-247` — missing markdown root is silent:

```ts
function listMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return []; // L246
}
```

`memory-search.ts:672-675` — missing db warns **inside** `searchStage1`:

```ts
  const dbPath = memoriesDbPath(home);
  if (!dbPath) {
    warnings.push("memories db not found (stage1 search off)"); // L674
    return;
  }
```

`searchStage1` is called from the inner `collect` (`memory-search.ts:504-515`). `collect` runs at L519, and again at L533 when the relaxed retry fires:

```ts
  let candidates = collect(groups, true); // L519
  if (candidates.length === 0 && hasBoundaryTerm(groups)) { // L526
    fillStage1Presence(home, groups, present, cutoffMs, warnings); // L527; silent if !dbPath (L637-638)
    // ...
    if (miss.size > 0) { // L532  — issue body called this L532 collect; collect is L533
      candidates = collect(relaxGroupsAt(groups, miss), false); // L533
```

The duplicate warning is therefore two `searchStage1` calls, not two `listMarkdownFiles` calls. `fillStage1Presence` (`L637-638`) already returns without warning when the db is absent.

`foo` is a short-ASCII symbol (`query-words.ts:67` `SHORT_ASCII = /^[a-z]{1,3}$/`, `isSymbolWord` at L96-106, `synonyms.ts:176` sets `boundary`). `hasBoundaryTerm` is true, so `searchMemory("foo", { home: empty })` duplicates the db warning. `searchMemory("anything", ...)` does **not** — the existing test at `test/memory-search.test.ts:70-79` uses `"anything"` and cannot pin the duplicate.

Library `searchMemory` never `process.exit`s. Non-zero exit is a CLI duty when the user passed `--home`.

## 3. Locked decisions

1. Help tokens are only `--help` and `-h`, detected with `argv.some` **before** routing and **before** `parseArgs`. Do not treat the word `help` as a help token — `memory search help` is a real query. Pattern already in-tree: `pabcd-state/src/orchestrate-cli.ts:168` `isHelpToken`, `freeze-cli.ts:65` `argv.some`. Recreate a local helper in `cli.ts`; do not import across components.
2. `strict: true` on `parseArgs`. Unknown flags exit 1 with the Node message on stderr. Catch the throw; do not crash the process.
3. After a successful parse, any of `cwd`, `cwd-only`, `home`, `index-path` whose value is a string starting with `-` is an error (stderr, exit 1). This is the actual swallow bug; `strict: true` alone does not fix it. Include `--index-path` in the same helper (same class of flag, same `parseFlags`).
4. Valueless `--cwd-only` / `--cwd` / `--home` / `--index-path` is an error (Node `parseArgs` with `type: "string"` + `strict: true` already throws). Delete the boolean-hardener comment and stop treating `values["cwd-only"] !== false` as a boolean. `cwdOnly` becomes `typeof values["cwd-only"] === "string"`.
5. Explicit `--home PATH` where `existsSync(PATH)` is false: stderr `--home not found: <PATH>` plus newline, exit 1, no search, no ingest, no JSON. Applies to `chat search`, `memory search`, and `chat index` (shared flag). Default home (flag omitted) stays fail-soft.
6. Warning contract, exact strings:
   - `"memories root not found (file search off)"` — once, when `{home}/memories` is missing.
   - `"memories db not found (stage1 search off)"` — once, when `memoriesDbPath(home)` is null. Keep this string; tests already match `memories db`.
   Emit both when both are missing. Emit them in `searchMemory`, not in `searchStage1`. `searchStage1` returns silently on `!dbPath` (same as `fillStage1Presence`).
7. **Do not** change the default of bare `cxc chat index`. Issue #139 *recommends* making it read-only and adding `--refresh`. Roadmap c-5 only requires `--help` to be side-effect free. L4 (#144) extends the `--status` output on this same function. Adding `--refresh` would add a `--flag` token to USAGE and break `plugins/codexclaw/test/recall-skill-synopsis.test.mjs:16-23` unless SKILL.md is updated — out of this layer. Bare `chat index` still ingests. `--status` stays read-only. `--rebuild` still deletes then ingests.
8. Do not add `--help` to the USAGE string (that injects a new `--flag` token into the skill synopsis test). Help prints the existing USAGE and exits 0.
9. No new helper in `paths.ts`. `memoriesDir` stays a pure join.
10. `searchMemory` remains fail-soft for library callers (hooks, tests). Non-zero is CLI-only.

## 4. Production diffs

### 4.1 MODIFY `plugins/codexclaw/components/recall/src/cli.ts`

No existing helper named `wantsHelp` / `flagLikePathError` / `readFlags` in this file. Create them here.

**Import (`cli.ts:11`)**

Before:

```ts
import { realpathSync } from "node:fs";
```

After:

```ts
import { existsSync, realpathSync } from "node:fs";
```

**Header (`cli.ts:5-6`)** — optional, only if you already have the file open:

Before: `Read-only over CODEX_HOME (~/.codex); never writes.`

After: `Search paths are read-only over CODEX_HOME (~/.codex). chat index without --status writes the sidecar. --help/-h never writes.`

**After `USAGE` / `ParsedFlags` (after `cli.ts:59`), add:**

```ts
const PATH_OPTION_KEYS = ["cwd", "cwd-only", "home", "index-path"] as const;

function wantsHelp(args: string[]): boolean {
  return args.some((a) => a === "--help" || a === "-h");
}

function flagLikePathError(values: Record<string, unknown>): string | undefined {
  for (const key of PATH_OPTION_KEYS) {
    const raw = values[key];
    if (typeof raw === "string" && raw.startsWith("-")) {
      return `--${key} path must not start with '-': got ${JSON.stringify(raw)}`;
    }
  }
  return undefined;
}

function readFlags(args: string[]): ParsedFlags | null {
  try {
    const parsed = parseFlags(args);
    const dashErr = flagLikePathError(parsed.values);
    if (dashErr) throw new Error(dashErr);
    return parsed;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return null;
  }
}

/** Explicit --home must exist. `false` = error already printed. `undefined` = use default. */
function explicitHome(values: Record<string, unknown>): string | undefined | false {
  if (typeof values.home !== "string") return undefined;
  if (!existsSync(values.home)) {
    process.stderr.write(`--home not found: ${values.home}\n`);
    return false;
  }
  return values.home;
}
```

**`parseFlags` (`cli.ts:61-93`)** — only change `strict: false` to `strict: true`. Keep the option table identical (do not add a `help` option; `wantsHelp` runs first).

Before: `strict: false,`
After: `strict: true,`

**`runChatSearch` (`cli.ts:102`)** — parse via `readFlags`; honor `explicitHome`.

Before (`cli.ts:102-132`):

```ts
function runChatSearch(args: string[]): number {
  const { values, positionals } = parseFlags(args);
  const query = positionals.join(" ").trim();
  if (query === "") {
    process.stdout.write(`${USAGE}\n`);
    return 1;
  }
  // ...
    home: typeof values.home === "string" ? values.home : undefined,
    indexPath: typeof values["index-path"] === "string" ? values["index-path"] : undefined,
  };
```

After:

```ts
function runChatSearch(args: string[]): number {
  const parsed = readFlags(args);
  if (parsed === null) return 1;
  const { values, positionals } = parsed;
  const home = explicitHome(values);
  if (home === false) return 1;
  const query = positionals.join(" ").trim();
  if (query === "") {
    process.stdout.write(`${USAGE}\n`);
    return 1;
  }
  // ... same opts as today, except:
    home,
    indexPath: typeof values["index-path"] === "string" ? values["index-path"] : undefined,
  };
```

**`runMemorySearch` (`cli.ts:141-161`)**

Before:

```ts
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
    searchChat: values["no-chat"] === true ? undefined : searchChat,
  };
```

After:

```ts
function runMemorySearch(args: string[]): number {
  const parsed = readFlags(args);
  if (parsed === null) return 1;
  const { values, positionals } = parsed;
  const home = explicitHome(values);
  if (home === false) return 1;
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
    home,
    // --cwd-only PATH is the only hard-filter form. A missing or flag-like
    // value is rejected by readFlags; there is no boolean-hardener.
    cwd: typeof values["cwd-only"] === "string" ? values["cwd-only"] : typeof values.cwd === "string" ? values.cwd : null,
    cwdOnly: typeof values["cwd-only"] === "string",
    searchChat: values["no-chat"] === true ? undefined : searchChat,
  };
```

**`runChatIndex` (`cli.ts:169-172`)**

Before:

```ts
function runChatIndex(args: string[]): number {
  const { values } = parseFlags(args);
  const home = typeof values.home === "string" ? values.home : codexHome();
  const path = typeof values["index-path"] === "string" ? values["index-path"] : indexPath();
```

After:

```ts
function runChatIndex(args: string[]): number {
  const parsed = readFlags(args);
  if (parsed === null) return 1;
  const { values } = parsed;
  const homeOrErr = explicitHome(values);
  if (homeOrErr === false) return 1;
  const home = homeOrErr ?? codexHome();
  const path = typeof values["index-path"] === "string" ? values["index-path"] : indexPath();
```

Leave `cli.ts:173-203` (statusOnly / ingest / rebuild) unchanged.

**`main` (`cli.ts:247-260`)** — help-first, before any kind/sub routing:

Before:

```ts
export function main(argv: string[]): number | Promise<number> {
  const kind = argv[0] ?? "help";
  const sub = argv[1] ?? "";
  if ((kind === "chat" || kind === "memory") && sub === "search") {
```

After:

```ts
export function main(argv: string[]): number | Promise<number> {
  if (wantsHelp(argv)) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const kind = argv[0] ?? "help";
  const sub = argv[1] ?? "";
  if ((kind === "chat" || kind === "memory") && sub === "search") {
```

Rest of `main` unchanged. Unknown subcommands still print USAGE and exit 0 (`cli.ts:259-260`).

### 4.2 MODIFY `plugins/codexclaw/components/recall/src/memory-search.ts`

L1 does NOT edit this file — its change lands in `rollout.ts`, `index-search.ts` and `cwd-context.ts`. L2 is the previous writer of this file and this layer is the next one, so re-anchor on the function names if L2 moved the line numbers. Do not retouch collect/match/fallback logic.

**`searchMemory` after the empty-query return (today `memory-search.ts:441-448`)**

Before:

```ts
  if (words.length === 0) {
    warnings.push("empty query");
    return { hits: [], warnings, scannedFiles, elapsedMs: Date.now() - started };
  }

  const root = memoriesDir(home);
  const files = listMarkdownFiles(root);
  const scope = buildCwdScope(home, opts, warnings);
```

After:

```ts
  if (words.length === 0) {
    warnings.push("empty query");
    return { hits: [], warnings, scannedFiles, elapsedMs: Date.now() - started };
  }

  const root = memoriesDir(home);
  if (!existsSync(root)) {
    warnings.push("memories root not found (file search off)");
  }
  if (!memoriesDbPath(home)) {
    warnings.push("memories db not found (stage1 search off)");
  }
  const files = listMarkdownFiles(root);
  const scope = buildCwdScope(home, opts, warnings);
```

`existsSync` is already imported (`memory-search.ts:11`). `memoriesDbPath` is already imported (`memory-search.ts:13`).

**`searchStage1` (`memory-search.ts:672-675`)**

Before:

```ts
  const dbPath = memoriesDbPath(home);
  if (!dbPath) {
    warnings.push("memories db not found (stage1 search off)");
    return;
  }
```

After:

```ts
  const dbPath = memoriesDbPath(home);
  if (!dbPath) {
    return;
  }
```

`listMarkdownFiles` stays as-is (returns `[]` when root is missing). `fillStage1Presence` stays silent on `!dbPath`.

### 4.3 `paths.ts` — no diff

Issue #140 quoted L23-29 as one snippet mixing `memoriesDir` with `if (!existsSync(home)) return null`. Those are two functions. This layer does not invent a wrapper.

## 5. Tests

Convention: `plugins/codexclaw/components/recall/test/*.test.ts`, `node:test` + `node:assert/strict`, run by `plugins/codexclaw/scripts/test.mjs`. CLI tests import `main as cliMain` from `../src/cli.ts` and stub `process.stdout.write` (see `test/index.test.ts:215-231`, `test/cwd-scope.test.ts:312-334`). This layer also stubs stderr. Do not spawn a subprocess; `cliMain` is sync for these argv shapes.

Keep `test/cwd-scope.test.ts:312` (`cli: --cwd and --cwd-only reach memory search`) green — it passes a real path after `--cwd-only`. Keep `test/index.test.ts:215` (`cli: chat index --status and --rebuild work against --index-path`) green.

### 5.1 NEW `plugins/codexclaw/components/recall/test/cli-arg-hygiene.test.ts`

Complete file:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexHome } from "./fixtures.ts";
import { main as cliMain } from "../src/cli.ts";
import { searchMemory } from "../src/memory-search.ts";

function withCapturedStdio(fn: () => number): { code: number; stdout: string; stderr: string } {
  const out: string[] = [];
  const err: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    out.push(s);
    return true;
  };
  (process.stderr as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    err.push(s);
    return true;
  };
  try {
    return { code: fn(), stdout: out.join(""), stderr: err.join("") };
  } finally {
    (process.stdout as unknown as { write: typeof origOut }).write = origOut;
    (process.stderr as unknown as { write: typeof origErr }).write = origErr;
  }
}

test("cli: chat index --help prints usage, exits 0, and does not ingest", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-help-idx-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--help"]) as number,
    );
    assert.equal(r.code, 0);
    assert.match(r.stdout, /cxc chat search/);
    assert.doesNotMatch(r.stdout, /ingested/);
    assert.equal(existsSync(idx), false, "help must not openIndex/create the sidecar");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: --help anywhere beats --rebuild", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-help-rebuild-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    buildCodexHome(home);
    assert.equal(
      withCapturedStdio(() => cliMain(["chat", "index", "--home", home, "--index-path", idx]) as number).code,
      0,
    );
    const before = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--status", "--json"]) as number,
    );
    const beforeJson = JSON.parse(before.stdout);
    const help = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--rebuild", "--help"]) as number,
    );
    assert.equal(help.code, 0);
    assert.match(help.stdout, /cxc chat search/);
    assert.doesNotMatch(help.stdout, /ingested/);
    const after = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--status", "--json"]) as number,
    );
    const afterJson = JSON.parse(after.stdout);
    assert.equal(afterJson.files, beforeJson.files);
    assert.equal(afterJson.msgs, beforeJson.msgs);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: memory search --help exits 0 even with no query", () => {
  const r = withCapturedStdio(() => cliMain(["memory", "search", "--help"]) as number);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /cxc memory search/);
});

test("cli: -h is help", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-help-h-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "-h"]) as number,
    );
    assert.equal(r.code, 0);
    assert.match(r.stdout, /cxc chat index/);
    assert.doesNotMatch(r.stdout, /ingested/);
    assert.equal(existsSync(idx), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: dash-leading --cwd-only value is rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-dash-cwdonly-"));
  try {
    const r = withCapturedStdio(() =>
      cliMain(["memory", "search", "memory", "--home", home, "--cwd-only", "--no-chat", "--json"]) as number,
    );
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /cwd-only/);
    assert.match(r.stderr, /path must not start with '-'/);
    assert.equal(r.stdout.trim(), "");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: dash-leading --cwd and --home values are rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-dash-cwd-"));
  try {
    const cwd = withCapturedStdio(() =>
      cliMain(["chat", "search", "q", "--home", home, "--cwd", "--json", "--scan"]) as number,
    );
    assert.notEqual(cwd.code, 0);
    assert.match(cwd.stderr, /--cwd path must not start with '-'/);
    const homeFlag = withCapturedStdio(() =>
      cliMain(["memory", "search", "q", "--home", "--json"]) as number,
    );
    assert.notEqual(homeFlag.code, 0);
    assert.match(homeFlag.stderr, /--home path must not start with '-'/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: missing --cwd-only value is rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-missing-cwdonly-"));
  try {
    const r = withCapturedStdio(() =>
      cliMain(["memory", "search", "q", "--home", home, "--cwd-only"]) as number,
    );
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /cwd-only/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: unknown flag is rejected", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-unknown-flag-"));
  const idx = join(home, "sidecar", "index.sqlite");
  try {
    const r = withCapturedStdio(() =>
      cliMain(["chat", "index", "--home", home, "--index-path", idx, "--not-a-flag"]) as number,
    );
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /not-a-flag/i);
    assert.equal(existsSync(idx), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("cli: missing --home directory exits non-zero", () => {
  const missing = join(tmpdir(), "recall-home-does-not-exist");
  assert.equal(existsSync(missing), false);
  const r = withCapturedStdio(() =>
    cliMain(["memory", "search", "foo", "--home", missing, "--no-chat", "--json"]) as number,
  );
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /--home not found/);
  assert.equal(r.stdout.trim(), "");
});

test("searchMemory: missing memories root and missing db each warn once, including on relaxed retry", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-missing-roots-"));
  try {
    const prose = searchMemory("anything", { home });
    assert.equal(prose.hits.length, 0);
    assert.equal(prose.warnings.filter((w) => w === "memories root not found (file search off)").length, 1);
    assert.equal(prose.warnings.filter((w) => w === "memories db not found (stage1 search off)").length, 1);

    const symbol = searchMemory("foo", { home });
    assert.equal(symbol.hits.length, 0);
    assert.equal(symbol.warnings.filter((w) => w === "memories root not found (file search off)").length, 1);
    assert.equal(symbol.warnings.filter((w) => w === "memories db not found (stage1 search off)").length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
```

Why these fail on today's code:

| Test name | Input | Today | After |
|---|---|---|---|
| `cli: chat index --help prints usage, exits 0, and does not ingest` | `chat index --home H --index-path IDX --help` | exit 0, stdout `ingested …`, `IDX` created | USAGE, exit 0, `IDX` absent |
| `cli: --help anywhere beats --rebuild` | `… --rebuild --help` after a real ingest | rebuild runs, counts may reset | USAGE, files/msgs unchanged |
| `cli: memory search --help exits 0 even with no query` | `memory search --help` | USAGE but **exit 1** (empty query, `cli.ts:144-146`) | USAGE, exit 0 |
| `cli: -h is help` | `chat index -h` | ingest (unknown short dropped) | USAGE, no ingest |
| `cli: dash-leading --cwd-only value is rejected` | `memory search memory --cwd-only --no-chat --json` | exit 0, warning path ends with `--no-chat` (issue #140 repro) | exit ≠ 0, stderr names `cwd-only` |
| `cli: dash-leading --cwd and --home values are rejected` | `--cwd --json`, `--home --json` | flags swallowed | exit ≠ 0 |
| `cli: missing --cwd-only value is rejected` | trailing `--cwd-only` | `strict: false` may coerce boolean / ignore | exit ≠ 0 |
| `cli: unknown flag is rejected` | `chat index --not-a-flag` | ingest | exit ≠ 0, no ingest |
| `cli: missing --home directory exits non-zero` | `--home` missing dir | exit 0, JSON `scannedFiles: 0`, db warning twice for `foo` | exit ≠ 0, empty stdout |
| `searchMemory: missing memories root and missing db each warn once, including on relaxed retry` | empty home, queries `anything` and `foo` | no root warning; `foo` pushes db warning twice | each string exactly once |

Match Node's unknown-option wording with a case-insensitive regex on `not-a-flag` plus non-zero. Do not assert a guessed full sentence.

### 5.2 MODIFY `plugins/codexclaw/components/recall/test/memory-search.test.ts:70-79`

Before:

```ts
test("missing memories db degrades with a warning", () => {
  const bare = mkdtempSync(join(tmpdir(), "recall-mem-bare-"));
  try {
    const r = searchMemory("anything", { home: bare });
    assert.equal(r.hits.length, 0);
    assert.ok(r.warnings.some((w) => w.includes("memories db")));
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});
```

After:

```ts
test("missing memories db degrades with a warning", () => {
  const bare = mkdtempSync(join(tmpdir(), "recall-mem-bare-"));
  try {
    const r = searchMemory("anything", { home: bare });
    assert.equal(r.hits.length, 0);
    assert.equal(r.warnings.filter((w) => w.includes("memories db not found")).length, 1);
    assert.equal(r.warnings.filter((w) => w.includes("memories root not found")).length, 1);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});
```

Today this fails the root-warning count (0, not 1). It still would not catch the `foo` duplicate; that lives in the new file.

## 6. Verification

From repo root `C:/Users/super/.codex/worktrees/b74b/codexclaw`:

```powershell
npm run build
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/recall/test/cli-arg-hygiene.test.ts" "plugins/codexclaw/components/recall/test/memory-search.test.ts" "plugins/codexclaw/components/recall/test/index.test.ts" "plugins/codexclaw/components/recall/test/cwd-scope.test.ts"
npm test
```

Layer is proven when:

1. `npm run build` exits 0. `git diff --stat -- plugins/codexclaw/components/recall/dist/cli.js plugins/codexclaw/components/recall/dist/memory-search.js` is non-empty.
2. Focused run shows the new test names and 0 failures.
3. Red-green: at parent tip, `cli: chat index --help prints usage, exits 0, and does not ingest` fails (stdout matches `ingested` or `index.sqlite` is created). At this layer's tip it passes. Same for `cli: missing --home directory exits non-zero` (today exit 0) and the `foo` once-each warning test (today db warning length 2).
4. `npm test` exits 0 with the new names visible. Existing `cli: --cwd and --cwd-only reach memory search` and `cli: chat index --status and --rebuild work against --index-path` still pass.
5. Windows live check for #140 (optional but the issue reproduced here):

```powershell
node plugins/codexclaw/components/recall/dist/cli.js memory search memory --cwd-only --no-chat --json --limit 1
# expect non-zero, no search against a path ending in --no-chat
```

Do not use inline JSON with `cxc orchestrate attest`. This layer has no attest step.

## 7. Must not touch / layer interactions

Must not edit: `provider-bridge/`, `session-binding.ts`, `config-guard/`, `source-identity.ts`, `session-source.ts`, `hook.ts` (L4/L5), `ingest.ts`, `index-db.ts` status shape (L4), `query-words.ts`, `synonyms.ts`, `rollout.ts` `normalizeCwd` / `FOLD_CWD_CASE` (L1), `pabcd-state/`, SKILL.md (unless you violate decision 8).

Below: L2 is the only lower layer that writes `memory-search.ts`; L1 does not touch it. This layer only adds the two warning pushes in `searchMemory` and removes the one in `searchStage1`. If L2 moved those functions, follow the names, not the 0.2.24 line numbers. Do not reopen matchedThreadIds, paragraph AND, or chat-fallback `synonyms`/`any` forwarding.

Above: L4 (#144) adds fields to the same `--status` JSON this layer makes safe to call. Do not add/rename status keys. Do not change `statusOnly` (`cli.ts:176`). L4's `chat index --help` must still be a no-op because help returns in `main` before `runChatIndex`.

Peer Windows sweep owns #132 (`cxc enable --help`) — different dispatcher. Do not fix it here.

## 8. Acceptance mapped

| id | proof |
|---|---|
| c-5 | `cli: chat index --help prints usage, exits 0, and does not ingest` plus `cli: --help anywhere beats --rebuild` |
| c-6 | dash-leading tests, `cli: missing --home directory exits non-zero`, once-each warning test |
| #139 unknown flags | `cli: unknown flag is rejected` |
| #139 default ingest flip | explicitly not done (§3.7) |

## Amendment A — wp4 P revalidation (2026-09-11)

Re-verified at `20b42207` by an independent `xai/grok-4.6` explorer.
**This amendment governs.**

### A.1 Every `memory-search.ts` line number in this PRD is wrong

L2 (`c8bb1ff9`) added ~46 lines to that file. The PRD measured it before.
**Anchor on function and identifier names; never apply a range from the body.**

| PRD says | Actually now | What it is |
|---|---|---|
| `:441-448` empty query / root | **`:450-457`** | `:441` is now `dropStopwords` |
| inner `collect` `:504-515` | `collect` at **`:460`**, `searchStage1(...)` at **`:542-553`** | `:504-515` is now the paragraph-hit `relpath` block |
| `:519` / `:526` / `:527` / `:532` / `:533` | **`:557`** `collect(groups,true)` / **`:564`** `hasBoundaryTerm` / **`:565`** `fillStage1Presence` / **`:570`** `miss.size` / **`:571`** retry `collect` | |
| `fillStage1Presence` silent at `:637-638` | **`:679-680`** | |
| `searchStage1` db warning `:672-675` | **`:714-717`**, push at **`:716`** | **`:672` is now `fillStage1Presence`'s parameter list** |

That last row is the trap: applying the named BEFORE at `:672` **corrupts a different
function**. It is the single most likely way to break this layer.

Also stale: §4.1's `runMemorySearch` BEFORE is not byte-for-byte — the current
`:158-159` still carries the `searchChat` injection comments, and the PRD's AFTER
would silently delete them. §5.2's test range `:70-79` is `:71-79` (`:70` is blank),
and `index.test.ts:215-231` is `:216-232`. §6.4's "`npm test` exits 0" is replaced by
the `002` gate.

### A.2 The help check goes at the top of `main`, not inside the sub-commands

```ts
export function main(argv: string[]): number | Promise<number> {
  const kind = argv[0] ?? "help";
  const sub = argv[1] ?? "";
  if ((kind === "chat" || kind === "memory") && sub === "search") { ... }
  if (kind === "chat" && sub === "index") {
    return runChatIndex(argv.slice(2));
  }
```

`wantsHelp(argv)` must answer **before** `kind`/`sub` are dispatched. The ingest path,
read from the code and deliberately NOT executed because running it would ingest:
`main:253-254` → `runChatIndex` → `--help` silently dropped by `strict: false`
(`cli.ts:89`, no `help` option declared) → `statusOnly` false (`:176`) → `openIndex`
(`:177`) → `ingest(home, db, 0)` (`:182-183`).

### A.3 Do not copy the prior art

`orchestrate-cli.ts:168-169` `isHelpToken` and `freeze-cli.ts:65` both treat the bare
word `help` as a help request via `argv.some`. Copying either would make
`memory search help` print usage instead of searching for the word "help". The PRD's
`--help`/`-h`-only `wantsHelp` is the correct shape. Keep it.

### A.4 What the warnings actually look like after L2

- The only db-missing push to move is **`memory-search.ts:716`, inside `searchStage1`
  (declared at `:702`)**.
- `fillStage1Presence` (`:671`) is already silent at `:679-680`. `listMarkdownFiles`
  (`:245`) is already silent at `:246`.
- There is **no** "memories root not found" warning yet. Add it once, in
  `searchMemory` after `:453`.
- The duplicate the issue reports comes from **two `searchStage1` calls** (`:557`
  then the relaxed retry at `:571`), not from two `listMarkdownFiles` calls. Dedupe
  at the source of the second call, not by filtering the warnings array.

### A.5 Current behaviour, read from the code

| command | today |
|---|---|
| `cxc chat index --help` | full ingest, prints `ingested ...`, creates the default sidecar |
| `memory search foo --cwd-only --json` | `--cwd-only` swallows `--json`; `cwd: "--json"`, `cwdOnly: true`, JSON never enabled, **exit 0**, text output |
| `memory search foo --home <missing>` | no `existsSync` check, **exit 0**, no root warning, db warning **twice** because `foo` is SHORT_ASCII and triggers the relaxed retry |

