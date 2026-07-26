/**
 * final-gate guard tests (WP12 / plan 040).
 *
 * Fixtures build all three real files — session state, goalplan, receipt —
 * because a break anywhere in that chain fails open, so a deny case is only
 * meaningful when every link is present.
 *
 * Current identity is injected rather than captured: a temp directory has no
 * git, which lands on the unavailable branch and allows everything, leaving the
 * stale-receipt path unobservable.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FINAL_GATE_MARKER, checkFinalGatePrereqs, type SourceIdentityLite } from "../src/final-gate-guard.ts";
import { runSpawnAttachHook } from "../src/spawn-attach-hook.ts";

const HERE: SourceIdentityLite = { kind: "resolved", commitSha: "aaaaaaa", dirty: false };
const MOVED: SourceIdentityLite = { kind: "resolved", commitSha: "bbbbbbb", dirty: false };
const NO_GIT: SourceIdentityLite = { kind: "unavailable", commitSha: "", dirty: false };

const SESSION = "sess-1";
const SLUG = "demo";
const PACKET = `${FINAL_GATE_MARKER} please review the final gate`;

interface Fixture {
  surface?: string;
  testReceipt?: SourceIdentityLite | "missing" | "empty";
  qaReceipt?: SourceIdentityLite | "missing" | "empty";
  omitGate?: boolean;
  omitPlan?: boolean;
  omitSession?: boolean;
  slug?: string;
}

function fixture(opts: Fixture = {}): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-fgg-"));
  mkdirSync(join(cwd, ".codexclaw", "sessions"), { recursive: true });
  mkdirSync(join(cwd, ".codexclaw", "evidence"), { recursive: true });
  mkdirSync(join(cwd, ".codexclaw", "goalplans", SLUG), { recursive: true });

  if (!opts.omitSession) {
    writeFileSync(
      join(cwd, ".codexclaw", "sessions", `${SESSION}.json`),
      JSON.stringify({ sessionId: SESSION, slug: opts.slug ?? SLUG }),
    );
  }

  const writeReceipt = (name: string, spec: SourceIdentityLite | "missing" | "empty" | undefined): string | undefined => {
    if (spec === undefined || spec === "missing") return undefined;
    const rel = join(".codexclaw", "evidence", name);
    writeFileSync(join(cwd, rel), spec === "empty" ? "" : JSON.stringify({ kind: "test", sourceIdentity: spec }));
    return rel;
  };

  const testPath = writeReceipt("test.json", opts.testReceipt);
  const qaPath = writeReceipt("qa.json", opts.qaReceipt);

  if (!opts.omitPlan) {
    writeFileSync(
      join(cwd, ".codexclaw", "goalplans", SLUG, "goalplan.json"),
      JSON.stringify({
        objective: "o",
        slug: SLUG,
        criteria: [{ id: "c-1", scenario: "s", ...(opts.surface ? { surface: opts.surface } : {}) }],
        ...(opts.omitGate
          ? {}
          : {
              finalGate: {
                status: "in_flight",
                qaRequired: opts.surface === "web" || opts.surface === "tui",
                ...(testPath ? { testReceiptPath: testPath } : {}),
                ...(qaPath ? { qaReceiptPath: qaPath } : {}),
              },
            }),
      }),
    );
  }
  return cwd;
}

function check(cwd: string, current: SourceIdentityLite = HERE, packet = PACKET, session = SESSION) {
  return checkFinalGatePrereqs(packet, session, cwd, () => current);
}

test("a spawn without the marker is none of the guard's business", () => {
  const cwd = fixture({ testReceipt: "missing" });
  assert.equal(check(cwd, HERE, "please review this plan").ok, true);
});

test("a marked spawn with a fresh test receipt and no visual criteria is allowed", () => {
  const cwd = fixture({ testReceipt: HERE });
  assert.equal(check(cwd).ok, true);
});

test("a marked spawn with no test receipt is denied and names the gap", () => {
  const cwd = fixture({ testReceipt: "missing" });
  const r = check(cwd);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /test receipt path is not recorded/);
});

test("an empty test receipt is denied", () => {
  const cwd = fixture({ testReceipt: "empty" });
  const r = check(cwd);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /missing, empty or unreadable/);
});

test("a web criterion demands a QA receipt", () => {
  const cwd = fixture({ surface: "web", testReceipt: HERE });
  const r = check(cwd);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /QA receipt path is not recorded/);
});

test("a tui criterion demands a QA receipt", () => {
  const cwd = fixture({ surface: "tui", testReceipt: HERE });
  assert.equal(check(cwd).ok, false);
});

test("a web criterion with both receipts fresh is allowed", () => {
  const cwd = fixture({ surface: "web", testReceipt: HERE, qaReceipt: HERE });
  assert.equal(check(cwd).ok, true);
});

test("a logic criterion needs no QA receipt", () => {
  const cwd = fixture({ surface: "logic", testReceipt: HERE });
  assert.equal(check(cwd).ok, true);
});

test("an unknown surface is not treated as visual — 030 rejects it, not this guard", () => {
  const cwd = fixture({ surface: "api", testReceipt: HERE });
  assert.equal(check(cwd).ok, true);
});

test("a receipt from a different tree is denied and shows both shas", () => {
  const cwd = fixture({ testReceipt: MOVED });
  const r = check(cwd, HERE);
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /bbbbbbb/);
  assert.match(r.reason ?? "", /aaaaaaa/);
});

test("compareIdentity vectors match source-identity's ordering", () => {
  const cases: [string, SourceIdentityLite, SourceIdentityLite, boolean][] = [
    ["unavailable wins over a sha difference", { ...MOVED }, NO_GIT, true],
    ["sha mismatch denies", MOVED, HERE, false],
    ["clean vs dirty denies", { ...HERE, dirty: true }, HERE, false],
    ["treeHash mismatch denies", { ...HERE, dirty: true, treeHash: "x" }, { ...HERE, dirty: true, treeHash: "y" }, false],
    ["identical allows", HERE, HERE, true],
  ];
  for (const [label, receipt, current, expected] of cases) {
    const cwd = fixture({ testReceipt: receipt });
    assert.equal(check(cwd, current).ok, expected, label);
  }
});

test("every break in the session-to-plan chain fails open", () => {
  assert.equal(check(fixture({ testReceipt: "missing", omitSession: true })).ok, true, "no session state");
  assert.equal(check(fixture({ testReceipt: "missing", slug: "" })).ok, true, "empty slug");
  assert.equal(check(fixture({ testReceipt: "missing", omitPlan: true })).ok, true, "no goalplan");
  assert.equal(check(fixture({ testReceipt: "missing", omitGate: true })).ok, true, "no finalGate");
  assert.equal(check(fixture({ testReceipt: "missing" }), HERE, PACKET, "").ok, true, "no session id");
});

test("a corrupt goalplan fails open rather than trapping the spawn", () => {
  const cwd = fixture({ testReceipt: "missing" });
  writeFileSync(join(cwd, ".codexclaw", "goalplans", SLUG, "goalplan.json"), "{not json");
  assert.equal(check(cwd).ok, true);
});

test("the hook denies through every spawn tool name", () => {
  const cwd = fixture({ testReceipt: "missing" });
  for (const toolName of [
    "spawn_agent",
    "collaborationspawn_agent",
    "collaboration.spawn_agent",
    "collaboration_spawn_agent",
  ]) {
    const out = runSpawnAttachHook(
      JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: toolName,
        session_id: SESSION,
        cwd,
        tool_input: { message: PACKET },
      }),
    );
    assert.notEqual(out, "", `${toolName} should produce an envelope`);
    const parsed = JSON.parse(out.trim()) as { hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string } };
    assert.equal(parsed.hookSpecificOutput?.permissionDecision, "deny", toolName);
    assert.match(parsed.hookSpecificOutput?.permissionDecisionReason ?? "", /final gate/);
  }
});

test("the hook stays out of the way when the prerequisites are in place", () => {
  const cwd = fixture({ testReceipt: HERE });
  const out = runSpawnAttachHook(
    JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "spawn_agent",
      session_id: SESSION,
      cwd,
      tool_input: { message: PACKET },
    }),
  );
  if (out !== "") {
    const parsed = JSON.parse(out.trim()) as { hookSpecificOutput?: { permissionDecision?: string } };
    assert.notEqual(parsed.hookSpecificOutput?.permissionDecision, "deny");
  }
});
