/**
 * fixtures.test.ts — L21.3 packaging smoke validators (test-support absorb).
 *
 * JSON-shape validators for the real codexclaw plugin payload: package metadata,
 * hook json files, MCP config, and the plugin manifest. These are the codexclaw
 * packaging smoke tests reused from omo test-support.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDriftCheck } from "../src/doctor.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..", "..", "..");

function readJson(p: string): unknown {
  return JSON.parse(readFileSync(p, "utf8"));
}

test("fixture: plugin manifest has the required shape", () => {
  const m = readJson(join(pluginRoot, ".codex-plugin", "plugin.json")) as Record<string, unknown>;
  assert.equal(typeof m.name, "string");
  assert.equal(typeof m.version, "string");
  assert.ok(Array.isArray(m.hooks), "hooks must be an array");
  assert.ok((m.hooks as unknown[]).every((h) => typeof h === "string"), "every hook ref is a string path");
});

test("fixture: every manifest hook json parses and declares a hook event", () => {
  const m = readJson(join(pluginRoot, ".codex-plugin", "plugin.json")) as { hooks: string[] };
  for (const ref of m.hooks) {
    const p = join(pluginRoot, ref);
    assert.ok(existsSync(p), `hook file missing: ${ref}`);
    const j = readJson(p) as { hooks?: Record<string, unknown> };
    assert.ok(j.hooks && typeof j.hooks === "object", `${ref} has no hooks object`);
    const events = Object.keys(j.hooks);
    assert.ok(events.length > 0, `${ref} declares no hook event`);
  }
});

test("fixture: .mcp.json parses and each server has a command", () => {
  const m = readJson(join(pluginRoot, ".codex-plugin", "plugin.json")) as { mcpServers?: string };
  assert.equal(typeof m.mcpServers, "string", "manifest must reference an mcp config file");
  const mcpPath = join(pluginRoot, m.mcpServers as string);
  assert.ok(existsSync(mcpPath), "mcp config file must exist");
  const mcp = readJson(mcpPath) as { mcpServers?: Record<string, { command?: unknown }> };
  assert.ok(mcp.mcpServers && typeof mcp.mcpServers === "object", "mcp config has no mcpServers map");
  for (const [name, srv] of Object.entries(mcp.mcpServers)) {
    assert.equal(typeof srv.command, "string", `mcp server ${name} has no command`);
  }
});

test("fixture: each component package.json is a private ES module", () => {
  const componentsDir = join(pluginRoot, "components");
  for (const c of readdirSync(componentsDir)) {
    const pkgPath = join(componentsDir, c, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = readJson(pkgPath) as Record<string, unknown>;
    assert.equal(pkg.type, "module", `${c} must be an ES module`);
    assert.equal(pkg.private, true, `${c} must be private`);
    assert.equal(typeof pkg.name, "string", `${c} needs a name`);
  }
});

test("L21.3: runDriftCheck reports version + mcp drift + known-issues on the real payload", () => {
  const checks = runDriftCheck(pluginRoot);
  const names = checks.map((c) => c.name);
  assert.ok(names.includes("drift:version"), "missing drift:version check");
  assert.ok(names.includes("drift:mcp"), "missing drift:mcp check");
  assert.ok(names.includes("known-issues"), "missing known-issues check");
  // real payload is healthy -> version + mcp PASS, known-issues PASS.
  assert.equal(checks.find((c) => c.name === "drift:version")?.severity, "PASS");
  assert.equal(checks.find((c) => c.name === "drift:mcp")?.severity, "PASS");
  assert.equal(checks.find((c) => c.name === "known-issues")?.severity, "PASS");
  for (const c of checks) assert.ok(c.evidence.length > 0, `${c.name} has no evidence`);
});
