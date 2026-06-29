#!/usr/bin/env node
/**
 * provider-bridge — SessionStart hook entry (L23, detect-only).
 *
 * Detects opencodex (`ocx`) and emits a machine-readable provider status line
 * for downstream catalog (L25) and GUI (L27) consumers. DETECT-ONLY (Q-P2-2):
 * never runs `ocx ensure`, never mutates codex config, never vendors opencodex.
 * Always exits 0 — a missing or broken ocx must not fail the session; the status
 * line carries native/provider/error so consumers can react.
 */
import { spawnSync } from "node:child_process";
import { detectOcx, renderStatusLine, type DetectDeps } from "./detect.ts";

/** Real PATH resolver via the platform `command -v` / `where`. */
function whichOcx(cmd: string): string | null {
  const finder = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [cmd] : ["-v", cmd];
  try {
    const res = spawnSync(finder, args, { encoding: "utf8", shell: process.platform !== "win32" });
    if (res.status === 0 && typeof res.stdout === "string") {
      const path = res.stdout.split("\n")[0]?.trim();
      return path && path.length > 0 ? path : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Real ocx status reader (detect-only — `status --json` is read-only; never
 *  `ensure`/`sync`, which would mutate codex config). */
function runOcxStatus(ocxPath: string): { status: number | null; stdout: string } {
  const res = spawnSync(ocxPath, ["status", "--json"], { encoding: "utf8", timeout: 8000 });
  return { status: res.status, stdout: typeof res.stdout === "string" ? res.stdout : "" };
}

export function runBridge(deps: DetectDeps = { which: whichOcx, runStatus: runOcxStatus }): number {
  const status = detectOcx(deps);
  // SessionStart additionalContext: a single JSON status line for consumers.
  process.stdout.write(`${renderStatusLine(status)}\n`);
  return 0; // always 0 — detect-only never fails the session.
}

const [, , kind, event] = process.argv;
if (kind === "hook" && event === "session-start") {
  process.exit(runBridge());
}
// Allow `provider-bridge detect` for cxc doctor / manual probes.
if (kind === "detect") {
  process.exit(runBridge());
}
process.exit(0);
