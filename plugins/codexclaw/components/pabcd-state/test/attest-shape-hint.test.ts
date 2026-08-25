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
  // Positive form: a menu of every key would also "not mention auditVerdict"
  // only by accident. Assert the bound-session note is edge-correct instead.
  assert.match(r.output, /needs "workPhaseId"\./);
  assert.doesNotMatch(r.output, /testReceiptPath/);
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
  // The pre-fix build also emitted this literal, so the path match alone proves
  // nothing. The hint substrings below are what did not exist before.
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


// Found by re-reading the shipped output before the reviewer got to it: the first
// version printed the CURRENT phase as `from` even when the requested edge was
// illegal, so an agent at P asking for D was handed {"from":"P","to":"D"} — an
// object that clears the coerce gate and is then refused by the FSM adjacency
// check. Two wrong refusals instead of one. A hint that teaches a rejected attest
// is worse than no hint.
test("an illegal edge names the legal routes instead of teaching a doomed attest", () => {
  const cwd = freshCwd();
  seedSession(cwd, "s4", "P");
  const args = parseOrchestrateCliArgs(["d", "--session", "s4", "--attest", '{"did":"x"}'], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /P -> D is not a legal edge/);
  assert.match(r.output, /legal from P is I\|A/);
  // Crucially: no example object, because every object would be refused.
  assert.doesNotMatch(r.output, /"from":"P","to":"D"/);
});

test("a legal edge from the same phase still gets the worked example", () => {
  const cwd = freshCwd();
  seedSession(cwd, "s5", "P");
  const args = parseOrchestrateCliArgs(["a", "--session", "s5", "--attest", '{"did":"x"}'], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.match(r.output, /"from":"P","to":"A"/);
  assert.doesNotMatch(r.output, /not a legal edge/);
});


// ---------------------------------------------------------------------------
// The injected surfaces. A Stop block and a goal-idle block are commands agents
// copy verbatim, so an example missing a key spends their next turn on a refusal
// — the same cascade this unit exists to close, one layer up.
// ---------------------------------------------------------------------------
import { stopNextCommand, buildGoalIdleBlock, loopArmDirective } from "../src/hook.ts";

test("every gated Stop command carries the keys its edge actually requires", () => {
  // P>A needs planUnit; C>D needs testReceiptPath; every gated edge needs
  // workPhaseId when a goalplan is bound. All three were absent.
  assert.match(stopNextCommand("P", "linux") ?? "", /planUnit/);
  assert.match(stopNextCommand("P", "linux") ?? "", /workPhaseId/);
  assert.match(stopNextCommand("A", "linux") ?? "", /workPhaseId/);
  assert.match(stopNextCommand("B", "linux") ?? "", /workPhaseId/);
  assert.match(stopNextCommand("C", "linux") ?? "", /testReceiptPath/);
  assert.match(stopNextCommand("C", "linux") ?? "", /workPhaseId/);
  // from/to were already right here; assert them so a rewrite cannot drop them.
  for (const phase of ["P", "A", "B", "C"] as const) {
    assert.match(stopNextCommand(phase, "linux") ?? "", /"from":"/, `${phase} names from`);
    assert.match(stopNextCommand(phase, "linux") ?? "", /"to":"/, `${phase} names to`);
  }
});

test("the goal-idle block emits did, not evidence, and closes its backticks", () => {
  const state = { ...defaultState("gi1"), phase: "IDLE" as const };
  for (const platform of ["linux", "win32"] as const) {
    // buildGoalIdleBlock returns the hook JSON envelope, so read the reason.
    const block = JSON.parse(buildGoalIdleBlock("/unused", state, "gi1", platform)).reason as string;
    // 'evidence' is not a key coerceAttest reads. IDLE>P is ungated, so this
    // advanced anyway and taught a wrong field name that failed silently.
    assert.match(block, /"did":"/, `${platform}: uses did`);
    assert.doesNotMatch(block, /"evidence":/, `${platform}: no evidence key`);
    // A backtick-escape slip while renaming the key left a trailing backslash and
    // an unterminated span in the rendered text. Caught in review, pinned here.
    assert.doesNotMatch(block, /\\\\$/m, `${platform}: no line ends in a stray backslash`);
    const ticks = (block.match(/`/g) ?? []).length;
    assert.equal(ticks % 2, 0, `${platform}: backticks are balanced`);
  }
});

test("the arming directive shows a from/to-bearing object on both platforms", () => {
  for (const platform of ["linux", "win32"] as const) {
    const d = loopArmDirective(platform);
    assert.match(d, /"from":"P","to":"A"/, `${platform}: P>A object`);
    assert.match(d, /planUnit/, `${platform}: planUnit`);
    assert.match(d, /ATTEST-SHAPE-01/, `${platform}: names the rule`);
  }
});


// ---------------------------------------------------------------------------
// Drift detection. Everything above fixes today's text; this is what fails the
// build when the NEXT contract change forgets the skill again. The repo already
// works this way — see "shipped skill catalog exactly matches on-disk SKILL.md
// folders" — so the genre is house style, not an invention.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
import { parseOrchestrateCommand } from "../src/orchestrate-grammar.ts";

const REPO = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");

/** The attest table rows out of pabcd/SKILL.md, keyed by edge. */
function attestTableRows(): Map<string, string> {
  const md = readFileSync(resolvePath(REPO, "plugins/codexclaw/skills/pabcd/SKILL.md"), "utf8");
  const rows = new Map<string, string>();
  for (const line of md.split("\n")) {
    const m = /^\|\s*(IDLE->P|I->P|P->A|A->B|B->C|C->D)\s*\|([^|]*)\|/.exec(line.trim());
    // Capture the KEYS cell only. Taking the rest of the row would let a
    // mention in the Notes column satisfy a key the contract cell omits — the
    // exact way this test first passed against injected drift.
    if (m) rows.set(m[1], m[2]);
  }
  return rows;
}

test("the pabcd attest table names every key its edge's gate requires", () => {
  const rows = attestTableRows();
  // A file-wide grep would pass on any incidental mention in a 37k-character
  // document. Bind to the ROW, so a key documented for the wrong edge fails.
  const required: Record<string, string[]> = {
    "P->A": ["from", "to", "did", "planUnit"],
    "A->B": ["from", "to", "did", "auditOutput", "auditVerdict"],
    "B->C": ["from", "to", "did"],
    "C->D": ["from", "to", "did", "checkOutput", "exitCode"],
  };
  for (const [edge, keys] of Object.entries(required)) {
    const row = rows.get(edge);
    assert.ok(row, `the attest table has no row for ${edge}`);
    for (const key of keys) {
      assert.ok(row!.includes(key), `${edge} row must name "${key}" — the gate requires it`);
    }
  }
  // The bound-session keys are stated once beneath the table rather than per row.
  const md = readFileSync(resolvePath(REPO, "plugins/codexclaw/skills/pabcd/SKILL.md"), "utf8");
  assert.match(md, /workPhaseId/);
  assert.match(md, /testReceiptPath/);
  assert.match(md, /ATTEST-SHAPE-01/);
});

test("the chat grammar rejects a from/to-less attest with the same guidance", () => {
  const cmd = parseOrchestrateCommand('orchestrate a --attest {"did":"x"}');
  assert.ok(cmd, "the line-anchored command must parse");
  assert.match(cmd!.attestError ?? "", /missing valid from\/to/);
  // Both parsers now teach the same shape; a reader comparing them cannot
  // conclude one of the two is authoritative.
  assert.match(cmd!.attestError ?? "", /ATTEST-SHAPE-01/);
});

