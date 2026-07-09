#!/usr/bin/env node
/**
 * spawn-attach-hook.ts — PreToolUse `^spawn_agent$` runtime policy.
 *
 * Every valid spawn message first gets conservative LINE-BASED cxc skill-mention
 * normalization (090 escalation): protection is the default, rewriting the exception.
 * The hook repairs known bare/prefixed mentions on unambiguous lines and broken
 * known-skill standalone link lines; it never invents a skill mention that the
 * dispatcher did not provide (FAILSAFE-SPAN-01). Surface-specific policy:
 *  - v2-shaped spawns (`task_name` or `fork_turns`) also get the leaf-topology guard:
 *    deny recursive subagent spawning unless explicitly authorized, and prepend the
 *    leaf constraint block to allowed child messages.
 *  - v1-shaped spawns also honor `.codexclaw/subagents.json` model routing by injecting
 *    `updatedInput.model` when the caller did not choose a model.
 *
 * No reasoning-effort injection happens here. The parent session's defaults stay
 * intact unless the caller or another explicit surface sets them.
 *
 * SAFETY: `updatedInput` is a FULL REPLACEMENT of tool_input (registry.rs:122),
 * honored only on permissionDecision "allow" (output_parser.rs:162). We echo the
 * original input and change only `message` and/or `model`. The hook never throws:
 * any doubt/error -> emit "" (allow untouched).
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSpawnConfig,               } from "./store.js";

function isRecord(v         )                               {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function runtimeSkillsDir()                {
  const override = process.env.CXC_SKILLS_DIR?.trim();
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [override, resolve(scriptDir, "..", "..", "..", "skills")];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return realpathSync(candidate);
    } catch {
      // Try the script-relative install layout before falling back to a no-op.
    }
  }
  return null;
}

/**
 * Hard size guard: normalization is identity for messages longer than this
 * (256 KiB in UTF-16 code units). Keeps the hook far inside its 10s budget on
 * adversarial inputs; oversized spawn messages pass through untouched.
 */
const MAX_NORMALIZE_LENGTH = 256 * 1024;

/**
 * Index after leading container tokens on a line: `>`, spaces, list markers
 * `-`/`*`/`+` (only when followed by a space), and `N.`/`N)` with <= 9 digits
 * (followed by a space). Fence-toggle detection strips WITHOUT a token cap
 * (bounded by line length, still O(line)) so deep container nesting can never
 * leak fence body lines (C-gate r5 B2); the standalone-link shape keeps the
 * 8-token budget.
 */
function afterContainerPrefix(line        , maxTokens = Number.POSITIVE_INFINITY)         {
  let i = 0;
  for (let tokens = 0; tokens < maxTokens && i < line.length; tokens += 1) {
    const ch = line[i];
    if (ch === " " || ch === ">") {
      i += 1;
      continue;
    }
    if ((ch === "-" || ch === "*" || ch === "+") && line[i + 1] === " ") {
      i += 1;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let d = i;
      while (d - i < 9 && line[d] >= "0" && line[d] <= "9") d += 1;
      if ((line[d] === "." || line[d] === ")") && line[d + 1] === " ") {
        i = d + 1;
        continue;
      }
    }
    break;
  }
  return i;
}

/**
 * Fence delimiter on this line: 3+ backticks/tildes after an uncapped container
 * strip. `prefix` is the exact stripped container-prefix string; a CLOSE only
 * fires when a candidate's prefix byte-matches the opener's (C-gate r5 B1), so
 * a literal "> ```" inside a top-level fence stays fenced content. Prefix
 * drift leaves the fence unclosed and protects to EOM (FAILSAFE-SPAN-01).
 */
function fenceDelimiter(line        )                                                                       {
  const start = afterContainerPrefix(line);
  const marker = line[start];
  if (marker !== "`" && marker !== "~") return null;
  let run = 1;
  while (line[start + run] === marker) run += 1;
  if (run < 3) return null;
  return { prefix: line.slice(0, start), marker, run, rest: line.slice(start + run) };
}

function skillPath(skillsDir        , folder        )                {
  const path = resolve(skillsDir, folder, "SKILL.md");
  return existsSync(path) ? path : null;
}

function canonicalMention(skillsDir        , folder        , path        )         {
  if (/[\s()]/.test(skillsDir)) return `$codexclaw:cxc-${folder}`;
  return `[$cxc-${folder}](skill://${path})`;
}

