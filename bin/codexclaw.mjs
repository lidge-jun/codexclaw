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

/** Delegate a subcommand to the compiled config-guard CLI; returns its exit code. */
function runConfigGuard(subcommand) {
  const res = spawnSync(process.execPath, [configGuardCli, subcommand], { stdio: "inherit" });
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
  case "gui":
    console.log("codexclaw: GUI launcher TBD (Phase 2).");
    break;
  case "subagents":
  case "provider":
    console.log(`codexclaw: '${cmd}' is a Phase 2 command (subagent model config / ocx bridge).`);
    break;
  default:
    console.log("codexclaw <enable|uninstall|status|subagents|provider|gui>");
}
