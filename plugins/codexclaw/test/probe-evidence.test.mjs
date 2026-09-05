// 021 §§4–5: synthetic evidence and private subprocess fixtures, never live models.
// Intentionally one test owner: the approved write scope excludes fixture modules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { conversationDigest, pointer, analyzeRun, analyzeBench, verdict } from "../scripts/probe-evidence.mjs";
import { execArgs, probeEnv, payloadDigest, record, runOwned } from "../scripts/probe-recorder.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const recorderUrl = pathToFileURL(join(pluginRoot, "scripts/probe-recorder.mjs")).href;
const benchmark = join(pluginRoot, "scripts/hook-bench.mjs");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const jsonl = rows => rows.map(row => JSON.stringify(row)).join("\n") + "\n";
const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const checks = ["manifest", "hooks", "hook-trust", "install-root"];
const doctorReport = () => ({ checks: checks.map(name => ({ name, severity: "PASS" })) });
const runtimeRows = (id = "abc") => [
  { type: "session_meta", payload: { id } },
  { type: "turn_context", model: "gpt-6-astra", effort: "high" },
];

function tempRoot(t, prefix = "cxc-proof-") {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function put(root, file, value, mode = 0o600) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, value, { mode });
  return path;
}

const putJson = (root, file, value) => put(root, file, JSON.stringify(value));

function fixture(t) {
  const root = tempRoot(t);
  const row = {
    cid: "ba7816bf8f01cfea414140de5dae2223", requestId: "request-one",
    requestedModel: "gpt-6-astra", resolvedModel: "gpt-6-astra", requestedEffort: "high",
    requestedServiceTier: "priority", canonical: "priority", wireKind: "service-tier",
    wireValue: "priority", fastOutcome: "applied", confirmation: "assumed", responseServiceTier: "default",
  };
  const files = {
    "stdout.jsonl": jsonl([{ type: "thread.started", thread_id: "abc" }, { type: "turn.completed" }]),
    "stderr.log": "", "final.txt": "SYNTHETIC_FIXTURE_OK\n",
    "doctor-before.json": JSON.stringify(doctorReport()), "doctor-after.json": JSON.stringify(doctorReport()),
  };
  for (const [name, text] of Object.entries(files)) put(root, name, text);
  const run = {
    schemaVersion: 1, outcome: { rc: 0 }, before: { config: "a", payload: "b" }, after: { config: "a", payload: "b" },
    beforeDoctor: { selectedChecks: "PASS" }, afterDoctor: { selectedChecks: "PASS" },
    requested: { model: "gpt-6-astra", effort: "high", serviceTier: "priority" },
    files: Object.fromEntries(Object.entries(files).map(([name, text]) => [name, sha(text)])),
  };
  const runtime = jsonl(runtimeRows());
  put(root, "evidence/parent.jsonl", runtime);
  put(root, "evidence/usage.jsonl", jsonl([row]));
  put(root, "evidence/id.ts", "fixture-id-source");
  put(root, "evidence/tier.ts", "fixture-tier-source");
  const proof = {
    schemaVersion: 1,
    sources: { parent: { file: "evidence/parent.jsonl", sha256: sha(runtime) },
      usage: { file: "evidence/usage.jsonl", sha256: sha(jsonl([row])) } },
    sessions: [{ id: "abc", role: "parent", source: "parent" }],
    runtimePointers: { model: "/model", effort: "/effort" }, usageSource: "usage",
    usagePointers: { ...Object.fromEntries(Object.keys(row).filter(k => k !== "cid").map(k => [k, "/" + k])), conversationId: "/cid" },
    adapterAudit: { reviewedBy: "main", sourceSha: "a".repeat(40), normalization: "sha256(trim).hex.slice(0,32)",
      knownResponseEchoLimitation: true, files: [
        { file: "evidence/id.ts", sha256: sha("fixture-id-source") },
        { file: "evidence/tier.ts", sha256: sha("fixture-tier-source") },
      ] },
  };
  putJson(root, "run.json", run);
  putJson(root, "proof.json", proof);
  return { root, row, proof, run };
}

function setSource(f, key, rows) {
  const text = jsonl(rows);
  put(f.root, f.proof.sources[key].file, text);
  f.proof.sources[key].sha256 = sha(text); // independent node:crypto oracle
  putJson(f.root, "proof.json", f.proof);
}

function setArtifact(f, name, text) {
  put(f.root, name, text);
  f.run.files[name] = sha(text);
  putJson(f.root, "run.json", f.run);
}

function assertVerdict(action, rc) {
  const result = verdict(action);
  assert.equal(result.rc, rc, JSON.stringify(result));
  assert.equal(result.report.state, ["eligible-for-review", "failed", "unknown"][rc]);
  if (rc !== 0) {
    assert.equal(result.report.pairedComparisonEligible, undefined);
    assert.equal(result.report.comparison, undefined);
  }
  return result;
}

test("thread correlation is the exact trimmed SHA-256 prefix, not raw ID equality", () => {
  assert.equal(conversationDigest(" abc \n"), "ba7816bf8f01cfea414140de5dae2223");
});

test("JSON Pointer resolves escaped keys; missing proof is UNKNOWN", () => {
  assert.equal(pointer({ "a/b": { "~x": 3 } }, "/a~1b/~0x"), 3);
  assertVerdict(() => pointer({}, "/missing"), 2);
});

