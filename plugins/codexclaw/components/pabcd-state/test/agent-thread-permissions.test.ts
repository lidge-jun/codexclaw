import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleAgentThreadPermissionRequest as permission, handleAgentThreadSessionStartAdvisory as advisory } from "../src/agent-thread-permissions.ts";

const ALLOW = '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}';
const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/cli.js");
const FULL = 'approval_policy = "never"\nsandbox_mode = "danger-full-access"\n';

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "cxc-agent-permission-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, "project");
  const codexHome = join(root, "codex");
  const clawHome = join(root, "global-claw");
  for (const dir of [cwd, codexHome, clawHome]) mkdirSync(dir);
  const transcript = join(root, "rollout.jsonl");
  const meta = { type: "session_meta", payload: { id: "fixture-id", thread_source: "agent_created_thread" } };
  writeFileSync(transcript, `${JSON.stringify(meta)}\n`);
  writeFileSync(join(codexHome, "config.toml"), FULL);
  writeFileSync(join(clawHome, "config.json"), '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  const env: NodeJS.ProcessEnv = { CODEX_HOME: codexHome, CODEXCLAW_HOME: clawHome };
  const input = { hook_event_name: "PermissionRequest", cwd, session_id: "fixture-id", transcript_path: transcript, permission_mode: "default", tool_name: "Bash" };
  const send = (change: Record<string, unknown> = {}, e: NodeJS.ProcessEnv = env) => permission(JSON.stringify({ ...input, ...change }), e);
  const advise = (change: Record<string, unknown> = {}, e: NodeJS.ProcessEnv = env) => advisory(JSON.stringify({ ...input, hook_event_name: "SessionStart", ...change }), e);
  return { root, cwd, codexHome, clawHome, transcript, meta, env, input, send, advise };
}

function cli(verb: string, input: unknown, cwd: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [CLI, "hook", verb], {
    cwd, env: { ...process.env, ...env }, input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8",
  });
}

test("allows opted-in agent-created root thread for covered tools", (t) => {
  const f = fixture(t);
  for (const tool_name of ["Bash", "write_stdin", "apply_patch", "mcp__codex_app__create_worktree", "mcp__codex_app__create_thread"]) {
    assert.equal(f.send({ tool_name }), ALLOW, tool_name);
  }
  assert.equal(f.send({ tool_name: "Bash", tool_input: { description: "network-access example.com" } }), ALLOW);
});


test("overflowing numbers fail closed", (t) => {
  const f = fixture(t);
  for (const tail of ["foo = 1e9999", "foo = -1e400", "foo = 9223372036854775808", "foo = 0x8000000000000000", "foo = -9223372036854775809"]) {
    writeFileSync(join(f.codexHome, "config.toml"), FULL + tail + "\n");
    assert.equal(f.send(), "", tail);
  }
  writeFileSync(join(f.codexHome, "config.toml"), FULL + "foo = 1e300\nbar = 9007199254740993\nbaz = 9223372036854775807\nqux = -9223372036854775808\nhex = 0x7fff_ffff_ffff_ffff\n");
  assert.equal(f.send(), ALLOW);
});



test("symlinked default directories into the home-cwd project cannot grant permission", (t) => {
  const f = fixture(t);
  const env = { CODEX_HOME: "", CODEXCLAW_HOME: "", HOME: f.root, USERPROFILE: f.root };
  // Real project directories under the home, reached through symlinked defaults.
  const projectCodex = join(f.cwd, ".codex");
  const projectClaw = join(f.cwd, ".codexclaw");
  mkdirSync(projectCodex);
  mkdirSync(projectClaw);
  writeFileSync(join(projectCodex, "config.toml"), FULL);
  writeFileSync(join(projectClaw, "config.json"), '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  const codexDir = join(f.root, ".codex");
  const clawDir = join(f.root, ".codexclaw");
  mkdirSync(clawDir);
  writeFileSync(join(clawDir, "config.json"), '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  symlinkSync(projectCodex, codexDir);
  assert.equal(cli("permission-request", { ...f.input, cwd: f.root }, f.root, env).stdout, "", "symlinked ~/.codex");
  rmSync(codexDir);
  mkdirSync(codexDir);
  writeFileSync(join(codexDir, "config.toml"), FULL);
  rmSync(clawDir, { recursive: true, force: true });
  symlinkSync(projectClaw, clawDir);
  assert.equal(cli("permission-request", { ...f.input, cwd: f.root }, f.root, env).stdout, "", "symlinked ~/.codexclaw");
});

test("invalid dates, times and multi-line inline tables fail closed", (t) => {
  const f = fixture(t);
  for (const tail of [
    "foo = 2026-13-42", "foo = 25:99:99", "foo = [2026-99-99]", "foo = 2026-02-30",
    "foo = 2026-01-01T10:00:00+24:00", "foo = { a = 1,\n  b = 2 }",
  ]) {
    writeFileSync(join(f.codexHome, "config.toml"), FULL + tail + "\n");
    assert.equal(f.send(), "", tail);
    assert.equal(f.advise(), "", tail);
  }
  for (const tail of ["foo = 2024-02-29", "foo = 1979-05-27T07:32:00Z", "foo = 07:32:00", "foo = { a = 1, b = \"x\" }"]) {
    writeFileSync(join(f.codexHome, "config.toml"), FULL + tail + "\n");
    assert.equal(f.send(), ALLOW, tail);
  }
});


test("network-access approval is allowed with opt-in", (t) => {
  const f = fixture(t);
  assert.equal(f.send({ tool_input: { description: "network-access example.com" } }), ALLOW);
});

test("network-access approval gets no decision without opt-in", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.clawHome, "config.json"), "{}");
  assert.equal(f.send({ tool_input: { description: "network-access example.com" } }), "");
});

