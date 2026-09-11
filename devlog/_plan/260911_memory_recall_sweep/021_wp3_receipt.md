# 021 — wp3 receipt (L2 / #142 + #143, memory search semantics)

Branch `codex/fix-memory-search-semantics`, based on `codex/fix-recall-cwd-normalization`
at `1e819453`. Implementation commit `c8bb1ff9`.

## Conclusion

A memory file that answers the query across a blank line is no longer silently
dropped, a thread is no longer marked "already found" when nothing was kept, and the
chat fallback now searches with the same synonym expansion the memory path used.
The three defects compounded: the first produced zero paragraph hits, the second
told stage1 to skip that thread's chat rows, and the third made the fallback blind
in exactly the mixed-language case it existed for. A user asking a two-word question
about a document they could see got an empty result and no warning.

## What changed — `memory-search.ts` only, +46 lines

1. **File-span fallback.** When the file-level AND passes and every
   blank-separated paragraph fails, one file-span hit is emitted — same nine
   `MemoryHit` fields, same `scopeAdjust`, same `PER_FILE_CAP` and `rankAndTrim`.
   It runs only when `paragraphMatches === 0`, so a paragraph hit that `--cwd-only`
   legitimately dropped does not resurrect itself as a file hit.
2. **`matchedThreadIds` moves.** The `add()` left the file-level AND at `:474-475`
   and now fires after `candidates.length > keptBefore`. The comment at the stage1
   skip changed with it: "already hit via its md file" was not true, "already kept a
   file hit for this thread" is.
3. **Fallback forwarding.** `synonyms: opts.synonyms ?? true` and
   `any: opts.any === true`. The `??` is load-bearing: chat tests
   `opts.synonyms === true` on its side, so forwarding chat's own expression would
   have passed `undefined`, read as false, and the fix would have been a no-op that
   still looked correct in review.

`firstMatchStartLine` is new and pinned off line 1 — the Test A fixture asserts
`startLine === 3` — rather than shipped on the strength of a fixture that matches in
the first paragraph.

## Evidence

RED on the parent `1e819453`, proven per-test by the main session after the fact,
and per-assertion by the executor before the fix:

```text
git stash push -- recall/src recall/dist
test.mjs memory-search.test.ts chat-fallback.test.ts
  -> tests 21, pass 18, fail 3
     ✖ the chat fallback forwards synonyms and any
     ✖ file-level AND still hits when tokens sit on opposite sides of a blank line
     ✖ matchedThreadIds records a thread only after a file hit is kept
git stash pop -> tree restored
```

Exactly three red, and Test B green among the 18 — the lock held while the three
real defects failed. Executor's pre-fix capture: A `assert.ok(r.hits.length >= 1)`
falsy, C `0 !== 1`, D `undefined !== true`.

GREEN: `npm run build` exit 0; focused recall suite `tests 207, pass 207, fail 0`
(203 before this layer, so all four new names ran).

## Deviations, and one thing deliberately not done

- **Test B is a lock, not proof.** It was already green on the parent. The audit
  called that out and it is recorded as a lock here rather than counted as
  red-green evidence. `paragraphChunks` was not touched to manufacture a red B.
- **File-span scoring is not special-cased.** `scoreChunk` sees the whole file, so
  the heading bonus at `:192` does not fire for a file that opens with frontmatter,
  while a heading paragraph would get it. That is a value difference on one field
  through one code path. A scoring branch that existed only for the fallback would
  reintroduce exactly the paragraph-vs-file divergence this layer removes.
- **Test C closes its sqlite handles before `searchMemory`.** The audit predicted
  that an open `DatabaseSync` on this Windows host fail-softs stage1 to zero hits —
  indistinguishable from the bug. The fixture follows `cwd-scope.test.ts`.

## What did not improve

The file-span excerpt is a 400-character window around the first present term, so
for a long document the two matched words can still be far outside it. The hit is
correct and findable; the excerpt may not show why it matched. Merging the two
matching paragraphs was considered and rejected — it invents text the file does not
contain and breaks `startLine`. If users report confusing excerpts, that is the
thread to pull, and it is a separate change.

## Next

wp4 / L3 / #139 + #140 on `codex/fix-recall-cli-arg-hygiene`, based on this branch.