for (const echo of ["default", "priority", undefined]) {
  test(`configured priority with response echo ${echo} never confirms scheduling`, t => {
    const f = fixture(t);
    if (echo === undefined) delete f.row.responseServiceTier;
    else f.row.responseServiceTier = echo;
    setSource(f, "usage", [f.row]);
    const result = assertVerdict(() => analyzeRun(f.root), 0).report;
    assert.equal(result.eligibility, "configured-priority-only");
    assert.equal(result.schedulerConfirmation, "unknown");
    assert.equal(result.confirmedFastPerformanceClaim, false);
    assert.equal(result.pairedComparisonEligible, true);
    assert.equal(result.hookInvocationCount, null);
    assert.equal(result.sessions[0].requests[0].responseServiceTier, echo ?? null);
    assert.equal(result.sessions[0].requests[0].fastOutcome, "applied");
    assert.equal(result.sessions[0].requests[0].confirmation, "assumed");
    assert.equal(result.sessions[0].requests[0].schedulerConfirmation, "unknown");
  });
}

test("absent echo and limitation flag are not eligibility gates", t => {
  const f = fixture(t);
  delete f.row.responseServiceTier;
  delete f.proof.adapterAudit.knownResponseEchoLimitation;
  setSource(f, "usage", [f.row]);
  const result = assertVerdict(() => analyzeRun(f.root), 0).report;
  assert.equal(result.sessions[0].requests[0].responseServiceTier, null);
  assert.equal(result.schedulerConfirmation, "unknown");
  assert.equal(result.hookInvocationCount, null);
});

for (const field of ["requestId", "wireValue", "requestedEffort"]) {
  test(`missing usage ${field} is UNKNOWN despite exact requested config`, t => {
    const f = fixture(t);
    delete f.row[field];
    setSource(f, "usage", [f.row]);
    assertVerdict(() => analyzeRun(f.root), 2);
  });
}

for (const field of ["requestedModel", "resolvedModel", "requestedEffort", "requestedServiceTier", "canonical", "wireKind", "wireValue"]) {
  test(`contradictory usage ${field} is FAILED`, t => {
    const f = fixture(t);
    setSource(f, "usage", [{ ...f.row, [field]: "different" }]);
    assertVerdict(() => analyzeRun(f.root), 1);
  });
}

test("every digest-matched request is checked, including a bad first row", t => {
  const f = fixture(t);
  setSource(f, "usage", [{ ...f.row, wireValue: "default" }, { ...f.row, requestId: "request-two" }]);
  assertVerdict(() => analyzeRun(f.root), 1);
});

test("duplicate request IDs fail, unrelated digest cannot substitute", t => {
  const f = fixture(t);
  setSource(f, "usage", [f.row, { ...f.row }]);
  assertVerdict(() => analyzeRun(f.root), 1);
  setSource(f, "usage", [{ ...f.row, cid: "unrelated" }]);
  assertVerdict(() => analyzeRun(f.root), 2);
});

test("two matching requests retain individual IDs, source lines and raw response categories", t => {
  const f = fixture(t);
  setSource(f, "usage", [
    { ...f.row, cid: "unrelated", resolvedModel: "irrelevant" }, f.row,
    { ...f.row, requestId: "request-two", responseServiceTier: "priority", confirmation: "different-category" },
  ]);
  const requests = analyzeRun(f.root).sessions[0].requests;
  assert.deepEqual(requests.map(r => [r.requestId, r.line, r.responseServiceTier, r.confirmation]), [
    ["request-one", 2, "default", "assumed"], ["request-two", 3, "priority", "different-category"],
  ]);
});

test("missing proof.json is UNKNOWN without changing transport evidence", t => {
  const f = fixture(t);
  const before = readFileSync(join(f.root, "stdout.jsonl"));
  rmSync(join(f.root, "proof.json"));
  assertVerdict(() => analyzeRun(f.root), 2);
  assert.deepEqual(readFileSync(join(f.root, "stdout.jsonl")), before);
  assert.equal(readJson(join(f.root, "run.json")).outcome.rc, 0);
});

test("missing adapter binding cannot manufacture configured proof", t => {
  const f = fixture(t);
  delete f.proof.adapterAudit;
  putJson(f.root, "proof.json", f.proof);
  assertVerdict(() => analyzeRun(f.root), 2);
});

test("changed captured bytes fail at the integrity boundary", t => {
  const f = fixture(t);
  put(f.root, "stdout.jsonl", "not-json\n");
  assert.throws(() => analyzeRun(f.root), /captured artifact digest mismatch/);
  assertVerdict(() => analyzeRun(f.root), 1);
});

for (const [name, text, error] of [
  ["malformed JSONL", '{"type":\n', /malformed JSONL at line 1/],
  ["no completion", jsonl([{ type: "thread.started", thread_id: "abc" }]), /CLI completion missing/],
  ["no thread", jsonl([{ type: "turn.completed" }]), /missing\/ambiguous CLI thread/],
  ["turn failure", jsonl([{ type: "thread.started", thread_id: "abc" }, { type: "turn.failed" }]), /CLI reported failure/],
]) {
  test(`valid-hash stdout with ${name} reaches parser/transport rejection`, t => {
    const f = fixture(t);
    setArtifact(f, "stdout.jsonl", text);
    assert.throws(() => analyzeRun(f.root), error);
    assertVerdict(() => analyzeRun(f.root), 1);
  });
}