test("default-off global setting leaves approval to Codex", (t) => {
  const f = fixture(t);
  const path = join(f.clawHome, "config.json");
  for (const value of [null, "{}", "{", '{"permissions":[]}', '{"permissions":{"agentCreatedThreadAutoAllow":false}}', '{"permissions":{"agentCreatedThreadAutoAllow":"true"}}']) {
    if (value === null) rmSync(path, { force: true }); else writeFileSync(path, value);
    assert.equal(f.send(), "", String(value));
  }
});

test("rejects missing corrupt and mismatched rollout identity", (t) => {
  const f = fixture(t);
  for (const change of [{ session_id: "" }, { session_id: null }, { session_id: undefined }, { transcript_path: null }, { transcript_path: undefined }, { transcript_path: "" }, { transcript_path: join(f.root, "absent") }, { transcript_path: "relative.jsonl" }]) {
    assert.equal(f.send(change), "", JSON.stringify(change));
  }
  const records = ["", "{bad\n", JSON.stringify({ type: "other", payload: f.meta.payload }), JSON.stringify({ type: "session_meta" }), ...[
    {}, { id: "wrong", thread_source: "agent_created_thread" }, { id: "fixture-id" }, { id: "fixture-id", thread_source: "user" },
  ].map((payload) => JSON.stringify({ type: "session_meta", payload })),
    `{"padding":"${"x".repeat(65536)}"}`, `${JSON.stringify({ type: "other" })}\n${JSON.stringify(f.meta)}`];
  for (const value of records) {
    writeFileSync(f.transcript, `${value}\n`);
    assert.equal(f.send(), "", value.slice(0, 70));
  }
});

test("rejects non-default permission and subagent payloads", (t) => {
  const f = fixture(t);
  for (const change of [{ permission_mode: null }, { permission_mode: "full-access" }, { agent_id: "" }, { agent_id: null }, { agent_type: "" }, { agent_type: null }]) {
    assert.equal(f.send(change), "", JSON.stringify(change));
  }
});

test("rejects forked and user thread sources", (t) => {
  const f = fixture(t);
  for (const payload of [{ id: "fixture-id", thread_source: "user" }, { id: "fixture-id", thread_source: "subagent" }, { id: "fixture-id", thread_source: "agent_created_thread", forked_from_id: "parent" }]) {
    writeFileSync(f.transcript, `${JSON.stringify({ type: "session_meta", payload })}\n`);
    assert.equal(f.send(), "");
  }
});

