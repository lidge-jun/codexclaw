import { test } from "node:test";
import assert from "node:assert/strict";
import type { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor, rollup, renderDoctor } from "../src/doctor.ts";
import { runInstalledRootCheck } from "../src/doctor.ts";
import { checkWslResidency } from "../src/doctor.ts";
import { identityHash } from "../src/hook-trust.ts";
import { runReset, parseResetScope } from "../src/reset.ts";
import { main } from "../src/cli.ts";

// STALE-ROOT-01 (260818) — `codex plugin add` keeps one version directory per
// plugin, so a reinstall DELETES the path a running session still resolves
// `${PLUGIN_ROOT}` to. Every hook in that session then dies with "Cannot find
// module" and reports nothing. Doctor is the only place that can notice.
function payloadAt(version: string): string {
  const root = mkdtempSync(join(tmpdir(), "cxc-payload-"));
  mkdirSync(join(root, ".codex-plugin"), { recursive: true });
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "codexclaw", version }));
  return root;
}

function homeWithInstalled(version: string): string {
  const home = mkdtempSync(join(tmpdir(), "cxc-home-"));
  mkdirSync(join(home, "plugins", "cache", "mkt", "codexclaw", version), { recursive: true });
  return home;
}

test("install-root: a payload newer than the installed root FAILS", () => {
  const codexHome = homeWithInstalled("0.2.5+codex.OLD");
  const check = runInstalledRootCheck(payloadAt("0.2.5+codex.NEW"), { codexHome });
  assert.equal(check.severity, "FAIL");
  assert.match(check.evidence, /STALE-ROOT-01/);
  assert.match(check.repair ?? "", /RESTART/);
});

test("install-root: a payload matching the installed root PASSES", () => {
  const codexHome = homeWithInstalled("0.2.5+codex.SAME");
  const check = runInstalledRootCheck(payloadAt("0.2.5+codex.SAME"), { codexHome });
  assert.equal(check.severity, "PASS");
});

test("install-root: an uninstalled plugin warns rather than failing", () => {
  const codexHome = mkdtempSync(join(tmpdir(), "cxc-home-empty-"));
  const check = runInstalledRootCheck(payloadAt("0.2.5+codex.X"), { codexHome });
  assert.equal(check.severity, "WARN");
});

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
    // A REAL handler, not `{}`. An empty hook file has nothing to hash, and
    // hook-trust now reports "nothing was verified" as WARN instead of laundering
    // an empty result set into PASS (STALE-ROOT-01 companion).
    writeFileSync(p, JSON.stringify({
      hooks: { Stop: [{ hooks: [{ type: "command", command: "node stub.js" }] }] },
    }));
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
  const codexHome = mkdtempSync(join(tmpdir(), "cxc-doctor-home-"));
  // The fixture hook must be TRUSTED for a healthy report: hook-trust hashes real
  // handlers now, and an unhashable/untrusted one is no longer silently a PASS.
  const trusted = identityHash("Stop", undefined, { type: "command", command: "node stub.js" });
  writeFileSync(
    join(codexHome, "config.toml"),
    '[plugins."test@fixture"]\nenabled = true\n\n'
      + '[hooks.state."test@fixture:hooks/a.json:stop:0:0"]\n'
      + `trusted_hash = "${trusted}"\n`,
  );
  // A healthy machine has this payload actually installed (STALE-ROOT-01); without
  // a matching install root the honest answer is WARN, not PASS.
  mkdirSync(join(codexHome, "plugins", "cache", "fixture", "test", "0.0.1"), { recursive: true });
  // stub the ast-grep runner so the L22 check resolves PASS without a real sg.
  // It must answer per command now: the `features` check also shells out, and a runner
  // that returned ast-grep text for every call made that check read as not-enabled.
  const agRunner = ((cmd: string, args?: readonly string[]) => {
    if (cmd === "codex" && args?.[0] === "features") {
      return {
        status: 0,
        stdout: ["multi_agent  stable  true", "goals  stable  true", "hooks  stable  true", "default_mode_request_user_input  under-development  true"].join("\n"),
        stderr: "",
      };
    }
    return { status: 0, stdout: "ast-grep binary: /stub/sg\n  version: ast-grep 0.44.0\n", stderr: "" };
  }) as unknown as typeof import("node:child_process").spawnSync;
  // Pin the WSL probes: run from a /mnt/c checkout inside WSL the state tree is
  // really on 9p, so an un-injected check would WARN here and the assertion below
  // would depend on which side of the platform boundary the tests were started.
  const report = runDoctor(root, agRunner, {
    codexHome,
    pluginKey: "test@fixture",
    wslDeps: { platform: "linux", env: {}, procVersion: null },
  });
  assert.equal(
    report.overall,
    "PASS",
    report.checks.filter((c) => c.severity !== "PASS").map((c) => `${c.severity} ${c.name}: ${c.evidence}`).join(" | "),
  );
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

