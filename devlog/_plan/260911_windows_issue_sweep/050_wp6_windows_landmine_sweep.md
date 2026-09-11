# 050 — wp6 / L5 / Windows landmine sweep

Branch `codex/windows-landmine-sweep`, base **L4** (`codex/fix-nongit-early-refusal`, `96e9486a`).
Criteria **c-11** and the "every copy" half of **c-9**.

Revision 2. Revision 1 was audited and returned FAIL on three structural errors, all
folded here: its `after` blocks propagated a design L1 did not ship, its Row 5 line
numbers pointed at the wrong function, and its header had the stack order backwards.

## 1. Scope, fixed by preflight rather than by code review

Every row below was produced by running the fuck-powershell corpus preflight against
this repository's Windows execution surfaces, then mapping each finding to a corpus case.
Findings that map to no case were dropped; this is not a general code review.

| # | path:line | corpus case | risk | disposition |
|---|---|---|---|---|
| 1 | `gui/src/server/middleware.ts:75` | `get-command-where-disagree` | high | fix |
| 2 | `gui/src/server/middleware.ts:79` | `spawn-npm-enoent-einval` | high | fix |
| 3 | `messenger-bridge/src/api-compat.ts:40` | `get-command-where-disagree` | high | fix |
| 4 | `messenger-bridge/src/api-compat.ts:45` | `spawn-npm-enoent-einval` | high | fix |
| 5 | `config-guard/src/cli.ts:141` | `spawn-npm-enoent-einval`, `windowsapps-alias-eperm` | medium | **defer**, §7 |
| 6 | `gui/src/server/middleware.ts:88` | `windowsapps-alias-eperm` | medium | fix |
| 7 | `scripts/dev-install.sh:44-50` | `windowsapps-alias-eperm` + `pathext-bare-name-enoent` | high | fix |

Rows 1-4 are **three more live copies of #131**. Fixing `provider-bridge` alone (L1) leaves
the GUI `/api/provider` endpoint and the `cxc serve` provider endpoint reporting `error`
on this host. That is why c-9 says "in every copy".

## 2. Change map

| file | NEW/MODIFY/DELETE | change |
|---|---|---|
| `plugins/codexclaw/gui/src/server/middleware.ts` | MODIFY | rows 1, 2, 6 — import the existing helpers directly |
| `plugins/codexclaw/gui/test/crlf-where.test.ts` | MODIFY | its premise ("the exact expression detectDeps now uses") stops being true |
| `plugins/codexclaw/components/messenger-bridge/src/api-compat.ts` | MODIFY | rows 3, 4 — use the package's existing `./win-exec.ts` re-export |
| `plugins/codexclaw/components/messenger-bridge/test/crlf-where.test.ts` | MODIFY | same premise expiry as the gui twin; see §8.2 |
| `plugins/codexclaw/components/messenger-bridge/dist/api-compat.js` | MODIFY | `npm run build`, already tracked |
| `scripts/dev-install.sh` | MODIFY | row 7 — read the manifest with node, not python3 |

**No new `win-exec.ts` copies.** Revision 1 called for one in `gui` and one in
`messenger-bridge`, and both were wrong:

- `gui` is a Vite package, not a component. `middleware.ts:17-19` already imports
  `../../../components/provider-bridge/src/detect.ts` and two `config-guard` sources, and
  `gui/vite.config.ts` imposes no boundary. It imports the existing helpers directly.
- `messenger-bridge/src/win-exec.ts` already exists as a two-line re-export of
  `../../subagent-config/dist/win-exec.js`. A second copy in the same package would be
  pure drift surface.

So this layer adds **zero** copies of that module. Revision 1's regression section claimed
"eight places"; the real count stays at four byte-identical copies plus one re-export,
plus L1's `provider-bridge` copy.

## 3. Rows 1 and 2 — `gui/src/server/middleware.ts` `detectDeps()`

before (`:67-83`):

```ts
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
    runStatus: (ocxPath: string) => {
      const res = spawnSync(ocxPath, ["status", "--json"], { encoding: "utf8", timeout: 8000 });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
  };
}
```

after — **this mirrors what L1 actually shipped** (`provider-bridge/src/cli.ts`), which
deletes the `where` parsing on win32 rather than picking a better line out of it:

