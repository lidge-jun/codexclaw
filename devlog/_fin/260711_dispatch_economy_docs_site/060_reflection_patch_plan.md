---
created: 2026-07-11
tags: [codexclaw, pabcd-initiative, dispatch-economy, reflection, plan, diff-level]
---

# Loop 2 — reflect Loop-1 findings + port economy to pabcd (diff-level plan)

Status: PLANNED (rev 3 — A-gate rounds 1-2: 5 blockers total, all ACCEPT)

## Loop-spec header

- Loop archetype: spec-satisfaction (verifier = rg presence/absence checks +
  gate).
- Trigger: user — "pabcd에 반영하는 loop도 한바퀴"; input = 051 fix set.
- Goal: (a) fix the two confirmed text-vs-runtime contradictions + one
  ambiguity in codexclaw rule text; (b) port DISPATCH-ECONOMY-01 into the
  agent-neutral pabcd_initiative dev-pabcd SOT and retire the stale
  complexity-flavored "Boss writes all code" framing there.
- Non-goals: dist/src code changes (the shipped gate behavior is correct;
  TEXT aligns to it), hook manifests, jawcode/cli-jaw ports (recorded as
  backlog pointers only), docs-site edits.
- R3 carry-forward (round-1 blocker #3): the V2 catalog-pin claims
  (pabcd/SKILL.md DISPATCH-DISCOVER-01) cannot be verified from the plugin
  dist — effective selection lives upstream in opencodex config. DEFERRED
  with an explicit backlog row in 061 (verify against opencodex source or
  live-probe both surfaces in a future unit); text stays as-is.
- Verifier: (1) rg: loop/SKILL.md no longer claims attest on IDLE→P / I→P;
  (2) rg: pabcd/SKILL.md:92-area wording matches shipped gate semantics
  ("exitCode, when supplied, must be 0"); (3) rg: WAIT-VISIBILITY names the
  retry consumption; (4) rg: dev-pabcd SKILL contains DISPATCH-ECONOMY-01
  with 3 axes + disposition obligation, agent-neutral (no cxc/host-CLI
  commands in the new text), AND zero surviving absolute delegation claims:
  `rg -n "write all code|read-only verifiers unless|Workers verify \(read-only\)\. You write|Boss writes"`
  over dev-pabcd/SKILL.md returns only economy-qualified wording (round-1
  blocker #2); additionally (round-2 blocker #2) delegation-permission
  sentences introduce NO axis outside ECONOMY-01's three:
  `rg -n "load-bearing|complex logic|critical code"` over dev-pabcd/SKILL.md
  gains zero new hits vs baseline `a5c4aef`; (5) `npm run gate` PASS in
  codexclaw; (6) both repos committed.
- Stop condition: all six verifier rows pass.
- Memory artifact: this plan + 061 impl record.
- Expected terminal outcome: DONE.
- Escalation condition: upward — reviewer FAIL x3 -> replan; downward — none
  (small coupled text edits, main-owned).
- Write scope: `plugins/codexclaw/skills/loop/SKILL.md`,
  `plugins/codexclaw/skills/pabcd/SKILL.md`,
  `../pabcd_initiative/skills/dev-pabcd/SKILL.md`, this devlog unit, commits.

## Delegation plan (DISPATCH-ECONOMY-01)

| Slice | Axis call | Disposition |
| --- | --- | --- |
| A-gate review of this plan | audit dispatch, decorrelated | DISPATCH (gpt-5.6-sol — reuse Poincare: same role + same unit context per DISPATCH-ACTOR-01) |
| Text patches (4 codexclaw + 2 initiative) | small, tightly coupled to 051 judgment | MAIN |
| Verification + commits | main-owned close | MAIN |

## File change map (diff-level)

1. `plugins/codexclaw/skills/loop/SKILL.md`
   - ORCH-MANDATE step 4 (line ~27): "Advance every forward edge with
     `--attest`" -> "Advance the four gated work edges (P>A, A>B, B>C, C>D)
     with `cxc orchestrate <phase> --attest <json>` ...; entry edges (IDLE→P,
     I→P) are explicit commands without an attest JSON — the shipped gate
     (`dist/attest.js` GATED_TRANSITIONS) gates exactly those four."
   - Contract bullet "There is no I -> P auto-advance..." : split command vs
     attest — the agent advances every phase by explicit command; only the
     four work edges carry `--attest`.
   - WAIT-VISIBILITY bullet 3: append "That retirement CONSUMES the
     DISPATCH-RETIRE-01 same-agent retry: after ~3 empty wait cycles go
     straight to fresh-spawn with the failure folded into the new packet —
     do not grant the silent agent a second retry."
2. `plugins/codexclaw/skills/pabcd/SKILL.md` line ~92: "additionally needs
   `checkOutput` + a passing `exitCode`" -> "additionally needs a non-empty
   `checkOutput`; `exitCode` is optional but, when supplied, must be `0`"
   (matches :73 and the shipped gate).
3. `../pabcd_initiative/skills/dev-pabcd/SKILL.md`
   - §7.1: add **DEFAULT (DISPATCH-ECONOMY-01)** block (agent-neutral):
     3-axis delegability (specifiability x verifiability x judgment
     ownership; collapse/crux verdicts stay with the orchestrating session,
     re-derivation/standardized implementation/research/audit are
     dispatchable), output-side triage disposition obligation
     (accept/reject/merge + one-line rationale before the next wave;
     wave-granular allowed), verbatim-anchor returns (file:line quotes,
     exact figures, URLs), batch-wave + single-synthesis preference,
     speculative dispatch default-OFF with the phase-invariant external
     research exception (quarantined `candidate — unverified`). Adoption
     note: 2026-07-11 fork-debate + Tier-2 arXiv ledger (codexclaw devlog
     `260711_dispatch_economy_docs_site`); jawcode/cli-jaw ports pending.
   - §8 Delegation Trap first bullet: keep read-only as the SAFETY default
     but ground the write exception in the economy axes, not complexity:
     "Boss writes by default; a worker may write when the slice passes
     DISPATCH-ECONOMY-01 (specifiable, verifiable, no verdict ownership)
     AND the dispatch is explicitly write-capable with a bounded scope."
   - Reconcile the three remaining absolute delegation statements (round-1
     blocker #1; round-2 blocker #1 — permission wording uses ONLY the three
     ECONOMY-01 axes, no importance/complexity axis like "load-bearing"):
     (a) §B line ~316 "You write all code by default. Workers are read-only
     verifiers unless dispatched with `--mutable`" -> "You write code by
     default and own every verdict; a worker may write when its slice passes
     DISPATCH-ECONOMY-01 (§7.1) and the dispatch is explicitly write-capable
     with a bounded scope (see Pitfalls). Workers without that grant are
     read-only verifiers."
     (b) line ~417 "Workers verify (read-only). You write all code directly
     in B." -> "Workers verify (read-only) by default; write-capable
     dispatch follows §7.1 DISPATCH-ECONOMY-01. Verdicts stay with you in B."
     (c) class table lines ~560-562: "Boss writes" cells -> "Boss-led build"
     with one economy pointer in the C3 cell ("economy-eligible slices
     dispatchable, §7.1").

## Accept criteria (c-loop2)

Verifier rows 1-6 above, each with command output captured in 061.