for (const field of ["model", "effort"]) {
  test(`second turn_context ${field} conflict fails despite valid first context`, t => {
    const f = fixture(t);
    setSource(f, "parent", [...runtimeRows(), { ...runtimeRows()[1], [field]: "different" }]);
    assert.throws(() => analyzeRun(f.root), new RegExp(`effective ${field} mismatch`));
    assertVerdict(() => analyzeRun(f.root), 1);
  });
  test(`missing runtime ${field} is UNKNOWN, not inferred from argv`, t => {
    const f = fixture(t);
    const rows = runtimeRows();
    delete rows[1][field];
    setSource(f, "parent", rows);
    assertVerdict(() => analyzeRun(f.root), 2);
  });
}

test("child sessions require their own effective runtime and exact joined usage", t => {
  const f = fixture(t);
  f.proof.sessions.push({ id: "child", role: "child", source: "child" });
  f.proof.sources.child = { file: "evidence/child.jsonl" };
  setSource(f, "child", runtimeRows("child"));
  const childRow = { ...f.row, cid: sha("child").slice(0, 32), requestId: "child-request" };
  setSource(f, "usage", [f.row, childRow]);
  assert.deepEqual(analyzeRun(f.root).sessions.map(s => [s.id, s.effectiveLines]), [["abc", [2]], ["child", [2]]]);
  setSource(f, "child", [...runtimeRows("child"), { ...runtimeRows()[1], effort: "low" }]);
  assertVerdict(() => analyzeRun(f.root), 1);
});

test("escaping proof path fails before external content can appear in a report", t => {
  const f = fixture(t);
  const outside = tempRoot(t, "cxc-external-proof-");
  const secret = "TEST_ONLY_EXTERNAL_CONTENT_DO_NOT_REPORT";
  const target = put(outside, "proof.jsonl", jsonl([{ secret }]));
  f.proof.sources.usage = { file: relative(f.root, target), sha256: sha(readFileSync(target)) };
  putJson(f.root, "proof.json", f.proof);
  assert.throws(() => analyzeRun(f.root), /artifact escapes output root/);
  assert.ok(!JSON.stringify(assertVerdict(() => analyzeRun(f.root), 1)).includes(secret));
});

for (const outcome of [{ rc: 7 }, { rc: 0, signal: "SIGTERM" }, { rc: 0, interruption: "timeout" }, { rc: 0, spawnError: "ENOENT" }]) {
  test(`failed transport cannot pass: ${JSON.stringify(outcome)}`, t => {
    const f = fixture(t);
    f.run.outcome = outcome;
    putJson(f.root, "run.json", f.run);
    assertVerdict(() => analyzeRun(f.root), 1);
  });
}

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
    assert.ok(env.CODEXCLAW_CXC.includes("/fixture/plugin/bin/cxc.mjs"));
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
  symlinkSync(target, join(root, "nested/link"));
  assert.throws(() => payloadDigest(root), /payload symlink/);
  assert.equal(readFileSync(target, "utf8"), "untouched");
});

function bench() {
  return { schemaVersion: 1, platform: "darwin", release: "fixture", nodeVersion: "v24-fixture", harnessSha256: "same",
    iterations: 3, hooks: [{ name: "guard", event: "PreToolUse", aboveFloorMs: 10,
      errorCount: 0, invocations: 3, stdoutBytes: 0, stderrBytes: 0 }] };
}

test("compatible benchmark reports are eligible only for synthetic replay", () => {
  assert.equal(assertVerdict(() => analyzeBench(bench(), bench(), 10), 0).report.scope, "synthetic-replay-only");
});

for (const field of ["platform", "release", "nodeVersion", "harnessSha256", "iterations"]) {
  test(`incompatible benchmark ${field} is UNKNOWN without a percentage claim`, () => {
    const after = bench();
    after[field] = field === "iterations" ? 4 : "different";
    assertVerdict(() => analyzeBench(bench(), after, 10), 2);
  });
}

for (const floor of [null, 0, -1]) {
  test(`benchmark floor ${floor} is UNKNOWN`, () => {
    const after = bench();
    after.hooks[0].aboveFloorMs = floor;
    assertVerdict(() => analyzeBench(bench(), after, 10), 2);
  });
}

test("one iteration cannot claim warm performance even on matching hosts", () => {
  const before = bench(), after = bench();
  before.iterations = after.iterations = 1;
  before.hooks[0].invocations = after.hooks[0].invocations = 1;
  assertVerdict(() => analyzeBench(before, after, 10), 2);
});

for (const [name, mutate] of [
  ["invocation errors", b => { b.hooks[0].errorCount = 1; }],
  ["missing error count", b => { delete b.hooks[0].errorCount; }],
  ["duplicate keys", b => { b.hooks.push({ ...b.hooks[0] }); }],
  ["added hook", b => { b.hooks.push({ ...b.hooks[0], name: "added" }); }],
  ["empty inventory", b => { b.hooks = []; }],
  ["wrong invocation count", b => { b.hooks[0].invocations = 2; }],
]) {
  test(`benchmark ${name} is FAILED`, () => {
    const after = bench();
    mutate(after);
    assertVerdict(() => analyzeBench(bench(), after, 10), 1);
  });
}

