// Deactivation: revert exactly the flags codexclaw turned on, with a drift guard. If the live
// config no longer matches the post-activate snapshot, codexclaw does NOT blindly revert — it
// reports the drift and leaves drifted state alone (safe-by-default).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type CodexRunner } from "./features.ts";
import { type InstallManifest, manifestPath } from "./activate.ts";

export interface DeactivateDeps {
  run: CodexRunner;
  codexHome: string;
  configPath?: string;
}

export interface DeactivateResult {
  disabled: string[];
  skippedPreExisting: string[];
  skippedDrift: boolean;
  noManifest: boolean;
}

function hashOrNull(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function deactivate(deps: DeactivateDeps): DeactivateResult {
  const { run, codexHome } = deps;
  const mPath = manifestPath(codexHome);
  if (!existsSync(mPath)) {
    return { disabled: [], skippedPreExisting: [], skippedDrift: false, noManifest: true };
  }

  const manifest = JSON.parse(readFileSync(mPath, "utf8")) as InstallManifest;
  const configPath = deps.configPath ?? manifest.configPath ?? join(codexHome, "config.toml");

  // Drift guard: if config changed since activation, do not blindly revert.
  const currentHash = hashOrNull(configPath);
  if (manifest.postActivateHash !== null && currentHash !== manifest.postActivateHash) {
    return { disabled: [], skippedPreExisting: [], skippedDrift: true, noManifest: false };
  }

  const disabled: string[] = [];
  const skippedPreExisting: string[] = [];
  for (const [key, rec] of Object.entries(manifest.flags)) {
    if (rec.priorEnabled) {
      // Was already on before codexclaw — leave it untouched.
      skippedPreExisting.push(key);
      continue;
    }
    if (!rec.enabledByCodexclaw) continue; // never actually enabled (e.g. soft flag that failed)
    const res = run(["features", "disable", key]);
    if (res.exitCode === 0) disabled.push(key);
  }
  return { disabled, skippedPreExisting, skippedDrift: false, noManifest: false };
}
