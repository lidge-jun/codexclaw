# wp2 — Export completion for issue #240

This phase fixes a false failure in the paged-report exporter. Chromium can finish writing a syntactically complete staged PDF and then keep its process alive, so the current exporter waits until its deadline and rejects a usable stage. The phase adds a bounded stability probe for the staged PDF, requires cleanup before promotion, records how each print pass completed, and makes the human summary name failed, blocked, and not-run checks. It is for report authors and reviewers who need the exporter’s result to describe the artifact and the failed condition accurately.

## Phase contract

- Work phase: `wp2`, issue `#240`.
- Binding decisions: D2.1, D2.2, D2.3 from `002_architect_consultation.md`.
- Dependency: independent of wp4; wp3’s optional DOM diagnostics should consume this phase’s stable print behavior if both land.
- Completion: the focused export tests exercise normal exit, stable completion on first and second print passes, changing content, deadline failure, cleanup failure, nonzero exit, destination preservation, and human-readable reasons.
- Existing `--qa-only` behavior remains PDF-only and does not run the staged-process probe.

## File change map

No file is added or deleted. The following four files are modified. `quality-gate.mjs` is read and tested as a contract dependency; it has no planned diff because D2.3 changes exporter presentation and leaves the existing PASS/FAIL/REVIEW/NOT_RUN/BLOCKED aggregation unchanged.

### 1. MODIFY `plugins/codexclaw/skills/dev-visualizer/scripts/export-paged-report.mjs`

Current source anchors, rechecked on 2026-09-24: `killToolTree` at lines 89–106, `runTool` at 108–146, `printPdf` at 183–197, `finish` at 302–347, first print dispatch in `main` at 393–400, second print dispatch at 455–464, and CLI entry at 511–512.

Add the following constants beside `DEFAULT_TIMEOUT_MS` and `MAX_TIMEOUT_MS` at lines 24–26:

```diff
 const DEFAULT_TIMEOUT_MS = 30_000;
 const MAX_TIMEOUT_MS = 300_000;
+const STAGE_POLL_MS = 250;
+const STAGE_STABILITY_MS = 1_500;
+const POST_KILL_GRACE_MS = 5_000;
```

Add `readSync` to the `node:fs` import at line 12. Add this complete helper after `writeTempHtml` (currently lines 176–181). It reads only the first five bytes and the final 1 KiB on each probe; it accepts a stage only when the header, trailer, size, and modification time are usable.

```js
function readPdfStageSnapshot(path) {
  let descriptor;
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size < 5) return null;
    descriptor = openSync(path, "r");
    const header = Buffer.alloc(5);
    if (readSync(descriptor, header, 0, header.length, 0) !== header.length) return null;
    const tailLength = Math.min(stat.size, 1024);
    const tail = Buffer.alloc(tailLength);
    if (readSync(descriptor, tail, 0, tailLength, stat.size - tailLength) !== tailLength) return null;
    if (header.toString("latin1") !== "%PDF-") return null;
    if (!/%%EOF[\\t\\n\\f\\r ]*$/.test(tail.toString("latin1"))) return null;
    return { size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
```

Replace `killToolTree` at current lines 89–106 so its return value records whether an owned kill was actually requested. A POSIX `ESRCH` means no group signal was sent even if cleanup has no error. On Windows, retain the existing direct `taskkill.exe /PID ... /T /F` invocation and fallback, but return its status explicitly. `runTool` uses this receipt only after it observes the child exit; a successful cleanup call alone never proves the child died from our request.

```js
function killToolTree(child) {
  if (process.platform === "win32") {
    const taskkill = join(process.env.SystemRoot || process.env.WINDIR || "C:\\Windows", "System32", "taskkill.exe");
    const result = spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
      timeout: 5000, killSignal: "SIGKILL", windowsHide: true, encoding: "utf8",
    });
    if (result.error || result.status !== 0) {
      child.kill("SIGKILL");
      return { error: `tree cleanup failed: ${result.error?.message || result.stderr || result.status}`, signalSent: null, taskkillStatus: result.status };
    }
    return { error: null, signalSent: null, taskkillStatus: 0 };
  }
  try {
    process.kill(-child.pid, "SIGKILL");
    return { error: null, signalSent: "SIGKILL", taskkillStatus: null };
  } catch (error) {
    if (error.code === "ESRCH") return { error: null, signalSent: null, taskkillStatus: null };
    child.kill("SIGKILL");
    return { error: `tree cleanup failed: ${error.message}`, signalSent: null, taskkillStatus: null };
  }
}
```

