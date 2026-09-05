# 021 — wp1 recorder/analyzer complete proposed source

Status: PROPOSED code listings, not executed or installed. Dependency: [020](020_remote_evaluation.md).
Only this Markdown file is written in wp0. Main audits before extracting files in B.
All source paths below are relative to `/Users/jun/.codex/worktrees/974c/codexclaw`.

## 1. Run and evidence contracts

### Run spec, operator-provisioned, private, outside the source checkout

The following is a schema example, not a claim that these paths/version exist.
Replace sourceRoot, codexBin, sourceSha and expectedVersion with verified values.
`root` is a fresh real directory containing `home/.codex`, `work`, `prompt.txt`,
`approval.md`, and `install.json`. Work is a disposable fixture checkout.
Output must not exist. Auth is provisioned separately; no auth values go in spec.

```json
{
  "schemaVersion": 1,
  "candidate": "baseline",
  "root": "/Users/junny/cxc-probes/260905/baseline",
  "sourceRoot": "/ABSOLUTE/VERIFIED/CANDIDATE/SOURCE",
  "sourceSha": "REPLACE_WITH_EXACT_CLEAN_40_HEX_SHA",
  "codexBin": "/ABSOLUTE/VERIFIED/CODEX/BINARY",
  "expectedVersion": "REPLACE_WITH_FULL_MANIFEST_VERSION_INCLUDING_CACHEBUSTER",
  "serviceTier": "priority",
  "timeoutMs": 180000
}
```

`install.json` is the original installer JSON, not a hand-authored install receipt.
`approval.md` is main's scope/trust/input/source-to-payload and binary/schema review.
No automated trust grant is encoded in the spec. An approval note's existence/hash
is an audit breadcrumb, not cryptographic authorization.

Recorder outputs: `run.json`, `stdout.jsonl`, `stderr.log`, `final.txt`,
`doctor-before.json`, `doctor-before.stderr`, `doctor-after.json`,
`doctor-after.stderr`. Failure before exec may leave only doctor artifacts;
the recorder exits 2 and the analyzer reports an incomplete packet, never PASS.
Transport failure after spawn leaves run.json with rc/signal/interruption.
Raw stdout and stderr are never echoed to the console by either script.

### Additional evidence, supplied by main after local artifact inspection

Main copies only relevant original rollout/usage JSONL into `output/evidence/`,
retaining byte identity and private permissions. Do not append fields to real
events or relabel requested values as response values. The mapping below is our
offline manifest, **not a new Codex/OCX API**. Actual JSON Pointer strings must
come from the observed schema; deliberately no speculative live pointer defaults.

```json
{
  "schemaVersion": 1,
  "sources": {
    "parent": {"file":"evidence/parent.jsonl","sha256":"ACTUAL_SHA256"},
    "usage": {"file":"evidence/usage.jsonl","sha256":"ACTUAL_SHA256"}
  },
  "sessions": [
    {"id":"ACTUAL_CLI_THREAD_ID","role":"parent","source":"parent"}
  ],
  "runtimePointers": {"model":"ACTUAL_POINTER","effort":"ACTUAL_POINTER"},
  "usageSource": "usage",
  "usagePointers": {
    "conversationId":"ACTUAL_POINTER",
    "requestId":"ACTUAL_POINTER",
    "requestedModel":"ACTUAL_POINTER",
    "resolvedModel":"ACTUAL_POINTER",
    "requestedEffort":"ACTUAL_POINTER",
    "requestedServiceTier":"ACTUAL_POINTER",
    "canonical":"ACTUAL_POINTER",
    "wireKind":"ACTUAL_POINTER",
    "wireValue":"ACTUAL_POINTER",
    "fastOutcome":"ACTUAL_POINTER",
    "confirmation":"ACTUAL_POINTER",
    "responseServiceTier":"ACTUAL_POINTER"
  },
  "adapterAudit": {
    "reviewedBy":"main",
    "sourceSha":"EXACT_OCX_SOURCE_SHA",
    "normalization":"sha256(trim).hex.slice(0,32)",
    "knownResponseEchoLimitation":true,
    "files":[
      {"file":"evidence/request-log-conversation.ts","sha256":"ACTUAL_SHA256"},
      {"file":"evidence/fastwire.ts","sha256":"ACTUAL_SHA256"}
    ]
  }
}
```

Main verifies that the source snapshots belong to the OCX actually serving the
requests. The known non-authoritative/default echo is already reported by main;
do not investigate it again or require this diagnostic flag for eligibility.
Main also verifies the full child inventory; supplied session lists are not a
native discovery API. Include each child rollout and session, not just parent.
Known rollout event kinds `session_meta` and `turn_context` come from the existing
recall owner and the reported preflight; field pointers remain observed mappings.

Correlation is deterministic: `sha256(threadId.trim()).hex.slice(0,32)`.
Scan **all** usage rows with that conversation digest. Require unique nonempty
request IDs and validate every matched row, not the last row. If a particular
usage artifact lacks request IDs or has multiple incompatible schema shapes,
return UNKNOWN and obtain the exact request/metadata artifact. No timestamp-only,
model-name-only, fuzzy recent-row, or substring matching. The hash joins a
conversation, not an individual request; request IDs disambiguate rows within it.

Request model/effort/priority + resolved model + configured wire priority are
separate from scheduler confirmation. On the bound ChatGPT-internal Codex path,
response tier is non-authoritative. Keep raw `default`; do not infer a downgrade.
`fastOutcome=applied` + `confirmation=assumed` is **not confirmed scheduling**.
Analyzer can emit `configured-priority-only` eligibility after complete binding;
it never grants a confirmed-scheduling claim. A sample with applied+assumed,
priority wire and known default echo is eligible when exact digest/request,
model/effort and wire evidence match. Main may compare like-for-like
configured-priority runs with the limitation stated; the echo cannot block that
comparison. Source binding, request completeness and paired conditions are
independently reviewed, not hidden-scheduler confirmation.

