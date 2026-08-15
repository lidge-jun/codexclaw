/**
 * release-cli.test.ts — the producer side of the release gate.
 *
 * release-gate.test.ts proves the PREDICATE; these prove it is WIRED: a candidate
 * can be assembled from receipts, and every refusal path is reachable through the
 * CLI rather than only through a hand-built object.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runReleaseCli, TRAIN_RECEIPTS } from "../src/release-cli.ts";
import { MLB_1_0_RECEIPTS, type CandidateManifest } from "../src/release-gate.ts";

const SHA = "deadbeefcafe1234";
const HASH = "sha256:" + "a".repeat(64);

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "cxc-release-"));
}

function candidatePath(cwd: string): string {
  return join(cwd, ".codexclaw", "release", "candidate-0.2.0-beta.1.json");
}

function read(cwd: string): CandidateManifest {
  return JSON.parse(readFileSync(candidatePath(cwd), "utf8")) as CandidateManifest;
}

function init(cwd: string): void {
  const r = runReleaseCli(["init", "--version", "0.2.0-beta.1", "--sha", SHA], cwd);
  assert.equal(r.code, 0, r.output);
}

/** Fill every train receipt plus tests/inventory/platforms on the candidate SHA. */
function complete(cwd: string, overrides: { publishedTests?: number } = {}): void {
  for (const r of TRAIN_RECEIPTS) {
    const res = runReleaseCli(
      ["receipt", "--name", r.name, "--evidence", "run://evidence/" + r.name, "--sha", SHA],
      cwd,
    );
    assert.equal(res.code, 0, res.output);
  }
  runReleaseCli(["tests", "--pass", "1639", "--fail", "0", "--sha", SHA], cwd);
  runReleaseCli(
    [
      "inventory",
      "--hash", HASH,
      "--skills", "28",
      "--hooks", "21",
      "--published-tests", String(overrides.publishedTests ?? 1639),
    ],
    cwd,
  );
  for (const [platform, run] of [["ubuntu", "111"], ["windows", "222"], ["macos", "333"]]) {
    runReleaseCli(["platform", "--platform", platform, "--sha", SHA, "--ci-run", run], cwd);
  }
}

