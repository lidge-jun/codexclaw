// Portable recorder contracts remain global; real record/process cases are
// explicitly skipped off macOS. Darwin (including macmini) never skips them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, cpSync, existsSync, lstatSync, openSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { analyzeRun } from "../scripts/probe-evidence.mjs";
import { execArgs, probeEnv, payloadDigest, record, runOwned } from "../scripts/probe-recorder.mjs";
import { sha, readJson, tempRoot, put, putJson, isolatedEnv, recorderUrl, darwinOnly } from "./probe-fixtures/filesystem.mjs";
import { doctorReport, assertVerdict } from "./probe-fixtures/evidence.mjs";
import { recordFixture, recordReport, assertNoExec } from "./probe-fixtures/recorder.mjs";
import { ownedChildFixture, lifecycleDriver, pidExists, killFixture, assertGone, childExit,
  lifecycleMessages, sentinelFixture } from "./probe-fixtures/lifecycle.mjs";

test("args are exact and the allowlisted environment excludes ambient overrides/secrets", () => {
  assert.deepEqual(execArgs("priority", "/fixture/final.txt"), [
    "exec", "-m", "gpt-6-astra", "-c", 'model_reasoning_effort="high"',
    "-c", 'service_tier="priority"', "--dangerously-bypass-approvals-and-sandbox",
    "--json", "-o", "/fixture/final.txt",
  ]);
  assert.throws(() => execArgs("default", "/fixture/final.txt"));
  const keys = ["OPENAI_API_KEY", "NODE_OPTIONS", "CXC_SKILLS_DIR", "CODEXCLAW_WORKTREE_ROOTS", "CODEX_THREAD_ID"];
  const before = keys.map(key => process.env[key]);
  try {
    for (const key of keys) process.env[key] = "synthetic-ambient-sentinel";
    const env = probeEnv("/fixture/home", "/fixture/bin", "/fixture/plugin");
    assert.deepEqual(Object.keys(env).sort(), ["CODEXCLAW_CXC", "CODEX_HOME", "CODEX_SQLITE_HOME", "HOME", "LANG", "PATH", "TMPDIR", "USERPROFILE"].sort());
    assert.equal(env.PATH.split(":")[0], "/fixture/bin");
    assert.ok(env.CODEXCLAW_CXC.includes(join("/fixture/plugin", "bin", "cxc.mjs")));
    for (const key of keys) assert.equal(env[key], undefined);
  } finally {
    keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; });
  }
});

test("payload hashing detects byte drift and refuses nested symlinks without touching target", t => {
  const root = tempRoot(t, "cxc-payload-");
  put(root, "nested/file", "before");
  const before = payloadDigest(root);
  put(root, "nested/file", "after");
  assert.notEqual(payloadDigest(root), before);
  const outside = tempRoot(t, "cxc-payload-target-");
  const target = put(outside, "target", "untouched");
  // Junctions need no Windows symlink privilege; POSIX retains the file-link case.
  symlinkSync(process.platform === "win32" ? outside : target, join(root, "nested/link"),
    process.platform === "win32" ? "junction" : "file");
  assert.throws(() => payloadDigest(root), /payload symlink/);
  assert.equal(readFileSync(target, "utf8"), "untouched");
});

