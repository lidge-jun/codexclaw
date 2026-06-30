// codexclaw build aggregation tests (node:test, .mjs — runs on Node 24).
// Proves: build is idempotent, every manifest-referenced dist entry exists post-build,
// .ts import specifiers were rewritten to .js, and a compiled hook runs end-to-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const buildScript = join(pluginRoot, "scripts", "build.mjs");

function runBuild() {
  // Build emits an ExperimentalWarning on stderr (stripTypeScriptTypes) — tolerated.
  return execFileSync("node", [buildScript], { cwd: pluginRoot, encoding: "utf8" });
}

function hashDir(dir) {
  // Deterministic snapshot of every file's relative path + bytes under dir.
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else out.push(`${p.slice(dir.length)}:${readFileSync(p, "utf8")}`);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.join("\n");
}

const COMPONENTS = ["pabcd-state", "config-guard", "provider-bridge", "subagent-config", "cxc-ops"];

test("build is idempotent (run twice -> byte-identical dist)", () => {
  runBuild();
  const first = COMPONENTS.map((c) => hashDir(join(pluginRoot, "components", c, "dist")));
  runBuild();
  const second = COMPONENTS.map((c) => hashDir(join(pluginRoot, "components", c, "dist")));
  assert.deepEqual(second, first, "dist changed across two identical builds");
});

test("every manifest-referenced dist + skill path exists post-build", () => {
  runBuild();
  const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  // hooks[*] reference compiled cli.js entries via ${PLUGIN_ROOT}; resolve each hook json's command.
  for (const rel of manifest.hooks) {
    const hookJson = JSON.parse(readFileSync(join(pluginRoot, rel), "utf8"));
    const flat = JSON.stringify(hookJson);
    const m = flat.match(/components\/[^"\\]+?\/dist\/[A-Za-z0-9._-]+\.js/);
    assert.ok(m, `hook ${rel} references a component dist entry`);
    assert.ok(existsSync(join(pluginRoot, m[0])), `missing compiled entry ${m[0]}`);
  }
  // .mcp.json server entry
  const mcp = JSON.parse(readFileSync(join(pluginRoot, ".mcp.json"), "utf8"));
  const args = mcp.mcpServers.codexclaw.args.join(" ");
  const mcpEntry = args.match(/components\/[^ ]+?\/dist\/[A-Za-z0-9._-]+\.js/);
  assert.ok(mcpEntry && existsSync(join(pluginRoot, mcpEntry[0])), "missing mcp dist entry");
  // skills
  const skillsDir = join(pluginRoot, "skills");
  for (const name of readdirSync(skillsDir)) {
    const sd = join(skillsDir, name);
    if (statSync(sd).isDirectory()) {
      assert.ok(existsSync(join(sd, "SKILL.md")), `skill ${name} missing SKILL.md`);
    }
  }
});

test("compiled dist rewrote .ts import specifiers to .js", () => {
  runBuild();
  for (const c of COMPONENTS) {
    const dist = join(pluginRoot, "components", c, "dist");
    if (!existsSync(dist)) continue;
    for (const f of readdirSync(dist).filter((n) => n.endsWith(".js"))) {
      const body = readFileSync(join(dist, f), "utf8");
      assert.ok(
        !/from\s+["']\.{1,2}\/[^"']+\.ts["']/.test(body),
        `${c}/dist/${f} still has a .ts specifier`,
      );
    }
  }
});

test("compiled pabcd-state hook runs end-to-end (trigger -> directive + state write)", () => {
  runBuild();
  const cli = join(pluginRoot, "components", "pabcd-state", "dist", "cli.js");
  const tmp = mkdtempSync(join(tmpdir(), "ccx-build-"));
  try {
    const payload = JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      prompt: "interview me about this feature",
      cwd: tmp,
      session_id: "s-build-test",
      turn_id: "t1",
    });
    const res = spawnSync("node", [cli, "hook", "user-prompt-submit"], { input: payload, encoding: "utf8" });
    assert.equal(res.status, 0, `hook exited ${res.status}: ${res.stderr}`);
    const out = JSON.parse(res.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /codexclaw: INTERVIEW/);
    // S2: orchestrationActive written to the per-session state file in payload cwd.
    const stateFile = join(tmp, ".codexclaw", "sessions", "s-build-test.json");
    assert.ok(existsSync(stateFile), "session state file not written");
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(state.orchestrationActive, true);
    assert.equal(state.lastInjectedPhase, "I");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("subagent-config compiled MCP server completes the initialize handshake", () => {
  runBuild();
  const mcp = join(pluginRoot, "components", "subagent-config", "dist", "mcp.js");
  const req = `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`;
  const res = spawnSync("node", [mcp], { input: req, encoding: "utf8" });
  assert.equal(res.status, 0, `mcp exited ${res.status}: ${res.stderr}`);
  const line = res.stdout.trim().split("\n")[0];
  const msg = JSON.parse(line);
  assert.equal(msg.id, 1);
  assert.ok(msg.result.protocolVersion, "no protocolVersion in initialize result");
  assert.ok(msg.result.capabilities, "no capabilities in initialize result");
});

test("no placeholder markers in shipped component src or dist", () => {
  runBuild();
  const RE = /\[TODO\]|TODO\(|FIXME|\bTBD\b/;
  for (const c of COMPONENTS) {
    for (const sub of ["src", "dist"]) {
      const d = join(pluginRoot, "components", c, sub);
      if (!existsSync(d)) continue;
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isFile()) {
          assert.ok(!RE.test(readFileSync(p, "utf8")), `placeholder marker in ${c}/${sub}/${f}`);
        }
      }
    }
  }
});
