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
const creation = () => ({ provisionalId: "pending-xyz", hostId: "local", requestedAt: "2026-09-22T12:00:00Z" });
const pending = () => {
  const p = base();
  delete p.address;
  return { ...p, mode: "pending", creation: creation() };
};

test("legacy no-mode dispatch and bound defaults remain address-based", () => {
  const p = base();
  assert.equal(validateLanePacket(p).resolved.mode, "bound");
  delete p.address;
  assert.equal(validateLanePacket(p).resolved.mode, "dispatch");
});

test("pending records creation without inventing an address", () => {
  const p = pending();
  p.creation.worktree = "/worktrees/lane-1";
  const r = validateLanePacket(p);
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.equal(r.resolved.mode, "pending");
  assert.equal("address" in p, false);
  delete p.mode;
  assert.equal(validateLanePacket(p).ok, false, "creation must not infer a mode");
  assert.equal(validateLanePacket(p, { mode: "pending" }).ok, true);
});

test("present malformed modes cannot fall back or be hidden by CLI options", () => {
  for (const mode of [null, false, 1, {}, "", " ", "unknown"]) {
    for (const options of [{}, { mode: "bound" }])
      assert.equal(validateLanePacket({ ...base(), mode }, options).ok, false, JSON.stringify({ mode, options }));
    assert.equal(validateLanePacket(base(), { mode }).ok, false);
  }
  for (const declared of ["dispatch", "pending", "bound"])
    for (const forced of ["dispatch", "pending", "bound"]) {
      if (declared === forced) continue;
      const r = validateLanePacket({ ...pending(), mode: declared }, { mode: forced });
      assert.equal(r.ok, false);
      assert.match(r.errors.join(" "), /conflict/);
    }
});

test("pending forbids any address property and dispatch forbids creation or provisional addresses", () => {
  for (const address of [undefined, null, {}, "", { provisionalId: "queued" }, { clientThreadId: "queued" }, base().address])
    assert.equal(validateLanePacket({ ...pending(), address }).ok, false);
  for (const value of [undefined, null, {}, creation()]) {
    const p = { ...pending(), mode: "dispatch", creation: value };
    assert.equal(validateLanePacket(p).ok, false);
  }
  for (const key of ["clientThreadId", "provisionalId"])
    for (const value of ["queued", "", null])
      assert.equal(validateLanePacket({ ...base(), mode: "dispatch", address: { [key]: value } }).ok, false);
});

test("pending requires creation and bound validates it whenever present", () => {
  const p = pending();
  delete p.creation;
  assert.equal(validateLanePacket(p).ok, false);
  for (const mode of ["pending", "bound"]) {
    const packet = mode === "pending" ? pending() : { ...base(), mode, creation: creation() };
    assert.equal(validateLanePacket(packet).ok, true);
    for (const invalid of [undefined, null, [], {}, "queued"])
      assert.equal(validateLanePacket({ ...packet, creation: invalid }).ok, false);
    for (const key of ["provisionalId", "hostId", "requestedAt"])
      for (const value of [undefined, null, "", " ", 123])
        assert.equal(validateLanePacket({ ...packet, creation: { ...creation(), [key]: value } }).ok, false, key);
    for (const worktree of [undefined, null, "", " ", 123])
      assert.equal(validateLanePacket({ ...packet, creation: { ...creation(), worktree } }).ok, false);
    assert.equal(validateLanePacket({ ...packet, creation: { ...creation(), hostId: "remote ssh/host" } }).ok, false);
  }
});

test("creation timestamps use canonical UTC syntax and real calendar dates", () => {
  for (const requestedAt of ["2024-02-29T23:59:59Z", "2026-09-22T12:00:00.123Z", "2000-02-29T00:00:00.000Z"])
    assert.equal(validateLanePacket({ ...pending(), creation: { ...creation(), requestedAt } }).ok, true, requestedAt);
  for (const requestedAt of ["2026-02-29T00:00:00Z", "2026-04-31T00:00:00Z", "1900-02-29T00:00:00Z", "2026-09-22T24:00:00Z", "2026-09-22T12:60:00Z", "2026-09-22T12:00:60Z", "2026-13-01T00:00:00Z", "2026-00-01T00:00:00Z", "2026-01-00T00:00:00Z", "2026-09-22", "2026-09-22T12:00:00", "2026-09-22T12:00:00+00:00", "2026-09-22T12:00:00.1Z", "2026-09-22T12:00:00.1234Z", "2026-09-22t12:00:00z", " 2026-09-22T12:00:00Z"])
    assert.equal(validateLanePacket({ ...pending(), creation: { ...creation(), requestedAt } }).ok, false, requestedAt);
});

