import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activate, manifestPath, preserveMultiAgentV2Table, type InstallManifest } from "../src/activate.ts";
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
  // Mirror the real `codex features enable|disable`, which edits config.toml in place
  // via toml_edit and leaves every other line alone. Regenerating the file from scratch
  // would silently destroy foreign content and let a clobbering bug pass its test.
  const writeConfig = () => {
    const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    const lines = existing.length > 0 ? existing.split("\n") : [];
    const hasFeatures = lines.some((l) => /^\s*\[features\]\s*$/.test(l));
    if (!hasFeatures) {
      if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
      lines.push("[features]");
    }
    const headerIdx = lines.findIndex((l) => /^\s*\[features\]\s*$/.test(l));
    let end = lines.length;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (/^\s*\[/.test(lines[i])) {
        end = i;
        break;
      }
    }
    for (const [k, v] of Object.entries(state)) {
      const re = new RegExp(`^(\\s*)${k}\\s*=\\s*(?:true|false)\\s*$`);
      let found = -1;
      for (let i = headerIdx + 1; i < end; i++) {
        if (re.test(lines[i])) {
          found = i;
          break;
        }
      }
      if (found >= 0) {
        lines[found] = `${k} = ${v}`;
      } else {
        lines.splice(end, 0, `${k} = ${v}`);
        end += 1;
      }
    }
    const out = lines.join("\n");
    writeFileSync(configPath, out.endsWith("\n") ? out : `${out}\n`, "utf8");
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
  assert.equal(r.fileDrifted, false);
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

test("activate never manages multi_agent_v2 outside the declared feature set", () => {
  const { home, configPath } = setup();
  const fake = makeFakeCodex(configPath, {
    multi_agent: true,
    goals: true,
    hooks: true,
    default_mode_request_user_input: true,
  });

  const manifest = activate({ run: fake.run, codexHome: home, configPath });

  assert.equal(Object.hasOwn(manifest.flags, "multi_agent_v2"), false);
  assert.equal(fake.calls.some((call) => call[1] === "enable" && call[2] === "multi_agent_v2"), false);
});

test("deactivate with no manifest is a safe no-op", () => {
  const { home, configPath } = setup();
  const fake = makeFakeCodex(configPath, { multi_agent: false, goals: false, hooks: false, default_mode_request_user_input: false });
  const r = deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(r.noManifest, true);
  assert.equal(r.disabled.length, 0);
});

test("deactivate reverts our keys and preserves unrelated edits", () => {
  // Replaces "deactivate detects config drift and refuses to revert" (260829 wp3).
  // The old whole-file hash gate made ONE unrelated edit disable uninstall forever,
  // stranding flags the user never chose. The contract is now positive: revert our
  // own items, and leave every foreign byte exactly where it was.
  const { home, configPath } = setup();
  const fake = makeFakeCodex(configPath, { multi_agent: false, goals: false, hooks: false, default_mode_request_user_input: false });
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-06-30T00:00:00.000Z" });
  // simulate external edit after activation
  writeFileSync(configPath, readFileSync(configPath, "utf8") + "\n# user edit\n", "utf8");

  const r = deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(r.fileDrifted, true, "the drift is still detected — it is reported, not obeyed");
  assert.deepEqual(
    r.disabled.sort(),
    ["default_mode_request_user_input", "goals", "hooks", "multi_agent"],
    "every flag codexclaw turned on is reverted despite the unrelated edit",
  );
  assert.equal(fake.state.goals, false);
  assert.match(readFileSync(configPath, "utf8"), /# user edit/, "the foreign line survives verbatim");
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

test("preserveMultiAgentV2Table preserves CRLF line endings", () => {
  const preConfig = [
    "[features.multi_agent_v2]",
    "enabled = false",
    "max_concurrent_threads_per_session = 7",
    "",
  ].join("\r\n");
  const postConfig = "[features]\r\nmulti_agent_v2 = true\r\n";

  const repaired = preserveMultiAgentV2Table(preConfig, postConfig);

  assert.equal(
    repaired,
    "[features]\r\n\r\n[features.multi_agent_v2]\r\nenabled = true\r\nmax_concurrent_threads_per_session = 7\r\n",
  );
  assert.equal(repaired?.replace(/\r\n/g, "").includes("\n"), false);
});
