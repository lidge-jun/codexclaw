# 050 - wp06 spawn and quoting

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp06.

Defects closed from 002 section D:

| # | Sev | Location | Problem |
|---|-----|----------|---------|
| 7 | P1 | `bin/codexclaw.mjs:259` | venv python at `bin/python3`; win32 bootstrap self-destructs |
| 8 | P1 | `bin/codexclaw.mjs:400` | `spawnSync("npm")` ENOENT (needs `npm.cmd`) |
| 9 | P1 | `bin/codexclaw.mjs:253`, `doctor.ts:409` | `python3` hits the Store stub, exit 9009, no hint |
| 10 | P2 | `skill-search/src/cli.ts:82` | launch failure vs auth failure indistinguishable |
| 11 | P2 | `messenger-bridge/src/runner.ts:263-318` | no win32 process-tree kill; orphans + hung turns |

All five were MEASURED on this machine (002 B4/B5/B6): `spawnSync("npm", ["--version"])`
returns `error=ENOENT` despite `npm.cmd` being on PATH; `spawnSync("python3", ["--version"])`
returns `error=none, status=9009` from the Microsoft Store stub; `spawnSync("gh", ...)`
succeeds because the official install ships `gh.exe`.

Pattern adopted from 001 section 3.1: one `commandInvocation` helper resolves PATHEXT,
spawns `.exe` directly, and routes `.cmd`/`.bat` through `ComSpec /d /s /c` with
`windowsVerbatimArguments`. `shell: true` is banned outright - Node does not escape cmd
metacharacters there, and `guiDir` can contain spaces.

Note the repo already has most of this: `cxc-resolve.ts:37,47` handles `WIN_EXTS`
(`.cmd/.exe/.bat/.ps1`) and splits PATH with `path.delimiter` (002 section C names it the
model to follow). This slice promotes that logic into a spawn-shaped helper.

## MODIFY / NEW / DELETE map

### 1. NEW plugins/codexclaw/components/cxc-ops/src/win-exec.ts

```ts
/**
 * win-exec.ts - one entry point for spawning external commands.
 *
 * Three Windows facts drive this (opencodex `src/lib/win-exec.ts:1-11`):
 *  1. npm-installed CLIs are `.cmd` shims, and Node refuses shell-less `.cmd` spawns
 *     after the CVE-2024-27980 hardening.
 *  2. A bare command name skips PATHEXT resolution, so `spawn("npm")` ENOENTs even
 *     with `npm.cmd` on PATH (measured, 002 B4).
 *  3. `shell: true` is not a fix: Node does not escape cmd metacharacters there, so
 *     a path containing `&` or `^` becomes a command injection.
 *
 * Env vars are read case-insensitively: a spawned child can arrive with `Path`,
 * `PATH`, or both, and reading one fixed spelling resolves against the wrong list
 * (001 3.2).
 */
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

export interface Invocation {
  file: string;
  args: string[];
  options: { windowsVerbatimArguments?: boolean };
}

/** Case-insensitive env lookup with a key-scan fallback. */
export function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const direct = env[name];
  if (direct !== undefined) return direct;
  const lower = name.toLowerCase();
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === lower) return env[key];
  }
  return undefined;
}

const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/** Resolve `command` against PATH + PATHEXT. Returns the input when nothing matches. */
export function resolveWindowsCommand(command: string, env: NodeJS.ProcessEnv): string {
  if (command.includes("/") || command.includes("\\") || isAbsolute(command)) return command;
  const exts = (envValue(env, "PATHEXT") ?? DEFAULT_PATHEXT).split(";").filter((e) => e.length > 0);
  const dirs = (envValue(env, "PATH") ?? "").split(delimiter).filter((d) => d.length > 0);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, command + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return command;
}

/** cross-spawn's escaping: double backslashes before quotes, quote, then caret. */
function escapeCmdArg(arg: string): string {
  let out = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  out = `"${out}"`;
  return out.replace(/[()%!^"<>&|;, ]/g, "^$&");
}

function escapeCmdCommand(command: string): string {
  return command.replace(/[()%!^"<>&|;, ]/g, "^$&");
}

/**
 * Build the spawn shape for `command`. POSIX is a passthrough; win32 resolves
 * PATHEXT and routes only `.cmd`/`.bat` through cmd.exe.
 */
export function commandInvocation(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Invocation {
  if (platform !== "win32") return { file: command, args: [...args], options: {} };
  const resolved = resolveWindowsCommand(command, env);
  if (!/\.(cmd|bat)$/i.test(resolved)) return { file: resolved, args: [...args], options: {} };
  const line = [escapeCmdCommand(resolved), ...args.map(escapeCmdArg)].join(" ");
  return {
    file: envValue(env, "ComSpec") ?? "cmd.exe",
    args: ["/d", "/s", "/c", `"${line}"`],
    options: { windowsVerbatimArguments: true },
  };
}
```

