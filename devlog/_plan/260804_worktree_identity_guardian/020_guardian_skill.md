# 020 — WP3: worktree-guardian skill (diff-level)

Scope IN: one new skill folder `plugins/codexclaw/skills/worktree-guardian/`
(single `SKILL.md`, no references/ — the content fits one file).
Scope OUT: hook code (010), docs-site, README (a one-line skill-list mention only
if the README already enumerates skills — check during B; otherwise skip).

## NEW `plugins/codexclaw/skills/worktree-guardian/SKILL.md`

Frontmatter:
```yaml
---
name: cxc-worktree-guardian
description: "MUST USE when working inside or renaming Codex-app managed worktrees — hash-named dirs under ~/.codex/worktrees, detached-HEAD checkouts, thread-bound workspaces. Prevents delete-and-recreate: adopt/rename in place with git worktree move + branch -m. Triggers: worktree, 워크트리, 워크트리 이름, rename worktree, 새 워크트리, 브랜치랑 워크트리, detached HEAD worktree, ~/.codex/worktrees."
metadata:
  short-description: "Managed-worktree identity safety: never delete/recreate; rename in place."
---
```

Body sections (concise, English; rule ids WG-*):

1. **Three namespaces (WG-CONCEPT-01)** — table: branch (git ref, `git branch -m`),
   worktree (directory + .git/worktrees admin entry, `git worktree move`),
   thread title (Codex app sidebar, user-renames-in-app only). "Name the worktree"
   from a user can mean any of the three → confirm which, default to directory +
   branch naming in place.
2. **Managed-worktree facts (WG-FACTS-01)** — $CODEX_HOME/worktrees root,
   detached-HEAD start, per-chat disposable lifecycle, latest-15 retention,
   archive→snapshot+auto-delete; each fact one line with its source URL
   (developers.openai.com git-worktrees page; issues #10917, #14498).
3. **Never-list (WG-NEVER-01)** — no `git worktree remove` / `rm -rf` on the
   session's own worktree; no "fresh clone/copy then delete"; no deleting a
   sibling session's worktree without explicit user naming of that path.
4. **Safe procedures (WG-PROC-*)** —
   - Rename directory: `git worktree move <old> <new>` (+ caveats: not main
     worktree, no submodule-containing worktree, git ≥ 2.35).
   - Name a branch: `git switch -c <name>` or `git branch -m <name>` from inside
     the worktree (detached HEAD → switch -c).
   - Recover from manual move: `git worktree repair <new>`.
   - Adopt-and-continue recipe for "이름 붙이고 새로 시작": stay, create branch,
     commit WIP, optionally move dir, tell user to rename thread in app.
   - Cleanup of OTHER worktrees: verify clean + merged + no open PR + not a
     session cwd; prefer `git worktree remove`, never `rm -rf`.
5. **Hook interplay (WG-HOOK-01)** — what WORKTREE-GUARD-01/02/03 injections mean
   and that the PreToolUse deny is intentional; remedy = follow the procedures
   above instead of bypassing.
6. **AGENTS.md snippet (WG-AGENTS-01)** — copy-paste block users can drop into
   repos for projects without codexclaw hooks.

Length target: ≤ 120 lines (skill, not a manual; cites 000_research.md sources).

## Accept criteria

- A1: skill folder picked up by the plugin skills dir (`"skills": "./skills/"` in
  plugin.json — no manifest edit needed).
- A2: description triggers cover the Korean phrasings from the user report.
- A3: every procedure command matches git-scm semantics verified in 000_research.md §4.
