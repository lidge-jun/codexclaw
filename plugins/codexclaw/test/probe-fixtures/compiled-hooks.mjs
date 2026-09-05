// Real manifest-selected entrypoints; absent dist is a failure, never a skip.
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pluginRoot, tempRoot, put, putJson, readJson, isolatedEnv, syncNode } from "./filesystem.mjs";

export function benchmarkFixture(t, body = 'process.stdout.write("{}\\n");') {
  const root = tempRoot(t, "cxc-bench-payload-");
  putJson(root, ".codex-plugin/plugin.json", { name: "fixture", version: "1.0.0", hooks: ["./hooks/fixture.json"] });
  putJson(root, "hooks/fixture.json", { hooks: { PreToolUse: [{ hooks: [{ type: "command",
    command: 'node "${PLUGIN_ROOT}/entry.mjs"', timeout: 2 }] }] } });
  put(root, "entry.mjs", body);
  return root;
}

export function compiledHookFixture(t, hookFile) {
  const root = tempRoot(t, "cxc-compiled-hook-");
  const manifest = readJson(join(pluginRoot, ".codex-plugin/plugin.json"));
  const selected = manifest.hooks.find(path => path.replace(/^\.\//, "") === `hooks/${hookFile}`);
  assert.ok(selected, `hook must be selected by actual manifest: ${hookFile}`);
  const hook = readJson(join(pluginRoot, selected));
  const groups = hook.hooks.PreToolUse;
  assert.equal(groups.length, 1);
  assert.equal(groups[0].hooks.length, 1);
  const command = groups[0].hooks[0].command;
  const match = /^node "\$\{PLUGIN_ROOT\}\/([^"]+)" hook (\S+)$/.exec(command);
  assert.ok(match, `unsupported manifest command: ${command}`);
  const installed = join(root, "home/.codex/plugins/cache/codexclaw/fixture");
  const source = join(pluginRoot, dirname(match[1]));
  const destination = join(installed, dirname(match[1]));
  mkdirSync(dirname(destination), { recursive: true });
  // Missing/partial dist is a hard failure, not a skip, retry or rebuild.
  cpSync(source, destination, { recursive: true });
  const entrypoint = join(installed, match[1]);
  assert.ok(existsSync(entrypoint), "compiled manifest entrypoint required");
  const skillBody = "# Installed synthetic dev skill\n\nFixture-specific instruction body 8317.\n";
  const skill = put(installed, "skills/dev/SKILL.md", skillBody);
  const cwd = join(root, "work");
  mkdirSync(cwd);
  return { root, installed, entrypoint, hookEvent: match[2], matcher: groups[0].matcher,
    skill, skillBody, cwd, env: isolatedEnv(root) };
}

export function compiledOutput(f, payload) {
  const result = syncNode([f.entrypoint, "hook", f.hookEvent], f.root, {
    input: JSON.stringify(payload), env: f.env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "", "unexpected compiled-hook diagnostics must not be hidden");
  return result.stdout;
}

export function spawnPayload(f, surface) {
  return { hook_event_name: "PreToolUse", session_id: "probe-spawn", cwd: f.cwd,
    tool_name: surface === "V1" ? "spawn_agent" : "collaborationspawn_agent",
    tool_input: { message: "$cxc-dev inspect the fixture", agent_type: "explorer",
      ...(surface === "V2" ? { task_name: "probe_leaf", fork_turns: "none" } : {}),
      probe_preserved: { nested: ["unchanged", 7] } } };
}
