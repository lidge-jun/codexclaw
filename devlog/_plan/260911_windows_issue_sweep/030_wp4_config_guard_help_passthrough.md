# 030 — wp4 / L3: config-guard help passthrough (#132)

Layer: L3. Branch: `codex/fix-config-guard-help`. Base: L2 (`codex/fix-session-binding-extended-path`).
Issue: #132. Criterion: **c-10** (both entrypoints, all four verbs, both help flags, config byte-identical and no bak; `cxc uninstall` without help still disables).
This document is the copy-paste PRD for the implementation cycle. Docs-only now; no production patch in wp1.

Source truth (L2 head `701639b6`): help never reaches config-guard because both dispatchers drop argv after the verb. `uninstall` is already rewritten to `disable` at both dispatchers — that rewrite must survive the passthrough. Dist of `config-guard` is already tracked. Anchors re-verified at this head: `bin/codexclaw.mjs` `:463`/`:467`/`:470`, `plugins/codexclaw/bin/cxc.mjs:165`, and in `config-guard/src/cli.ts` `CONFIG_USAGE` `:22-33`, `runConfig` `:37`, `main` `:140`, switch default `:235-237`.

## 1. Scope

IN

- `bin/codexclaw.mjs`: `enable` / `disable` / `uninstall` / `status` forward remaining argv after rewriting `uninstall` → `disable`.
- `plugins/codexclaw/bin/cxc.mjs`: same contract, same rewrite. Update the comment that currently says config-guard gets `[subcommand] only`.
- `plugins/codexclaw/components/config-guard/src/cli.ts`: `main()` answers help before the action, any argument position, freeze-cli pattern.
- `plugins/codexclaw/test/cli-usage.test.mjs`: both entrypoints × four verbs × both flags under a temp `CODEX_HOME`; uninstall-without-help still reaches disable.
- `plugins/codexclaw/components/config-guard/dist/cli.js`: rebuild in the same commit (already tracked; plain `git add` restages).

OUT

- Adding `case "uninstall"` to config-guard `main()`. The dispatcher rewrite is the contract. If a caller forwards the raw token, `switch` default must still fire so the trap stays visible.
- Changing `cxc config --help` (`runConfig` already owns `CONFIG_USAGE`; existing `cli-usage.test.mjs:44-53` pins it). `main()` must not steal `config` or `hook`.
- Treating empty config-guard argv as help. freeze-cli does that because a bare `cxc freeze` used to write files. Empty config-guard argv is already a usage error (stderr, exit 2) and is not this bug.
- Touching `activate.ts` / `deactivate.ts` / managed keys. Help must not call them.
- Any other file.

## 2. Change map

| file | NEW/MODIFY/DELETE | what | lines (approx) |
|---|---|---|---|
| `bin/codexclaw.mjs` | MODIFY | four verbs forward rest argv; `uninstall` rewritten to `disable` | ~8 |
| `plugins/codexclaw/bin/cxc.mjs` | MODIFY | same forwarding; comment at `:154-158` updated | ~6 |
| `plugins/codexclaw/components/config-guard/src/cli.ts` | MODIFY | `FEATURE_USAGE`; help-before-action in `main()` | ~25 |
| `plugins/codexclaw/components/config-guard/dist/cli.js` | MODIFY | `npm run build` output; do not hand-edit | compileSource of src |
| `plugins/codexclaw/test/cli-usage.test.mjs` | MODIFY | imports + two tests at EOF | ~90 |

No NEW. No DELETE. No new `.ts` file, so no `git add -f`.

## 3. The trap (load-bearing — do not follow issue #132's suggested `slice(2)`)

Issue #132 proposes forwarding `process.argv.slice(2)` for all four verbs. That is correct for `enable` / `disable` / `status` and **wrong for `uninstall`**.

config-guard `main()` has no `uninstall` case. `plugins/codexclaw/components/config-guard/src/cli.ts:236-238`:

```ts
    default:
      process.stderr.write("usage: config-guard <enable|disable|status|config>\n");
      return 2;
```

Today both dispatchers already rewrite the verb and drop the rest:

- `bin/codexclaw.mjs:465-467` — `runConfigGuard(["disable"])`
- `plugins/codexclaw/bin/cxc.mjs:165` — `delegate(component, [cmd === "uninstall" ? "disable" : cmd])`

