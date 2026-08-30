/**
 * config-set.ts — write a whitelisted non-feature config.toml key, and record it.
 *
 * The recording is not bookkeeping, it is the whole point. `deactivate` reverts only
 * keys present in the install manifest's `tableKeys`, so a write that skipped the
 * manifest would be permanently unrevertable — `cxc disable` could never undo it and
 * the user would be left with a switch they cannot turn off through codexclaw.
 * Backup, write and record therefore live in one function instead of at call sites.
 *
 * All IO paths are injected; nothing here resolves the real ~/.codex on its own.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { manifestPath, parseInstallManifest,                      } from "./activate.js";
import { CONFIG_MANAGED_KEYS, findManagedKey, managedKeyId,                 } from "./managed-keys.js";
import { readTableKey, restoreTableKey, setTableKey } from "./toml-edit.js";











function hashOrNull(path        )                {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadManifest(codexHome        )                         {
  const path = manifestPath(codexHome);
  if (!existsSync(path)) return null;
  try {
    return parseInstallManifest(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function saveManifest(codexHome        , manifest                 )       {
  writeFileSync(manifestPath(codexHome), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/** Resolve "<table>.<key>" against the whitelist. */
export function resolveManagedKey(id        )                                 {
  const entry = findManagedKey(id);
  if (entry) return entry;
  return {
    error:
      `'${id}' is not a codexclaw-managed key. Run 'cxc config list' to see what can be set. ` +
      "codexclaw edits only whitelisted keys, so it never becomes a general TOML editor.",
  };
}

/**
 * Set or unset a managed key.
 *
 * `value === null` means unset: restore the manifest's recorded `priorValue`.
 * Refuses when no install manifest exists — writing config.toml with nowhere to record
 * the prior value is exactly the unrevertable case this module exists to prevent.
 */
export function applyManagedKey(
  deps               ,
  id        ,
  value                ,
)                   {
  const resolved = resolveManagedKey(id);
  if ("error" in resolved) return { ok: false, reason: resolved.error };
  const entry = resolved;

  const configPath = deps.configPath ?? `${deps.codexHome}/config.toml`;
  const now = deps.now ?? (() => new Date().toISOString());

  const manifest = loadManifest(deps.codexHome);
  if (manifest === null) {
    return {
      ok: false,
      reason:
        "no readable install manifest under this codex home; run 'cxc enable' first. " +
        "Without it there is nowhere to record the previous value, and 'cxc disable' could not revert this key.",
    };
  }

  const content = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const keyId = managedKeyId(entry);

  if (value === null) {
    const rec = (manifest.tableKeys ?? {})[keyId];
    if (!rec) {
      return { ok: false, reason: `${keyId} is not recorded as set by codexclaw; nothing to unset.` };
    }
    const res = restoreTableKey(content, entry.table, entry.key, rec.priorValue);
    if (res.action === "unsupported-value") {
      return { ok: false, reason: `${keyId} currently holds a value codexclaw will not rewrite; edit config.toml by hand.` };
    }
    let backupPath                = null;
    if (res.changed) {
      backupPath = `${configPath}.codexclaw-${now().replace(/[:.]/g, "-")}.bak`;
      copyFileSync(configPath, backupPath);
      writeFileSync(configPath, res.content, "utf8");
    }
    const nextKeys = { ...(manifest.tableKeys ?? {}) };
    delete nextKeys[keyId];
    saveManifest(deps.codexHome, {
      ...manifest,
      version: 2,
      tableKeys: nextKeys,
      postActivateHash: hashOrNull(configPath),
    });
    return {
      ok: true,
      changed: res.changed,
      entry,
      priorValue: rec.priorValue,
      appliedValue: rec.priorValue ?? "(absent)",
      backupPath,
    };
  }

  const priorValue = readTableKey(content, entry.table, entry.key);
  const res = setTableKey(content, entry.table, entry.key, value);
  if (res.action === "unsupported-value") {
    return { ok: false, reason: `${keyId} currently holds a value codexclaw will not rewrite; edit config.toml by hand.` };
  }

  let backupPath                = null;
  if (res.changed) {
    if (existsSync(configPath)) {
      backupPath = `${configPath}.codexclaw-${now().replace(/[:.]/g, "-")}.bak`;
      copyFileSync(configPath, backupPath);
    }
    writeFileSync(configPath, res.content, "utf8");
  }

  const appliedValue = value ? "true" : "false";
  // Record even a no-op write: an existing manifest entry keeps its ORIGINAL priorValue
  // so repeated sets cannot rewrite history into "the prior value was our own value".
  const existing = (manifest.tableKeys ?? {})[keyId];
  saveManifest(deps.codexHome, {
    ...manifest,
    version: 2,
    tableKeys: {
      ...(manifest.tableKeys ?? {}),
      [keyId]: {
        table: entry.table,
        key: entry.key,
        priorValue: existing ? existing.priorValue : priorValue,
        appliedValue,
        setByCodexclaw: existing ? existing.setByCodexclaw || res.changed : res.changed,
      },
    },
    postActivateHash: hashOrNull(configPath),
  });

  return { ok: true, changed: res.changed, entry, priorValue, appliedValue, backupPath };
}

/** Current live value of every managed key, for `cxc config list`. */
export function readManagedState(configPath        )                                                {
  const content = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  return CONFIG_MANAGED_KEYS.map((entry) => ({
    entry,
    value: readTableKey(content, entry.table, entry.key),
  }));
}
