# 050 — WP6 / L6: Windows landmine corpus sweep

Layer: L6. Branch: `codex/windows-landmine-sweep`. Base: L5 `codex/fix-split-cwd-source` (after L1–L5). Work-phase: wp6. Criteria: **c-11** (every risk=high corpus finding in this stack) and the "every copy" clause of **c-9** (GUI + serve provider endpoints report provider, never error from the #131 spawn bugs).

Scope is the six-row table in `000_plan.md` "Corpus sweep scope". Do not expand it. Deferred (risk=medium, out of this issue set — do not touch): `messenger-bridge/src/service.ts:245` BOM-less `.cmd`; `payload-bin.test.mjs:72` and `live-catalog.test.ts:79` colon-PATH fixtures.

`build.mjs` allows only `node:*` and relative imports inside a component. Copy helpers; do not import `cxc-ops`. GUI is not a `build.mjs` component and already relative-imports other packages, but this layer still copies. messenger-bridge already has `src/win-exec.ts` (re-export of `subagent-config/dist/win-exec.js`); reuse that `commandInvocation`, do not add a second copy.

L3 (`030`) also edits `config-guard/src/cli.ts`. If `makeRealRunner` has moved by L5, apply the same substitution in place. Do not create a second runner.

The `where` selector is the L1 helper from `010` (`selectExecutableFromWhereOutput`). Copy the function into each spawn site; do not add it to `win-exec.ts` (that would fail SHARED-HELPER-01 byte identity).

## Change list

- NEW `plugins/codexclaw/gui/src/server/win-exec.ts`
- NEW `plugins/codexclaw/gui/src/server/codex-bin.ts`
- NEW `plugins/codexclaw/gui/test/codex-bin.test.ts`
- NEW `plugins/codexclaw/components/config-guard/src/win-exec.ts`
- NEW `plugins/codexclaw/components/config-guard/src/codex-bin.ts`
- NEW `plugins/codexclaw/components/config-guard/test/codex-bin.test.ts`
- NEW `plugins/codexclaw/components/config-guard/dist/win-exec.js` (build output; `git add -f`)
- NEW `plugins/codexclaw/components/config-guard/dist/codex-bin.js` (build output; `git add -f`)
- MODIFY `plugins/codexclaw/gui/src/server/middleware.ts`
- MODIFY `plugins/codexclaw/gui/test/crlf-where.test.ts`
- MODIFY `plugins/codexclaw/components/messenger-bridge/src/api-compat.ts`
- MODIFY `plugins/codexclaw/components/messenger-bridge/test/crlf-where.test.ts`
- MODIFY `plugins/codexclaw/components/messenger-bridge/dist/api-compat.js` (restage after build; already tracked)
- MODIFY `plugins/codexclaw/components/config-guard/src/cli.ts`
- MODIFY `plugins/codexclaw/components/config-guard/dist/cli.js` (restage after build; already tracked)
- DELETE none (the `splitLines` import in the two detectDeps sites becomes unused and is removed as part of those MODIFY after-blocks)

## NEW copies of win-exec.ts and codex-bin.ts

Byte-identical copies. Do not retype.

```

## L1 helper (paste into both detectDeps files)

Copy from 010's `cli.ts` after-block. Export it. Do not put it in `win-exec.ts`.

```ts
const DEFAULT_WIN32_PATHEXT = ".COM;.EXE;.BAT;.CMD";

function whereLines(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function pathExt(filePath: string): string {
  return extname(filePath.replaceAll("\\", "/")).toLowerCase();
}

function pathextList(pathext: string | undefined): string[] {
  const raw = pathext && pathext.trim().length > 0 ? pathext : DEFAULT_WIN32_PATHEXT;
  return raw
    .split(";")
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => ext.length > 0);
}

export function selectExecutableFromWhereOutput(
  stdout: string,
  options: { platform: NodeJS.Platform; pathext?: string },
): string | null {
  const lines = whereLines(stdout);
  if (lines.length === 0) return null;
  if (options.platform !== "win32") return lines[0] ?? null;
  const allowed = pathextList(options.pathext);
  const match = lines.find((line) => {
    const ext = pathExt(line);
    return ext.length > 0 && allowed.includes(ext);
  });
  return match ?? lines[0] ?? null;
}
```

gui: add `extname` to `middleware.ts:23` (`import { dirname, join } from "node:path"` → `import { dirname, extname, join } from "node:path"`).
messenger-bridge: add `import { extname } from "node:path";` next to the spawnSync import.

## Row 1 — gui/src/server/middleware.ts:75 (get-command-where-disagree)

Before `middleware.ts:20-21`:

```ts
import { spawnSync } from "node:child_process";
import { splitLines } from "./text-lines.ts";
```

Before `middleware.ts:23`:

```ts
import { dirname, join } from "node:path";
```

Before `middleware.ts:66-77`:

```ts
// Real ocx detection deps for the dev server (detect-only).
function detectDeps() {
  return {
    which: (cmd: string) => {
      const res = spawnSync(process.platform === "win32" ? "where" : "command", process.platform === "win32" ? [cmd] : ["-v", cmd], {
        encoding: "utf8",
        shell: process.platform !== "win32",
      });
      // where.exe emits CRLF; the trailing .trim() saved this by accident.
      const out = res.status === 0 && typeof res.stdout === "string" ? splitLines(res.stdout)[0]?.trim() ?? "" : null;
      return out && out.length > 0 ? out : null;
    },
```

After imports (delete splitLines; keep spawnSync; add win-exec + codex-bin + extname):

```ts
import { spawnSync } from "node:child_process";
import { dirname, extname, join } from "node:path";
import { commandInvocation, envValue } from "./win-exec.ts";
import { resolveCodexInvocation } from "./codex-bin.ts";
```

After `which` (paste the L1 helper above `detectDeps`):

```ts
function detectDeps() {
  return {
    which: (cmd: string) => {
      const res = spawnSync(process.platform === "win32" ? "where" : "command", process.platform === "win32" ? [cmd] : ["-v", cmd], {
        encoding: "utf8",
        shell: process.platform !== "win32",
      });
      if (res.status !== 0 || typeof res.stdout !== "string") return null;
      return selectExecutableFromWhereOutput(res.stdout, {
        platform: process.platform,
        pathext: envValue(process.env, "PATHEXT"),
      });
    },
```

## Row 2 — gui/src/server/middleware.ts:79 (spawn-npm-enoent-einval)

Before `middleware.ts:78-81`:

```ts
    runStatus: (ocxPath: string) => {
      const res = spawnSync(ocxPath, ["status", "--json"], { encoding: "utf8", timeout: 8000 });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
```

After:

```ts
    runStatus: (ocxPath: string) => {
      const inv = commandInvocation(ocxPath, ["status", "--json"]);
      const res = spawnSync(inv.file, inv.args, { encoding: "utf8", timeout: 8000, ...inv.options });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
```

## Row 3 — messenger-bridge/src/api-compat.ts:40 (get-command-where-disagree)

Before `api-compat.ts:15-21`:

```ts
import { spawnSync } from "node:child_process";
// Compiled component dists — runtime-typed, so minimal local shapes below.
import { getSettings, updateSettings, settingsResponse } from "../../subagent-config/dist/settings-api.js";
import { readCatalog } from "../../subagent-config/dist/live-catalog.js";
import { detectOcx } from "../../provider-bridge/dist/detect.js";
import type { ApiRoute, ApiResponse } from "./server.ts";
import { splitLines } from "./text-lines.ts";
```

Before `api-compat.ts:28-43`:

```ts
/** Real ocx detection deps (detect-only) — mirrored from gui/src/server/middleware.ts. */
function detectDeps(): Record<string, unknown> {
  return {
    which: (cmd: string) => {
      const res = spawnSync(
        process.platform === "win32" ? "where" : "command",
        process.platform === "win32" ? [cmd] : ["-v", cmd],
        { encoding: "utf8", shell: process.platform !== "win32" },
      );
      // where.exe emits CRLF; the trailing .trim() saved this by accident.
      const out =
        res.status === 0 && typeof res.stdout === "string"
          ? splitLines(res.stdout)[0]?.trim() ?? ""
          : null;
      return out && out.length > 0 ? out : null;
    },
```

After imports (delete splitLines; reuse existing win-exec re-export):

```ts
import { spawnSync } from "node:child_process";
import { extname } from "node:path";
// Compiled component dists — runtime-typed, so minimal local shapes below.
import { getSettings, updateSettings, settingsResponse } from "../../subagent-config/dist/settings-api.js";
import { readCatalog } from "../../subagent-config/dist/live-catalog.js";
import { detectOcx } from "../../provider-bridge/dist/detect.js";
import type { ApiRoute, ApiResponse } from "./server.ts";
import { commandInvocation, envValue } from "./win-exec.ts";
```

After `which` (paste the L1 helper above `detectDeps`):

```ts
function detectDeps(): Record<string, unknown> {
  return {
    which: (cmd: string) => {
      const res = spawnSync(
        process.platform === "win32" ? "where" : "command",
        process.platform === "win32" ? [cmd] : ["-v", cmd],
        { encoding: "utf8", shell: process.platform !== "win32" },
      );
      if (res.status !== 0 || typeof res.stdout !== "string") return null;
      return selectExecutableFromWhereOutput(res.stdout, {
        platform: process.platform,
        pathext: envValue(process.env, "PATHEXT"),
      });
    },
```

## Row 4 — messenger-bridge/src/api-compat.ts:45 (spawn-npm-enoent-einval)

Before `api-compat.ts:44-50`:

```ts
    runStatus: (ocxPath: string) => {
      const res = spawnSync(ocxPath, ["status", "--json"], {
        encoding: "utf8",
        timeout: 8000,
      });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
```

After:

```ts
    runStatus: (ocxPath: string) => {
      const inv = commandInvocation(ocxPath, ["status", "--json"]);
      const res = spawnSync(inv.file, inv.args, {
        encoding: "utf8",
        timeout: 8000,
        ...inv.options,
      });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
```

## Row 5 — config-guard/src/cli.ts:131 (spawn-npm-enoent-einval, bare codex)

Before `cli.ts:5`:

```ts
import { spawnSync } from "node:child_process";
```

After — keep that line and insert immediately under it:

```ts
import { resolveCodexInvocation } from "./codex-bin.ts";
```

Before `cli.ts:129-138`:

```ts
export function makeRealRunner(): CodexRunner {
  return (args) => {
    const res = spawnSync("codex", [...args], { encoding: "utf8" });
    return {
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? (res.error ? String(res.error.message) : ""),
      exitCode: typeof res.status === "number" ? res.status : 1,
    };
  };
}
```

After:

```ts
export function makeRealRunner(): CodexRunner {
  return (args) => {
    const inv = resolveCodexInvocation("codex", [...args]);
    const res = spawnSync(inv.file, inv.args, { encoding: "utf8", ...inv.options });
    return {
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? (res.error ? String(res.error.message) : ""),
      exitCode: typeof res.status === "number" ? res.status : 1,
    };
  };
}
```

## Row 6 — gui/src/server/middleware.ts:88 (windowsapps-alias-eperm, same bare codex spawn)

Before `middleware.ts:85-94`:

```ts
function codexFeatureDeps() {
  const run: CodexRunner = (args) => {
    const command = process.env.CODEX_CLI_PATH?.trim() || "codex";
    const res = spawnSync(command, [...args], { encoding: "utf8", timeout: 15000 });
    return {
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? (res.error ? String(res.error.message) : ""),
      exitCode: typeof res.status === "number" ? res.status : 1,
    };
  };
```

After (keep `CODEX_CLI_PATH` as the command argument so the existing GUI override still wins when `CODEX_BIN` is unset; `resolveCodexInvocation` still honors `CODEX_BIN` when set, matching cxc-ops):

```ts
function codexFeatureDeps() {
  const run: CodexRunner = (args) => {
    const command = process.env.CODEX_CLI_PATH?.trim() || "codex";
    const inv = resolveCodexInvocation(command, [...args]);
    const res = spawnSync(inv.file, inv.args, { encoding: "utf8", timeout: 15000, ...inv.options });
    return {
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? (res.error ? String(res.error.message) : ""),
      exitCode: typeof res.status === "number" ? res.status : 1,
    };
  };
```


## Row 7 — scripts/dev-install.sh reads the manifest with python3 (install)

Not in the original preflight table. Found while writing `060`, and it **blocks c-12**:
the reinstall this stack has to prove cannot run on this host at all.

`scripts/dev-install.sh:44-50`:

```bash
installed_version() {
  python3 - "$PLUGIN_SRC/.codex-plugin/plugin.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as fh:
    print(json.load(fh)["version"])
PY
}
```

`VERSION="$(installed_version)"` runs on every path, not only `--status`. On this host
`python`, `python3` and `py` all resolve to the Microsoft Store alias or nothing, so
under `set -euo pipefail` the script aborts before it builds. A Node project whose
dogfood install depends on Python is the landmine; the corpus case is
`windowsapps-alias-eperm` (the Store alias that exits without running) compounded by
`pathext-bare-name-enoent`.

after:

```bash
installed_version() {
  # node, not python3: the toolchain this repo already requires. A Windows host with
  # no Python otherwise kills the whole dev-install under `set -e`, and the Microsoft
  # Store `python3` alias can exit without running at all.
  node -e 'process.stdout.write(require(process.argv[1]).version)' "$PLUGIN_SRC/.codex-plugin/plugin.json"
}
```

`require()` of an absolute `.json` path is fine here: the script always passes an
absolute `$PLUGIN_SRC`. `process.stdout.write` rather than `console.log` so no trailing
newline enters `$VERSION` — a trailing newline would break the
`[ "$(basename "$dir")" != "$VERSION" ]` prune comparison and delete the freshly
installed cache root.

That last point is why this is risk=high rather than a convenience fix: the prune loop
`rm -rf`s every cache directory whose name differs from `$VERSION`.

### Test

Shell scripts have no suite here. Verify by execution, both ways:

```powershell
& "C:\Program Files\Git\usr\bin\bash.exe" scripts/dev-install.sh --status
```

Before: exits non-zero with `python3: command not found`. After: prints `source:`,
`manifest: 0.2.24`, `marketplace:` and the cache roots. Confirm `manifest:` has no
blank line after the version, which would indicate a trailing newline survived.

## Regression risk (all rows)

Rows 1-4 are the same edit applied to two more copies of the `#131` bug. The risk is
**copy drift**: `win-exec.ts` now exists in eight places once `gui` and
`messenger-bridge` get theirs. Each copy needs the byte-identity test from `010` §5,
otherwise a later edit to the `cxc-ops` original silently diverges. `build.mjs` forbids
cross-component imports, so deduplication is not available and the test is the only
defence.

Rows 5-6 replace a bare `codex` spawn with `resolveCodexInvocation`. Both call sites are
fail-open today — `config-guard`'s SessionStart self-heal swallows the failure — so the
observable change is that the self-heal starts working on hosts where `codex` is a
`.cmd`. Nothing that currently succeeds can start failing: the resolver returns the
input unchanged when nothing matches.

Row 7 is the only row that touches a destructive path. See above.

`gui/test/crlf-where.test.ts` pins the first-line behaviour being replaced; update its
expectation in the same commit or the layer fails its own suite. Note that
`gui/test/router.test.ts` is a **pre-existing** failure on this host (recorded in
`000_plan.md`) and is not this layer's regression.

## Criteria

**c-11**: every risk=high corpus finding is fixed inside this stack; deferral with a
recorded reason is permitted only for risk=medium. Rows 1-4 are risk=high and fixed
here. Row 7 is risk=high and fixed here. Rows 5-6 are risk=medium and fixed here
anyway because `wp4` already opens `config-guard/src/cli.ts`. The deferred set is
recorded in `000_plan.md`: the BOM-less `.cmd` in `messenger-bridge/src/service.ts:245`
(risk=medium, needs a non-ASCII home path to bite) and the colon-PATH test fixtures in
`payload-bin.test.mjs:72` and `live-catalog.test.ts:79` (risk=medium, test-only,
currently green).

**c-9**, "every copy" half: rows 1-4 bring the GUI `/api/provider` and the `cxc serve`
provider endpoint to `mode: provider` on this host. Prove by starting each surface and
reading the endpoint, not by reading the diff.
Copy-Item -LiteralPath plugins/codexclaw/components/cxc-ops/src/win-exec.ts -Destination plugins/codexclaw/gui/src/server/win-exec.ts
Copy-Item -LiteralPath plugins/codexclaw/components/cxc-ops/src/win-exec.ts -Destination plugins/codexclaw/components/config-guard/src/win-exec.ts
Copy-Item -LiteralPath plugins/codexclaw/components/cxc-ops/src/codex-bin.ts -Destination plugins/codexclaw/gui/src/server/codex-bin.ts
Copy-Item -LiteralPath plugins/codexclaw/components/cxc-ops/src/codex-bin.ts -Destination plugins/codexclaw/components/config-guard/src/codex-bin.ts
```

`win-exec.ts`: LF, 89 lines, 3657 bytes, hash `B7B07DE668F622EA1AC0CD1A82FE04B61C85A41E9390233D22AEBAA4AF175E3D`. Full text is in `010_wp2_provider_bridge_windows_detect.md` NEW win-exec.ts (same bytes as cxc-ops).

`codex-bin.ts`: LF, 125 lines, 5437 bytes. Full text is `plugins/codexclaw/components/cxc-ops/src/codex-bin.ts` as of L0 `9cd52769`. The load-bearing export is `resolveCodexInvocation` at `codex-bin.ts:106-125`. Quoted here so the copy cannot silently drift; if this block disagrees with the cxc-ops file, the cxc-ops file wins and the identity test will catch a bad retype.

Before (cxc-ops, the function this layer copies), `codex-bin.ts:101-125`:

```ts
/**
 * Build the spawn shape for the `codex` CLI.
 *
 * POSIX is a passthrough; `CODEX_BIN` wins on every platform when it is set.
 */
export function resolveCodexInvocation(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Invocation {
  const override = envValue(env, "CODEX_BIN")?.trim();
  const target = override && override.length > 0 ? override : command;
  if (platform !== "win32") return { file: target, args: [...args], options: {} };

  // An explicit override is honored as written; only PATH discovery filters.
  const resolved = override && override.length > 0
    ? (spawnableWindowsCandidates(override, env)[0] ?? null)
    : (spawnableWindowsCandidates(command, env)[0] ?? null);
  if (resolved === null) return cmdShellInvocation(target, args, env);
  // commandInvocation already routes .cmd/.bat through ComSpec and spawns a
  // resolved .exe directly; the path it gets here is absolute, so it re-resolves
  // nothing.
  return commandInvocation(resolved, args, platform, env);
}
```

After: the NEW files are that entire cxc-ops file, unmodified. Do not trim `isWindowsAppsAlias`, `spawnableWindowsCandidates`, or `cmdShellInvocation` — `resolveCodexInvocation` needs all three.
