import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexHome, THREAD_MAIN, THREAD_SUB } from "./fixtures.ts";
import { searchChat, type ChatSearchOptions } from "../src/chat-search.ts";

// WP1 scan-path semantics under test: pin the engine so the sidecar index (WP2)
// cannot serve these queries.
const scanChat = (q: string, o: ChatSearchOptions = {}) => searchChat(q, { scan: true, ...o });
import { listRolloutFiles, readRolloutMeta, isSyntheticUserText } from "../src/rollout.ts";
import { stateDbPath } from "../src/paths.ts";

let home: string;

test.before(() => {
  home = mkdtempSync(join(tmpdir(), "recall-chat-"));
  buildCodexHome(home);
});

test.after(() => {
  rmSync(home, { recursive: true, force: true });
});

test("listRolloutFiles: days pruning drops stale directories, 0 keeps all", () => {
  assert.equal(listRolloutFiles(home, 7).length, 2);
  assert.equal(listRolloutFiles(home, 0).length, 3);
});

test("readRolloutMeta: survives 40KB first lines and classifies subagents", () => {
  const files = listRolloutFiles(home, 7);
  const metas = files.map((f) => readRolloutMeta(f.path));
  const main = metas.find((m) => m.threadId === THREAD_MAIN);
  const sub = metas.find((m) => m.threadId === THREAD_SUB);
  assert.ok(main && sub, "both fixture threads classified");
  assert.equal(main.source, "main");
  assert.equal(main.cwd, "/proj/alpha");
  assert.equal(sub.source, "subagent");
  assert.equal(sub.nickname, "Popper");
});

test("paths: versioned db resolver picks the highest state_<N>.sqlite", () => {
  assert.ok(stateDbPath(home)?.endsWith("state_2.sqlite"));
});

test("AND matching is default; --any switches to OR", () => {
  const and = scanChat("trigram korean", { home, source: "all" });
  assert.ok(and.hits.length >= 1);
  assert.ok(and.hits.every((h) => /trigram/i.test(h.text) && /korean/i.test(h.text)));
  const or = scanChat("trigram korean", { home, source: "all", any: true });
  assert.ok(or.hits.length > and.hits.length, "OR must match a superset");
});

test("default source=main excludes subagent rollouts; source filters work", () => {
  const main = scanChat("trigram", { home });
  assert.ok(main.hits.length > 0);
  assert.ok(main.hits.every((h) => h.source === "main"));
  const sub = scanChat("trigram", { home, source: "subagent" });
  assert.ok(sub.hits.length > 0);
  assert.ok(sub.hits.every((h) => h.source === "subagent"));
});

test("synthetic harness messages are hidden unless includeSynthetic", () => {
  assert.ok(isSyntheticUserText("# AGENTS.md instructions for /x"));
  const hidden = scanChat("zebra", { home, role: "user" });
  assert.equal(hidden.hits.length, 0);
  const shown = scanChat("zebra", { home, role: "user", includeSynthetic: true });
  assert.equal(shown.hits.length, 1);
});

test("tool_log matches by default; --no-tools disables them", () => {
  const withTools = scanChat("zebra-in-tool-output", { home });
  assert.equal(withTools.hits.length, 1);
  assert.equal(withTools.hits[0].matchField, "tool_log");
  const without = scanChat("zebra-in-tool-output", { home, includeTools: false });
  assert.equal(without.hits.length, 0);
});

test("days=0 reaches full history; default window hides stale rollouts", () => {
  const recent = scanChat("ancient question", { home });
  assert.equal(recent.hits.length, 0);
  const all = scanChat("ancient question", { home, days: 0 });
  assert.equal(all.hits.length, 1);
  assert.equal(all.hits[0].cwd, "/proj/beta");
});

test("cwd prefix filter restricts to matching sessions", () => {
  const alpha = scanChat("trigram", { home, source: "all", cwd: "/proj/alpha" });
  assert.ok(alpha.hits.length > 0);
  const beta = scanChat("trigram", { home, days: 0, cwd: "/proj/beta" });
  assert.ok(beta.hits.every((h) => h.cwd === "/proj/beta"));
});

test("korean queries match and enrich with threads-table titles", () => {
  const r = scanChat("트라이그램", { home });
  assert.ok(r.hits.length >= 2);
  assert.equal(r.hits[0].title, "deploy trigram index");
  assert.equal(r.hits[0].gitBranch, "main");
});

test("context window carries neighbours and marks the match", () => {
  const r = scanChat("한글 트라이그램 결과", { home, context: 1 });
  assert.equal(r.hits.length, 1);
  const ctx = r.hits[0].context;
  assert.equal(ctx.length, 3);
  assert.equal(ctx.filter((c) => c.isMatch).length, 1);
});

test("role filter and limit cap apply", () => {
  const users = scanChat("trigram", { home, source: "all", role: "user" });
  assert.ok(users.hits.every((h) => h.role === "user"));
  const limited = scanChat("trigram", { home, source: "all", any: true, limit: 1 });
  assert.equal(limited.hits.length, 1);
});

test("missing state db degrades with a warning, not a failure", () => {
  const bare = mkdtempSync(join(tmpdir(), "recall-bare-"));
  try {
    const r = scanChat("anything", { home: bare });
    assert.equal(r.hits.length, 0);
    assert.ok(r.warnings.some((w) => w.includes("state db")));
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});
