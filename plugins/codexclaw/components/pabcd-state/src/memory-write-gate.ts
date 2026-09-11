/**
 * memory-write-gate.ts — MEMORY-WRITE-GATE-01 (260909 wp1-A).
 *
 * PreToolUse guard over the memory WRITE surface: a note only lands in
 * ~/.codex/memories when this session can point at an explicit user request for
 * it. `memories.add_ad_hoc_note` creates
 * `~/.codex/memories/extensions/ad_hoc/notes/<filename>` with create_new(true)
 * (codex-rs ext/memories/src/local/ad_hoc_note.rs:12,28-38), so the risk this
 * closes is an UNWANTED NEW NOTE, not damage to an existing one. That file
 * outlives codexclaw, which is exactly the "user keeps carrying the result"
 * property config-guard/src/managed-keys.ts:20-24 refuses to auto-enable
 * without a gate — and its caution text (:44-47) names this gate as the
 * precondition.
 *
 * Two write surfaces, one policy:
 *  1. the memory tool itself, hook-facing name `memoriesadd_ad_hoc_note`;
 *  2. an ordinary file edit (apply_patch/Write/Edit) or shell command whose
 *     destination is under ~/.codex/memories.
 * Surface 2 matters because the tool is only one route to the same bytes.
 *
 * Tool name (T2): codex-rs flat_tool_name concatenates namespace + name with NO
 * separator (core/src/tools/mod.rs:40-54), `memories` is not a default
 * namespace (protocol/src/tool_name.rs:46-51), and ExtensionToolAdapter does not
 * override pre_tool_use_payload — so registry.rs:129-139 -> :801-808 flattens it
 * to `memoriesadd_ad_hoc_note`. The same repo already handles this for
 * `collaborationspawn_agent` (subagent-config/src/spawn-attach-hook.ts:5-8) and
 * accepts punctuated variants defensively; this file does the same, so a future
 * upstream separator cannot silently reopen the surface.
 *
 * Authorization, checked in order — the first hit allows:
 *  1. a CLI grant (`cxc memory allow-write --session <id>`), consumed on use;
 *  2. the session marker set when UserPromptSubmit saw a remember idiom
 *     (state.memoryWriteRequested, hook.ts/detectMemoryWriteRequest), consumed
 *     per turn so one "기억해" does not authorize a session's worth of writes.
 * Neither present -> deny, naming both remedies.
 *
 * FAIL-OPEN, deliberately. A crash here costs one unwanted note; fail-closed
 * would let a hook bug permanently block a write the user explicitly asked for.
 * The judgement is a heuristic (idiom regexes cannot read intent), and a
 * fail-closed heuristic turns every false negative into lost functionality —
 * the same reasoning comment-lint.ts:9-11 records for the edit lint.
 *
 * Envelope: exit 0 + stdout JSON, deny only (goal-gate.ts:116-124 shape).
 * Wire schema is camelCase + deny_unknown_fields (codex-rs hooks/src/schema.rs:243-256).
 * A pass is the empty string. Non-deny decisions are invisible to the model
 * except through additionalContext (idle-edit.ts:10-12), so this gate stays
 * silent when it allows.
 */
import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { readState, writeState } from "./state.ts";
import { splitLines } from "./text-lines.ts";
import { shellWriteDestinations } from "./shell-write-destinations.ts";

export { shellWriteDestinations } from "./shell-write-destinations.ts";

/**
 * Hook-facing names for the memory write tool. `memoriesadd_ad_hoc_note` is what
 * flat_tool_name produces today; the punctuated forms are defensive (precedent:
 * spawn-attach-hook.ts:483-488).
 */
export const MEMORY_WRITE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "memoriesadd_ad_hoc_note",
  "memories.add_ad_hoc_note",
  "memories_add_ad_hoc_note",
  "add_ad_hoc_note",
]);

/** Edit tools that can write a memory file directly (idle-edit.ts:44 set + Bash). */
const EDIT_TOOLS: ReadonlySet<string> = new Set(["apply_patch", "Write", "Edit"]);
const SHELL_TOOLS: ReadonlySet<string> = new Set(["Bash", "shell", "exec_command", "local_shell"]);

/**
 * Remember idioms, Korean and English. Curated like recall/src/hook.ts:61-77:
 * each pattern needs a memory NOUN or an unambiguous verb phrase, because a bare
 * "기억" ("기억 안 나") is a recall question, not a write request.
 */
