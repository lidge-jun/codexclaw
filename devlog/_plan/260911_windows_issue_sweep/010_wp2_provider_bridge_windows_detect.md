# 010 — wp2 / L1 / #131 provider-bridge Windows detect

Date: 2026-09-11 (KST). Worktree `C:\\Users\\super\\Developers\\codexclaw`, branch `codex/win-sweep-roadmap`, HEAD `9cd52769`. This file is the plan. No production code was changed in this cycle.

Sources: `000_plan.md` wp2, constraint "Reuse win-exec.ts", criterion **c-9**. Implementation commit `f280394b` (`codex/fix-ocx-windows-detect`, parent `9cd52769`) was read with `git show f280394b`. Before blocks are quoted from L0 HEAD.

Detect-only: never `ocx ensure`, never `ocx sync`, never write Codex config (Q-P2-2).

## 1. Goal

`provider-bridge` on Windows must (1) pick a PATHEXT launcher from `where` stdout instead of the extensionless npm shim, and (2) run `.cmd`/`.bat` through ComSpec. Each half has its own test. GUI/serve copies are wp6 (`050`). This document owns provider-bridge only.

criterion: **c-9** (wp2 half: launcher selection + ComSpec spawn, separate tests).

## 2. File map

| file | NEW/MODIFY/DELETE | change |
|---|---|---|
| `plugins/codexclaw/components/provider-bridge/src/win-exec.ts` | NEW | Byte-identical copy of `cxc-ops/src/win-exec.ts`. SHA256 `B7B07DE668F622EA1AC0CD1A82FE04B61C85A41E9390233D22AEBAA4AF175E3D` (same bytes as `pabcd-state` / `cxc-ops` / `skill-search` / `subagent-config`). `build.mjs` allows only `node:*` + relative imports inside a component, so a cross-component import is illegal. |
| `plugins/codexclaw/components/provider-bridge/dist/win-exec.js` | NEW | `npm run build` output. `.gitignore:2` ignores `dist/`, so `git add -f plugins/codexclaw/components/provider-bridge/dist/win-exec.js`. |
| `plugins/codexclaw/components/provider-bridge/src/cli.ts` | MODIFY | Add `selectExecutableFromWhereOutput` for the `where` first-line bug. `runOcxStatus` must call the copied `commandInvocation`, not an inlined ComSpec wrapper. Direct-exec guard so tests can import `cli.ts`. |
| `plugins/codexclaw/components/provider-bridge/dist/cli.js` | MODIFY | compileSource of the same commit. Already tracked. |
| `plugins/codexclaw/components/provider-bridge/test/detect.test.ts` | MODIFY | Launcher-selection test + ComSpec spawn test + SHARED-HELPER-01 byte-identity check. |

No DELETE. Do not modify `detect.ts`.

## 3. Current code (L0 `9cd52769`)

`plugins/codexclaw/components/provider-bridge/src/cli.ts:15-36`:

```ts
/** Real PATH resolver via the platform `command -v` / `where`. */
function whichOcx(cmd: string): string | null {
  const finder = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [cmd] : ["-v", cmd];
  try {
    const res = spawnSync(finder, args, { encoding: "utf8", shell: process.platform !== "win32" });
    if (res.status === 0 && typeof res.stdout === "string") {
      const path = res.stdout.split("\\n")[0]?.trim();
      return path && path.length > 0 ? path : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Real ocx status reader (detect-only — `status --json` is read-only; never
 *  `ensure`/`sync`, which would mutate codex config). */
function runOcxStatus(ocxPath: string): { status: number | null; stdout: string } {
  const res = spawnSync(ocxPath, ["status", "--json"], { encoding: "utf8", timeout: 8000 });
  return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
}
```

`cli.ts:57-65` (importing the module exits immediately, so a test cannot import launcher helpers):

```ts
const [, , kind, event] = process.argv;
if (kind === "hook" && event === "session-start") {
  process.exit(runSessionStartHook());
}
// Allow `provider-bridge detect` for cxc doctor / manual probes.
if (kind === "detect") {
  process.exit(runBridge());
}
process.exit(0);
```

`where` prints the extensionless npm sh shim first (`get-command-where-disagree`). Spawning that path or a `.cmd` without a shell is EINVAL (`spawn-npm-enoent-einval`, CVE-2024-27980).

Note: the live source at `:22` is `res.stdout.split("\n")[0]?.trim();` — a JS `"\\n"` split, not a CRLF-aware split. `where.exe` emits CRLF; `.trim()` currently strips the leftover CR by accident.

## 4. The committed implementation is correct but is a third ComSpec wrapper

Commit `f280394b` fixes both halves and is verified on this host (provider-bridge
tests 9/9; the session-start hook emits `"mode":"provider"` with `C:\nvm4w\nodejs\ocx.cmd`).
It does so with a bespoke helper pair: `selectExecutableFromWhereOutput()` parsing
`where` stdout, and an inline `spawnSync(ComSpec, ["/d","/s","/c", `"${ocxPath}" status --json`])`.

