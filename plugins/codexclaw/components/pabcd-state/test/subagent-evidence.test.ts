/**
 * subagent-evidence.test.ts — lazygap_impl 010 SubagentStop evidence-receipt gate.
 *
 * Covers: gated-agent-type scoping, missing-receipt fail-closed escalation,
 * valid-receipt release, symlink/outside-root rejection, and transcript spoofing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, existsSync, chmodSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supportsSymlinks, symlinkDirSync } from "../test-support/symlink-support.ts";

import {
  runSubagentStopGate,
  hasValidReceipt,
  extractReceiptPath,
  transcriptHasContextPressure,
  readAttempts,
  MAX_ATTEMPTS,
  GATED_AGENT_TYPES,
} from "../src/subagent-evidence.ts";
import type { SubagentStopPayload } from "../src/hook.ts";
import { readState, writeState, defaultState } from "../src/state.ts";
import { applyGoalCompleteGuard } from "../src/goal-gate.ts";

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

test("010: symlinked receipt inside the root is rejected", (t) => {
  // The link target is a receipt FILE, which a directory junction cannot express.
  if (!supportsSymlinks().file) {
    t.skip("file symlinks unavailable on this host: leaf-symlink receipt refusal not exercised");
    return;
  }
  const cwd = tmp();
  const target = join(cwd, "secret.md");
  writeFileSync(target, "data");
  mkdirSync(join(cwd, ".codexclaw", "evidence"), { recursive: true });
  const link = join(cwd, ".codexclaw", "evidence", "link.md");
  symlinkSync(target, link);
  assert.equal(hasValidReceipt(cwd, ".codexclaw/evidence/link.md"), false);
});

test("010: receipt reached through a linked directory inside the root is rejected", (t) => {
  // The realpath half of the same guard, reachable through a directory link.
  // Junctions need no elevation, so this runs on a stock Windows checkout.
  if (!supportsSymlinks().dir) {
    t.skip("directory links unavailable on this host: linked-directory receipt escape not exercised");
    return;
  }
  const cwd = tmp();
  const outside = mkdtempSync(join(tmpdir(), "cxc-subev-outside-"));
  writeFileSync(join(outside, "secret.md"), "data");
  mkdirSync(join(cwd, ".codexclaw", "evidence"), { recursive: true });
  symlinkDirSync(outside, join(cwd, ".codexclaw", "evidence", "linked"));
  // Lexically inside the evidence root; the realpath lands outside it.
  assert.equal(hasValidReceipt(cwd, ".codexclaw/evidence/linked/secret.md"), false);
});

test("010: empty receipt file is not valid", () => {
  const cwd = tmp();
  writeEvidence(cwd, "empty.md", "");
  assert.equal(hasValidReceipt(cwd, ".codexclaw/evidence/empty.md"), false);
});

/**
 * EVIDENCE-TERMINAL-01. The old contract blocked forever past the cap, which trapped
 * exactly the population it could not help: a read-only child cannot create a file
 * under the parent's .codexclaw/evidence/, so it could never satisfy the demand and
 * never stopped being asked (a real transcript shows 15+ identical blocks).
 *
 * This test DISAGREES with both the shipped behavior (blocks at 4,5,6) and with the
 * first rejected design that cleared attempts at the cap (blocks at 5,6).
 */
test("010: blocks exactly MAX_ATTEMPTS times, then releases terminally and stays released", () => {
  const cwd = tmp();
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const out = runSubagentStopGate(payload(cwd));
    assert.equal(JSON.parse(out).decision, "block", `attempt ${i + 1} should block`);
  }
  assert.equal(runSubagentStopGate(payload(cwd)), "", "cap+1 must release");
  assert.equal(runSubagentStopGate(payload(cwd)), "", "cap+2 must stay released");
  assert.equal(runSubagentStopGate(payload(cwd)), "", "cap+3 must stay released");
});

test("010: terminal release records an unresolved tombstone for the parent", () => {
  const cwd = tmp();
  for (let i = 0; i <= MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd));
  const state = readState(cwd, "s1");
  assert.equal(state.unverifiedSubagents.length, 1);
  const entry = state.unverifiedSubagents[0];
  assert.equal(entry.agentId, "a1");
  assert.equal(entry.agentType, "worker");
  assert.equal(entry.resolvable, true);
});

