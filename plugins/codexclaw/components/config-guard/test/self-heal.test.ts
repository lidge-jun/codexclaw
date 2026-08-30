/**
 * self-heal.test.ts — wp3 of 260829_request-user-input-autopilot.
 *
 * The capability to enable the soft flag already existed in `cxc enable`; nothing ran it
 * on a marketplace install. These tests pin the SessionStart call site: idempotent via an
 * mtime cache, silent when there is nothing to say, never throwing, and never undoing an
 * explicit `cxc disable`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  selfHealDeclaredFeatures,
  renderSelfHealContext,
  selfHealableFeatures,
  selfHealMarkerPath,
  parseSelfHealMarker,
  markSelfHealOptedOut,
  clearSelfHealOptOut,
  readSelfHealMarkerFile,
  makeRealSelfHealDeps,
  type SelfHealDeps,
  type SelfHealOutcome,
} from "../src/self-heal.ts";
import { DECLARED_FEATURES, SOFT_FEATURES, type CodexRunner } from "../src/features.ts";
import { deactivate } from "../src/deactivate.ts";

const SOFT = "default_mode_request_user_input";

/** An in-memory dep set: no real filesystem, no real codex, fully observable. */
function harness(opts: {
  enabled?: Record<string, boolean>;
  files?: Record<string, string>;
  mtimes?: Record<string, number>;
  failEnable?: { key: string; exitCode: number; stderr: string };
  listExitCode?: number;
}) {
  const enabled: Record<string, boolean> = { multi_agent: true, goals: true, hooks: true, [SOFT]: false, ...(opts.enabled ?? {}) };
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const mtimes: Record<string, number> = { ...(opts.mtimes ?? {}) };
  const calls: string[][] = [];
  const run: CodexRunner = (args) => {
    calls.push([...args]);
    if (args[0] === "features" && args[1] === "list") {
      if (opts.listExitCode !== undefined && opts.listExitCode !== 0) return { stdout: "", stderr: "codex missing", exitCode: opts.listExitCode };
      const stdout = DECLARED_FEATURES.map((k) => `${k}  stable  ${enabled[k] === true}`).join("\n");
      return { stdout, stderr: "", exitCode: 0 };
    }
    if (args[1] === "enable") {
      const key = args[2] ?? "";
      if (opts.failEnable && opts.failEnable.key === key) return { stdout: "", stderr: opts.failEnable.stderr, exitCode: opts.failEnable.exitCode };
      enabled[key] = true;
      mtimes[join("HOME", "config.toml")] = (mtimes[join("HOME", "config.toml")] ?? 1000) + 1;
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const deps: SelfHealDeps = {
    codexHome: "HOME",
    run,
    readFile: (p) => files[p] ?? null,
    writeFile: (p, c) => {
      files[p] = c;
    },
    statMtimeMs: (p) => mtimes[p] ?? null,
    now: () => "2026-08-29T00:00:00.000Z",
  };
  return { deps, calls, files, mtimes, enabled };
}

const enableCalls = (calls: string[][]) => calls.filter((c) => c[1] === "enable").map((c) => c[2]);

test("only soft flags are self-healable; hard flags are never touched here", () => {
  assert.deepEqual(selfHealableFeatures(), [...SOFT_FEATURES]);
  const h = harness({ enabled: { goals: false, hooks: false, [SOFT]: false } });
  selfHealDeclaredFeatures(h.deps);
  assert.deepEqual(enableCalls(h.calls), [SOFT]);
});

test("a missing soft flag is enabled and reported as healed", () => {
  const h = harness({ mtimes: { [join("HOME", "config.toml")]: 1000 } });
  const out = selfHealDeclaredFeatures(h.deps);
  assert.deepEqual(out, [{ action: "healed", key: SOFT }] as SelfHealOutcome[]);
  assert.equal(h.files[selfHealMarkerPath("HOME")] !== undefined, true);
  const marker = parseSelfHealMarker(h.files[selfHealMarkerPath("HOME")]);
  assert.equal(marker?.allEnabled, true);
  // The mtime recorded is the POST-enable one, or the next session misses the cache forever.
  assert.equal(marker?.configMtimeMs, 1001);
});

test("a second run hits the mtime cache and never calls codex", () => {
  const h = harness({ mtimes: { [join("HOME", "config.toml")]: 1000 } });
  selfHealDeclaredFeatures(h.deps);
  const before = h.calls.length;
  const out = selfHealDeclaredFeatures(h.deps);
  assert.deepEqual(out, [{ action: "skipped", reason: "cached" }] as SelfHealOutcome[]);
  assert.equal(h.calls.length, before, "a cached round must not shell out at all");
});

test("a changed config.toml mtime re-probes", () => {
  const cfg = join("HOME", "config.toml");
  const h = harness({ mtimes: { [cfg]: 1000 } });
  selfHealDeclaredFeatures(h.deps);
  const before = h.calls.length;
  h.mtimes[cfg] = 5000; // someone else edited the file
  const out = selfHealDeclaredFeatures(h.deps);
  assert.ok(h.calls.length > before);
  assert.deepEqual(out, [{ action: "skipped", reason: "already-enabled" }] as SelfHealOutcome[]);
});

test("the opt-out marker stops self-heal without any codex call", () => {
  const h = harness({
    files: { [selfHealMarkerPath("HOME")]: JSON.stringify({ optedOut: true, optedOutAt: "2026-08-29T00:00:00.000Z" }) },
  });
  const out = selfHealDeclaredFeatures(h.deps);
  assert.deepEqual(out, [{ action: "skipped", reason: "opted-out" }] as SelfHealOutcome[]);
  assert.equal(h.calls.length, 0);
});

test("an unreadable features list reports unavailable and does NOT poison the cache", () => {
  const h = harness({ listExitCode: 127 });
  const out = selfHealDeclaredFeatures(h.deps);
  assert.equal(out[0].action, "unavailable");
  assert.equal(h.files[selfHealMarkerPath("HOME")], undefined, "a measurement failure must not be cached as all-enabled");
});

test("an enable failure is reported and not cached as all-enabled", () => {
  const h = harness({ failEnable: { key: SOFT, exitCode: 2, stderr: "error: unknown feature key" } });
  const out = selfHealDeclaredFeatures(h.deps);
  assert.equal(out[0].action, "failed");
  const marker = parseSelfHealMarker(h.files[selfHealMarkerPath("HOME")]);
  assert.equal(marker?.allEnabled, false);
});

test("a malformed marker degrades to a cache miss rather than throwing", () => {
  assert.equal(parseSelfHealMarker("{not json"), null);
  assert.equal(parseSelfHealMarker("[]"), null);
  assert.equal(parseSelfHealMarker(null), null);
  const h = harness({ files: { [selfHealMarkerPath("HOME")]: "{{{" } });
  const out = selfHealDeclaredFeatures(h.deps);
  assert.equal(out[0].action, "healed");
});

test("a quiet round renders no context at all", () => {
  assert.equal(renderSelfHealContext([{ action: "skipped", reason: "cached" }]), "");
  assert.equal(renderSelfHealContext([{ action: "skipped", reason: "already-enabled" }]), "");
  assert.equal(renderSelfHealContext([{ action: "unavailable", message: "no codex" }]), "");
  assert.equal(renderSelfHealContext([]), "");
});

test("a healed round says the flag lands from the NEXT session", () => {
  const out = renderSelfHealContext([{ action: "healed", key: SOFT }]);
  assert.match(out, new RegExp(SOFT));
  assert.match(out, /NEXT session/);
});

test("a failed round names the impact and the recovery command", () => {
  const out = renderSelfHealContext([{ action: "failed", key: SOFT, exitCode: 2, message: "unknown" }]);
  assert.match(out, /exit 2/);
  assert.match(out, /request_user_input/);
  assert.match(out, new RegExp(`codex features enable ${SOFT}`));
});

// --- real-filesystem wrappers + the deactivate hookup

test("cxc disable writes the opt-out marker even with no manifest at all", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-sh-"));
  const run: CodexRunner = () => ({ stdout: "", stderr: "", exitCode: 0 });
  // No manifest exists: this is the early-return path, and it must still opt out.
  const res = deactivate({ run, codexHome: home, now: () => "2026-08-29T00:00:00.000Z" });
  assert.equal(res.noManifest, true);
  const marker = readSelfHealMarkerFile(home);
  assert.equal(marker?.optedOut, true);
  assert.equal(marker?.optedOutAt, "2026-08-29T00:00:00.000Z");
});

test("the opt-out merges with an existing cache instead of replacing it", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-sh-"));
  writeFileSync(selfHealMarkerPath(home), JSON.stringify({ configMtimeMs: 42, allEnabled: true }));
  markSelfHealOptedOut(home, "2026-08-29T00:00:00.000Z");
  const marker = readSelfHealMarkerFile(home);
  assert.equal(marker?.optedOut, true);
  assert.equal(marker?.configMtimeMs, 42, "the cache entry must survive an opt-out");
  assert.equal(marker?.allEnabled, false, "an opted-out install is not all-enabled");
});

