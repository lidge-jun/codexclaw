# 020 — wp3 / L2: session-binding extended-length cwd (#134)

Layer: L2. Branch: `codex/fix-session-binding-extended-path`. Base: L1 (`codex/fix-ocx-windows-detect`).
Issue: #134. Criterion: **c-3** (`cxc session current` succeeds against an extended-length stored cwd).
This document is the copy-paste PRD for the implementation cycle. Docs-only now; no production patch in wp1.

Source truth (L1 head `1f34a30a`): `realpathSync` call sites in `session-binding.ts` are **`:31` and `:74`**, not the `:38`/`:78` pair in `000_plan.md` wp3. Dist matches src. Both were re-verified byte-for-byte at this head by an independent reviewer. Implement against the file.

## 1. Scope

IN

- `plugins/codexclaw/components/pabcd-state/src/session-binding.ts`: private `canonical()` copied from `session-source.ts`, used at both live `realpathSync` call sites.
- `plugins/codexclaw/components/pabcd-state/test/session-binding.test.ts`: fixture canonicalizes with `.native`; one new win32 test stores an extended-length cwd and drives both call sites plus `cxc session current`.
- `plugins/codexclaw/components/pabcd-state/dist/session-binding.js`: rebuild in the same commit (already tracked; plain `git add` restages).

OUT

- Exporting or sharing `canonical` with `session-source.ts`. Copy the private helper; do not create a third module.
- `worktree-guard.ts` `canonicalize()`. It walks missing paths up to an existing ancestor and returns a lexical join, which would convert the missing-cwd throw into a mismatch.
- 8.3 short-name fixtures (`RUNNER~1`). `session-source.ts` uses `.native` for 8.3; #134's observed form is the extended-length prefix. Native fixes both; the regression test covers the observed form only.
- `ROOT_SOURCES` at `session-binding.ts:10`. Rejecting subagent bindings stays.
- Any other file.

## 2. Change map

| file | NEW/MODIFY/DELETE | what | lines (approx) |
|---|---|---|---|
| `plugins/codexclaw/components/pabcd-state/src/session-binding.ts` | MODIFY | add private `canonical()`; replace `:31` and `:74` | +18 / -2 |
| `plugins/codexclaw/components/pabcd-state/test/session-binding.test.ts` | MODIFY | fixture `.native`; import `toNamespacedPath`; new extended-prefix test after the parent/sibling test | +40 / -1 |
| `plugins/codexclaw/components/pabcd-state/dist/session-binding.js` | MODIFY | `npm run build` output; do not hand-edit | compileSource of src |

No new `.ts` file, so no `git add -f`. Dist is already tracked (`git ls-files plugins/codexclaw/components/pabcd-state/dist/session-binding.js`).

## 3. Why these two sites, and why `.native`

Host fact: every native thread row on this machine stores `cwd` with the extended-length prefix (`\\?\\C:\\...`). JS `realpathSync` on that shape throws `EISDIR: illegal operation on a directory, lstat 'C:'`. `realpathSync.native` returns the ordinary absolute path. Confirmed on this host against `C:\\Users\\super\\Developers\\codexclaw`:

```
js(prefixed)     ERR EISDIR lstat 'C:'
native(prefixed) OK  C:\\Users\\super\\Developers\\codexclaw
```

`resolveNativeSession` canonicalises two strings and compares them. If either call uses JS `realpathSync`, a prefixed stored cwd (the live desktop case) or a prefixed live cwd dies in the `catch` and surfaces `Cannot resolve the native session's working directory.` — the #134 symptom. Both sites move together.

Do not reuse `worktree-guard.ts:54-77` `canonicalize()`. On a missing path it does not throw:

```ts
/** realpath when possible; otherwise realpath the nearest existing ancestor and
 *  append the remainder (symlink + macOS case-insensitive safety). */
export function canonicalize(p: string): string {
  const abs = resolve(p);
  try {
    return realpathSync.native(abs);
  } catch {
    // walk up to the nearest existing ancestor
    let cur = abs;
    const missing: string[] = [];
    while (true) {
      const parent = resolve(cur, "..");
      if (parent === cur) return abs; // filesystem root: give up, return lexical
      cur = parent;
      missing.unshift(abs.slice(cur.length + 1).split(sep)[0] ?? "");
      try {
        const real = realpathSync.native(cur);
        const rest = abs.slice(cur.length + 1);
        return rest ? join(real, rest) : real;
      } catch {
        // keep walking
      }
      if (missing.length > 64) return abs; // pathological depth guard
    }
  }
}
```

