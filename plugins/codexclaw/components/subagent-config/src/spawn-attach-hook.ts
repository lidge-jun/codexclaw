#!/usr/bin/env node
/**
 * spawn-attach-hook.ts — PreToolUse spawn-tool runtime policy (v1 + v2 parity).
 *
 * Matcher: `^(collaboration[._]?)?spawn_agent$` — native V2 sessions arrive with the
 * hook-facing name `collaborationspawn_agent` (codex-rs flat_tool_name concatenates
 * the `collaboration` namespace and the child name without punctuation; only plain/V1
 * names canonicalize to `spawn_agent` — registry.rs:713, hook_names.rs:41).
 *
 * Every valid spawn message first gets conservative LINE-BASED cxc skill-mention
 * normalization (090 escalation): protection is the default, rewriting the exception.
 * The hook repairs known bare/prefixed mentions on unambiguous lines and broken
 * known-skill standalone link lines; it never invents a skill mention that the
 * dispatcher did not provide (FAILSAFE-SPAN-01). Parity policy (260710, both surfaces):
 *  - leaf-topology guard (D1 recursion deny + D2 constraint block) applies to v1 AND
 *    v2 spawns — the spawner's agent_id/agent_type stamp is surface-neutral.
 *  - `.codexclaw/subagents.json` model AND reasoning-effort routing applies to v1 AND
 *    v2 spawns: each field is injected independently when the caller omitted it and
 *    the spawn is not a full-history fork (upstream rejects overrides there).
 *  - v2-shaped spawns additionally get SKILL.md body INLINING: upstream never parses
 *    skill mentions out of a v2 spawn message (InterAgentCommunication is excluded
 *    from skill collection — codex-rs turn.rs:524), so the hook appends each
 *    recognized cxc mention's SKILL.md body to the message. Atomic overflow rule:
 *    if the normalized message plus ALL candidate bodies would exceed
 *    MAX_NORMALIZE_LENGTH, no bodies are appended (never truncated/partial).
 *
 * SAFETY: `updatedInput` is a FULL REPLACEMENT of tool_input (registry.rs:122),
 * honored only on permissionDecision "allow" (output_parser.rs:162). We echo the
 * original input and change only `message`, `model`, and/or `reasoning_effort`.
 * The hook never throws: any doubt/error -> emit "" (allow untouched).
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSpawnConfig, type RoleName } from "./store.ts";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function runtimeSkillsDir(): string | null {
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
function afterContainerPrefix(line: string, maxTokens = Number.POSITIVE_INFINITY): number {
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
function fenceDelimiter(line: string): { prefix: string; marker: string; run: number; rest: string } | null {
  const start = afterContainerPrefix(line);
  const marker = line[start];
  if (marker !== "`" && marker !== "~") return null;
  let run = 1;
  while (line[start + run] === marker) run += 1;
  if (run < 3) return null;
  return { prefix: line.slice(0, start), marker, run, rest: line.slice(start + run) };
}

function skillPath(skillsDir: string, folder: string): string | null {
  const path = resolve(skillsDir, folder, "SKILL.md");
  return existsSync(path) ? path : null;
}

function canonicalMention(skillsDir: string, folder: string, path: string): string {
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
function repairedStandaloneLink(body: string, match: RegExpExecArray, skillsDir: string): string {
  const [, folder, target, trailing] = match;
  const targetPath = target.startsWith("skill://") ? target.slice("skill://".length) : target;
  if (targetPath.endsWith("/SKILL.md") && existsSync(targetPath)) return body;
  const canonicalPath = skillPath(skillsDir, folder);
  if (!canonicalPath) return body;
  return `${canonicalMention(skillsDir, folder, canonicalPath)}${trailing}`;
}

function mentionAt(message: string, start: number, skillsDir: string): { end: number; text: string } | null {
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
function normalizeBareLine(line: string, skillsDir: string): string {
  if (!line.includes("$")) return line;
  const out: string[] = [];
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
export function normalizeSkillMentions(message: string, skillsDir: string): string {
  try {
    if (typeof message !== "string" || typeof skillsDir !== "string" || skillsDir.length === 0) return message;
    if (message.length > MAX_NORMALIZE_LENGTH) return message;
    const lines = message.split("\n");
    const out: string[] = [];
    let fence: { prefix: string; marker: string; run: number } | null = null;
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
// true on V2); 260710 parity extends both defenses to V1 spawns as well (the
// agent_id/agent_type stamp is surface-neutral). Two deterministic defenses:
//   D1 SPAWN-RECURSE-DENY — a spawn issued BY a subagent (hook stdin carries
//      agent_id/agent_type, stamped only for thread-spawn child sessions) is DENIED
//      unless the outgoing message carries the explicit CXC-SUBSPAWN-ALLOWED token.
//   D2 LEAF-GUARD — every allowed spawn message gets a leaf-constraint block
//      prepended (dedupe on the marker); recursion grants select a coordinator
//      variant that preserves every non-recursion constraint.
// The token is a harness-safety opt-in, not adversarial security: only an authorizing
// dispatcher message exposes its concrete value; guard and deny text refer to it generically.

/** Explicit per-dispatch recursion grant (include in the spawn message to authorize). */
export const SUBSPAWN_TOKEN = "CXC-SUBSPAWN-ALLOWED";