test("clearing the opt-out keeps the rest of the marker and is a no-op when absent", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-sh-"));
  clearSelfHealOptOut(home); // absent: must not create a file
  assert.equal(existsSync(selfHealMarkerPath(home)), false);
  markSelfHealOptedOut(home, "2026-08-29T00:00:00.000Z");
  clearSelfHealOptOut(home);
  const marker = readSelfHealMarkerFile(home);
  assert.equal(marker?.optedOut, undefined);
  assert.equal(marker?.optedOutAt, undefined);
});

test("the marker write is atomic and leaves no temp file behind", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-sh-"));
  markSelfHealOptedOut(home, "2026-08-29T00:00:00.000Z");
  assert.equal(existsSync(`${selfHealMarkerPath(home)}.tmp`), false);
  assert.match(readFileSync(selfHealMarkerPath(home), "utf8"), /optedOut/);
});

// --- consent and ownership (wp3 independent review: B-2, B-3)

test("a key we already healed is DECLINED when the user turns it back off", () => {
  const cfg = join("HOME", "config.toml");
  const h = harness({ mtimes: { [cfg]: 1000 } });
  // Round 1 heals it.
  assert.equal(selfHealDeclaredFeatures(h.deps)[0].action, "healed");
  // The user turns it off with the codex-native inverse command, which moves the mtime.
  h.enabled[SOFT] = false;
  h.mtimes[cfg] = 9000;
  const out = selfHealDeclaredFeatures(h.deps);
  assert.deepEqual(out, [{ action: "declined", key: SOFT }] as SelfHealOutcome[]);
  assert.equal(h.enabled[SOFT], false, "a declined key must stay off");
});

