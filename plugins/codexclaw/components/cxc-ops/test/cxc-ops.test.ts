import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor, rollup, renderDoctor } from "../src/doctor.ts";
import { runReset, parseResetScope } from "../src/reset.ts";
import { main } from "../src/cli.ts";

// ---- doctor ---------------------------------------------------------------

function makePluginRoot(opts: { hooks?: string[]; skills?: string[]; brokenSkill?: boolean; roles?: string[] } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "cxc-doctor-"));
  mkdirSync(join(root, ".codex-plugin"), { recursive: true });
  const hooks = opts.hooks ?? ["./hooks/a.json"];
  writeFileSync(
    join(root, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: "test", version: "0.0.1", hooks, mcpServers: "./.mcp.json" }),
  );
  writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: { test: { command: "node" } } }));
  for (const h of hooks) {
    const p = join(root, h);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, "{}");
  }
  for (const s of opts.skills ?? ["dev"]) {
    mkdirSync(join(root, "skills", s, "agents"), { recursive: true });
    writeFileSync(join(root, "skills", s, "SKILL.md"), "---\nname: x\n---\n");
    if (!opts.brokenSkill) writeFileSync(join(root, "skills", s, "agents", "openai.yaml"), "policy: {}\n");
  }
  mkdirSync(join(root, "agents"), { recursive: true });
  for (const r of opts.roles ?? ["explorer"]) writeFileSync(join(root, "agents", `${r}.toml`), `name="${r}"\n`);
  // ast-grep skill stub so the L22 doctor check has a helper to probe AND the
  // skills check sees a complete skill (SKILL.md + agents/openai.yaml).
  mkdirSync(join(root, "skills", "ast-grep", "scripts"), { recursive: true });
  mkdirSync(join(root, "skills", "ast-grep", "agents"), { recursive: true });
  writeFileSync(join(root, "skills", "ast-grep", "SKILL.md"), "---\nname: ast-grep\n---\n");
  writeFileSync(join(root, "skills", "ast-grep", "agents", "openai.yaml"), "policy: {}\n");
  writeFileSync(join(root, "skills", "ast-grep", "scripts", "ast_grep_helper.py"), "# stub\n");
  return root;
}

test("rollup: FAIL > WARN > PASS", () => {
  assert.equal(rollup([{ name: "a", severity: "PASS", evidence: "" }, { name: "b", severity: "WARN", evidence: "" }]), "WARN");
  assert.equal(rollup([{ name: "a", severity: "WARN", evidence: "" }, { name: "b", severity: "FAIL", evidence: "" }]), "FAIL");
  assert.equal(rollup([{ name: "a", severity: "PASS", evidence: "" }]), "PASS");
});

test("doctor: healthy plugin root -> PASS with evidence on every check", () => {
  const root = makePluginRoot();
  // stub the ast-grep runner so the L22 check resolves PASS without a real sg.
  const agRunner = (() => ({
    status: 0,
    stdout: "ast-grep binary: /stub/sg\n  version: ast-grep 0.44.0\n",
    stderr: "",
  })) as unknown as typeof import("node:child_process").spawnSync;
  const report = runDoctor(root, agRunner);
  assert.equal(report.overall, "PASS");
  for (const c of report.checks) assert.ok(c.evidence.length > 0, `check ${c.name} has no evidence`);
  assert.match(renderDoctor(report), /overall: PASS/);
});

test("doctor: missing hook file -> FAIL on hooks", () => {
  const root = makePluginRoot({ hooks: ["./hooks/present.json"] });
  // add a manifest hook that points at a missing file
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ hooks: ["./hooks/present.json", "./hooks/ghost.json"] }));
  const report = runDoctor(root);
  const hooks = report.checks.find((c) => c.name === "hooks");
  assert.equal(hooks?.severity, "FAIL");
  assert.match(hooks?.evidence ?? "", /ghost\.json/);
  assert.equal(report.overall, "FAIL");
});

test("doctor: skill missing openai.yaml -> FAIL on skills", () => {
  const root = makePluginRoot({ brokenSkill: true });
  const report = runDoctor(root);
  assert.equal(report.checks.find((c) => c.name === "skills")?.severity, "FAIL");
});

// ---- reset ----------------------------------------------------------------

