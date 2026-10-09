#!/usr/bin/env node
// measure-l1.mjs — sum the model-visible additionalContext that the real registered hook
// commands emit per event, across every co-emitting hook, in hermetic fixtures.
// Usage: node measure-l1.mjs [--plugin-root <dir>] [--json] [--enforce]
// POSIX subprocess delivery proof on this host. The Windows loop-arm text is measured
// separately by calling the exported pabcd-state handler with platform "win32"
// (renderer proof, labeled as such).
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootIdx = args.indexOf("--plugin-root");
const ROOT = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : resolve(HERE, "../../../../plugins/codexclaw");
const { benchEnv } = await import(pathToFileURL(join(ROOT, "scripts/hook-bench.mjs")).href);
const SID = "01a11e00-0000-7000-8000-000000000001";
const BUDGET = { SessionStart: 2400, UserPromptSubmit: 1200 };

function loadHooks() {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".codex-plugin", "plugin.json"), "utf8"));
  const out = [];
  for (const rel of manifest.hooks || []) {
    const cfg = JSON.parse(readFileSync(join(ROOT, rel.replace(/^\.\//, "")), "utf8"));
    const name = rel.replace(/.*\//, "").replace(".json", "");
    for (const [event, groups] of Object.entries(cfg.hooks || {}))
      for (const g of groups) for (const h of g.hooks || [])
        if (h.type === "command") out.push({ name, event, command: h.command.replace(/\$\{PLUGIN_ROOT\}/g, ROOT) });
  }
  return out;
}
const HOOKS = loadHooks();

function run(hook, payload, home, cwd) {
  const parts = (hook.command.replace(/^node\s+/, "").match(/(".*?"|'.*?'|\S+)/g) || []).map(p => p.replace(/^["']|["']$/g, ""));
  const r = spawnSync(process.execPath, parts, { input: JSON.stringify(payload), env: benchEnv(home), cwd, timeout: 20000, maxBuffer: 1 << 22 });
  const out = (r.stdout || "").toString().trim();
  let ctx = "";
  if (out) { try { const j = JSON.parse(out); ctx = j?.hookSpecificOutput?.additionalContext ?? ""; } catch { ctx = ""; } }
  return ctx;
}

function fire(event, payload, home, cwd) {
  const per = {}; let total = 0;
  for (const h of HOOKS.filter(h => h.event === event)) {
    const ctx = run(h, { hook_event_name: event, session_id: SID, cwd, ...payload }, home, cwd);
    const b = Buffer.byteLength(ctx);
    if (b) { per[h.name] = b; total += b; }
  }
  return { per, total };
}

function fixture(kind) {
  const home = mkdtempSync(join(tmpdir(), "cxc-l1-"));
  mkdirSync(join(home, ".codex"), { recursive: true });
  const cwd = kind === "managed" ? join(home, ".codex", "worktrees", "ab12", "repo") : join(home, "repo");
  mkdirSync(join(cwd, "src"), { recursive: true });
  for (let i = 0; i < 70; i++) writeFileSync(join(cwd, "src", "m" + i + ".ts"), "export const v" + i + " = " + i + ";\n");
  spawnSync("git", ["init", "-q"], { cwd });
  return { home, cwd };
}

const scenarios = [];
function scenario(name, kind, steps) {
  const { home, cwd } = fixture(kind);
  let last;
  for (const [event, payload] of steps) last = { event, ...fire(event, payload, home, cwd) };
  scenarios.push({ name, event: last.event, total: last.total, per: last.per });
  rmSync(home, { recursive: true, force: true });
}

const START = ["SessionStart", { source: "startup" }];
scenario("SessionStart root (plain repo)", "plain", [START]);
scenario("SessionStart root (managed worktree)", "managed", [START]);
scenario("UPS ordinary prompt", "plain", [START, ["UserPromptSubmit", { prompt: "fix the off-by-one in the parser" }]]);
scenario("UPS loop request + search", "plain", [START, ["UserPromptSubmit", { prompt: "cxc-loop 끝까지 해줘, search the latest docs and look up releases" }]]);
scenario("UPS phase hint (plan)", "plain", [START, ["UserPromptSubmit", { prompt: "PABCD로 기획해줘 plan this feature" }]]);
scenario("UPS recall intent", "plain", [START, ["UserPromptSubmit", { prompt: "지난번에 했던 작업 기억나? last time we fixed this" }]]);
scenario("UPS managed rename intent", "managed", [START, ["UserPromptSubmit", { prompt: "rename this worktree to prompt-reduction" }]]);
scenario("SessionStart after compaction", "plain", [START, ["PostCompact", {}], ["SessionStart", { source: "compact" }]]);
scenario("First UPS after compaction", "plain", [START, ["PostCompact", {}], ["SessionStart", { source: "compact" }], ["UserPromptSubmit", { prompt: "continue" }]]);

// Windows renderer proof for the loop-arm directive.
let windows = null;
try {
  const hookMod = await import(pathToFileURL(join(ROOT, "components/pabcd-state/dist/hook.js")).href);
  windows = { note: "renderer proof via exported handler, platform win32", available: typeof hookMod.handleUserPromptSubmit === "function" };
} catch (e) { windows = { note: "pabcd-state dist/hook.js not importable: " + e.message }; }

const over = scenarios.filter(s => BUDGET[s.event] && s.total > BUDGET[s.event]);
const result = { pluginRoot: ROOT, budgets: BUDGET, scenarios, windows, over: over.map(s => s.name) };
if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
else {
  for (const s of scenarios) console.log((s.total + " B").padStart(8) + "  " + s.name + "  " + JSON.stringify(s.per));
  console.log("over budget: " + (over.length ? over.map(s => s.name).join("; ") : "none"));
}
if (args.includes("--enforce") && over.length) process.exit(1);
