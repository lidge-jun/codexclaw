/**
 * self-heal.ts — keep the declared SOFT codex feature flags on, whatever the install path.
 *
 * `cxc enable` can already turn them on, but nothing runs it on a marketplace install:
 * `codex plugin add` registers skills/hooks/MCP from plugin.json and there is no
 * install-time hook event, nor a postinstall in the repo. So the capability existed and
 * the call site did not. This module is that call site, driven from SessionStart.
 *
 * HONEST LIMIT: a plugin hook is registered with is_managed:false (codex-rs
 * hooks/src/engine/discovery.rs:253) and only runs once its trust status is Managed or
 * Trusted (:566-571). On a genuinely new machine this therefore runs AFTER the user
 * approves the plugin's hooks — the same single prompt every other codexclaw hook needs.
 * The claim is "earliest hook-reachable point", not "install-independent".
 *
 * Split on purpose: `selfHealDeclaredFeatures` is pure-with-injected-IO so tests can never
 * reach the real ~/.codex, while the marker read/write wrappers touch the real filesystem
 * for the two callers that need them (the CLI hook branch and deactivate). Same shape as
 * cli.ts owning `makeRealRunner` while the lib layers take everything injected.
 */
import { readFileSync, writeFileSync, statSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DECLARED_FEATURES, SOFT_FEATURES, SOFT_FEATURE_IMPACT, readDeclaredState, type CodexRunner } from "./features.ts";
import { INSTALL_MANIFEST, parseInstallManifest } from "./activate.ts";

export const SELF_HEAL_MARKER = "codexclaw-self-heal.json";

export interface SelfHealMarker {
  /** True once the user ran `cxc disable`: a later session must not undo that choice. */
  optedOut?: boolean;
  optedOutAt?: string;
  /** config.toml mtime when the flags were last confirmed all-on. */
  configMtimeMs?: number;
  checkedAt?: string;
  /** Only true means "skip"; anything else re-probes. */
  allEnabled?: boolean;
  /**
   * Flags self-heal has ALREADY turned on at least once.
   *
   * This is the consent record. Without it self-heal cannot tell "never enabled" from
   * "we enabled it and the user turned it back off", so a user who runs the codex-native
   * `codex features disable <key>` — the obvious inverse of the recovery command codexclaw
   * itself prints — would be overridden on the next session forever. A key listed here and
   * currently off is treated as an implicit opt-out for that key: heal once, never argue.
   */
  healedKeys?: string[];
  /**
   * Which soft flags the cached `allEnabled` actually covered. Without it, adding a second
   * entry to SOFT_FEATURES later would be skipped indefinitely by a stale all-enabled cache
   * until config.toml happened to change for an unrelated reason.
   */
  cachedKeys?: string[];
}

export type SelfHealOutcome =
  | { action: "skipped"; reason: "cached" | "opted-out" | "already-enabled" }
  | { action: "declined"; key: string }
  | { action: "unavailable"; message: string }
  | { action: "healed"; key: string }
  | { action: "failed"; key: string; exitCode: number; message: string };

export interface SelfHealDeps {
  codexHome: string;
  run: CodexRunner;
  /** Returns null when the file is absent or unreadable. */
  readFile: (path: string) => string | null;
  writeFile: (path: string, contents: string) => void;
  /** Returns null when the path does not exist. */
  statMtimeMs: (path: string) => number | null;
  now: () => string;
}

export function selfHealMarkerPath(codexHome: string): string {
  return join(codexHome, SELF_HEAL_MARKER);
}

/**
 * Record a self-healed flag as codexclaw-owned in the install manifest, so `cxc disable`
 * reverts it.
 *
 * Without this, a flag that failed at activation (enabledByCodexclaw:false) and later
 * succeeded here would be skipped by deactivate.ts's `if (!rec.enabledByCodexclaw) continue`,
 * leaving it on forever while the opt-out marker blocked any later correction. The manifest
 * is the ownership ledger, and a heal is an enable, so it belongs there.
 *
 * No manifest (the marketplace track) means there is nothing to own into and nothing for
 * deactivate to read — that path is a no-op, not an error.
 */
