import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePlanCliArgs, runPlanCli, yymmdd } from "../src/plan-cli.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-plancli-"));
}

test("plan-cli parse: init requires slug; --phases bounds enforced; slug normalized", () => {
  assert.match((parsePlanCliArgs([], "/tmp") as { error: string }).error, /unknown plan verb/);
  assert.match((parsePlanCliArgs(["init"], "/tmp") as { error: string }).error, /requires a <slug>/);
  assert.match((parsePlanCliArgs(["init", "x", "--phases", "0"], "/tmp") as { error: string }).error, /1-9/);
  const ok = parsePlanCliArgs(["init", "My Big Feature!", "--phases", "3"], "/tmp");
  assert.ok(!("error" in ok));
  assert.equal(ok.slug, "my-big-feature");
  assert.equal(ok.phases, 3);
});

test("plan-cli init: scaffolds 000 + N decade stubs with DIFFLEVEL header; refuses overwrite", () => {
  const cwd = freshCwd();
  try {
    const args = parsePlanCliArgs(["init", "gate-demo", "--phases", "2", "--cwd", cwd], cwd);
    assert.ok(!("error" in args));
    const r = runPlanCli(args);
    assert.equal(r.code, 0, r.output);
    const unit = join(cwd, "devlog", "_plan", `${yymmdd()}_gate-demo`);
    assert.ok(existsSync(unit));
    const files = readdirSync(unit).sort();
    assert.deepEqual(files, ["000_plan.md", "010_phase1.md", "020_phase2.md"]);
    assert.match(readFileSync(join(unit, "010_phase1.md"), "utf8"), /DIFFLEVEL-ROADMAP-01/);
    // second run refuses
    const again = runPlanCli(args);
    assert.equal(again.code, 1);
    assert.match(again.output, /refusing to overwrite/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
