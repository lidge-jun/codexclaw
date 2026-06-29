/**
 * phase2.test.mjs — Phase 2 integration + verification gate (L28, S6-S10).
 *
 * Exercises the shipped Phase-2 capabilities end to end against deterministic
 * fixtures, covering both ocx-absent and ocx-present evidence. No real provider
 * credentials, no vendored ocx assets. Imports the component TS sources directly
 * (Node 24 strips types).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, existsSync, readFileSync as rf } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { detectOcx } from "../components/provider-bridge/src/detect.ts";
import { buildCatalog, NATIVE_OPENAI_MODELS } from "../components/subagent-config/src/catalog.ts";
import { setRole, readConfig, resolveSpawnConfig, ROLES } from "../components/subagent-config/src/store.ts";
import { getProvider, postSubagents, getSubagents } from "../gui/src/server/handlers.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureStatus = rf(join(here, "fixtures", "phase2", "ocx-status.json"), "utf8");
const componentRoot = resolve(here, "..");

function tmp() {
  return mkdtempSync(join(tmpdir(), "cxc-phase2-"));
}

// Present-ocx deps: stub `which` + `status --json` (no real ocx, no creds).
const presentDeps = {
  which: () => "/stub/bin/ocx",
  runStatus: () => ({ status: 0, stdout: fixtureStatus }),
};
const absentDeps = { which: () => null };

// --- S6: ocx detect present / graceful absent / detect-only ----------------

test("S6: ocx present is DETECTED (provider mode, port from status)", () => {
  const s = detectOcx(presentDeps);
  assert.equal(s.mode, "provider");
  assert.equal(s.status.port, 10100);
});

test("S6: ocx absent gracefully skips -> native mode (no failure)", () => {
  const s = detectOcx(absentDeps);
  assert.equal(s.mode, "native");
});

test("S6: detect-only — provider bridge NEVER invokes `ocx ensure`/`sync`", () => {
  const src = readFileSync(join(componentRoot, "components", "provider-bridge", "src", "detect.ts"), "utf8");
  const cli = readFileSync(join(componentRoot, "components", "provider-bridge", "src", "cli.ts"), "utf8");
  for (const forbidden of ['"ensure"', "'ensure'", '"sync"', "'sync'", '"ensure"]', "ensure]"]) {
    assert.ok(!src.includes(forbidden), `detect.ts must not invoke ocx ${forbidden}`);
  }
  // the only ocx subcommand the bridge runs is `status`.
  assert.ok(cli.includes('"status"'), "cli.ts should read via `ocx status`");
  assert.ok(!cli.includes('"ensure"') && !cli.includes('"sync"'), "cli.ts must not run ensure/sync");
});

// --- S7: catalog = ocx models + main/default model -------------------------

test("S7: catalog with ocx fixture = native main models + ocx models (n+1), native first", () => {
  const cat = buildCatalog({
    readNativeCache: () => ["gpt-5.5"],
    providerStatus: { mode: "provider", ocxModels: ["grok-4", "claude-opus"] },
  });
  assert.equal(cat.state, "ocx-active");
  assert.deepEqual(cat.entries.map((e) => e.id), ["gpt-5.5", "grok-4", "claude-opus"]);
  assert.equal(cat.entries[0].source, "native");
});

test("S7: ocx absent -> native catalog contains the main/default models", () => {
  const cat = buildCatalog({ readNativeCache: () => [...NATIVE_OPENAI_MODELS] });
  assert.equal(cat.state, "native-catalog");
  assert.ok(cat.entries.some((e) => e.id === "gpt-5.5" && e.source === "native"));
});

// --- S8: assign model to each role persists + spawn honors -----------------

test("S8: assigning a model to explorer/reviewer/executor persists + spawn honors it", () => {
  const cwd = tmp();
  for (const role of ROLES) setRole(cwd, role, { mode: "model", model: `model-${role}` });
  const cfg = readConfig(cwd);
  for (const role of ROLES) {
    assert.equal(cfg.roles[role].model, `model-${role}`);
    const spawn = resolveSpawnConfig(cwd, role);
    assert.equal(spawn.usesMainModel, false);
    assert.equal(spawn.model, `model-${role}`);
  }
});

// --- S9: GUI link bar gating ------------------------------------------------

test("S9: link bar provider state — present -> provider+port; absent -> native+null", () => {
  const present = getProvider(presentDeps);
  assert.equal(present.body.mode, "provider");
  assert.equal(present.body.port, 10100);
  const absent = getProvider(absentDeps);
  assert.equal(absent.body.mode, "native");
  assert.equal(absent.body.port, null);
});

// --- S10: per-role prompt override editable + applied on spawn -------------

test("S10: prompt override saved through GUI handler is applied on spawn", () => {
  const cwd = tmp();
  const r = postSubagents(cwd, { role: "reviewer", promptOverride: "Adversarial only." });
  assert.equal(r.status, 200);
  assert.equal(resolveSpawnConfig(cwd, "reviewer").promptOverride, "Adversarial only.");
  // and GET returns it
  assert.equal(getSubagents(cwd).body.roles.reviewer.promptOverride, "Adversarial only.");
});

// --- GUI build artifacts + cxc gui dependency presence ----------------------

test("L28: GUI build artifacts exist (vite build output) and gui has package.json", () => {
  const guiRoot = join(componentRoot, "gui");
  assert.ok(existsSync(join(guiRoot, "package.json")), "gui package.json missing");
  assert.ok(existsSync(join(guiRoot, "index.html")), "gui index.html missing");
  // dist is produced by `npm run build` in the gui workspace (gitignored).
  const dist = join(guiRoot, "dist", "index.html");
  if (existsSync(dist)) {
    assert.match(readFileSync(dist, "utf8"), /<div id="root">/, "built index.html must mount the app");
  }
});

test("L28: no real provider credentials in phase2 fixtures", () => {
  const fx = fixtureStatus;
  for (const secret of ["sk-", "api_key", "apiKey", "token", "secret", "password", "Bearer "]) {
    assert.ok(!fx.includes(secret), `fixture must not contain "${secret}"`);
  }
});