```ts
function detectDeps() {
  return {
    which: (cmd: string) => {
      if (process.platform === "win32") {
        // #131: `where ocx` lists the extensionless npm sh shim FIRST, and that file is
        // not an executable image, so spawning it ENOENTs. Resolve PATH+PATHEXT directly
        // instead of parsing `where` stdout: resolveWindowsCommand reads PATH/PATHEXT
        // case-insensitively and retries lowercased extensions, which a `where` parse
        // cannot do. Returns its input unchanged on a miss.
        const resolved = resolveWindowsCommand(cmd, process.env);
        return resolved === cmd ? null : resolved;
      }
      const res = spawnSync("command", ["-v", cmd], { encoding: "utf8", shell: true });
      const out = res.status === 0 && typeof res.stdout === "string" ? splitLines(res.stdout)[0]?.trim() ?? "" : null;
      return out && out.length > 0 ? out : null;
    },
    runStatus: (ocxPath: string) => {
      // #131 second half: after CVE-2024-27980 a shell-less `.cmd` spawn is EINVAL.
      // commandInvocation routes only `.cmd`/`.bat` through ComSpec and escapes cmd
      // metacharacters; `shell: true` would not escape them.
      const inv = commandInvocation(ocxPath, ["status", "--json"]);
      const res = spawnSync(inv.file, inv.args, { encoding: "utf8", timeout: 8000, ...inv.options });
      return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
    },
  };
}
```

Import, alongside the existing component imports at `:17-19`:

```ts
import { commandInvocation, resolveWindowsCommand } from "../../../components/cxc-ops/src/win-exec.ts";
import { resolveCodexInvocation } from "../../../components/cxc-ops/src/codex-bin.ts";
```

`splitLines` stays imported: the POSIX branch still uses it.

That POSIX branch deliberately keeps `splitLines` rather than copying L1's inline
`split(/\r?\n/)`. These two packages own a `text-lines` helper and their tests pin it
(§8.1, §8.2); `provider-bridge` has no such helper, which is why L1 inlined the regex.
Same behaviour, each package using the idiom it already owns.

## 4. Row 6 — the bare `codex` spawn in the same file

before (`:85-96`):

```ts
function codexFeatureDeps() {
  const run: CodexRunner = (args) => {
    const command = process.env.CODEX_CLI_PATH?.trim() || "codex";
    const res = spawnSync(command, [...args], { encoding: "utf8", timeout: 15000 });
```

after:

```ts
function codexFeatureDeps() {
  const run: CodexRunner = (args) => {
    const command = process.env.CODEX_CLI_PATH?.trim() || "codex";
    // A bare name skips PATHEXT, and an npm-installed `codex.cmd` is EINVAL shell-less.
    // resolveCodexInvocation additionally detects the Microsoft Store WindowsApps alias,
    // which exits EPERM without running. Note it does NOT pass a miss through unchanged:
    // it falls back to a cmd-shell invocation (cxc-ops/src/codex-bin.ts:120).
    const inv = resolveCodexInvocation(command, [...args]);
    const res = spawnSync(inv.file, inv.args, { encoding: "utf8", timeout: 15000, ...inv.options });
```

## 5. Rows 3 and 4 — `messenger-bridge/src/api-compat.ts` `detectDeps()`

The same two edits as §3, in the same shape. This package already crosses its own
boundary through `dist` (`api-compat.ts` imports `../../subagent-config/dist/settings-api.js`,
`../../provider-bridge/dist/detect.js`), and it already owns a re-export, so the import is:

```ts
import { commandInvocation, resolveWindowsCommand } from "./win-exec.ts";
```

`messenger-bridge/src/win-exec.ts` is:

```ts
/** Compatibility export; subprocess escaping is shared with live model discovery. */
export * from "../../subagent-config/dist/win-exec.js";
```

Do not add a second copy to this package.

## 6. Row 7 — `scripts/dev-install.sh` reads the manifest with `python3`

Not from the preflight; found while writing `060`. It **blocks c-12 outright**: the
reinstall this stack has to prove cannot run at all on a Windows host without Python.

before (`scripts/dev-install.sh:44-50`):

```bash
installed_version() {
  python3 - "$PLUGIN_SRC/.codex-plugin/plugin.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as fh:
    print(json.load(fh)["version"])
PY
}
```

