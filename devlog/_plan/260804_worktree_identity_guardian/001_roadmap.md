# 001 — Roadmap: worktree identity guardian

Loop archetype: spec-satisfaction repair (the failure mode is known; the verifier
is the hook test suite + live injection evidence).
Trigger: user report 2026-08-04 (delete-and-recreate pattern on app worktrees).
Goal: codexclaw sessions inside Codex-app managed worktrees stop destroying the
worktree they run in, and know the safe rename/adopt procedures.
Non-goals: patching codex-rs or the desktop app; managing other sessions'
worktrees; the opencodex usage-rollup work (separate unit, separate session).
Verifier: `node --test` in plugins/codexclaw/components/pabcd-state (full suite,
exit 0) + build/dist freshness + manual live-fire hook payloads (030).
Stop condition: all criteria in the bound goalplan met, dev pushed, main merged.
Memory artifact: this unit + goalplan ledger.
Expected terminal outcomes: DONE (primary), BLOCKED (remote auth), NEEDS_HUMAN
(scope judgment). Escalation: any push/merge failure → stop and report, no retries
with force flags.

## Phase map (dependency-ordered, PHASE-SPLIT-01)

| Work-phase | Decade doc | Content | Depends on |
|------------|-----------|---------|------------|
| WP1 (this cycle) | 000, 001, 010, 020, 030 | docs-only: research + roadmap + all phase docs | — |
| WP2 | 010 | worktree-guard hook module + CLI wiring + hook JSONs + plugin.json + unit tests | WP1 |
| WP3 | 020 | worktree-guardian skill (concept/procedures/citations) | WP1 (content-wise independent; ordered after 010 so the skill documents shipped behavior, not planned behavior) |
| WP4 | 030 | full gates, live injection evidence, SoT sync, dev push + main merge | WP2, WP3 |

Foundation first (the guard module is the enforcement layer), then the knowledge
layer (skill), then the release surface. No effort buckets.

## Goalplan binding

goalplans/codexclaw-codex-codex-codex-worktrees-hash-repo — workPhases wp1-docs /
wp2-build-hook / wp3-skill-docs / wp4-verify-publish map 1:1 onto this table
(refined from the 3-phase skeleton at this docs-cycle D, per LOOP-DOCS-FIRST-01).
