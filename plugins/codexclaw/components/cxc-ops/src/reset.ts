/**
 * reset.ts — scoped codexclaw state cleanup (L20 / 203).
 *
 * Scopes (never touches codex global config under ~/.codex):
 *  - "state":     PABCD state only — .codexclaw/sessions/*.json + .codexclaw/ledger.jsonl
 *                 + .codexclaw/interviews/ (per-session scan-evidence ledgers)
 *  - "generated": generated artifacts — .codexclaw/interview/, freeze manifests
 *  - "goalplans": project-local goalplan substrate — .codexclaw/goalplans/ (lazygap_impl 030).
 *                 A goalplan can outlive a session reset (like a freeze manifest), so "state"
 *                 does NOT touch it; only "goalplans" or "all" remove it.
 *  - "all":       the entire .codexclaw/ working dir
 *
 * Returns the list of removed paths so callers (and tests) can verify the blast
 * radius. Pure filesystem; no network; refuses to escape the .codexclaw subtree.
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export type ResetScope = "state" | "generated" | "goalplans" | "all";

const STATE_DIR = ".codexclaw";
const SESSIONS_SUBDIR = "sessions";
const LEDGER_FILE = "ledger.jsonl";
const INTERVIEW_SUBDIR = "interview";
const INTERVIEWS_SUBDIR = "interviews";
const GOALPLANS_SUBDIR = "goalplans";

export interface ResetResult {
  scope: ResetScope;
  removed: string[];
  /** paths considered but absent (informational). */
  absent: string[];
}

function rmIfExists(path: string, removed: string[], absent: string[]): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    removed.push(path);
  } else {
    absent.push(path);
  }
}

/**
 * Compute and apply the reset for a given scope rooted at `cwd`. The codexclaw
 * state dir is always `<cwd>/.codexclaw`; nothing outside it is ever touched.
 */
export function runReset(cwd: string, scope: ResetScope): ResetResult {
  const stateDir = join(cwd, STATE_DIR);
  const removed: string[] = [];
  const absent: string[] = [];

  if (scope === "all") {
    rmIfExists(stateDir, removed, absent);
    return { scope, removed, absent };
  }

  if (scope === "state") {
    // Remove every per-session state file + the ledger, but leave other subdirs.
    const sessionsDir = join(stateDir, SESSIONS_SUBDIR);
    if (existsSync(sessionsDir) && statSync(sessionsDir).isDirectory()) {
      for (const f of readdirSync(sessionsDir)) {
        if (f.endsWith(".json")) rmIfExists(join(sessionsDir, f), removed, absent);
      }
    } else {
      absent.push(sessionsDir);
    }
    rmIfExists(join(stateDir, LEDGER_FILE), removed, absent);
    // 131/D2': per-session interview scan-evidence ledgers are session state too.
    rmIfExists(join(stateDir, INTERVIEWS_SUBDIR), removed, absent);
    return { scope, removed, absent };
  }

  if (scope === "goalplans") {
    // 030: project-local goalplan substrate. Distinct from session state so a plan
    // survives a `--state` reset; removed only here or via `--all`.
    rmIfExists(join(stateDir, GOALPLANS_SUBDIR), removed, absent);
    return { scope, removed, absent };
  }

  // scope === "generated"
  rmIfExists(join(stateDir, INTERVIEW_SUBDIR), removed, absent);
  return { scope, removed, absent };
}

/** Parse a CLI flag (--state|--generated|--all) into a scope; default "state". */
export function parseResetScope(args: string[]): ResetScope {
  if (args.includes("--all")) return "all";
  if (args.includes("--generated")) return "generated";
  if (args.includes("--goalplans")) return "goalplans";
  return "state";
}

export function renderReset(result: ResetResult): string {
  const head = `reset --${result.scope}: removed ${result.removed.length} path(s)`;
  const body = result.removed.map((p) => `  - ${p}`).join("\n");
  return result.removed.length ? `${head}\n${body}` : `${head} (nothing to remove)`;
}
