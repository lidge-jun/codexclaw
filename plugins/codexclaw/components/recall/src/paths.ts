/**
 * paths.ts — Codex session-root path resolution for the recall component.
 *
 * Everything reads from CODEX_HOME (default ~/.codex). Codex versions its sqlite
 * stores (state_5.sqlite, memories_1.sqlite, ...), so the db resolvers glob for the
 * highest-numbered file instead of hardcoding today's suffix.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

export function codexHome(env: Record<string, string | undefined> = process.env): string {
  const fromEnv = env["CODEX_HOME"];
  return fromEnv && fromEnv.trim() !== "" ? fromEnv : join(homedir(), ".codex");
}

export function sessionsDir(home: string): string {
  return join(home, "sessions");
}

export function memoriesDir(home: string): string {
  return join(home, "memories");
}

/** Highest-numbered `<prefix>_<N>.sqlite` in `home`, or null when absent. */
function latestVersionedDb(home: string, prefix: string): string | null {
  if (!existsSync(home)) return null;
  const re = new RegExp(`^${prefix}_(\\d+)\\.sqlite$`);
  let best: { n: number; name: string } | null = null;
  for (const name of readdirSync(home)) {
    const m = re.exec(name);
    if (!m) continue;
    const n = Number(m[1]);
    if (!best || n > best.n) best = { n, name };
  }
  return best ? join(home, best.name) : null;
}

export function stateDbPath(home: string): string | null {
  return latestVersionedDb(home, "state");
}

export function memoriesDbPath(home: string): string | null {
  return latestVersionedDb(home, "memories");
}
