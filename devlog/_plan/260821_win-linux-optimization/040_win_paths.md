# 040 - wp05 Windows path handling

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp05.

Defects closed from 002 section D:

| # | Sev | Location | Problem |
|---|-----|----------|---------|
| 1 | P0 | `cxc-ops/src/scouting-bundle.ts:75` | `process.env.HOME` undefined on win32 -> `split("")` shreds the bundle |
| 3 | P0 | `cxc-ops/src/scouting-bundle.ts:30-42` | `redactPaths` case-sensitive + 8.3 blind -> home dir leaks |
| 12 | P2 | 8 sites (`state.ts:305` et al.) | `renameSync` over existing -> intermittent EPERM |
| 13 | P2 | `pabcd-state/src/state.ts:200-209` | `linkSync` publish throws on non-NTFS |

Patterns adopted from 001: section 1.1 (platform-parameterized path identity), 1.2 (8.3
short names are canonicalization, not attack), 5.1 (bounded rename retry), and the
cross-cutting rule that platform and IO are defaulted parameters so Linux CI can drive
the win32 branch.

## MODIFY / NEW / DELETE map

### 1. NEW plugins/codexclaw/components/cxc-ops/src/win-paths.ts

One module for path identity, so no call site invents its own comparison (001 1.1).

```ts
/**
 * win-paths.ts - platform-parameterized path identity and home redaction.
 *
 * Adopted from opencodex `user-identity.ts:447` / `log-guard/path-safety.ts:43-73`:
 * Windows paths are case-insensitive and `realpathSync.native` expands 8.3 short
 * components, so "the same directory" has several legal spellings. POSIX paths
 * have exactly one, and folding case there would merge two real directories.
 */
import { realpathSync } from "node:fs";

/** True when two paths name the same location on `platform`. */
export function samePathIdentity(
  left: string,
  right: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

/** Escape a literal for embedding in a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every spelling of one directory that could appear in text: both separator
 * forms, plus the OS-canonical (8.3-expanded) form when it differs.
 *
 * `realpathSync.native` is the piece that catches `C:\Users\SUPER~1`, which no amount
 * of case folding would match (001 1.2).
 */
export function homePathVariants(
  homeDir: string,
  platform: NodeJS.Platform = process.platform,
  realpath: (p: string) => string = (p) => realpathSync.native(p),
): string[] {
  const trimmed = homeDir.trim();
  if (trimmed.length === 0) return [];
  const seen = new Set<string>();
  const add = (v: string) => {
    if (v.length > 0) seen.add(v);
  };
  const both = (v: string) => {
    add(v.split("\\").join("/"));
    add(v.split("/").join("\\"));
  };
  both(trimmed);
  if (platform === "win32") {
    try {
      both(realpath(trimmed));
    } catch {
      // An unreadable home is not a redaction failure; the literal forms stand.
    }
  }
  // Longest first, so C:/Users/x/AppData never redacts before C:/Users/x would
  // have, leaving a dangling suffix.
  return [...seen].sort((a, b) => b.length - a.length);
}
```

### 2. MODIFY plugins/codexclaw/components/cxc-ops/src/scouting-bundle.ts

#### 2a. redactPaths - defect #3 (P0)

BEFORE (:29-42)
```ts
/** Redact home directory paths. */
export function redactPaths(text: string, homeDir: string): string {
  // Normalize separators for cross-platform
  const normalizedHome = homeDir.split(sep).join("/");
  const windowsHome = homeDir.split("/").join("\\");
  let result = text;
  result = result.split(normalizedHome).join("~");
  if (sep === "\\") {
    result = result.split(windowsHome).join("~");
  }
  // Also redact forward-slash version on Windows
  result = result.split(homeDir).join("~");
  return result;
}
```

On win32 `homeDir` is `C:\Users\x`, so `windowsHome === homeDir` and the last two passes
are the same dead pass. The live defect is case sensitivity: `c:\users\x` (lowercased
by tools) and `C:\Users\SUPER~1` (8.3) both survive into a bundle whose entire purpose
is to be shareable.

