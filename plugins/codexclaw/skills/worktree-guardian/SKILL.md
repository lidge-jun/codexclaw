---
name: cxc-worktree-guardian
description: "MUST USE when working inside or renaming Codex-app managed worktrees — hash-named dirs under ~/.codex/worktrees, detached-HEAD checkouts, thread-bound workspaces. Prevents delete-and-recreate: adopt in place with git switch -c / branch -m; git worktree move only for other inactive worktrees. Triggers: worktree, 워크트리, 워크트리 이름, rename worktree, 새 워크트리, 브랜치랑 워크트리, detached HEAD worktree, ~/.codex/worktrees."
metadata:
  short-description: "Managed-worktree identity safety: never delete/recreate; adopt in place."
---

# Worktree Guardian — Codex-app managed worktrees

The Codex desktop app creates one worktree per thread under `$CODEX_HOME/worktrees/`
(hash or date-slug slot dirs, e.g. `~/.codex/worktrees/7627/opencodex`), checked out
from the selected base branch, usually **detached HEAD**. These sessions look like
scratch directories but are not: the app binds the thread to that directory.

## 1. Three namespaces (WG-CONCEPT-01)

| Namespace | What it is | How to rename |
|-----------|-----------|---------------|
| branch | a git ref | `git branch -m <name>` (or `git switch -c <name>` from detached HEAD), run inside the worktree |
| worktree | a directory + its `.git/worktrees/<id>` admin entry | `git worktree move <old> <new>` — never for the ACTIVE one (WG-MOVE-01) |
| thread title | the Codex app sidebar entry | the user renames it in the app; agents cannot |

"워크트리 이름 붙여줘 / name the worktree" can mean any of these. Default:
name the branch in place and tell the user to rename the thread in the app.

## 2. Managed-worktree facts (WG-FACTS-01)

- Root: `$CODEX_HOME/worktrees` (default `~/.codex/worktrees`); the app setting can
  move it (Settings → Worktrees) — codexclaw detection then needs
  `CODEXCLAW_WORKTREE_ROOTS` (WG-LIMIT-01).
- Managed worktrees are per-chat disposable; the app retains the latest N (15 by
  default) and **auto-deletes the worktree when the chat is archived** (a snapshot
  is kept for restore). Commit early.
- Source: developers.openai.com/codex/environments/git-worktrees; identity fragility
  is a known upstream area (openai/codex issues #10917, #10522, #14498, #34662;
  naming contract still a proposal, #12862).

## 3. Never-list (WG-NEVER-01)

- Never `git worktree remove` or `rm -rf` the session's OWN worktree, slot dir, or
  any ancestor of cwd — not even to "start clean". codexclaw's PreToolUse guard
  (WORKTREE-GUARD-03) denies it; do not try to bypass the deny.
- Never copy the work elsewhere and delete the original — that loses the app
  binding and any uncommitted state you missed.
- Never delete another slot under `~/.codex/worktrees` without the user explicitly
  naming that path — another live session may be bound to it.

## 4. Safe procedures (WG-PROC-*)

**Adopt-and-continue (DEFAULT for "이름 붙이고 새로 시작"):**
1. Stay in the worktree. `git switch -c <name>` (detached HEAD) or
   `git branch -m <name>`.
2. Commit the work in progress (archive auto-deletes managed worktrees).
3. Tell the user the thread title can be renamed in the app sidebar.

**Move/repair — OTHER, inactive worktrees only (WG-MOVE-01):**
`git worktree move <old> <new>` (refuses the main worktree, locked worktrees, and
worktrees containing submodules). After a manual directory move:
`git worktree repair <new-path>`. Feature-detect with `git worktree move -h` /
`git worktree repair -h`; do not version-gate. Moving the ACTIVE worktree kills the
session's cwd (next command: ENOENT) and app rebinding is undocumented — don't.

**Cleanup of other worktrees:** verify clean (`git status`), merged
(`git merge-base --is-ancestor`), no open PR head, not any session's cwd; then
`git worktree remove <path>` — never `rm -rf`. A directory deleted without
`git worktree remove` leaves admin state under `.git/worktrees/`; recover with
`git worktree prune` (dry-run first).

## 5. Defense-in-depth limits (WG-LIMIT-01)

- The PreToolUse guard matches literal paths. Pure variable/glob indirection that
  never mentions the slot path is out of scope — treat the deny as a seatbelt, not
  a sandbox.
- Detection covers the default root + `CODEX_HOME` + `CODEXCLAW_WORKTREE_ROOTS`
  (path.delimiter-separated). A custom app-side root needs that env.

## 6. Hook interplay (WG-HOOK-01)

- WORKTREE-GUARD-01 (SessionStart): identity block when cwd is managed.
- WORKTREE-GUARD-02 (UserPromptSubmit): this guidance, once per session, on
  rename intent.
- WORKTREE-GUARD-03 (PreToolUse, `^Bash$`): deterministic deny of self-worktree
  deletion — applies to subagent turns too. The deny is intentional; follow §4
  instead of routing around it.

## 7. AGENTS.md snippet (WG-AGENTS-01)

For repos where codexclaw hooks are not installed:

```md
## Worktree safety
This session may run inside a Codex-app-managed worktree (~/.codex/worktrees/<slot>/<repo>).
Never delete or recreate that directory to "rename" it. Adopt in place:
`git switch -c <name>` / `git branch -m <name>`, commit early, and ask the user to
rename the thread in the app. `git worktree move` is for other, inactive worktrees only.
```
