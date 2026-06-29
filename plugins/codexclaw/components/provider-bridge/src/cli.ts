#!/usr/bin/env node
/**
 * provider-bridge — SessionStart hook entry.
 *
 * Responsibility:
 *  - Detect whether `ocx` (opencodex) is installed and running.
 *  - If installed: DETECT-ONLY — read the available subagent/model list.
 *    Never auto-run `ocx ensure` (jun decision Q-P2-2: detect-only).
 *  - If absent: exit 0 silently (graceful skip) — codexclaw still works
 *    on codex's native model catalog (NATIVE_OPENAI_MODELS), not just one
 *    default model.
 *
 * codexclaw never bundles opencodex. It is an optional external dependency,
 * so updates are tracked by opencodex itself (npm/brew), not by codexclaw.
 *
 * Phase 1 scope: this is a deliberate graceful no-op. Active opencodex
 * DETECTION (detect-only, no ensure) is Phase 2 work (opencodex + GUI),
 * tracked in mvp_res L23 (provider bridge). Shipping it as a silent
 * exit-0 SessionStart hook keeps the plugin valid and side-effect-free
 * until that work lands, rather than asserting behavior it does not have.
*/
const [, , kind, event] = process.argv;
if (kind === "hook" && event === "session-start") {
  // Phase 2 (mvp_res L23) adds: DETECT ocx (read model/subagent list), emit additionalContext.
  // Detect-only — never auto-run `ocx ensure` (Q-P2-2).
  // Phase 1 intentionally exits 0 so codexclaw runs on the default model unchanged.
  process.exit(0);
}
process.exit(0);
