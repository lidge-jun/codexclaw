import { ensureCodexclawDir } from "./codexclaw-dir.ts";
/**
 * map-affordance.ts — SessionStart `cxc map` discoverability injector.
 *
 * WHY: `cxc map` (the repo-map skill) is only routed from the `dev` skill's §1.5
 * (DEV-MAP-FIRST-01), which is model-autonomous — the model only learns the tool
 * exists if it reads that skill. This hook uses one of the four real enforcement
 * surfaces (SessionStart additionalContext, philosophy §1) to make the tool's
 * existence known at session start, WITHOUT injecting the map body itself (that
 * whole-repo preload is the deliberately-rejected non-goal — see lazygap 005 and
 * 260706_repo_map: on-demand only, no session-start map injection). This injects a
 * POINTER, not the map.
 *
 * SIZE GATE: a repo-map overview only pays off once a tree is big enough that
 * `rg`-walking to reconstruct structure is costly. Below the threshold the
 * affordance is silent (a tiny repo does not need a map). The count is a cheap
 * bounded source-file walk (skips vendored/build/VCS dirs, caps traversal).
 *
 * SAFETY: SessionStart is read-only; compact recovery writes only a scoped hint
 * marker, never FSM/goal state. Always exit 0. On any doubt (unreadable cwd,
 * walk error) it emits nothing rather than a broken envelope — a missing
 * affordance is strictly better than a failed session start.
 */
import { readdirSync, mkdirSync, lstatSync, realpathSync, writeFileSync, unlinkSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { cxcInvocation } from "./cxc-resolve.ts";

/**
 * Resolve backtick-anchored `` `cxc `` COMMAND prefixes to the invocation that
 * actually exists on this machine (cxc-resolve ladder). Called at RENDER time so
 * the env seam (CODEXCLAW_CXC) and per-machine PATH state are honored per emit,
 * not frozen at import.
 *
 * WHY backtick-anchored only (H1, 260724 fresh-install): noun phrases
 * ("owns cxc orchestration"), skill names (`cxc-loop`), and chat commands
 * (`!cxc start`) must keep the literal word — only command mentions rendered as
 * `` `cxc <verb> ...` `` code spans are rewritten.
 */
export function resolveCxcCommands(
  text: string,
  env: Record<string, string | undefined> = process.env,
): string {
  return text.replace(/`cxc ([^\s`]+)/g,
    (_prefix: string, command: string) => `\`${cxcInvocation(import.meta.url, env, command)} ${command}`);
}

/** Source extensions worth mapping (mirrors the repo-map tree-sitter language set). */
const SOURCE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".rb", ".c", ".h", ".cpp", ".hpp",
  ".cs", ".swift", ".kt", ".scala", ".lua", ".ex", ".exs", ".php",
]);

/** Dirs that never contribute to a useful structure map. */
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "target", "out", "coverage",
  "__pycache__", "venv", ".venv", "env", ".next", ".cache", "vendor",
]);

/** Repos at/above this source-file count get the affordance. Below it, stay silent. */
export const MAP_AFFORDANCE_MIN_FILES = 40;

/** Stop counting once we clearly clear the gate — the exact number does not matter. */
const COUNT_CAP = 60;
/** Bound the walk so a pathological tree cannot stall session start. */
const MAX_DIRS_VISITED = 4000;

/**
 * Count source files under `root`, breadth-first, skipping SKIP_DIRS. Stops early
 * at COUNT_CAP or MAX_DIRS_VISITED. Returns the (possibly capped) count.
 */
export function countSourceFiles(root: string): number {
  let count = 0;
  let dirsVisited = 0;
  const queue: string[] = [root];
  while (queue.length > 0) {
    if (count >= COUNT_CAP || dirsVisited >= MAX_DIRS_VISITED) break;
    const dir = queue.shift() as string;
    dirsVisited += 1;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable dir -> skip, never throw
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
        queue.push(join(dir, entry.name));
      } else if (entry.isFile()) {
        const dot = entry.name.lastIndexOf(".");
        if (dot > 0 && SOURCE_EXT.has(entry.name.slice(dot))) {
          count += 1;
          if (count >= COUNT_CAP) break;
        }
      }
    }
  }
  return count;
}

/** On-demand map pointer; the caller owns the source-file size gate. */
export function renderMapAffordance(fileCount: number): string {
  const size = fileCount >= COUNT_CAP ? `${COUNT_CAP}+` : String(fileCount);
  return resolveCxcCommands(
    `[codexclaw] ${size} source files: ranked symbol map via \`cxc map <dir>\`. Owner: $codexclaw:cxc-repo-map.`,
  );
}

/** Current identity; phase-control.md owns binding and recovery procedures. */
export function renderSessionBinding(sessionId: string): string {
  return resolveCxcCommands([
    `[codexclaw] Session \`${sessionId}\`. Mutating \`cxc orchestrate\`/\`cxc loop\` calls pass`,
    `\`--session ${sessionId}\`; verify \`cxc session current\`. Never use parent/history ids.`,
    "Owner: $codexclaw:cxc-pabcd phase-control.md.",
  ].join(" "));
}

