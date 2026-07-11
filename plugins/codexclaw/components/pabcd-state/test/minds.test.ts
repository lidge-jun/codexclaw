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

test("MIND-SPAWN-SHAPE-01: dispatch directive carries the spawn shape + effort routing contract", () => {
  // Non-full-history fork is what keeps model/effort overrides + role-config injection legal.
  assert.match(MIND_DISPATCH_DIRECTIVE, /fork_turns:"none"/);
  assert.match(MIND_DISPATCH_DIRECTIVE, /agent_type/);
  assert.match(MIND_DISPATCH_DIRECTIVE, /task_name mind_/);
  assert.match(MIND_DISPATCH_DIRECTIVE, /full-history fork rejects model\/effort overrides/i);
  // Effort routing rides the explorer role config; explicit pinning is the offered path.
  assert.match(MIND_DISPATCH_DIRECTIVE, /explorer role config/i);
  assert.match(MIND_DISPATCH_DIRECTIVE, /cxc subagents set explorer --effort/);
  // Minds are stateless — the dispatcher packs the interview snapshot.
  assert.match(MIND_DISPATCH_DIRECTIVE, /interview snapshot/i);
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

test("L9.2: every accepted contradiction carries its Mind + exact correlationId <roundId>-<mindId>", () => {
  const raw = [{ dimension: "success", contradiction: "untestable AC", severity: "medium", evidence: "spec.md:3" }];
  for (const m of MINDS) {
    const out = normalizeMindOutput(m, raw, 4);
    assert.equal(out[0].mind, m);
    assert.equal(out[0].correlationId, `4-${m}`); // frozen pin format
  }
  // default round 0 when omitted
  assert.equal(normalizeMindOutput("contrarian", raw)[0].correlationId, "0-contrarian");
});

test("L9.2: extra side-effect keys are stripped (only the contract fields + correlation survive)", () => {
  const raw = [{
    dimension: "goal", contradiction: "smuggle", severity: "high", evidence: "plan.md:9",
    action: "edit file", question: "ask the user?", writeState: true, plan: "rewrite",
  }];
  const out = normalizeMindOutput("contrarian", raw, 1);
  assert.equal(out.length, 1);
  assert.deepEqual(Object.keys(out[0]).sort(), ["contradiction", "correlationId", "dimension", "evidence", "mind", "severity"]);
});

test("L9.2: ungrounded evidence (bare guess) is rejected; file:line/section/quote accepted", () => {
  const guess = [{ dimension: "goal", contradiction: "x", severity: "low", evidence: "I think this is wrong" }];
  assert.equal(normalizeMindOutput("contrarian", guess).length, 0);
  const grounded = [
    { dimension: "goal", contradiction: "a", severity: "low", evidence: "src/x.ts:42" },
    { dimension: "goal", contradiction: "b", severity: "low", evidence: "see section Goals" },
    { dimension: "goal", contradiction: "c", severity: "low", evidence: "the spec says \"must be max\"" },
  ];
  assert.equal(normalizeMindOutput("contrarian", grounded).length, 3);
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
