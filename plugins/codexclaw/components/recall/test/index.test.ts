import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexHome, dateParts, THREAD_MAIN } from "./fixtures.ts";
import { searchChat, type ChatSearchOptions } from "../src/chat-search.ts";
import { openIndex, indexStatus } from "../src/index-db.ts";
import { ingest, TOOL_TEXT_CAP } from "../src/ingest.ts";
import { main as cliMain } from "../src/cli.ts";

let home: string;
let idx: string;

const viaIndex = (q: string, o: ChatSearchOptions = {}) =>
  searchChat(q, { home, indexPath: idx, ...o });
const viaScan = (q: string, o: ChatSearchOptions = {}) => searchChat(q, { home, scan: true, ...o });

test.before(() => {
  home = mkdtempSync(join(tmpdir(), "recall-idx-"));
  idx = join(home, "sidecar", "index.sqlite");
  buildCodexHome(home);
});

test.after(() => {
  rmSync(home, { recursive: true, force: true });
});

test("ingest: builds, is incremental, and prunes deleted files", () => {
  const db = openIndex(idx);
  try {
    const first = ingest(home, db, 0);
    assert.equal(first.ingested, 4, "all fixture rollouts ingested (incl. archived)");
    assert.ok(first.msgs > 0);
    const second = ingest(home, db, 0);
    assert.equal(second.ingested, 0, "unchanged files skipped");
    assert.equal(second.pruned, 0);
    const status = indexStatus(db, idx);
    assert.equal(status.files, 4);
    assert.ok(status.lastIngestAt !== null);
  } finally {
    db.close();
  }
});

test("oracle: index-mode hits equal scan-mode hits across engines and filters", () => {
  const cases: Array<[string, ChatSearchOptions]> = [
    ["trigram korean", { source: "all" }],
    ["trigram korean", { source: "all", any: true }],
    ["trigram", {}],
    ["trigram", { source: "subagent" }],
    ["트라이그램", {}],
    ["zebra", { role: "user" }],
    ["zebra", { role: "user", includeSynthetic: true }],
    ["zebra-in-tool-output", {}],
    ["zebra-in-tool-output", { includeTools: false }],
    ["ancient question", { days: 0 }],
    ["trigram", { source: "all", cwd: "/proj/alpha" }],
  ];
  for (const [q, o] of cases) {
    const a = viaIndex(q, { ...o, noRefresh: true });
    const b = viaScan(q, o);
    assert.equal(a.mode, "index", `index mode expected for ${q}`);
    assert.deepEqual(
      a.hits.map((h) => [h.ts, h.role, h.text, h.matchField, h.source, h.cwd]),
      b.hits.map((h) => [h.ts, h.role, h.text, h.matchField, h.source, h.cwd]),
      `oracle mismatch for query=${JSON.stringify(q)} opts=${JSON.stringify(o)}`,
    );
  }
});

test("index context windows match scan context windows", () => {
  const a = viaIndex("한글 트라이그램 결과", { context: 1, noRefresh: true });
  const b = viaScan("한글 트라이그램 결과", { context: 1 });
  assert.equal(a.hits.length, 1);
  assert.deepEqual(
    a.hits[0].context.map((c) => [c.role, c.text, c.isMatch]),
    b.hits[0].context.map((c) => [c.role, c.text, c.isMatch]),
  );
});

test("short (<3 char) words fall back to LIKE and still match", () => {
  // "한글" is 2 chars — trigram cannot serve it (verified in the WP2 spike).
  const a = viaIndex("한글", { noRefresh: true });
  const b = viaScan("한글");
  assert.ok(a.hits.length > 0, "short korean word must match via LIKE fallback");
  assert.equal(a.hits.length, b.hits.length);
});

test("fts special characters are neutralized by quoting", () => {
  const r = viaIndex('trigram "index', { noRefresh: true, any: true });
  assert.equal(r.mode, "index");
  assert.ok(Array.isArray(r.hits), "no MATCH syntax error");
});

