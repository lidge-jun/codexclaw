/**
 * synonyms.test.ts — WP2 curated ko/en synonym expansion for memory search:
 * cross-language recall, opt-out, AND-across-groups preservation, and the
 * documented same-group multiword collapse (A-gate reviewer warning #2).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandQueryWords, SYNONYM_GROUPS } from "../src/synonyms.ts";
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
  assert.equal(groups[0][0], "결정");
  assert.ok(groups[0].includes("decision"), "korean term expands to its english family");
  assert.deepEqual(groups[1], ["quagga"]);
  for (const g of expandQueryWords(SYNONYM_GROUPS.map((g) => g[0]))) {
    assert.ok(g.length <= 8, "group cap holds");
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
