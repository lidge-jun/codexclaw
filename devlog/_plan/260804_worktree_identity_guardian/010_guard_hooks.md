# 010 — WP2: worktree-guard hook module (diff-level, rev2 post-audit)

rev2 changes vs rev1 (audit blockers B1-B7, FQ6): adopt-in-place replaces
`git worktree move` as the current-worktree procedure; slotRoot/checkoutRoot split;
PreToolUse enforcement runs for subagents too via a dedicated CLI event; matcher
`^Bash$` + `tool_input.command`; expanded command grammar + conservative-deny
fallback; custom roots via CODEXCLAW_WORKTREE_ROOTS; realpath canonicalization;
once-per-session rename guidance.

Scope IN: `plugins/codexclaw/components/pabcd-state/` (new `src/worktree-guard.ts`,
`src/cli.ts` wiring, new `test/worktree-guard.test.ts`), three new hook JSONs under
`plugins/codexclaw/hooks/`, `plugins/codexclaw/.codex-plugin/plugin.json` hooks
array, regenerated `dist/`, README.md hook count texts (18→21: badge line ~18,
"approve the 18 hooks" ~57, "18 active hooks" ~106), structure/INDEX.md hook
table/list mentions.
Scope OUT: other components, skills (020), docs-site, existing event behavior.

## NEW `plugins/codexclaw/components/pabcd-state/src/worktree-guard.ts`

Path/fs-only detection (no subprocess). API:

```ts
export interface WorktreeIdentity {
  managed: boolean;
  worktreesDir: string;        // the root that matched (per root in candidate list)
  slot: string | null;         // first segment under worktreesDir
  slotRoot: string | null;     // <worktreesDir>/<slot> — DELETION boundary
  checkoutRoot: string | null; // nearest ancestor of cwd containing a .git entry,
                               // capped at slotRoot; fallback slotRoot — git target
}
export function candidateWorktreeRoots(env): string[]
//   [ resolveCodexHome(env)+"/worktrees", ...split(env.CODEXCLAW_WORKTREE_ROOTS, ":") ]
export function resolveCodexHome(env): string          // env.CODEX_HOME ?? ~/.codex
export function canonicalize(p: string): string
//   realpathSync.native(p) when it exists; else realpath nearest existing
//   ancestor + append remainder (macOS symlink/case safety, B7)
export function detectManagedWorktree(cwd: string, env): WorktreeIdentity
//   canonicalize(cwd); managed when under a canonicalized candidate root (+sep);
//   cwd == root itself → managed=false (no slot)
export function buildSessionStartContext(id): string   // "" when !managed
export function detectRenameIntent(prompt: string): boolean
//   /worktree|워크트리/i AND /rename|re-?name|이름|명명|바꾸|바꿔|지어|짓/i
//   advisory-only; negation false positives accepted (FQ6 residual)
export function buildRenameGuidance(id): string
export type GuardVerdict = { action: "allow" } | { action: "deny"; reason: string }
export function evaluateCommand(command: string, cwd: string, id, env): GuardVerdict
export function handleWorktreeGuard(rawStdin: string): string        // context events
export function handleWorktreeGuardPreTool(rawStdin: string): string // enforcement
```

### Command grammar (B5)

1. Split the raw command into segments on `&&`, `||`, `;`, `|` (quote-aware minimal:
   single/double quotes protected).
2. Per segment, strip leading prefixes `sudo`, `env ...`, `command`, `builtin`.
3. Executable match by basename: `rm`, `rmdir`, `unlink`, `git`.
4. `rm`/`rmdir`/`unlink`: recursive/force detection via clustered short flags
   (`-rf`, `-fr`, `-r -f`, ...) or long flags (`--recursive`, `--force`); `--`
   ends flag parsing. Each non-flag token is a target path.
5. `git`: scan for `-C <path>` (sets effective cwd for that segment) then
   `worktree remove <path>` (also `--force` variants). `worktree prune` is NOT
   denied (no path arg; does not delete an existing directory).
6. Target classification: canonicalize(resolve(segmentCwd, target)) → DENY when it
   equals `slotRoot`, equals/ancestor-of canonicalized cwd, or equals
   `checkoutRoot`. Else allow.
7. Conservative fallback: if a segment contains a destructive basename
   (rm/rmdir/unlink) or `worktree remove` AND the raw command literally mentions
   the slot string or worktreesDir string, but no concrete target could be
   resolved (variable/glob indirection), DENY with an "unresolvable target"
   reason. Everything else: allow. Handler exceptions → "" (fail-open at the cli
   layer), matching the existing fail-safe contract.

### Event split (B3)

- `handleWorktreeGuard` (SessionStart / UserPromptSubmit): called from the generic
  fail-open dispatch — AFTER the subagent early-exit (children get no context).
  UserPromptSubmit: rename guidance only when managed AND intent matched AND no
  once-per-session marker; on inject, write
  `.codexclaw/worktree-guard/<session_id>.json` `{ injectedAt, slot }` (FQ6).
- `handleWorktreeGuardPreTool` (PreToolUse): dispatched in cli.ts ABOVE the
  `isSubagentHookPayload` early-exit (same position class as the fail-closed
  pre-tool-use dispatcher), so child agents are enforced too. Reads
  `tool_input.command` (B4); non-Bash/absent → "".

### Injection text: SessionStart identity block (WORKTREE-GUARD-01)

