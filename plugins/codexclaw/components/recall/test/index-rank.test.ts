/**
 * index-rank.test.ts — WP5 chat-search ranking: BM25 lane + trigram lane fused
 * with RRF, plus a bounded recency term.
 *
 * Builds an ISOLATED temp CODEX_HOME (never the shared fixture home) so the
 * corpus can be shaped for ranking, and injects `nowMs` for determinism.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchChat, type ChatSearchOptions } from "../src/chat-search.ts";
import {
  RRF_K,
  LANE_WEIGHT_FTS,
  LANE_WEIGHT_TRI,
  RECENCY_WEIGHT,
  RECENCY_HALF_LIFE_HOURS,
  rrfScore,
  recencyScore,
} from "../src/index-search.ts";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-09-09T00:00:00Z");

let home: string;
let idx: string;

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString();
}

function line(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}

function message(role: string, text: string, ts: string): string {
  return line({
    timestamp: ts,
    type: "response_item",
    payload: {
      type: "message",
      role,
      content: [{ type: role === "assistant" ? "output_text" : "input_text", text }],
    },
  });
}

/** One rollout file per thread; `msAgo` places both the filename date and stamps. */
function rollout(threadId: string, msAgo: number, texts: Array<[string, string]>): void {
  const at = new Date(NOW - msAgo);
  const y = String(at.getUTCFullYear());
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  const dir = join(home, "sessions", y, m, d);
  mkdirSync(dir, { recursive: true });
  const ts = at.toISOString();
  const body =
    line({
      timestamp: ts,
      type: "session_meta",
      payload: { id: threadId, timestamp: ts, cwd: "/proj/rank", originator: "codex-tui" },
    }) + texts.map(([role, text]) => message(role, text, ts)).join("");
  writeFileSync(join(dir, `rollout-${y}-${m}-${d}T00-00-00-${threadId}.jsonl`), body);
}

const search = (q: string, o: ChatSearchOptions = {}) =>
  searchChat(q, { home, indexPath: idx, days: 0, nowMs: NOW, ...o });

test.before(() => {
  home = mkdtempSync(join(tmpdir(), "recall-rank-"));
  idx = join(home, "sidecar", "index.sqlite");
  // Oldest file is the ON-TOPIC one: pure recency order would bury it.
  rollout("019f0000-0000-7000-8000-0000000f0001", 30 * 24 * HOUR, [
    ["user", "quokka deployment plan for the quokka rollout, quokka everywhere"],
  ]);
  // Newer files mention the term once, in passing.
  rollout("019f0000-0000-7000-8000-0000000f0002", 12 * HOUR, [
    ["user", "unrelated standup notes that happen to name quokka once among many other words here"],
  ]);
  rollout("019f0000-0000-7000-8000-0000000f0003", 1 * HOUR, [
    ["user", "another long unrelated message about pipelines, caches, and a quokka reference at the end"],
  ]);
  // Two equally-relevant messages that differ only in age (recency tie-break).
  rollout("019f0000-0000-7000-8000-0000000f0004", 60 * 24 * HOUR, [["user", "wombat wombat"]]);
  rollout("019f0000-0000-7000-8000-0000000f0005", 2 * HOUR, [["user", "wombat wombat"]]);
  // Korean corpus: >=3 chars goes to trigram, 2 chars falls back to LIKE.
  rollout("019f0000-0000-7000-8000-0000000f0006", 20 * 24 * HOUR, [
    ["user", "트라이그램 색인 트라이그램 재구축 트라이그램 완료"],
  ]);
  rollout("019f0000-0000-7000-8000-0000000f0007", 3 * HOUR, [
    ["assistant", "한글 문서에서 트라이그램 이야기를 잠깐 언급했다"],
  ]);
});

test.after(() => {
  rmSync(home, { recursive: true, force: true });
});

test("rrfScore: k=60, weighted lanes, absent rank contributes nothing", () => {
  assert.equal(RRF_K, 60);
  assert.equal(LANE_WEIGHT_FTS, 1.0);
  assert.equal(LANE_WEIGHT_TRI, 0.8);
  assert.equal(rrfScore(undefined, LANE_WEIGHT_FTS), 0);
  assert.equal(rrfScore(0, LANE_WEIGHT_FTS), 1 / 61);
  assert.equal(rrfScore(1, LANE_WEIGHT_FTS), 1 / 62);
  assert.equal(rrfScore(0, LANE_WEIGHT_TRI), 0.8 / 61);
  assert.ok(rrfScore(0, LANE_WEIGHT_FTS) > rrfScore(0, LANE_WEIGHT_TRI), "fts lane outweighs trigram");
});

