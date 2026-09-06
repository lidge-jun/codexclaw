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
import { cxcInvocation } from "./cxc-resolve.js";

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
  text        ,
  env                                     = process.env,
)         {
  const cxc = cxcInvocation(import.meta.url, env);
  if (cxc === "cxc") return text;
  return text.split("`cxc ").join(`\`${cxc} `);
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
export function countSourceFiles(root        )         {
  let count = 0;
  let dirsVisited = 0;
  const queue           = [root];
  while (queue.length > 0) {
    if (count >= COUNT_CAP || dirsVisited >= MAX_DIRS_VISITED) break;
    const dir = queue.shift()          ;
    dirsVisited += 1;
    let entries                            ;
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
export function renderMapAffordance(fileCount        )         {
  const size = fileCount >= COUNT_CAP ? `${COUNT_CAP}+` : String(fileCount);
  return resolveCxcCommands([
    `[codexclaw] This workspace has ${size} source files. A ranked structure map is`,
    "available on demand: run `cxc map <dir>` (tree-sitter symbols + PageRank) to see",
    "which files own which symbols BEFORE deep rg dives into unfamiliar territory.",
    "It is a stateless one-shot tool — use it when you need the shape of code you do",
    "not yet know. Keep rg for byte/text search, and use ast-grep (skill:",
    "$cxc-ast-grep) for syntax-shape search and deterministic codemods.",
  ].join(" "));
}

/**
 * One-line skill-search affordance (same pointer-not-payload policy as the map
 * affordance): external skill catalogs exist and are searchable on demand. Always
 * on — unlike the map, its usefulness does not depend on repo size, and the cost
 * is one sentence per session.
 */
export function renderSkillSearchAffordance()         {
  return resolveCxcCommands([
    "[codexclaw] External skill catalogs are searchable on demand.",
    "Priority: jaw (cli-jaw-skills, 1st-class, default) > clawhub (2nd) > hermes (3rd, sparse).",
    "When a task needs a capability you do not have loaded,",
    "browse `dev/references/skill-catalog.md` for the full jaw catalog first,",
    "or run `cxc skill search <query>` then `cxc skill show <id>` to load it",
    "(adapter preamble applies; cxc-dev discipline wins on conflict).",
  ].join(" "));
}

/**
 * Universal Korean-prose polishing affordance (pointer-not-payload, always on
 * like the skill-search line): when the session writes Korean prose, the
 * baseline discipline is stated in one sentence and the full protocol lives in
 * the $cxc-kwrite skill. Deliberately genre-free — platform-specific writing
 * is out of scope here.
 */
export function renderKwriteAffordance()         {
  return [
    "[codexclaw] When writing Korean prose for the user (docs, answers,",
    "announcements), keep it human: no translationese (~에 대해/~를 통해/~함으로써),",
    "no AI idioms (시사하는 바가 크다/결론적으로/기대된다 endings), no 첫째/둘째",
    "enumeration, one consistent register throughout. For explicit 윤문/polish",
    "requests or long-form Korean output, load the $cxc-kwrite skill for the",
    "full revision protocol.",
  ].join(" ");
}

/**
 * Session-id binding line (G3, 260707 fork-FSM fix). Mutating `cxc orchestrate`
 * verbs require an explicit --session; this line tells the agent ITS OWN id at
 * SessionStart, so a /fork-ed session (which replays the parent's orchestrate
 * context but receives a NEW id here) targets its own FSM instead of the
 * most-recently-touched session file.
 */
export function renderSessionBinding(sessionId        )         {
  return resolveCxcCommands([
    `[codexclaw] This session's id is \`${sessionId}\`. Every mutating`,
    "`cxc orchestrate` command (I/P/A/B/C/D/reset) MUST pass",
    `\`--session ${sessionId}\` — the implicit latest-session fallback is`,
    "disabled for writes, which prevents ACCIDENTAL implicit-fallback",
    "collisions between concurrent/forked sessions.",
    "IDENTITY RULE: use the MOST RECENT SessionStart binding line, never a parent/history id.",
    "With native CODEX_THREAD_ID, verify via `cxc session current` before mutation.",
    "Missing/inherited/conflicting binding: use `cxc session current`, then `cxc session bind` in its verified cwd.",
    "Never set the environment id. Binding does not verify hooks or arm Stop-continuation.",
  ].join(" "));
}

/**
 * Always-on loop-contract line (ORCH-ARM-VISIBILITY-01, 260714). The arming
 * mandate used to live ONLY behind the UserPromptSubmit regex
 * (detectLoopArmRequest) — one lexical miss ("PABCD 여러 번 돌려") delivered zero
 * bytes and the agent patched without the FSM. This line puts the contract's
 * existence in the always-visible SessionStart layer; the per-prompt directive
 * remains the detailed surface.
 */
export function renderLoopAffordance()         {
  return resolveCxcCommands([
    "[codexclaw] Loop contract: for actual loop work load $codexclaw:cxc-loop + $codexclaw:cxc-pabcd.",
    "Bare cxc-loop means scoped HOTL; a mention alone grants no authority.",
    "Exact user limits and separately allowed actions scope this pointer and its owners. No-delegation means no dispatch.",
    "Read-only inspection remains allowed under no-goal/no-FSM; for actual loop work inspect `cxc orchestrate status --session <your id>` first.",
    "No-tests does not forbid an explicitly allowed build. One work-phase = one full PABCD cycle.",
    "No extra external permissions; do not bypass guards or invent evidence.",
  ].join(" "));
}

/** Global discovery only; the agent verifies membership and CI on demand. */
export function renderStackedPrAffordance()         {
  return [
    "[codexclaw] For PR work or dependent branches, read $codexclaw:cxc-dev references/stacked-prs.md (DEV-STACK-06/07).",
    "Use ordinary PRs/manual chains by default.",
    "Do not suggest or create GitHub native stacks unless the user clearly and strongly requests them for this task.",
    "Inspect existing membership and CI separately; a parent base or Can Stack banner is not opt-in.",
    "Per-PR CI is expected. This is guidance, not authorization to register, restack, cancel CI, or merge.",
  ].join(" ");
}

/**
 * Always-on background-terminal affordance (BG-TERMINAL-AFFORDANCE-01, 260715).
 * Long-running or collision-risky commands (dev servers, builds, 5min+ probes)
 * should use managed background execution instead of blocking the turn inline.
 * Emitted at SessionStart and the first root UserPromptSubmit after compact.
 */
export function renderBackgroundTerminalAffordance()         {
  return [
    "[codexclaw] Long-running or collision-risky commands (dev servers, builds, test",
    "suites, 5min+ probes) SHOULD use managed background execution: `exec_command`",
    "with short `yield_time_ms` → get `session_id` → end turn or continue other work",
    "→ poll later with `write_stdin` (empty chars = poll, no typing). Do NOT block the",
    "turn inline for commands that might outlive compaction or conflict with parallel",
    "work. CLI: `/ps` lists active background terminals; `/stop` terminates all in the",
    "current session. A session_id is NOT an OS PID — it is a Codex-managed execution",
    "handle.",
  ].join(" ");
}

/** Question transport guidance only; does not expose tools or change permissions. */
function renderQuestionAffordance()         {
  return [
    "[codexclaw] User questions: main agents may leave useful questions during work, including active goals.",
    "Outside Interview, prefer exposed and host-allowed `request_user_input_async`; do not expect replies or wait.",
    "Continue authorized work with reasonable assumptions, incorporate later replies, and ask distinct useful questions without reminders.",
    "Interview uses `request_user_input` only; see $codexclaw:cxc-interview.",
    "Absent tools stay absent; silence grants no approval. Subagents send question candidates to main.",
    "Details: $codexclaw:cxc-dev references/async-questions.md.",
  ].join(" ");
}

/** Resolve only a valid root event; child sessions may reuse the parent's id. */
function recoveryPath(stdin        , event        , create         )                {
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
        if (!create || (error                         ).code !== "ENOENT") return null;
        mkdirSync(path, { mode: 0o700 });
        st = lstatSync(path);
      }
      if (!st.isDirectory() || st.isSymbolicLink()) return null;
    }
    return join(dir, createHash("sha256").update(p.session_id).digest("hex") + ".pending");
  } catch { return null; }
}