Initial timeout defaults to 180000 ms, aligned with 010. An explicit spec may
select 1000–600000 ms; changing it between paired runs requires disclosure.
CLI 0.146 had no hook lifecycle events in the reported rollout: hook counts are
unknown, never zero, and not required for eligibility. Model behavior and raw
captured instruction bytes are valid bounded observables; synthetic replay stays
separate. No full-syscall-count or backend-scheduler gate is introduced.

Field chains: spec → recorder's sanitized run.json → analyzer requested checks;
stdout raw bytes → digest-bound JSONL → thread/termination checks;
original rollout/usage → hash-bound sources + pointers → exact runtime/wire checks;
adapter source snapshots → main audit + digest → non-authoritative response
interpretation. All reporting is offline; no production consumer or host gate.

## 2. NEW `plugins/codexclaw/scripts/probe-recorder.mjs`

Complete proposed file. No SSH, install, retrust, auth copying, resume, provider
fallback, or environment dump. macOS-only is intentional for the approved host.
The subprocess group is the resource ownership boundary, not a security sandbox.

```js
#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const digest = bytes => createHash("sha256").update(bytes).digest("hex");
export const fileDigest = file => digest(readFileSync(file));
const json = file => JSON.parse(readFileSync(file, "utf8"));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n", {flag:"wx", mode:0o600});
const inside = (root, file) => file.startsWith(root + sep);

function real(file) {
  if (!isAbsolute(file)) throw new Error("absolute path required");
  const path = realpathSync(file);
  if (path !== resolve(file)) throw new Error("symlinked path refused");
  return path;
}

export function payloadDigest(root) {
  const rows = [];
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error("payload symlink refused");
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) rows.push([relative(root, path), fileDigest(path)]);
      else throw new Error("non-file payload entry refused");
    }
  }
  walk(root);
  return digest(JSON.stringify(rows));
}

const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";

export function probeEnv(home, launchDir, pluginRoot) {
  return {
    PATH: [launchDir, dirname(process.execPath), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    CODEXCLAW_CXC: shellQuote(process.execPath) + " " + shellQuote(join(pluginRoot, "bin", "cxc.mjs")),
    LANG: "en_US.UTF-8", HOME: home, USERPROFILE: home,
    CODEX_HOME: join(home, ".codex"), CODEX_SQLITE_HOME: join(home, ".codex"),
    TMPDIR: join(home, "tmp"),
  };
}

export function execArgs(tier, finalPath) {
  if (tier !== "priority") throw new Error("only audited priority condition is supported");
  return ["exec", "-m", "gpt-6-astra", "-c", 'model_reasoning_effort="high"',
    "-c", 'service_tier="priority"', "--dangerously-bypass-approvals-and-sandbox",
    "--json", "-o", finalPath];
}

function cleanSource(root, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("exact source SHA required");
  for (const [args, expected] of [
    [["rev-parse", "HEAD"], sha], [["status", "--porcelain"], ""],
  ]) {
    const r = spawnSync("git", args, {cwd:root, encoding:"utf8", timeout:10000});
    if (r.status !== 0 || r.stdout.trim() !== expected) throw new Error("source identity mismatch or dirty source");
  }
}

function prepare(spec) {
  if (process.platform !== "darwin") throw new Error("physical macmini only");
  if (spec.schemaVersion !== 1 || !/^[a-z0-9-]+$/.test(spec.candidate || "")) throw new Error("invalid run spec");
  const root = real(spec.root), sourceRoot = real(spec.sourceRoot);
  if (root === sourceRoot || inside(sourceRoot, root)) throw new Error("run root must be outside source");
  const home = real(join(root, "home")), cwd = real(join(root, "work"));
  if (home === realpathSync(homedir())) throw new Error("shared HOME refused");
  const codexHome = real(join(home, ".codex"));
  real(join(codexHome, "config.toml"));
  real(join(root, "prompt.txt"));
  real(join(root, "approval.md"));
  const installed = json(real(join(root, "install.json")));
  const pluginRoot = real(installed.installedPath || installed.path || "");
  if (!inside(codexHome, pluginRoot)) throw new Error("installed root outside isolated CODEX_HOME");
  const manifest = json(join(pluginRoot, ".codex-plugin", "plugin.json"));
  if (manifest.name !== "codexclaw" || manifest.version !== spec.expectedVersion) throw new Error("manifest identity mismatch");
  const timeoutMs = spec.timeoutMs ?? 180000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) throw new Error("invalid timeout");
  execArgs(spec.serviceTier, "final.txt");
  cleanSource(sourceRoot, spec.sourceSha);
  const codexBin = realpathSync(spec.codexBin);
  if (!isAbsolute(spec.codexBin)) throw new Error("absolute Codex binary required");
  payloadDigest(pluginRoot); // reject nested links before executing any candidate code
  const launchDir = join(home, "probe-bin");
  mkdirSync(launchDir, {mode:0o700});
  const env = probeEnv(home, launchDir, pluginRoot);
  writeFileSync(join(launchDir, "cxc"), "#!/bin/sh\nexec " + env.CODEXCLAW_CXC + ' "$@"\n', {flag:"wx", mode:0o700});
  writeFileSync(join(launchDir, "codex"), "#!/bin/sh\nexec " + shellQuote(codexBin) + ' "$@"\n', {flag:"wx", mode:0o700});
  const out = join(root, "output");
  mkdirSync(out, {mode:0o700}); // exclusive; a failed run is never overwritten
  mkdirSync(join(home, "tmp"), {recursive:true, mode:0o700});
  return {root, sourceRoot, home, cwd, codexHome, pluginRoot, codexBin, launchDir, out, timeoutMs, env};
}

function doctor(p, label) {
  const r = spawnSync(process.execPath, [join(p.pluginRoot, "bin", "cxc.mjs"), "doctor", "--json"], {
    cwd:p.cwd, env:p.env, encoding:"utf8", timeout:30000, maxBuffer:16 * 1024 * 1024,
  });
  writeFileSync(join(p.out, `doctor-${label}.json`), r.stdout || "", {flag:"wx", mode:0o600});
  writeFileSync(join(p.out, `doctor-${label}.stderr`), r.stderr || "", {flag:"wx", mode:0o600});
  if (r.error || r.signal) throw new Error("doctor transport failure");
  const report = JSON.parse(r.stdout);
  for (const name of ["manifest", "hooks", "hook-trust", "install-root"]) {
    const matches = report.checks.filter(c => c.name === name);
    if (matches.length !== 1 || matches[0].severity !== "PASS") throw new Error(`doctor ${name} not PASS`);
  }
  return {rc:r.status, selectedChecks:"PASS"};
}

function snapshot(p) {
  return {config:fileDigest(join(p.codexHome, "config.toml")), payload:payloadDigest(p.pluginRoot),
    cxcLauncher:fileDigest(join(p.launchDir, "cxc")), codexLauncher:fileDigest(join(p.launchDir, "codex"))};
}

export function runOwned({bin, args, cwd, env, prompt, timeoutMs, stdoutFd, stderrFd}) {
  return new Promise(resolveRun => {
    const started = Date.now();
    const child = spawn(bin, args, {cwd, env, detached:true, stdio:["pipe", stdoutFd, stderrFd]});
    let interruption = null, spawnError = null, escalation;
    const signalGroup = signal => {
      if (!child.pid) return;
      try { process.kill(-child.pid, signal); } catch (error) {
        if (error.code !== "ESRCH") spawnError = error.code || "SIGNAL_ERROR";
      }
    };
    const stop = reason => {
      if (interruption) return;
      interruption = reason;
      signalGroup("SIGTERM");
      escalation = setTimeout(() => signalGroup("SIGKILL"), 3000);
    };
    const interrupt = () => stop("SIGINT"), terminate = () => stop("SIGTERM");
    process.once("SIGINT", interrupt); process.once("SIGTERM", terminate);
    const timer = setTimeout(() => stop("timeout"), timeoutMs);
    child.on("error", error => { spawnError = error.code || "SPAWN_ERROR"; });
    child.stdin.on("error", error => { if (error.code !== "EPIPE") stop("stdin-error"); });
    child.on("close", (rc, signal) => {
      signalGroup("SIGKILL"); // only descendants still in this owned process group
      clearTimeout(timer); clearTimeout(escalation);
      process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", terminate);
      resolveRun({rc, signal, interruption, spawnError, elapsedMs:Date.now() - started});
    });
    child.stdin.end(prompt);
  });
}

export async function record(spec) {
  const p = prepare(spec);
  const before = snapshot(p), beforeDoctor = doctor(p, "before");
  if (JSON.stringify(before) !== JSON.stringify(snapshot(p))) {
    throw new Error("identity changed during preflight doctor");
  }
  const prompt = readFileSync(join(p.root, "prompt.txt"));
  const finalPath = join(p.out, "final.txt"), args = execArgs(spec.serviceTier, finalPath);
  const stdoutFd = openSync(join(p.out, "stdout.jsonl"), "wx", 0o600);
  const stderrFd = openSync(join(p.out, "stderr.log"), "wx", 0o600);
  let outcome;
  try {
    outcome = await runOwned({bin:p.codexBin, args, cwd:p.cwd, env:p.env, prompt,
      timeoutMs:p.timeoutMs, stdoutFd, stderrFd});
  } finally { closeSync(stdoutFd); closeSync(stderrFd); }
  let afterDoctor, after, postflightError = false;
  try {
    after = snapshot(p);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("identity changed during run");
    afterDoctor = doctor(p, "after");
    after = snapshot(p);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("identity changed during doctor");
  }
  catch { postflightError = true; }
  const files = {};
  for (const name of ["stdout.jsonl", "stderr.log", "final.txt", "doctor-before.json",
    "doctor-before.stderr", "doctor-after.json", "doctor-after.stderr"]) {
    if (existsSync(join(p.out, name))) files[name] = fileDigest(join(p.out, name));
  }
  const report = {
    schemaVersion:1, candidate:spec.candidate, sourceSha:spec.sourceSha,
    pluginRoot:p.pluginRoot, version:spec.expectedVersion,
    codexBin:p.codexBin, codexSha256:fileDigest(p.codexBin),
    dispatch:{path:p.env.PATH, cxc:p.env.CODEXCLAW_CXC, launcherRoot:p.launchDir},
    recorderSha256:fileDigest(fileURLToPath(import.meta.url)),
    approvalSha256:fileDigest(join(p.root, "approval.md")),
    installSha256:fileDigest(join(p.root, "install.json")), promptSha256:digest(prompt),
    requested:{model:"gpt-6-astra", effort:"high", serviceTier:spec.serviceTier},
    args, timeoutMs:p.timeoutMs, before, after, beforeDoctor, afterDoctor, postflightError, outcome, files,
  };
  save(join(p.out, "run.json"), report);
  const ok = outcome.rc === 0 && !outcome.signal && !outcome.interruption && !outcome.spawnError
    && !postflightError && JSON.stringify(before) === JSON.stringify(after);
  return {ok, out:p.out};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  try {
    if (process.argv.length !== 3) throw new Error("one spec path required");
    const result = await record(json(process.argv[2]));
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    console.error("probe-recorder: preflight or recording failed; inspect private artifacts");
    process.exitCode = 2;
  }
}
```