Replace `runTool` at current lines 108–146 with the same subprocess behavior plus an optional completion probe. The following is the required behavior and replacement body. `completionPath` is passed only by `printPdf`; `killTree`, `postKillGraceMs`, and `env` are dependency injection used by focused race/cleanup tests. A stability request is not an exit result: on POSIX it succeeds as `stage-stable` only when the `exit` event reports the sent signal and `status === null`; on Windows it requires a zero-status `taskkill` receipt and the child `exit` event after the request. A natural code `3` or `8` exit after a stability decision remains a failure.

```js
async function runTool(tool, args, timeoutMs, {
  completionPath = null,
  killTree = killToolTree,
  postKillGraceMs = POST_KILL_GRACE_MS,
  env,
} = {}) {
  const nodeModule = /[.](?:[cm]?js)$/i.test(tool);
  const captureDir = mkdtempSync(join(tmpdir(), "cxc-report-tool-"));
  const descriptors = [];
  let result;
  try {
    for (const name of ["stdout", "stderr"]) descriptors.push(openSync(join(captureDir, name), "w+"));
    result = await new Promise((resolveResult) => {
      const child = spawn(nodeModule ? process.execPath : tool, nodeModule ? [tool, ...args] : args, {
        stdio: ["ignore", ...descriptors], detached: process.platform !== "win32", windowsHide: true,
        env,
      });
      let settled = false;
      let timedOut = false;
      let completionRequested = false;
      let killRequestedAt = null;
      let killOutcome = { error: null, signalSent: null, taskkillStatus: null };
      let previousStage = null;
      let stableSince = null;
      let deadlineTimer;
      let probeTimer;
      let graceTimer;
      const clearTimers = () => {
        clearTimeout(deadlineTimer);
        clearTimeout(graceTimer);
        clearInterval(probeTimer);
      };
      const finishResult = (value) => {
        if (settled) return;
        settled = true;
        clearTimers();
        resolveResult(value);
      };
      const requestKill = (reason) => {
        if (completionRequested || settled) return;
        completionRequested = reason;
        killRequestedAt = Date.now();
        if (reason === "stage-stable") clearTimeout(deadlineTimer);
        if (child.pid) {
          try { killOutcome = killTree(child); }
          catch (error) { killOutcome = { error: `tree cleanup failed: ${error.message}`, signalSent: null, taskkillStatus: null }; }
        } else {
          killOutcome = { error: "tree cleanup failed: child has no PID", signalSent: null, taskkillStatus: null };
        }
        graceTimer = setTimeout(() => finishResult({
          timedOut,
          completionRequested,
          cleanupError: killOutcome.error,
          postKillTimedOut: true,
        }), postKillGraceMs);
      };
      child.once("error", (error) => finishResult({ error }));
      child.once("exit", (status, signal) => {
        const killedByUs = completionRequested === "stage-stable"
          && killRequestedAt !== null && !killOutcome.error
          && (process.platform === "win32"
            ? killOutcome.taskkillStatus === 0
            : status === null && signal !== null && signal === killOutcome.signalSent);
        finishResult({
          status, signal, timedOut, completionRequested,
          cleanupError: killOutcome.error,
          completedBy: killedByUs ? "stage-stable" : "exit",
        });
      });
      deadlineTimer = setTimeout(() => {
        timedOut = true;
        requestKill("deadline");
      }, timeoutMs);
      if (completionPath) {
        probeTimer = setInterval(() => {
          const current = readPdfStageSnapshot(completionPath);
          const unchanged = current && previousStage
            && current.size === previousStage.size
            && current.mtimeMs === previousStage.mtimeMs;
          if (!current) {
            previousStage = null;
            stableSince = null;
            return;
          }
          if (!unchanged) stableSince = Date.now();
          previousStage = current;
          if (stableSince !== null && Date.now() - stableSince >= STAGE_STABILITY_MS) {
            requestKill("stage-stable");
          }
        }, STAGE_POLL_MS);
      }
    });
    result.stdout = readFileSync(join(captureDir, "stdout"), "utf8");
    result.stderr = readFileSync(join(captureDir, "stderr"), "utf8");
  } finally {
    for (const descriptor of descriptors) closeSync(descriptor);
    rmSync(captureDir, { recursive: true, force: true });
  }
  if (result.postKillTimedOut || result.cleanupError) {
    const phase = result.completionRequested === "stage-stable" ? "stable PDF stage cleanup" : `timed out after ${timeoutMs} ms`;
    const grace = result.postKillTimedOut ? "; post-kill grace expired before child exit" : "";
    return { ok: false, reason: `${phase}${grace}${result.cleanupError ? `; ${result.cleanupError}` : ""}` };
  }
  if (result.timedOut) return { ok: false, reason: `timed out after ${timeoutMs} ms; killSignal SIGKILL (owned process tree)` };
  if (result.error) return { ok: false, reason: `could not start: ${result.error.code || result.error.message}` };
  if (result.completedBy === "stage-stable") return { ok: true, stdout: result.stdout || "", completedBy: "stage-stable" };
  if (result.signal) return { ok: false, reason: `terminated by signal ${result.signal}` };
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim().slice(-400);
    return { ok: false, reason: `exited with status ${String(result.status)}${detail ? `: ${detail}` : ""}` };
  }
  return { ok: true, stdout: result.stdout || "", completedBy: "exit" };
}
```

