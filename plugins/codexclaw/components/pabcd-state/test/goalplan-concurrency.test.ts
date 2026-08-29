import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
  GOALPLAN_LOCK_OWNER_FILE,
  advanceWorkPhase,
  buildGoalplan,
  closeFixedWorkPhase,
  goalplanDir,
  goalplanWriteLockDir,
  goalplanWriteLockStatus,
  readGoalplan,
  withGoalplanWriteLock,
  writeGoalplan,
  type Goalplan,
  type WorkPhaseStatus,
} from "../src/goalplan.ts";

function workspace(objective: string): { cwd: string; slug: string } {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-goalplan-lock-"));
  const plan = buildGoalplan({ objective });
  writeGoalplan(cwd, plan);
  return { cwd, slug: plan.slug };
}

// A same-process sequential A-then-B call proves nothing: B reads what A already
// persisted whether or not a lock exists. These writers run in real child
// processes and signal through files, so removing the lock lets both callbacks be
// active at once and the overlap sentinel appears.
const GOALPLAN_WRITER_SCRIPT = String.raw`
import { existsSync, rmSync, writeFileSync } from "node:fs";

const [
  goalplanUrl, cwd, slug, writer, enteredPath, activePath, peerActivePath,
  contendedPath, overlapPath, releasePath, donePath, mode,
] = process.argv.slice(1);
const { withGoalplanWriteLock, writeGoalplan } = await import(goalplanUrl);

function waitForAny(paths) {
  const deadline = Date.now() + 10_000;
  while (!paths.some((path) => path !== "-" && existsSync(path))) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for: " + paths.join(", "));
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
}

const delays = [];
try {
  const retryDelaysMs = mode === "timeout" ? [5, 10, 20, 40] : [50, 50, 50, 50];
  const options = writer === "b"
    ? {
        retryDelaysMs,
        sleep(ms) {
          delays.push(ms);
          writeFileSync(contendedPath, String(ms) + "\n");
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
        },
      }
    : {};

  const result = withGoalplanWriteLock(cwd, slug, (plan) => {
    writeFileSync(activePath, writer + "\n");
    try {
      if (peerActivePath !== "-" && existsSync(peerActivePath)) {
        writeFileSync(overlapPath, writer + " overlapped its peer\n");
      }
      writeGoalplan(cwd, {
        ...plan,
        workPhases: [
          ...plan.workPhases,
          { id: "wp-" + writer, title: writer.toUpperCase(), status: "pending", tasks: [], criteriaIds: [] },
        ],
      });
      writeFileSync(enteredPath, writer + "\n");
      if (writer === "a") waitForAny(releasePath === "-" ? [contendedPath, overlapPath] : [releasePath]);
      return writer;
    } finally {
      rmSync(activePath, { force: true });
    }
  }, options);

  process.stdout.write(JSON.stringify({ result, delays }));
} finally {
  if (donePath !== "-") writeFileSync(donePath, writer + "\n");
}
`;

interface GoalplanWriterRun {
  cwd: string;
  slug: string;
  writer: "a" | "b";
  enteredPath: string;
  activePath: string;
  peerActivePath?: string;
  contendedPath: string;
  overlapPath: string;
  releasePath?: string;
  donePath?: string;
  mode: "holder" | "handoff" | "timeout";
}