### 2. MODIFY bin/codexclaw.mjs

`bin/codexclaw.mjs` is plain ESM with no build step, so it cannot import the TS module
above. It gets the same three rules inline; the TS helper serves the components.

#### 2a. defect #8 - `cxc gui` npm ENOENT

BEFORE (:395-401)
```js
    if (!existsSync(guiVite) && !existsSync(rootVite)) {
      console.log("codexclaw gui: dependencies not installed. Run `npm install` in plugins/codexclaw/gui first.");
      process.exit(1);
    }
    console.log("codexclaw gui: starting the dashboard (Vite will print the local URL)...");
    const res = spawnSync("npm", ["run", "dev"], { cwd: guiDir, stdio: "inherit" });
    process.exit(typeof res.status === "number" ? res.status : 1);
```

AFTER
```js
    if (!existsSync(guiVite) && !existsSync(rootVite)) {
      // 002 B18: name the real directory rather than a POSIX-looking relative path.
      console.log(`codexclaw gui: dependencies not installed. Run \`npm install\` in ${guiDir} first.`);
      process.exit(1);
    }
    console.log("codexclaw gui: starting the dashboard (Vite will print the local URL)...");
    // npm on PATH is an extensionless shell script Node cannot exec, and a bare
    // "npm" skips PATHEXT, so this ENOENTs on Windows even though npm works in the
    // same shell (measured, 002 B4). shell:true is NOT the fix - guiDir may contain
    // spaces and Node does not escape cmd metacharacters under shell:true.
    const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
    const res = spawnSync(npmBin, ["run", "dev"], { cwd: guiDir, stdio: "inherit" });
    if (res.error && res.error.code === "ENOENT") {
      console.error(`codexclaw gui: ${npmBin} not found on PATH; install Node.js/npm and retry`);
      process.exit(1);
    }
    process.exit(typeof res.status === "number" ? res.status : 1);
```

#### 2b. defect #7 - venv interpreter path

BEFORE (:256-260)
```js
/** Locate the user-level rebuildable repomap venv (philosophy paragraph 2 derived-cache rule). */
export function repoMapVenvPython(env, home) {
  const base = env.CODEXCLAW_HOME && env.CODEXCLAW_HOME.trim() !== "" ? env.CODEXCLAW_HOME : join(home, ".codexclaw");
  return join(base, "venvs", "repomap", "bin", "python3");
}
```

AFTER
```js
/**
 * Locate the user-level rebuildable repomap venv.
 *
 * Windows venvs put the interpreter at `Scripts\python.exe`, never `bin/python3`. With
 * the POSIX-only path, `hasVenv` was always false on Windows, so every
 * `CODEXCLAW_MAP_BOOTSTRAP=1` run created a venv, failed to find its pip, and
 * rmSync'd the venv it had just built (002 B7).
 *
 * `platform` is a parameter so the packaging test can assert both shapes from one OS.
 */
export function repoMapVenvPython(env, home, platform = process.platform) {
  const base = env.CODEXCLAW_HOME && env.CODEXCLAW_HOME.trim() !== "" ? env.CODEXCLAW_HOME : join(home, ".codexclaw");
  return platform === "win32"
    ? join(base, "venvs", "repomap", "Scripts", "python.exe")
    : join(base, "venvs", "repomap", "bin", "python3");
}
```

`runRepoMap` (:272) computes `venvDir` as `dirname(dirname(venvPython))`, which stays
correct under both shapes (`.../repomap/Scripts/python.exe` -> `.../repomap`).

#### 2c. defect #9 - the python3 Store stub

BEFORE (:250-253)
```js
  if (!wantsHelp && hasVenv) {
    return { cmd: venvPython, args: ["-B", scriptPath, ...args] };
  }
  return { cmd: env.CODEXCLAW_PYTHON || "python3", args: ["-B", scriptPath, ...args] };
