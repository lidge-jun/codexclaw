/**
 * criterion-decision-link.test.ts — issue #314.
 *
 * IDLE Stop releases when every remaining phase and every unmet criterion waits on
 * an open user decision. A criterion only counts as waiting when a waiting phase
 * lists it, so the loop CLI must be able to tie a criterion to that phase. These
 * tests drive the real CLI verbs and the real Stop hook.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.CODEXCLAW_CXC = "cxc";

import { handleStop, type StopPayload } from "../src/hook.ts";
import { GOALS_DB_FILENAME } from "../src/goal-active.ts";
import { parseGoalplanCliArgs, runGoalplanCli, type GoalplanCliArgs } from "../src/goalplan-cli.ts";
import { applySteeringBatch } from "../src/steering.ts";
import { readGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { readState } from "../src/state.ts";

const nodeRequire = createRequire(import.meta.url);

function withActiveGoal(sessionId: string, fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-criterion-link-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  writeFileSync(join(cwd, "README.md"), "fixture\n");
  git("add", "README.md");
  git("commit", "-qm", "init");
  const home = mkdtempSync(join(tmpdir(), "cxc-criterion-link-goals-"));
  const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(join(home, GOALS_DB_FILENAME));
  db.exec("CREATE TABLE thread_goals (thread_id TEXT PRIMARY KEY NOT NULL, goal_id TEXT NOT NULL, objective TEXT NOT NULL, status TEXT NOT NULL);");
  db.prepare("INSERT INTO thread_goals (thread_id, goal_id, objective, status) VALUES (?,?,?,?)").run(sessionId, "g-" + sessionId, "obj", "active");
  db.close();
  const prev = process.env.CODEX_SQLITE_HOME;
  process.env.CODEX_SQLITE_HOME = home;
  try {
    fn(cwd);
  } finally {
    if (prev === undefined) delete process.env.CODEX_SQLITE_HOME;
    else process.env.CODEX_SQLITE_HOME = prev;
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
}

function loop(cwd: string, ...argv: string[]): { output: string; code: number } {
  const parsed = parseGoalplanCliArgs(argv, cwd);
  if ("error" in parsed) return { output: parsed.error, code: 2 };
  return runGoalplanCli(parsed as GoalplanCliArgs);
}

function ok(cwd: string, ...argv: string[]): string {
  const result = loop(cwd, ...argv);
  assert.equal(result.code, 0, result.output);
  return result.output;
}

function stop(cwd: string, sessionId: string): string {
  const payload: StopPayload = {
    hook_event_name: "Stop", session_id: sessionId, cwd, transcript_path: null,
    turn_id: "t1", stop_hook_active: false, last_assistant_message: "waiting for the user",
  };
  return handleStop(payload);
}

/** wp1 done, c-1 met, c-2 unmet: the shape of the issue's repro. */
function seed(cwd: string, sessionId: string): void {
  ok(cwd, "init", "--objective", "ship " + sessionId, "--session", sessionId,
    "--criterion", "feature works", "--criterion", "PR merged after exact-head CI");
  ok(cwd, "add-work-phase", "--session", sessionId, "--id", "wp1", "--title", "build");
  ok(cwd, "add-task", "--session", sessionId, "--work-phase", "wp1", "--id", "t1", "--title", "build it");
  ok(cwd, "complete-task", "--session", sessionId, "--work-phase", "wp1", "--id", "t1", "--outcome", "built");
  ok(cwd, "meet-criterion", "--session", sessionId, "--id", "c-1", "--evidence", "suite green");
  // D-close is what marks a phase done; the fixture records that outcome directly.
  const plan = readGoalplan(cwd, readState(cwd, sessionId).slug!)!;
  writeGoalplan(cwd, { ...plan, workPhases: plan.workPhases.map((wp) => wp.id === "wp1" ? { ...wp, status: "done" as const } : wp) });
}

test("#314 repro: an unlinked criterion keeps Stop blocking and the block names the link command", () => {
  withActiveGoal("link-repro", (cwd) => {
    seed(cwd, "link-repro");
    ok(cwd, "add-work-phase", "--session", "link-repro", "--id", "wp5", "--title", "accept c-2");
    ok(cwd, "ask", "--session", "link-repro", "--id", "c2-accept", "--question", "Accept the merge without exact-head CI?", "--work-phase", "wp5");
    const out = stop(cwd, "link-repro");
    assert.notEqual(out, "", "an unlinked unmet criterion must not release Stop");
    const reason = JSON.parse(out.trim()).reason as string;
    assert.match(reason, /c-2/);
    assert.match(reason, /link-criterion --session link-repro --work-phase wp5 --criterion c-2/);
  });
});

