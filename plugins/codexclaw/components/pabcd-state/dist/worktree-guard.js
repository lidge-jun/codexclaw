/**
 * worktree-guard.ts — Codex-app managed-worktree identity guard (260804 unit,
 * devlog/_plan/260804_worktree_identity_guardian/010 rev2).
 *
 * Problem: the Codex desktop app creates per-thread worktrees under
 * $CODEX_HOME/worktrees/<slot>/<repo> (detached HEAD, hash slots). Asked to
 * "name the worktree", agents repeatedly delete-and-recreate the ACTIVE
 * worktree, destroying uncommitted work and the app binding.
 *
 * Three surfaces:
 *  - SessionStart (WORKTREE-GUARD-01): identity injection when cwd is managed.
 *  - UserPromptSubmit (WORKTREE-GUARD-02): rename-intent guidance, once/session.
 *  - PreToolUse (WORKTREE-GUARD-03): deterministic deny of commands that delete
 *    THIS session's own slot/checkout/cwd — enforced for subagent turns too
 *    (dispatched above the subagent early-exit in cli.ts).
 *
 * Detection covers the default root plus CODEXCLAW_WORKTREE_ROOTS
 * (path.delimiter-separated). A custom app-side worktree root needs that env —
 * the app's settings storage is closed-source and not read here.
 */
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve, sep } from "node:path";
import { buildContextOutput } from "./hook.js";
import { sanitizeKey, STATE_DIR } from "./state.js";









export function resolveCodexHome(env                   )         {
  const home = env.CODEX_HOME?.trim();
  return home ? home : join(homedir(), ".codex");
}

export function candidateWorktreeRoots(env                   )           {
  const roots = [join(resolveCodexHome(env), "worktrees")];
  const extra = env.CODEXCLAW_WORKTREE_ROOTS;
  if (extra) {
    for (const entry of extra.split(delimiter)) {
      const trimmed = entry.trim();
      if (trimmed) roots.push(trimmed);
    }
  }
  return roots;
}

/** realpath when possible; otherwise realpath the nearest existing ancestor and
 *  append the remainder (symlink + macOS case-insensitive safety). */
export function canonicalize(p        )         {
  const abs = resolve(p);
  try {
    return realpathSync.native(abs);
  } catch {
    // walk up to the nearest existing ancestor
    let cur = abs;
    const missing           = [];
    while (true) {
      const parent = resolve(cur, "..");
      if (parent === cur) return abs; // filesystem root: give up, return lexical
      cur = parent;
      missing.unshift(abs.slice(cur.length + 1).split(sep)[0] ?? "");
      try {
        const real = realpathSync.native(cur);
        const rest = abs.slice(cur.length + 1);
        return rest ? join(real, rest) : real;
      } catch {
        // keep walking
      }
      if (missing.length > 64) return abs; // pathological depth guard
    }
  }
}

function firstSegment(rel        )         {
  const idx = rel.indexOf(sep);
  return idx === -1 ? rel : rel.slice(0, idx);
}

/** Nearest ancestor of cwd (inclusive) containing a `.git` entry, walking no
 *  higher than slotRoot. Returns null when none found. */
function findCheckoutRoot(cwd        , slotRoot        )                {
  let cur = cwd;
  while (true) {
    try {
      if (existsSync(join(cur, ".git"))) return cur;
    } catch {
      return null;
    }
    if (cur === slotRoot) return null;
    const parent = resolve(cur, "..");
    if (parent === cur) return null;
    cur = parent;
  }
}

export function detectManagedWorktree(cwd        , env                   )                   {
  const none                   = {
    managed: false,
    worktreesDir: "",
    slot: null,
    slotRoot: null,
    checkoutRoot: null,
  };
  if (!cwd || !cwd.trim()) return none;
  const canonicalCwd = canonicalize(cwd);
  for (const root of candidateWorktreeRoots(env)) {
    const canonicalRoot = canonicalize(root);
    if (canonicalCwd === canonicalRoot) continue; // root itself: no slot
    if (!canonicalCwd.startsWith(canonicalRoot + sep)) continue;
    const rel = canonicalCwd.slice(canonicalRoot.length + 1);
    const slot = firstSegment(rel);
    if (!slot) continue;
    const slotRoot = join(canonicalRoot, slot);
    return {
      managed: true,
      worktreesDir: canonicalRoot,
      slot,
      slotRoot,
      checkoutRoot: findCheckoutRoot(canonicalCwd, slotRoot),
    };
  }
  return none;
}

