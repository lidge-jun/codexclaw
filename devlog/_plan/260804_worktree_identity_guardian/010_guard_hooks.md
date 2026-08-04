# 010 — WP2: worktree-guard hook module (diff-level)

Scope IN: `plugins/codexclaw/components/pabcd-state/` (one new module + cli wiring +
one new test file), three new hook JSONs under `plugins/codexclaw/hooks/`,
`plugins/codexclaw/.codex-plugin/plugin.json` hooks array, regenerated `dist/`.
Scope OUT: other components, skills (020), docs-site, any runtime behavior change to
existing events.

## NEW `plugins/codexclaw/components/pabcd-state/src/worktree-guard.ts`

Pure, dependency-light module. No git subprocess (hook latency; detection is
path-based only). Exports:

```ts
export interface WorktreeIdentity {
  managed: boolean;          // cwd is inside <codexHome>/worktrees/
  worktreesDir: string;      // resolved <codexHome>/worktrees (always set)
  slot: string | null;       // first path segment under worktreesDir (e.g. "7627")
  worktreeRoot: string | null; // worktreesDir/<slot> — conservative root bound
}
export function resolveCodexHome(env: NodeJS.ProcessEnv): string
//   env.CODEX_HOME ?? join(os.homedir(), ".codex")
export function detectManagedWorktree(cwd: string, env): WorktreeIdentity
//   managed = path.resolve(cwd) starts with worktreesDir + sep (or equals it)
//   slot = first segment of the relative path; worktreeRoot = join(worktreesDir, slot)
//   Note: root bound is the SLOT dir, not the repo subdir — deleting the slot
//   destroys the session's cwd regardless of repo nesting depth.
export function buildSessionStartContext(id: WorktreeIdentity): string
//   "" when !id.managed; else the identity block (below).
export function detectRenameIntent(prompt: string): boolean
//   /worktree|워크트리/i AND /rename|re-?name|이름|명명|바꾸|바꿔|지어|짓/i
export function buildRenameGuidance(id: WorktreeIdentity): string
//   the safe-procedure block (below).
export type GuardVerdict = { action: "allow" } | { action: "deny"; reason: string }
export function evaluateCommand(command: string, cwd: string, id: WorktreeIdentity): GuardVerdict
//   allow when !id.managed. Tokenize whitespace/quote-aware (minimal).
//   DENY when a token sequence matches:
//     - `git worktree remove|prune` ... <path> where resolve(cwd, path) equals
//       worktreeRoot OR is an ancestor of (or equal to) cwd  [prune included:
//       pruning while cwd sits inside a stale-registered worktree can unlink us]
//     - `rm` with any of -r/-R/-f combined flags AND a target that resolves to
//       worktreeRoot, cwd, or an ancestor of cwd up to worktreesDir
//   Everything else: allow. Unknown/garbled input: allow (fail-open; hook errors
//   must never block codex — cli.ts fail-safe contract).
export function handleWorktreeGuard(rawStdin: string): string
//   JSON.parse(rawStdin) in try/catch → "" on failure.
//   dispatch on payload.hook_event_name:
//     "SessionStart"     → buildContextOutput("SessionStart", buildSessionStartContext(detect(cwd)))
//     "UserPromptSubmit" → when managed AND detectRenameIntent(prompt):
//                          buildContextOutput("UserPromptSubmit", buildRenameGuidance(id))
//     "PreToolUse"       → evaluateCommand(extractCommand(payload), cwd, id);
//                          deny → deny envelope (goal-gate.ts shape, below); allow → ""
//   extractCommand: payload.tool_input?.cmd ?? .command ?? (string)tool_input ?? ""
```

Reuse `buildContextOutput` imported from `./hook.ts`. Deny envelope shape copied
from `goal-gate.ts:112-117`:
`JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason, additionalContext: reason } }) + "\n"`.

### Injection text: SessionStart identity block (WORKTREE-GUARD-01)

```
[codexclaw: MANAGED WORKTREE — identity guard (WORKTREE-GUARD-01)]
This session runs inside a Codex-app-managed worktree: <worktreeRoot>
(cwd: <cwd>; worktrees root: <worktreesDir>).
- This thread is BOUND to this worktree. NEVER delete, recreate, or "start fresh"
  to rename it — that destroys uncommitted work and breaks the app binding.
- App worktrees usually start detached-HEAD: the "worktree name" is the directory
  slot, not a branch. branch ≠ worktree ≠ thread title (three namespaces).
- To name/rename: stay here; `git worktree move <old> <new>` renames the directory;
  `git branch -m <name>` (or `git switch -c <name>`) names a branch. Neither renames
  the app thread — the user does that in the app sidebar.
- The app may auto-delete this worktree when the chat is archived (snapshot kept)
  and retains only the latest N managed worktrees: commit early, push on approval.
- Load $codexclaw:worktree-guardian for the full procedure set.
```

