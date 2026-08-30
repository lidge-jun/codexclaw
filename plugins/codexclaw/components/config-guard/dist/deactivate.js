/**
 * deactivate.ts — revert exactly what codexclaw turned on, per key.
 *
 * The old gate hashed the WHOLE config.toml and refused to revert anything when the
 * file had changed at all. codexclaw is not the only writer of that file (the user
 * edits it, codex writes it, opencodex writes it), so one unrelated edit after install
 * disabled uninstall permanently — leaving flags the user never chose enabled forever.
 *
 * Now each item is judged on its own: revert when our value is still there, leave it
 * when someone else changed or removed it. The whole-file hash survives as a REPORTED
 * signal (`fileDrifted`), and it still gates the one destructive case — removing a key
 * whose priorValue was null — because value equality on a boolean is one bit of
 * provenance, not proof that we wrote it. There the activation backup has to agree.
 *
 * Order matters (and is load-bearing): table-key restores happen FIRST as one
 * read-modify-write, then the flag pass runs `codex features disable`. That CLI
 * rewrites config.toml from a fresh read, so it preserves our write; the reverse order
 * would clobber it. It also means a broken `codex` can never strand a managed key.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readDeclaredState,                  } from "./features.js";
import { parseInstallManifest, manifestPath,                     } from "./activate.js";
import { readTableKey, restoreTableKey } from "./toml-edit.js";
import { markSelfHealOptedOut } from "./self-heal.js";

























function hashOrNull(path        )                {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readTextOrNull(path        )                {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Decide what to do with one managed key.
 *
 * Pure so the decision table is testable without touching a filesystem.
 */
export function decideKeyRestore(
  rec                ,
  liveValue               ,
  fileDrifted         ,
  backupValue                           ,
)                                                                 {
  if (!rec.setByCodexclaw) return { action: "skip", reason: "changed" };
  if (liveValue === null) return { action: "skip", reason: "missing" };
  if (liveValue !== rec.appliedValue) return { action: "skip", reason: "changed" };
  // Destructive case: we would DELETE the line. One bit of value equality is not
  // enough when the file has drifted — the backup has to confirm the key was absent
  // before we installed. `undefined` means no backup was readable at all.
  if (rec.priorValue === null && fileDrifted) {
    if (backupValue === undefined || backupValue !== null) {
      return { action: "skip", reason: "unverifiable" };
    }
  }
  return { action: "restore" };
}

export function deactivate(deps                )                   {
  const { run, codexHome } = deps;
  // Opt out of self-heal on EVERY uninstall path, including the early returns below.
  // `cxc disable` is the user saying they want codexclaw off; a later SessionStart must
  // not quietly re-enable the flag it just reverted. Placing this at the top rather than
  // before the final return covers the no-manifest and malformed-manifest exits too,
  // which are exactly the cases where someone disables an install that never completed.
  try {
    markSelfHealOptedOut(codexHome, (deps.now ?? (() => new Date().toISOString()))());
  } catch {
    /* the marker is an optimisation, never a gate on uninstall */
  }
  const empty = ()                   => ({
    disabled: [],
    skippedPreExisting: [],
    noManifest: true,
    restoredKeys: [],
    skippedExternal: [],
    fileDrifted: false,
    featuresStateUnavailable: false,
  });

  const mPath = manifestPath(codexHome);
  if (!existsSync(mPath)) return empty();

  const manifestText = readTextOrNull(mPath);
  const manifest = manifestText === null ? null : parseInstallManifest(manifestText);
  // A malformed manifest is treated exactly like a missing one: never guess at a revert.
  if (manifest === null) return empty();

  const configPath = deps.configPath ?? manifest.configPath ?? join(codexHome, "config.toml");
  const fileDrifted =
    manifest.postActivateHash !== null && hashOrNull(configPath) !== manifest.postActivateHash;

  const restoredKeys           = [];
  const skippedExternal                                           = [];

  // --- Pass 1: managed table keys, as a single read-modify-write.
  const tableKeys = manifest.tableKeys ?? {};
  if (Object.keys(tableKeys).length > 0) {
    let content = readTextOrNull(configPath);
    if (content !== null) {
      const backupContent = manifest.backupPath ? readTextOrNull(manifest.backupPath) : null;
      let changed = false;
      for (const [id, rec] of Object.entries(tableKeys)) {
        const live = readTableKey(content, rec.table, rec.key);
        const backupValue =
          backupContent === null ? undefined : readTableKey(backupContent, rec.table, rec.key);
        const decision = decideKeyRestore(rec, live, fileDrifted, backupValue);
        if (decision.action === "skip") {
          skippedExternal.push({ target: id, reason: decision.reason });
          continue;
        }
        const res = restoreTableKey(content, rec.table, rec.key, rec.priorValue);
        if (res.changed) {
          content = res.content;
          changed = true;
          restoredKeys.push(id);
        } else {
          // Nothing to do (already at the prior value) — still ours, not an external skip.
          restoredKeys.push(id);
        }
      }
      if (changed) writeFileSync(configPath, content, "utf8");
    }
  }

  // --- Pass 2: declared feature flags, via the official CLI.
  // Reading live state lets us skip a flag the user turned back off themselves, but it
  // must never make uninstall fail: `readDeclaredState` throws when codex is missing
  // or errors, and uninstall used to complete without it.
  let liveFlags                                      = null;
  let featuresStateUnavailable = false;
  try {
    liveFlags = readDeclaredState(run);
  } catch {
    featuresStateUnavailable = true;
  }

  const disabled           = [];
  const skippedPreExisting           = [];
  for (const [key, rec] of Object.entries(manifest.flags)) {
    if (rec.priorEnabled) {
      skippedPreExisting.push(key);
      continue;
    }
    if (!rec.enabledByCodexclaw) continue; // never actually enabled (e.g. a failed soft flag)
    if (liveFlags && liveFlags.get(key) === false) {
      // The user already turned it off; calling disable again would be noise.
      skippedExternal.push({ target: key, reason: "missing" });
      continue;
    }
    const res = run(["features", "disable", key]);
    if (res.exitCode === 0) disabled.push(key);
  }

  return {
    disabled,
    skippedPreExisting,
    noManifest: false,
    restoredKeys,
    skippedExternal,
    fileDrifted,
    featuresStateUnavailable,
  };
}
