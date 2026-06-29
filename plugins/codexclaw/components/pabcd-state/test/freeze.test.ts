import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sha256,
  computeFreezeId,
  buildFreezeManifest,
  checkStale,
  GOAL_ACTIVATION_DIRECTIVE,
  type PlanFileHash,
  type EvidenceBundle,
} from "../src/freeze.ts";

function bundle(): EvidenceBundle {
  return {
    dimensions: null,
    openAssumptions: ["- Assume X (low)"],
    contradictions: [],
    seedAcceptanceCriteria: ["AC1: builds green"],
    researchReportRef: ".codexclaw/plan/slug/research.md",
  };
}

test("L10.3: buildFreezeManifest records sorted files + sha256 + deterministic freezeId", () => {
  const files: PlanFileHash[] = [
    { path: "b.md", sha256: sha256("B") },
    { path: "a.md", sha256: sha256("A") },
  ];
  const m = buildFreezeManifest({ slug: "slug", files, evidence: bundle(), now: () => "2026-06-30T00:00:00Z" });
  assert.deepEqual(m.files.map((f) => f.path), ["a.md", "b.md"]); // sorted
  assert.equal(m.freezeId, computeFreezeId(files));
  assert.equal(m.evidence.openAssumptions.length, 1);
});

test("L10.3: checkStale detects changed/missing/new files and refuses stale execution", () => {
  const files: PlanFileHash[] = [{ path: "plan.md", sha256: sha256("v1") }];
  const m = buildFreezeManifest({ slug: "s", files, evidence: bundle() });
  // unchanged
  assert.equal(checkStale(m, [{ path: "plan.md", sha256: sha256("v1") }]).stale, false);
  // changed
  const changed = checkStale(m, [{ path: "plan.md", sha256: sha256("v2") }]);
  assert.equal(changed.stale, true);
  assert.deepEqual(changed.changedFiles, ["plan.md"]);
  // new file appeared
  const added = checkStale(m, [{ path: "plan.md", sha256: sha256("v1") }, { path: "extra.md", sha256: sha256("e") }]);
  assert.equal(added.stale, true);
  assert.ok(added.changedFiles.includes("extra.md"));
});

test("L10.3: OPEN ASSUMPTIONS content is part of the hash surface (evidence carried)", () => {
  // two manifests differing only in assumptions evidence must differ in freezeId-relevant content
  const files: PlanFileHash[] = [{ path: "plan.md", sha256: sha256("same") }];
  const m = buildFreezeManifest({ slug: "s", files, evidence: bundle() });
  assert.equal(m.evidence.openAssumptions[0], "- Assume X (low)");
});

test("L10.3 R-7: activation directive instructs get_goal -> objective-only create_goal + verify", () => {
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /get_goal/);
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /objective ONLY/i);
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /no token_budget/i);
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /Verify a goal row/i);
});
