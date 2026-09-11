# 010 — wp2 / L1: cwd normalization parity (scan + index) — #138

Date: 2026-09-11 (KST). Checkout `codex/memory-recall-roadmap` at `6aae1c97`. Docs only; no production patch in this work-phase.
Issue: https://github.com/lidge-jun/codexclaw/issues/138
Layer branch (next work-phase): `codex/fix-recall-cwd-normalization`, base `codex/memory-recall-roadmap`.
Roadmap: `000_plan.md` wp2 / L1 / c-2.
Every path:line below was re-read on this tree; issue #138 quoted 0.2.24 numbers and they still match, with one snippet omission recorded in §3.

## 1. Purpose and scope

### Thesis

`cwd` normalization must be identical on the scan path and the index path. It must strip the Windows extended-length prefix `\\?\` / `//?/` and the extended UNC prefix `\\?\UNC\` / `//?/UNC/`, and `FOLD_CWD_CASE` must include `win32` as well as `darwin`. A `repo_key` NULL (non-git) fixture is mandatory because a git clone hides the bug behind the `repo_key` OR branch.

### IN

1. `normalizeCwd` becomes the single JS authority: slash-fold, strip extended-length and extended-UNC prefixes, drop trailing slashes, uppercase a leading drive letter. Path case is still not folded here.
2. New helper `canonicalCwdSql(expr)` (does not exist today — create it) emits the SQL twin of `normalizeCwd`. `RwDb` has no `function()` (`sqlite.ts:19-23`), so do not invent a SQLite UDF.
3. New helper `foldCwdCaseFor(platform)` (does not exist today — create it). `FOLD_CWD_CASE` becomes `foldCwdCaseFor(process.platform)` and is true on `darwin` and `win32`, false on `linux`.
4. Index SQL (`index-search.ts` `candidateFilter`) and cwd injection SQL (`cwd-context.ts` `listCwdSessions`) compare `canonicalCwdSql(<column>)` against `normalizeCwd(queryCwd)` so `--no-refresh` against an already-ingested raw `files.cwd` answers the same as scan.
5. Regression tests with `repo_key` NULL sessions for extended-length cwd, separator mismatch, and case-differing cwd. Index hits must equal scan hits.

### OUT

- Do not rewrite stored `files.cwd` at ingest (`ingest.ts:138`, `ingest.ts:159` keep `meta.cwd` as recorded). Displayed `hit.cwd` stays raw. Query-time canonicalization is what makes `--no-refresh` work.
- Do not bump `INDEX_SCHEMA_VERSION` (`index-db.ts:18` is `"2"`).
- Do not change `cwd-context` from exact-cwd to prefix match. Index search stays prefix-aware (`s === p || s.startsWith(p + "/")`); injection stays exact.
- Do not touch `hook.ts`, `cli.ts`, `chat-search.ts`, `ingest.ts`, `provider-bridge`, `session-binding`, `config-guard`, `source-identity`, `session-source`.
- Do not implement #142/#143 (L2), #139/#140 (L3), #144 (L4), #137 (L5), #135/#136/#141 (L6).
- Do not edit `memory-search.ts` in this layer — not production code, not comments, not imports. L1 is not a writer of that file. L2 and L3 are its only writers. Do not leave an L1 hook for a later layer to re-splice. Scan-path coverage for this layer is tests in `cwd-scope.test.ts` (§6.1) that call `searchMemory` against the existing `normalizeCwd` + `cwdMatches(..., { caseInsensitive: FOLD_CWD_CASE })` wiring.

## 2. Current code (this checkout)

### 2.1 `normalizeCwd` does not strip extended-length / UNC prefixes

`plugins/codexclaw/components/recall/src/rollout.ts:76-114`:

```ts
/**
 * Canonical form for comparing two working directories.
 *
 * Separators fold to "/" and a trailing one is dropped, so a path stored by a
 * POSIX session and the same path typed with backslashes compare equal. Drive
 * letters upper-case because Windows reports them either way for one directory.
 * Case is otherwise preserved: macOS and Linux both host case-sensitive paths,
 * and folding them would let /Repo match /repo.
 */
export function normalizeCwd(cwd: string): string {
  const unified = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-z]:/.test(unified) ? unified[0].toUpperCase() + unified.slice(1) : unified;
}

export function cwdMatches(
  sessionCwd: string,
  prefix: string,
  opts?: { caseInsensitive?: boolean },
): boolean {
  const fold = opts?.caseInsensitive === true;
  const s0 = normalizeCwd(sessionCwd);
  const p0 = normalizeCwd(prefix);
  const s = fold ? s0.toLowerCase() : s0;
  const p = fold ? p0.toLowerCase() : p0;
  return s === p || s.startsWith(`${p}/`);
}

/** macOS volumes are case-insensitive by default; Linux and Windows are handled as before. */
export const FOLD_CWD_CASE = process.platform === "darwin";
```

Scan already goes through this pair: `cwdMatches` at `chat-search.ts:322`, `memory-search.ts:354-356`, `hook.ts:517`. A recorded `\\?\C:\\Users\\...` becomes `//?/C:/Users/...`; a user-typed `C:\\Users\\...` becomes `C:/Users/...`; `cwdMatches` is false.

