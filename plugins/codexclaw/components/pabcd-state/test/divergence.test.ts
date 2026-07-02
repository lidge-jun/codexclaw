import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discardStreak,
  readDivergenceCandidates,
  readDivergenceMode,
  recordDivergenceCandidate,
  writeDivergenceMode,
} from "../src/divergence.ts";
import { runDivergenceCli } from "../src/divergence-cli.ts";
import { STATE_DIR } from "../src/state.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-divergence-"));
}

test("divergence mode: writes and reads session-scoped mode", () => {
  const cwd = freshCwd();
  try {
    const mode = writeDivergenceMode(cwd, {
      sessionId: "s1",
      active: true,
      collapsePoint: "D",
      reason: "flat objective metric",
      now: () => "2026-07-01T00:00:00.000Z",
    });
    assert.equal(mode.active, true);
    assert.equal(readDivergenceMode(cwd, "s1")?.collapsePoint, "D");
    assert.equal(readDivergenceMode(cwd, "other"), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("candidate archive: requires source provenance and filters by session", () => {
  const cwd = freshCwd();
  try {
    assert.throws(
      () =>
        recordDivergenceCandidate(cwd, {
          sessionId: "s1",
          kind: "strong-1",
          title: "No source",
          rationale: "memory only",
          sourceUrls: [],
        }),
      /source URL/,
    );
    recordDivergenceCandidate(cwd, {
      sessionId: "s1",
      kind: "strong-1",
      title: "Alpha",
      rationale: "primary path",
      sourceUrls: ["https://example.com/a", "https://example.com/a"],
      now: () => "2026-07-01T00:01:00.000Z",
    });
    recordDivergenceCandidate(cwd, {
      sessionId: "s2",
      kind: "add-1",
      title: "Beta",
      rationale: "alternative",
      sourceUrls: ["https://example.com/b"],
    });
    const s1 = readDivergenceCandidates(cwd, "s1");
    assert.equal(s1.length, 1);
    assert.deepEqual(s1[0].sourceUrls, ["https://example.com/a"]);
    assert.equal(readDivergenceCandidates(cwd).length, 2);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("candidate archive: roundtrips loop metadata and tolerates legacy rows", () => {
  const cwd = freshCwd();
  try {
    recordDivergenceCandidate(cwd, {
      sessionId: "s1",
      kind: "strong-1",
      title: "State redesign",
      rationale: "widen state representation",
      sourceUrls: ["https://example.com/state"],
      status: "discarded",
      changeClass: "state-space-redesign",
      killedAtPhase: "D",
      now: () => "2026-07-01T00:01:00.000Z",
    });
    const dir = join(cwd, STATE_DIR, "divergence");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "candidates.jsonl"),
      `${JSON.stringify({
        ts: "2026-07-01T00:00:00.000Z",
        sessionId: "s1",
        id: "legacy",
        kind: "add-1",
        title: "Legacy",
        rationale: "old row",
        sourceUrls: ["https://example.com/legacy"],
        status: "discarded",
      })}\n`,
      { flag: "a" },
    );

    const candidates = readDivergenceCandidates(cwd, "s1");
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].changeClass, "state-space-redesign");
    assert.equal(candidates[0].killedAtPhase, "D");
    assert.equal(candidates[1].title, "Legacy");
    assert.equal(candidates[1].changeClass, undefined);
    assert.equal(candidates[1].killedAtPhase, undefined);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("discardStreak: reports trailing discarded same-class run", () => {
  const base = {
    sessionId: "s1",
    kind: "strong-1" as const,
    rationale: "r",
    sourceUrls: ["https://example.com"],
  };
  assert.deepEqual(discardStreak([]), { changeClass: null, length: 0 });
  assert.deepEqual(
    discardStreak([
      { ...base, ts: "2026-07-01T00:00:00.000Z", id: "a", title: "A", status: "discarded", changeClass: "parameter-tweak" },
      { ...base, ts: "2026-07-01T00:01:00.000Z", id: "b", title: "B", status: "kept", changeClass: "parameter-tweak" },
    ]),
    { changeClass: null, length: 0 },
  );
  assert.deepEqual(
    discardStreak([
      { ...base, ts: "2026-07-01T00:03:00.000Z", id: "d", title: "D", status: "discarded", changeClass: "parameter-tweak" },
      { ...base, ts: "2026-07-01T00:01:00.000Z", id: "b", title: "B", status: "discarded", changeClass: "branch-toggle" },
      { ...base, ts: "2026-07-01T00:02:00.000Z", id: "c", title: "C", status: "discarded", changeClass: "parameter-tweak" },
      { ...base, ts: "2026-07-01T00:00:00.000Z", id: "a", title: "A", status: "discarded", changeClass: "branch-toggle" },
    ]),
    { changeClass: "parameter-tweak", length: 2 },
  );
  assert.deepEqual(
    discardStreak([
      { ...base, ts: "2026-07-01T00:00:00.000Z", id: "a", title: "A", status: "discarded", changeClass: "parameter-tweak" },
      { ...base, ts: "2026-07-01T00:01:00.000Z", id: "b", title: "B", status: "discarded", changeClass: "parameter-tweak" },
      { ...base, ts: "2026-07-01T00:02:00.000Z", id: "c", title: "C", status: "discarded", changeClass: "parameter-tweak" },
    ]),
    { changeClass: "parameter-tweak", length: 3 },
  );
});

test("runDivergenceCli: mode and candidate add/list", () => {
  const cwd = freshCwd();
  try {
    const mode = runDivergenceCli(["mode", "on", "--session", "cli", "--collapse", "D", "--reason", "plateau", "--json"], cwd);
    assert.equal(mode.code, 0);
    assert.equal(JSON.parse(mode.output).active, true);

    const add = runDivergenceCli(
      [
        "candidate",
        "add",
        "--session",
        "cli",
        "--kind",
        "strong-1",
        "--title",
        "Main path",
        "--rationale",
        "best grounded option",
        "--source",
        "https://example.com/source",
        "--change-class",
        "parameter-tweak",
        "--killed-at-phase",
        "D",
        "--json",
      ],
      cwd,
    );
    assert.equal(add.code, 0, add.output);
    assert.equal(JSON.parse(add.output).kind, "strong-1");
    assert.equal(JSON.parse(add.output).changeClass, "parameter-tweak");
    assert.equal(JSON.parse(add.output).killedAtPhase, "D");

    const list = runDivergenceCli(["candidate", "list", "--session", "cli", "--json"], cwd);
    assert.equal(list.code, 0);
    assert.equal(JSON.parse(list.output).candidates.length, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("runDivergenceCli: --cwd writes to the owner archive, not the caller worktree", () => {
  const owner = freshCwd();
  const childWorktree = freshCwd();
  try {
    const add = runDivergenceCli(
      [
        "candidate",
        "add",
        "--session",
        "cli",
        "--cwd",
        owner,
        "--kind",
        "add-1",
        "--title",
        "Child idea",
        "--rationale",
        "recorded from an isolated worktree",
        "--source",
        "https://example.com/child",
      ],
      childWorktree,
    );
    assert.equal(add.code, 0, add.output);
    assert.equal(readDivergenceCandidates(owner, "cli").length, 1);
    assert.equal(readDivergenceCandidates(childWorktree, "cli").length, 0);
  } finally {
    rmSync(owner, { recursive: true, force: true });
    rmSync(childWorktree, { recursive: true, force: true });
  }
});
