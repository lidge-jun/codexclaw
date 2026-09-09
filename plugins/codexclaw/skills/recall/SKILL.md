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

## Recall Lookup Scope (read first)

When ANY of these happen, search BEFORE asking the user:

- A term, file, decision, or codename from prior work is unfamiliar.
- Context seems lost after a compact, restart, or session handoff.
- The user references earlier work: "그때 그거", "지난번에 하던 거", "저번 세션에서",
  "예전에 만든", "last time", "the thing we did earlier", "as discussed previously".
- You are about to write "I don't have context about X" — search X first.

Both commands are strictly read-only over `~/.codex`; they never modify anything.

## Commands

```
cxc chat search "<query>" [--days N] [--cwd PATH] [--role r] [--source main|subagent|all]
                          [--limit N] [--context N] [--any] [--all] [--no-tools]
                          [--scan] [--no-refresh] [--json]
cxc chat index [--rebuild] [--status]
cxc memory search "<query>" [--days N] [--limit N] [--any] [--no-synonyms] [--json]
```

Defaults that matter:

- Words AND together; pass `--any` for OR. Quote the whole query.
- `--days` defaults to 7 for chat; pass `--days 0` for FULL history (the sidecar FTS
  index answers full-history queries in tens of milliseconds).
- `--source main` is default; subagent transcripts are searchable with
  `--source subagent|all` (cli-jaw has no equivalent corpus).
- Harness-injected synthetic messages (AGENTS.md preambles, environment context) are
  hidden; `--all` reveals them.
- Korean works in both engines (trigram FTS >=3 chars; shorter words auto-fallback).

## How memory search reads your query

`cxc memory search` judges each query word by its shape, so short symbols and
Korean prose can coexist in one query.

Symbol-shaped words — uppercase acronyms (`CI`, `LSP`), one-to-three-letter
ASCII words (`go`, `id`), numbers (`3956`, `#3956`), SHAs, filenames and paths —
match on word boundaries only. Searching `LSP` no longer returns
`NaiControlsPanel`, and `3956` no longer returns a thread id that happens to
contain those digits. When a symbol query finds nothing on boundaries, results
fall back to substring matching and the output carries a
`lower confidence` warning, so an empty answer is never the outcome.

Everything else keeps substring matching, including Korean. Korean queries also
get their ending trimmed and the stem searched alongside the original, so
`배포까지`, `배포를` and `배포했다` all reach a document that only says `배포` —
and the stem is looked up in the synonym table too, so `배포를` reaches
`deploy`. Trimming only ever adds terms; the word you typed still anchors the
excerpt. Stems shorter than two syllables are never produced, so `검사` is not
split into `검`.

Pass `--no-synonyms` for literal matching with no expansion at all.

## Escalation ladder

1. `cxc chat search "<distinctive terms>" --days 0` — find the conversation.
   Add `--context 2` to read around a hit; `--cwd <repo>` to scope to a project.
2. `cxc memory search "<topic>"` — find the durable per-thread summary
   (`rollout_summaries`, MEMORY.md, stage1 outputs); hits carry `rollout_path` and
   thread ids for deep-dive.
3. Open the winning rollout file directly (path is in every hit) for full detail.
4. Only if all three miss, ask the user — and say what you searched.

## Reading results

Text mode prints `[timestamp] (role) «thread title» {cwd}` + excerpt per hit;
`--json` returns `{hits, warnings, scannedFiles, totalFiles, elapsedMs, mode}` where
`mode` is `index` (sidecar FTS) or `scan` (raw JSONL fallback). Warnings are
non-fatal degradations (missing state db, truncation at --limit) — read them.

## Scope: single Codex home (deliberate non-goal)

Recall searches ONE Codex home per invocation — `$CODEX_HOME ?? ~/.codex`, overridable
per query with `--home <path>`. Cross-home federation (cli-jaw's multi-instance model)
is an explicit non-goal: Codex is a single-home runtime, and pointing `--home` at an
alternate root covers the rare multi-root case without a registry or rerank layer.

## Maintenance

The sidecar index self-refreshes on every query (changed files only). `cxc chat index
--status` shows freshness; `--rebuild` drops and re-ingests after schema-level doubts.
Deleting `~/.codexclaw/recall/index.sqlite` is always safe (rebuildable cache).
