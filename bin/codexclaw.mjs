#!/usr/bin/env node
/**
 * codexclaw CLI entry.
 *
 * Commands:
 *   codexclaw enable              activate declared codex feature flags (config-guard)
 *   codexclaw uninstall|disable   revert flags codexclaw enabled (config-guard)
 *   codexclaw status              show declared feature-flag state (config-guard)
 *   codexclaw doctor              run plugin health checks (cxc-ops)
 *   codexclaw reset               remove scoped .codexclaw state/generated files (cxc-ops)
 *   codexclaw orchestrate         drive IPABCD state with agent-gated attest evidence
 *   codexclaw freeze              freeze the interview plan + surface the goal-activation handoff
 *   codexclaw metric              record/show objective metrics for emergence-harness loops
 *   codexclaw divergence          record divergence mode + candidate archive state
 *   codexclaw loop                init/show/validate the project-local loop/goalplan substrate
 *   codexclaw goalplan            (deprecated alias for loop)
 *   codexclaw serve               run the bridge server (GUI static + API + messenger bots)
 *   codexclaw service             install/uninstall/status the serve daemon (launchd)
 *   codexclaw gui                 launch the codexclaw web dashboard
 *   codexclaw subagents           read/write per-role subagent model+prompt config
 *   codexclaw provider            show read-only opencodex (ocx) provider status
 *   codexclaw chat search         read-only recall search over ~/.codex rollouts (recall)
 *   codexclaw memory search       read-only search over ~/.codex memories (recall)
 *   codexclaw skill search|show   remote dormant-skill search over cli-jaw-skills/hermes/clawhub/gh (skill-search)
 *
 * This file is a thin delegator over compiled component CLIs; provider detection is
 * read-only and does not toggle or ensure opencodex.
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

const subagentConfigCli = join(
  here,
  "..",
  "plugins",
  "codexclaw",
  "components",
  "subagent-config",
  "dist",
  "cli.js",
);

const recallCli = join(
  here,
  "..",
  "plugins",
  "codexclaw",
  "components",
  "recall",
  "dist",
  "cli.js",
);

const providerBridgeCli = join(
  here,
  "..",
  "plugins",
  "codexclaw",
  "components",
  "provider-bridge",
  "dist",
  "cli.js",
);

const messengerBridgeCli = join(
  here,
  "..",
  "plugins",
  "codexclaw",
  "components",
  "messenger-bridge",
  "dist",
  "cli.js",
);

const skillSearchCli = join(
  here,
  "..",
  "plugins",
  "codexclaw",
  "components",
  "skill-search",
  "dist",
  "cli.js",
);

/** Delegate a subcommand to the compiled config-guard CLI; returns its exit code. */
function runConfigGuard(subcommand) {
  const res = spawnSync(process.execPath, [configGuardCli, subcommand], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled cxc-ops CLI (doctor/reset); returns its exit code. */
function runCxcOps(args) {
  const res = spawnSync(process.execPath, [cxcOpsCli, ...args], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled pabcd-state CLI. argv: [kind, ...rest]. */
function runPabcdState(args) {
  const res = spawnSync(process.execPath, [pabcdStateCli, ...args], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled subagent-config CLI. argv: ["subagents", ...rest]. */
function runSubagents(args) {
  const res = spawnSync(process.execPath, [subagentConfigCli, ...args], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled recall CLI. argv: [kind, "search", ...rest], kind ∈ chat|memory. */
function runRecall(args) {
  const res = spawnSync(process.execPath, [recallCli, ...args], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled skill-search CLI. argv: ["search"|"show", ...rest]. */
function runSkillSearch(args) {
  const res = spawnSync(process.execPath, [skillSearchCli, ...args], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled messenger-bridge CLI. argv: ["serve", ...rest]. */
function runMessengerBridge(args) {
  const res = spawnSync(process.execPath, [messengerBridgeCli, ...args], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled provider-bridge CLI in detect mode (read-only status). */
function runProvider() {
  const res = spawnSync(process.execPath, [providerBridgeCli, "detect"], { stdio: "inherit" });
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
    process.exit(runCxcOps(process.argv.slice(2)));
    break;
  case "orchestrate":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "orchestrate".
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "freeze":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "freeze".
    // Surfaces the goal-activation handoff (GOAL_ACTIVATION_DIRECTIVE) to the
    // operator/main session when the interview is ready; codexclaw never writes
    // the goal DB itself.
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "metric":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "metric".
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "divergence":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "divergence".
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "loop":
  case "goalplan":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "loop" or "goalplan".
    // Project-local loop/goalplan substrate (init/show/validate); never writes the host goal DB.
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "serve":
  case "service":
    // messenger-bridge CLI expects argv as ["serve"|"service", ...rest].
    process.exit(runMessengerBridge(process.argv.slice(2)));
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
  case "chat":
  case "memory":
    // recall CLI expects argv as [kind, "search", ...rest]; read-only over ~/.codex.
    process.exit(runRecall(process.argv.slice(2)));
    break;
  case "skill":
    // skill-search CLI: remote dormant-skill search/show (jaw/hermes/clawhub/gh).
    process.exit(runSkillSearch(process.argv.slice(3)));
    break;
  case "subagents":
    process.exit(runSubagents(process.argv.slice(2)));
    break;
  case "provider":
    process.exit(runProvider());
    break;
  default:
    console.log("codexclaw <enable|disable|uninstall|status|orchestrate|freeze|metric|divergence|loop|goalplan|doctor|reset|subagents|provider|chat|memory|skill|gui|serve|service>");
}
