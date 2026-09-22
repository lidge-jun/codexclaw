// report-research-handoff.test.mjs — issue #199.
//
// The handoff exists so the publication step inherits what was asked, how far the answer
// was allowed to reach, and what is still unresolved. The cases that matter are the ones
// where a document could otherwise look finished while hiding one of those.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateClaims,
  validateResearchHandoff,
  generationReceipt,
  researchReceipt,
  RESEARCH_ROUTES,
} from "../skills/dev-visualizer/scripts/report-contract.mjs";

const source = (over = {}) => ({ id: "s1", locator: "https://example.test/a", observedAt: "2026-09-19", ...over });
const claim = (over = {}) => ({ id: "c1", text: "a claim", kind: "observation", sourceRefs: ["s1"], limitations: [], ...over });
const model = (over = {}) => ({
  schemaVersion: 1,
  audience: "reader",
  question: "what is true?",
  answerClaimId: "c1",
  claims: [claim()],
  sources: [source()],
  ...over,
});
const research = (over = {}) => ({
  contractVersion: 1,
  route: "source-only",
  sourceBoundary: "the three files supplied by the requester",
  languages: { source: "ko", output: "en" },
  questions: [{ id: "q1", text: "what is true?", answeredBy: ["c1"] }],
  gaps: [],
  ...over,
});
const here = dirname(fileURLToPath(import.meta.url));

test("#199: a document with no research section stays valid and is never called research-complete", () => {
  const m = model();
  assert.deepEqual(validateClaims(m), []);
  assert.deepEqual(validateResearchHandoff(m), [], "absence is not an error");
  const receipt = researchReceipt(m);
  assert.equal(receipt.supplied, false);
  assert.equal(receipt.route, null, "silence must read as unknown, not as a clean route");
});

test("#199: a well-formed handoff validates and produces a receipt naming route and versions", () => {
  const m = model({ research: research() });
  assert.deepEqual(validateResearchHandoff(m), []);
  const receipt = researchReceipt(m, { skillVersion: "0.2.30", checks: { claimEvidence: true, editorialReview: false } });
  assert.equal(receipt.route, "source-only");
  assert.equal(receipt.contractVersion, 1);
  assert.equal(receipt.skillVersion, "0.2.30");
  assert.deepEqual(receipt.completed, ["claimEvidence"]);
  assert.deepEqual(receipt.omitted, ["editorialReview"], "an omitted check must never render as a pass");
});

test("#199: an unreadable contract version is refused rather than treated as an upgrade", () => {
  const issues = validateResearchHandoff(model({ research: research({ contractVersion: 2 }) }));
  assert.ok(issues.some((i) => /contractVersion/.test(i.msg)), JSON.stringify(issues));
});

test("#199: the route must be one of the three, and they are the three the issue names", () => {
  assert.deepEqual([...RESEARCH_ROUTES].sort(), ["bounded-lookup", "deep-research", "source-only"]);
  const issues = validateResearchHandoff(model({ research: research({ route: "whatever-i-felt-like" }) }));
  assert.ok(issues.some((i) => /route must be one of/.test(i.msg)));
});

test("#199: source-only may not carry a discovered source", () => {
  const m = model({
    sources: [source(), source({ id: "s2", discovered: true })],
    research: research(),
  });
  assert.ok(validateResearchHandoff(m).some((i) => /discovered source/.test(i.msg)));

  // The same document is fine once it admits it went looking.
  m.research.route = "bounded-lookup";
  assert.deepEqual(validateResearchHandoff(m), []);
});

test("#199: snippets are leads — a load-bearing claim cannot rest only on them", () => {
  const snippetOnly = model({
    sources: [source({ via: "snippet" })],
    claims: [claim({ kind: "inference" })],
    research: research(),
  });
  assert.ok(
    validateResearchHandoff(snippetOnly).some((i) => /snippets are leads/.test(i.msg)),
    "an inference resting only on a search excerpt has not been checked",
  );

  // One read source alongside the snippet is enough; the rule is about sole support.
  const mixed = model({
    sources: [source({ via: "snippet" }), source({ id: "s2" })],
    claims: [claim({ kind: "inference", sourceRefs: ["s1", "s2"] })],
    research: research(),
  });
  assert.deepEqual(validateResearchHandoff(mixed), []);

  // An observation is not load-bearing in this sense: it reports what the snippet said.
  const observation = model({ sources: [source({ via: "snippet" })], research: research() });
  assert.deepEqual(validateResearchHandoff(observation), []);
});