export const MEMORY_WRITE_PATTERNS: readonly RegExp[] = [
  /기억\s*(해둬|해 둬|해줘|해라|하자|해$|해[.!,]|해서\s*(둬|놔))/,
  /(기억|메모)\s*(에|해서)?\s*(남겨|남겨둬|적어|적어둬|저장|기록)/,
  /메모리\s*(에|에다)?\s*(남겨|기록|추가|저장|적어|넣어|써)/,
  /(노트|메모)\s*(로|를|에)?\s*(남겨|남겨둬|추가|저장|기록)/,
  /잊지\s*(말고|마|마라|말아)/,
  /\bremember\s+(this|that|it|these)\b/i,
  // The destination preposition is REQUIRED. Without it this matched ordinary
  // engineering prose — "Do not modify src/store.mjs or test/notes.test.mjs" reads as
  // store...notes and armed the gate on a prompt about files (pabcd-state
  // hook.test.ts:194 neutral control).
  /\b(add|save|write|store|put|record)\b[^.\n]{0,24}\bto\s+(your\s+|the\s+|my\s+)?(memory|memories)\b/i,
  /\bnote\s+(this|that|it)\s+down\b/i,
  /\bmake\s+a\s+note\b/i,
  /\bkeep\s+(this|that|it)\s+in\s+mind\b/i,
  /\bdon'?t\s+forget\b/i,
];

/**
 * True when the prompt explicitly asks for something to be remembered. HEURISTIC:
 * misses cost a deny the user can undo with the CLI grant; false positives only
 * ever authorize the write the user just asked for.
 */