So `cxc uninstall` without help **already disables**. A naive passthrough of `["uninstall", ...rest]` would hit `default`, print usage, exit 2, and leave flags on. That is the gaming hole c-10 exists to close.

Required shape at **both** entrypoints:

```js
[cmd === "uninstall" ? "disable" : cmd, ...process.argv.slice(3)]
```

Verb rewritten, remaining argv appended. Never forward the raw `uninstall` token. Do not add `uninstall` as a `switch` alias to hide a missed rewrite.

## 4. Help-before-action (freeze-cli pattern)

Same class of bug, already fixed in freeze. `plugins/codexclaw/components/pabcd-state/src/freeze-cli.ts:61-65`:

```ts
    // 260825 wp1: `cxc freeze --help` used to fall straight through to runFreeze,
    // which WROTE .codexclaw/interview/freeze.json and exited 0 — a workspace
    // mutation behind a read-only-looking flag, with nothing in the output to
    // signal it. Help is now parsed, and runFreeze returns before any IO.
    help: argv.length === 0 || argv.some((a) => a === "help" || a === "--help" || a === "-h"),
```

Copy the `.some(...)` position-independent test. Do **not** copy `argv.length === 0`: freeze's bare invocation was mutating; config-guard's empty argv is already exit 2 on `default` and must stay that.

Help must run **before** the action `switch`. `runConfig` already checks only `argv[0]` (`cli.ts:41`). That is the config subcommand. Feature verbs never enter `runConfig`. If the dispatcher starts forwarding `["enable", "--help"]`, `cmd === "enable"` and enable still runs unless `main()` scans every token first.

Exclude `config` (keeps `CONFIG_USAGE`, existing test) and `hook` (SessionStart must not turn `--help` into a usage print).

## 5. MODIFY `bin/codexclaw.mjs`

### 5.1 Four verbs currently drop argv

before (`bin/codexclaw.mjs:462-471`):

```js
  case "enable":
    process.exit(runConfigGuard(["enable"]));
    break;
  case "uninstall":
  case "disable":
    process.exit(runConfigGuard(["disable"]));
    break;
  case "status":
    process.exit(runConfigGuard(["status"]));
    break;
```

after:

```js
  case "enable":
  case "uninstall":
  case "disable":
  case "status":
    // Rewrite uninstall → disable, then append remaining argv. Forwarding
    // process.argv.slice(2) would send the raw "uninstall" token into
    // config-guard main(), which has no such case and would hit default
    // (usage, exit 2) instead of disable. Help flags ride in the rest.
    process.exit(runConfigGuard([
      cmd === "uninstall" ? "disable" : cmd,
      ...process.argv.slice(3),
    ]));
    break;
```

`runConfigGuard` already spreads `args` onto the compiled CLI (`:202-204`). No change there. `config` already forwards `process.argv.slice(2)` (`:472-479`); leave it.

## 6. MODIFY `plugins/codexclaw/bin/cxc.mjs`

### 6.1 Comment + single-token delegate

before (`plugins/codexclaw/bin/cxc.mjs:154-165`):

```js
  // Component CLI argv contracts (mirror root bin):
  //   config-guard: [subcommand] only, EXCEPT `config`, which forwards its full argv so
  //     `config set <key> <value>` keeps its arguments; skill-search: [search|show, ...]
  //     (drop the "skill" verb);
  //   provider-bridge: ["detect"]; everything else: [cmd, ...rest] verbatim.
  if (component === "config-guard") {
    if (cmd === "config") {
      // `config interview` is owned by pabcd-state; the rest by config-guard.
      const target = process.argv[3] === "interview" ? "pabcd-state" : "config-guard";
      process.exit(delegate(target, process.argv.slice(2)));
    }
    process.exit(delegate(component, [cmd === "uninstall" ? "disable" : cmd]));
  }
```

after:

```js
  // Component CLI argv contracts (mirror root bin):
  //   config-guard feature verbs: [disable-rewritten-verb, ...rest]. `uninstall`
  //     is rewritten to `disable` because config-guard main() has no uninstall
  //     case (raw token hits switch default and does not disable). `config`
  //     still forwards its full argv so `config set <key> <value>` keeps its
  //     arguments; skill-search: [search|show, ...] (drop the "skill" verb);
  //   provider-bridge: ["detect"]; everything else: [cmd, ...rest] verbatim.
  if (component === "config-guard") {
    if (cmd === "config") {
      // `config interview` is owned by pabcd-state; the rest by config-guard.
      const target = process.argv[3] === "interview" ? "pabcd-state" : "config-guard";
      process.exit(delegate(target, process.argv.slice(2)));
    }
    process.exit(delegate(component, [
      cmd === "uninstall" ? "disable" : cmd,
      ...process.argv.slice(3),
    ]));
  }
```

The `config` branch is unchanged. `COMMAND_TABLE` already maps `uninstall` to `"config-guard"` (`:37`); do not remove that row — the rewrite happens at the delegate call, not at the table.

## 7. MODIFY `plugins/codexclaw/components/config-guard/src/cli.ts`

### 7.1 Usage string, next to `CONFIG_USAGE`

Insert immediately after `CONFIG_USAGE` (`cli.ts:35`), before `function runConfig`:

```ts
const FEATURE_USAGE = [
  "Usage:",
  "  cxc enable                         activate declared Codex feature flags",
  "  cxc disable | uninstall            revert flags codexclaw enabled when safe",
  "  cxc status                         show declared feature-flag state",
  "",
  "  --help / -h / help in any argument position prints this text and writes nothing.",
  "  enable writes $CODEX_HOME/config.toml and a timestamped .bak; disable/uninstall revert.",
].join("\n");
```

`cxc enable`, `cxc disable`, `cxc uninstall` (via `disable | uninstall`), and `cxc status` all appear so a per-verb `/cxc ${verb}/` match works for enable/status and `/uninstall/` works for the alias.

### 7.2 `main()` currently has no help path for feature verbs

before (`plugins/codexclaw/components/config-guard/src/cli.ts:140-145`):

```ts
function main(argv: readonly string[]): number {
  const cmd = argv[0];
  const run = makeRealRunner();
  const codexHome = resolveCodexHome();

  switch (cmd) {
```

after:

```ts
function main(argv: readonly string[]): number {
  const cmd = argv[0];
  // Same class of bug as freeze-cli.ts:61-65 (`cxc freeze --help` used to write
  // freeze.json). Help is position-independent and runs BEFORE the action:
  // once the dispatcher forwards ["enable", "--help"], argv[0] is "enable" and
  // runConfig's first-arg help at :41 never sees the flag.
  // Do not steal `config --help` (CONFIG_USAGE) or the SessionStart `hook` path.
  // Empty argv stays the default usage/exit 2 — unlike freeze, it is not a
  // mutating bare invocation.
  if (
    cmd !== "config" &&
    cmd !== "hook" &&
    argv.some((a) => a === "help" || a === "--help" || a === "-h")
  ) {
    process.stdout.write(`${FEATURE_USAGE}\n`);
    return 0;
  }
  const run = makeRealRunner();
  const codexHome = resolveCodexHome();

  switch (cmd) {
```

The rest of the `switch` (`hook` / `enable` / `disable` / `status` / `config` / `default`) is unchanged. Do not add `case "uninstall"`.

Help returns before `makeRealRunner()` / `resolveCodexHome()`, so it cannot spawn `codex` or read the real home. `activate` (`:168`) and `deactivate` (`:206`) are unreachable on a help token.

After `npm run build`, restage `plugins/codexclaw/components/config-guard/dist/cli.js`. Both entrypoints spawn that file, not `src/cli.ts`. Tests that drive `bin/codexclaw.mjs` / `plugins/codexclaw/bin/cxc.mjs` will keep failing until dist is rebuilt.

## 8. MODIFY `plugins/codexclaw/test/cli-usage.test.mjs`

### 8.1 Imports

before (`plugins/codexclaw/test/cli-usage.test.mjs:1-9`):

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const cli = join(repoRoot, "bin", "codexclaw.mjs");
```

after:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const cli = join(repoRoot, "bin", "codexclaw.mjs");
const payloadCli = join(repoRoot, "plugins", "codexclaw", "bin", "cxc.mjs");
```

