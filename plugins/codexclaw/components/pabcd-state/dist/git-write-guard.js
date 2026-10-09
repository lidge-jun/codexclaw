/**
 * git-write-guard.ts — #284. Two PreToolUse checks that ride the existing `^Bash$`
 * `worktree-guard-pretool` hook (no new hook registration, no new trust hash):
 *
 *  - WORKTREE-GUARD-04: when this session pinned a source worktree with
 *    `cxc session source`, a git write whose effective repository is the SAME
 *    repository as the source but a DIFFERENT worktree (typically the native main
 *    checkout) is denied. Unrelated repositories are untouched, and recovery flags
 *    (`--abort`, `--quit`) stay allowed so a half-applied sequence can be undone.
 *  - SHELL-SUBST-01: a command substitution that the shell will actually execute
 *    (backtick or `$(` outside single quotes and quoted heredocs, or inside a
 *    `sh|bash|zsh -c` payload) whose body runs a git write or a high-risk gh
 *    mutation is denied with or without a binding. Any other backtick substitution
 *    inside double quotes gets an advisory: that shape is nearly always Markdown
 *    inline code interpolated into shell code.
 *
 * Codex hook payloads carry only `tool_input.command`; exec_command's `workdir` is
 * not exposed (codex-rs unified_exec/exec_command.rs pre_tool_use_payload). The
 * effective directory is therefore the hook cwd plus in-command `cd`, `git -C`,
 * `--git-dir` and `--work-tree` (and `tool_input.workdir` if a host ever sends it).
 * Every probe failure allows: a guard error must never block an unrelated command.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveSessionSource } from "./session-source.js";
import { isCanonicalSessionId } from "./state.js";
import { canonicalize, splitSegments, tokenize } from "./worktree-guard.js";






const ALLOW                   = { action: "allow" };

const GIT_WRITE_VERBS = new Set([
  "cherry-pick", "commit", "merge", "rebase", "reset", "checkout", "switch",
  "am", "revert", "push", "pull",
]);
const RECOVERY_FLAGS = new Set(["--abort", "--quit"]);
const BRANCH_WRITE_FLAG = /^(-[dDfmMcC]+|--delete|--force|--move|--copy)$/;
const GH_RISKY = new Set(["pr merge", "pr close", "issue close", "release delete", "repo delete"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
const MAX_DEPTH = 3;

function base(p        )         {
  const norm = p.replace(/\\/g, "/");
  return norm.slice(norm.lastIndexOf("/") + 1);
}



/** Drop sudo/command/builtin/env prefixes and leading VAR=value assignments. */
function strip(tokens          )             {
  const assigns                         = {};
  let rest = tokens;
  for (;;) {
    const head = rest[0];
    if (head === undefined) break;
    const name = base(head);
    if (name === "sudo" || name === "command" || name === "builtin" || name === "env") {
      rest = rest.slice(1);
      continue;
    }
    const assign = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(head);
    if (assign) {
      assigns[assign[1]] = assign[2];
      rest = rest.slice(1);
      continue;
    }
    break;
  }
  return { tokens: rest, assigns };
}









/** Parse `git [global options] <verb> ...`; null when the segment is not git. */
export function parseGitCall(segment        , cwd        )                 {
  const { tokens, assigns } = strip(tokenize(segment));
  if (!tokens.length || base(tokens[0]) !== "git") return null;
  let dir = cwd;
  const probeArgs           = [];
  const args = tokens.slice(1);
  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (tok === "-C" && i + 1 < args.length) { dir = resolve(dir, args[++i]); continue; }
    if (tok === "-c" && i + 1 < args.length) { i++; continue; }
    if ((tok === "--git-dir" || tok === "--work-tree") && i + 1 < args.length) {
      probeArgs.push(`${tok}=${resolve(dir, args[++i])}`);
      continue;
    }
    const eq = /^(--git-dir|--work-tree)=(.+)$/.exec(tok);
    if (eq) { probeArgs.push(`${eq[1]}=${resolve(dir, eq[2])}`); continue; }
    if (tok.startsWith("-")) continue;
    const rest = args.slice(i + 1);
    let write = GIT_WRITE_VERBS.has(tok) && !rest.some((r) => RECOVERY_FLAGS.has(r));
    if (tok === "branch") write = rest.some((r) => BRANCH_WRITE_FLAG.test(r));
    return { verb: tok, write, dir, probeArgs, assigns };
  }
  return null;
}

