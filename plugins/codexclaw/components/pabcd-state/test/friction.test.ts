import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeError,
  frictionKey,
  verdictForCount,
  recordFriction,
  readFrictionVerdict,
  peakFrictionVerdict,
  looksLikeFailure,
  readFrictionEntries,
} from "../src/friction.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-friction-"));
}

test("080.1: verdict math retry(1)/escalate(>=2)/stop(>=3)", () => {
  assert.equal(verdictForCount(1), "retry");
  assert.equal(verdictForCount(2), "escalate");
  assert.equal(verdictForCount(3), "stop");
  assert.equal(verdictForCount(7), "stop");
});

test("080.1: normalizeError strips line:col + paths so the same failure keys stably", () => {
  const a = normalizeError("Error at /Users/jun/x.ts:12:5: boom");
  const b = normalizeError("Error at /tmp/y.ts:99:1: boom");
  assert.equal(a, b, "path + line:col normalized away => same signature");
  assert.equal(frictionKey("Bash", a), frictionKey("Bash", b));
});

test("080.1: recordFriction increments the same signature and escalates", () => {
  const cwd = tmp();
  assert.equal(recordFriction(cwd, "Bash", "fatal: boom at x.ts:1:1"), "retry");
  assert.equal(recordFriction(cwd, "Bash", "fatal: boom at x.ts:2:9"), "escalate");
  assert.equal(recordFriction(cwd, "Bash", "fatal: boom at x.ts:3:3"), "stop");
  assert.ok(existsSync(join(cwd, ".codexclaw", "friction.jsonl")));
  assert.equal(peakFrictionVerdict(cwd), "stop");
});

test("080.1: distinct failures keep distinct counts", () => {
  const cwd = tmp();
  recordFriction(cwd, "Bash", "command not found: foo");
  recordFriction(cwd, "Bash", "permission denied");
  // each seen once => retry
  assert.equal(readFrictionVerdict(cwd, "Bash", "command not found: foo"), "retry");
  assert.equal(readFrictionVerdict(cwd, "Bash", "permission denied"), "retry");
  assert.equal(readFrictionEntries(cwd).length, 2);
});

test("080.1: readFrictionVerdict is null for an unseen signature; fail-open on missing dir", () => {
  const cwd = tmp();
  assert.equal(readFrictionVerdict(cwd, "Bash", "never happened"), null);
  assert.equal(peakFrictionVerdict(cwd), null);
});

test("080.1: looksLikeFailure matches markers, ignores clean output", () => {
  assert.equal(looksLikeFailure("Traceback (most recent call last):"), true);
  assert.equal(looksLikeFailure("npm ERR! code E404"), true);
  assert.equal(looksLikeFailure("error: cannot find module"), true);
  assert.equal(looksLikeFailure("ok, 5 files written"), false);
  assert.equal(looksLikeFailure(""), false);
});
