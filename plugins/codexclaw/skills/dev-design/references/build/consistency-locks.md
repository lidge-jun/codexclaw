# Consistency Locks (MANDATORY)

## Color Consistency Lock
Once accent color is chosen for a page, it is used on the WHOLE page.
- Warm-grey site does not get blue CTA in section 7
- Rose-accented site does not get teal badge in footer
- Pick one accent, lock it, audit every component

## Shape Consistency Lock
Pick ONE corner-radius scale per page:
- All-sharp (radius 0)
- All-soft (radius 12-16px)
- All-pill (full radius for interactive)
Mixed systems only with documented rule (e.g., "buttons=pill, cards=16px, inputs=8px")

## Page Theme Lock
ONE theme (light/dark/auto) for the whole page. No section inversions.
- Section-level background tints within same family OK (zinc-950 next to zinc-900)
- Flipping to amber-50 in middle of zinc-950 page = broken
- Exception: one deliberate "color block story" transition per page, if brief demands
