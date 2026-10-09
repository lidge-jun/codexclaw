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
cxc memory status [--json] [--home PATH]
cxc memory requeue [--apply] [--include-context-window] [--kind K] [--limit N]
                   [--retries N] [--json] [--home PATH]
```

`cxc chat search` and `cxc memory search` do not write Codex session files or the
memory store. They are not write-free against the sidecar: without `--no-refresh`,
`cxc chat search` refreshes the sidecar index at `~/.codexclaw/recall/index.sqlite`,
and `cxc chat index --rebuild` deletes and re-ingests that index. Pass
`--no-refresh` when the index must stay untouched.

Flags that live in the CLI USAGE and are easy to miss:

- `--rank` — relevance order (the default; accepted for explicitness). `--recent`
  is newest-first.
- `--full` — with `--json`, skip the 500-char clip.
- `--home PATH` — search an alternate Codex home (default `$CODEX_HOME` ?? `~/.codex`).

`cxc memory status` reports the HOST extraction pipeline, which is a different system
from the recall index above: per-kind job counts, jobs that exhausted their retries
bucketed by cause, and the newest success. It names the store it read, because the host
supports more than one memories schema, and reports `unsupported` rather than guessing.

Every snapshot carries `observationSource: "jobs-db"`, identifying the collector even
when the store is missing or unreadable. `effectiveExtractionRoute` and
`startupGuardDecision` are always `"unknown"`: job history, including a recent success
or a quota-classified error, cannot establish the current extraction route or startup
guard decision. Text output states this limit too; healthy SessionStart notices stay
silent. Provider-bridge status is not extraction-route evidence, and setting the
threshold to zero is not a universal bypass: a present `rate_limit_reached_type` still
blocks startup, while an absent flag permits a numeric 100% window at threshold zero.

`cxc memory requeue` returns dead-lettered jobs to that pipeline's retry queue. It is a
**dry run unless you pass `--apply`**, because it writes to the live memory database.
By default it selects only transient causes; `--include-context-window` is opt-in and
usually a bad idea, since an input that did not fit the context window will not fit on a
retry either — it just spends quota failing again.
- `--json` on `cxc chat index` prints index status as JSON.

Defaults that matter:

- Words AND together; pass `--any` for OR. Quote the whole query.
- A space split keeps up to 16 words. Through 8 every word is required. Past 8
  the AND relaxes: symbols, versions and mixed-case names (`2.49.0`, `npm`,
  `CI`, `BundledPluginsMarketplace`) stay required, and the rest become a quota
  — half of them, rounded up. Six fillers (그 / 이 / 저 / 것 / 문제 / 방법) are
  dropped at any length; 진짜 and 지난번 are not.
- A relaxed query can therefore answer a whole sentence, but it ranks by word
  overlap, not by what you meant. The [rewrite ladder](../SKILL.md#natural-language--keyword-ladder) still wins.
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
