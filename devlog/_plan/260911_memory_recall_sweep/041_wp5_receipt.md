# 041 — wp5 receipt (L4 / #144, chat index freshness)

Branch `codex/fix-chat-index-freshness`, based on `codex/fix-recall-cli-arg-hygiene`.
Implementation commit `4a300a2d`.

## Conclusion

The index no longer grades its own homework. `--status` and the SessionStart banner
now measure the index against the source JSONL on disk, read-only, and report what a
refresh would actually touch. The reported number counts files that **changed**, not
only files that are missing — which was the whole point of #144, since the reported
case was three files that had grown while the count stayed identical.

## What changed

| file | change |
|---|---|
| `recall/src/ingest.ts` | `FreshnessBudget`, `BANNER_FRESHNESS_BUDGET`, `IndexFreshness`, `measureIndexFreshness`; `last_ingest_at` stamped only when `ingested + appended + pruned > 0` |
| `recall/src/cli.ts` | `--status` reports exact figures with no budget; the banner uses the bounded report and renders a truncated scan as `N+` |
| `recall/src/chat-search.ts` | `staleFiles` comes from the report instead of `sourceFiles - status.files` |
| `recall/src/hook.ts` | comment only; `noRefresh: true` is unchanged |
| `recall/test/index-freshness.test.ts` | NEW |

`index-db.ts` is untouched. `indexStatus` stays a pure sqlite COUNT and the module
keeps no filesystem knowledge.

## The cost problem, and how it was bounded

The banner runs at **every SessionStart**. A naive implementation stats every rollout
JSONL: fine on this host's 219 files, seconds on the ~13k the product documentation
describes, and well past the hook's own sub-200ms expectation. The audit caught this
before a line was written.

```text
banner + search   { maxStats: 512, maxMs: 50 }, newest-first
--status          no budget, exact
missing / extra   path-set difference, zero statSync
changed           the only term that costs a stat, and the only one bounded
truncated         report carries truncated: true; banner prints "stale: N+"
```

The lower-bound rendering matters. Replacing a number that was wrong with a number
that is quietly incomplete would have been the same bug wearing a better hat.

## Evidence

RED on the parent, re-proved independently by the main session:

```text
git stash push -- recall/src recall/dist
test.mjs index-freshness.test.ts index.test.ts
  -> tests 19, pass 16, fail 3
     ✖ index-freshness.test.ts            (whole file: indexStatusLine is not exported)
     ✖ ingest: builds, is incremental, and prunes deleted files
     ✖ cli: chat index --status and --rebuild work against --index-path
git stash pop -> tree restored
```

The executor's per-assertion capture is sharper where it matters: the stamp test
planted `2000-01-01T00:00:00.000Z`, ran a no-op ingest, and got
`2026-09-11T14:29:49.246Z` back — the always-stamp bug, caught by a sentinel that
cannot collide. Comparing two `toISOString()` values would have passed inside the
same millisecond with the bug fully present; the audit caught that too.

GREEN: `npm run build` exit 0; focused recall suite `tests 234, pass 234, fail 0`
(223 before this layer).

## What did not improve

`chat search` still refreshes by default — this layer only made the resulting
staleness honest. Whether a read command should ingest at all is a real design
question raised by L3 and still unanswered; it is bigger than #144 and is not
smuggled in here.

The 512/50ms budget is a guess calibrated on one host with 219 files. It is not
measured against a 13k-file home, because no such home was available. If the banner
still feels slow for a heavy user, that constant is the first thing to revisit, and
`truncated: true` already makes the truncation visible rather than silent.

## Next

wp6 / L5 / #137 on `codex/fix-recall-intent-regex`, based on this branch.

