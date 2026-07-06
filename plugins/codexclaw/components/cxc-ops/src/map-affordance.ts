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
 * SAFETY: read-only, never throws, always exit 0. On any doubt (unreadable cwd,
 * walk error) it emits nothing rather than a broken envelope — a missing
 * affordance is strictly better than a failed session start.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

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

/** The strong, one-line affordance injected as SessionStart additionalContext. */
export function renderMapAffordance(fileCount: number): string {
  const size = fileCount >= COUNT_CAP ? `${COUNT_CAP}+` : String(fileCount);
  return [
    `[codexclaw] This workspace has ${size} source files. A ranked structure map is`,
    "available on demand: run `cxc map <dir>` (tree-sitter symbols + PageRank) to see",
    "which files own which symbols BEFORE deep rg dives into unfamiliar territory.",
    "It is a stateless one-shot tool — use it when you need the shape of code you do",
    "not yet know. Keep rg for byte/text search, and use ast-grep (skill:",
    "$cxc-ast-grep) for syntax-shape search and deterministic codemods.",
  ].join(" ");
}

/**
 * One-line skill-search affordance (same pointer-not-payload policy as the map
 * affordance): external skill catalogs exist and are searchable on demand. Always
 * on — unlike the map, its usefulness does not depend on repo size, and the cost
 * is one sentence per session.
 */
export function renderSkillSearchAffordance(): string {
  return [
    "[codexclaw] External skill catalogs (cli-jaw registry, hermes, clawhub) are",
    "searchable on demand: when a task needs a capability or domain workflow you do",
    "not have loaded, run `cxc skill search <query>` first, then `cxc skill show <id>`",
    "to load it (adapter preamble applies; cxc-dev discipline wins on conflict).",
  ].join(" ");
}

/**
 * Session-id binding line (G3, 260707 fork-FSM fix). Mutating `cxc orchestrate`
 * verbs require an explicit --session; this line tells the agent ITS OWN id at
 * SessionStart, so a /fork-ed session (which replays the parent's orchestrate
 * context but receives a NEW id here) targets its own FSM instead of the
 * most-recently-touched session file.
 */
export function renderSessionBinding(sessionId: string): string {
  return [
    `[codexclaw] This session's id is \`${sessionId}\`. Every mutating`,
    "`cxc orchestrate` command (I/P/A/B/C/D/reset) MUST pass",
    `\`--session ${sessionId}\` — the implicit latest-session fallback is`,
    "disabled for writes, which prevents ACCIDENTAL implicit-fallback",
    "collisions between concurrent/forked sessions.",
    "IDENTITY RULE: use the MOST RECENT SessionStart binding line in your",
    "current context as the only source of your session id — older binding",
    "lines or other ids in transcript/history belong to prior/parent sessions;",
    "never pass those to a mutating command.",
  ].join(" ");
}

/**
 * SessionStart handler. Reads the hook JSON payload from stdin (for `cwd`), counts
 * source files, and returns ONE SessionStart envelope combining the affordance
 * lines: the map pointer (size-gated) plus the skill-search pointer (always on).
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
    count = 0; // walk blew up somehow -> skip the map line, keep the skill line
  }
  const lines: string[] = [];
  if (sessionId) lines.push(renderSessionBinding(sessionId));
  if (count >= MAP_AFFORDANCE_MIN_FILES) lines.push(renderMapAffordance(count));
  lines.push(renderSkillSearchAffordance());
  const envelope = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: lines.join("\n\n"),
    },
  };
  return `${JSON.stringify(envelope)}\n`;
}
