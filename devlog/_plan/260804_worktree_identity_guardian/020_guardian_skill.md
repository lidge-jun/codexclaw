# 020 — WP3: worktree-guardian skill (diff-level, rev2 post-audit)

rev2 changes (B1, B8, B9, B10): adopt-in-place is THE current-worktree procedure
(`git worktree move` demoted to inactive worktrees); `agents/openai.yaml` added;
skill counts in README/structure/INDEX enter scope; version gates replaced by
feature detection.

Scope IN: one new skill folder `plugins/codexclaw/skills/worktree-guardian/`
(`SKILL.md` + `agents/openai.yaml`, no references/ — the content fits one file);
skill-count/list mentions in README.md / structure/INDEX.md / skills/README.md
(whichever enumerate skills — check during B).
Scope OUT: hook code (010), docs-site.

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

`agents/openai.yaml` (precedent: skills/loop/agents/openai.yaml):
```yaml
interface:
  display_name: "cxc-worktree-guardian"
  short_description: "Managed-worktree identity safety - adopt/rename in place, never delete/recreate (워크트리 이름/삭제 방지)."
policy:
  allow_implicit_invocation: true
```

Body sections (concise, English; rule ids WG-*):

1. **Three namespaces (WG-CONCEPT-01)** — table: branch (git ref, `git branch -m`),
   worktree (directory + .git/worktrees admin entry), thread title (Codex app
   sidebar, user-renames-in-app only). "Name the worktree" from a user can mean
   any of the three → confirm which; default = branch naming in place + tell the
   user to rename the thread in the app.
2. **Managed-worktree facts (WG-FACTS-01)** — $CODEX_HOME/worktrees root,
   detached-HEAD start, per-chat disposable lifecycle, latest-15 retention,
   archive→snapshot+auto-delete; each fact one line with its source URL
   (developers.openai.com git-worktrees page; issues #10917, #14498).
3. **Never-list (WG-NEVER-01)** — no `git worktree remove` / `rm -rf` on the
   session's own worktree; no "fresh clone/copy then delete"; no deleting a
   sibling session's worktree without explicit user naming of that path.
4. **Safe procedures (WG-PROC-*)** —
   - Adopt-and-continue (DEFAULT for "이름 붙이고 새로 시작"): stay in the
     worktree; `git switch -c <name>` from detached HEAD (or `git branch -m
     <name>`); commit WIP; tell the user to rename the thread in the app.
   - NEVER `git worktree move` the ACTIVE worktree (WG-MOVE-01): the session's
     cwd dies (next command ENOENT) and app rebinding is undocumented. Move is
     only for OTHER/inactive worktrees: `git worktree move <old> <new>` (not the
     main worktree; refuses submodule-containing/locked worktrees; feature-detect
     with `git worktree move -h`, no version arithmetic).
   - Recover from manual move: `git worktree repair <new>` (feature-detect with
     `git worktree repair -h`).
   - Cleanup of OTHER worktrees: verify clean + merged + no open PR + not any
     session's cwd; prefer `git worktree remove`, never `rm -rf`.
5. **Defense-in-depth limits (WG-LIMIT-01)** — the PreToolUse guard matches
   literal paths; variable/glob-indirected deletions that never mention the slot
   path are out of scope (residual risk, accepted). Detection covers the default
   `$CODEX_HOME/worktrees` root + `CODEXCLAW_WORKTREE_ROOTS`; a custom app root
   needs that env.
6. **Hook interplay (WG-HOOK-01)** — what WORKTREE-GUARD-01/02/03 injections mean
   and that the PreToolUse deny is intentional; remedy = follow the procedures
   above instead of bypassing.
7. **AGENTS.md snippet (WG-AGENTS-01)** — copy-paste block users can drop into
   repos for projects without codexclaw hooks.

Length target: ≤ 120 lines (skill, not a manual; cites 000_research.md sources).

## Accept criteria

- A1: skill folder picked up by the plugin skills dir (`"skills": "./skills/"` in
  plugin.json — no manifest edit needed).
- A2: description triggers cover the Korean phrasings from the user report.
- A3: every procedure command matches git-scm semantics verified in 000_research.md §4.
