import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { deactivate, decideKeyRestore } from "../src/deactivate.ts";
import { manifestPath, parseInstallManifest, type InstallManifest, type TableKeyRecord } from "../src/activate.ts";
import { type CodexRunner } from "../src/features.ts";

const CONFIG_BASE = "[memories]\ngenerate_memories = true\ndedicated_tools = true\n";

function setup(config = CONFIG_BASE) {
  const home = mkdtempSync(join(tmpdir(), "cxc-drift-"));
  const configPath = join(home, "config.toml");
  writeFileSync(configPath, config, "utf8");
  return { home, configPath };
}

/** A runner that reports every declared flag as disabled and records its calls. */
function makeRunner(opts: { throwOnList?: boolean } = {}) {
  const calls: string[][] = [];
  const run: CodexRunner = (args) => {
    calls.push([...args]);
    if (args[0] === "features" && args[1] === "list") {
      if (opts.throwOnList) return { stdout: "", stderr: "codex: command not found", exitCode: 127 };
      return {
        stdout: [
          "multi_agent  stable  false",
          "goals  stable  false",
          "hooks  stable  false",
          "default_mode_request_user_input  under-development  false",
        ].join("\n"),
        stderr: "",
        exitCode: 0,
      };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  return { run, calls };
}

function writeManifest(
  home: string,
  configPath: string,
  tableKeys: Record<string, TableKeyRecord>,
  opts: { hashOf?: string | null; version?: 1 | 2; backupPath?: string | null } = {},
) {
  const hash =
    opts.hashOf === undefined
      ? createHash("sha256").update(readFileSync(configPath)).digest("hex")
      : opts.hashOf;
  const manifest: InstallManifest = {
    version: opts.version ?? 2,
    activatedAt: "2026-08-29T00:00:00.000Z",
    configPath,
    backupPath: opts.backupPath ?? null,
    postActivateHash: hash,
    flags: {},
    tableKeys,
  };
  writeFileSync(manifestPath(home), JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

const ours = (priorValue: string | null): TableKeyRecord => ({
  table: "memories",
  key: "dedicated_tools",
  priorValue,
  appliedValue: "true",
  setByCodexclaw: true,
});

test("scenario 1: an unrelated line added before our key does not stop the revert", () => {
  const { home, configPath } = setup();
  writeManifest(home, configPath, { "memories.dedicated_tools": ours(null) });
  // external edit AFTER the manifest hash was taken
  writeFileSync(configPath, `# 사용자 주석\n${CONFIG_BASE}`, "utf8");
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.equal(r.fileDrifted, true);
  // priorValue=null + drift -> destructive path needs backup corroboration (blocker 5)
  assert.deepEqual(r.skippedExternal, [{ target: "memories.dedicated_tools", reason: "unverifiable" }]);
  assert.match(readFileSync(configPath, "utf8"), /# 사용자 주석/);
});

test("scenario 1b: with a backup confirming the key was absent, the drifted removal proceeds", () => {
  const { home, configPath } = setup();
  const backupPath = join(home, "config.toml.bak");
  // the backup is the pre-install state: no dedicated_tools at all
  writeFileSync(backupPath, "[memories]\ngenerate_memories = true\n", "utf8");
  writeManifest(home, configPath, { "memories.dedicated_tools": ours(null) }, { backupPath });
  writeFileSync(configPath, `# 사용자 주석\n${CONFIG_BASE}`, "utf8");
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.deepEqual(r.restoredKeys, ["memories.dedicated_tools"]);
  const after = readFileSync(configPath, "utf8");
  assert.equal(/dedicated_tools/.test(after), false);
  assert.match(after, /# 사용자 주석/, "the foreign comment survives");
  assert.match(after, /generate_memories = true/, "the foreign key survives");
});

test("scenario 2: an externally changed value is left alone", () => {
  const { home, configPath } = setup("[memories]\ndedicated_tools = false\n");
  writeManifest(home, configPath, { "memories.dedicated_tools": ours("false") });
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.deepEqual(r.skippedExternal, [{ target: "memories.dedicated_tools", reason: "changed" }]);
  assert.equal(readFileSync(configPath, "utf8"), "[memories]\ndedicated_tools = false\n");
});

test("scenario 3: an externally deleted key is reported missing, not an error", () => {
  const { home, configPath } = setup("[memories]\ngenerate_memories = true\n");
  writeManifest(home, configPath, { "memories.dedicated_tools": ours(null) });
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.deepEqual(r.skippedExternal, [{ target: "memories.dedicated_tools", reason: "missing" }]);
});

test("scenario 4: priorValue=null removes only our key line", () => {
  const { home, configPath } = setup();
  writeManifest(home, configPath, { "memories.dedicated_tools": ours(null) });
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.deepEqual(r.restoredKeys, ["memories.dedicated_tools"]);
  const after = readFileSync(configPath, "utf8");
  assert.match(after, /\[memories\]/, "the header stays");
  assert.match(after, /generate_memories = true/);
  assert.equal(/dedicated_tools/.test(after), false);
});

test("scenario 5: priorValue='false' puts the old value back", () => {
  const { home, configPath } = setup();
  writeManifest(home, configPath, { "memories.dedicated_tools": ours("false") });
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.deepEqual(r.restoredKeys, ["memories.dedicated_tools"]);
  assert.match(readFileSync(configPath, "utf8"), /dedicated_tools = false/);
});

test("scenario 6: a v1 manifest with no tableKeys is handled without error", () => {
  const { home, configPath } = setup();
  writeManifest(home, configPath, {}, { version: 1 });
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.equal(r.noManifest, false);
  assert.deepEqual(r.restoredKeys, []);
  assert.equal(readFileSync(configPath, "utf8"), CONFIG_BASE);
});

test("scenario 7: setByCodexclaw=false means we never touch the key", () => {
  const { home, configPath } = setup();
  writeManifest(home, configPath, {
    "memories.dedicated_tools": { ...ours(null), setByCodexclaw: false },
  });
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.deepEqual(r.restoredKeys, []);
  assert.equal(readFileSync(configPath, "utf8"), CONFIG_BASE);
});

test("blocker 1: a flag revert and a key revert in one call both survive", () => {
  const { home, configPath } = setup();
  const hash = createHash("sha256").update(readFileSync(configPath)).digest("hex");
  const manifest: InstallManifest = {
    version: 2,
    activatedAt: "2026-08-29T00:00:00.000Z",
    configPath,
    backupPath: null,
    postActivateHash: hash,
    flags: { goals: { priorEnabled: false, enabledByCodexclaw: true, enableFailed: false } },
    tableKeys: { "memories.dedicated_tools": ours(null) },
  };
  writeFileSync(manifestPath(home), JSON.stringify(manifest, null, 2), "utf8");
  // report the flag as still enabled so the disable call is actually issued
  const calls: string[][] = [];
  const run: CodexRunner = (args) => {
    calls.push([...args]);
    if (args[0] === "features" && args[1] === "list") {
      return { stdout: "goals  stable  true\n", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const r = deactivate({ run, codexHome: home, configPath });
  assert.deepEqual(r.disabled, ["goals"], "the flag pass ran");
  assert.deepEqual(r.restoredKeys, ["memories.dedicated_tools"], "the key pass ran");
  // the key write happened before the CLI call, and nothing undid it
  assert.equal(/dedicated_tools/.test(readFileSync(configPath, "utf8")), false);
  assert.ok(calls.some((c) => c[0] === "features" && c[1] === "disable" && c[2] === "goals"));
});

test("blocker 2: a broken codex does not fail the uninstall, and our key still reverts", () => {
  const { home, configPath } = setup();
  writeManifest(home, configPath, { "memories.dedicated_tools": ours(null) });
  const { run } = makeRunner({ throwOnList: true });
  const r = deactivate({ run, codexHome: home, configPath });
  assert.equal(r.featuresStateUnavailable, true);
  assert.deepEqual(r.restoredKeys, ["memories.dedicated_tools"]);
  assert.equal(/dedicated_tools/.test(readFileSync(configPath, "utf8")), false);
});

test("blocker 6: a malformed manifest is treated as absent, never guessed at", () => {
  const { home, configPath } = setup();
  writeFileSync(manifestPath(home), "{ not json", "utf8");
  const { run } = makeRunner();
  const r = deactivate({ run, codexHome: home, configPath });
  assert.equal(r.noManifest, true);
  assert.equal(readFileSync(configPath, "utf8"), CONFIG_BASE);
});

test("blocker 6: parseInstallManifest rejects bad shapes and accepts v1/v2", () => {
  assert.equal(parseInstallManifest("nope"), null);
  assert.equal(parseInstallManifest("[]"), null);
  assert.equal(parseInstallManifest('{"version":3,"configPath":"/x","flags":{}}'), null);
  assert.equal(parseInstallManifest('{"version":2,"flags":{}}'), null, "configPath is required");
  assert.equal(parseInstallManifest('{"version":2,"configPath":"/x"}'), null, "flags is required");
  const v1 = parseInstallManifest('{"version":1,"configPath":"/x","flags":{"goals":{"priorEnabled":false,"enabledByCodexclaw":true,"enableFailed":false}}}');
  assert.ok(v1);
  assert.equal(v1?.version, 1);
  assert.deepEqual(v1?.tableKeys, {}, "a v1 manifest reads as having no table keys");
  const badKey = parseInstallManifest('{"version":2,"configPath":"/x","flags":{},"tableKeys":{"a.b":{"table":"a"}}}');
  assert.equal(badKey, null, "an incomplete tableKeys record is rejected");
});

test("decideKeyRestore: the decision table, without touching a filesystem", () => {
  // not ours
  assert.deepEqual(decideKeyRestore({ ...ours(null), setByCodexclaw: false }, "true", false, null), {
    action: "skip",
    reason: "changed",
  });
  // gone
  assert.deepEqual(decideKeyRestore(ours(null), null, false, null), { action: "skip", reason: "missing" });
  // changed by someone else
  assert.deepEqual(decideKeyRestore(ours(null), "false", false, null), { action: "skip", reason: "changed" });
  // ours, no drift -> restore
  assert.deepEqual(decideKeyRestore(ours(null), "true", false, undefined), { action: "restore" });
  // ours, drifted, destructive, no backup -> refuse
  assert.deepEqual(decideKeyRestore(ours(null), "true", true, undefined), {
    action: "skip",
    reason: "unverifiable",
  });
  // ours, drifted, destructive, backup shows the key already existed -> refuse
  assert.deepEqual(decideKeyRestore(ours(null), "true", true, "false"), {
    action: "skip",
    reason: "unverifiable",
  });
  // ours, drifted, destructive, backup confirms absence -> restore
  assert.deepEqual(decideKeyRestore(ours(null), "true", true, null), { action: "restore" });
  // ours, drifted, NON-destructive (we only rewrite a value) -> restore
  assert.deepEqual(decideKeyRestore(ours("false"), "true", true, undefined), { action: "restore" });
});

