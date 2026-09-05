// Portable synthetic analyzer contracts: registered on every OS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { conversationDigest, pointer, analyzeRun, analyzeBench } from "../scripts/probe-evidence.mjs";
import { sha, jsonl, readJson, tempRoot, put, putJson } from "./probe-fixtures/filesystem.mjs";
import { fixture, runtimeRows, setSource, setArtifact, assertVerdict, bench } from "./probe-fixtures/evidence.mjs";

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

for (const [baseline, candidate, rc] of [[0.00005, 10, 2], [10, 10, 0], [10, 12, 1]]) {
  test(`benchmark positive baseline ${baseline} to ${candidate} preserves comparison eligibility`, () => {
    const before = bench(), after = bench();
    before.hooks[0].aboveFloorMs = baseline;
    after.hooks[0].aboveFloorMs = candidate;
    const result = assertVerdict(() => analyzeBench(before, after, 10), rc);
    if (rc === 0) assert.equal(result.report.comparison.rows[0].deltaPct, 0);
  });
}

test("uncomputable baseline does not mask another hook regression or missing hook", () => {
  for (const missing of [false, true]) {
    const before = bench(), after = bench();
    before.hooks[0].aboveFloorMs = 0.00005;
    before.hooks.push({ ...bench().hooks[0], name: "other" });
    if (!missing) after.hooks.push({ ...bench().hooks[0], name: "other", aboveFloorMs: 12 });
    assertVerdict(() => analyzeBench(before, after, 10), 1);
  }
});
