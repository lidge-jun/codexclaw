# opencodex Cross-Platform Reference Patterns

Read-only survey of `C:\Users\super\Downloads\opencodex` (sibling reference repo) for
Windows/Linux patterns that codexclaw can adopt. Nothing in opencodex was modified.
All line references are against the working tree as of 2026-08-21.

Scope note: opencodex runs on Bun and uses `bun:sqlite`, `Bun.sleepSync`, and Bun FFI in a
few places. The patterns below are mostly runtime-agnostic; Bun-specific dependencies are
called out where adoption would need substitution.

---

## 1. win32 path handling

### 1.1 Case-folding only on win32, never on POSIX

`src/codex/user-identity.ts:447` centralizes path comparison in one predicate that takes the
platform as a parameter, so no call site invents its own comparison:

```ts
return platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
```

The same rule reappears when a path becomes a hash key (`src/codex/codex-write-lock.ts:217`):

```ts
// Windows paths are case-insensitive, so two spellings of one directory must
// hash alike there; POSIX paths are not, so they must not be folded.
const normalized = process.platform === "win32" ? canonical.toLowerCase() : canonical;
const lockId = createHash("sha256").update("opencodex-codex-write-lock-v1\0").update(normalized).digest("hex");
```

**Adoptable lesson:** put path equality behind one platform-parameterized helper, and fold case
for win32 identity *and* for any derived key (hash, map key, lock id) or two spellings of one
directory will acquire two separate locks.

### 1.2 8.3 short-name canonicalization is not a symlink attack

`src/codex/log-guard/path-safety.ts:43-73` is the highest-value find in this area. Windows
`realpathSync.native` expands 8.3 short components (the `RUNNER~1` form pervasive in `%TEMP%`),
so a canonical path and the requested path differ as strings while naming the same file. Treating
that as an ancestor-symlink redirection made *every* Log Guard mutation refuse with `unsafe_path`
on Windows CI. The comment also records a rejected first fix that re-canonicalized both sides and
silently let a genuinely symlinked database compare equal:

```ts
function sameWindowsCanonicalPath(realPath: string, requestedPath: string): boolean {
  if (process.platform !== "win32") return false;
  try {
    if (pathChainContainsLink(requestedPath)) return false;
    return samePathIdentity(realPath, realpathSync.native(requestedPath));
  } catch { return false; }
}
```

The widening is gated by a link-aware walk that fails closed on an unreadable component
(`path-safety.ts:76-88`): if no component of the request is a link, any remaining string
difference must be the OS's own canonical spelling.

**Adoptable lesson:** on Windows, canonical-vs-requested string mismatch is usually 8.3 expansion,
not an attack; widen the comparison only after proving no component of the chain is a link.

### 1.3 Trusted OS aliases are normalized, arbitrary symlinks are not

The same module handles the macOS analog (`path-safety.ts:6-30`): `/var` and `/tmp` are rewritten
to `/private/var` and `/private/tmp` only after `realpathSync.native` confirms the alias actually
points where the OS says it does.

**Adoptable lesson:** hardcode the small set of OS-owned aliases and verify each one at runtime,
rather than relaxing the symlink check globally.

### 1.4 Drive-letter to WSL mount rewriting

`src/codex/home.ts:22-29` converts a Windows `USERPROFILE` into its WSL mount path with an
anchored regex and an explicit lowercase drive letter:

```ts
const normalized = value.replaceAll("\\", "/");
const match = normalized.match(/^([A-Za-z]):\/Users\/([^/]+)$/);
if (!match) return null;
return \`\${root === "/" ? "" : root}/\${match[1]!.toLowerCase()}/Users/\${match[2]}\`;
```

**Adoptable lesson:** normalize backslashes first, then match an anchored drive-letter pattern and
lowercase the drive, since `/mnt/C` does not exist while `/mnt/c` does.

### 1.5 Explicit `posix.join` / `win32.join` where the target namespace is known

`src/codex/home.ts:99,106,107` uses `posix.join` for WSL mount paths with the comment "WSL mount
paths are POSIX by definition; keep separators stable on any host", and `home.ts:178` uses
`win32.join` for the Windows app home. Bare `join` is reserved for genuinely host-local paths.

**Adoptable lesson:** when a path belongs to a *known* namespace rather than the host, import
`posix`/`win32` explicitly so the separator does not follow whichever OS happens to be running.

