import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { analyzeRun } from "../scripts/probe-evidence.mjs";
import { fixture, familyFixture, saveFamily, setSource, assertVerdict } from "./probe-fixtures/evidence.mjs";
import { put, putJson, sha, tempRoot } from "./probe-fixtures/filesystem.mjs";
test("schema 1 keeps direct proof; schema 2 never allocates group requests to threads", t => {
  const direct = analyzeRun(fixture(t).root); assert.equal(direct.pairedComparisonEligible, true);
  assert.equal(direct.sessions[0].requests.length, 1); assert.equal(direct.proofScope, undefined);
  const f = familyFixture(t), bytes = readFileSync(join(f.root, "evidence/usage.jsonl"));
  const r = assertVerdict(() => analyzeRun(f.root), 0).report;
  assert.equal(r.proofScope, "shared-family"); assert.equal(r.pairedComparisonEligible, false);
  assert.equal(r.familyComparisonEligibleForReview, true); assert.equal(r.perThreadRequestAttribution, "unavailable");
  assert.equal(r.configuredWireExact, undefined); assert.equal(r.familyConfiguredWireExact, true);
  assert.equal(r.family.requestCount, 2); assert.equal(r.family.conversationId, "ba7816bf8f01cfea414140de5dae2223");
  assert.deepEqual(r.family.requests.map(x => [x.requestId, x.line]), [["request-one", 1], ["request-two", 2]]);
  assert.deepEqual(r.family.inventory, [{id:"child", spawnItemId:"spawn-1", startedLine:2, completedLine:3}]);
  assert.deepEqual(r.sessions.map(s => [s.id, s.sharedSessionId, s.effectiveLines, s.requests, s.requestCount]),
    [["abc", "abc", [3], null, null], ["child", "abc", [3], null, null]]);
  assert.equal(r.schedulerConfirmation, "unknown"); assert.equal(r.confirmedFastPerformanceClaim, false);
  assert.equal(r.hookInvocationCount, null); assert.deepEqual(readFileSync(join(f.root, "evidence/usage.jsonl")), bytes);
});
test("two direct children still have only one family request array; unrelated rows stay unrelated", t => {
  const f = familyFixture(t), sibling = structuredClone(f.childRows);
  sibling[0].payload.id = "sibling"; sibling[1].payload.turn_id = sibling[2].payload.turn_id = sibling[3].payload.turn_id = "sibling-turn";
  f.proof.sources.sibling = {file:"evidence/sibling.jsonl"};
  f.proof.sessions.push({id:"sibling", role:"child", source:"sibling"}); setSource(f, "sibling", sibling);
  const start = structuredClone(f.events[1]), end = structuredClone(f.events[2]);
  start.item.id = end.item.id = "spawn-2"; end.item.receiver_thread_ids = ["sibling"];
  f.events.splice(3, 0, start, end); f.usageRows.unshift({...f.row, cid:"unrelated", wireValue:"default"}); saveFamily(f);
  const r = analyzeRun(f.root); assert.equal(r.sessions.length, 3); assert.equal(r.family.requestCount, 2);
  assert.deepEqual(r.family.inventory.map(s => s.id), ["child", "sibling"]);
  assert.deepEqual(r.family.requests.map(s => s.line), [2, 3]); assert.ok(r.sessions.every(s => s.requests === null));
});
test("a declared native child without an observed spawn is rejected", t => {
  const f = familyFixture(t), sibling = structuredClone(f.childRows);
  sibling[0].payload.id = "unspawned";
  sibling[1].payload.turn_id = sibling[2].payload.turn_id = sibling[3].payload.turn_id = "unspawned-turn";
  f.proof.sources.unspawned = {file:"evidence/unspawned.jsonl"};
  f.proof.sessions.push({id:"unspawned", role:"child", source:"unspawned"});
  setSource(f, "unspawned", sibling); saveFamily(f);
  assert.throws(() => analyzeRun(f.root), /CLI child inventory mismatch/);
  assertVerdict(() => analyzeRun(f.root), 1);
});
const cases = [
  ["bad mode", 2, /unsupported proof mode/, f => { f.proof.correlationMode = "automatic"; }],
  ["implicit mode", 2, /unsupported proof mode/, f => { delete f.proof.correlationMode; }],
  ["schema 1 cannot opt into family", 2, /unsupported proof mode/, f => { f.proof.schemaVersion = 1; }],
  ["unknown schema", 2, /unsupported proof mode/, f => { f.proof.schemaVersion = 3; }],
  ["failed transport", 1, /run transport\/postflight failed/, f => { f.run.outcome.rc = 7; }],
  ["foreign parent inventory", 1, /parent inventory mismatch/, f => { f.proof.sessions[0].id = "foreign"; }],
  ["duplicate session", 1, /invalid session inventory/, f => { f.proof.sessions.push({...f.proof.sessions[1]}); }],
  ["missing entrypoint digest", 2, /missing Codex entrypoint/, f => { delete f.run.codexSha256; }],
  ["native audit missing", 2, /native source/, f => { delete f.proof.family.nativeAudit; }],
  ["native source version", 2, /native source/, f => { f.proof.family.nativeAudit.sourceSha = "a".repeat(40); }],
  ["source snapshot missing", 2, /missing native source/, f => { delete f.proof.family.nativeAudit.files["core/src/client.rs"]; }],
  ["child identity", 1, /native family identity/, f => { f.childRows[0].payload.id = "other"; }],
  ["child shared identity", 1, /native family identity/, f => { f.childRows[0].payload.session_id = "child"; }],
  ["root shared identity", 1, /native family identity/, f => { f.parentRows[0].payload.session_id = "other"; }],
  ["absent shared identity", 2, /missing native identities/, f => { delete f.childRows[0].payload.session_id; }],
  ["whitespace thread identity", 1, /invalid native inventory/, f => { f.proof.sessions[1].id = " child "; }],
  ["missing metadata", 2, /missing native metadata/, f => { f.childRows.shift(); }],
  ["missing child contexts", 2, /no effective runtime/, f => { f.childRows.splice(2, 1); }],
  ["missing context effort", 2, /missing proof field/, f => { delete f.childRows[2].payload.effort; }],
  ["missing runtime pointer", 2, /unsupported native runtime pointers/, f => { delete f.proof.runtimePointers.effort; }],
  ["causal parent", 1, /causal parent mismatch/, f => { f.childRows[0].payload.source.subagent.thread_spawn.parent_thread_id = "foreign"; }],
  ["metadata parent", 1, /causal parent mismatch/, f => { f.childRows[0].payload.parent_thread_id = "foreign"; }],
  ["absent causal parent", 2, /missing causal parent/, f => { delete f.childRows[0].payload.parent_thread_id; }],
  ["grandchild", 2, /unsupported native topology/, f => { f.childRows[0].payload.source.subagent.thread_spawn.depth = 2; }],
  ["V2", 2, /unsupported native topology/, f => { f.childRows[0].payload.multi_agent_version = "v2"; }],
  ["unknown native source", 2, /missing causal parent/, f => { f.childRows[0].payload.source = {subagent:"review"}; }],
  ["fork", 2, /unsupported native history/, f => { f.childRows[0].payload.forked_from_id = "fork"; }],
  ["native version drift", 2, /unsupported native history/, f => { f.childRows[0].payload.cli_version = "0.147.0"; }],
  ["unknown root source", 2, /unsupported root source/, f => { f.parentRows[0].payload.source = "app-server"; }],
  ["duplicate meta", 1, /ambiguous native metadata/, f => { f.childRows.push(f.childRows[0]); }],
  ["missing child completion", 2, /incomplete native lifecycle/, f => { f.childRows.pop(); }],
  ["wrong terminal turn", 1, /native lifecycle mismatch/, f => { f.childRows[3].payload.turn_id = "other"; }],
  ["missing terminal turn id", 2, /missing native turn identity/, f => { delete f.childRows[3].payload.turn_id; }],
  ["native turn error", 1, /native turn failed/, f => { f.childRows.push({type:"event_msg", payload:{type:"error"}}); }],
  ["descendant event", 2, /unsupported descendant event/, f => { f.childRows.push({type:"event_msg", payload:{type:"collab_agent_spawn_begin"}}); }],
  ["resumed history", 2, /multi-turn/, f => { f.childRows.push(f.childRows[1]); }],
  ["unsupported role", 1, /invalid native inventory/, f => { f.proof.sessions[1].role = "reviewer"; }],
  ["omitted child", 1, /CLI child inventory mismatch/, f => { f.proof.sessions.pop(); }],
  ["different CLI child", 1, /CLI child inventory mismatch/, f => { f.events[2].item.receiver_thread_ids = ["unlisted"]; }],
  ["no native CLI spawn", 2, /original CLI spawn/, f => { f.events.splice(1, 2); }],
  ["incomplete CLI spawn", 2, /original CLI spawn/, f => { f.events.splice(2, 1); }],
  ["unresolved additional start", 2, /incomplete CLI spawn lifecycle/, f => { const e = structuredClone(f.events[1]); e.item.id = "spawn-2"; f.events.splice(3, 0, e); }],
  ["reversed CLI lifecycle", 1, /CLI spawn order mismatch/, f => { [f.events[1], f.events[2]] = [f.events[2], f.events[1]]; }],
  ["duplicate spawn completion", 1, /duplicate CLI spawn/, f => { f.events.splice(3, 0, f.events[2]); }],
  ["failed spawn", 1, /CLI spawn failed/, f => { f.events[2].item.status = "failed"; }],
  ["nested CLI sender", 2, /non-root CLI sender/, f => { f.events[2].item.sender_thread_id = "child"; }],
  ["empty spawn receiver", 1, /ambiguous CLI spawn/, f => { f.events[2].item.receiver_thread_ids = []; }],
  ["duplicate spawned child", 1, /duplicate spawned child/, f => { const a = structuredClone(f.events[1]), b = structuredClone(f.events[2]); a.item.id = b.item.id = "spawn-2"; f.events.splice(3, 0, a, b); }],
  ["unknown CLI collab tool", 2, /unsupported CLI collab tool/, f => { f.events[1].item.tool = "spawn_agent_v2"; }],
  ["missing CLI receiver", 2, /missing CLI receiver inventory/, f => { delete f.events[2].item.receiver_thread_ids; }],
  ["missing CLI spawn id", 2, /missing CLI spawn identity/, f => { delete f.events[2].item.id; }],
  ["unknown spawn event", 2, /unsupported CLI spawn event/, f => { f.events[2].type = "item.updated"; }],
  ["CLI warning", 2, /CLI warning/, f => { f.events.push({type:"warning"}); }],
  ["unlisted wait recipient", 1, /unlisted CLI receiver/, f => { const e = structuredClone(f.events[2]); e.item.tool = "wait"; e.item.receiver_thread_ids = ["unlisted"]; f.events.splice(3, 0, e); }],
  ["mixed usage topology", 1, /mixed direct\/shared/, f => { f.usageRows.push({...f.row, cid:sha("child").slice(0, 32)}); }],
  ["duplicate request", 1, /duplicate request/, f => { f.usageRows.push({...f.row}); }],
  ["no root usage", 2, /no exact conversation/, f => { f.usageRows = [{...f.row, cid:"unrelated"}]; }],
  ["incomplete review", 2, /not established/, f => { f.review.originalsComplete = false; }],
  ["nested not excluded", 2, /not established/, f => { f.review.noUnlistedDescendants = false; }],
  ["usage incomplete", 2, /not established/, f => { f.review.usageComplete = false; }],
  ["review author", 2, /not established/, f => { f.review.reviewedBy = "worker"; }],
  ["review topology", 2, /not established/, f => { f.review.topology = "nested"; }],
  ["resume not excluded", 2, /not established/, f => { delete f.review.noResumeOrFork; }],
];
for (const [name, rc, error, mutate] of cases) test(name, t => {
  const f = familyFixture(t); mutate(f); saveFamily(f);
  assert.throws(() => analyzeRun(f.root), error); assertVerdict(() => analyzeRun(f.root), rc);
});
for (const field of ["requestedModel", "resolvedModel", "requestedEffort", "requestedServiceTier", "canonical", "wireKind", "wireValue"])
  for (const index of [0, 1]) test(`every family request ${index} validates ${field}`, t => {
    const f = familyFixture(t); f.usageRows[index][field] = "different"; saveFamily(f);
    assert.throws(() => analyzeRun(f.root), new RegExp(`configured request mismatch: ${field}`)); assertVerdict(() => analyzeRun(f.root), 1);
  });