```

AFTER
```js
  if (!wantsHelp && hasVenv) {
    return { cmd: venvPython, args: ["-B", scriptPath, ...args] };
  }
  // On Windows, bare "python3" resolves to the Microsoft Store stub at
  // %LOCALAPPDATA%\Microsoft\WindowsApps\python3.exe - a real executable that
  // exits 9009 without running Python, so it is not even an ENOENT (002 B6).
  // The py launcher ships with every python.org install at C:\Windows\py.exe.
  if (platform === "win32") {
    return { cmd: "py", args: ["-3", "-B", scriptPath, ...args] };
  }
  return { cmd: env.CODEXCLAW_PYTHON || "python3", args: ["-B", scriptPath, ...args] };
```

`selectRepoMapCommand`'s signature gains the platform:
`export function selectRepoMapCommand(args, env, deps, platform = process.platform)`.
It stays pure, so the existing offline packaging test keeps working.

Also widen the failure branch. BEFORE (:288-293)
```js
  const res = spawnSync(sel.cmd, sel.args, { stdio: "inherit" });
  if (res.error && res.error.code === "ENOENT") {
    console.error(`codexclaw map: ${sel.cmd} not found; install Python 3.9+ or set CODEXCLAW_PYTHON`);
    return 1;
  }
  return typeof res.status === "number" ? res.status : 1;
```

AFTER
```js
  const res = spawnSync(sel.cmd, sel.args, { stdio: "inherit" });
  // 9009 is cmd.exe's "command not recognized" and the Store stub's exit code;
  // 127 is the POSIX equivalent. Neither sets res.error, so the ENOENT-only guard
  // let `cxc map` exit silently with no diagnostic at all (002 B6).
  const notFound =
    (res.error && res.error.code === "ENOENT") || res.status === 9009 || res.status === 127;
  if (notFound) {
    console.error(
      `codexclaw map: ${sel.cmd} could not be run (exit ${res.status ?? "spawn error"}).` +
        (process.platform === "win32"
          ? " Install Python 3.9+ from python.org (the Microsoft Store alias exits 9009 without running), or set CODEXCLAW_PYTHON."
          : " Install Python 3.9+ or set CODEXCLAW_PYTHON."),
    );
    return 1;
  }
  return typeof res.status === "number" ? res.status : 1;
```

And the venv bootstrap interpreter at :274, `spawnSync("python3", ["-m", "venv", venvDir])`,
becomes `spawnSync(process.platform === "win32" ? "py" : "python3", bootstrapArgs)` with
`bootstrapArgs = process.platform === "win32" ? ["-3", "-m", "venv", venvDir] : ["-m", "venv", venvDir]`.

### 3. MODIFY plugins/codexclaw/components/cxc-ops/src/doctor.ts

`doctor.ts:409` probes ast-grep through a python helper and WARNs about a missing helper
when it is really the Store stub. Route it through `commandInvocation` and treat
9009/127 as "not installed" rather than "broken":

```ts
const inv = commandInvocation(pythonBin, ["-m", "ast_grep_cli", "--version"], process.platform);
const res = spawnSync(inv.file, inv.args, { encoding: "utf8", ...inv.options });
const missing = res.error?.code === "ENOENT" || res.status === 9009 || res.status === 127;
```

### 4. MODIFY plugins/codexclaw/components/skill-search/src/cli.ts - defect #10

BEFORE (:76-87)
```ts
function ghSearch(query: string, limit: number): ScoredRow[] {
  const res = spawnSync(
    "gh",
    ["search", "code", `filename:SKILL.md ${query}`, "--limit", String(limit), "--json", "repository,path"],
    { encoding: "utf8" },
  );
  if (res.status !== 0 || !res.stdout) {
    process.stderr.write(
      `skill-search: gh code search unavailable (${res.stderr?.trim() || "gh CLI missing or not authenticated"})\n`,
    );
    return [];
  }
```

AFTER
```ts
function ghSearch(query: string, limit: number): ScoredRow[] {
  // The official gh install ships gh.exe, which PATHEXT resolves; scoop and
  // npm-wrapped distributions ship a .cmd shim, which needs cmd.exe (002 B5).
  const inv = commandInvocation(
    "gh",
    ["search", "code", `filename:SKILL.md ${query}`, "--limit", String(limit), "--json", "repository,path"],
  );
  const res = spawnSync(inv.file, inv.args, { encoding: "utf8", ...inv.options });
  // A failed LAUNCH sets res.error and leaves status null; a failed AUTH exits
  // non-zero with a message. Collapsing both into one string made a missing gh
  // and an expired token indistinguishable.
  if (res.error) {
    const hint =
      res.error.code === "ENOENT"
        ? "gh is not on PATH - install the GitHub CLI from cli.github.com"
        : `gh could not be launched: ${res.error.message}`;
    process.stderr.write(`skill-search: ${hint}\n`);
    return [];
  }
  if (res.status !== 0 || !res.stdout) {
    process.stderr.write(
      `skill-search: gh code search failed (${res.stderr?.trim() || "gh exited " + String(res.status) + " - try \`gh auth status\`"})\n`,
    );
    return [];
  }
```

Leave `dir.split("/").pop()` at :98 alone. 002 B17 marks it explicitly
deliberately-not-a-defect: those are GitHub API paths, always forward-slash, and
"fixing" them to `path.sep` would break them on Windows.

### 5. MODIFY plugins/codexclaw/components/messenger-bridge/src/runner.ts - defect #11

BEFORE (:263-274, :306-318)
```ts
export function terminateChild(child: ChildProcess): void {
  signalProcessTree(child, "SIGTERM");
  if (process.platform !== "win32") {
    const timer = setTimeout(() => {
      signalProcessTree(child, "SIGKILL");
    }, SIGKILL_GRACE_MS);
    timer.unref?.();
  }
}
...
function signalProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Race with process exit or a platform without group signalling.
    }
  }
  child.kill(signal);
}
```

AFTER
```ts
export function terminateChild(child: ChildProcess): void {
  signalProcessTree(child, "SIGTERM");
  // The escalation used to be POSIX-only, so on Windows a codex process that
  // spawned MCP helpers left them holding the pipe: the turn timeout fired,
  // terminateChild ran, and the promise never settled (002 B13).
  const timer = setTimeout(() => {
    if (process.platform === "win32") killWindowsTree(child);
    else signalProcessTree(child, "SIGKILL");
  }, SIGKILL_GRACE_MS);
  timer.unref?.();
}

