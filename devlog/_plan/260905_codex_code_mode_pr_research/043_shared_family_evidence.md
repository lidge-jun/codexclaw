# 043 — WP3 prerequisite: explicit shared-family evidence

Status: complete proposed patch/test packet, NOT implemented or executed. Anchor: `91e051df54609ebabf5710c5485c63faaaa57f47`, checkout `/Users/jun/.codex/worktrees/974c/codexclaw`. Dependencies: [035](035_native_identity_observations.md), [020](020_remote_evaluation.md), [021](021_evaluation_contract.md), [023](023_wp1_review_synthesis.md). Main owns WP3 P, 040 integration, audit, execution and all goal/FSM state. This author writes only this page.

## Contract and authority

Archetype: satisfy-spec, docs-only prerequisite; C3 analysis with C4 care for evidence-contract changes. Trigger: 035 disproves per-thread hashing for native families. Goal: retain original per-thread context proof while reporting shared requests exactly once. Non-goals: proxy/request-logger/OCX/recorder/runtime/config edits, daemon, packer, client, correlation DSL, parallel tracing, scheduler confirmation, nested-family support, per-child wire/token allocation. Verifier: main's remote tests and byte-bound original-artifact review below; no command was executed to validate proposed code. Stop: audited plan ready for main, not candidate adoption. Durable artifact: this page. Outcomes: eligible-for-review / unknown / failed. Escalation: unsupported source/topology or incomplete originals goes to main; no fallback, new collector, model call, or scope expansion. No subdelegation is needed for this bounded page. Main reports fresh 284 baseline handler/guard tests passing; that is not validation of this unimplemented extension.

Necessity/search: `usageFor`, `analyzeRun`, `pairedComparisonEligible`, `sessions.*requests`, `probe-evidence` identify one opt-in analyzer and its existing portable fixtures/tests. Doing nothing preserves the diagnosed gap; changing hash inputs silently would falsify schema 1; configuring pointers cannot express shared ownership. Reuse `transport`, `source`, `runtime`, `usageFor`, `verdict`, `fixture`, `setSource`, `setArtifact`; no new production module/export. No trace framework or generic schema engine.

Source anchors verified read-only: local `/Users/jun/Developer/new/700_projects/040_upstream/codex`, `rust-v0.146.0^{commit}` = `e363b08c9175ac1cbe5893615dd2cb9ddf95043b` (annotated tag object itself is `be449751a978f02e5bbba886999662956c7f38f5`). At that commit, `codex-rs/core/src/agent/control.rs:90–99,127–134`, `core/src/session/session.rs:477–484,558–582`, `core/src/session/turn_context.rs:546–553`, `core/src/client.rs:1149–1151`, `codex-api/src/requests/headers.rs:5–13` distinguish shared session and concrete thread identity. All shortened paths in this sentence are beneath `codex-rs/`. Captured OCX `a687eb735afc7307f902816972c2f8fb522ed2f3`, `.codexclaw/evidence/01a0702d-c493-7510-801f-7d8772a2689c/wp1-baseline-003/output/evidence/request-log-conversation.ts:34–37,115–127`, hashes trimmed client-parent identity, otherwise session identity, before thread identity. Main must review captured-source correspondence to the actual CLI version and serving OCX service. In these packets `run.codexBin` resolves to the JavaScript launcher and `run.codexSha256` hashes that invocation entrypoint, not the native Rust executable. CLI version/source correspondence is explicit supporting evidence, not cryptographic native-binary attestation.

Additional inventory limit: pinned `codex-rs/exec/src/event_processor_with_jsonl_output.rs:235–295` serializes `collab_tool_call`; `codex-rs/exec/src/lib.rs:1292–1349` filters notifications to the primary thread/turn. CLI spawn rows therefore prove **direct** children, not absence of grandchildren. Never scan code-mode JavaScript strings for `spawn` and call that complete native discovery. A mandatory, byte-bound main review of complete isolated-run rollouts and native sources supplies the one-level/no-resume/no-fork/completeness judgment. If main cannot establish that judgment from owned originals, leave it absent: UNKNOWN. Its truth is a human-review dependency, not an automatic guarantee.

Schema 1 and its direct-thread output remain unchanged. Schema 2 requires `correlationMode:"native-shared-family-v1"`; it is never inferred from missing child matches. All existing `sources`, `sessions`, runtime/usage pointers and adapter audit retain their meanings. Add `family.nativeAudit` (reviewedBy, cliVersion, sourceSha, files keyed by the seven exact native source paths below), and `family.review` (relative file + SHA-256 of one operator-authored JSONL review record). Native metadata and usage files are byte-identical copies, never enriched or relabeled. The review is explicitly a separate human artifact, not native evidence.