function runGoalplanWriter(run: GoalplanWriterRun): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [
      "--experimental-strip-types", "--input-type=module", "-e", GOALPLAN_WRITER_SCRIPT,
      new URL("../src/goalplan.ts", import.meta.url).href,
      run.cwd, run.slug, run.writer, run.enteredPath, run.activePath,
      run.peerActivePath ?? "-", run.contendedPath, run.overlapPath,
      run.releasePath ?? "-", run.donePath ?? "-", run.mode,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectChild);
    child.on("close", (status) => resolveChild({ status, stdout, stderr }));
  });
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${path}`);
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, 5));
  }
}

test("real concurrent writers never overlap and preserve both updates", async () => {
  const { cwd, slug } = workspace("preserve concurrent updates");
  const enteredA = join(cwd, "writer-a-entered");
  const activeA = join(cwd, "writer-a-active");
  const enteredB = join(cwd, "writer-b-entered");
  const activeB = join(cwd, "writer-b-active");
  const contendedB = join(cwd, "writer-b-contended");
  const overlap = join(cwd, "writers-overlapped");

  try {
    const first = runGoalplanWriter({
      cwd, slug, writer: "a", enteredPath: enteredA, activePath: activeA,
      contendedPath: contendedB, overlapPath: overlap, mode: "holder",
    });
    await waitForFile(enteredA);

    const second = runGoalplanWriter({
      cwd, slug, writer: "b", enteredPath: enteredB, activePath: activeB,
      peerActivePath: activeA, contendedPath: contendedB, overlapPath: overlap, mode: "handoff",
    });
    const [a, b] = await Promise.all([first, second]);

    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(JSON.parse(a.stdout).result.kind, "ok");
    assert.equal(JSON.parse(b.stdout).result.kind, "ok");
    assert.equal(existsSync(contendedB), true, "writer B must observe the held lock");
    assert.equal(existsSync(overlap), false, "writer callbacks must never overlap");
    assert.deepEqual(readGoalplan(cwd, slug)!.workPhases.map((workPhase) => workPhase.id), ["wp-a", "wp-b"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a real contender waits 75ms, times out, and never enters its callback", async () => {
  const { cwd, slug } = workspace("bounded lock wait");
  const dir = goalplanWriteLockDir(cwd, slug);
  const enteredA = join(cwd, "timeout-holder-entered");
  const activeA = join(cwd, "timeout-holder-active");
  const enteredB = join(cwd, "timeout-contender-entered");
  const activeB = join(cwd, "timeout-contender-active");
  const contendedB = join(cwd, "timeout-contender-contended");
  const overlap = join(cwd, "timeout-writers-overlapped");
  const contenderDone = join(cwd, "timeout-contender-done");

  try {
    const holder = runGoalplanWriter({
      cwd, slug, writer: "a", enteredPath: enteredA, activePath: activeA,
      contendedPath: contendedB, overlapPath: overlap, releasePath: contenderDone, mode: "holder",
    });
    await waitForFile(enteredA);

    const contender = runGoalplanWriter({
      cwd, slug, writer: "b", enteredPath: enteredB, activePath: activeB,
      peerActivePath: activeA, contendedPath: contendedB, overlapPath: overlap,
      donePath: contenderDone, mode: "timeout",
    });
    const [a, b] = await Promise.all([holder, contender]);

    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    const report = JSON.parse(b.stdout) as { result: { kind: string; reason?: string }; delays: number[] };
    assert.equal(report.result.kind, "locked");
    assert.deepEqual(report.delays, [5, 10, 20, 40]);
    assert.equal(report.delays.reduce((sum, delay) => sum + delay, 0), 75);
    assert.equal(existsSync(contendedB), true, "the second process must hit EEXIST");
    assert.equal(existsSync(enteredB), false, "the timed-out callback must not run");
    assert.equal(existsSync(overlap), false, "timed-out writers must not overlap");
    assert.equal(report.result.reason?.includes(`Lock directory: ${dir}`), true);
    assert.deepEqual(readGoalplan(cwd, slug)!.workPhases.map((workPhase) => workPhase.id), ["wp-a"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("owner metadata is diagnostic only and cannot trigger automatic deletion", () => {
  const { cwd, slug } = workspace("owner is diagnostic");
  const dir = goalplanWriteLockDir(cwd, slug);
  mkdirSync(dir, { recursive: false });
  writeFileSync(
    join(dir, GOALPLAN_LOCK_OWNER_FILE),
    `${JSON.stringify({ pid: -1, hostname: "same-host", token: "old", acquiredAt: "2000-01-01T00:00:00.000Z" })}\n`,
  );

  const result = withGoalplanWriteLock(cwd, slug, () => "entered", {
    retryDelaysMs: [],
    sleep: () => assert.fail("no sleep is configured"),
  });

  assert.equal(result.kind, "locked");
  assert.equal(existsSync(dir), true);
  assert.match(readFileSync(join(dir, GOALPLAN_LOCK_OWNER_FILE), "utf8"), /"token":"old"/);
});

test("closing a fixed phase picks the same successor advanceWorkPhase would", () => {
  // §46: the recovery-only selection normalization must not leak into a first close.
  // A plan may legitimately hold a second in_progress phase — definition integrity
  // does not reject that — and normalizing there moved the cursor onto the running
  // phase instead of the pending one wp4 selects, re-logging started for work already
  // under way. Both functions must agree on this input.
  const build = (): Goalplan => {
    const plan = buildGoalplan({ objective: "successor parity" });
    plan.workPhases = [
      { id: "wp-1", title: "first", status: "in_progress", tasks: [], criteriaIds: [] },
      { id: "wp-2", title: "second", status: "in_progress", tasks: [], criteriaIds: [] },
      { id: "wp-3", title: "third", status: "pending", tasks: [], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = "wp-1";
    return plan;
  };

  const advanced = advanceWorkPhase(build());
  const closed = closeFixedWorkPhase(build(), "wp-1");

  assert.equal(advanced.kind, "ok");
  assert.equal(closed.kind, "ok");
  const shape = (plan: Goalplan) => ({
    activeWorkPhaseId: plan.activeWorkPhaseId,
    workPhases: plan.workPhases.map((wp) => [wp.id, wp.status]),
  });
  assert.deepEqual(
    shape(closed.kind === "ok" ? closed.plan : build()),
    shape(advanced.kind === "ok" ? advanced.plan : build()),
  );
  assert.equal(advanced.kind === "ok" ? advanced.plan.activeWorkPhaseId : null, "wp-3");
});

test("a retry quoting its recorded successor answers already_done and keeps the cursor", () => {
  // §48: judging "did my commit land?" from the plan file was forgeable five drafts in a
  // row, because one byte pattern fits two histories. The first attempt now records the
  // successor it chose, and the retry re-reads that instead of the file. Both halves are
  // asserted here: the FIRST call must pick what wp4 picks, and the retry quoting that
  // choice must answer already_done without moving anything.
  const build = (phases: Array<[string, WorkPhaseStatus]>, cursor: string | null): Goalplan => {
    const plan = buildGoalplan({ objective: "round trip" });
    plan.workPhases = phases.map(([id, status]) => ({
      id,
      title: id,
      status,
      tasks: [],
      criteriaIds: [],
    }));
    plan.activeWorkPhaseId = cursor;
    return plan;
  };

  // Each row fixes the successor the FIRST close must choose, so an implementation that
  // merely round-trips consistently — but picks the wrong phase — still fails.
  const cases: Array<[string, Goalplan, string, string | null]> = [
    ["pending successor", build([["wp-1", "in_progress"], ["wp-2", "pending"]], "wp-1"), "wp-1", "wp-2"],
    [
      "an unrelated phase is already running",
      build([["wp-1", "in_progress"], ["wp-2", "in_progress"], ["wp-3", "pending"]], "wp-1"),
      "wp-1",
      // wp4 locked pending-only after-then-wrap: the running wp-2 is not a candidate.
      "wp-3",
    ],
    [
      "target marked done by hand",
      build([["wp-1", "done"], ["wp-2", "in_progress"], ["wp-3", "pending"]], "wp-1"),
      "wp-1",
      // No recorded intent, so the running wp-2 stays running and wp-3 starts. This is
      // the same rule as the row above; a manual `done` does not make wp-2 selectable.
      "wp-3",
    ],
    ["wrap to an earlier pending phase", build([["wp-1", "pending"], ["wp-2", "in_progress"]], "wp-2"), "wp-2", "wp-1"],
    ["no successor left", build([["wp-1", "in_progress"], ["wp-2", "done"]], "wp-1"), "wp-1", null],
  ];

  for (const [label, input, target, expectedNext] of cases) {
    const first = closeFixedWorkPhase(input, target);
    assert.equal(first.kind, "ok", label);
    if (first.kind !== "ok") continue;
    assert.equal(first.plan.activeWorkPhaseId, expectedNext, label);
    if (expectedNext) {
      assert.equal(
        first.plan.workPhases.find((wp) => wp.id === expectedNext)!.status,
        "in_progress",
        label,
      );
    }
    // The retry quotes the marker, not the file.
    assert.equal(closeFixedWorkPhase(first.plan, target, expectedNext).kind, "already_done", label);
  }
});

test("a forged cursor cannot override the successor the marker recorded", () => {
  // §48: this is the input that defeated every plan-only rule. The file says the cursor
  // is wp-2, which is consistent BOTH with an attempt that chose wp-2 and with a plan
  // where wp-2 was running all along and wp-3 is the honest successor. The marker breaks
  // the tie: it recorded wp-3, so the retry finishes wp-3 and leaves wp-2 alone.
  const forged = buildGoalplan({ objective: "forged cursor" });
  forged.workPhases = [
    { id: "wp-1", title: "first", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "second", status: "in_progress", tasks: [], criteriaIds: [] },
    { id: "wp-3", title: "third", status: "pending", tasks: [], criteriaIds: [] },
  ];
  forged.activeWorkPhaseId = "wp-2";

  const retried = closeFixedWorkPhase(forged, "wp-1", "wp-3");

  assert.equal(retried.kind, "ok");
  if (retried.kind !== "ok") return;
  assert.equal(retried.plan.activeWorkPhaseId, "wp-3");
  assert.deepEqual(
    retried.plan.workPhases.map((wp) => [wp.id, wp.status]),
    [["wp-1", "done"], ["wp-2", "in_progress"], ["wp-3", "in_progress"]],
  );
  // And that repaired plan, replayed with the same marker, is settled.
  assert.equal(closeFixedWorkPhase(retried.plan, "wp-1", "wp-3").kind, "already_done");
});
test("read-only lock status reports absolute path and age without consulting owner metadata", () => {
  const { cwd, slug } = workspace("lock status");
  const dir = goalplanWriteLockDir(cwd, slug);
  mkdirSync(dir, { recursive: false });
  writeFileSync(join(dir, GOALPLAN_LOCK_OWNER_FILE), "{not-json\n");
  const acquiredAt = new Date("2026-08-29T00:00:00.000Z");
  utimesSync(dir, acquiredAt, acquiredAt);

  const status = goalplanWriteLockStatus(
    cwd,
    slug,
    new Date("2026-08-29T00:00:02.500Z").getTime(),
  );

  assert.equal(status.path, dir);
  assert.equal(isAbsolute(status.path), true);
  assert.equal(status.exists, true);
  assert.equal(status.ageMs, 2_500);
  assert.equal(readFileSync(join(dir, GOALPLAN_LOCK_OWNER_FILE), "utf8"), "{not-json\n");
});

test("read-only lock status normalizes exists-to-stat ENOENT as absent", () => {
  const { cwd, slug } = workspace("lock status race");
  const dir = goalplanWriteLockDir(cwd, slug);
  mkdirSync(dir, { recursive: false });

  const status = goalplanWriteLockStatus(cwd, slug, Date.now(), (path) => {
    rmSync(path, { recursive: true, force: true });
    throw Object.assign(new Error("lock vanished"), { code: "ENOENT" });
  });

  assert.deepEqual(status, { path: dir, exists: false, ageMs: null });
});

test("an unreadable plan releases the acquired lock", () => {
  const { cwd, slug } = workspace("unreadable releases lock");
  writeFileSync(join(goalplanDir(cwd, slug), "goalplan.json"), "{not-json");

  const result = withGoalplanWriteLock(cwd, slug, () => assert.fail("callback must not run"), {
    retryDelaysMs: [],
  });

  assert.equal(result.kind, "unreadable");
  assert.equal(existsSync(goalplanWriteLockDir(cwd, slug)), false);
});