Copied from `plugins/codexclaw/components/pabcd-state/src/worktree-guard.ts:52-77`. That success-on-missing path would skip the `catch` at `session-binding.ts:77-78` and turn a missing row cwd into a mismatch string. The helper below throws, matching today's contract.

## 4. MODIFY `session-binding.ts`

### 4.1 Private `canonical()`, copied from `session-source.ts` (do not export)

Pattern to copy, not import. `session-source.ts:17-25`:

```ts
/**
 * Canonical absolute path. `realpathSync.native` expands Windows 8.3 short names
 * (`RUNNER~1`) that the JS implementation leaves intact; Git always reports the long
 * form, so comparing a short-name cwd against `rev-parse` output would refuse a
 * valid worktree (observed on windows-latest CI where TEMP is a short path).
 */
function canonical(path: string): string {
  return realpathSync.native(path);
}
```

Insert the sibling helper in `session-binding.ts` **after the `NativeSessionResult` type ends at `:14`**, i.e. in the blank line at `:15`, before the `resolveNativeSession` JSDoc. That JSDoc occupies `:16-19` and the `export` is at `:20`, so inserting at `:19` would split the comment. The new comment names the #134 prefix, not 8.3. `realpathSync` stays imported from `node:fs` (`:1`); `.native` is a property of that function.

after (insert at `session-binding.ts:19`, before the `resolveNativeSession` JSDoc):

```ts
/**
 * Canonical absolute path. JS `realpathSync` throws `EISDIR: illegal operation
 * on a directory, lstat 'C:'` on Windows extended-length prefixes stored in the
 * native thread DB. `realpathSync.native` resolves that shape. Native also expands
 * 8.3 short names the JS implementation leaves intact (same reason `session-source.ts`
 * has a private copy). Do not export or share this helper. Do not call
 * `worktree-guard` `canonicalize()`: that walks missing paths up to an ancestor and
 * would break the missing-cwd throw.
 */
function canonical(path: string): string {
  return realpathSync.native(path);
}
```

### 4.2 Call site 1 — live cwd (`:31`)

before (`plugins/codexclaw/components/pabcd-state/src/session-binding.ts:29-35`):

```ts
  let canonicalCwd: string;
  try {
    canonicalCwd = realpathSync(cwd);
    if (!lstatSync(canonicalCwd).isDirectory()) throw new Error();
  } catch {
    return { ok: false, error: "Cannot resolve the working directory. Run from the native session's directory." };
  }
```

after:

```ts
  let canonicalCwd: string;
  try {
    canonicalCwd = canonical(cwd);
    if (!lstatSync(canonicalCwd).isDirectory()) throw new Error();
  } catch {
    return { ok: false, error: "Cannot resolve the working directory. Run from the native session's directory." };
  }
```

### 4.3 Call site 2 — stored thread cwd (`:74`)

before (`plugins/codexclaw/components/pabcd-state/src/session-binding.ts:70-79`):

```ts
      if (typeof row.cwd !== "string" || !isAbsolute(row.cwd)) {
        return { ok: false, error: "Native session has an invalid working directory." };
      }
      try {
        if (realpathSync(row.cwd) !== canonicalCwd) {
          return { ok: false, error: "Working directory does not match the native session. Run from its exact directory." };
        }
      } catch {
        return { ok: false, error: "Cannot resolve the native session's working directory." };
      }
```

after:

```ts
      if (typeof row.cwd !== "string" || !isAbsolute(row.cwd)) {
        return { ok: false, error: "Native session has an invalid working directory." };
      }
      try {
        if (canonical(row.cwd) !== canonicalCwd) {
          return { ok: false, error: "Working directory does not match the native session. Run from its exact directory." };
        }
      } catch {
        return { ok: false, error: "Cannot resolve the native session's working directory." };
      }
```

