import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AUTOMATION_UPDATE_TOOL_NAMES, evaluateAutomationMutation, handleAutomationOwnershipGate } from "../src/automation-ownership-gate.ts";

const OWNER = "019f9d73-4c28-7723-ab52-346aca1d9bcb";
const OTHER = "019f9d73-4c28-7723-ab52-346aca1d9bcc";
const ID = "heartbeat-one";
function ptu(input: unknown = { mode: "delete", id: ID }, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ hook_event_name: "PreToolUse", session_id: OWNER,
    tool_name: "mcp__codex_app__automation_update", tool_input: input, ...extra });
}
function store(owner = OWNER): string {
  return `version = 1\nid = "${ID}"\nkind = "heartbeat"\nname = "Example"\nprompt = "A prompt"\nrrule = "FREQ=HOURLY"\nstatus = "ACTIVE"\ntarget_thread_id = "${owner}"\ncreated_at = 123\nupdated_at = 456\n`;
}
function fixture(t: TestContext, content = store()) {
  const root = mkdtempSync(join(tmpdir(), "cxc-automation-gate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home"), dir = join(home, "automations", ID), file = join(dir, "automation.toml");
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, content);
  return { root, home, dir, file, deps: { env: { CODEX_HOME: home } } };
}
function denied(result: string): void {
  const parsed = JSON.parse(result);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /^AUTOMATION-OWNERSHIP-01:/);
}

test("own heartbeat update, suggested update and delete pass without changing store", (t) => {
  const f = fixture(t);
  for (const mode of ["update", "suggested_update", "delete"]) {
    assert.equal(handleAutomationOwnershipGate(ptu({ mode, id: ID }), f.deps), "");
  }
  assert.equal(readFileSync(f.file, "utf8"), store());
});

test("exact matcher aliases agree and unrelated names remain unaffected", (t) => {
  const f = fixture(t, store(OTHER));
  const names = ["automation_update", "mcp__codex_app__automation_update", "mcp__codex_app.automation_update",
    "mcp__codex_app_automation_update", "codex_app.automation_update", "codex_app_automation_update"];
  assert.deepEqual([...AUTOMATION_UPDATE_TOOL_NAMES].sort(), names.sort());
  for (const tool_name of names) denied(handleAutomationOwnershipGate(ptu(undefined, { tool_name }), f.deps));
  for (const tool_name of ["exec_command", "mcp__other__automation_update", "prefixautomation_update", "mcp__codex_appautomation_update"]) {
    assert.equal(handleAutomationOwnershipGate(ptu(undefined, { tool_name }), f.deps), "");
  }
});

test("foreign ownership denies regardless of caller-supplied target or owner assertions", (t) => {
  const f = fixture(t, store(OTHER));
  for (const extra of [{}, { targetThreadId: OWNER }, { ownerThreadId: OWNER }]) {
    denied(handleAutomationOwnershipGate(ptu({ mode: "delete", id: ID, ...extra }), f.deps));
  }
});

test("child identity never inherits root association and invalid native identity denies", (t) => {
  const f = fixture(t);
  for (const extra of [{ agent_id: "child" }, { agent_type: "executor" }, { agent_id: OWNER },
    { agent_id: 1 }, { agent_type: {} }, { session_id: "" }, { session_id: null }, { session_id: "../owner" }]) {
    denied(handleAutomationOwnershipGate(ptu(undefined, extra), f.deps));
  }
  assert.equal(handleAutomationOwnershipGate(ptu(undefined, { agent_id: null, agent_type: "" }), f.deps), "");
});

test("views and unrelated tools do not access even a throwing store configuration", () => {
  const deps = { get env(): NodeJS.ProcessEnv { throw new Error("store should not be consulted"); } };
  assert.equal(handleAutomationOwnershipGate(ptu({ mode: "view", id: "../anything" }, { agent_id: "child" }), deps), "");
  assert.equal(handleAutomationOwnershipGate(ptu(null, { tool_name: "unrelated" }), deps), "");
});

test("heartbeat creates accept only implicit or explicit native caller and no existing id", (t) => {
  const f = fixture(t);
  for (const mode of ["create", "suggested_create"]) {
    for (const target of [{}, { targetThreadId: OWNER }]) {
      assert.equal(handleAutomationOwnershipGate(ptu({ mode, kind: "heartbeat", ...target }), f.deps), "");
    }
    for (const extra of [{ targetThreadId: OTHER }, { targetThreadId: null }, { id: ID }, { id: null }, { kind: "cron" }]) {
      denied(handleAutomationOwnershipGate(ptu({ mode, kind: "heartbeat", ...extra }), f.deps));
    }
    denied(handleAutomationOwnershipGate(ptu({ mode, kind: "heartbeat" }, { agent_id: "child" }), f.deps));
    denied(handleAutomationOwnershipGate(ptu({ mode }), f.deps));
  }
});

test("retargets, unsupported modes, unknown fields, kinds and destinations deny", (t) => {
  const f = fixture(t);
  for (const extra of [{ targetThreadId: OTHER }, { target_thread_id: OWNER }, { targetThreadId: null },
    { mode: "new-mode" }, { mode: "" }, { mode: null }, { kind: "cron" }, { kind: "unknown" },
    { destination: "remote" }, { owner: OWNER }]) {
    denied(handleAutomationOwnershipGate(ptu({ mode: "update", id: ID, ...extra }), f.deps));
  }
  assert.equal(handleAutomationOwnershipGate(ptu({ mode: "update", id: ID, targetThreadId: OWNER, kind: "heartbeat" }), f.deps), "");
});