test("record accepts a clean isolated fixture exactly once and persists private identity artifacts", darwinOnly, async t => {
  const f = recordFixture(t);
  const result = await record(f.spec);
  assert.equal(result.ok, true);
  assert.equal(result.out, join(f.root, "output"));
  assert.equal(readFileSync(f.execMarker, "utf8"), "exec\n");
  assert.equal(readFileSync(f.doctorLog, "utf8"), "doctor\ndoctor\n");
  assert.equal(readFileSync(f.postflightMarker, "utf8"), "postflight\n");
  const run = recordReport(f);
  assert.equal(run.timeoutMs, 180000);
  assert.equal(run.version, "1.0.0+codex.fixture-one");
  assert.equal(run.sourceSha, f.spec.sourceSha);
  assert.equal(run.pluginRoot, f.installed);
  assert.equal(run.before.config, sha(readFileSync(f.config)));
  assert.equal(run.codexSha256, sha(readFileSync(f.spec.codexBin)));
  assert.deepEqual(run.beforeDoctor, { rc: 0, selectedChecks: "PASS" });
  assert.deepEqual(run.afterDoctor, { rc: 0, selectedChecks: "PASS" });
  assert.deepEqual(run.before, run.after);
  assert.equal(statSync(result.out).mode & 0o777, 0o700);
  assert.deepEqual(Object.keys(run.files).sort(), ["stdout.jsonl", "stderr.log", "final.txt",
    "doctor-before.json", "doctor-before.stderr", "doctor-after.json", "doctor-after.stderr"].sort());
  for (const [name, hash] of Object.entries(run.files)) {
    assert.equal(sha(readFileSync(join(result.out, name))), hash, name);
    assert.equal(statSync(join(result.out, name)).mode & 0o777, 0o600, name);
  }
  assert.equal(statSync(join(result.out, "run.json")).mode & 0o777, 0o600);
  assert.equal(assertVerdict(() => analyzeRun(result.out), 2).report.reason, "model/tier proof not supplied");
  await assert.rejects(() => record(f.spec));
  assert.equal(readFileSync(f.execMarker, "utf8"), "exec\n", "a run is never overwritten/re-executed");
});

for (const [name, mutate, expected] of [
  ["full cachebuster version mismatch", f => { f.spec.expectedVersion = "1.0.0+codex.fixture-two"; }, /manifest identity mismatch/],
  ["outside install", f => { const outside = join(f.base, "outside-plugin"); cpSync(f.installed, outside, { recursive: true });
    putJson(f.root, "install.json", { installedPath: outside }); }, /outside isolated CODEX_HOME/],
  ["config symlink", f => { const target = put(f.base, "outside-config", "# fixture\n");
    rmSync(f.config); symlinkSync(target, f.config); }, /symlinked path refused/],
  ["trust WARN", () => {}, /doctor hook-trust not PASS/],
  ["missing dist", f => { rmSync(f.dist); }, /doctor hooks not PASS/],
  ["timeout over maximum", f => { f.spec.timeoutMs = 600001; }, /invalid timeout/],
]) {
  test(`record preflight refuses ${name} before inference`, darwinOnly, async t => {
    const f = recordFixture(t, name === "trust WARN" ? "trust-warn" : "success");
    mutate(f);
    await assert.rejects(() => record(f.spec), expected);
    assertNoExec(f);
  });
}

test("record persists an explicit maximum timeout without waiting for it", darwinOnly, async t => {
  const f = recordFixture(t);
  f.spec.timeoutMs = 600000;
  assert.equal((await record(f.spec)).ok, true);
  assert.equal(recordReport(f).timeoutMs, 600000);
});

test("record refuses a symlinked dispatcher before doctor can execute its valid-looking target", darwinOnly, async t => {
  const f = recordFixture(t);
  rmSync(f.dispatcher);
  symlinkSync(f.externalDispatcher, f.dispatcher);
  await assert.rejects(() => record(f.spec), /payload symlink/);
  assert.equal(existsSync(f.linkedMarker), false);
  assert.equal(existsSync(f.doctorLog), false);
  assertNoExec(f);
});

for (const identity of ["config", "payload", "launcher"]) {
  test(`initial doctor ${identity} mutation is rejected before inference`, darwinOnly, async t => {
    const f = recordFixture(t, `predoctor-${identity}`);
    await assert.rejects(() => record(f.spec), /identity changed during preflight doctor/);
    assert.equal(readFileSync(f.doctorLog, "utf8"), "doctor\n");
    assert.deepEqual(readJson(join(f.root, "output/doctor-before.json")), doctorReport());
    assertNoExec(f);
  });
}

for (const scenario of ["payload-symlink", "config-drift", "launcher-drift", "postdoctor-mutation"]) {
  test(`record detects ${scenario} and analyzer fails before missing postflight proof`, darwinOnly, async t => {
    const f = recordFixture(t, scenario);
    const result = await record(f.spec);
    assert.equal(result.ok, false);
    const run = recordReport(f);
    assert.equal(run.outcome.rc, 0, "fake Codex must complete successfully to reach postflight");
    assert.equal(run.postflightError, true);
    assert.equal(existsSync(f.linkedMarker), false, "postflight must never run a linked dispatcher");
    assert.equal(readFileSync(f.doctorLog, "utf8"), scenario === "postdoctor-mutation" ? "doctor\ndoctor\n" : "doctor\n");
    assert.equal(existsSync(join(result.out, "doctor-after.json")), scenario === "postdoctor-mutation");
    if (scenario === "payload-symlink") assert.equal(run.after, undefined);
    assert.throws(() => analyzeRun(result.out), /run transport\/postflight failed/);
    assertVerdict(() => analyzeRun(result.out), 1);
  });
}

