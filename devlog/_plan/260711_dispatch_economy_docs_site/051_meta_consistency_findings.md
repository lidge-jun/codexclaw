---
created: 2026-07-11
tags: [codexclaw, dispatch-economy, meta-audit, findings, triage]
---

# Loop 1 — meta-consistency findings + main triage (DONE)

Cycle: P -> A (sol round 1: 4 blockers ACCEPT -> rev 2; round 2 PASS) ->
B (2 sol lanes) -> C (main re-verification) -> D. Session
`019f4a07-70d9-7fc3-bdcb-9276fa5f2522`, baseline commit `95eaf677`.

## Lane returns

- Lane T (Carson, gpt-5.6-sol): 0 CONTRADICTION / 6 VARIATION / 1 UNCLEAR +
  24-row coverage ledger. Full rows recovered from the agent rollout (the
  final chat message was a receipt; rows lived one turn earlier).
- Lane R (Sartre, gpt-5.6-sol): 2 CONTRADICTION / 1 UNCLEAR / 23 VERIFIED
  dist anchors incl. src/dist parity spot-checks. First return was empty
  (agent deadlocked on "evidence recording" vs read-only packet) — tightened
  re-instruction (chat-only deliverable) fixed it; counts as the packet's one
  same-agent retry.
- Dispatch-hygiene note (itself loop-relevant): both sol lanes tried to
  persist evidence files / run FSM commands despite read-only packets —
  Carson wrote `.codexclaw/evidence/lane-t-meta-contradiction-audit.txt`
  (out of scope, tolerated as harmless). Return-surface friction: V1
  `wait_agent` delivers only the FINAL message, so a lane that "replies then
  receipts" loses its payload — recovered via rollout read.

## Main triage (accept/reject/merge, 100% of rows)

| Row | Class | Disposition | Action |
| --- | --- | --- | --- |
| T1 reviewer reuse vs decorrelate | VARIATION | ACCEPT | none (initial independence + reuse carve-out compose) |
| T2 RETIRE vs ECONOMY | VARIATION | ACCEPT | none (ex-ante test vs ex-post failure handling) |
| T3 SPECULATE vs ECONOMY | VARIATION | ACCEPT | none (timing overlap only; packet duty intact) |
| T4 3 empty waits vs one same-agent retry | UNCLEAR | ACCEPT -> FIX | Loop 2: WAIT-VISIBILITY clarifier — empty-wait retirement CONSUMES the RETIRE-01 same-agent retry |
| T5 Tier-1 lanes vs batch-spawn | VARIATION | ACCEPT | none (lanes ARE a wave) |
| T6 bidirectional escalation vs mid-B ban | VARIATION | ACCEPT | none (same sentence constrains itself) |
| T7 independent A-gate vs reviewer reuse | VARIATION | ACCEPT | none (independence = from producer) |
| R1 "every forward edge" attest | CONTRADICTION | ACCEPT -> FIX | Loop 2: scope attest wording to the four gated edges (IDLE→P / I→P are explicit commands, no attest JSON); dist verified: `dist/attest.js` GATED_TRANSITIONS = {P>A,A>B,B>C,C>D} |
| R2 C→D exitCode "required" | CONTRADICTION | ACCEPT -> FIX | Loop 2: align pabcd:92 to the shipped gate (checkOutput required; exitCode optional, must be 0 when supplied) — pabcd:73 already correct |
| R3 V2 catalog pins unverifiable from plugin dist | UNCLEAR | ACCEPT | record only — effective selection lives upstream (opencodex config), text stays |

Zero REJECTED rows; both lanes met the coverage-ledger bar after one retry
each (T: payload recovery; R: re-instruction).

## C-phase re-verification (main, fresh reads)

- `dist/attest.js` GATED_TRANSITIONS + validateAttest early-return confirmed
  (4 edges only; C>D rejects missing checkOutput, rejects only PRESENT
  nonzero exitCode).
- `loop/SKILL.md:27` "Advance every forward edge" + contract bullet "advances
  every phase, including I -> P ... --attest" both overclaim vs dist.
- `pabcd/SKILL.md:73` correct ("optional but, if supplied, must be 0");
  `pabcd/SKILL.md:92` loose ("needs checkOutput + a passing exitCode").

Terminal outcome: DONE — 2 contradictions + 1 ambiguity confirmed, fix set
handed to Loop 2 (060 plan).
