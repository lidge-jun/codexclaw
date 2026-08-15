/**
 * manifest-targets: shared build/doctor validator (WP7 / plan 080).
 *
 * Expected messages are hardcoded, never derived from the module under test —
 * otherwise the oracle would just echo whatever the implementation produces
 * (TEST-ORACLE-INDEPENDENCE-01). The four legacy strings below are the exact
 * ones `scripts/build.mjs` emitted before this module existed; keeping them
 * byte-identical is what proves the refactor did not silently change the build
 * contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TargetParseError, validateManifestTargets } from "../src/manifest-targets.ts";
import { runDoctor } from "../src/doctor.ts";

const REPO_PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface RootOpts {
  hookCommand?: string;
  hookCommandWindows?: string;
  /** dist files to actually create, relative to the plugin root. */
  present?: string[];
  mcpArgs?: string[];
  /** write these raw instead of valid JSON. */
  brokenHookJson?: boolean;
  brokenMcpJson?: boolean;
  omitMcpFile?: boolean;
  omitHookFile?: boolean;
}

function makeRoot(opts: RootOpts = {}): string {
  const root = mkdtempSync(join(tmpdir(), "cxc-targets-"));
  mkdirSync(join(root, ".codex-plugin"), { recursive: true });
  writeFileSync(
    join(root, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: "t", version: "0.0.1", hooks: ["./hooks/a.json"], mcpServers: "./.mcp.json" }),
  );

  if (!opts.omitHookFile) {
    mkdirSync(join(root, "hooks"), { recursive: true });
    const handler: Record<string, string> = {};
    if (opts.hookCommand !== undefined) handler.command = opts.hookCommand;
    if (opts.hookCommandWindows !== undefined) handler.commandWindows = opts.hookCommandWindows;
    writeFileSync(
      join(root, "hooks", "a.json"),
      opts.brokenHookJson ? "{not json" : JSON.stringify({ hooks: { SessionStart: [{ hooks: [handler] }] } }),
    );
  }

  if (!opts.omitMcpFile) {
    writeFileSync(
      join(root, ".mcp.json"),
      opts.brokenMcpJson ? "{not json" : JSON.stringify({ mcpServers: { t: { command: "node", args: opts.mcpArgs ?? [] } } }),
    );
  }

  for (const rel of opts.present ?? []) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "// stub\n");
  }
  return root;
}

// ---- A. legacy build guards preserved -------------------------------------

test("A1: manifest declares a hook file that does not exist", () => {
  const root = makeRoot({ omitHookFile: true });
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: "manifest hook file missing: ./hooks/a.json" },
  ]);
});

test("A2: hook command points at a missing dist file", () => {
  const root = makeRoot({ hookCommand: 'node "${PLUGIN_ROOT}/components/x/dist/cli.js" hook stop' });
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: "hook references missing dist: components/x/dist/cli.js" },
  ]);
});

test("A3: manifest declares an mcp file that does not exist", () => {
  const root = makeRoot({ omitMcpFile: true });
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "mcp", message: "manifest mcpServers file missing: ./.mcp.json" },
  ]);
});

test("A4: mcp args point at a missing dist file", () => {
  const root = makeRoot({ mcpArgs: ["./components/y/dist/mcp.js"] });
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "mcp", message: "mcp server t references missing dist: ./components/y/dist/mcp.js" },
  ]);
});

test("A5: malformed hook json throws a hook-kinded SyntaxError", () => {
  const root = makeRoot({ brokenHookJson: true });
  assert.throws(
    () => validateManifestTargets(root),
    (err: unknown) => {
      assert.ok(err instanceof SyntaxError, "must stay a SyntaxError for build compatibility");
      assert.ok(err instanceof TargetParseError);
      assert.equal(err.kind, "hook");
      assert.equal(err.path, join(root, "hooks", "a.json"));
      return true;
    },
  );
});

test("A6: malformed mcp json throws an mcp-kinded SyntaxError", () => {
  const root = makeRoot({ brokenMcpJson: true });
  assert.throws(
    () => validateManifestTargets(root),
    (err: unknown) => {
      assert.ok(err instanceof SyntaxError);
      assert.ok(err instanceof TargetParseError);
      assert.equal(err.kind, "mcp");
      return true;
    },
  );
});

// ---- B. new checks ---------------------------------------------------------

test("B1: zero-byte targets are rejected (hook and mcp)", () => {
  const root = makeRoot({
    hookCommand: 'node "${PLUGIN_ROOT}/components/x/dist/cli.js"',
    mcpArgs: ["./components/y/dist/mcp.js"],
  });
  for (const rel of ["components/x/dist/cli.js", "components/y/dist/mcp.js"]) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), "");
  }
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: "target is empty: components/x/dist/cli.js" },
    { kind: "mcp", message: "target is empty: ./components/y/dist/mcp.js" },
  ]);
});

test("B2: a ../ target resolving outside the plugin root is rejected", () => {
  const root = makeRoot({ hookCommand: 'node "${PLUGIN_ROOT}/../escape.js"' });
  writeFileSync(join(root, "..", "escape.js"), "// outside\n");
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: "target escapes plugin root: ../escape.js" },
  ]);
});

test("B3: a symlink pointing outside the plugin root is rejected", () => {
  const root = makeRoot({ hookCommand: 'node "${PLUGIN_ROOT}/components/x/dist/cli.js"' });
  const outside = mkdtempSync(join(tmpdir(), "cxc-outside-"));
  writeFileSync(join(outside, "evil.js"), "// elsewhere\n");
  mkdirSync(join(root, "components", "x", "dist"), { recursive: true });
  symlinkSync(join(outside, "evil.js"), join(root, "components", "x", "dist", "cli.js"));
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: "target escapes plugin root: components/x/dist/cli.js" },
  ]);
});