### 1.6 Temp/UNC-aware normalization for display and comparison

`src/codex/home.ts:164-166` normalizes for comparison only (slashes to backslashes, strip trailing
separators, lowercase), and the result is used for diagnosis, never written back as a real path:

```ts
function normalizedWindowsPath(path: string): string {
  return path.trim().replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase();
}
```

**Adoptable lesson:** keep a separate "normalized for comparison" spelling from the real path you
operate on, and never persist the normalized form.

### 1.7 Restricted directory creation that refuses reparse points

`src/lab/paths.ts:15-29` walks each Lab-owned component and rejects symlinks, non-directories, and
reparse-point substitutions by comparing `realpathSync.native(path)` against
`join(realpathSync.native(dirname(path)), basename(path))`. `lab/paths.ts:57` then skips the
`chmod 0o700` step on win32 because POSIX modes are not the ACL model there.

**Adoptable lesson:** verify each path component against its canonical parent + basename to catch
junction substitution, and skip `chmod` on win32 instead of pretending it worked.

---

## 2. WSL detection and interop

### 2.1 Layered runtime detection with injectable probes

`src/codex/home.ts:82-88`:

```ts
export function isWslRuntime(deps: CodexHomeDeps = {}): boolean {
  if ((deps.platform ?? process.platform) !== "linux") return false;
  const env = deps.env ?? process.env;
  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) return true;
  const version = \`\${deps.release ?? ""}\n\${deps.procVersion ?? readProcVersion() ?? ""}\`;
  return /microsoft|wsl/i.test(version);
}
```

Every filesystem and environment touch is a `deps` field (`home.ts:7-20`: `env`, `platform`,
`release`, `procVersion`, `homedir`, `usersRoot`, `wslConf`, `existsSync`, `readdirSync`,
`statSync`, `realpathSync`), which is what lets Linux CI exercise the Windows branches.

**Adoptable lesson:** detect WSL by env vars first and `/proc/version` second, and inject every
platform probe so both branches are testable from a single CI OS.

### 2.2 `/etc/wsl.conf` automount root is parsed, not assumed

`src/codex/home.ts:51-72` parses the `[automount] root` key with comment stripping, quote
stripping, case-insensitive key matching, and a fallback to `/mnt` when the value is not absolute.
`src/codex/shim.ts:494-498` then builds the interop-directory test from that root with a regex-escaped
prefix:

```ts
export function isWindowsInteropDir(dir: string, automountRoot = "/mnt"): boolean {
  const root = automountRoot.replace(/\/+$/, "");
  const escaped = root.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  return new RegExp(\`^\${escaped}/[a-z](/|$)\`, "i").test(dir);
}
```

**Adoptable lesson:** never hardcode `/mnt`; read `[automount] root` once and thread it through
every mount-path construction and test, escaping it before regex use.

### 2.3 No `wsl.exe` subprocess parsing at all

Notable negative finding: `rg` over `src/` shows **no** `wsl.exe` or `wslpath` invocation. opencodex
derives everything from the filesystem (`/proc/version`, `/etc/wsl.conf`, `/proc/mounts`,
`/mnt/c/Users/*/.codex` enumeration in `home.ts:91-119`) instead of shelling out. That sidesteps
the well-known `wsl.exe` UTF-16LE-stdout problem entirely.

**Adoptable lesson:** prefer filesystem probes over `wsl.exe`; if you must shell out, note that
`wsl.exe` writes UTF-16LE and needs `decodeWindowsTextBytes`-style handling (section 4.1).

### 2.4 drvfs is treated as a distinct reliability tier

`src/cli/doctor.ts:225-246` parses `/proc/mounts` for the longest covering mount prefix and flags
`drvfs`/`9p`, with the mounts content injectable and `null` off-Linux yielding `"n/a"`.
`src/codex/native-main-owner.ts:76-92` turns that into a hard refusal:

```ts
if (platform === "win32") {
  const normalized = codexHome.replaceAll("/", "\\");
  if (normalized.startsWith("\\\\?\\UNC\\")) return false;
  if (normalized.startsWith("\\\\") && !normalized.startsWith("\\\\?\\")) return false;
}
if (platform === "linux" && (env.WSL_INTEROP !== undefined || env.WSL_DISTRO_NAME !== undefined)
    && /^\/mnt\/[a-z](?:\/|$)/i.test(codexHome)) return false;
```