test("#314: link-criterion ties an existing criterion to the waiting phase and Stop releases", () => {
  withActiveGoal("link-existing", (cwd) => {
    seed(cwd, "link-existing");
    ok(cwd, "add-work-phase", "--session", "link-existing", "--id", "wp5", "--title", "accept c-2");
    ok(cwd, "ask", "--session", "link-existing", "--id", "c2-accept", "--question", "Accept?", "--work-phase", "wp5");
    ok(cwd, "link-criterion", "--session", "link-existing", "--work-phase", "wp5", "--criterion", "c-2");
    assert.equal(stop(cwd, "link-existing"), "");
    // Answering the decision resumes the loop: the wait was the only reason to release.
    ok(cwd, "decide", "--session", "link-existing", "--id", "c2-accept", "--answer", "accept");
    assert.equal(JSON.parse(stop(cwd, "link-existing").trim()).decision, "block");
  });
});

test("#314: add-work-phase --criterion and ask --criterion both link at creation time", () => {
  withActiveGoal("link-phase", (cwd) => {
    seed(cwd, "link-phase");
    ok(cwd, "add-work-phase", "--session", "link-phase", "--id", "wp5", "--title", "accept c-2", "--criterion", "c-2");
    ok(cwd, "ask", "--session", "link-phase", "--id", "c2-accept", "--question", "Accept?", "--work-phase", "wp5");
    assert.equal(stop(cwd, "link-phase"), "");
  });
  withActiveGoal("link-ask", (cwd) => {
    seed(cwd, "link-ask");
    ok(cwd, "add-work-phase", "--session", "link-ask", "--id", "wp5", "--title", "accept c-2");
    ok(cwd, "ask", "--session", "link-ask", "--id", "c2-accept", "--question", "Accept?", "--work-phase", "wp5", "--criterion", "c-2");
    assert.equal(stop(cwd, "link-ask"), "");
  });
});

test("#314: the steering add-work-phase op accepts criteriaIds", () => {
  withActiveGoal("link-steer", (cwd) => {
    seed(cwd, "link-steer");
    const slug = readState(cwd, "link-steer").slug!;
    const applied = applySteeringBatch(cwd, slug, {
      idempotencyKey: "wp5-steer", rationale: "c-2 needs a user decision", evidence: "PR merged before CI",
      ops: [{ kind: "add-work-phase", id: "wp5", title: "accept c-2", criteriaIds: ["c-2"] }],
    });
    assert.equal(applied.kind, "applied", JSON.stringify(applied));
    ok(cwd, "ask", "--session", "link-steer", "--id", "c2-accept", "--question", "Accept?", "--work-phase", "wp5");
    assert.equal(stop(cwd, "link-steer"), "");
  });
});

test("#314: linking refuses unknown criteria and phases and writes nothing", () => {
  withActiveGoal("link-refuse", (cwd) => {
    seed(cwd, "link-refuse");
    ok(cwd, "add-work-phase", "--session", "link-refuse", "--id", "wp5", "--title", "accept c-2");
    const slug = readState(cwd, "link-refuse").slug!;
    const before = JSON.stringify(readGoalplan(cwd, slug));
    const cases: string[][] = [
      ["link-criterion", "--session", "link-refuse", "--work-phase", "wp5", "--criterion", "c-9"],
      ["link-criterion", "--session", "link-refuse", "--work-phase", "wp9", "--criterion", "c-2"],
      ["link-criterion", "--session", "link-refuse", "--work-phase", "wp1", "--criterion", "c-2"],
      ["ask", "--session", "link-refuse", "--id", "d1", "--question", "Q?", "--criterion", "c-2"],
      ["add-work-phase", "--session", "link-refuse", "--id", "wp6", "--title", "x", "--criterion", "c-9"],
    ];
    for (const argv of cases) assert.notEqual(loop(cwd, ...argv).code, 0, argv.join(" "));
    assert.equal(JSON.stringify(readGoalplan(cwd, slug)), before);
  });
});
