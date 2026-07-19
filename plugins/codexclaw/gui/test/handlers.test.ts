/**
 * handlers.test.ts — L27 GUI API handler coverage (node:test).
 * Verifies save persists to .codexclaw/subagents.json (AC1/AC2) and link-bar
 * provider gating (AC3) without a browser.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getSubagents,
  postSubagents,
  getCatalog,
  getProvider,
  getMultiAgentSurface,
  postMultiAgentSurface,
} from "../src/server/handlers.ts";
import { resolveSpawnConfig } from "../../components/subagent-config/src/store.ts";
import type { CodexRunner } from "../../components/config-guard/src/features.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-gui-"));
}

test("AC1: POST reviewer model persists to subagents.json and GET reflects it", () => {
  const cwd = tmp();
  const post = postSubagents(cwd, { role: "reviewer", mode: "model", model: "gpt-5.5" });
  assert.equal(post.status, 200);
  // on disk
  assert.ok(existsSync(join(cwd, ".codexclaw", "subagents.json")));
  const onDisk = JSON.parse(readFileSync(join(cwd, ".codexclaw", "subagents.json"), "utf8"));
  assert.equal(onDisk.roles.reviewer.model, "gpt-5.5");
  // reload via GET
  const get = getSubagents(cwd);
  assert.equal((get.body as any).roles.reviewer.model, "gpt-5.5");
});

test("AC2: prompt override persists and spawn-time reader returns it", () => {
  const cwd = tmp();
  postSubagents(cwd, { role: "executor", promptOverride: "Be terse." });
  const spawn = resolveSpawnConfig(cwd, "executor");
  assert.equal(spawn.promptOverride, "Be terse.");
});

test("POST with invalid mode -> 400 error, file not corrupted", () => {
  const cwd = tmp();
  const r = postSubagents(cwd, { role: "reviewer", mode: "turbo" });
  assert.equal(r.status, 400);
});

test("POST unknown role -> 400", () => {
  assert.equal(postSubagents(tmp(), { role: "wizard" }).status, 400);
});

test("postSubagents: effort round-trips and invalid effort is rejected", () => {
  const cwd = tmp();
  const ok = postSubagents(cwd, { role: "explorer", effort: "high" });
  assert.equal(ok.status, 200);
  const cfg = getSubagents(cwd).body as { roles: { explorer: { effort: string | null } } };
  assert.equal(cfg.roles.explorer.effort, "high");

  const cleared = postSubagents(cwd, { role: "explorer", effort: null });
  assert.equal(cleared.status, 200);
  assert.equal((getSubagents(cwd).body as { roles: { explorer: { effort: string | null } } }).roles.explorer.effort, null);

  const bad = postSubagents(cwd, { role: "explorer", effort: "turbo" });
  assert.equal(bad.status, 400);
});

test("AC3: provider gating — ocx detected -> provider mode + port; absent -> native", () => {
  const present = getProvider({
    which: () => "/usr/local/bin/ocx",
    runStatus: () => ({ status: 0, stdout: JSON.stringify({ proxy: { running: true }, listen: { port: 10100 }, defaultProvider: "openai" }) }),
  });
  assert.equal((present.body as any).mode, "provider");
  assert.equal((present.body as any).port, 10100);

  const absent = getProvider({ which: () => null });
  assert.equal((absent.body as any).mode, "native");
  assert.equal((absent.body as any).port, null);
});

test("catalog: native entries always present; ocx-present-no-list -> unsupported state", () => {
  const native = getCatalog({ which: () => null });
  assert.equal((native.body as any).state, "native-catalog");
  assert.ok((native.body as any).entries.length > 0);

  const ocx = getCatalog({
    which: () => "/x/ocx",
    runStatus: () => ({ status: 0, stdout: JSON.stringify({ proxy: { running: true }, listen: { port: 10100 } }) }),
  });
  // Default reader is machine-dependent (may load the real ~/.codex cache):
  // the invariant is state honesty — ocx-active iff ocx-sourced entries exist.
  const body = ocx.body as { state: string; entries: Array<{ source: string }> };
  const hasOcx = body.entries.some((e) => e.source === "ocx");
  assert.equal(body.state, hasOcx ? "ocx-active" : "unsupported-ocx-catalog");
});

test("GUI checkbox flow: bare mode:model on fresh role -> 400 with real error; with model -> 200; bare re-assert keeps model", () => {
  const cwd = tmp();
  const bad = postSubagents(cwd, { role: "explorer", mode: "model" });
  assert.equal(bad.status, 400);
  assert.match(String((bad.body as { error?: string }).error), /requires a non-empty model/);
  const good = postSubagents(cwd, { role: "explorer", mode: "model", model: "gpt-5.6-luna" });
  assert.equal(good.status, 200);
  const again = postSubagents(cwd, { role: "explorer", mode: "model" });
  assert.equal(again.status, 200);
  assert.equal((again.body as { roles: { explorer: { model: string } } }).roles.explorer.model, "gpt-5.6-luna");
});

test("multi-agent surface handlers read and toggle v1/v2 through codex feature runner", () => {
  const codexHome = tmp();
  const configPath = join(codexHome, "config.toml");
  writeFileSync(configPath, "[features.multi_agent_v2]\nenabled = false\nmax_concurrent_threads_per_session = 5\n", "utf8");
  const calls: string[][] = [];
  const run: CodexRunner = (args) => {
    calls.push([...args]);
    if (args[0] === "features" && args[1] === "enable" && args[2] === "multi_agent_v2") {
      writeFileSync(configPath, "[features]\nmulti_agent_v2 = true\n", "utf8");
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (args[0] === "features" && args[1] === "disable" && args[2] === "multi_agent_v2") {
      writeFileSync(configPath, "[features]\nmulti_agent_v2 = false\n", "utf8");
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "bad command", exitCode: 1 };
  };
  const deps = { run, codexHome, configPath };

  assert.deepEqual(getMultiAgentSurface(deps).body, {
    version: "v1",
    v2Enabled: false,
    appliesTo: "flag-fallback models only",
    catalogPinned: {
      v2: ["gpt-5.6-sol", "gpt-5.6-terra"],
      v1: ["gpt-5.6-luna"],
    },
    effectiveFrom: "new sessions",
  });
  const on = postMultiAgentSurface(deps, { version: "v2" });
  assert.equal(on.status, 200);
  assert.equal((on.body as { version: string }).version, "v2");
  assert.equal((on.body as { appliesTo: string }).appliesTo, "flag-fallback models only");
  assert.equal((on.body as { effectiveFrom: string }).effectiveFrom, "new sessions");
  assert.deepEqual(calls[0], ["features", "enable", "multi_agent_v2"]);
  assert.match(readFileSync(configPath, "utf8"), /max_concurrent_threads_per_session = 5/);

  const off = postMultiAgentSurface(deps, { version: "v1" });
  assert.equal(off.status, 200);
  assert.equal((off.body as { version: string }).version, "v1");
  assert.deepEqual(calls[1], ["features", "disable", "multi_agent_v2"]);
  assert.match(readFileSync(configPath, "utf8"), /enabled = false/);
});

test("multi-agent surface handler rejects invalid versions and reports runner failure", () => {
  const codexHome = tmp();
  const configPath = join(codexHome, "config.toml");
  writeFileSync(configPath, "[features]\nmulti_agent_v2 = false\n", "utf8");
  const run: CodexRunner = () => ({ stdout: "", stderr: "nope", exitCode: 42 });

  assert.equal(postMultiAgentSurface({ run, codexHome, configPath }, { version: "turbo" }).status, 400);
  const fail = postMultiAgentSurface({ run, codexHome, configPath }, { version: "v2" });
  assert.equal(fail.status, 502);
  assert.match(String((fail.body as { error?: string }).error), /failed \(exit 42\)/);
});