**Adoptable lesson:** detecting WSL is not enough; separately detect whether state lives on
drvfs/9p/UNC and refuse lock-dependent features there with an explicit `unsupported-filesystem`
reason rather than failing mysteriously later.

### 2.5 Dual-install diagnosis is a first-class user-facing surface

`src/cli/doctor.ts:279-310` reports which `.codex` home each side owns, and `doctor.ts:1089-1107`
emits concrete hints: prefer the Linux home under WSL, the one-way `localhost` behavior of WSL2 NAT
mode (with `networkingMode=mirrored` as the fix), and a refusal to shim a Windows launcher reached
through interop because "a WSL shim breaks Windows invocations".

**Adoptable lesson:** ship a doctor command that names the exact dual-install failure modes with
copy-pasteable remedies; these are the bugs users cannot diagnose themselves.

---

## 3. Child-process spawning on Windows

### 3.1 A vendored cross-spawn equivalent is the single entry point

`src/lib/win-exec.ts:1-11` states the problem precisely: Windows npm installs expose CLIs as
`.cmd` shims, Node/Bun refuse shell-less `.cmd` spawns after CVE-2024-27980 hardening, and bare
`spawn("claude")` skips PATHEXT resolution so it ENOENTs even when `claude.cmd` is on PATH.

`win-exec.ts:79-96` is the whole policy:

```ts
if (platform !== "win32") return { file: command, args: [...args], options: {} };
const resolved = resolveWindowsCommand(command, deps);
if (!/\.(cmd|bat)$/i.test(resolved)) return { file: resolved, args: [...args], options: {} };
const line = [escapeCmdCommand(resolved), ...args.map(a => escapeCmdArg(a, doubleEscape))].join(" ");
return { file: env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", \`"\${line}"\`],
         options: { windowsVerbatimArguments: true } };
```

`src/codex/exec-invocation.ts:8-21` documents the prohibition it enforces: "`.cmd`/`.bat` must go
through `cmd.exe`, but never via `shell: true` (Node does not escape cmd metacharacters there)."

**Adoptable lesson:** route every child process through one `commandInvocation` helper that
resolves PATHEXT, spawns `.exe` directly, and sends `.cmd`/`.bat` through
`ComSpec /d /s /c` with `windowsVerbatimArguments` -- and ban `shell: true` outright.

### 3.2 PATH lookup tolerates env-var casing drift

`src/lib/win-exec.ts:47-56` notes that a spawned child can arrive with `Path`, `PATH`, or both, and
that reading two fixed spellings once resolved against the wrong list. The lookup falls back to a
case-insensitive key scan, and `PATHEXT` defaults to `.COM;.EXE;.BAT;.CMD` when absent.

**Adoptable lesson:** look up Windows env vars case-insensitively with a key scan fallback; the
two-spelling shortcut is a real bug source.

### 3.3 cross-spawn's exact escaping, including the npm-shim double escape

`win-exec.ts:15-29` keeps the original semantics: `escapeCmdArg` doubles backslashes before quotes,
wraps in quotes, then carets every cmd metacharacter; `IS_CMD_SHIM` (`node_modules[\\/].bin[\\/]...\.cmd`)
selects the second escaping pass that only npm local-bin shims need.

**Adoptable lesson:** copy cross-spawn's escaping verbatim including the shim-only double escape;
hand-rolled quoting will not survive paths with `&`, `^`, or spaces.

### 3.4 System binaries resolved from the real System32, never PATH

`src/lib/windows-elevation.ts:115-145` calls `GetSystemDirectoryW` through FFI (with a
grow-and-retry buffer loop) and `windows-elevation.ts:161-171` asserts every candidate is contained
inside it before use. `resolveTrustedWindowsPowerShellExe`/`Schtasks`/`Taskkill`/`Icacls`
(`:192-230`) are the only ways those tools are reached, with a test-only override seam
(`:185-189`) for Linux CI that "production resolution never consults".

**Adoptable lesson:** resolve `powershell.exe`/`taskkill.exe` from the FFI-reported system directory
and assert containment, so a PATH-shadowed binary cannot hijack a privileged call.

### 3.5 Uniform spawn options: absolute exe, no profile, timeout, hidden window

Every PowerShell call in `src/codex/app-server-processes.ts` (`:445-449`, `:550-554`, `:640-644`)
uses the same shape:

