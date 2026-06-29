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
  type CodexRunner,
  type DeclaredFeature,
} from "./features.ts";

export const INSTALL_MANIFEST = ".codexclaw-install.json";

export interface FlagRecord {
  priorEnabled: boolean;
  // true when codexclaw turned this flag on (so deactivate should turn it back off).
  enabledByCodexclaw: boolean;
  // true when the enable command failed (e.g. soft under-dev flag unavailable).
  enableFailed: boolean;
}

export interface InstallManifest {
  version: 1;
  activatedAt: string;
  configPath: string;
  backupPath: string | null;
  postActivateHash: string | null;
  flags: Record<string, FlagRecord>;
}

export interface ActivateDeps {
  run: CodexRunner;
  codexHome: string;
  // Defaults to <codexHome>/config.toml; injectable for tests.
  configPath?: string;
  // Returns an ISO timestamp; injectable for deterministic tests.
  now?: () => string;
}

function hashOrNull(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function manifestPath(codexHome: string): string {
  return join(codexHome, INSTALL_MANIFEST);
}

export function activate(deps: ActivateDeps): InstallManifest {
  const { run, codexHome } = deps;
  const configPath = deps.configPath ?? join(codexHome, "config.toml");
  const now = deps.now ?? (() => new Date().toISOString());

  mkdirSync(codexHome, { recursive: true });

  const priorState = readDeclaredState(run);
  const pending = featuresToEnable(priorState);

  // Back up config.toml before any change (timestamped; codexclaw's own safeguard).
  let backupPath: string | null = null;
  if (existsSync(configPath)) {
    backupPath = `${configPath}.codexclaw-${now().replace(/[:.]/g, "-")}.bak`;
    copyFileSync(configPath, backupPath);
  }

  const flags: Record<string, FlagRecord> = {};
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

  const manifest: InstallManifest = {
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

export type { DeclaredFeature };
