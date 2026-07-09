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

/**
 * PURE (260709 dev2 switch, audit blocker 3): `codex features enable multi_agent_v2`
 * rewrites the flag as a SCALAR (`multi_agent_v2 = true` under `[features]`),
 * REPLACING an existing `[features.multi_agent_v2]` table and silently dropping
 * tuning keys such as `max_concurrent_threads_per_session` (codex-rs
 * config/edit.rs). Given the pre-enable and post-enable config contents, return the
 * repaired post content (scalar removed, table restored with `enabled = true` plus
 * the preserved non-`enabled` keys) — or null when no repair is needed.
 */
export function preserveMultiAgentV2Table(preConfig: string, postConfig: string): string | null {
  // Post still carries the table form -> nothing was clobbered.
  if (/^\[features\.multi_agent_v2\]\s*$/m.test(postConfig)) return null;
  // Pre had no table -> nothing to preserve.
  const tableMatch = /^\[features\.multi_agent_v2\]\s*\n((?:(?!\s*\[).*\n?)*)/m.exec(preConfig);
  if (!tableMatch) return null;
  const preservedLines = tableMatch[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !/^enabled\s*=/.test(l));
  if (preservedLines.length === 0) return null;
  // The clobbered scalar form: `multi_agent_v2 = true` (dotted or bare key line).
  const scalarRe = /^(?:features\.)?multi_agent_v2\s*=\s*true\s*$/m;
  if (!scalarRe.test(postConfig)) return null;
  const withoutScalar = postConfig.replace(scalarRe, "").replace(/\n{3,}/g, "\n\n");
  const table = `\n[features.multi_agent_v2]\nenabled = true\n${preservedLines.join("\n")}\n`;
  return `${withoutScalar.replace(/\n*$/, "\n")}${table}`;
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
  // Snapshot for the multi_agent_v2 table-preservation repair (see helper above).
  const preConfigContent = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";

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
      if (key === "multi_agent_v2" && existsSync(configPath)) {
        const post = readFileSync(configPath, "utf8");
        const repaired = preserveMultiAgentV2Table(preConfigContent, post);
        if (repaired !== null) writeFileSync(configPath, repaired, "utf8");
      }
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
