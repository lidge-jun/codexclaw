/**
 * query-words.test.ts — R1 token-boundary matching: which query shapes are
 * judged symbol-like, what the custom boundary excludes, and the end-to-end
 * mismatch cases measured on the memories corpus (011 2.2). The regression that
 * matters most is `LSP` inside `NaiControlsPanel` and `3956` inside a thread id.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isSymbolWord,
  splitQueryWords,
  splitQueryWordsRaw,
  termIncludes,
  termIndexOf,
  countTermOccurrences,
  hasBoundaryTerm,
  relaxQueryGroups,
  groupTexts,
  MAX_WORDS,
} from "../src/query-words.ts";
import { expandQueryWords } from "../src/synonyms.ts";
import { searchMemory, scoreChunk } from "../src/memory-search.ts";

const bounded = (text: string) => ({ text, boundary: true });
const loose = (text: string) => ({ text, boundary: false });

test("splitQueryWords: raw keeps case, lowercase variant matches the historical tokenizer", () => {
  assert.deepEqual(splitQueryWordsRaw("  CI  PR3956 "), ["CI", "PR3956"]);
  assert.deepEqual(splitQueryWords("  CI  PR3956 "), ["ci", "pr3956"]);
  assert.equal(splitQueryWordsRaw("a b c d e f g h i j").length, MAX_WORDS);
});

test("isSymbolWord: covers every shape in the roadmap table and excludes prose", () => {
  // Uppercase acronyms — judged before lowercasing, which is the whole reason
  // the raw word has to survive tokenization.
  for (const w of ["CI", "PR", "FTS", "RRF", "LSP"]) {
    assert.ok(isSymbolWord(w), `${w} is an acronym`);
  }
  // Short ASCII words, numeric ids, SHAs, filenames, paths.
  for (const w of ["go", "id", "ci", "3956", "#3956", "6e97e73d", "hook.ts", "src/hook.ts", "a\\b"]) {
    assert.ok(isSymbolWord(w), `${w} is symbol-shaped`);
  }
  // Ordinary prose and Korean fall through to substring matching, which is what
  // keeps 검색 reaching 검색해봐.
  for (const w of ["deploy", "release", "Codex", "검색", "배포까지", "트라이그램"]) {
    assert.ok(!isSymbolWord(w), `${w} must stay substring-matched`);
  }
});

test("termIndexOf: the custom boundary treats dots and slashes as separators", () => {
  // Dots must be boundaries or a filename could never be boundary-matched...
  assert.ok(termIncludes("see hook.ts for details", bounded("hook.ts")));
  assert.ok(termIncludes("edit src/hook.ts now", bounded("src/hook.ts")));
  // ...while still excluding a longer neighbouring filename.
  assert.ok(!termIncludes("edit my-hook.tsx now", bounded("hook.ts")));
  // Start and end of text count as boundaries.
  assert.ok(termIncludes("ci", bounded("ci")));
  assert.ok(termIncludes("run ci", bounded("ci")));
  // Hangul is outside the token class, so a Korean particle does not block an
  // ASCII acronym: CI를 still matches CI.
  assert.ok(termIncludes("ci를 돌렸다", bounded("ci")));
  // Underscores and digits are token characters.
  assert.ok(!termIncludes("ci_runner", bounded("ci")));
  assert.ok(!termIncludes("ci2", bounded("ci")));
  assert.equal(termIndexOf("nothing here", bounded("ci")), -1);
  assert.equal(termIndexOf("", bounded("ci")), -1);
  assert.equal(termIndexOf("abc", loose("")), -1, "empty term never matches");
});

test("termIndexOf: boundary scanning does not stop at the first embedded hit", () => {
  // A naive implementation returns -1 here because the first `ci` is inside a
  // word; the scan has to keep going to find the standalone one.
  assert.equal(termIndexOf("precision then ci", bounded("ci")), 15);
  assert.equal(countTermOccurrences("precision ci ci_x ci", bounded("ci"), 5), 2);
  assert.equal(countTermOccurrences("cici cici", loose("ci"), 5), 4, "substring counts every occurrence");
  assert.equal(countTermOccurrences("ci ci ci ci ci ci", bounded("ci"), 3), 3, "cap holds");
});

test("relaxQueryGroups: drops boundary gating and is detectable beforehand", () => {
  const groups = expandQueryWords(["LSP"]);
  assert.ok(hasBoundaryTerm(groups));
  const relaxed = relaxQueryGroups(groups);
  assert.ok(!hasBoundaryTerm(relaxed));
  assert.deepEqual(groupTexts(relaxed[0]), groupTexts(groups[0]), "only the flag changes");
  assert.ok(!hasBoundaryTerm(expandQueryWords(["배포"])), "korean is never boundary-gated");
});

test("scoreChunk: boundary terms score nothing on embedded-only text", () => {
  const embedded = "NaiControlsPanel and NaiControlsPanel again";
  assert.equal(scoreChunk(embedded.toLowerCase(), expandQueryWords(["LSP"]), "lsp"), 0);
  const standalone = "the LSP server restarted";
  assert.ok(scoreChunk(standalone.toLowerCase(), expandQueryWords(["LSP"]), "lsp") > 0);
});

test("memory search: symbol queries stop matching inside longer words (R1)", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-r1-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    // The exact measured mismatches: LSP inside NaiControlsPanel, PR #3956
    // inside a thread id, fts inside conflicts.
    writeFileSync(
      join(mem, "MEMORY.md"),
      "# Notes\n\nTouched NaiControlsPanel and negativePrompt.\n\nThread 01a03956-6245-73d1 was archived.\n\nResolved merge conflicts in drafts.\n",
    );
    // A real occurrence of each symbol lives in a second file, so the strict
    // pass is non-empty and the relaxed retry stays out of the way. This is the
    // corpus-realistic shape: on the operator's memories store `LSP` does have
    // genuine standalone occurrences.
    writeFileSync(
      join(mem, "real.md"),
      "# Real\n\nThe LSP server crashed.\n\nMerged PR #3956 today.\n\nRebuilt the fts index.\n",
    );
    for (const [q, expected] of [["LSP", "real.md"], ["3956", "real.md"], ["fts", "real.md"]] as const) {
      const r = searchMemory(q, { home });
      assert.ok(r.hits.length >= 1, `${q} must still find its real occurrence`);
      // The mismatching file is present and scanned, and is still excluded.
      assert.ok(r.hits.every((h) => h.relpath === expected), `${q} must only hit ${expected}`);
      assert.ok(r.scannedFiles >= 2, "the mismatching file was scanned, not skipped");
      assert.ok(!r.warnings.some((w) => w.includes("lower confidence")), "strict pass succeeded");
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: an embedded-only symbol falls back rather than answering nothing", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-r1-embedded-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Notes\n\nTouched NaiControlsPanel today.\n");
    // Boundary matching removes this hit from the strict pass. With nothing else
    // in the corpus the relaxed retry returns it, penalized and labelled — the
    // deliberate tradeoff against answering an empty result.
    const r = searchMemory("LSP", { home });
    assert.equal(r.hits.length, 1);
    assert.ok(r.warnings.some((w) => w.includes("lower confidence")));
    // The penalty is relative, not absolute: kind priority keeps a handbook hit
    // positive. Compare against the same text reached without the fallback.
    const strict = searchMemory("naicontrolspanel", { home });
    assert.equal(strict.hits.length, 1);
    assert.ok(!strict.warnings.some((w) => w.includes("lower confidence")));
    assert.ok(
      r.hits[0].score < strict.hits[0].score,
      `relaxed hit must rank below a strict hit on the same chunk (${r.hits[0].score} vs ${strict.hits[0].score})`,
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: zero boundary matches fall back to substring with a warning", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-r1-relax-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    // "PR3956" has no boundary in front of the digits, so a strict-only gate
    // would answer nothing at all for a query of 3956.
    writeFileSync(join(mem, "MEMORY.md"), "# Log\n\nShipped PR3956 to production.\n");
    const r = searchMemory("3956", { home });
    assert.equal(r.hits.length, 1, "relaxed retry recovers the hit");
    assert.ok(
      r.warnings.some((w) => w.includes("lower confidence")),
      "the fallback labels itself",
    );
    // A query with real boundary hits never triggers the retry, so no warning.
    writeFileSync(join(mem, "clean.md"), "# Clean\n\nShipped PR #3956 today.\n");
    const strict = searchMemory("3956", { home });
    assert.ok(strict.hits.every((h) => h.relpath === "clean.md"));
    assert.ok(!strict.warnings.some((w) => w.includes("lower confidence")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: non-symbol queries keep substring matching untouched", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-r1-prose-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Prose\n\nredeployment pipeline notes\n\n검색해봐 라고 적었다\n");
    // "deploy" inside "redeployment" is a substring hit that R1 deliberately
    // preserves: the word is not symbol-shaped.
    assert.ok(searchMemory("deploy", { home }).hits.length >= 1);
    // And the Korean case the boundary rule exists to protect.
    assert.ok(searchMemory("검색", { home }).hits.length >= 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: --no-synonyms drops expansion but keeps boundary gating", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-r1-nosyn-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Notes\n\nTouched NaiControlsPanel.\n\nThe LSP server is fine.\n");
    // Boundary gating is R1 and independent of R2's expansion, so opting out of
    // synonyms must not silently reinstate the NaiControlsPanel mismatch.
    const r = searchMemory("LSP", { home, synonyms: false });
    assert.equal(r.hits.length, 1);
    assert.ok(r.hits[0].excerpt.includes("LSP server"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