test("doctor report includes schemaVersion 1", () => {
  const root = makePluginRoot();
  const codexHome = mkdtempSync(join(tmpdir(), "cxc-doctor-schema-"));
  writeFileSync(join(codexHome, "config.toml"), '[plugins."test@fixture"]\nenabled = true\n');
  const agRunner = (() => ({
    status: 0,
    stdout: "ast-grep binary: /stub/sg\n  version: ast-grep 0.44.0\n",
    stderr: "",
  })) as unknown as typeof import("node:child_process").spawnSync;
  const report = runDoctor(root, agRunner, { codexHome, pluginKey: "test@fixture" });
  assert.equal(report.schemaVersion, 1);
  assert.ok(typeof report.overall === "string");
  assert.ok(Array.isArray(report.checks));
});

test("doctor --json outputs valid JSON with schemaVersion", async () => {
  const { code, out } = await captureMain(["doctor", "--json"]);
  // The output should be valid JSON (may FAIL overall but still structured)
  const parsed = JSON.parse(out);
  assert.equal(parsed.schemaVersion, 1);
  assert.ok(Array.isArray(parsed.checks));
  assert.ok(["PASS", "WARN", "FAIL"].includes(parsed.overall));
});

test("doctor report includes pluginVersion when manifest has version", () => {
  const root = makePluginRoot();
  const report = runDoctor(root);
  assert.equal(report.pluginVersion, "0.0.1");
});

test("doctor renders codexclaw version header when present", () => {
  const root = makePluginRoot();
  const report = runDoctor(root);
  const rendered = renderDoctor(report);
  assert.match(rendered, /codexclaw v0.0.1/);
});

test("doctor PABCD state check passes on clean state", () => {
  const root = makePluginRoot();
  const report = runDoctor(root);
  const pabcdCheck = report.checks.find(c => c.name === "pabcd-state");
  assert.ok(pabcdCheck, "pabcd-state check should be present");
  assert.equal(pabcdCheck.severity, "PASS");
});

test("doctor repair field appears in rendered output for non-PASS checks", () => {
  const root = makePluginRoot();
  // Create a corrupt session file
  const sessDir = join(root, ".codexclaw", "sessions");
  mkdirSync(sessDir, { recursive: true });
  writeFileSync(join(sessDir, "corrupt.json"), "NOT JSON");
  // Override process.cwd to point at root
  const origCwd = process.cwd;
  process.cwd = () => root;
  try {
    const report = runDoctor(root);
    const pabcdCheck = report.checks.find(c => c.name === "pabcd-state");
    assert.equal(pabcdCheck?.severity, "WARN");
    assert.ok(pabcdCheck?.repair);
    const rendered = renderDoctor(report);
    assert.match(rendered, /repair:/);
  } finally {
    process.cwd = origCwd;
  }
});

// --- wp05 defect #16: the version regex was missing its backslashes ---

test("doctor parses a semver out of codex --version", () => {
  // /(d+.d+.d+)/ matched a literal "d", so "codex 1.2.3" fell through to the raw
  // stdout trim. The report has a codexVersion field; it should hold a version.
  const runner = ((cmd: string) => {
    if (cmd === "codex") return { status: 0, stdout: "codex-cli 1.2.3\n", stderr: "" };
    return { status: 1, stdout: "", stderr: "" };
  }) as unknown as typeof spawnSync;
  const report = runDoctor(payloadAt("0.0.1"), runner, { codexHome: mkdtempSync(join(tmpdir(), "cxc-empty-")) });
  assert.equal(report.codexVersion, "1.2.3");
});

test("doctor falls back to trimmed stdout when no semver is present", () => {
  const runner = ((cmd: string) => {
    if (cmd === "codex") return { status: 0, stdout: "  nightly  \n", stderr: "" };
    return { status: 1, stdout: "", stderr: "" };
  }) as unknown as typeof spawnSync;
  const report = runDoctor(payloadAt("0.0.1"), runner, { codexHome: mkdtempSync(join(tmpdir(), "cxc-empty-")) });
  assert.equal(report.codexVersion, "nightly");
});

// --- wp07 (plan 060): WSL residency + state filesystem tier ---

test("the doctor wsl check is ok off-WSL", () => {
  const check = checkWslResidency("/home/u/proj", { platform: "linux", env: {}, procVersion: null });
  assert.equal(check.severity, "PASS");
  assert.match(check.evidence, /not running under WSL/);
});

test("the doctor wsl check warns on drvfs state", () => {
  const check = checkWslResidency("/mnt/c/proj", {
    platform: "linux",
    env: { WSL_DISTRO_NAME: "Ubuntu" },
    wslConf: "[automount]\nroot = /mnt\n",
    procMounts: ["/dev/sdc / ext4 rw 0 0", "C: /mnt/c drvfs rw 0 0"].join("\n"),
  });
  assert.equal(check.severity, "WARN");
  assert.match(check.evidence, /drvfs/);
  assert.match(check.evidence, /automount root \/mnt/);
});