test("010: the tombstone never persists the child's prose", () => {
  const cwd = tmp();
  const secret = "AKIA-not-a-real-key-but-treat-it-as-one";
  for (let i = 0; i <= MAX_ATTEMPTS; i++) {
    runSubagentStopGate(payload(cwd, { last_assistant_message: `done ${secret}` }));
  }
  const raw = JSON.stringify(readState(cwd, "s1"));
  assert.ok(!raw.includes(secret), "child message text must not reach durable state");
});

test("010: repeated terminal stops do not duplicate the tombstone", () => {
  const cwd = tmp();
  for (let i = 0; i < MAX_ATTEMPTS + 4; i++) runSubagentStopGate(payload(cwd));
  assert.equal(readState(cwd, "s1").unverifiedSubagents.length, 1);
});

test("010: a payload with no agent id records a NON-resolvable tombstone", () => {
  const cwd = tmp();
  for (let i = 0; i <= MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd, { agent_id: undefined }));
  const entries = readState(cwd, "s1").unverifiedSubagents;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].resolvable, false, "missing ids collide, so they must not be clearable by id");
});

test("010: a late valid receipt resolves the tombstone so the parent is not stuck", () => {
  const cwd = tmp();
  for (let i = 0; i <= MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd));
  assert.equal(readState(cwd, "s1").unverifiedSubagents.length, 1);
  writeEvidence(cwd, "late.md", "the real check output");
  const out = runSubagentStopGate(
    payload(cwd, { last_assistant_message: "EVIDENCE_RECORDED: .codexclaw/evidence/late.md" }),
  );
  assert.equal(out, "");
  assert.equal(readState(cwd, "s1").unverifiedSubagents.length, 0);
});

test("010: an unresolved tombstone DENIES goal completion (the verdict is not waived)", () => {
  const cwd = tmp();
  for (let i = 0; i <= MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd));
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "completion must be denied while evidence is unverified");
  assert.match(deny, /exhausted evidence verification/);
});

test("010: status blocked stays allowed — the honest escape hatch survives", () => {
  const cwd = tmp();
  for (let i = 0; i <= MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd));
  const out = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "blocked" },
  });
  assert.equal(out, "");
});

test("010: a corrupt verification record denies completion instead of reading as empty", () => {
  const cwd = tmp();
  const base = defaultState("s1");
  writeState(cwd, { ...base, unverifiedSubagents: "not-an-array" as never });
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "corrupt verdict data must not launder into 'all resolved'");
  assert.match(deny, /unreadable or overflowed/);
});

test("010: an old state file without the field is clean, not corrupt", () => {
  const cwd = tmp();
  const base = defaultState("s1") as Record<string, unknown>;
  delete base.unverifiedSubagents;
  delete base.unverifiedCorrupt;
  writeState(cwd, base as never);
  const state = readState(cwd, "s1");
  assert.deepEqual(state.unverifiedSubagents, []);
  assert.equal(state.unverifiedCorrupt, false);
});

/**
 * writeState publishes atomically but is a read-modify-write. Two subagents stopping
 * at the same moment each read the same list, add only their own entry, and the second
 * write would erase the first verdict. Losing a security verdict to a race is not
 * acceptable, so recordTombstone runs its whole transaction under the session lock and
 * re-reads inside it. This test drives two REAL concurrent processes.
 */
test("010: concurrent terminal stops do not lose a tombstone", async () => {
  const cwd = tmp();
  const here = new URL(".", import.meta.url).pathname;
  const src = join(here, "..", "src", "subagent-evidence.ts");
  // Pre-spend each agent's budget so both processes land on the terminal branch.
  for (const agent of ["racer-a", "racer-b"]) {
    for (let i = 0; i < MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd, { agent_id: agent }));
  }
  const runner = (agent: string) =>
    `import{runSubagentStopGate}from${JSON.stringify(src)};runSubagentStopGate({hook_event_name:"SubagentStop",session_id:"s1",cwd:${JSON.stringify(cwd)},agent_type:"worker",agent_id:${JSON.stringify(agent)},last_assistant_message:null});`;
  const { spawn } = await import("node:child_process");
  const go = (agent: string) =>
    new Promise<void>((done) => {
      const p = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", runner(agent)], {
        stdio: "ignore",
      });
      p.on("exit", () => done());
    });
  await Promise.all([go("racer-a"), go("racer-b")]);
  const ids = readState(cwd, "s1").unverifiedSubagents.map((e) => e.agentId).sort();
  assert.deepEqual(ids, ["racer-a", "racer-b"], "both verdicts must survive the race");
});

