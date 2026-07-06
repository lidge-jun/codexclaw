#!/usr/bin/env node
/**
 * cli.ts — `cxc subagents` operator surface (L9.3 / 093).
 *
 * Read/write the SAME `.codexclaw/subagents.json` store the MCP server and GUI use,
 * so the terminal, the dashboard, and MCP all roundtrip one source of truth. Pure
 * arg parsing + a thin runner; the store owns validation (validateRolePatch) and the
 * atomic write. Zero third-party deps (node:* only) per the build constraint.
 *
 * Usage:
 *   subagents               list all role configs (JSON)
 *   subagents get <role>    show one role config (JSON)
 *   subagents set <role> --mode default|model [--model <id>] [--effort <level>|--clear-effort]
 *                        [--prompt <text>|--clear-prompt]
 */
import { readConfig, setRole, ROLES, EFFORTS,                                                 } from "./store.js";








function isRole(v                    )                {
  return typeof v === "string" && (ROLES                     ).includes(v);
}

/** Pure structural parse of the `subagents` argv (excluding the leading verb). */
export function parseSubagentsArgs(argv          )                      {
  const sub = argv[0];
  if (sub === undefined || sub === "list") return { action: "list" };
  if (sub === "help" || sub === "--help" || sub === "-h") return { action: "help" };

  if (sub === "get") {
    if (!isRole(argv[1])) return { action: "get", error: `unknown role '${argv[1] ?? ""}' (expected ${ROLES.join("|")})` };
    return { action: "get", role: argv[1] };
  }

  if (sub === "set") {
    if (!isRole(argv[1])) return { action: "set", error: `unknown role '${argv[1] ?? ""}' (expected ${ROLES.join("|")})` };
    const role = argv[1];
    const patch                      = {};
    for (let i = 2; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--mode") {
        const v = argv[++i];
        if (v !== "default" && v !== "model") return { action: "set", role, error: `--mode must be default|model (got '${v ?? ""}')` };
        patch.mode = v;
      } else if (a === "--model") {
        patch.model = argv[++i] ?? "";
      } else if (a === "--effort") {
        const v = argv[++i];
        if (!(EFFORTS                     ).includes(v ?? "")) {
          return { action: "set", role, error: `--effort must be ${EFFORTS.join("|")} (got '${v ?? ""}')` };
        }
        patch.effort = v              ;
      } else if (a === "--clear-effort") {
        patch.effort = null;
      } else if (a === "--prompt") {
        patch.promptOverride = argv[++i] ?? "";
      } else if (a === "--clear-prompt") {
        patch.promptOverride = null;
      } else {
        return { action: "set", role, error: `unknown flag '${a}'` };
      }
    }
    if (Object.keys(patch).length === 0) {
      return { action: "set", role, error: "set requires at least one of --mode/--model/--effort/--clear-effort/--prompt/--clear-prompt" };
    }
    return { action: "set", role, patch };
  }

  return { action: "help", error: `unknown subcommand '${sub}'` };
}

const HELP = [
  "cxc subagents — per-role subagent model/prompt config (.codexclaw/subagents.json)",
  "",
  "  subagents               list all role configs",
  "  subagents get <role>    show one role config",
  "  subagents set <role> --mode default|model [--model <id>] [--effort <level>|--clear-effort] [--prompt <text>|--clear-prompt]",
  "",
  `  roles: ${ROLES.join(", ")}`,
  `  efforts: ${EFFORTS.join(", ")} (unset = inherit the parent session's effort)`,
].join("\n");






/** Execute a parsed `subagents` command against the store at `cwd`. Never throws. */
export function runSubagents(parsed                     , cwd        )                  {
  if (parsed.error) return { code: 1, output: `subagents: ${parsed.error}` };
  switch (parsed.action) {
    case "help":
      return { code: 0, output: HELP };
    case "list":
      return { code: 0, output: JSON.stringify(readConfig(cwd), null, 2) };
    case "get": {
      const cfg = readConfig(cwd);
      return { code: 0, output: JSON.stringify(cfg.roles[parsed.role            ], null, 2) };
    }
    case "set": {
      try {
        const cfg = setRole(cwd, parsed.role            , parsed.patch ?? {});
        return { code: 0, output: JSON.stringify(cfg.roles[parsed.role            ], null, 2) };
      } catch (err) {
        return { code: 1, output: `subagents: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  }
}

// CLI entry: argv = [node, cli.js, "subagents", ...rest].
const isDirect = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  const [, , verb, ...rest] = process.argv;
  if (verb !== "subagents") {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const result = runSubagents(parseSubagentsArgs(rest), process.cwd());
  process.stdout.write(`${result.output}\n`);
  process.exit(result.code);
}