AFTER
```ts
/**
 * Redact every spelling of the home directory.
 *
 * win32 needs a case-insensitive match (tools lowercase paths freely) and the
 * 8.3 short form (`C:\Users\SUPER~1`), neither of which a literal split/join finds.
 * An empty `homeDir` returns the text untouched - `"".split("")` would explode the
 * string into characters joined by "~" (defect #1).
 */
export function redactPaths(
  text: string,
  homeDir: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const variants = homePathVariants(homeDir, platform);
  if (variants.length === 0) return text;
  const pattern = variants.map(escapeRegExp).join("|");
  return text.replace(new RegExp(pattern, platform === "win32" ? "gi" : "g"), "~");
}
```

`homePathVariants` and `escapeRegExp` are imported from `./win-paths.ts`. The `sep` import
from `node:path` (:8) becomes unused here and is dropped if nothing else in the file
uses it.

#### 2b. generateBundle home resolution - defect #1 (P0)

BEFORE (:75)
```ts
  const home = opts.homeDir ?? process.env.HOME ?? "";
```

AFTER
```ts
  // Windows sets USERPROFILE, not HOME (except under Git Bash), so this used to
  // resolve to "" and every redactPaths call became split("").join("~") - which
  // rewrites "plugin" as "p~l~u~g~i~n" and corrupts the whole bundle (defect #1).
  const home = opts.homeDir ?? homedir();
```

`homedir` joins the existing `node:os` import at :10 (`platform, hostname, release`).
The empty-string guard in `redactPaths` stays regardless: it converts a silent
corruption into a no-op, which is the correct failure direction for a diagnostics tool.

### 3. NEW plugins/codexclaw/components/pabcd-state/src/atomic-write.ts

Defect #12 in one place, adopted from 001 5.1.

```ts
/**
 * atomic-write.ts - publish-by-rename with a bounded win32 retry.
 *
 * POSIX `rename(2)` replaces the destination unconditionally. Windows fails with
 * EPERM/EACCES/EBUSY while a scanner, indexer, or sync client holds a transient
 * handle on the target - which is routine here, because hooks fire concurrently
 * (SessionStart, UserPromptSubmit, PreToolUse all touch session state).
 *
 * The envelope is sized for a scanner blinking, not for a file someone actually
 * has open: two retries at 25ms and 50ms. A longer wait would turn a hot-path
 * hook into a visible stall, and a file genuinely held open is a real error that
 * should surface (opencodex `windows-atomic-replace.ts:1-18`).
 */
import { renameSync } from "node:fs";

const RETRY_DELAYS_MS = [25, 50] as const;
const TRANSIENT_WIN32_CODES: ReadonlySet<string> = new Set(["EBUSY", "EPERM", "EACCES"]);

function sleepSync(ms: number): void {
  // Synchronous by necessity: every call site is a sync write path.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isTransientWin32(err: unknown, platform: NodeJS.Platform): boolean {
  if (platform !== "win32") return false;
  const code = (err as NodeJS.ErrnoException)?.code;
  return typeof code === "string" && TRANSIENT_WIN32_CODES.has(code);
}

/** `renameSync` with a bounded win32-only retry. Rethrows the final error. */
export function renameWithRetry(
  tmp: string,
  finalPath: string,
  platform: NodeJS.Platform = process.platform,
  rename: (a: string, b: string) => void = renameSync,
  sleep: (ms: number) => void = sleepSync,
): void {
  for (let attempt = 0; ; attempt++) {
    try {
      rename(tmp, finalPath);
      return;
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || !isTransientWin32(err, platform)) throw err;
      sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}
```

### 4. MODIFY the eight rename sites - defect #12

Each is the same one-line substitution: `renameSync(tmp, finalPath)` becomes
`renameWithRetry(tmp, finalPath)`, with `renameWithRetry` imported and the now-unused
`renameSync` import dropped from the `node:fs` clause where it has no other caller.

| File | Line |
|------|------|
| `plugins/codexclaw/components/pabcd-state/src/state.ts` | 305 |
| `plugins/codexclaw/components/pabcd-state/src/goalplan.ts` | 542 |
| `plugins/codexclaw/components/pabcd-state/src/metrics.ts` | 141 |
| `plugins/codexclaw/components/pabcd-state/src/divergence.ts` | 126 |
| `plugins/codexclaw/components/pabcd-state/src/release-cli.ts` | 137 |
| `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts` | 148 |
| `plugins/codexclaw/components/subagent-config/src/store.ts` | 132 |
| `plugins/codexclaw/components/cxc-ops/src/hook-trust.ts` | 356 |

