/**
 * cli.ts — `cxc-ops` entry point (L20). Subcommands: doctor | reset | hooks | hook.
 *
 * Resolves the plugin root relative to this compiled file (dist/ -> component ->
 * components -> plugin root). Operations are synchronous. Exit codes: doctor
 * FAIL and hooks errors -> 1; reset and successful operations -> 0. Unknown
 * subcommands print the usage line and exit 0 (informational, not an error).
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { runDoctor, renderDoctor } from "./doctor.ts";
import { parseResetScope, runReset, renderReset } from "./reset.ts";
import { runMapAffordanceSessionStart } from "./map-affordance.ts";
import { diagnoseHookTrust, readInstalledPluginKeys, retrustHooks } from "./hook-trust.ts";

/** Read all of stdin synchronously (hook payload); "" if none/unavailable. */
function readStdinSync(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function pluginRootFrom(metaUrl: string): string {
  // dist/cli.js -> components/cxc-ops/dist -> components/cxc-ops -> components -> <pluginRoot>
  const here = dirname(fileURLToPath(metaUrl));
  return resolve(here, "..", "..", "..");
}

interface HookCliOptions {
  codexHome: string;
  pluginKey?: string;
  bootstrapOk: boolean;
}

function parseHookOptions(args: string[]): HookCliOptions {
  const options: HookCliOptions = {
    codexHome: process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    bootstrapOk: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bootstrap-ok") {
      options.bootstrapOk = true;
    } else if (arg === "--key" || arg === "--codex-home") {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === "--key") options.pluginKey = value;
      else options.codexHome = resolve(value);
      index += 1;
    } else {
      throw new Error(`unknown hooks option: ${arg}`);
    }
  }
  return options;
}

function resolvePluginKey(pluginRoot: string, options: HookCliOptions): string {
  if (options.pluginKey) return options.pluginKey;
  const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8")) as { name?: unknown };
  if (typeof manifest.name !== "string" || !manifest.name) throw new Error("plugin manifest has no name");
  const candidates = readInstalledPluginKeys(options.codexHome, manifest.name);
  if (candidates.length !== 1) {
    throw new Error(`enabled install key is ambiguous (${candidates.length}); candidates: ${candidates.length ? candidates.join(", ") : "(none)"}; pass --key <plugin@marketplace>`);
  }
  return candidates[0];
}

export async function main(argv: string[], metaUrl: string): Promise<number> {
  const cmd = argv[0] ?? "help";
  const rest = argv.slice(1);

  switch (cmd) {
    case "doctor": {
      const options = parseHookOptions(rest);
      const report = runDoctor(pluginRootFrom(metaUrl), undefined, options);
      process.stdout.write(`${renderDoctor(report)}\n`);
      return report.overall === "FAIL" ? 1 : 0;
    }
    case "reset": {
      const scope = parseResetScope(rest);
      const result = runReset(process.cwd(), scope);
      process.stdout.write(`${renderReset(result)}\n`);
      return 0;
    }
    case "hooks": {
      if (rest[0] !== "retrust") {
        process.stdout.write("cxc-ops hooks retrust [--key <plugin@marketplace>] [--codex-home <path>] [--bootstrap-ok]\n");
        return 1;
      }
      try {
        const pluginRoot = pluginRootFrom(metaUrl);
        const options = parseHookOptions(rest.slice(1));
        const pluginKey = resolvePluginKey(pluginRoot, options);
        const result = retrustHooks(options.codexHome, pluginRoot, pluginKey, options.bootstrapOk);
        for (const hook of diagnoseHookTrust(options.codexHome, pluginRoot, pluginKey)) {
          process.stdout.write(`[${hook.status}] ${hook.key} expected=${hook.hash} actual=${hook.actual ?? "(none)"}\n`);
        }
        process.stdout.write(`updated=${result.updated} appended=${result.appended}\nbackup: ${result.backupPath}\n`);
        return 0;
      } catch (error) {
        process.stderr.write(`cxc-ops hooks retrust: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
      }
    }
    case "hook": {
      // Only the map-affordance SessionStart hook lives here today.
      if (rest[0] === "session-start") {
        const out = runMapAffordanceSessionStart(readStdinSync(), process.cwd());
        if (out) process.stdout.write(out);
        return 0; // read-only affordance never fails the session
      }
      process.stdout.write("cxc-ops hook <session-start>\n");
      return 0;
    }
    default:
      process.stdout.write("cxc-ops <doctor|reset [--state|--generated|--goalplans|--all]|hooks retrust|hook session-start>\n");
      return 0;
  }
}

// Direct-exec guard: run only when invoked as a script, not when imported by tests.
// Compare via realpath — the plugin cache reaches this file through a symlinked
// components/ dir, so a plain resolve() comparison misses real hook invocations.
function realOrSelf(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const invokedPath = process.argv[1] ? realOrSelf(resolve(process.argv[1])) : "";
const selfPath = realOrSelf(fileURLToPath(import.meta.url));
if (invokedPath === selfPath) {
  main(process.argv.slice(2), import.meta.url).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`cxc-ops error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