The implementation must preserve the current deadline semantics: a 100 ms deadline cannot satisfy the 1,500 ms stability window. A natural exit before `requestKill` keeps the existing rule: zero succeeds, nonzero fails, regardless of stage completeness. A natural nonzero exit after the stability request but before kill delivery also fails (`status !== 0`, `signal === null` on POSIX; the injected Windows receipt has no successful `taskkill` status). `killRequestedAt` records the decision before synchronous kill delivery; the `exit` callback compares the observed exit with the actual kill receipt. A stage that has completed and is deliberately killed by the probe is successful only if cleanup reports success and the child exits before the 5,000 ms grace period. Disarming the deadline after a stable-stage request lets the separate grace period govern cleanup; a deadline that fires first remains a timeout failure.

Replace `printPdf` at current lines 183–197 with this body. The stage path remains unique and registered in `tempFiles`.

```js
async function printPdf(chrome, htmlPath, pdfPath, profilePath, timeoutMs, tempFiles) {
  const stage = join(dirname(pdfPath), `.${basename(pdfPath)}.${randomUUID()}.export-stage.pdf`);
  tempFiles.add(stage);
  const result = await runTool(chrome, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${profilePath}`, "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=10000",
    `--print-to-pdf=${stage}`, pathToFileURL(htmlPath).href,
  ], timeoutMs, { completionPath: stage });
  if (!result.ok) return result;
  try {
    if (statSync(stage).isFile() && readFileSync(stage).subarray(0, 5).toString() === "%PDF-") {
      return { ok: true, path: stage, completedBy: result.completedBy };
    }
  } catch { /* report below */ }
  return { ok: false, reason: "browser exited successfully but produced no nonempty PDF" };
}
```

Add `printPasses: []` beside `passes` in the report object at current lines 354–360. After the successful first `printPdf` result at current line 393, append `{ pass: 1, completedBy: printed.completedBy }` before setting `pdfPath`. After the successful second result at current line 455, append `{ pass: 2, completedBy: printed.completedBy }` before setting `pdfPath`. Failed passes are represented by the existing failed check reason and are not claimed as completed.

Replace the non-JSON branch in `finish` at current lines 338–345. Keep the existing TOC and QA lines, then emit each check with status `FAIL`, `BLOCKED`, or `NOT_RUN` as `status id: reason`, once per unique status/id/reason tuple. Emit entries from `report.notRun` only when their reason was not already printed by a check. Finish with the existing verdict line. This makes a timeout such as `artifact-created` visible without changing JSON consumers.

Guard the CLI entry at current lines 511–512 so the test can import `runTool` for the cleanup injection, while direct execution remains identical:

```diff
-try { process.exitCode = await main(); }
-catch (error) { console.error(`export-paged-report: ${error.message}`); process.exitCode = 1; }
+export { runTool };
+if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
+  try { process.exitCode = await main(); }
+  catch (error) { console.error(`export-paged-report: ${error.message}`); process.exitCode = 1; }
+}
```

### 2. MODIFY `plugins/codexclaw/test/fixtures/visualizer-export-tools.mjs`

Current anchors: print dispatch at lines 39–102, staged PDF write at 57, hang modes at 66, and text/PDF inspection dispatch at 104–157.

Keep all existing modes. Refactor the single staged write at current line 57 into a helper that writes a complete fixture PDF with `%%EOF` followed only by a newline. Add these modes immediately after the complete write and before the existing partial-output branches:

- `complete-then-hang`: write the complete PDF, then call the existing `hang()`; this applies to both `count === 1` and `count === 2`, so first-pass and second-pass tests exercise the same mode.
- `complete-then-nonzero`: write the complete PDF, print a diagnostic, and exit 8; this verifies that a racing nonzero exit is not converted to stable success.
- `complete-then-nonzero-after-stable-request`: write the complete PDF, then wait briefly for a test-controlled release marker named by `CXC_VISUALIZER_RACE_RELEASE`; poll for the marker and exit 3 as soon as it appears, with a bounded fixture watchdog that exits with a different code if it never appears. The test's injected `killTree` writes the marker only after `runTool` records `killRequestedAt` and the 1,500 ms stability window has elapsed. It returns `{ error: null, signalSent: null, taskkillStatus: null }` without delivering a kill, so the child emits a natural code-3 exit after the stability request on every platform. Assert that the callback was reached; this handshake makes the ordering deterministic without relying on scheduler timing.
- `changing-content-same-size`: write a complete PDF, then update one non-structural byte at a fixed offset on a 100 ms interval while keeping the byte length constant, and call `hang()`. Each write must leave the `%PDF-` header and `%%EOF` trailer intact. The mtime changes, so the stability probe cannot arm.

The fixture cannot simulate a process ignoring POSIX `SIGKILL`; `SIGKILL` is not catchable. The post-kill-no-exit and cleanup-failure case is therefore tested by the unit-level `killTree` injection described below, while the fixture continues to cover real descendant cleanup with `chrome-tree-hang`.

### 3. MODIFY `plugins/codexclaw/test/report-export.test.mjs`

Current anchors: subprocess helper at lines 33–49, export arguments at 57–67, timeout matrix at 377–406, failed-generation matrix at 447–466, descendant cleanup at 468–488, and two-pass success at 490–509.

Import `runTool` from the exporter after the existing `evaluateReport` import. Add these tests with the following exact names and assertions:

1. `complete-then-hang accepts a stable staged PDF on the first print pass` — run the real CLI in fixture mode `complete-then-hang` with a previous destination; assert exit 0, `verdict === "PASS"`, `passes === 1`, `printPasses` equals `[{ pass: 1, completedBy: "stage-stable" }]`, the destination contains `fixture-pass=1`, and no `export-stage`, `export-pass`, or `cxc-report-` scratch entry remains.
2. `complete-then-hang accepts stable staged PDFs on both print passes` — use the existing TOC input shape, run mode `complete-then-hang`, assert exit 0, `passes === 2`, two `printPasses` entries both have `completedBy === "stage-stable"`, the fixture print count is `2`, the final destination contains `fixture-pass=2`, and the old destination bytes were observed before both passes.
3. `changing-content-same-size cannot satisfy the stability window before the deadline` — run mode `changing-content-same-size` with `--timeout-ms 1000` and a previous destination; assert exit 1, `artifact-created` is `FAIL`, its reason names the deadline, the previous bytes and digest remain, and scratch files are removed.
4. `a complete staged PDF followed by a nonzero exit remains FAIL` — run mode `complete-then-nonzero`; assert exit 1, `artifact-created` is `FAIL`, the reason contains `status 8`, and the previous destination is unchanged.
5. `nonzero exit after stability request is not success` — call imported `runTool` on fixture mode `complete-then-nonzero-after-stable-request` with a complete stage path, a test-owned release marker, `timeoutMs` long enough for the 1,500 ms stability window, and an `env` containing `CXC_VISUALIZER_RACE_RELEASE`. Inject `killTree` to atomically create the marker and return `{ error: null, signalSent: null, taskkillStatus: null }`; count calls and capture the child PID for `finally` cleanup. Assert the callback ran once, the marker exists, `ok === false`, the reason contains `status 3`, and no `stage-stable` completion is returned. The fixture exits only after that callback, so this specifically tests a natural nonzero exit after the stability decision and before kill delivery; its watchdog gives a distinct failure if the probe never requests cleanup.
6. `runTool reports cleanup failure when injected kill cannot produce child exit` — call imported `runTool` with a short-lived hanging Node child, `timeoutMs` 100, `postKillGraceMs` 20, and a `killTree` injection that captures the PID and returns `{ error: "tree cleanup failed: injected", signalSent: null, taskkillStatus: null }` without killing it; assert `ok === false`, the reason contains the cleanup text and post-kill grace failure, and kill the captured PID in `finally`.
7. `human summaries print each failed check id and reason once` — omit `--json`, run an existing timeout mode, assert exit 1 and that stdout contains exactly one `FAIL artifact-created:` line with the timeout reason. Also run the missing-Poppler case and assert each `NOT_RUN <id>:` reason is named once.

Extend the existing failed-generation matrix only where needed for `complete-then-nonzero`; retain the current incomplete `chrome-hang` and `second-pass-hang` cases because a `%PDF-` prefix without `%%EOF` must continue to fail. Retain the current descendant test as the real process-tree cleanup proof.

### 4. MODIFY `plugins/codexclaw/skills/dev-visualizer/reference/report-pipeline.md`

Current lines 116–121 read:

```text
Select available Poppler tools with `--pdfinfo` and `--pdftotext` when they are not
on PATH. Each tool has a 30-second deadline; `--timeout-ms` accepts 100–300000.
A timed-out tool fails even when a useful draft PDF exists; verify that file
separately with `--qa-only` and record which engine actually completed the export.
The output records per-check status and reasons. Missing tools block
verification; a process failure or empty extraction fails it. A4/Letter is an
explicit choice independent of output language.
```

Replace them with the following exact lines (omit the Markdown quote markers):

> Select available Poppler tools with `--pdfinfo` and `--pdftotext` when they are not
> on PATH. Each tool has a 30-second deadline; `--timeout-ms` accepts 100–300000.
> An incomplete or changing stage fails at the deadline even when it has a useful
> draft PDF or a `%PDF-` prefix. During Chromium export, a stage with a `%PDF-`
> header and a final `%%EOF` trailer whose size and modification time remain
> unchanged for 1.5 seconds may complete through the bounded stability probe. The
> exporter then kills the owned Chromium tree and requires the child to exit within
> 5 seconds before promoting the stage. Stable-stage completion is accepted only
> when the exit matches that kill request: SIGKILL on POSIX, or a zero-status
> taskkill followed by child exit on Windows. A natural nonzero exit still fails,
> even after the stage looks complete; cleanup failure also fails. Verify
> any preserved or independently completed file separately with `--qa-only` and
> record which engine completed the export. The output records per-check status,
> reasons, and the completion method for each print pass. Missing tools block
> verification; a process failure or empty extraction fails it. A4/Letter is an
> explicit choice independent of output language.

## PLAN-FIELD-CHAIN-01

The phase introduces the `printPasses[]` report field and the `completedBy` values `"exit"` and `"stage-stable"`.

| Stage | Chain evidence and planned change |
| --- | --- |
| Creation | `runTool` returns `completedBy: "stage-stable"` only after an attributable kill and child exit, or `completedBy: "exit"` after a natural zero exit; `printPdf` preserves it; `main` creates `report.printPasses` and appends one object after each successful print at the current first-pass and second-pass call sites. Natural nonzero exits add no successful pass. |
| Serialization | `finish` serializes the report through the existing `JSON.stringify(report, null, 2)` branch at current `export-paged-report.mjs:338`; the human summary reads the report's checks and reasons and does not need to render `printPasses`. No new file format is introduced. |
| Deserialization / unknown-value handling | `N/A`: the exporter does not read a prior JSON report or revive `printPasses`; `--qa-only` starts a new report from a PDF and leaves `printPasses` empty. The test’s `JSON.parse` is a consumer assertion, not production deserialization. |
| Every consumer | `finish` and the focused tests consume the field. `quality-gate.mjs:evaluateReport` at current lines 23–56 iterates `artifact_sha256`, `checks`, and `notRun` and ignores unknown report fields, so no gate change is required. No other repository consumer is identified by the current source search. |
| Compatibility | Keep `schemaVersion: 1`; the field is additive. Consumers that ignore unknown fields remain valid. `completedBy` is an internal string union, not a public enum export. The kill receipt and `killRequestedAt` remain internal to `runTool` and are not serialized. |

## C-ACTIVATION-GROUNDING-01

| Conditional path | Activation scenario C will run | Observable effect |
| --- | --- | --- |
| Stable-stage completion | Fixture mode `complete-then-hang`, first print; valid header/trailer, unchanged size/mtime for 1.5 s, Chromium remains alive. | `runTool` records the request and actual kill receipt; POSIX child exit reports `SIGKILL` or Windows `taskkill` reports status 0 before child exit. CLI exits 0, stage is promoted, and `printPasses[0].completedBy` is `stage-stable`. |
| Stable-stage completion on refill | Same fixture mode with TOC input; both print invocations hang after complete output. | Two stable completion records appear, `passes === 2`, and only the second candidate is promoted. |
| Incomplete stage deadline | Existing `chrome-hang` or `second-pass-hang`; output has `%PDF-` but no `%%EOF`, and timeout is 1,000 ms. | Probe never arms, timeout kills the owned tree, `artifact-created` is `FAIL`, and the prior destination remains. |
| Changing content with constant size | Fixture mode `changing-content-same-size`; valid trailer remains but a byte and mtime change every 100 ms; timeout is 1,000 ms. | Size/mtime stability never reaches 1.5 s; the command fails at the deadline and does not promote the stage. |
| Cleanup failure / no child exit | Unit test injects `killTree` failure and a 20 ms post-kill grace. | `runTool` returns `ok: false` with cleanup and grace-expiry text; no stable success is reported. |
| Nonzero natural exit before request | Fixture mode `complete-then-nonzero`; complete bytes are written immediately before exit 8. | The exit status is retained as failure; a complete-looking stage is not promoted. |
| Nonzero natural exit after stability request | Fixture mode `complete-then-nonzero-after-stable-request` writes a complete stage and waits for the injected cleanup callback to create its release marker. The callback reports no kill delivered; the child then exits 3. | The callback proves the stability decision occurred; `status 3` remains a failure, with no `stage-stable` result or promotion. |
| Human failure explanation | Run an existing timeout without `--json`, and a missing-Poppler export. | stdout names each `FAIL` or `NOT_RUN` check ID and reason once, with duplicate `report.notRun` text suppressed. |

## PLAN-BYPASS-NAMED-01

| New check / behavior | Tier | Executing surface | Known bypass | Residual risk | Wording |
| --- | --- | --- | --- | --- | --- |
| Stage header/trailer/stability probe | E8, script-level gate | `export-paged-report.mjs` through `runTool`/`printPdf` | A caller can skip this exporter, use `--qa-only` on a PDF produced elsewhere, or ignore the nonzero exit. | A syntactically complete PDF may still fail Poppler parsing; mtime resolution and filesystem behavior can affect stability observation. | Say “the exporter rejects an unstable stage”; do not call it Codex runtime enforcement or proof of PDF semantic correctness. |
| Post-kill cleanup, attribution, and grace | E8, script-level gate | `killToolTree`, `runTool`, and the 5-second grace timer | An alternative exporter or a caller that ignores the exporter result bypasses it; OS-level descendants can remain beyond what the parent/taskkill result proves. | The phase proves the owned child exit matched the sent POSIX signal or followed a successful Windows `taskkill` request; it does not prove universal descendant disappearance. | Say “stable-stage promotion requires an attributable kill and child exit”; a natural nonzero exit remains failed. |
| Per-pass `completedBy` receipt field | E7, output documentation | Exporter JSON and human summary | A consumer can ignore the field or consume a stale report. | It records the exporter’s observation, not independent process or PDF truth. | Call it an output record, not enforcement. |
| Human-readable check reasons | E7, CLI output | `finish` non-JSON branch | JSON-only consumers or users who do not read stdout will not receive the explanation. | The structured report remains the authoritative machine-readable result. | Call it diagnostic output, not a gate. |
| Regression fixtures and assertions | E8, repository test gate | `report-export.test.mjs` via `scripts/test.mjs` | A caller can omit the focused suite or run an uncommitted tree. | Tests do not prove every Chromium/OS version or a real descendant after parent exit. | Say the suite covers the named scenarios; do not generalize it to all platforms. |

The E8 classification follows `structure/40_enforcement_methods.md:18–32`: E8 is a script/test gate, while E7 is documentation or output guidance. No E1/E2 hook or live-turn enforcement is introduced.

## Verifier commands and fresh baseline

Run these after implementation. Every command below was run against the current tree before this document was written; “new” rows are intentionally not run because their tests and modes do not exist yet.

| Command | Current result | How it reads this phase’s target |
| --- | --- | --- |
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/report-export.test.mjs"` | EXIT 0; 37 passed, 0 failed. | The glob directly names the export test file, which imports the exporter contract and invokes the CLI with `test/fixtures/visualizer-export-tools.mjs`. Existing tests do not yet observe the new modes. |
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/report-quality-gate.test.mjs" "plugins/codexclaw/test/report-genre-contract.test.mjs"` | EXIT 0; 42 passed, 0 failed. | The quality suite directly imports `quality-gate.mjs`; the genre suite directly reads `reference/report-pipeline.md`. |
| `node --check plugins/codexclaw/skills/dev-visualizer/scripts/export-paged-report.mjs` | EXIT 0. | Directly parses the exporter target. |
| `node --check plugins/codexclaw/skills/dev-visualizer/scripts/quality-gate.mjs` | EXIT 0. | Directly parses the unchanged quality-gate dependency. |
| `node --check plugins/codexclaw/test/fixtures/visualizer-export-tools.mjs` | EXIT 0. | Directly parses the fixture target. |
| `node -e 'const fs=require("node:fs"); const p="plugins/codexclaw/skills/dev-visualizer/reference/report-pipeline.md"; const s=fs.readFileSync(p,"utf8"); if(!s.includes("A timed-out tool fails even when a useful draft PDF exists")) process.exit(1); console.log("report-pipeline timeout contract located")'` | EXIT 0. | Directly reads the current report-pipeline target and confirms the pre-change sentence. |
| `node -e 'const fs=require("node:fs"); const p="structure/40_enforcement_methods.md"; const s=fs.readFileSync(p,"utf8"); if(!/\\| E8 \\|/.test(s)||!s.includes("claim \\"enforced\\" only for E1, E2, and E8")) process.exit(1); console.log("enforcement ladder located")'` | EXIT 0 after correcting the initial wrong path `plugins/codexclaw/structure/40_enforcement_methods.md`, which exited 1 with ENOENT. | Directly reads the enforcement-tier source used by PLAN-BYPASS-NAMED-01; it does not read the phase file. |
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/report-export.test.mjs"` after implementation | NOT RUN (new). | Will read the modified exporter, fixture, and every new test, including stable first/second pass, changing content, a marker-released nonzero exit after stability request, injected cleanup failure, and human summary assertions. |
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/report-quality-gate.test.mjs" "plugins/codexclaw/test/report-genre-contract.test.mjs"` after implementation | NOT RUN (new). | Will recheck unchanged quality aggregation and the modified report-pipeline wording through their direct imports/reads. |