`readRolloutMeta` stores cwd raw (`rollout.ts:202`: `cwd: typeof p.cwd === "string" ? p.cwd : null`). Ingest writes that raw value into `files.cwd` (`ingest.ts:138` and `ingest.ts:159`).

### 2.2 Index SQL compares raw `opts.cwd` to raw `f.cwd`

`plugins/codexclaw/components/recall/src/index-search.ts:27` imports `FOLD_CWD_CASE` only — not `normalizeCwd`.

`index-search.ts:237-259` (`candidateFilter`), used by both `rankedRows` (`:320`, `:337`) and `queryIndex` (`:379`):

```ts
  if (opts.cwd) {
    // Separator-aware prefix: exact cwd, or a child path under it on either
    // separator style — /repo must never match /repo2.
    const parts = [
      // macOS folds path case (see rollout.ts FOLD_CWD_CASE); elsewhere the
      // exact comparison stays byte-exact as before.
      FOLD_CWD_CASE ? "lower(f.cwd) = lower(?)" : "f.cwd = ?",
      "f.cwd LIKE ? ESCAPE '\\'",
      "f.cwd LIKE ? ESCAPE '\\'",
    ];
    // Backslash separator must itself be escaped under ESCAPE '\\': pattern "\\\\%".
    params.push(opts.cwd, `${escapeLike(opts.cwd)}/%`, `${escapeLike(opts.cwd)}\\\\%`);
    if (opts.repoKey && opts.hasRepoKeyColumn) {
      parts.push("(f.repo_key IS NOT NULL AND f.repo_key = ?)");
      params.push(opts.repoKey);
    }
    if (opts.repoThreadIds.length > 0) {
      parts.push(`f.thread_id IN (${opts.repoThreadIds.map(() => "?").join(",")})`);
      params.push(...opts.repoThreadIds);
    }
    conds.push(`(${parts.join(" OR ")})`);
  }
```

Issue #138 measured (`--no-refresh --days 0`, query `lidgejun`, cwd `C:\\Users\\super\\Developers`, `repo_key` NULL): index + `C:/Users/super/Developers` → 0 hits; index + `C:\\Users\\super\\Developers` → 4 hits; scan + either separator → 4 hits. `lower(f.cwd)` does not slash-fold or strip `\\?\`.

`chat-search.ts:241` forwards `cwd: opts.cwd ?? null` into `queryIndex` unnormalized. After this layer, `candidateFilter` normalizes; `chat-search.ts` stays untouched. `normalizeCwd` is idempotent.

### 2.3 Injection SQL is exact raw `cwd = ?`

`plugins/codexclaw/components/recall/src/cwd-context.ts:15` imports `FOLD_CWD_CASE` only.

`cwd-context.ts:110-131`:

```ts
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
      const ids = sameOriginThreadIds(opts.home ?? codexHome(), repoKey);
      if (ids.length > 0) {
        conds.push(`thread_id IN (${ids.map(() => "?").join(",")})`);
        params.push(...ids);
      }
    }
```

Exact match, not prefix. Keep that. On a non-git workspace `repoKey` is null, so the OR list is only `cwd = ?` (plus `lower` on darwin). `\\?\` vs `C:\\` is then a total miss — the issue's 0-hit case.

### 2.4 Memory search already uses the JS pair

`memory-search.ts:15` imports `cwdMatches, normalizeCwd, FOLD_CWD_CASE`.
`memory-search.ts:315`: `const prefix = normalizeCwd(absolute ? raw : resolve(raw));`
`memory-search.ts:354-356`:

```ts
  const cwdHit =
    hitCwd !== null && hitCwd !== "" && cwdMatches(hitCwd, scope.prefix, { caseInsensitive: FOLD_CWD_CASE });
  if (cwdHit || repoKeysEqual(scope.repoKey, hitRepoKey)) return { keep: true, bonus: CWD_BOOST };
```

Once `normalizeCwd` strips prefixes and `FOLD_CWD_CASE` includes win32, this path is correct with no further production edit. Pin it with a `repo_key` NULL + `\\?\` fixture in `cwd-scope.test.ts`.

### 2.5 Why a git clone hides the bug

`cwdHit || repoKeysEqual(scope.repoKey, hitRepoKey)` (`memory-search.ts:356`), the same OR in `chat-search.ts:322-323`, and the SQL `f.repo_key = ?` / `thread_id IN (...)` branches (`index-search.ts:249-258`, `cwd-context.ts:119-131`). A clone with an origin still matches via repo_key even when cwd canonicalization fails. The regression fixture must pass `readOriginUrl: () => null` and omit `payload.git` so `files.repo_key` is NULL.

## 3. Issue #138 vs this tree

| Claim in #138 | This tree | Verdict |
|---|---|---|
| `rollout.ts` L85-87 `normalizeCwd` | `rollout.ts:85-88` (body `:86-87`) | Match |
| `FOLD_CWD_CASE` L113-114 darwin-only | `rollout.ts:113-114` | Match |
| `memory-search.ts` L354-356 `cwdMatches` | `memory-search.ts:354-356` | Match |
| `cwd-context.ts` L113-117 `cwd = ?` / `lower` | `cwd-context.ts:113-118` | Match (block ends `:118`) |
| `index-search.ts` L237-248 raw `opts.cwd` | `index-search.ts:237-259` | Line range is the cwd filter; the issue snippet omitted the `FOLD_CWD_CASE ? lower(f.cwd)=lower(?) : f.cwd=?` ternary now at `:240-246`. Params at `:248` are still raw `opts.cwd`. No `normalizeCwd` import. |

No line-number drift that would mislead an implementer. The omitted ternary does not fix #138: `lower()` does not slash-fold or strip `\\?\`.

Comment drift inside the tree: `normalizeCwd` at `rollout.ts:82-83` says macOS paths are case-sensitive; `FOLD_CWD_CASE` at `:113` says the opposite (and is the one call sites honor). Fix the `normalizeCwd` comment in this layer so it no longer contradicts.

## 4. Design

### 4.1 Prefix rules (authoritative)

Apply in this order inside `normalizeCwd` (SQL twin must match exactly):

1. Replace every `\\` with `/`.
2. `rtrim` `/`.
3. If the string starts with `//?/UNC/` (ASCII case-insensitive on the `UNC` token), replace that 8-character prefix with `//`. Example: `\\?\\UNC\\server\\share\\proj` → `//server/share/proj`.
4. Else if it starts with `//?/`, drop those 4 characters. Example: `\\?\\C:\\Users\\super\\Developers` → `C:/Users/super/Developers`.
5. `rtrim` `/` again.
6. If the result matches `/^[a-z]:/`, uppercase the drive letter only.

