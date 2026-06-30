import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrchestrateCommand, extractBalancedJson } from "../src/orchestrate-grammar.ts";

test("parses bare phase commands (case-insensitive)", () => {
  assert.deepEqual(parseOrchestrateCommand("orchestrate p"), { verb: "P", rawAttest: null, attest: null });
  assert.deepEqual(parseOrchestrateCommand("orchestrate A"), { verb: "A", rawAttest: null, attest: null });
  assert.equal(parseOrchestrateCommand("ORCHESTRATE d")?.verb, "D");
});

test("parses control verbs status / reset", () => {
  assert.equal(parseOrchestrateCommand("orchestrate status")?.verb, "status");
  assert.equal(parseOrchestrateCommand("orchestrate reset")?.verb, "reset");
});

test("accepts namespaced + shorthand prefixes", () => {
  assert.equal(parseOrchestrateCommand("$codexclaw:cxc-orchestrate P")?.verb, "P");
  assert.equal(parseOrchestrateCommand("$cxc-orchestrate p")?.verb, "P");
  assert.equal(parseOrchestrateCommand("cxc orchestrate a")?.verb, "A");
  assert.equal(parseOrchestrateCommand("/orchestrate c")?.verb, "C");
});

test("rejects IDLE, unknown verbs, prose, and bare verb-less command", () => {
  assert.equal(parseOrchestrateCommand("orchestrate idle"), null);
  assert.equal(parseOrchestrateCommand("orchestrate x"), null);
  assert.equal(parseOrchestrateCommand("orchestrate proper testing"), null);
  assert.equal(parseOrchestrateCommand("orchestrate"), null);
  assert.equal(parseOrchestrateCommand(""), null);
});

test("does NOT match a verb buried mid-sentence (line-anchored)", () => {
  assert.equal(parseOrchestrateCommand("please orchestrate p for me"), null);
  assert.equal(parseOrchestrateCommand("we should orchestrate proper tests"), null);
});

test("finds the command on its own line within a multi-line prompt", () => {
  const prompt = "here is some context\norchestrate b\nthanks";
  assert.equal(parseOrchestrateCommand(prompt)?.verb, "B");
});

test("--attest with a space-containing did parses (brace-balanced, not split)", () => {
  const cmd = parseOrchestrateCommand('orchestrate A --attest {"from":"P","to":"A","did":"challenged the plan"}');
  assert.equal(cmd?.verb, "A");
  assert.equal(cmd?.attestError, undefined);
  assert.deepEqual(cmd?.attest, { from: "P", to: "A", did: "challenged the plan" });
});

test("--attest preserves checkOutput/exitCode through coerceAttest", () => {
  const cmd = parseOrchestrateCommand('orchestrate d --attest {"from":"C","to":"D","did":"ran tests","checkOutput":"233 pass","exitCode":0}');
  assert.equal(cmd?.attest?.checkOutput, "233 pass");
  assert.equal(cmd?.attest?.exitCode, 0);
});

test("malformed / unbalanced attest JSON sets attestError, never throws", () => {
  const bad = parseOrchestrateCommand('orchestrate a --attest {"from":"P","to":"A"');
  assert.equal(bad?.verb, "A");
  assert.equal(bad?.attest, null);
  assert.match(bad?.attestError ?? "", /balanced|valid/i);
  const notJson = parseOrchestrateCommand("orchestrate a --attest {nope}");
  assert.equal(notJson?.attest, null);
  assert.ok(notJson?.attestError);
});

test("--attest without from/to is coerced to null with an attestError", () => {
  const cmd = parseOrchestrateCommand('orchestrate a --attest {"did":"x"}');
  assert.equal(cmd?.attest, null);
  assert.match(cmd?.attestError ?? "", /from\/to/i);
});

test("extractBalancedJson respects braces inside string literals", () => {
  assert.equal(extractBalancedJson('{"did":"a } b"} trailing'), '{"did":"a } b"}');
  assert.equal(extractBalancedJson('no json here'), null);
  assert.equal(extractBalancedJson('{"unbalanced":true'), null);
});
