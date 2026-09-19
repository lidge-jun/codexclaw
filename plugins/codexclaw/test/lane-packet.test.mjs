import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validateLanePacket, validateLanePacketSet } from "../scripts/check-lane-packet.mjs";
import { checkBounds } from "../scripts/check-host-bounds.mjs";

// LANE-PACKET-01 is a decision, not a phrase: these exercise the validator on the cases
// that actually go wrong when a coordinator dispatches lanes.
const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const base = () => ({
  lane: "lane-1",
  address: { threadId: "01a0b875-9bb1", hostId: "local" },
  work: { writeScope: ["plugins/codexclaw/skills/loop"], base: "dev", branch: "codex/lane-1" },
  reporting: { evidence: ["branch head sha", "CI run id"], onBlocked: "report and stop" },
});

test("a minimal non-looping packet is accepted and its defaults are explicit", () => {
  const r = validateLanePacket(base());
  assert.ok(r.ok, r.errors.join("; "));
  assert.deepEqual(r.resolved, { lane: "lane-1", mode: "bound", loop: false, push: false, openPr: false, merge: false, mergeTarget: null });
});

test("a dispatch packet carries no address, because creation has not returned one", () => {
  const p = base();
  delete p.address;
  const r = validateLanePacket(p, { mode: "dispatch" });
  assert.ok(r.ok, r.errors.join("; "));
  assert.equal(r.resolved.mode, "dispatch");
});

test("a dispatch packet that already claims an address is refused", () => {
  const r = validateLanePacket(base(), { mode: "dispatch" });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /creation has not returned one yet/);
});

test("a bound packet missing its address is refused", () => {
  const p = base();
  delete p.address;
  const r = validateLanePacket(p, { mode: "bound" });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /bound packet requires address/);
});

test("a recorded provisional id copied into threadId is refused", () => {
  const p = base();
  p.address.provisionalId = p.address.threadId;
  const r = validateLanePacket(p);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /repeats the recorded provisionalId/);
});

test("a lane told to loop without an objective is told to invent a goal", () => {
  const p = base();
  p.authority = { loop: true };
  p.work.criteria = ["tests green"];
  const r = validateLanePacket(p);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /work\.objective/);
});

test("a looping lane without criteria decides its own completion", () => {
  const p = base();
  p.authority = { loop: true };
  p.work.objective = "land the parser fix";
  const r = validateLanePacket(p);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /work\.criteria/);
});

test("a complete looping packet is accepted", () => {
  const p = base();
  p.authority = { loop: true };
  p.work.objective = "land the parser fix";
  p.work.criteria = ["tests green", "PR opened"];
  const r = validateLanePacket(p);
  assert.ok(r.ok, r.errors.join("; "));
  assert.equal(r.resolved.loop, true);
});

test("a merge target without the grant is not a grant", () => {
  const p = base();
  p.authority = { mergeTarget: "codex/lane-1" };
  const r = validateLanePacket(p);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /not a grant/);
});

test("a granted merge must name this lane's own branch", () => {
  const p = base();
  p.authority = { merge: true, mergeTarget: "codex/lane-2" };
  const r = validateLanePacket(p);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /own branch/);
});

test("a granted merge on its own branch resolves to an explicit target", () => {
  const p = base();
  p.authority = { merge: true, push: true, mergeTarget: "codex/lane-1" };
  const r = validateLanePacket(p);
  assert.ok(r.ok, r.errors.join("; "));
  assert.equal(r.resolved.mergeTarget, "codex/lane-1");
});

test("merge without push is refused: a lane that cannot push cannot land", () => {
  const p = base();
  p.authority = { merge: true, mergeTarget: "codex/lane-1" };
  const r = validateLanePacket(p);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /cannot push cannot land/);
});

test("opening a pull request needs a pushed branch", () => {
  const p = base();
  p.authority = { openPr: true };
  const r = validateLanePacket(p);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /needs a pushed branch/);
});

test("a provisional clientThreadId is refused as an address", () => {
  const p = base();
  p.address.clientThreadId = "pending-xyz";
  const r = validateLanePacket(p);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /provisional id/);
});

test("a host id outside the accepted charset is refused", () => {
  const p = base();
  p.address.hostId = "remote ssh/host";
  assert.equal(validateLanePacket(p).ok, false);
});

test("overlapping write scopes across two lanes are caught before dispatch", () => {
  const a = base(), b = base();
  b.lane = "lane-2";
  b.work.branch = "codex/lane-2";
  b.work.writeScope = ["plugins/codexclaw/skills/loop/references"];
  const r = validateLanePacketSet({ lanes: [a, b] });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /write scopes overlap/);
});

test("an aliased path cannot hide an overlap", () => {
  const a = base(), b = base();
  b.lane = "lane-2";
  b.work.branch = "codex/lane-2";
  b.work.writeScope = ["plugins/codexclaw/skills/pabcd/../loop/references"];
  const r = validateLanePacketSet({ lanes: [a, b] });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /write scopes overlap/);
});

test("two lanes claiming one branch are caught", () => {
  const a = base(), b = base();
  b.lane = "lane-2";
  b.work.writeScope = ["docs"];
  const r = validateLanePacketSet({ lanes: [a, b] });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /same branch/);
});

test("disjoint lanes pass as a set", () => {
  const a = base(), b = base();
  b.lane = "lane-2";
  b.work.branch = "codex/lane-2";
  b.work.writeScope = ["docs"];
  const r = validateLanePacketSet({ lanes: [a, b] });
  assert.ok(r.ok, r.errors.join("; "));
  assert.equal(r.lanes, 2);
});

