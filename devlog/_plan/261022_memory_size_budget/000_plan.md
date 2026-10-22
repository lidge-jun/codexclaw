# 261022 Memory size budget

## Problem

The memory store codexclaw owns must stay small on disk: under 100 MB total in
steady state, with 10 to 50 MB as the working target. Memory exists to be
injected into an agent's context, so the store keeps what recall can inject or
answer quickly and treats everything else as derived, bounded, or evicted. An
idle machine must do no memory work.

Measured on the operator machine on 2026-10-22:

| Store | Size | Owner |
|---|---:|---|
| `~/.codexclaw/recall/index.sqlite` | 410 MB | codexclaw (derived cache) |
| `~/.codex/sessions` + `archived_sessions` | 844 MB | Codex (source of truth, never written) |
| `~/.codex/memories_1.sqlite` | 45 KB | Codex (jobs, stage-1 outputs) |

Inside the recall index (47,206 messages, 84 MB of stored text, last vacuumed
never, `auto_vacuum=NONE`):

| Object | MB |
|---|---:|
| `msgs_tri` trigram FTS data | 237.6 |
| `msgs` content table | 109.3 |
| `msgs_fts` unicode61 FTS data | 32.3 |
| indexes, docsize, files | 10.4 |

Nothing bounded it. Tool output was capped at 8 KB per message, chat text was
uncapped, every session ever recorded was kept, deletes left free pages in the
file, and code comments record a 12 GB / 1.2M-message index on another machine.

Separately, `cxc memory status` reported "298 jobs exhausted retries" in every
SessionStart on another machine, with no way to make the pile shrink.

## Research

Full report with citations:
`~/Developer/goat-research/2026-10-22-small-memory-codexclaw.md` (Aside exec
run, 2026-10-22). The points this design depends on:

- Small injection and small storage are separate properties. Claude Code loads
  the first 200 lines / 25 KB of `MEMORY.md`; Codex truncates `memory_summary.md`
  to 2,500 tokens; neither bounds the bytes behind them.
- SQLite `DELETE` frees pages without shrinking the file. `auto_vacuum=INCREMENTAL`
  must be set before the first table, after which `PRAGMA incremental_vacuum`
  returns freed pages. A full `VACUUM` can need twice the database size in
  free space, which breaks a 100 MB peak at a 50 MB steady state.
- `wal_autocheckpoint` recycles the WAL without truncating it; `journal_size_limit`
  and a checked `wal_checkpoint(TRUNCATE)` bound it after each write burst.
- FTS5 `detail=column`/`none` shrink an index sharply (SQLite's own email test:
  743 → 340 → 134 MiB) but refuse phrase queries.
- Codex memory jobs get 3 retries; exhausted rows are never deleted by the
  host. The host only claims threads updated within `max_rollout_age_days`
  (default 10, clamped to 0..90), and new input on a thread resets its budget
  (codex-rs `state/src/runtime/memories.rs`, `config/src/types.rs`).

## Measurements that chose the design

10,000 of the newest real messages, copied into scratch databases, VACUUMed:

| Variant | File | Stored chars |
|---|---:|---:|
| current (tool 8 KB, chat uncapped, both FTS `detail=full`) | 94.4 MB | 21.2M |
| trigram `detail=column` | 59.6 MB | 21.2M |
| trigram `detail=none` | 45.4 MB | 21.2M |
| tool 1 KB, chat 4 KB, `detail=full` | 37.5 MB | 6.9M |
| tool 1 KB, chat 4 KB, both `detail=none` | 18.0 MB | 6.9M |

`detail=column` and `none` were rejected: every query word of three or more
characters becomes a trigram phrase (`"SessionStart"` → error
"phrase queries are not supported (detail!=full)"), and the unicode61 lane loses
any word the tokenizer splits (`index.sqlite`). The caps keep the head of each
message, which is what a recall snippet shows, and cut stored text by 3x.

Dropping 400 MB of tables before a migration took 2.2 s; unlinking the file is
O(1) and leaves no free pages.

## Design

1. **Byte budget on the recall index.** Default 48 MiB of live database bytes,
   `(page_count - freelist_count) * page_size`, overridable with
   `CODEXCLAW_RECALL_MAX_MB` (minimum 4). The measure is exact and costs three
   pragma reads; a text-size estimate was rejected because the bytes per
   character differ between Korean and English text and between the two FTS
   indexes.
2. **Admission control.** Ingest walks rollouts newest first. Once the index is
   at its budget, a session it has never indexed is recorded as metadata only
   (`files.evicted = 1`). A first build therefore parses only as much history as
   fits; on this machine it reads 254 sessions in 3.9 s and stops at 41 MB.
3. **Eviction with hysteresis.** Above the budget, whole sessions are evicted
   in order of last activity (`mtime_ms`) until the index is under 80 % of the
   budget. Each round optimizes both FTS indexes (deletes add tombstones),
   runs `incremental_vacuum`, and re-measures. An evicted session keeps its
   `files` row, so SessionStart still lists it and an unchanged file is never
   parsed again; if the file changes it is re-indexed as active work.
4. **Physical reclamation.** Schema v3 is created with
   `auto_vacuum=INCREMENTAL`, `journal_size_limit` 4 MiB, and a
   `wal_checkpoint(TRUNCATE)` after any ingest that changed something. No
   full `VACUUM` runs in normal operation. The worst maintenance peak is an FTS
   optimize at the budget: about 48 MB plus a WAL the size of the trigram index,
   under 100 MB.
