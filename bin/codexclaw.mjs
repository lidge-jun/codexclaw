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
 *   codexclaw map                 generate a ranked repo map (repo-map skill, python3)
 *   codexclaw provider            show read-only opencodex (ocx) provider status
 *   codexclaw chat search         read-only recall search over ~/.codex rollouts (recall)
 *   codexclaw memory search       read-only search over ~/.codex memories (recall)
 *   codexclaw skill search|show   remote dormant-skill search over cli-jaw-skills/hermes/clawhub/gh (skill-search)
 *
 * This file is a thin delegator over compiled component CLIs; provider detection is
 * read-only and does not toggle or ensure opencodex.
 */
import { spawnSync } from "node:child_process";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, realpathSync, rmSync } from "node:fs";
import { homedir } from "node:os";

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

/**
 * Windows spawn helpers, inlined.
 *
 * bin/codexclaw.mjs is plain ESM with no build step, so it cannot import the TS
 * win-exec module the components use; it carries the same three rules here.
 *
 *  1. npm-installed CLIs are .cmd shims, and Node refuses shell-less .cmd spawns
 *     after the CVE-2024-27980 hardening (measured here as EINVAL, not ENOENT).
 *  2. A bare command name skips PATHEXT resolution, so spawnSync("npm") ENOENTs
 *     even with npm.cmd on PATH.
 *  3. shell:true is NOT the fix: Node does not escape cmd metacharacters there,
 *     and guiDir can contain spaces or an ampersand.
 */

/** Case-insensitive env lookup: a child can arrive with Path, PATH, or both. */
export function envValue(env, name) {
  const direct = env[name];
  if (direct !== undefined) return direct;
  const lower = name.toLowerCase();
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === lower) return env[key];
  }
  return undefined;
}

const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/** Resolve command against PATH x PATHEXT. Returns the input when nothing matches. */
export function resolveWindowsCommand(command, env) {
  if (command.includes("/") || command.includes("\\") || isAbsolute(command)) return command;
  const exts = (envValue(env, "PATHEXT") ?? DEFAULT_PATHEXT).split(";").filter((e) => e.length > 0);
  const dirs = (envValue(env, "PATH") ?? "").split(delimiter).filter((d) => d.length > 0);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, command + ext);
      if (existsSync(candidate)) return candidate;
      // Case-sensitive filesystems (WSL, Linux CI): PATHEXT spells ".EXE" but
      // real shims are "npm.cmd" / "gh.exe", so retry the lowercased extension
      // before giving up. On win32 this second stat is a no-op hit anyway.
      const lowered = join(dir, command + ext.toLowerCase());
      if (existsSync(lowered)) return lowered;
    }
  }
  return command;
}

