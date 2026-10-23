/**
 * plan-delta.test.ts — issue #315.
 *
 * SOURCE-DELTA-01 refuses B>C when nothing changed during B. A repository that
 * commits its plans already shows plan edits as a source change. A repository
 * that forbids committing plans keeps them outside the commit (a configured plans
 * directory), so the gate must also see the bound plan unit, recorded on entry to
 * B by path and digest. Both kinds are driven through the real plan and
 * orchestrate CLIs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

process.env.CODEXCLAW_CXC = "cxc";

import { parseOrchestrateCliArgs, runOrchestrateCli } from "../src/orchestrate-cli.ts";
import { handleUserPromptSubmit } from "../src/hook.ts";
import { parsePlanCliArgs, runPlanCli } from "../src/plan-cli.ts";
import { runDevlogCli } from "../src/state-cli.ts";
import { clearStateRootCache } from "../src/state-root.ts";
import { defaultState, readState, writeState } from "../src/state.ts";

const ENV_KEYS = ["CODEXCLAW_STATE_MODE", "CODEXCLAW_PLANS_DIR", "CODEXCLAW_HOME"] as const;

function withEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => void): void {
  const saved = ENV_KEYS.map((key) => [key, process.env[key]] as const);
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  clearStateRootCache();
  try {
    fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    clearStateRootCache();
  }
}

function gitRepo(): string {
  const cwd = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-plan-delta-")));
  const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  writeFileSync(join(cwd, "seed.txt"), "seed\n");
  git("add", "-A");
  git("commit", "-qm", "seed");
  return cwd;
}

function orchestrate(cwd: string, sessionId: string, verb: string, attest: Record<string, unknown>) {
  const parsed = parseOrchestrateCliArgs([verb, "--session", sessionId, "--cwd", cwd, "--attest", JSON.stringify(attest)], cwd);
  assert.ok(!("error" in parsed), JSON.stringify(parsed));
  return runOrchestrateCli(parsed as never);
}

/** IDLE -> P -> (plan init) -> A -> B, returning the plan unit directory. */
function cycleToB(cwd: string, sessionId: string): string {
  writeState(cwd, defaultState(sessionId));
  let r = orchestrate(cwd, sessionId, "p", { from: "IDLE", to: "P", did: "plan the roadmap" });
  assert.equal(r.code, 0, r.output);
  const planArgs = parsePlanCliArgs(["init", "roadmap"], cwd);
  assert.ok(!("error" in planArgs), JSON.stringify(planArgs));
  const init = runPlanCli(planArgs as never);
  assert.equal(init.code, 0, init.output);
  const devlog = runDevlogCli(["path"], cwd);
  assert.equal(devlog.code, 0, devlog.output);
  const unit = join(devlog.output.trim(), "_plan", readdirPlan(join(devlog.output.trim(), "_plan")));
  writeFileSync(join(unit, "000_plan.md"), "# roadmap\n\nfirst draft\n");
  r = orchestrate(cwd, sessionId, "a", { from: "P", to: "A", did: "wrote the roadmap", planUnit: unit });
  assert.equal(r.code, 0, r.output);
  r = orchestrate(cwd, sessionId, "b", { from: "A", to: "B", did: "audited the roadmap", auditOutput: "reviewer: PASS; no blockers", auditVerdict: "pass" });
  assert.equal(r.code, 0, r.output);
  assert.equal(readState(cwd, sessionId).phase, "B");
  return unit;
}

function readdirPlan(dir: string): string {
  const entries = readdirSync(dir).filter((name) => name.endsWith("_roadmap"));
  assert.equal(entries.length, 1, `one roadmap unit under ${dir}`);
  return entries[0];
}

const TO_C = { from: "B", to: "C", did: "wrote the roadmap docs" };