test("append-aware ingest: grown files parse only the appended range", () => {
  const idx2 = join(home, "sidecar", "append.sqlite");
  const db = openIndex(idx2);
  try {
    const first = ingest(home, db, 0);
    assert.ok(first.ingested >= 3);
    const today = dateParts(0);
    const file = join(
      home,
      "sessions",
      today.y,
      today.m,
      today.d,
      `rollout-${today.y}-${today.m}-${today.d}T01-00-00-${THREAD_MAIN}.jsonl`,
    );
    const line =
      JSON.stringify({
        timestamp: today.iso,
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "appended 한글 문장 quokka" }] },
      }) + "\n";
    writeFileSync(file, readFileSync(file, "utf8") + line);
    const bumped = new Date(Date.now() + 2_000);
    utimesSync(file, bumped, bumped);
    const before = (db.prepare("SELECT COUNT(*) AS n FROM msgs").get() as { n: number }).n;
    const second = ingest(home, db, 0);
    assert.equal(second.appended, 1, "grown file must take the append path");
    assert.equal(second.ingested, 0, "no full re-ingest for a grown file");
    assert.equal(second.msgs, 1, "exactly the appended entry lands");
    const after = (db.prepare("SELECT COUNT(*) AS n FROM msgs").get() as { n: number }).n;
    assert.equal(after, before + 1);
    const hit = db
      .prepare("SELECT rowid FROM msgs_tri WHERE msgs_tri MATCH ?")
      .all('"quokka"');
    assert.equal(hit.length, 1, "appended korean/english text is FTS-visible");
    const third = ingest(home, db, 0);
    assert.equal(third.appended + third.ingested, 0, "stable after append");
  } finally {
    db.close();
  }
});

test("refresh-on-query picks up newly appended session lines", () => {
  const today = dateParts(0);
  const dir = join(home, "sessions", today.y, today.m, today.d);
  const file = join(dir, `rollout-${today.y}-${today.m}-${today.d}T01-00-00-${THREAD_MAIN}.jsonl`);
  const appended =
    JSON.stringify({
      timestamp: today.iso,
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "freshly appended xylophone question" }] },
    }) + "\n";
  writeFileSync(file, readFileSync(file, "utf8") + appended);
  // Ensure mtime changes even on coarse-grained filesystems.
  const bumped = new Date(Date.now() + 2_000);
  utimesSync(file, bumped, bumped);
  const stale = viaIndex("xylophone", { noRefresh: true });
  assert.equal(stale.hits.length, 0, "stale index must miss the new line");
  const fresh = viaIndex("xylophone", {});
  assert.equal(fresh.hits.length, 1, "refresh-on-query must ingest the change");
});

test("tool outputs are capped at TOOL_TEXT_CAP in the index", () => {
  const today = dateParts(0);
  const dir = join(home, "sessions", today.y, today.m, today.d);
  const big = "y".repeat(TOOL_TEXT_CAP + 500) + " needleinbigoutput";
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T03-00-00-019f0000-0000-7000-8000-00000000dddd.jsonl`),
    JSON.stringify({ timestamp: today.iso, type: "session_meta", payload: { id: "019f0000-0000-7000-8000-00000000dddd", cwd: "/proj/alpha", originator: "codex-tui" } }) +
      "\n" +
      JSON.stringify({ timestamp: today.iso, type: "response_item", payload: { type: "function_call_output", call_id: "t", output: big } }) +
      "\n",
  );
  const capped = viaIndex("needleinbigoutput", {});
  assert.equal(capped.hits.length, 0, "text beyond the cap is not indexed");
  const scan = viaScan("needleinbigoutput");
  assert.equal(scan.hits.length, 1, "scan path still sees the full output");
});

test("cli: chat index --status and --rebuild work against --index-path", () => {
  const captured: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    captured.push(s);
    return true;
  };
  try {
    assert.equal(cliMain(["chat", "index", "--home", home, "--index-path", idx, "--status"]), 0);
    assert.match(captured.join(""), /files: \d+, messages: \d+/);
    captured.length = 0;
    assert.equal(cliMain(["chat", "index", "--home", home, "--index-path", idx, "--rebuild"]), 0);
    assert.match(captured.join(""), /ingested \d+\/\d+ files/);
  } finally {
    (process.stdout as unknown as { write: typeof orig }).write = orig;
  }
});

test("broken index path degrades to scan with a warning", () => {
  const r = searchChat("trigram", { home, indexPath: join(home, "sessions") });
  assert.equal(r.mode, "scan");
  assert.ok(r.warnings.some((w) => w.includes("index unavailable")));
  assert.ok(r.hits.length > 0);
});
