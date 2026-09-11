---
name: cxc-recall
description: "MUST USE for past-session recall — when a term from prior work is unfamiliar, context feels lost after a compact/restart, or the user references earlier work (그때, 지난번, 저번 세션, 예전에 했던, 기억나?, last time, previous session, what did we do). Searches past Codex conversations and the Codex memory store from the CLI before asking the user. Triggers: recall, 리콜, past session, chat search, memory search, 지난 세션, 이전 작업, 뭐였지, 어떻게 했었지."
metadata:
  short-description: "Read-only recall search over ~/.codex: past chats (FTS-indexed) + memory store."
---

# recall — Past-Session Recall Search

Codex already persists every session (`~/.codex/sessions/**/rollout-*.jsonl`) and a
per-thread memory store (`~/.codex/memories/`). This skill is the discipline for
SEARCHING that history instead of asking the user to repeat themselves.

Injected `memory_summary.md` and SessionStart snippets are locators, never proof.
Search, then open the winning file, before answering a past-work question.

## Recall Lookup Scope (read first)

When ANY of these happen, search BEFORE asking the user:

- A term, file, decision, or codename from prior work is unfamiliar.
- Context seems lost after a compact, restart, or session handoff.
- The user references earlier work: "그때 그거", "지난번에 하던 거", "저번 세션에서",
  "예전에 만든", "last time", "the thing we did earlier", "as discussed previously".
- You are about to write "I don't have context about X" — search X first.

`cxc chat search` and `cxc memory search` do not write Codex session files or the
memory store. They are not write-free against the sidecar: without `--no-refresh`,
`cxc chat search` refreshes the sidecar index at `~/.codexclaw/recall/index.sqlite`,
and `cxc chat index --rebuild` deletes and re-ingests that index. Pass
`--no-refresh` when the index must stay untouched. Never call
`memories.add_ad_hoc_note` from this skill.

## Commands

```
cxc chat search "<query>" [--days N] [--cwd PATH] [--role r] [--source main|subagent|all]
                          [--limit N] [--context N] [--any] [--all] [--no-tools]
                          [--recent] [--rank] [--scan] [--no-refresh] [--synonyms] [--json] [--full]
                          [--home PATH]
cxc chat index [--rebuild] [--status] [--json]
cxc memory search "<query>" [--days N] [--limit N] [--any] [--no-synonyms]
                            [--cwd PATH] [--cwd-only PATH] [--no-chat] [--json]
                            [--home PATH]
```

Flags that live in the CLI USAGE and are easy to miss:

- `--rank` — relevance order (the default; accepted for explicitness). `--recent`
  is newest-first.
- `--full` — with `--json`, skip the 500-char clip.
- `--home PATH` — search an alternate Codex home (default `$CODEX_HOME` ?? `~/.codex`).
- `--json` on `cxc chat index` prints index status as JSON.

Defaults that matter:

- Words AND together; pass `--any` for OR. Quote the whole query.
- A space split keeps up to 16 words. Through 8 every word is required. Past 8
  the AND relaxes: symbols, versions and mixed-case names (`2.49.0`, `npm`,
  `CI`, `BundledPluginsMarketplace`) stay required, and the rest become a quota
  — half of them, rounded up. Six fillers (그 / 이 / 저 / 것 / 문제 / 방법) are
  dropped at any length; 진짜 and 지난번 are not.
- A relaxed query can therefore answer a whole sentence, but it ranks by word
  overlap, not by what you meant. The rewrite ladder below still wins.
- Do not paste a Korean or English sentence as-is. Do not use `--any` on a long
  sentence — it fills the page with common-word noise and is not a relevance rewrite.
- `--days` defaults to **7 for chat** and **0 (full history) for memory**. They
  are different. Pass `--days 0` on chat for full history.
- `--limit` defaults: chat 50 (cap 200), memory 20.
- `--source main` is default; subagent transcripts need `--source subagent|all`.
- Harness-injected synthetic messages are hidden; `--all` reveals them.
- Chat matches tool call/output (`tool_log`) by default. Recall questions should
  pass `--no-tools`.
- Chat hits come back BY RELEVANCE: a BM25 lane and a trigram lane are fused
  (reciprocal rank fusion) and freshness breaks ties among comparable matches.
  Pass `--recent` for newest-first. This ordering is chat index only; memory
  ranks by its own chunk score (group coverage, density, kind, freshness).

## Two engines (do not mix their rules)

Chat (`cxc chat search`, sidecar FTS index):

- Lowercase substring AND (OR with `--any`). No Korean stemming and no synonym
  table by default.
- Drop particles yourself (`코덱스를` → `코덱스` or `codex`), or pass
  `--synonyms` to borrow memory's ko/en table and Korean stemmer for one query
  (`코덱스를 재시작하면` then reaches a transcript that says `Codex restart`). It
  is off by default because expanding every word widens a multi-GB scan.
- Trigram FTS for words of length >= 3; LIKE fallback below that. This is chat index only.
- Empty results are possible. There is no substring fallback for a failed AND,
  and past 8 words the required symbols must still all be present.

Memory (`cxc memory search`):

