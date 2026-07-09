---
created: 2026-07-02
tags: [codexclaw, recall, chat-search, memory-search, fts5, plan]
aliases: [codex recall plan, chat/memory search over ~/.codex]
---

# 260702 codex-recall — cli-jaw-parity chat/memory search over the Codex session root

> Goal (user directive): implement `jaw dashboard chat search` / `jaw dashboard memory search`
> equivalents on top of `~/.codex`, with trigger integration, iterated via PABCD until an
> independent subagent judges the result SUPERIOR to cli-jaw's implementation.

## Part 1 — What is being built (plain terms)

A `recall` component for codexclaw that lets any agent (or the user) full-text search
(1) past Codex conversations and (2) the Codex memory store, straight from the CLI:

```
cxc chat search "<query>" [--days N] [--cwd PATH] [--role r] [--limit N] [--context N] [--any] [--json]
cxc memory search "<query>" [--limit N] [--json]
```

cli-jaw does this with a dashboard server + per-instance SQLite `messages` tables
(plain `LIKE '%w%'` OR-matching) and an FTS5 memory index. Codex already persists
everything we need — richer, in fact:

| Need | Codex source |
| --- | --- |
| chat transcripts | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (1,508 files observed) |
| thread metadata | `~/.codex/state_5.sqlite` `threads` (title, first_user_message, preview, cwd, git_branch, rollout_path, ms timestamps) |
| user prompt log | `~/.codex/history.jsonl` |
| memory store | `~/.codex/memories/*.md`, `rollout_summaries/*.md`, `memories_1.sqlite` `stage1_outputs` (raw_memory, rollout_summary) |

## Work-phase map (multi-pass PABCD)

- **WP1 (this doc)**: MVP scan-based search — no index, read-only, zero deps. → `10_wp1_mvp.md`
- **WP2**: sidecar FTS5 index (unicode61 + trigram for Korean) with incremental ingest keyed on
  `threads.updated_at_ms`/rollout mtime; auto-used when fresh, scan fallback. → `20_wp2_index.md`
- **WP3**: trigger integration — `recall` skill + hook injection so agents actually run the
  search on context loss (cli-jaw AGENTS.md "Memory Lookup Scope" parity). → `30_wp3_trigger.md`
- **WP4**: adversarial superiority evaluation vs cli-jaw by codex-rescue subagent; iterate. → `40_wp4_eval.md`

## Part 2 — WP1 diff-level plan

Class: **C3** (new public CLI surface, cross-session read path; no persistence yet in WP1).

### Hard constraints (from repo SOT)

- Build is Node type-stripping (`plugins/codexclaw/scripts/build.mjs`): **zero third-party runtime
  deps**, imports only `node:*` + relative `./x.ts`. SQLite access therefore uses **`node:sqlite`
  (DatabaseSync)** — verified locally: FTS5 + trigram tokenizer work (SQLite 3.51.2).
- Codex-owned DBs (`state_5.sqlite`, `memories_1.sqlite`) are sqlx-migrated, WAL, live. Open
  **readOnly: true**, fail-soft (warning, degrade to JSONL/md scan) — mirror cli-jaw's
  warning model (`open_failed`, `schema_mismatch`).
- Placeholder markers (TODO/FIXME/TBD) are build failures — keep sources clean.

### Doctrine reconciliation (L10 / L20.4 / D1')

Prior SOT records chat/memory search as an explicit NON-GOAL: L10
(`devlog/_fin/mvp_hard/100_L10_memory_chat_project_worklog_parity.md`) bans `cxc memory`,
local chat indexers, and chat databases; D1' (`devlog/_fin/mvp_res/204_L20.4`, commit
`025f677`) retired the `cxc chat-search` app-server wrapper for crossing the
"no self-implemented search" boundary.

This work-phase re-scopes that boundary under the owner directive of 2026-07-02 (goal:
implement cli-jaw-parity chat/memory search over `~/.codex`), which is precisely the
"later loop explicitly designs a Codex-native replacement" escape hatch L10 reserved.
Differentiation from the retired model — the recall component:

- does NOT wrap app-server `thread/search` (no server, no protocol client) — D1' stands;
- does NOT create a memory store or chat database codexclaw writes to — it READS Codex's
  own native persistence (`sessions/*.jsonl`, `state_5.sqlite`, `memories/`) read-only;