test("missing baseline hook fails even when the remaining hook improves", () => {
  const before = bench(), after = bench();
  before.hooks.push({ ...before.hooks[0], name: "removed" });
  after.hooks[0].aboveFloorMs = 1;
  assert.throws(() => analyzeBench(before, after, 10), /per-hook regression or missing hook/);
  assertVerdict(() => analyzeBench(before, after, 10), 1);
});

test("one hook regression fails despite a larger improvement elsewhere", () => {
  const before = bench(), after = bench();
  before.hooks.push({ ...before.hooks[0], name: "other", aboveFloorMs: 100 });
  after.hooks.push({ ...after.hooks[0], name: "other", aboveFloorMs: 1 });
  after.hooks[0].aboveFloorMs = 12;
  assertVerdict(() => analyzeBench(before, after, 10), 1);
});

function isolatedEnv(root) {
  const home = join(root, "home");
  mkdirSync(join(home, ".codex"), { recursive: true });
  mkdirSync(join(home, "tmp"), { recursive: true });
  return { PATH: [dirname(process.execPath), "/usr/bin", "/bin"].join(":"),
    HOME: home, USERPROFILE: home, CODEX_HOME: join(home, ".codex"),
    CODEX_SQLITE_HOME: join(home, ".codex"), TMPDIR: join(home, "tmp"), LANG: "en_US.UTF-8" };
}

function syncNode(args, root, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root, env: isolatedEnv(root), encoding: "utf8", timeout: 20000, ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

function benchmarkFixture(t, body = 'process.stdout.write("{}\\n");') {
  const root = tempRoot(t, "cxc-bench-payload-");
  putJson(root, ".codex-plugin/plugin.json", { name: "fixture", version: "1.0.0", hooks: ["./hooks/fixture.json"] });
  putJson(root, "hooks/fixture.json", { hooks: { PreToolUse: [{ hooks: [{ type: "command",
    command: 'node "${PLUGIN_ROOT}/entry.mjs"', timeout: 2 }] }] } });
  put(root, "entry.mjs", body);
  return root;
}

test("alternate plugin roots select fixture commands, preserve harness hash and count raw bytes", t => {
  const roots = [benchmarkFixture(t), benchmarkFixture(t)];
  const reports = roots.map(root => {
    const result = syncNode([benchmark, "--plugin-root", root, "--iterations", "2", "--json"], root);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.pluginRoot, root);
    assert.equal(report.hooks.length, 1);
    assert.equal(report.hooks[0].command, `node "${root}/entry.mjs"`);
    assert.equal(report.hooks[0].invocations, 2);
    assert.equal(report.hooks[0].errorCount, 0);
    assert.equal(report.hooks[0].stdoutBytes, 6);
    assert.equal(report.hooks[0].stderrBytes, 0);
    return report;
  });
  assert.equal(reports[0].harnessSha256, sha(readFileSync(benchmark)));
  assert.equal(reports[0].harnessSha256, reports[1].harnessSha256);
});

test("benchmark nonzero hook exits cannot become analyzer success through a zero controller exit", t => {
  const root = benchmarkFixture(t, 'process.stderr.write("fixture-error\\n"); process.exitCode = 3;');
  const result = syncNode([benchmark, "--plugin-root", root, "--iterations", "2", "--json"], root);
  assert.equal(result.status, 0, "legacy controller returns zero; the report must expose failure");
  const after = JSON.parse(result.stdout);
  assert.equal(after.hooks[0].errorCount, 2);
  assert.equal(after.hooks[0].stderrBytes, 28);
  assert.equal(after.hooks[0].stdoutBytes, 0);
  // A synthetic compatible baseline avoids noisy real floor timings preempting
  // the after-report error guard. No timing here is presented as measured proof.
  const before = { schemaVersion: 1, platform: after.platform, release: after.release,
    nodeVersion: after.nodeVersion, harnessSha256: after.harnessSha256, iterations: 2,
    hooks: [{ name: "fixture", event: "PreToolUse", aboveFloorMs: 10,
      errorCount: 0, invocations: 2, stdoutBytes: 6, stderrBytes: 0 }] };
  assert.throws(() => analyzeBench(before, after, 10), /hook invocation failed/);
  assertVerdict(() => analyzeBench(before, after, 10), 1);
});

for (const missing of ["argument", "manifest hook file"]) {
  test(`benchmark rejects missing ${missing} without emitting a valid report`, t => {
    const root = benchmarkFixture(t);
    if (missing === "manifest hook file") rmSync(join(root, "hooks/fixture.json"));
    const args = missing === "argument" ? [benchmark, "--json", "--plugin-root"]
      : [benchmark, "--plugin-root", root, "--iterations", "2", "--json"];
    const result = syncNode(args, root);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout.trim(), "");
    assert.match(result.stderr, missing === "argument" ? /requires a directory/ : /missing manifest hook file/);
  });
}