test("a declined key renders no context: it is the user\u0027s choice, not news", () => {
  assert.equal(renderSelfHealContext([{ action: "declined", key: SOFT }]), "");
});

test("a stale cache that predates a SOFT_FEATURES addition does not vouch for the new key", () => {
  const cfg = join("HOME", "config.toml");
  const h = harness({
    mtimes: { [cfg]: 1000 },
    files: { [selfHealMarkerPath("HOME")]: JSON.stringify({ allEnabled: true, configMtimeMs: 1000, cachedKeys: ["some_older_flag"] }) },
  });
  const out = selfHealDeclaredFeatures(h.deps);
  assert.notEqual(out[0].action, "skipped", "the cache must not cover a key it never checked");
});

test("a heal claims ownership in the manifest so cxc disable can revert it", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-sh-"));
  const configPath = join(home, "config.toml");
  writeFileSync(configPath, "[features]\n");
  // A manifest where the soft flag FAILED at activation: the exact divergence B-2 named.
  writeFileSync(
    join(home, ".codexclaw-install.json"),
    JSON.stringify({
      version: 2,
      activatedAt: "2026-08-29T00:00:00.000Z",
      configPath,
      backupPath: null,
      postActivateHash: null,
      flags: {
        [SOFT]: { priorEnabled: false, enabledByCodexclaw: false, enableFailed: true, failure: { exitCode: 2, message: "boom" } },
      },
      tableKeys: {},
    }),
  );
  const run: CodexRunner = (args) => {
    if (args[0] === "features" && args[1] === "list") {
      return { stdout: DECLARED_FEATURES.map((k) => `${k}  stable  ${k !== SOFT}`).join("\n"), stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const out = selfHealDeclaredFeatures(makeRealSelfHealDeps(home, run));
  assert.equal(out[0].action, "healed");
  const manifest = JSON.parse(readFileSync(join(home, ".codexclaw-install.json"), "utf8"));
  assert.equal(manifest.flags[SOFT].enabledByCodexclaw, true, "a heal must be recorded as codexclaw-owned");
  assert.equal(manifest.flags[SOFT].enableFailed, false);
  assert.equal(manifest.flags[SOFT].failure, undefined);
});

test("a heal with no manifest is a silent no-op, not an error", () => {
  const home = mkdtempSync(join(tmpdir(), "cxc-sh-"));
  writeFileSync(join(home, "config.toml"), "[features]\n");
  const run: CodexRunner = (args) => {
    if (args[0] === "features" && args[1] === "list") {
      return { stdout: DECLARED_FEATURES.map((k) => `${k}  stable  ${k !== SOFT}`).join("\n"), stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  assert.equal(selfHealDeclaredFeatures(makeRealSelfHealDeps(home, run))[0].action, "healed");
  assert.equal(existsSync(join(home, ".codexclaw-install.json")), false, "self-heal must not fabricate a manifest");
});

test("an opt-out that lands mid-round is not clobbered by the cache write", () => {
  const cfg = join("HOME", "config.toml");
  const h = harness({ mtimes: { [cfg]: 1000 } });
  // Simulate `cxc disable` writing the opt-out while this round was probing: the dep
  // readFile is consulted again before the write, so it must win.
  const originalRead = h.deps.readFile;
  let reads = 0;
  h.deps.readFile = (p) => {
    reads += 1;
    if (reads > 1 && p === selfHealMarkerPath("HOME")) {
      return JSON.stringify({ optedOut: true, optedOutAt: "2026-08-29T00:00:00.000Z" });
    }
    return originalRead(p);
  };
  selfHealDeclaredFeatures(h.deps);
  const marker = parseSelfHealMarker(h.files[selfHealMarkerPath("HOME")] ?? null);
  assert.notEqual(marker?.optedOut, false, "a concurrent opt-out must not be overwritten");
});
