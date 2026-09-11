/**
 * nl-query.test.ts — the wp5 natural-language golden set.
 *
 * Three sentences from the 2026-09-10 recall evaluation returned zero hits on
 * all six paths (chat and memory, index and scan). They failed for one reason:
 * a space-split query was truncated at eight words and then required every
 * surviving word. This file pins the recovery on a SYNTHETIC Codex home, so it
 * measures the matching rules rather than the state of the operator's corpus —
 * every chat query passes both `home` and `indexPath`, because a missing
 * `indexPath` silently answers from ~/.codexclaw/recall/index.sqlite.
 *
 * Each golden document is partial on purpose (see addNlGoldenCorpus): none of
 * them contains the whole sentence, so none of these assertions could pass
 * under the old all-words AND.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexHome, addNlGoldenCorpus } from "./fixtures.ts";
import { searchChat, chatMatchPlan, type ChatHit, type ChatSearchOptions } from "../src/chat-search.ts";
import { searchMemory, type MemorySearchOptions } from "../src/memory-search.ts";
import { main as cliMain } from "../src/cli.ts";

/** The three evaluation sentences, verbatim. */
const D3 = "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법";
const P2 = "코덱스를 재시작하면 플러그인이 사라지는 문제";
const R2 = "2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록";

let home: string;
let idx: string;

const chat = (q: string, o: ChatSearchOptions = {}) =>
  searchChat(q, { home, indexPath: idx, days: 0, noRefresh: true, ...o });
const chatScan = (q: string, o: ChatSearchOptions = {}) =>
  searchChat(q, { home, scan: true, days: 0, ...o });
const mem = (q: string, o: MemorySearchOptions = {}) => searchMemory(q, { home, ...o });

const key = (h: ChatHit) => `${h.ts}|${h.source}|${h.text}`;
const relpaths = (r: { hits: Array<{ relpath: string }> }) => r.hits.map((h) => h.relpath);

/**
 * Both index orderings must return exactly the scan path's hit set. This is the
 * wp5 extension of the index.test.ts oracle: once the optional groups leave the
 * SQL WHERE clause, the JS predicate is the only thing keeping the relevance
 * candidates, the top-up sweep and the recent page in agreement with the scan.
 */
function assertEnginesAgree(q: string, o: ChatSearchOptions = {}): ChatHit[] {
  const scan = chatScan(q, o);
  for (const order of ["relevance", "recent"] as const) {
    const viaIndex = chat(q, { ...o, order });
    assert.equal(viaIndex.mode, "index", `index mode expected for ${q}`);
    assert.deepEqual(
      viaIndex.hits.map(key).sort(),
      scan.hits.map(key).sort(),
      `index/scan mismatch (${order}) for ${JSON.stringify(q)}`,
    );
  }
  return scan.hits;
}

test.before(() => {
  home = mkdtempSync(join(tmpdir(), "recall-nl-"));
  idx = join(home, "sidecar", "index.sqlite");
  buildCodexHome(home);
  addNlGoldenCorpus(home);
  // Build the sidecar once; every query afterwards runs --no-refresh.
  searchChat("trigram", { home, indexPath: idx, days: 0 });
});

test.after(() => {
  rmSync(home, { recursive: true, force: true });
});

test("G-D3: the 10-word dogfooding sentence recovers on chat, index and scan alike", () => {
  const plan = chatMatchPlan(D3, false, false);
  assert.equal(plan.optional.length, 9, "방법 is dropped; the 9th and 10th words are no longer truncated");
  assert.equal(plan.required.length, 0, "korean prose carries no required term");
  assert.equal(plan.minOptional, 5);

  const hits = assertEnginesAgree(D3);
  assert.ok(hits.length >= 1, "the sentence must reach the transcript");
  assert.ok(
    hits.every((h) => /bun link|healthz/.test(h.text)),
    "the relaxed sweep must return the matching message, not merely the newest one",
  );
  // What makes this a relaxation and not a lucky AND: the hit does not contain
  // three of the words the user typed.
  assert.ok(hits.every((h) => !/지난번|확인한|방법/.test(h.text)));
});

test("G-D3: the same sentence reaches the memory store", () => {
  const r = mem(D3);
  assert.ok(relpaths(r).includes("nl-d3.md"), `expected nl-d3.md, got ${relpaths(r).join(", ")}`);
  assert.ok(!r.warnings.some((w) => w.includes("lower confidence")));
});