/** PostCompact accepts no event-specific context; queue a best-effort hint only. */
export function runPostCompactAffordance(stdin = "")         {
  const path = recoveryPath(stdin, "PostCompact", true);
  if (path) {
    try { writeFileSync(path, "pending\n", { flag: "wx", mode: 0o600 }); }
    catch { /* An existing marker coalesces compactions; IO failure loses only a hint. */ }
  }
  return "";
}

/** Emit once on the next root prompt, not on every tool/Stop or on a child. */
export function runUserPromptAffordance(stdin        )         {
  const path = recoveryPath(stdin, "UserPromptSubmit", false);
  if (!path) return "";
  try {
    const st = lstatSync(path);
    if (!st.isFile() || st.isSymbolicLink()) return "";
    unlinkSync(path); // only one concurrent consumer can remove the marker
  } catch { return ""; }
  const lines           = [];
  lines.push(renderBackgroundTerminalAffordance());
  lines.push(renderLoopAffordance());
  lines.push(renderStackedPrAffordance());
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
 * lines: the map pointer (size-gated) plus the skill-search pointer (always on).
 * Never throws.
 */
export function runMapAffordanceSessionStart(stdin        , fallbackCwd        )         {
  let cwd = fallbackCwd;
  let sessionId = "";
  try {
    const trimmed = stdin.trim();
    if (trimmed.length > 0) {
      const payload = JSON.parse(trimmed)                                           ;
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
  const lines           = [];
  if (sessionId) lines.push(renderSessionBinding(sessionId));
  if (count >= MAP_AFFORDANCE_MIN_FILES) lines.push(renderMapAffordance(count));
  lines.push(renderSkillSearchAffordance());
  lines.push(renderKwriteAffordance());
  lines.push(renderLoopAffordance());
  lines.push(renderStackedPrAffordance());
  lines.push(renderBackgroundTerminalAffordance());
  lines.push(renderQuestionAffordance());
  // Fresh-install coverage for STATIC surfaces (SKILL.md files are deliberately
  // NOT rewritten): when `cxc` is not runnable as-is, ONE banner line names the
  // invocation that works on this machine so every doc-mentioned command resolves.
  const cxc = cxcInvocation(import.meta.url);
  if (cxc !== "cxc") {
    lines.push(
      `[codexclaw] \`cxc\` is not on PATH here; wherever docs say \`cxc\`, run: ${cxc}`,
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