Existing tests are unchanged. They do not set `CODEX_HOME`; they only hit top-level / `config` / `orchestrate` help, which never enter `activate`/`deactivate`.

### 8.2 New tests — insert at EOF (after `cli-usage.test.mjs:73`)

Do not replace the existing `config --help` loop. These tests **must** set a temp `CODEX_HOME`. `resolveCodexHome` (`cli.ts:105-107`) falls through to `~/.codex` when the env is missing; without isolation, a leaked enable would write the operator's real config — the #132 symptom.

```js
const FEATURE_VERBS = ["enable", "disable", "uninstall", "status"];
const HELP_FLAGS = ["--help", "-h"];
const FEATURE_ENTRIES = [cli, payloadCli];
const SEEDED_CONFIG = "[features]\nhooks = false\n";

function isolatedCodexHome() {
  const home = mkdtempSync(join(tmpdir(), "cxc-132-home-"));
  writeFileSync(join(home, "config.toml"), SEEDED_CONFIG);
  return home;
}

function spawnFeature(entry, args, home) {
  return spawnSync("node", [entry, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CODEX_HOME: home },
  });
}

function assertNoMutation(home) {
  assert.equal(readFileSync(join(home, "config.toml"), "utf8"), SEEDED_CONFIG);
  assert.equal(readdirSync(home).some((name) => name.includes(".bak")), false);
  assert.equal(existsSync(join(home, "codexclaw-self-heal.json")), false);
  assert.deepEqual(readdirSync(home).sort(), ["config.toml"]);
}

// #132: `cxc enable --help` used to run enable (config.toml rewrite + timestamped
// .bak). Fixing only the root bin, only --help, or only argv[0] help is the
// same class of miss as the #47 --version dual-entrypoint test above.
test("enable/disable/uninstall/status help is side-effect free on both entrypoints", () => {
  for (const entry of FEATURE_ENTRIES) {
    for (const verb of FEATURE_VERBS) {
      for (const flag of HELP_FLAGS) {
        const home = isolatedCodexHome();
        try {
          const res = spawnFeature(entry, [verb, flag], home);
          const label = `${basename(entry)} ${verb} ${flag}`;
          assert.equal(res.status, 0, `${label} exited ${res.status}: ${res.stderr}`);
          assert.match(res.stdout, /Usage:/, `${label} stdout`);
          assert.match(res.stdout, /enable/);
          assert.match(res.stdout, /uninstall/);
          assert.match(res.stdout, /status/);
          assert.doesNotMatch(res.stdout, /codexclaw: enabled/);
          assert.doesNotMatch(res.stdout, /codexclaw: disabled/);
          assert.doesNotMatch(res.stdout, /no install manifest/);
          assertNoMutation(home);
        } finally {
          rmSync(home, { recursive: true, force: true });
        }
      }
    }
  }
});

test("feature-verb help is position-independent", () => {
  const home = isolatedCodexHome();
  try {
    const res = spawnFeature(cli, ["enable", "ignored", "--help"], home);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /Usage:/);
    assert.doesNotMatch(res.stdout, /codexclaw: enabled/);
    assertNoMutation(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// Guard the uninstall rewrite. Parent already maps uninstall → disable with
// no rest args, so this test is green before the patch. A naive
// process.argv.slice(2) passthrough (the #132 issue-body suggestion) turns
// it red: config-guard main() default prints usage and exits 2.
test("cxc uninstall without help still disables on both entrypoints", () => {
  for (const entry of FEATURE_ENTRIES) {
    const home = isolatedCodexHome();
    try {
      const res = spawnFeature(entry, ["uninstall"], home);
      const label = `${basename(entry)} uninstall`;
      assert.equal(res.status, 0, `${label} exited ${res.status}: ${res.stderr}`);
      assert.match(res.stdout, /no install manifest|disabled/);
      assert.doesNotMatch(res.stderr, /usage: config-guard/);
      assert.equal(readFileSync(join(home, "config.toml"), "utf8"), SEEDED_CONFIG);
      assert.equal(readdirSync(home).some((name) => name.includes(".bak")), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  }
});
```

Empty isolated home has no install manifest. `deactivate` then prints `codexclaw: no install manifest; nothing to revert` and returns 0 **without spawning `codex`** (`deactivate.ts:114-115`). That string is unique to the disable case. `default` would be stderr `usage: config-guard ...` and exit 2.

