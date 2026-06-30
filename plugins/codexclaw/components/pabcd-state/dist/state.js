import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {                        reconstructInterview, normalizeInterview, isInterviewReady } from "./interview.js";


// Work phases run the IPABCD cycle; IDLE is the closed/rest state a cycle returns to.
export const WORK_PHASES                   = ["I", "P", "A", "B", "C", "D"];
export const ALL_PHASES                   = ["IDLE", ...WORK_PHASES];
// PHASES kept as the work-phase list for back-compat (hook directive lookups iterate I..D).
export const PHASES                   = WORK_PHASES;








































export const STATE_DIR = ".codexclaw";
export const SESSIONS_SUBDIR = "sessions";
export const LEDGER_FILE = "ledger.jsonl";
/** 131/D2': per-session interview scan-evidence ledger (durable source of record). */
export const INTERVIEWS_SUBDIR = "interviews";

export function sanitizeKey(value        )         {
  const sanitized = (value ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "missing";
}

export function defaultState(sessionId        , slug = "")        {
  return {
    phase: "IDLE",
    sessionId,
    slug,
    updatedAt: new Date().toISOString(),
    flags: { interview: false, auditPassed: false, checkPassed: false },
    supersededBy: null,
    injectedTurns: [],
    lastInjectedPhase: null,
    orchestrationActive: false,
    interview: null,
    stopBlockPhase: null,
    stopBlockCount: 0,
  };
}

function sessionsDir(cwd        )         {
  return join(cwd, STATE_DIR, SESSIONS_SUBDIR);
}

function statePath(cwd        , sessionId        )         {
  return join(sessionsDir(cwd), `${sanitizeKey(sessionId)}.json`);
}

export function readState(cwd        , sessionId        )        {
  try {
    const raw = readFileSync(statePath(cwd, sessionId), "utf8");
    const parsed = JSON.parse(raw)                         ;
    if (!parsed || typeof parsed.phase !== "string" || !ALL_PHASES.includes(parsed.phase         )) {
      return defaultState(sessionId);
    }
    const base = defaultState(sessionId, typeof parsed.slug === "string" ? parsed.slug : "");
    // strict reconstruction: only known fields survive (omo-style discipline, no unknown-key passthrough)
    return {
      phase: parsed.phase         ,
      sessionId,
      slug: base.slug,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : base.updatedAt,
      flags: {
        // HIGH-1: derive from the tracker (single source of truth); a persisted
        // true flag cannot override a non-ready tracker.
        interview: isInterviewReady(reconstructInterview(parsed.interview)),
        auditPassed: parsed.flags?.auditPassed === true,
        checkPassed: parsed.flags?.checkPassed === true,
      },
      supersededBy: typeof parsed.supersededBy === "string" ? parsed.supersededBy : null,
      injectedTurns:
        Array.isArray(parsed.injectedTurns) && parsed.injectedTurns.every((x) => typeof x === "string")
          ? parsed.injectedTurns
          : [],
      lastInjectedPhase:
        typeof parsed.lastInjectedPhase === "string" && PHASES.includes(parsed.lastInjectedPhase         )
          ? (parsed.lastInjectedPhase         )
          : null,
      orchestrationActive: parsed.orchestrationActive === true,
      interview: reconstructInterview(parsed.interview),
      // L6: strict reconstruction of the stagnation-guard fields (default-safe so an
      // old session file without them reads as a fresh counter).
      stopBlockPhase:
        typeof parsed.stopBlockPhase === "string" && ALL_PHASES.includes(parsed.stopBlockPhase         )
          ? (parsed.stopBlockPhase         )
          : null,
      stopBlockCount:
        typeof parsed.stopBlockCount === "number" && Number.isFinite(parsed.stopBlockCount) && parsed.stopBlockCount >= 0
          ? Math.floor(parsed.stopBlockCount)
          : 0,
    };
  } catch {
    return defaultState(sessionId);
  }
}

export function writeState(cwd        , next       )       {
  const dir = sessionsDir(cwd);
  mkdirSync(dir, { recursive: true });
  const finalPath = statePath(cwd, next.sessionId);
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    // T2: cap tracker arrays on the write side so oversized in-memory trackers
    // never reach the hot session JSON.
    const normalized = { ...next, interview: normalizeInterview(next.interview), updatedAt: new Date().toISOString() };
    writeFileSync(tmp, JSON.stringify(normalized, null, 2));
    renameSync(tmp, finalPath);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // best-effort cleanup of orphan tmp; ignore
    }
    throw err;
  }
}

export function appendLedger(cwd        , entry             )       {
  const dir = join(cwd, STATE_DIR);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, LEDGER_FILE), `${JSON.stringify(entry)}\n`);
}

/** 131/D2': a recorded interview scan event (durable scan-evidence). */


/**
 * The complete set of scan-event kinds. The per-session interview ledger
 * (`.codexclaw/interviews/<id>.jsonl`) is SHARED with Q/A capture events
 * (`question_asked`/`answer_recorded`, written by interview-ledger.ts), so the scan
 * reader must filter to these kinds — a blind parse would misread Q/A rows as scan
 * evidence (L20 / G3).
 */
export const SCAN_EVENT_KINDS                      = new Set                    ([
  "scan_started",
  "scan_completed",
  "rescan_completed",
]);










function interviewsDir(cwd        )         {
  return join(cwd, STATE_DIR, INTERVIEWS_SUBDIR);
}

function interviewLedgerPath(cwd        , sessionId        )         {
  return join(interviewsDir(cwd), `${sanitizeKey(sessionId)}.jsonl`);
}

/**
 * 131/D2': append a scan event to the per-session interview ledger. This is the durable
 * source of record for "a contradiction scan ran"; the tracker's scanRounds is a cache.
 */
export function appendInterviewEvent(cwd        , entry                )       {
  const dir = interviewsDir(cwd);
  mkdirSync(dir, { recursive: true });
  appendFileSync(interviewLedgerPath(cwd, entry.sessionId), `${JSON.stringify(entry)}\n`);
}

/**
 * 131/D2': read recorded interview SCAN events (best-effort; missing file -> []).
 *
 * The ledger file is shared with Q/A capture events (interview-ledger.ts), so this
 * filters to rows whose `event` is a scan kind AND that carry the structural scan
 * fields (mirrors readQaEvents() robustness). Q/A rows and malformed lines are skipped
 * rather than misread as scan evidence (L20 / G3).
 */
export function readInterviewEvents(cwd        , sessionId        )                   {
  let raw        ;
  try {
    raw = readFileSync(interviewLedgerPath(cwd, sessionId), "utf8");
  } catch {
    return [];
  }
  const out                   = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t.length === 0) continue;
    try {
      const o = JSON.parse(t)           ;
      if (
        typeof o === "object" && o !== null && !Array.isArray(o) &&
        SCAN_EVENT_KINDS.has((o                       ).event          ) &&
        typeof (o                         ).roundId === "number" &&
        typeof (o                                    ).contradictionCount === "number"
      ) {
        out.push(o                  );
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}