const RENAME_INTENT = [
  /worktree|워크트리/i,
  /rename|re-?name|이름|명명|바꾸|바꿔|지어|짓/i,
];

export function detectRenameIntent(prompt        )          {
  if (!prompt) return false;
  return RENAME_INTENT.every((re) => re.test(prompt));
}

export function buildSessionStartContext(id                  , cwd        )         {
  if (!id.managed) return "";
  const checkout = id.checkoutRoot ?? "unconfirmed (no .git entry found)";
  const gitAdvice = id.checkoutRoot
    ? "- To name things, ADOPT IN PLACE: stay here; `git switch -c <name>` (detached) or\n  `git branch -m <name>` names the branch; commit early. The app thread title is\n  renamed by the user in the app sidebar — agents cannot rename it."
    : "- Stay here and commit early. The app thread title is renamed by the user in\n  the app sidebar — agents cannot rename it.";
  return [
    "[codexclaw: MANAGED WORKTREE — identity guard (WORKTREE-GUARD-01)]",
    `This session runs inside a Codex-app-managed worktree: ${checkout}`,
    `(cwd: ${cwd}; slot: ${id.slotRoot}; worktrees root: ${id.worktreesDir}).`,
    "- This thread is BOUND to this worktree. NEVER delete, recreate, or \"start fresh\"",
    "  to rename it — that destroys uncommitted work and breaks the app binding.",
    "- App worktrees usually start detached-HEAD: the \"worktree name\" is the directory",
    "  slot, not a branch. branch ≠ worktree ≠ thread title (three namespaces).",
    gitAdvice,
    "- Do NOT `git worktree move` the ACTIVE worktree: it invalidates this session's",
    "  cwd and app rebinding is not guaranteed. Move only OTHER/inactive worktrees.",
    "- The app may auto-delete this worktree on chat archive (snapshot kept) and",
    "  retains only the latest N managed worktrees: commit early, push on approval.",
    "- Detection covers the default root + CODEXCLAW_WORKTREE_ROOTS; a custom app",
    "  worktree root needs that env. Full procedures: $codexclaw:cxc-worktree-guardian.",
  ].join("\n");
}

