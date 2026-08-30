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
















/**
 * A non-feature config.toml key codexclaw wrote (managed-keys.ts whitelist).
 *
 * `priorValue` is what deactivate restores; null means the key did not exist and
 * should be removed. `appliedValue` is what we wrote, so the uninstall path can ask
 * "is my value still there" per key instead of hashing the whole file.
 */





















/**
 * Runtime shape check for a parsed manifest. This repo has no `tsc` step, so a cast
 * would let a hand-edited or truncated manifest reach the revert logic as `undefined`
 * lookups. A malformed manifest is treated as absent by the caller (safe no-op).
 */
export function parseInstallManifest(text        )                         {
  let raw         ;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw                           ;
  if (o.version !== 1 && o.version !== 2) return null;
  if (typeof o.configPath !== "string") return null;
  if (typeof o.flags !== "object" || o.flags === null || Array.isArray(o.flags)) return null;

  const flags                             = {};
  for (const [key, value] of Object.entries(o.flags                           )) {
    if (typeof value !== "object" || value === null) return null;
    const rec = value                           ;
    flags[key] = {
      priorEnabled: rec.priorEnabled === true,
      enabledByCodexclaw: rec.enabledByCodexclaw === true,
      enableFailed: rec.enableFailed === true,
    };
    // Lenient on purpose: a malformed `failure` drops that one field instead of
    // rejecting the manifest. The parser's contract is "malformed = absent (safe
    // no-op)", and voiding a whole manifest over warning metadata would cost the
    // revert capability the manifest exists to provide.
    const f = (value                           ).failure;
    if (typeof f === "object" && f !== null && !Array.isArray(f)) {
      const fr = f                           ;
      if (typeof fr.exitCode === "number") {
        flags[key].failure = {
          exitCode: fr.exitCode,
          message: typeof fr.message === "string" ? fr.message : "",
        };
      }
    }
  }

  const tableKeys                                 = {};
  if (o.tableKeys !== undefined) {
    if (typeof o.tableKeys !== "object" || o.tableKeys === null || Array.isArray(o.tableKeys)) return null;
    for (const [id, value] of Object.entries(o.tableKeys                           )) {
      if (typeof value !== "object" || value === null) return null;
      const rec = value                           ;
      if (typeof rec.table !== "string" || typeof rec.key !== "string") return null;
      if (typeof rec.appliedValue !== "string") return null;
      if (rec.priorValue !== null && typeof rec.priorValue !== "string") return null;
      tableKeys[id] = {
        table: rec.table,
        key: rec.key,
        priorValue: rec.priorValue                 ,
        appliedValue: rec.appliedValue,
        setByCodexclaw: rec.setByCodexclaw === true,
      };
    }
  }

  return {
    version: o.version,
    activatedAt: typeof o.activatedAt === "string" ? o.activatedAt : "",
    configPath: o.configPath,
    backupPath: typeof o.backupPath === "string" ? o.backupPath : null,
    postActivateHash: typeof o.postActivateHash === "string" ? o.postActivateHash : null,
    flags,
    tableKeys,
  };
}










function hashOrNull(path        )                {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * PURE (260709 dev2 switch, audit blocker 3): `codex features enable multi_agent_v2`
 * rewrites the flag as a SCALAR (`multi_agent_v2 = true` under `[features]`),
 * REPLACING an existing `[features.multi_agent_v2]` table and silently dropping
 * tuning keys such as `max_concurrent_threads_per_session` (codex-rs
 * config/edit.rs). Given the pre-enable and post-enable config contents, return the
 * repaired post content (scalar removed, table restored with the requested `enabled`
 * value plus preserved non-`enabled` keys) — or null when no repair is needed.
 */
export function preserveMultiAgentV2Table(preConfig        , postConfig        , enabled = true)                {
  const lineEnding = preConfig.includes("\r\n") ? "\r\n" : "\n";
  // Post still carries the table form -> nothing was clobbered.
  if (/^\[features\.multi_agent_v2\]\s*$/m.test(postConfig)) return null;
  // Pre had no table -> nothing to preserve.
  const tableMatch = /^\[features\.multi_agent_v2\][^\S\r\n]*(?:\r?\n|$)((?:(?![^\S\r\n]*\[)[^\r\n]*(?:\r?\n|$))*)/m.exec(preConfig);
  if (!tableMatch) return null;
  const preservedLines = tableMatch[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !/^enabled\s*=/.test(l));
  if (preservedLines.length === 0) return null;
  // The clobbered scalar form: `multi_agent_v2 = true/false` (dotted or bare key line).
  const scalarRe = new RegExp(`^(?:features\\.)?multi_agent_v2\\s*=\\s*${enabled ? "true" : "false"}\\s*$`, "m");
  if (!scalarRe.test(postConfig)) return null;
  const withoutScalar = postConfig
    .replace(scalarRe, "")
    .replace(/(?:\r?\n){3,}/g, lineEnding.repeat(2));
  const table = `${lineEnding}[features.multi_agent_v2]${lineEnding}enabled = ${enabled ? "true" : "false"}${lineEnding}${preservedLines.join(lineEnding)}${lineEnding}`;
  return `${withoutScalar.replace(/(?:\r?\n)*$/, lineEnding)}${table}`;
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
      flags[key].failure = {
        exitCode: res.exitCode,
        message: res.stderr.trim().slice(0, 500),
      };
      if (!SOFT_FEATURES.has(key)) {
        throw new Error(
          `codex features enable ${key} failed (exit ${res.exitCode}): ${res.stderr.trim()}`,
        );
      }
      // Soft flag: activation continues, but cli.ts renders an explicit warning from
      // the recorded failure. Failing the whole activation here would also drop skills,
      // hooks and MCP registration over one upstream flag — worse than the warning.
    }
  }

  const manifest                  = {
    version: 2,
    activatedAt: now(),
    configPath,
    backupPath,
    postActivateHash: hashOrNull(configPath),
    flags,
    // Installation never writes a managed key: every CONFIG_MANAGED_KEYS entry is
    // autoEnable:false, so this starts empty and only `cxc config set` adds to it.
    tableKeys: {},
  };
  writeFileSync(manifestPath(codexHome), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}


