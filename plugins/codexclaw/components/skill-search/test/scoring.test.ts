import { test } from "node:test";
import assert from "node:assert/strict";
import { rank, scoreRow, tokenize } from "../src/scoring.ts";
import type { SkillRow } from "../src/types.ts";

const row = (over: Partial<SkillRow>): SkillRow => ({
  id: "x",
  source: "jaw",
  name: "x",
  description: "",
  rawUrl: "https://example.com/SKILL.md",
  ...over,
});

test("tokenize splits on whitespace/commas and lowercases", () => {
  assert.deepEqual(tokenize("PDF  vision,ocr"), ["pdf", "vision", "ocr"]);
  assert.deepEqual(tokenize("   "), []);
});

test("exact id match outranks description match", () => {
  const rows = [
    row({ id: "telegram-send", description: "send messages" }),
    row({ id: "notify", description: "telegram-send helper wrapper" }),
  ];
  const ranked = rank(rows, "telegram-send", 10);
  assert.equal(ranked[0].id, "telegram-send");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("korean description matches score via descriptionKo", () => {
  const r = row({ id: "one-password", descriptionKo: "1Password CLI로 비밀번호 조회" });
  assert.ok(scoreRow(r, tokenize("비밀번호")) > 0);
});

test("superseded_by and claude-specific rows are demoted x0.5, not hidden", () => {
  const plain = row({ id: "tdd-guide", description: "tdd loop" });
  const sup = row({ id: "tdd", description: "tdd loop", supersededBy: "dev-testing" });
  const claude = row({ id: "tdd-claude", description: "tdd loop", status: "claude-specific" });
  const terms = tokenize("tdd loop");
  assert.ok(scoreRow(sup, terms) < scoreRow(plain, terms));
  assert.ok(scoreRow(claude, terms) < scoreRow(plain, terms));
  assert.ok(scoreRow(sup, terms) > 0);
});

test("rank filters zero scores, sorts desc, respects limit", () => {
  const rows = [
    row({ id: "a", description: "alpha search" }),
    row({ id: "b", description: "unrelated" }),
    row({ id: "search", description: "the search skill" }),
  ];
  const ranked = rank(rows, "search", 1);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "search");
});
