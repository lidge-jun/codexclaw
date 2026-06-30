// Activation orchestration. All external dependencies (codex runner, codexHome path) are injected
// so this layer never resolves the real ~/.codex by default — see cli.ts for the production binding.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DECLARED_FEATURES,
  SOFT_FEATURES,
  featuresToEnable,
  readDeclaredState,


} from "./features.js";

export const INSTALL_MANIFEST = ".codexclaw-install.json";



























function hashOrNull(path        )                {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function manifestPath(codexHome        )         {
  return join(codexHome, INSTALL_MANIFEST);
}

export function activate(deps              )                  {
  const { run, codexHome } = deps;
  const configPath = deps.configPath ?? join(codexHome, "config.toml");
  const now = deps.now ?? (() => new Date().toISOString());

  mkdirSync(codexHome, { recursive: true });

  const priorState = readDeclaredState(run);
  const pending = featuresToEnable(priorState);

  // Back up config.toml before any change (timestamped; codexclaw's own safeguard).
  let backupPath                = null;
  if (existsSync(configPath)) {
    backupPath = `${configPath}.codexclaw-${now().replace(/[:.]/g, "-")}.bak`;
    copyFileSync(configPath, backupPath);
  }

  const flags                             = {};
  for (const key of DECLARED_FEATURES) {
    flags[key] = {
      priorEnabled: priorState.get(key) === true,
      enabledByCodexclaw: false,
      enableFailed: false,
    };
  }

  for (const key of pending) {
    const res = run(["features", "enable", key]);
    if (res.exitCode === 0) {
      flags[key].enabledByCodexclaw = true;
    } else {
      flags[key].enableFailed = true;
      if (!SOFT_FEATURES.has(key)) {
        throw new Error(
          `codex features enable ${key} failed (exit ${res.exitCode}): ${res.stderr.trim()}`,
        );
      }
      // Soft flag (e.g. under-development): log and continue; Interview degrades gracefully.
    }
  }

  const manifest                  = {
    version: 1,
    activatedAt: now(),
    configPath,
    backupPath,
    postActivateHash: hashOrNull(configPath),
    flags,
  };
  writeFileSync(manifestPath(codexHome), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}


