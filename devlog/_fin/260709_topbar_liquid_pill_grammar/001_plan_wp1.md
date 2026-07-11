# WP1 Plan — Material & Top-Bar Grammar (D1, D2, D3)

Phase: P (session `019f4754-031e-7fc0-b53e-cf146a123cee`, goalplan
`encode-all-10-interview-locked-design-decisions`)
Decision source: `000_interview.md` (D1/D2/D3 + S-series triage + rounds 2-4 answers)

## Loop-spec (HOTL bounds)

- Write scope: `plugins/codexclaw/skills/dev-frontend/references/core/top-bar.md`
  (NEW), `liquid-glass.md`, `aesthetics.md`, `dev-frontend/SKILL.md` (table rows),
  `dev-uiux-design/SKILL.md` (pill-chrome cross-ref) + `references/design-isms.md`
  (§1.12 state-model wording update + pill-chrome cross-ref). Nothing else.
- Tools: apply_patch, rg, gpt-5.5 subagents (workers/reviewers), no network needed.
- Budget: ~1 dispatch wave (2 workers + 1 reviewer), wall-clock ~40min soft.

## Edits

### E1. NEW `top-bar.md` (worker A)

Canonical top-bar COMPOSITION owner (material recipes stay in liquid-glass.md —
S9 ownership split; design judgment pointer to dev-uiux-design):

- **Domain gate (STRICT)**: liquid pill top bar is an expressive-surface pattern;
  dashboards/admin/finance/gov/B2B repeated-work tools keep standard solid headers
  (mirrors UX-DEFAULT-ISM-01 gate — S12).
- **Geometry**: floating pill bar (detached, radius 9999px/>=24px, max-width capped,
  top inset) vs full-width bar — decision table by surface; safe-area insets.
- **Slots**: logo (real SVG, brand-asset-sourcing pointer), 2-5 nav links, one
  filled pill CTA allowed, optional theme/lang controls; mobile: logo + menu
  trigger, sheet/drawer collapse rule.
- **Scroll-state contract (FE-TOPBAR-STATE-01, DEFAULT)**: at-top state may be
  lighter (~70-80% opacity) ONLY when the hero is authored with a calm bar zone
  (S1/S2 resolution); scrolled state 85-95% + blur; transition animates
  background-color/opacity ONLY (no size morph on blurred bars — S10); a11y
  supremacy clause (FE-LIQUID-A11Y-01 pointer).
- **Hover-surface contract (FE-TOPBAR-HOVER-01, DEFAULT)**: any surface spawned
  from the bar (dropdown/mega-menu/popover) renders unconditionally near-opaque,
  blur-free solid (round-2 answer + S6/S7); same dropdown design layer as D8
  (cross-ref stub only, D8 lands in WP4); mobile tap alternative required.
- **Child-visual rule pointer**: FE-PILL-NEST-01 (canonical in liquid-glass.md).
- **A11y**: keyboard path through bar + spawned surfaces, focus never hidden under
  sticky chrome, aria-current styling via fill/tint (borders banned at rest).
- **Verification hooks**: what a reviewer screenshots (both scroll states, hover
  surface over busy background, reduced-transparency collapse).

### E2. `liquid-glass.md` rewrite (worker B)

- Replace the two-variant framing with a **named material-state table**:
  `pill-at-top` (~70-80%, authored calm zone required), `pill-scrolled` (85-95% +
  blur 12-16px), `media-overlay` (the old 55% regular recipe, demoted to
  media/photo-overlay use), `clear` (unchanged, gated).
- **FE-PILL-NEST-01 (DEFAULT)**: inside a pill container (radius >= 24px or the
  9999px chrome class), child elements render NO capsule border/outline at rest
  (the `( () () () )` double-ring ban). Solid fills are NOT restricted by this
  rule (round-4 answer) — hierarchy rules (one primary action, accent budget)
  still govern how many strong fills make sense. Container's own single hairline
  border stays legal. Shadow-only children legal (S8). Hover/active/aria-current
  fills and tints legal at rest.
- Popover row rescope: bar-spawned menus = near-opaque blur-free solid (S6),
  resolves one-glass-layer stacking (S7) and keeps <=2 blurred surfaces budget.
- A11y gate text scoped to translucent states + declared supreme over all state
  definitions (S3/S11): reduced-transparency/contrast collapse everything solid.
- No-size-morph rule for blurred bars (S10) stated next to the perf gate.
- CSS recipes updated to match the state table (STYLE_SAMPLE).

### E3. `aesthetics.md` carve-out (main session)

- § Expressive vs Functional Layers: add the scroll-adaptive-nav exception —
  a top bar following FE-TOPBAR-STATE-01 may run the lighter at-top state over an
  authored calm bar zone; everything else in the rule unchanged (S1).
- Fill-vs-border wording aligned with FE-PILL-NEST-01.

### E4. Table rows + cross-refs (main session)

- dev-frontend/SKILL.md Modular References: add `top-bar.md` row.
- dev-frontend/SKILL.md: UPDATE the existing `liquid-glass.md` row wording
  ("regular/clear recipes" -> named material states) so the table matches the
  E2 rewrite (audit R1 blocker 1).
- dev-uiux-design/SKILL.md UX-DEFAULT-ISM-01 + design-isms.md §1.12/§1.13
  pill-chrome/chip-cluster lines: add "children carry no capsule borders at rest
  inside pill chrome (FE-PILL-NEST-01)" cross-ref (S4).
- design-isms.md §1.12 Liquid Glass: UPDATE the two-variant/`canvas 55%`
  signature text to reference the named state model (pill-at-top /
  pill-scrolled / media-overlay / clear) with liquid-glass.md as canonical
  owner (audit R1 blocker 2).

## Audit synthesis (round 1)

Reviewer verdict FAIL with two blockers, both ACCEPTED (missing edit targets
that would leave stale contradicting text): folded into E4 above. Finding 4
(c3 too narrow) ACCEPTED: c3 read-back now covers aesthetics.md +
dev-frontend/SKILL.md table rows + design-isms.md §1.12 for stale
"regular/clear"/55% references.

## Dispatch plan (B phase)

- Worker A (gpt-5.5): writes top-bar.md from this spec + ledger. Owns that file only.
- Worker B (gpt-5.5): rewrites liquid-glass.md. Owns that file only.
- Main: E3 + E4, then integration read-back of both worker files against the ledger.
- Reviewer (gpt-5.5, A phase now / C phase later): plan audit now; post-build
  consistency check later.

## WP1 acceptance (criteria c1-c3)

- c1: top-bar.md exists, owns composition/scroll contract, SKILL.md row present.
- c2: liquid-glass.md encodes state table + FE-PILL-NEST-01 + hover-surface rule.
- c3: aesthetics.md carve-out present; no stale "regular/clear"/55% wording
  contradicts the state table anywhere in aesthetics.md, dev-frontend/SKILL.md,
  or design-isms.md §1.12 (rg check for `canvas 55%` / "regular/clear").