`isAbsolute(row.cwd)` stays in front. `path.win32.isAbsolute` is true for an extended-length prefix, so the prefix is not rejected as a relative cwd. Do not move or weaken that check.

No other `realpathSync(` call exists in this file. Dist currently mirrors src:

- `plugins/codexclaw/components/pabcd-state/dist/session-binding.js:31` — `canonicalCwd = realpathSync(cwd);`
- `plugins/codexclaw/components/pabcd-state/dist/session-binding.js:74` — `if (realpathSync(row.cwd) !== canonicalCwd)`

After `npm run build`, those two become `canonical(...)` plus the new helper. Restage the tracked dist file in the same commit as src.

## 5. MODIFY `session-binding.test.ts`

### 5.1 Fixture must canonicalise with `.native`

Happy-path tests assert `cwd: f.cwd`. `session-source.ts:18-21` records that windows-latest TEMP is often an 8.3 short path: JS `realpathSync` leaves `RUNNER~1`, native expands it. If the fixture keeps JS `realpathSync` while production switches to native, `assert.deepEqual(..., { cwd: f.cwd })` flakes on that runner. Same helper as production.

before (`plugins/codexclaw/components/pabcd-state/test/session-binding.test.ts:5`):

```ts
import { join } from "node:path";
```

after:

```ts
import { join, toNamespacedPath } from "node:path";
```

before (`plugins/codexclaw/components/pabcd-state/test/session-binding.test.ts:15-17`):

```ts
function fixture(t: TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cxc-session-binding-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
```

after:

```ts
function fixture(t: TestContext) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-session-binding-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
```

`realpathSync` stays in the `node:fs` import; the new test calls the JS implementation to pin the EISDIR.

### 5.2 New test — observed form, both call sites, `session current`

Insert **after** the parent/sibling test, currently `session-binding.test.ts:163-167`. Do not replace that test.

Existing test that stays (anchor):

```ts
test("cwd must match exactly after realpath, not a parent or sibling", t => {
  const f = fixture(t);
  nativeDb(f.home, f.root);
  assert.equal(resolveNativeSession(f.cwd, f.env).ok, false);
});
```

Insert immediately after it:

```ts
test("extended-length stored cwd matches the live cwd", { skip: process.platform !== "win32" }, t => {
  const f = fixture(t);
  const prefixed = toNamespacedPath(f.cwd);
  assert.ok(prefixed.startsWith("\\\\?\\"));
  assert.notEqual(prefixed, f.cwd);
  // Pin the JS implementation bug this layer fixes. 8.3 short names are a
  // different alias class; do not substitute them here.
  assert.throws(
    () => realpathSync(prefixed),
    (err: NodeJS.ErrnoException) => err.code === "EISDIR",
  );
  assert.equal(realpathSync.native(prefixed), f.cwd);

  nativeDb(f.home, prefixed);

  // Call site 2: stored row.cwd is prefixed, live cwd is not (desktop case).
  const fromLive = resolveNativeSession(f.cwd, f.env);
  assert.equal(fromLive.ok, true);
  if (fromLive.ok) assert.equal(fromLive.cwd, f.cwd);

  // Call site 1: live cwd is also prefixed.
  const fromPrefixed = resolveNativeSession(prefixed, f.env);
  assert.equal(fromPrefixed.ok, true);
  if (fromPrefixed.ok) assert.equal(fromPrefixed.cwd, f.cwd);

  // c-3: the CLI corroboration path, not only the helper.
  const current = jsonResult(["current"], f);
  assert.equal(current.code, 0);
  assert.equal(current.body.sessionId, CHILD);
  assert.equal(current.body.cwd, f.cwd);

  const prefixedCurrent = runSessionCli(["current", "--json"], prefixed, f.env);
  assert.equal(prefixedCurrent.code, 0);
  assert.equal(JSON.parse(prefixedCurrent.output).cwd, f.cwd);
});
```

Skip on non-win32: `toNamespacedPath` is a no-op on POSIX and the extended-length prefix is not an EISDIR there. Windows is the reproduction platform (`000_plan.md` Constraints).

