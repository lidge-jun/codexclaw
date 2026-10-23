---
created: 2026-10-20
tags: [codexclaw, state, devlog, privacy]
aliases: [state root, external state, 상태 루트]
---

# 80 — State layout: where codexclaw writes

Codexclaw writes two kinds of project state. Volatile runtime state always stays in the checkout at `<cwd>/.codexclaw/`. Durable state, the record a later session or another machine still needs, resolves through `components/pabcd-state/src/state-root.ts` (byte-identical copies in every component that owns a `codexclaw-dir.ts`). The goal: in a repository you do not own, nothing codexclaw-related becomes committable, while plans and ledgers keep accumulating in your own storage, survive worktree removal and can sync across machines. Plan unit: `devlog/_plan/261020_external_state_root/`.

## Modes

| Mode | Durable state | Devlog | Git visibility |
| --- | --- | --- | --- |
| `repo` | `<cwd>/.codexclaw/` | `<cwd>/devlog/` | historical layout; `.codexclaw/rules/*.md` stay committable |
| `local` | `<cwd>/.codexclaw/` | `<cwd>/devlog/` | `.codexclaw/`, `codexclaw.json` and `devlog/` listed in `<git common dir>/info/exclude` |
| `external` | `<base>/<projectId>/state/` | `<base>/<projectId>/devlog/` | checkout keeps only volatile state, hidden through `info/exclude` |
| `none` | disabled | disabled | durable writes skipped or refused with a message; hooks keep running |

Precedence uses explicit non-auto values: `CODEXCLAW_STATE_MODE` > config `state.projects["host/owner/repo"]` > config `state.mode` > auto (`CODEXCLAW_STATE_MODE=auto` falls through to the config). Auto: not a git checkout → `repo`; git checkout without a usable normalized origin → `local` (no owner, no stable cross-machine id); origin owner on `state.ownerAllowlist` (default `lidge-jun`, `goat-si`, `lidge-ai`; bare names mean github.com, `host/owner` otherwise) → `repo`; any other owner → `external`.

Config is the user config `$CODEXCLAW_HOME/config.json` (default `~/.codexclaw/config.json`):

```json
{ "state": { "mode": "auto", "root": "/abs/private-state", "ownerAllowlist": ["lidge-jun"], "projects": { "github.com/acme/app": "external" } } }
```

Config inside the checkout is ignored, except the default `~/.codexclaw/config.json` when the checkout is the home directory. `CODEXCLAW_HOME` / `CODEXCLAW_STATE_ROOT` / `state.root` must be absolute, and an external root that resolves inside the checkout disables durable writes. Base: `CODEXCLAW_STATE_ROOT` > `state.root` > `$CODEXCLAW_HOME/projects` > `~/.codexclaw/projects`.

## Plans directory

Some repositories forbid committing plans. `CODEXCLAW_PLANS_DIR` > config `state.plansDir` (absolute) moves only the devlog, and with it every plan unit, to `<plansDir>/<project id>`, in any mode except `none`; ledgers, goalplans and evidence stay where the mode puts them. A relative value, or one that resolves inside the checkout, is ignored with a warning. `cxc devlog path --explain` names the source, and `cxc plan init` scaffolds there.