The review record is `{schemaVersion:1,reviewedBy:"main",topology:"root-direct-children",originalsComplete:true,noUnlistedDescendants:true,noResumeOrFork:true,usageComplete:true,inputDigests:[...]}`. `inputDigests` binds every declared raw source, original stdout, recorded Codex invocation-entrypoint/launcher hash (`codexEntrypoint`), and manifest (including pointer mappings, inventory and both source audits, excluding only the self-referential review descriptor); exact construction is below. It does not bind or attest the native Rust binary. Main records these assertions only after reviewing complete post-completion originals, all child activity, isolated-home inventory, root CLI spawn records, adapter/source-to-live correspondence and unfiltered request coverage. This is a review record, not a cryptographic signature. CLI version/source correspondence alone cannot prove request completeness. Hash refresh without a new review is forbidden.

State machine: transport/request validation → explicit schema dispatch → existing adapter audit → parent/unique-ID inventory → native audit → every native metadata/context and terminal lifecycle → original CLI spawn inventory equality → byte-bound main completeness review → one root-digest usage scan → scoped report. Missing inputs, unresolved starts, absent terminal lifecycle, unknown versions/modes, unsupported depth/source/history/V2/resume/fork or unestablished completeness → UNKNOWN/rc2. Contradictory IDs, stale hashes, duplicate identities/spawns/requests, malformed JSONL, failed transport or any matched request mismatch → FAILED/rc1. First encountered error wins; there is no error aggregation or fallback. No partial sessions/groups or eligibility escape an error.

Eligible schema 2 reports `proofScope:"shared-family"`, `pairedComparisonEligible:false`, `familyComparisonEligibleForReview:true`, `perThreadRequestAttribution:"unavailable"`, each session `requests:null,requestCount:null`, and exactly one family request array. It deliberately omits schema 1's unscoped `configuredWireExact` and `effectiveModelEffortExact` booleans; scoped fields are `familyConfiguredWireExact` and `nativeThreadModelEffortExact`. A report's rc0 is not adoption PASS. 040 must explicitly consume the family field only for whole-run/family comparisons; a per-thread-required row stays unavailable/ineligible. Behavioral acceptance, input/config/host pairing and scheduler status remain independent. The observed C2 baseline/candidate both retain `failed-original-no-delegation`; 12/13 shared requests cannot repair that failure.

Mandatory-trial boundary: planned 050 F7 full-history trials and any supported V2 trials remain unverified and outside this observed legacy V1, one-level mode. UNKNOWN/unsupported here is not a waiver, substitute PASS, or permission to drop those mandatory trials. Their separate evidence and acceptance remain required under main's integration plan.

## Exact future file map / copy-paste hunks

Only future modifications: `plugins/codexclaw/scripts/probe-evidence.mjs` (193 lines before patch; insert 107 private-function lines before `analyzeRun` at :123, replace the schema guard, and add the dispatch statement below: approximately 303 lines); `plugins/codexclaw/test/probe-fixtures/evidence.mjs` (84 existing + 38 appended fixture lines); NEW `plugins/codexclaw/test/probe-evidence-family.test.mjs` (entire 146-line listing). Existing portable/recorder/compiled-hook tests stay intact. Every resulting source/test file must remain <400 lines. The general SoT `docs/native-thin-harness.md:86–90` is owned by main's 040 integration: add “Shared-family request evidence is explicitly scoped, counted once, and cannot satisfy per-thread request attribution; native child inventory and completeness require independent review.” No extra file is authorized in this authoring task.

Replace `need(proof.schemaVersion === 1 && Array.isArray(proof.sessions), "invalid proof manifest");` at :131 with:
```js
  need(Array.isArray(proof.sessions), "invalid proof manifest");
  need((proof.schemaVersion === 1 && proof.correlationMode === undefined && proof.family === undefined)
    || (proof.schemaVersion === 2 && proof.correlationMode === "native-shared-family-v1"), "unsupported proof mode");
```
Insert immediately after `const usage = source(root, proof.sources?.[proof.usageSource]);` at :137; keep all following schema-1 code unchanged:
```js
  if (proof.schemaVersion === 2) return familyEvidence(root, proof, parent, run, usage);
```
Complete private additions to that SAME analyzer file (no exported helpers or new imports):
```js
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
```

## Fixture extension (append to existing `test/probe-fixtures/evidence.mjs`)

