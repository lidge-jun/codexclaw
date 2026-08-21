# 080 - wp09 dual-platform CI lane

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp09.

Defects closed from 002 section D: **none**. Every defect is allocated to wp02-wp08 and
wp11. This phase is the verifier that makes those fixes stay fixed, and it depends on all
of them landing first (000_plan.md work-phase map).

Starting position, which is better than the campaign brief assumed:
`.github/workflows/ci.yml` ALREADY runs a three-OS matrix
(`ubuntu-latest, windows-latest, macos-latest`) with `fail-fast: false`, Node 24, `npm ci`,
`npm test`, the inventory check, and the gate. So Windows is not an untested platform -
which raises the real question this phase must answer: **why did 18 win32 defects ship
under a green Windows lane?**

Three answers, and each is a work item below:

1. **No WSL lane at all.** wp07's entire surface (`/proc/version`, `[automount] root`,
   drvfs tiering) has no runner. GitHub's `ubuntu-latest` is not WSL.
2. **The defects are not in the tested paths.** `bin/codexclaw.mjs` spawn ladders,
   `hook-bench.mjs`, and the `cxc gui` path have no coverage that executes them; the
   suites that do run are pure-function suites that pass identically everywhere. A green
   matrix over the wrong surface is not evidence.
3. **No receipts.** `cxc receipt test` exists and CHECK-BINDING-01 requires a receipt at
   C>D, but CI produces none, so a work-phase's own gate cannot consume CI's result.

## MODIFY / NEW / DELETE map

### 1. MODIFY .github/workflows/ci.yml

BEFORE
```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
      fail-fast: false
    runs-on: ${{ matrix.os }}
    env:
      CODEXCLAW_SKIP_REPOMAP_SMOKE: "1"
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: package-lock.json
      - run: npm ci
      - run: npm test
      - run: node plugins/codexclaw/scripts/inventory.mjs --check
      - run: node plugins/codexclaw/scripts/gate.mjs
```

AFTER - the existing job keeps its shape and gains a shell, the CRLF checkout case, and
receipt capture:
```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        # autocrlf=true is what a default Windows git install does, and it is the
        # configuration that turns the safe-today JSONL readers of 070 into
        # broken ones. Testing only the eol=lf checkout tests a machine our users
        # do not have.
        autocrlf: [false]
        include:
          - os: windows-latest
            autocrlf: true
      fail-fast: false
    runs-on: ${{ matrix.os }}
    env:
      CODEXCLAW_SKIP_REPOMAP_SMOKE: "1"
    steps:
      - name: Configure line endings
        run: git config --global core.autocrlf ${{ matrix.autocrlf }}
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: package-lock.json
      - run: npm ci
      - run: npm test
      - run: node plugins/codexclaw/scripts/inventory.mjs --check
      - run: node plugins/codexclaw/scripts/gate.mjs
      # The suites above are pure-function suites that pass identically on every
      # OS. These four commands are the ones that ACTUALLY execute the spawn
      # ladders, the bench, and the bundle - the surfaces where all 18 audited
      # defects lived (002).
      - name: Platform smoke
        run: node plugins/codexclaw/scripts/platform-smoke.mjs
      - name: Upload receipts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: receipts-${{ matrix.os }}-crlf${{ matrix.autocrlf }}
          path: .codexclaw/evidence/
          if-no-files-found: warn
```

### 2. NEW .github/workflows/wsl.yml

```yaml
name: WSL

on:
  push:
    branches: [main, dev]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  wsl:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v7
      # A real WSL2 kernel on a Windows runner, so /proc/version carries
      # "microsoft" and /proc/mounts reports drvfs for the checkout - the two
      # signals wp07 keys on and that ubuntu-latest cannot produce.
      - uses: Vampire/setup-wsl@v6
        with:
          distribution: Ubuntu-24.04
          additional-packages: curl ca-certificates
      - name: Install Node in the distro
        shell: wsl-bash {0}
        run: |
          curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
          apt-get install -y nodejs
          node --version
      # Two checkouts, deliberately. /mnt/c is drvfs and is where the lock and
      # publish guarantees get weaker; ~ is native ext4 and is what the docs
      # recommend. Both must pass, and the doctor must TELL THEM APART.
      - name: Test on drvfs (/mnt/c)
        shell: wsl-bash {0}
        run: |
          cd "$(wslpath '${{ github.workspace }}')"
          npm ci
          npm test
          node bin/codexclaw.mjs doctor | grep -i drvfs
      - name: Test on native ext4 (~)
        shell: wsl-bash {0}
        run: |
          cp -r "$(wslpath '${{ github.workspace }}')" ~/codexclaw-native
          cd ~/codexclaw-native
          npm ci
          npm test
          node plugins/codexclaw/scripts/platform-smoke.mjs
      - name: No wsl.exe subprocess parsing
        shell: wsl-bash {0}
        run: |
          cd "$(wslpath '${{ github.workspace }}')"
          ! grep -rn "wsl\.exe\|wslpath" plugins/codexclaw/components plugins/codexclaw/scripts bin cli scripts \
            --include="*.ts" --include="*.mjs" --include="*.js" \
            | grep -v "/dist/" | grep -v "/test/"
```