function makeStateTree(): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-reset-"));
  const sd = join(cwd, ".codexclaw");
  mkdirSync(join(sd, "sessions"), { recursive: true });
  writeFileSync(join(sd, "sessions", "s1.json"), "{}");
  writeFileSync(join(sd, "sessions", "s2.json"), "{}");
  writeFileSync(join(sd, "ledger.jsonl"), "{}\n");
  mkdirSync(join(sd, "interview"), { recursive: true });
  writeFileSync(join(sd, "interview", "freeze.json"), "{}");
  // 131/D2': plural interviews/ holds per-session scan-evidence ledgers (session state).
  mkdirSync(join(sd, "interviews"), { recursive: true });
  writeFileSync(join(sd, "interviews", "s1.jsonl"), "{}\n");
  // 030: project-local goalplan substrate.
  mkdirSync(join(sd, "goalplans", "demo"), { recursive: true });
  writeFileSync(join(sd, "goalplans", "demo", "goalplan.json"), "{}");
  return cwd;
}

test("parseResetScope: flags map to scopes, default state", () => {
  assert.equal(parseResetScope([]), "state");
  assert.equal(parseResetScope(["--all"]), "all");
  assert.equal(parseResetScope(["--generated"]), "generated");
  assert.equal(parseResetScope(["--goalplans"]), "goalplans");
});

test("reset --state: removes only session json + ledger, leaves interview/ intact", () => {
  const cwd = makeStateTree();
  const r = runReset(cwd, "state");
  assert.equal(r.removed.filter((p) => p.endsWith(".json") || p.endsWith(".jsonl")).length, 3);
  // interview/ must survive
  assert.ok(existsSync(join(cwd, ".codexclaw", "interview", "freeze.json")), "interview/ must be untouched by --state");
  // 131/D2': plural interviews/ (scan-evidence) IS session state -> removed by --state
  assert.ok(!existsSync(join(cwd, ".codexclaw", "interviews")), "interviews/ scan-evidence must be cleaned by --state");
  // sessions dir emptied of json
  assert.equal(readdirSync(join(cwd, ".codexclaw", "sessions")).length, 0);
});

test("reset --generated: removes interview/ only, leaves session state", () => {
  const cwd = makeStateTree();
  runReset(cwd, "generated");
  assert.ok(!existsSync(join(cwd, ".codexclaw", "interview")), "interview/ should be gone");
  assert.ok(existsSync(join(cwd, ".codexclaw", "sessions", "s1.json")), "session state must survive --generated");
});

test("reset --state: leaves goalplans/ intact (a plan outlives a session reset)", () => {
  const cwd = makeStateTree();
  runReset(cwd, "state");
  assert.ok(
    existsSync(join(cwd, ".codexclaw", "goalplans", "demo", "goalplan.json")),
    "goalplans/ must survive --state",
  );
});

test("reset --goalplans: removes goalplans/ only, leaves session + interview state", () => {
  const cwd = makeStateTree();
  const r = runReset(cwd, "goalplans");
  assert.ok(!existsSync(join(cwd, ".codexclaw", "goalplans")), "goalplans/ should be gone");
  assert.ok(existsSync(join(cwd, ".codexclaw", "sessions", "s1.json")), "session state must survive --goalplans");
  assert.ok(existsSync(join(cwd, ".codexclaw", "interview", "freeze.json")), "interview/ must survive --goalplans");
  assert.equal(r.scope, "goalplans");
});

test("reset --all: removes the whole .codexclaw subtree and nothing above it", () => {
  const cwd = makeStateTree();
  // a sibling file outside .codexclaw must never be touched
  writeFileSync(join(cwd, "sibling.txt"), "keep me");
  runReset(cwd, "all");
  assert.ok(!existsSync(join(cwd, ".codexclaw")), ".codexclaw should be gone");
  assert.ok(existsSync(join(cwd, "sibling.txt")), "files outside .codexclaw must never be touched");
});

// ---- chat-search removed (D1', L13/WP1) -----------------------------------
// The chat-search subcommand was retired: codex app-server `thread/search` has no
// native CLI/agent surface to wrap, and repo/web lookups route through `cxc-search`.
// Unknown subcommands are NOT errors here (default prints usage + exit 0), so the
// positive proof that chat-search is gone is: it falls through to default usage,
// and the usage string no longer advertises it.

async function captureMain(argv: string[]): Promise<{ code: number; out: string }> {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  (process.stdout as { write: typeof process.stdout.write }).write = ((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    const code = await main(argv, import.meta.url);
    return { code, out: chunks.join("") };
  } finally {
    (process.stdout as { write: typeof process.stdout.write }).write = original;
  }
}

test("chat-search: subcommand is gone (falls to default usage, exit 0)", async () => {
  const { code, out } = await captureMain(["chat-search", "anything"]);
  assert.equal(code, 0, "unknown subcommand must exit 0, not error");
  assert.doesNotMatch(out, /chat-search/, "usage must not advertise chat-search");
});

test("usage string lists only doctor and reset", async () => {
  const { out } = await captureMain(["definitely-not-a-command"]);
  assert.match(out, /doctor/);
  assert.match(out, /reset/);
  assert.doesNotMatch(out, /chat-search/);
});
