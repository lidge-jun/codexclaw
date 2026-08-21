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
import { delimiter, isAbsolute, join } from "node:path";







/** Case-insensitive env lookup with a key-scan fallback. */
export function envValue(env                   , name        )                     {
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
export function resolveWindowsCommand(command        , env                   )         {
  if (command.includes("/") || command.includes("\\") || isAbsolute(command)) return command;
  const exts = (envValue(env, "PATHEXT") ?? DEFAULT_PATHEXT).split(";").filter((e) => e.length > 0);
  const dirs = (envValue(env, "PATH") ?? "").split(delimiter).filter((d) => d.length > 0);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, command + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return command;
}

/** cross-spawn's escaping: double backslashes before quotes, quote, then caret. */
function escapeCmdArg(arg        )         {
  let out = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  out = `"${out}"`;
  return out.replace(/[()%!^"<>&|;, ]/g, "^$&");
}

function escapeCmdCommand(command        )         {
  return command.replace(/[()%!^"<>&|;, ]/g, "^$&");
}

/**
 * Build the spawn shape for `command`. POSIX is a passthrough; win32 resolves
 * PATHEXT and routes only `.cmd`/`.bat` through cmd.exe.
 */
export function commandInvocation(
  command        ,
  args          ,
  platform                  = process.platform,
  env                    = process.env,
)             {
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

