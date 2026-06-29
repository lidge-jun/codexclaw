import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type InterviewTracker, reconstructInterview, normalizeInterview, isInterviewReady } from "./interview.ts";

export type Phase = "IDLE" | "I" | "P" | "A" | "B" | "C" | "D";
// Work phases run the IPABCD cycle; IDLE is the closed/rest state a cycle returns to.
export const WORK_PHASES: readonly Phase[] = ["I", "P", "A", "B", "C", "D"];
export const ALL_PHASES: readonly Phase[] = ["IDLE", ...WORK_PHASES];
// PHASES kept as the work-phase list for back-compat (hook directive lookups iterate I..D).
export const PHASES: readonly Phase[] = WORK_PHASES;

export interface Flags {
  interview: boolean;
  auditPassed: boolean;
  checkPassed: boolean;
}

export interface State {
  phase: Phase;
  sessionId: string;
  slug: string;
  updatedAt: string;
  flags: Flags;
  supersededBy: string | null;
  injectedTurns: string[];
  lastInjectedPhase: Phase | null;
  orchestrationActive: boolean;
  interview: InterviewTracker | null;
}

export interface LedgerEntry {
  ts: string;
  sessionId: string;
  from: Phase | null;
  to: Phase;
  reason: string;
  evidence?: string;
}

export const STATE_DIR = ".codexclaw";
export const SESSIONS_SUBDIR = "sessions";
export const LEDGER_FILE = "ledger.jsonl";

export function sanitizeKey(value: string): string {
  const sanitized = (value ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "missing";
}

export function defaultState(sessionId: string, slug = ""): State {
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
  };
}

function sessionsDir(cwd: string): string {
  return join(cwd, STATE_DIR, SESSIONS_SUBDIR);
}

function statePath(cwd: string, sessionId: string): string {
  return join(sessionsDir(cwd), `${sanitizeKey(sessionId)}.json`);
}

export function readState(cwd: string, sessionId: string): State {
  try {
    const raw = readFileSync(statePath(cwd, sessionId), "utf8");
    const parsed = JSON.parse(raw) as Partial<State> | null;
    if (!parsed || typeof parsed.phase !== "string" || !ALL_PHASES.includes(parsed.phase as Phase)) {
      return defaultState(sessionId);
    }
    const base = defaultState(sessionId, typeof parsed.slug === "string" ? parsed.slug : "");
    // strict reconstruction: only known fields survive (omo-style discipline, no unknown-key passthrough)
    return {
      phase: parsed.phase as Phase,
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
        typeof parsed.lastInjectedPhase === "string" && PHASES.includes(parsed.lastInjectedPhase as Phase)
          ? (parsed.lastInjectedPhase as Phase)
          : null,
      orchestrationActive: parsed.orchestrationActive === true,
      interview: reconstructInterview(parsed.interview),
    };
  } catch {
    return defaultState(sessionId);
  }
}

export function writeState(cwd: string, next: State): void {
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

export function appendLedger(cwd: string, entry: LedgerEntry): void {
  const dir = join(cwd, STATE_DIR);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, LEDGER_FILE), `${JSON.stringify(entry)}\n`);
}
