/**
 * orchestrate-cli.ts — `cxc orchestrate` terminal command (L4 / 040), the AGENT-gated
 * path. Unlike the chat hook (human free-pass, L3b), phase verbs here go through the
 * un-weakened `transition()` + `validateAttest`, so an agent MUST supply real
 * `--attest` evidence to advance a forward edge.
 *
 * Shares the SAME `.codexclaw/sessions/<id>.json` state as the hook — but only when
 * the same session id is used. A mutating call therefore requires `--session` (or an
 * existing session to target); it never silently invents a divergent session.
 *
 * Structural argv parsing (NOT the prompt grammar): verb is argv[0]; `--attest` takes
 * the NEXT single argv token as the exact JSON string (the shell already quoted it).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { coerceAttest,                  } from "./attest.js";
import { transition } from "./fsm.js";
import { applyHumanTransition, clearedIdle } from "./orchestrate-apply.js";

import {
  appendLedger,
  readState,
  writeState,
  STATE_DIR,
  SESSIONS_SUBDIR,


} from "./state.js";

const VERBS                                            = {
  i: "I", p: "P", a: "A", b: "B", c: "C", d: "D", status: "status", reset: "reset",
};














/** Structural argv parse. argv excludes the `orchestrate` kind token. */
export function parseOrchestrateCliArgs(argv          , cwd        )                                     {
  const verbTok = (argv[0] ?? "").toLowerCase();
  const verb = VERBS[verbTok];
  if (!verb) return { error: `unknown orchestrate verb '${argv[0] ?? ""}' (expected I|P|A|B|C|D|status|reset)` };

  let attest                     = null;
  let attestError                    ;
  let session                    ;
  let cwdOut = cwd;
  let json = false;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--attest") {
      const raw = argv[++i];
      if (raw === undefined) { attestError = "--attest requires a JSON argument"; continue; }
      try {
        const parsed = JSON.parse(raw)           ;
        const coerced = coerceAttest(parsed);
        if (!coerced) attestError = "attest JSON missing valid from/to";
        else attest = coerced;
      } catch {
        attestError = "attest JSON is not valid JSON";
      }
    } else if (a === "--session") {
      session = argv[++i];
    } else if (a === "--cwd") {
      cwdOut = argv[++i] ?? cwd;
    } else if (a === "--json") {
      json = true;
    }
  }
  return { verb, attest, attestError, session, cwd: cwdOut, json };
}

/**
 * Resolve the target session id. Explicit `--session` wins; else the most-recently
 * modified `.codexclaw/sessions/*.json` (ties broken by filename); else null when no
 * session exists. Never throws on a missing/empty dir.
 */
export function resolveSession(cwd        , explicit         )                {
  if (explicit) return explicit;
  const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
  if (!existsSync(dir)) return null;
  let best                                       = null;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || f.endsWith(".tmp")) continue;
    const id = f.slice(0, -".json".length);
    let mtime = 0;
    try { mtime = statSync(join(dir, f)).mtimeMs; } catch { continue; }
    if (!best || mtime > best.mtime || (mtime === best.mtime && id < best.id)) {
      best = { id, mtime };
    }
  }
  return best?.id ?? null;
}

/**
 * Reserved explicit terminal session keys the CLI may bootstrap (create-on-write)
 * without a pre-existing file. A real codex session id is NEVER in this set — those
 * are created by the hook, and the CLI only rides an existing one. This keeps an
 * explicit `--session <typo-or-new-uuid>` from silently minting a divergent session
 * on a mutating verb (G2 / L20). `cli` is the documented terminal bootstrap key.
 */
export const RESERVED_SESSION_KEYS                      = new Set(["cli"]);

/** True when a session file already exists for this id under the cwd. */
function sessionFileExists(cwd        , sessionId        )          {
  return existsSync(join(cwd, STATE_DIR, SESSIONS_SUBDIR, `${sessionId}.json`));
}

function renderStatus(state       , json         )         {
  if (json) return JSON.stringify({ phase: state.phase, flags: state.flags, sessionId: state.sessionId });
  return `phase=${state.phase} interview=${state.flags.interview} auditPassed=${state.flags.auditPassed} checkPassed=${state.flags.checkPassed}`;
}



