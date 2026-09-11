# 011 — wp2 receipt (L1 / #138, recall cwd normalization parity)

Branch `codex/fix-recall-cwd-normalization`, based on `codex/memory-recall-roadmap`
at `ba305627`. Implementation commit `9d9f1046`.

## Conclusion

The scan path and the index path now canonicalise a working directory the same way,
including the Windows extended-length and extended-UNC prefixes, and case folding
is on for `win32` as well as `darwin`. A non-git workspace — where `cwd` is the only
key and the `repo_key` OR branch cannot rescue the query — returns the same hits
through both engines.

## What changed

| file | change |
|---|---|
| `recall/src/rollout.ts` | `normalizeCwd` strips `//?/` and `//?/UNC/` after the slash fold, then re-trims; new `foldCwdCaseFor(platform)`; `FOLD_CWD_CASE = foldCwdCaseFor(process.platform)`, now true on `win32`; new `canonicalCwdSql(expr)`, the SQL twin |
| `recall/src/index-search.ts` | `candidateFilter` compares `canonicalCwdSql("f.cwd")` against `normalizeCwd(opts.cwd)` in the equality arm AND the LIKE arm; the backslash LIKE pattern is dropped because the column is slash-folded before comparison |
| `recall/src/cwd-context.ts` | `listCwdSessions` uses the same pair; the separate `lower(cwd)` condition collapses into one canonical comparison |
| three test files | 12 regressions, every fixture with `repo_key` NULL |

`+361/-61` across 9 files including the tracked `dist`.

## Why a SQL twin and not a UDF

`RwDb` exposes `{ prepare, exec, close }` only (`sqlite.ts:19-23`). There is no
`function()` hook to register `normalizeCwd` as a SQLite UDF, so the canonical form
has to be expressed as SQL. That is a duplication of logic and it is the standing
risk of this layer: the two implementations can drift. The audit mitigated it by
executing the generated SQL against `node:sqlite` and comparing it to the JS on
extended-length, extended-UNC, mixed separators, trailing separator, lowercase
drive, plain UNC and empty input — no disagreement. The matrix test
`canonicalCwdSql matches normalizeCwd on the prefix matrix` keeps that honest.

## Evidence

RED, proven twice and independently:

```text
main session:  git stash push -- recall/src recall/dist
               test.mjs cwd-scope.test.ts index.test.ts cwd-context.test.ts
               -> tests 3, pass 0, fail 3   (all three fail at import: canonicalCwdSql
                                             and foldCwdCaseFor do not exist on the parent)
               git stash pop -> tree restored
executor:      per-assertion red captured before the source patch, e.g.
               index extended-length        0 !== 1
               index separator mismatch     0 !== 1
               index case-differing         0 !== 1
               index child path             0 !== 1
               listCwdSessions \\?\          0 !== 1
               normalizeCwd strips...       '//?/C:/Users/super/Developers' !== 'C:/Users/super/Developers'
```

The main session's re-proof is import-level rather than per-assertion, because the
new tests import helpers that do not exist on the parent. Both halves together show
the tests cannot pass without this layer.

GREEN:

```text
npm run build                                exit 0, 179 files compiled
receipt test (recall + pabcd-state)          tests 1422, pass 1420, fail 0, skipped 2, exit 0
```

The focused suite grew from 1410 to 1422 — the 12 new regressions, none of them
replacing an existing assertion.

## Deviations from the plan, and why

- **B.3 child-prefix fixtures** are asserted on the index and scan paths but not on
  `listCwdSessions`, which stays an exact-cwd surface by design (§4.5/§5.3): a child
  path is a different project surface and automatic injection must not federate.
- **B.5 Windows previously-matching pin** was green before the fix. It is an
  existing-behaviour pin, not a regression test, and it is declared as such rather
  than dressed up as red-green evidence.
- **`hook.ts:517`** reads `FOLD_CWD_CASE` and therefore widens on win32 with no
  Windows-specific pin of its own. This layer does not edit `hook.ts` and did not
  start. The exposure is declared here, per B.5.

## What did not improve

The duplication between `normalizeCwd` and `canonicalCwdSql` is real and unresolved.
If a later layer changes one, nothing but the matrix test forces the other to
follow. The honest alternative — normalising `cwd` at ingest so the stored value is
already canonical — was rejected in the plan because it breaks `--no-refresh`
against an already-ingested index, which is precisely the case the issue reproduces
on. If a future change makes re-ingest cheap, that alternative becomes better than
this one.

## Next

wp3 / L2 / #142 + #143 on `codex/fix-memory-search-semantics`, based on this branch.