/** cross-spawn's escaping: double backslashes before quotes, quote, then caret. */
function escapeCmdArg(arg) {
  let out = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  out = `"${out}"`;
  return out.replace(/[()%!^"<>&|;, ]/g, "^$&");
}

function escapeCmdCommand(command) {
  return command.replace(/[()%!^"<>&|;, ]/g, "^$&");
}

/**
 * Build the spawn shape for command. POSIX is a passthrough; win32 resolves
 * PATHEXT and routes only .cmd/.bat through cmd.exe.
 */
export function commandInvocation(command, args, platform = process.platform, env = process.env) {
  if (platform !== "win32") return { file: command, args: [...args], options: {} };
  const resolved = resolveWindowsCommand(command, env);
  if (!/\.(cmd|bat)$/i.test(resolved)) return { file: resolved, args: [...args], options: {} };
  const line = [escapeCmdCommand(resolved), ...args.map(escapeCmdArg)].join(" ");
  return {
    file: envValue(env, "ComSpec") ?? "cmd.exe",
    args: ["/d", "/s", "/c", `"${line}"`],
    options: { windowsVerbatimArguments: true },
  };
}

/** Delegate a subcommand to the compiled config-guard CLI; returns its exit code. */
function runConfigGuard(subcommand) {
  const res = spawnSync(process.execPath, [configGuardCli, subcommand], { stdio: "inherit" });
  return typeof res.status === "number" ? res.status : 1;
}

/** Delegate to the compiled cxc-ops CLI (doctor/reset/hooks); returns its exit code. */
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

const TOP_LEVEL_HELP = [
  "cxc — codexclaw operator CLI",
  "",
  "Usage:",
  "  cxc <command> [args]",
  "  cxc --help",
  "",
  "Core:",
  "  enable                         activate declared Codex feature flags",
  "  disable | uninstall            revert flags codexclaw enabled when safe",
  "  status                         show declared feature-flag state",
  "  doctor                         run plugin health checks",
  "  reset                          remove scoped .codexclaw state/generated files",
  "  hooks retrust                  re-trust plugin hook hashes after editing hook JSONs",
  "",
  "PABCD / loop:",
  "  orchestrate <verb>             drive IPABCD state (try: cxc orchestrate --help)",
  "  freeze                         freeze the interview plan and show goal handoff",
  "  loop init|show|validate         manage the project-local goalplan substrate",
  "  goalplan init|show|validate     deprecated alias for loop",
  "  plan init <slug> [--phases N]   scaffold the devlog/_plan unit the P>A gate verifies",
  "  metric                         record/show objective metrics",
  "  divergence                     record divergence mode and candidate archive state",
  "",
  "Workspace intelligence:",
  "  map [dir]                      generate a ranked repo structure map",
  "  chat search \"query\"             search Codex chat history",
  "  memory search \"query\"           search Codex memories",
  "  skill search|show              search and display dormant skills",
  "",
  "Operations:",
  "  subagents                      read/write per-role subagent model+prompt config",
  "  provider                       show read-only opencodex provider status",
  "  serve                          run the bridge server",
  "  service                        install/uninstall/status the serve daemon",
  "  gui                            launch the web dashboard",
  "",
  "Agent notes:",
  "  Mutating PABCD commands require the current session id: cxc orchestrate P --session <id>",
  "  Use --json only on subcommands that document it, such as orchestrate status --json.",
  "  For command-specific help, start with: cxc orchestrate --help or cxc map --help.",
].join("\n");

function renderTopLevelHelp() {
  return TOP_LEVEL_HELP;
}

function renderUnknownTopLevelCommand(cmd) {
  return `codexclaw: unknown command '${cmd}'\nRun \`cxc --help\` for usage.`;
}

/**
 * Pick the interpreter command for the vendored repo-map script (bootstrap ladder).
 *
 * Rungs, highest priority first (SOT: pabcd repo-map-capability.md packaging note):
 *   0. `--help`/`-h` anywhere in args -> bare python3 (dep-free help contract).
 *   1. CODEXCLAW_PYTHON env override -> that interpreter, verbatim.
 *   2. `uv` on PATH -> `uv run --with-requirements <reqs> python -B script ...`
 *      (deps resolve into uv's own rebuildable cache; no venv to manage).
 *   3. existing venv at $CODEXCLAW_HOME|~/.codexclaw/venvs/repomap -> its python.
 *      The venv is only auto-created when CODEXCLAW_MAP_BOOTSTRAP=1 (opt-in network).
 *   4. bare python3 -> repomap.py itself degrades to an exit-3 install hint.
 *
 * Pure helper (no spawning) so packaging tests can assert the ladder offline.
 */
export function selectRepoMapCommand(args, env, deps, platform = process.platform) {
  const { scriptPath, reqsPath, venvPython, hasUv, hasVenv } = deps;
  const wantsHelp = args.some((a) => a === "--help" || a === "-h");
  if (!wantsHelp && env.CODEXCLAW_PYTHON && env.CODEXCLAW_PYTHON.trim()) {
    return { cmd: env.CODEXCLAW_PYTHON, args: ["-B", scriptPath, ...args] };
  }
  if (!wantsHelp && hasUv) {
    return {
      cmd: "uv",
      args: ["run", "--quiet", "--with-requirements", reqsPath, "python", "-B", scriptPath, ...args],
    };
  }
  if (!wantsHelp && hasVenv) {
    return { cmd: venvPython, args: ["-B", scriptPath, ...args] };
  }
  // On Windows, bare "python3" resolves to the Microsoft Store stub at
  // %LOCALAPPDATA%\Microsoft\WindowsApps\python3.exe - a real executable that
  // exits 9009 without running Python, so it is not even an ENOENT. The py
  // launcher ships with every python.org install at C:\Windows\py.exe.
  if (platform === "win32" && !(env.CODEXCLAW_PYTHON && env.CODEXCLAW_PYTHON.trim())) {
    return { cmd: "py", args: ["-3", "-B", scriptPath, ...args] };
  }
  return { cmd: env.CODEXCLAW_PYTHON || "python3", args: ["-B", scriptPath, ...args] };
}

/**
 * Locate the user-level rebuildable repomap venv (philosophy derived-cache rule).
 *
 * Windows venvs put the interpreter at Scripts\python.exe, never bin/python3. With
 * the POSIX-only path, hasVenv was always false on Windows, so every
 * CODEXCLAW_MAP_BOOTSTRAP=1 run created a venv, failed to find its pip, and
 * rmSync'd the venv it had just built.
 *
 * platform is a parameter so the packaging test can assert both shapes from one OS.
 */
export function repoMapVenvPython(env, home, platform = process.platform) {
  const base = env.CODEXCLAW_HOME && env.CODEXCLAW_HOME.trim() !== "" ? env.CODEXCLAW_HOME : join(home, ".codexclaw");
  return platform === "win32"
    ? join(base, "venvs", "repomap", "Scripts", "python.exe")
    : join(base, "venvs", "repomap", "bin", "python3");
}

/** Run the vendored repo-map Python script (skill-owned, no dist build). argv: [...rest]. */
function runRepoMap(args) {
  const scriptsDir = join(here, "..", "plugins", "codexclaw", "skills", "repo-map", "scripts");
  const scriptPath = join(scriptsDir, "repomap.py");
  const reqsPath = join(scriptsDir, "requirements.txt");
  const venvPython = repoMapVenvPython(process.env, homedir());
  let hasVenv = existsSync(venvPython);

  // Opt-in one-time venv bootstrap (network): CODEXCLAW_MAP_BOOTSTRAP=1.
  if (!hasVenv && process.env.CODEXCLAW_MAP_BOOTSTRAP === "1" && !process.env.CODEXCLAW_PYTHON) {
    const venvDir = dirname(dirname(venvPython));
    console.error(`codexclaw map: bootstrapping venv at ${venvDir} (one-time)...`);
    // Same Store-stub reason as the ladder below: bare python3 exits 9009 here.
    const bootstrapBin = process.platform === "win32" ? "py" : "python3";
    const bootstrapArgs =
      process.platform === "win32" ? ["-3", "-m", "venv", venvDir] : ["-m", "venv", venvDir];
    const mk = spawnSync(bootstrapBin, bootstrapArgs, { stdio: "inherit" });
    if (mk.status === 0) {
      const pip = spawnSync(venvPython, ["-m", "pip", "install", "-q", "-r", reqsPath], { stdio: "inherit" });
      hasVenv = pip.status === 0;
      if (!hasVenv) {
        console.error("codexclaw map: venv bootstrap failed; falling back.");
        rmSync(venvDir, { recursive: true, force: true });
      }
    }
  }

  const uvRes = spawnSync("uv", ["--version"], { stdio: "ignore" });
  const hasUv = !uvRes.error && uvRes.status === 0;
  const sel = selectRepoMapCommand(args, process.env, { scriptPath, reqsPath, venvPython, hasUv, hasVenv });
  const inv = commandInvocation(sel.cmd, sel.args);
  const res = spawnSync(inv.file, inv.args, { stdio: "inherit", ...inv.options });
  // 9009 is cmd.exe's "command not recognized" and the Store stub's exit code;
  // 127 is the POSIX equivalent. Neither sets res.error, so the ENOENT-only guard
  // let "cxc map" exit silently with no diagnostic at all.
  const notFound =
    (res.error && res.error.code === "ENOENT") || res.status === 9009 || res.status === 127;
  if (notFound) {
    console.error(
      `codexclaw map: ${sel.cmd} could not be run (exit ${res.status ?? "spawn error"}).` +
        (process.platform === "win32"
          ? " Install Python 3.9+ from python.org (the Microsoft Store alias exits 9009 without running), or set CODEXCLAW_PYTHON."
          : " Install Python 3.9+ or set CODEXCLAW_PYTHON."),
    );
    return 1;
  }
  return typeof res.status === "number" ? res.status : 1;
}

// Only dispatch when executed directly; the ladder helpers are importable for tests.
// Compare via realpath: npm global installs and the plugin cache reach this file
// through symlinks, so a plain resolve() comparison misses real CLI runs.
function realOrSelf(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const isMain = Boolean(
  process.argv[1] &&
    realOrSelf(fileURLToPath(import.meta.url)) === realOrSelf(resolve(process.argv[1])),
);
const cmd = process.argv[2] ?? "help";
if (isMain) switch (cmd) {
  case "help":
  case "--help":
  case "-h":
    console.log(renderTopLevelHelp());
    process.exit(0);
    break;
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
  case "hooks":
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
  case "plan":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "plan".
    // Scaffolds devlog/_plan/YYMMDD_slug/ for the P>A plan-artifact gate (260714 wp2).
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "release":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "release".
    // Release-candidate manifest producer + fail-closed verifier (260815 wp3).
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "receipt":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "receipt".
    // Runs a command and records the observed exit for the C>D gate (075).
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "review-round":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "review-round".
    // Opens and inspects plan-audit rounds for the A>B binding gate (060). There is
    // no close verb: the SubagentStop observer writes the verdict.
    process.exit(runPabcdState(process.argv.slice(2)));
    break;
  case "scan":
    // pabcd-state CLI expects argv as [kind, ...rest]; kind === "scan".
    // Records an interview contradiction-scan round (H4, 260724): ledger event +
    // tracker counters, so the I->P readiness gate is passable without override.
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
      // Name the real directory rather than a POSIX-looking relative path.
      console.log(`codexclaw gui: dependencies not installed. Run \`npm install\` in ${guiDir} first.`);
      process.exit(1);
    }
    console.log("codexclaw gui: starting the dashboard (Vite will print the local URL)...");
    // npm on PATH is a .cmd shim Node refuses to exec shell-less, and a bare "npm"
    // skips PATHEXT, so this ENOENTs on Windows even though npm works in the same
    // shell. shell:true is NOT the fix - guiDir may contain spaces and Node does
    // not escape cmd metacharacters under shell:true.
    const inv = commandInvocation("npm", ["run", "dev"]);
    const res = spawnSync(inv.file, inv.args, { cwd: guiDir, stdio: "inherit", ...inv.options });
    if (res.error) {
      const hint =
        res.error.code === "ENOENT"
          ? "npm was not found on PATH; install Node.js/npm and retry"
          : `npm could not be launched: ${res.error.message}`;
      console.error(`codexclaw gui: ${hint}`);
      process.exit(1);
    }
    process.exit(typeof res.status === "number" ? res.status : 1);
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
  case "map":
    // repo-map skill script (vendored RepoMapper); stateless one-shot, degrades to
    // an install hint when Python deps are missing.
    process.exit(runRepoMap(process.argv.slice(3)));
    break;
  case "provider":
    process.exit(runProvider());
    break;
  default:
    console.error(renderUnknownTopLevelCommand(cmd));
    process.exit(1);
}
