#!/usr/bin/env node
/**
 * codexclaw CLI entry (MVP stub).
 *
 * Commands:
 *   codexclaw enable              activate declared codex feature flags (config-guard)
 *   codexclaw uninstall|disable   revert flags codexclaw enabled (config-guard)
 *   codexclaw status              show declared feature-flag state (config-guard)
 *   codexclaw subagents [...]     view/edit subagent model & prompt config (Phase 2)
 *   codexclaw provider <on|off>   toggle the opencodex provider bridge (Phase 2)
 *   codexclaw gui                 launch the codexclaw web dashboard (Phase 2)
 *
 * enable/disable/status delegate to the compiled config-guard CLI so install-time
 * activation is a real end-to-end path, not a stub.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const configGuardCli = join(
  here,
  "..",
  "plugins",
  "codexclaw",
  "components",
  "config-guard",
  "dist",
  "cli.js",
);

const cxcOpsCli = join(
  here,
  "..",
  "plugins",
  "codexclaw",
  "components",
  "cxc-ops",
  "dist",
  "cli.js",
);

const pabcdStateCli = join(
  here,
  "..",
  "plugins",
  "codexclaw",
  "components",
  "pabcd-state",
  "dist",
  "cli.js",
);

/** Delegate a subcommand to the compiled config-guard CLI; returns its exit code. */
function runConfigGuard(subcommand) {
  const res = spawnSync(process.execPath, [configGuardCli, subcommand], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled cxc-ops CLI (doctor/reset/chat-search); returns its exit code. */
function runCxcOps(args) {
  const res = spawnSync(process.execPath, [cxcOpsCli, ...args], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled pabcd-state CLI. argv: [kind, ...rest]. */
function runPabcdState(args) {
  const res = spawnSync(process.execPath, [pabcdStateCli, ...args], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

const cmd = process.argv[2] ?? "help";
switch (cmd) {
  case "enable":
    process.exit(runConfigGuard("enable"));
    break;
  case "uninstall":
  case "disable":
    process.exit(runConfigGuard("disable"));
    break;
  case "status":
    process.exit(runConfigGuard("status"));
    break;
  case "doctor":
  case "reset":
  case "chat-search":
    process.exit(runCxcOps(process.argv.slice(2)));
    break;
  case "orchestrate":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "orchestrate".
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "gui": {
    const guiDir = join(here, "..", "plugins", "codexclaw", "gui");
    // npm workspaces hoist deps to the repo root, so check either location.
    const guiVite = join(guiDir, "node_modules", "vite");
    const rootVite = join(here, "..", "node_modules", "vite");
    if (!existsSync(guiVite) && !existsSync(rootVite)) {
      console.log("codexclaw gui: dependencies not installed. Run `npm install` in plugins/codexclaw/gui first.");
      process.exit(1);
    }
    console.log("codexclaw gui: starting the dashboard (Vite will print the local URL)...");
    const res = spawnSync("npm", ["run", "dev"], { cwd: guiDir, stdio: "inherit" });
    process.exit(typeof res.status === "number" ? res.status : 0);
    break;
  }
  case "subagents":
  case "provider":
    console.log(`codexclaw: '${cmd}' is a Phase 2 command (subagent model config / ocx bridge).`);
    break;
  default:
    console.log("codexclaw <enable|uninstall|status|orchestrate|doctor|reset|chat-search|subagents|provider|gui>");
}