/**
 * Implementation-review BLOCKER/MAJORs. A persisted negative counter sits below the
 * cap, so the old predicate would increment by one and block — quadrillions of blocks
 * before termination, which is an infinite loop with extra steps.
 */
test("010: a corrupt attempt counter terminates instead of extending the budget", () => {
  for (const bad of [-9007199254740991, -1, 2.5, 999999, "three"]) {
    const cwd = tmp();
    // Reach the real (digest-bearing) counter path by spending one attempt first,
    // then corrupting whatever file the implementation actually wrote.
    runSubagentStopGate(payload(cwd));
    const dir = join(cwd, ".codexclaw", "evidence-attempts");
    const name = readdirSync(dir).find((n) => n.endsWith(".json"));
    assert.ok(name, "the gate must have written a counter");
    writeFileSync(join(dir, name), JSON.stringify({ attempts: bad }));
    assert.equal(runSubagentStopGate(payload(cwd)), "", `attempts=${String(bad)} must terminate, not block`);
  }
});

test("010: unreadable session state DENIES completion (cannot rule out a failure)", () => {
  const cwd = tmp();
  const dir = join(cwd, ".codexclaw", "sessions");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "s1.json"), "{ this is not json");
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "unreadable state must not read as a clean bill of health");
  assert.match(deny, /unreadable/);
});

test("010: a session that never delegated anything still completes normally", () => {
  const cwd = tmp();
  const out = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s-never-used",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.equal(out, "", "an ABSENT state file is not 'unreadable' — no false denial");
});

/**
 * There is no stale-lock breaker: pathname-based recovery is TOCTOU-racy and two
 * processes that both judge a lock stale can enter concurrently and lose a verdict.
 * A held lock must make acquisition EXHAUST (the caller then takes its deny-only
 * path) rather than be taken over.
 */
test("010: a held lock is never broken — acquisition exhausts instead", async () => {
  const { withSessionLock } = await import("../src/state.ts");
  const cwd = tmp();
  mkdirSync(join(cwd, ".codexclaw", "sessions"), { recursive: true });
  const lockPath = join(cwd, ".codexclaw", "sessions", "s1.json.lock");
  writeFileSync(lockPath, "12345");
  assert.throws(() => withSessionLock(cwd, "s1", () => "entered"), "must not enter a held lock");
  assert.equal(existsSync(lockPath), true, "the other holder's lock must survive");
});

test("010: a lock is released after a successful critical section", async () => {
  const { withSessionLock } = await import("../src/state.ts");
  const cwd = tmp();
  const lockPath = join(cwd, ".codexclaw", "sessions", "s1.json.lock");
  assert.equal(withSessionLock(cwd, "s1", () => "ok"), "ok");
  assert.equal(existsSync(lockPath), false, "the lock must not leak");
});

/**
 * Implementation-review r2 BLOCKER: existsSync() collapses ENOTDIR/EACCES into
 * "false", which reported a real storage failure as "this session never delegated"
 * and allowed completion.
 */
test("010: a storage error (ENOTDIR) denies completion, unlike a genuine absence", () => {
  const cwd = tmp();
  // Make `.codexclaw/sessions` a FILE so the session path lookup fails with ENOTDIR.
  mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
  writeFileSync(join(cwd, ".codexclaw", "sessions"), "not a directory");
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "a storage error must not read as a clean absence");
});

test("010: an unrecordable verdict marker denies completion", async () => {
  const { writeUnrecordableMarker } = await import("../src/subagent-evidence.ts");
  const cwd = tmp();
  writeUnrecordableMarker(cwd, "s1", "a1");
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "a verdict that could not be persisted must still deny");
  assert.match(deny, /could not be confirmed/);
});

test("010: an UNREADABLE marker directory also denies (not read as absent)", () => {
  const cwd = tmp();
  // Make the marker directory a FILE so readdir fails with ENOTDIR.
  mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
  writeFileSync(join(cwd, ".codexclaw", "evidence-unrecordable"), "not a directory");
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "an unreadable marker dir must not be indistinguishable from absence");
});