test("rejects unknown or conflicting Codex config", (t) => {
  const f = fixture(t);
  const path = join(f.codexHome, "config.toml");
  rmSync(path);
  assert.equal(f.send(), "");
  for (const value of [
    'approval_policy = "never\nsandbox_mode = "danger-full-access"',
    `${FULL}invalid top-level`, `${FULL}approval_policy = "never"`,
    'approval_policy = "never"', 'sandbox_mode = "danger-full-access"',
    'approval_policy = "on-request"\nsandbox_mode = "danger-full-access"',
    'approval_policy = "never"\nsandbox_mode = "workspace-write"',
    `${FULL}profile = "team"`, `${FULL}"profile" = "team"`,
    `${FULL}[[profiles]`, `${FULL}[profiles]]`, `${FULL}[features]\nnot_valid = [`,
    `${FULL}[features]\nx = "unterminated`, `${FULL}[features]\nx = 1 2`,
    `${FULL}[features]\nx = [1 2]`, `${FULL}[features]\nx = {a = 1 b = 2}`,
  ]) {
    writeFileSync(path, value);
    assert.equal(f.send(), "", value);
  }
  writeFileSync(path, `${FULL}[features]\nenabled = true\n[sandbox_workspace_write]\nwritable_roots = [\n  "/tmp",\n]\n`);
  assert.equal(f.send(), ALLOW);
  writeFileSync(path, `${FULL}[features]\nsettings = { enabled = true, retries = 2 }\nnotes = """hello\nworld"""\nraw = '''one\ntwo'''\n`);
  assert.equal(f.send(), ALLOW, "closed compound values");
  writeFileSync(path, `${FULL}${"#".repeat(1024 * 1024)}`);
  assert.equal(f.send(), "", "oversized Codex config");
});

for (const [name, suffix] of [
  ["invalid header key", "[bad key]\nx = true\n"],
  ["invalid numeric underscores", "foo = 1__2\n"],
  ["invalid basic string escape", 'foo = "\\q"\n'],
  ["duplicate unrelated key", "foo = 1\nfoo = 2\n"],
] as const) {
  test(`rejects ${name} anywhere in Codex config`, (t) => {
    const f = fixture(t);
    const variants = name === "invalid header key" ? [suffix, "[x. bad key]\ny = 1\n", "[[bad key]]\ny = 1\n"]
      : name === "invalid numeric underscores" ? [suffix, ...["1_", "1._2", "1.2__3", "1e_2", "1e2_", "0x_1", "0x1__2", "0o7_", "0b1__0"].map((value) => `foo = ${value}\n`)]
      : name === "invalid basic string escape" ? [suffix, 'foo = """\\q"""\n', '"\\q" = 1\n']
      : [suffix, 'foo = 1\n"foo" = 2\n', '[x]\na = 1\n"a" = 2\n', 'a = 1\na.b = 2\n'];
    for (const variant of variants) {
      writeFileSync(join(f.codexHome, "config.toml"), FULL + variant);
      assert.equal(f.send(), "", variant);
      assert.equal(f.advise(), "", variant);
    }
  });
}

test("accepts real dotted tables, literal keys and multiline roots while rejecting redefined scalar", (t) => {
  const f = fixture(t);
  const path = join(f.codexHome, "config.toml");
  writeFileSync(path, `${FULL}[features]\nsearch = true\nalpha . 'beta gamma' = 2\n[projects."/a/b"]\ntrust_level = "trusted"\n[hooks.state."x@y:z.json:pre_tool_use:0:0"]\nenabled = true\n[sandbox_workspace_write]\nwritable_roots = [\n  "/tmp",\n  "/var/tmp",\n]\n[literal.'raw key']\nvalue = 1\n`);
  assert.equal(f.send(), ALLOW);
  assert.notEqual(f.advise(), "");
  writeFileSync(path, `${FULL}[numbers]\nint = 1_000\nfloat = 1_000.2_50e+1_0\nhex = 0xA_B\noctal = 0o7_1\nbinary = 0b1_0\nmultiline = """hello\\\n  world"""\n`);
  assert.equal(f.send(), ALLOW);
  writeFileSync(path, `${FULL}foo = 1\nfoo.bar = 2\n`);
  assert.equal(f.send(), "");
});

test("allows repeated array tables with fresh keys but rejects repeated standard tables", (t) => {
  const f = fixture(t);
  const path = join(f.codexHome, "config.toml");
  writeFileSync(path, `${FULL}[[x]]\nkey = 1\n[[x]]\nkey = 2\n`);
  assert.equal(f.send(), ALLOW);
  writeFileSync(path, `${FULL}[x]\nkey = 1\n[x]\nother = 2\n`);
  assert.equal(f.send(), "");
});

test("project-controlled CODEX_HOME config cannot grant permission or advisory", (t) => {
  const f = fixture(t);
  const home = join(f.cwd, "codex");
  mkdirSync(home);
  writeFileSync(join(home, "config.toml"), FULL);
  const env = { ...f.env, CODEX_HOME: home };
  assert.equal(f.send({}, env), "");
  assert.equal(f.advise({}, env), "");
});

test("symlinked Codex config into project cannot grant permission or advisory", (t) => {
  const f = fixture(t);
  const path = join(f.cwd, "config.toml");
  writeFileSync(path, FULL);
  rmSync(join(f.codexHome, "config.toml"));
  symlinkSync(path, join(f.codexHome, "config.toml"));
  assert.equal(f.send(), "");
  assert.equal(f.advise(), "");
});

