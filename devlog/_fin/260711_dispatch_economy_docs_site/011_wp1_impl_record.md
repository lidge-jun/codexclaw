---
created: 2026-07-11
tags: [codexclaw, dispatch-economy, implementation, record, wp1]
---

# WP1 implementation record

Status: DONE (cycle closed via attested D, session 019f4a07)

## What shipped

- `structure/20_pabcd_dispatch_doctrine.md` §3 — DISPATCH-RETIRE-01 gained the
  packet-failure reclaim clause (two DISTINCT agents failing one packet = the
  packet failed specifiability -> main reclaims, no third copy). New
  DISPATCH-ECONOMY-01 (E7, agent-followed): three-axis delegability
  (specifiability incl. DECISION BOUNDARY x verifiability x judgment ownership),
  output-side triage disposition obligation (wave-granular allowed), model routing
  as non-overriding DEFAULT, batch-spawn preference.
- `plugins/codexclaw/skills/pabcd/SKILL.md` — 51-line delegation block
  verbatim-moved from `## Catalog Discovery routing` into the previously empty
  `## Delegation Model (subagents)` (move diff-verified byte-identical:
  VERBATIM_MOVE_OK). One-sentence non-normative ECONOMY-01 pointer (SOT stays
  doctrine §3). DISPATCH-TASK-01 amended: packet DECISION BOUNDARY sentence +
  RETURN FORMAT verbatim-anchor obligation (Memex 2603.04257 grounding). P-phase
  loop-spec `Escalation condition` now stated bidirectionally.
- `plugins/codexclaw/skills/loop/SKILL.md` — new `## Speculative dispatch
  (DISPATCH-SPECULATE-01, HEURISTIC)` after Wait visibility.

## A-gate history (reviewer: decorrelated gpt-5.6-sol explorer, reused per DISPATCH-ACTOR-01)

- Round 1: FAIL, 7 blockers — move-list omission (main-owns bullet), model routing
  overriding DIVERGE-TIER-01, packet/specifiability contract gap, summary scope
  undefined (SOT drift), no rollback, forbidden-claims description too broad,
  stale historical line refs. All 7 ACCEPT; plan rev 2.
- Round 2: GO-WITH-FIXES (1) — rollback needed verbatim pre-edit copies, not a
  HEAD-relative diff. Folded as rev 3 (`/tmp/wp1_snapshot`, sha1 recorded).
  Exit A>B as main-judged near-pass with residual disposition recorded.

## C verification

- `npm run gate` exit 0. `npm test`: 1103 tests, 1101 pass, 1 fail —
  `L11: inactive goal allows I-trigger` (hook-continuation.test.ts:78),
  proven PRE-EXISTING by A/B run against the pre-edit snapshot (identical
  failure; regression count 0). Hooks code is out-of-scope for this goal;
  failure left documented for the owner unit (likely 260711_loop_orch_mandate
  in-flight work).
- Presence: DISPATCH-ECONOMY-01 @ doctrine:146,152 / pabcd:375,417 / loop:164;
  DISPATCH-SPECULATE-01 @ loop:148.