/**
 * Windows has no process groups and no real signals, so `child.kill()` reaches only
 * the direct child. `taskkill /T` walks the tree by parent pid.
 *
 * argv array with no shell: the pid is a number we produced, but routing it
 * through a shell would be a quoting hazard for no benefit.
 */
function killWindowsTree(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      timeout: 5_000,
    });
  } catch {
    // Fall back to the direct child; the process may already be gone.
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // Already exited.
  }
}
```

`signalProcessTree` is unchanged: its `child.kill(signal)` tail is still the right
SIGTERM-equivalent on Windows. Only the escalation gains a tree walk, and it stays
behind the existing `SIGKILL_GRACE_MS` timer so grace semantics match POSIX.

### 6. Package wiring (SHARED-HELPER-01)

`win-exec.ts` lives in `cxc-ops` because the `doctor.ts` call sites are there. But
section 4 calls `commandInvocation` from `skill-search/src/cli.ts` and section 5 calls it
from `messenger-bridge/src/runner.ts`, and those are SEPARATE workspace packages. A
`from "../../cxc-ops/src/win-exec.ts"` import would not resolve at build time:
`rg` for `from "../../` across all component sources returns zero hits, because this
repo keeps components dependency-free of each other.

Same rule as 040 section 6, applied uniformly across win-exec, wsl, text-lines, and
atomic-write: **each consuming package gets its own copy or two-line re-export module at
the same relative path** (`src/win-exec.ts`), never a cross-package import. So:

| Package | File | Content |
|---------|------|---------|
| `cxc-ops` | `src/win-exec.ts` | the implementation (section 1) |
| `skill-search` | `src/win-exec.ts` | same body, copied |
| `messenger-bridge` | `src/win-exec.ts` | same body, copied |

Each consumer then imports `from "./win-exec.ts"`. If a real shared package is preferred,
that is a scope expansion to raise, not assume - and it should be raised ONCE for all four
helpers rather than per-phase. Filed in 100 section 5.

The duplication is deliberate and bounded: `win-exec.ts` is a pure function over
`(file, args, platform)` with no state, so three copies cannot drift semantically without
a test catching it. Test 1 of the win-exec suite is duplicated into each consuming
package's suite as a one-line identity check for exactly that reason.

### 7. Not in this slice