test("malformed dedicated payload and mutation input deny, other hook events pass", (t) => {
  const f = fixture(t);
  for (const raw of ["", "{", "null", "[]", "{}", "x".repeat(1024 * 1024 + 1),
    ptu(null), ptu("{}"), ptu([]), ptu({}), ptu(undefined, { tool_name: null }),
    ptu(undefined, { hook_event_name: undefined })]) denied(handleAutomationOwnershipGate(raw, f.deps));
  assert.equal(handleAutomationOwnershipGate(ptu(undefined, { hook_event_name: "PostToolUse" }), f.deps), "");
});

test("missing, unsafe, encoded and ambiguous automation ids deny", (t) => {
  const f = fixture(t);
  for (const id of [undefined, null, "", "missing", "../heartbeat-one", "a/b", "a\\b", "%2e%2e", ".", "a\0b", "a".repeat(201)]) {
    denied(handleAutomationOwnershipGate(ptu({ mode: "delete", id }), f.deps));
  }
});

test("unsupported, duplicate, conflicting or missing store fields deny", (t) => {
  const f = fixture(t);
  const cases = [
    store().replace(`target_thread_id = "${OWNER}"\n`, ""),
    store().replace(`target_thread_id = "${OWNER}"`, 'target_thread_id = ""'),
    store() + `target_thread_id = "${OTHER}"\n`, store() + `target_thread_id = "${OWNER}"\n`,
    store() + 'name = "duplicate"\n', store() + '[ownership]\nowner = "bad"\n',
    store() + 'owner_thread_id = "extra"\n', store().replace('kind = "heartbeat"', 'kind = "cron"'),
    store().replace('kind = "heartbeat"', 'kind = "unknown"'), store().replace('version = 1', 'version = 2'),
    store().replace(`id = "${ID}"`, 'id = "different"'), store().replace('created_at = 123', 'created_at = [123]'),
    store().replace('created_at = 123', 'created_at = 01'), store().replace('version = 1', 'version = true'),
    store().replace(`target_thread_id = "${OWNER}"`, `target_thread_id = """${OWNER}"""`),
    store().replace('name = "Example"', '"name" = "Example"'),
    store().replace('name = "Example"', 'name = "unterminated'),
    store() + "\0", store() + "# control\0\n", store().replaceAll("\n", "\r"), 'x'.repeat(65537),
  ];
  for (const content of cases) {
    writeFileSync(f.file, content);
    denied(handleAutomationOwnershipGate(ptu(), f.deps));
  }
});

test("multiline basic and literal prompts cannot spoof an owner", (t) => {
  const f = fixture(t);
  for (const delimiter of ['"""', "'''"]) {
    const prompt = `prompt = ${delimiter}\n# not a real key\ntarget_thread_id = "${OWNER}"\n[table]\n${delimiter}`;
    const foreign = store(OTHER).replace('prompt = "A prompt"', prompt);
    writeFileSync(f.file, foreign);
    denied(handleAutomationOwnershipGate(ptu(), f.deps));
    writeFileSync(f.file, store().replace('prompt = "A prompt"', prompt));
    assert.equal(handleAutomationOwnershipGate(ptu(), f.deps), "");
    writeFileSync(f.file, foreign.replace(`target_thread_id = "${OTHER}"\n`, ""));
    denied(handleAutomationOwnershipGate(ptu(), f.deps));
  }
});

test("escaped quotes, comment text and unicode stay inside supported strings", (t) => {
  const f = fixture(t);
  const content = store().replace('prompt = "A prompt"', 'prompt = "line\\nquote\\\" # target_thread_id = fake \\uAC00" # comment')
    .replace('name = "Example"', "name = 'literal # comment'");
  writeFileSync(f.file, content.replaceAll("\n", "\r\n"));
  assert.equal(handleAutomationOwnershipGate(ptu(), f.deps), "");
  writeFileSync(f.file, store().replace('prompt = "A prompt"', 'prompt = """a\\\"""\ntarget_thread_id = "fake"\nend"""'));
  assert.equal(handleAutomationOwnershipGate(ptu(), f.deps), "");
  for (const prompt of ['prompt = """unterminated', 'prompt = "bad\\q"', 'prompt = """bad\\q"""', 'prompt = "\\uD800"']) {
    writeFileSync(f.file, store().replace('prompt = "A prompt"', prompt));
    denied(handleAutomationOwnershipGate(ptu(), f.deps));
  }
});

test("symlink files, automation directories, store root and home deny", (t) => {
  for (const surface of ["file", "dir", "automations", "home"] as const) {
    const f = fixture(t);
    const target = surface === "automations" ? join(f.home, "automations") : f[surface];
    const outside = join(f.root, "outside");
    if (surface === "file") writeFileSync(outside, store());
    else mkdirSync(outside);
    rmSync(target, { recursive: true, force: true });
    symlinkSync(outside, target, surface === "file" ? "file" : "dir");
    denied(handleAutomationOwnershipGate(ptu(), f.deps));
  }
});

test("missing files, non-regular files and invalid UTF-8 deny", (t) => {
  const f = fixture(t);
  writeFileSync(f.file, Buffer.from([0xff, 0xfe]));
  denied(handleAutomationOwnershipGate(ptu(), f.deps));
  rmSync(f.file);
  denied(handleAutomationOwnershipGate(ptu(), f.deps));
  mkdirSync(f.file);
  denied(handleAutomationOwnershipGate(ptu(), f.deps));
});

test("pure evaluator rejects conflicting snapshot ids and unknown association", () => {
  const caller = { session_id: OWNER };
  const request = { mode: "delete", id: ID };
  for (const snapshot of [undefined, { id: "other", kind: "heartbeat", targetThreadId: OWNER },
    { id: ID, kind: "cron", targetThreadId: OWNER }, { id: ID, kind: "heartbeat", targetThreadId: "" }]) {
    assert.equal(evaluateAutomationMutation(request, caller, snapshot).decision, "deny");
  }
});