test("020: one receipt cannot clear every turn an agent failed", async () => {
  const { runEvidenceCli } = await import("../src/evidence-cli.ts");
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  // Same agent, two DIFFERENT turns both unverified.
  for (const turn of ["t1", "t2"]) {
    for (let i = 0; i <= MAX_ATTEMPTS; i++) {
      runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a1", turn_id: turn }));
    }
  }
  assert.equal(readState(cwd, sid).unverifiedSubagents.length, 2);
  const receipt = ".codexclaw/evidence/one.md";
  writeEvidence(cwd, "one.md", "verified turn 1 only");
  const ambiguous = runEvidenceCli({ verb: "resolve", sessionId: sid, agentId: "a1", receipt, cwd });
  assert.equal(ambiguous.code, 1, "an agent-wide resolve must refuse when several turns are unverified");
  assert.match(ambiguous.output, /--turn/);
  const exact = runEvidenceCli({ verb: "resolve", sessionId: sid, agentId: "a1", turnId: "t1", receipt, cwd });
  assert.equal(exact.code, 0);
  const left = readState(cwd, sid).unverifiedSubagents;
  assert.equal(left.length, 1, "the unverified turn must survive");
  assert.equal(left[0].turnId, "t2");
});

/**
 * Round-4 silent-allow paths.
 *
 * (a) A marker directory that is READABLE but UNWRITABLE: marker creation fails, and
 *     the later lookup sees an empty, perfectly readable directory and reports
 *     "no verdict".
 * (b) recordTombstone reading through non-strict readState: corrupt bytes rebuild as a
 *     clean default, so committing over them erases a tombstone that was already there.
 */
test("010: a readable-but-unwritable marker directory denies completion", (t) => {
  const cwd = tmp();
  const dir = join(cwd, ".codexclaw", "evidence-unrecordable");
  mkdirSync(dir, { recursive: true });
  try {
    chmodSync(dir, 0o500); // r-x: listable, not writable
  } catch {
    t.skip("cannot drop write permission on this platform");
    return;
  }
  if (process.getuid?.() === 0) {
    t.skip("running as root: permissions are not enforced");
    return;
  }
  try {
    const deny = applyGoalCompleteGuard({
      hook_event_name: "PreToolUse",
      session_id: "s1",
      cwd,
      tool_name: "update_goal",
      tool_input: { status: "complete" },
    });
    assert.notEqual(deny, "", "an unwritable marker dir cannot be trusted to be empty");
  } finally {
    chmodSync(dir, 0o700);
  }
});

test("010: a tombstone is never committed over unreadable state", () => {
  const cwd = tmp();
  const dir = join(cwd, ".codexclaw", "sessions");
  mkdirSync(dir, { recursive: true });
  // Spend the budget first, so the NEXT stop takes the terminal branch.
  for (let i = 0; i < MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd));
  // Then corrupt the state: readState would rebuild these bytes as a CLEAN default,
  // so a non-strict commit would rewrite the file as if no verdict had ever existed.
  writeFileSync(join(dir, "s1.json"), "{ corrupt");
  // The child is still released (liveness) ...
  assert.equal(runSubagentStopGate(payload(cwd)), "");
  // ... and completion is still denied, so nothing was laundered.
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "corrupt state must not be rewritten clean");
});

/**
 * Round-6 blocker: a TRANSIENT failure at terminal time followed by filesystem
 * RECOVERY. Every completion-time probe then looks healthy — state readable, marker
 * dir absent and writable — so the historical verdict would be lost.
 *
 * The spent retry counter closes it: it is written during normal operation (calls
 * 1..3), is cleared only by a valid receipt, and therefore outlives the outage.
 */
test("010: a verdict survives a transient failure followed by recovery", () => {
  const cwd = tmp();
  // Calls 1..3 spend the budget while everything is healthy.
  for (let i = 0; i < MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd));
  // The terminal stop happens, but its durable records are then WIPED, simulating a
  // failure at terminal time; afterwards the filesystem is perfectly healthy again.
  runSubagentStopGate(payload(cwd));
  rmSync(join(cwd, ".codexclaw", "sessions"), { recursive: true, force: true });
  rmSync(join(cwd, ".codexclaw", "evidence-unrecordable"), { recursive: true, force: true });
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: "s1",
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "a spent budget must outlive the loss of every other record");
  assert.match(deny, /exhausted/);
});

