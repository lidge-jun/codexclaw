# 007 — audit round 4 dispositions

Round 4 (research/05): one blocker — compare-then-rename in sync step 5 can drop a writer's goalplan publication that lands between the compare and the rename. Fold:

1. Step 5 of the 006 sync procedure becomes:
   - `*.jsonl`: append missing merged lines (unchanged).
   - paths under `goalplans/<slug>/` (non-jsonl): compare and replace while holding that goalplan's existing write lock (`withGoalplanWriteLock`, the same lock every goalplan mutation in goalplan.ts takes), so a writer cannot publish between the compare and the rename. Lock busy → conflict, sync stops before moving the branch.
   - any other path: only ADDED paths are applied, with an exclusive create (`wx`) of the tmp then `linkSync` to the final name (EEXIST → conflict). Modified or deleted non-goalplan, non-jsonl paths are reported as conflicts and never written. Those files (evidence receipts, attempts, unrecordable markers) are write-once or session-scoped to one machine, so remote modification of them is not an expected sync case.
   - diff uses `--no-renames`, so every record is one path.
2. 006 line "no data is overwritten" now holds by construction: the only replacements happen under the writer's own lock; everything else is append or exclusive create.
3. Union merge does not preserve line order across machines; ledger readers already filter by session/slug and do not rely on global order. Documented.
4. Test adds: a goalplan writer holding the goalplan lock during sync → conflict reported, live plan and branch unchanged.

