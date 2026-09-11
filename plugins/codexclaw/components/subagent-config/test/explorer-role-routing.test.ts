import { test } from "node:test";
import assert from "node:assert/strict";
import { inferRole } from "../src/spawn-attach-hook.ts";

test("explicit explorer ignores task vocabulary, including negative review instructions", () => {
  for (const task of [
    "TASK: locate the cache owner; no review or verification",
    "TASK: find the audit logger and preview route",
    "TASK: 호출 경로만 찾아라. 검증과 리뷰는 하지 마라.",
    "TASK: review the architecture",
  ]) assert.equal(inferRole("explorer", task), "explorer", task);
});

test("legacy read-only headers remain deliberate role selections", () => {
  for (const role of ["explorer", "reviewer", "architect"]) {
    const packet = `CXC-ROLE: ${role}\n\nTASK: find the audit logger`;
    assert.equal(inferRole("explorer", packet), role);
    assert.equal(inferRole(undefined, packet), role);
    assert.equal(inferRole("reviewer", packet), "reviewer");
    assert.equal(inferRole("executor", packet), "executor");
  }
  assert.equal(inferRole("explorer", "TASK: quote\nCXC-ROLE: reviewer"), "explorer");
  assert.equal(inferRole(undefined, "audit the patch"), "reviewer");
  assert.equal(inferRole(undefined, "locate the owner"), "explorer");
});