### Injection text: rename-intent guidance (WORKTREE-GUARD-02)

Compact procedure list: adopt-in-place default; exact `git worktree move` /
`git branch -m` / `git worktree repair` sequences; "do not `git worktree remove` or
rm the current worktree"; thread-title rename is app-side only.

### Deny reason (WORKTREE-GUARD-03)

Names the matched command, the protected path, and remedies: finish+commit here;
move instead of remove; if teardown is truly intended the user archives the thread
in the app (snapshot preserved) or removes it from OUTSIDE this session.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

1. Import: `import { handleWorktreeGuard } from "./worktree-guard.ts";`
2. In the fail-safe `try` dispatch (after the `pre-tool-use-lint` branch), add:
   `} else if (event === "worktree-guard") { output = handleWorktreeGuard(raw); }`
   Deliberately inside the generic fail-open try (hook errors → silence, never a
   block). NOT in the fail-closed pre-tool-use dispatcher (that one is scoped to
   request_user_input/create_goal).

## NEW hook JSONs (registered in plugin.json `hooks` array, order: after the
existing session-start entries / with their event groups)

- `hooks/session-start-detecting-managed-worktree.json`:
  SessionStart → `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook worktree-guard`,
  timeout 10, statusMessage "(codexclaw) Checking managed-worktree identity".
- `hooks/user-prompt-submit-guiding-worktree-rename.json`:
  UserPromptSubmit, same command, timeout 10, "(codexclaw) Checking worktree rename intent".
- `hooks/pre-tool-use-guarding-managed-worktree-deletion.json`:
  PreToolUse, same command, timeout 10, "(codexclaw) Guarding managed worktree".
  NO `matcher`: shell-tool names differ across surfaces (Bash/shell/exec_command);
  the handler extracts the command itself and returns "" for non-shell payloads
  (precedent: goal-gate.ts reads tool_name from the payload instead of trusting
  the matcher).

## MODIFY `plugins/codexclaw/.codex-plugin/plugin.json`

Append the three hook paths to the `hooks` array (keep existing order intact).

## NEW `plugins/codexclaw/components/pabcd-state/test/worktree-guard.test.ts`

`node --test`, imports from `../src/worktree-guard.ts`. Cases:
1. detect: cwd under default `~/.codex/worktrees/<slot>/<repo>` → managed, slot,
   root = slot dir; CODEX_HOME env override honored; non-worktree cwd → not managed;
   cwd == worktreesDir itself → managed=false (no slot).
2. SessionStart: managed → envelope contains WORKTREE-GUARD-01 + the root path;
   non-managed → "".
3. UserPromptSubmit: managed + "워크트리 이름 바꾸고 싶어" → guidance envelope;
   managed + unrelated prompt → ""; non-managed + rename prompt → "".
4. PreToolUse: `git worktree remove <ownRoot>` → deny envelope w/ permissionDecision;
   `rm -rf <ownRoot>` and `rm -rf .` (cwd == root) → deny;
   `git worktree remove <other path>` → allow; `git status` → allow;
   malformed JSON stdin → "" (fail-open); non-managed cwd + rm -rf own cwd → allow.
5. Envelope shape parity: parse deny/context JSON, assert hookSpecificOutput keys.

## Build/dist

`node plugins/codexclaw/scripts/build.mjs` regenerates `components/pabcd-state/dist/`
(type-stripped). dist is gitignored → force-add with `git add -f` per repo
convention (memory: fresh-install orchestrate stabilization, Task 2).

## Accept criteria + activation scenarios (C-ACTIVATION-GROUNDING-01)

- A1: full `node --test` in pabcd-state exits 0 (fresh output).
- A2 (activation): live-fire SessionStart payload with
  cwd `/Users/jun/.codex/worktrees/probe-slot/repo` against dist/cli.js → stdout
  contains WORKTREE-GUARD-01 (proves the shipped dist path, not just src tests).
- A3 (activation): live-fire PreToolUse `git worktree remove` on the probe root →
  stdout deny envelope. Live-fire `git status` → empty stdout.
- A4: `plugin.json` hooks paths all exist on disk (build.mjs manifest validation).
