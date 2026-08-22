/**
 * codex-bin.ts - resolving the `codex` executable before spawning it.
 *
 * `spawnSync("codex", ...)` with no shell fails on Windows in two different ways,
 * and both were measured on a stock Codex-desktop host (issue #33):
 *
 *  1. When the Codex desktop app is installed, a PATH entry points at the
 *     packaged `WindowsApps\...\codex.EXE`. That file is readable and is not a
 *     reparse point, so no stat-based probe rejects it, yet CreateProcess still
 *     refuses it: spawnSync reports EPERM (not ENOENT), and cmd.exe reports
 *     "Access is denied." Only the Store app-execution alias may launch it, so
 *     the discriminator is the `WindowsApps` path segment itself, not file mode.
 *  2. The npm shim next to it is `codex.CMD`, and Node refuses shell-less
 *     `.cmd` spawns after the CVE-2024-27980 hardening: EINVAL.
 *
 * So the ladder is: explicit CODEX_BIN override, then a PATH/PATHEXT walk that
 * skips WindowsApps, then a cmd.exe hop that lets the shell resolve the alias
 * itself (measured working where every direct spawn failed).
 *
 * Everything is platform- and env-parameterized so the whole contract is
 * testable from any OS.
 */
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { commandInvocation, envValue, type Invocation } from "./win-exec.ts";

const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/**
 * True when `candidate` sits under a WindowsApps directory.
 *
 * Matched as a whole path segment on either separator so a legitimately named
 * directory like `C:\tools\MyWindowsAppsBackup` is not swept up with it.
 */
export function isWindowsAppsAlias(candidate: string): boolean {
  return /(^|[\\/])WindowsApps([\\/]|$)/i.test(candidate);
}

/**
 * Walk PATH x PATHEXT and return every spawnable match, nearest first.
 *
 * WindowsApps hits are dropped: they resolve but cannot be launched directly,
 * and returning one would turn a working cmd.exe fallback into a hard EPERM.
 */
export function spawnableWindowsCandidates(command: string, env: NodeJS.ProcessEnv): string[] {
  if (command.includes("/") || command.includes("\\") || isAbsolute(command)) {
    return isWindowsAppsAlias(command) ? [] : [command];
  }
  const exts = (envValue(env, "PATHEXT") ?? DEFAULT_PATHEXT).split(";").filter((e) => e.length > 0);
  // A WINDOWS PATH is always ";"-separated. node:path's `delimiter` follows the
  // HOST, so on a Linux CI runner exercising this win32-only walk it would be ":"
  // and the whole PATH would collapse into one bogus directory entry.
  const dirs = (envValue(env, "PATH") ?? "").split(";").filter((d) => d.length > 0);
  const found: string[] = [];
  // Case-insensitive dedupe: on NTFS "codex.CMD" and "codex.cmd" are one file,
  // and CreateProcess cannot tell them apart either.
  const seen = new Set<string>();
  for (const dir of dirs) {
    if (isWindowsAppsAlias(dir)) continue;
    for (const ext of exts) {
      // Case-sensitive filesystems spell the shim "codex.cmd" while PATHEXT
      // spells ".CMD", so try both spellings (win-exec.ts carries the same rule).
      for (const spelling of [ext, ext.toLowerCase()]) {
        const candidate = join(dir, command + spelling);
        const key = candidate.toLowerCase();
        if (seen.has(key) || !existsSync(candidate)) continue;
        seen.add(key);
        found.push(candidate);
      }
    }
  }
  return found;
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
 * Hand the bare command to cmd.exe and let the shell resolve it.
 *
 * This is the only route that starts a Store-aliased codex, because the alias
 * is resolvable by the shell but not by a direct CreateProcess.
 */
function cmdShellInvocation(command: string, args: string[], env: NodeJS.ProcessEnv): Invocation {
  const line = [escapeCmdCommand(command), ...args.map(escapeCmdArg)].join(" ");
  return {
    file: envValue(env, "ComSpec") ?? "cmd.exe",
    args: ["/d", "/s", "/c", `"${line}"`],
    options: { windowsVerbatimArguments: true },
  };
}

/**
 * Build the spawn shape for the `codex` CLI.
 *
 * POSIX is a passthrough; `CODEX_BIN` wins on every platform when it is set.
 */
export function resolveCodexInvocation(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Invocation {
  const override = envValue(env, "CODEX_BIN")?.trim();
  const target = override && override.length > 0 ? override : command;
  if (platform !== "win32") return { file: target, args: [...args], options: {} };

  // An explicit override is honored as written; only PATH discovery filters.
  const resolved = override && override.length > 0
    ? (spawnableWindowsCandidates(override, env)[0] ?? null)
    : (spawnableWindowsCandidates(command, env)[0] ?? null);
  if (resolved === null) return cmdShellInvocation(target, args, env);
  // commandInvocation already routes .cmd/.bat through ComSpec and spawns a
  // resolved .exe directly; the path it gets here is absolute, so it re-resolves
  // nothing.
  return commandInvocation(resolved, args, platform, env);
}
