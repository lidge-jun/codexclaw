import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { applyManagedKey, readManagedState, resolveManagedKey } from "../src/config-set.ts";
import { manifestPath, parseInstallManifest, type InstallManifest } from "../src/activate.ts";
import { deactivate } from "../src/deactivate.ts";
import { type CodexRunner } from "../src/features.ts";

const KEY = "memories.dedicated_tools";
const CONFIG = "[memories]\ngenerate_memories = true\n";

function setup(config = CONFIG, withManifest = true) {
  const home = mkdtempSync(join(tmpdir(), "cxc-set-"));
  const configPath = join(home, "config.toml");
  writeFileSync(configPath, config, "utf8");
  if (withManifest) {
    const manifest: InstallManifest = {
      version: 2,
      activatedAt: "2026-08-29T00:00:00.000Z",
      configPath,
      backupPath: null,
      postActivateHash: createHash("sha256").update(readFileSync(configPath)).digest("hex"),
      flags: {},
      tableKeys: {},
    };
    writeFileSync(manifestPath(home), JSON.stringify(manifest, null, 2), "utf8");
  }
  return { home, configPath };
}

const noopRunner: CodexRunner = () => ({ stdout: "", stderr: "", exitCode: 0 });

test("set writes the key AND records it, so disable can revert it", () => {
  const { home, configPath } = setup();
  const res = applyManagedKey({ codexHome: home, configPath }, KEY, true);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.changed, true);
  assert.equal(res.priorValue, null);
  assert.match(readFileSync(configPath, "utf8"), /dedicated_tools = true/);

  // the manifest carries what deactivate needs
  const m = parseInstallManifest(readFileSync(manifestPath(home), "utf8"));
  assert.ok(m);
  const rec = m?.tableKeys?.[KEY];
  assert.ok(rec, "the key must be recorded or it can never be reverted");
  assert.equal(rec?.priorValue, null);
  assert.equal(rec?.appliedValue, "true");
  assert.equal(rec?.setByCodexclaw, true);

  // end-to-end: the uninstall path actually undoes it
  const d = deactivate({ run: noopRunner, codexHome: home, configPath });
  assert.deepEqual(d.restoredKeys, [KEY]);
  const after = readFileSync(configPath, "utf8");
  assert.equal(/dedicated_tools/.test(after), false);
  assert.match(after, /generate_memories = true/, "the foreign key survives");
});

test("set backs up config.toml before writing", () => {
  const { home, configPath } = setup();
  const res = applyManagedKey({ codexHome: home, configPath, now: () => "2026-08-29T01:02:03.456Z" }, KEY, true);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.ok(res.backupPath, "a backup path must be reported");
  assert.ok(existsSync(res.backupPath!), "the backup must exist on disk");
  assert.equal(readFileSync(res.backupPath!, "utf8"), CONFIG, "the backup holds the pre-write content");
});

test("blocker 3: without an install manifest, set REFUSES instead of writing unrevertably", () => {
  const { home, configPath } = setup(CONFIG, false);
  const res = applyManagedKey({ codexHome: home, configPath }, KEY, true);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.match(res.reason, /cxc enable/);
  assert.equal(readFileSync(configPath, "utf8"), CONFIG, "config.toml is untouched");
});

test("a non-whitelisted key is refused and never reaches the file", () => {
  const { home, configPath } = setup();
  const res = applyManagedKey({ codexHome: home, configPath }, "tools.dangerous", true);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.match(res.reason, /not a codexclaw-managed key/);
  assert.equal(readFileSync(configPath, "utf8"), CONFIG);
  const resolved = resolveManagedKey("tools.dangerous");
  assert.ok("error" in resolved);
});

test("setting twice keeps the ORIGINAL prior value, so history cannot be rewritten", () => {
  const { home, configPath } = setup("[memories]\ndedicated_tools = false\n");
  const first = applyManagedKey({ codexHome: home, configPath }, KEY, true);
  assert.ok(first.ok);
  const second = applyManagedKey({ codexHome: home, configPath }, KEY, true);
  assert.ok(second.ok);
  const m = parseInstallManifest(readFileSync(manifestPath(home), "utf8"));
  assert.equal(m?.tableKeys?.[KEY]?.priorValue, "false", "must still be the user's original value");
});

test("unset restores the recorded prior value and drops the record", () => {
  const { home, configPath } = setup("[memories]\ndedicated_tools = false\n");
  applyManagedKey({ codexHome: home, configPath }, KEY, true);
  const res = applyManagedKey({ codexHome: home, configPath }, KEY, null);
  assert.ok(res.ok);
  assert.match(readFileSync(configPath, "utf8"), /dedicated_tools = false/);
  const m = parseInstallManifest(readFileSync(manifestPath(home), "utf8"));
  assert.equal(m?.tableKeys?.[KEY], undefined, "the record is cleared");
});

test("unset without a record is refused", () => {
  const { home, configPath } = setup();
  const res = applyManagedKey({ codexHome: home, configPath }, KEY, null);
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.reason, /not recorded/);
});

test("readManagedState reports live values for the whitelist", () => {
  const { configPath } = setup();
  const before = readManagedState(configPath);
  assert.equal(before.length, 1);
  assert.equal(before[0].value, null);
  writeFileSync(configPath, "[memories]\ndedicated_tools = true\n", "utf8");
  assert.equal(readManagedState(configPath)[0].value, "true");
});