Runtime restrictions are input hygiene and ownership, not security containment.
`runOwned`'s lifecycle is intentionally kept together; tests must verify timeout,
signal and cleanup of descendants that remain in the owned process group before
main accepts it. Separately detached subprocesses are outside this cleanup
guarantee. A fixture that starts background work must retain its own resource
identity and produce explicit teardown proof, or the fixture is incomplete. Do
not broaden recorder kill scope to process names, foreign PIDs or other groups.
Hard SIGKILL of the
recorder itself cannot guarantee cleanup; main inspects the recorded/private
host process state after such an interruption and does not reuse that packet.

## 3. NEW `plugins/codexclaw/scripts/probe-evidence.mjs`

Complete proposed file. No model calls. Exit 0 means eligible **for main review**,
1 means failed, 2 means unknown/incomplete/incomparable. A non-authoritative raw
response of `default` is retained and does not become downgrade or confirmation.

```js
#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { digest, fileDigest } from "./probe-recorder.mjs";
import { compareReports } from "./hook-bench-compare.mjs";

class Unknown extends Error {}
const need = (condition, label) => { if (!condition) throw new Unknown(label); };
const check = (condition, label) => { if (!condition) throw new Error(label); };
const json = file => JSON.parse(readFileSync(file, "utf8"));
export const conversationDigest = id => digest(id.trim()).slice(0, 32);

export function pointer(value, path) {
  need(typeof path === "string" && path.startsWith("/"), "missing observed JSON Pointer");
  for (const key of path.slice(1).split("/").map(s => s.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    need(value !== null && typeof value === "object" && Object.hasOwn(value, key), "missing proof field");
    value = value[key];
  }
  return value;
}

function local(root, file) {
  need(typeof file === "string" && !isAbsolute(file), "relative artifact path required");
  const path = realpathSync(join(root, file));
  check(path.startsWith(realpathSync(root) + sep), "artifact escapes output root");
  return path;
}

function lines(file) {
  const text = readFileSync(file, "utf8");
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try { return [{line:index + 1, value:JSON.parse(line)}]; }
    catch { throw new Error(`malformed JSONL at line ${index + 1}`); }
  });
}

function source(root, description) {
  need(description && /^[a-f0-9]{64}$/.test(description.sha256 || ""), "missing source digest");
  const file = local(root, description.file);
  check(fileDigest(file) === description.sha256, "source digest mismatch");
  return lines(file);
}

function transport(root, run) {
  need(run.schemaVersion === 1 && run.outcome && run.before, "incomplete run record");
  check(run.outcome.rc === 0 && !run.outcome.signal && !run.outcome.interruption
    && !run.outcome.spawnError && !run.postflightError, "run transport/postflight failed");
  need(run.after, "missing postflight identity");
  check(JSON.stringify(run.before) === JSON.stringify(run.after), "config/payload changed during run");
  check(run.beforeDoctor?.selectedChecks === "PASS" && run.afterDoctor?.selectedChecks === "PASS", "doctor check failed");
  for (const name of ["stdout.jsonl", "stderr.log", "final.txt", "doctor-before.json", "doctor-after.json"]) {
    need(run.files?.[name], "missing captured artifact");
    check(fileDigest(local(root, name)) === run.files[name], "captured artifact digest mismatch");
  }
  for (const name of ["doctor-before.json", "doctor-after.json"]) {
    const checks = json(local(root, name)).checks;
    need(Array.isArray(checks), "missing doctor checks");
    for (const required of ["manifest", "hooks", "hook-trust", "install-root"]) {
      const found = checks.filter(c => c.name === required);
      check(found.length === 1 && found[0].severity === "PASS", "captured doctor check not PASS");
    }
  }
  check(readFileSync(local(root, "final.txt"), "utf8").trim().length > 0, "empty final response");
  const events = lines(local(root, "stdout.jsonl"));
  check(!events.some(e => ["error", "turn.failed"].includes(e.value.type)), "CLI reported failure");
  const ids = events.filter(e => e.value.type === "thread.started").map(e => e.value.thread_id);
  check(ids.length === 1 && typeof ids[0] === "string" && ids[0].length > 0, "missing/ambiguous CLI thread");
  check(events.some(e => e.value.type === "turn.completed"), "CLI completion missing");
  return ids[0];
}

function auditAdapter(root, audit) {
  need(audit?.reviewedBy === "main" && /^[a-f0-9]{40}$/.test(audit.sourceSha || ""), "adapter source binding not reviewed");
  need(audit.normalization === "sha256(trim).hex.slice(0,32)", "unsupported correlation contract");
  need(Array.isArray(audit.files) && audit.files.length >= 1, "missing adapter source snapshots");
  for (const item of audit.files) {
    check(fileDigest(local(root, item.file)) === item.sha256, "adapter snapshot digest mismatch");
  }
}

function runtime(root, proof, session) {
  const rows = source(root, proof.sources?.[session.source]);
  const meta = rows.filter(e => e.value.type === "session_meta");
  check(meta.length === 1 && meta[0].value.payload?.id === session.id, "rollout session mismatch");
  const contexts = rows.filter(e => e.value.type === "turn_context");
  need(contexts.length > 0, "no effective runtime settings");
  for (const row of contexts) {
    check(pointer(row.value, proof.runtimePointers?.model) === "gpt-6-astra", "effective model mismatch");
    check(pointer(row.value, proof.runtimePointers?.effort) === "high", "effective effort mismatch");
  }
  return contexts.map(row => row.line);
}

function optionalPointer(value, path) {
  try { return pointer(value, path); }
  catch (error) { if (error instanceof Unknown) return null; throw error; }
}

function usageFor(rows, pointers, id) {
  const matched = rows.filter(row => pointer(row.value, pointers?.conversationId) === conversationDigest(id));
  need(matched.length > 0, "no exact conversation usage match");
  const expected = {requestedModel:"gpt-6-astra", resolvedModel:"gpt-6-astra",
    requestedEffort:"high", requestedServiceTier:"priority", canonical:"priority",
    wireKind:"service-tier", wireValue:"priority"};
  const seen = new Set();
  return matched.map(row => {
    const requestId = pointer(row.value, pointers.requestId);
    need(typeof requestId === "string" && requestId.length > 0, "missing unique request identifier");
    check(!seen.has(requestId), "ambiguous duplicate request identifier"); seen.add(requestId);
    for (const [field, value] of Object.entries(expected)) {
      check(pointer(row.value, pointers[field]) === value, `configured request mismatch: ${field}`);
    }
    const responseServiceTier = optionalPointer(row.value, pointers.responseServiceTier);
    const fastOutcome = optionalPointer(row.value, pointers.fastOutcome);
    const confirmation = optionalPointer(row.value, pointers.confirmation);
    return {requestId, line:row.line, responseServiceTier, fastOutcome, confirmation,
      configuredTier:"priority", schedulerConfirmation:"unknown"};
  });
}

export function analyzeRun(root) {
  const run = json(join(root, "run.json"));
  const parent = transport(root, run);
  check(run.requested?.model === "gpt-6-astra" && run.requested?.effort === "high"
    && run.requested?.serviceTier === "priority", "requested config mismatch");
  let proof;
  try { proof = json(join(root, "proof.json")); }
  catch (error) { if (error.code === "ENOENT") throw new Unknown("model/tier proof not supplied"); throw error; }
  need(proof.schemaVersion === 1 && Array.isArray(proof.sessions), "invalid proof manifest");
  auditAdapter(root, proof.adapterAudit);
  const parents = proof.sessions.filter(s => s.role === "parent");
  check(parents.length === 1 && parents[0].id === parent, "parent inventory mismatch");
  const ids = proof.sessions.map(s => s.id);
  check(ids.every(id => typeof id === "string" && id.length > 0) && new Set(ids).size === ids.length, "invalid session inventory");
  const usage = source(root, proof.sources?.[proof.usageSource]);
  const sessions = proof.sessions.map(session => ({id:session.id, role:session.role,
    effectiveLines:runtime(root, proof, session),
    requests:usageFor(usage, proof.usagePointers, session.id)}));
  return {state:"eligible-for-review", eligibility:"configured-priority-only",
    requestedExact:true, effectiveModelEffortExact:true, configuredWireExact:true,
    schedulerConfirmation:"unknown", confirmedFastPerformanceClaim:false,
    pairedComparisonEligible:true, hookInvocationCount:null,
    knownLimitation:"response tier echo ignored; no confirmed scheduler claim; absent hook events are unknown",
    requiresMainReview:["adapter-source-to-live-service binding", "complete child/request inventory",
      "independent behavioral invariants", "paired input/config/host conditions"], sessions};
}

export function analyzeBench(before, after, threshold) {
  need(Number.isFinite(threshold) && threshold >= 0, "invalid regression threshold");
  for (const field of ["schemaVersion", "platform", "release", "nodeVersion", "harnessSha256", "iterations"]) {
    need(before[field] != null && before[field] === after[field], `incomparable ${field}`);
  }
  for (const report of [before, after]) {
    need(report.iterations >= 2, "warm samples not measured");
    check(Array.isArray(report.hooks) && report.hooks.length > 0, "empty hook inventory");
    const keys = report.hooks.map(h => `${h.name}::${h.event}`);
    check(new Set(keys).size === keys.length, "ambiguous hook comparison keys");
    for (const hook of report.hooks) {
      check(hook.errorCount === 0, "hook invocation failed or error count absent");
      need(Number.isFinite(hook.aboveFloorMs) && hook.aboveFloorMs > 0, "noisy/missing above-floor sample");
      need(Number.isFinite(hook.stdoutBytes) && Number.isFinite(hook.stderrBytes), "missing output byte accounting");
      check(hook.invocations === report.iterations, "invocation count mismatch");
    }
  }
  const beforeKeys = new Set(before.hooks.map(h => `${h.name}::${h.event}`));
  check(after.hooks.every(h => beforeKeys.has(`${h.name}::${h.event}`)), "added hook requires separate review");
  const comparison = compareReports(before, after, threshold);
  check(comparison.ok, "per-hook regression or missing hook");
  return {state:"eligible-for-review", scope:"synthetic-replay-only", comparison};
}

export function verdict(action) {
  try { return {rc:0, report:action()}; }
  catch (error) {
    const unknown = error instanceof Unknown || error.code === "ENOENT";
    return {rc:unknown ? 2 : 1, report:{state:unknown ? "unknown" : "failed",
      reason:error instanceof Unknown ? error.message : "artifact/contract failure; inspect private sources"}};
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, a, b, threshold = "10"] = process.argv.slice(2);
  const result = verdict(() => {
    if (mode === "run" && a && !b) return analyzeRun(resolve(a));
    if (mode === "bench" && a && b) return analyzeBench(json(a), json(b), Number(threshold));
    throw new Unknown("usage: probe-evidence.mjs run OUTPUT | bench BEFORE AFTER [PCT]");
  });
  console.log(JSON.stringify(result.report, null, 2));
  process.exitCode = result.rc;
}
```

