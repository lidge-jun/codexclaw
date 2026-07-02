---
name: cxc-ultraresearch
description: "Deep multi-source research protocol for Tier-3 swarm dispatches: EXPAND query families, run research waves, keep a journal + claim-ledger, and converge with verified claims. Use when a single lookup is not enough and the main agent deliberately spawns an explorer swarm. Triggers: deep research, ultraresearch, multi-source, survey, literature, broad investigation, 심층 조사, 리서치."
metadata:
  short-description: "EXPAND/wave/journal/claim-ledger deep-research protocol ridden by base explorer subagents."
  last-verified: "2026-07-02"
---

# ultraresearch — Deep Research Protocol

This is a protocol skill attached to base `explorer` subagents for Tier-3 deep research
(`cxc-search` Tier 3). It is not a new subagent role and not a background service: the main
agent deliberately spawns explorer subagents and attaches this skill so each one follows the
same method. Nothing here runs on its own.

## When to use

Use only when a single Tier-1/Tier-2 lookup is insufficient: broad surveys, multi-source
claims, conflicting reports, or a question that needs several query families proven
independently. For ordinary latest/current lookups, stay on the `cxc-search` ladder.

## EXPAND — query families first

Before fetching, expand the question into distinct query families (entities, time windows,
source classes, rival hypotheses). Each family is a separate line of proof, not a reworded
duplicate. Record the expanded set so a reader can see the search space you chose.

## Waves

- First wave: assign one query family or source class per explorer. Spawn a real floor of at
  least two explorers when the question is genuinely multi-source; a single agent is not a
  "swarm."
- Run at least two expansion waves before converging: wave 1 discovers, wave 2 fills the gaps
  and chases the strongest leads from wave 1.
- Stop rule: stop after three consecutive no-new-lead results, or at five waves, whichever
  comes first. State which stop fired.

## Journal + claim-ledger

- Journal: each wave appends what was searched, what was found, and what remains open. The
  journal is the audit trail of the research, not a summary written at the end.
- Claim-ledger: every factual claim is recorded with its proving source URL and the tier it
  reached (Tier 1 discovered vs Tier 2 proven). A claim with no Tier-2 proof is marked
  unverified, never promoted silently.
- Verified-claims: the converged answer cites only claims that reached Tier-2 proof; unverified
  leads are listed separately as open questions.

## Grounding (no invention)

Snippet consensus is not verification: agreement among any number of search snippets never substitutes for opening the source — a claim reaches verified only via Tier-2 proof. Every candidate and claim must come from a real search result, not memory. Discovery stays
Tier 1 (hosted `web_search`); proof opens the source (`cxc-search` Tier 2, optionally the
`agbrowse` HTTP-first proof helper). Do not fabricate URLs; do not cite a number before the
source is opened.

## Boundaries

- No new subagent role: this protocol rides base `explorer` subagents.
- No server/daemon and no hidden providers; the swarm is one-shot agent work the main agent
  requested.
- This skill is on-demand: it is loaded by mention (`$cxc-ultraresearch`) or attached to a
  research dispatch; it is not implicit and nothing auto-loads it.
