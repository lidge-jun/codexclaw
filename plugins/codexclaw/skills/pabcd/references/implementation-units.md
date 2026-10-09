### Implementation-Unit Documents

Full documentation routine (P concretizes the docs, A audits them as a hard gate, D
archives to `_fin/`, plus the mainstream design-doc/RFC translation table):
[Implementation log](../../dev-scaffolding/references/implementation-log.md).

**DIFFLEVEL-ROADMAP-01 (STRICT).** For any multi-phase unit
(2+ work-phases), the FIRST P — or the dedicated design-only Phase-0 pass — must
deliver the entire roadmap concretized: `000_plan.md` (objective, constraints,
dependency-ordered work-phase map) PLUS every phase's decade doc written to full
diff-level precision (exact paths, NEW/MODIFY/DELETE, before/after diffs) — each one
a copy-paste-executable PRD, not an outline. Scaffolding empty decade files to "fill
per cycle" does NOT satisfy this rule. Each later cycle's P starts from its
pre-written doc: re-verify it against the current codebase (stale check — earlier
phases may have moved lines, signatures, or files), amend the doc, then execute.
For prior D direction, follow [loop continuity](../../loop/SKILL.md)
(LOOP-CONTINUITY-01).

**LEXICO-SPLIT-01 (DEFAULT).** Use numeric lexicographic prefixes for unit documents;
keep research/spec material in the 000-range and implementation designs in decade
ranges. Keep them separate: no implementation diffs inside research documents or
survey padding inside a phase plan. Audit this separation. Naming deviations follow
[dev rule classes](../../dev/SKILL.md), rather than a universal safety failure;
the runtime P→A gate still requires an existing directory with a numbered plan file.

**UNIT-RESIDENCE-01 (DEFAULT).** C2+ development belongs to an
implementation unit (devlog/_plan/YYMMDD_slug/). Ceremony scales with class.
C0/C1 record behavior is canonically defined by [cxc-dev §0.1](../../dev/SKILL.md):
C0 is exempt from numbered unit records; C1 records in the owning unit only when
one already exists. Do not create a unit solely for a C0/C1 fast-path record.
This exception does not waive verification, safety, or behavior-based promotion.
When residence is required and no unit exists, use the existing repository's
unit convention; interview resolves placement when interview is in scope.

Devlog plan artifacts use decade-range numbering to separate concerns:

| Range | Purpose | Examples |
|-------|---------|----------|
| 000-009 | Research, specs, MOC | `000_plan.md`, `001_api_survey.md`, `002_competitor_analysis.md` |
| 010-019 | Phase 1 | `010_phase1_auth_module.md`, `011_phase1_db_schema.md` |
| 020-029 | Phase 2 | `020_phase2_frontend.md` |
| 030-039 | Phase 3 | ... |

Rules:
- 000-range durable research is mandatory for C4, and for C3 when cross-turn,
  contract, architecture, or repository-convention needs require it. It is optional
  for C0-C2 and low-persistence C3. C2+ still follows UNIT-RESIDENCE-01;
  C0/C1 follows cxc-dev §0.1 without a forced new unit.
- Default: sequential within decade (`000`, `001`, `002`...).
- Overflow (>10 docs in a range): use sub-index (`000_0_name.md`, `000_1_name.md`).
- This repo uses three-digit prefixes (`000_`, `010_`, `020_`); keep the convention
  rather than mixing two-digit names.

## Loop routes

Before multi-cycle entry, read [docs-first timing](../../loop/SKILL.md)
(LOOP-DOCS-FIRST-01); roadmap content is defined above.
Before adding an in-scope unit mid-loop, follow [plan amendments](plan-output.md)
and the [goalplan schema](../../loop/references/durable-goalplan.md)
(LOOP-UNIT-CHAIN-01). Do not extend the agreed objective.
For divergence and collapse, read [divergence tiers](../../loop/references/divergence-tiers.md).
Faithful execution and PLAN-TRACK-01 remain in
[Work-phase loop](../SKILL.md#work-phase-loop-multi-pass-tasks).