The `wslpath` call in the workflow itself is fine and is not what the grep forbids: the
prohibition (001 2.3, enforced by wp07) is on codexclaw SOURCE shelling out to it, because
of the UTF-16LE stdout hazard. A CI script converting one path is not a runtime code path.

### 3. NEW plugins/codexclaw/scripts/platform-smoke.mjs

The gap that let 18 defects through a green matrix. This executes the code paths that
unit tests mock.

```js
#!/usr/bin/env node
/**
 * platform-smoke.mjs - execute the surfaces that only break on a real OS.
 *
 * The unit suites are pure-function suites: they pass identically on every
 * platform, which is exactly why a green three-OS matrix shipped a bundle that
 * shreds its own output on Windows (002 B3) and a `cxc gui` that ENOENTs (002 B4).
 * Every check here SPAWNS or writes something real.
 *
 * Exit 0 on success, 1 with a named failing check otherwise.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// NOT `new URL(...).pathname`: on Windows that yields "/C:/Users/..." with a leading
// slash, which spawnSync cannot resolve. fileURLToPath is the only correct spelling,
// and this is the campaign's Windows-verification script.
const CLI = fileURLToPath(new URL("../../../bin/codexclaw.mjs", import.meta.url));
const failures = [];

function check(name, fn) {
  try {
    const problem = fn();
    if (problem) failures.push(`${name}: ${problem}`);
  } catch (err) {
    failures.push(`${name}: threw ${err instanceof Error ? err.message : String(err)}`);
  }
}

function runCli(args, opts = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", timeout: 60_000, ...opts });
}

// wp05: the bundle must not be character-shredded and must not leak the username.
check("scouting-bundle", () => {
  const res = runCli(["doctor", "--bundle"]);
  if (res.status !== 0) return `exit ${res.status}`;
  if (/(~.){5}/.test(res.stdout)) return "output is character-shredded (empty homeDir redaction)";
  const user = (homedir().split(/[\\/]/).pop() ?? "").trim();
  if (user && res.stdout.toLowerCase().includes(user.toLowerCase())) {
    return `home directory leaked (${user} present)`;
  }
  return null;
});

// wp06: the python ladder must not exit 9009 silently on the Store stub.
check("map-ladder", () => {
  const res = runCli(["map", "--help"]);
  if (res.status === 9009) return "exited 9009 (Microsoft Store python stub) with no diagnostic";
  if (res.status !== 0 && (res.stdout + res.stderr).trim() === "") return "failed with no message";
  return null;
});

// wp02: --attest-file is the only Windows-viable attest path.
check("attest-file", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-smoke-"));
  const file = join(dir, "attest.json");
  writeFileSync(file, JSON.stringify({ from: "A", to: "B", did: "smoke" }), "utf8");
  const res = runCli(["orchestrate", "B", "--session", "cli", "--attest-file", file, "--cwd", dir]);
  const out = res.stdout + res.stderr;
  if (/could not read the attest file/.test(out)) return "the file was not read";
  // A gate rejection is a PASS here: it proves the JSON parsed and reached the
  // validator. Only a read failure or an unknown flag is a smoke failure.
  if (/unknown|unrecognized/i.test(out)) return "--attest-file is not a recognized flag";
  return null;
});

// wp08: the bench must run at all (it hard-coded /tmp).
check("hook-bench", () => {
  const bench = fileURLToPath(new URL("./hook-bench.mjs", import.meta.url));
  const res = spawnSync(process.execPath, [bench, "--iterations", "1", "--json"], {
    encoding: "utf8",
    timeout: 180_000,
  });
  if (res.status !== 0) return `exit ${res.status}: ${(res.stderr || "").slice(0, 200)}`;
  return null;
});

// wp07: the doctor must classify the filesystem rather than guess.
check("doctor-wsl", () => {
  const res = runCli(["doctor"]);
  if (res.status !== 0 && res.status !== 1) return `unexpected exit ${res.status}`;
  if (!/wsl/i.test(res.stdout)) return "no wsl residency line in doctor output";
  return null;
});

if (failures.length > 0) {
  console.error("platform smoke FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`platform smoke OK on ${process.platform}`);
```