Deliberate fail-closed boundaries: no proof.json -> UNKNOWN; missing pointer,
request ID, source binding or schema -> UNKNOWN; contradictory exact value,
duplicate request ID, malformed JSONL or changed bytes -> FAILED. A provider
history array is not silently flattened into a matching last event. If real
usage files carry heterogeneous envelope lines, main amends the mapping/parser
against a retained real fixture before B proceeds; no catch-and-ignore parsing.

## 4. NEW `plugins/codexclaw/test/probe-evidence.test.mjs`

Complete proposed deterministic core fixture file. The source fixture uses flat
synthetic fields explicitly; it is not documentation of live OCX field names.
Known SHA-256 `abc` prefix is independent of the implementation under test.
No test reads prose. Physical-process and benchmark-root cases in §5 must be
added to this same test owner before C; do not claim these core tests cover them.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { conversationDigest, pointer, analyzeRun, analyzeBench, verdict } from "../scripts/probe-evidence.mjs";
import { execArgs, probeEnv, payloadDigest } from "../scripts/probe-recorder.mjs";

const sha = text => createHash("sha256").update(text).digest("hex");
const put = (root, file, value) => writeFileSync(join(root, file), value);
const putJson = (root, file, value) => put(root, file, JSON.stringify(value));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cxc-proof-"));
  mkdirSync(join(root, "evidence"));
  const stdout = [{type:"thread.started", thread_id:"abc"}, {type:"turn.completed"}].map(JSON.stringify).join("\n") + "\n";
  const runtime = [{type:"session_meta", payload:{id:"abc"}},
    {type:"turn_context", model:"gpt-6-astra", effort:"high"}].map(JSON.stringify).join("\n") + "\n";
  const row = {cid:"ba7816bf8f01cfea414140de5dae2223", requestId:"request-one",
    requestedModel:"gpt-6-astra", resolvedModel:"gpt-6-astra", requestedEffort:"high",
    requestedServiceTier:"priority", canonical:"priority", wireKind:"service-tier",
    wireValue:"priority", fastOutcome:"applied", confirmation:"assumed", responseServiceTier:"default"};
  const doctor = JSON.stringify({checks:["manifest","hooks","hook-trust","install-root"]
    .map(name => ({name,severity:"PASS"}))});
  const files = {"stdout.jsonl":stdout, "stderr.log":"", "final.txt":"ASTRA_PREFLIGHT_OK\n",
    "doctor-before.json":doctor, "doctor-after.json":doctor};
  for (const [name, text] of Object.entries(files)) put(root, name, text);
  const run = {schemaVersion:1, outcome:{rc:0}, before:{config:"a",payload:"b"}, after:{config:"a",payload:"b"},
    beforeDoctor:{selectedChecks:"PASS"}, afterDoctor:{selectedChecks:"PASS"},
    requested:{model:"gpt-6-astra",effort:"high",serviceTier:"priority"},
    files:Object.fromEntries(Object.entries(files).map(([name,text]) => [name,sha(text)]))};
  putJson(root, "run.json", run);
  put(root, "evidence/parent.jsonl", runtime);
  put(root, "evidence/usage.jsonl", JSON.stringify(row) + "\n");
  put(root, "evidence/id.ts", "fixture-id-source");
  put(root, "evidence/tier.ts", "fixture-tier-source");
  const proof = {schemaVersion:1,
    sources:{parent:{file:"evidence/parent.jsonl",sha256:sha(runtime)},
      usage:{file:"evidence/usage.jsonl",sha256:sha(JSON.stringify(row) + "\n")}},
    sessions:[{id:"abc",role:"parent",source:"parent"}],
    runtimePointers:{model:"/model",effort:"/effort"}, usageSource:"usage",
    usagePointers:Object.fromEntries(Object.keys(row).filter(k => k !== "cid").map(k => [k,"/" + k])),
    adapterAudit:{reviewedBy:"main",sourceSha:"a".repeat(40),normalization:"sha256(trim).hex.slice(0,32)",
      knownResponseEchoLimitation:true,files:[{file:"evidence/id.ts",sha256:sha("fixture-id-source")},
        {file:"evidence/tier.ts",sha256:sha("fixture-tier-source")}]}};
  proof.usagePointers.conversationId = "/cid";
  putJson(root, "proof.json", proof);
  return {root, row, proof, run};
}

