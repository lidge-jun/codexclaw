import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import {
  getGoalActiveStatus,
  suppressesInterview,
  resolveGoalsDbPath,
  GOALS_DB_FILENAME,
} from "../src/goal-active.ts";

const nodeRequire = createRequire(import.meta.url);

// Build a real goals_1.sqlite fixture mirroring codex's thread_goals schema.
function makeGoalsDb(dir: string, rows: Array<{ thread_id: string; status: string }>): string {
  const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
  const path = join(dir, GOALS_DB_FILENAME);
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE thread_goals (thread_id TEXT PRIMARY KEY NOT NULL, goal_id TEXT NOT NULL, objective TEXT NOT NULL, status TEXT NOT NULL);`);
  const ins = db.prepare("INSERT INTO thread_goals (thread_id, goal_id, objective, status) VALUES (?,?,?,?)");
  for (const r of rows) ins.run(r.thread_id, `g-${r.thread_id}`, "obj", r.status);
  db.close();
  return path;
}

test("L11.1: resolveGoalsDbPath honors CODEX_SQLITE_HOME > CODEX_HOME", () => {
  assert.equal(resolveGoalsDbPath({ CODEX_SQLITE_HOME: "/sq" } as NodeJS.ProcessEnv), join("/sq", GOALS_DB_FILENAME));
  assert.equal(resolveGoalsDbPath({ CODEX_HOME: "/ch" } as NodeJS.ProcessEnv), join("/ch", GOALS_DB_FILENAME));
});

test("L11.1: missing DB -> inactive (codex not using goals)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-ga-"));
  try {
    assert.equal(getGoalActiveStatus("t1", { dbPath: join(cwd, "nope.sqlite") }), "inactive");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L11.1: Active row -> active; Complete/absent -> inactive", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-ga-"));
  try {
    const db = makeGoalsDb(cwd, [
      { thread_id: "sess-active", status: "active" },
      { thread_id: "sess-complete", status: "complete" },
      { thread_id: "sess-paused", status: "paused" },
    ]);
    assert.equal(getGoalActiveStatus("sess-active", { dbPath: db }), "active");
    assert.equal(getGoalActiveStatus("sess-complete", { dbPath: db }), "inactive");
    assert.equal(getGoalActiveStatus("sess-paused", { dbPath: db }), "inactive");
    assert.equal(getGoalActiveStatus("sess-missing", { dbPath: db }), "inactive");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L11.1: present-but-unparsable row -> unreadable (fail closed)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-ga-"));
  try {
    // open succeeds but the query throws (no thread_goals table) -> unreadable
    const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
    const path = join(cwd, GOALS_DB_FILENAME);
    const db = new DatabaseSync(path);
    db.exec("CREATE TABLE other (x INTEGER);");
    db.close();
    assert.equal(getGoalActiveStatus("any", { dbPath: path }), "unreadable");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("L11: suppressesInterview is true for active AND unreadable (fail-closed), false for inactive", () => {
  assert.equal(suppressesInterview("active"), true);
  assert.equal(suppressesInterview("unreadable"), true);
  assert.equal(suppressesInterview("inactive"), false);
});
