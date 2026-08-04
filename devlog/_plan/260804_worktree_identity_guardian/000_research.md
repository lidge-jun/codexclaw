# 000 — Research: Codex app managed-worktree identity problem

Date: 2026-08-04. Session: 019fcd33-7aa4-7531-ab25-e9d5ed982303 (WP1 docs-only cycle).
Research method: local codex-rs/codexclaw source inspection (main session) + 4-lane
lunasearch swarm (gpt-5.6-luna/low, cxc-search attached) + main-session Tier-2 source
opens (`gh issue view`, web_search open, agbrowse fetch).

## 1. Problem statement (user-reported, 2026-08-04)

The Codex desktop app creates a worktree per thread from the selected base branch.
These start as unnamed/hash-named directories under `~/.codex/worktrees/`. When the
user later asks to "name the worktree and start properly", agents repeatedly DELETE
the original worktree (including uncommitted work) and create a new one, instead of
renaming/adopting in place. Observed incident: the ocx usage-rollup session worked in
`/Users/jun/.codex/worktrees/7627/opencodex`; the user protested verbatim:
"ENOENT: .../7627/opencodex 여기서 작업하라고 현재 작업도 여기로 옮기고 그 워크트리이름을
제대로 짓고 시작하라는거였어" (attachment pasted-text.txt, 11:17 PM).

## 2. Local evidence (this machine)

- `ls ~/.codex/worktrees` mixes hash slots (`1429`, `250c`, `404d`, `7627`),
  UUID slots (`02319b23-c267-...`, `0cd4515f-...`), and date-slug names
  (`260727-pr526`, `260728-release`, ...). Both namespaces coexist.
- codex-rs local checkout `/Users/jun/Developer/codex/121_openai-codex` @ `2b5bdcf67`
  (2026-08-04): `git-utils/src/info.rs` resolves linked worktrees
  (`file_name() == "worktrees"` → common dir); `config/src/state.rs:225-228` documents
  project config layers for "Linked Git worktrees". `rg "worktree add"` over the whole
  codex-rs tree: **no creation code**. Conclusion: open-source codex-rs only
  *detects/serves* worktrees; creation, naming, retention and teardown are
  desktop-app-side (closed source).

## 3. Upstream behavior (sources opened)

Official docs — https://developers.openai.com/codex/environments/git-worktrees
(lane Popper crawled 2026-08-04; main-session web_search open corroborated;
agbrowse direct fetch mis-redirected to /rss.xml — recorded as fetch quirk):
- Managed worktrees live under `$CODEX_HOME/worktrees`; root configurable in
  Settings > Worktrees.
- Created from the selected starting branch, normally **detached HEAD**.
- Managed worktrees are per-chat disposable; app retains latest 15 by default
  (configurable); archiving the chat auto-deletes the managed worktree after saving
  a restorable snapshot. Permanent worktrees are separate projects, not auto-deleted.
- AGENTS.md is the documented channel for repo-scoped agent instructions;
  hooks/config documented under config-file + hooks pages.

GitHub openai/codex issues (primary):
- #10917 (OPEN, 2026-02-06, verified via `gh issue view`): "Thread disappeared that
  was inside a Project and on a Worktree" — worktree survives, thread binding lost;
  follow-ups (per lane Kierkegaard) report unarchive moving session JSON without
  recreating the worktree and uncommitted-work loss after upgrades.
- #12862 (OPEN, 2026-02-26, verified via `gh issue view`): feature request
  `codex --worktree [name]` with predictable `.codex/worktrees/<name>` — i.e. a
  settled naming contract does NOT exist upstream yet.
- #13367 (lane, 2026-03-03): worktrees hard to find; wants configurable roots;
  "Fork into new worktree" locks the worktree to one thread.
- #10522 (lane, 2026-02-03): worktree threads vanish from sidebar while data
  persists under `$CODEX_HOME/worktrees/...`.
- #14498 (lane, 2026-03-12): renaming the thread leaves the worktree name visually
  dominant — thread-name and worktree-dir-name are SEPARATE namespaces.
- #34662 (lane, 2026-07-22): implementation left in hidden `.worktrees/...` across
  releases; main checkout incomplete until user ordered integration.

