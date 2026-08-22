/**
 * steering-ops.test.ts - wp07 (plan 060).
 *
 * The lock-contention message names the filesystem tier when the lock lives on
 * drvfs or 9p, where directory-create atomicity is the driver's guarantee rather
 * than the kernel's. Contention is produced by pre-creating the lock directory,
 * matching the technique in steering.test.ts, and the filesystem probes are
 * injected so both branches run on any OS.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGoalplan, goalplanDir, writeGoalplan } from "../src/goalplan.ts";
import { applySteeringBatch, type SteerResult } from "../src/steering.ts";
import type { WslDeps } from "../src/wsl.ts";

const OBJECTIVE = "steering tier fixture";
const SLUG = buildGoalplan({ objective: OBJECTIVE }).slug;

function contendedWorkspace(): { cwd: string; lockDir: string } {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-steer-tier-"));
  writeGoalplan(cwd, buildGoalplan({ objective: OBJECTIVE }));
  const lockDir = join(goalplanDir(cwd, SLUG), ".steer.lock");
  mkdirSync(lockDir, { recursive: true });
  return { cwd, lockDir };
}

/**
 * A /proc/mounts fixture in which the lock directory itself is the mount point.
 * The workspace is a real temp dir, whose shape differs per OS, so naming it
 * exactly keeps the fixture honest on both platforms.
 */
function mountsFor(lockDir: string, type: string): string {
  return ["/dev/root / ext4 rw 0 0", `dev ${lockDir} ${type} rw 0 0`].join("\n");
}

function locked(cwd: string, wslDeps: WslDeps): Extract<SteerResult, { kind: "locked" }> {
  const r = applySteeringBatch(
    cwd,
    SLUG,
    {
      idempotencyKey: "k1",
      rationale: "the scope shifted after the audit",
      evidence: "devlog/_plan/260821_win-linux-optimization/060_wsl.md:1",
      ops: [{ kind: "annotate", note: "narrowed to the parser" }],
    },
    { wslDeps },
  );
  assert.equal(r.kind, "locked", "expected a locked result from a pre-created lock dir");
  return r as Extract<SteerResult, { kind: "locked" }>;
}

test("the lock-contention message names the filesystem tier on drvfs", () => {
  const ws = contendedWorkspace();
  const r = locked(ws.cwd, { platform: "linux", procMounts: mountsFor(ws.lockDir, "drvfs") });
  assert.match(r.reason, /holds the lock/);
  assert.match(r.reason, /This lock lives on drvfs/);
});

test("9p gets the same tier note", () => {
  const ws = contendedWorkspace();
  const r = locked(ws.cwd, { platform: "linux", procMounts: mountsFor(ws.lockDir, "9p") });
  assert.match(r.reason, /This lock lives on 9p/);
});

test("the lock-contention message carries no tier note on a native filesystem", () => {
  const ws = contendedWorkspace();
  const r = locked(ws.cwd, { platform: "linux", procMounts: mountsFor(ws.lockDir, "ext4") });
  assert.match(r.reason, /holds the lock/);
  assert.doesNotMatch(r.reason, /This lock lives on/);
});
