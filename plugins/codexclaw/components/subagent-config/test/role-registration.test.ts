import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { createHash } from "node:crypto";
import { supportsSymlinks, symlinkDirSync } from "../../cxc-ops/test-support/symlink-support.ts";
import { registerArchitect, registerExecutor, registerRole, resolveNativeRoleHome } from "../src/role-registration.ts";
import { parseSubagentsArgs, runSubagents } from "../src/cli.ts";

const TASK_TMP = tmpdir();

function tmp(prefix: string): string {
  return mkdtempSync(join(TASK_TMP, prefix));
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function expectedFields(role: "architect" | "executor") {
  return {
    name: new RegExp(`^name = "${role}"$`, "m"),
    sandbox: role === "architect" ? /sandbox_mode\s*=\s*"read-only"/ : /^(model|model_reasoning_effort|sandbox_mode|approval_policy)\s*=/m,
  };
}

for (const role of ["executor", "architect"] as const) {
  test(`register ${role} publishes complete role, omits model sentinel and preserves user settings`, (t) => {
    const home = tmp(`${role}-register-`);
    t.after(() => rmSync(home, { recursive: true, force: true }));
    writeFileSync(join(home, "config.toml"), "# user config\n");
    mkdirSync(join(home, "agents"));
    writeFileSync(join(home, "agents/worker.toml"), "# legacy user role\n");
    const result = registerRole(role, home);
    assert.equal(result.created, true);
    const content = readFileSync(result.path, "utf8");
    const template = readFileSync(new URL(`../../../agents/${role}.toml`, import.meta.url), "utf8");
    assert.equal(content.split("developer_instructions = ")[1], template.split("developer_instructions = ")[1]);
    assert.match(content, expectedFields(role).name);
    if (role === "architect") {
      assert.match(content, /^sandbox_mode = "read-only"$/m);
      assert.doesNotMatch(content, /^(model|model_reasoning_effort|approval_policy)\s*=/m);
    } else {
      assert.doesNotMatch(content, expectedFields(role).sandbox);
    }
    assert.deepEqual(registerRole(role, home), { path: result.path, created: false });
    assert.equal(readFileSync(join(home, "config.toml"), "utf8"), "# user config\n");
    assert.equal(readFileSync(join(home, "agents/worker.toml"), "utf8"), "# legacy user role\n");
  });
}

for (const role of ["executor", "architect"] as const) {
  test(`${role} registration rejects conflicting file and directory without replacing them`, (t) => {
    for (const kind of ["file", "directory"]) {
      const home = tmp(`${role}-conflict-`);
      t.after(() => rmSync(home, { recursive: true, force: true }));
      mkdirSync(join(home, "agents"));
      const path = join(home, `agents/${role}.toml`);
      if (kind === "file") writeFileSync(path, "# custom"); else mkdirSync(path);
      assert.throws(() => registerRole(role, home), /differs|non-regular/);
      if (kind === "file") assert.equal(readFileSync(path, "utf8"), "# custom");
    }
  });
}

for (const role of ["executor", "architect"] as const) {
  for (const kind of ["directory", "role"] as const) {
    test(`${role} registration refuses symlink ${kind}`, (t) => {
      const support = supportsSymlinks();
      if (kind === "directory" ? !support.dir : !support.file) { t.skip("host cannot create this symlink type"); return; }
      const home = tmp(`${role}-symlink-`);
      t.after(() => rmSync(home, { recursive: true, force: true }));
      const outside = join(home, "outside"); mkdirSync(outside);
      if (kind === "directory") symlinkDirSync(outside, join(home, "agents"));
      else { mkdirSync(join(home, "agents")); symlinkSync(join(outside, "missing"), join(home, `agents/${role}.toml`)); }
      assert.throws(() => registerRole(role, home), /non-regular/);
      assert.equal(existsSync(join(outside, `${role}.toml`)), false);
      assert.equal(existsSync(join(outside, "missing")), false);
    });
  }
}

test("register parser accepts only executor or architect with no extra arguments", () => {
  assert.deepEqual(parseSubagentsArgs(["register", "executor"]), { action: "register", role: "executor" });
  assert.deepEqual(parseSubagentsArgs(["register", "architect"]), { action: "register", role: "architect" });
  for (const args of [
    ["register"],
    ["register", "worker"],
    ["register", "explorer"],
    ["register", "executor", "--force"],
    ["register", "architect", "--global"],
    ["register", "executor", "--global"],
  ]) {
    const parsed = parseSubagentsArgs(args);
    assert.equal(parsed.action, "register");
    assert.ok(parsed.error);
    assert.equal(parsed.scope, undefined);
  }
});

test("registerRole rejects invalid runtime role input even from untyped callers", (t) => {
  const home = tmp("invalid-role-");
  t.after(() => rmSync(home, { recursive: true, force: true }));
  assert.throws(() => (registerRole as (role: unknown, home?: string) => unknown)("../etc/passwd", home), /unsupported native role/);
  assert.throws(() => (registerRole as (role: unknown, home?: string) => unknown)("reviewer", home), /unsupported native role/);
  assert.equal(existsSync(join(home, "agents")), false);
});

test("resolveNativeRoleHome uses explicit env, then injected userHome, and default binding is read-only", () => {
  const envRoot = join(TASK_TMP, "resolver-env");
  const injectedHome = join(TASK_TMP, "resolver-user");
  assert.equal(resolveNativeRoleHome({ CODEX_HOME: envRoot }, "/unused-home"), envRoot);
  assert.equal(resolveNativeRoleHome({ CODEX_HOME: "  /spaced-codex  " }, injectedHome), "  /spaced-codex  ");
  assert.equal(resolveNativeRoleHome({ CODEX_HOME: "" }, injectedHome), join(injectedHome, ".codex"));
  assert.equal(resolveNativeRoleHome({}, injectedHome), join(injectedHome, ".codex"));
  const production = resolveNativeRoleHome();
  assert.equal(production, resolveNativeRoleHome(process.env, homedir()));
  const realHome = tmp("resolver-register-");
  const result = registerArchitect(resolveNativeRoleHome({ CODEX_HOME: realHome }, "/unused"));
  assert.equal(result.created, true);
  assert.equal(result.path, join(realHome, "agents/architect.toml"));
  rmSync(realHome, { recursive: true, force: true });
});

test("explicit blank codexHome throws before any write and does not use the default home", () => {
  const bound = resolveNativeRoleHome();
  const sentinel = join(bound, "agents/architect.toml");
  const existed = existsSync(sentinel);
  const before = existed ? readFileSync(sentinel, "utf8") : null;
  assert.throws(() => registerArchitect(""), /invalid native role home/);
  assert.throws(() => registerExecutor(" \t"), /invalid native role home/);
  assert.throws(() => (registerRole as (role: string, home?: unknown) => unknown)("architect", null), /invalid native role home/);
  if (existed) assert.equal(readFileSync(sentinel, "utf8"), before);
  else assert.equal(existsSync(sentinel), false);
});

test("explicit nonempty home preserves surrounding space bytes", (t) => {
  const inner = tmp("inner-home-");
  t.after(() => rmSync(inner, { recursive: true, force: true }));
  const dest = join(inner, " padded ");
  const result = registerArchitect(dest);
  assert.equal(result.path, join(dest, "agents/architect.toml"));
  assert.equal(existsSync(join(inner, "agents/architect.toml")), false);
});

function concurrentRegister(role: "architect" | "executor", home: string): Promise<{ created: boolean; updated?: boolean; path: string }> {
  const moduleUrl = new URL("../src/role-registration.ts", import.meta.url).href;
  const source = `
    import { parentPort, workerData } from "node:worker_threads";
    import { registerRole } from ${JSON.stringify(moduleUrl)};
    const result = registerRole(workerData.role, workerData.home);
    parentPort.postMessage(result);
  `;
  return new Promise((resolve, reject) => {
    const worker = new Worker(source, { eval: true, workerData: { role, home } });
    worker.once("message", resolve);
    worker.once("error", reject);
  });
}

for (const role of ["executor", "architect"] as const) {
  test(`native runner registers ${role} concurrently with explicit root and refuses later conflicting content`, async (t) => {
    const home = tmp(`${role}-cli-`);
    t.after(() => rmSync(home, { recursive: true, force: true }));
    const cwd = tmp(`${role}-cwd-`);
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    const parsed = parseSubagentsArgs(["register", role]);
    const [first, second] = await Promise.all([
      concurrentRegister(role, home),
      concurrentRegister(role, home),
    ]);
    const created = [first, second].filter((r) => r.created).length;
    const already = [first, second].filter((r) => !r.created && !r.updated).length;
    assert.equal(created, 1);
    assert.equal(already, 1);
    const viaRunner = runSubagents(parsed, cwd, home);
    assert.equal(viaRunner.code, 0);
    assert.match(viaRunner.output, /^Already registered:/);
    const rolePath = join(home, `agents/${role}.toml`);
    assert.match(readFileSync(rolePath, "utf8"), expectedFields(role).name);
    writeFileSync(rolePath, `# user's customized ${role}\n`);
    const refused = runSubagents(parsed, cwd, home);
    assert.equal(refused.code, 1);
    assert.match(refused.output, new RegExp(`Existing ${role} role differs`));
    assert.equal(readFileSync(rolePath, "utf8"), `# user's customized ${role}\n`);
  });
}

for (const role of ["executor", "architect"] as const) {
  test(`${role} registration upgrades intact managed prompts, keeps a backup and preserves edited prompts`, (t) => {
    const home = tmp(`${role}-update-`);
    t.after(() => rmSync(home, { recursive: true, force: true }));
    mkdirSync(join(home, "agents"));
    const path = join(home, `agents/${role}.toml`);
    const old = `name = "${role}"\ndeveloper_instructions = "previous shipped prompt"\n`;
    const signed = `# codexclaw-managed: ${hash(old)}\n${old}`;
    writeFileSync(path, signed);
    assert.equal(registerRole(role, home).updated, true);
    assert.equal(readFileSync(join(home, "agents", `${role}.toml.backup-${hash(signed)}`), "utf8"), signed);
    assert.match(readFileSync(path, "utf8"), /^# codexclaw-managed: [a-f0-9]{64}\n/);
    assert.equal(registerRole(role, home).created, false);
    const edited = readFileSync(path, "utf8") + "# user edit\n";
    writeFileSync(path, edited);
    assert.throws(() => registerRole(role, home), /differs/);
    assert.equal(readFileSync(path, "utf8"), edited);
  });
}

for (const role of ["executor", "architect"] as const) {
  test(`identical legacy ${role} role is adopted without losing its previous bytes`, (t) => {
    const home = tmp(`${role}-adopt-`);
    t.after(() => rmSync(home, { recursive: true, force: true }));
    const first = registerRole(role, home);
    const body = readFileSync(first.path, "utf8").replace(/^# codexclaw-managed: [a-f0-9]{64}\n/, "");
    writeFileSync(first.path, body);
    assert.equal(registerRole(role, home).updated, true);
    assert.equal(readFileSync(first.path, "utf8").split("\n").slice(1).join("\n"), body);
  });
}

test("compatibility entrypoints registerExecutor and registerArchitect share one algorithm", (t) => {
  const home = tmp("compat-");
  t.after(() => rmSync(home, { recursive: true, force: true }));
  assert.equal(registerExecutor(home).created, true);
  assert.equal(registerArchitect(home).created, true);
  assert.match(readFileSync(join(home, "agents/executor.toml"), "utf8"), /^name = "executor"$/m);
  assert.match(readFileSync(join(home, "agents/architect.toml"), "utf8"), /^sandbox_mode = "read-only"$/m);
});

test("abandoned update lock fails closed and preserves the existing role file", (t) => {
  const home = tmp("lock-");
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const first = registerArchitect(home);
  const original = readFileSync(first.path, "utf8");
  const unsigned = original.replace(/^# codexclaw-managed: [a-f0-9]{64}\n/, "");
  writeFileSync(first.path, unsigned);
  mkdirSync(join(home, "agents/.architect-update.lock"));
  assert.throws(() => registerArchitect(home), /EEXIST|file already exists|mkdir/i);
  assert.equal(readFileSync(first.path, "utf8"), unsigned);
});

test("runner surfaces registration errors without throwing", (t) => {
  const cwd = tmp("runner-cwd-");
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const home = tmp("runner-home-");
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, "agents"), { recursive: true });
  writeFileSync(join(home, "agents/architect.toml"), "# custom architect\n");
  const result = runSubagents(parseSubagentsArgs(["register", "architect"]), cwd, home);
  assert.equal(result.code, 1);
  assert.match(result.output, /^subagents: Existing architect role differs/);
  assert.equal(readFileSync(join(home, "agents/architect.toml"), "utf8"), "# custom architect\n");
});
