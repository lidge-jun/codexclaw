# Visual concept exploration procedure

Before implementing a C2+ new/redesigned expressive or brand-visible UI
surface, generate visual concept candidates BEFORE frontend code. C0/C1
patches and utility CRUD/dashboard screens are exempt.

### Concept Decision Tree

1. Is the surface C2+ and expressive or brand-visible?
   - No: skip concept generation and state why.
   - Yes: continue.

2. Probe ima2 availability: `ima2 status`, attempt `ima2 serve` if
   down, `$imagegen` only as true fallback. State the chosen
   generator.

### Compact ima2 Recipe

Canonical command:
`ima2 gen "<detailed prompt>" --quality high --size 1536x1024 -o ./concepts/01.png`

- Add a reference image with `--ref ./reference.png`.
- Every prompt specifies surface, audience, composition, palette, typography,
  material, and constraints.
- Batch one prompt with `ima2 gen -n 5 -d ./concepts/`.
- For distinct prompts, launch `ima2 gen ... &` in parallel and monitor with
  `ima2 ps --json`.
- Fall back to `$imagegen` only after `ima2 status`, `ima2 serve`, and the
  subsequent status re-check all fail.

3. Is the direction already concrete (named ism, reference screenshot,
   finished design, governing design system)?
   - Yes: lock that direction → generate 3-5 contextual execution
     variants.
   - No: use UX-IMAGE-FIRST-01 → generate 5 distinct ism directions,
     compare, lock one direction, then refine with 2-4 variants.

### Image-First Direction Discovery (UX-IMAGE-FIRST-01, DEFAULT)

Fires when the brief has no named ism, product reference, or concrete design
direction. Generate 5 maximally different ism directions, varying layout
family, palette, type stance, material, and hero grammar. Every prompt must be
detailed enough to reconstruct the layout. Compare candidates on hero
composition, palette coherence, typographic voice, and density fit. Pick the
winning ISM, not the winning image, then refine it with 2-4 variants.
Interactive mode: the user picks the ism. Autonomous mode: state the selection
reasoning in the devlog.

4. Evaluate candidates on: domain/audience fit, hero/composition,
   palette coherence, typographic voice, density and context fit.

5. SYNTHESIZE — do not pick one winner. Build an element ledger: for
   each token (palette, composition, type, material, signature visual),
   note WHICH variant did it best and WHY. Use FE-ASSET-SELECT-01
   scorecard as rubric.

| Token | Best variant | Rationale | DESIGN.md value |
|-------|-------------|-----------|-----------------|
| Palette | #3 | warmest coherence | primary: #2c2420, accent: #c4956a |
| Hero | #1 | strongest asymmetric composition | editorial offset |
| Type | #2 | best grotesk weight contrast | heading: 300, body: 400 |

Synthesis IS the direction lock: it assembles the best tokens from multiple candidates into one coherent DESIGN.md. The lock is the assembled token set, not any single render.

6. Lock DESIGN.md from the synthesis. Each token cites its source
   variant. Interactive mode: show candidates + synthesis for
   confirmation. Autonomous mode: record selection rationale and
   proceed.

Generation mechanics,
batching (FE-ASSET-PARALLEL-01),
cutout preparation,
hero constraints (FE-HERO-SPLIT-01),
and asset selection are owned by
`../../dev-frontend/references/core/asset-requirements.md`.

Precedence: UX-CONCEPT-GEN-01 governs PRE-CODE concept stage. After
code exists, `../../dev-frontend/references/core/iterative-design.md` governs POST-CODE rounds.
`../../dev-frontend/references/core/prototype-variants.md` runs AFTER the concept lock for structural
variants.

Skip (state the skip): a finished implementation-ready design skips concept
generation entirely. A reference screenshot or style direction requires
contextual execution variants rather than a skip. A governing design system
skips generation unless a new brand-visible composition remains unresolved.
C0/C1 patches and utility CRUD/dashboard surfaces also skip. Generator
unavailability is a skip only after the complete fallback sequence above.
---