for (const field of ["requestId", "requestedEffort", "wireValue"]) test(`missing family ${field} is unknown`, t => {
  const f = familyFixture(t); delete f.usageRows[1][field]; saveFamily(f); assertVerdict(() => analyzeRun(f.root), 2);
});
for (const field of ["model", "effort"]) test(`every child context validates ${field}`, t => {
  const f = familyFixture(t); f.childRows.splice(3, 0, {type:"turn_context", payload:{...f.childRows[2].payload, [field]:"different"}}); saveFamily(f);
  assert.throws(() => analyzeRun(f.root), new RegExp(`effective ${field} mismatch`)); assertVerdict(() => analyzeRun(f.root), 1);
});
for (const role of ["parentRows", "childRows"]) for (const index of [0, 1])
  for (const [field, value, rc, error] of [["turn_id", undefined, 2, /missing native context turn/],
    ["turn_id", "foreign-turn", 1, /native context turn mismatch/], ["multi_agent_version", undefined, 2, /native context version/],
    ["multi_agent_version", "v2", 2, /native context version/]]) test(`${role} context ${index} ${field}=${value}`, t => {
    const f = familyFixture(t); if (index) f[role].splice(3, 0, structuredClone(f[role][2]));
    if (value === undefined) delete f[role][2 + index].payload[field]; else f[role][2 + index].payload[field] = value;
    saveFamily(f); assert.throws(() => analyzeRun(f.root), error); assertVerdict(() => analyzeRun(f.root), rc);
  });