export function recordHealInManifest(
  codexHome: string,
  keys: readonly string[],
  io: { readFile: (p: string) => string | null; writeFile: (p: string, c: string) => void },
): boolean {
  if (keys.length === 0) return false;
  const path = join(codexHome, INSTALL_MANIFEST);
  const raw = io.readFile(path);
  if (raw === null) return false;
  const manifest = parseInstallManifest(raw);
  if (manifest === null) return false;
  let changed = false;
  for (const key of keys) {
    const rec = manifest.flags[key];
    if (rec === undefined) continue;
    if (rec.enabledByCodexclaw && !rec.enableFailed) continue;
    rec.enabledByCodexclaw = true;
    rec.enableFailed = false;
    delete rec.failure;
    changed = true;
  }
  if (!changed) return false;
  io.writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return true;
}

/** Parse a marker, treating any malformed content as "no marker" (cache miss, never a throw). */
export function parseSelfHealMarker(raw: string | null): SelfHealMarker | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const marker: SelfHealMarker = {};
  if (typeof o.optedOut === "boolean") marker.optedOut = o.optedOut;
  if (typeof o.optedOutAt === "string") marker.optedOutAt = o.optedOutAt;
  if (typeof o.configMtimeMs === "number") marker.configMtimeMs = o.configMtimeMs;
  if (typeof o.checkedAt === "string") marker.checkedAt = o.checkedAt;
  if (typeof o.allEnabled === "boolean") marker.allEnabled = o.allEnabled;
  if (Array.isArray(o.healedKeys)) {
    marker.healedKeys = o.healedKeys.filter((k): k is string => typeof k === "string" && k.length > 0);
  }
  if (Array.isArray(o.cachedKeys)) {
    marker.cachedKeys = o.cachedKeys.filter((k): k is string => typeof k === "string" && k.length > 0);
  }
  return marker;
}

/**
 * The soft flags this module is allowed to turn on.
 *
 * Hard flags are deliberately excluded. A hard flag being off means `cxc enable` was never
 * run at all, which is a standing condition to report (the doctor `features` check), not
 * something a per-session hook should quietly paper over.
 */
export function selfHealableFeatures(): string[] {
  return DECLARED_FEATURES.filter((key) => SOFT_FEATURES.has(key));
}

export function selfHealDeclaredFeatures(deps: SelfHealDeps): SelfHealOutcome[] {
  const { codexHome, run, readFile, writeFile, statMtimeMs, now } = deps;
  const markerPath = selfHealMarkerPath(codexHome);
  const marker = parseSelfHealMarker(readFile(markerPath));

  if (marker?.optedOut === true) return [{ action: "skipped", reason: "opted-out" }];

  const configMtimeMs = statMtimeMs(join(codexHome, "config.toml"));
  const healable = selfHealableFeatures();
  // A cache that predates a SOFT_FEATURES addition must not vouch for the new key.
  const cacheCoversCurrentKeys =
    marker?.cachedKeys !== undefined && healable.every((k) => marker.cachedKeys?.includes(k));
  if (
    marker?.allEnabled === true &&
    cacheCoversCurrentKeys &&
    marker.configMtimeMs !== undefined &&
    configMtimeMs !== null &&
    marker.configMtimeMs === configMtimeMs
  ) {
    return [{ action: "skipped", reason: "cached" }];
  }

  let state: ReadonlyMap<string, boolean>;
  try {
    state = readDeclaredState(run);
  } catch (err) {
    // Measurement failure, not a state. Caching it as all-enabled would permanently hide
    // a genuinely-off flag, so the marker is left exactly as it was.
    return [{ action: "unavailable", message: err instanceof Error ? err.message : String(err) }];
  }

  const outcomes: SelfHealOutcome[] = [];
  let allEnabled = true;
  const healedKeys = [...(marker?.healedKeys ?? [])];
  for (const key of healable) {
    if (state.get(key) === true) continue;
    // Heal once. If we already turned this key on and it is off again, someone turned it
    // off deliberately — most likely with `codex features disable`, the exact inverse of
    // the recovery command codexclaw prints. Overriding that every session would make the
    // flag impossible to turn off without uninstalling codexclaw.
    if (healedKeys.includes(key)) {
      outcomes.push({ action: "declined", key });
      continue;
    }
    const res = run(["features", "enable", key]);
    if (res.exitCode === 0) {
      outcomes.push({ action: "healed", key });
      healedKeys.push(key);
    } else {
      allEnabled = false;
      outcomes.push({ action: "failed", key, exitCode: res.exitCode, message: res.stderr.trim().slice(0, 500) });
    }
  }
  if (outcomes.length === 0) outcomes.push({ action: "skipped", reason: "already-enabled" });
  // A declined key is off by the user's choice, so the cache may still claim all-enabled:
  // the point of the cache is "nothing left for me to do", not "every flag is true".

  // Ownership: a heal is an enable, so deactivate must be able to revert it.
  const justHealed = outcomes.filter((o) => o.action === "healed").map((o) => o.key);
  recordHealInManifest(codexHome, justHealed, { readFile, writeFile });

  // Re-stat: the enable calls just rewrote config.toml, so caching the pre-write mtime
  // would make the very next session miss the cache every time.
  const afterMtimeMs = statMtimeMs(join(codexHome, "config.toml"));
  // Re-read before writing. Two sessions can start at once, and `cxc disable` may have set
  // optedOut while this round was probing. A blind whole-file write would drop that opt-out
  // and resurrect the round-trip the marker exists to prevent.
  const latest = parseSelfHealMarker(readFile(markerPath));
  if (latest?.optedOut === true) return outcomes;
  const next: SelfHealMarker = {
    ...(latest ?? marker ?? {}),
    checkedAt: now(),
    allEnabled,
    healedKeys: [...new Set([...(latest?.healedKeys ?? []), ...healedKeys])],
    cachedKeys: healable,
    ...(afterMtimeMs !== null ? { configMtimeMs: afterMtimeMs } : {}),
  };
  writeFile(markerPath, `${JSON.stringify(next, null, 2)}\n`);
  return outcomes;
}

