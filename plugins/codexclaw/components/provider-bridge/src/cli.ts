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
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectOcx, renderStatusLine, type DetectDeps } from "./detect.ts";
import { commandInvocation, resolveWindowsCommand } from "./win-exec.ts";

/**
 * Resolve `ocx` to a spawnable path.
 *
 * #131: on win32 an npm global install lays down BOTH an extensionless sh shim and
 * a `.cmd` launcher, and `where ocx` lists the extensionless one FIRST. That file is
 * not an executable image, so spawning it fails with ENOENT and detect reports
 * `ocx status exited null`. Resolve PATH+PATHEXT directly instead of picking a line
 * out of `where` stdout: resolveWindowsCommand reads PATH/PATHEXT case-insensitively
 * (a child can arrive with `Path`, `PATH`, or both), splits PATH on a literal `;`
 * rather than node:path's host-dependent delimiter, and retries the lowercased
 * extension for case-sensitive filesystems. POSIX keeps `command -v`.
 */
function whichOcx(cmd: string): string | null {
  if (process.platform === "win32") {
    const resolved = resolveWindowsCommand(cmd, process.env);
    // resolveWindowsCommand returns its input unchanged when nothing matched.
    return resolved === cmd ? null : resolved;
  }
  try {
    const res = spawnSync("command", ["-v", cmd], { encoding: "utf8", shell: true });
    if (res.status === 0 && typeof res.stdout === "string") {
      const path = res.stdout.split(/\r?\n/)[0]?.trim();
      return path && path.length > 0 ? path : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Real ocx status reader (detect-only — `status --json` is read-only; never
 * `ensure`/`sync`, which would mutate codex config).
 *
 * #131 second half: after the CVE-2024-27980 hardening (Node 18.20.2 / 20.12.2)
 * a shell-less `.cmd` spawn fails with EINVAL. commandInvocation routes only
 * `.cmd`/`.bat` through ComSpec and escapes cmd metacharacters; `shell: true` would
 * not escape them, so a launcher path containing `&` or `^` would be an injection.
 */
function runOcxStatus(ocxPath: string): { status: number | null; stdout: string } {
  const inv = commandInvocation(ocxPath, ["status", "--json"]);
  const res = spawnSync(inv.file, inv.args, { encoding: "utf8", timeout: 8000, ...inv.options });
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