test("#199: an unanswered question must surface as a gap rather than vanish", () => {
  const hidden = model({ research: research({ questions: [{ id: "q9", text: "unresolved", answeredBy: [] }] }) });
  assert.ok(validateResearchHandoff(hidden).some((i) => /must be listed in research.gaps/.test(i.msg)));

  const declared = model({
    research: research({ questions: [{ id: "q9", text: "unresolved", answeredBy: [] }], gaps: ["q9 was not answered"] }),
  });
  assert.deepEqual(validateResearchHandoff(declared), []);
  for (const [id, gap, accepted] of [
    ["q1", "q10 is unresolved", false],
    ["q1", "q1.1 is unresolved", false],
    ["q1.1", "q1.10 is unresolved", false],
    ["q1.1", "q1x1 is unresolved", false],
    ["q[1]+?", "q[1]+?extra is unresolved", false],
    ["q[1]+?", "q111 is unresolved", false],
    ["q1", "Notes about q1 remain unresolved", false],
    ["q1", "q1:unresolved", false],
    ["q1", "q1", true],
    ["q1", "  q1 was not answered", true],
    ["q1", "q1: unresolved", true],
    ["q1", "q1:", true],
    ["q1.1", "q1.1 is unresolved", true],
    ["q[1]+?", "q[1]+?: unresolved", true],
    ["q[1]+?", "q[1]+?", true],
  ]) {
    const input = model({ research: research({
      questions: [{ id, text: "unresolved", answeredBy: [] }], gaps: [gap],
    }) });
    const issues = validateResearchHandoff(input);
    assert.equal(issues.length, accepted ? 0 : 1, JSON.stringify({ id, gap, issues }));
    if (!accepted) assert.equal(issues[0].id, id);
  }
});

test("#199: a question cannot point at a claim that does not exist", () => {
  const m = model({ research: research({ questions: [{ id: "q1", text: "?", answeredBy: ["nope"] }] }) });
  assert.ok(validateResearchHandoff(m).some((i) => /unknown claim/.test(i.msg)));
});

test("#199: source and output language are recorded separately", () => {
  const m = model({ research: research({ languages: { source: "ko" } }) });
  assert.ok(validateResearchHandoff(m).some((i) => /languages/.test(i.msg)));
});

test("#199: the source boundary and the gap list are both required", () => {
  assert.ok(validateResearchHandoff(model({ research: research({ sourceBoundary: "" }) })).some((i) => /sourceBoundary/.test(i.msg)));
  assert.ok(validateResearchHandoff(model({ research: research({ gaps: "none" }) })).some((i) => /gaps/.test(i.msg)));
});

test("canonical languages, source spans, and counter-evidence retain their reference integrity", () => {
  const m = model({
    sources: [source({ spans: [{ id: "p1", locator: "#page=2", language: "ko", excerpt: "반대 결과" }] })],
    claims: [claim({ sourceSpans: [{ sourceId: "s1", spanId: "p1" }] })],
    research: research({
      languages: undefined,
      sourceLanguages: ["ko"],
      outputLanguage: "en",
      counterEvidence: [{ claimId: "c1", sourceRefs: ["s1"], note: "The source also reports a contrary result." }],
    }),
  });
  assert.deepEqual(validateClaims(m), []);
  assert.deepEqual(validateResearchHandoff(m), []);
  assert.equal(researchReceipt(m).legacyInput, false);
});

