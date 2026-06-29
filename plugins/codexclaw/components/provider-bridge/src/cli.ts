#!/usr/bin/env node
/**
 * provider-bridge — SessionStart hook entry.
 *
 * Responsibility:
 *  - Detect whether `ocx` (opencodex) is installed and running.
 *  - If installed: run `ocx ensure` so Codex config/cache are current.
 *  - If absent: exit 0 silently (graceful skip) — codexclaw still works
 *    on the plain default model.
 *
 * codexclaw never bundles opencodex. It is an optional external dependency,
 * so updates are tracked by opencodex itself (npm/brew), not by codexclaw.
 *
 * MVP stub: real detection/ensure logic lands in MVP plan step 02.
 */
const [, , kind, event] = process.argv;
if (kind === "hook" && event === "session-start") {
  // TODO(mvp-02): detect ocx, run `ocx ensure`, emit additionalContext.
  process.exit(0);
}
process.exit(0);