```ts
execFileSync(resolveTrustedWindowsPowerShellExe(),
  ["-NoProfile", "-NoLogo", "-NonInteractive", "-Command", script],
  { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], timeout: 8_000, windowsHide: true });
```

`app-server-processes.ts:441` records why: "windowsHide keeps the enumeration console-less on
desktop sessions". `app-server-processes.ts:412-419` additionally sets `-ErrorAction Stop` because
under `SilentlyContinue` a failing `Get-CimInstance` emits nothing and looks like a clean empty result.

**Adoptable lesson:** standardize on `-NoProfile -NoLogo -NonInteractive` plus `timeout`,
`windowsHide`, and `-ErrorAction Stop`, so failures are loud and no console flashes at the user.

---

## 4. CRLF and encoding hygiene

### 4.1 Bounded, ordered decoding of Windows tool output

`src/lib/windows-text.ts` is a self-contained decoder with its full decision log at `:1-19`. Order
at `:81-105`: UTF-16LE BOM or heuristic (`buffer[1]===0 && buffer[3]===0 && buffer[0]!==0`), then
UTF-16BE via pair swapping, then **strict** UTF-8 (`fatal: true`), then a locale-appropriate legacy
decoder, then a fail-soft replacement-preserving UTF-8 decode.

The narrowness is deliberate (`:51-56`): CP949 is reached via the `euc-kr` WHATWG label, and the
Windows-1252 fallback is restricted to an explicit language allowlist (`:64-68`) because decoding
CP932/CP1250/CP1251 bytes as Windows-1252 "can fabricate a different valid-looking filesystem path,
which is worse than the previous replacement-character refusal".

**Adoptable lesson:** decode Windows tool output as UTF-16, then strict UTF-8, then a
locale-specific legacy codec, then fail-soft, and refuse to guess unknown code pages because a
wrong guess yields a plausible but wrong path.

### 4.2 Base64 + UTF-16LE as a codepage-proof transport

`src/codex/user-identity.ts:100-118` avoids the decoding problem instead of solving it: PowerShell
encodes its own result and only ASCII crosses the pipe.

```ts
"$ocxBytes = [System.Text.Encoding]::Unicode.GetBytes($ocxValue)",
"[Console]::Out.Write([Convert]::ToBase64String($ocxBytes))",
```

The reader (`:184-199`) decodes strict UTF-8, validates the base64 shape by regex, requires an even
byte length, requires a canonical round-trip (`bytes.toString("base64") === encoded`), and only then
reads `utf16le`. Anything else is a typed refusal.

**Adoptable lesson:** when a Windows helper must return a non-ASCII string, have it emit
base64-of-UTF-16LE and validate the round-trip; this is immune to the console code page entirely.

### 4.3 Batch files get `%USERPROFILE%` indirection, not literal paths

`src/lib/win-paths.ts:1-11` explains that `cmd.exe` parses `.cmd` files in the console's OEM code
page, so any absolute path baked into a generated batch file becomes mojibake for users with
non-ASCII profile directories. The fix rewrites the longest matching prefix as an env token
(`:31-42`), with `isComponentPrefix` (`:19-25`) requiring a whole-component match. Critically,
`windowsEnvIndirectBatchValue` (`:49-56`) keeps the token verbatim and escapes only the remainder,
because batch escaping doubles `%` and would destroy the token.

**Adoptable lesson:** never bake absolute profile paths into generated `.cmd` files; emit
`%LOCALAPPDATA%`/`%APPDATA%`/`%USERPROFILE%` tokens (longest match wins) and escape only the suffix.

### 4.4 UTF-16LE + BOM for generated Windows service assets

`src/service.ts:2024-2027` writes both the launcher VBS and the task XML as `"\uFEFF" + content` in
`utf16le`, since "a BOM-less UTF-8 VBS mis-decodes non-ASCII (e.g. Korean) profile" paths.
`service.ts:760-782` decodes `schtasks /query /xml` output with the same BOM/heuristic logic, because
reading UTF-16LE as UTF-8 "makes every health check" fail.

**Adoptable lesson:** generated Windows service/scripting assets should be UTF-16LE with a BOM, and
anything reading `schtasks` output must expect UTF-16LE back.

### 4.5 Newline-tolerant parsing, with a byte-accounting exception

