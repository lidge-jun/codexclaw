/**
 * multi-agent-v2.ts — read/write the Codex multi_agent_v2 feature flag.
 *
 * Mirrors the opencodex `ocx v2` boundary: detection reads config.toml directly,
 * while mutation goes through the official `codex features enable|disable` CLI.
 * Tests inject both the runner and codex home so this module never reaches the
 * real ~/.codex unless the production binding passes it explicitly.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { preserveMultiAgentV2Table } from "./activate.js";








// Source: codex-rs models-manager/models.json, checked 2026-07-10.
// These point-in-time catalog pins must be refreshed when that catalog changes.
export const MULTI_AGENT_V2_CATALOG_PINNED = {
  v2: ["gpt-5.6-sol", "gpt-5.6-terra"],
  v1: ["gpt-5.6-luna"],
}         ;

export const MULTI_AGENT_V2_STATUS_CONTEXT = {
  appliesTo: "flag-fallback models only",
  catalogPinned: MULTI_AGENT_V2_CATALOG_PINNED,
  effectiveFrom: "new sessions",
}         ;









function configPathFor(deps                                                    )         {
  return deps.configPath ?? join(deps.codexHome, "config.toml");
}

function readConfigText(path        )                {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Body lines of a TOML table `[header]` up to the next table header. */
function tomlTableBody(content        , header        )                {
  const lines = content.split("\n");
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = lines.findIndex((line) => new RegExp(`^\\s*\\[${escaped}\\]\\s*(?:#.*)?$`).test(line));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\s*\[/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

function tomlBoolInBody(body        , key        )                 {
  const match = body.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*(?:#.*)?$`, "m"));
  return match ? match[1] === "true" : null;
}

/**
 * TRUE when config.toml enables multi_agent_v2. Recognizes the shipped table,
 * scalar, and inline-table forms; missing config/key means the v1 default.
 */
export function isMultiAgentV2Enabled(configPath        )          {
  const content = readConfigText(configPath);
  if (content === null) return false;

  const table = tomlTableBody(content, "features.multi_agent_v2");
  if (table !== null) {
    return tomlBoolInBody(table, "enabled") === true;
  }

  const features = tomlTableBody(content, "features");
  if (features !== null) {
    const bool = tomlBoolInBody(features, "multi_agent_v2");
    if (bool !== null) return bool;
    const inline = features.match(/^\s*multi_agent_v2\s*=\s*\{([^}]*)\}/m);
    if (inline) {
      const enabled = inline[1].match(/enabled\s*=\s*(true|false)/);
      if (enabled) return enabled[1] === "true";
    }
  }
  return false;
}

export function readMultiAgentV2State(deps                  )                    {
  const v2Enabled = isMultiAgentV2Enabled(configPathFor(deps));
  return { version: v2Enabled ? "v2" : "v1", v2Enabled, ...MULTI_AGENT_V2_STATUS_CONTEXT };
}

export function setMultiAgentV2State(deps                  , version             )                                           {
  const configPath = configPathFor(deps);
  const wantEnabled = version === "v2";
  const beforeEnabled = isMultiAgentV2Enabled(configPath);
  if (beforeEnabled === wantEnabled) {
    return { version, v2Enabled: wantEnabled, changed: false, ...MULTI_AGENT_V2_STATUS_CONTEXT };
  }

  const preConfig = readConfigText(configPath) ?? "";
  const res = deps.run(["features", wantEnabled ? "enable" : "disable", "multi_agent_v2"]);
  if (res.exitCode !== 0) {
    throw new Error(`codex features ${wantEnabled ? "enable" : "disable"} multi_agent_v2 failed (exit ${res.exitCode}): ${res.stderr.trim()}`);
  }

  if (existsSync(configPath)) {
    const postConfig = readFileSync(configPath, "utf8");
    // This toggle path is the sole owner of preserving the v2 tuning table.
    const repaired = preserveMultiAgentV2Table(preConfig, postConfig, wantEnabled);
    if (repaired !== null) writeFileSync(configPath, repaired, "utf8");
  }

  const v2Enabled = isMultiAgentV2Enabled(configPath);
  return {
    version: v2Enabled ? "v2" : "v1",
    v2Enabled,
    changed: true,
    ...MULTI_AGENT_V2_STATUS_CONTEXT,
  };
}
