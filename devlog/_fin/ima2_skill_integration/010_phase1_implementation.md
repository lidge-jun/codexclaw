# Phase 1 Implementation Record

**Date:** 2026-07-11
**Class:** C3
**Terminal outcome:** DONE

## Changes

### 1. asset-requirements.md (13 → 29 ima2 refs)

Added 3 new sections after existing "Multi-Candidate Strategy":

- **FE-ASSET-PARALLEL-01** — Parallel Generation Patterns
  - Decision table: `gen -n N` vs `multimode` vs independent CLI parallel
  - Independent CLI parallel recipe with `&` + `ima2 ps --json` + `ima2 cancel`
  - Monitoring and cancellation workflow
  - Capacity guard (TOO_MANY_JOBS, Retry-After: 5) handling
  - `$imagegen` fallback: sequential single-image generation

- **FE-ASSET-SELECT-01** — Variant Selection Workflow
  - Two-stage process: exploration (3-5 broad) → synthesis (element ledger)
  - Selection scorecard: 6 axes (subject fidelity, composition, palette, text render, asset-type fit, technical quality)
  - Explicit "do NOT pick one winner" — extract best elements across candidates
  - Cross-reference to dev-uiux-design UX-CONCEPT-GEN-01 step 3
  - `$imagegen` fallback: 1-2 sequential, prompt refinement between rounds

- **FE-ASSET-PROVIDER-01** — Provider Routing
  - Decision table: GPT OAuth / Grok / Gemini by asset type
  - `$imagegen` fallback: single provider, no routing needed

### 2. motion.md (2 → 20 ima2 refs)

Added new section **FE-MOTION-VIDEO-01** — ima2 Video Pipeline for Motion Assets:

- Image-first video recipe (GPT keyframe → i2v, highest quality)
- Storyboard-to-video chain (9-panel → animate → frame extract → loop)
- Video continue and extend workflows
- Video prompt writing rules (7-element table)
- Model/resolution selection by motion surface (5-row table)
- Frame extraction for scroll sequences (ffmpeg pipeline)
- Parallel video generation pattern
- `$imagegen` fallback: 3-level degradation (keyframe+CSS > multi-still > CSS-only)

### 3. dev-frontend/SKILL.md

Updated §4 Assets bullet to reference all 4 new rule IDs:
FE-ASSET-PARALLEL-01, FE-ASSET-PROVIDER-01, FE-ASSET-SELECT-01, FE-MOTION-VIDEO-01.
Added `ima2 ps --json` / `ima2 cancel` monitoring pattern.
Added `$imagegen` fallback summary.

### 4. dev-uiux-design/SKILL.md

Updated §2.5 UX-CONCEPT-GEN-01:
- Step 2: Added parallel strategy selection block with gen -n vs multimode vs independent parallel decision
- Step 2: Added `$imagegen` fallback for sequential generation
- Step 3: Added FE-ASSET-SELECT-01 scorecard cross-reference for structured rubric

## Evidence

- `rg -c "ima2" asset-requirements.md` = 29 (from 13, +16)
- `rg -c "ima2" motion.md` = 20 (from 2, +18)
- `$imagegen` fallback: 17 occurrences across 4 files
- Cross-reference rule IDs: 7 occurrences across 4 files
- No broken references (all FE-* IDs defined and referenced)

## Phase 1.5 Amendment — UX-IMAGE-FIRST-01

**Date:** 2026-07-11

Added step 0.5 to UX-CONCEPT-GEN-01 in `dev-uiux-design/SKILL.md`:

**UX-IMAGE-FIRST-01 (DEFAULT)** — Image-first ism discovery when direction is unclear.

Workflow:
1. User gives vague brief ("make me a website for X")
2. Agent reads code/context, senses domain
3. If ism is unclear: Round 1 — 5 parallel images, each a DIFFERENT ism direction
   (editorial serif, geometric grotesk, product-led mockup, dark premium, warm capsule)
4. Inspect all 5, pick the WINNING ISM (not the winning image)
5. Round 2 — 3-4 refined images locked to the chosen ism, varying execution details
6. Synthesize Round 2 into element ledger -> lock DESIGN.md

Key design decisions:
- Every prompt must be maximally detailed (specific hex palette, font direction, composition)
- Round 1 varies ISM-level dimensions (layout family, palette temp, typography stance, material, hero grammar)
- Round 2 varies EXECUTION-level dimensions (accent color, hero subject, section layout, CTA treatment)
- Uses `--ref` from Round 1 best image to anchor Round 2 style
- Auto loop (HOTL): agent picks ism autonomously with stated reasoning in devlog
- Skip conditions: user named specific ism, provided reference, or UX-INTENT-01 resolved

`$imagegen` fallback: 2-3 sequential ism candidates + 2 sequential refinement candidates.

Evidence: grep -c confirms 26 ima2 refs in dev-uiux-design/SKILL.md (from 17, +9).

## Phase 2 — ima2-gen Skills (ima2-front + ima2-uiux)

**Date:** 2026-07-11

Created two new skills in ima2-gen's `skills/` directory, packaged via `npm install -g ima2-gen`:

### skills/ima2-uiux/SKILL.md (205 lines)

Design direction discovery through image generation:
- UX-IMAGE-FIRST workflow: Round 1 (5 ism candidates) → scorecard → Round 2 (3-4 refinements) → element ledger → DESIGN.md
- Ism-level dimensions table: layout family, palette temp, typography stance, material, hero grammar
- Execution-level dimensions table for Round 2 refinement
- Evaluation scorecard (hero composition, palette coherence, typographic voice, density fit, distinctiveness)
- Full bash examples with maximally detailed prompts
- Auto loop (HOTL) behavior documented
- Motion variant extension (keyframe → video)
- Cross-references to skills/ima2 and skills/ima2-front

### skills/ima2-front/SKILL.md (210 lines)

Frontend asset production pipeline:
- Asset decision table: 9 surface types → ima2 command mapping
- Parallel generation: batch vs multimode vs independent, with monitoring
- Provider routing by asset type (5-row table)
- Variant selection workflow (3-step)
- Video pipeline: image-first, storyboard chain, multi-shot, frame extraction
- Video prompt rules (6-element table)
- Model selection by motion surface (5-row table)
- Frontend asset recipes: hero, OG card, Korean hero, texture
- Cross-references to skills/ima2 and skills/ima2-uiux

### Architecture

```
skills/ima2/SKILL.md        (1106 lines) — core CLI, prompting, providers
skills/ima2-uiux/SKILL.md   (205 lines)  — BEFORE code: design discovery via images
skills/ima2-front/SKILL.md  (210 lines)  — DURING build: asset production pipeline
```

Relationship: ima2 (core) → ima2-uiux (direction) → ima2-front (assets) → code

Evidence: grep -c "ima2" shows 21 refs in uiux, 43 in front. Cross-references verified.
