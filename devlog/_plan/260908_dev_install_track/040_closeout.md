# 260908 dev-install track — closeout

Written for a reader who was not in the loop.

## Outcome

The plugin now runs from a real copy of the `dev` checkout, the dogfood loop is documented in all
three READMEs, and two of three open PRs are merged. One PR is deliberately held.

| Item | Final state |
|---|---|
| `dev` head | `2683eba2`, local == `origin/dev`, reached by fast-forward from `6d70ef44` |
| PR 92 | MERGED — `393da86b` |
| PR 93 | MERGED — `ccf990ea`, after conflict resolution and two defect fixes |
| PR 91 | **HELD** — verified BLOCKER, not merged |
| Suite | 2,697 tests, 2,696 pass, 0 fail, 1 skip |
| Install | byte-identical to `plugins/codexclaw`, 0 symlinks, `cxc doctor` overall PASS |

## What was actually wrong at the start

The reported symptom was that symlinks stopped Codex recognizing the plugin. The cache contained no
symlinks at all. The real defect was that the `codexclaw` marketplace was registered as a **git**
source pinned to `bb85227`, which is `origin/main` — so the installed payload was a snapshot of
`main` while all work happened on `dev`. `scripts/dev-symlink.sh` had also drifted to the point of
being unusable: it hardcoded `VERSION="0.1.0"` against a live cache directory of
`0.2.24+codex.20260908031619`, so it would have created an orphan directory Codex ignores.

## Why PR 91 is held

An independent review found, and this session verified, that `ROLE_AGENT_TYPE.executor` would emit
`agent_type: "executor"` unconditionally while `executor` is not a codex-rs built-in. It resolves
only after a manual `cxc subagents register executor` plus a session restart. `dev` today declares
`Record<RoleName, "explorer" | "worker">` at `spawn-wrapper.ts:24`, and `~/.codex/agents/` on this
host is empty, so this machine is in the affected population. Merging it would break the executor
dispatch path that PABCD's B phase depends on.

The routing and exit-verification half of that PR is sound and was confirmed correct by the
reviewer. A fallback in `resolveSpawnPayload` — emit `"worker"` when
`$CODEX_HOME/agents/executor.toml` is absent — would resolve it, since both the exit gate and
`inferRole` already accept `worker`. That work belongs to the PR author.

## What the reviews caught that the plan did not

Four separate `anthropic/claude-opus-5` lanes reviewed the roadmap, PR 91, PR 92 and PR 93, plus a
fifth auditing the finished documentation. Findings that changed the outcome:

- The roadmap declared both merge orderings safe. They are not: PRs 92 and 93 both edit the same
  three READMEs this unit rewrites, so the documentation had to land last. The roadmap was amended
  before any code moved, and the predicted conflict did occur.
- The roadmap claimed committed `dist/` is gitignored. It is tracked — `git ls-files` returns 160
  files and `git check-ignore` exits 1. The rebuild step survived, but for the opposite reason.
- PR 92's thin CI was not path filtering. All three workflows declare a bare `pull_request:` with
  no `paths:` key; the runs sat at `action_required` behind the first-time-fork-contributor gate.
  Approving them ran the full matrix, which passed on both Windows legs.
- PR 93 collapsed a three-state effort ladder with `?? []`, greying out every effort option for any
  model whose ladder OCX does not advertise. A live roster on this host returned 106 models, several
  without a ladder. Fixed before merge, with four regression tests.
- The first documentation pass got hook trust wrong. `identityHash` covers the hook **declaration**,
  not file bytes, so a rebuilt `dist/` keeps trust while a matcher edit breaks it — the opposite of
  what was written.

## What did not improve, and what would show this is wrong

The dev install trades liveness for correctness: every change now needs a reinstall and a new
thread, where the symlink track promised neither. That is only worth it if Codex genuinely
mishandles symlinked cache children. This session did not reproduce that failure directly — the
cache had no symlinks to observe — so the justification rests on the reported symptom plus the
observed git-pin defect, which fully explains the reported behavior on its own. Evidence that would
overturn this: a Codex build that loads a symlinked cache child correctly, which would make the
symlink track viable again and the reinstall step unnecessary friction.

The held PR is the other open thread. If its author adds the fallback, the executor role becomes
canonical and this hold was a one-cycle delay rather than a rejection.