test("the CLI exits 1 on an invalid packet and 0 on a valid one", () => {
  const dir = mkdtempSync(join(tmpdir(), "lane-packet-"));
  try {
    const script = join(pluginRoot, "scripts", "check-lane-packet.mjs");
    const good = join(dir, "good.json"), bad = join(dir, "bad.json");
    writeFileSync(good, JSON.stringify(base()));
    const broken = base();
    delete broken.reporting;
    writeFileSync(bad, JSON.stringify(broken));
    assert.equal(spawnSync(process.execPath, [script, good], { encoding: "utf8", timeout: 20000 }).status, 0);
    const fail = spawnSync(process.execPath, [script, bad], { encoding: "utf8", timeout: 20000 });
    assert.equal(fail.status, 1);
    assert.match(fail.stderr, /reporting is required/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Drift detection between the recorded host bounds and the document that quotes them.
// The fixture is the single source; check-host-bounds.mjs re-derives it from the
// artifacts where they exist.
const fixture = JSON.parse(readFileSync(join(pluginRoot, "test", "fixtures", "host-thread-bounds.json"), "utf8"));
const laneDoc = readFileSync(join(pluginRoot, "skills", "loop", "references", "lane-dispatch.md"), "utf8");

for (const id of ["wait_threads.targets.max", "wait_threads.timeoutMs.max", "worktree.retention.keepCount"]) {
  test("lane-dispatch quotes the recorded bound " + id, () => {
    const bound = fixture.bounds.find((b) => b.id === id);
    assert.ok(bound, "fixture is missing " + id);
    assert.ok(laneDoc.includes(String(bound.value)), id + " drifted between the fixture and lane-dispatch.md");
  });
}

test("every recorded bound carries an evidence locator", () => {
  for (const entry of [...fixture.bounds, ...fixture.shapes])
    assert.ok(typeof entry.evidence === "string" && entry.evidence.trim().length > 0, entry.id + " has no evidence locator");
});

test("the subagent cap and its failure string are recorded together", () => {
  const cap = fixture.bounds.find((b) => b.id === "subagents.maxThreads.defaultV1");
  const err = fixture.shapes.find((s) => s.id === "subagents.limit.error");
  assert.equal(cap.value, 6);
  assert.equal(err.value, "agent thread limit reached");
  assert.ok(laneDoc.includes(err.value), "the document must name the failure a caller will actually see");
});

// Anchored drift checks. "The number appears somewhere in the file" is too weak: these
// require the bound to appear on the line that actually describes the call.
const skills = join(pluginRoot, "skills");
const lineWith = (file, needle) =>
  readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.includes(needle));
const boundValue = (id) => String(fixture.bounds.find((b) => b.id === id).value);

test("waiting.md states the wait bounds on the line that describes wait_threads", () => {
  const lines = lineWith(join(skills, "loop", "references", "waiting.md"), "wait_threads");
  const stated = lines.filter((l) => l.includes(boundValue("wait_threads.targets.max")));
  assert.ok(stated.length > 0, "waiting.md does not state the target bound where it describes the wait");
  const doc = readFileSync(join(skills, "loop", "references", "waiting.md"), "utf8");
  assert.ok(doc.includes(boundValue("wait_threads.timeoutMs.max")), "the timeout bound drifted out of waiting.md");
});

test("the delegation thread-surface table carries the measured bounds", () => {
  const table = readFileSync(join(skills, "pabcd", "references", "delegation.md"), "utf8");
  for (const id of ["wait_threads.targets.max", "wait_threads.timeoutMs.max", "read_thread.turnLimit.max", "read_thread.maxOutputCharsPerItem.max", "list_threads.limit.max", "get_handoff_status.waitMs.max"])
    assert.ok(table.includes(boundValue(id)), id + " is missing from the delegation table");
});

test("dispatch-surfaces states the subagent cap and routes to the lane contract", () => {
  const doc = readFileSync(join(skills, "pabcd", "references", "dispatch-surfaces.md"), "utf8");
  assert.ok(doc.includes("DISPATCH-FANOUT-CAP-01"), "the fan-out rule is missing");
  assert.ok(doc.includes(boundValue("subagents.maxThreads.defaultV1")), "the subagent cap drifted");
  assert.ok(doc.includes("](../../loop/references/lane-dispatch.md)"), "dispatch-surfaces does not route to the lane contract");
});

test("a missing artifact is NOT RUN, never a pass", () => {
  const report = checkBounds(fixture, { appAsar: "/nonexistent/app.asar", codexSource: "/nonexistent/codex" });
  assert.equal(report.verdict, "PARTIAL");
  assert.equal(report.passed, 0);
  assert.equal(report.notRun, fixture.bounds.length + fixture.shapes.length);
  assert.ok(report.results.every((r) => r.status !== "PASS"));
});

test("a drifted value is reported as drift, not silence", () => {
  const tampered = JSON.parse(JSON.stringify(fixture));
  tampered.bounds = [{ id: "wait_threads.targets.max", value: 99, evidence: fixture.bounds[0].evidence }];
  tampered.shapes = [];
  const report = checkBounds(tampered, { appAsar: fixture.artifacts.appAsar, codexSource: fixture.artifacts.codexSource });
  if (report.results[0].status === "NOT_RUN") return; // artifact absent on this machine
  assert.equal(report.verdict, "FAIL");
});
