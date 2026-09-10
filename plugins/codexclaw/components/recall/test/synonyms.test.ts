/**
 * synonyms.test.ts — curated ko/en synonym expansion for memory search:
 * cross-language recall, opt-out, AND-across-groups preservation, the
 * documented same-group multiword collapse (A-gate reviewer warning #2), and
 * R2 Korean ending trimming with its over-trimming guards.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandQueryWords, koreanStem, SYNONYM_GROUPS } from "../src/synonyms.ts";
import { groupTexts } from "../src/query-words.ts";
import { searchMemory, scoreChunk } from "../src/memory-search.ts";

test("scoreChunk: synonym hit scores density on the best-present member (C-gate blocker #1)", () => {
  const text = "decision decision decision made here";
  const viaSynonym = scoreChunk(text, expandQueryWords(["결정"]), "결정");
  const viaLiteral = scoreChunk(text, expandQueryWords(["decision"]), "decision");
  assert.equal(viaSynonym, viaLiteral, "결정 must score identically to decision on the same text");
});

test("expandQueryWords: OR-groups lead with the original word, unknown words stay singleton", () => {
  const groups = expandQueryWords(["결정", "quagga"]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0][0].text, "결정");
  assert.ok(groupTexts(groups[0]).includes("decision"), "korean term expands to its english family");
  assert.deepEqual(groupTexts(groups[1]), ["quagga"]);
  for (const g of expandQueryWords(SYNONYM_GROUPS.map((g) => g[0]))) {
    assert.ok(g.length <= 8, "group cap holds");
  }
});

test("koreanStem: trims measured endings, refuses everything that would over-trim", () => {
  // Real inflections from the corpus ending survey (011 3.3).
  assert.equal(koreanStem("배포까지"), "배포");
  assert.equal(koreanStem("문서를"), "문서");
  assert.equal(koreanStem("인덱스도"), "인덱스");
  assert.equal(koreanStem("스킬들을"), "스킬");
  // Longest-ending-first: 에서는 must not lose its 는 first.
  assert.equal(koreanStem("세션에서는"), "세션");
  // Conjugated 하-verbalizer tails reduce to the noun stem.
  assert.equal(koreanStem("결정했지"), "결정");
  assert.equal(koreanStem("배포하고"), "배포");
  assert.equal(koreanStem("검색해야"), "검색");
  // Guard 1 — a stem under two syllables is refused (011 3.6 table).
  assert.equal(koreanStem("검사"), null, "검사 must not become 검");
  assert.equal(koreanStem("고의"), null);
  assert.equal(koreanStem("하고"), null);
  // The 하/해 tail rule inherits the same guard: ordinary nouns survive.
  assert.equal(koreanStem("이해"), null);
  assert.equal(koreanStem("오해"), null);
  // Guard 2 — no ending present, or non-Hangul input, means no trimming.
  assert.equal(koreanStem("릴리스"), null, "스 is not an ending");
  assert.equal(koreanStem("도구"), null, "prefix-shaped syllables are not suffixes");
  assert.equal(koreanStem("deploy"), null);
  assert.equal(koreanStem("hook.ts"), null);
  assert.equal(koreanStem("배포2"), null, "mixed tokens are out of scope");
});

test("koreanStem: 인지 trims (wp5), 한 deliberately does not", () => {
  assert.equal(koreanStem("소스인지"), "소스");
  assert.equal(koreanStem("무엇인지"), "무엇");
  // The ending alone leaves no stem, so the two-syllable guard still rejects it.
  assert.equal(koreanStem("인지"), null);
  // 한 is not in the ending list on purpose: it would trim 검증한 → 검증 but
  // also every noun that merely ends in 한.
  assert.equal(koreanStem("검증한"), null);
});

test("wp5 seeds: the evaluation sentences' nouns reach their english family", () => {
  const texts = (w: string) => groupTexts(expandQueryWords([w])[0]);
  assert.ok(texts("도그푸딩").includes("dogfooding"));
  assert.ok(texts("코덱스를").includes("codex"), "코덱스를 → 코덱스 → codex");
  assert.ok(texts("재시작하면").includes("restart"), "하-verbalizer tail, then the seed");
  assert.ok(texts("소스인지").includes("source"), "소스인지 → 소스 → source");
  assert.ok(texts("검증").includes("verify"));
  assert.ok(texts("검증").includes("provenance"));
  assert.deepEqual(texts("검증한"), ["검증한"], "no 한 trimming means no seed lookup either");
});

test("memory search: 기억 recalls an english-only memory (c-5 durable-memory leg)", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-ko-recall-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Notes\n\nThe memory store keeps every decision.\n");
    assert.ok(searchMemory("기억", { home }).hits.length >= 1, "기억 → memory");
    assert.equal(searchMemory("기억", { home, synonyms: false }).hits.length, 0, "opt-out drops the bridge");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("expandQueryWords: guard 3 keeps the original word leading, stem is additive", () => {
  const [group] = expandQueryWords(["배포를"]);
  const texts = groupTexts(group);
  assert.equal(texts[0], "배포를", "the typed word stays the excerpt anchor");
  assert.ok(texts.includes("배포"), "stem is added, never substituted");
  // Chained lookup: the stem is re-queried against the synonym table, which is
  // what makes an inflected Korean word reach its english family.
  assert.ok(texts.includes("deploy"), "배포를 → 배포 → deploy");
  assert.ok(texts.includes("deployment"));
});

test("memory search: korean inflected query reaches the uninflected document (R2)", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-ko-infl-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# 운영 노트\n\n첫 배포 이후 인덱스 재생성이 필요했다.\n");
    // Substring matching already covered 배포 → 배포까지; this is the failing
    // direction, where the user types the inflected form (011 3.3).
    for (const q of ["배포까지", "배포를", "배포했다", "인덱스도"]) {
      assert.ok(searchMemory(q, { home }).hits.length >= 1, `${q} must reach the memory`);
    }
    // Opting out of expansion returns to raw-word matching: 배포까지 is absent.
    assert.equal(searchMemory("배포까지", { home, synonyms: false }).hits.length, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: trimming does not fabricate hits for a one-syllable stem", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-ko-guard-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    // Nothing here contains 검사; only the would-be stem 검 appears. If trimming
    // ran, 검사 would match this file, which is exactly the recall explosion the
    // two-syllable rule prevents (011 3.6).
    writeFileSync(join(mem, "MEMORY.md"), "# 도구\n\n검 하나만 적힌 문장이다.\n");
    assert.equal(searchMemory("검사", { home }).hits.length, 0);
    // Same guard on the 하/해 tail: 이해 must not become 이.
    writeFileSync(join(mem, "short.md"), "# 이\n\n이 글자만 적혀 있다.\n");
    assert.equal(searchMemory("이해", { home }).hits.length, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: korean query recalls english-only memory via synonyms, opt-out disables it", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-syn-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Decision log\n\nThe rollout decision was reverted on tuesday.\n");
    const withSyn = searchMemory("결정", { home });
    // Heading and body paragraphs both carry "decision" (two chunks, one file).
    assert.equal(withSyn.hits.length, 2, "결정 must reach the decision paragraphs");
    assert.equal(withSyn.hits[0].relpath, "MEMORY.md");
    const withoutSyn = searchMemory("결정", { home, synonyms: false });
    assert.equal(withoutSyn.hits.length, 0, "opt-out returns to raw word matching");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: AND across groups still requires every group", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-syn-and-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Notes\n\nA decision about deployment pipelines.\n");
    // One group hits (결정→decision), the other (세션→session) does not: AND fails.
    assert.equal(searchMemory("결정 세션", { home }).hits.length, 0);
    // anyMode: one hit is enough.
    assert.equal(searchMemory("결정 세션", { home, any: true }).hits.length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("documented collapse: two query words from the same group match one occurrence", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-syn-collapse-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Loop\n\nWe ran the audit twice before shipping.\n");
    // "plan" and "audit" both expand into the pabcd family, so a chunk with
    // only "audit" satisfies both groups (cli-jaw parity, documented).
    const r = searchMemory("plan audit", { home });
    assert.equal(r.hits.length, 1);
    // Opting out restores strict AND on the raw words: "plan" is absent.
    assert.equal(searchMemory("plan audit", { home, synonyms: false }).hits.length, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("stage1 sql path handles expanded groups with bound parameters (no crash, korean query)", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-syn-stage1-"));
  try {
    mkdirSync(join(home, "memories"), { recursive: true });
    // No memories db on purpose: fail-soft warning, zero hits, no SQL error path.
    const r = searchMemory("메모리 검색", { home });
    assert.equal(r.hits.length, 0);
    assert.ok(r.warnings.some((w) => w.includes("memories db")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