test("advisory requires string cwd even with outside Codex config", (t) => {
  const f = fixture(t);
  assert.notEqual(f.advise(), "");
  assert.equal(f.advise({ cwd: null }), "");
});

test("permission CLI verbs leave project CODEX_HOME untouched", (t) => {
  const f = fixture(t);
  const home = join(f.cwd, "codex");
  mkdirSync(home);
  writeFileSync(join(home, "config.toml"), FULL);
  const env = { ...f.env, CODEX_HOME: home };
  const before = readdirSync(f.cwd).sort();
  const homeBefore = readdirSync(home).sort();
  for (const [verb, hook_event_name] of [["permission-request", "PermissionRequest"], ["session-start-permission-advisory", "SessionStart"]] as const) {
    const result = cli(verb, { ...f.input, hook_event_name }, f.cwd, env);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  }
  assert.deepEqual(readdirSync(f.cwd).sort(), before);
  assert.deepEqual(readdirSync(home).sort(), homeBefore);
});

test("ignores project-local opt-in and noncovered tool", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.clawHome, "config.json"), "{}");
  writeFileSync(join(f.cwd, "codexclaw.json"), '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  mkdirSync(join(f.cwd, ".codexclaw"));
  writeFileSync(join(f.cwd, ".codexclaw", "config.json"), '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  assert.equal(f.send(), "");
  assert.equal(f.send({}, { ...f.env, CODEXCLAW_HOME: join(f.cwd, ".codexclaw") }), "");
  assert.equal(f.send({}, { ...f.env, CODEXCLAW_HOME: "relative" }), "");
  assert.equal(f.send({}, { ...f.env, CODEX_HOME: "relative" }), "");
  writeFileSync(join(f.clawHome, "config.json"), '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  for (const tool_name of ["Edit", "mcp_tool", "functions.exec", "", "mcp__", "mcp__server", "mcp____tool", "mcp__server__"]) {
    assert.equal(f.send({ tool_name }), "", tool_name);
  }
  assert.equal(f.send({ tool_name: "mcp__codex_app__create_thread" }), ALLOW);
});

test("global opt-in rejects symlinked project config and accepts plain outside config", (t) => {
  const f = fixture(t);
  const projectConfig = join(f.cwd, ".codexclaw", "config.json");
  mkdirSync(dirname(projectConfig));
  writeFileSync(projectConfig, '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  const linkedHome = join(f.root, "linked-home");
  symlinkSync(dirname(projectConfig), linkedHome);
  assert.equal(f.send({}, { ...f.env, CODEXCLAW_HOME: linkedHome }), "");
  const outsideConfig = join(f.clawHome, "config.json");
  rmSync(outsideConfig);
  symlinkSync(projectConfig, outsideConfig);
  assert.equal(f.send(), "");
  rmSync(outsideConfig);
  writeFileSync(outsideConfig, '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  assert.equal(f.send(), ALLOW);
});

test("default home config remains eligible at home but a project symlink does not", (t) => {
  const f = fixture(t);
  const defaultDir = join(f.root, ".codexclaw");
  mkdirSync(defaultDir);
  const defaultConfig = join(defaultDir, "config.json");
  writeFileSync(defaultConfig, '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  const codexDir = join(f.root, ".codex");
  mkdirSync(codexDir);
  writeFileSync(join(codexDir, "config.toml"), FULL);
  const env = { CODEX_HOME: "", CODEXCLAW_HOME: "", HOME: f.root, USERPROFILE: f.root };
  const atHome = cli("permission-request", { ...f.input, cwd: f.root }, f.root, env);
  assert.equal(atHome.status, 0, atHome.stderr);
  assert.equal(atHome.stdout, ALLOW);
  const projectToml = join(f.cwd, "config.toml");
  writeFileSync(projectToml, FULL);
  rmSync(join(codexDir, "config.toml"));
  symlinkSync(projectToml, join(codexDir, "config.toml"));
  assert.equal(cli("permission-request", { ...f.input, cwd: f.root }, f.root, env).stdout, "");
  rmSync(join(codexDir, "config.toml"));
  writeFileSync(join(codexDir, "config.toml"), FULL);
  const projectConfig = join(f.cwd, "config.json");
  writeFileSync(projectConfig, '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  rmSync(defaultConfig);
  symlinkSync(projectConfig, defaultConfig);
  const project = cli("permission-request", f.input, f.cwd, env);
  assert.equal(project.status, 0, project.stderr);
  assert.equal(project.stdout, "");
});

test("emits exact allow JSON and otherwise no stdout", (t) => {
  const f = fixture(t);
  assert.deepEqual(JSON.parse(f.send()), { hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } } });
  assert.equal(f.send(), ALLOW);
  for (const raw of ["{", "", JSON.stringify({ ...f.input, hook_event_name: "Other" }), JSON.stringify({ ...f.input, hook_event_name: null })]) {
    assert.equal(permission(raw, f.env), "");
  }
  assert.equal(f.send({ transcript_path: join(f.root, "missing") }), "");
  writeFileSync(join(f.clawHome, "config.json"), `${" ".repeat(1024 * 1024)}{}`);
  assert.equal(f.send(), "", "oversized global config");
});

test("advises agent-created default thread without opt-in", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.clawHome, "config.json"), "{}");
  const result = JSON.parse(f.advise());
  assert.match(result.systemMessage, /Full Access/);
  assert.match(result.systemMessage, /agentCreatedThreadAutoAllow/);
  assert.match(result.systemMessage, /one-time network/);
  assert.equal(result.hookSpecificOutput.hookEventName, "SessionStart");
  const context = result.hookSpecificOutput.additionalContext;
  assert.match(context, /\[codexclaw\]/);
  assert.match(context, /Agent-created thread/);
  assert.match(context, /approvals/);
  assert.match(context, /full-access config/);
  assert.match(context, /sandbox\/tools/);
  assert.ok(Buffer.byteLength(context) <= 150);
  assert.doesNotMatch(context, /Request escalation explicitly|answers pending approvals/);
});