/** The risky mutation a command body would run, or null. */
export function riskyMutation(body        )                {
  for (const segment of splitSegments(body)) {
    const git = parseGitCall(segment, "/");
    if (git?.write) return `git ${git.verb}`;
    const { tokens } = strip(tokenize(segment));
    if (tokens.length >= 3 && base(tokens[0]) === "gh") {
      const action = `${tokens[1]} ${tokens[2]}`;
      if (GH_RISKY.has(action)) return `gh ${action}`;
    }
  }
  return null;
}



/** End index of a quoted heredoc body whose operator ends at `from`. */
function quotedHeredocEnd(command        , from        , delim        , dash         )         {
  const start = command.indexOf("\n", from);
  if (start === -1) return command.length;
  let pos = start + 1;
  for (;;) {
    const nl = command.indexOf("\n", pos);
    const line = command.slice(pos, nl === -1 ? command.length : nl);
    if ((dash ? line.replace(/^\t+/, "") : line) === delim) return nl === -1 ? command.length : nl;
    if (nl === -1) return command.length;
    pos = nl + 1;
  }
}

/**
 * Command substitutions the invoking shell will execute: backtick and `$(...)`
 * outside single quotes and outside quoted-delimiter heredocs. `$((` arithmetic is
 * not a substitution. Unterminated forms are a shell parse error and run nothing.
 */
export function findSubstitutions(command        )                 {
  const out                 = [];
  let inSingle = false;
  let inDouble = false;
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (inSingle) {
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (ch === "\\") { i += 2; continue; }
    if (ch === "'" && !inDouble) { inSingle = true; i++; continue; }
    if (ch === '"') { inDouble = !inDouble; i++; continue; }
    if (!inDouble && ch === "<" && command[i + 1] === "<" && command[i + 2] !== "<") {
      const m = /^<<(-?)\s*(?:'([^']+)'|"([^"]+)"|\\(\w+))/.exec(command.slice(i));
      if (m) {
        const delim = m[2] ?? m[3] ?? m[4];
        i = quotedHeredocEnd(command, i + m[0].length, delim, m[1] === "-");
        continue;
      }
    }
    if (ch === "`") {
      let j = i + 1;
      let body = "";
      while (j < command.length && command[j] !== "`") {
        if (command[j] === "\\" && j + 1 < command.length) { body += command[j + 1]; j += 2; continue; }
        body += command[j];
        j++;
      }
      if (j >= command.length) break;
      out.push({ body, kind: "backtick", inDoubleQuotes: inDouble });
      i = j + 1;
      continue;
    }
    if (ch === "$" && command[i + 1] === "(" && command[i + 2] !== "(") {
      let depth = 1;
      let j = i + 2;
      let quote                = null;
      while (j < command.length && depth > 0) {
        const c = command[j];
        if (quote) {
          if (c === quote) quote = null;
          else if (c === "\\" && quote === '"') j++;
        } else if (c === "'" || c === '"') quote = c;
        else if (c === "\\") j++;
        else if (c === "(") depth++;
        else if (c === ")") depth--;
        j++;
      }
      if (depth !== 0) break;
      out.push({ body: command.slice(i + 2, j - 1), kind: "dollar", inDoubleQuotes: inDouble });
      i = j;
      continue;
    }
    i++;
  }
  return out;
}

/** `sh|bash|zsh -c PAYLOAD` payloads; the inner shell expands their substitutions. */
function shellPayloads(command        )           {
  const payloads           = [];
  for (const segment of splitSegments(command)) {
    const { tokens } = strip(tokenize(segment));
    if (!tokens.length || !SHELLS.has(base(tokens[0]))) continue;
    for (let i = 1; i < tokens.length - 1; i++) {
      if (/^-[a-z]*c[a-z]*$/.test(tokens[i])) { payloads.push(tokens[i + 1]); break; }
    }
  }
  return payloads;
}



function scanSubstitutions(command        , depth        )            {
  let advisory                = null;
  for (const sub of findSubstitutions(command)) {
    const risky = riskyMutation(sub.body);
    if (risky) return { risky, advisory };
    if (depth < MAX_DEPTH) {
      const inner = scanSubstitutions(sub.body, depth + 1);
      if (inner.risky) return inner;
    }
    if (advisory === null && sub.kind === "backtick" && sub.inDoubleQuotes) advisory = sub.body;
  }
  if (depth < MAX_DEPTH) {
    for (const payload of shellPayloads(command)) {
      const inner = scanSubstitutions(payload, depth + 1);
      if (inner.risky) return inner;
      if (advisory === null) advisory = inner.advisory;
    }
  }
  return { risky: null, advisory };
}



function probeEnv(assigns                        )                    {
  const env = { ...process.env };
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[name];
  return { ...env, ...assigns };
}