5. **One-time migration.** Opening a v2 index read-write deletes the file
   (WAL and shm too) under a create-exclusive lock, recreates it at v3, and
   carries the small `recall_hit_counts` table across. Where the file cannot be
   unlinked it drops the tables and vacuums in place. Hooks open with
   `migrate: false`, so a SessionStart never pays for a rebuild; the first
   `cxc chat search` or `cxc chat index` does it.
6. **Nothing is lost.** The index is derived from rollouts Codex keeps.
   Searches whose window reaches trimmed sessions say so and point at
   `--scan`, which reads the raw JSONL.
7. **Idle machines do nothing.** Ingest runs only from explicit search, index
   and status commands; with no changes it does one size measurement and no
   writes. No timer or server touches the index.
8. **Health metric.** `cxc chat index --status` and `cxc memory status` report
   on-disk bytes against the budget and the number of trimmed sessions
   (`--json` carries `recallIndex`). SessionStart gets one line only when the
   file on disk exceeds the budget, which is the state an old 410 MB index is in
   until its first migration. This check is a `stat`, never a database open.
9. **Injection budget.** The recall SessionStart envelope is capped as a whole:
   2,400 characters at startup and 1,400 after compaction (about 600 and 350
   tokens at 4 characters per token). The session block already has its own
   1,400 / 800 cap; optional lines (pipeline notice, index status) are clipped
   to 320 characters and dropped first; the closing recall pointer always stays.
10. **Exhausted job pile.** SessionStart reports only jobs that exhausted their
    retries in the last 7 days. The full count stays in `cxc memory status`,
    which now also counts inert rows: stage-1 jobs that finished over 90 days
    ago, which the host can never claim again. `cxc memory prune` deletes
    exactly those (dry run by default, `--apply` to write, never younger than
    90 days because that is the host's own maximum age window). Requeueing
    context-window failures stays opt-in, since they fail the same way again.

## Rejected

- `detail=column` / `none` on either FTS table: breaks substring and split-word
  queries (measured above).
- A text-length budget: inexact across languages.
- `PRAGMA max_page_count` as the cap: writes past it fail with `SQLITE_FULL`
  mid-ingest; admission control plus eviction keeps the same bound without
  failing a search.
- Deleting exhausted jobs younger than 90 days: the host would re-create and
  re-run them, repeating context-window failures.
- Leaving SQLite: the index needs FTS5's trigram tokenizer for Korean
  substring search, and a 48 MB SQLite file with incremental vacuum meets the
  target.

## Verification

- `index-budget.test.ts`: a 160-session, ~17 MB synthetic history (seeded
  English/Korean text, explicit mtimes) ingested under a 3 MB budget stays
  under budget on disk, keeps the newest sessions, records the rest as
  metadata, refreshes idle with zero work, and re-indexes a revived session;
  an oversized index is evicted oldest-first below the low-water mark with an
  FTS integrity check; a v2 index migrates once with hit counts kept and hooks
  refusing to migrate; the SessionStart envelope stays under its cap; prune
  touches only inert stage-1 rows.
- Real data, scratch `CODEXCLAW_HOME`: default budget 41.3 MB in 3.9 s; a
  20 MB budget settles at 15.3 MB with 181 sessions trimmed; an idle refresh
  takes 21 ms.

## Follow-up: patterns ported from oh-my-openagent

The omo lane (`lidge-jun/oh-my-openagent` `feat/small-memory-store`,
`docs/reference/memory-storage-budget.md`) bounded its store with four
mechanisms. How each maps here:

| omo | codexclaw |
|---|---|
| Reasoning and tool results capped at capture to a 2,048-char head+tail window | Reasoning is never indexed. Chat (4 KB) and tool (1 KB) caps now keep a head+tail window (3/4 head, 1/4 tail) instead of only the head, so a tool's final error line survives. |
| Consumed transcripts retired; `retired.ids` keeps 16-hex keys so replays dedupe; markers expire after 90 days | The rollouts belong to Codex and stay read-only, so codexclaw has no transcripts to retire. The equivalent is the evicted `files` row: its (mtime, size) fingerprint is the dedupe marker that stops an unchanged session from being parsed again. It expires when the rollout disappears (pruned on the next full refresh). |
| Budget enforced in a maintenance pass: once per 12 h per identity across processes, 30 s after a session binds, lock-held, no work on a host without a session | `maintenance.ts`: SessionStart claims `recall/maintenance.lock` create-exclusively and spawns one detached child (token passed on argv and verified) when the `recall/maintenance.json` stamp is older than 12 h and an index exists. The child waits 30 s, migrates/refreshes/evicts/compacts, writes the stamp, releases the lock. Stale locks are taken over after 30 min, judged by the claim time inside the lock. |
| `measureMemoryFootprint` per area, `/doctor` warns above 64 MiB | `footprint.ts`: capped `lstat` walk of `~/.codexclaw` by area (recall, projects, backups, skill-cache, sessions, other). `cxc memory status` prints it with the last pass; `cxc doctor` `memory-footprint` warns above 100 MiB total or when the recall area passes its budget. |

Measured on this machine (read-only): the live store is 401.6 MiB, of which
391.2 MiB is the pre-v3 index. A scratch store built from the same rollouts was
taken from 15.2 MB to 5.9 MB by one scheduled pass under an 8 MB budget, with
the hook itself returning immediately.
