import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dateParts } from "./fixtures.ts";
import { openIndex } from "../src/index-db.ts";
import { ingest } from "../src/ingest.ts";
import { listCwdSessions } from "../src/cwd-context.ts";
import { loadSummaryIndex } from "../src/cwd-context.ts";

// A real ingested index, not a hand-built table: the cwd column and the synthetic
// flag must come from the same code path production uses.
let home: string;
let idx: string;
const CWD = "/hash/worktrees/1fa9/project";
/** The same repository, checked out where the user actually works. */
const MAIN_CHECKOUT = "/Users/someone/dev/project";
const ORIGIN = "https://github.com/example/project.git";
const OTHER_ORIGIN = "git@github.com:example/unrelated.git";

function rollout(
  threadId: string,
  cwd: string,
  iso: string,
  msgs: Array<[string, string]>,
  repositoryUrl?: string,
): string {
  const lines = [
    JSON.stringify({
      timestamp: iso,
      type: "session_meta",
      payload: {
        id: threadId,
        timestamp: iso,
        cwd,
        originator: "codex-tui",
        cli_version: "0.130.0",
        ...(repositoryUrl ? { git: { repository_url: repositoryUrl, branch: "main" } } : {}),
      },
    }),
  ];
  for (const [role, text] of msgs) {
    lines.push(
      JSON.stringify({
        timestamp: iso,
        type: "response_item",
        payload: {
          type: "message",
          role,
          content: [{ type: role === "assistant" ? "output_text" : "input_text", text }],
        },
      }),
    );
  }
  return lines.join("\n") + "\n";
}

test.before(() => {
  home = mkdtempSync(join(tmpdir(), "recall-cwdctx-"));
  idx = join(home, "sidecar", "index.sqlite");
  const today = dateParts(0);
  const dir = join(home, "sessions", today.y, today.m, today.d);
  mkdirSync(dir, { recursive: true });

  // Newest: the real opener sits behind a harness block that ingest does NOT
  // flag synthetic, so it is only skippable at read time.
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T03-00-00-019f0000-0000-7000-8000-0000000000a1.jsonl`),
    rollout("019f0000-0000-7000-8000-0000000000a1", CWD, today.iso, [
      ["user", "<recommended_plugins>\nHere is a list of plugins that are available."],
      ["user", "wire the hook budget to the compaction source"],
      ["assistant", "done"],
    ]),
  );
  // Older session in the same cwd.
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T02-00-00-019f0000-0000-7000-8000-0000000000a2.jsonl`),
    rollout("019f0000-0000-7000-8000-0000000000a2", CWD, today.iso, [
      ["user", "audit the postcompact envelope"],
      ["assistant", "ok"],
    ]),
  );
  // A different cwd that must never leak into this one's context.
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T01-00-00-019f0000-0000-7000-8000-0000000000a3.jsonl`),
    rollout("019f0000-0000-7000-8000-0000000000a3", "/other/project", today.iso, [
      ["user", "secret from another project"],
      ["assistant", "ok"],
    ]),
  );

  // Same repository as the hash slot above, checked out elsewhere. A brand-new
  // slot has no history of its own, so this is the session the hook needs.
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T04-00-00-019f0000-0000-7000-8000-0000000000a4.jsonl`),
    rollout(
      "019f0000-0000-7000-8000-0000000000a4",
      MAIN_CHECKOUT,
      today.iso,
      [
        ["user", "land the parser rewrite on the main checkout"],
        ["assistant", "ok"],
      ],
      ORIGIN,
    ),
  );

  const db = openIndex(idx);
  try {
    ingest(home, db, 0);
  } finally {
    db.close();
  }
});

test.after(() => {
  rmSync(home, { recursive: true, force: true });
});

test("cwd enumeration finds sessions a basename text search cannot", () => {
  // The directory name "1fa9" appears nowhere in the conversation text, which is
  // exactly the case the old basename(cwd) query missed.
  const sessions = listCwdSessions(CWD, 5, { indexPath: idx });
  assert.ok(sessions, "index is present, so this must not be a fallback");
  assert.equal(sessions.length, 2);
  assert.deepEqual(
    sessions.map((s) => s.excerpt),
    ["wire the hook budget to the compaction source", "audit the postcompact envelope"],
  );
  for (const s of sessions) {
    assert.doesNotMatch(s.excerpt, /recommended_plugins/, "harness opener is skipped at read time");
  }
});

test("cwd enumeration never returns another directory's sessions", () => {
  const sessions = listCwdSessions(CWD, 5, { indexPath: idx }) ?? [];
  for (const s of sessions) assert.doesNotMatch(s.excerpt, /secret from another project/);
  const other = listCwdSessions("/other/project", 5, { indexPath: idx }) ?? [];
  assert.equal(other.length, 1);
  assert.equal(other[0].excerpt, "secret from another project");
  // A cwd with no rows is an empty list, not a fallback signal.
  assert.deepEqual(listCwdSessions("/nonexistent/cwd", 5, { indexPath: idx }), []);
});

