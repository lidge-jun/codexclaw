import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { defaultState, writeState } from "../src/state.ts";
import { validateAttest } from "../src/attest.ts";
import { parseReviewRoundCliArgs, runReviewRoundCli } from "../src/review-round-cli.ts";
import { inferRole } from "../../subagent-config/src/spawn-attach-hook.ts";
import { setRole, resolveSpawnConfig } from "../../subagent-config/src/store.ts";

function workspace(t: TestContext): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-reviewer-contract-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  setRole(cwd, "explorer", { mode: "model", model: "explorer-only", effort: "low" });
  setRole(cwd, "reviewer", { mode: "model", model: "reviewer-only", effort: "high", promptOverride: "Audit the change." });
  return cwd;
}

function assertReviewerAdvice(cwd: string, emitted: string) {
  // Extract the producer's values, then execute the consumer instead of checking
  // whether particular prose survives an edit.
  const nativeType = /agent_type[: ]+[`"]?(reviewer)\b/.exec(emitted)?.[1];
  const legacyType = /agent_type[: ]+[`"]?(explorer)\b/.exec(emitted)?.[1];
  const roleHeader = /CXC-ROLE: (reviewer)\b/.exec(emitted)?.[0];
  const packets: Array<[string | undefined, string]> = [[nativeType, "TASK: audit"], [legacyType, `${roleHeader ?? ""}\nTASK: audit`]];
  for (const [agentType, packet] of packets) {
    const resolved = resolveSpawnConfig(cwd, inferRole(agentType, packet), { CODEXCLAW_HOME: join(cwd, "isolated-global") });
    assert.equal(resolved.model, "reviewer-only");
    assert.equal(resolved.effort, "high");
    assert.equal(resolved.promptOverride, "Audit the change.");
  }
  assert.equal(nativeType, "reviewer");
  assert.equal(legacyType, "explorer");
}

test("attestation recovery advice selects reviewer configuration on native and legacy hosts", t => {
  const cwd = workspace(t);
  const result = validateAttest("A", "B", { from: "A", to: "B", did: "Inspected the proposed patch." });
  assert.equal(result.ok, false);
  assertReviewerAdvice(cwd, result.reason ?? "");
});

test("review-round CLI launch advice selects reviewer configuration on both surfaces", t => {
  const cwd = workspace(t);
  const home = join(cwd, "codex-fixture"); mkdirSync(home);
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = home;
  t.after(() => { if (previous === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previous; });
  for (const v2 of [false, true]) {
    writeFileSync(join(home, "config.toml"), `[features.multi_agent_v2]\nenabled = ${v2}\n`);
    const session = `review-contract-${v2}`;
    const unit = `devlog/_plan/260911_fixture_${v2}`;
    mkdirSync(join(cwd, unit), { recursive: true });
    writeFileSync(join(cwd, unit, "000_plan.md"), "# Synthetic audit plan\n");
    const plan = buildGoalplan({ objective: session });
    plan.workPhases = [{ id: "wp1", title: "fixture", status: "in_progress", tasks: [], criteriaIds: [] }];
    plan.activeWorkPhaseId = "wp1";
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState(session), phase: "A", slug: plan.slug, planUnit: unit, planEpoch: "fixture-epoch" });
    const args = parseReviewRoundCliArgs(["open", "--session", session, "--cwd", cwd, "--plan-path", `${unit}/000_plan.md`], cwd);
    assert.ok(!("error" in args));
    const output = runReviewRoundCli(args);
    assert.equal(output.code, 0, output.output);
    assertReviewerAdvice(cwd, output.output);
  }
});