test("#315 repository that forbids committing plans: a plans directory outside the checkout satisfies B>C", () => {
  const cwd = gitRepo();
  const plans = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-plans-outside-")));
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo", CODEXCLAW_PLANS_DIR: plans }, () => {
      const unit = cycleToB(cwd, "forbid");
      assert.ok(unit.startsWith(plans + sep), `plan unit ${unit} lives under the configured plans directory`);
      assert.equal(existsSync(join(cwd, "devlog")), false, "nothing is written to the checkout's devlog");

      // Unchanged plan and unchanged source: still refused, and the refusal names the plan unit.
      const refused = orchestrate(cwd, "forbid", "c", TO_C);
      assert.equal(refused.code, 1);
      assert.match(refused.output, /SOURCE-DELTA-01/);
      assert.ok(refused.output.includes(unit), refused.output);

      writeFileSync(join(unit, "010_phase1.md"), "# phase 1\n\ndiff-level steps\n");
      const accepted = orchestrate(cwd, "forbid", "c", TO_C);
      assert.equal(accepted.code, 0, accepted.output);
      assert.equal(readState(cwd, "forbid").phase, "C");
      assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" }).replace(/^.*\.codexclaw\/.*\n?/gm, ""), "", "the commit stays free of plans");
      const ledger = readFileSync(join(cwd, ".codexclaw", "ledger.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
      const toC = ledger.filter((row) => row.to === "C").at(-1);
      assert.equal(toC?.planDelta?.path, unit, "the accepted edge records the plan unit path");
      assert.match(String(toC?.planDelta?.before), /^[0-9a-f]{64}$/);
      assert.match(String(toC?.planDelta?.after), /^[0-9a-f]{64}$/);
      assert.notEqual(toC.planDelta.before, toC.planDelta.after);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(plans, { recursive: true, force: true });
  }
});

test("#315 repository that commits plans: plan edits in devlog/ count as source, and an idle B is still refused", () => {
  const cwd = gitRepo();
  const idleCwd = gitRepo();
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo" }, () => {
      const unit = cycleToB(cwd, "commit");
      assert.ok(unit.startsWith(join(cwd, "devlog") + sep), unit);
      writeFileSync(join(unit, "010_phase1.md"), "# phase 1\n\ndiff-level steps\n");
      const accepted = orchestrate(cwd, "commit", "c", TO_C);
      assert.equal(accepted.code, 0, accepted.output);

      cycleToB(idleCwd, "commit-idle");
      const idle = orchestrate(idleCwd, "commit-idle", "c", TO_C);
      assert.equal(idle.code, 1, idle.output);
      assert.match(idle.output, /SOURCE-DELTA-01/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(idleCwd, { recursive: true, force: true });
  }
});

test("#315: state.plansDir in the user config moves plans outside the checkout per project", () => {
  const cwd = gitRepo();
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-plans-home-")));
  const plans = join(home, "plans");
  mkdirSync(plans);
  writeFileSync(join(home, "config.json"), JSON.stringify({ state: { plansDir: plans } }));
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo", CODEXCLAW_HOME: home }, () => {
      const devlog = runDevlogCli(["path", "--explain"], cwd);
      assert.equal(devlog.code, 0, devlog.output);
      const dir = devlog.output.split("\n")[0];
      assert.ok(dir.startsWith(plans + sep), dir);
      assert.match(devlog.output, /config state\.plansDir/);
      const unit = cycleToB(cwd, "config");
      writeFileSync(join(unit, "000_plan.md"), "# roadmap\n\nsecond draft\n");
      assert.equal(orchestrate(cwd, "config", "c", TO_C).code, 0);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("#315: a plans directory inside the checkout is ignored with a warning", () => {
  const cwd = gitRepo();
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo", CODEXCLAW_PLANS_DIR: join(cwd, "scratch") }, () => {
      const devlog = runDevlogCli(["path", "--explain"], cwd);
      assert.equal(devlog.output.split("\n")[0], join(cwd, "devlog"));
      assert.match(devlog.output, /warning: CODEXCLAW_PLANS_DIR .* inside the checkout/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("#315: the chat B>C path accepts the same plan-unit delta and refuses an idle one", () => {
  const cwd = gitRepo();
  const plans = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-plans-chat-")));
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo", CODEXCLAW_PLANS_DIR: plans }, () => {
      const unit = cycleToB(cwd, "chat");
      let turn = 0;
      const say = (prompt: string) => handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit", session_id: "chat", cwd, prompt, transcript_path: null, turn_id: "t" + ++turn });
      const chatC = "orchestrate c";
      const refused = JSON.parse(say(chatC)).hookSpecificOutput.additionalContext as string;
      assert.match(refused, /SOURCE-DELTA-01/);
      assert.ok(refused.includes(unit), refused);
      assert.equal(readState(cwd, "chat").phase, "B");
      writeFileSync(join(unit, "010_phase1.md"), "# phase 1\n\nchat edit\n");
      say(chatC);
      assert.equal(readState(cwd, "chat").phase, "C");
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(plans, { recursive: true, force: true });
  }
});


test("#315: plans hidden from git in the checkout (local mode, .git/info/exclude) also satisfy B>C", () => {
  const cwd = gitRepo();
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "local" }, () => {
      const unit = cycleToB(cwd, "excluded");
      assert.ok(unit.startsWith(join(cwd, "devlog") + sep), unit);
      assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd, encoding: "utf8" }), "", "git sees neither state nor plans");
      assert.equal(orchestrate(cwd, "excluded", "c", TO_C).code, 1);
      writeFileSync(join(unit, "010_phase1.md"), "# phase 1\n\nexcluded edit\n");
      const accepted = orchestrate(cwd, "excluded", "c", TO_C);
      assert.equal(accepted.code, 0, accepted.output);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("#315 review: codexclaw's own writes and non-plan files never count as plan work", () => {
  const cwd = gitRepo();
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo" }, () => {
      // A whole checkout bound as the unit: the state and ledger writes between A>B and
      // B>C land under it, and they must not satisfy SOURCE-DELTA-01.
      writeFileSync(join(cwd, "000_plan.md"), "# root plan\n");
      execFileSync("git", ["add", "-A"], { cwd });
      execFileSync("git", ["commit", "-qm", "plan"], { cwd });
      writeState(cwd, defaultState("dot"));
      assert.equal(orchestrate(cwd, "dot", "p", { from: "IDLE", to: "P", did: "plan" }).code, 0);
      assert.equal(orchestrate(cwd, "dot", "a", { from: "P", to: "A", did: "plan written", planUnit: "." }).code, 0);
      assert.equal(orchestrate(cwd, "dot", "b", { from: "A", to: "B", did: "audited", auditOutput: "reviewer: PASS", auditVerdict: "pass" }).code, 0);
      const idle = orchestrate(cwd, "dot", "c", TO_C);
      assert.equal(idle.code, 1, idle.output);
      assert.match(idle.output, /SOURCE-DELTA-01/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
  const repo = gitRepo();
  const plans = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-plans-noise-")));
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo", CODEXCLAW_PLANS_DIR: plans }, () => {
      const unit = cycleToB(repo, "noise");
      writeFileSync(join(unit, "notes.txt"), "scratch\n");
      writeFileSync(join(unit, ".DS_Store"), "x");
      assert.equal(orchestrate(repo, "noise", "c", TO_C).code, 1, "files that are not numbered plan docs are not plan work");
    });
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(plans, { recursive: true, force: true });
  }
});

test("#315 review: retargeting a symlinked plan unit between unchanged directories is not plan work", { skip: process.platform === "win32" }, () => {
  const cwd = gitRepo();
  const outside = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-plans-link-")));
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo" }, () => {
      for (const name of ["a", "b"]) {
        mkdirSync(join(outside, name));
        writeFileSync(join(outside, name, "000_plan.md"), "# same plan\n");
      }
      writeFileSync(join(outside, "b", "010_extra.md"), "# different set\n");
      symlinkSync(join(outside, "a"), join(outside, "unit"));
      writeState(cwd, defaultState("link"));
      assert.equal(orchestrate(cwd, "link", "p", { from: "IDLE", to: "P", did: "plan" }).code, 0);
      assert.equal(orchestrate(cwd, "link", "a", { from: "P", to: "A", did: "plan written", planUnit: join(outside, "unit") }).code, 0);
      assert.equal(orchestrate(cwd, "link", "b", { from: "A", to: "B", did: "audited", auditOutput: "reviewer: PASS", auditVerdict: "pass" }).code, 0);
      unlinkSync(join(outside, "unit"));
      symlinkSync(join(outside, "b"), join(outside, "unit"));
      assert.equal(orchestrate(cwd, "link", "c", TO_C).code, 1, "the unit pinned at B entry did not change");
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("#315 review: a project directory under the plans dir that links back into the checkout is refused", { skip: process.platform === "win32" }, () => {
  const cwd = gitRepo();
  const plans = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-plans-back-")));
  try {
    withEnv({ CODEXCLAW_STATE_MODE: "repo", CODEXCLAW_PLANS_DIR: plans }, () => {
      const first = runDevlogCli(["path"], cwd).output.trim();
      assert.ok(first.startsWith(plans + sep), first);
      mkdirSync(join(cwd, "inside"));
      symlinkSync(join(cwd, "inside"), first);
      clearStateRootCache();
      const explained = runDevlogCli(["path", "--explain"], cwd).output;
      assert.equal(explained.split("\n")[0], join(cwd, "devlog"));
      assert.match(explained, /warning: CODEXCLAW_PLANS_DIR .* inside the checkout/);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(plans, { recursive: true, force: true });
  }
});
