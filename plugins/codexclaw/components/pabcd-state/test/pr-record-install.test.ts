/**
 * pr-record-install.test.ts — issue #316.
 *
 * A host ran \`cxc loop pr-record\` from a newer clone while its installed hooks were
 * 0.2.42, and the completion gate kept denying. Two things must hold on this side:
 * a record lands where the session's gate reads it (or nothing is written), and an
 * install that meets a record or verb newer than itself says so with the update path.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.CODEXCLAW_CXC = "cxc";

import { prRecordPath, runPrRecord, type GhPrView, type GhViewFn } from "../src/pr-record.ts";
import { applyGoalCompleteGuard, type PreToolUsePayload } from "../src/goal-gate.ts";
import { defaultState, writeState } from "../src/state.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { parseGoalplanCliArgs } from "../src/goalplan-cli.ts";

const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".codex-plugin", "plugin.json");
const INSTALLED = (JSON.parse(readFileSync(MANIFEST, "utf8")) as { version: string }).version;
const UPDATE = "codex plugin marketplace upgrade codexclaw";

const MERGED: GhPrView = {
  url: "https://github.com/goat-si/goat/pull/831", number: 831, state: "MERGED",
  mergedAt: "2026-10-22T01:00:00Z", mergeCommit: { oid: "abc123" }, headRefOid: "def456",
  statusCheckRollup: [{ __typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "SUCCESS" }],
};
const view = (v: GhPrView): GhViewFn => () => ({ ok: true, view: v });

function ptu(cwd: string, sessionId: string): PreToolUsePayload {
  return { hook_event_name: "PreToolUse", session_id: sessionId, cwd, tool_name: "update_goal", tool_input: { status: "complete" }, turn_id: "t1", transcript_path: null };
}
function decision(out: string): string {
  return out === "" ? "allow" : JSON.parse(out.trimEnd()).hookSpecificOutput.permissionDecision;
}

/** The issue's state: IDLE, bound plan, c-2 and c-3 unmet. */
function issueSession(cwd: string, sessionId: string): void {
  const plan = buildGoalplan({ objective: "goat " + sessionId, criteria: [
    { scenario: "docs", expectedEvidence: "merged" },
    { scenario: "PR A merged", expectedEvidence: "merge sha" },
    { scenario: "PR B merged", expectedEvidence: "merge sha" },
  ] });
  plan.criteria[0] = { ...plan.criteria[0], status: "met", capturedEvidence: "docs merged" };
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState(sessionId), phase: "IDLE", slug: plan.slug });
}

test("#316: the issue's E8 denial (unmet c-2, c-3) turns into an allow once the merged PR is recorded in the session checkout", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-316-gate-"));
  try {
    issueSession(cwd, "goat-a");
    const before = applyGoalCompleteGuard(ptu(cwd, "goat-a"));
    assert.equal(decision(before), "deny");
    assert.match(before, /fails E8: 2 unmet/);
    assert.equal(runPrRecord(cwd, "goat-a", "831", { view: view(MERGED) }).code, 0);
    assert.equal(decision(applyGoalCompleteGuard(ptu(cwd, "goat-a"))), "allow");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("#316: pr-record run from a checkout that does not hold the session is refused and writes nothing", () => {
  const session = mkdtempSync(join(tmpdir(), "cxc-316-session-"));
  const clone = mkdtempSync(join(tmpdir(), "cxc-316-clone-"));
  try {
    issueSession(session, "goat-b");
    const out = runPrRecord(clone, "goat-b", "831", { view: view(MERGED) });
    assert.equal(out.code, 1, out.output);
    assert.match(out.output, /--cwd/);
    assert.match(out.output, /Nothing was written/);
    assert.equal(existsSync(prRecordPath(clone, "goat-b")), false);
    assert.equal(decision(applyGoalCompleteGuard(ptu(session, "goat-b"))), "deny");
  } finally {
    rmSync(session, { recursive: true, force: true });
    rmSync(clone, { recursive: true, force: true });
  }
});

test("#316: a record written by a newer cxc is not trusted, and the denial names this install and the update path", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-316-newer-"));
  try {
    issueSession(cwd, "goat-c");
    const path = prRecordPath(cwd, "goat-c");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ schema: 2, sessionId: "goat-c", cxcVersion: "9.9.9", url: MERGED.url, verdict: "merged", recordedAt: new Date().toISOString() }));
    const out = applyGoalCompleteGuard(ptu(cwd, "goat-c"));
    assert.equal(decision(out), "deny");
    assert.ok(out.includes(INSTALLED), out);
    assert.match(out, /9\.9\.9/);
    assert.ok(out.includes(UPDATE), out);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("#316: a loop verb this build lacks names the installed version and the update path", () => {
  const parsed = parseGoalplanCliArgs(["record-pr-v2", "--session", "s1"], "/tmp/x");
  assert.ok("error" in parsed);
  const error = (parsed as { error: string }).error;
  assert.ok(error.includes(INSTALLED), error);
  assert.ok(error.includes(UPDATE), error);
});