`receipt-cli.ts:79` uses `shell: false` with an argv array BY DESIGN ("the recorded
command must be the argv that actually ran", 002 section C). The consequence is that
`cxc receipt test -- npm test` hits the same `.cmd` problem on Windows. The fix belongs
in a documented wrapper (`cxc receipt test -- npm.cmd test`, or a receipt-side
`commandInvocation` that records BOTH the requested and executed argv), not by turning on
`shell: true` here. File it, and note it in 080_ci_lane.md where receipts get wired.

## TESTS

NEW `plugins/codexclaw/components/cxc-ops/test/win-exec.test.ts`

1. "POSIX is a passthrough" - `commandInvocation("npm", ["run", "dev"], "linux")` returns
   the input verbatim with empty options.
2. "an .exe resolves and spawns directly" - a fake PATH dir containing `gh.exe` yields
   `file` ending in `gh.exe` and no `cmd.exe`.
3. "a .cmd routes through ComSpec" - `file` is the ComSpec value, `args[0..2]` are
   `/d /s /c`, and `windowsVerbatimArguments` is true.
4. "arguments with spaces and metacharacters survive" - an arg of
   `C:\Program Files\a&b` comes back quoted with `&` carets.
5. "envValue finds Path when asked for PATH" and returns undefined for a genuinely
   absent key.
6. "PATHEXT defaults when unset" - `.EXE` is still tried.
7. "an unresolvable command returns the input" - no throw, so the caller's own
   ENOENT handling still runs.

MODIFY `plugins/codexclaw/test/repo-map-packaging.test.mjs`

8. "repoMapVenvPython returns Scripts\python.exe on win32" and `bin/python3` on linux,
   from one OS via the platform parameter.
9. "selectRepoMapCommand's final rung is py -3 on win32" - assert
   `{ cmd: "py", args: ["-3", "-B", ...] }` with `hasUv: false, hasVenv: false`.
10. "the linux rung is unchanged" - still `python3`.
11. "CODEXCLAW_PYTHON still wins on win32" - the env override precedes the py rung.
12. "--help short-circuits on both platforms" - the existing behavior at :240.

NEW cases in `plugins/codexclaw/components/skill-search/test/`

13. "a launch ENOENT reports an install hint, not an auth hint" - stub `spawnSync` to
    return `{ error: { code: "ENOENT" }, status: null }` and assert stderr matches
    `/not on PATH/` and NOT `/authenticated/`.
14. "a non-zero exit reports the auth hint" - `{ status: 4, stderr: "auth required" }`
    matches `/gh auth status/`.

NEW cases in `plugins/codexclaw/components/messenger-bridge/test/`

15. "win32 escalation calls taskkill with /T /F" - inject the spawn function and assert
    the argv is `["/pid", "<pid>", "/T", "/F"]` with `shell` absent.
16. "POSIX escalation still uses SIGKILL on the negative pid" - no taskkill.
17. "escalation waits for SIGKILL_GRACE_MS on both platforms" - a fake timer asserts
    the win32 path is not immediate.
18. "a pidless child is a no-op, not a throw".

## Verification (C)

Run from the repo root; each command must exit 0.

```powershell
node --test --test-concurrency=1 "plugins/codexclaw/components/cxc-ops/test/win-exec.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/test/repo-map-packaging.test.mjs"
node --test --test-concurrency=1 "plugins/codexclaw/components/skill-search/test/*.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/messenger-bridge/test/*.test.ts"
npm test
node plugins/codexclaw/scripts/gate.mjs
```

Manual acceptance for defect #8 (this currently fails with a bare exit 1 after printing
"starting the dashboard"):

```powershell
node bin/codexclaw.mjs gui
```

Expected: Vite starts and prints a localhost URL. Ctrl-C to stop.

Manual acceptance for defect #9 (currently exits 9009 with NO message):

```powershell
node bin/codexclaw.mjs map --help
```

Expected: the repomap help text, or an install hint naming the Store-alias problem.
Exit code must not be 9009 with empty output.

Manual acceptance for defect #7 - the create-then-destroy cycle:

```powershell
$env:CODEXCLAW_MAP_BOOTSTRAP="1"; node bin/codexclaw.mjs map --help
Test-Path "$env:USERPROFILE\.codexclaw\venvs\repomap\Scripts\python.exe"
```

Expected `True`: the venv survives the run instead of being rmSync'd.

Defect #10 acceptance - rename gh temporarily, or run with a scrubbed PATH:

```powershell
$env:PATH=""; node bin/codexclaw.mjs skill search test 2>&1 | Select-String "not on PATH"
```

WSL parity (the POSIX branches must be untouched), expected exit 0:

```bash
wsl -d Ubuntu -- bash -lc "cd ~/codexclaw-wsl-checkout && npm test && node bin/codexclaw.mjs map --help"
```

Record the C>D receipt with `cxc receipt test -- npm test` per CHECK-BINDING-01. Note
the receipt wrapper caveat from section 7: on Windows the receipt command itself must
name `npm.cmd` until that follow-up lands.
