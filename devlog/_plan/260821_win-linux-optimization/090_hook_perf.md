# 090 - wp10 win32 hook overhead

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp10.

Defects closed from 002 section D: **none**. This phase is measurement-first by design,
and it depends on wp08 (the bench hard-codes `/tmp` and cannot run on Windows at all
until 070 lands) and wp09 (the CI lane that keeps the numbers honest).

The premise is a suspicion, not a finding: Windows process creation is substantially more
expensive than `fork` on Linux, and codexclaw's hook manifests spawn a fresh
`node <cli.js>` per event. With hooks on SessionStart, UserPromptSubmit, PreToolUse,
PostToolUse, Stop, SubagentStop, and PostCompact, the per-tool-call hooks are the ones a
user feels. **No trim in this doc ships without a measured before/after.** A "performance
fix" with no number is how a correctness regression enters a codebase.

## MODIFY / NEW / DELETE map

### 1. MODIFY plugins/codexclaw/scripts/hook-bench.mjs

070 makes it run on Windows. This phase makes it comparable across platforms and runs.

#### 1a. A stable, machine-readable report

The current `--json` output carries per-hook timings. Add the fields a comparison needs:

```js
const report = {
  schemaVersion: 1,
  platform: process.platform,
  release: release(),
  nodeVersion: process.version,
  // Cold vs warm matters more on Windows than anywhere else: Defender's
  // first-touch scan of a JS file is a one-time cost that would otherwise be
  // averaged into every number and blamed on the hook.
  iterations,
  hooks: results.map((r) => ({
    event: r.event,
    category: r.category,
    command: r.command,
    coldMs: r.timings[0] ?? null,
    warmP50Ms: percentile(r.timings.slice(1).sort((a, b) => a - b), 50),
    warmP95Ms: percentile(r.timings.slice(1).sort((a, b) => a - b), 95),
    noOpRate: r.noOps / iterations,
    errors: r.errors,
  })),
};
```

#### 1b. A baseline spawn measurement

Without this, every number is unattributable: a 90ms hook on Windows where a bare
`node -e ""` costs 80ms is a 10ms hook, not a 90ms one.

```js
/**
 * Cost of spawning node at all, with no codexclaw code loaded.
 *
 * Subtracting this separates "the hook is slow" from "this OS makes process
 * creation slow", which are different problems with different fixes. Windows
 * has no fork(), so CreateProcess + PE loading + Defender's filter driver all
 * land in this number.
 */
function measureSpawnFloor(iterations) {
  const timings = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    spawnSync(process.execPath, ["-e", ""], { stdio: "ignore", timeout: 15000 });
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  return { p50: percentile(timings, 50), p95: percentile(timings, 95) };
}
```

`report.spawnFloorMs` carries it, and each hook gains
`aboveFloorMs: warmP50Ms - spawnFloor.p50`.

### 2. NEW plugins/codexclaw/scripts/hook-bench-compare.mjs

```js
#!/usr/bin/env node
/**
 * hook-bench-compare.mjs - diff two bench reports.
 *
 * Usage: node hook-bench-compare.mjs before.json after.json [--max-regression-pct 10]
 *
 * A trim that helps one hook and hurts another nets to noise in a total, so
 * this compares PER HOOK and fails on any regression past the threshold.
 * Ratios are taken against `aboveFloorMs`, not wall time: comparing a Windows run
 * to a Linux run on wall time mostly measures CreateProcess.
 */
```

Its exit code is the gate: 0 when no hook regressed past the threshold, 1 otherwise, with
the offending hooks named.

### 3. NEW devlog/_plan/260821_win-linux-optimization/091_bench_baseline.md

A recorded artifact, not code. Written during THIS phase's B step, before any trim, and
it carries:

- `hook-bench --iterations 25 --json` on Windows 11 / Node 24, Defender on.
- The same with the repo added to Defender's exclusion list, which separates
  "codexclaw is slow" from "the AV filter driver is slow" - a distinction the user can
  act on and we cannot fix in code.
- The same inside WSL2 on native ext4.
- The same on `/mnt/c` drvfs, since 060 established that tier as distinct.
- The spawn floor for each.

Four rows per hook. If Windows-minus-floor is within noise of Linux-minus-floor, the
correct outcome of this phase is **no trims**, a recorded finding, and a doctor hint about
Defender exclusions. That is a legitimate result, and this doc says so up front so the
phase is not pressured into shipping a change to look productive.

### 4. Candidate trims - each gated on the baseline

None of these are committed to. Each names its measurement precondition and its risk.

#### 4a. Fast-path exit before any IO

**Trigger:** a hook's `aboveFloorMs` p50 exceeds ~15ms while its `noOpRate` is above 0.8.

Most PreToolUse invocations are no-ops - the tool is not one the guard cares about. If
the decision needs no filesystem read, it should happen before the first `readFileSync`.

```ts
// Cheapest possible discriminator first: a payload the guard cannot act on
// exits before touching the session state, which on Windows is 1-2 stat calls
// through the AV filter driver.
if (!GUARDED_TOOLS.has(payload.tool_name)) return "";
```

**Risk:** a guard that exits early can no longer observe. Any hook that maintains a
counter or a ledger across ALL invocations must not take this path. Each candidate site
needs its observation side effects enumerated first.

#### 4b. Consolidate redundant state reads within one invocation

**Trigger:** a hook shows more `readState` calls than it has decisions to make.

