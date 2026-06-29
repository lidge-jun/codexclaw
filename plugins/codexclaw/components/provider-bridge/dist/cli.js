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
 * Phase 1 scope: this is a deliberate graceful no-op. Active opencodex
 * detection and `ocx ensure` wiring are Phase 2 work (opencodex + GUI),
 * tracked in devlog step 031 (provider bridge). Shipping it as a silent
 * exit-0 SessionStart hook keeps the plugin valid and side-effect-free
 * until that work lands, rather than asserting behavior it does not have.
*/
const [, , kind, event] = process.argv;
if (kind === "hook" && event === "session-start") {
  // Phase 2 (devlog 031) adds: detect ocx, run `ocx ensure`, emit additionalContext.
  // Phase 1 intentionally exits 0 so codexclaw runs on the default model unchanged.
  process.exit(0);
}
process.exit(0);