The 000_plan constraint says reuse `win-exec.ts`, and comparing the two makes the
reason concrete rather than stylistic. `commandInvocation()` in
`cxc-ops/src/win-exec.ts` already handles four things the bespoke version does not:

| `win-exec.ts` behaviour | bespoke version |
|---|---|
| `envValue()` reads `PATH`/`PATHEXT` **case-insensitively** — a spawned child can arrive with `Path`, `PATH`, or both | reads `process.env.PATHEXT` only |
| `resolveWindowsCommand()` walks PATH+PATHEXT itself and retries the **lowercased** extension for case-sensitive filesystems (WSL, Linux CI) | depends on `where.exe` stdout, which does not exist off win32 |
| splits PATH on a literal `;` with an explicit comment that `node:path`'s `delimiter` follows the HOST and would collapse a Windows PATH on a Linux runner | not applicable, but the same trap sits in this repo's test fixtures (corpus `path-colon-not-delimiter`) |
| `escapeCmdArg()`/`escapeCmdCommand()` escape `()%!^"<>&|;,` and space, cross-spawn style | wraps the path in plain double quotes. A launcher path containing `&` or `^` is a cmd injection (corpus `cmd-start-ampersand-splits`, `backslash-quote-ends-span`) |

The last row is the one that matters: `windowsVerbatimArguments: true` with a naively
quoted path hands cmd.exe an unescaped metacharacter. `C:\nvm4w\nodejs` is benign, so the
host verification cannot distinguish the two implementations — which is exactly why
this must be fixed by construction rather than by observation.

**Decision: keep the shape of `f280394b` but replace both helpers with the existing
module.** `resolveWindowsCommand()` also removes the `where` parsing entirely, so the
first-line bug stops being something to work around.

### 4.1 NEW `provider-bridge/src/win-exec.ts`

Byte-identical copy of `cxc-ops/src/win-exec.ts`. `build.mjs` permits only `node:*` and
relative imports inside a component, so a cross-component import is illegal and a copy
is the sanctioned form — the same copy already exists in `pabcd-state`, `cxc-ops`,
`messenger-bridge`, `skill-search` and `subagent-config`.

```powershell
Copy-Item plugins/codexclaw/components/cxc-ops/src/win-exec.ts `
  plugins/codexclaw/components/provider-bridge/src/win-exec.ts
```

### 4.2 MODIFY `provider-bridge/src/cli.ts`

after (replaces both helpers quoted in §3):

```ts
import { spawnSync } from "node:child_process";
import { commandInvocation, resolveWindowsCommand } from "./win-exec.ts";
import { detectOcx, renderStatusLine, type DetectDeps } from "./detect.ts";

/**
 * Resolve `ocx` to a spawnable path.
 *
 * #131: on win32 `where ocx` lists the extensionless npm sh shim FIRST, and that
 * file is not an executable image, so spawnSync ENOENTs. Rather than pick a line
 * out of `where` stdout, resolve PATH+PATHEXT directly — resolveWindowsCommand()
 * reads PATH/PATHEXT case-insensitively and retries lowercased extensions, which a
 * `where` parse cannot do. POSIX keeps `command -v`.
 */
function whichOcx(cmd: string): string | null {
  if (process.platform === "win32") {
    const resolved = resolveWindowsCommand(cmd, process.env);
    // resolveWindowsCommand returns its input when nothing matched.
    return resolved === cmd ? null : resolved;
  }
  try {
    const res = spawnSync("command", ["-v", cmd], { encoding: "utf8", shell: true });
    if (res.status === 0 && typeof res.stdout === "string") {
      const path = res.stdout.split(/\r?\n/)[0]?.trim();
      return path && path.length > 0 ? path : null;
    }
  } catch { /* fall through */ }
  return null;
}

/** Real ocx status reader (detect-only — `status --json` is read-only; never
 *  `ensure`/`sync`, which would mutate codex config).
 *
 *  #131 second half: after CVE-2024-27980 Node refuses a shell-less `.cmd` spawn
 *  (EINVAL). commandInvocation routes only `.cmd`/`.bat` through ComSpec and escapes
 *  cmd metacharacters; `shell: true` would not escape them. */
function runOcxStatus(ocxPath: string): { status: number | null; stdout: string } {
  const inv = commandInvocation(ocxPath, ["status", "--json"]);
  const res = spawnSync(inv.file, inv.args, { encoding: "utf8", timeout: 8000, ...inv.options });
  return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
}
```

Keep the direct-exec guard from `f280394b` (`process.argv[1]` realpath compared against
`import.meta.url`): without it, importing `cli.ts` from a test calls `process.exit(0)`.
Do not touch `detect.ts`.

## 5. MODIFY `test/detect.test.ts` — two halves, two tests

c-9 requires launcher selection and ComSpec spawn to be proven **separately**. A single
end-to-end test passes when only one half works.

```ts
import { commandInvocation, resolveWindowsCommand } from "../src/win-exec.ts";