test("recencyScore: bounded, decays by half-life, clamps future stamps", () => {
  assert.equal(recencyScore(NOW, NOW), RECENCY_WEIGHT);
  assert.equal(recencyScore(NOW + 500 * HOUR, NOW), RECENCY_WEIGHT, "future clamps to age 0");
  assert.equal(recencyScore(null, NOW), 0);
  const half = recencyScore(NOW - RECENCY_HALF_LIFE_HOURS * HOUR, NOW);
  assert.ok(Math.abs(half - RECENCY_WEIGHT / 2) < 1e-12, `half-life midpoint, got ${half}`);
  // Sizing contract: the whole recency term equals ONE adjacent-rank gap at the
  // head of the BM25 lane, so a hit leading in BOTH lanes cannot be overturned.
  const oneRankFts = rrfScore(0, LANE_WEIGHT_FTS) - rrfScore(1, LANE_WEIGHT_FTS);
  const oneRankTri = rrfScore(0, LANE_WEIGHT_TRI) - rrfScore(1, LANE_WEIGHT_TRI);
  assert.ok(Math.abs(RECENCY_WEIGHT - oneRankFts) < 1e-15, "recency == one BM25 rank gap");
  assert.ok(RECENCY_WEIGHT < oneRankFts + oneRankTri, "a both-lane lead survives any freshness gap");
});

test("relevance is the default: a dense old match beats fresher passing mentions", () => {
  const r = search("quokka");
  assert.equal(r.mode, "index");
  assert.equal(r.hits.length, 3);
  assert.match(r.hits[0].text, /quokka deployment plan/, "densest match ranks first despite being oldest");
  assert.ok(typeof r.hits[0].score === "number");
  assert.ok(
    r.hits.every((h, i) => i === 0 || (r.hits[i - 1].score ?? 0) >= (h.score ?? 0)),
    "hits ordered by fused score desc",
  );
  // The same query in recency mode gives the OLD behaviour: newest first.
  const recent = search("quokka", { order: "recent" });
  assert.deepEqual(
    recent.hits.map((h) => h.ts),
    [...recent.hits.map((h) => h.ts)].sort().reverse(),
    "--recent stays pure ts DESC",
  );
  assert.match(recent.hits[0].text, /quokka reference at the end/);
  assert.equal(recent.hits[0].score, undefined, "recency mode carries no fused score");
});

test("both orderings return the same hit SET — ranking reorders, never filters", () => {
  for (const q of ["quokka", "wombat", "트라이그램"]) {
    const ranked = search(q);
    const recent = search(q, { order: "recent" });
    assert.deepEqual(
      ranked.hits.map((h) => h.ts + h.text).sort(),
      recent.hits.map((h) => h.ts + h.text).sort(),
      `hit set must not change with ordering for ${q}`,
    );
  }
});

test("recency breaks ties between equally relevant matches", () => {
  const r = search("wombat");
  assert.equal(r.hits.length, 2);
  assert.ok(r.hits[0].ts > r.hits[1].ts, "newer of two identical matches ranks first");
  assert.ok((r.hits[0].score ?? 0) > (r.hits[1].score ?? 0));
});

test("korean: trigram lane ranks CJK, and 2-char LIKE fallback still returns hits", () => {
  const r = search("트라이그램");
  assert.equal(r.hits.length, 2);
  assert.match(r.hits[0].text, /트라이그램 색인/, "the denser korean match wins over the fresher mention");
  // "한글" is 2 chars: no FTS lane can serve it, so this exercises the
  // degenerate fusion path (both lanes empty) and must still work.
  const short = search("한글");
  assert.ok(short.hits.length > 0, "short korean word still matches via LIKE");
  const shortScan = searchChat("한글", { home, days: 0, scan: true });
  assert.equal(short.hits.length, shortScan.hits.length, "index and scan agree on the LIKE path");
});

test("ranking is deterministic across repeated queries", () => {
  const a = search("quokka");
  const b = search("quokka");
  assert.deepEqual(a.hits.map((h) => [h.ts, h.text, h.score]), b.hits.map((h) => [h.ts, h.text, h.score]));
});

test("limit still truncates and warns under relevance ordering", () => {
  const r = search("quokka", { limit: 1 });
  assert.equal(r.hits.length, 1);
  assert.match(r.hits[0].text, /quokka deployment plan/, "the truncated slot keeps the best hit");
  assert.ok(r.warnings.some((w) => w.includes("truncated at limit 1")));
});
