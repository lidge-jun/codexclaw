import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  sha256,
  computePlanHash,
  deriveSlug,
  buildFreezeManifest,
  checkStale,
  GOAL_ACTIVATION_DIRECTIVE,
  type PlanFileHash,
  type EvidenceBundle,
} from "../src/freeze.ts";
import { runFreeze } from "../src/freeze-cli.ts";

function bundle(openAssumptions: string[] = ["- Assume X (low)"]): EvidenceBundle {
  return { dimensions: null, openAssumptions, contradictions: [], acceptanceCriteria: ["AC1"], researchReportRef: null };
}

test("L10.3: manifest uses exact pinned field names + planHash over per-file sha256", () => {
  const files: PlanFileHash[] = [
    { path: "b.md", sha256: sha256("B") },
    { path: "a.md", sha256: sha256("A") },
  ];
  const m = buildFreezeManifest({ objective: "Build the Thing!", planFiles: files, evidenceBundle: bundle(), now: () => "2026-06-30T00:00:00Z" });
  assert.deepEqual(Object.keys(m).sort(), ["evidenceBundle", "frozenAt", "objective", "planFiles", "planHash", "slug"]);
  assert.deepEqual(m.planFiles.map((f) => f.path), ["a.md", "b.md"]); // sorted
  assert.equal(m.planHash, computePlanHash(files));
  assert.equal(m.slug, "build-the-thing");
});

test("L10.3: deriveSlug lowercases, dashes non-alnum, trims, caps 48", () => {
  assert.equal(deriveSlug("  Hello, World!!  "), "hello-world");
  assert.equal(deriveSlug("a".repeat(60)).length, 48);
  assert.equal(deriveSlug("***"), "interview");
});

test("L10.3: OPEN ASSUMPTIONS is hash-covered via plan file content", () => {
  // OPEN ASSUMPTIONS lives in the plan file; changing it changes the file sha256 -> planHash -> stale
  const v1: PlanFileHash[] = [{ path: "plan.md", sha256: sha256("# Plan\n## OPEN ASSUMPTIONS\n- A1") }];
  const v2: PlanFileHash[] = [{ path: "plan.md", sha256: sha256("# Plan\n## OPEN ASSUMPTIONS\n- A1\n- A2") }];
  const m = buildFreezeManifest({ objective: "o", planFiles: v1, evidenceBundle: bundle() });
  assert.equal(checkStale(m, v1).stale, false);
  assert.equal(checkStale(m, v2).stale, true); // changed assumptions -> stale
});

test("L10.3: checkStale catches changed/missing/new files AND planHash mismatch", () => {
  const files: PlanFileHash[] = [{ path: "plan.md", sha256: sha256("v1") }];
  const m = buildFreezeManifest({ objective: "o", planFiles: files, evidenceBundle: bundle() });
  assert.equal(checkStale(m, [{ path: "plan.md", sha256: sha256("v1") }]).stale, false);
  assert.equal(checkStale(m, [{ path: "plan.md", sha256: sha256("v2") }]).stale, true);
  const added = checkStale(m, [{ path: "plan.md", sha256: sha256("v1") }, { path: "x.md", sha256: sha256("e") }]);
  assert.equal(added.stale, true);
  assert.ok(added.changedFiles.includes("x.md"));
});

test("L10.3 R-7: activation directive instructs get_goal -> objective-only create_goal + verify + re-freeze", () => {
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /get_goal/);
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /objective ONLY/i);
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /no token_budget/i);
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /Verify a goal row/i);
  assert.match(GOAL_ACTIVATION_DIRECTIVE, /recompute planHash/i);
});

test("L10.3 runtime: freeze --dry-run produces a summary without writing", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-frz-"));
  try {
    const planDir = join(cwd, ".codexclaw", "plan", "default");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "# Plan\n## OPEN ASSUMPTIONS\n- A1");
    const out = runFreeze({ cwd, sessionId: "default", dryRun: true });
    assert.match(out, /planHash:/);
    assert.match(out, /planFiles: 1/);
    assert.match(out, /freeze --dry-run/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// L14.2: freeze must SURFACE the goal-activation handoff when (and only when) the
// interview is ready — this is the production consumer of GOAL_ACTIVATION_DIRECTIVE,
// closing the C5 "test-only export" gap. codexclaw still never writes the goal DB.
function readyTrackerJson(): string {
  const score = { level: "max", known: ["k"], unknown: [], confidence: 1 };
  return JSON.stringify({
    phase: "I",
    slug: "demo",
    flags: { interview: true, auditPassed: false, checkPassed: false },
    orchestrationActive: false,
    lastInjectedPhase: null,
    injectedTurns: [],
    stopBlockPhase: null,
    stopBlockCount: 0,
    interview: {
      dimensions: { goal: score, constraint: score, success: score, ontology: score },
      contradictions: [],
      assumptions: [{ text: "Assume X", recorded: true }],
      scanRounds: 1,
    },
  });
}

test("L14.2: freeze emits GOAL_ACTIVATION_DIRECTIVE when the interview is ready", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-frz-ready-"));
  try {
    mkdirSync(join(cwd, ".codexclaw", "sessions"), { recursive: true });
    writeFileSync(join(cwd, ".codexclaw", "sessions", "s1.json"), readyTrackerJson());
    const planDir = join(cwd, ".codexclaw", "plan", "demo");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "# Plan");
    const out = runFreeze({ cwd, sessionId: "s1", dryRun: true });
    assert.match(out, /interviewReady: true/);
    assert.ok(out.includes(GOAL_ACTIVATION_DIRECTIVE), "ready freeze must include the handoff directive");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L14.2: freeze does NOT emit the directive when the interview is not ready", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-frz-notready-"));
  try {
    const planDir = join(cwd, ".codexclaw", "plan", "default");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "# Plan");
    const out = runFreeze({ cwd, sessionId: "default", dryRun: true });
    assert.match(out, /interviewReady: false/);
    assert.ok(!out.includes(GOAL_ACTIVATION_DIRECTIVE), "not-ready freeze must not surface the handoff");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
