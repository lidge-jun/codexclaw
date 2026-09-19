// report-research-handoff.test.mjs — issue #199.
//
// The handoff exists so the publication step inherits what was asked, how far the answer
// was allowed to reach, and what is still unresolved. The cases that matter are the ones
// where a document could otherwise look finished while hiding one of those.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateClaims,
  validateResearchHandoff,
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
