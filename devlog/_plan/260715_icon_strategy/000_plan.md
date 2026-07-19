# 260715 Icon Strategy — Plan (000)

## Loop spec

- **Archetype:** spec-satisfaction repair
- **Trigger:** User request for icon library options in dev-uiux-design/dev-frontend skills + ima2 icon pipeline handoff
- **Goal:** Integrate icon library selection into Design Read workflow; create ima2 icon generation handoff spec
- **Non-goals:** Implement ima2 icon code; change existing codexclaw icon imports; modify skills beyond dev-uiux-design and dev-frontend
- **Verifier:** YAML frontmatter parse + devlog file existence + handoff doc completeness
- **Stop condition:** All 7 criteria met (unit-level; per-WP exit gates below)
- **Memory artifact:** This devlog unit + goalplan
- **Expected terminal outcomes:** DONE (all deliverables exist and pass verification)
- **Escalation:** NEEDS_HUMAN if skill patch scope conflicts with uncommitted changes

## Work phases (dependency-ordered)

### WP1: Research archive + devlog unit + diff-level plan (this doc)

Foundation phase. Archive the parallel explorer research from the preceding conversation
turn (3 sol explorers: established libraries, emerging/premium sets, community sentiment).
Write diff-level plans for WP2 and WP3.

- 000_plan.md — this file
- 001_research_archive.md — structured icon library comparison (10+ libraries)
- 010_phase1_skill_patches.md — diff-level plan for dev-uiux-design + dev-frontend patches
- 020_phase2_ima2_handoff.md — diff-level plan for ima2 icon pipeline spec

### WP2: Skill patches — dev-uiux-design + dev-frontend

Implementation phase. Patch both skills with icon strategy sections.

**dev-uiux-design changes:**
- §2 Design Read: add `iconography:` field to DESIGN.md output format
- New section after §2.6: Icon Strategy (UX-ICON-01) — library selection by domain/density,
  decision routing (AI default vs user choice), custom icon trigger conditions
- Icon guidance is inlined into §2.7 and §4; no separate reference file or table entry added

**dev-frontend changes:**
- §4 Implementation: add icon implementation routing subsection — library install guidance,
  custom icon generation workflow (ima2 icon pipeline), SVG tracing/optimization notes
- §5 Anti-Slop: update Lucide-as-default-tell signal (already partially exists as
  "Lucide/Phosphor/Heroicons" mention), add icon library monoculture detection
- Icon guidance is inlined into §4/§5; no separate reference file or table entry added

### WP3: ima2 handoff doc — icon pipeline spec

Handoff phase. Write implementation-ready spec in ima2-gen devlog.

- ima2-gen/devlog/_plan/260715_icon_pipeline/ — new devlog unit
- 000_plan.md — overview
- 010_cli_design.md — `ima2 icon` subcommand tree, flags, interactive flow
- 020_dependencies.md — vtracer, svgo, svgr integration spec
- Back-reference in codexclaw skills to ima2 icon capability

## File change map

| File | Action | WP |
|------|--------|----|
| `devlog/_plan/260715_icon_strategy/000_plan.md` | CREATE | WP1 |
| `devlog/_plan/260715_icon_strategy/001_research_archive.md` | CREATE | WP1 |
| `devlog/_plan/260715_icon_strategy/010_phase1_skill_patches.md` | CREATE | WP1 |
| `devlog/_plan/260715_icon_strategy/020_phase2_ima2_handoff.md` | CREATE | WP1 |
| `plugins/codexclaw/skills/dev-uiux-design/SKILL.md` | PATCH | WP2 |
| `plugins/codexclaw/skills/dev-frontend/SKILL.md` | PATCH | WP2 |
| ima2: `devlog/_plan/260715_icon_pipeline/000_plan.md` | CREATE | WP3 |
| ima2: `devlog/_plan/260715_icon_pipeline/010_cli_design.md` | CREATE | WP3 |
| ima2: `devlog/_plan/260715_icon_pipeline/020_dependencies.md` | CREATE | WP3 |

## Scope boundary

**IN:**
- Icon library comparison/recommendation system in skills
- DESIGN.md iconography field
- ima2 icon CLI design spec (document only)
- Anti-slop icon rules refinement

**OUT:**
- ima2 source code changes
- Any existing codexclaw source code icon imports
- Skills beyond dev-uiux-design and dev-frontend
- Icon asset generation (that's runtime, not skill text)

## Per-WP exit gates

**WP1 exit:** 000-020 range files exist in devlog unit; 001 has official URLs per library row; 010/020 name concrete insertion points or file anchors.

**WP2 exit:** `rg 'UX-ICON-01|FE-ICON-01' plugins/codexclaw/skills/dev-uiux-design/SKILL.md plugins/codexclaw/skills/dev-frontend/SKILL.md` returns matches; YAML frontmatter parses; no phantom reference-table links added.

**WP3 exit:** ima2 devlog unit exists with 000/010/020 docs; 010 references `bin/commands/icon.ts` and `bin/lib/client.ts`; codexclaw skills mention `ima2 icon`.

## Accept criteria (mapped to goalplan)

| ID | Criterion | Verification |
|----|-----------|--------------|
| c1 | Devlog unit exists with numbered docs | `ls devlog/_plan/260715_icon_strategy/` |
| c2 | Research archive has 10+ libraries with sources | `grep -c '|.*http' 001_research_archive.md` >= 10 (official URL per library row) |
| c3 | dev-uiux-design has iconography section | grep for UX-ICON in SKILL.md |
| c4 | dev-frontend has icon routing | grep for icon routing in SKILL.md |
| c5 | Skill YAML frontmatter valid | Parse check |
| c6 | ima2 handoff doc is implementor-ready | Doc contains: CLI subcommand tree, vtracer/svgo dep spec, bin/commands/icon.ts anchor, interactive flow, and server interaction boundary |
| c7 | Skills reference ima2 icon capability | grep for ima2 icon in skills |