The post-build C check must also inspect that the fixture processes recorded in `hanging-tool.json` and `descendant.json` are gone and that the destination bytes remain unchanged on all failure cases. A passing syntax check alone is not evidence for those conditional paths.

## Docs and source-of-truth sync

| Owner | Current line(s) | Planned sync |
| --- | --- | --- |
| `plugins/codexclaw/skills/dev-visualizer/reference/report-pipeline.md` | 116–121 | MODIFY exactly as shown in the file map: document the 1.5-second header/trailer/size/mtime probe, attributable kill, 5-second cleanup grace, natural nonzero failure, per-pass completion method, and unchanged `--qa-only` path. This replacement is the canonical new wording for wp3 to extend when it adds DOM diagnostics. |
| `plugins/codexclaw/skills/dev-visualizer/SKILL.md` | 114–119, 145–180 | No line change. The existing visualizer verification rules already require actual export and proportional evidence; this phase changes exporter mechanics and its report reference. |
| `structure/INDEX.md` | 17–35 | No line change. No component, skill, hook, CLI, or durable architecture boundary is added; `structure/40_enforcement_methods.md` is consulted for honest tier labels only. |
| `plugins/codexclaw/skills/dev-visualizer/scripts/quality-gate.mjs` | 23–56 | No line change. Existing check status aggregation remains the contract; the additive `printPasses` field is ignored as an unknown report field. |