test("B3b: manifest hook documents themselves cannot escape the plugin root", () => {
  const root = makeRoot();
  writeFileSync(join(root, "..", "outside-hook.json"), JSON.stringify({ hooks: {} }));
  writeFileSync(
    join(root, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: "t", hooks: ["../outside-hook.json"] }),
  );
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: "manifest hook file escapes plugin root: ../outside-hook.json" },
  ]);
});

// The exact upstream value — backslash separators, a .ps1 launcher and a .js
// entry point inside one command. Copied from
// devlog/.lazycodex/plugins/omo/hooks/session-start-loading-project-rules.json:11.
// String.raw keeps the backslashes; a plain literal would silently eat them.
const WINDOWS_COMMAND = String.raw`powershell -NoProfile -ExecutionPolicy Bypass -File "${"$"}{PLUGIN_ROOT}\components\bootstrap\scripts\node-dispatch.ps1" "${"$"}{PLUGIN_ROOT}\components\rules\dist\cli.js" hook session-start`;
const PS1_REL = "components/bootstrap/scripts/node-dispatch.ps1";
const JS_REL = "components/rules/dist/cli.js";

test("B4a: commandWindows with only the .ps1 launcher missing", () => {
  const root = makeRoot({ hookCommandWindows: WINDOWS_COMMAND, present: [JS_REL] });
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: `hook references missing dist: ${PS1_REL}` },
  ]);
});

test("B4b: commandWindows with only the .js target missing", () => {
  const root = makeRoot({ hookCommandWindows: WINDOWS_COMMAND, present: [PS1_REL] });
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: `hook references missing dist: ${JS_REL}` },
  ]);
});

test("B4c: commandWindows with both targets missing reports both", () => {
  const root = makeRoot({ hookCommandWindows: WINDOWS_COMMAND });
  assert.deepEqual(validateManifestTargets(root), [
    { kind: "hook", message: `hook references missing dist: ${PS1_REL}` },
    { kind: "hook", message: `hook references missing dist: ${JS_REL}` },
  ]);
});

test("B4d: commandWindows with both targets present is clean on POSIX", () => {
  const root = makeRoot({ hookCommandWindows: WINDOWS_COMMAND, present: [PS1_REL, JS_REL] });
  assert.deepEqual(validateManifestTargets(root), []);
});

// ---- C. real installed-shape payload --------------------------------------

function copyRealPayload(): string {
  const root = join(mkdtempSync(join(tmpdir(), "cxc-payload-")), "codexclaw");
  cpSync(REPO_PLUGIN_ROOT, root, { recursive: true, dereference: true });
  return root;
}

test("C1: the real payload copied to a fresh absolute root validates clean", () => {
  const root = copyRealPayload();
  assert.deepEqual(validateManifestTargets(root), []);
});

test("C2: deleting a target referenced exactly once yields exactly one issue", () => {
  const root = copyRealPayload();
  rmSync(join(root, "components/provider-bridge/dist/cli.js"));
  const issues = validateManifestTargets(root);
  // 1 is hardcoded: provider-bridge/dist/cli.js is referenced by a single hook.
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, "hook");
  assert.match(issues[0]?.message ?? "", /provider-bridge\/dist\/cli\.js/);
});

test("C2b: deleting a shared target yields one issue per reference", () => {
  const root = copyRealPayload();
  rmSync(join(root, "components/pabcd-state/dist/cli.js"));
  // 15 is hardcoded: fifteen hooks reference pabcd-state/dist/cli.js today (11 +
  // the 3 worktree-guard hooks 260804 + the review observer 260815). If a hook is
  // added or removed this test should fail and be updated deliberately.
  assert.equal(validateManifestTargets(root).length, 15);
});

// ---- D. doctor integration -------------------------------------------------

test("D6: malformed hook json -> hooks FAIL, mcp-targets WARN not evaluated", () => {
  const root = makeRoot({ brokenHookJson: true });
  const report = runDoctor(root);
  const hooks = report.checks.find((c) => c.name === "hooks");
  const mcp = report.checks.find((c) => c.name === "mcp-targets");
  assert.equal(hooks?.severity, "FAIL");
  assert.equal(mcp?.severity, "WARN");
  assert.match(mcp?.evidence ?? "", /not evaluated after hook parse failure/);
});

test("D7: malformed mcp json -> mcp-targets FAIL, hooks not blamed", () => {
  const root = makeRoot({ brokenMcpJson: true });
  const report = runDoctor(root);
  assert.equal(report.checks.find((c) => c.name === "mcp-targets")?.severity, "FAIL");
  assert.notEqual(report.checks.find((c) => c.name === "hooks")?.severity, "FAIL");
});

test("D8: a non-parse failure lands in a generic check, not hooks or mcp-targets", () => {
  const root = makeRoot();
  // Replace the hook file with a directory: reading it raises EISDIR, which
  // carries no kind. chmod 000 would be a no-op under a root CI user.
  rmSync(join(root, "hooks", "a.json"));
  mkdirSync(join(root, "hooks", "a.json"));
  const report = runDoctor(root);
  const generic = report.checks.find((c) => c.name === "manifest-targets");
  assert.equal(generic?.severity, "FAIL");
  assert.equal(report.checks.find((c) => c.name === "hooks"), undefined);
  assert.equal(report.checks.find((c) => c.name === "mcp-targets"), undefined);
});
