# 261022 A merged or green PR as the completion record

## Problem

On 2026-10-22 a loop finished its work, merged the PR with CI green, and still
could not complete its goal. GOAL-COMPLETE-GATE-01 and SOURCE-DELTA-01 refused
twice:

- B>C refused because the checkout was byte-identical to its state on entry to
  B. The change had already landed, so there was nothing left to differ.
- With the cycle stuck before D, `update_goal {status:"complete"}` was denied
  for a cycle in flight, and the bound plan's receipts described a source that
  had since moved.

Both gates exist to catch a rubber-stamped B and a goal declared done with work
remaining. A merged PR, or an open one with every check passing, is stronger
evidence of delivered work than either local check, and the gates had no way to
accept it.

## Design

- `cxc loop pr-record --session <id> --pr <url|number>` runs
  `gh pr view --json url,number,state,mergedAt,mergeCommit,headRefOid,statusCheckRollup`
  once. It accepts a PR that is MERGED, or OPEN with a non-empty set of
  finished checks that all passed (SUCCESS, NEUTRAL or SKIPPED; status contexts
  SUCCESS). Anything else is refused with the reason and nothing is written.
- The record is written atomically to `<evidence root>/pr-records/<session>.json`
  and read only for that session. A record with another session id or an
  unknown verdict is ignored.
- Hooks read only that file. No hook makes a network call.
- GOAL-COMPLETE-GATE-01 with a record: an open cycle, unfinished work phases,
  unmet criteria and receipt/source checks no longer deny. Unreadable state,
  unverified subagents, an unrecordable-verdict marker, a spent verification
  budget, an unreadable plan and every structural plan defect
  (`goalplanStructuralReasons`) still deny.
- SOURCE-DELTA-01 (CLI and chat path) accepts B>C over an unchanged source only
  when the record's `recordedAt` is at or after `phaseEntrySource.capturedAt`,
  so a record from an earlier cycle cannot wave a later B through.
- Deny messages name `cxc loop pr-record` as the remedy.

## Verification

`pabcd-state/test/pr-record.test.ts` (gh injected, no network):
classification of merged, green, pending, failing, status-context failures, no
checks and closed PRs; record write and refusal; per-session isolation and
rejection of a hand-edited verdict; verb parsing; the incident shape (cycle at
C, unmet criterion) denied before the record and allowed after; unverified
subagents and a cyclic plan still denied with a record; B>C refused with a
record older than B entry and accepted with one made during B.