export function buildRenameGuidance(id                  )         {
  return [
    "[codexclaw: MANAGED WORKTREE — rename/adopt guidance (WORKTREE-GUARD-02)]",
    "Rename request on a managed worktree. ADOPT IN PLACE — do not delete/recreate:",
    "1. Stay in this worktree. It is bound to the app thread; recreating breaks that.",
    "2. Name the BRANCH: `git switch -c <name>` (detached HEAD) or `git branch -m <name>`.",
    "3. Commit the work early — the app auto-deletes managed worktrees on archive",
    "   (snapshot kept) and retains only the latest N.",
    "4. The app THREAD TITLE is renamed by the user in the app sidebar; neither the",
    "   directory nor the branch rename changes it.",
    "5. Do NOT `git worktree move` the ACTIVE worktree (session cwd dies). Move/repair",
    "   are for OTHER inactive worktrees: `git worktree move <old> <new>`,",
    "   `git worktree repair <new>` — feature-detect with `-h`, no version gates.",
    `Slot protected by the PreToolUse guard: ${id.slotRoot ?? "unknown"}.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Command grammar (010 rev2 §grammar; per-command flag semantics, round-3 fix)
// ---------------------------------------------------------------------------



const ALLOW               = { action: "allow" };

/** Split a shell command into segments on &&, ||, ;, | (quote-protected). */
export function splitSegments(command        )           {
  const segments           = [];
  let cur = "";
  let quote                = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === ";" || ch === "|" || (ch === "&" && command[i + 1] === "&")) {
      segments.push(cur);
      cur = "";
      if (ch === "&") i++;
      if (ch === "|" && command[i + 1] === "|") i++;
      continue;
    }
    cur += ch;
  }
  segments.push(cur);
  return segments.map((s) => s.trim()).filter(Boolean);
}

/** Minimal quote-aware tokenizer. */
export function tokenize(segment        )           {
  const tokens           = [];
  let cur = "";
  let quote                = null;
  let has = false;
  for (const ch of segment) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      has = true;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (has) {
        tokens.push(cur);
        cur = "";
        has = false;
      }
      continue;
    }
    cur += ch;
    has = true;
  }
  if (has) tokens.push(cur);
  return tokens;
}

function basename(p        )         {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? norm : norm.slice(idx + 1);
}

/** Strip leading sudo/env/command/builtin prefixes; env may carry VAR=val. */
function stripPrefixes(tokens          )           {
  let rest = tokens;
  for (;;) {
    const head = rest[0] ? basename(rest[0]) : "";
    if (head === "sudo" || head === "command" || head === "builtin") {
      rest = rest.slice(1);
      continue;
    }
    if (head === "env") {
      rest = rest.slice(1);
      while (rest.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0])) rest = rest.slice(1);
      continue;
    }
    return rest;
  }
}

function isProtectedTarget(target        , segCwd        , id                  )          {
  const resolved = canonicalize(resolve(segCwd, target));
  const cwd = canonicalize(segCwd);
  if (id.slotRoot && resolved === id.slotRoot) return true;
  if (id.checkoutRoot && resolved === id.checkoutRoot) return true;
  if (resolved === cwd) return true;
  // ancestor of cwd (deleting a parent deletes us): cwd sits under target
  if (cwd.startsWith(resolved + sep)) return true;
  return false;
}

/** Evaluate one segment. Returns a deny verdict or null (no opinion). */
function evaluateSegment(
  segment        ,
  cwd        ,
  id                  ,
)                      {
  let tokens = tokenize(segment);
  if (!tokens.length) return null;

  // `cd <dir>` changes the effective cwd for later segments — tracked by caller;
  // handled here by returning null (caller updates segCwd separately).
  tokens = stripPrefixes(tokens);
  if (!tokens.length) return null;
  const exe = basename(tokens[0]);

  const deny = (what        )               => ({
    action: "deny",
    reason: denyReason(what, id),
  });

  if (exe === "rm") {
    let recursive = false;
    let flagsDone = false;
    const targets           = [];
    for (const tok of tokens.slice(1)) {
      if (!flagsDone && tok === "--") {
        flagsDone = true;
        continue;
      }
      if (!flagsDone && tok.startsWith("--")) {
        if (tok === "--recursive") recursive = true;
        continue; // --force and other long flags carry no targets
      }
      if (!flagsDone && tok.startsWith("-") && tok.length > 1) {
        if (/[rR]/.test(tok)) recursive = true;
        continue;
      }
      targets.push(tok);
    }
    if (!recursive) return null; // plain file removal cannot delete the worktree
    for (const target of targets) {
      if (isProtectedTarget(target, cwd, id)) return deny(`rm -r ${target}`);
    }
    return null;
  }

  if (exe === "rmdir") {
    for (const tok of tokens.slice(1)) {
      if (tok.startsWith("-")) continue;
      if (isProtectedTarget(tok, cwd, id)) return deny(`rmdir ${tok}`);
    }
    return null;
  }

  if (exe === "unlink") return null; // file-only; never threatens the worktree

  if (exe === "git") {
    const args = tokens.slice(1);
    let segCwd = cwd;
    const rest           = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-C" && i + 1 < args.length) {
        segCwd = resolve(segCwd, args[i + 1]);
        i++;
        continue;
      }
      if (args[i] === "-c" && i + 1 < args.length) {
        i++;
        continue;
      }
      rest.push(args[i]);
    }
    if (rest[0] === "worktree" && rest[1] === "remove") {
      const target = rest.find((t, i) => i >= 2 && !t.startsWith("-"));
      if (target && isProtectedTarget(target, segCwd, id)) {
        return deny(`git worktree remove ${target}`);
      }
    }
    return null;
  }

  return null;
}

// unlink is excluded on purpose: file-only, can never threaten the worktree.
const DESTRUCTIVE_HINT = /(^|[\s/])(rm|rmdir)\b|git\s+(-C\s+\S+\s+)?worktree\s+remove/;

export function evaluateCommand(
  command        ,
  cwd        ,
  id                  ,
)               {
  if (!id.managed || !command || !command.trim()) return ALLOW;
  let segCwd = cwd;
  let destructiveSeen = false;
  for (const segment of splitSegments(command)) {
    const tokens = tokenize(segment);
    if (tokens[0] === "cd" && tokens[1]) {
      segCwd = resolve(segCwd, tokens[1]);
      continue;
    }
    if (DESTRUCTIVE_HINT.test(segment)) destructiveSeen = true;
    const verdict = evaluateSegment(segment, segCwd, id);
    if (verdict) return verdict;
  }
  // Conservative fallback: a destructive op was seen and the raw command
  // literally mentions the slot or worktrees root, but no concrete protected
  // target resolved (variable/glob indirection).
  const mentionsProtected =
    (id.slotRoot !== null && command.includes(id.slotRoot)) ||
    command.includes(id.worktreesDir) ||
    (id.slot !== null && command.includes(id.slot));
  if (destructiveSeen && mentionsProtected) {
    return {
      action: "deny",
      reason: denyReason("unresolvable target mentioning the managed worktree", id),
    };
  }
  return ALLOW;
}

function denyReason(what        , id                  )         {
  return [
    `[codexclaw: WORKTREE-GUARD-03] blocked \`${what}\`: it deletes this session's`,
    `own Codex-app-managed worktree (slot: ${id.slotRoot ?? "unknown"}). This thread`,
    "is bound to that worktree; deletion destroys uncommitted work.",
    "Remedies: finish and commit here; rename in place (git switch -c / branch -m);",
    "teardown of THIS session's worktree is done by the user (archive the thread in",
    "the app — snapshot preserved — or remove it from OUTSIDE this session).",
    "See $codexclaw:cxc-worktree-guardian.",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Hook entry points (tolerant raw-stdin parse; never throw)
// ---------------------------------------------------------------------------

function parseRaw(raw        )                                 {
  try {
    const parsed = JSON.parse(raw)           ;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed                           ;
  } catch {
    return null;
  }
}

function markerPath(cwd        , sessionId        )         {
  return join(cwd, STATE_DIR, "worktree-guard", `${sanitizeKey(sessionId)}.json`);
}

function alreadyInjected(cwd        , sessionId        )          {
  try {
    return existsSync(markerPath(cwd, sessionId));
  } catch {
    return false;
  }
}

function markInjected(cwd        , sessionId        , slot               )       {
  try {
    const path = markerPath(cwd, sessionId);
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify({ injectedAt: new Date().toISOString(), slot }), {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // marker failure must never block the injection
  }
}

/** SessionStart / UserPromptSubmit surface (context events). */
export function handleWorktreeGuard(rawStdin        )         {
  const payload = parseRaw(rawStdin);
  if (!payload) return "";
  const event = payload.hook_event_name;
  const cwd = typeof payload.cwd === "string" ? payload.cwd : "";
  if (!cwd) return "";
  const env = process.env;

  if (event === "SessionStart") {
    const id = detectManagedWorktree(cwd, env);
    return buildContextOutput("SessionStart", buildSessionStartContext(id, cwd));
  }

  if (event === "UserPromptSubmit") {
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    const id = detectManagedWorktree(cwd, env);
    if (!id.managed || !detectRenameIntent(prompt)) return "";
    if (sessionId && alreadyInjected(cwd, sessionId)) return "";
    if (sessionId) markInjected(cwd, sessionId, id.slot);
    return buildContextOutput("UserPromptSubmit", buildRenameGuidance(id));
  }

  return "";
}

/** PreToolUse enforcement surface — dispatched ABOVE the subagent early-exit in
 *  cli.ts so child-agent turns are denied too (audit B3). */
export function handleWorktreeGuardPreTool(rawStdin        )         {
  const payload = parseRaw(rawStdin);
  if (!payload) return "";
  if (payload.hook_event_name !== "PreToolUse") return "";
  const toolName = typeof payload.tool_name === "string" ? payload.tool_name : "";
  if (toolName && toolName !== "Bash") return "";
  const cwd = typeof payload.cwd === "string" ? payload.cwd : "";
  if (!cwd) return "";
  const input = payload.tool_input;
  let command = "";
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const cmd = (input                           ).command;
    if (typeof cmd === "string") command = cmd;
  }
  if (!command) return "";
  const id = detectManagedWorktree(cwd, process.env);
  const verdict = evaluateCommand(command, cwd, id);
  if (verdict.action === "allow") return "";
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: verdict.reason,
      additionalContext: verdict.reason,
    },
  })}\n`;
}