### 4. MODIFY plugins/codexclaw/scripts/gate.mjs

Add one structural rule so this campaign's own convention is machine-checked: a plan unit
under `devlog/_plan/` whose `000_plan.md` declares N work-phases must have N decade docs,
and none may still carry the `DIFFLEVEL-ROADMAP-01` scaffold marker with an unfilled
`(fill in:` body. This is the DIFFLEVEL-ROADMAP-01 rule the A-phase reviewer enforces by
hand today.

### 5. MODIFY package.json

```json
  "scripts": {
    "build": "node plugins/codexclaw/scripts/build.mjs",
    "gate": "node plugins/codexclaw/scripts/gate.mjs",
    "smoke": "node plugins/codexclaw/scripts/platform-smoke.mjs",
    "test": "node --test --test-concurrency=1 \"plugins/codexclaw/components/pabcd-state/test/*.test.ts\" ..."
  }
```

The `test` script is unchanged. `smoke` is separate on purpose: it spawns real
subprocesses and takes minutes, so it must not be inside the fast inner-loop suite.

### 6. Receipt wiring

CHECK-BINDING-01 requires a `testReceiptPath` at C>D on goalplan-bound sessions, and
`cxc receipt test -- <cmd>` produces it. Two things connect here:

1. Every phase doc in this campaign ends with the same receipt line, so each work-phase's
   C>D consumes a receipt from ITS OWN run.
2. CI uploads `.codexclaw/evidence/` per matrix cell (section 1), so a Windows receipt is
   downloadable from the run that produced it.

**Known caveat carried from 050 section 6:** `receipt-cli.ts:79` uses `shell: false` by
design, so on Windows `cxc receipt test -- npm test` hits the `.cmd` problem. Until the
filed follow-up lands, the Windows receipt command is:

```powershell
node bin/codexclaw.mjs receipt test -- npm.cmd test
```

That is a documented wrapper, not a code change, and explicitly not a reason to turn on
`shell: true` in the receipt path.

## TESTS

NEW `plugins/codexclaw/test/platform-smoke.test.mjs`

1. "every check returns a string or null" - import the check table and assert the
   contract, so a check that throws cannot silently pass.
2. "the shredding detector fires on shredded text" - `/(~.){5}/` matches
   `"p~l~u~g~i~n"` and does not match ordinary bundle text containing a single `~`.
3. "a gate rejection is not a smoke failure" - the attest-file check passes when the
   validator rejects, and fails when the flag is unrecognized. This encodes the
   distinction the check comment makes.

NEW cases in the gate's own test

4. "a plan unit missing a declared decade doc fails the gate".
5. "a decade doc still carrying an unfilled `(fill in:` body fails".
6. "this campaign's own unit passes" - the self-check that 100_closeout.md relies on.

## Verification (C)

Run from the repo root; each must exit 0.

```powershell
npm test
npm run smoke
node plugins/codexclaw/scripts/gate.mjs
node plugins/codexclaw/scripts/inventory.mjs --check
```

The CRLF matrix cell, reproduced locally - this is the cell that did not exist before:

```powershell
git config --global core.autocrlf true
git clone . $env:TEMP\cxc-crlf-check
cd $env:TEMP\cxc-crlf-check; npm ci; npm test
git config --global core.autocrlf false
```

WSL, both filesystem tiers:

```bash
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/super/Downloads/codexclaw && npm test && node bin/codexclaw.mjs doctor | grep -i drvfs"
wsl -d Ubuntu -- bash -lc "cd ~/codexclaw-wsl-checkout && npm test && npm run smoke"
```

Workflow syntax, before pushing:

```powershell
gh workflow view CI
gh workflow view WSL
```

After the first push, both lanes must be green across all five cells (3 OS + 1 CRLF
Windows + WSL):

```powershell
gh run list --branch dev --limit 5
```

Record the C>D receipt with `node bin/codexclaw.mjs receipt test -- npm.cmd test` on
Windows and `cxc receipt test -- npm test` in WSL. This phase is the first that must
produce BOTH.
