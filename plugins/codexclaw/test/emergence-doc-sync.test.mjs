/**
 * emergence-doc-sync.test.mjs — WP 070 E8 drift gate.
 *
 * Keeps the emergence harness doctrine, visual HTML, and live skills aligned on
 * the collapse-point model. This is intentionally a text contract: the runtime
 * lever is covered by hook/metric tests; this gate catches doctrine drift.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(path) {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

test("emergence 070: docs, HTML, and skills preserve the collapse-point doctrine", () => {
  const loopSkill = read("plugins/codexclaw/skills/loop/SKILL.md");
  const devSkill = read("plugins/codexclaw/skills/dev/SKILL.md");
  const searchSkill = read("plugins/codexclaw/skills/search/SKILL.md");
  const plan070 = read("devlog/_fin/260701_emergence_harness_impl/070_docs_sync_falsifiability.md");
  const html = read("devlog/_plan/260701_emergence_harness/emergence_gap.html");

  assert.match(plan070, /I records N>=2 approaches/);
  assert.match(plan070, /NOT automatically a user question/);
  assert.match(plan070, /satisfy-spec\/build work records N>=2 cheaply and collapses at P/);
  assert.match(plan070, /maximize-metric\/unclear work keeps N plans through A\/B\/C/);
  assert.match(plan070, /HITL PABCD may enter it deliberately during I\/P/);
  assert.match(plan070, /only the goal-mode plateau Stop block is the shipped E2 lever/);

  assert.match(loopSkill, /HITL PABCD/);
  assert.match(loopSkill, /plateau-triggered mode[\s\S]+automatic entry/);
  assert.match(loopSkill, /strong-1[\s\S]+add-1/);
  assert.match(loopSkill, /Collapse\s+early at P[\s\S]+Collapse\s+late at D/);
  assert.match(loopSkill, /HITL divergence entry is valid/);
  assert.match(devSkill, /user-facing question\s+does not/);

  assert.match(searchSkill, /Divergence Candidate Grounding/);
  assert.match(searchSkill, /HITL manual entry or goal-mode/);
  assert.match(searchSkill, /strong-1[\s\S]+Tier 2/);
  assert.match(searchSkill, /add-1[\s\S]+Tier 1/);

  assert.match(html, /HITL I\/P의 수동 선택/);
  assert.match(html, /goal-mode의 plateau 자동 경보/);
  assert.match(html, /기록 N≥2, 실행 N=1/);
  assert.match(html, /N≥2 기록 후 P에서 1개 선택/);
  assert.match(html, /OLD-vs-NEW/);
  assert.match(html, /median \+ worst-10% \+ variance/);
  assert.doesNotMatch(html, /충족형 → 단일 전략 \(N=1\)/);
});

test("emergence 070: HTML keeps the expected section and tag balance", () => {
  const html = read("devlog/_plan/260701_emergence_harness/emergence_gap.html");
  for (const section of ["07", "08", "09", "10"]) {
    assert.match(html, new RegExp(`<span class="n">${section}</span>`), `missing section ${section}`);
  }

  const tags = ["div", "table", "thead", "tbody", "tr", "td", "ul", "li", "h2"];
  for (const tag of tags) {
    const open = (html.match(new RegExp(`<${tag}(?:\\s|>)`, "g")) ?? []).length;
    const close = (html.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
    assert.equal(open, close, `${tag} tag count drift: ${open} open vs ${close} close`);
  }
});
