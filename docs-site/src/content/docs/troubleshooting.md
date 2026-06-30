---
title: Troubleshooting
description: Common codexclaw issues — hooks not running, stale state, provider detection, and the GUI.
---

## Hooks do not run

Codex runs hooks only after you trust them.

- Re-open Codex's hook review and trust codexclaw's hooks.
- Under the [dev symlink](/codexclaw/development/dogfood-dev-symlink/), trust applies to your
  live checkout files — re-trust after large changes.
- codexclaw never forges hook trust. If a hook still does not run, confirm `${PLUGIN_ROOT}`
  resolves and the component `dist/` is built (`npm run build`).

## A session is stuck at a phase

- Check state: `cxc orchestrate status`.
- Close or reset: `cxc orchestrate reset` returns the phase to `IDLE`.
- Remember `D` is a closing action; you should not see a session resting at `D`.

## The Stop loop will not release

The continuation only blocks under an active goal with an in-flight cycle, and it is bounded:

- It releases at `IDLE` / no active goal.
- It releases under context pressure.
- It releases after the stagnation cap (consecutive blocks at the same phase with no transition).

If it still blocks unexpectedly, reset the phase and confirm no goal is active.

## Provider detection looks wrong

- The bridge is detect-only. If `ocx` is not detected, confirm it is installed and on `PATH`.
- codexclaw never runs `ocx ensure`. Provider setup is an
  [opencodex](https://github.com/lidge-jun/opencodex) concern.

## `cxc gui` fails to start

- Install GUI deps: run `npm install` in `plugins/codexclaw/gui`.
- The GUI is local-only and unauthenticated; use it on `localhost`.

## Stale state references

- The shipped state layout is `.codexclaw/sessions/<sessionId>.json`. If a tool or doc references
  `.codexclaw/state.json`, that is stale — see the [State Model](/codexclaw/concepts/state-model/).

## Build or test failures

- Use Node.js 22+.
- Run `npm run build` then `npm test` from the repo root. The build is idempotent; a second run
  should produce no changes.
