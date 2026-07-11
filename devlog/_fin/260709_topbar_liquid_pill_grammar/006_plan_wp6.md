# WP6 Plan — Demo Page + Corpus Consistency Audit (Acceptance)

Phase: P (session `019f4754-031e-7fc0-b53e-cf146a123cee`)
Purpose: prove the encoded grammar (goal DONE conditions 2-4).

## Loop-spec (HOTL bounds)

- Write scope: `devlog/_plan/260709_topbar_liquid_pill_grammar/demo/`
  (single-file HTML demo + screenshots + concept assets), goalplan/devlog
  updates. NO further skill-file edits except fixes surfaced by the final
  audit (each such fix cites its audit finding).
- Tools: apply_patch, in-app browser via node_repl (screenshots), ima2
  (already serving, session 70333), 1 gpt-5.5 audit explorer + main.
- Budget: 1 audit lane + browser verification; ~50min soft.

## Steps

### S1. Concept pass (dogfooding UX-CONCEPT-GEN-01, component context-strip)

- DONE-in-progress: `ima2 status` failed -> `ima2 serve` started (persistent
  session 70333) -> 3 context-strip renders (bar+hero top viewport) submitted
  with long explicit prompts (concept_a/b/c.png under assets/concept/).
- Read all 3 with view_image; element ledger (compressed, component tokens:
  material, radius, fills, type) recorded in the devlog; synthesis feeds the
  demo build. Skip NOT taken — mandate fired (C2+ expressive chrome).

### S2. Demo build (main, single HTML file demo/index.html)

Exercises every new rule:
- Liquid pill top bar: `pill-at-top` (76%) -> `pill-scrolled` (90% + blur)
  via IntersectionObserver sentinel; transition bg-color/opacity only
  (FE-TOPBAR-STATE-01, FE-LIQUID-STATE-01).
- Hover dropdown from nav: unconditionally near-opaque blur-free solid
  (FE-TOPBAR-HOVER-01), dropdown-layer skin, borderless children rows with
  hover fills (FE-PILL-NEST-01: no capsule borders at rest; one filled CTA).
- Hero: FE-HERO-LIGHT-CENTER-01 — centered, weight 300, over full-width real
  photographic backdrop (generated asset from concept pass or CSS-referenced
  local image; no gradient wash).
- Scroll motions (FE-MOTION-BUCKET-01 landing floor): exactly 2-3 distinct
  choreographed moments — (1) signature: scroll-driven hero media scale/fade
  via animation-timeline with @supports guard, (2) supporting: view() reveal
  on a content band; prefers-reduced-motion zeroes both.
- A11y: keyboard path through bar + dropdown, focus-visible, skip link,
  reduced-transparency fallback via @supports/@media.
- Dropdown layer full surface (audit R1 blocker 1): a content-band form with a
  skinned form `<select>`/listbox (same panel skin, labels + keyboard
  preserved) and, at <= 640px, the same picker rendered as a same-skin bottom
  sheet (no nested scroll).

### S3. Browser render verification (main, node_repl in-app browser)

Serve the demo over a tiny local HTTP server (python3 -m http.server) —
file:// only as fallback if the port is blocked (audit R1 finding 3).
Screenshots: at-top state, scrolled state, dropdown open over busy background,
form-select panel open, mobile 390px with bottom-sheet picker. Motion proof
(audit R1 blocker 2): scripted scroll-state observations — computed
opacity/transform of the two motion targets before vs after scroll, under
normal AND emulated prefers-reduced-motion (CDP Emulation.setEmulatedMedia or
media override), captured as text evidence alongside screenshots. Each
screenshot read back with view_image; observations recorded in devlog.

## Audit synthesis (round 1)

Reviewer FAIL: demo lacked form-select + mobile sheet surfaces (ACCEPTED — S2
extended), motion verification was screenshot-only (ACCEPTED — S3 now requires
computed-style before/after checks under both motion preferences), file://
risk (ACCEPTED — local HTTP server primary).

### S4. Final consistency audit (fresh gpt-5.5 explorer, NOT Cicero)

Fresh reviewer (final C-gate needs an uncontaminated auditor) sweeps the 10
decisions vs the edited corpus: rg rule IDs, cross-file contradiction scan
(the 68 catalogued items + new edits). Target: 0 HIGH. Findings fixed by main
(each fix cites finding) or recorded as accepted-LOW.

### S5. Close-out

- `cxc loop validate` pass (c12), goalplan evidence completed, devlog
  close-out note, D attest with real command outputs.

## Acceptance (criteria c11-c12)

- c11: screenshots prove the five demo behaviors (at-top/scrolled pill,
  near-opaque hover dropdown, border-free pill children, >= 2 scroll motions,
  light centered hero).
- c12: fresh-audit 0 HIGH + `cxc loop validate` OK.