test("hostile global cxc is never selected; actual child resolution and launcher hashes bind candidate", darwinOnly, async t => {
  const f = recordFixture(t, "dispatch");
  const foreignBin = join(f.base, "foreign-bin");
  put(foreignBin, "cxc", `#!${process.execPath}\nimport {writeFileSync} from "node:fs";
writeFileSync(${JSON.stringify(f.foreignMarker)}, "foreign");\n`, 0o700);
  const previous = process.env.PATH;
  try {
    process.env.PATH = foreignBin + ":" + (previous ?? "");
    const result = await record(f.spec);
    assert.equal(result.ok, true);
    assert.equal(readFileSync(f.candidateMarker, "utf8"), "candidate\n");
    assert.equal(existsSync(f.foreignMarker), false);
    const run = recordReport(f), launcherRoot = join(f.home, "probe-bin");
    assert.equal(run.dispatch.launcherRoot, launcherRoot);
    assert.equal(run.dispatch.path.split(":")[0], launcherRoot);
    assert.ok(!run.dispatch.path.split(":").includes(foreignBin));
    assert.ok(run.dispatch.cxc.includes(f.dispatcher));
    assert.equal(readFileSync(f.resolution, "utf8"), `${launcherRoot}/cxc\n${launcherRoot}/codex\n`);
    assert.equal(run.before.cxcLauncher, sha(readFileSync(join(launcherRoot, "cxc"))));
    assert.equal(run.before.codexLauncher, sha(readFileSync(join(launcherRoot, "codex"))));
    assert.deepEqual(run.after, run.before);
  } finally {
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
  }
});

test("runOwned retains separate exact stdout/stderr bytes and nonzero exit status", darwinOnly, async t => {
  const root = tempRoot(t, "cxc-owned-bytes-");
  const stdoutFd = openSync(join(root, "stdout"), "wx", 0o600);
  const stderrFd = openSync(join(root, "stderr"), "wx", 0o600);
  let outcome;
  try {
    outcome = await runOwned({ bin: process.execPath, args: ["--input-type=module", "-e",
      'process.stdout.write("stdout-한글\\n"); process.stderr.write("stderr-only\\n"); process.exitCode = 7;'],
    cwd: root, env: isolatedEnv(root), prompt: "", timeoutMs: 1000, stdoutFd, stderrFd });
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }
  assert.equal(outcome.rc, 7);
  assert.equal(outcome.signal, null);
  assert.equal(outcome.interruption, null);
  assert.equal(outcome.spawnError, null);
  assert.deepEqual(readFileSync(join(root, "stdout")), Buffer.from("stdout-한글\n"));
  assert.deepEqual(readFileSync(join(root, "stderr")), Buffer.from("stderr-only\n"));
});

