import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseOrchestrateCliArgs, runOrchestrateCli, resolveSession } from "../src/orchestrate-cli.ts";
import { writeState, readState, defaultState, STATE_DIR, SESSIONS_SUBDIR, LEDGER_FILE } from "../src/state.ts";

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-cli-"));
}
function seedSession(cwd: string, id: string, phase: Parameters<typeof defaultState>[0] extends string ? string : never = "IDLE"): void {
  writeState(cwd, { ...defaultState(id), phase: phase as never });
}
function ledgerLines(cwd: string): Array<Record<string, unknown>> {
  const p = join(cwd, STATE_DIR, LEDGER_FILE);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

test("parseOrchestrateCliArgs: verb + structural --attest (single quoted token)", () => {
  const r = parseOrchestrateCliArgs(["a", "--attest", '{"from":"P","to":"A","did":"x y z"}'], "/tmp");
  assert.ok(!("error" in r));
  if ("error" in r) return;
  assert.equal(r.verb, "A");
  assert.deepEqual(r.attest, { from: "P", to: "A", did: "x y z" });
});

test("parseOrchestrateCliArgs: unknown verb -> error", () => {
  const r = parseOrchestrateCliArgs(["idle"], "/tmp");
  assert.ok("error" in r);
});

test("parseOrchestrateCliArgs: malformed --attest sets attestError, no throw", () => {
  const r = parseOrchestrateCliArgs(["a", "--attest", "{nope}"], "/tmp");
  assert.ok(!("error" in r));
  if ("error" in r) return;
  assert.ok(r.attestError);
});

test("AGENT-GATED: P->A without --attest fails (unlike chat free-pass)", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "P");
    const r = runOrchestrateCli({ verb: "A", attest: null, session: "s1", cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /attestation|did/i);
    assert.equal(readState(cwd, "s1").phase, "P"); // unchanged
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("AGENT-GATED: P->A WITH valid --attest advances + ledger reason 'cli'", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s2", "P");
    const r = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "audited" }, session: "s2", cwd, json: false });
    assert.equal(r.code, 0);
    assert.equal(readState(cwd, "s2").phase, "A");
    const led = ledgerLines(cwd);
    assert.equal(led.at(-1)?.reason, "cli");
    assert.equal(led.at(-1)?.to, "A");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("C->D with failing exitCode is rejected (gated check)", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s3", "C");
    const r = runOrchestrateCli({ verb: "D", attest: { from: "C", to: "D", did: "ran", checkOutput: "x", exitCode: 1 }, session: "s3", cwd, json: false });
    assert.equal(r.code, 1);
    assert.equal(readState(cwd, "s3").phase, "C");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("illegal edge from IDLE is refused", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s4", "IDLE");
    const r = runOrchestrateCli({ verb: "C", attest: null, session: "s4", cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /illegal transition|attestation/i);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("status renders phase; reset clears to IDLE", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s5", "C");
    const st = runOrchestrateCli({ verb: "status", attest: null, session: "s5", cwd, json: false });
    assert.match(st.output, /phase=C/);
    const rs = runOrchestrateCli({ verb: "reset", attest: null, session: "s5", cwd, json: false });
    assert.equal(rs.code, 0);
    assert.equal(readState(cwd, "s5").phase, "IDLE");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("mutating verb with no session and empty dir -> error (no silent divergence)", () => {
  const cwd = freshCwd();
  try {
    const r = runOrchestrateCli({ verb: "P", attest: null, cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /no active session/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("status with no session reports it without creating one", () => {
  const cwd = freshCwd();
  try {
    const r = runOrchestrateCli({ verb: "status", attest: null, cwd, json: false });
    assert.equal(r.code, 0);
    assert.match(r.output, /no active session/);
    assert.equal(existsSync(join(cwd, STATE_DIR, SESSIONS_SUBDIR)), false);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("resolveSession: explicit wins; latest-mtime otherwise; null on empty", () => {
  const cwd = freshCwd();
  try {
    assert.equal(resolveSession(cwd), null); // missing dir
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "old.json"), "{}");
    writeFileSync(join(dir, "new.json"), "{}");
    const past = Date.now() / 1000 - 100;
    utimesSync(join(dir, "old.json"), past, past);
    assert.equal(resolveSession(cwd), "new"); // latest mtime
    assert.equal(resolveSession(cwd, "explicit"), "explicit"); // explicit wins
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// root-bin integration: actually invoke bin/codexclaw.mjs orchestrate ...
function repoRoot(): string {
  // test/ -> pabcd-state -> components -> codexclaw -> plugins -> <repoRoot>
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..", "..", "..");
}

test("root bin: `codexclaw orchestrate status` runs end-to-end", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "binsess", "P");
    const bin = join(repoRoot(), "bin", "codexclaw.mjs");
    const res = spawnSync(process.execPath, [bin, "orchestrate", "status", "--session", "binsess", "--cwd", cwd], { encoding: "utf8" });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /phase=P/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