`VERSION="$(installed_version)"` runs on **every** path, not only `--status`. On this host
`python`, `python3` and `py` all resolve to the Microsoft Store alias or nothing, so under
`set -euo pipefail` the script aborts before it builds anything.

after:

```bash
installed_version() {
  # node, not python3: the toolchain this repo already requires. A Windows host with no
  # Python otherwise kills the whole dev-install under `set -e`, and the Microsoft Store
  # `python3` alias can exit without running at all.
  #
  # process.stdout.write, NOT console.log: a trailing newline would enter $VERSION and
  # break the `[ "$(basename "$dir")" != "$VERSION" ]` prune comparison below, whose
  # else-branch is `rm -rf "$dir"` — it would delete the cache root just installed.
  node -e 'process.stdout.write(require(process.argv[1]).version)' "$PLUGIN_SRC/.codex-plugin/plugin.json"
}
```

That newline hazard is why this row is risk=high rather than a convenience fix.

### Verification (no suite covers shell scripts here)

```powershell
& "C:\Program Files\Git\usr\bin\bash.exe" scripts/dev-install.sh --status
```

Before: non-zero with `python3: command not found`. After: prints `source:`,
`manifest: <version>`, `marketplace:` and the cache roots, with **no blank line** after the
version — a blank line would mean a trailing newline survived.

## 7. Row 5 deferred, with the reason

`config-guard/src/cli.ts:139-148` `makeRealRunner` spawns a bare `codex`:

```ts
export function makeRealRunner(): CodexRunner {
  return (args) => {
    const res = spawnSync("codex", [...args], { encoding: "utf8" });
```

(Revision 1 cited `:131`; that is inside `renderSoftFailureWarning`. The function bytes
were right, the anchor was not.)

**Deferred.** risk=medium, which c-11 permits deferring with a recorded reason. The reason
is copy scope, and specifically **not** "wp4 already opened this file" — an audit correctly
rejected that as a non-reason.

`config-guard` imports only `node:*` and relative `./` files, strictly, and it runs a
SessionStart hook. A GUI-style cross-package import would break that property for a
fail-open code path. Doing it properly means porting `resolveCodexInvocation` plus
`spawnableWindowsCandidates` and `isWindowsAppsAlias` (`cxc-ops/src/codex-bin.ts:35-125`),
which itself needs `win-exec` — a copy larger than the bug it fixes, in the one package
in this repository that has never crossed its boundary.

Impact while deferred: on a host where `codex` is an npm `.cmd` or the Store alias, the
SessionStart self-heal silently does nothing. It is fail-open by design, so no session
breaks. Note it is **not** hook-only — `makeRealRunner` also serves `enable`/`disable`/
`status` (`config-guard/src/cli.ts:167`), so the deferral is wider than "just the hook" and
is recorded as such.

## 8. Tests

### 8.1 `gui/test/crlf-where.test.ts` — its premise expires

Its docstring says it exercises "the exact expression `detectDeps()` now uses". After §3
that is false on win32: the `splitLines(...)[0]` idiom survives only on the POSIX branch.
Leaving it unchanged would leave a test asserting a retired contract.

Keep the three `splitLines` cases — they still pin the POSIX branch and the `?? ""` guard —
and correct the docstring to say so. Then add the launcher case the suite lacks, matching
L1's §5 half 1:

```ts
test("win32 launcher selection prefers the PATHEXT launcher over the extensionless shim", t => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-gui-which-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "ocx"), "#!/bin/sh\n");      // npm sh shim, not an image
  writeFileSync(join(dir, "ocx.cmd"), "@echo off\r\n"); // the real launcher
  // Case-insensitive compare: candidates are built with the PATHEXT spelling.
  assert.equal(
    resolveWindowsCommand("ocx", { PATH: dir, PATHEXT: ".COM;.EXE;.BAT;.CMD" }).toLowerCase(),
    join(dir, "ocx.cmd").toLowerCase(),
  );
});
```

### 8.2 `messenger-bridge` — same addition

That package has its own `crlf-where`-equivalent pinning the same idiom. Apply the same
two changes: correct the premise, add the launcher case against `./win-exec.ts`.

## 9. Reproduction (parent fails, L5 head passes)

