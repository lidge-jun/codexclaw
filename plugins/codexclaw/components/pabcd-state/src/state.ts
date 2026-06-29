import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export type Phase = "I" | "P" | "A" | "B" | "C" | "D";
export const PHASES: readonly Phase[] = ["I", "P", "A", "B", "C", "D"];

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
    phase: "I",
    sessionId,
    slug,
    updatedAt: new Date().toISOString(),
    flags: { interview: false, auditPassed: false, checkPassed: false },
    supersededBy: null,
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
    if (!parsed || typeof parsed.phase !== "string" || !PHASES.includes(parsed.phase as Phase)) {
      return defaultState(sessionId);
    }
    const base = defaultState(sessionId, parsed.slug ?? "");
    return {
      ...base,
      ...parsed,
      sessionId,
      flags: { ...base.flags, ...(parsed.flags ?? {}) },
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
  writeFileSync(tmp, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2));
  renameSync(tmp, finalPath);
}

export function appendLedger(cwd: string, entry: LedgerEntry): void {
  const dir = join(cwd, STATE_DIR);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, LEDGER_FILE), `${JSON.stringify(entry)}\n`);
}
