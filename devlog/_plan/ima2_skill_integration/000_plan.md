# ima2 Deep Integration into Frontend/Design Skills

**Unit:** ima2_skill_integration
**Class:** C3 (cross-module: 4 files across 2 skills + devlog)
**Date:** 2026-07-11

## Objective

Deeply integrate ima2-gen's parallel generation and motion/video pipeline
capabilities into `cxc-dev-frontend` and `cxc-dev-uiux-design` skills.
Current state: thin probe-and-fallback references (16 total mentions across
4 files). Target: actionable CLI recipes, variant selection logic, monitoring
patterns, video pipeline, and `$imagegen` fallback gates at every decision point.

## Constraints

- ima2 is an EXTERNAL tool, not always available — every pattern needs a
  `$imagegen` fallback or CSS-only degradation path.
- Changes scoped to reference files + SKILL.md summary lines only.
- Parallel generation and motion/video are the two priority axes.
- Keep existing file structure; no new reference files — extend existing ones.

## Work-Phase Map (dependency-ordered)

### Phase 1: asset-requirements.md — Parallel Generation + Variant Selection

Add to `references/core/asset-requirements.md`:

**Parallel Generation Patterns** (new section after "Multi-Candidate Strategy")
- `ima2 gen -n N` vs `ima2 multimode` decision table
- Independent CLI parallel (multiple `ima2 gen &` + `ima2 ps --json`)
- Monitoring loop: `ima2 ps --json` → inspect → `ima2 cancel <id>`
- Capacity guard: `TOO_MANY_JOBS` handling
- `$imagegen` fallback: single-call or sequential

**Variant Selection Workflow** (new section after Parallel Generation)
- Two-stage: exploration (5 candidates) → refinement (2-3 targeted)
- Element-ledger synthesis (extract best elements, not pick one winner)
- Selection scorecard
- `view_image` mandatory inspection
- `$imagegen` fallback

**Provider Routing** (new section)
- GPT OAuth / Grok / Gemini decision
- `$imagegen` fallback: single provider

### Phase 2: motion.md — Video Pipeline + Motion Asset Generation

Add to `references/core/motion.md`:

**ima2 Video Pipeline** (new section before "Performance Rules")
- Image-first video: GPT keyframe → i2v
- Storyboard → i2v chain
- Video continue/extend for multi-shot
- Video prompt writing rules
- Provider/model/resolution selection
- Frame extraction for scroll sequences
- `$imagegen` fallback: static keyframe + CSS animation

### Phase 3: SKILL.md updates (both skills)

**dev-frontend/SKILL.md §4:** update Assets bullet
**dev-uiux-design/SKILL.md §2.5:** strengthen UX-CONCEPT-GEN-01

## Scope Boundary

**IN:** asset-requirements.md, motion.md, dev-frontend/SKILL.md, dev-uiux-design/SKILL.md, devlog
**OUT:** no new files, no hook/component/CLI changes, no ima2-gen changes, no other skills

## Acceptance Criteria

1. `rg -c "ima2" asset-requirements.md` ≥ 30 (from 13)
2. `rg -c "ima2" motion.md` ≥ 15 (from 2)
3. Every ima2 CLI pattern has `$imagegen` fallback documented
4. Parallel gen: gen -n vs multimode, ps/cancel monitoring, capacity guard
5. Motion: image-first video, storyboard chain, continue/extend, frame extract
6. Variant selection: two-stage, element-ledger, scorecard
7. No broken cross-references
8. devlog unit complete