```
[codexclaw: MANAGED WORKTREE — identity guard (WORKTREE-GUARD-01)]
This session runs inside a Codex-app-managed worktree: <checkoutRoot>
(cwd: <cwd>; slot: <slotRoot>; worktrees root: <worktreesDir>).
- This thread is BOUND to this worktree. NEVER delete, recreate, or "start fresh"
  to rename it — that destroys uncommitted work and breaks the app binding.
- App worktrees usually start detached-HEAD: the "worktree name" is the directory
  slot, not a branch. branch ≠ worktree ≠ thread title (three namespaces).
- To name things, ADOPT IN PLACE: stay here; `git switch -c <name>` (detached) or
  `git branch -m <name>` names the branch; commit early. The app thread title is
  renamed by the user in the app sidebar — agents cannot rename it.
- Do NOT `git worktree move` the ACTIVE worktree: it invalidates this session's
  cwd and app rebinding is not guaranteed. Move only OTHER/inactive worktrees.
- The app may auto-delete this worktree on chat archive (snapshot kept) and
  retains only the latest N managed worktrees: commit early, push on approval.
- Detection covers the default root + CODEXCLAW_WORKTREE_ROOTS; a custom app
  worktree root needs that env. Full procedures: $codexclaw:cxc-worktree-guardian.
```

### Injection text: rename-intent guidance (WORKTREE-GUARD-02, once per session)

Adopt-in-place recipe (switch -c / branch -m / commit / tell user to rename the
thread in-app); move/repair only for inactive worktrees; feature-detect with
`git worktree move -h` (no version gates); never remove the current worktree.

### Deny reason (WORKTREE-GUARD-03)

Names matched command + protected path + remedies: finish & commit here; rename in
place; teardown of THIS session's worktree is done by the user (archive in app —
snapshot preserved — or removal from OUTSIDE this session); even explicit in-session
approval does not unlock self-deletion from inside the session.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

1. Import `handleWorktreeGuard, handleWorktreeGuardPreTool` from `./worktree-guard.ts`.
2. ABOVE the subagent early-exit (next to the fail-closed pre-tool-use dispatcher):
   `if (event === "worktree-guard-pretool") { process.stdout.write(handleWorktreeGuardPreTool(raw)); process.exit(0); }`
   — own try/catch → "" on error (enforcement must fail closed ONLY on confident
   match; handler-internal errors fail open to avoid blocking codex).
3. In the generic fail-open dispatch: `else if (event === "worktree-guard") { output = handleWorktreeGuard(raw); }`.

## NEW hook JSONs (+ plugin.json `hooks` array entries, existing order preserved)

- `hooks/session-start-detecting-managed-worktree.json`: SessionStart →
  `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook worktree-guard`,
  timeout 10, statusMessage "(codexclaw) Checking managed-worktree identity".
- `hooks/user-prompt-submit-guiding-worktree-rename.json`: UserPromptSubmit,
  same command, timeout 10, "(codexclaw) Checking worktree rename intent".
- `hooks/pre-tool-use-guarding-managed-worktree-deletion.json`: PreToolUse,
  command `... hook worktree-guard-pretool`, matcher `"^Bash$"` (B4: codex-rs
  canonical shell hook name; precedent hooks/_deprecated/pre-tool-use-advising-on-friction.json),
  timeout 10, "(codexclaw) Guarding managed worktree".

## NEW `plugins/codexclaw/components/pabcd-state/test/worktree-guard.test.ts`

`node --test`, imports `../src/worktree-guard.ts`. Cases:
1. detect: default `~/.codex/worktrees/<slot>/<repo>` (tmpdir HOME via env) →
   managed, slot, slotRoot, checkoutRoot at the dir containing `.git`;
   CODEX_HOME override; CODEXCLAW_WORKTREE_ROOTS extra root; non-worktree cwd →
   not managed; cwd == root → not managed.
2. canonicalize: symlinked cwd resolves to the real managed path; case-variant
   path on macOS still matches (skip on case-sensitive fs).
3. SessionStart: managed → WORKTREE-GUARD-01 + checkoutRoot; non-managed → "".
4. UserPromptSubmit: managed + "워크트리 이름 바꾸고 싶어" → guidance + marker file
   written; second identical prompt → "" (dedupe); managed + unrelated → "";
   non-managed + rename prompt → "".
5. Grammar: `git worktree remove <checkoutRoot>` deny; `git -C <other> worktree
   remove <checkoutRoot>` deny; `sudo rm -rf <slotRoot>` deny; `/bin/rm -rf .`
   (cwd == checkoutRoot) deny; `rm --recursive --force <checkoutRoot>` deny;
   `cd /tmp && rm -rf <slotRoot>` deny (compound); `rm -rf "$X"` mentioning slot
   string → conservative deny; `git worktree remove <other path>` allow;
   `git worktree prune` allow; `git status` allow; `rm -rf ./build` allow.
6. PreToolUse handler: Bash payload with deny command → deny envelope with
   permissionDecision; subagent-stamped payload (agent_id present) → STILL denied
   (B3); malformed JSON → ""; tool_name != Bash → "".
7. Envelope parity: parsed hookSpecificOutput keys for both context and deny.

## SoT updates (B9)

README.md: badge `hooks-18`→`hooks-21`, "approve the 18 hooks"→21, "18 active
hooks"→21. structure/INDEX.md: add the three hooks to the hook list/table.
(Skills counts change in 020.)

## Build/dist

`node plugins/codexclaw/scripts/build.mjs` regenerates dist; `git add -f` the dist
paths (repo convention, verified by auditor against .gitignore + history).

## Accept criteria + activation scenarios

- A1: full `node --test` in pabcd-state exits 0 (fresh output).
- A2 (activation): live-fire SessionStart payload (cwd under a probe slot with a
  real `.git` file) against dist/cli.js → WORKTREE-GUARD-01 on stdout.
- A3 (activation): live-fire PreToolUse Bash payload `git worktree remove
  <probeCheckout>` → deny envelope; `git status` → empty stdout.
- A4: build.mjs manifest validation passes with 21 hooks (paths exist).
