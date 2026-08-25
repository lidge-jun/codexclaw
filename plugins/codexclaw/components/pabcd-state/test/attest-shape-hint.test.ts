/**
 * attest-shape-hint.test.ts — 260825 wp1.
 *
 * `attest JSON missing valid from/to` was the most-hit agent-facing failure in the
 * archive: 50+ occurrences across four repos, because the skill table agents copy
 * never listed from/to. The message named the problem and nothing else, so the
 * agent retried the same omission.
 *
 * These assertions deliberately pin substrings that did NOT exist before this
 * change. Asserting that the output "contains from and to" would have passed
 * against the original bare message — it contains both words — and an audit
 * caught exactly that in the first draft of the plan.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseOrchestrateCliArgs, runOrchestrateCli, renderAttestShapeHint, renderOrchestrateHelp } from "../src/orchestrate-cli.ts";
import { writeState, defaultState } from "../src/state.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-attest-hint-"));
}

function seedSession(cwd: string, id: string, phase: string): void {
  writeState(cwd, { ...defaultState(id), phase: phase as never });
}

test("inline --attest without from/to names the real edge and a worked example", () => {
  const cwd = freshCwd();
  seedSession(cwd, "s1", "P");
  const args = parseOrchestrateCliArgs(["a", "--session", "s1", "--attest", '{"did":"wrote the plan"}'], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  // `to` comes from the verb, which the parser resolves before the attest loop.
  // `from` comes from the session state the error path already reads.
  assert.match(r.output, /"from":"P","to":"A"/);
  // A worked example: absent from the pre-fix message entirely.
  assert.match(r.output, /"did":"\.\.\."/);
  // The extra key for THIS edge, not a menu of every key the FSM has.
  assert.match(r.output, /planUnit/);
  assert.doesNotMatch(r.output, /auditVerdict/);
});

test("--attest-file without from/to gets the hint on its own distinct wording", () => {
  const cwd = freshCwd();
  seedSession(cwd, "s2", "C");
  const p = join(cwd, "bad-attest.json");
  writeFileSync(p, '{"did":"verified"}', "utf8");
  const args = parseOrchestrateCliArgs(["d", "--session", "s2", "--attest-file", p], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  // :257 emits a DIFFERENT literal from :227 — the path is named. A single-path
  // test would leave the Windows-required flag uncovered.
  assert.match(r.output, /attest file .*bad-attest\.json is missing valid from\/to/);
  assert.match(r.output, /"from":"C","to":"D"/);
  assert.match(r.output, /checkOutput/);
  assert.match(r.output, /exitCode/);
});

test("an unresolvable session yields a status pointer instead of a fabricated phase", () => {
  const cwd = freshCwd();
  const args = parseOrchestrateCliArgs(["b", "--session", "never-created", "--attest", '{"did":"x"}'], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /"to":"B"/);
  // Never invent a `from`: say so and name the command that reveals it.
  assert.match(r.output, /cxc orchestrate status --session/);
  assert.match(r.output, /auditOutput/);
});

test("malformed JSON keeps its own diagnosis and gets no shape example", () => {
  const cwd = freshCwd();
  seedSession(cwd, "s3", "P");
  const args = parseOrchestrateCliArgs(["a", "--session", "s3", "--attest", "{not json"], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /attest JSON is not valid JSON/);
  // A well-formed-object example would only muddy a syntax error.
  assert.doesNotMatch(r.output, /"did":"\.\.\."/);
});

test("renderAttestShapeHint is silent for the control verbs", () => {
  assert.equal(renderAttestShapeHint("status", "P"), "");
  assert.equal(renderAttestShapeHint("reset", "P"), "");
});

test("orchestrate help ships a copy-paste object for every gated edge", () => {
  for (const platform of ["linux", "win32"] as const) {
    const help = renderOrchestrateHelp(platform);
    assert.match(help, /"from":"P","to":"A"/, `${platform}: P->A example`);
  }
  // The posix branch carries the full ladder. B->C had no example at all and
  // C->D omitted testReceiptPath until 260825 wp1, so the skill table could not
  // honestly point at help as its source.
  const posix = renderOrchestrateHelp("linux");
  assert.match(posix, /"from":"A","to":"B"/);
  assert.match(posix, /"from":"B","to":"C"/);
  assert.match(posix, /"from":"C","to":"D"/);
  assert.match(posix, /testReceiptPath/);
});