The default for parsing tool output is `split(/\r?\n/)` (`app-server-processes.ts:327,334,381,580,624`;
`service.ts:902`). But `src/usage/log.ts:782-786` documents where that is wrong:

```ts
// Split on "\n" only, so a CRLF line keeps its "\r" and its byte length stays exact.
// Splitting on /\r?\n/ consumes two bytes but leaves no way to tell that it did, which
// made the recorded lengths short by one byte per line on a CRLF ledger...
const lines = text.split("\n");
```

**Adoptable lesson:** use `/\r?\n/` for display and tool output, but split on `"\n"` alone whenever
byte offsets or lengths are recorded, or CRLF files silently desynchronize the accounting.

### 4.6 Preserve the file's dominant EOL across a rewrite

`src/grok/inject.ts:388-389` captures `dominantEol(rawContent)`, normalizes to `\n` for all editing,
then restores the original EOL on write. `src/integrations/omp-yaml-source.ts:141-143` uses the
simpler `text.includes("\r\n") ? "\r\n" : "\n"`, plus `preserveFinalNewline` (`:230`).
`inject.ts:411-415` adds a related invariant: injection must be *injective* (exactly one separator
newline) so that strip can restore the original bytes.

**Adoptable lesson:** detect dominant EOL, edit in normalized `\n`, and restore on write; also keep
edits byte-reversible so an uninstall path can undo exactly what was added.

### 4.7 `latin1` only as a byte-preserving transport

`src/server/direct-local-http.ts:24,83` parses HTTP header lines with `toString("latin1")`, and
`src/images/artifacts.ts:218,397` reads magic-number signatures the same way. Both are cases where
`latin1` is a 1:1 byte view, never a text guess.

**Adoptable lesson:** reach for `latin1` only for byte-exact protocol/signature framing; it is a
transport, not an encoding fallback.

---

## 5. File locking and atomic writes on Windows

### 5.1 Bounded retry around `rename` for Windows sharing violations

`src/lib/windows-atomic-replace.ts:1-18` names the cause: POSIX `rename()` replaces
unconditionally, but Windows returns EBUSY/EPERM/EACCES while a scanner, sync client, or backup
agent holds the target open. The envelope is explicitly sized (`:10-13`) at two retries, 25ms then
50ms, "sized for a scanner blinking, not for a file someone actually has open".

```ts
function transientWindowsReplaceCode(platform: NodeJS.Platform, error: unknown): ReplaceRetryCode | null {
  if (platform !== "win32") return null;
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EBUSY" || code === "EPERM" || code === "EACCES" ? code : null;
}
```

Retries are counted per `publisher:CODE` (`:55-59`), and the publisher type is a closed union
(`:29-37`) specifically so a path-derived string carrying a username cannot reach a diagnostic
surface. Both sync (`:108`) and async (`:135`) variants exist; the sync one injects
`platform`/`rename`/`sleep` for testing.

**Adoptable lesson:** wrap every publish-by-rename in a bounded win32-only retry over
EBUSY/EPERM/EACCES, keep the window near 75ms, and count retries by publisher and code so you can
tell a scanner from a permissions bug.

### 5.2 Locks are SQLite `BEGIN IMMEDIATE`, not lockfiles

opencodex does not use `open(..., "wx")` lockfiles for its main locks. It opens a dedicated lock
database and takes an OS-backed write transaction (`src/codex/native-main-owner.ts:186-188`):

```ts
candidate = new Database(entry.lockPath, { create: true });
candidate.exec("PRAGMA locking_mode = NORMAL; PRAGMA busy_timeout = 0; BEGIN IMMEDIATE");
assertStableLockFile(entry.lockPath, entry.file!);
```

`busy_timeout = 0` is deliberate (`src/config.ts:2691`, `codex-write-lock.ts:142`): SQLite's internal
wait is *not* the exclusion mechanism, so contention returns immediately and the caller owns the
retry policy with jitter (`codex-write-lock.ts:227-235`). This sidesteps stale-lockfile cleanup
entirely, since a crashed process releases the transaction automatically.

**Adoptable lesson:** prefer a SQLite `BEGIN IMMEDIATE` on a dedicated lock DB over lockfiles;
crash cleanup becomes free, and `busy_timeout = 0` keeps retry policy in your own code.

### 5.3 Refuse to lock where locking does not work

