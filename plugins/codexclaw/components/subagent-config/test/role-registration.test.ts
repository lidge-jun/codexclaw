import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supportsSymlinks, symlinkDirSync } from "../../cxc-ops/test-support/symlink-support.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { registerExecutor } from "../src/role-registration.ts";
import { parseSubagentsArgs } from "../src/cli.ts";

test("register executor publishes complete role, omits model sentinel and preserves user settings", (t) => {
  const home = mkdtempSync(join(tmpdir(), "executor-register-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  writeFileSync(join(home, "config.toml"), "# user config\n");
  mkdirSync(join(home, "agents"));
  writeFileSync(join(home, "agents/worker.toml"), "# legacy user role\n");
  const result = registerExecutor(home);
  assert.equal(result.created, true);
  const content = readFileSync(result.path, "utf8");
  const template = readFileSync(new URL("../../../agents/executor.toml", import.meta.url), "utf8");
  assert.equal(content.split('developer_instructions = ')[1], template.split('developer_instructions = ')[1]);
  assert.match(content, /^name = "executor"$/m);
  assert.doesNotMatch(content, /^(model|model_reasoning_effort|sandbox_mode|approval_policy)\s*=/m);
  assert.deepEqual(registerExecutor(home), { path: result.path, created: false });
  assert.equal(readFileSync(join(home, "config.toml"), "utf8"), "# user config\n");
  assert.equal(readFileSync(join(home, "agents/worker.toml"), "utf8"), "# legacy user role\n");
});

test("registration rejects conflicting file and directory without replacing them", (t) => {
  for (const kind of ["file", "directory"]) {
    const home = mkdtempSync(join(tmpdir(), "executor-conflict-"));
    t.after(() => rmSync(home, { recursive: true, force: true }));
    mkdirSync(join(home, "agents"));
    const path = join(home, "agents/executor.toml");
    if (kind === "file") writeFileSync(path, "# custom"); else mkdirSync(path);
    assert.throws(() => registerExecutor(home), /differs|non-regular/);
    if (kind === "file") assert.equal(readFileSync(path, "utf8"), "# custom");
  }
});

for (const kind of ["directory", "role"] as const) {
  test(`registration refuses symlink ${kind}`, (t) => {
    const support = supportsSymlinks();
    if (kind === "directory" ? !support.dir : !support.file) { t.skip("host cannot create this symlink type"); return; }
    const home = mkdtempSync(join(tmpdir(), "executor-symlink-"));
    t.after(() => rmSync(home, { recursive: true, force: true }));
    const outside = join(home, "outside"); mkdirSync(outside);
    if (kind === "directory") symlinkDirSync(outside, join(home, "agents"));
    else { mkdirSync(join(home, "agents")); symlinkSync(join(outside, "missing"), join(home, "agents/executor.toml")); }
    assert.throws(() => registerExecutor(home), /non-regular/);
    assert.equal(existsSync(join(outside, "executor.toml")), false);
    assert.equal(existsSync(join(outside, "missing")), false);
  });
}


test("register parser accepts only executor with no extra arguments", () => {
  assert.deepEqual(parseSubagentsArgs(["register", "executor"]), { action: "register", role: "executor" });
  for (const args of [["register"], ["register", "worker"], ["register", "executor", "--force"]]) {
    assert.ok(parseSubagentsArgs(args).error);
  }
});

test("native CLI registers concurrently in CODEX_HOME and refuses later conflicting content", async (t) => {
  const home = mkdtempSync(join(tmpdir(), "executor-cli-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
  const run = () => promisify(execFile)(process.execPath, [cli, "subagents", "register", "executor"], { env: { ...process.env, CODEX_HOME: home } });
  const results = await Promise.all([run(), run()]);
  assert.equal(results.filter(r => r.stdout.startsWith("Registered:")).length, 1);
  assert.equal(results.filter(r => r.stdout.startsWith("Already registered:")).length, 1);
  const role = join(home, "agents/executor.toml");
  assert.match(readFileSync(role, "utf8"), /^name = "executor"$/m);
  writeFileSync(role, "# user's customized executor\n");
  await assert.rejects(run(), /Existing executor role differs/);
  assert.equal(readFileSync(role, "utf8"), "# user's customized executor\n");
});