Help must not write `codexclaw-self-heal.json`. Disable always calls `markSelfHealOptedOut` even on no-manifest (`deactivate.ts:99-115`), so a leaked `uninstall --help` would create that file and fail `assertNoMutation`.

Do not add an `enable`-without-help case: that path spawns the real `codex` binary via `makeRealRunner()`.

## 9. Reproduction (parent fails, L3 head passes)

Parent = L2 head (today: this checkout at `9cd52769` still drops argv at both dispatchers). Layer head = L3 after the patch + rebuild.

PowerShell. Check native status with `$LASTEXITCODE`, never `$?`.

### 9.1 Unit test red/green

On the parent commit, apply **only** the test file changes from §8, then:

```powershell
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/cli-usage.test.mjs
```

Expected:

- existing tests stay green (`config --help`, top-level help, `--version`)
- `enable/disable/uninstall/status help is side-effect free on both entrypoints` fails: stdout is `codexclaw: enabled [...]` / disable-side-effect / status listing, not `Usage:`; `assertNoMutation` fails on `.bak` or `codexclaw-self-heal.json`
- `feature-verb help is position-independent` fails the same way
- `cxc uninstall without help still disables on both entrypoints` **passes on the parent** (rewrite already exists). It exists to fail a naive `slice(2)` implementation.

On the L3 head (bins + src + dist from §5–7, tests from §8):

```powershell
npm run build
git add bin/codexclaw.mjs plugins/codexclaw/bin/cxc.mjs plugins/codexclaw/components/config-guard/src/cli.ts plugins/codexclaw/components/config-guard/dist/cli.js plugins/codexclaw/test/cli-usage.test.mjs
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/cli-usage.test.mjs
```

Expected: exit 0. Then:

```powershell
npm run gate
```

Known pre-existing failures on this host, not this layer: `repo-map-packaging.test.mjs`, `gui/test/router.test.ts`, `hook-bench --json` schema. Do not treat them as L3 regressions.

### 9.2 Live command (c-10)

Temp home. Never point `CODEX_HOME` at the real `~/.codex`.

```powershell
$home = Join-Path $env:TEMP ("cxc-132-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $home | Out-Null
Set-Content -LiteralPath (Join-Path $home "config.toml") -Value "[features]`nhooks = false`n" -Encoding utf8
$env:CODEX_HOME = $home
node bin/codexclaw.mjs enable --help
Write-Output "exit=$LASTEXITCODE"
node plugins/codexclaw/bin/cxc.mjs uninstall --help
Write-Output "exit=$LASTEXITCODE"
Get-ChildItem -LiteralPath $home | Select-Object Name
node bin/codexclaw.mjs uninstall
Write-Output "exit=$LASTEXITCODE"
Remove-Item -LiteralPath $home -Recurse -Force
```

Parent: first two commands print enable/disable output (not Usage), `$LASTEXITCODE` 0, `Get-ChildItem` shows a `.bak` and/or `codexclaw-self-heal.json`.
L3: first two print `Usage:`, `$LASTEXITCODE` 0, directory still only `config.toml`. Bare `uninstall` prints `no install manifest` / `disabled`, not `usage: config-guard`.

C>D receipt for the implementation cycle:

```powershell
cxc receipt test --session <id> -- node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/cli-usage.test.mjs
```

## 10. Regression risk

`cxc config --help` stays on `runConfig` because `main()` skips the new help path when `cmd === "config"`. Existing `cli-usage.test.mjs` coverage for `loop`/`scan`/`receipt`/`config` is untouched. `cxc uninstall` without help already disabled; the rewrite-then-append shape preserves that and is pinned by the new guard test. The real risk is a later "just forward `slice(2)`" cleanup that reintroduces the trap, or help that runs after `activate`/`deactivate`. Help returns before `makeRealRunner`, so it cannot spawn `codex` or write a bak. POSIX and Windows share this argv bug; the tests are not win32-skipped.

## 11. Criterion

**c-10**: both entrypoints, all four verbs, both help flags, config byte-identical and no bak; `cxc uninstall` without help still disables. Proved by the three tests in §8.2 plus the live commands in §9.2.
