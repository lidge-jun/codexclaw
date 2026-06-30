/**
 * reset.ts — scoped codexclaw state cleanup (L20 / 203).
 *
 * Scopes (never touches codex global config under ~/.codex):
 *  - "state":     PABCD state only — .codexclaw/sessions/*.json + .codexclaw/ledger.jsonl
 *                 + .codexclaw/interviews/ (per-session scan-evidence ledgers)
 *  - "generated": generated artifacts — .codexclaw/interview/, freeze manifests
 *  - "all":       the entire .codexclaw/ working dir
 *
 * Returns the list of removed paths so callers (and tests) can verify the blast
 * radius. Pure filesystem; no network; refuses to escape the .codexclaw subtree.
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";



const STATE_DIR = ".codexclaw";
const SESSIONS_SUBDIR = "sessions";
const LEDGER_FILE = "ledger.jsonl";
const INTERVIEW_SUBDIR = "interview";
const INTERVIEWS_SUBDIR = "interviews";








function rmIfExists(path        , removed          , absent          )       {
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
export function runReset(cwd        , scope            )              {
  const stateDir = join(cwd, STATE_DIR);
  const removed           = [];
  const absent           = [];

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

  // scope === "generated"
  rmIfExists(join(stateDir, INTERVIEW_SUBDIR), removed, absent);
  return { scope, removed, absent };
}

/** Parse a CLI flag (--state|--generated|--all) into a scope; default "state". */
export function parseResetScope(args          )             {
  if (args.includes("--all")) return "all";
  if (args.includes("--generated")) return "generated";
  return "state";
}

export function renderReset(result             )         {
  const head = `reset --${result.scope}: removed ${result.removed.length} path(s)`;
  const body = result.removed.map((p) => `  - ${p}`).join("\n");
  return result.removed.length ? `${head}\n${body}` : `${head} (nothing to remove)`;
}
