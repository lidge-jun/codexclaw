/**
 * soft-failure-visibility.test.ts — wp2 of 260829_request-user-input-autopilot.
 *
 * A soft flag's enable failure used to survive only as a boolean and a parenthetical
 * on the success line. The one flag in SOFT_FEATURES gates whether request_user_input
 * is exposed in Default mode, so it was also the only flag whose failure could not
 * fail anything — the exact opposite of what the user needs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activate, manifestPath, parseInstallManifest, type InstallManifest } from "../src/activate.ts";
import { SOFT_FEATURES, SOFT_FEATURE_IMPACT, DECLARED_FEATURES, type CodexRunner } from "../src/features.ts";
import { renderSoftFailureWarning } from "../src/cli.ts";

const SOFT = "default_mode_request_user_input";

function tempHome(): { home: string; configPath: string } {
  const home = mkdtempSync(join(tmpdir(), "cxc-soft-"));
  const configPath = join(home, "config.toml");
  writeFileSync(configPath, "[features]\n");
  return { home, configPath };
}

/** All declared flags report false; only the soft one fails to enable. */
function runnerFailingSoftOnly(exitCode: number, stderr: string): CodexRunner {
  return (args) => {
    if (args[0] === "features" && args[1] === "list") {
      return { stdout: DECLARED_FEATURES.map((k) => `${k}  stable  false`).join("\n"), stderr: "", exitCode: 0 };
    }
    if (args[1] === "enable" && args[2] === SOFT) return { stdout: "", stderr, exitCode };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

test("a soft enable failure records its exit code and stderr in the manifest", () => {
  const { home, configPath } = tempHome();
  const m: InstallManifest = activate({ run: runnerFailingSoftOnly(2, "error: unknown feature key"), codexHome: home, configPath });
  assert.equal(m.flags[SOFT].enableFailed, true);
  assert.equal(m.flags[SOFT].failure?.exitCode, 2);
  assert.match(m.flags[SOFT].failure?.message ?? "", /unknown feature key/);
  // The other declared flags are unaffected.
  for (const key of DECLARED_FEATURES) {
    if (key === SOFT) continue;
    assert.equal(m.flags[key].enabledByCodexclaw, true);
    assert.equal(m.flags[key].failure, undefined);
  }
});

test("the failure field round-trips through parseInstallManifest", () => {
  const { home, configPath } = tempHome();
  activate({ run: runnerFailingSoftOnly(2, "boom"), codexHome: home, configPath });
  const reparsed = parseInstallManifest(readFileSync(manifestPath(home), "utf8"));
  assert.ok(reparsed, "manifest should parse");
  assert.equal(reparsed?.flags[SOFT].failure?.exitCode, 2);
  assert.equal(reparsed?.flags[SOFT].failure?.message, "boom");
});

test("a malformed failure field drops that field without rejecting the manifest", () => {
  const { home } = tempHome();
  const raw = JSON.stringify({
    version: 2,
    activatedAt: "2026-08-29T00:00:00.000Z",
    configPath: join(home, "config.toml"),
    backupPath: null,
    postActivateHash: null,
    flags: { [SOFT]: { priorEnabled: false, enabledByCodexclaw: false, enableFailed: true, failure: "not an object" } },
    tableKeys: {},
  });
  const parsed = parseInstallManifest(raw);
  assert.ok(parsed, "a bad failure field must not void the manifest");
  assert.equal(parsed?.flags[SOFT].enableFailed, true);
  assert.equal(parsed?.flags[SOFT].failure, undefined);
});

test("a hard flag failure still throws", () => {
  const { home, configPath } = tempHome();
  const run: CodexRunner = (args) => {
    if (args[0] === "features" && args[1] === "list") {
      return { stdout: DECLARED_FEATURES.map((k) => `${k}  stable  false`).join("\n"), stderr: "", exitCode: 0 };
    }
    if (args[1] === "enable" && args[2] === "goals") return { stdout: "", stderr: "nope", exitCode: 1 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  assert.throws(() => activate({ run, codexHome: home, configPath }), /codex features enable goals failed/);
});

test("every SOFT_FEATURES member has an impact statement", () => {
  for (const key of SOFT_FEATURES) {
    assert.equal(typeof SOFT_FEATURE_IMPACT[key], "string", `${key} has no impact statement`);
    assert.ok((SOFT_FEATURE_IMPACT[key] ?? "").length > 0);
  }
});

test("the warning names the impact, the exit code, and both recovery commands", () => {
  const out = renderSoftFailureWarning(SOFT, { priorEnabled: false, enabledByCodexclaw: false, enableFailed: true, failure: { exitCode: 2, message: "unknown feature key" } });
  assert.match(out, /경고/);
  assert.match(out, /exit 2/);
  assert.match(out, /request_user_input/);
  assert.match(out, /unknown feature key/);
  assert.match(out, /codex features list/);
  assert.match(out, new RegExp(`codex features enable ${SOFT}`));
});

test("the warning survives a missing record and an unknown key", () => {
  // No FlagRecord at all: still a complete, actionable message.
  const out = renderSoftFailureWarning(SOFT, undefined);
  assert.match(out, /경고/);
  assert.doesNotMatch(out, /exit/);
  assert.match(out, new RegExp(`codex features enable ${SOFT}`));
  // A key with no impact entry falls back instead of printing undefined.
  const unknown = renderSoftFailureWarning("some_future_flag", undefined);
  assert.doesNotMatch(unknown, /undefined/);
});