test("bound refuses provisional copies from either recorded location", () => {
  for (const location of ["address", "creation"]) {
    const p = { ...base(), mode: "bound", creation: creation() };
    p[location].provisionalId = " " + p.address.threadId + " ";
    const r = validateLanePacket(p);
    assert.equal(r.ok, false);
    assert.match(r.errors.join(" "), /repeats the recorded provisionalId/);
  }
});

test("mixed packet sets retain their response shape and collision checks", () => {
  const a = pending(), b = base(), c = base();
  b.lane = "lane-2"; b.work.branch = "codex/lane-2"; b.work.writeScope = ["docs"];
  c.lane = "lane-3"; c.work.branch = "codex/lane-3"; c.work.writeScope = ["src"];
  delete c.address;
  assert.deepEqual(validateLanePacketSet({ lanes: [a, b, c] }), { ok: true, errors: [], lanes: 3 });
  b.work.writeScope = ["plugins/codexclaw/skills/pabcd/../loop/references"];
  assert.match(validateLanePacketSet({ lanes: [a, b] }).errors.join(" "), /write scopes overlap/);
  b.work.writeScope = ["docs"]; b.work.branch = a.work.branch;
  assert.match(validateLanePacketSet({ lanes: [a, b] }).errors.join(" "), /same branch/);
  b.work.branch = "codex/lane-2"; b.lane = a.lane;
  assert.match(validateLanePacketSet({ lanes: [a, b] }).errors.join(" "), /duplicate lane/);
});

test("CLI parses ordered options, reports mode, and rejects ambiguous arguments", () => {
  const dir = mkdtempSync(join(tmpdir(), "lane-pending-cli-"));
  try {
    const script = join(pluginRoot, "scripts", "check-lane-packet.mjs");
    const file = join(dir, "packet.json"), setFile = join(dir, "set.json");
    writeFileSync(file, JSON.stringify(pending()));
    const invoke = (args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 20000 });
    for (const args of [["--mode", "pending", file, "--json"], [file, "--json", "--mode", "pending"], ["--json", file]]) {
      const r = invoke(args);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(JSON.parse(r.stdout).resolved.mode, "pending");
    }
    assert.match(invoke([file]).stdout, /OK.*mode=pending/);
    for (const mode of ["dispatch", "bound"]) {
      const r = invoke([file, "--mode", mode]);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /conflict/);
    }
    for (const args of [[file, "--mode"], ["--mode", "--json", file], [file, "--mode", "pending", "--mode", "pending"], [file, "--json", "--json"], [file, "--mode", "unknown"], [file, "--unknown"], [file, file], ["--json"]]) {
      const r = invoke(args);
      assert.equal(r.status, 1, JSON.stringify(args));
      assert.ok(r.stderr.length > 0);
    }
    const p = pending(); delete p.mode;
    writeFileSync(file, JSON.stringify(p));
    assert.equal(invoke([file]).status, 1);
    assert.equal(invoke(["--mode", "pending", file]).status, 0);
    for (const mode of ["dispatch", "bound"]) {
      const packet = base(); packet.mode = mode;
      if (mode === "dispatch") delete packet.address;
      writeFileSync(file, JSON.stringify(packet));
      assert.match(invoke([file]).stdout, new RegExp("OK.*mode=" + mode));
      assert.equal(JSON.parse(invoke([file, "--json"]).stdout).resolved.mode, mode);
    }
    const b = base(); b.lane = "lane-2"; b.work.branch = "codex/lane-2"; b.work.writeScope = ["docs"];
    writeFileSync(setFile, JSON.stringify({ lanes: [pending(), b] }));
    assert.deepEqual(JSON.parse(invoke([setFile, "--json"]).stdout), { ok: true, errors: [], lanes: 2 });
    assert.equal(invoke([setFile, "--mode", "bound"]).status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
    // The entrypoint check must not depend on path separators: a "/"-split basename
    // comparison decides the CLI was never invoked on Windows and exits 0 silently.
    const ok = spawnSync(process.execPath, [script, good], { encoding: "utf8", timeout: 20000 });
    assert.match(ok.stdout, /lane-packet\] OK/, "the CLI produced no output, so its entrypoint check did not fire");
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
