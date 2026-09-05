// Synthetic analyzer data and independent assertions, shared without registration.
import assert from "node:assert/strict";
import { verdict } from "../../scripts/probe-evidence.mjs";
import { sha, jsonl, tempRoot, put, putJson } from "./filesystem.mjs";

const checks = ["manifest", "hooks", "hook-trust", "install-root"];
export const doctorReport = () => ({ checks: checks.map(name => ({ name, severity: "PASS" })) });
export const runtimeRows = (id = "abc") => [
  { type: "session_meta", payload: { id } },
  { type: "turn_context", model: "gpt-6-astra", effort: "high" },
];

export function fixture(t) {
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

export function setSource(f, key, rows) {
  const text = jsonl(rows);
  put(f.root, f.proof.sources[key].file, text);
  f.proof.sources[key].sha256 = sha(text); // independent node:crypto oracle
  putJson(f.root, "proof.json", f.proof);
}

export function setArtifact(f, name, text) {
  put(f.root, name, text);
  f.run.files[name] = sha(text);
  putJson(f.root, "run.json", f.run);
}

export function assertVerdict(action, rc) {
  const result = verdict(action);
  assert.equal(result.rc, rc, JSON.stringify(result));
  assert.equal(result.report.state, ["eligible-for-review", "failed", "unknown"][rc]);
  if (rc !== 0) {
    assert.equal(result.report.pairedComparisonEligible, undefined);
    assert.equal(result.report.comparison, undefined);
  }
  return result;
}

export function bench() {
  return { schemaVersion: 1, platform: "darwin", release: "fixture", nodeVersion: "v24-fixture", harnessSha256: "same",
    iterations: 3, hooks: [{ name: "guard", event: "PreToolUse", aboveFloorMs: 10,
      errorCount: 0, invocations: 3, stdoutBytes: 0, stderrBytes: 0 }] };
}

export function familyFixture(t) {
  const f = fixture(t);
  f.proof.schemaVersion = 2; f.proof.correlationMode = "native-shared-family-v1";
  f.proof.runtimePointers = {model:"/payload/model", effort:"/payload/effort"};
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
  const {model, effort} = runtimeRows()[1];
  const rows = (id, child) => [{type:"session_meta", payload:{id, session_id:"abc", cli_version:"0.146.0", history_mode:"legacy",
    source:child ? {subagent:{thread_spawn:{parent_thread_id:"abc", depth:1}}} : "exec",
    thread_source:child ? "subagent" : "user", ...(child ? {parent_thread_id:"abc", multi_agent_version:"v1"} : {})}},
    {type:"event_msg", payload:{type:"task_started", turn_id:id + "-turn"}},
    {type:"turn_context", payload:{model, effort, turn_id:id + "-turn", multi_agent_version:"v1"}},
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
