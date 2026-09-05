/**
 * capability-lock.ts — versioned Codex capability lock (issue #16).
 *
 * A small fixture describing the native Codex surfaces codexclaw depends on.
 * Used by doctor and the capability resolver to make drift explicit without
 * copying runtime identities into skill documents.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Schema version for the capability lock fixture. */
export const LOCK_SCHEMA_VERSION = 1;























/** Validate a capability lock object. Returns error messages or empty array. */
export function validateLock(lock         )           {
  const errors           = [];
  if (!lock || typeof lock !== "object") {
    errors.push("lock must be a non-null object");
    return errors;
  }
  const obj = lock                           ;
  if (obj.schemaVersion !== LOCK_SCHEMA_VERSION) {
    errors.push("schemaVersion must be " + LOCK_SCHEMA_VERSION + ", got " + String(obj.schemaVersion));
  }
  if (!Array.isArray(obj.entries)) {
    errors.push("entries must be an array");
    return errors;
  }
  for (let i = 0; i < obj.entries.length; i++) {
    const e = obj.entries[i]                           ;
    if (typeof e.name !== "string" || !e.name) errors.push("entries[" + i + "].name must be a non-empty string");
    if (typeof e.required !== "boolean") errors.push("entries[" + i + "].required must be a boolean");
    if (e.channel !== "stable" && e.channel !== "canary") errors.push("entries[" + i + "].channel must be stable or canary");
    if (typeof e.usage !== "string" || !e.usage) errors.push("entries[" + i + "].usage must be a non-empty string");
  }
  return errors;
}

/**
 * Read and validate a capability lock from a JSON file.
 * Returns the lock or an error description.
 */
export function readCapabilityLock(path        )                                               {
  if (!existsSync(path)) {
    return { error: "lock file not found: " + path };
  }
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    const errors = validateLock(data);
    if (errors.length > 0) {
      return { error: "invalid lock: " + errors.join("; ") };
    }
    return { lock: data                   };
  } catch (err) {
    return { error: "unparseable lock: " + String(err) };
  }
}

/**
 * Check capabilities against the lock. Returns entries that are required
 * but not available in the current runtime.
 */
export function checkAgainstLock(
  lock                ,
  availableCapabilities             ,
)                                                                  {
  const missing                                                                  = [];
  for (const entry of lock.entries) {
    if (entry.required && !availableCapabilities.has(entry.name)) {
      missing.push({ name: entry.name, usage: entry.usage, channel: entry.channel });
    }
  }
  return missing;
}

/** The default stable lock fixture for codexclaw. */
export const DEFAULT_STABLE_LOCK                 = {
  schemaVersion: LOCK_SCHEMA_VERSION,
  generatedAt: "2026-08-15T00:00:00Z",
  entries: [
    { name: "exec_command", required: true, channel: "stable", usage: "shell execution for build/test/doctor" },
    { name: "apply_patch", required: true, channel: "stable", usage: "file editing" },
    { name: "web_search", required: false, channel: "stable", usage: "search skill discovery" },
    { name: "spawn_agent", required: false, channel: "stable", usage: "V1 subagent dispatch" },
    { name: "create_task", required: false, channel: "stable", usage: "V2 subagent dispatch" },
    { name: "browser", required: false, channel: "stable", usage: "QA and proof browsing" },
    { name: "plugin_hooks", required: true, channel: "stable", usage: "PABCD state transitions, Stop continuation" },
    { name: "goal_api", required: false, channel: "canary", usage: "HOTL goal creation and management" },
  ],
};

