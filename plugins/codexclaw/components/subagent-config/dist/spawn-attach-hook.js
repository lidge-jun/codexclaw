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
 * Besides mention attachment, this hook is also the MODEL/EFFORT-ENFORCEMENT point:
 * when the role's `.codexclaw/subagents.json` config is model-mode and the caller did
 * not set a model on the spawn, the configured model id is injected into
 * `updatedInput.model`; likewise a configured reasoning effort is injected into
 * `updatedInput.reasoning_effort` when the caller did not pick one (effort is
 * mode-independent — it can ride a main-model spawn). Caller-picked values always
 * win (never overridden). reasoning_effort is a real spawn schema field on both v1
 * and v2 (multi_agents_spec.rs:571,610) and an invalid value HARD-FAILS the spawn,
 * so only store-validated efforts are ever injected.
 *
 * SAFETY:
 *  - `updatedInput` is a FULL REPLACEMENT of tool_input (registry.rs:122), honored only
 *    on permissionDecision "allow" (output_parser.rs:162). We echo the ENTIRE original
 *    input and change ONLY `message` and/or `model`.
 *  - `items` already present -> mention attachment is skipped (the caller chose the
 *    structured v1 channel; adding mentions on top would double-inject the same
 *    skills), but model enforcement still applies. We do NOT salvage a v2-shaped
 *    payload that carries stale `items` — that spawn is already invalid on v2 with or
 *    without us, and guessing the surface risks breaking v1.
 *  - Mentions already present in the message dedupe per-folder; nothing left -> no-op.
 *    Model injection is independent: an empty mention block can still yield a
 *    model-only updatedInput.
 *  - The hook NEVER denies and NEVER throws: any doubt/error -> emit "" (allow untouched).
 */
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSkillMentionBlock,
  SURFACE_SKILL,


} from "./spawn-wrapper.js";
import { resolveSpawnConfig } from "./store.js";

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

/**
 * Review-intent keywords (EN + KO) that mark an explorer-typed spawn as a reviewer
 * dispatch. Lowercase substring matching, same style as inferSurfaces. A false
 * positive only changes which configured model/skill baseline applies (low risk).
 */
const REVIEW_KEYWORDS = [
  "review",
  "audit",
  "verify",
  "verification",
  "red-team",
  "red team",
  "리뷰",
  "검증",
  "감사",
  "검토",
];

/**
 * Map the spawn's agent_type (+ message intent) back to a base RoleName.
 * explorer/reviewer both spawn as agent_type "explorer"; executor as "worker".
 * The agent_type alone cannot tell reviewer from explorer, so review-intent
 * keywords in the message upgrade the explorer surface to "reviewer" — this is
 * what lets a reviewer-specific model in .codexclaw/subagents.json take effect
 * on hook-path dispatches.
 */
export function inferRole(agentType         , message        )           {
  if (agentType === "worker") return "executor";
  const m = (message ?? "").toLowerCase();
  return REVIEW_KEYWORDS.some((k) => m.includes(k)) ? "reviewer" : "explorer";
}

/**
 * TRUE when this spawn is (or defaults to) a full-history fork, where codex-rs
 * REJECTS agent_type/model/reasoning_effort overrides outright
 * (reject_full_fork_spawn_overrides, multi_agents_common.rs:241):
 *  - v1: `fork_context: true` (missing/false -> fresh spawn, overrides fine);
 *  - v2: `fork_turns` is `Option<String>` — missing/empty/"all" -> FullHistory. Only
 *    "none" or a positive-integer STRING avoids the full fork (multi_agents_v2/spawn.rs
 *    fork_mode()). A JSON numeric `fork_turns` is already invalid upstream (wrong type),
 *    so we treat it as non-full-fork defensively — injecting into an already-rejected
 *    payload cannot make it worse, and we never turn a VALID fork into a rejected one.
 * v2 payloads are recognized by their v2-only markers (task_name / fork_turns);
 * a bare v1 payload without fork_context stays injectable.
 */
export function isFullHistoryFork(toolInput                         )          {
  if (toolInput.fork_context === true) return true;
  const isV2Shaped = "task_name" in toolInput || "fork_turns" in toolInput;
  if (!isV2Shaped) return false;
  const raw = toolInput.fork_turns;
  // Numeric is off-schema (codex expects a string); already invalid upstream -> defensive
  // non-full-fork. Only a string is a real fork_turns value.
  if (typeof raw === "number") return false;
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v.length === 0) return true; // v2 default is "all" (full history)
  if (v.toLowerCase() === "all") return true;
  return false; // "none" or an integer string -> not a full-history fork
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

    // Only rewrite a real message; never invent one (schema shape stays untouched).
    const message = toolInput.message;
    if (typeof message !== "string" || message.trim().length === 0) return "";

    const role = inferRole(toolInput.agent_type, message);

    // Skill-mention channel: skipped when the structured v1 `items` channel is already
    // chosen (E5 builder payload) — adding mentions would double-inject the same skills.
    let block = "";
    if (!("items" in toolInput)) {
      block = buildSkillMentionBlock({
        role,
        skillsDir: skillsDir(),
        surfaces: inferSurfaces(message),
        excludeFolders: [...mentionedFolders(message)],
      });
    }

    // Model/effort-enforcement channel (independent of mentions): when the role's
    // store config carries a model (model mode) or an effort override AND the caller
    // did not pick one, inject the configured value so .codexclaw/subagents.json is
    // actually honored at spawn time. Caller-picked values are NEVER overridden.
    // FULL-HISTORY FORK GUARD: codex-rs hard-rejects model/reasoning_effort overrides
    // on full-history forks (v1 fork_context:true; v2 fork_turns omitted/"all"), so
    // injection is skipped entirely there — a configured role model must never turn a
    // valid fork spawn into a rejected one.
    const cwd = typeof obj.cwd === "string" && obj.cwd.length > 0 ? obj.cwd : process.cwd();
    let injectedModel                = null;
    let injectedEffort                = null;
    if (!isFullHistoryFork(toolInput)) {
      const callerModel = toolInput.model;
      const callerPickedModel = typeof callerModel === "string" && callerModel.trim().length > 0;
      const callerEffort = toolInput.reasoning_effort;
      const callerPickedEffort = typeof callerEffort === "string" && callerEffort.trim().length > 0;
      if (!callerPickedModel || !callerPickedEffort) {
        const resolution = resolveSpawnConfig(cwd, role);
        if (!callerPickedModel && !resolution.usesMainModel && typeof resolution.model === "string" && resolution.model.length > 0) {
          injectedModel = resolution.model;
        }
        if (!callerPickedEffort && typeof resolution.effort === "string" && resolution.effort.length > 0) {
          injectedEffort = resolution.effort;
        }
      }
    }

    if (block.length === 0 && injectedModel === null && injectedEffort === null) return "";

    // Full replacement: echo every original key, change only message/model/effort.
    const updatedInput                          = { ...toolInput };
    if (block.length > 0) updatedInput.message = `${block}\n\n${message}`;
    if (injectedModel !== null) updatedInput.model = injectedModel;
    if (injectedEffort !== null) updatedInput.reasoning_effort = injectedEffort;
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
