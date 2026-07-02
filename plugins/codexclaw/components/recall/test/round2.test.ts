import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexHome } from "./fixtures.ts";
import { searchChat } from "../src/chat-search.ts";
import { openIndex, openIndexReadOnly } from "../src/index-db.ts";
import { ingest } from "../src/ingest.ts";
import { searchMemory } from "../src/memory-search.ts";
import { clipChatResultForJson } from "../src/format.ts";
import { detectRecallIntent } from "../src/hook.ts";
import { parseRollout, cwdMatches } from "../src/rollout.ts";

let home: string;
let idx: string;

test.before(() => {
  home = mkdtempSync(join(tmpdir(), "recall-r2-"));
  idx = join(home, "sidecar", "index.sqlite");
  buildCodexHome(home);
  const db = openIndex(idx);
  ingest(home, db, 0);
  db.close();
});

test.after(() => {
  rmSync(home, { recursive: true, force: true });
});

test("gap1: --no-refresh opens the index read-only and reports freshness", () => {
  const r = searchChat("trigram", { home, indexPath: idx, noRefresh: true });
  assert.equal(r.mode, "index");
  assert.ok(r.index, "freshness metadata present");
  assert.equal(r.index.readOnly, true);
  assert.ok(r.index.files >= 4);
  assert.ok(r.index.sourceFiles >= r.index.files - r.index.staleFiles);
  assert.ok(typeof r.index.lastIngestAt === "string");
});

test("gap1: openIndexReadOnly refuses to create a missing index", () => {
  assert.throws(() => openIndexReadOnly(join(home, "nope.sqlite")), /no index at/);
  // ...and searchChat degrades to scan (not a crash) for a missing index path.
  const r = searchChat("trigram", { home, indexPath: join(home, "nope.sqlite"), noRefresh: true });
  assert.equal(r.mode, "scan");
  assert.ok(r.warnings.some((w) => w.includes("index unavailable")));
});

test("gap7: refreshing queries also carry freshness metadata", () => {
  const r = searchChat("trigram", { home, indexPath: idx });
  assert.equal(r.mode, "index");
  assert.ok(r.index);
  assert.equal(r.index.readOnly, false);
  assert.equal(r.index.staleFiles, 0, "fresh after refresh-on-query");
});

test("gap2: memory ranking puts phrase matches above scattered word matches", () => {
  // "trigram sidecar" appears as an exact phrase in MEMORY.md task line.
  const r = searchMemory("trigram sidecar", { home });
  assert.ok(r.hits.length >= 1);
  assert.ok(r.hits[0].score >= 4, "top hit must carry coverage + boosts");
  assert.ok(
    r.hits.every((h, i) => i === 0 || r.hits[i - 1].score >= h.score),
    "hits ordered by score desc",
  );
});

test("gap3: one file cannot consume every memory slot (per-file cap)", () => {
  writeFileSync(
    join(home, "memories", "fat.md"),
    "capybara one\n\ncapybara two\n\ncapybara three\n\ncapybara four\n",
  );
  const r = searchMemory("capybara", { home, limit: 10 });
  const fromFat = r.hits.filter((h) => h.relpath === "fat.md");
  assert.equal(fromFat.length, 2, "per-file cap of 2 applies");
});

test("gap4: hardened hook patterns and suppression", () => {
  assert.ok(detectRecallIntent("as discussed previously, wire the index"));
  assert.ok(detectRecallIntent("we discussed last time that ingest should cap tools"));
  assert.equal(
    detectRecallIntent('node bin/codexclaw.mjs chat search "trigram" --days 0; what did we do last time?'),
    false,
    "raw codexclaw.mjs invocation suppresses the nudge",
  );
  assert.equal(
    detectRecallIntent('run chat search "trigram index" like last time'),
    false,
    "generic chat search invocation suppresses the nudge",
  );
});

test("wp5: structured function_call_output arrays are text-extracted, not stringified", () => {
  const line = JSON.stringify({
    timestamp: "2026-07-02T00:00:00.000Z",
    type: "response_item",
    payload: {
      type: "function_call_output",
      call_id: "t",
      output: [{ type: "output_text", text: "structured narwhal output" }, "plain tail"],
    },
  });
  const entries = parseRollout(`${line}\n`, true);
  assert.equal(entries.length, 1);
  assert.match(entries[0].text, /structured narwhal output/);
  assert.match(entries[0].text, /plain tail/);
  assert.ok(!entries[0].text.includes("[object Object]"));
});

test("wp5: cwd prefix matching is separator-aware (no /repo → /repo2 false positive)", () => {
  assert.ok(cwdMatches("/proj/alpha", "/proj/alpha"));
  assert.ok(cwdMatches("/proj/alpha/sub", "/proj/alpha"));
  assert.ok(cwdMatches("C:\\proj\\alpha\\sub", "C:\\proj\\alpha"));
  assert.equal(cwdMatches("/proj/alphabet", "/proj/alpha"), false);
  const alpha = searchChat("trigram", { home, source: "all", scan: true, cwd: "/proj/alph" });
  assert.equal(alpha.hits.length, 0, "partial path segment must not match");
});

test("gap5: JSON clipping bounds text/title/context and flags it", () => {
  const long = "z".repeat(1200);
  const base = searchChat("trigram", { home, indexPath: idx, noRefresh: true, context: 1 });
  const fat = {
    ...base,
    hits: base.hits.map((h) => ({ ...h, text: long, title: long, context: [{ ts: "", role: "user", text: long, isMatch: true }] })),
  };
  const clipped = clipChatResultForJson(fat);
  assert.equal(clipped.clipped, true);
  for (const h of clipped.hits) {
    assert.ok(h.text.length <= 501);
    assert.ok((h.title ?? "").length <= 501);
    assert.ok(h.context.every((c) => c.text.length <= 501));
  }
  const thin = clipChatResultForJson(base);
  assert.ok(base.hits.length > 0, "sanity: base query must actually hit");
  assert.equal(thin.clipped, false, "short fields stay untouched");
  assert.deepEqual(
    thin.hits.map((h) => h.text),
    base.hits.map((h) => h.text),
  );
});
