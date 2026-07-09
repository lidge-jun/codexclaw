# 260707 Fugu Orchestration Adoption — codexclaw record

Class call: C2 (doc-rule port, no code paths touched) — fast-path record per
UNIT-RESIDENCE-01.

What changed: `plugins/codexclaw/skills/pabcd/SKILL.md` gained five rules adopted
from the Sakana Fugu learned-orchestrator report (arXiv:2606.21228v1):

- Delegation Model: DISPATCH-ISOLATION-01 (DEFAULT, read isolation + explicit
  access list in the TASK packet `SCOPE`; prevents orchestration collapse),
  SPECIALIST-CRUX-01 (HEURISTIC, first-principles re-derivation of out-of-domain
  cruxes before merge), REVIEW-DECORRELATE-01 (HEURISTIC, A reviewer/clean-slate
  re-examiner on a different model family via `spawn_agent` model override).
- Optimization-Loop Meta-Rules: LOOP-FANOUT-TIMING-01 (HEURISTIC, fan-out after
  coarse levers plateau; variance reduction counts as value),
  COLLAPSE-AGGREGATOR-01 (DEFAULT, synthesis verdict from the crux-domain
  strongest, never a fixed aggregator; main session keeps collapse ownership).

Canonical rationale, evidence quotes, non-adoptions, and the three-repo patch map
live in the owning unit: pabcd_initiative devlog
`260707_fugu_orchestration_adoption/000_fugu_adoption.md`. Sibling patches landed
the same day in `pabcd_initiative/skills/dev-pabcd/SKILL.md` and
`cli-jaw/skills_ref/dev-pabcd/SKILL.md`.

Verification: rule IDs grep clean across the three docs (each new ID appears in
all three SKILL.md files exactly once per placement); no existing rule renamed or
removed; markdown structure intact by read-back.

Follow-ups tracked in the canonical record: jawcode port, loop-engineering.md
reference sync, cxc-loop mirror of COLLAPSE-AGGREGATOR-01.