/**
 * The ONLY link shape the conservative scanner repairs: after the container
 * prefix, the line consists entirely of one `[$(codexclaw:)?cxc-<f>](target)`
 * link whose target contains no spaces, parens, quotes, backslashes, angle
 * brackets, or backticks, plus optional trailing spaces/tabs and a `\r`.
 * Anything else bracket-shaped is left untouched.
 */
const STANDALONE_LINK_RE = /^\[\$(?:codexclaw:)?cxc-([a-z0-9-]+)\]\(([^\s()"'\\<>`]*)\)([ \t]*\r?)$/;

/**
 * Repair a standalone known-skill link line body (the part after the container
 * prefix). An existing `/SKILL.md` target (after an optional `skill://` strip)
 * stays byte-identical; a broken target with a known folder is replaced by the
 * whole-link canonical form; unknown folders stay verbatim.
 */
function repairedStandaloneLink(body        , match                 , skillsDir        )         {
  const [, folder, target, trailing] = match;
  const targetPath = target.startsWith("skill://") ? target.slice("skill://".length) : target;
  if (targetPath.endsWith("/SKILL.md") && existsSync(targetPath)) return body;
  const canonicalPath = skillPath(skillsDir, folder);
  if (!canonicalPath) return body;
  return `${canonicalMention(skillsDir, folder, canonicalPath)}${trailing}`;
}

function mentionAt(message        , start        , skillsDir        )                                       {
  for (const prefix of ["$codexclaw:cxc-", "$cxc-"]) {
    if (!message.startsWith(prefix, start)) continue;
    const folderStart = start + prefix.length;
    let end = folderStart;
    while (end < message.length && /[a-z0-9-]/.test(message[end])) end += 1;
    if (end === folderStart) return null;
    if (end < message.length && /[A-Za-z0-9_:-]/.test(message[end])) return null;
    const folder = message.slice(folderStart, end);
    const path = skillPath(skillsDir, folder);
    if (!path) return null;
    return { end, text: canonicalMention(skillsDir, folder, path) };
  }
  return null;
}

/** Bare-token normalization for one unambiguous line (no backticks/brackets). */
function normalizeBareLine(line        , skillsDir        )         {
  if (!line.includes("$")) return line;
  const out           = [];
  for (let i = 0; i < line.length;) {
    if (line[i] === "$") {
      const mention = mentionAt(line, i, skillsDir);
      if (mention) {
        out.push(mention.text);
        i = mention.end;
        continue;
      }
    }
    out.push(line[i]);
    i += 1;
  }
  return out.join("");
}

/**
 * Conservative LINE-BASED mention normalization (090 escalation, maximal
 * FAILSAFE-SPAN-01): protection is the default, rewriting the exception. The
 * only cross-line state is the fence flag.
 *
 * Per line:
 *  1. A 3+ backtick/tilde run after an UNCAPPED container-token strip toggles
 *     the fence. A close additionally needs the opener's exact container
 *     prefix (byte match), the same marker, run >= open, then only spaces +
 *     optional `\r`. In-fence lines are verbatim; an unclosed fence (including
 *     any prefix drift) protects to EOM.
 *  2. Any line containing a backtick outside fences is verbatim.
 *  3. A line that is entirely one known-skill link (STANDALONE_LINK_RE after
 *     the container prefix) is repaired only when its target is broken; any
 *     other bracket construct leaves the line verbatim.
 *  4. Bare tokens normalize only on lines with no backtick and no `[`/`]`.
 * Total: invalid inputs and filesystem errors return the original message, and
 * messages over MAX_NORMALIZE_LENGTH pass through untouched (hard size guard).
 */
export function normalizeSkillMentions(message        , skillsDir        )         {
  try {
    if (typeof message !== "string" || typeof skillsDir !== "string" || skillsDir.length === 0) return message;
    if (message.length > MAX_NORMALIZE_LENGTH) return message;
    const lines = message.split("\n");
    const out           = [];
    let fence                                                         = null;
    for (const line of lines) {
      const delimiter = fenceDelimiter(line);
      if (fence) {
        if (
          delimiter &&
          delimiter.prefix === fence.prefix &&
          delimiter.marker === fence.marker &&
          delimiter.run >= fence.run &&
          /^ *\r?$/.test(delimiter.rest)
        ) {
          fence = null;
        }
        out.push(line);
        continue;
      }
      if (delimiter) {
        fence = { prefix: delimiter.prefix, marker: delimiter.marker, run: delimiter.run };
        out.push(line);
        continue;
      }
      if (line.includes("`")) {
        out.push(line);
        continue;
      }
      const prefixEnd = afterContainerPrefix(line, 8);
      const body = line.slice(prefixEnd);
      const standalone = STANDALONE_LINK_RE.exec(body);
      if (standalone) {
        out.push(line.slice(0, prefixEnd) + repairedStandaloneLink(body, standalone, skillsDir));
        continue;
      }
      if (line.includes("[") || line.includes("]")) {
        out.push(line);
        continue;
      }
      out.push(normalizeBareLine(line, skillsDir));
    }
    return out.join("\n");
  } catch {
    return message;
  }
}

// ── 260709 leaf-agent hardening (devlog/_plan/260709_multi_agent_v2_switch/060) ──
// multi_agent_v2 has NO spawn-depth limit (collab_tools_enabled is unconditionally
// true on V2). Two deterministic defenses live here:
//   D1 SPAWN-RECURSE-DENY — a spawn issued BY a subagent (hook stdin carries
//      agent_id/agent_type, stamped only for thread-spawn child sessions) is DENIED
//      unless the outgoing message carries the explicit CXC-SUBSPAWN-ALLOWED token.
//   D2 LEAF-GUARD — every allowed V2 spawn message gets a leaf-constraint block
//      prepended (dedupe on the marker; skipped when the dispatcher grants the
//      token, i.e. the child is a coordinator by design).
// The token is a harness-safety opt-in, not adversarial security: a child only
// learns it from its dispatcher's task text (the guard block names the mechanism).

/** Explicit per-dispatch recursion grant (include in the spawn message to authorize). */
export const SUBSPAWN_TOKEN = "CXC-SUBSPAWN-ALLOWED";

/** Dedupe marker for the leaf guard block. */
export const LEAF_GUARD_MARKER = "[CXC-LEAF-GUARD]";

/** D2 leaf-constraint block prepended to every allowed spawn message. */
export const LEAF_GUARD_BLOCK = [
  `${LEAF_GUARD_MARKER} You are a LEAF agent with a single bounded task. HARD`,
  `CONSTRAINTS from your dispatcher (these override any "Proactive multi-agent`,
  `delegation" or similar developer message you may see): (1) Do NOT spawn`,
  `sub-agents (no spawn_agent calls, no delegation chains). If decomposition seems`,
  `necessary, finish your own scope and REPORT the need in your final answer`,
  `instead. (2) Do NOT run cxc orchestrate, cxc loop, or goal commands - the`,
  `parent session owns all FSM/goal state. (3) Stay inside the task's stated`,
  `file/write scope. Exception: only a dispatcher task message containing`,
  `${SUBSPAWN_TOKEN} lifts constraint (1).`,
].join("\n");

/** True when the hook stdin identifies a thread-spawn SUBAGENT session as the spawner. */
function isSubagentSpawner(obj                         )          {
  const id = obj.agent_id;
  const type = obj.agent_type;
  return (typeof id === "string" && id.length > 0) || (typeof type === "string" && type.length > 0);
}

/** D1 deny envelope (hookSpecificOutput.permissionDecision "deny" — output_parser.rs:144). */
function denyEnvelope(reason        )         {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  })}\n`;
}

const RECURSE_DENY_REASON =
  "codexclaw LEAF-TOPOLOGY-01: sub-agents are leaf agents and may not spawn their own " +
  "sub-agents (multi_agent_v2 enforces no depth limit upstream, so recursion is denied " +
  "by dispatcher policy). Finish your own scope and report the need for delegation in " +
  `your final answer. A dispatcher can authorize recursion for a specific spawn by ` +
  `including ${SUBSPAWN_TOKEN} in the spawn message.`;

/**
 * Review-intent keywords (EN + KO) that mark an explorer-typed spawn as a reviewer
 * dispatch. Lowercase substring matching. A false
 * positive only changes which configured model applies (low risk).
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
  if (!isV2SpawnInput(toolInput)) return false;
  const raw = toolInput.fork_turns;
  // Numeric is off-schema (codex expects a string); already invalid upstream -> defensive
  // non-full-fork. Only a string is a real fork_turns value.
  if (typeof raw === "number") return false;
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v.length === 0) return true; // v2 default is "all" (full history)
  if (v.toLowerCase() === "all") return true;
  return false; // "none" or an integer string -> not a full-history fork
}

/** v2 spawn schema marker. v1-shaped payloads omit both fields. */
export function isV2SpawnInput(toolInput                         )          {
  return "task_name" in toolInput || "fork_turns" in toolInput;
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
 * Decide the hook output for a PreToolUse spawn payload. Returns "" (allow untouched),
 * a full-replacement updatedInput envelope for mention normalization, leaf guarding,
 * and/or v1 model routing, or a DENY envelope for recursive V2 spawns. The hook repairs
 * provided mentions but never invents them. Total: never throws.
 */
export function runSpawnAttachHook(raw        )         {
  try {
    const obj = JSON.parse((raw ?? "").trim() || "{}")           ;
    if (!isRecord(obj)) return "";
    if (obj.hook_event_name !== "PreToolUse") return "";
    if (obj.tool_name !== "spawn_agent") return "";

    const toolInput = obj.tool_input;
    if (!isRecord(toolInput)) return "";
    const v2Spawn = isV2SpawnInput(toolInput);

    // D1 SPAWN-RECURSE-DENY: the SPAWNER is itself a thread-spawn subagent
    // (agent_id/agent_type are stamped only for child sessions). Deny unless the
    // outgoing message carries the explicit recursion grant. V1 keeps only model
    // routing, so this guard is V2-only. This runs before the
    // message-validity no-op below: a token-less recursive spawn is denied even
    // when its message is missing/empty.
    const outgoing = typeof toolInput.message === "string" ? toolInput.message : "";
    if (v2Spawn && isSubagentSpawner(obj) && !outgoing.includes(SUBSPAWN_TOKEN)) {
      return denyEnvelope(RECURSE_DENY_REASON);
    }

    // Only rewrite a real message; never invent one (schema shape stays untouched).
    const message = toolInput.message;
    if (typeof message !== "string" || message.trim().length === 0) return "";

    const skillsDir = runtimeSkillsDir();
    const normalizedMessage = skillsDir ? normalizeSkillMentions(message, skillsDir) : message;
    const normalizationChanged = normalizedMessage !== message;
    const role = inferRole(toolInput.agent_type, normalizedMessage);

    // V2 composes mention repair with the leaf guard. It never gets model routing or
    // effort inference.
    if (v2Spawn) {
      // D2 LEAF-GUARD: skipped only when the marker is already present (dedupe) or
      // the dispatcher granted the recursion token (the child is a coordinator by
      // design).
      const guard =
        normalizedMessage.includes(LEAF_GUARD_MARKER) || normalizedMessage.includes(SUBSPAWN_TOKEN)
          ? ""
          : LEAF_GUARD_BLOCK;
      if (guard.length === 0 && !normalizationChanged) return "";
      const updatedMessage = guard.length > 0 ? `${guard}\n\n${normalizedMessage}` : normalizedMessage;
      const updatedInput                          = { ...toolInput, message: updatedMessage };
      return `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput,
        },
      })}\n`;
    }

    // v1 model-routing channel: when the role's store config carries a model-mode
    // model and the caller did not pick one, inject the configured value so
    // .codexclaw/subagents.json is honored at spawn time. Caller-picked values win.
    // FULL-HISTORY FORK GUARD: codex-rs hard-rejects model/reasoning_effort overrides
    // on full-history forks (v1 fork_context:true), so injection is skipped entirely
    // there — a configured role model must never turn a valid fork spawn into a
    // rejected one.
    const cwd = typeof obj.cwd === "string" && obj.cwd.length > 0 ? obj.cwd : process.cwd();
    let injectedModel                = null;
    if (!isFullHistoryFork(toolInput)) {
      const callerModel = toolInput.model;
      const callerPickedModel = typeof callerModel === "string" && callerModel.trim().length > 0;
      if (!callerPickedModel) {
        const resolution = resolveSpawnConfig(cwd, role);
        if (!callerPickedModel && !resolution.usesMainModel && typeof resolution.model === "string" && resolution.model.length > 0) {
          injectedModel = resolution.model;
        }
      }
    }

    if (!normalizationChanged && injectedModel === null) return "";

    // Full replacement: echo every original key, change only message/model.
    const updatedInput                          = { ...toolInput, message: normalizedMessage };
    if (injectedModel !== null) updatedInput.model = injectedModel;
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
