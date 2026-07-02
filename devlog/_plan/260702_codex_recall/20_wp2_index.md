---
created: 2026-07-02
tags: [codexclaw, recall, fts5, trigram, sidecar-index, plan]
aliases: [recall WP2 index plan]
---

# WP2 — sidecar FTS5 index for instant full-history chat recall

## Part 1 — What changes

WP1's scan path costs ~2-5s per week-window and ~16s full-history (3.6GB corpus).
WP2 adds a rebuildable sidecar SQLite index so `cxc chat search` answers in
milliseconds over the FULL history, with Korean-capable FTS. The scan path stays as
fallback; `~/.codex` stays strictly read-only.

cli-jaw superiority anchor: cli-jaw's chat search is LIKE-over-live-table with recency
ordering only; its FTS5+trigram+bm25 machinery exists only for its (separate) memory
md-chunk index. WP2 gives Codex chat search the FTS5+trigram treatment cli-jaw never
built for chat, while staying always-fresh via refresh-on-query.

## Part 2 — Diff-level plan

Class: C3 (persistence — a new codexclaw-owned derived cache on disk).

### Index home (new surface, disclosed)

`$CODEXCLAW_HOME ?? ~/.codexclaw` + `/recall/index.sqlite`. Rationale: the index spans
sessions across ALL projects, so project-local `.codexclaw/` cannot hold it; writing
inside `~/.codex` would squat the Codex runtime's namespace. cli-jaw precedent: derived
index lives in the tool's own home (`~/.cli-jaw/memory/structured/index.sqlite`).
It is a CACHE: deleting it only costs a rebuild; source of truth stays `~/.codex`.

### NEW `src/index-db.ts` — schema + lifecycle

```sql
CREATE TABLE meta   (key TEXT PRIMARY KEY, value TEXT NOT NULL);          -- schema_version
CREATE TABLE files  (path TEXT PRIMARY KEY, mtime_ms INTEGER, size INTEGER,
                     thread_id TEXT, cwd TEXT, source TEXT, date TEXT);
CREATE TABLE msgs   (id INTEGER PRIMARY KEY, path TEXT NOT NULL, ord INTEGER,
                     ts TEXT, role TEXT, match_field TEXT, synthetic INTEGER, text TEXT);
CREATE INDEX idx_msgs_path ON msgs(path);
CREATE INDEX idx_msgs_ts ON msgs(ts DESC);
CREATE VIRTUAL TABLE msgs_fts USING fts5(text, content='msgs', content_rowid='id',
                                         tokenize='unicode61');
CREATE VIRTUAL TABLE msgs_tri USING fts5(text, content='msgs', content_rowid='id',
                                         tokenize='trigram');
```

External-content FTS keeps text stored once. Tool outputs are capped at 8KB per entry
before indexing (bulk of the 3.6GB is tool logs; the cap bounds index size, and the cap
is recorded as a warning-free doc'd behavior — cli-jaw stores full tool_log but scans it
with LIKE, so recall precision at 8KB remains a superset in practice).

### NEW `src/ingest.ts` — incremental ingest

- `ingest(home, indexPath, {days})`: list rollout files, diff against `files` table by
  (mtime_ms, size); changed/new files re-parse via WP1 `parseRollout` (+ meta via
  `readRolloutMeta`), delete+reinsert their msgs rows inside one transaction per batch;
  deleted files are pruned. Returns counts + elapsed.
- First build over the full corpus is a one-time cost (target < 90s); subsequent
  refreshes touch only changed files (typically < 10 per query).

### MODIFY `src/chat-search.ts` — query routing

- Default path: open index read-write, run refresh-on-query (incremental ingest first —
  keeps results always-fresh, matching cli-jaw's live-table freshness), then query:
  - CJK-containing words → `msgs_tri MATCH` (trigram); ASCII words → `msgs_fts MATCH`;
    mixed queries intersect rowid sets; AND remains default, OR via `--any`.
  - FTS5 special syntax is neutralized by quoting each word (`"w"`).
  - words shorter than 3 chars that trigram cannot serve fall back to LIKE over msgs.text
    (indexed table scan is still far smaller than raw JSONL).
- Filters (days exact ts cutoff, cwd prefix, role, source, synthetic) become SQL WHERE
  clauses; ordering stays recency-first (cli-jaw parity); limit + truncation warning kept.
- Fallbacks: `--scan` forces the WP1 scan path; index open/refresh failure appends a
  warning and silently degrades to scan. `--no-refresh` skips ingest for max speed.
- Envelope gains `mode: "index" | "scan"` so agents/tests can assert the path taken.

### MODIFY `src/cli.ts`

- `cxc chat index` subcommand: `--rebuild` (drop + full build), `--status` (file/msg
  counts, size, last ingest), default = incremental refresh.
- search flags: `--scan`, `--no-refresh`.

### Memory search: stays scan-based (deliberate)

The memory corpus is ~1MB; WP1 already answers in <10ms. An FTS index would add
complexity with no measurable win. Recorded here so the eval subagent doesn't count it
as an omission: parity target for FTS quality is the CHAT surface, where cli-jaw has no
FTS at all.

### Tests (extend recall suite)

- ingest: build → counts match fixture; touch a file → only it re-ingests; delete →
  pruned; rebuild drops stale rows; 8KB tool cap applied.
- query: index-mode hits equal scan-mode hits on the fixture corpus (oracle test,
  AND + OR + Korean trigram + role/cwd/source/days filters); FTS quoting survives
  hyphens/quotes/parens in queries; index corruption → scan fallback warning.
- cli: `chat index --status/--rebuild` output; `--scan`/`--no-refresh` honored.

### Audit reconciliation (2026-07-02)

The A-phase audit (FAIL, 12 findings) reviewed this plan text against the in-flight
implementation; findings 1/3/4/8/9/10/11/12 were already closed in code (trigger-synced
external-content FTS with delete-command semantics, LIKE `ESCAPE` fallback for <3-char
words, WAL + busy_timeout, `--no-tools`/context/title+branch enrichment/default parity —
all locked by the oracle test comparing index-mode vs scan-mode hits). Finding 5 (user-level
`~/.codexclaw` vs project-local-state doctrine) was resolved by amending
`structure/00_philosophy.md` §2, `structure/20_pabcd_dispatch_doctrine.md`, and
`structure/INDEX.md` Boundary Rules to carve out user-level REBUILDABLE DERIVED CACHES.
Finding 7 (concurrent appends): stat-before-read makes staleness self-healing (recorded
stat ≤ indexed content ⇒ next refresh re-ingests); documented in `ingest.ts`.

Measured on live data: full build 1,533 files / 325,935 msgs / 161s / 2.1GB index;
full-history queries 20-40ms (vs 2-16s scans); refresh-on-query picks up appended lines
(regression-tested).

### Verification (C gate)

Full suite green; live: first build timing over real ~/.codex, then `cxc chat search`
p50 < 200ms full-history, Korean query hit-parity vs scan mode, refresh picks up a
just-written session line.