test("G-P2: a 5-word sentence stays strict AND — chat needs --synonyms to cross languages", () => {
  const plan = chatMatchPlan(P2, false, false);
  assert.equal(plan.optional.length, 0, "5 words is under the threshold: every group stays required");
  assert.equal(plan.required.length, 4, "문제 is dropped, the other four are required");

  // Default chat: the transcript says Codex, the query says 코덱스를. No hit,
  // and that is the contract — chat does not expand unless asked.
  assert.equal(assertEnginesAgree(P2).length, 0);

  const hits = assertEnginesAgree(P2, { synonyms: true });
  assert.ok(hits.length >= 1, "--synonyms must reach the english transcript");
  assert.ok(hits.every((h) => /BundledPluginsMarketplace|plugin wipe/.test(h.text)));
});

test("G-P2: memory expands by default, so the sentence needs no flag there", () => {
  const r = mem(P2);
  assert.ok(relpaths(r).includes("nl-p2.md"), `expected nl-p2.md, got ${relpaths(r).join(", ")}`);
  // Opting out of expansion loses the ko→en bridge: the file says Codex/restart.
  assert.equal(mem(P2, { synonyms: false }).hits.length, 0);
});

test("G-R2: symbols stay required while the korean padding becomes a quota", () => {
  const plan = chatMatchPlan(R2, false, false);
  assert.deepEqual(
    plan.required.map((g) => g[0].text),
    ["2.49.0", "npm"],
    "the version and the package manager are what make this query specific",
  );
  assert.equal(plan.optional.length, 6, "그 is dropped from the remaining seven");
  assert.equal(plan.minOptional, 3);

  const hits = assertEnginesAgree(R2);
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((h) => /gitHead|provenance/.test(h.text)));
  // The required symbols really are required: dropping one of them from the
  // corpus side (the user message has no npm) leaves that message out.
  assert.ok(hits.every((h) => h.text.includes("npm")));
});

test("G-R2: memory recovers the release record with and without synonyms", () => {
  for (const synonyms of [true, false]) {
    const r = mem(R2, { synonyms });
    assert.ok(
      relpaths(r).includes("nl-r2.md"),
      `synonyms=${synonyms}: expected nl-r2.md, got ${relpaths(r).join(", ")}`,
    );
  }
});

test("G-c4: relaxation does not loosen a boundary-gated symbol", () => {
  const r = mem("LSP");
  assert.ok(r.hits.length >= 1);
  assert.ok(
    relpaths(r).every((p) => p === "nl-c4-real.md"),
    `LSP must not match inside NaiControlsPanel, got ${relpaths(r).join(", ")}`,
  );
  assert.ok(!r.warnings.some((w) => w.includes("lower confidence")));
});

test("G-c5: an inflected korean query still reaches the uninflected document", () => {
  const r = mem("배포까지");
  assert.ok(relpaths(r).includes("nl-c5.md"), `expected nl-c5.md, got ${relpaths(r).join(", ")}`);
  assert.equal(mem("배포까지", { synonyms: false }).hits.length, 0, "opt-out drops the stem");
});

test("N-empty: an absent term still answers nothing on every path", () => {
  const absent = "zxqv84721무지개잠수함";
  assert.equal(assertEnginesAgree(absent).length, 0);
  assert.equal(mem(absent).hits.length, 0);
  // A sentence made of nothing but stopwords keeps its words rather than
  // relaxing into "match everything".
  assert.equal(mem("그 이 저 것 문제 방법").hits.length, 0);
});

test("cli: chat --synonyms reaches the engine, and stays off without it", () => {
  const captured: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    captured.push(s);
    return true;
  };
  try {
    // --home AND --index-path: without the second one this reads the operator's
    // real sidecar index instead of the fixture.
    const argv = ["chat", "search", P2, "--home", home, "--index-path", idx, "--days", "0", "--no-refresh", "--json"];
    assert.equal(cliMain([...argv]), 0);
    const off = JSON.parse(captured.join("")) as { hits: unknown[] };
    captured.length = 0;
    assert.equal(cliMain([...argv, "--synonyms"]), 0);
    const on = JSON.parse(captured.join("")) as { hits: unknown[] };
    assert.equal(off.hits.length, 0, "chat does not expand unless asked");
    assert.ok(on.hits.length >= 1, "--synonyms must reach the english transcript");
  } finally {
    (process.stdout as unknown as { write: typeof orig }).write = orig;
  }
});