test("init seeds both receipt sets: train receipts missing, MLB receipts deferred with reasons", () => {
  const cwd = scratch();
  try {
    init(cwd);
    const m = read(cwd);
    assert.equal(m.candidateSha, SHA);
    assert.equal(m.receipts.length, TRAIN_RECEIPTS.length + MLB_1_0_RECEIPTS.length);
    for (const r of TRAIN_RECEIPTS) {
      assert.equal(m.receipts.find((x) => x.name === r.name)?.status, "missing");
    }
    for (const r of MLB_1_0_RECEIPTS) {
      const seeded = m.receipts.find((x) => x.name === r.name);
      assert.equal(seeded?.status, "deferred");
      assert.ok(seeded?.deferredReason, "a deferred receipt must carry a reason");
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a fresh candidate refuses; a completed 0.2.0 accepts with no flag at all", () => {
  // wp7 changed this contract. The MLB receipts are scoped to the 1.0 line, so a
  // 0.2.x release is exempt automatically — --allow-deferred is no longer needed,
  // and no longer waives anything.
  const cwd = scratch();
  try {
    init(cwd);
    const fresh = runReleaseCli(["verify"], cwd);
    assert.equal(fresh.code, 1, "a fresh candidate must not verify");
    assert.match(fresh.output, /NOT READY/);

    complete(cwd);
    const stable = runReleaseCli(["verify"], cwd);
    assert.equal(stable.code, 0, stable.output);
    assert.match(stable.output, /READY/);

    // the flag is accepted and recorded, but changes nothing
    const withFlag = runReleaseCli(["verify", "--allow-deferred"], cwd);
    assert.equal(withFlag.code, 0, withFlag.output);
    assert.equal(read(cwd).allowedDeferred, true, "the request is recorded as provenance");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a 1.0.0 candidate is refused, and --allow-deferred does not rescue it", () => {
  const cwd = scratch();
  try {
    const r = runReleaseCli(["init", "--version", "1.0.0", "--sha", SHA], cwd);
    assert.equal(r.code, 0, r.output);
    for (const rc of TRAIN_RECEIPTS) {
      runReleaseCli(["receipt", "--version", "1.0.0", "--name", rc.name, "--evidence", "run://x", "--sha", SHA], cwd);
    }
    runReleaseCli(["tests", "--version", "1.0.0", "--pass", "1660", "--fail", "0", "--total", "1660", "--sha", SHA], cwd);
    runReleaseCli(["inventory", "--version", "1.0.0", "--hash", HASH, "--skills", "28", "--hooks", "21", "--published-tests", "1660"], cwd);
    for (const [p, run] of [["ubuntu", "1"], ["windows", "2"], ["macos", "3"]]) {
      runReleaseCli(["platform", "--version", "1.0.0", "--platform", p, "--sha", SHA, "--ci-run", run], cwd);
    }
    for (const args of [["verify", "--version", "1.0.0"], ["verify", "--version", "1.0.0", "--allow-deferred"]]) {
      const result = runReleaseCli(args, cwd);
      assert.equal(result.code, 1, args.join(" ") + " -> " + result.output);
      assert.match(result.output, /activation-baseline deferred/);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("classify shares one parser with the workflow", () => {
  const cwd = scratch();
  try {
    const cases: Array<[string, string]> = [
      ["0.2.0-beta.1", "prerelease"],
      ["0.2.0", "stable"],
      ["1.0.0", "stable"],
      // the substring test the workflow used called this a prerelease
      ["1.0.0+build-with-hyphen", "stable"],
      ["1.0.0-rc.1", "prerelease"],
    ];
    for (const [version, expected] of cases) {
      const r = runReleaseCli(["classify", "--version", version], cwd);
      assert.equal(r.code, 0, r.output);
      assert.equal(r.output, expected, version);
    }
    assert.equal(runReleaseCli(["classify", "--version", "nonsense"], cwd).code, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("--allow-deferred never excuses a missing train receipt", () => {
  const cwd = scratch();
  try {
    init(cwd);
    complete(cwd);
    runReleaseCli(["receipt", "--name", "build", "--status", "missing"], cwd);
    const r = runReleaseCli(["verify", "--allow-deferred"], cwd);
    assert.equal(r.code, 1);
    assert.match(r.output, /build is missing/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a platform tested on another SHA is refused", () => {
  const cwd = scratch();
  try {
    init(cwd);
    complete(cwd);
    runReleaseCli(["platform", "--platform", "windows", "--sha", "0000000000"], cwd);
    const r = runReleaseCli(["verify", "--allow-deferred"], cwd);
    assert.equal(r.code, 1);
    assert.match(r.output, /windows tested different SHA/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a receipt captured on another commit is refused as stale", () => {
  const cwd = scratch();
  try {
    init(cwd);
    complete(cwd);
    runReleaseCli(["receipt", "--name", "gate", "--evidence", "run://old", "--sha", "9999999999"], cwd);
    const r = runReleaseCli(["verify", "--allow-deferred"], cwd);
    assert.equal(r.code, 1);
    assert.match(r.output, /gate captured on 9999999999/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("an inventory hash differing from the checkout is refused", () => {
  const cwd = scratch();
  try {
    init(cwd);
    complete(cwd);
    const r = runReleaseCli(
      ["verify", "--allow-deferred", "--actual-inventory-hash", "sha256:" + "b".repeat(64)],
      cwd,
    );
    assert.equal(r.code, 1);
    assert.match(r.output, /inventory hash mismatch/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a stale published test count is refused beside a green fresh suite", () => {
  const cwd = scratch();
  try {
    init(cwd);
    complete(cwd, { publishedTests: 1213 });
    const r = runReleaseCli(["verify", "--allow-deferred"], cwd);
    assert.equal(r.code, 1);
    assert.match(r.output, /published tests=1213 but the measured suite reported 1639/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("candidate selection: zero, multiple, and conflicting selectors are explicit errors", () => {
  const cwd = scratch();
  try {
    const none = runReleaseCli(["verify"], cwd);
    assert.equal(none.code, 1);
    assert.match(none.output, /no candidate found/);

    init(cwd);
    const both = runReleaseCli(
      ["verify", "--version", "0.2.0-beta.1", "--candidate", candidatePath(cwd)],
      cwd,
    );
    assert.equal(both.code, 1);
    assert.match(both.output, /mutually exclusive/);

    runReleaseCli(["init", "--version", "0.3.0", "--sha", SHA], cwd);
    const ambiguous = runReleaseCli(["verify"], cwd);
    assert.equal(ambiguous.code, 1);
    assert.match(ambiguous.output, /multiple candidates/);

    const picked = runReleaseCli(["verify", "--version", "0.3.0"], cwd);
    assert.equal(picked.code, 1, "still not ready, but it resolved a single candidate");
    assert.match(picked.output, /NOT READY/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("receipt rejects an unknown name instead of inventing one", () => {
  const cwd = scratch();
  try {
    init(cwd);
    const r = runReleaseCli(["receipt", "--name", "not-a-receipt", "--evidence", "x", "--sha", SHA], cwd);
    assert.equal(r.code, 1);
    assert.match(r.output, /unknown receipt/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("verify --json reports blockers machine-readably", () => {
  const cwd = scratch();
  try {
    init(cwd);
    const r = runReleaseCli(["verify", "--json"], cwd);
    assert.equal(r.code, 1);
    const parsed = JSON.parse(r.output);
    assert.equal(parsed.ready, false);
    assert.equal(parsed.candidateSha, SHA);
    assert.ok(Array.isArray(parsed.blockers) && parsed.blockers.length > 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a corrupt candidate file is reported, not crashed on", () => {
  const cwd = scratch();
  try {
    init(cwd);
    writeFileSync(candidatePath(cwd), "{ not json");
    const r = runReleaseCli(["verify"], cwd);
    assert.equal(r.code, 1);
    assert.match(r.output, /not valid JSON/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