Representative, `state.ts:295-314`:

BEFORE
```ts
    const normalized = { ...next, interview: normalizeInterview(next.interview), updatedAt: new Date().toISOString() };
    writeFileSync(tmp, JSON.stringify(normalized, null, 2));
    renameSync(tmp, finalPath);
  } catch (err) {
```

AFTER
```ts
    const normalized = { ...next, interview: normalizeInterview(next.interview), updatedAt: new Date().toISOString() };
    writeFileSync(tmp, JSON.stringify(normalized, null, 2));
    renameWithRetry(tmp, finalPath);
  } catch (err) {
```

The existing `catch` + tmp-cleanup blocks are untouched, so error semantics are
unchanged; only the transient window is absorbed. `store.ts` and `hook-trust.ts` live
outside `pabcd-state`, so they import through their own package's copy - see section 6.

### 5. MODIFY plugins/codexclaw/components/pabcd-state/src/state.ts - defect #13

BEFORE (:199-212)
```ts
  try {
    writeFileSync(tmp, JSON.stringify(defaultState(sessionId), null, 2), { flag: "wx" });
    try {
      linkSync(tmp, finalPath);
      return true;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "EEXIST") {
        return false;
      }
      throw err;
    }
  } finally {
    rmSync(tmp, { force: true });
  }
```

AFTER
```ts
  try {
    writeFileSync(tmp, JSON.stringify(defaultState(sessionId), null, 2), { flag: "wx" });
    try {
      linkSync(tmp, finalPath);
      return true;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "EEXIST") return false;
      // Hard links need NTFS and a single volume. FAT32/exFAT sticks (and some
      // mounted shares) answer EPERM/ENOTSUP/EXDEV instead, and this runs from the
      // SessionStart hook - a throw here kills session bootstrap (defect #13).
      if (code === "EPERM" || code === "ENOTSUP" || code === "EXDEV") {
        try {
          // "wx" gives the same exclusive-create semantics without hard links.
          writeFileSync(finalPath, JSON.stringify(defaultState(sessionId), null, 2), { flag: "wx" });
          return true;
        } catch (fallbackErr) {
          const fallbackCode =
            fallbackErr && typeof fallbackErr === "object" && "code" in fallbackErr
              ? String(fallbackErr.code)
              : "";
          if (fallbackCode === "EEXIST") return false;
          throw fallbackErr;
        }
      }
      throw err;
    }
  } finally {
    rmSync(tmp, { force: true });
  }
```

The `EEXIST` fast path is byte-identical, so NTFS behavior is untouched.

### 6. Package wiring (SHARED-HELPER-01)

`atomic-write.ts` lives in `pabcd-state` because six of the eight call sites are there.
`subagent-config/src/store.ts` and `cxc-ops/src/hook-trust.ts` are separate workspace packages; each
gets a two-line re-export module (`src/atomic-write.ts`) with the same body rather than a
cross-package import, matching how this repo already keeps components dependency-free of
each other. If a shared dep is preferred, that is a scope expansion to raise, not assume.

This paragraph is the campaign-wide rule, not a local one. Three later phases introduce
helpers with the same cross-package shape - 050 `win-exec.ts`, 060 `wsl.ts`, 070
`text-lines.ts` - and each of their package-wiring sections applies exactly this pattern
rather than re-deciding. The rule in one line: **a component never imports from another
component package; every consumer owns a copy or re-export at its own relative path.**
`rg` for `from "../../` across component sources returns zero hits today, and that should
still hold after wp08. The single shared-package follow-up is filed once, for all four
helpers, in 100 section 5.

## TESTS

NEW `plugins/codexclaw/components/cxc-ops/test/win-paths.test.ts`

1. "samePathIdentity folds case only on win32" - `("C:\\A", "c:\\a", "win32")` true,
   `("/a/B", "/a/b", "linux")` false.
2. "homePathVariants returns both separator forms, longest first".
3. "homePathVariants includes the realpath form on win32" - inject a `realpath` stub
   returning `C:\Users\SUPERL~1` and assert it is present; assert the same stub is NOT
   consulted with `platform: "linux"`.
4. "an unreadable home does not throw" - the injected `realpath` throws; the literal
   forms still come back.
5. "empty and whitespace-only home yield no variants".