## Scope and risks

IN: staged PDF completion probing for Chromium print passes; bounded post-kill cleanup; additive per-pass completion metadata; human summary reasons; fixture modes and focused tests; the report-pipeline reference update.

OUT: CDP printing; changes to PDF parsing, Poppler checks, assurance profiles, or exit-code meanings; `--qa-only` process probing; SVG DOM diagnostics; changes to the paged template; hook/CI enforcement; proof that every OS descendant has exited after the parent is gone.

Risks are bounded by the existing `pdfinfo` and `pdftotext` checks: a stable trailer is only a completion signal, not semantic PDF validation. A too-short deadline still fails by design. A filesystem that preserves the same mtime across changing writes could make the probe accept too early, so the fixture must write often enough to expose the local mtime resolution and the implementation must keep the stability window explicit. The cleanup result is a hard promotion condition, but OS process APIs cannot prove that an unrelated descendant escaped a broken process group.

Open decisions: none. D2.1, D2.2, and D2.3 settle the intended behavior; the unit-level injection is the explicit test method for the uncatchable SIGKILL/no-exit case and for ordering a natural nonzero exit after the stability request.

## Audit round 1 folds

- Finding 3: `killToolTree` now returns a signal/taskkill receipt, and `runTool` records `killRequestedAt` before requesting cleanup. It marks `stage-stable` only after a matching POSIX signal exit or a zero-status Windows `taskkill` followed by child exit. Natural nonzero exits, including code 3 after the stability request, remain failures. The new marker-controlled fixture and named test make that race reproducible.
- Finding 12 counterpart: the wp2 `report-pipeline.md` replacement above is the canonical timeout/stability wording. Wp3 must extend this replacement when adding DOM guidance, rather than retain the obsolete sentence that every timed-out tool fails.
- Syntax proof for changed executable blocks: extracted `killToolTree` to `/tmp/010_export_completion_killToolTree.mjs` and `runTool` to `/tmp/010_export_completion_runTool.mjs`; `node --check` exited 0 for each on 2026-09-24. The proposed reference replacement is prose, shown as a Markdown quote rather than an executable code block. No implementation or new tests were run in this docs-only phase.