test("advisory is silent outside degraded agent-created context", (t) => {
  const f = fixture(t);
  for (const value of ['approval_policy = "on-request"\nsandbox_mode = "danger-full-access"', 'approval_policy = "never"\nsandbox_mode = "workspace-write"', `${FULL}profile = "team"`]) {
    writeFileSync(join(f.codexHome, "config.toml"), value);
    assert.equal(f.advise(), "");
  }
  writeFileSync(join(f.codexHome, "config.toml"), FULL);
  for (const change of [{ permission_mode: "full-access" }, { agent_id: null }, { agent_type: "worker" }]) assert.equal(f.advise(change), "");
  writeFileSync(f.transcript, `${JSON.stringify({ type: "session_meta", payload: { id: "fixture-id", thread_source: "user" } })}\n`);
  assert.equal(f.advise(), "");
  writeFileSync(f.transcript, "{bad\n");
  assert.equal(f.advise(), "");
});

test("CLI hooks fail open before root-only subagent exit", (t) => {
  const f = fixture(t);
  for (const [verb, input] of [["permission-request", f.input], ["session-start-permission-advisory", { ...f.input, hook_event_name: "SessionStart" }]] as const) {
    const positive = cli(verb, input, f.cwd, f.env);
    assert.equal(positive.status, 0, positive.stderr);
    assert.equal(verb === "permission-request" ? positive.stdout : JSON.parse(positive.stdout).hookSpecificOutput.hookEventName, verb === "permission-request" ? ALLOW : "SessionStart");
    for (const bad of ["{bad", "x".repeat(4 * 1024 * 1024 + 1)]) {
      const result = cli(verb, bad, f.cwd, f.env);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "");
    }
  }
});

test("CLI hooks stay active with PABCD disabled and never create project state", (t) => {
  const f = fixture(t);
  for (const mode of ["env", "project"] as const) {
    const cwd = join(f.root, `project-${mode}`);
    mkdirSync(cwd);
    if (mode === "project") writeFileSync(join(cwd, "codexclaw.json"), '{"pabcd":{"enabled":false}}');
    const env = { ...f.env, CODEXCLAW_PABCD: mode === "env" ? "off" : "" };
    const input = { ...f.input, cwd };
    const allowed = cli("permission-request", input, cwd, env);
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(allowed.stdout, ALLOW);
    const advised = cli("session-start-permission-advisory", { ...input, hook_event_name: "SessionStart" }, cwd, env);
    assert.equal(advised.status, 0, advised.stderr);
    assert.equal(JSON.parse(advised.stdout).hookSpecificOutput.hookEventName, "SessionStart");
    assert.equal(existsSync(join(cwd, ".codexclaw")), false);
    writeFileSync(join(f.clawHome, "config.json"), "{}");
    assert.equal(cli("permission-request", input, cwd, env).stdout, "");
    writeFileSync(join(f.clawHome, "config.json"), '{"permissions":{"agentCreatedThreadAutoAllow":true}}');
  }
});
