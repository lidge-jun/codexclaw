# 02 — Provider Bridge (opencodex / ocx)

Status: TODO

## Goal
SessionStart hook that makes opencodex *optional and graceful*.

## Behavior
- Detect `ocx` on PATH (and/or running proxy on its configured port).
- If present → `ocx ensure` (sync models/config to codex), then optionally inject
  an additionalContext note that multi-provider routing is active.
- If absent → exit 0 silently. codexclaw runs on the plain default model.
- Never fail the session because ocx is missing (graceful skip — fail-fast only
  reports, never silently substitutes a wrong provider).

## Files
- `components/provider-bridge/src/cli.ts` (hook entry — stub exists).
- Detection helper + `ocx ensure` invocation + idempotency guard.

## Verify
- With ocx installed: session start runs ensure, no error.
- With ocx absent: session start is a no-op, plugin still loads.