// Half 1 — launcher selection. A directory holding BOTH the extensionless npm shim
// and the .cmd launcher must resolve to the .cmd. This is #131's first cause.
test("win32 launcher selection prefers the PATHEXT launcher over the extensionless shim", t => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-pb-which-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "ocx"), "#!/bin/sh\n");      // npm sh shim, not an image
  writeFileSync(join(dir, "ocx.cmd"), "@echo off\n");  // the real launcher
  const resolved = resolveWindowsCommand("ocx", { PATH: dir, PATHEXT: ".COM;.EXE;.BAT;.CMD" });
  assert.equal(resolved, join(dir, "ocx.cmd"));
  // Case-insensitive env: a child may arrive with `Path` instead of `PATH`.
  assert.equal(resolveWindowsCommand("ocx", { Path: dir }), join(dir, "ocx.cmd"));
});

// Half 2 — ComSpec routing. A .cmd must go through cmd.exe with verbatim args; an
// .exe must not. Asserted on the invocation shape so it runs on every platform.
test("win32 .cmd routes through ComSpec with verbatim args; .exe does not", () => {
  const cmd = commandInvocation("C:\\nvm4w\\nodejs\\ocx.cmd", ["status", "--json"], "win32", { ComSpec: "C:\\Windows\\system32\\cmd.exe" });
  assert.equal(cmd.file, "C:\\Windows\\system32\\cmd.exe");
  assert.deepEqual(cmd.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(cmd.options.windowsVerbatimArguments, true);
  assert.match(cmd.args[3], /status/);

  const exe = commandInvocation("C:\\tools\\ocx.exe", ["status", "--json"], "win32", {});
  assert.equal(exe.file, "C:\\tools\\ocx.exe");
  assert.deepEqual(exe.args, ["status", "--json"]);
  assert.notEqual(exe.options.windowsVerbatimArguments, true);

  // A metacharacter in the launcher path must be escaped, not passed through.
  const amp = commandInvocation("C:\\a&b\\ocx.cmd", ["status"], "win32", {});
  assert.match(amp.args[3], /\^&/);
});

// SHARED-HELPER-01: the copy must not drift from its source.
test("provider-bridge win-exec.ts is byte-identical to the cxc-ops original", () => {
  const here = readFileSync(new URL("../src/win-exec.ts", import.meta.url));
  const origin = readFileSync(new URL("../../cxc-ops/src/win-exec.ts", import.meta.url));
  assert.deepEqual(here, origin);
});
```

Keep the `status: null` → `error` test from `f280394b`: it pins that a failed spawn is
never silently downgraded to `native`.

## 6. Reproduction (parent fails, L1 head passes)

```powershell
node plugins/codexclaw/components/provider-bridge/dist/cli.js detect
```

Parent (`a267b398`): `{"provider":"ocx","mode":"error","ocxPath":"C:\nvm4w\nodejs\ocx","reason":"ocx status exited null"}`.
L1 head: `{"provider":"ocx","mode":"provider","ocxPath":"C:\nvm4w\nodejs\ocx.cmd","running":true,"defaultProvider":"openai","port":10100}`.

The two spawn failures behind `exited null`, measured on this host:

```text
C:\nvm4w\nodejs\ocx                  status=null  err=ENOENT
C:\nvm4w\nodejs\ocx.cmd              status=null  err=EINVAL
C:\nvm4w\nodejs\ocx.cmd via ComSpec  status=0     stdout=3931 bytes
```

Then the suite and the build:

```powershell
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/provider-bridge/test/*.test.ts"
npm run build
git add -f plugins/codexclaw/components/provider-bridge/dist/win-exec.js
npm run gate
cxc receipt test --session <id> -- node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/provider-bridge/test/*.test.ts"
```

`dist/win-exec.js` is a NEW file and `.gitignore:2` ignores `dist/`, so it needs `-f`.
`dist/cli.js` is already tracked and restages normally.

## 7. Regression risk

Low, and narrower than `f280394b`. `detect.ts` and the detect-only contract are
untouched: no `ocx ensure`, no `ocx sync`, no config write.

`whichOcx` now returns `null` when `resolveWindowsCommand` finds nothing, which keeps the
absent-ocx path on `mode:"native"` rather than `error` — the existing AC2 test pins that.
The behaviour difference from `where` is that a launcher reachable only through a
`where`-visible alias but not through PATH+PATHEXT would no longer be found; no such
case exists for npm global installs, which is the shape #131 reports.

The real hazard is copy drift: `win-exec.ts` now lives in six components. The
byte-identity test in §5 is the guard, and it fails loudly if the original is edited
without propagating.

## 8. Criterion

**c-9**, wp2 half: launcher selection and ComSpec spawn each proved by their own test
(§5 halves 1 and 2), and `mode` is `provider` rather than `error` on this host (§6). The
"every copy" half of c-9 — the GUI and `cxc serve` duplicates — belongs to wp6 (`050`).
