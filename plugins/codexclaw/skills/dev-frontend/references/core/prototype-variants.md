# Prototype Variants — Runnable UI Choice Protocol

Use this when the user wants to compare designs, when visual direction is uncertain,
or when `iterative-design.md` calls for multiple variants.

## Boundary

- `iterative-design.md` owns creative divergence: what directions to try and how to
  kill/mutate them.
- This file owns the runnable mechanism: where variants live, how the user switches
  between them, how screenshots are verified, and how temporary code is removed.

## Required Shape

Sequence: runnable structural variants come AFTER the pre-code concept lock
(`dev-uiux-design` UX-CONCEPT-GEN-01 mockup synthesis) and only when structural
uncertainty genuinely survives that lock.

1. Build at least 3 structurally different variants. A color swap, copy tweak, icon
   swap, or same card grid with different spacing is not a variant.
2. Prefer the existing target page/context so data, routing, constraints, and layout
   pressure are real.
3. Use a throwaway route only when no host page exists or the host page would create
   unrelated risk.
4. Expose variants with a stable `?variant=` URL parameter, plus an on-screen switcher
   or keyboard shortcut when useful for review.
5. Keep variant state deterministic. Reloading the same URL must show the same option.

## Variant Quality Gate

Each variant should differ in at least two structural dimensions:

- navigation or information architecture
- layout rhythm and density
- primary interaction model
- visual hierarchy
- content grouping
- motion or transition model

Do not count these as structural differences: theme color only, font only, card radius
only, copy tone only, or swapping illustration assets while keeping the same layout.

## Verification

- Capture screenshots for every variant at the relevant desktop and mobile viewport.
- Check text fit, overlap, scroll containment, and empty/error/loading states when
  those states are in scope.
- If a variant is interactive, click through the primary path once before presenting it.

## Cleanup

After the user selects a winner, fold the winning direction into production code and
remove the loser variants, switcher, temporary route, and prototype-only fixtures unless
the user explicitly asks to keep a gallery.