This reuses synthetic `fixture`, hashing, source/artifact writers and cleanup; synthetic Rust snapshot text is deliberately NOT claimed to be native source. No tool/model/process calls in the fixture. All names resolve within `plugins/codexclaw/`.
```js
export function familyFixture(t) {
  const f = fixture(t);
  f.proof.schemaVersion = 2; f.proof.correlationMode = "native-shared-family-v1";
  f.proof.sessions.push({id:"child", role:"child", source:"child"});
  f.proof.sources.child = {file:"evidence/child.jsonl"};
  f.run.codexSha256 = "b".repeat(64);
  f.proof.family = {nativeAudit:{reviewedBy:"main", cliVersion:"0.146.0",
    sourceSha:"e363b08c9175ac1cbe5893615dd2cb9ddf95043b", files:{}}, review:{file:"evidence/family-review.jsonl"}};
  for (const name of ["core/src/agent/control.rs", "core/src/session/session.rs", "core/src/session/turn_context.rs",
    "core/src/client.rs", "codex-api/src/requests/headers.rs", "exec/src/event_processor_with_jsonl_output.rs", "exec/src/lib.rs"]) {
    const file = "evidence/native/" + name; put(f.root, file, "SYNTHETIC " + name);
    f.proof.family.nativeAudit.files[name] = {file, sha256:sha("SYNTHETIC " + name)};
  }
  const rows = (id, child) => [{type:"session_meta", payload:{id, session_id:"abc", cli_version:"0.146.0", history_mode:"legacy",
    source:child ? {subagent:{thread_spawn:{parent_thread_id:"abc", depth:1}}} : "exec",
    thread_source:child ? "subagent" : "user", ...(child ? {parent_thread_id:"abc", multi_agent_version:"v1"} : {})}},
    {type:"event_msg", payload:{type:"task_started", turn_id:id + "-turn"}}, runtimeRows(id)[1],
    {type:"event_msg", payload:{type:"task_complete", turn_id:id + "-turn"}}];
  f.parentRows = rows("abc", false); f.childRows = rows("child", true);
  const item = {id:"spawn-1", type:"collab_tool_call", tool:"spawn_agent", sender_thread_id:"abc"};
  f.events = [{type:"thread.started", thread_id:"abc"},
    {type:"item.started", item:{...item, status:"in_progress", receiver_thread_ids:[]}},
    {type:"item.completed", item:{...item, status:"completed", receiver_thread_ids:["child"]}}, {type:"turn.completed"}];
  f.usageRows = [f.row, {...f.row, requestId:"request-two"}];
  f.review = {schemaVersion:1, reviewedBy:"main", topology:"root-direct-children", originalsComplete:true,
    noUnlistedDescendants:true, noResumeOrFork:true, usageComplete:true};
  saveFamily(f); return f;
}
export function saveFamily(f) {
  setArtifact(f, "stdout.jsonl", jsonl(f.events));
  setSource(f, "parent", f.parentRows); setSource(f, "child", f.childRows); setSource(f, "usage", f.usageRows);
  const {family, ...manifest} = f.proof;
  f.review.inputDigests = [["manifest", sha(JSON.stringify({...manifest, nativeAudit:family.nativeAudit}))],
    ["stdout.jsonl", sha(jsonl(f.events))], ["codexEntrypoint", f.run.codexSha256],
    ...Object.keys(f.proof.sources).map(key => [key, f.proof.sources[key].sha256])].sort(([a], [b]) => a.localeCompare(b));
  const text = jsonl([f.review]); put(f.root, f.proof.family.review.file, text);
  f.proof.family.review.sha256 = sha(text); putJson(f.root, "proof.json", f.proof);
}
```

## NEW `plugins/codexclaw/test/probe-evidence-family.test.mjs` (complete)

Matrices mutate one independently constructed artifact fact, reseal synthetic hashes, then assert both rc and the reached private error through the public analyzer. Hash-failure tests deliberately do not reseal. No original test is deleted, skipped, weakened or relabeled.
```js
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
  sibling[0].payload.id = "sibling"; sibling[1].payload.turn_id = sibling[3].payload.turn_id = "sibling-turn";
  f.proof.sources.sibling = {file:"evidence/sibling.jsonl"};
  f.proof.sessions.push({id:"sibling", role:"child", source:"sibling"}); setSource(f, "sibling", sibling);
  const start = structuredClone(f.events[1]), end = structuredClone(f.events[2]);
  start.item.id = end.item.id = "spawn-2"; end.item.receiver_thread_ids = ["sibling"];
  f.events.splice(3, 0, start, end); f.usageRows.unshift({...f.row, cid:"unrelated", wireValue:"default"}); saveFamily(f);
  const r = analyzeRun(f.root); assert.equal(r.sessions.length, 3); assert.equal(r.family.requestCount, 2);
  assert.deepEqual(r.family.inventory.map(s => s.id), ["child", "sibling"]);
  assert.deepEqual(r.family.requests.map(s => s.line), [2, 3]); assert.ok(r.sessions.every(s => s.requests === null));
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
  ["missing context effort", 2, /missing proof field/, f => { delete f.childRows[2].effort; }],
  ["missing runtime pointer", 2, /missing observed JSON Pointer/, f => { delete f.proof.runtimePointers.effort; }],
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
  const f = familyFixture(t); f.childRows.splice(3, 0, {...f.childRows[2], [field]:"different"}); saveFamily(f);
  assert.throws(() => analyzeRun(f.root), new RegExp(`effective ${field} mismatch`)); assertVerdict(() => analyzeRun(f.root), 1);
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
```

