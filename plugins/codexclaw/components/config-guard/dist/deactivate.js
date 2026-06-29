// Deactivation: revert exactly the flags codexclaw turned on, with a drift guard. If the live
// config no longer matches the post-activate snapshot, codexclaw does NOT blindly revert — it
// reports the drift and leaves drifted state alone (safe-by-default).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {                  } from "./features.js";
import {                       manifestPath } from "./activate.js";

                                 
                   
                    
                      
 

                                   
                     
                               
                        
                      
 

function hashOrNull(path        )                {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function deactivate(deps                )                   {
  const { run, codexHome } = deps;
  const mPath = manifestPath(codexHome);
  if (!existsSync(mPath)) {
    return { disabled: [], skippedPreExisting: [], skippedDrift: false, noManifest: true };
  }

  const manifest = JSON.parse(readFileSync(mPath, "utf8"))                   ;
  const configPath = deps.configPath ?? manifest.configPath ?? join(codexHome, "config.toml");

  // Drift guard: if config changed since activation, do not blindly revert.
  const currentHash = hashOrNull(configPath);
  if (manifest.postActivateHash !== null && currentHash !== manifest.postActivateHash) {
    return { disabled: [], skippedPreExisting: [], skippedDrift: true, noManifest: false };
  }

  const disabled           = [];
  const skippedPreExisting           = [];
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