for (const scenario of ["timeout", "cancel", "completion", "detached"]) {
  test(`runOwned ${scenario}: exact owned-group cleanup and explicit detached teardown`, { ...darwinOnly, timeout: 25000 }, async t => {
    const root = tempRoot(t, "cxc-lifecycle-");
    const f = { root, scenario, recorderUrl, childSource: ownedChildFixture.toString(),
      pidFile: join(root, "pids.json"), stdout: join(root, "stdout"), stderr: join(root, "stderr") };
    const driverPath = put(root, "driver.mjs", `const f = ${JSON.stringify(f)}; await (${lifecycleDriver.toString()})();`);
    const sentinel = await sentinelFixture(root);
    const driver = spawn(process.execPath, [driverPath], { cwd: root, env: isolatedEnv(root),
      detached: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    const driverExit = childExit(driver);
    let diagnostics = "", identities;
    driver.stderr.on("data", chunk => { diagnostics += chunk; });
    try {
      const result = await lifecycleMessages(driver, ready => {
        identities = ready;
        assert.equal(pidExists(ready.child), true);
        if (ready.background) assert.equal(pidExists(ready.background), true);
        if (scenario === "cancel") driver.kill("SIGTERM");
        if (scenario === "completion" || scenario === "detached") driver.send("release");
      });
      assert.equal(result.outcome.spawnError, null, diagnostics);
      if (scenario === "timeout") {
        assert.equal(result.outcome.interruption, "timeout");
        assert.equal(result.outcome.signal, "SIGKILL", "TERM-ignoring fixture must reach escalation");
        assert.ok(result.outcome.elapsedMs >= 1000 && result.outcome.elapsedMs < 10000);
      } else if (scenario === "cancel") {
        assert.equal(result.outcome.interruption, "SIGTERM");
      } else {
        assert.equal(result.outcome.rc, 0, diagnostics);
        assert.equal(result.outcome.interruption, null);
      }
      assert.deepEqual(await driverExit, { rc: 0, signal: null }, diagnostics);
      await assertGone(result.child);
      await assertGone(-result.child);
      assert.equal(pidExists(sentinel.child.pid), true, "unrelated sentinel must survive recorder cleanup");
      if (scenario === "detached") {
        assert.equal(pidExists(result.background), true, "separately detached group is outside recorder ownership");
        killFixture(-result.background);
        await assertGone(result.background);
        await assertGone(-result.background); // explicit fixture-owned teardown proof
      } else if (result.background) await assertGone(result.background);
    } finally {
      // Failure teardown is scoped to handles created by this fixture, never
      // names or host-wide process searches. ESRCH alone is a benign race.
      if (!identities && existsSync(f.pidFile)) identities = readJson(f.pidFile);
      if (identities?.child) killFixture(-identities.child);
      if (scenario === "detached" && identities?.background) killFixture(-identities.background);
      killFixture(-driver.pid);
      killFixture(-sentinel.child.pid);
      await Promise.all([driverExit, sentinel.exit]);
      await assertGone(sentinel.child.pid);
    }
  });
}

for (const phase of ["preflight", "execution", "postdoctor"]) {
  for (const identity of ["config", "installed-root", "codex-home", "home", "launcher-root", "cxc-launcher", "codex-launcher"]) {
    test(`record refuses ${phase} same-byte ${identity} replacement`, darwinOnly, async t => {
      const f = recordFixture(t, `${phase}-same-byte-${identity}`);
      const configBefore = readFileSync(f.config), dispatcherBefore = readFileSync(f.dispatcher);
      if (phase === "preflight") {
        await assert.rejects(() => record(f.spec), /symlinked path refused/);
        assertNoExec(f);
      } else {
        const result = await record(f.spec), run = recordReport(f);
        assert.equal(result.ok, false);
        assert.equal(run.outcome.rc, 0, "successful fake inference must reach identity revalidation");
        assert.equal(run.postflightError, true);
        assertVerdict(() => analyzeRun(result.out), 1);
        assert.equal(existsSync(join(result.out, "doctor-after.json")), phase === "postdoctor");
        // Read bytes deliberately through the link: matching content must not
        // make a replaced path acceptable to the recorder's snapshot.
        assert.equal(sha(readFileSync(f.config)), run.before.config);
        assert.equal(sha(readFileSync(f.cxcLauncher)), run.before.cxcLauncher);
        assert.equal(sha(readFileSync(join(f.home, "probe-bin/codex"))), run.before.codexLauncher);
      }
      assert.equal(lstatSync(f.identities[identity]).isSymbolicLink(), true);
      assert.deepEqual(readFileSync(f.config), configBefore);
      assert.deepEqual(readFileSync(f.dispatcher), dispatcherBefore);
      assert.equal(existsSync(f.linkedMarker), false);
      assert.equal(existsSync(f.candidateMarker), false);
      assert.equal(existsSync(f.postflightMarker), phase === "postdoctor",
        "execution replacements must block the second dispatcher, despite identical bytes");
      assert.equal(readFileSync(f.doctorLog, "utf8"), phase === "postdoctor" ? "doctor\ndoctor\n" : "doctor\n");
    });
  }
}
