import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildCodexHome, dateParts, THREAD_MAIN, REPO_KEY_ALPHA } from "./fixtures.ts";
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
    // The oracle pins WHAT MATCHES, not what ranks: compare against the scan
    // path in recency order, which is the ordering the scan path can produce.
    // Relevance ordering is checked for set-equality below and ranked in
    // index-rank.test.ts.
    const a = viaIndex(q, { ...o, noRefresh: true, order: "recent" });
    const b = viaScan(q, o);
    assert.equal(a.mode, "index", `index mode expected for ${q}`);
    assert.deepEqual(
      a.hits.map((h) => [h.ts, h.role, h.text, h.matchField, h.source, h.cwd]),
      b.hits.map((h) => [h.ts, h.role, h.text, h.matchField, h.source, h.cwd]),
      `oracle mismatch for query=${JSON.stringify(q)} opts=${JSON.stringify(o)}`,
    );
    // Default (relevance) ordering must match the very same SET of messages.
    const ranked = viaIndex(q, { ...o, noRefresh: true });
    const key = (h: { ts: string; text: string; source: string }) => `${h.ts}|${h.source}|${h.text}`;
    assert.deepEqual(
      ranked.hits.map(key).sort(),
      b.hits.map(key).sort(),
      `ranking changed the hit set for query=${JSON.stringify(q)} opts=${JSON.stringify(o)}`,
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

test("oracle: a relaxed 9-word query agrees across engines in both orderings (wp5)", () => {
  // Past MAX_WORDS the WHERE clause stops carrying the whole requirement, so
  // the JS predicate has to hold three separate places together. The first
  // query still has required words ("the" and "for" are short-ASCII symbols);
  // the second has none at all, which is the case where SQL filters nothing and
  // the lane candidates, the top-up sweep and the recent page are each free to
  // drift on their own.
  const key = (h: { ts: string; text: string; source: string }) => `${h.ts}|${h.source}|${h.text}`;
  const cases: Array<[string, ChatSearchOptions]> = [
    ["please deploy the trigram index for korean search extra", { source: "all" }],
    ["please deploy trigram index korean search 확인 완료 없는단어", { source: "all" }],
  ];
  for (const [q, o] of cases) {
    const scan = viaScan(q, o);
    assert.ok(scan.hits.length > 0, `the relaxed query must match something: ${q}`);
    for (const order of ["recent", "relevance"] as const) {
      const a = viaIndex(q, { ...o, noRefresh: true, order });
      assert.equal(a.mode, "index", `index mode expected for ${q}`);
      assert.deepEqual(
        a.hits.map(key).sort(),
        scan.hits.map(key).sort(),
        `relaxed oracle mismatch (${order}) for ${JSON.stringify(q)}`,
      );
    }
  }
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

test("ingest stores the normalized git origin as files.repo_key", () => {
  const db = openIndex(idx);
  try {
    const rows = db
      .prepare("SELECT cwd, repo_key FROM files ORDER BY cwd")
      .all() as Array<Record<string, unknown>>;
    const alpha = rows.filter((r) => String(r.cwd).startsWith("/proj/alpha"));
    assert.ok(alpha.length >= 2, "the alpha sessions are indexed");
    const keyed = alpha.filter((r) => r.repo_key !== null);
    assert.ok(keyed.length >= 2, "sessions whose session_meta carries git get a key");
    for (const row of keyed) {
      assert.equal(row.repo_key, REPO_KEY_ALPHA, "https URL is stored normalized, not raw");
    }
    // Sessions recorded without a git object stay NULL rather than guessing.
    assert.ok(
      alpha.some((r) => r.repo_key === null),
      "the git-less fixture rollout keeps a NULL key",
    );
    // A different remote must land on a different key, never merge.
    const beta = rows.find((r) => r.cwd === "/proj/beta");
    assert.equal(beta?.repo_key, "github.com/example/beta");
  } finally {
    db.close();
  }
});

test("chat --cwd reaches another checkout of the same git origin", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-origin-idx-"));
  try {
    const today = dateParts(0);
    const dir = join(root, "sessions", today.y, today.m, today.d);
    mkdirSync(dir, { recursive: true });
    const origin = "https://github.com/example/gemsbok.git";
    const write = (suffix: string, threadId: string, cwd: string, text: string, url?: string) => {
      const payload: Record<string, unknown> = {
        id: threadId,
        timestamp: today.iso,
        cwd,
        originator: "codex-tui",
      };
      if (url) payload.git = { repository_url: url };
      writeFileSync(
        join(dir, `rollout-${today.y}-${today.m}-${today.d}T${suffix}-00-00-${threadId}.jsonl`),
        `${JSON.stringify({ timestamp: today.iso, type: "session_meta", payload })}\n` +
          `${JSON.stringify({
            timestamp: today.iso,
            type: "response_item",
            payload: { type: "message", role: "user", content: [{ type: "input_text", text }] },
          })}\n`,
      );
    };
    write("01", "019f3333-0000-7000-8000-0000000000a1", "/proj/gemsbok", "gemsbok work in the main checkout", origin);
    write("02", "019f3333-0000-7000-8000-0000000000a2", "/wt/gemsbok", "gemsbok work in the worktree", origin);
    write("03", "019f3333-0000-7000-8000-0000000000a3", "/proj/eland", "gemsbok mentioned by an unrelated repo");

    const originIdx = join(root, "sidecar", "origin.sqlite");
    const opts = { home: root, indexPath: originIdx, readOriginUrl: () => origin };
    // Prefix-only: the worktree sees itself alone.
    const local = searchChat("gemsbok", { ...opts, readOriginUrl: () => null, cwd: "/wt/gemsbok" });
    assert.equal(local.mode, "index");
    assert.deepEqual(local.hits.map((h) => h.cwd), ["/wt/gemsbok"]);

    // Same origin: the main checkout joins; the unrelated repo stays out.
    const federated = searchChat("gemsbok", { ...opts, cwd: "/wt/gemsbok", noRefresh: true });
    assert.equal(federated.mode, "index");
    assert.deepEqual(
      federated.hits.map((h) => h.cwd).sort(),
      ["/proj/gemsbok", "/wt/gemsbok"],
    );

    // The scan path applies the same rule, so index/scan parity survives it.
    const scanned = searchChat("gemsbok", { ...opts, cwd: "/wt/gemsbok", scan: true });
    assert.equal(scanned.mode, "scan");
    assert.deepEqual(
      scanned.hits.map((h) => h.cwd).sort(),
      federated.hits.map((h) => h.cwd).sort(),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("an index built before wp4 gains repo_key in place, without re-parsing msgs", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-migrate-"));
  try {
    buildCodexHome(root);
    const path = join(root, "sidecar", "legacy.sqlite");
    let db = openIndex(path);
    ingest(root, db, 0);
    const msgsBefore = (db.prepare("SELECT COUNT(*) AS n FROM msgs").get() as { n: number }).n;
    db.close();

    // Rewind to a pre-wp4 index: same rows, no column. This is the shape of the
    // operator's 12GB cache, which must migrate WITHOUT a schema-version bump
    // (a bump drops files+msgs and re-parses the whole corpus).
    const raw = new DatabaseSync(path);
    raw.exec("DROP INDEX IF EXISTS idx_files_repo_key");
    raw.exec("ALTER TABLE files DROP COLUMN repo_key");
    const legacyCols = (raw.prepare("PRAGMA table_info(files)").all() as Array<{ name: string }>).map(
      (c) => c.name,
    );
    assert.ok(!legacyCols.includes("repo_key"), "sanity: the column is really gone");
    raw.close();

    db = openIndex(path);
    try {
      const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
        value: string;
      };
      assert.equal(version.value, "2", "the migration must not bump the schema version");
      const cols = (db.prepare("PRAGMA table_info(files)").all() as Array<{ name: string }>).map(
        (c) => c.name,
      );
      assert.ok(cols.includes("repo_key"), "ADD COLUMN ran on the existing table");

      // Unchanged files are skipped by (mtime, size), so the keys can only come
      // from the threads join — no JSONL head is re-read and no message moves.
      const result = ingest(root, db, 0);
      assert.equal(result.ingested + result.appended, 0, "no file was re-parsed");
      assert.equal(
        (db.prepare("SELECT COUNT(*) AS n FROM msgs").get() as { n: number }).n,
        msgsBefore,
        "the message table is untouched",
      );
      const alpha = db
        .prepare("SELECT repo_key FROM files WHERE cwd LIKE '/proj/alpha%' AND thread_id = ?")
        .all(THREAD_MAIN) as Array<{ repo_key: unknown }>;
      assert.equal(alpha.length, 1);
      assert.equal(alpha[0].repo_key, REPO_KEY_ALPHA, "backfilled from threads.git_origin_url");

      // Idempotent: a second pass changes nothing and still leaves unknown
      // threads NULL rather than guessing a key for them.
      ingest(root, db, 0);
      const after = db.prepare("SELECT repo_key FROM files WHERE thread_id = ?").all(THREAD_MAIN) as Array<{
        repo_key: unknown;
      }>;
      assert.equal(after[0].repo_key, REPO_KEY_ALPHA);
    } finally {
      db.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