for (const [action, rc] of [["tamper", 1], ["delete", 2]]) test(`reviewed extra source ${action} is detected without review refresh`, t => {
  const f = familyFixture(t); f.proof.sources.extra = {file:"evidence/extra.jsonl"};
  setSource(f, "extra", [{kind:"extra-original"}]); saveFamily(f); assertVerdict(() => analyzeRun(f.root), 0);
  const proofBefore = readFileSync(join(f.root, "proof.json")), reviewBefore = readFileSync(join(f.root, f.proof.family.review.file));
  if (action === "tamper") put(f.root, "evidence/extra.jsonl", '{"kind":"changed"}\n'); else rmSync(join(f.root, "evidence/extra.jsonl"));
  if (action === "tamper") assert.throws(() => analyzeRun(f.root), /source digest mismatch/);
  assertVerdict(() => analyzeRun(f.root), rc); assert.deepEqual(readFileSync(join(f.root, "proof.json")), proofBefore);
  assert.deepEqual(readFileSync(join(f.root, f.proof.family.review.file)), reviewBefore);
});
for (const echo of ["default", "priority", undefined]) test(`family echo ${echo} does not confirm scheduler`, t => {
  const f = familyFixture(t); f.usageRows[1].responseServiceTier = echo; saveFamily(f);
  const r = analyzeRun(f.root); assert.equal(r.family.requests[1].responseServiceTier, echo ?? null);
  assert.equal(r.family.requests[1].confirmation, "assumed"); assert.equal(r.schedulerConfirmation, "unknown");
});
test("stale review is not refreshed by the analyzer", t => {
  const f = familyFixture(t); setSource(f, "usage", [f.row]);
  assert.throws(() => analyzeRun(f.root), /stale family review binding/); assertVerdict(() => analyzeRun(f.root), 1);
});
test("a changed pointer mapping invalidates the existing human review even with unchanged bytes", t => {
  const f = familyFixture(t); f.proof.usagePointers.responseServiceTier = "/canonical";
  putJson(f.root, "proof.json", f.proof); assert.throws(() => analyzeRun(f.root), /stale family review binding/);
  assertVerdict(() => analyzeRun(f.root), 1);
});
for (const name of ["evidence/child.jsonl", "evidence/family-review.jsonl", "evidence/native/core/src/client.rs"])
  test(`missing then tampered ${name}`, t => {
    const f = familyFixture(t); rmSync(join(f.root, name)); assertVerdict(() => analyzeRun(f.root), 2);
    put(f.root, name, "DIFFERENT"); assertVerdict(() => analyzeRun(f.root), 1);
  });
test("schema 1 does not fall back when child has no direct usage", t => {
  const f = familyFixture(t); f.proof.schemaVersion = 1; delete f.proof.family; delete f.proof.correlationMode;
  putJson(f.root, "proof.json", f.proof); assertVerdict(() => analyzeRun(f.root), 2);
});
test("native snapshot paths cannot escape output or expose private content", t => {
  const f = familyFixture(t), secret = "TEST_ONLY_NEVER_REPORT", outside = tempRoot(t);
  const path = put(outside, "client.rs", secret);
  f.proof.family.nativeAudit.files["core/src/client.rs"] = {file:relative(f.root, path), sha256:sha(secret)};
  putJson(f.root, "proof.json", f.proof); assert.throws(() => analyzeRun(f.root), /artifact escapes output root/);
  assert.ok(!JSON.stringify(assertVerdict(() => analyzeRun(f.root), 1)).includes(secret));
});
