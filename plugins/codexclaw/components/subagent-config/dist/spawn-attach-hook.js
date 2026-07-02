#!/usr/bin/env node
/**
 * spawn-attach-hook.ts — the E3 PreToolUse `^spawn_agent$` skill-attachment hook
 * (WP1 mention-channel upgrade; originally lazygap_impl 020 Part B).
 *
 * Rewrites the spawn's `message` to PREPEND link-form skill mentions
 * (`[$cxc-<folder>](skill://<abs SKILL.md path>)`), so a dispatched subagent loads the
 * matching `cxc-*` discipline deterministically without the main agent calling the E5
 * builder by hand. The child's first turn parses mentions out of its UserInput text and
 * injects each SKILL.md body (codex-rs injection.rs, extract_tool_mentions).
 *
 * WHY message rewrite (not `items`): only the v1 spawn schema accepts `items`
 * (UserInput::Skill); v2 is `deny_unknown_fields` and rejects it. `message` is a shared
 * field on BOTH surfaces, so rewriting it is schema-safe everywhere — no v1-proof opt-in
 * (the old CODEXCLAW_SPAWN_ATTACH=v1 gate) and no V2_ONLY_FIELDS sniffing are needed.
 * This hook is therefore ALWAYS-ON.
 *
 * SAFETY:
 *  - `updatedInput` is a FULL REPLACEMENT of tool_input (registry.rs:122), honored only
 *    on permissionDecision "allow" (output_parser.rs:162). We echo the ENTIRE original
 *    input and change ONLY `message`.
 *  - `items` already present -> no-op. The caller chose the structured v1 channel (E5
 *    builder); adding mentions on top would double-inject the same skills. We do NOT
 *    salvage a v2-shaped payload that carries stale `items` — that spawn is already
 *    invalid on v2 with or without us, and guessing the surface risks breaking v1.
 *  - Mentions already present in the message dedupe per-folder; nothing left -> no-op.
 *  - The hook NEVER denies and NEVER throws: any doubt/error -> emit "" (allow untouched).
 */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSkillMentionBlock,
  SURFACE_SKILL,


} from "./spawn-wrapper.js";

/**
 * The plugin skills dir. CODEXCLAW_SKILLS_DIR overrides for installs (and tests)
 * where the dist entrypoint does not sit at its canonical in-plugin location;
 * otherwise resolve relative to this module's dist location.
 */
function skillsDir()         {
  const env = process.env.CODEXCLAW_SKILLS_DIR;
  if (typeof env === "string" && env.length > 0) return env;
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

/**
 * Skill FOLDERS already mentioned in the outgoing message, in any of the three
 * recognized shapes: plain `$cxc-<folder>`, plugin-native `$codexclaw:cxc-<folder>`,
 * or a link-form `skill://.../<folder>/SKILL.md` target path.
 */
export function mentionedFolders(message        )              {
  const out = new Set        ();
  for (const m of message.matchAll(/\$(?:codexclaw:)?cxc-([a-z0-9-]+)/gi)) {
    out.add(m[1].toLowerCase());
  }
  for (const m of message.matchAll(/skill:\/\/\S*?\/([^/\s)]+)\/SKILL\.md/gi)) {
    out.add(m[1].toLowerCase());
  }
  return out;
}

/**
 * Decide the hook output for a PreToolUse spawn payload. Returns "" (allow untouched) or
 * the full-replacement updatedInput envelope with the mention block prepended to
 * `message`. Total: never throws.
 */
export function runSpawnAttachHook(raw        )         {
  try {
    const obj = JSON.parse((raw ?? "").trim() || "{}")           ;
    if (!isRecord(obj)) return "";
    if (obj.hook_event_name !== "PreToolUse") return "";
    if (obj.tool_name !== "spawn_agent") return "";

    const toolInput = obj.tool_input;
    if (!isRecord(toolInput)) return "";

    // Structured channel already chosen (E5 builder v1 payload) -> never double-attach.
    if ("items" in toolInput) return "";

    // Only rewrite a real message; never invent one (schema shape stays untouched).
    const message = toolInput.message;
    if (typeof message !== "string" || message.trim().length === 0) return "";

    const role = roleFromAgentType(toolInput.agent_type);
    const surfaces = inferSurfaces(message);
    const block = buildSkillMentionBlock({
      role,
      skillsDir: skillsDir(),
      surfaces,
      excludeFolders: [...mentionedFolders(message)],
    });
    if (block.length === 0) return "";

    // Full replacement: echo every original key, change only message.
    const updatedInput = { ...toolInput, message: `${block}\n\n${message}` };
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

// Only run as a CLI entrypoint, not when imported by tests. Compare via realpath:
// the ESM loader resolves the main module through symlinks (e.g. macOS /var/folders
// -> /private/var/folders), so a plain resolve() comparison can miss a real CLI run.
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
let invokedReal = invokedPath;
try {
  invokedReal = realpathSync(invokedPath);
} catch {
  /* keep the unresolved path */
}
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && (selfPath === invokedPath || selfPath === invokedReal)) {
  main();
}