- Paragraph scan over `~/.codex/memories/` (MEMORY.md, memory_summary.md,
  rollout_summaries, stage1, ad-hoc notes).
- Korean ending trim + ko/en synonym expansion (unless `--no-synonyms`).
  `--no-synonyms` on chat is a no-op because chat never expands.
- Symbol-shaped words — uppercase acronyms (`CI`, `LSP`), one-to-three-letter
  ASCII (`go`, `id`), numbers (`3956`, `#3956`), SHAs, dotted versions (`2.49.0`,
  `v2.49.0`; judged before the filename rule), filenames and paths — match on
  word boundaries only. `LSP` does not return `NaiControlsPanel`. A version
  written as `v2.49.0` in the corpus still matches the query `2.49.0`: a lone
  token-edge `v` before a version counts as a boundary.
- When a query finds nothing at all, memory retries with substring matching
  only for the boundary groups that occur nowhere in the corpus, and warns
  `lower confidence`. A group that does hit on boundaries keeps its precision,
  so `3956 LSP` never lets `LSP` match inside `NaiControlsPanel`. Korean prose
  has no boundary term, so that retry does **not** run for it. Empty results
  are common for unsplit sentences.
- Trimming only ever adds terms; the word you typed still anchors the excerpt.
  Stems shorter than two syllables are never produced, so `검사` is not split
  into `검`.

## Natural-language → keyword ladder

Do not start with the user's sentence. Rewrite, then search. Each rewrite is its
own query (`--days 0`, chat then memory unless the noun is known to live in notes):

1. Proper nouns / versions / hostnames / filenames as a single token
   (`BundledPluginsMarketplace`, `2.49.0`, a thread id).
2. Korean/English synonym pair of that noun (`도그푸딩` and `dogfooding`,
   `플러그인` and `plugin restart`, `배포` and `provenance` / `SLSA`).
3. Short 2–3 word keyword query (`로컬 소스 서비스`, `2.49.0 배포 npm`).
4. `cxc chat search "<keywords>" --days 0 --no-tools` — find the conversation.
   Add `--context 2`. Add `--source all` if the work was delegated.
5. `cxc memory search "<keywords>"` — durable summary. Omit `--no-chat` so empty
   memory can backfill up to 5 raw messages labelled `(chat/chat)`.
6. Open the winning rollout / memory file (`rollout_path` is on the hit). Do not
   answer from the excerpt.
7. Only if the rewritten queries miss, ask the user and list what you searched.

Worked recoveries (eval 2026-09-10, re-measured after the long-query
relaxation). `지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법`
now returns hits as-is, on word overlap alone, so read them before trusting
them. `코덱스를 재시작하면 플러그인이 사라지는 문제` and
`2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록` are still 0 as-is on
this corpus: five words is a strict AND, and the release sentence's required
`2.49.0` and `npm` never share a message with three of its remaining words.
All three recover as `source dogfooding` / `plugin restart` / `2.49.0 배포 npm`.

## Result checks (before treating a hit as the answer)

- Request vs completion: a user line or "진행할게" is a locator, not proof.
  Prefer assistant text that names the outcome (healthz, npm latest, recovered).
- Version-string trap: a hit that contains `2.49.0` may be the previous release
  bumping *toward* 2.49.0. Check the title/date/task_outcome. Do not take the
  first version match. `2.49.0 provenance` ranked a 2.48 session first.
- Correction history: later ad-hoc notes and MEMORY.md entries override older
  summaries. If two hits disagree, read the newer file, then the rollout.
- `--any` hits are not evidence by mere existence.

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

## Optional extra lanes (only if the tool is installed)

These are not part of cxc. Skip the whole section when the binary is missing.

- **Aside** (`aside` on PATH): `aside memory search --json "<q>"`. If the top
  score is below 0.72, treat the semantic lane as a miss. Recover proper nouns
  with `rg --fixed-strings`. Dedupe by `path` (neighbor chunks of the same file
  are not extra evidence).
- **kim_wiki** (`~/kim_wiki/scripts/ask.py` exists):
  `python3 ~/kim_wiki/scripts/ask.py "<q>"`. Do not add entries/raw/nodes scores
  together. If the entries lane is empty, open the detailed document that
  nodes/raw pointed at and confirm with `rg`.

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

## Maintenance

The sidecar index self-refreshes on every chat query (changed files only) unless
`--no-refresh`. `cxc chat index --status` shows freshness; `--rebuild` drops and
re-ingests after schema-level doubts. Deleting `~/.codexclaw/recall/index.sqlite`
is always safe (rebuildable cache).

## Automatic session-start injection

Separate from these commands, the SessionStart hook injects a short CWD-scoped
list of recent sessions, including the start that follows a compaction. That
list rotates: a session already injected several times is pushed back so a
start sees something it has not seen yet. Counts live in the same rebuildable
sidecar, so deleting the index also resets the rotation to plain newest-first.

The rotation applies to the automatic injection ALONE. `cxc chat search` and
`cxc memory search` never consult it: the same query returns the same ranking
however many times you run it. After compaction the same hook re-fires with
`source=compact` and a smaller block plus a recovery pointer; the PostCompact
recall handler itself emits nothing.