### 5.3 Why existing fail-closed tests still pass

- **missing cwd** (`session-binding.test.ts:141`, `{ cwd: "/does-not-exist-cxc" }`): `realpathSync.native` throws `ENOENT` on a missing path, same as JS `realpathSync`. The `catch` at `:77-78` still returns `{ ok: false }`. The test asserts only `.ok === false`, not the error string.
- **relative cwd** (`:142`, `{ cwd: "." }`): rejected at `:70` by `!isAbsolute(row.cwd)` before either realpath runs. `canonical()` is unreachable.
- **parent/sibling mismatch** (`:163-167`): stores `f.root`, resolves `f.cwd` (a child directory). Native realpath of two existing distinct directories stays distinct, so `:74` still reports mismatch.
- **symlink alias** (`:109-117`): `realpathSync.native` resolves the directory symlink to the same target JS `realpathSync` does, so `result.cwd === f.cwd` still holds. The fixture `.native` change keeps that equality on 8.3 TEMP.

## 6. Reproduction (parent fails, L2 head passes)

Parent = L1 head `1f34a30a`, which still has JS `realpathSync` at both sites. Layer head = L2 after the patch + rebuild.

PowerShell. Check native status with `$LASTEXITCODE`, never `$?`.

### 6.1 The EISDIR shape (does not need the patch; documents the bug)

```powershell
node -e "const { realpathSync } = require('node:fs'); const p = require('node:path').toNamespacedPath(process.cwd()); try { realpathSync(p); console.log('js-ok'); } catch (e) { console.log('js', e.code, e.message); } console.log('native', realpathSync.native(p));"
```

Expected on this host: `js EISDIR EISDIR: illegal operation on a directory, lstat 'C:'` then `native C:\\Users\\super\\Developers\\codexclaw`.

### 6.2 Unit test red/green

On the parent commit, apply **only** the test file changes from §5, then:

```powershell
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/pabcd-state/test/session-binding.test.ts
```

Expected: `extended-length stored cwd matches the live cwd` fails (`fromLive.ok` is `false`; error is `Cannot resolve the native session's working directory.`). Other tests in the file stay green.

On the L2 head (src + dist from §4, tests from §5):

```powershell
npm run build
git add plugins/codexclaw/components/pabcd-state/src/session-binding.ts plugins/codexclaw/components/pabcd-state/test/session-binding.test.ts plugins/codexclaw/components/pabcd-state/dist/session-binding.js
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/pabcd-state/test/session-binding.test.ts
```

Expected: exit 0, including the new test. Then:

```powershell
npm run gate
```

Known pre-existing failures on this host, not this layer: `repo-map-packaging.test.mjs`, `gui/test/router.test.ts`, `hook-bench --json` schema. Do not treat them as L2 regressions.

### 6.3 Live desktop corroboration (c-3)

Inside a native Codex session on this host (thread row cwd already prefixed; `CODEX_THREAD_ID` set):

```powershell
node plugins/codexclaw/bin/cxc.mjs session current --json
```

Parent: `{"ok":false,"error":"Cannot resolve the native session's working directory.","hooksVerified":false}` and `$LASTEXITCODE` is 1.
L2: `ok: true`, `sessionId` equals `$env:CODEX_THREAD_ID`, `cwd` is the ordinary absolute path (no extended-length prefix).

C>D receipt for the implementation cycle:

```powershell
cxc receipt test --session <id> -- node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/pabcd-state/test/session-binding.test.ts
```

## 7. Regression risk

The fail-closed matrix (missing/relative/mismatch/symlink/subagent/archived) is unchanged because native realpath still throws on missing paths, still resolves symlinks, and still distinguishes parent vs child. The real risk is an 8.3 TEMP fixture mismatch, which §5.1 removes, and a later "reuse `canonicalize()`" refactor, which would silently reclassify missing cwd as a mismatch. `ROOT_SOURCES` is untouched. POSIX CI skips the new test; the rest of the file is the cross-platform net.

## 8. Criterion

**c-3**: `cxc session current` succeeds against an extended-length stored cwd. Proved by the new test's `jsonResult(["current"], f)` on a `toNamespacedPath` row plus the live command in §6.3.