/**
 * SessionStart additionalContext for a self-heal round, or "" when there is nothing to say.
 *
 * A quiet session gets no added context at all — the same restraint activation-trace.ts
 * states for ordinary sessions. `unavailable` is also silent: a session with no reachable
 * codex binary does not need that told to it mid-turn, and `cxc doctor` reports it standing.
 */
export function renderSelfHealContext(outcomes: readonly SelfHealOutcome[]): string {
  const healed = outcomes.filter((o) => o.action === "healed").map((o) => o.key);
  const failed = outcomes.filter((o) => o.action === "failed");
  if (healed.length === 0 && failed.length === 0) return "";
  const lines: string[] = [];
  if (healed.length > 0) {
    lines.push(
      `[codexclaw] Enabled the codex feature flag(s) codexclaw declares: ${healed.join(", ")}. ` +
        `The tool list is fixed when a session starts, so anything they expose becomes available ` +
        `from the NEXT session, not this one.`,
    );
  }
  for (const f of failed) {
    const impact = SOFT_FEATURE_IMPACT[f.key] ?? "이 플래그에 의존하는 기능이 비활성화된다.";
    lines.push(
      `[codexclaw] Could not enable '${f.key}' (exit ${f.exitCode}). ${impact} ` +
        `Recover with: codex features enable ${f.key}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

// --- Real-filesystem wrappers. Only the CLI hook branch and deactivate use these.

export function readSelfHealMarkerFile(codexHome: string): SelfHealMarker | null {
  try {
    return parseSelfHealMarker(readFileSync(selfHealMarkerPath(codexHome), "utf8"));
  } catch {
    return null;
  }
}

/** Atomic: a torn marker would read as a cache miss, which re-probes rather than misleads. */
export function writeSelfHealMarkerFile(codexHome: string, marker: SelfHealMarker): void {
  const path = selfHealMarkerPath(codexHome);
  mkdirSync(codexHome, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

/**
 * Record that the user turned codexclaw off, so no later session re-enables what
 * `cxc disable` just reverted. Merges rather than replaces: an existing cache stays intact.
 */
export function markSelfHealOptedOut(codexHome: string, at: string): void {
  const existing = readSelfHealMarkerFile(codexHome) ?? {};
  writeSelfHealMarkerFile(codexHome, { ...existing, optedOut: true, optedOutAt: at, allEnabled: false });
}

/** Clear the opt-out, so an explicit `cxc enable` resumes self-heal. */
export function clearSelfHealOptOut(codexHome: string): void {
  const existing = readSelfHealMarkerFile(codexHome);
  if (existing === null) return;
  const { optedOut: _o, optedOutAt: _a, ...rest } = existing;
  writeSelfHealMarkerFile(codexHome, rest);
}

export function makeRealSelfHealDeps(codexHome: string, run: CodexRunner): SelfHealDeps {
  return {
    codexHome,
    run,
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return null;
      }
    },
    writeFile: (path, contents) => {
      mkdirSync(codexHome, { recursive: true });
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, contents, "utf8");
      renameSync(tmp, path);
    },
    statMtimeMs: (path) => {
      try {
        return statSync(path).mtimeMs;
      } catch {
        return null;
      }
    },
    now: () => new Date().toISOString(),
  };
}