function withFixture(action) {
  const f = fixture();
  try { action(f); } finally { rmSync(f.root, {recursive:true,force:true}); }
}

function setUsage(f, rows) {
  const text = rows.map(JSON.stringify).join("\n") + "\n";
  put(f.root, "evidence/usage.jsonl", text);
  f.proof.sources.usage.sha256 = sha(text);
  putJson(f.root, "proof.json", f.proof);
}

test("thread digest uses exact trimmed SHA-256 prefix, not CLI id equality", () => {
  assert.equal(conversationDigest(" abc \n"), "ba7816bf8f01cfea414140de5dae2223");
});
test("JSON Pointer handles escaped keys and missing proof is unknown", () => {
  assert.equal(pointer({"a/b":{"~x":3}}, "/a~1b/~0x"), 3);
  assert.equal(verdict(() => pointer({}, "/missing")).rc, 2);
});
test("applied + assumed + non-authoritative default is configured priority, never confirmed scheduling", () => withFixture(f => {
  const result = analyzeRun(f.root);
  assert.equal(result.eligibility, "configured-priority-only");
  assert.equal(result.schedulerConfirmation, "unknown");
  assert.equal(result.confirmedFastPerformanceClaim, false);
  assert.equal(result.pairedComparisonEligible, true);
  assert.equal(result.hookInvocationCount, null);
  assert.equal(result.sessions[0].requests[0].responseServiceTier, "default");
}));
test("missing tier proof is unknown; requested config cannot replace it", () => withFixture(f => {
  delete f.row.wireValue; setUsage(f, [f.row]);
  assert.equal(verdict(() => analyzeRun(f.root)).rc, 2);
}));
test("wrong resolved model fails even when requested Astra is exact", () => withFixture(f => {
  f.row.resolvedModel = "different-model"; setUsage(f, [f.row]);
  assert.equal(verdict(() => analyzeRun(f.root)).rc, 1);
}));
test("every request in the digest is checked, not the last matching row", () => withFixture(f => {
  setUsage(f, [{...f.row,wireValue:"default"}, {...f.row,requestId:"request-two"}]);
  assert.equal(verdict(() => analyzeRun(f.root)).rc, 1);
}));
test("duplicate request identifiers fail and an unrelated digest is not selected", () => withFixture(f => {
  setUsage(f, [f.row, {...f.row}]); assert.equal(verdict(() => analyzeRun(f.root)).rc, 1);
  setUsage(f, [{...f.row,cid:"unrelated"}]); assert.equal(verdict(() => analyzeRun(f.root)).rc, 2);
}));
test("changed raw artifacts fail before proof interpretation", () => withFixture(f => {
  put(f.root, "stdout.jsonl", "not-json\n");
  assert.equal(verdict(() => analyzeRun(f.root)).rc, 1);
}));
test("missing adapter binding does not manufacture confirmed or configured proof", () => withFixture(f => {
  delete f.proof.adapterAudit; putJson(f.root, "proof.json", f.proof);
  assert.equal(verdict(() => analyzeRun(f.root)).rc, 2);
}));
test("missing response echo and hook lifecycle events do not block exact priority comparison", () => withFixture(f => {
  delete f.row.responseServiceTier; delete f.proof.adapterAudit.knownResponseEchoLimitation;
  setUsage(f, [f.row]);
  const result = analyzeRun(f.root);
  assert.equal(result.pairedComparisonEligible, true);
  assert.equal(result.sessions[0].requests[0].responseServiceTier, null);
  assert.equal(result.hookInvocationCount, null);
}));
test("args are exact and do not bypass hook trust; environment does not inherit provider secrets", () => {
  const args = execArgs("priority", "/tmp/final.txt");
  assert.ok(args.includes('service_tier="priority"'));
  assert.ok(!args.includes("--dangerously-bypass-hook-trust"));
  assert.throws(() => execArgs("default", "/tmp/final.txt"));
  const env = probeEnv("/tmp/isolated", "/tmp/isolated/probe-bin", "/tmp/isolated/.codex/plugins/candidate");
  assert.equal(env.PATH.split(":")[0], "/tmp/isolated/probe-bin");
  assert.ok(env.CODEXCLAW_CXC.includes("/tmp/isolated/.codex/plugins/candidate/bin/cxc.mjs"));
  assert.deepEqual(Object.keys(env).sort(), ["CODEXCLAW_CXC","CODEX_HOME","CODEX_SQLITE_HOME","HOME","LANG","PATH","TMPDIR","USERPROFILE"].sort());
});
test("payload digest changes on byte change", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-payload-"));
  try { put(dir,"x","before"); const before = payloadDigest(dir); put(dir,"x","after"); assert.notEqual(payloadDigest(dir),before); }
  finally { rmSync(dir,{recursive:true,force:true}); }
});