SOURCE-DELTA-01 then reads the plan unit too. On entry to B the session records the unit bound at P>A by absolute path and a sha256 digest of its files (`phaseEntryPlan`). At B>C a changed digest counts like a changed source, and the ledger row for that edge carries `planDelta: { path, before, after }`. In a repository that commits its plans the same edit already changes the source, so nothing gets weaker there. Plans hidden from git inside the checkout (`local` mode's `.git/info/exclude`, an ignored symlink) count the same way.

## Project id

The origin URL is normalized to `host/owner/repo` (scp, ssh, https; credentials, port, query, fragment and `.git` dropped; lower-cased). Project ids join the sanitized origin segments with `__` (each segment limited to 40 characters), followed by `-` and 32 hex characters of the SHA-256 of the normalized origin key. Every worktree reads the same shared git config, so all worktrees of one repository share one directory, and deleting a worktree leaves it in place. `project.json` records the origin; a directory recorded for another origin is never shared. Without a usable origin, git checkouts use `local__<name>-<32-hex hash of the real common git directory>` and non-git directories `path__<name>-<32-hex hash of the real cwd>`. The git config is parsed from disk (no subprocess on hook paths); `include`, `includeIf` and `insteadOf` are not followed, and `cxc state path` shows the origin key that was read.

## Durable vs volatile

| Durable (resolved root) | Volatile (checkout `.codexclaw/`) |
| --- | --- |
| `ledger.jsonl`, `goalplans/<slug>/`, `evidence/`, `evidence-attempts/`, `evidence-unrecordable/`, `interviews/<session>.jsonl`, devlog `_plan/` and `_fin/` | `sessions/` (incl. D-close recovery), `sources/`, `worktree-guard/`, `friction.jsonl`, `edit-shapes.jsonl`, `render-observations.jsonl`, `affordance-recovery/`, `metrics.jsonl`, `objective-kind/`, `divergence/`, `interview/` + `plan/` (freeze manifest, one unkeyed file per checkout), `release/`, `dispatches/`, `subagents.json`, `bg/`, `traces/`, `bridge.db*`, `bridge-events.jsonl`, `attest.json` (optional caller-written scratch input) |

Partitioning comes from keys that already exist (`goalplans/<slug>`, `evidence/<session>`, `interviews/<session>`, session ids in the ledger). There is no per-branch partition: agents switch branches mid-session, and a receipt written before `git checkout -b` must stay visible.

## Evidence guard

`hasValidReceipt` accepts a receipt only inside the resolved evidence root, with no symlink at the root, in any directory below it or at the leaf, with its realpath inside the root's realpath, as a regular non-empty file. A disabled root accepts nothing. A receipt under the legacy `<cwd>/.codexclaw/evidence` does not count while the mode is external.

## Commands

- `cxc state path [--json]` — mode, reason, directories, project id, warnings (including legacy in-checkout state to migrate).
- `cxc devlog path [--explain|--json]` — the devlog directory alone, for `$(cxc devlog path)/_plan`.
- `cxc state sync [--dry-run]` — for a base that is its own private git repository. Without an upstream, sync commits locally only. With an upstream it takes a snapshot commit, fetches, merges remote changes when needed in a throwaway linked worktree (`*.jsonl merge=union`), applies them to the live tree (missing ledger lines appended, new files created exclusively, goalplan files swapped under the goalplan write lock, other files edited or deleted remotely applied only while the local copy is still byte-for-byte the last synced version), `git reset --soft` to the merge, commits and pushes local commits. Never `--force`; a local edit to a file the other machine also changed is a conflict that stops the sync before adopting the merged commit. Do not drive one goalplan from two machines at once.
- `cxc state migrate [--apply]` — moves a checkout's legacy durable state and `devlog/` into the external layout. Dry run by default; identical files count as done, `*.jsonl` union-merge, other differences are conflicts with both copies kept; symlinks and git-tracked source files are skipped (tracked status is matched by file identity and by case- and Unicode-folded repo-relative name, so aliases on macOS and Windows still count as tracked); `--apply` is refused while a session is mid-cycle, has pending D-close recovery, or is unreadable (the dry run still reports the plan). Goalplan JSON files containing legacy evidence or devlog path strings are listed as potentially stale.

Migration is manual. A foreign-owner checkout writes new durable state externally as soon as it resolves to `external`, but state already in the checkout stays there (and `cxc state path` / `cxc plan init` warn about it) until you move it. From the checkout, with running cycles closed to IDLE:

```bash
cd /path/to/enterprise-checkout
cxc state path              # expect "mode: external" and the target directories
cxc state migrate           # dry run
cxc state migrate --apply
```

If the checkout resolves to `repo` (for example an allowlisted owner), prefix the migrate commands with `CODEXCLAW_STATE_MODE=external` or set `state.projects["host/owner/repo"]` to `"external"`. Sync rejects tracked or incoming lock/scratch paths and incoming non-regular git entries, and refuses remote JSONL deletions. Migrate skips symlinks and tracked source files; it does not filter lock/scratch filenames.

## Known limits

- A same-user process that swaps state directories for links between the resolver's checks and its writes can still race them; Node has no fd-pinned `mkdir`/`openat`, and such a process already controls `~/.codexclaw`.
- Durable readers other than the evidence guard and receipt producers do not consult the disabled flag.
- In `none` mode gates that require durable evidence (goalplan C>D receipts, subagent receipts) cannot be satisfied.