function probeRepo(dir        , probeArgs          , assigns                        )                      {
  try {
    const out = execFileSync(
      "git",
      [...probeArgs, "rev-parse", "--path-format=absolute", "--git-common-dir", "--absolute-git-dir"],
      { cwd: dir, env: probeEnv(assigns), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 },
    ).trim().split(/\r?\n/);
    if (out.length < 2) return null;
    return { commonDir: canonicalize(out[0]), gitDir: canonicalize(out[1]) };
  } catch {
    return null;
  }
}









function boundSource(ctx                  )                                            {
  if (!ctx.sessionId || !isCanonicalSessionId(ctx.sessionId)) return null;
  if (!existsSync(join(ctx.sessionCwd, ".codexclaw", "sources", `${ctx.sessionId}.json`))) return null;
  try {
    const root = resolveSessionSource(ctx.sessionCwd, ctx.sessionId);
    const id = probeRepo(root, [], {});
    return id ? { root, id } : null;
  } catch {
    return null;
  }
}

function sourceGuard(command        , ctx                  )                   {
  let segCwd = ctx.startDir;
  let source                                                       ;
  for (const segment of splitSegments(command)) {
    const tokens = tokenize(segment);
    if (tokens[0] === "cd" && tokens[1]) { segCwd = resolve(segCwd, tokens[1]); continue; }
    const git = parseGitCall(segment, segCwd);
    if (!git?.write) continue;
    if (source === undefined) source = boundSource(ctx);
    if (!source) return ALLOW;
    const target = probeRepo(git.dir, git.probeArgs, git.assigns);
    if (!target) continue;
    if (target.commonDir === source.id.commonDir && target.gitDir !== source.id.gitDir) {
      return { action: "deny", reason: sourceDenyReason(git, source.root) };
    }
  }
  return ALLOW;
}

function sourceDenyReason(git         , sourceRoot        )         {
  return [
    `[codexclaw: WORKTREE-GUARD-04] Denied git ${git.verb}: target ${canonicalize(git.dir)} differs from source ${sourceRoot}.`,
    `Use \`git -C ${sourceRoot} ${git.verb} ...\`. Owner: $codexclaw:cxc-worktree-guardian SKILL.md.`,
  ].join(" ");
}

function substDenyReason(risky        )         {
  return `[codexclaw: SHELL-SUBST-01] Shell would execute \`${risky}\`. Use apply_patch, quoted heredoc, file or --body-file. Owner: $codexclaw:cxc-dev SKILL.md.`;
}

function substAdvisory(body        )         {
  const shown = body.length > 60 ? `${body.slice(0, 57)}...` : body;
  return `[codexclaw: SHELL-SUBST-01 advisory] Shell executes backticks \`${shown}\` in double quotes. Use a quoted heredoc or file. Owner: $codexclaw:cxc-dev SKILL.md.`;
}

export function evaluateGitSafety(command        , ctx                  )                   {
  if (!command || !command.trim()) return ALLOW;
  const scan = scanSubstitutions(command, 0);
  if (scan.risky) return { action: "deny", reason: substDenyReason(scan.risky) };
  const source = sourceGuard(command, ctx);
  if (source.action !== "allow") return source;
  if (scan.advisory !== null) return { action: "advise", context: substAdvisory(scan.advisory) };
  return ALLOW;
}

/** PreToolUse entry; cli.ts calls it after WORKTREE-GUARD-03 allows. Never throws. */
export function handleGitWriteGuardPreTool(rawStdin        )         {
  let payload                         ;
  try {
    const parsed = JSON.parse(rawStdin)           ;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
    payload = parsed                           ;
  } catch {
    return "";
  }
  if (payload.hook_event_name !== "PreToolUse") return "";
  const toolName = typeof payload.tool_name === "string" ? payload.tool_name : "";
  if (toolName && toolName !== "Bash") return "";
  const cwd = typeof payload.cwd === "string" ? payload.cwd : "";
  const input = payload.tool_input;
  if (!cwd || !input || typeof input !== "object" || Array.isArray(input)) return "";
  const fields = input                           ;
  const command = typeof fields.command === "string" ? fields.command : "";
  if (!command) return "";
  const workdir = typeof fields.workdir === "string" && fields.workdir ? resolve(cwd, fields.workdir) : cwd;
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  const verdict = evaluateGitSafety(command, { startDir: workdir, sessionCwd: cwd, sessionId });
  if (verdict.action === "allow") return "";
  const hookSpecificOutput = verdict.action === "deny"
    ? { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: verdict.reason, additionalContext: verdict.reason }
    : { hookEventName: "PreToolUse", permissionDecision: "allow", additionalContext: verdict.context };
  return `${JSON.stringify({ hookSpecificOutput })}\n`;
}