export function detectMemoryWriteRequest(prompt: string): boolean {
  const p = prompt ?? "";
  if (p.trim() === "") return false;
  return MEMORY_WRITE_PATTERNS.some((re) => re.test(p));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The memories root this gate protects: $CODEX_HOME/memories, else ~/.codex/memories. */
export function memoriesRoot(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.CODEX_HOME && env.CODEX_HOME.trim() !== "" ? env.CODEX_HOME.trim() : join(homedir(), ".codex");
  return resolve(join(home, "memories"));
}

/**
 * True when `candidate` names the memories root or something inside it. Compares on
 * a separator boundary so a sibling like `memories-backup` does not match (the same
 * prefix-confusion recall/src/index-search.ts guards against for cwd filtering).
 */
export function isMemoryPath(candidate: string, root: string): boolean {
  if (candidate === "") return false;
  const abs = isAbsolute(candidate) ? resolve(candidate) : resolve(normalize(candidate));
  return abs === root || abs.startsWith(root + sep);
}

/**
 * Expand a possibly `~`-prefixed, possibly relative path against cwd. Shell text and
 * patch headers both carry these forms, and a tilde path that stayed literal would
 * read as relative and escape the check.
 */
function absolutize(raw: string, cwd: string): string {
  let value = raw.trim().replace(/^["']|["']$/g, "");
  if (value === "") return "";
  if (value === "~" || value.startsWith("~/")) value = join(homedir(), value.slice(1));
  if (isAbsolute(value)) return resolve(value);
  return cwd === "" ? "" : resolve(cwd, value);
}

/**
 * Destination paths named by an apply_patch envelope. The patch grammar puts them on
 * `*** Add/Update/Delete File:` directives and on `+++ b/<path>` unified headers.
 */
export function patchTargets(patchText: string): string[] {
  const out: string[] = [];
  for (const line of splitLines(patchText)) {
    const directive = /^\*\*\* (?:Add|Update|Delete|Move) File: (.+)$/.exec(line.trim());
    if (directive) {
      out.push(directive[1].trim());
      continue;
    }
    const unified = /^\+\+\+ (?:b\/)?(.+)$/.exec(line);
    if (unified) out.push(unified[1].trim());
  }
  return out;
}

export interface MemoryWriteAttempt {
  /** Why this call counts as a memory write; "" when it does not. */
  surface: "tool" | "edit" | "shell" | "";
  /** The destination that triggered the judgement, for the deny reason. */
  target: string;
}

/**
 * Classify a PreToolUse call as a memory write or not. Pure: no IO, no state.
 */
export function classifyMemoryWrite(
  toolName: string,
  toolInput: unknown,
  cwd: string,
  root: string,
): MemoryWriteAttempt {
  if (MEMORY_WRITE_TOOL_NAMES.has(toolName)) {
    // registry.rs:810-816: empty args normalize to {}, and UNPARSEABLE args arrive as a
    // bare JSON string — so tool_input is not necessarily an object.
    const filename = isRecord(toolInput) && typeof toolInput.filename === "string" ? toolInput.filename : "";
    return { surface: "tool", target: filename === "" ? "(ad hoc note)" : filename };
  }
  if (!isRecord(toolInput)) return { surface: "", target: "" };

  if (EDIT_TOOLS.has(toolName)) {
    const command = typeof toolInput.command === "string" ? toolInput.command : "";
    const direct = typeof toolInput.file_path === "string" ? toolInput.file_path : "";
    const candidates = direct === "" ? patchTargets(command) : [direct];
    for (const candidate of candidates) {
      const abs = absolutize(candidate, cwd);
      if (isMemoryPath(abs, root)) return { surface: "edit", target: abs };
    }
    return { surface: "", target: "" };
  }

  if (SHELL_TOOLS.has(toolName)) {
    const command = typeof toolInput.command === "string" ? toolInput.command : "";
    if (command === "") return { surface: "", target: "" };
    // Classify by WRITE DESTINATION (260910 wp1). A memories path that appears only
    // as a read operand, inside quotes, or in a heredoc body is not a write, so
    // `sed -n`, `rg ... 2>/dev/null` and a devlog heredoc whose body mentions the
    // memories root stay free. Redirections, `tee`, `sed -i`, `cp`/`mv` targets and
    // `perl -i`/`ruby -i` operands are the write surface.
    for (const token of shellWriteDestinations(command)) {
      const abs = absolutize(token, cwd);
      if (isMemoryPath(abs, root)) return { surface: "shell", target: abs };
    }
  }
  return { surface: "", target: "" };
}

export function denyReason(attempt: MemoryWriteAttempt, sessionId: string): string {
  const what =
    attempt.surface === "tool"
      ? `a memory note (${attempt.target})`
      : `a file under the Codex memories directory (${attempt.target})`;
  return [
    `[codexclaw MEMORY-WRITE-GATE] Blocked a write of ${what}: this session has no explicit user request to remember anything.`,
    "Memory notes outlive codexclaw and reach every later session, so they are written only when the user asks.",
    "Two ways forward: ask the user to confirm they want this remembered (a prompt such as \"기억해둬\" or \"remember this\" authorizes the next write),",
    `or record an explicit grant with \`cxc memory allow-write --session ${sessionId || "<id>"}\`.`,
    "If the user did ask, say so and retry — the request must appear in their own message, not in yours.",
  ].join(" ");
}

function denyEnvelope(reason: string): string {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      additionalContext: reason,
    },
  })}\n`;
}

/**
 * Consume one authorization if this session holds one. Returns true when the write is
 * allowed. Consumption keeps the marker meaningful: a single "기억해" authorizes the
 * turn that asked, not the rest of the session.
 *
 * The consumption unit is (session, turn). Per-filename would deny the ordinary retry
 * of one note under a new name; per-session would never expire. A turnless payload
 * consumes the marker outright, which is the conservative reading.
 */
function consumeAuthorization(cwd: string, sessionId: string, turnId: string): boolean {
  const state = readState(cwd, sessionId);
  if (state.memoryWriteGrant) {
    // A CLI grant is operator-issued and outranks the idiom marker; spend it first.
    try {
      writeState(cwd, { ...state, memoryWriteGrant: false, memoryWriteTurn: null });
    } catch {
      // A grant that cannot be cleared still authorized THIS call; allowing is correct.
    }
    return true;
  }
  if (!state.memoryWriteRequested) return false;
  if (turnId !== "" && state.memoryWriteTurn !== null && state.memoryWriteTurn !== turnId) {
    // The marker belongs to an earlier turn and was already spent there.
    return false;
  }
  try {
    writeState(cwd, { ...state, memoryWriteRequested: false, memoryWriteTurn: null });
  } catch {
    // same reasoning as above: this call was authorized regardless of the write
  }
  return true;
}

/**
 * FAIL-OPEN PreToolUse dispatch. Returns a deny envelope for an unauthorized memory
 * write, "" for everything else — including every parse failure.
 */
export function handleMemoryWriteGate(raw: string, env: NodeJS.ProcessEnv = process.env): string {
  try {
    const payload = JSON.parse(raw) as {
      hook_event_name?: string;
      session_id?: string;
      turn_id?: string;
      cwd?: string;
      tool_name?: string;
      tool_input?: unknown;
    };
    if (payload.hook_event_name !== "PreToolUse") return "";
    const toolName = typeof payload.tool_name === "string" ? payload.tool_name : "";
    const cwd = typeof payload.cwd === "string" ? payload.cwd : "";
    const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    const turnId = typeof payload.turn_id === "string" ? payload.turn_id : "";
    if (toolName === "") return "";

    const attempt = classifyMemoryWrite(toolName, payload.tool_input, cwd, memoriesRoot(env));
    if (attempt.surface === "") return "";

    // No session state to consult (no cwd, or a session id we cannot key on) means the
    // gate cannot prove authorization, and a memory write with no provable request is
    // exactly what this gate exists to stop. Denying here is not the fail-open
    // exception: the fail-open promise covers CRASHES, and the deny still names both
    // remedies.
    if (cwd !== "" && sessionId !== "" && consumeAuthorization(cwd, sessionId, turnId)) return "";
    return denyEnvelope(denyReason(attempt, sessionId));
  } catch {
    return ""; // FAIL-OPEN: a gate crash must never block an explicitly requested write
  }
}
