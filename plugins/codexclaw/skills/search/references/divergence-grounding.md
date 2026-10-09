## Divergence Candidate Grounding

Use an existing task's research as read-only context only when needed for a
specific uncertainty; relevant research does not justify an unsolicited message.
[Peer collaboration](../../dev/references/peer-collaboration.md) limits contact to
explicit user requests or necessary confirmed blocking CI/merge collision
coordination, with host permission and wake checks. This does not activate a
Tier-3 swarm; peer reports are leads, not primary-source proof or independent
corroboration.

When any PABCD workflow enters divergence mode (HITL manual entry or goal-mode
plateau prompt), every N>=2 candidate must carry search provenance in the divergence
archive:

- `strong-1`: Tier 2 proven by opening the original source. Concrete numbers or
  claims may be cited only after this proof step.
- `add-1`: at least Tier 1 discovered, with candidate URL recorded. Promote to
  Tier 2 before using detailed claims from it.
- Record provenance URLs with `cxc divergence candidate add ... --source <url>`.
  The archive enforces non-empty source URLs; it does not certify the search tier.
  The agent must state Tier 1/Tier 2 evidence in the rationale or phase notes.

Do not invent a candidate from memory and then search only for confirmation. Search
discovers rival approaches first; the archive records which sources justified each
candidate.