test("malformed spans and dangling counter-evidence return issues instead of throwing", () => {
  const m = model({
    sources: [source({ spans: [{ id: "p1", locator: "", language: "ko" }] })],
    claims: [claim({ sourceSpans: [{ sourceId: "s1", spanId: "missing" }] })],
    research: research({
      counterEvidence: [{ claimId: "missing", sourceRefs: ["absent"], note: "Contrary evidence." }],
    }),
  });
  assert.doesNotThrow(() => validateClaims(m));
  assert.ok(validateClaims(m).some((i) => /span/i.test(i.msg)), JSON.stringify(validateClaims(m)));
  assert.ok(validateResearchHandoff(m).some((i) => /counterEvidence|unknown/i.test(i.msg)));
});

test("legacy languages remain accepted and conflicting dual language representations are rejected", () => {
  const legacy = model({ research: research() });
  assert.deepEqual(validateResearchHandoff(legacy), []);
  assert.equal(researchReceipt(legacy).legacyInput, true);

  const conflict = model({
    research: research({ sourceLanguages: ["ja"], outputLanguage: "ko" }),
  });
  assert.ok(validateResearchHandoff(conflict).some((i) => /conflict/i.test(i.msg)));
});

test("generation receipt preserves distinct explicit provenance and labels caller checks as assertions", () => {
  const m = model({ research: research() });
  const receipt = generationReceipt(m, {
    skillVersion: "visualizer-3",
    packageVersion: "package-9",
    sourceSha: "a".repeat(40),
    hostAdapter: "aside",
    genre: "research-synthesis",
    templateIds: ["paged-report"],
    recipeIds: ["evidence-table"],
    checks: [{ id: "claim-evidence", status: "PASS", reason: "reviewed by caller" }],
  });
  assert.equal(receipt.skillVersion, "visualizer-3");
  assert.equal(receipt.packageVersion, "package-9");
  assert.equal(receipt.sourceSha, "a".repeat(40));
  assert.equal(receipt.checks[0].basis, "caller-assertion");
  assert.equal(receipt.authenticatedProof, false);
  assert.deepEqual(receipt.validationIssues, []);
});

test("generation receipt leaves provenance unknown and reports malformed metadata explicitly", () => {
  const defaults = generationReceipt(model());
  assert.equal(defaults.skillVersion, "unknown");
  assert.equal(defaults.packageVersion, "unknown");
  assert.equal(defaults.sourceSha, "unknown");

  const malformed = generationReceipt(model(), {
    sourceSha: "../checkout/HEAD",
    hostAdapter: "/Users/example/account",
    templateIds: ["ok", 7],
    checks: [{ id: "claim-evidence", status: "MAGIC" }],
  });
  assert.ok(malformed.validationIssues.length >= 4, JSON.stringify(malformed));
  assert.equal(malformed.sourceSha, "unknown", "invalid provenance must not be copied into a receipt");
});

for (const [field, mutate, validate, expectedId] of [
  ["claim.sourceRefs", (m) => { m.claims[0].sourceRefs.push("s1"); }, validateClaims, "c1"],
  ["question.answeredBy", (m) => { m.research.questions[0].answeredBy.push("c1"); }, validateResearchHandoff, "q1"],
  ["counterEvidence.sourceRefs", (m) => { m.research.counterEvidence[0].sourceRefs.push("s1"); }, validateResearchHandoff, "c1"],
]) {
  test(`reject repeated valid IDs in ${field} without changing the input`, () => {
    const m = model({ research: research({
      counterEvidence: [{ claimId: "c1", sourceRefs: ["s1"], note: "Contrary finding." }],
    }) });
    assert.deepEqual(validate(m), []);
    mutate(m);
    const before = structuredClone(m);
    assert.deepEqual(validate(m), [{ level: "P0", id: expectedId, msg: `${field} must contain unique IDs` }]);
    assert.deepEqual(m, before);
  });
}

test("the shipped research handoff example satisfies the executable contract", () => {
  const fixture = JSON.parse(readFileSync(join(here, "..", "skills", "dev-visualizer", "assets", "research-handoff.example.json"), "utf8"));
  assert.deepEqual(validateClaims(fixture), []);
  assert.deepEqual(validateResearchHandoff(fixture), []);
  assert.equal(generationReceipt(fixture).legacyInput, false);
});
