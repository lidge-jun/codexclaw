---
created: 2026-07-02
tags: [codexclaw, recall, evaluation, benchmark, cli-jaw-comparison]
aliases: [recall WP4 eval log]
---

# WP4 — superiority evaluation loop vs cli-jaw

Gate: an adversarial codex-rescue evaluator must return SUPERIOR. Each NOT_SUPERIOR
round's gaps get fixed in a follow-up PABCD pass. This doc logs rounds and evidence.

## Round 0 — self-run head-to-head (2026-07-02, live data)

| Probe | cli-jaw (`jaw dashboard ...`) | codexclaw recall (`cxc ...`) |
|---|---|---|
| chat search "trigram" --days 7 | 0 hits, 0.58s (10 instances) | 3 hits, 0.12s no-refresh / 0.33s with refresh |
| memory search "codexclaw" | 1 hit, 0.18s | 2 hits, 0.07s |
| full-history chat query | n/a (LIKE over live table) | 20-45ms via FTS index |

### Gap found by self-benchmark: refresh-on-query latency

Default (refreshing) chat query measured 3.2s — active session files are multi-MB and
were fully re-parsed on every change. cli-jaw's live-table default is 0.1-0.5s, so this
was a genuine LOSS dimension.

**Fix (same day): append-aware ingest.** `files` gains `bytes_ingested` (complete-line
byte boundary, Buffer-scanned so UTF-8 Korean cannot corrupt the resume point) and
`last_ord`; grown files parse only the appended byte range; shrunk/rewritten files fall
back to full re-parse; schema version bump 1→2 (cache semantics: drop + rebuild).
Result: refreshing queries now 117-335ms. Regression-locked by the
"append-aware ingest" test (append path taken, exactly one entry lands, FTS-visible,
stable on re-run).

## Round 0.5 — owner directive additions (Codex-doc alignment + Win/Linux)

- `archived_sessions/` coverage: archived rollouts (flat dir, filename-borne dates) are
  now listed, date-pruned, indexed, and searchable — live index grew 1,533 → 1,769
  files (354,798 msgs), queries still ~30ms. Memory summaries reference
  `archived_sessions` rollout_paths, so recall now follows those pointers.
- Windows/Linux: CRLF-safe memory chunking (fixture regression test), byte-offset
  boundaries were already Buffer-based (UTF-8-safe), platform-neutral (date, basename)
  sort key replaces full-path string sort, no shell/POSIX-only APIs anywhere.
- A codex-rescue verifier is auditing every layout assumption against the local
  openai/codex source clone (CODEX_HOME resolution incl. Windows, rollout writer path
  template + line terminator, SessionMeta serde fields, state_<N> naming, memories
  writer) — findings folded in on return.

## Round 1 — adversarial evaluator verdict: NOT_SUPERIOR (2026-07-02)

Scorecard (for codexclaw-recall): WIN chat semantics, chat filters/corpus, output+fail-soft,
memory coverage, escaping/CJK · TIE memory days/dedupe, triggers, architecture ·
LOSS chat perf in READ-ONLY sandbox (CLI could not open the index read-only → 12s scan
fallback), freshness visibility, memory ranking, federation.

Gaps accepted for Round 2 (in impact order):
1. Read-only index open path (`--status`, `--no-refresh`, and RO-fs fallback before scan).
2. Ranked memory search (score+phrase boost+recency, not scan-order-first-limit).
3. Memory dedupe/diversity (per-file cap; MEMORY.md must not consume all hits).
4. Hook: add "as discussed previously"-class patterns; suppress `codexclaw.mjs ...` and
   generic `chat/memory search` invocations, not just literal `cxc`.
5. JSON output bounding (default clip + `--full`).
6. Federation: document single-home (+`CODEX_HOME`/`--home` override) as an explicit
   non-goal with rationale.
7. Index freshness surfaced in the search envelope (lastIngestAt, files, sourceFiles,
   stale delta).

## Round 2 — fixes (2026-07-02, all 7 gaps closed)

1. Read-only paths: `openIndexReadOnly` (no mkdir/schema/WAL writes); `--no-refresh`
   and `--status` open read-only; the refresh path degrades RW→RO-stale→scan. A
   read-only sandbox now gets index-speed queries instead of 12s scans.
2. Ranked memory search: `scoreChunk` (word coverage ×2 + occurrence density ≤5 +
   exact-phrase +5 + heading +1), sorted score→recency.
3. Diversity: per-file cap of 2 before `--limit`; MEMORY.md can no longer consume
   every slot.
4. Hook: `discussed previously/last time` patterns added; suppression now covers
   `codexclaw(.mjs) chat|memory search`, generic `chat/memory search "..."`, and
   `$cxc-recall`.
5. JSON bounding: text/title/context clipped at 500 chars with a `clipped` flag;
   `--full` opts out.
6. Federation: documented as an explicit single-home non-goal in the skill
   (`--home` covers alternate roots).
7. Freshness envelope: `index: {lastIngestAt, files, sourceFiles, staleFiles,
   readOnly}` on every index-mode result (live-verified: staleFiles 5 visible under
   `--no-refresh`).

All locked by `test/round2.test.ts` (7 tests); full suite 526/526 + gate OK.

## Round 2 — adversarial evaluator verdict: **SUPERIOR** (2026-07-02)

Gap verification: all 5 probed gaps CLOSED with live evidence (read-only `--status` +
`--json` freshness block in a read-only sandbox; score-ranked memory hits with per-file
cap ≤2; hook fires on "as discussed previously" and stays silent on raw
`codexclaw.mjs chat search`; JSON clipped at 501 / `--full` reaches 6935; single-home
non-goal section present).

Dimension scorecard (codexclaw-recall): **9 WIN** (chat semantics, filters, perf —
30ms index vs cli-jaw 0.15s LIKE over a 66× smaller table — freshness, output, memory
coverage, memory dedupe, triggers, robustness) · **2 TIE** (memory ranking — cli-jaw's
BM25/RRF is algorithmically richer; architecture) · **1 LOSS** (federation, explicitly
irrelevant to the Codex single-home bar per the evaluator).

> "All five Round 2 gap checks are closed. The only remaining LOSS is federation, and
> it is explicitly outside the Codex single-home use case."

Goal condition ("iterate until the subagent judges it superior") **met**.
