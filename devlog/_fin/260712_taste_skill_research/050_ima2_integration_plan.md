---
created: 2026-07-12
tags: [codexclaw, ima2, improvement-plan]
---

# ima2 Integration Improvement Plan

## Accepted (P0)

### I1: Image Set Continuity Contract

Add to `asset-requirements.md` FE-IMAGE-SET-CONTINUITY-01:
- Multi-frame sets share a visual world (palette, type, CTA family, radius, treatment)
- Per-section default frame counts: landing 6, full website 8, portfolio 6
- Composition anchors rotate across frames (no same-layout repetition)
- Each frame must be independently useful as a section reference
- ima2 multimode or parallel gen with `--ref` to first frame as style anchor

### I2: Composition-Anchor Rotation in UX-CONCEPT-GEN-01

Update dev-uiux-design §2.5 step 1:
- Explicitly name what must vary across 5 renders: hero position, stat/proof placement,
  CTA treatment, accent application, section hint, and density
- Add a composition-anchor ledger to the element-synthesis step (step 3)
- Each anchor gets a "best variant" citation

## Deferred (P2) — needs ima2 feature work

### I3: Reference-to-DESIGN.md via ima2 vision

Screenshot → ima2 → draft structured token manifest (colors, spacing, type, layout,
components) with confidence labels. Needs ima2 to support schema-constrained
vision output. For now, manual Design Read from `view_image` is the path.

### I4: Browser+Vision Fusion

brandmd-style Playwright DOM extraction + ima2 vision classification. Would automate
the manual bridge between Design System Detection and Design Read. Needs both a
browser extraction script and ima2 fusion mode.

### I5: Reference-vs-Implementation Visual Diff

Post-implementation: capture runtime screenshots, compare structurally against
reference concept renders. Report palette/density/hierarchy divergences. Needs
ima2 structural comparison capability.

## Relationship to existing ima2 workflow

codexclaw already has the strongest ima2 integration of any skill system examined:
- Availability probing (ima2 status → ima2 serve → recheck)
- Multi-candidate generation (ima2 gen -n N, multimode, parallel CLI)
- Reference anchoring (--ref)
- Provider routing (GPT/Grok/Gemini)
- Selection with element-ledger synthesis (FE-ASSET-SELECT-01)
- Cutout pipeline (FE-ASSET-BG-01)
- Video generation (FE-MOTION-VIDEO-01)
- Session style sheets

taste-skill has NO ima2 integration. impeccable has no image generation.
brandmd extracts tokens but doesn't generate. The improvements above build
on codexclaw's existing advantage rather than copying a weaker system.