/** Always-visible owner pointer; user limits determine loop applicability. */
export function renderLoopAffordance(): string {
  return "[codexclaw] Loop contract: load $codexclaw:cxc-loop and $codexclaw:cxc-pabcd for loop work. User limits win; a mention grants no authority.";
}

/** Terminal transport pointer, shared by startup and compact recovery. */
export function renderBackgroundTerminalAffordance(): string {
  return "[codexclaw] Long commands: exec_command with short yield_time_ms; poll session_id with write_stdin. Owner: $codexclaw:cxc-dev native-execution.md.";
}

/** Question transport guidance only; does not expose tools or change permissions. */
function renderQuestionAffordance(): string {
  return "[codexclaw] User questions: request_user_input_async when exposed; do not wait; silence is not approval. Owner: $codexclaw:cxc-dev async-questions.md.";
}

/** Resolve only a valid root event; child sessions may reuse the parent's id. */
function recoveryPath(stdin: string, event: string, create: boolean): string | null {
  try {
    const p = JSON.parse(stdin);
    if (!p || typeof p !== "object" || Array.isArray(p) || p.hook_event_name !== event
      || typeof p.cwd !== "string" || !isAbsolute(p.cwd)
      || typeof p.session_id !== "string" || !p.session_id.trim() || p.session_id.length > 256
      || (p.agent_id != null && p.agent_id !== "") || (p.agent_type != null && p.agent_type !== "")) return null;
    const state = join(realpathSync(p.cwd), ".codexclaw");
    const dir = join(state, "affordance-recovery");
    for (const path of [state, dir]) {
      let st;
      try { st = lstatSync(path); }
      catch (error) {
        if (!create || (error as NodeJS.ErrnoException).code !== "ENOENT") return null;
        if (path === state) ensureCodexclawDir(realpathSync(p.cwd));
        else mkdirSync(path, { mode: 0o700 });
        st = lstatSync(path);
      }
      if (!st.isDirectory() || st.isSymbolicLink()) return null;
    }
    return join(dir, createHash("sha256").update(p.session_id).digest("hex") + ".pending");
  } catch { return null; }
}

/** PostCompact accepts no event-specific context; queue a best-effort hint only. */
export function runPostCompactAffordance(stdin = ""): string {
  const path = recoveryPath(stdin, "PostCompact", true);
  if (path) {
    try { writeFileSync(path, "pending\n", { flag: "wx", mode: 0o600 }); }
    catch { /* An existing marker coalesces compactions; IO failure loses only a hint. */ }
  }
  return "";
}

/** Emit once on the next root prompt, not on every tool/Stop or on a child. */
export function runUserPromptAffordance(stdin: string): string {
  const path = recoveryPath(stdin, "UserPromptSubmit", false);
  if (!path) return "";
  try {
    const st = lstatSync(path);
    if (!st.isFile() || st.isSymbolicLink()) return "";
    unlinkSync(path); // only one concurrent consumer can remove the marker
  } catch { return ""; }
  const lines: string[] = [];
  lines.push(renderBackgroundTerminalAffordance());
  lines.push(renderLoopAffordance());
  lines.push(renderQuestionAffordance());
  const envelope = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: lines.join("\n\n"),
    },
  };
  return `${JSON.stringify(envelope)}\n`;
}

/**
 * SessionStart handler. Reads the hook JSON payload from stdin (for `cwd`), counts
 * source files, and returns ONE SessionStart envelope combining the affordance
 * lines: the size-gated map plus binding, loop, terminal and question pointers.
 * Never throws.
 */
export function runMapAffordanceSessionStart(stdin: string, fallbackCwd: string): string {
  let cwd = fallbackCwd;
  let sessionId = "";
  try {
    const trimmed = stdin.trim();
    if (trimmed.length > 0) {
      const payload = JSON.parse(trimmed) as { cwd?: unknown; session_id?: unknown };
      if (typeof payload.cwd === "string" && payload.cwd.length > 0) cwd = payload.cwd;
      if (typeof payload.session_id === "string" && payload.session_id.length > 0) {
        sessionId = payload.session_id;
      }
    }
  } catch {
    // malformed stdin -> fall back to fallbackCwd; still safe.
  }
  let count = 0;
  try {
    count = countSourceFiles(cwd);
  } catch {
    count = 0; // walk blew up somehow -> skip the map line, keep the other pointers
  }
  const lines: string[] = [];
  if (sessionId) lines.push(renderSessionBinding(sessionId));
  if (count >= MAP_AFFORDANCE_MIN_FILES) lines.push(renderMapAffordance(count));
  lines.push(renderLoopAffordance());
  lines.push(renderBackgroundTerminalAffordance());
  lines.push(renderQuestionAffordance());
  // Fresh-install coverage for STATIC surfaces (SKILL.md files are deliberately
  // NOT rewritten): when `cxc` is not runnable as-is, ONE banner line names the
  // invocation that works on this machine so every doc-mentioned command resolves.
  const cxc = cxcInvocation(import.meta.url);
  if (cxc !== "cxc") {
    lines.push(
      `[codexclaw] cxc invocation: ${cxc}`,
    );
  }
  const envelope = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: lines.join("\n\n"),
    },
  };
  return `${JSON.stringify(envelope)}\n`;
}