// These script bodies are written only under each test's canonical temp root.
// The fake dispatcher and Codex never read shared settings or invoke a provider.
function fakeDispatcher() {
  const args = process.argv.slice(2);
  if (args[0] === "probe-dispatch") {
    appendFileSync(f.candidateMarker, "candidate\n");
    process.exit(0);
  }
  if (JSON.stringify(args) !== JSON.stringify(["doctor", "--json"])) process.exit(91);
  appendFileSync(f.doctorLog, "doctor\n");
  const count = readFileSync(f.doctorLog, "utf8").trim().split("\n").length;
  const checks = ["manifest", "hooks", "hook-trust", "install-root"].map(name => ({ name, severity: "PASS" }));
  if (f.scenario === "trust-warn") checks[2].severity = "WARN";
  if (!existsSync(f.dist)) checks[1].severity = "FAIL";
  process.stdout.write(JSON.stringify({ checks }) + "\n");
  if (count === 1 && f.scenario.startsWith("predoctor-")) {
    const target = { "predoctor-config": f.config, "predoctor-payload": f.dist, "predoctor-launcher": f.cxcLauncher }[f.scenario];
    appendFileSync(target, "\n// initial doctor drift\n");
  }
  if (f.scenario === "postdoctor-mutation" && count === 2) appendFileSync(f.config, "# postdoctor drift\n");
}

async function fakeCodex() {
  const args = process.argv.slice(2);
  const expected = ["exec", "-m", "gpt-6-astra", "-c", 'model_reasoning_effort="high"',
    "-c", 'service_tier="priority"', "--dangerously-bypass-approvals-and-sandbox", "--json", "-o", f.final];
  if (JSON.stringify(args) !== JSON.stringify(expected)) process.exit(92);
  let prompt = "";
  for await (const chunk of process.stdin) prompt += chunk;
  if (prompt !== "Harmless synthetic fixture.\n") process.exit(93);
  appendFileSync(f.execMarker, "exec\n");
  if (f.scenario === "dispatch") {
    const resolution = spawnSync("/bin/sh", ["-c", "command -v cxc; command -v codex"], { encoding: "utf8" });
    if (resolution.error || resolution.status !== 0) process.exit(94);
    writeFileSync(f.resolution, resolution.stdout);
    const child = spawnSync("cxc", ["probe-dispatch"], { encoding: "utf8" });
    if (child.error || child.status !== 0) process.exit(95);
  }
  if (f.scenario === "payload-symlink") {
    unlinkSync(f.dispatcher);
    symlinkSync(f.externalDispatcher, f.dispatcher);
  }
  if (f.scenario === "config-drift") appendFileSync(f.config, "# execution drift\n");
  if (f.scenario === "launcher-drift") appendFileSync(f.cxcLauncher, "# execution drift\n");
  writeFileSync(f.final, "SYNTHETIC_FIXTURE_OK\n", { mode: 0o600 });
  process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "abc" }) + "\n");
  process.stdout.write(JSON.stringify({ type: "turn.completed" }) + "\n");
}

function scriptSource(f, fn) {
  return `#!${process.execPath}\nimport { appendFileSync, existsSync, readFileSync, writeFileSync, unlinkSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
const f = ${JSON.stringify(f)};
await (${fn.toString()})();\n`;
}

