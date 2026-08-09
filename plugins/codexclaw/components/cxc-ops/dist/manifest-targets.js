/**
 * Shared manifest-target validator (WP7 / plan 080).
 *
 * Both `scripts/build.mjs` and `doctor.ts` need the same question answered:
 * does every target a manifest declares actually exist, non-empty, inside the
 * plugin root? Before this module the build had one inline copy and doctor had
 * a weaker one. This is the single implementation.
 *
 * There is no build/installed mode. An installed plugin keeps `${PLUGIN_ROOT}`
 * placeholders and relative MCP args exactly as the repo does, so one
 * `pluginRoot` argument covers both callers.
 */
import { existsSync, realpathSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";













/**
 * A JSON parse failure that remembers where it came from.
 *
 * Raw `SyntaxError` from `JSON.parse` carries no filename and no kind — a
 * broken hook JSON and a broken MCP JSON produce byte-identical messages. That
 * left doctor unable to route the failure. Extending `SyntaxError` keeps the
 * build's existing behaviour (it dies) and any `instanceof SyntaxError` check
 * intact.
 */
export class TargetParseError extends SyntaxError {
           kind            ;
           path        ;

  constructor(kind            , path        , cause         ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "TargetParseError";
    this.kind = kind;
    this.path = path;
  }
}



























function readJson   (kind            , path        )    {
  const text = readFileSync(path, "utf8");
  try {
    return JSON.parse(text)     ;
  } catch (err) {
    throw new TargetParseError(kind, path, err);
  }
}

/**
 * Every `${PLUGIN_ROOT}/...` target in a command string.
 *
 * `commandWindows` uses backslashes and packs two targets into one command (a
 * `.ps1` launcher plus the real `.js` entry point), so this must collect every
 * match and must not filter on extension. This repo has zero `commandWindows`
 * fields today; the branch is exercised by fixtures only.
 */
const PLUGIN_ROOT_TARGET = /\$\{PLUGIN_ROOT\}[\\/]([^"\s]+)/g;

function targetsInCommand(command         )           {
  if (typeof command !== "string") return [];
  const out           = [];
  for (const match of command.matchAll(PLUGIN_ROOT_TARGET)) {
    const parts = match[1].split(/[\\/]/).filter((p) => p.length > 0);
    if (parts.length > 0) out.push(parts.join("/"));
  }
  return out;
}

/** Inside-root test uses realpath so a symlink cannot escape lexically. */
function escapesRoot(pluginRoot        , target        )          {
  let root        ;
  let real        ;
  try {
    root = realpathSync(pluginRoot);
    real = realpathSync(target);
  } catch {
    root = resolve(pluginRoot);
    real = resolve(target);
  }
  return real !== root && !real.startsWith(root.endsWith(sep) ? root : root + sep);
}

function checkTarget(
  issues               ,
  kind            ,
  pluginRoot        ,
  rel        ,
  missingMessage        ,
)       {
  const normalized = rel.replace(/^\.\//, "");
  const abs = resolve(pluginRoot, normalized);
  if (isAbsolute(rel) || escapesRoot(pluginRoot, abs)) {
    issues.push({ kind, message: `target escapes plugin root: ${rel}` });
    return;
  }
  if (!existsSync(abs)) {
    issues.push({ kind, message: missingMessage });
    return;
  }
  if (statSync(abs).size === 0) {
    issues.push({ kind, message: `target is empty: ${rel}` });
  }
}

/**
 * Validate every target declared by the plugin manifest.
 *
 * Throws {@link TargetParseError} on malformed JSON — a broken manifest is a
 * collapsed premise, not a finding, and validation stops there. Callers that
 * want to report rather than die must catch it.
 */
export function validateManifestTargets(pluginRoot        )                {
  const issues                = [];
  const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
  if (!existsSync(manifestPath)) return issues;
  const manifest = readJson                ("hook", manifestPath);

  const hookEntries            = Array.isArray(manifest.hooks) ? manifest.hooks : [];
  for (const hookRel of hookEntries) {
    if (typeof hookRel !== "string") {
      issues.push({ kind: "hook", message: `manifest hook file must be a string: ${String(hookRel)}` });
      continue;
    }
    const hookFile = resolve(pluginRoot, hookRel.replace(/^\.\//, ""));
    if (isAbsolute(hookRel) || escapesRoot(pluginRoot, hookFile)) {
      issues.push({ kind: "hook", message: `manifest hook file escapes plugin root: ${String(hookRel)}` });
      continue;
    }
    if (!existsSync(hookFile)) {
      issues.push({ kind: "hook", message: `manifest hook file missing: ${hookRel}` });
      continue;
    }
    const hookJson = readJson          ("hook", hookFile);
    for (const evt of Object.values(hookJson.hooks ?? {})) {
      for (const group of evt ?? []) {
        for (const h of group.hooks ?? []) {
          for (const command of [h.command, h.commandWindows]) {
            for (const rel of targetsInCommand(command)) {
              checkTarget(issues, "hook", pluginRoot, rel, `hook references missing dist: ${rel}`);
            }
          }
        }
      }
    }
  }

  if (typeof manifest.mcpServers === "string") {
    const mcpRel = manifest.mcpServers;
    const mcpFile = resolve(pluginRoot, mcpRel.replace(/^\.\//, ""));
    if (isAbsolute(mcpRel) || escapesRoot(pluginRoot, mcpFile)) {
      issues.push({ kind: "mcp", message: `manifest mcpServers file escapes plugin root: ${mcpRel}` });
      return issues;
    }
    if (!existsSync(mcpFile)) {
      issues.push({ kind: "mcp", message: `manifest mcpServers file missing: ${mcpRel}` });
    } else {
      const mcp = readJson         ("mcp", mcpFile);
      for (const [srv, cfg] of Object.entries(mcp.mcpServers ?? {})) {
        for (const arg of cfg.args ?? []) {
          if (typeof arg === "string" && arg.endsWith(".js")) {
            checkTarget(issues, "mcp", pluginRoot, arg, `mcp server ${srv} references missing dist: ${arg}`);
          }
        }
      }
    }
  }

  return issues;
}