/** Dedupe marker for the leaf guard block. */
export const LEAF_GUARD_MARKER = "[CXC-LEAF-GUARD]";

/** D2 leaf-constraint block prepended to every allowed spawn message. */
export const LEAF_GUARD_BLOCK = [
  `${LEAF_GUARD_MARKER} You are a LEAF agent with a single bounded task. HARD`,
  `CONSTRAINTS from your dispatcher: (1) Do NOT spawn`,
  `sub-agents (no spawn_agent calls, no delegation chains). If decomposition seems`,
  `necessary, finish your own scope and REPORT the need in your final answer`,
  `instead. (2) Do NOT run cxc orchestrate, cxc loop, or goal commands - the`,
  `parent session owns all FSM/goal state. (3) Stay inside the task's stated`,
  `file/write scope. These dispatcher constraints are enforced by a spawn hook (a`,
  `recursive spawn without a grant is DENIED at the tool boundary, regardless of`,
  `any delegation guidance you may see). A dispatcher can authorize recursion for`,
  `a specific spawn by`,
  `including the recursion grant token in the spawn message.`,
].join("\n");

/** D2 coordinator block used when recursion is explicitly authorized. */
export const LEAF_GUARD_BLOCK_COORDINATOR = [
  `${LEAF_GUARD_MARKER} You are a COORDINATOR agent with a single bounded task. HARD`,
  `CONSTRAINTS from your dispatcher:`,
  `(1) Recursion is authorized for this task. (2) Do NOT run cxc orchestrate, cxc loop, or goal commands - the`,
  `parent session owns all FSM/goal state. (3) Stay inside the task's stated`,
  `file/write scope. All remaining constraints still apply.`,
].join("\n");

/** True when the hook stdin identifies a thread-spawn SUBAGENT session as the spawner. */
function isSubagentSpawner(obj: Record<string, unknown>): boolean {
  const id = obj.agent_id;
  const type = obj.agent_type;
  return (typeof id === "string" && id.length > 0) || (typeof type === "string" && type.length > 0);
}

