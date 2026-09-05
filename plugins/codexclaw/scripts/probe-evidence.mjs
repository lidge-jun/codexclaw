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

const nativeFiles = ["core/src/agent/control.rs", "core/src/session/session.rs", "core/src/session/turn_context.rs",
  "core/src/client.rs", "codex-api/src/requests/headers.rs", "exec/src/event_processor_with_jsonl_output.rs", "exec/src/lib.rs"];
const nativeSha = "e363b08c9175ac1cbe5893615dd2cb9ddf95043b";
const exactId = value => typeof value === "string" && value.length > 0 && value === value.trim();
function nativeAudit(root, proof) {
  const audit = proof.family?.nativeAudit;
  need(audit?.reviewedBy === "main" && audit.cliVersion === "0.146.0"
    && audit.sourceSha === nativeSha, "unsupported/unreviewed native source");
  for (const name of nativeFiles) {
    const item = audit.files?.[name];
    need(item && /^[a-f0-9]{64}$/.test(item.sha256 || ""), "missing native source snapshot");
    check(fileDigest(local(root, item.file)) === item.sha256, "native snapshot digest mismatch");
  }
}
function nativeSession(root, proof, session, parent) {
  const rows = source(root, proof.sources?.[session.source]);
  const meta = rows.filter(r => r.value.type === "session_meta");
  need(meta.length > 0, "missing native metadata");
  check(meta.length === 1, "ambiguous native metadata");
  const m = meta[0].value.payload;
  need(m && exactId(m.id) && exactId(m.session_id), "missing native identities");
  check(m.id === session.id && m.session_id === parent, "native family identity mismatch");
  need(m.cli_version === "0.146.0" && m.history_mode === "legacy" && !m.forked_from_id, "unsupported native history/version");
  if (session.role === "parent") {
    need(m.source === "exec" && m.thread_source === "user" && !m.parent_thread_id, "unsupported root source");
  } else {
    check(session.role === "child", "invalid native role");
    const spawn = m.source?.subagent?.thread_spawn;
    need(spawn && exactId(spawn.parent_thread_id) && exactId(m.parent_thread_id), "missing causal parent");
    need(spawn.depth === 1 && m.thread_source === "subagent" && m.multi_agent_version === "v1", "unsupported native topology");
    check(spawn.parent_thread_id === parent && m.parent_thread_id === parent, "causal parent mismatch");
  }
  const events = rows.filter(r => r.value.type === "event_msg");
  check(!events.some(r => ["error", "task_failed", "turn_aborted"].includes(r.value.payload?.type)), "native turn failed");
  need(!events.some(r => r.value.payload?.type?.startsWith("collab_agent_spawn")), "unsupported descendant event source");
  const starts = events.filter(r => r.value.payload?.type === "task_started");
  const ends = events.filter(r => r.value.payload?.type === "task_complete");
  need(starts.length > 0 && ends.length > 0, "incomplete native lifecycle");
  need(starts.length === 1 && ends.length === 1, "unsupported multi-turn/resumed history");
  need(exactId(starts[0].value.payload.turn_id) && exactId(ends[0].value.payload.turn_id), "missing native turn identity");
  check(starts[0].line < ends[0].line && starts[0].value.payload.turn_id === ends[0].value.payload.turn_id, "native lifecycle mismatch");
  need(proof.runtimePointers?.model === "/payload/model" && proof.runtimePointers?.effort === "/payload/effort", "unsupported native runtime pointers");
  for (const row of rows.filter(r => r.value.type === "turn_context")) {
    const context = row.value.payload;
    need(context && exactId(context.turn_id), "missing native context turn identity");
    check(context.turn_id === starts[0].value.payload.turn_id, "native context turn mismatch");
    need(context.multi_agent_version === "v1", "unsupported/missing native context version");
  }
  return {id:session.id, role:session.role, source:session.source, metadataLine:meta[0].line,
    sharedSessionId:m.session_id, parentId:session.role === "child" ? m.parent_thread_id : null,
    effectiveLines:runtime(root, proof, session), requests:null, requestCount:null};
}
function directSpawns(root, parent, sessions) {
  const rows = lines(local(root, "stdout.jsonl")), started = new Map(), completed = new Map();
  need(!rows.some(r => r.value.type === "warning"), "CLI warning requires completeness review");
  const calls = rows.filter(r => r.value.item?.type === "collab_tool_call");
  for (const row of calls) {
    const e = row.value, item = e.item;
    need(["spawn_agent", "wait", "send_input", "close_agent"].includes(item.tool), "unsupported CLI collab tool");
    need(item.sender_thread_id === parent, "unsupported non-root CLI sender");
    need(Array.isArray(item.receiver_thread_ids) && item.receiver_thread_ids.every(exactId), "missing CLI receiver inventory");
    if (item.tool !== "spawn_agent") continue;
    need(exactId(item.id), "missing CLI spawn identity");
    need(["item.started", "item.completed"].includes(e.type), "unsupported CLI spawn event");
    const target = e.type === "item.started" ? started : completed;
    check(!target.has(item.id), "duplicate CLI spawn record");
    check(item.status === (e.type === "item.started" ? "in_progress" : "completed"), "CLI spawn failed");
    check(item.receiver_thread_ids.length === (e.type === "item.started" ? 0 : 1), "ambiguous CLI spawn receivers");
    target.set(item.id, row);
  }
  need(started.size > 0 && completed.size > 0, "shared-family mode needs original CLI spawn records");
  need(started.size === completed.size && [...started.keys()].every(id => completed.has(id)), "incomplete CLI spawn lifecycle");
  const inventory = [...completed].map(([id, row]) => {
    check(started.get(id).line < row.line, "CLI spawn order mismatch");
    return {id:row.value.item.receiver_thread_ids[0], spawnItemId:id, startedLine:started.get(id).line, completedLine:row.line};
  });
  check(new Set(inventory.map(s => s.id)).size === inventory.length, "duplicate spawned child");
  const children = sessions.filter(s => s.role === "child").map(s => s.id).sort();
  check(JSON.stringify(children) === JSON.stringify(inventory.map(s => s.id).sort()), "CLI child inventory mismatch");
  check(calls.every(r => r.value.item.receiver_thread_ids.every(id => children.includes(id))), "unlisted CLI receiver");
  return inventory;
}
function familyReview(root, proof, run) {
  need(/^[a-f0-9]{64}$/.test(run.codexSha256 || ""), "missing Codex entrypoint identity");
  const rows = source(root, proof.family?.review);
  check(rows.length === 1, "ambiguous family review");
  const r = rows[0].value;
  need(r.schemaVersion === 1 && r.reviewedBy === "main" && r.topology === "root-direct-children"
    && r.originalsComplete === true && r.noUnlistedDescendants === true && r.noResumeOrFork === true
    && r.usageComplete === true, "family completeness/topology not established");
  const {family, ...manifest} = proof;
  const inputs = [["manifest", digest(JSON.stringify({...manifest, nativeAudit:family.nativeAudit}))],
    ["stdout.jsonl", run.files["stdout.jsonl"]], ["codexEntrypoint", run.codexSha256],
    ...Object.entries(proof.sources).map(([key, s]) => [key, s.sha256])].sort(([a], [b]) => a.localeCompare(b));
  check(JSON.stringify(r.inputDigests) === JSON.stringify(inputs), "stale family review binding");
}
function familyEvidence(root, proof, parent, run, usage) {
  for (const description of Object.values(proof.sources)) source(root, description);
  nativeAudit(root, proof);
  check(proof.sessions.every(s => exactId(s.id) && ["parent", "child"].includes(s.role)), "invalid native inventory");
  const sessions = proof.sessions.map(s => nativeSession(root, proof, s, parent));
  const inventory = directSpawns(root, parent, sessions);
  familyReview(root, proof, run);
  const childDigests = new Set(sessions.filter(s => s.role === "child").map(s => conversationDigest(s.id)));
  check(!childDigests.has(conversationDigest(parent)), "ambiguous family digest");
  check(!usage.some(r => childDigests.has(pointer(r.value, proof.usagePointers?.conversationId))), "mixed direct/shared usage source");
  const requests = usageFor(usage, proof.usagePointers, parent);
  return {state:"eligible-for-review", schemaVersion:2, proofScope:"shared-family", eligibility:"configured-priority-only",
    requestedExact:true, nativeThreadModelEffortExact:true, familyConfiguredWireExact:true,
    perThreadRequestAttribution:"unavailable", pairedComparisonEligible:false, familyComparisonEligibleForReview:true,
    schedulerConfirmation:"unknown", confirmedFastPerformanceClaim:false, hookInvocationCount:null,
    requiresMainReview:["independent behavioral invariants", "paired input/config/host conditions", "source/live and completeness review authenticity"],
    sessions, family:{rootId:parent, sharedSessionId:parent, conversationId:conversationDigest(parent),
      usageSource:proof.usageSource, review:proof.family.review, inventory, requestCount:requests.length, requests}};
}