## 4. git mechanics (lane Volta; git-scm.com official docs, accessed 2026-08-04)

- `git worktree move <old> <new>` — atomically re-links admin data; refuses locked
  worktrees (unless forced), the main worktree, and worktrees containing submodules.
- `git branch -m <new>` run INSIDE the worktree renames the checked-out branch
  safely (config + reflog included); git only refuses branch mutation when the
  branch is checked out in ANOTHER linked worktree.
- Manual directory move recovery: `git worktree repair <new-path>`.
- Version note (corrected in audit round 1): `move`/`repair` appear already in the
  git 2.30 official docs — do NOT version-gate; feature-detect with
  `git worktree move -h` / `repair -h`.
- Session-safety note (audit round 1, blocker B1): `git worktree move` is git-safe
  but NOT session-safe for the ACTIVE worktree — the running session's cwd is
  invalidated (next command ENOENT, the incident shape) and app rebinding after a
  manual move is undocumented. Adopt-in-place is the default for the current
  worktree; move is for other/inactive worktrees only.
- Deleting the directory without `git worktree remove` leaves admin state in
  `$GIT_COMMON_DIR/worktrees/<id>`; pruned per `gc.worktreePruneExpire`.

## 5. Guardrail precedents (lane Nash)

- Claude Code hooks docs (primary): PreToolUse can inspect Bash input and block
  `rm -rf`; SessionStart/UserPromptSubmit inject context; a dedicated
  WorktreeRemove event cannot be blocked → enforcement must happen at the
  command/tool boundary.
- VS Code agent hooks docs (primary): recommends PreToolUse hooks to deterministically
  block dangerous commands (`rm -rf`, `DROP TABLE`).
- Community pattern (lead): defense-in-depth — prompt/session injection for guidance
  PLUS deterministic PreToolUse denial for destructive ops.

## 6. Failure-mode model (why agents delete + recreate)

1. No in-session signal that cwd is an app-managed worktree → treated as scratch.
2. Branch/worktree concept conflation: "name the worktree" is read as "new branch +
   new checkout", and recreating looks cleaner than renaming.
3. Rename path unknown: agents don't reach for `git worktree move`; and even a
   directory rename does not rename the app thread (#14498), so "fresh start" wins.
4. App-level thread↔worktree binding is invisible from inside the session
   (#10917/#10522 show even the app loses it).

## 7. Design decision

Chosen (A): codexclaw hook-based "worktree guardian":
- SessionStart: detect cwd under `$CODEX_HOME/worktrees/` → inject identity block
  (managed status, base repo, do-not-delete rule, detached-HEAD note, retention fact).
- UserPromptSubmit: worktree rename-intent trigger → inject the adopt-in-place
  procedure (branch -m / switch -c / thread-vs-dir namespace; move only for
  inactive worktrees).
- PreToolUse: deny commands that delete THIS session's own worktree root
  (`git worktree remove <own>`, `rm -rf` of own root/ancestor) with a remedy message.
- New `worktree-guardian` skill: concept explainer + procedures + citations.

Rejected/deferred:
- (B) AGENTS.md-only guidance: per-repo, not present in arbitrary user repos;
  documented inside the skill as a complementary channel instead.
- (C) Blocking ALL `git worktree remove`: breaks legitimate cleanup of OTHER
  worktrees; scope limited to the session's own root.
- (D) `cxc worktree` CLI helper: deferred — hook output already surfaces identity;
  revisit if users ask for a manual query surface.

## 8. Verification status of external claims

| Claim | Status |
|-------|--------|
| Managed worktrees under $CODEX_HOME/worktrees, detached HEAD, retention 15, archive-deletes | verified (docs opened by lane + main web_search) |
| codex-rs has no worktree creation code | verified (local rg @2b5bdcf67) |
| #10917 / #12862 content | verified (gh issue view) |
| #13367 / #10522 / #14498 / #34662 | candidate — lane-opened, not main-session re-opened |
| git worktree move/branch -m/repair semantics | verified (git-scm docs opened by lane) |
| PreToolUse command-boundary enforcement pattern | verified (two primary docs via lane) |