- WP2's sidecar FTS index is a rebuildable derived cache outside `~/.codex`-owned files,
  not a second source of truth.

Same-change SOT edits (repo rule: never leave code/SOT silently divergent):
`structure/INDEX.md` (component map + retirement paragraph pointer),
`100_L10_...md` + `204_L20.4_...md` (SUPERSEDED-IN-PART notes, owner directive 2026-07-02).

### NEW `plugins/codexclaw/components/recall/`

| File | Responsibility |
| --- | --- |
| `package.json` | `@codexclaw/recall`, private, `"type": "module"`, main `dist/cli.js`, test `node --test` |
| `src/paths.ts` | `codexHome()` = `$CODEX_HOME ?? ~/.codex`; all data paths derived here |
| `src/rollout.ts` | date-pruned iteration of `sessions/YYYY/MM/DD/*.jsonl`; line-level lazy parse: cheap lowercase substring prefilter BEFORE `JSON.parse`; extract `session_meta` + `response_item` messages (role, text, ts); classify injected scaffolding (`<INSTRUCTIONS>`, `<permissions instructions>`, `<ENVIRONMENT_CONTEXT>`, AGENTS.md preamble) as `synthetic` |
| `src/threads-db.ts` | readOnly `node:sqlite` open of `state_5.sqlite`; thread metadata map (title, cwd, git_branch) keyed by thread id; fail-soft null |
| `src/chat-search.ts` | query → words (≤8), case-insensitive; **AND default, `--any` for cli-jaw-style OR**; filters: days (dir-date pruning, **default 7**, `--days 0` = all history), cwd prefix, role, `--source main\|subagent\|all` (**default main**; cli-jaw cannot search subagent transcripts at all), tool_log matching (function_call/function_call_output, parity with cli-jaw match_field); context window ±N messages; limit (default 50, cap 200); results newest-first |
| `src/memory-search.ts` | scan `memories/**/*.md` (incl. `rollout_summaries/`) + readOnly LIKE query over `stage1_outputs(raw_memory, rollout_summary)`; dedupe by thread/file; excerpt with match highlight |
| `src/format.ts` | jaw-style text output (`[ts] (role) excerpt` + `---`) and `--json` envelope `{hits, warnings, scanned}` |
| `src/cli.ts` | `node:util` parseArgs; argv contract `[kind, "search", ...]`, kind ∈ `chat`\|`memory` (mirrors pabcd-state delegator style) |
| `test/*.test.ts` | fixture `CODEX_HOME` in tmpdir: synthetic rollout JSONLs (+Korean text), synthetic state_5/memories sqlite built via `node:sqlite`; cover AND/OR, --days pruning, cwd/role filters, context, synthetic-message exclusion, sqlite-missing degradation, Korean queries |

### MODIFY

- `plugins/codexclaw/scripts/build.mjs` — `COMPONENTS` += `"recall"`.
- `package.json` (root) — test glob += `plugins/codexclaw/components/recall/test/*.test.ts`.
- `bin/codexclaw.mjs` — route `chat` + `memory` commands to `components/recall/dist/cli.js`
  (same spawnSync delegator pattern; update help line).

### Measured performance constraints (2026-07-02, live data)

Full corpus = 1,522 rollout files / **3.6GB** / 638k lines → 16s naive scan; 3-day window =
616 files / 763MB / ~4.6s. Naive per-line scan is NOT "instant" — WP1 therefore requires:

1. **File-level prefilter**: one `content.toLowerCase().includes(word)` pass per file for every
   AND word before any line split/JSON.parse — non-matching files cost one pass, no allocation.
2. **session_meta early skip**: parse only the first line to read `thread_source`/`source`; skip
   subagent rollouts unless `--source subagent|all` (subagents dominate file count).
3. **Default `--days 7`** window; `--days 0` opts into full history with a duration note in output.

WP2's FTS index is the real fix for full-history instant search (cli-jaw superiority gate).

### Non-goals in WP1

- No index/persistence (WP2). No hook/skill changes (WP3). No writes anywhere under `~/.codex`.

### Verification (C gate)

- `npm run build` clean (includes layout validation), `npm test` green including new suite,
  live smoke: `cxc chat search` against the real `~/.codex` with Korean + English queries,
  `--days 3` pruning check, memory search hit on a known `rollout_summaries` topic.