test("010: resolving with a receipt clears the spent budget too", async () => {
  const { runEvidenceCli } = await import("../src/evidence-cli.ts");
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  for (let i = 0; i <= MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd, { session_id: sid }));
  writeEvidence(cwd, "done.md", "the real check output");
  const res = runEvidenceCli({
    verb: "resolve",
    sessionId: sid,
    agentId: "a1",
    receipt: ".codexclaw/evidence/done.md",
    cwd,
  });
  assert.equal(res.code, 0, res.output);
  const out = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: sid,
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.equal(out, "", "a resolved agent must not keep denying completion forever");
});

/**
 * Round-7 blocker: attempts were keyed per AGENT while verdicts are per
 * (agentId, turnId), so resolving one turn cleared the fallback signal for another.
 */
test("010: resolving one turn leaves another turn's spent budget intact", async () => {
  const { runEvidenceCli } = await import("../src/evidence-cli.ts");
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  for (const turn of ["t1", "t2"]) {
    for (let i = 0; i <= MAX_ATTEMPTS; i++) {
      runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a1", turn_id: turn }));
    }
  }
  writeEvidence(cwd, "t1.md", "verified turn 1 only");
  const res = runEvidenceCli({
    verb: "resolve",
    sessionId: sid,
    agentId: "a1",
    turnId: "t1",
    receipt: ".codexclaw/evidence/t1.md",
    cwd,
  });
  assert.equal(res.code, 0, res.output);
  // Wipe the tombstone list so ONLY the fallback counter signal can deny.
  rmSync(join(cwd, ".codexclaw", "sessions"), { recursive: true, force: true });
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: sid,
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "turn t2 was never verified: its budget signal must survive");
});

/**
 * Round-8 blocker: delimiter-joined tuple keys are ambiguous. sanitizeKey maps unsafe
 * runs to "-", so ("a-b","c") and ("a","b-c") collided into one filename and a receipt
 * for one agent/turn deleted the other's spent counter.
 */
test("010: (agent,turn) keys that differ cannot collide into one counter", () => {
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  // Spend the budget for ("a-b", "c") only.
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a-b", turn_id: "c" }));
  }
  // A DIFFERENT identity must still have a fresh budget: it must BLOCK, not release.
  const out = runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a", turn_id: "b-c" }));
  assert.equal(JSON.parse(out).decision, "block");
  assert.match(JSON.parse(out).reason, /attempt 1 of/, "a colliding key would have inherited a spent budget");
});

/**
 * A turn-scoped resolution must NOT delete the legacy agent-only counter: that file is
 * shared by every turn-less stop of the agent, so clearing it while resolving one turn
 * could erase the live verdict of an absent-turn worker.
 */
test("010: resolving a turn does not erase a live absent-turn verdict", async () => {
  const { runEvidenceCli } = await import("../src/evidence-cli.ts");
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  // A turn-LESS worker exhausts its budget (legacy/agent-only key).
  for (let i = 0; i <= MAX_ATTEMPTS; i++) runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a1" }));
  // A turn-SCOPED worker of the same agent also fails, and is then resolved.
  for (let i = 0; i <= MAX_ATTEMPTS; i++) {
    runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a1", turn_id: "t1" }));
  }
  writeEvidence(cwd, "ok.md", "verified turn t1");
  const res = runEvidenceCli({
    verb: "resolve",
    sessionId: sid,
    agentId: "a1",
    turnId: "t1",
    receipt: ".codexclaw/evidence/ok.md",
    cwd,
  });
  assert.equal(res.code, 0, res.output);
  // Wipe the tombstone list so ONLY the counter signal can speak.
  rmSync(join(cwd, ".codexclaw", "sessions"), { recursive: true, force: true });
  const deny = applyGoalCompleteGuard({
    hook_event_name: "PreToolUse",
    session_id: sid,
    cwd,
    tool_name: "update_goal",
    tool_input: { status: "complete" },
  });
  assert.notEqual(deny, "", "the turn-less worker was never verified: its counter must survive");
});

test("010: sanitize-collapsing identities still get distinct counters", () => {
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  // sanitizeKey maps "/" and "-" to the same character, so these two pairs collapse
  // to identical sanitized strings and would share a file without a raw-value digest.
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a", turn_id: "b/c" }));
  }
  const out = runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a", turn_id: "b-c" }));
  assert.equal(JSON.parse(out).decision, "block");
  assert.match(JSON.parse(out).reason, /attempt 1 of/, "a collapsed key would have inherited a spent budget");
});