test("a fresh worktree slot sees the same repository's other checkout", () => {
  // Without an origin the slot only has its own two sessions...
  const local = listCwdSessions(CWD, 5, { indexPath: idx, home, readOriginUrl: () => null }) ?? [];
  assert.equal(local.length, 2);

  // ...and with one, the main checkout of the same remote joins them.
  const federated = listCwdSessions(CWD, 5, { indexPath: idx, home, readOriginUrl: () => ORIGIN }) ?? [];
  assert.equal(federated.length, 3);
  assert.ok(
    federated.some((s) => s.excerpt === "land the parser rewrite on the main checkout"),
    "the same-origin session must be listed",
  );
  for (const s of federated) assert.doesNotMatch(s.excerpt, /secret from another project/);
});

test("a different remote never federates into this project", () => {
  const sessions =
    listCwdSessions(CWD, 5, { indexPath: idx, home, readOriginUrl: () => OTHER_ORIGIN }) ?? [];
  assert.equal(sessions.length, 2, "only this cwd's own sessions");
  for (const s of sessions) {
    assert.doesNotMatch(s.excerpt, /main checkout/);
    assert.doesNotMatch(s.excerpt, /secret from another project/);
  }
});

test("a missing index yields null so the caller can fall back", () => {
  assert.equal(listCwdSessions(CWD, 5, { indexPath: join(home, "absent", "index.sqlite") }), null);
  assert.equal(listCwdSessions("", 5, { indexPath: idx }), null);
  assert.equal(listCwdSessions(CWD, 0, { indexPath: idx }), null);
});

test("excerpts are single-line and length-capped", () => {
  const long = mkdtempSync(join(tmpdir(), "recall-cwdctx-long-"));
  try {
    const today = dateParts(0);
    const dir = join(long, "sessions", today.y, today.m, today.d);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `rollout-${today.y}-${today.m}-${today.d}T01-00-00-019f0000-0000-7000-8000-0000000000b1.jsonl`),
      rollout("019f0000-0000-7000-8000-0000000000b1", "/long/cwd", today.iso, [
        ["user", `first line\nsecond line ${"x".repeat(300)}`],
      ]),
    );
    const lidx = join(long, "sidecar", "index.sqlite");
    const db = openIndex(lidx);
    try {
      ingest(long, db, 0);
    } finally {
      db.close();
    }
    const sessions = listCwdSessions("/long/cwd", 5, { indexPath: lidx }) ?? [];
    assert.equal(sessions.length, 1);
    const excerpt = sessions[0].excerpt;
    assert.doesNotMatch(excerpt, /\n/, "newlines are collapsed to keep one session on one line");
    assert.ok(excerpt.length <= 100, `capped, got ${excerpt.length}`);
    assert.ok(excerpt.endsWith("..."), "an over-long opener is marked as clipped");
  } finally {
    rmSync(long, { recursive: true, force: true });
  }
});

test("summary index maps thread ids to the first heading, tolerating bad files", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-summaries-"));
  try {
    const dir = join(root, "memories", "rollout_summaries");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "2026-09-09-abcd-good.md"),
      [
        "thread_id: 019f0000-0000-7000-8000-0000000000c1",
        "updated_at: 2026-09-09T03:19:27+00:00",
        "cwd: /repo/current",
        "",
        "# Fixed the PostCompact envelope and moved recovery to SessionStart",
        "",
        "# A second heading that must not win",
      ].join("\n"),
    );
    // No heading: contributes nothing rather than an empty title.
    writeFileSync(
      join(dir, "2026-09-08-efgh-headless.md"),
      "thread_id: 019f0000-0000-7000-8000-0000000000c2\ncwd: /repo/current\n",
    );
    // No frontmatter at all.
    writeFileSync(join(dir, "2026-09-08-ijkl-bare.md"), "# heading with no thread id\n");
    // Non-markdown is ignored outright.
    writeFileSync(join(dir, "notes.txt"), "thread_id: x\n# nope\n");

    const index = loadSummaryIndex(root);
    assert.equal(index.size, 1);
    const entry = index.get("019f0000-0000-7000-8000-0000000000c1");
    assert.equal(entry?.title, "Fixed the PostCompact envelope and moved recovery to SessionStart");
    assert.equal(entry?.relpath, "2026-09-09-abcd-good.md");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a machine with no summaries yields an empty map, never a throw", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-nosummaries-"));
  try {
    assert.equal(loadSummaryIndex(root).size, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