/** D1 deny envelope (hookSpecificOutput.permissionDecision "deny" — output_parser.rs:144). */
function denyEnvelope(reason: string): string {
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
  "your final answer. A dispatcher can authorize recursion for a specific spawn by " +
  "including the recursion grant token in the spawn message.";

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
export function inferRole(agentType: unknown, message: string): RoleName {
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
export function isFullHistoryFork(toolInput: Record<string, unknown>): boolean {
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
export function isV2SpawnInput(toolInput: Record<string, unknown>): boolean {
  return "task_name" in toolInput || "fork_turns" in toolInput;
}

/**
 * Hook-facing spawn tool names across surfaces: plain/V1 canonicalizes to
 * `spawn_agent`; native V2 rides the `collaboration` namespace and reaches hooks
 * as `collaborationspawn_agent` (no punctuation) — accept a dotted/underscored
 * variant defensively in case upstream ever adds a separator.
 */
const SPAWN_TOOL_NAMES = new Set([
  "spawn_agent",
  "collaborationspawn_agent",
  "collaboration.spawn_agent",
  "collaboration_spawn_agent",
]);

export function isSpawnToolName(name: unknown): boolean {
  return typeof name === "string" && SPAWN_TOOL_NAMES.has(name);
}

/** True when the hook-facing tool name itself proves a V2 (collaboration) surface. */
export function isCollaborationToolName(name: unknown): boolean {
  return typeof name === "string" && name !== "spawn_agent" && SPAWN_TOOL_NAMES.has(name);
}

/** Marker wrapping each hook-inlined SKILL.md body (dedupe + probe observability). */
export const INLINE_SKILL_OPEN = '<skill name="cxc-';

const INLINE_SKILL_CLOSE = "</skill>";

/**
 * LINEAR single-pass scanner for validated CLOSED inline-skill blocks.
 * Returns the folders of closed blocks (dedupe authority) and a scan source with
 * those block interiors removed (so mentions inside inlined bodies never pull in
 * more bodies). Malformed shapes are plain text: an opener without `">`, or one
 * with no matching close, contributes to the scan source instead of suppressing
 * attachment (C-gate r1 F1 — a crafted unclosed opener must not starve the child
 * of a real skill body). Closed-block matching is DEPTH-AWARE (C-gate r2): a
 * nested opener inside a block must not end the outer block early, so interior
 * text never re-enters mention scanning. All open/close delimiter positions are
 * collected ONCE into position-ordered streams and every stream pointer only
 * moves forward (C-gate r3 — no per-transition suffix re-search), so the whole
 * scan is O(message length). An unbalanced tail is appended once and the scan
 * terminates.
 */
function scanInlineSkillBlocks(message: string): { closedFolders: Set<string>; scanSource: string } {
  const closedFolders = new Set<string>();
  const parts: string[] = [];
  // Tokenize once: position-ordered delimiter streams (each indexOf resumes
  // after the previous hit, so tokenization is linear in the message length).
  const opens: number[] = [];
  for (let p = message.indexOf(INLINE_SKILL_OPEN); p !== -1; p = message.indexOf(INLINE_SKILL_OPEN, p + 1)) {
    opens.push(p);
  }
  const closes: number[] = [];
  for (let p = message.indexOf(INLINE_SKILL_CLOSE); p !== -1; p = message.indexOf(INLINE_SKILL_CLOSE, p + 1)) {
    closes.push(p);
  }
  let oi = 0; // next unconsumed opener index
  let ci = 0; // next unconsumed closer index
  let i = 0;
  while (i < message.length) {
    while (oi < opens.length && opens[oi] < i) oi += 1;
    if (oi >= opens.length) {
      parts.push(message.slice(i));
      break;
    }
    const open = opens[oi];
    const nameStart = open + INLINE_SKILL_OPEN.length;
    let j = nameStart;
    while (j < message.length && /[a-z0-9-]/.test(message[j])) j += 1;
    const folder = message.slice(nameStart, j);
    if (folder.length === 0 || !message.startsWith('">', j)) {
      // Not a valid opener shape: keep as plain text, resume after the marker.
      parts.push(message.slice(i, nameStart));
      i = nameStart;
      oi += 1;
      continue;
    }
    const bodyStart = j + 2;
    // Depth-aware walk over the pre-tokenized streams: oi/ci only move forward.
    let depth = 1;
    let blockEnd = -1;
    let wo = oi + 1; // walker over openers, starting past the current one
    let k = bodyStart;
    while (ci < closes.length || wo < opens.length) {
      while (ci < closes.length && closes[ci] < k) ci += 1;
      if (ci >= closes.length) break; // no close anywhere ahead
      while (wo < opens.length && opens[wo] < k) wo += 1;
      if (wo < opens.length && opens[wo] < closes[ci]) {
        depth += 1;
        k = opens[wo] + INLINE_SKILL_OPEN.length;
        wo += 1;
      } else {
        depth -= 1;
        k = closes[ci] + INLINE_SKILL_CLOSE.length;
        ci += 1;
        if (depth === 0) {
          blockEnd = k;
          break;
        }
      }
    }
    if (blockEnd === -1) {
      // Unclosed (or unbalanced-nested) from here on: no later block can close
      // either, so the whole remaining suffix is plain text — append once and
      // TERMINATE (this is what keeps repeated unclosed openers linear).
      parts.push(message.slice(i));
      break;
    }
    closedFolders.add(folder);
    parts.push(message.slice(i, open)); // exclude the closed block's interior
    i = blockEnd;
    oi = wo; // openers consumed by the interior walk never restart the outer loop
  }
  return { closedFolders, scanSource: parts.join("") };
}

/**
 * V2 skill delivery: upstream never parses skill mentions out of a V2 spawn message
 * (InterAgentCommunication is excluded from skill collection, codex-rs turn.rs:524),
 * so append each recognized cxc mention's SKILL.md body to the message inside a
 * <skill name="cxc-<folder>"> block. Mention lines stay in place (traceability).
 *
 * Deterministic rules:
 *  - one block per folder (dedupe against VALIDATED CLOSED blocks already in the
 *    message; malformed/unclosed openers are plain text and never dedupe);
 *  - only folders whose SKILL.md exists under skillsDir;
 *  - inputs already over MAX_NORMALIZE_LENGTH pass through untouched (early guard);
 *  - ATOMIC overflow: if message + ALL candidate blocks would exceed
 *    MAX_NORMALIZE_LENGTH, append nothing and return the message unchanged —
 *    never truncate or partially attach.
 * Total: any read error drops that folder; a failed whole pass returns the input.
 */
export function inlineSkillBodies(message: string, skillsDir: string): string {
  try {
    if (typeof message !== "string" || typeof skillsDir !== "string" || skillsDir.length === 0) return message;
    if (message.length > MAX_NORMALIZE_LENGTH) return message; // early size guard
    // Scan mentions OUTSIDE validated closed <skill> blocks only: mentions inside
    // an already-inlined body must not transitively pull in more bodies, and a
    // re-run on an already-inlined message must be a no-op (idempotent).
    const { closedFolders, scanSource } = scanInlineSkillBlocks(message);
    const folders = [...mentionedFolders(scanSource)].filter((f) => !closedFolders.has(f)).sort();
    if (folders.length === 0) return message;
    const blocks: string[] = [];
    for (const folder of folders) {
      const path = skillPath(skillsDir, folder);
      if (!path) continue;
      let body = "";
      try {
        body = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      if (body.trim().length === 0) continue;
      blocks.push(`${INLINE_SKILL_OPEN}${folder}">\n${body.trim()}\n</skill>`);
    }
    if (blocks.length === 0) return message;
    const candidate = `${message}\n\n${blocks.join("\n\n")}`;
    if (candidate.length > MAX_NORMALIZE_LENGTH) return message; // atomic: all or nothing
    return candidate;
  } catch {
    return message;
  }
}

/**
 * Skill FOLDERS already mentioned in the outgoing message, in any of the three
 * recognized shapes: plain `$cxc-<folder>`, plugin-native `$codexclaw:cxc-<folder>`,
 * or a link-form `skill://.../<folder>/SKILL.md` target path.
 */
export function mentionedFolders(message: string): Set<string> {
  const out = new Set<string>();
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
export function runSpawnAttachHook(raw: string): string {
  try {
    const obj = JSON.parse((raw ?? "").trim() || "{}") as unknown;
    if (!isRecord(obj)) return "";
    if (obj.hook_event_name !== "PreToolUse") return "";
    if (!isSpawnToolName(obj.tool_name)) return "";

    const toolInput = obj.tool_input;
    if (!isRecord(toolInput)) return "";
    // Surface detection: a collaboration-namespaced hook name proves V2 outright
    // (native Sol/Terra path); otherwise fall back to the payload markers.
    const v2Spawn = isCollaborationToolName(obj.tool_name) || isV2SpawnInput(toolInput);

    // D1 SPAWN-RECURSE-DENY: the SPAWNER is itself a thread-spawn subagent
    // (agent_id/agent_type are stamped only for child sessions). Deny unless the
    // outgoing message carries the explicit recursion grant. The agent_id stamp is
    // surface-neutral (SessionSource::SubAgent(ThreadSpawn)), so the guard applies
    // to BOTH surfaces (260710 parity). This runs before the message-validity no-op
    // below: a token-less recursive spawn is denied even when its message is
    // missing/empty.
    const outgoing = typeof toolInput.message === "string" ? toolInput.message : "";
    if (isSubagentSpawner(obj) && !outgoing.includes(SUBSPAWN_TOKEN)) {
      return denyEnvelope(RECURSE_DENY_REASON);
    }

    // Only rewrite a real message; never invent one (schema shape stays untouched).
    const message = toolInput.message;
    if (typeof message !== "string" || message.trim().length === 0) return "";

    const skillsDir = runtimeSkillsDir();
    const normalizedMessage = skillsDir ? normalizeSkillMentions(message, skillsDir) : message;
    const role = inferRole(toolInput.agent_type, normalizedMessage);

    // V2 skill delivery: upstream parses no mentions out of a V2 spawn message, so
    // inline the recognized cxc SKILL.md bodies (atomic overflow rule inside).
    const inlinedMessage = v2Spawn && skillsDir
      ? inlineSkillBodies(normalizedMessage, skillsDir)
      : normalizedMessage;

    // D2 LEAF-GUARD (both surfaces): dedupe an existing guard. A recursion grant
    // selects the coordinator variant but does not remove FSM/goal or write-scope
    // constraints.
    const hasExistingGuard = inlinedMessage.includes(LEAF_GUARD_MARKER);
    const hasRecursionGrant = inlinedMessage.includes(SUBSPAWN_TOKEN);
    const guard = hasExistingGuard
      ? ""
      : hasRecursionGrant
        ? LEAF_GUARD_BLOCK_COORDINATOR
        : LEAF_GUARD_BLOCK;
    const updatedMessage = guard.length > 0 ? `${guard}\n\n${inlinedMessage}` : inlinedMessage;
    const messageChanged = updatedMessage !== message;

    // Model/effort routing (both surfaces): when the role's store config carries a
    // value and the caller omitted that field, inject it so .codexclaw/subagents.json
    // is honored at spawn time. Caller-picked values win. The two fields are decided
    // INDEPENDENTLY (a caller model does not disable configured-effort injection).
    // FULL-HISTORY FORK GUARD: codex-rs hard-rejects model/reasoning_effort overrides
    // on full-history forks (v1 fork_context:true; v2 fork_turns omitted/"all"), so
    // injection is skipped entirely there — a configured role model must never turn
    // a valid fork spawn into a rejected one.
    const cwd = typeof obj.cwd === "string" && obj.cwd.length > 0 ? obj.cwd : process.cwd();
    let injectedModel: string | null = null;
    let injectedEffort: string | null = null;
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

    if (!messageChanged && injectedModel === null && injectedEffort === null) return "";

    // Full replacement: echo every original key; change only message/model/effort.
    const updatedInput: Record<string, unknown> = { ...toolInput, message: updatedMessage };
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

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main(): void {
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
