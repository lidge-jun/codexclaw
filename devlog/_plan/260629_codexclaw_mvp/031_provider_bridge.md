# 031 — Provider Bridge (opencodex / ocx)

Status: TODO  ·  Phase 2

## Goal
SessionStart hook making opencodex optional and graceful.

## Behavior
- Detect `ocx` on PATH and/or running proxy on its port (default 10100 GUI / proxy port).
- Present → `ocx ensure` (sync models/config), optionally inject "multi-provider active" note.
- Absent → exit 0 silently; codexclaw runs on the default model.
- Never fail the session because ocx is missing (graceful skip; fail-fast = report, never silent
  wrong-provider substitution).

## Files
- `components/provider-bridge/src/cli.ts` (stub exists).

## Verify
- ocx present: ensure runs, no error.
- ocx absent: no-op, plugin still loads.
