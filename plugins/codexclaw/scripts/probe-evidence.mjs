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
