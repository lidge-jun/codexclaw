import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validatePlanArtifacts } from "../src/plan-gate.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-plangate-"));
}

test("plan-gate: null attest / missing planUnit refused with scaffold hint", () => {
  const cwd = freshCwd();
  try {
    const nullRes = validatePlanArtifacts(null, cwd);
    assert.equal(nullRes.ok, false);
    assert.match(nullRes.reason ?? "", /planUnit/);
    assert.match(nullRes.reason ?? "", /cxc plan init/);
    const noField = validatePlanArtifacts({ from: "P", to: "A", did: "x" }, cwd);
    assert.equal(noField.ok, false);
    assert.match(noField.reason ?? "", /DIFFLEVEL-ROADMAP-01/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("plan-gate: nonexistent dir refused; dir without numbered docs refused", () => {
  const cwd = freshCwd();
  try {
    const ghost = validatePlanArtifacts({ from: "P", to: "A", did: "x", planUnit: "devlog/_plan/000000_none" }, cwd);
    assert.equal(ghost.ok, false);
    assert.match(ghost.reason ?? "", /does not exist/);
    const empty = join(cwd, "devlog", "_plan", "000000_empty");
    mkdirSync(empty, { recursive: true });
    writeFileSync(join(empty, "PLAN.md"), "bare name\n", "utf8"); // LEXICO-SPLIT-01 violation
    const bare = validatePlanArtifacts({ from: "P", to: "A", did: "x", planUnit: "devlog/_plan/000000_empty" }, cwd);
    assert.equal(bare.ok, false);
    assert.match(bare.reason ?? "", /no numbered plan docs/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("plan-gate: valid unit passes; planPaths entries verified on disk", () => {
  const cwd = freshCwd();
  try {
    const unit = join(cwd, "devlog", "_plan", "000000_ok");
    mkdirSync(unit, { recursive: true });
    writeFileSync(join(unit, "000_plan.md"), "# plan\n", "utf8");
    writeFileSync(join(unit, "010_phase1.md"), "# phase1\n", "utf8");
    const ok = validatePlanArtifacts({ from: "P", to: "A", did: "x", planUnit: "devlog/_plan/000000_ok" }, cwd);
    assert.equal(ok.ok, true);
    const withPaths = validatePlanArtifacts(
      { from: "P", to: "A", did: "x", planUnit: "devlog/_plan/000000_ok", planPaths: ["devlog/_plan/000000_ok/010_phase1.md"] },
      cwd,
    );
    assert.equal(withPaths.ok, true);
    const badPath = validatePlanArtifacts(
      { from: "P", to: "A", did: "x", planUnit: "devlog/_plan/000000_ok", planPaths: ["devlog/_plan/000000_ok/999_ghost.md"] },
      cwd,
    );
    assert.equal(badPath.ok, false);
    assert.match(badPath.reason ?? "", /999_ghost\.md does not exist/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