MODIFY `plugins/codexclaw/components/cxc-ops/test/scouting-bundle.test.ts`

The two existing redaction tests stay valid (a POSIX path and a Windows path both
redact). Add:

6. "redactPaths is case-insensitive on win32" (defect #3) -
   `redactPaths("c:\\users\\jun\\.codex", "C:\\Users\\jun", "win32")` contains no `jun`.
7. "redactPaths stays case-SENSITIVE on posix" -
   `redactPaths("/Users/JUN/x", "/Users/jun", "linux")` still contains `JUN`. A regression
   here would merge two genuinely different POSIX directories.
8. "redactPaths handles regex metacharacters in the home path" - a home of
   `C:\Users\a+b(1)` redacts literally and does not throw.
9. "an empty homeDir is a no-op, not a shredder" (defect #1) -
   `redactPaths("plugin", "")` === `"plugin"`, explicitly asserting it is not `"p~l~u~g~i~n"`.
10. "generateBundle with no HOME set produces readable sections" - delete
    `process.env.HOME`, call `generateBundle({ pluginRoot })` with no `homeDir`, and assert
    no section content matches `/(~.){5}/`. This is the guaranteed-on-Windows corruption
    from 002 B3, caught on any platform.
11. "the longest variant wins" - text containing both `C:/Users/x/AppData` and
    `C:/Users/x` redacts to `~/AppData` and `~`, never a dangling fragment.

NEW `plugins/codexclaw/components/pabcd-state/test/atomic-write.test.ts`

12. "a clean rename does not retry" - injected `rename` called once, `sleep` never.
13. "EBUSY then success retries once" - `rename` called twice, `sleep` called with 25.
14. "three failures rethrow the last error" - `sleep` called with 25 then 50, and the
    thrown error is the third one.
15. "POSIX never retries" - `platform: "linux"` with an EBUSY-throwing rename rethrows
    immediately. The retry must not mask a real POSIX failure.
16. "ENOENT is not transient" - rethrown immediately even on win32.

MODIFY `plugins/codexclaw/components/pabcd-state/test/fsm.test.ts` (or wherever
`ensureState` is covered)

17. "ensureState falls back when linkSync answers EPERM" - stub `linkSync` to throw
    `{ code: "EPERM" }` and assert `true` plus a state file on disk.
18. "the fallback maps EEXIST to false" - the `wx` write throws EEXIST -> `false`, which
    is the "someone else won" contract.
19. "EEXIST from linkSync still returns false without touching the fallback".

## Verification (C)

Run from the repo root; each command must exit 0.

```powershell
node --test --test-concurrency=1 "plugins/codexclaw/components/cxc-ops/test/win-paths.test.ts" "plugins/codexclaw/components/cxc-ops/test/scouting-bundle.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/atomic-write.test.ts" "plugins/codexclaw/components/pabcd-state/test/fsm.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts" "plugins/codexclaw/components/pabcd-state/test/metrics.test.ts" "plugins/codexclaw/components/pabcd-state/test/divergence.test.ts" "plugins/codexclaw/components/pabcd-state/test/release-cli.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/cxc-ops/test/hook-trust.test.ts" "plugins/codexclaw/components/subagent-config/test/store.test.ts"
npm test
node plugins/codexclaw/scripts/gate.mjs
```

Manual acceptance for the bundle corruption (002 B3), on Windows:

```powershell
node bin/codexclaw.mjs doctor --bundle | Select-String -Pattern '~.~.~' -Quiet
```

Expected `False`: no character-shredded section anywhere in the bundle. Then confirm the
home really is redacted:

```powershell
node bin/codexclaw.mjs doctor --bundle | Select-String -Pattern ([regex]::Escape($env:USERNAME)) -Quiet
```

Expected `False`.

Non-NTFS acceptance for defect #13, if a FAT32/exFAT volume is available (skip with a
recorded note otherwise - this is the one check that cannot be faked from CI):

```powershell
node bin/codexclaw.mjs orchestrate status --cwd E:\cxc-fat32-check
```

Expected: a status line, not an EPERM stack.

WSL parity, expected exit 0:

```bash
wsl -d Ubuntu -- bash -lc "cd ~/codexclaw-wsl-checkout && npm test"
```

Record the C>D receipt with `cxc receipt test -- npm test` per CHECK-BINDING-01.
