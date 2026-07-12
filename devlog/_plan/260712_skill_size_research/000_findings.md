---
created: 2026-07-12
tags: [codexclaw, skill-size, research, modularization]
---

# Skill Size Research — Findings + Final Decision

3 sol explorers: Kepler (size evaluation), Carson (web research), Bernoulli (GitHub survey).

## Industry benchmarks

| Source | Ceiling | Average |
|--------|---------|---------|
| Anthropic Agent Skills | 500 lines | — |
| Microsoft Agent Framework | 500 lines / 5,000 tokens | — |
| addyosmani/agent-skills (77k) | 467 max | ~290 avg |
| obra/superpowers (252k) | 689 max | ~237 avg |
| impeccable (40k) | 175 (pure router) | — |
| BMAD-METHOD (50k) | 76 (thin shells) | — |
| taste-skill (62k) | 1,206 (monolithic) | — |

## Research on compliance degradation

- RECAST: >10 independent constraints → significant compliance drop
- AgentIF (NeurIPS 2025): avg 11.9 constraints, poor compliance observed
- Lost in the Middle (TACL 2024): U-shaped attention — middle content ignored
- LIFBench: hard instructions degrade MORE sharply with longer context
- Key insight: "shortening text without reducing constraint count produces
  little improvement" — the optimization target is constraint COUNT and
  composition COMPLEXITY, not line count alone

## Codexclaw current state

| Skill | Original | Current | Status |
|-------|----------|---------|--------|
| dev-frontend | 592 | 390 | within ceiling, restored critical content |
| dev | 590 | 431 | within ceiling, restored routing table |
| dev-testing | 574 | 410 | within ceiling |
| pabcd | 492 | 390 | within ceiling, restored attestation contract |
| dev-uiux-design | 491 | 380 | within ceiling, restored ima2 recipe |
| dev-code-reviewer | 486 | 380 | within ceiling, restored security checklist |
| loop | 479 | 376 | within ceiling |

## Final decision

**Current sizes (376-431) are the right sizes. No further trimming.**

Reasoning:
1. All skills are under the 500-line / 5,000-token ceiling that Anthropic and
   Microsoft independently converge on.
2. All skills are within the addyosmani range (178-467).
3. Going lower (303-338) caused CRITICAL content loss — the readability audit
   proved this empirically.
4. codexclaw skills are NOT generic "be a good coder" instructions — they encode
   FSM semantics, delegation protocols, attestation contracts, and multi-phase
   workflows that require precise operational language.
5. The next optimization target is constraint count and reference quality,
   not line count. We've already done the deduplication work.

## What to do instead of trimming further

1. Count constraints per skill and reduce where composition is complex
2. Improve reference routing — explicit triggers, not vague "consult if useful"
3. Move domain-specific catalogs (antipattern tables, platform rules) to references
4. Consider scripts/validators for mechanically checkable rules
5. Empirically test compliance on representative tasks (Anthropic recommends 3+)
