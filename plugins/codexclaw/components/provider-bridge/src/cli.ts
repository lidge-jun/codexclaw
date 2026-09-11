#!/usr/bin/env node
/**
 * provider-bridge — SessionStart hook entry (L23, detect-only).
 *
 * Detects opencodex (`ocx`) and emits a machine-readable provider status line
 * inside the SessionStart hook envelope. The `detect` command keeps the raw line
 * for downstream catalog (L25) and GUI (L27) consumers. DETECT-ONLY (Q-P2-2):
 * never runs `ocx ensure`, never mutates codex config, never vendors opencodex.
 * Always exits 0 — a missing or broken ocx must not fail the session; the status
 * line carries native/provider/error so consumers can react.
 */
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectOcx, renderStatusLine, type DetectDeps } from "./detect.ts";

/** PATHEXT default when the env var is missing or empty (win-exec convention). */
const DEFAULT_WIN32_PATHEXT = ".COM;.EXE;.BAT;.CMD";

function whereLines(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function pathExt(filePath: string): string {
  // Normalize slashes so Linux CI can still read a Windows `where` listing.
  return extname(filePath.replaceAll("\\", "/")).toLowerCase();
}

function pathextList(pathext: string | undefined): string[] {
  const raw = pathext && pathext.trim().length > 0 ? pathext : DEFAULT_WIN32_PATHEXT;
  return raw
    .split(";")
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => ext.length > 0);
}

/**
 * Pick a spawnable path from `where` / `command -v` stdout.
 * On win32, PATHEXT-backed launchers beat the extensionless npm sh shim that
 * `where` prints first. No executable candidate -> first line, matching the
 * historical resolver.
 */
export function selectExecutableFromWhereOutput(
  stdout: string,
  options: { platform: NodeJS.Platform; pathext?: string },
): string | null {
  const lines = whereLines(stdout);
  if (lines.length === 0) return null;
  if (options.platform !== "win32") return lines[0] ?? null;
  const allowed = pathextList(options.pathext);
  const match = lines.find((line) => {
    const ext = pathExt(line);
    return ext.length > 0 && allowed.includes(ext);
  });
  return match ?? lines[0] ?? null;
}

function isWindowsBatchLauncher(ocxPath: string): boolean {
  const ext = pathExt(ocxPath);
  return ext === ".cmd" || ext === ".bat";
}

/** Real PATH resolver via the platform `command -v` / `where`. */
function whichOcx(cmd: string): string | null {
  const finder = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [cmd] : ["-v", cmd];
  try {
    const res = spawnSync(finder, args, { encoding: "utf8", shell: process.platform !== "win32" });
    if (res.status === 0 && typeof res.stdout === "string") {
      return selectExecutableFromWhereOutput(res.stdout, {
        platform: process.platform,
        pathext: process.env.PATHEXT,
      });
    }
    return null;
  } catch {
    return null;
  }
}

/** Real ocx status reader (detect-only — `status --json` is read-only; never
 *  `ensure`/`sync`, which would mutate codex config). */
function runOcxStatus(ocxPath: string): { status: number | null; stdout: string } {
  const res =
    process.platform === "win32" && isWindowsBatchLauncher(ocxPath)
      ? spawnSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", `"${ocxPath}" status --json`],
          { encoding: "utf8", timeout: 8000, windowsVerbatimArguments: true },
        )
      : spawnSync(ocxPath, ["status", "--json"], { encoding: "utf8", timeout: 8000 });
  return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
}

export function runBridge(deps: DetectDeps = { which: whichOcx, runStatus: runOcxStatus }): number {
  const status = detectOcx(deps);
  process.stdout.write(`${renderStatusLine(status)}\n`);
  return 0; // always 0 — detect-only never fails the session.
}

export function runSessionStartHook(deps: DetectDeps = { which: whichOcx, runStatus: runOcxStatus }): number {
  const status = detectOcx(deps);
  const envelope = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      // SessionStart additionalContext: a single JSON status line for consumers.
      additionalContext: renderStatusLine(status),
    },
  };
  process.stdout.write(`${JSON.stringify(envelope)}\n`);
  return 0; // always 0 — detect-only never fails the session.
}

function realOrSelf(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

function main(): number {
  const [, , kind, event] = process.argv;
  if (kind === "hook" && event === "session-start") {
    return runSessionStartHook();
  }
  // Allow `provider-bridge detect` for cxc doctor / manual probes.
  if (kind === "detect") {
    return runBridge();
  }
  return 0;
}

// Direct-exec guard: importing this module from a test must not exit.
const invokedPath = process.argv[1] ? realOrSelf(resolve(process.argv[1])) : "";
if (invokedPath === realOrSelf(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
