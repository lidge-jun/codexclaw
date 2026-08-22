/**
 * help-verbs.test.ts — issue #47: `cxc orchestrate --help` worked while every
 * sibling reported `--help` as an unknown verb and exited non-zero. The top-level
 * help points at those commands, so an agent that followed the pointer hit a brick
 * wall and had to learn each flag from a rejection.
 *
 * These assert the CONTRACT (exit 0 plus usage), not the wording, so the help text
 * can be edited without churning the test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGoalplanCliArgs, runGoalplanCli } from "../src/goalplan-cli.ts";
import { parseReceiptCliArgs, runReceiptCli } from "../src/receipt-cli.ts";
import { parseScanCliArgs, runScanCli } from "../src/scan-cli.ts";

const CWD = "/unused";

for (const token of ["help", "--help", "-h"]) {
  test(`loop ${token} prints usage and exits 0`, () => {
    const args = parseGoalplanCliArgs([token], CWD);
    assert.ok(!("error" in args), `${token} must not be an unknown verb`);
    const r = runGoalplanCli(args as never);
    assert.equal(r.code, 0);
    assert.match(r.output, /Usage:/);
    // The flags that could previously only be discovered from rejections.
    assert.match(r.output, /--session <id>/);
    assert.match(r.output, /--batch-json/);
    assert.match(r.output, /idempotencyKey/);
  });

  test(`receipt ${token} prints usage and exits 0`, () => {
    const args = parseReceiptCliArgs([token], CWD);
    assert.ok(!("error" in args), `${token} must not be an unknown verb`);
    const r = runReceiptCli(args as never);
    assert.equal(r.code, 0);
    assert.match(r.output, /Usage:/);
    assert.match(r.output, /-- <command>/);
  });

  test(`scan ${token} prints usage and exits 0`, () => {
    const args = parseScanCliArgs([token], CWD);
    assert.ok(!("error" in args), `${token} must not be an unknown action`);
    const r = runScanCli(args as never);
    assert.equal(r.code, 0);
    assert.match(r.output, /Usage:/);
    assert.match(r.output, /--cwd <path>/);
  });
}

// An unknown verb must still fail — but now it names the way out.
test("an unknown verb points at --help instead of just listing verbs", () => {
  const loop = parseGoalplanCliArgs(["nope"], CWD);
  assert.ok("error" in loop);
  assert.match((loop as { error: string }).error, /cxc loop --help/);

  const receipt = parseReceiptCliArgs(["nope"], CWD);
  assert.ok("error" in receipt);
  assert.match((receipt as { error: string }).error, /cxc receipt --help/);

  const scan = parseScanCliArgs(["nope"], CWD);
  assert.ok("error" in scan);
  assert.match((scan as { error: string }).error, /cxc scan --help/);
});

// #47 also reported `scan record --cwd` as rejected while orchestrate accepts it.
// That stranded a session whose answer ledger lived outside the process cwd.
test("scan record accepts --cwd, like orchestrate does", () => {
  const args = parseScanCliArgs(["record", "--session", "s1", "--cwd", "/elsewhere"], CWD);
  assert.ok(!("error" in args), "scan record must accept --cwd");
  assert.equal((args as { cwd: string }).cwd, "/elsewhere");
});

test("scan record without --cwd still resolves against the process cwd", () => {
  const args = parseScanCliArgs(["record", "--session", "s1"], CWD);
  assert.ok(!("error" in args));
  assert.equal((args as { cwd: string }).cwd, CWD);
});
