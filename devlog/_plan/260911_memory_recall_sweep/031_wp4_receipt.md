# 031 — wp4 receipt (L3 / #139 + #140, recall CLI arg hygiene)

Branch `codex/fix-recall-cli-arg-hygiene`, based on `codex/fix-memory-search-semantics`
at `20b42207`. Implementation commit `0707a347`.

## Conclusion

`cxc chat index --help` no longer rewrites the user's index. Help is answered at the
top of `main`, before any sub-command can dispatch, and an unknown flag is now an
error instead of a silent ingest. The path flags refuse a dash-leading value instead
of swallowing the next flag and searching a scope nobody asked for at exit 0.

The #139 report is worth restating because it is the sharpest failure in this whole
stack: during an audit, one `--help` took the index from 28 files to 101. The command
that did it had no write in its name, and the file header said the CLI "never writes".
That header is corrected in this layer too.

## What changed

| file | change |
|---|---|
| `recall/src/cli.ts` | `wantsHelp` answered at the top of `main`; positional `help` and `/?` for `chat index` only; `strict: true`; `flagLikePathError` over `--cwd`, `--cwd-only`, `--home`, `--index-path`; `explicitHome` refusing a missing directory; header comment corrected |
| `recall/src/memory-search.ts` | missing root and missing db are distinct warnings, one each; the relaxed-retry `searchStage1` stays silent |
| `recall/test/cli-arg-hygiene.test.ts` | NEW, the argv matrix |
| `recall/test/memory-search.test.ts` | warning-count assertions tightened |

## Help matrix after this layer

| argv | result |
|---|---|
| `chat index --help` | usage, exit 0, **no ingest** |
| `chat index help` | usage, exit 0, no ingest |
| `chat index /?` | usage, exit 0, no ingest |
| `memory search --help` | usage, exit 0 — it exited **1** before |
| `memory search help` | searches for the word "help" |
| `chat search help` | searches for the word "help" |
| `--Help`, `-help`, `--help=true` | parse error, exit non-zero, no ingest |

The last row is deliberate. Widening `wantsHelp` to case-insensitive or single-dash
spellings is exactly how `help`-as-a-query gets broken, and the audit showed that
copying the existing `isHelpToken` prior art from `orchestrate-cli.ts` would do
precisely that. Those spellings fail loudly and do not ingest, which is the property
that mattered.

## Evidence

RED on the parent `20b42207`, re-proved independently by the main session:

```text
git stash push -- recall/src recall/dist
test.mjs cli-arg-hygiene.test.ts memory-search.test.ts
  -> tests 27, fail 15
     chat index --help / --help beats --rebuild / -h is help
     chat index help / chat index /?
     memory search --help exits 0 with no query
     dash-leading --cwd-only / equals-form / --cwd + --home / equals-form
     missing --cwd-only value / unknown flag / missing --home
     root and db warn once (incl. relaxed retry) / db degrades with a warning
git stash pop -> tree restored
```

The two "help stays a query" pins were green among the other 12 — the guard rails
held while every real defect failed.

GREEN: `npm run build` exit 0; focused recall suite `tests 223, pass 223, fail 0`
(207 before this layer).

## Safety note

No `cxc chat index` was ever run against the real home, on the parent or after the
fix. Every test points at a temp `--home` and `--index-path`. Reproducing #139 live
would have caused the exact harm the issue reports, so the before/after evidence is
the temp-home matrix and the code trace, not a live run.

## What did not improve

`chat search` can still trigger a refresh-ingest as a side effect of searching; this
layer only guarantees that asking for HELP never does. Whether a search should
silently ingest at all is a real question and it belongs to L4, which owns the
freshness accounting — it is noted there rather than fixed here.

## Next

wp5 / L4 / #144 on `codex/fix-chat-index-freshness`, based on this branch.

