import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { prepareResearch } from "../skills/dev-visualizer/scripts/research-adapter.mjs";

const source = (over = {}) => ({ id: "s1", locator: "file:brief.md", observedAt: "2026-09-22", ...over });
const claim = (over = {}) => ({ id: "c1", text: "Supplied fact", kind: "observation", sourceRefs: ["s1"], limitations: [], ...over });
const model = (route = "source-only") => ({
  schemaVersion: 1,
  audience: "reader",
  question: "What is supported?",
  answerClaimId: "c1",
  sources: [source()],
  claims: [claim()],
  research: {
    contractVersion: 1,
    route,
    sourceBoundary: "supplied files",
    sourceLanguages: ["en"],
    outputLanguage: "en",
    questions: [
      { id: "q1", text: "What is supplied?", answeredBy: ["c1"] },
      { id: "q2", text: "What is missing?", answeredBy: [] },
    ],
    gaps: ["q2 requires retrieval"],
    counterEvidence: [{ claimId: "c1", sourceRefs: ["s1"], note: "The brief limits the observation." }],
  },
});

test("source-only validates frozen inputs and never invokes an injected retrieval capability", async () => {
  let calls = 0;
  const result = await prepareResearch(model(), { retrieve: async () => { calls += 1; throw new Error("must not run"); } });
  assert.equal(calls, 0);
  assert.deepEqual(result.issues, []);
  assert.equal(result.model.claims[0].text, "Supplied fact");
  assert.deepEqual(result.model.research.gaps, ["q2 requires retrieval"]);
  assert.deepEqual(result.model.research.counterEvidence[0].sourceRefs, ["s1"]);
});

test("legacy v1 without research stays valid but the receipt does not declare research supplied", async () => {
  const legacy = model();
  delete legacy.research;
  const result = await prepareResearch(legacy);
  assert.deepEqual(result.issues, []);
  assert.equal(result.receipt.supplied, false);
  assert.equal(result.receipt.route, null);
});

test("bounded research without a capability returns an explicit issue and gap", async () => {
  const result = await prepareResearch(model("bounded-lookup"));
  assert.ok(result.issues.some((i) => i.id === "research.retrieve"));
  assert.ok(result.model.research.gaps.some((gap) => /capability unavailable/.test(gap)));
  assert.equal(result.receipt.route, "bounded-lookup");
});

test("retrieval request is bounded and a valid result merges stable ids without dropping supplied evidence", async () => {
  let request;
  const result = await prepareResearch(model("bounded-lookup"), {
    metadata: { skillVersion: "skill-2", packageVersion: "package-8", hostAdapter: "aside" },
    retrieve: async (value) => {
      request = value;
      return {
        sources: [{ id: "s2", locator: "https://example.test/study", observedAt: "2026-09-22", discovered: true,
          spans: [{ id: "abstract", locator: "#abstract", language: "en", excerpt: "No effect." }] }],
        claims: [{ id: "c2", text: "The study found no effect.", kind: "observation", sourceRefs: ["s2"],
          sourceSpans: [{ sourceId: "s2", spanId: "abstract" }], limitations: ["One study."] }],
        answers: [{ questionId: "q2", claimIds: ["c2"] }],
        gaps: ["Long-term outcomes remain unknown."],
        counterEvidence: [{ claimId: "c1", sourceRefs: ["s2"], note: "A contrary study found no effect." }],
        stopReason: "bounded question answered",
      };
    },
  });
  assert.deepEqual(request, {
    route: "bounded-lookup",
    sourceBoundary: "supplied files",
    sourceLanguages: ["en"],
    outputLanguage: "en",
    questions: model("bounded-lookup").research.questions,
    suppliedSources: [source()],
  });
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.model.sources.map((item) => item.id), ["s1", "s2"]);
  assert.deepEqual(result.model.claims.map((item) => item.id), ["c1", "c2"]);
  assert.deepEqual(result.model.research.questions.find((item) => item.id === "q2").answeredBy, ["c2"]);
  assert.deepEqual(result.model.research.counterEvidence.map((item) => item.sourceRefs), [["s1"], ["s2"]]);
  assert.equal(result.receipt.skillVersion, "skill-2");
  assert.equal(result.receipt.packageVersion, "package-8");
});

