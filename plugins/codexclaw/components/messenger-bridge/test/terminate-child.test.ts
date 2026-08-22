/**
 * terminate-child.test.ts - wp06 / 050 section 5: win32 process-tree termination.
 *
 * The escalation used to be POSIX-only, so on Windows a codex process that had
 * spawned MCP helpers left them holding the pipe: the turn timeout fired,
 * terminateChild ran, and the promise never settled (002 B13). Platform, the
 * spawn function, process.kill, and the timer are all injected, so both branches
 * run from one OS without signalling anything real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChildProcess, spawnSync } from "node:child_process";
import { SIGKILL_GRACE_MS, terminateChild } from "../src/runner.ts";
import { commandInvocation } from "../src/win-exec.ts";

interface FakeChild {
  pid: number | undefined;
  killed: NodeJS.Signals[];
}

function fakeChild(pid: number | undefined): { child: ChildProcess; log: FakeChild } {
  const log: FakeChild = { pid, killed: [] };
  const child = {
    pid,
    kill(signal: NodeJS.Signals) {
      log.killed.push(signal);
      return true;
    },
  } as unknown as ChildProcess;
  return { child, log };
}

/** Captures the scheduled escalation instead of waiting on a real timer. */
function manualClock() {
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
  let unrefs = 0;
  return {
    scheduled,
    unrefs: () => unrefs,
    schedule: (fn: () => void, ms: number) => {
      scheduled.push({ fn, ms });
      return {
        unref: () => {
          unrefs++;
        },
      };
    },
  };
}

function recordingSpawn() {
  const calls: Array<{ file: string; args: string[]; opts: Record<string, unknown> }> = [];
  const fn = ((file: string, args: string[], opts: Record<string, unknown>) => {
    calls.push({ file, args, opts });
    return { status: 0 };
  }) as unknown as typeof spawnSync;
  return { fn, calls };
}

test("win32 escalation calls taskkill with /T /F and no shell", () => {
  const { child, log } = fakeChild(4321);
  const clock = manualClock();
  const spawner = recordingSpawn();

  terminateChild(child, { platform: "win32", spawnFn: spawner.fn, schedule: clock.schedule });

  // SIGTERM first: on Windows child.kill() is the SIGTERM-equivalent.
  assert.deepEqual(log.killed, ["SIGTERM"]);
  assert.equal(spawner.calls.length, 0, "taskkill must wait for the grace window");

  clock.scheduled[0].fn();
  assert.equal(spawner.calls.length, 1);
  const call = spawner.calls[0];
  assert.match(call.file, /taskkill/i);
  assert.deepEqual(call.args, ["/pid", "4321", "/T", "/F"]);
  assert.equal("shell" in call.opts, false, "a shell hop would be a quoting hazard");
  assert.equal(call.opts.windowsHide, true);
  // The direct child is still killed after the tree walk.
  assert.deepEqual(log.killed, ["SIGTERM", "SIGKILL"]);
});

test("POSIX escalation still uses SIGKILL on the negative pid, never taskkill", () => {
  const { child, log } = fakeChild(999);
  const clock = manualClock();
  const spawner = recordingSpawn();
  const signals: Array<[number, NodeJS.Signals]> = [];

  terminateChild(child, {
    platform: "linux",
    spawnFn: spawner.fn,
    schedule: clock.schedule,
    kill: (pid, signal) => {
      signals.push([pid, signal]);
    },
  });

  assert.deepEqual(signals, [[-999, "SIGTERM"]]);
  clock.scheduled[0].fn();
  assert.deepEqual(signals, [
    [-999, "SIGTERM"],
    [-999, "SIGKILL"],
  ]);
  assert.equal(spawner.calls.length, 0, "taskkill has no business on POSIX");
  assert.deepEqual(log.killed, [], "the group signal already covered the direct child");
});

test("escalation waits for SIGKILL_GRACE_MS on both platforms and unrefs the timer", () => {
  for (const platform of ["win32", "linux"] as const) {
    const { child } = fakeChild(77);
    const clock = manualClock();
    terminateChild(child, {
      platform,
      spawnFn: recordingSpawn().fn,
      schedule: clock.schedule,
      kill: () => {},
    });
    assert.equal(clock.scheduled.length, 1, `${platform}: exactly one escalation timer`);
    assert.equal(clock.scheduled[0].ms, SIGKILL_GRACE_MS, `${platform}: escalation must not be immediate`);
    assert.equal(clock.unrefs(), 1, `${platform}: the timer must not hold the event loop open`);
  }
});

test("a pidless child is a no-op escalation, not a throw", () => {
  const { child, log } = fakeChild(undefined);
  const clock = manualClock();
  const spawner = recordingSpawn();

  terminateChild(child, { platform: "win32", spawnFn: spawner.fn, schedule: clock.schedule });
  assert.deepEqual(log.killed, ["SIGTERM"]);
  assert.doesNotThrow(() => clock.scheduled[0].fn());
  assert.equal(spawner.calls.length, 0, "taskkill without a pid would kill nothing or the wrong tree");

  // POSIX with no pid falls straight through to child.kill.
  const posix = fakeChild(undefined);
  const posixClock = manualClock();
  terminateChild(posix.child, { platform: "linux", schedule: posixClock.schedule, kill: () => {} });
  assert.doesNotThrow(() => posixClock.scheduled[0].fn());
  assert.deepEqual(posix.log.killed, ["SIGTERM", "SIGKILL"]);
});

test("a taskkill spawn failure still falls back to killing the direct child", () => {
  const { child, log } = fakeChild(555);
  const clock = manualClock();
  const throwing = (() => {
    throw new Error("taskkill unavailable");
  }) as unknown as typeof spawnSync;

  terminateChild(child, { platform: "win32", spawnFn: throwing, schedule: clock.schedule });
  assert.doesNotThrow(() => clock.scheduled[0].fn());
  assert.deepEqual(log.killed, ["SIGTERM", "SIGKILL"]);
});

test("SHARED-HELPER-01: this package's win-exec copy is the same contract", () => {
  const inv = commandInvocation("taskkill", ["/pid", "1"], "linux", {});
  assert.equal(inv.file, "taskkill");
  assert.deepEqual(inv.args, ["/pid", "1"]);
  assert.deepEqual(inv.options, {});
});

