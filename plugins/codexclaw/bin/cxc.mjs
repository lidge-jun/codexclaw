#!/usr/bin/env node
/**
 * Payload-resident `cxc` dispatcher (260724 fresh-install stabilization, WP1).
 *
 * WHY: the marketplace payload is only `plugins/codexclaw/` — the repo-root
 * `bin/codexclaw.mjs` (the PATH-level `cxc` for repo checkouts) never ships.
 * This file gives every install a runnable command surface:
 *
 *   node "<payloadRoot>/bin/cxc.mjs" orchestrate status --session <id>
 *
 * Injected directives resolve to exactly that invocation when `cxc` is not on
 * PATH (components/cxc-ops/src/cxc-resolve.ts). Command set mirrors the root
 * dispatcher's payload-servable subset; a parity test pins the two tables
 * against each other (plugins/codexclaw/test/payload-bin.test.mjs).
 *
 * Not here (repo-checkout-only, by design): `gui` (needs node_modules) and
 * `map` (root bin owns the python bootstrap ladder; the repo-map skill docs
 * the payload path). Both print a pointer instead of failing cryptically.
 */
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const payloadRoot = join(here, "..");

const componentCli = (name) => join(payloadRoot, "components", name, "dist", "cli.js");

/**
 * Verb -> component routing table. EXPORTED for the parity test that pins this
 * dispatcher against the repo-root bin (M2 anti-drift guard).
 */
export const COMMAND_TABLE = Object.freeze({
  enable: "config-guard",
  disable: "config-guard",
  uninstall: "config-guard",
  status: "config-guard",
  doctor: "cxc-ops",
  reset: "cxc-ops",
  hooks: "cxc-ops",
  orchestrate: "pabcd-state",
  freeze: "pabcd-state",
  metric: "pabcd-state",
  divergence: "pabcd-state",
  loop: "pabcd-state",
  goalplan: "pabcd-state",
  plan: "pabcd-state",
  scan: "pabcd-state",
  chat: "recall",
  memory: "recall",
  skill: "skill-search",
  subagents: "subagent-config",
  serve: "messenger-bridge",
  service: "messenger-bridge",
  provider: "provider-bridge",
});

const HELP = [
  "cxc (payload dispatcher) — codexclaw operator CLI",
  "",
  "Usage:",
  '  node "<payloadRoot>/bin/cxc.mjs" <command> [args]',
  "",
  "PABCD / loop:",
  "  orchestrate <verb>             drive IPABCD state (try: orchestrate --help)",
  "  freeze | metric | divergence   interview freeze / metrics / divergence state",
  "  loop init|show|validate        manage the project-local goalplan substrate",
  "  plan init <slug>               scaffold the devlog/_plan unit for the P>A gate",
  "  scan record --session <id>     record an interview contradiction-scan round",
  "",
  "Core:",
  "  enable | disable | status      declared Codex feature flags",
  "  doctor | reset | hooks         plugin health / state reset / hook re-trust",
  "",
  "Workspace intelligence:",
  '  chat search "q" | memory search "q"   recall over ~/.codex artifacts',
  "  skill search|show              dormant-skill discovery",
  "",
  "Operations:",
  "  subagents | provider | serve | service",
  "",
  "Repo-checkout only (not in the payload dispatcher):",
  "  gui, map — use a git checkout of codexclaw (README: Development)",
  "",
  "Agent notes:",
  "  Mutating PABCD commands require the session id: orchestrate P --session <id>",
].join("\n");

function delegate(component, args) {
  const res = spawnSync(process.execPath, [componentCli(component), ...args], {
    stdio: "inherit",
  });
  return typeof res.status === "number" ? res.status : 1;
}

// Dispatch only when executed directly; COMMAND_TABLE stays importable for tests.
function real(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const isMain = Boolean(
  process.argv[1] && real(fileURLToPath(import.meta.url)) === real(resolvePath(process.argv[1])),
);

if (isMain) {
  const cmd = process.argv[2] ?? "help";
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    process.exit(0);
  }
  if (cmd === "gui" || cmd === "map") {
    console.log(
      `cxc ${cmd}: available from a repo checkout only (github.com/lidge-jun/codexclaw — see README Development section).`,
    );
    process.exit(1);
  }
  const component = COMMAND_TABLE[cmd];
  if (!component) {
    console.error(`cxc: unknown command '${cmd}'\nRun with --help for usage.`);
    process.exit(1);
  }
  // Component CLI argv contracts (mirror root bin):
  //   config-guard: [subcommand] only; skill-search: [search|show, ...] (drop the "skill" verb);
  //   provider-bridge: ["detect"]; everything else: [cmd, ...rest] verbatim.
  if (component === "config-guard") {
    process.exit(delegate(component, [cmd === "uninstall" ? "disable" : cmd]));
  } else if (component === "skill-search") {
    process.exit(delegate(component, process.argv.slice(3)));
  } else if (component === "provider-bridge") {
    process.exit(delegate(component, ["detect"]));
  } else {
    process.exit(delegate(component, process.argv.slice(2)));
  }
}