test("conflicting duplicate ids reject the retrieval payload without overwriting supplied evidence", async () => {
  const original = model("bounded-lookup");
  const result = await prepareResearch(original, { retrieve: async () => ({
    sources: [{ ...source(), locator: "https://attacker.test/replaced" }],
    claims: [], answers: [], gaps: [], counterEvidence: [],
  }) });
  assert.ok(result.issues.some((i) => /conflicting duplicate source/i.test(i.msg)), JSON.stringify(result.issues));
  assert.equal(result.model.sources[0].locator, "file:brief.md");
  assert.equal(result.model.sources.length, 1);
});

test("identical duplicate ids are deduplicated while conflicting duplicate answers are rejected", async () => {
  const identical = await prepareResearch(model("bounded-lookup"), { retrieve: async () => ({
    sources: [source(), source()], claims: [claim(), claim()],
    answers: [{ questionId: "q1", claimIds: ["c1"] }, { questionId: "q1", claimIds: ["c1"] }],
    gaps: [], counterEvidence: [],
  }) });
  assert.deepEqual(identical.issues, []);
  assert.equal(identical.model.sources.length, 1);
  assert.equal(identical.model.claims.length, 1);

  const conflicting = await prepareResearch(model("bounded-lookup"), { retrieve: async () => ({
    sources: [], claims: [],
    answers: [{ questionId: "q1", claimIds: ["c1"] }, { questionId: "q1", claimIds: ["other"] }],
    gaps: [], counterEvidence: [],
  }) });
  assert.ok(conflicting.issues.some((i) => /Conflicting duplicate retrieval answer/.test(i.msg)));
});

test("malformed or rejected retrieval returns issues and does not fabricate answers", async () => {
  for (const retrieve of [
    async () => ({ sources: [], claims: [], answers: [{ questionId: "q2", claimIds: ["invented"] }], gaps: [], counterEvidence: [] }),
    async () => { throw new Error("provider secret detail"); },
  ]) {
    const result = await prepareResearch(model("deep-research"), { retrieve });
    assert.ok(result.issues.length, "failure must be visible");
    assert.deepEqual(result.model.research.questions.find((item) => item.id === "q2").answeredBy, []);
    assert.ok(result.model.research.gaps.length >= 2);
  }
});

test("hostile retrieval shapes return explicit issues instead of throwing", async () => {
  for (const payload of [null, [], {}, { sources: "all", claims: [], answers: [], gaps: [], counterEvidence: [] }]) {
    await assert.doesNotReject(async () => {
      const result = await prepareResearch(model("bounded-lookup"), { retrieve: async () => payload });
      assert.ok(result.issues.some((i) => i.id === "research.result"), JSON.stringify(result));
    });
  }
});

test("malformed adapter options return issues instead of throwing", async () => {
  await assert.doesNotReject(async () => {
    const result = await prepareResearch(model(), null);
    assert.ok(result.issues.some((i) => i.id === "research.options"));
  });
  const badMetadata = await prepareResearch(model(), { metadata: null });
  assert.ok(badMetadata.issues.some((i) => i.id === "generation.metadata"));
});

test("operational CLI reads only frozen JSON, emits provenance, and exits nonzero for invalid input", () => {
  const dir = mkdtempSync(join(tmpdir(), "report-intake-"));
  const home = join(dir, "home");
  const input = join(dir, "model.json");
  const metadata = join(dir, "metadata.json");
  const script = resolve("plugins/codexclaw/skills/dev-visualizer/scripts/report-intake.mjs");
  writeFileSync(input, JSON.stringify(model()));
  writeFileSync(metadata, JSON.stringify({ skillVersion: "skill-cli", packageVersion: "package-cli", sourceSha: "b".repeat(40), hostAdapter: "aside" }));
  const env = { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: join(home, "config"), XDG_CACHE_HOME: join(home, "cache") };
  const ok = spawnSync(process.execPath, [script, input, "--metadata", metadata], { encoding: "utf8", env, timeout: 10_000 });
  assert.equal(ok.status, 0, ok.stderr);
  const output = JSON.parse(ok.stdout);
  assert.equal(output.receipt.skillVersion, "skill-cli");
  assert.equal(output.receipt.packageVersion, "package-cli");
  assert.deepEqual(output.issues, []);

  writeFileSync(input, "{bad json");
  const bad = spawnSync(process.execPath, [script, input], { encoding: "utf8", env, timeout: 10_000 });
  assert.equal(bad.status, 1);
  const failure = JSON.parse(bad.stdout);
  assert.equal(failure.issues[0].id, "intake.model");
  assert.doesNotMatch(bad.stderr, /SyntaxError|at JSON\.parse/);
  assert.equal(readFileSync(metadata, "utf8").includes("package-cli"), true);
});