/** Execute a parsed orchestrate CLI command. Does its own state IO. Never throws. */
export function runOrchestrateCli(args                    )            {
  // malformed --attest is a hard error before any state mutation (except control verbs).
  if (args.attestError && args.verb !== "status" && args.verb !== "reset") {
    return { code: 1, output: `orchestrate ${args.verb}: ${args.attestError}` };
  }

  const sessionId = resolveSession(args.cwd, args.session);

  // status: read-only. With no session, report it (don't create one).
  if (args.verb === "status") {
    if (!sessionId) return { code: 0, output: "no active session" };
    return { code: 0, output: renderStatus(readState(args.cwd, sessionId), args.json) };
  }

  // mutating verbs need a concrete session: never silently invent a divergent one.
  if (!sessionId) {
    return { code: 1, output: `orchestrate ${args.verb}: no active session — pass --session <id> (the codex session id, or an explicit terminal session like 'cli')` };
  }

  // G2 (L20): an EXPLICIT --session on a mutating verb may target only an existing
  // session file or a reserved terminal key (cli). An unknown explicit id (e.g. a typo
  // or a fresh codex-style uuid the hook never created) must NOT silently mint a
  // divergent session. The implicit most-recent pick and the no-session cli bootstrap
  // are unaffected (args.session is undefined there).
  if (args.session && !sessionFileExists(args.cwd, sessionId) && !RESERVED_SESSION_KEYS.has(sessionId)) {
    return {
      code: 1,
      output: `orchestrate ${args.verb}: unknown session '${sessionId}' — no .codexclaw/sessions/${sessionId}.json exists. Target an existing session or use the terminal key 'cli'.`,
    };
  }
  const state = readState(args.cwd, sessionId);

  // reset: control override (same cleared-IDLE write as the human path).
  if (args.verb === "reset") {
    const res = applyHumanTransition(state, "reset");
    if (res.noop) return { code: 0, output: `orchestrate reset: already IDLE (session ${sessionId})` };
    if (res.state) {
      writeState(args.cwd, { ...res.state, orchestrationActive: false, lastInjectedPhase: null, stopBlockPhase: null, stopBlockCount: 0 });
      if (res.ledger) appendLedger(args.cwd, res.ledger);
    }
    return { code: 0, output: `orchestrate reset: → IDLE (session ${sessionId})` };
  }

  // phase verb: AGENT-GATED via the un-weakened transition().
  const to = args.verb         ;
  const result = transition(state, to, args.attest);
  if (!result.ok || !result.state) {
    return { code: 1, output: `orchestrate ${args.verb}: ${result.reason ?? "transition refused"}` };
  }

  // G1 (L20): D is a CLOSING transition, not a resting badge. Once the C->D attest
  // gate (checkOutput + exitCode:0, enforced by transition() above) passes, close the
  // cycle to IDLE atomically — one clearedIdle write + one done ledger (C->IDLE) — so
  // the terminal path matches the chat done-control and L5/L7's "resting state is
  // IDLE" contract. No intermediate phase="D" is persisted and no second ledger row.
  if (to === "D") {
    writeState(args.cwd, { ...clearedIdle(state), stopBlockPhase: null, stopBlockCount: 0 });
    appendLedger(args.cwd, {
      ts: new Date().toISOString(),
      sessionId: state.sessionId,
      from: state.phase,
      to: "IDLE",
      reason: "done",
      ...(args.attest?.did ? { evidence: args.attest.did } : {}),
    });
    return { code: 0, output: `orchestrate D: ${state.phase} → IDLE (cycle closed, session ${sessionId})` };
  }

  // L6: a real CLI transition is progress -> reset the Stop stagnation guard.
  writeState(args.cwd, { ...result.state, orchestrationActive: result.state.phase !== "IDLE", lastInjectedPhase: result.state.phase, stopBlockPhase: null, stopBlockCount: 0 });
  appendLedger(args.cwd, {
    ts: new Date().toISOString(),
    sessionId: state.sessionId,
    from: state.phase,
    to: result.state.phase,
    reason: "cli",
    ...(args.attest?.did ? { evidence: args.attest.did } : {}),
  });
  return { code: 0, output: `orchestrate ${args.verb}: ${state.phase} → ${result.state.phase} (session ${sessionId})` };
}