function bench() {
  return {schemaVersion:1,platform:"darwin",release:"fixture",nodeVersion:"v24-fixture",harnessSha256:"same",
    iterations:3,hooks:[{name:"guard",event:"PreToolUse",aboveFloorMs:10,errorCount:0,invocations:3,stdoutBytes:0,stderrBytes:0}]};
}
test("benchmark errors, missing warm samples and missing hooks cannot pass", () => {
  const good = bench();
  assert.equal(verdict(() => analyzeBench(good,bench(),10)).rc,0);
  const error = bench(); error.hooks[0].errorCount=1;
  assert.equal(verdict(() => analyzeBench(good,error,10)).rc,1);
  const cold = bench(); cold.hooks[0].aboveFloorMs=null;
  assert.equal(verdict(() => analyzeBench(good,cold,10)).rc,2);
  const missing = bench(); missing.hooks=[];
  assert.equal(verdict(() => analyzeBench(good,missing,10)).rc,1);
});
```

## 5. Mandatory additional fixtures before C

These are precise additions to the same test owner, not new runners or libraries.
Implementation can keep fixture creation inside tests; no standalone fixture files
or executable production exports solely for tests. Tests use Node child_process
and fs; never a real model, SSH, shared config or production service.

| Fixture/setup | Action | Exact oracle |
| --- | --- | --- |
| fixture() but remove proof.json | analyzeRun | UNKNOWN/2; stdout/transport success unchanged |
| rewrite valid-hash stdout to malformed JSONL | update run.files digest independently, analyzeRun | FAILED/1 (parser, not hash guard, must fire) |
| valid-hash stdout without turn.completed | analyzeRun | FAILED/1, no completion claim |
| runtime model/effort conflict on second turn_context | update source digest independently | FAILED/1 despite first context matching |
| usage requestId absent | keep digest/model/tier correct | UNKNOWN/2; no fallback to row index/time |
| two distinct matching request IDs | both tuple-exact | two request records retained, raw response categories retained |
| proof source path escapes output | real external temp fixture with valid digest | FAILED/1 at path boundary, no external content report |
| raw response tier priority on known non-authoritative path | keep other required evidence exact | scheduler remains unknown, not confirmed |
| response echo or limitation flag absent | valid required model/effort/wire proof | still eligible; raw missing echo null; no scheduler inference |
| payload nested symlink | payloadDigest(temp root) | throws; original target unchanged |
| record(spec) dispatcher symlink, not merely payloadDigest unit call | Use the valid macOS integration fixture and clean source git repo; replace only installed bin/cxc.mjs with a symlink to a test-owned script outside payload that writes a marker and emits valid four-check doctor JSON | record rejects with payload-symlink error; target marker remains absent. Reverting validation to after doctor must make this test fail |
| record(spec) payload replaced during Codex execution | Valid preflight; fake Codex replaces bin/cxc.mjs with the marker-writing external symlink before exiting successfully | record returns not ok with postflightError; analyzer classifies FAILED before requiring absent after identity; linked marker absent and no postflight doctor execution. Repeat with config/launcher byte drift, and with a doctor that mutates an identity file after its valid invocation |
| initial doctor mutates an identity component | Valid fixture until doctor executes; fake doctor changes config, payload or a launcher and still prints valid PASS diagnostics | record rejects before starting fake Codex; inference marker remains absent. A valid doctor report cannot override changed bytes |
| conflicting global cxc and candidate dispatcher | Valid macOS record fixture; put a marker-writing foreign cxc on the original process PATH. Fake Codex invokes cxc through its received PATH; candidate cxc handles doctor normally and writes a distinct candidate marker for that invocation | Candidate marker present, foreign marker absent; run.json dispatch and launcher digests match candidate. Restore test PATH in finally. Final native fixture additionally inspects actual cxc resolution inside the model shell |
| incompatible benchmark host/harness; 1 iteration; negative floor | analyzeBench separately | UNKNOWN/2, no percentage claim |
| benchmark duplicated keys / added hook / one hook regression | analyzeBench separately | FAILED/1; existing missing-hook regression remains intact |
| alternate --plugin-root with fixture manifest and node entrypoint returning `{}` | spawn common benchmark controller --iterations 2 --json | reported command points to fixture; harness digest stable across two roots; stdoutBytes=6 for two `{}` plus newline outputs |
| same fixture command emits stderr and exits 3 | benchmark, then analyzer with compatible before report | benchmark errorCount=2; analyzer FAILED/1 even if benchmark exit was 0 |
| missing --plugin-root argument / missing manifest-referenced file | spawn benchmark | nonzero exit, no valid report |
| runOwned with process.execPath and `-e` deterministic stdout/stderr/exit 7 | real private output FDs, no model | rc=7 and exact bytes in separate files; no successful packet |
| runOwned child never exits, timeoutMs=1000 | owned Node fixture, finite parent watchdog | interruption=timeout, termination within timeout+grace+test margin; fixture pid/group gone |
| runOwned child creates a same-group grandchild then writes its PID and waits | signal recorder-owned cancellation fixture | both same-group processes gone; an unrelated sentinel process remains alive |
| fixture starts separately detached background work | fixture records its own handle/PID and closes it through its explicit teardown | independent teardown proof required; recorder does not claim to clean another group or broaden its kill scope |
| macOS prepare integration | fresh temp clean git repo, isolated home/work, fake installed dispatcher doctor JSON and fake executable codex | correct spec runs once; full version mismatch/outside install/config symlink/trust WARN/missing dist each stops before fake exec marker |
| omitted timeoutMs, then explicit 600000, then 600001 | same valid macOS spec with fake immediate-exit Codex | persisted timeoutMs is 180000, then 600000; last preflight refuses before exec |
| compiled spawn V1 activation | same cache-shaped fixture as hook-e2e.test.mjs:827; actual manifest-selected command; tool_input message `$cxc-dev inspect the fixture`, agent_type explorer, no task_name | parseable updatedInput, installed fixture skill path/body delivery per current contract; original unrelated keys preserved |
| compiled spawn V2 activation | separate payload with task_name `probe_leaf`, message `$cxc-dev inspect the fixture`, native V2 tool name exposed by host; same isolated fixture | V2 branch actually emits updatedInput/guard; no invented items field; original unrelated keys preserved |
| spawn nonmatch and repeated input | first wrong tool name, then replay original matched payload with the already-updated message | nonmatch empty output; matched replay does not duplicate delivered body/guard; no model invoked |
| protected worktree and completion gate | reuse worktree-guard.test.ts:414 and hook-e2e.test.mjs:436 preconditions in temp paths, invoke compiled manifest-selected hook | actual denial envelope for self-deletion/mid-cycle completion; benign/blocked paths remain allowed; never execute deletion |

For macOS integration, the fake `codex` is a test-owned executable shell/Node script
with an absolute shebang; never put a fake binary on shared PATH. The fake plugin
contains `bin/cxc.mjs` responding only to `doctor --json`, manifest/version, and
four named PASS checks. Each negative changes exactly one precondition, keeping
the earlier guards satisfiable. Counter/marker files prove exec was not reached.
Hook activation fixture owner is **this new test file**, not hook-bench.mjs and
not an unavailable host event stream. Reuse manifest resolution and cache-shaped
setup from the cited hook-e2e owner. These subprocess fixtures establish compiled
hook behavior; installed real model behavior/skill reads are separate recorder
scenarios under main. They do not require CLI lifecycle events. A new candidate's
intentional transport change updates its independently stated expected output in
the main's candidate plan before tests change, rather than forcing old prose.

`prepare` stays private; test through exported record(spec), never expose it only
for tests. Platform-specific tests run on macmini, not silently skipped there.

Tests that deliberately use `runOwned` may write/process-kill only their temp
fixture group. No live provider calls or test-issued hook trust mutation. Existing
source tests remain unchanged except the explicitly listed bench-env hunk.

## 6. Known limits and acceptance boundary

- No installed skills picker or real hook execution is proven by doctor alone.
- No native scheduling certainty is manufactured from non-authoritative tier echoes.
- Usage `resolvedModel` is adapter routing evidence, not independent proof of a
  provider's internal model weights; the report must use that precise meaning.
- A deterministic conversation digest is not a unique request ID. Multiple matching
  rows are all checked; duplicate IDs or unavailable request metadata prevent eligibility.
- Main's adapter binding and complete child inventory remain reviewed provenance,
  not an automatic cryptographic assertion. An author who forges all files can
  bypass this opt-in analyzer; call its result eligible-for-review, not enforcement.
- Recorder's private raw files are not guaranteed redacted. No config contents or
  environment/auth values are emitted; main quarantines unexpected sensitive output.
- No hook lifecycle events in CLI 0.146 means unknown invocation counts, not zero.
  Synthetic benchmark status and optional syscall metrics cannot block an otherwise
  valid paired actual-behavior/instruction-byte comparison.
- The supplied core test file is not the entire C proof. §5 process/root/negative
  cases are mandatory before B's implementation can be called complete.
- All source code here remains unexecuted proposal text at wp0. Main runs the
  exact commands in 020 on macmini only after audit and implementation approval.