export function analyzeRun(root) {
  const run = json(join(root, "run.json"));
  const parent = transport(root, run);
  check(run.requested?.model === "gpt-6-astra" && run.requested?.effort === "high"
    && run.requested?.serviceTier === "priority", "requested config mismatch");
  let proof;
  try { proof = json(join(root, "proof.json")); }
  catch (error) { if (error.code === "ENOENT") throw new Unknown("model/tier proof not supplied"); throw error; }
  need(Array.isArray(proof.sessions), "invalid proof manifest");
  need((proof.schemaVersion === 1 && proof.correlationMode === undefined && proof.family === undefined)
    || (proof.schemaVersion === 2 && proof.correlationMode === "native-shared-family-v1"), "unsupported proof mode");
  auditAdapter(root, proof.adapterAudit);
  const parents = proof.sessions.filter(s => s.role === "parent");
  check(parents.length === 1 && parents[0].id === parent, "parent inventory mismatch");
  const ids = proof.sessions.map(s => s.id);
  check(ids.every(id => typeof id === "string" && id.length > 0) && new Set(ids).size === ids.length, "invalid session inventory");
  const usage = source(root, proof.sources?.[proof.usageSource]);
  if (proof.schemaVersion === 2) return familyEvidence(root, proof, parent, run, usage);
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
  need(comparison.rows.every(row => Number.isFinite(row.deltaPct)), "comparison baseline too small for a percentage claim");
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
