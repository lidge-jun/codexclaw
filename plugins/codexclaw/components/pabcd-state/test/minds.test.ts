import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINDS,
  MIND_ROLE_PROMPTS,
  MIND_DISPATCH_DIRECTIVE,
  MIND_CONCURRENCY_CAP,
  normalizeMindOutput,
  selectMinds,
} from "../src/minds.ts";
import { defaultInterview, DIMENSIONS } from "../src/interview.ts";

test("L9.1: all five Mind ids exist with fixed prompts", () => {
  assert.deepEqual([...MINDS], ["contrarian", "socratic", "ontologist", "evaluator", "simplifier"]);
  for (const m of MINDS) {
    assert.ok(MIND_ROLE_PROMPTS[m].length > 0, `${m} prompt missing`);
    assert.match(MIND_ROLE_PROMPTS[m], /JSON array of contradictions/i, `${m} missing output contract`);
    assert.match(MIND_ROLE_PROMPTS[m], /Do NOT ask questions, edit files/i, `${m} missing prohibition`);
  }
});

test("L9.3: dispatch directive states main owns loop + hook is injector-only + .codexclaw surface", () => {
  assert.match(MIND_DISPATCH_DIRECTIVE, /OWN this interview loop/i);
  assert.match(MIND_DISPATCH_DIRECTIVE, /hook only injects directives/i);
  assert.match(MIND_DISPATCH_DIRECTIVE, /\.codexclaw\//);
  assert.match(MIND_DISPATCH_DIRECTIVE, /if you are yourself a subagent/i); // T7
});

test("L9.2: normalizeMindOutput rejects missing dimension/invalid severity/missing evidence", () => {
  const raw = [
    { dimension: "goal", contradiction: "vague metric", severity: "high", evidence: "plan.md:12" }, // valid
    { dimension: "nope", contradiction: "x", severity: "high", evidence: "y" }, // bad dimension
    { dimension: "goal", contradiction: "x", severity: "critical", evidence: "y" }, // bad severity
    { dimension: "goal", contradiction: "", severity: "low", evidence: "y" }, // empty contradiction
    { dimension: "goal", contradiction: "x", severity: "low", evidence: "  " }, // empty evidence (guess)
    "not an object",
  ];
  const out = normalizeMindOutput("contrarian", raw);
  assert.equal(out.length, 1);
  assert.equal(out[0].dimension, "goal");
  assert.equal(out[0].mind, "contrarian"); // correlation key attached
});

test("L9.2: malformed top-level output -> [] (never marks ready)", () => {
  assert.deepEqual(normalizeMindOutput("socratic", null), []);
  assert.deepEqual(normalizeMindOutput("socratic", { not: "array" }), []);
  assert.deepEqual(normalizeMindOutput("socratic", "[]"), []); // string, not parsed array
});

test("L9.2: every accepted contradiction carries its Mind correlation key", () => {
  const raw = [{ dimension: "success", contradiction: "untestable AC", severity: "medium", evidence: "spec:3" }];
  for (const m of MINDS) {
    assert.equal(normalizeMindOutput(m, raw)[0].mind, m);
  }
});

test("L9: selectMinds picks lowest-scoring dimensions, clamped to cap", () => {
  const t = defaultInterview(1);
  // make most dims max, leave ontology low -> ontologist should be selected first
  for (const d of DIMENSIONS) t.dimensions[d].level = "max";
  t.dimensions.ontology.level = "low";
  const picked = selectMinds(t, 1);
  assert.deepEqual(picked, ["ontologist"]);
  // cap enforcement
  assert.equal(selectMinds(t, 99).length, MIND_CONCURRENCY_CAP);
  assert.equal(selectMinds(null, 2).length, 2);
});
