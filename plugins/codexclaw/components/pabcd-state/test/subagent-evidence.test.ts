/**
 * subagent-evidence.test.ts — lazygap_impl 010 SubagentStop evidence-receipt gate.
 *
 * Covers: gated-agent-type scoping, missing-receipt block (bounded), valid-receipt
 * release, symlink/outside-root rejection, context-pressure bail (child transcript),
 * and total fail-open behavior.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runSubagentStopGate,
  hasValidReceipt,
  extractReceiptPath,
  transcriptHasContextPressure,
  readAttempts,
  MAX_ATTEMPTS,
  GATED_AGENT_TYPES,
  transcriptHasReadOnlyMarker,
} from "../src/subagent-evidence.ts";
import type { SubagentStopPayload } from "../src/hook.ts";

function tmp() {
  return mkdtempSync(join(tmpdir(), "cxc-subev-"));
}

function payload(cwd: string, over: Partial<SubagentStopPayload> = {}): SubagentStopPayload {
  return {
    hook_event_name: "SubagentStop",
    session_id: "s1",
    cwd,
    agent_type: "worker",
    agent_id: "a1",
    last_assistant_message: null,
    ...over,
  };
}

function writeEvidence(cwd: string, rel: string, body = "ok"): string {
  const abs = join(cwd, ".codexclaw", "evidence", rel);
  mkdirSync(join(cwd, ".codexclaw", "evidence"), { recursive: true });
  writeFileSync(abs, body);
  return abs;
}

test("010: non-gated agent_type (explorer) is released untouched", () => {
  const cwd = tmp();
  const out = runSubagentStopGate(payload(cwd, { agent_type: "explorer" }));
  assert.equal(out, "");
});

test("010: worker with no receipt blocks (under cap) and names the receipt contract", () => {
  const cwd = tmp();
  const out = runSubagentStopGate(payload(cwd));
  const parsed = JSON.parse(out);
  assert.equal(parsed.decision, "block");
  assert.match(parsed.reason, /EVIDENCE_RECORDED/);
  assert.equal(readAttempts(cwd, "s1", "a1"), 1);
});

test("010: worker with a valid receipt is released and attempts cleared", () => {
  const cwd = tmp();
  writeEvidence(cwd, "proof.md", "ran tests: 369/369");
  // prime an attempt to prove it gets cleared on success.
  runSubagentStopGate(payload(cwd));
  const out = runSubagentStopGate(
    payload(cwd, { last_assistant_message: "done.\nEVIDENCE_RECORDED: .codexclaw/evidence/proof.md" }),
  );
  assert.equal(out, "");
  assert.equal(readAttempts(cwd, "s1", "a1"), 0);
});

test("010: receipt pointing outside the evidence root is rejected", () => {
  const cwd = tmp();
  // a real non-empty file, but OUTSIDE .codexclaw/evidence
  mkdirSync(join(cwd, "elsewhere"), { recursive: true });
  writeFileSync(join(cwd, "elsewhere", "x.md"), "data");
  const out = runSubagentStopGate(
    payload(cwd, { last_assistant_message: "EVIDENCE_RECORDED: elsewhere/x.md" }),
  );
  assert.notEqual(out, "", "outside-root receipt must NOT release");
  assert.equal(JSON.parse(out).decision, "block");
});

test("010: symlinked receipt inside the root is rejected", () => {
  const cwd = tmp();
  const target = join(cwd, "secret.md");
  writeFileSync(target, "data");
  mkdirSync(join(cwd, ".codexclaw", "evidence"), { recursive: true });
  const link = join(cwd, ".codexclaw", "evidence", "link.md");
  try {
    symlinkSync(target, link);
  } catch {
    return; // platform without symlink perms: skip
  }
  assert.equal(hasValidReceipt(cwd, ".codexclaw/evidence/link.md"), false);
});

test("010: empty receipt file is not valid", () => {
  const cwd = tmp();
  writeEvidence(cwd, "empty.md", "");
  assert.equal(hasValidReceipt(cwd, ".codexclaw/evidence/empty.md"), false);
});

test("010: block is bounded — after MAX_ATTEMPTS the gate releases", () => {
  const cwd = tmp();
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const out = runSubagentStopGate(payload(cwd));
    assert.equal(JSON.parse(out).decision, "block", `attempt ${i + 1} should block`);
  }
  // next call is over the cap -> release
  assert.equal(runSubagentStopGate(payload(cwd)), "");
});

test("010: context-pressure in the CHILD transcript bails (release)", () => {
  const cwd = tmp();
  const childTranscript = join(cwd, "child.jsonl");
  writeFileSync(childTranscript, "stuff... Context compacted ...more");
  const out = runSubagentStopGate(payload(cwd, { agent_transcript_path: childTranscript }));
  assert.equal(out, "");
});

test("010: extractReceiptPath parses the marker; null when absent", () => {
  assert.equal(extractReceiptPath("blah\nEVIDENCE_RECORDED: a/b.md"), "a/b.md");
  assert.equal(extractReceiptPath("no marker here"), null);
  assert.equal(extractReceiptPath(null), null);
});

test("010: transcriptHasContextPressure is false for missing/empty path", () => {
  assert.equal(transcriptHasContextPressure(undefined), false);
  assert.equal(transcriptHasContextPressure(""), false);
  assert.equal(transcriptHasContextPressure("/nonexistent/x.jsonl"), false);
});

// --- DISPATCH-AGENT-TYPE-01 invariant tests ---

test("DISPATCH-AGENT-TYPE-01: hook manifest matcher gates only worker agents", async () => {
  // The SubagentStop hook JSON must match only "worker" so explorer/default agents
  // never even trigger the evidence-receipt gate command. This is the first line of
  // defense; GATED_AGENT_TYPES in the runtime is the second.
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const hookPath = resolve(
    import.meta.dirname,
    "../../../hooks/subagent-stop-verifying-evidence.json",
  );
  const manifest = JSON.parse(readFileSync(hookPath, "utf8"));
  const matchers = manifest.hooks.SubagentStop.map(
    (entry: { matcher?: string }) => entry.matcher,
  );
  // Exactly one entry with the ^worker$ matcher.
  assert.deepEqual(matchers, ["^worker$"]);
});

test("DISPATCH-AGENT-TYPE-01: GATED_AGENT_TYPES contains only worker", () => {
  // Runtime defense-in-depth: even if the hook matcher is changed, only worker
  // agents are evidence-gated. Adding a new gated type requires deliberate change.
  assert.deepEqual([...GATED_AGENT_TYPES].sort(), ["worker"]);
});

test("DISPATCH-AGENT-TYPE-01: default agent_type is not gated", () => {
  const cwd = tmp();
  const out = runSubagentStopGate(payload(cwd, { agent_type: "default" }));
  assert.equal(out, "");
});

test("DISPATCH-AGENT-TYPE-01: worker with read-only marker in transcript is released", () => {
  const cwd = tmp();
  // Write a fake child transcript with a read-only marker in the first 4KB.
  const transcriptDir = join(cwd, ".codex", "sessions");
  mkdirSync(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, "child.jsonl");
  writeFileSync(transcriptPath, '[REVIEWER — read-only, 파일 작성 금지] review the plan\n');
  const out = runSubagentStopGate(
    payload(cwd, { agent_transcript_path: transcriptPath }),
  );
  assert.equal(out, "", "read-only marker should bypass evidence gate");
});

test("DISPATCH-AGENT-TYPE-01: worker with chat-only deliverable marker is released", () => {
  const cwd = tmp();
  const transcriptDir = join(cwd, ".codex", "sessions");
  mkdirSync(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, "child.jsonl");
  writeFileSync(transcriptPath, 'TASK: analyze alternatives. chat-only deliverable, no evidence files.\n');
  const out = runSubagentStopGate(
    payload(cwd, { agent_transcript_path: transcriptPath }),
  );
  assert.equal(out, "", "chat-only deliverable marker should bypass evidence gate");
});

test("DISPATCH-AGENT-TYPE-01: worker without read-only marker still blocks", () => {
  const cwd = tmp();
  const transcriptDir = join(cwd, ".codex", "sessions");
  mkdirSync(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, "child.jsonl");
  writeFileSync(transcriptPath, 'TASK: implement the fix and write tests.\n');
  const out = runSubagentStopGate(
    payload(cwd, { agent_transcript_path: transcriptPath }),
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.decision, "block", "write task should still be gated");
});
