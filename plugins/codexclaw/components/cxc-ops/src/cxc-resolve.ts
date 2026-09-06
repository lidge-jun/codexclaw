/**
 * cxc-resolve.ts — single source of truth for "how do I say `cxc` on this machine".
 *
 * WHY (260724 fresh-install RCA): the marketplace payload ships only
 * `plugins/codexclaw/`, while the PATH-level `cxc` bin is mapped from the REPO ROOT
 * package.json — so on a fresh marketplace install every injected directive that
 * says `cxc orchestrate ...` names a command that does not exist. Emit sites must
 * therefore template their command strings through `cxcInvocation()` instead of
 * hardcoding the literal `cxc` prefix.
 *
 * Resolution ladder (deterministic per-process, B1 seam):
 *   1. `CODEXCLAW_CXC` env override (test pin + power-user override), trimmed.
 *   2. Known payload command + existing dispatcher -> owned payload invocation.
 *   3. Legacy/no-command or repo-only command: PATH `cxc`, then payload fallback.
 *
 * H1 (260724 A-round): there is deliberately NO free-text rewrite helper here.
 * Noun-phrase uses ("owns cxc orchestration"), prohibitions, Discord `!cxc` chat
 * commands, and messenger CLI output must keep the literal word; only COMMAND
 * strings are built through this module, at their emit site.
 */
import { existsSync, statSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Derive the payload root (the `plugins/codexclaw` directory) from a component
 * module URL. Works for both shipped `components/<c>/dist/<f>.js` and test-time
 * `components/<c>/src/<f>.ts` callers — both sit exactly three levels below the
 * payload root.
 */
export function payloadRootFromModule(moduleUrl: string): string {
  const file = fileURLToPath(moduleUrl);
  return resolve(dirname(file), "..", "..", "..");
}

// Reuse the dispatcher's actual command set. A partial payload without its bin
// retains the legacy PATH fallback; importing this module never runs a command.
let payloadCommands: Readonly<Record<string, string>> = {};
if (existsSync(join(payloadRootFromModule(import.meta.url), "bin", "cxc.mjs"))) {
  ({ COMMAND_TABLE: payloadCommands } = await import("../../../bin/cxc.mjs"));
}

/** Windows-aware executable name candidates for a PATH scan. */
const WIN_EXTS = ["", ".cmd", ".exe", ".bat", ".ps1"];

/**
 * True when an executable file named `cxc` is reachable through PATH. Pure file
 * scan — never spawns. Any unreadable PATH entry is skipped (fail-quiet: a
 * broken PATH segment must not break directive emission).
 */
export function cxcOnPath(env: Record<string, string | undefined> = process.env): boolean {
  const path = env.PATH ?? "";
  if (!path) return false;
  const names = process.platform === "win32" ? WIN_EXTS.map((e) => `cxc${e}`) : ["cxc"];
  for (const dir of path.split(delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      try {
        const candidate = join(dir, name);
        if (existsSync(candidate) && statSync(candidate).isFile()) return true;
      } catch {
        // ignore unreadable entries
      }
    }
  }
  return false;
}

/**
 * The command prefix an emitted directive should use for `cxc` commands on this
 * machine. See the resolution ladder in the module docs. The returned string is
 * safe to prepend to ` orchestrate status --session <id>` etc.
 */
export function cxcInvocation(
  moduleUrl: string,
  env: Record<string, string | undefined> = process.env,
  command?: string,
): string {
  const override = env.CODEXCLAW_CXC;
  if (typeof override === "string" && override.trim().length > 0) return override.trim();
  const dispatcher = join(payloadRootFromModule(moduleUrl), "bin", "cxc.mjs");
  if (command && Object.hasOwn(payloadCommands, command) && existsSync(dispatcher)) {
    return `node "${dispatcher}"`;
  }
  if (cxcOnPath(env)) return "cxc";
  return `node "${dispatcher}"`;
}
