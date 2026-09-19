# 020 — wp3: addressing, waves and the real cap

wp2 gives a lane permission to loop. This phase makes coordinating more than a handful of
them survivable, and corrects the assumption that subagents are the unlimited resource.

## MODIFY `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md`

1. Under DISPATCH-LANE-ID-01, state the addressing forms: a lane is `threadId` plus
   `hostId`; the user-facing mention is `[@Title](thread://<threadId>?hostId=<host>)` with
   `threadId` limited to `[A-Za-z0-9_-]` and the host id percent-encoded; a queued worktree
   yields `clientThreadId`, which no tool accepts and no API resolves.
2. New **DISPATCH-FANOUT-CAP-01 (DEFAULT)**: tasks have no measured host-wide concurrency
   cap and queue per thread; subagents are capped per session (six by default on V1,
   `max_concurrent_threads_per_session - 1` on V2) and spawning past it fails outright.
   So fan-out width belongs to lanes, and subagent waves belong inside a lane. Say the wave
   size out loud and close finished agents: a completed agent holds its slot until closed.

## MODIFY `plugins/codexclaw/skills/loop/references/waiting.md`

Add to LOOP-WAIT-VISIBILITY-01: `wait_threads` watches at most eight targets with
`timeoutMs` capped at 120000, so more than eight lanes means deliberate batching — watch
the batch whose result changes the next decision, carry each target's `afterCursor`, and
do not treat an unwatched lane as idle. A wait that times out returns progress for all its
targets and is not a failure signal.

## MODIFY `plugins/codexclaw/skills/pabcd/references/delegation.md` (thread-surface table)

Annotate the rows with the measured bounds: `wait_threads` 1-8 targets / 0-120000 ms,
`read_thread` turnLimit 1-10 and maxOutputCharsPerItem 0-20000, `list_threads` limit 1-50,
`get_handoff_status` waitMs 0-60000, and create returning `clientThreadId` while a worktree
is still being set up.

## MODIFY `plugins/codexclaw/test/lane-dispatch.test.mjs`

Extend with: DISPATCH-FANOUT-CAP-01 is defined, the eight-target bound appears in
`waiting.md`, and the delegation table carries the numeric bounds. The test reads the
documents rather than restating them, so a silent edit that drops a bound fails.