Before acquiring, `codex-write-lock.ts:210-215` calls `nativeMainOwnerFilesystemSupported`
(section 2.4) and returns a distinct `unsupported_filesystem` reason for UNC paths, bare `\\` shares,
and `/mnt/<drive>` under WSL.

**Adoptable lesson:** validate the filesystem before taking a lock and fail with a specific reason
code; drvfs and SMB will otherwise appear to lock and then corrupt.

### 5.4 Retryable vs permanent is never collapsed

`codex-write-lock.ts:70-74` types the outcome so `busy` carries `retryable: true` while `refused`
carries `retryable: false`, and `:310` explains that an identity failure "will fail identically
forever; telling a caller to retry" turns a permanent denial into an endless loop (`:19-23`).

**Adoptable lesson:** make retryability part of the lock result type, so a permanent refusal can
never be mistaken for contention.

### 5.5 Runtime permit registry rather than type-level proof

`src/codex/catalog-write-serialization.ts:14-19` records a subtle failure: an opaque TypeScript
permit type proves a permit-bearing call path *exists*, but "a leaked permit used after its callback
returned type-checks perfectly". The module therefore keeps a private active-permit registry and
every mutator asks at runtime whether the permit is still live for the home being written
(`:38-50`). The module header (`:4-12`) also documents why "the replacement happens under a lock" is
insufficient when a read-transform-write transaction awaits in the middle.

**Adoptable lesson:** serialize the whole read-transform-write transaction, and enforce permits with
a runtime registry, since a branded type cannot prove the lock is still held.

### 5.6 POSIX-mode hardening is attempted, then degraded honestly

`src/codex/history-lock.ts:167,183` guards mode changes with `process.platform !== "win32"` and
wraps the chmod in a try/catch commented "Windows applies ACLs in WP11". Windows ACLs get their own
module (`src/lib/windows-secret-acl.ts`) driven through `icacls.exe`.

**Adoptable lesson:** do not silently no-op POSIX permissions on Windows; branch explicitly and
handle ACLs through `icacls` as a separate, named concern.

---

## Cross-cutting: how this code stays testable

Two habits make the above verifiable from a single CI OS, and are worth adopting before any
individual pattern:

1. **Platform as a parameter.** `commandInvocation(cmd, args, platform, deps)`,
   `samePathIdentity(l, r, platform)`, `nativeMainOwnerFilesystemSupported(home, platform, env)`, and
   the `CodexHomeDeps` bag all take platform and IO as arguments with `process.*` defaults.
2. **Named test seams that production never reads.** `setTrustedWindowsElevationExecutablesForTests`
   (`windows-elevation.ts:185`) exists precisely because Linux CI fakes win32 but has no System32,
   and its docstring states production resolution never consults it.

**Adoptable lesson:** thread `platform` and IO through as defaulted parameters so Windows-only
branches are exercised on Linux CI, and label test-only overrides explicitly.

---

## Adoption priority for codexclaw

| Priority | Pattern | Source |
| --- | --- | --- |
| P0 | `commandInvocation` PATHEXT + `cmd.exe /d /s /c` + no `shell: true` | `src/lib/win-exec.ts` |
| P0 | `renameAtomicFile` bounded EBUSY/EPERM/EACCES retry | `src/lib/windows-atomic-replace.ts` |
| P0 | Platform-parameterized `samePathIdentity` + win32 case folding for keys | `user-identity.ts:447`, `codex-write-lock.ts:217` |
| P1 | `decodeWindowsTextBytes` ordered decoder | `src/lib/windows-text.ts` |
| P1 | 8.3 short-name tolerance with link-aware gate | `log-guard/path-safety.ts:43-88` |
| P1 | Filesystem support check (UNC / drvfs / `/mnt`) before locking | `native-main-owner.ts:76-92` |
| P2 | WSL detection + `[automount] root` parsing with injected deps | `src/codex/home.ts:51-119` |
| P2 | `%USERPROFILE%` indirection for generated batch files | `src/lib/win-paths.ts` |
| P2 | Dominant-EOL preservation on config rewrites | `grok/inject.ts:388`, `omp-yaml-source.ts:141` |
| P3 | Trusted System32 resolution via `GetSystemDirectoryW` | `windows-elevation.ts:115-230` |
| P3 | SQLite `BEGIN IMMEDIATE` locking with `busy_timeout = 0` | `native-main-owner.ts:186` |