Do not strip a regular UNC `\\server\\share` — that *is* the path. Do not strip `\\.\\` device-namespace paths (not in #138). `normalizeCwd` must be idempotent: `normalizeCwd(normalizeCwd(x)) === normalizeCwd(x)`.

Path case stays in `FOLD_CWD_CASE` / `cwdMatches({ caseInsensitive })` / SQL `lower()`. Do not fold path case inside `normalizeCwd` (existing test at `cwd-scope.test.ts:423-429` must keep passing).

### 4.2 `foldCwdCaseFor` (create)

```ts
export function foldCwdCaseFor(platform: string): boolean {
  return platform === "darwin" || platform === "win32";
}
export const FOLD_CWD_CASE = foldCwdCaseFor(process.platform);
```

`FOLD_CWD_CASE` is a module const, so Linux CI cannot mock `process.platform`. Tests of the predicate go through `foldCwdCaseFor("win32")` etc. Runtime call sites keep using `FOLD_CWD_CASE`.

This is a widening on Windows: previously-missed sessions start matching. Pin previously-matching cases so nothing drops (`000_plan.md` risk register).

### 4.3 `canonicalCwdSql` (create)

`RwDb` (`sqlite.ts:19-23`) is `{ prepare, exec, close }`. Do not add `function()` / a UDF. Put the SQL twin next to `normalizeCwd` in `rollout.ts` so index-search and cwd-context cannot drift:

```ts
/** SQL expression mirroring normalizeCwd. `expr` is a column or already-bound SQL expression — never a bind placeholder (`?`). */
export function canonicalCwdSql(expr: string): string {
  const slashed = `rtrim(replace(${expr}, '\\', '/'), '/')`;
  const stripped = `(CASE WHEN substr(${slashed}, 1, 8) LIKE '//?/UNC/' THEN '//' || substr(${slashed}, 9) WHEN substr(${slashed}, 1, 4) = '//?/' THEN substr(${slashed}, 5) ELSE ${slashed} END)`;
  const trimmed = `rtrim(${stripped}, '/')`;
  return `(CASE WHEN ${trimmed} GLOB '[a-z]:*' THEN upper(substr(${trimmed}, 1, 1)) || substr(${trimmed}, 2) ELSE ${trimmed} END)`;
}
```

Notes for the implementer:

- `expr` must NOT be a bind placeholder. Pass a column (`f.cwd`, `cwd`) or a subquery alias (`v`). The helper interpolates `expr` once per CASE/substr/rtrim arm (~12 times); `canonicalCwdSql("?")` therefore emits ~12 `?` slots. To bind a JS value, wrap once: `SELECT ${canonicalCwdSql("v")} AS n FROM (SELECT ? AS v)`.
- SQLite `LIKE` treats `?` as a literal (wildcards are `%` and `_`). Do not use `GLOB` for the `//?/` prefix — `GLOB` `?` is a single-character wildcard.
- `LIKE '//?/UNC/'` with no wildcards is ASCII case-insensitive, matching JS `/^\/\/\?\/unc\//i`.
- `GLOB '[a-z]:*'` is case-sensitive, matching JS `/^[a-z]:/`.
- JS `\\` in `'\\'` produces SQL `'\'` (one backslash). SQLite does not backslash-escape string literals.
- `substr` is 1-based: JS `slice(8)` == SQL `substr(_, 9)`.

Lock with a `node:sqlite` `:memory:` parity loop: for every fixture input `q`, `db.prepare(`SELECT ${canonicalCwdSql("v")} AS n FROM (SELECT ? AS v)`).get(q).n` equals `normalizeCwd(q)`. One bind. A test that passes `"?"` as `expr` throws on bind-count even after the helper exists — that is not a parity failure.

### 4.4 Index comparison after canonicalization

After both sides are slash-folded, the extra `f.cwd LIKE <cwd>\\%` branch is redundant. Replace the three-part raw comparison with two parts on the canonical form: equality, and `LIKE <canonical>/%`. `/repo` must still never match `/repo2`.

When `FOLD_CWD_CASE` is true, wrap both sides in `lower()` / bind a lowercased LIKE pattern. When false (linux), compare the canonical strings as-is.

Keep the `repo_key` and `thread_id IN` OR branches unchanged.

### 4.5 cwd-context comparison

Bind `normalizeCwd(cwd)`. Compare `canonicalCwdSql("cwd")` for exact equality (plus `lower` when `FOLD_CWD_CASE`). Drop the redundant raw `cwd = ?` OR `lower(cwd) = lower(?)` pair. Do not add prefix LIKE here.

## 5. Changes

### 5.1 MODIFY `plugins/codexclaw/components/recall/src/rollout.ts`

Replace `rollout.ts:76-114` with:

```ts
/**
 * Canonical form for comparing two working directories.
 *
 * Separators fold to "/", a trailing one is dropped, and Windows extended-length
 * prefixes (`\\?\` / `//?/` and `\\?\UNC\` / `//?/UNC/`) are stripped so a
 * session recorded as `\\?\C:\\Users\\...` compares equal to a caller-typed
 * `C:\\Users\\...`. Drive letters upper-case because Windows reports them either
 * way for one directory. Path case is otherwise preserved: callers that need a
 * case-insensitive volume (`darwin`, `win32`) pass `FOLD_CWD_CASE` into
 * `cwdMatches` or wrap the SQL twin in `lower()`.
 */
export function normalizeCwd(cwd: string): string {
  let unified = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  if (/^\/\/\?\/unc\//i.test(unified)) {
    unified = `//${unified.slice(8)}`;
  } else if (unified.startsWith("//?/")) {
    unified = unified.slice(4);
  }
  unified = unified.replace(/\/+$/, "");
  return /^[a-z]:/.test(unified) ? unified[0].toUpperCase() + unified.slice(1) : unified;
}

/** SQL expression mirroring `normalizeCwd`. `expr` is a column or SQL expression, never a bind placeholder (`?`). */
export function canonicalCwdSql(expr: string): string {
  const slashed = `rtrim(replace(${expr}, '\\', '/'), '/')`;
  const stripped = `(CASE WHEN substr(${slashed}, 1, 8) LIKE '//?/UNC/' THEN '//' || substr(${slashed}, 9) WHEN substr(${slashed}, 1, 4) = '//?/' THEN substr(${slashed}, 5) ELSE ${slashed} END)`;
  const trimmed = `rtrim(${stripped}, '/')`;
  return `(CASE WHEN ${trimmed} GLOB '[a-z]:*' THEN upper(substr(${trimmed}, 1, 1)) || substr(${trimmed}, 2) ELSE ${trimmed} END)`;
}

/**
 * Separator-aware cwd prefix test: /repo matches /repo and /repo/x, never
 * /repo2. Both sides are normalized first, so the comparison does not depend on
 * which platform recorded the session or which separator the caller typed.
 *
 * `caseInsensitive` is opt-in per call site. The default stays case-sensitive
 * because Linux paths are, while macOS and Windows ship case-insensitive volumes
 * by default.
 */
export function cwdMatches(
  sessionCwd: string,
  prefix: string,
  opts?: { caseInsensitive?: boolean },
): boolean {
  const fold = opts?.caseInsensitive === true;
  const s0 = normalizeCwd(sessionCwd);
  const p0 = normalizeCwd(prefix);
  const s = fold ? s0.toLowerCase() : s0;
  const p = fold ? p0.toLowerCase() : p0;
  return s === p || s.startsWith(`${p}/`);
}

/** macOS and Windows volumes are case-insensitive by default; Linux is not. */
export function foldCwdCaseFor(platform: string): boolean {
  return platform === "darwin" || platform === "win32";
}
export const FOLD_CWD_CASE = foldCwdCaseFor(process.platform);
```

`cwdMatches` body is unchanged; it inherits prefix stripping from `normalizeCwd`.

### 5.2 MODIFY `plugins/codexclaw/components/recall/src/index-search.ts`

Import (today `:27` is `import { FOLD_CWD_CASE } from "./rollout.ts";`):

```ts
import { FOLD_CWD_CASE, normalizeCwd, canonicalCwdSql } from "./rollout.ts";
```

Replace `index-search.ts:237-259` with:

```ts
  if (opts.cwd) {
    // Canonical prefix: exact cwd or a child under it. /repo must never match
    // /repo2. Both sides go through the same normalizeCwd / canonicalCwdSql pair
    // as the scan path (cwdMatches), including \\?\ and UNC prefix stripping.
    const cwd = normalizeCwd(opts.cwd);
    const col = canonicalCwdSql("f.cwd");
    const eq = FOLD_CWD_CASE ? `lower(${col}) = lower(?)` : `${col} = ?`;
    const like = FOLD_CWD_CASE ? `lower(${col}) LIKE ? ESCAPE '\\'` : `${col} LIKE ? ESCAPE '\\'`;
    const parts = [eq, like];
    params.push(cwd, `${escapeLike(FOLD_CWD_CASE ? cwd.toLowerCase() : cwd)}/%`);
    if (opts.repoKey && opts.hasRepoKeyColumn) {
      parts.push("(f.repo_key IS NOT NULL AND f.repo_key = ?)");
      params.push(opts.repoKey);
    }
    if (opts.repoThreadIds.length > 0) {
      parts.push(`f.thread_id IN (${opts.repoThreadIds.map(() => "?").join(",")})`);
      params.push(...opts.repoThreadIds);
    }
    conds.push(`(${parts.join(" OR ")})`);
  }
```

The backslash `LIKE` branch is gone because the canonical form is slash-only. `escapeLike` (`index-search.ts:160-162`) stays.

### 5.3 MODIFY `plugins/codexclaw/components/recall/src/cwd-context.ts`

Import (today `:15` is `import { isSyntheticUserText, FOLD_CWD_CASE } from "./rollout.ts";`):

```ts
import { isSyntheticUserText, FOLD_CWD_CASE, normalizeCwd, canonicalCwdSql } from "./rollout.ts";
```

Replace `cwd-context.ts:110-118` with:

```ts
    const repoKey = repoKeyForCwd(cwd, opts.readOriginUrl ?? readOriginUrl);
    const canonical = normalizeCwd(cwd);
    const col = canonicalCwdSql("cwd");
    const conds: string[] = [FOLD_CWD_CASE ? `lower(${col}) = lower(?)` : `${col} = ?`];
    const params: unknown[] = [canonical];
```

Leave the `repoKey !== null` block (`cwd-context.ts:119-131`) unchanged.

### 5.4 `plugins/codexclaw/components/recall/src/memory-search.ts` — L1 does not write this file

Already wired via `normalizeCwd` + `cwdMatches(..., { caseInsensitive: FOLD_CWD_CASE })` (`memory-search.ts:354-356`). After the `rollout.ts` change, confirm the existing Windows separator tests in `cwd-scope.test.ts` (`:375-421`) still pass, and add the `\\?\` / `repo_key` NULL cases in §6.1. Those tests call `searchMemory`; they do not justify an L1 edit here. L2 and L3 are the only writers of this file. Do not add a comment, import, re-export, or no-op so a later layer can "finish" an L1 splice.

### 5.5 Dist

`npm run build` rewrites `plugins/codexclaw/components/recall/dist/rollout.js`, `index-search.js`, `cwd-context.js`. Those dist files are tracked (`000_plan.md` Constraints). No new source file, so no `git add -f` of a new dist path.

## 6. Regression tests

Convention: `plugins/codexclaw/components/recall/test/*.test.ts`, `node:test` + `node:assert/strict`, isolated `mkdtempSync` homes, `readOriginUrl: () => null` for the non-git pin. Runner: `plugins/codexclaw/scripts/test.mjs`.

Do not add these cases to the shared `buildCodexHome` fixture (`fixtures.ts`) — that origin-bearing `/proj/alpha` corpus would re-introduce the `repo_key` OR hide.

### 6.1 EXTEND `plugins/codexclaw/components/recall/test/cwd-scope.test.ts`

Add to the import at `:15`: `canonicalCwdSql, foldCwdCaseFor`. Keep the existing `normalizeCwd folds separators...` test (`:423-429`).

**Test name:** `normalizeCwd strips extended-length and extended-UNC prefixes`

| Input | Expected |
|---|---|
| `\\\\?\\C:\\Users\\super\\Developers` | `C:/Users/super/Developers` |
| `//?/C:/Users/super/Developers` | `C:/Users/super/Developers` |
| `\\\\?\\C:\\Users\\super\\Developers\\` | `C:/Users/super/Developers` |
| `c:\\Users\\super\\Developers` | `C:/Users/super/Developers` |
| `C:/Users/super/Developers/` | `C:/Users/super/Developers` |
| `\\\\?\\UNC\\server\\share\\proj` | `//server/share/proj` |
| `//?/UNC/server/share/proj` | `//server/share/proj` |
| `//?/unc/server/share/proj` | `//server/share/proj` |
| `\\\\server\\share\\proj` | `//server/share/proj` |
| `/proj/here/` | `/proj/here` |

Also assert idempotence on each row. Assert `normalizeCwd("/Proj/Here") !== normalizeCwd("/proj/here")` still holds.

**Why it fails today:** `normalizeCwd("\\\\?\\C:\\Users\\super\\Developers")` returns `//?/C:/Users/super/Developers` (`rollout.ts:86-87`).

**Test name:** `canonicalCwdSql matches normalizeCwd on the prefix matrix`

Input: the same rows, plus `""`. Open `new DatabaseSync(":memory:")` (already imported at `:13`). For each input `q`, `db.prepare(`SELECT ${canonicalCwdSql("v")} AS n FROM (SELECT ? AS v)`).get(q).n === normalizeCwd(q)`. Single bind of `q`. Never `canonicalCwdSql("?")` — that interpolates ~12 `?` slots and throws even after the helper exists.

**Why it fails today:** `canonicalCwdSql` does not exist (implementer creates it in §5.1). After it exists, any JS/SQL drift fails this test. A bind-count throw from passing `"?"` as `expr` is a bad test, not missing helper.

**Test name:** `foldCwdCaseFor is true on darwin and win32, false on linux`

```ts
assert.equal(foldCwdCaseFor("darwin"), true);
assert.equal(foldCwdCaseFor("win32"), true);
assert.equal(foldCwdCaseFor("linux"), false);
```

**Why it fails today:** helper missing; current `FOLD_CWD_CASE` is `process.platform === "darwin"` (`rollout.ts:114`).

**Test name:** `cwdMatches treats \\?\\ recorded cwd as the same directory as a typed C:\\ path`

Input: session `\\\\?\\C:\\proj\\here`, prefix `C:\\proj\\here`. Expected: `cwdMatches` true (default options — prefix stripping, not case folding). Sibling `C:\\proj\\here2` false. Child `\\\\?\\C:\\proj\\here\\sub` vs prefix `C:\\proj\\here` true.

**Why it fails today:** after current `normalizeCwd`, `//?/C:/proj/here` vs `C:/proj/here`.

**Test name:** `memory --cwd-only with a \\?\\ recorded cwd and repo_key NULL keeps the hit`

Build a temp home the way `drive-lettered paths compare...` does (`cwd-scope.test.ts:400-421`): one summary file with `cwd: \\\\?\\C:\\proj\\here` (literal backslashes in the markdown), body contains `numbat`, no git origin involved (memory summaries do not carry repo_key; pass `readOriginUrl: () => null` anyway). Query `searchMemory("numbat", { home, cwd: "C:\\proj\\here", cwdOnly: true, readOriginUrl: () => null })`.

Expected: `hits.length === 1`. Sibling cwd `C:\\proj\\here2` → 0.

**Why it fails today:** `cwdMatches` on the recorded `\\?\` cwd returns false, so `cwdOnly` drops the only hit (`memory-search.ts:354-359`). There is no repo_key OR to hide it.

### 6.2 EXTEND `plugins/codexclaw/components/recall/test/index.test.ts`

Follow the isolated-home pattern at `index.test.ts:266-319` (`chat --cwd reaches another checkout...`), but **omit** `payload.git` and pass `readOriginUrl: () => null`.

Shared fixture for the next three tests (inline or a local helper in this file):

- Temp `CODEX_HOME` with one `sessions/YYYY/MM/DD/rollout-*.jsonl`.
- `session_meta.payload.cwd` = `\\\\?\\C:\\Users\\super\\Developers` (the form on this machine).
- No `payload.git`.
- One user message containing the unique token `lidgejun` (the #138 probe word).
- Ingest into a sidecar index, then query with `noRefresh: true` so the test exercises query-time SQL, not a rewritten ingest.
- `readOriginUrl: () => null`.

**Test name:** `index and scan agree on an extended-length cwd when repo_key is NULL`

Queries (each engine): `cwd` = `C:\\Users\\super\\Developers` and `cwd` = `C:/Users/super/Developers`, `scan: false, noRefresh: true` vs `scan: true`, query `lidgejun`.

Red (parent tip): index + slash → 0; scan + either separator → 0 against this `\\?\` recorded cwd (bug (a) scan does not strip `\\?\`; bug (b) index does not slash-fold). Sibling `C:\\Users\\super\\Developers2` → 0 on both engines (unchanged). Do not encode the parent-tip 0-hit as this layer's test Expected.

Green (this layer tip): all four calls return exactly 1 hit; `hit.cwd` remains the raw recorded string `\\\\?\\C:\\Users\\super\\Developers` (ingest is not rewritten); sibling `cwd: "C:\\Users\\super\\Developers2"` returns 0 on both engines.

**Why it fails today:** `normalizeCwd` does not strip `\\?\` (`rollout.ts:86-87`); `candidateFilter` binds raw `opts.cwd` (`index-search.ts:248`).

**Test name:** `index and scan agree on separator mismatch when repo_key is NULL`

Same helper, but record cwd as `C:\\Users\\super\\Developers` (no `\\?\`, matching the #138 index measurement). Query with `C:/Users/super/Developers` and `C:\\Users\\super\\Developers`.

Red (parent tip): index + slash → 0; index + backslash → 1; scan + either → 1.

Green (this layer tip): index and scan both 1 for both spellings. Do not encode the parent-tip index+slash 0-hit as this layer's test Expected.

**Why it fails today:** index + slash → 0; index + backslash → 1; scan + either → 1 (`index-search.ts:248` raw bind).

**Test name:** `index and scan agree on a case-differing cwd when repo_key is NULL`

Record cwd `C:\\Users\\super\\Developers`. Query `c:\\users\\super\\developers`.

Red (parent tip, including win32): both engines miss — `FOLD_CWD_CASE` is darwin-only (`rollout.ts:114`).

Green (this layer tip):

- `viaIndex(...).hits` mapped by `(ts, text, cwd)` equals `viaScan(...).hits` (parity on every host).
- If `FOLD_CWD_CASE` (import from `../src/rollout.ts`): both lengths === 1.
- Else: both lengths === 0.

Drive-letter-only difference (`c:\\Users\\...` vs recorded `C:\\Users\\...`) already matches today via `normalizeCwd`'s drive uppercasing (`rollout.ts:87`) on the scan path; the path-case difference (`Users` vs `users`) is the win32/darwin widening. Linux CI must see a miss on **both** engines, not a miss on one.

**Why it fails today:** on win32, `FOLD_CWD_CASE` is false (`rollout.ts:114`), so both engines miss (scan via `cwdMatches` without fold; index via byte-exact `f.cwd = ?`). After the fix, win32 hits on both. On linux, still miss on both — the green `FOLD_CWD_CASE` branch documents that.

Coverage limitation: Linux CI never executes the `FOLD_CWD_CASE` SQL `lower()` branch (`index-search.ts` `eq`/`like`, `cwd-context.ts` equality). `foldCwdCaseFor("win32")` is unit-tested on every host; win32 case folding through SQL `lower(canonicalCwdSql(...))` is only proven on Windows. Prove it on this machine after L1 with:

```
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/recall/test/index.test.ts plugins/codexclaw/components/recall/test/cwd-context.test.ts
```

Proof: exit 0; `index and scan agree on a case-differing cwd when repo_key is NULL` and `listCwdSessions case-fold follows FOLD_CWD_CASE when repo_key is NULL` pass while `FOLD_CWD_CASE === true`. Quote that output in the layer receipt. A Linux-CI green on the `else both lengths === 0` branch does not prove the SQL `lower()` path.

Also re-run the existing oracle `trigram` + `cwd: "/proj/alpha"` (`index.test.ts:59`) to prove the widening does not drop POSIX fixtures.

### 6.3 EXTEND `plugins/codexclaw/components/recall/test/cwd-context.test.ts`

Do not overload the `test.before` home at `:59` (it has origin-bearing sessions). Add a self-contained test with its own temp home, modeled on `excerpts are single-line...` (`:177`).

**Test name:** `listCwdSessions matches a \\?\\ recorded cwd with repo_key NULL`

Input: one rollout, `cwd: "\\\\?\\C:\\proj\\here"`, no `repositoryUrl`, user text `wire the hook budget to the compaction source`. Ingest. Call `listCwdSessions("C:\\proj\\here", 5, { indexPath, home, readOriginUrl: () => null })`.

Expected: length 1, excerpt is that user text. `listCwdSessions("C:\\proj\\here2", ...)` → `[]`. `listCwdSessions("//?/C:/proj/here", ...)` → length 1.

**Why it fails today:** `cwd = ?` binds the caller string against raw `files.cwd` (`cwd-context.ts:113-114`); no repo_key OR.

**Test name:** `listCwdSessions case-fold follows FOLD_CWD_CASE when repo_key is NULL`

Record `C:\\proj\\here`. Query `c:\\proj\\HERE`. Expected: length 1 iff `FOLD_CWD_CASE`, else `[]`. No origin reader.

**Why it fails today:** win32 does not enter the `lower(cwd)` branch (`cwd-context.ts:115-117`).

Existing tests at `:121-169` (basename miss, other directory, federation, different remote) must still pass — federation remains origin-based and is not this layer's contract.

## 7. Verification

From repo root `C:/Users/super/.codex/worktrees/b74b/codexclaw`.

Red on parent tip (this branch, before the production patch):

```
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/recall/test/cwd-scope.test.ts plugins/codexclaw/components/recall/test/index.test.ts plugins/codexclaw/components/recall/test/cwd-context.test.ts
```

Proof of red: the new test names in §6 fail with the assertions in "Why it fails today". A layer whose new tests never ran red is not proven (`000_plan.md` Verification contract).

Green at L1 tip:

```
npm run build
```

Proof: exit 0; `plugins/codexclaw/components/recall/dist/rollout.js` contains the prefix-strip and `foldCwdCaseFor`.

```
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/recall/test/cwd-scope.test.ts plugins/codexclaw/components/recall/test/index.test.ts plugins/codexclaw/components/recall/test/cwd-context.test.ts
```

Proof: exit 0; output lists every §6 test name; 0 failures.

```
npm test
```

Proof: exit 0; the new names are visible in the recall shard; no regressions in `round2.test.ts` cwdMatches cases (`:111-114`) or `cwd-scope.test.ts` existing Windows separator tests (`:375-429`).

Windows live reproduction (this machine; #138 is a Windows bug). Query token `lidgejun`, `--no-refresh --days 0`, a `repo_key` NULL session. Before: index + `C:/Users/super/Developers` → 0. After: index and scan both return the same non-zero hit count for `C:/Users/super/Developers`, `C:\\Users\\super\\Developers`, and `\\\\?\\C:\\Users\\super\\Developers`. Quote the command output verbatim in the layer receipt. Use `--attest-file`, never inline JSON (`000_plan.md` Constraints).
Also run the case-folded query `c:\\users\\super\\developers` on this Windows machine (Linux CI never takes the SQL `lower()` branch; see §6.2 coverage limitation). After: same non-zero hit count as the three spellings above. Quote that output too.

## 8. What this layer must not touch

Production: `hook.ts`, `cli.ts`, `chat-search.ts`, `ingest.ts`, `index-db.ts` schema, `sqlite.ts`, `repo-key.ts`, `threads-db.ts`, `query-words.ts`, `synonyms.ts`.

Peer session `01a08fba` / Windows issue sweep: `provider-bridge/`, `session-binding.ts`, `config-guard/`, `source-identity.ts`, `session-source.ts`, the Windows landmine corpus.

This layer does not edit `memory-search.ts` at all. L2 (`020_wp3_memory_search_semantics.md`, #142+#143) and L3 are the only writers of that file (blank-line AND, `matchedThreadIds`, chat-fallback `synonyms`/`any`). Do not re-splice an L1 cwd-normalization change into it later — L1's scan-path proof is tests only.

This layer adds tests in `cwd-scope.test.ts`, `index.test.ts`, and `cwd-context.test.ts` (§6.1–§6.3).

L3/L4 own `cli.ts`. L4/L5 own `hook.ts`. L6 owns `pabcd-state`.

Below: L0 is this docs branch. Above: L2 bases on L1; `normalizeCwd` must already be the shared primitive before #142's thread bookkeeping re-verifies scoped fixtures (`000_plan.md` Ordering rationale).

Do not git commit, push, or switch branches in the docs-only pass. Do not open the L1 PR here (wp8).

## 9. Acceptance (c-2)

Layer is done when all of the following are true:

1. `normalizeCwd("\\\\?\\C:\\Users\\super\\Developers") === "C:/Users/super/Developers"` and `normalizeCwd("\\\\?\\UNC\\server\\share\\proj") === "//server/share/proj"`.
2. `foldCwdCaseFor("win32") === true` and `FOLD_CWD_CASE === (process.platform === "darwin" || process.platform === "win32")`.
3. `canonicalCwdSql` equals `normalizeCwd` on the §6.1 matrix via `node:sqlite`.
4. A `repo_key` NULL session recorded under `\\?\` is found by both index (`noRefresh`) and scan for slash and backslash queries; sibling path is not.
5. Index and scan hit sets are equal for a case-differing query against that NULL-key session; on win32/darwin they are non-empty, on linux they are empty.
6. Existing `/proj/alpha` oracle and `cwd-scope` Windows separator tests still pass.
7. `npm run build` and `npm test` exit 0.

## Amendment A — wp2 P revalidation (2026-09-11)

The PRD above was written during wp1 and audited three times. At wp2's P it was
re-verified against the tree by an independent `xai/grok-4.6` explorer. The tree has
not moved — `origin/dev` is still `a267b398` — so everything below is the PRD's own
imprecision, not drift. **Where this amendment disagrees with a section above, this
amendment governs.**

### A.1 The BEFORE blocks are not byte-for-byte — re-read before replacing

| PRD claim | Reality |
|---|---|
| §2.1 `rollout.ts:76-114` quotes `normalizeCwd` followed immediately by `export function cwdMatches` | A 10-line JSDoc sits between them at `rollout.ts:90-99`. The range is right; the quoted text is not complete. |
| §2.2 / §5.2 `index-search.ts:237-259` is the whole `if (opts.cwd)` block | The block closes at `:260`, and the BEFORE omits two ALTER comments now at `:254-255`. **A literal replace of 237-259 leaves a stray `}`.** |
| §2.3 / §5.3 "replace `cwd-context.ts:110-118`", starting at `const repoKey` | `:110-111` are comments; `const repoKey` is `:112`. The conditions to replace are `:112-118`; leave `:119-131` alone. The BEFORE also omits the wp4 comments at `:124-125`. |
| §2.3 "`cwd-context.ts:15` imports `FOLD_CWD_CASE` only" | `:15` is `import { isSyntheticUserText, FOLD_CWD_CASE } from "./rollout.ts";` |
| §3 "no line-number drift that would mislead an implementer" | False for the two rows above. |

**Rule for this layer: anchor on function and identifier names, re-read the current
lines, and never apply a range replace from this document without comparing it to
the file first.**

### A.2 Insertion point in `index-search.ts` — do not wrap the ternary

`index-search.ts:243` currently reads:

```ts
FOLD_CWD_CASE ? "lower(f.cwd) = lower(?)" : "f.cwd = ?"
```

Do not wrap or replace that ternary. Compute the canonical column once, then use it
in BOTH arms:

```ts
const col = canonicalCwdSql("f.cwd");
// exact:  FOLD_CWD_CASE ? `lower(${col}) = lower(?)` : `${col} = ?`
```

The same `col` must also replace the raw `f.cwd` in the LIKE arms at `:244-245`,
with `lower(...)` when folding. **The LIKE arms bypass the ternary today**, so a fix
that only touches the equality arm leaves child-path matching broken.

### A.3 The risk that will actually bite

Patching only the false arm (`f.cwd = ?`) because that is the arm win32 runs today.
The moment `foldCwdCaseFor` includes `win32`, this host starts taking
`lower(f.cwd) = lower(?)` against the raw stored cwd — so the `\\?\` strip and the
slash fold still miss and the layer looks fixed while staying broken. Both arms and
both LIKE patterns must go through `canonicalCwdSql`, and the regression must assert
a hit on THIS platform's arm as well as the other one.

### A.4 Confirmed unchanged

`canonicalCwdSql` and `foldCwdCaseFor` exist nowhere in `src` or `test`. `RwDb` still
exposes no `function()` hook (`sqlite.ts:19-23`), so the SQL twin remains the only
option — no SQLite UDF. `INDEX_SCHEMA_VERSION` is still `"2"` (`index-db.ts:18`).
`ingest.ts:138` and `:159` still store `meta.cwd` raw, which is what makes
query-time canonicalization necessary. All three target test files and their append
points still exist.