## Integration, verification and honest residuals

Field chain: operator creates explicit schema/mode/nativeAudit/review/sessions → private proof.json and review JSONL serialize them → `analyzeRun` dispatch + fixed native helpers deserialize/validate → CLI JSON and portable tests consume scoped session/family report. No recorder creation path changes; no production consumer. `rg` found only analyzer CLI plus portable/recorder tests consuming `analyzeRun`; benchmark comparison remains untouched. Main's 040/acceptance tables must not consume `familyComparisonEligibleForReview` as the old per-thread gate. Do not rewrite historical schema-1 outcomes or original run.json hashes.

Prospective commands, main on macmini only, from its verified candidate source root (NOT RUN here):
```sh
node --test plugins/codexclaw/test/probe-evidence.test.mjs plugins/codexclaw/test/probe-evidence-family.test.mjs plugins/codexclaw/test/probe-recorder.test.mjs plugins/codexclaw/test/probe-compiled-hooks.test.mjs
node --check plugins/codexclaw/scripts/probe-evidence.mjs
node --check plugins/codexclaw/test/probe-fixtures/evidence.mjs
node --check plugins/codexclaw/test/probe-evidence-family.test.mjs
git diff --check
wc -l plugins/codexclaw/scripts/probe-evidence.mjs plugins/codexclaw/test/probe-fixtures/evidence.mjs plugins/codexclaw/test/probe-evidence-family.test.mjs
```
Direct file arguments observe proposed source/test targets; imports trace to the analyzer and fixtures shown above. No code gate proves this Markdown's semantics: main reviews this page. RED: add fixture/tests without analyzer hunks; new positive-family case must fail `invalid proof manifest`. GREEN: apply analyzer hunks, rerun original plus new tests; retain output/rc/no-skip accounting. Mutation checks main should run remotely: remove child-inventory equality, change shared session binding to child ID, skip first matched usage row, or allocate family requests into sessions; corresponding negative/positive assertions must go red, then restore and rerun. No claimed TDD until artifacts exist.

Owned historical originals: `.codexclaw/evidence/01a0702d-c493-7510-801f-7d8772a2689c/wp2-native/runs/wp2-{baseline,candidate}-c2-001/family-observation/` contains original parent/child rollouts and `family-usage.jsonl`; original `output/stdout.jsonl` contains spawn start/completion records. Baseline IDs `01a070b0-4a51-7970-b708-6bf12c2d2103` / `01a070b1-6716-7102-9d25-eee496b78541`; candidate IDs `01a070b2-7252-7d90-ac19-b8e8ea5afe47` / `01a070b3-a9ce-7f82-86b2-17c1975cdb45`. Main may prepare a separate private analysis packet with copied originals, source snapshots and newly reviewed schema-2 proof; never overwrite partial `output-complete` or original schema-1 proof. Invoke existing `node plugins/codexclaw/scripts/probe-evidence.mjs run "$ANALYSIS_OUTPUT"` only after that explicitly owned path exists; this variable denotes main's new private analysis directory, not a supplied live path. Historical report.json is context, never substituted for raw proof. If complete topology/usage cannot be verified, the honest expected outcome remains UNKNOWN, not a reason to build a collector.

Bypass ledger: tier = opt-in script plus E7 human methodology; surface = analyzer/main review; bypass = omit analyzer, forge bytes/hashes/review, or falsely assert complete originals; residual = authenticity and absence of unrecorded descendants/requests are not machine-proven; wording = eligible-for-review only, never enforcement or per-thread proof; final automatic enforcement layer = none. Review pins source hashes, not privileged attacker resistance. Root/direct-child support is intentionally narrower than all native capabilities. Scheduler confirmation and hook invocation counts remain unknown. Usage request count is counted once; no token/cost sums or per-child percentages are introduced. Main alone decides whether scoped family evidence can answer a particular paired criterion without weakening that criterion.
