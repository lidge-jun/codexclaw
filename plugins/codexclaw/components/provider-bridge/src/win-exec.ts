/**
 * win-exec.ts - one entry point for spawning external commands.
 *
 * Three Windows facts drive this:
 *  1. npm-installed CLIs are `.cmd` shims, and Node refuses shell-less `.cmd` spawns
 *     after the CVE-2024-27980 hardening.
 *  2. A bare command name skips PATHEXT resolution, so `spawn("npm")` ENOENTs even
 *     with `npm.cmd` on PATH (measured, 002 B4).
 *  3. `shell: true` is not a fix: Node does not escape cmd metacharacters there, so
 *     a path containing `&` or `^` becomes a command injection.
 *
 * Env vars are read case-insensitively: a spawned child can arrive with `Path`,
 * `PATH`, or both, and reading one fixed spelling resolves against the wrong list
 * (001 3.2).
 */
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export interface Invocation {
  file: string;
  args: string[];
  options: { windowsVerbatimArguments?: boolean };
}

/** Case-insensitive env lookup with a key-scan fallback. */
export function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const direct = env[name];
  if (direct !== undefined) return direct;
  const lower = name.toLowerCase();
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === lower) return env[key];
  }
  return undefined;
}

const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/** Resolve `command` against PATH + PATHEXT. Returns the input when nothing matches. */
export function resolveWindowsCommand(command: string, env: NodeJS.ProcessEnv): string {
  if (command.includes("/") || command.includes("\\") || isAbsolute(command)) return command;
  const exts = (envValue(env, "PATHEXT") ?? DEFAULT_PATHEXT).split(";").filter((e) => e.length > 0);
  // A WINDOWS PATH is always ";"-separated. node:path's `delimiter` follows the
  // HOST, so on a Linux runner exercising this win32-only walk it would be ":"
  // and the whole PATH would collapse into one bogus directory entry.
  const dirs = (envValue(env, "PATH") ?? "").split(";").filter((d) => d.length > 0);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, command + ext);
      if (existsSync(candidate)) return candidate;
      // Case-sensitive filesystems (WSL, Linux CI): PATHEXT spells ".EXE" but
      // real shims are "npm.cmd" / "gh.exe". Retry the lowercased extension.
      const lowered = join(dir, command + ext.toLowerCase());
      if (existsSync(lowered)) return lowered;
    }
  }
  return command;
}

/** cross-spawn's escaping: double backslashes before quotes, quote, then caret. */
function escapeCmdArg(arg: string): string {
  let out = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  out = `"${out}"`;
  return out.replace(/[()%!^"<>&|;, ]/g, "^$&");
}

function escapeCmdCommand(command: string): string {
  return command.replace(/[()%!^"<>&|;, ]/g, "^$&");
}

/**
 * Build the spawn shape for `command`. POSIX is a passthrough; win32 resolves
 * PATHEXT and routes only `.cmd`/`.bat` through cmd.exe.
 */
export function commandInvocation(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Invocation {
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
