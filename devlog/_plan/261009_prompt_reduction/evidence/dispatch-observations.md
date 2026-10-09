# Dispatch observations moved from instructions

Moved on 2026-10-09 from the refs lane's pre-edit working-tree snapshot. These
are historical observations, not guarantees of current host behavior. Permission,
identity and source isolation still require current evidence.

## Observation 1

Source: `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md:57-63` (pre-edit lines).

A spawned child inherits the parent's cwd. Measured on 2026-09-13: a probe
subagent reported the parent's `pwd`, the parent's `git rev-parse --show-toplevel`,
the parent's branch and HEAD, and a file it created appeared as an untracked entry
in the parent's `git status`. In `codex-rs`, `apply_spawn_agent_runtime_overrides`
assigns the parent turn's cwd to the child config and is called from both spawn
paths; no worktree is created anywhere on that path.

## Observation 2

Source: `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md:73-78` (pre-edit lines).

- Tell the child its native cwd is your tree. It cannot infer this: on V1 the host tool
  description says the opposite, instructing the caller to have the child "edit
  files directly in its forked workspace". There is no forked workspace.
  `fork_context` and `fork_turns` fork conversation history, not the filesystem.
  Only the V2 usage hint states the shared directory, so a V1 session is never
  told it by the runtime.

## Observation 3

Source: `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md:119-126` (pre-edit lines).

- **Permission.** On the maintainer's host, same-directory forks kept the
  coordinator's full access. All seven lane forks dispatched on 2026-10-09 recorded
  `approval_policy: never` with a `danger-full-access` sandbox in their rollouts,
  and none waited on an approval; the lane forks of 2026-10-01 behaved the same.
  That is an observation, not a guarantee: confirm the child's
  actual permission before unattended writes. The opt-in PermissionRequest
  auto-allow hook deliberately ignores forks, so it does not cover a fork that
  started restricted.

## Observation 4

Source: `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md:142-145` (pre-edit lines).

before `loop init`. Without the pin, SOURCE-DELTA-01 reads the shared
     checkout, so a lane's B>C evidence does not describe its own work (the
     2026-10-01 lanes hit this), and WORKTREE-GUARD-04 does not fence its git
     writes;

## Observation 5

Source: `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md:156-162` (pre-edit lines).

Observed on 2026-10-09: `fork_thread({ environment: { type: "worktree" } })`,
called during an active coordinator turn, returned `status: "queued"` with a
`clientThreadId`. The managed worktree directory appeared within seconds, but no
task with that cwd appeared in `list_threads` for more than 25 minutes, including
after the coordinator's turn ended, and `get_worktree_creation_status` did not
recognize the provisional id.