function cleanGitFixture(root) {
  const source = join(root, "source");
  put(source, "fixture.txt", "synthetic source identity\n");
  const env = { ...isolatedEnv(root), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z" };
  const git = args => {
    const result = spawnSync("/usr/bin/git", args, { cwd: source, env, encoding: "utf8", timeout: 10000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "--quiet"]);
  git(["add", "fixture.txt"]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "fixture"]);
  assert.equal(git(["status", "--porcelain"]), "");
  return { sourceRoot: source, sourceSha: git(["rev-parse", "HEAD"]) };
}

function recordFixture(t, scenario = "success") {
  assert.equal(process.platform, "darwin", "021 macOS integration requires macmini; do not silently skip");
  const base = tempRoot(t, "cxc-record-");
  const root = join(base, "run");
  const home = join(root, "home"), installed = join(home, ".codex/plugins/cache/codexclaw/fixture");
  const f = { scenario, root, installed, home, dispatcher: join(installed, "bin/cxc.mjs"),
    dist: join(installed, "components/fixture/dist/cli.js"), config: join(home, ".codex/config.toml"),
    cxcLauncher: join(home, "probe-bin/cxc"), final: join(root, "output/final.txt"),
    execMarker: join(base, "exec.marker"), doctorLog: join(base, "doctor.log"),
    candidateMarker: join(base, "candidate.marker"), foreignMarker: join(base, "foreign.marker"),
    linkedMarker: join(base, "linked.marker"), externalDispatcher: join(base, "external.mjs"),
    resolution: join(base, "resolution.txt") };
  mkdirSync(join(root, "work"), { recursive: true });
  put(root, "home/.codex/config.toml", "# isolated synthetic config\n");
  put(root, "prompt.txt", "Harmless synthetic fixture.\n");
  put(root, "approval.md", "Synthetic fixture only; no real approval or model evidence.\n");
  const version = "1.0.0+codex.fixture-one";
  putJson(installed, ".codex-plugin/plugin.json", { name: "codexclaw", version });
  put(installed, "components/fixture/dist/cli.js", "// fixture dist\n");
  put(installed, "bin/cxc.mjs", scriptSource(f, fakeDispatcher));
  put(base, "external.mjs", `import {writeFileSync} from "node:fs";
writeFileSync(${JSON.stringify(f.linkedMarker)}, "executed");
process.stdout.write(${JSON.stringify(JSON.stringify(doctorReport()))});\n`);
  const codexBin = put(base, "fake-codex.mjs", scriptSource(f, fakeCodex), 0o700);
  putJson(root, "install.json", { installedPath: installed });
  const spec = { schemaVersion: 1, candidate: "fixture", root, ...cleanGitFixture(base),
    codexBin, expectedVersion: version, serviceTier: "priority" };
  return { ...f, base, spec };
}

function recordReport(f) {
  return readJson(join(f.root, "output/run.json"));
}

function assertNoExec(f) {
  assert.equal(existsSync(f.execMarker), false, "preflight must stop before fake Codex executes");
}

test("record accepts a clean isolated fixture exactly once and persists private identity artifacts", async t => {
  const f = recordFixture(t);
  const result = await record(f.spec);
  assert.equal(result.ok, true);
  assert.equal(result.out, join(f.root, "output"));
  assert.equal(readFileSync(f.execMarker, "utf8"), "exec\n");
  assert.equal(readFileSync(f.doctorLog, "utf8"), "doctor\ndoctor\n");
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
  test(`record preflight refuses ${name} before inference`, async t => {
    const f = recordFixture(t, name === "trust WARN" ? "trust-warn" : "success");
    mutate(f);
    await assert.rejects(() => record(f.spec), expected);
    assertNoExec(f);
  });
}

test("record persists an explicit maximum timeout without waiting for it", async t => {
  const f = recordFixture(t);
  f.spec.timeoutMs = 600000;
  assert.equal((await record(f.spec)).ok, true);
  assert.equal(recordReport(f).timeoutMs, 600000);
});

test("record refuses a symlinked dispatcher before doctor can execute its valid-looking target", async t => {
  const f = recordFixture(t);
  rmSync(f.dispatcher);
  symlinkSync(f.externalDispatcher, f.dispatcher);
  await assert.rejects(() => record(f.spec), /payload symlink/);
  assert.equal(existsSync(f.linkedMarker), false);
  assert.equal(existsSync(f.doctorLog), false);
  assertNoExec(f);
});

for (const identity of ["config", "payload", "launcher"]) {
  test(`initial doctor ${identity} mutation is rejected before inference`, async t => {
    const f = recordFixture(t, `predoctor-${identity}`);
    await assert.rejects(() => record(f.spec), /identity changed during preflight doctor/);
    assert.equal(readFileSync(f.doctorLog, "utf8"), "doctor\n");
    assert.deepEqual(readJson(join(f.root, "output/doctor-before.json")), doctorReport());
    assertNoExec(f);
  });
}

for (const scenario of ["payload-symlink", "config-drift", "launcher-drift", "postdoctor-mutation"]) {
  test(`record detects ${scenario} and analyzer fails before missing postflight proof`, async t => {
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

test("hostile global cxc is never selected; actual child resolution and launcher hashes bind candidate", async t => {
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

test("runOwned retains separate exact stdout/stderr bytes and nonzero exit status", async t => {
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

// A separate driver receives cancellation, so a regression cannot signal the
// node:test runner. Socket readiness + IPC is the barrier, not a sleep/retry.
async function ownedChildFixture() {
  const { spawn } = await import("node:child_process");
  const { createConnection } = await import("node:net");
  const { writeFileSync } = await import("node:fs");
  let background;
  if (f.scenario === "timeout") process.on("SIGTERM", () => {});
  if (f.scenario !== "timeout") {
    background = spawn(process.execPath, ["-e", 'process.stdout.write("READY\\n"); setInterval(() => {}, 1000);'], {
      detached: f.scenario === "detached", stdio: ["ignore", "pipe", "inherit"],
    });
    background.on("error", error => { console.error(error); process.exit(97); });
    if (f.scenario === "cancel") {
      process.on("SIGTERM", () => {});
      background.on("exit", () => process.exit(0)); // reap before leader exits
    }
  }
  const identities = { child: process.pid, background: background?.pid ?? null };
  writeFileSync(f.pidFile, JSON.stringify(identities));
  if (background) {
    await new Promise((resolveReady, rejectReady) => {
      let output = "";
      background.stdout.on("data", chunk => { output += chunk; if (output === "READY\n") resolveReady(); });
      background.once("error", rejectReady);
      background.once("exit", () => rejectReady(new Error("background exited before readiness")));
    });
  }
  const socket = createConnection({ host: "127.0.0.1", port: f.port });
  socket.on("error", error => { console.error(error); process.exit(98); });
  socket.on("connect", () => socket.write(JSON.stringify(identities) + "\n"));
  socket.on("close", () => {
    if (f.scenario === "detached" || f.scenario === "completion") process.exit(0);
  });
  setInterval(() => {}, 1000);
}

async function lifecycleDriver() {
  const { createServer } = await import("node:net");
  const { openSync, closeSync } = await import("node:fs");
  const { runOwned } = await import(f.recorderUrl);
  const server = createServer(socket => {
    let data = "";
    socket.on("data", chunk => {
      data += chunk;
      if (!data.endsWith("\n")) return;
      process.send({ type: "ready", ...JSON.parse(data) });
      if (f.scenario === "completion" || f.scenario === "detached") {
        process.once("message", message => {
          if (message !== "release") throw new Error("unexpected lifecycle barrier message");
          socket.end();
        });
      } else socket.end();
    });
    socket.on("error", error => { throw error; });
  });
  await new Promise((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const childConfig = { scenario: f.scenario, port: server.address().port, pidFile: f.pidFile };
  const code = `const f = ${JSON.stringify(childConfig)}; await (${f.childSource})();`;
  const stdoutFd = openSync(f.stdout, "wx", 0o600), stderrFd = openSync(f.stderr, "wx", 0o600);
  try {
    const outcome = await runOwned({ bin: process.execPath, args: ["--input-type=module", "-e", code],
      cwd: f.root, env: process.env, prompt: "", timeoutMs: f.scenario === "timeout" ? 1000 : 8000,
      stdoutFd, stderrFd });
    await new Promise((resolveClosed, rejectClosed) => server.close(error => error ? rejectClosed(error) : resolveClosed()));
    process.send({ type: "result", outcome }, () => process.disconnect());
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }
}

function pidExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}

function killFixture(pid, signal = "SIGKILL") {
  assert.ok(Number.isInteger(pid) && Math.abs(pid) > 1, "only a recorded fixture PID/group may be signalled");
  try { process.kill(pid, signal); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
}

async function assertGone(pid) {
  const deadline = Date.now() + 3000;
  while (pidExists(pid) && Date.now() < deadline) await new Promise(resolveTurn => setImmediate(resolveTurn));
  assert.equal(pidExists(pid), false, `fixture PID/group ${pid} must be gone`);
}

function childExit(child) {
  return new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("close", (rc, signal) => resolveExit({ rc, signal }));
  });
}

function lifecycleMessages(child, onReady) {
  return new Promise((resolveResult, rejectResult) => {
    const watchdog = setTimeout(() => rejectResult(new Error("fixture watchdog: no lifecycle result within 12s")), 12000);
    const finish = (error, result) => {
      clearTimeout(watchdog);
      if (error) rejectResult(error); else resolveResult(result);
    };
    let ready;
    child.once("error", error => finish(error));
    child.once("exit", rc => finish(new Error(`lifecycle driver exited before result: ${rc}`)));
    child.on("message", message => {
      try {
        if (message.type === "ready") { ready = message; onReady(message); }
        if (message.type === "result") {
          assert.ok(ready, "real child readiness must precede its result");
          finish(null, { ...ready, outcome: message.outcome });
        }
      } catch (error) { finish(error); }
    });
  });
}

async function sentinelFixture(root) {
  const child = spawn(process.execPath, ["-e", 'process.send("ready"); setInterval(() => {}, 1000);'], {
    cwd: root, env: isolatedEnv(root), detached: true, stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  const exit = childExit(child);
  try {
    await new Promise((resolveReady, rejectReady) => {
      const watchdog = setTimeout(() => rejectReady(new Error("sentinel readiness timeout")), 5000);
      const finish = error => { clearTimeout(watchdog); if (error) rejectReady(error); else resolveReady(); };
      child.once("error", finish);
      child.once("message", message => {
        if (message !== "ready") finish(new Error("unexpected sentinel message")); else finish();
      });
    });
  } catch (error) {
    if (child.pid) killFixture(-child.pid);
    await exit;
    throw error;
  }
  return { child, exit };
}

for (const scenario of ["timeout", "cancel", "completion", "detached"]) {
  test(`runOwned ${scenario}: exact owned-group cleanup and explicit detached teardown`, { timeout: 25000 }, async t => {
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

function compiledHookFixture(t, hookFile) {
  const root = tempRoot(t, "cxc-compiled-hook-");
  const manifest = readJson(join(pluginRoot, ".codex-plugin/plugin.json"));
  const selected = manifest.hooks.find(path => path.replace(/^\.\//, "") === `hooks/${hookFile}`);
  assert.ok(selected, `hook must be selected by actual manifest: ${hookFile}`);
  const hook = readJson(join(pluginRoot, selected));
  const groups = hook.hooks.PreToolUse;
  assert.equal(groups.length, 1);
  assert.equal(groups[0].hooks.length, 1);
  const command = groups[0].hooks[0].command;
  const match = /^node "\$\{PLUGIN_ROOT\}\/([^"]+)" hook (\S+)$/.exec(command);
  assert.ok(match, `unsupported manifest command: ${command}`);
  const installed = join(root, "home/.codex/plugins/cache/codexclaw/fixture");
  const source = join(pluginRoot, dirname(match[1]));
  const destination = join(installed, dirname(match[1]));
  mkdirSync(dirname(destination), { recursive: true });
  // Missing/partial dist is a hard failure, not a skip, retry or rebuild.
  cpSync(source, destination, { recursive: true });
  const entrypoint = join(installed, match[1]);
  assert.ok(existsSync(entrypoint), "compiled manifest entrypoint required");
  const skillBody = "# Installed synthetic dev skill\n\nFixture-specific instruction body 8317.\n";
  const skill = put(installed, "skills/dev/SKILL.md", skillBody);
  const cwd = join(root, "work");
  mkdirSync(cwd);
  return { root, installed, entrypoint, hookEvent: match[2], matcher: groups[0].matcher,
    skill, skillBody, cwd, env: isolatedEnv(root) };
}

function compiledOutput(f, payload) {
  const result = syncNode([f.entrypoint, "hook", f.hookEvent], f.root, {
    input: JSON.stringify(payload), env: f.env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "", "unexpected compiled-hook diagnostics must not be hidden");
  return result.stdout;
}

function spawnPayload(f, surface) {
  return { hook_event_name: "PreToolUse", session_id: "probe-spawn", cwd: f.cwd,
    tool_name: surface === "V1" ? "spawn_agent" : "collaborationspawn_agent",
    tool_input: { message: "$cxc-dev inspect the fixture", agent_type: "explorer",
      ...(surface === "V2" ? { task_name: "probe_leaf", fork_turns: "none" } : {}),
      probe_preserved: { nested: ["unchanged", 7] } } };
}

for (const surface of ["V1", "V2"]) {
  test(`compiled ${surface} manifest spawn delivers installed skill and preserves input without duplicate replay`, t => {
    const f = compiledHookFixture(t, "pre-tool-use-attaching-skills.json");
    const payload = spawnPayload(f, surface);
    assert.equal(new RegExp(f.matcher).test(payload.tool_name), true, "actual host-facing name must match manifest");
    const output = JSON.parse(compiledOutput(f, payload)).hookSpecificOutput;
    assert.equal(output.hookEventName, "PreToolUse");
    const ui = output.updatedInput;
    assert.ok(ui && typeof ui.message === "string");
    const guard = surface === "V1" ? "[CXC-SUBAGENT-SCOPE]" : "[CXC-LEAF-GUARD]";
    assert.ok(ui.message.startsWith(guard));
    assert.ok(ui.message.includes(`[$cxc-dev](skill://${realpathSync(f.skill)}) inspect the fixture`));
    assert.ok(ui.message.includes('<skill name="cxc-dev">'));
    assert.ok(ui.message.includes(f.skillBody.trim()), "body must come from the installed fixture, not the checkout");
    for (const [key, value] of Object.entries(payload.tool_input)) {
      if (key !== "message") assert.deepEqual(ui[key], value, key);
    }
    assert.equal(Object.hasOwn(ui, "items"), false, "do not invent native items transport");
    const replay = compiledOutput(f, { ...payload, tool_input: { ...payload.tool_input, message: ui.message } });
    // An idempotent hook may emit no update; otherwise guard/body cardinality is
    // checked on its effective message (V2 may append its self-load affordance).
    const replayed = replay.trim() ? JSON.parse(replay).hookSpecificOutput.updatedInput.message : ui.message;
    assert.equal(replayed.split(guard).length - 1, 1);
    assert.equal(replayed.split('<skill name="cxc-dev">').length - 1, 1);
    assert.equal(replayed.split(f.skillBody.trim()).length - 1, 1);
    assert.equal(compiledOutput(f, { ...payload, tool_name: "exec_command" }), "");
  });
}

test("compiled worktree guard denies self-deletion without executing it; benign command is allowed", t => {
  const f = compiledHookFixture(t, "pre-tool-use-guarding-managed-worktree-deletion.json");
  const checkout = join(f.env.CODEX_HOME, "worktrees/7627/fixture");
  put(checkout, ".git", "gitdir: /fake/main/.git/worktrees/7627\n");
  put(checkout, "preserve.txt", "untouched\n");
  const payload = { hook_event_name: "PreToolUse", session_id: "probe-worktree", cwd: checkout,
    tool_name: "Bash", tool_input: { command: `git worktree remove '${checkout}'` } };
  assert.equal(new RegExp(f.matcher).test(payload.tool_name), true);
  const out = JSON.parse(compiledOutput(f, payload)).hookSpecificOutput;
  assert.equal(out.hookEventName, "PreToolUse");
  assert.equal(out.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, /WORKTREE-GUARD-03/);
  assert.equal(typeof out.additionalContext, "string");
  assert.equal(compiledOutput(f, { ...payload, tool_input: { command: "git status" } }), "");
  assert.equal(readFileSync(join(checkout, "preserve.txt"), "utf8"), "untouched\n");
});

test("compiled goal-completion gate denies mid-cycle complete but allows blocked", t => {
  const f = compiledHookFixture(t, "pre-tool-use-guarding-goal-complete.json");
  putJson(f.cwd, ".codexclaw/sessions/probe-complete.json", {
    phase: "B", sessionId: "probe-complete", slug: "", updatedAt: "2026-01-01T00:00:00Z",
    flags: { interview: false, auditPassed: false, checkPassed: false }, supersededBy: null,
    injectedTurns: [], lastInjectedPhase: "B", orchestrationActive: true, interview: null,
    stopBlockPhase: null, stopBlockCount: 0,
  });
  const payload = { hook_event_name: "PreToolUse", session_id: "probe-complete", cwd: f.cwd,
    tool_name: "update_goal", tool_input: { status: "complete" } };
  assert.equal(new RegExp(f.matcher).test(payload.tool_name), true);
  const out = JSON.parse(compiledOutput(f, payload)).hookSpecificOutput;
  assert.equal(out.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, /GOAL-COMPLETE-GATE-01/);
  assert.equal(compiledOutput(f, { ...payload, tool_input: { status: "blocked" } }), "");
  assert.equal(readJson(join(f.cwd, ".codexclaw/sessions/probe-complete.json")).phase, "B");
});