**Risk:** low, but a re-read after a write is sometimes deliberate.

#### 4c. Lazy-load cold modules

**Trigger:** the spawn-floor-adjusted cost is dominated by module load, verified with
`node --cpu-prof` on the hook entry rather than guessed.

Static `import` at the top of `cli.ts` loads every module for every event, including
ones a given event never reaches. Dynamic `import()` inside the branch defers that.

**Risk:** real. It changes module init order, and any module with import-time side
effects (a registration, a process-level handler) would move. Needs an inventory of
import-time side effects before it is attempted.

#### 4d. Doctor hint for Defender exclusions

**Trigger:** the Defender-excluded baseline is materially faster than the default one.

Not a code optimization - a diagnostic that tells the user about a cost we cannot remove.
This is the trim most likely to actually help a Windows user, and it is the safest.

### 5. MODIFY .github/workflows/ci.yml

Append to the Windows cells only, non-blocking at first:

```yaml
      - name: Hook bench
        if: runner.os == 'Windows'
        continue-on-error: true
        run: |
          node plugins/codexclaw/scripts/hook-bench.mjs --iterations 15 --json > bench-${{ matrix.os }}.json
          node plugins/codexclaw/scripts/hook-bench-compare.mjs devlog/_plan/260821_win-linux-optimization/bench-baseline.json bench-${{ matrix.os }}.json --max-regression-pct 25
```

`continue-on-error: true` is deliberate for the first N runs: shared CI runners are noisy,
and a flaky perf gate that blocks merges gets disabled within a week. Promote it to
blocking only after the recorded variance across ~10 runs justifies a threshold.

## TESTS

NEW `plugins/codexclaw/test/hook-bench-report.test.mjs`

1. "the report carries schemaVersion, platform, and spawnFloorMs".
2. "cold is excluded from the warm percentiles" - with `timings = [500, 10, 10, 10]`,
   `coldMs === 500` and `warmP50Ms === 10`. This is the Defender-first-touch case.
3. "aboveFloorMs can be negative and is not clamped" - a hook faster than the measured
   floor means the floor sample was noisy, and hiding that with a `Math.max(0, ...)`
   would disguise an unreliable measurement as a good result.
4. "a single iteration yields null warm percentiles rather than NaN".

NEW `plugins/codexclaw/test/hook-bench-compare.test.mjs`

5. "an identical report compares clean" - exit 0.
6. "a 50% per-hook regression fails at threshold 10 and passes at 60".
7. "a regression in one hook fails even when the TOTAL improved" - the core reason this
   compares per hook.
8. "a hook present in before and absent in after is a failure, not a silent pass" - a
   deleted hook must be an explicit decision.
9. "comparison uses aboveFloorMs, not wall time" - two reports with identical
   `aboveFloorMs` and very different `spawnFloorMs` compare clean.

For any trim that actually ships, its own behavioral tests come first: 4a needs "the
guard still fires for every guarded tool" and "the observation side effects still happen"
BEFORE the early return is added.

## Verification (C)

Run from the repo root.

```powershell
node --test --test-concurrency=1 "plugins/codexclaw/test/hook-bench-report.test.mjs" "plugins/codexclaw/test/hook-bench-compare.test.mjs"
npm test
node plugins/codexclaw/scripts/gate.mjs
```

The baseline capture, which is this phase's actual deliverable:

```powershell
node plugins/codexclaw/scripts/hook-bench.mjs --iterations 25 --json > devlog/_plan/260821_win-linux-optimization/bench-baseline.json
Get-Content devlog/_plan/260821_win-linux-optimization/bench-baseline.json | ConvertFrom-Json | Select-Object -ExpandProperty spawnFloorMs
```

The Defender comparison - run elevated, and restore the exclusion afterward:

```powershell
Add-MpPreference -ExclusionPath (Get-Location).Path
node plugins/codexclaw/scripts/hook-bench.mjs --iterations 25 --json > bench-no-defender.json
Remove-MpPreference -ExclusionPath (Get-Location).Path
node plugins/codexclaw/scripts/hook-bench-compare.mjs bench-no-defender.json devlog/_plan/260821_win-linux-optimization/bench-baseline.json --max-regression-pct 1000
```

The threshold is deliberately huge: this run REPORTS a delta, it does not gate one.

Both WSL tiers:

```bash
wsl -d Ubuntu -- bash -lc "cd ~/codexclaw-wsl-checkout && node plugins/codexclaw/scripts/hook-bench.mjs --iterations 25 --json > /tmp/bench-native.json && node -e \"const r=require('/tmp/bench-native.json');console.log(r.spawnFloorMs)\""
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/super/Downloads/codexclaw && node plugins/codexclaw/scripts/hook-bench.mjs --iterations 25 --json > /tmp/bench-drvfs.json"
```

Then, after any trim, the gate that decides whether it ships:

```powershell
node plugins/codexclaw/scripts/hook-bench.mjs --iterations 25 --json > bench-after.json
node plugins/codexclaw/scripts/hook-bench-compare.mjs devlog/_plan/260821_win-linux-optimization/bench-baseline.json bench-after.json --max-regression-pct 0
```

Exit 0 with a measured improvement on at least one hook and no regression anywhere, or
the trim does not ship. A trim that only moves the total is not evidence.

Record the C>D receipt with `node bin/codexclaw.mjs receipt test -- npm.cmd test` on
Windows per CHECK-BINDING-01, and attach the before/after bench JSON as the phase's
evidence.

