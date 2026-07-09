import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activate, manifestPath, type InstallManifest } from "../src/activate.ts";
import { deactivate } from "../src/deactivate.ts";
import { type CodexRunner } from "../src/features.ts";
import { homedir } from "node:os";

// Test-only safety guard (G22: previously a dead prod export in cli.ts). A misconfigured
// fixture must never operate on the real ~/.codex; this lives in the test because prod
// `main()` is *supposed* to act on the real codex home, so the guard has no prod caller.
function assertNotRealCodexHome(path: string, env: NodeJS.ProcessEnv = process.env): void {
  const real = join((env.HOME ?? homedir()), ".codex");
  if (join(path) === join(real)) {
    throw new Error(`refusing to operate on the real codex home: ${path}`);
  }
}

// A fake codex that holds an in-memory feature state and rewrites a config.toml fixture so the
// activate snapshot/hash logic exercises a real file — without ever touching ~/.codex.
function makeFakeCodex(configPath: string, initial: Record<string, boolean>) {
  const state = { ...initial };
  const writeConfig = () => {
    const lines = ["[features]"];
    for (const [k, v] of Object.entries(state)) lines.push(`${k} = ${v}`);
    writeFileSync(configPath, lines.join("\n") + "\n", "utf8");
  };
  writeConfig();
  const calls: string[][] = [];
  const run: CodexRunner = (args) => {
    calls.push([...args]);
    if (args[0] === "features" && args[1] === "list") {
      // Emit the REAL `codex features list` format: `{name} {stage} {true|false}`, and include
      // sibling keys that contain a declared key as a substring (multi_agent_v2, plugin_hooks) so
      // the integration path also proves exact-first-field parsing (no clobber).
      const rows: Array<[string, string, boolean]> = [
        ...Object.entries(state).map(
          ([k, v]) => [k, "stable", v] as [string, string, boolean],
        ),
        ["multi_agent_v2", "under-development", false],
        ["plugin_hooks", "removed", false],
      ];
      rows.sort((a, b) => a[0].localeCompare(b[0]));
      const out = rows.map(([k, stage, v]) => `${k} ${stage} ${v}`).join("\n");
      return { stdout: out, stderr: "", exitCode: 0 };
    }
    if (args[0] === "features" && args[1] === "enable") {
      state[args[2]] = true;
      writeConfig();
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (args[0] === "features" && args[1] === "disable") {
      state[args[2]] = false;
      writeConfig();
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "unknown", exitCode: 1 };
  };
  return { run, calls, state };
}

function setup() {
  const home = mkdtempSync(join(tmpdir(), "codexclaw-cg-"));
  const configPath = join(home, "config.toml");
  return { home, configPath };
}

test("activate enables only not-already-true declared flags + writes manifest + backup", () => {
  const { home, configPath } = setup();
  const fake = makeFakeCodex(configPath, {
    multi_agent: true,
    goals: true,
    hooks: false,
    default_mode_request_user_input: false,
  });
  const m = activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-06-30T00:00:00.000Z" });

  // only the two off flags get enable calls
  const enableCalls = fake.calls.filter((c) => c[1] === "enable").map((c) => c[2]);
  assert.deepEqual(enableCalls.sort(), ["default_mode_request_user_input", "hooks"]);
  assert.equal(m.flags.multi_agent.enabledByCodexclaw, false);
  assert.equal(m.flags.multi_agent.priorEnabled, true);
  assert.equal(m.flags.hooks.enabledByCodexclaw, true);
  assert.equal(m.flags.default_mode_request_user_input.enabledByCodexclaw, true);
  assert.ok(existsSync(manifestPath(home)));
  // backup created
  assert.ok(m.backupPath && existsSync(m.backupPath));
  assert.ok(readdirSync(home).some((f) => f.includes(".bak")));
});

test("enable then disable restores prior state; pre-existing-true left untouched", () => {
  const { home, configPath } = setup();
  const fake = makeFakeCodex(configPath, {
    multi_agent: true,
    goals: false,
    hooks: false,
    default_mode_request_user_input: false,
  });
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-06-30T00:00:00.000Z" });
  assert.equal(fake.state.goals, true);

  const r = deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(r.skippedDrift, false);
  // goals/hooks/default... were turned on by codexclaw -> disabled again
  assert.deepEqual(r.disabled.sort(), ["default_mode_request_user_input", "goals", "hooks"]);
  // multi_agent was pre-existing true -> kept
  assert.deepEqual(r.skippedPreExisting, ["multi_agent"]);
  assert.equal(fake.state.multi_agent, true);
  assert.equal(fake.state.goals, false);
  assert.equal(fake.state.hooks, false);
});

test("idempotent re-enable: second activate issues no enable calls", () => {
  const { home, configPath } = setup();
  const fake = makeFakeCodex(configPath, {
    multi_agent: true,
    goals: true,
    hooks: true,
    default_mode_request_user_input: true,
  });
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-06-30T00:00:00.000Z" });
  assert.equal(fake.calls.filter((c) => c[1] === "enable").length, 0);
});

test("deactivate with no manifest is a safe no-op", () => {
  const { home, configPath } = setup();
  const fake = makeFakeCodex(configPath, { multi_agent: false, goals: false, hooks: false, default_mode_request_user_input: false });
  const r = deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(r.noManifest, true);
  assert.equal(r.disabled.length, 0);
});

test("deactivate detects config drift and refuses to revert", () => {
  const { home, configPath } = setup();
  const fake = makeFakeCodex(configPath, { multi_agent: false, goals: false, hooks: false, default_mode_request_user_input: false });
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-06-30T00:00:00.000Z" });
  // simulate external edit after activation
  writeFileSync(configPath, readFileSync(configPath, "utf8") + "\n# user edit\n", "utf8");
  const r = deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(r.skippedDrift, true);
  assert.equal(r.disabled.length, 0);
});

test("assertNotRealCodexHome throws on the real ~/.codex, allows temp", () => {
  const { home } = setup();
  assert.doesNotThrow(() => assertNotRealCodexHome(home, { HOME: "/Users/someone" } as NodeJS.ProcessEnv));
  assert.throws(
    () => assertNotRealCodexHome("/Users/someone/.codex", { HOME: "/Users/someone" } as NodeJS.ProcessEnv),
    /refusing to operate on the real codex home/,
  );
});

test("soft flag enable failure does not abort activation", () => {
  const { home, configPath } = setup();
  const base = makeFakeCodex(configPath, { multi_agent: false, goals: false, hooks: false, default_mode_request_user_input: false });
  const run: CodexRunner = (args) => {
    if (args[1] === "enable" && args[2] === "default_mode_request_user_input") {
      return { stdout: "", stderr: "under development", exitCode: 1 };
    }
    return base.run(args);
  };
  const m: InstallManifest = activate({ run, codexHome: home, configPath, now: () => "2026-06-30T00:00:00.000Z" });
  assert.equal(m.flags.default_mode_request_user_input.enableFailed, true);
  assert.equal(m.flags.default_mode_request_user_input.enabledByCodexclaw, false);
  assert.equal(m.flags.hooks.enabledByCodexclaw, true);
});