The GUI and serve endpoints are the point, so prove them, not the diff:

**Both** surfaces, because c-9 says every copy and they are two separate copies.

```powershell
# 1. serve surface (messenger-bridge). --port is real: messenger-bridge/src/cli.ts:47
node plugins/codexclaw/components/messenger-bridge/dist/cli.js serve --port 10199
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:10199/api/provider).Content
```

```powershell
# 2. GUI surface (Vite dev-server middleware). Read the dev-server entry from the gui
#    package scripts first; the middleware answers /api/provider on that port.
node plugins/codexclaw/bin/cxc.mjs gui
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:<gui-port>/api/provider).Content
```

Parent, on both: `"mode":"error"` with `"reason":"ocx status exited null"`. L5 head, on
both: `"mode":"provider"` with a `.cmd` launcher path.

If the GUI dev server cannot be reached non-interactively on this host, call `getProvider`
through the middleware's own module instead and record that substitution — but do not
claim the GUI copy is proven from the `serve` result alone. They are different files.

Then the suites and the build:

```powershell
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/gui/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/messenger-bridge/test/*.test.ts"
npm run build
npm run gate
```

### 9.1 Measured result, and the GUI substitution that was used

**serve surface** — ran as specified:

```text
$ node plugins/codexclaw/components/messenger-bridge/dist/cli.js serve --port 10199
cxc serve: listening on http://127.0.0.1:10199
$ (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:10199/api/provider).Content
{"mode":"provider","port":10100}
```

**GUI surface** — the dev server could not be started: `node bin/codexclaw.mjs gui` exits
with `dependencies not installed. Run npm install in .../gui first`, and the payload
dispatcher refuses `gui` outright as repo-checkout-only. §9's substitution was used, and
here is exactly what it was, so the claim can be checked:

the real `middleware.ts` module was imported and its exported `codexclawApiMiddleware()`
driven with a synthetic `GET /api/provider`. That runs the actual private `detectDeps()`
closure in that file — the thing under test — rather than a reimplementation of it. The
`import type { Connect } from "vite"` at `:8` is type-only and erased by strip-types, so
no Vite runtime is needed.

```text
GUI /api/provider status=200
GUI /api/provider body={"mode":"provider","port":10100}
```

Both surfaces returned `error` before this layer. The two results are from two different
files, which is what c-9's "every copy" requires; neither was inferred from the other.

## 10. Regression risk

Rows 1-4 apply L1's landed shape to two more call sites and add **no** new shared-module
copies, so there is no new drift surface. The behaviour difference L1 recorded carries
over: the resolved path ends in PATHEXT's casing (`.CMD`) rather than the on-disk casing,
which is cosmetic on a case-insensitive filesystem, so any assertion must compare
case-insensitively.

Row 6 changes a path that is fail-open today, so the observable change is that the GUI's
feature probe starts working on hosts where `codex` is a `.cmd`. Nothing that currently
succeeds can start failing, because a miss falls back to a cmd-shell invocation rather
than erroring.

Row 7 is the only row touching a destructive path — see the newline hazard in §6.

`gui` is a Vite package and its build output is not staged the way component `dist/` is;
`messenger-bridge/dist/api-compat.js` is already tracked and restages normally. No new
`dist` file is introduced by this layer, so no `git add -f` is needed — unlike L1 and L4.

Pre-existing failure on this host, unrelated and recorded in `000_plan.md`:
`gui/test/router.test.ts`.

## 11. Criteria

**c-11**: every risk=high finding is fixed in this layer — rows 1-4 and row 7. Row 5 and
the two entries below are risk=medium and deferred with reasons, which c-11 permits. Row 6
is risk=medium and fixed anyway because the direct import makes it nearly free.

Deferred set, recorded in `000_plan.md` and §7: row 5 above; the BOM-less `.cmd` written by
`messenger-bridge/src/service.ts:245` (needs a non-ASCII home path to bite); and the
colon-PATH test fixtures in `payload-bin.test.mjs:72` and `live-catalog.test.ts:79`
(test-only, currently green, product paths already use `commandInvocation`).

**c-9, "every copy" half**: rows 1-4 bring the GUI `/api/provider` and the `cxc serve`
provider endpoint to `mode: provider` on this host. Proved by §9 against the running
surfaces, not by reading the diff.
