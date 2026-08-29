/** steering mutation uses the same goalplan lock and platform-neutral recovery path. */
// wp4 적용 후 + wp5 추가분: 전용 WslDeps 제거, 공통 락 테스트 import 전체
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGoalplan, goalplanDir, writeGoalplan } from "../src/goalplan.ts";
import { applySteeringBatch, type SteerResult } from "../src/steering.ts";

const OBJECTIVE = "steering tier fixture";
const SLUG = buildGoalplan({ objective: OBJECTIVE }).slug;

function contendedWorkspace(): { cwd: string; lockDir: string } {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-steer-tier-"));
  writeGoalplan(cwd, buildGoalplan({ objective: OBJECTIVE }));
  const lockDir = join(goalplanDir(cwd, SLUG), ".goalplan.lock");
  mkdirSync(lockDir, { recursive: true });
  return { cwd, lockDir };
}

function locked(cwd: string): Extract<SteerResult, { kind: "locked" }> {
  const result = applySteeringBatch(
    cwd,
    SLUG,
    {
      idempotencyKey: "k1",
      rationale: "the scope shifted after the audit",
      evidence: "devlog/_plan/260821_win-linux-optimization/060_wsl.md:1",
      ops: [{ kind: "annotate", note: "narrowed to the parser" }],
    },
    { lock: { retryDelaysMs: [] } },
  );
  assert.equal(result.kind, "locked", "expected a locked result from a pre-created lock dir");
  return result as Extract<SteerResult, { kind: "locked" }>;
}

test("the common lock refusal names its platform-neutral lock path", () => {
  const workspace = contendedWorkspace();
  const result = locked(workspace.cwd);
  assert.match(result.reason, /goalplan '.+' is busy/);
  assert.match(result.reason, /After verifying no writer is active/);
  assert.ok(result.reason.includes(workspace.lockDir));
});
