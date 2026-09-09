/**
 * store.ts — filesystem substrate for the bg registry.
 *
 * Layout (contract 010, "파일 레이아웃"):
 *   <cwd>/.codexclaw/bg/
 *     disabled        wake off flag; body is the ISO time it was set
 *     enabled-at      ISO time of the last 'bg on'; wake ignores tasks that ended before it
 *     <id>.json       record
 *     <id>.out        merged stdout/stderr
 *     <id>.exit       exit code, written by the detached shell itself
 *     ledger.jsonl    append-only events
 *
 * Record writes are atomic (tmp + rename). The ledger is an append-only journal, so it
 * uses appendFileSync instead. pabcd-state has an atomic-write module but
 * cross-component imports are banned here (000_plan "제거를 쉽게 만드는 제약"), so this
 * is a deliberate local copy of that one idea.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export const BG_DIRNAME = "bg";
export const DISABLED_FILE = "disabled";
export const ENABLED_AT_FILE = "enabled-at";
export const LEDGER_FILE = "ledger.jsonl";

export function bgDir(cwd: string): string {
  return join(cwd, ".codexclaw", BG_DIRNAME);
}
export function recordPath(cwd: string, id: string): string {
  return join(bgDir(cwd), id + ".json");
}
export function outPath(cwd: string, id: string): string {
  return join(bgDir(cwd), id + ".out");
}
export function exitPath(cwd: string, id: string): string {
  return join(bgDir(cwd), id + ".exit");
}
export function disabledPath(cwd: string): string {
  return join(bgDir(cwd), DISABLED_FILE);
}
export function enabledAtPath(cwd: string): string {
  return join(bgDir(cwd), ENABLED_AT_FILE);
}

export function ensureDir(cwd: string): string {
  const dir = bgDir(cwd);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Atomic write: same-directory tmp then rename, so a reader never sees a torn file. */
export function atomicWrite(path: string, text: string): void {
  const tmp = path + ".tmp-" + process.pid + "-" + Date.now();
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

export function readTextOrNull(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function readJsonOrNull<T>(path: string): T | null {
  const raw = readTextOrNull(path);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export function appendLedger(cwd: string, event: Record<string, unknown>): void {
  try {
    ensureDir(cwd);
    appendFileSync(join(bgDir(cwd), LEDGER_FILE), JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n", "utf8");
  } catch {
    // Ledger loss must never break a hook. FAIL-OPEN (010 "구현 제약 재확인").
  }
}

export function listRecordIds(cwd: string): string[] {
  try {
    const dir = bgDir(cwd);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length))
      .sort();
  } catch {
    return [];
  }
}

/** File mtime in ms, or null. Used to bound how long a half-written exit file is tolerated. */
export function mtimeMs(path: string): number | null {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

export function removePath(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch {
    // best effort
  }
}

