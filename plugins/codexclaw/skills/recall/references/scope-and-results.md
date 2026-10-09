## Subagent / managed worktree

- Chat default `--source main` hides subagent transcripts. Delegated work:
  `--source all` or `--source subagent`.
- This skill's CLI search is allowed in a read-only subagent. Do not ask the
  parent or the user to recap a term until the ladder above has run.

Managed-worktree cwd (Codex app hash-named checkouts under `~/.codex/worktrees`):

- `--cwd` and `--cwd-only` group sessions that share one git origin
  (the normalized `repo_key`), so `--cwd <worktree>` also reaches the main
  checkout of that repository. `--cwd-only` still hides other remotes. A
  directory with no origin falls back to the cwd prefix alone.

## Native `memories.*` vs `cxc`

When Codex `[memories] dedicated_tools=true` (codexclaw `cxc enable` turns this
on), `memories.search` / `memories.read` / `memories.list` search the memory
store as dedicated tools (path-scoped, `match_mode` any | all_on_same_line |
all_within_lines). They do not search session JSONL.

Use them to open a known memory file or to scan MEMORY.md without a shell. They
are not a substitute for `cxc chat search --days 0`. `cxc memory search` adds
ko/en synonyms, Korean stems, cwd boost, kind priority, and chat fallback — use
it when the native tool returns nothing or only the saturated `memory_summary.md`.

Native injection limits (not a cxc bug):

- The injected `memory_summary.md` is **not** filtered by the current cwd. Other
  projects' blocks ride along.
- `## User preferences` is promoted from session quotes. The quoted instruction
  may not be this task's authorization. Live AGENTS.md wins.
- Re-search MEMORY.md `applies_to: cwd=` when the summary is too global.

## Scoping memory search to a project

`--cwd <path>` ranks memories recorded under that working directory first; it
does not hide anything else. That is deliberate. The memory store is heavily
concentrated in a few long-running projects, and a worktree checkout typically
owns one summary or none, so a hard filter would answer nothing exactly when you
most need history. A boost puts the project's own memories on top and keeps the
rest reachable below them.

`--cwd-only <path>` is the hard filter, for when unrelated projects are noise
rather than context. When it empties the result, the output says so and points
back at `--cwd`. See "Subagent / managed worktree" before using it on a
Codex-managed worktree.

Scope comes from a rollout summary's `cwd:` frontmatter, and for stage1 rows
from a thread-id join against the Codex state db (`stage1_outputs` stores no
working directory). Curated files such as MEMORY.md carry no cwd at all, so a
chunk that names the path in prose counts as a weaker signal at half the boost
— that is what keeps handbook rules inside a `--cwd-only` result. Prefix
matching is separator-aware: `/repo` never matches `/repo2`. Every hit prints
its `{cwd}` when one is known.

## When memory has nothing

The memory store is consolidated on a delay, so a topic from an hour ago may
have no summary yet. When `cxc memory search` finds no artifact, it answers
from the raw chat corpus instead: up to five session messages, labelled
`(chat/chat)`, with a warning saying the result was substituted. Tool call and
output text is excluded — it matches almost any query and drowns out what was
actually said. Pass `--no-chat` for a memory-only answer.

The backfill never refreshes the sidecar index, so it costs a query rather than
an ingest, and `--cwd-only` stays in force across it.

## Reading results

Text mode prints `[timestamp] (role) «thread title» {cwd}` + excerpt per hit.

Chat `--json` returns `{hits, warnings, scannedFiles, matchedFiles, totalFiles,
elapsedMs, mode, index?, clipped}`. `mode` is `index` (sidecar FTS) or `scan`
(raw JSONL fallback). Pass `--full` to skip 500-char clipping.

Memory `--json` returns `{hits, warnings, scannedFiles, elapsedMs}` only.
There is no `mode` / `totalFiles` field.

Warnings are non-fatal degradations (missing state db, truncation at --limit,
chat fallback) — read them.

## Scope: single Codex home (deliberate non-goal)

Recall searches ONE Codex home per invocation — `$CODEX_HOME ?? ~/.codex`,
overridable per query with `--home <path>`. Cross-home federation is an
explicit non-goal.
