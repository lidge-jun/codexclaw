#!/usr/bin/env node
/**
 * spawn-attach-hook.ts — lazygap_impl 020 Part B: the E3 PreToolUse `^spawn_agent$`
 * skill-attachment hook (FAIL-SAFE, opt-in).
 *
 * On a PROVEN v1 spawn surface, this rewrites the spawn's `tool_input` to add an `items`
 * array carrying the inferred `cxc-*` skills, so a dispatched subagent loads the discipline
 * deterministically without the main agent calling the E5 builder by hand.
 *
 * SAFETY (A-gate Curie, codex-rs verified):
 *  - The PreToolUse payload CANNOT prove v1 vs v2: both canonicalize to tool_name
 *    "spawn_agent" (registry.rs:727). v2 is `deny_unknown_fields` (multi_agents_v2/spawn.rs:242)
 *    and would REJECT an injected `items`, breaking the spawn. So we attach ONLY when v1 is
 *    positively proven via an explicit operator opt-in (env CODEXCLAW_SPAWN_ATTACH=v1).
 *  - `updatedInput` is a FULL REPLACEMENT of tool_input (registry.rs:122), honored only on
 *    permissionDecision "allow" (output_parser.rs:162). We echo the ENTIRE original input + items.
 *  - The hook NEVER denies and NEVER throws: any doubt/error -> emit "" (allow untouched).
 *
 * This is an opt-in convenience for v1 operators. The always-safe primary attach path is the
 * E5 builder (`routeDispatch`/`resolveSpawnPayloadWithSkills`), which the main agent calls.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSpawnItems,
  SURFACE_SKILL,



} from "./spawn-wrapper.js";

/** v2-only fields: if present, this is a v2 spawn — never inject. */
const V2_ONLY_FIELDS = ["task_name", "fork_turns"]         ;

/** The plugin skills dir, relative to this module's dist location. */
function skillsDir()         {
  // dist/spawn-attach-hook.js -> components/subagent-config/dist -> plugin root is ../../..
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..", "skills");
}

function isRecord(v         )                               {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Map the spawn's agent_type back to a base RoleName for skill baselines. */
function roleFromAgentType(agentType         )           {
  // explorer/reviewer both spawn as agent_type "explorer"; executor as "worker".
  // We cannot tell reviewer from explorer here, so default the explorer surface to
  // "explorer" (read-only baseline). worker -> executor.
  return agentType === "worker" ? "executor" : "explorer";
}

/** Narrow surface inference: only unambiguous surface keywords present in the message. */
function inferSurfaces(message        )            {
  const m = message.toLowerCase();
  const out            = [];
  for (const surface of Object.keys(SURFACE_SKILL)             ) {
    // surface tokens are hyphen-free words like "frontend", "backend", "security"...
    if (m.includes(surface)) out.push(surface);
  }
  return out;
}

/** True only when the operator has positively asserted the v1 spawn surface. */
function v1SurfaceProven()          {
  return process.env.CODEXCLAW_SPAWN_ATTACH === "v1";
}

/**
 * Decide the hook output for a PreToolUse spawn payload. Returns "" (allow untouched) or
 * the full-replacement updatedInput envelope. Total: never throws.
 */
export function runSpawnAttachHook(raw        )         {
  try {
    const obj = JSON.parse((raw ?? "").trim() || "{}")           ;
    if (!isRecord(obj)) return "";
    if (obj.hook_event_name !== "PreToolUse") return "";
    if (obj.tool_name !== "spawn_agent") return "";

    const toolInput = obj.tool_input;
    if (!isRecord(toolInput)) return "";

    // No-op guards: already attached, or a v2-only shape.
    if ("items" in toolInput) return "";
    for (const f of V2_ONLY_FIELDS) {
      if (f in toolInput) return "";
    }

    // v1 must be PROVEN; absent proof, allow untouched (never risk a v2 break).
    if (!v1SurfaceProven()) return "";

    const message = typeof toolInput.message === "string" ? toolInput.message : "";
    const role = roleFromAgentType(toolInput.agent_type);
    const surfaces = inferSurfaces(message);
    const items              = buildSpawnItems({
      role,
      task: message,
      skillsDir: skillsDir(),
      surfaces,
    });

    // Full replacement: echo every original key, then add items.
    const updatedInput = { ...toolInput, items };
    return `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        updatedInput,
      },
    })}\n`;
  } catch {
    return "";
  }
}

function readStdin()         {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main()       {
  // argv: hook pre-tool-use
  const kind = process.argv[2];
  if (kind !== "hook") {
    process.exit(0);
  }
  const out = runSpawnAttachHook(readStdin());
  if (out) process.stdout.write(out);
  process.exit(0);
}

// Only run as a CLI entrypoint, not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
