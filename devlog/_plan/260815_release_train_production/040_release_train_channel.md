# 040 — Release train channel

Status: PLANNED — work-phase wp4 (issue #27). Rewritten after A-gate round 2.

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: no workflow can publish a release; CI omits macOS and never tests the
  installed product (003)
- Goal: an executable release train — exact-head verification, gate, payload build,
  publication — plus CI lanes that test the artifact and the real install
- Non-goals: cutting the actual release (050)
- Verifier: real GitHub Actions runs on the exact head SHA, green
- Stop condition: every new job has a green run id recorded
- Memory artifact: this doc + run ids in the candidate manifest
- Terminal outcomes: DONE on green runs; **BLOCKED** if Actions is unavailable or
  the install lane cannot run
- Escalation: the install lane is never degraded, skipped, or marked
  `continue-on-error`. If it cannot run, the work-phase is BLOCKED and reported as
  such (004 #9). A lane that cannot fail is not evidence.

## Prerequisite

010 must have committed the regenerated `cxc-ops` dist files. Verified today:
`git diff --exit-code plugins/codexclaw/components/*/dist` exits 1, and `build.mjs`
reproduces exactly those two files — committed dist lags source. Without 010, lane 2
fails on a clean checkout the moment it is introduced (004 #7).

## Lane 1 — `ci.yml`

`os: [ubuntu-latest, windows-latest, macos-latest]`. Steps unchanged plus
`node plugins/codexclaw/scripts/inventory.mjs --check`.

macOS is added because it is the primary development platform and the only untested
one — a path-case or BSD-tool difference would ship undetected.

## Lane 2 — `packed-install.yml` / `artifact` job (no `codex` needed)

Matrix: ubuntu, windows, macos.

1. `npm ci`
2. `node plugins/codexclaw/scripts/build.mjs`
3. `git diff --exit-code plugins/codexclaw/components` — committed dist matches source
4. archive `plugins/codexclaw/` → `codexclaw-payload-<sha>.tar.gz` + `SHA256SUMS`
5. extract to a temp dir and run the payload dispatcher with no `cxc` on PATH:
   `node <extracted>/bin/cxc.mjs orchestrate status` (mirrors `payload-bin.test.mjs`)
6. fake-home residue simulation: copy the payload into a temp home, run the
   uninstall residue assertion, confirm zero leftovers
7. upload the archive + checksums as workflow artifacts for lane 4

## Lane 3 — `packed-install.yml` / `install` job (requires `codex`)

Matrix: ubuntu, macos (windows added once both are green).

```bash
npm install -g @openai/codex@0.147.0
CXC_LIFECYCLE_HOME="$RUNNER_TEMP/codex-home"; mkdir -p "$CXC_LIFECYCLE_HOME"

# the installed product must NOT rely on a PATH cxc (004 #6)
if command -v cxc >/dev/null 2>&1; then echo 'unexpected cxc on PATH'; exit 1; fi

export CODEX_HOME="$CXC_LIFECYCLE_HOME"
codex plugin marketplace add "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" --ref "$GITHUB_SHA"

# Resolve the INSTALLED payload from the installer's own output, not from find(1).
# A bare find matches three trees — installed cache, marketplace staging, marketplace
# source — so it is not an identity check (004r4 #3).
install_and_resolve() {   # $1 = expected ref label, for the log
  local json installed manifest
  json=$(codex plugin add codexclaw@codexclaw --json)
  installed=$(node -e "process.stdout.write(JSON.parse(process.argv[1]).installedPath||'')" "$json")
  [ -n "$installed" ] || { echo 'plugin add --json did not report installedPath'; return 1; }
  case "$installed" in
    "$CODEX_HOME"/plugins/cache/*) : ;;
    *) echo "refusing payload outside the install cache: $installed"; return 1 ;;
  esac
  manifest="$installed/.codex-plugin/plugin.json"
  [ -f "$manifest" ] || { echo "no manifest at $manifest"; return 1; }
  PLUGIN_ROOT="$installed"
  PLUGIN_VERSION=$(node -p "require('$manifest').version")
  node -e "if(require('$manifest').name!=='codexclaw')process.exit(1)"
  echo "payload[$1]: $PLUGIN_ROOT version=$PLUGIN_VERSION"
}

install_and_resolve head
HEAD_VERSION="$PLUGIN_VERSION"

node "$PLUGIN_ROOT/bin/cxc.mjs" hooks retrust --key codexclaw@codexclaw \
  --codex-home "$CODEX_HOME" --bootstrap-ok
node "$PLUGIN_ROOT/bin/cxc.mjs" doctor --json

# Upgrade path: drop to the PREVIOUS release, then return to HEAD.
codex plugin remove codexclaw@codexclaw
codex plugin marketplace remove codexclaw
codex plugin marketplace add "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" --ref v0.1.0
install_and_resolve v0.1.0
OLD_VERSION="$PLUGIN_VERSION"

# A marketplace source cannot be re-pointed in place: adding the same name from a
# different ref fails with "already added from a different source". Remove the
# marketplace first — the installed plugin does NOT need removing (004r6 #1,
# verified by executing this sequence in an isolated CODEX_HOME).
codex plugin marketplace remove codexclaw
codex plugin marketplace add "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" --ref "$GITHUB_SHA"
install_and_resolve head-again

# The upgrade must be observable, not assumed: an unchanged version means the
# upgrade silently kept the old payload and the lane FAILS.
[ "$PLUGIN_VERSION" != "$OLD_VERSION" ] || { echo "upgrade no-op: still $OLD_VERSION"; exit 1; }
[ "$PLUGIN_VERSION"  = "$HEAD_VERSION" ] || { echo "unexpected version $PLUGIN_VERSION"; exit 1; }

node "$PLUGIN_ROOT/bin/cxc.mjs" hooks retrust --key codexclaw@codexclaw \
  --codex-home "$CODEX_HOME" --bootstrap-ok

codex plugin remove codexclaw@codexclaw
# residue assertion over $CODEX_HOME
```

`codex plugin marketplace` exposes `add|list|upgrade|remove` and `codex plugin`
exposes `add|list|marketplace|remove` (verified against the local CLI), so every verb
above exists.

Three properties make this lane real rather than decorative: `--ref "$GITHUB_SHA"`
pins an immutable commit instead of a moving branch; the PATH assertion proves the
commands exercise the **installed payload**, not a checkout binary; and
`install_and_resolve` takes the payload path from `plugin add --json`, refuses anything
outside `$CODEX_HOME/plugins/cache`, and the lane **asserts** the version changed across
the upgrade — a silent no-op upgrade fails the job instead of passing quietly. `cxc` is not
on PATH after a marketplace install (`README.md:74-80`, `cxc-resolve.ts:4-14`).

## Lane 4 — `release.yml`

```yaml
on:
  workflow_dispatch:
    inputs:
      version: { required: true }
      prerelease: { type: boolean, default: true }
  push:
    tags: ["v*"]
permissions:
  contents: write   # create the release
  actions: read     # query exact-SHA run conclusions (004r3 #5:
                    # specifying any permission zeroes the rest)
concurrency: { group: release, cancel-in-progress: false }
```

Step order — **build before verify** (004 #5), because a `build` receipt cannot be
verified before the build that earns it:

1. resolve the exact SHA from the tag or dispatch ref
2. query `ci.yml` and `packed-install.yml` conclusions **for that SHA** via
   `gh api` (never "latest run")
3. `npm ci && npm test` → capture pass/fail
4. `build.mjs` → archive + `SHA256SUMS`
5. `node bin/codexclaw.mjs release init/platform/receipt/tests/inventory` — receipts
   recorded from steps 2-4 that already ran. The workflow runs `npm ci` only, which does
   not put `cxc` on PATH, so the release lane addresses the dispatcher by path exactly as
   the install lane does (004r4 #4)
6. `node bin/codexclaw.mjs release verify --version <v> --allow-deferred` — fails
   closed. `--allow-deferred` is required because `init` seeds the nine MLB 1.0 receipts
   as `deferred` (030); without it a complete beta candidate could never verify
   (004r5 #2). The flag is recorded in the manifest, so the published artifact states
   that MLB receipts were skipped. It does **not** weaken the six train receipts —
   any of those still `missing` fails the gate. For tag-driven stable releases the flag
   is omitted, so a `1.0` tag cannot ship with deferred receipts.
7. `gh release create` attaching archive, `SHA256SUMS`, candidate manifest
8. re-read the release via API and assert the assets exist

## PLAN-VERIFIER-REAL-01

| Command | Exists | Observes this change? |
| --- | --- | --- |
| `gh workflow run` / `gh run watch` | yes | yes — it executes the new files |
| `actionlint` | not installed | syntax only; not a substitute for a run |
| `npm test` | yes | no — no test reads workflow YAML |

Executing the workflows is the only real verifier. "Workflow correct" without a run
id is unverified.

## Bypass record

- Tier: E8; executing surface: `release.yml`
- Known bypass: manual `gh release create` or the GitHub UI
- Residual risk: high — no tag protection or rulesets exist (003)
- Wording downgrade: yes. Final enforcement layer: **`protect-release-tags`** +
  **`protect-main`** (rulesets `20884836` / `20884837`, added 2026-08-15; see 060).
  Manual publication through the UI is still possible — a ruleset is a
  recommended follow-up, out of scope here.

## Accept criteria

1. `ci.yml` green on ubuntu, windows and macOS at the exact head SHA (3 run ids).
2. Lane 2 green on all three OSes, including the dist-freshness step.
3. Lane 3 green on ubuntu and macOS, including the `command -v cxc` negative assertion,
   the upgrade path, and the residue assertion. Not green → **BLOCKED**, never skipped.
4. `release.yml` run against an incomplete candidate **fails at step 6** even with
   `--allow-deferred` (a missing train receipt is not a deferred one), proving the gate
   is wired, before 050 runs it for real.

Criterion 4 is the activation scenario for the phase: a release workflow that has
never refused anything has not been shown to gate.

**Amended during execution.** `workflow_dispatch` only resolves workflows that exist
on the **default branch**: dispatching `release.yml` from `dev` returns
`HTTP 404: workflow release.yml not found on the default branch`. That is a GitHub
constraint, not a defect in the workflow, so criterion 4 necessarily runs in 050
immediately after the promotion to `main` and before the real publish. The criterion
is not dropped — it moves to the first moment it is executable.