test("010: sanitize-collapsing AGENT ids get distinct counters with no turn", () => {
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a/b" }));
  }
  const out = runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "a-b" }));
  assert.equal(JSON.parse(out).decision, "block");
  assert.match(JSON.parse(out).reason, /attempt 1 of/, "absent-turn keys must not collide either");
});

test("010: lone-surrogate identities do not collapse into one counter", () => {
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  // UTF-8 encoding replaces both lone surrogates with U+FFFD, so a byte-hash would
  // give these two distinct agents the same counter file.
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "\uD800" }));
  }
  const out = runSubagentStopGate(payload(cwd, { session_id: sid, agent_id: "\uD801" }));
  assert.equal(JSON.parse(out).decision, "block");
  assert.match(JSON.parse(out).reason, /attempt 1 of/);
});

test("020: evidence resolve REQUIRES a receipt and has no override bypass", async () => {
  const { parseEvidenceCliArgs } = await import("../src/evidence-cli.ts");
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  const bare = parseEvidenceCliArgs(["resolve", "--session", sid, "--agent", "a1"], cwd);
  assert.ok("error" in bare, "a bare resolve must be refused");
  // The override flag was removed: it is not a recognised escape hatch.
  const overridden = parseEvidenceCliArgs(
    ["resolve", "--session", sid, "--agent", "a1", "--override", "--reason", "trust me"],
    cwd,
  );
  assert.ok("error" in overridden, "an agent must not be able to erase its own verdict");
});

test("020: evidence resolve refuses a receipt that fails the evidence-root guard", async () => {
  const { runEvidenceCli } = await import("../src/evidence-cli.ts");
  const cwd = tmp();
  const sid = "01a03c05-2d04-7b62-8c1f-42b155abfc89";
  const outside = join(cwd, "outside.md");
  writeFileSync(outside, "looks like evidence");
  const res = runEvidenceCli({ verb: "resolve", sessionId: sid, agentId: "a1", receipt: outside, cwd });
  assert.equal(res.code, 1);
  assert.match(res.output, /evidence-root guard/);
});

test("010: child-authored context-pressure text cannot bypass evidence", () => {
  const cwd = tmp();
  const childTranscript = join(cwd, "child.jsonl");
  writeFileSync(childTranscript, "stuff... Context compacted ...more");
  const out = runSubagentStopGate(payload(cwd, { agent_transcript_path: childTranscript }));
  assert.equal(JSON.parse(out).decision, "block");
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

test("DISPATCH-AGENT-TYPE-01: worker cannot exempt itself with transcript text", () => {
  const cwd = tmp();
  const transcriptDir = join(cwd, ".codex", "sessions");
  mkdirSync(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, "child.jsonl");
  writeFileSync(transcriptPath, '[CXC-EVIDENCE-EXEMPT] [REVIEWER] review the plan\n');
  const out = runSubagentStopGate(
    payload(cwd, { agent_transcript_path: transcriptPath }),
  );
  assert.equal(JSON.parse(out).decision, "block");
});

test("DISPATCH-AGENT-TYPE-01: marker deep in transcript still cannot bypass", () => {
  const cwd = tmp();
  const transcriptDir = join(cwd, ".codex", "sessions");
  mkdirSync(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, "child.jsonl");
  // Simulate token buried after 30KB of system prompt
  const padding = "x".repeat(30000);
  writeFileSync(transcriptPath, padding + '\n[CXC-EVIDENCE-EXEMPT] task\n');
  const out = runSubagentStopGate(
    payload(cwd, { agent_transcript_path: transcriptPath }),
  );
  assert.equal(JSON.parse(out).decision, "block");
});

test("DISPATCH-AGENT-TYPE-01: generic read-only text without token still blocks", () => {
  const cwd = tmp();
  const transcriptDir = join(cwd, ".codex", "sessions");
  mkdirSync(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, "child.jsonl");
  writeFileSync(transcriptPath, '[REVIEWER read-only] review the plan\n');
  const out = runSubagentStopGate(
    payload(cwd, { agent_transcript_path: transcriptPath }),
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.decision, "block", "generic read-only without token should still block");
});

test("DISPATCH-AGENT-TYPE-01: worker without token still blocks", () => {
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
