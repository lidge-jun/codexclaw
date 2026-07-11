# WP4 Plan — Custom Dropdown Design Layer (D8)

Phase: P (session `019f4754-031e-7fc0-b53e-cf146a123cee`)
Decision source: `000_interview.md` D8, G5-G10 triage, round-3/4 answers
(추가 지시: 커스텀 드롭다운 권장, 하나의 디자인 레이어로 통일; 폼 select 포함 전부).

## Loop-spec (HOTL bounds)

- Write scope: NEW `dev-frontend/references/core/dropdown-layer.md` (canonical),
  `dev-frontend/SKILL.md` (table row), amendments in `crud-ui.md`,
  `dev-uiux-design/references/form-patterns.md`, `a11y-patterns.md`,
  `mobile-ux.md`, `stacks/react.md` (cross-ref lines + scoped wording only).
- Tools: apply_patch, rg, 1 gpt-5.5 worker + reviewer. ~30min soft.

## Edits

### E1. NEW dropdown-layer.md (worker A)

- Rule FE-DROPDOWN-LAYER-01 (DEFAULT): on a project with custom design surface,
  RECOMMEND one unified custom dropdown design layer over browser-default
  dropdowns — ONE visual skin (surface near-opaque solid, radius tier, shadow,
  typography, motion) applied across ALL dropdown-like surfaces: nav menus,
  filter dropdowns, form `<select>`, comboboxes, date pickers (user round-4:
  form select 포함 전부).
- One SKIN != one ARIA pattern (G6): behavior comes from behavior-correct
  headless/proven primitives per pattern (menu, listbox/select, combobox,
  datepicker) — Radix, React Aria, Base UI, or the repo's equivalent; NEVER
  hand-rolled behavior (G9).
- Precedence (G5): Design System Detection wins — when MUI/Carbon/etc. governs,
  unify by THEMING that system's dropdowns, not rebuilding.
- Scope table (G10): surface -> primitive -> skin notes for nav menu / filter /
  form select / mobile picker.
- Mobile (G7): same skin as bottom sheet; tap alternative for hover-spawned
  menus; no nested scrolling; cross-ref mobile-ux.md.
- Material: dropdown surfaces are unconditionally near-opaque blur-free solid
  (cross-ref liquid-glass.md FE-LIQUID-STATE-01 spawned-surface rule +
  top-bar.md FE-TOPBAR-HOVER-01).
- A11y: keyboard path per pattern (cross-ref a11y-patterns.md); form semantics
  preserved (labels, errors, autofill) when skinning form selects.

### E2. Amendments (main)

- dev-frontend/SKILL.md: reference table row.
- crud-ui.md § Forms: form `<select>` controls participate in the project
  dropdown layer (FE-DROPDOWN-LAYER-01) while keeping form semantics + keyboard
  gates (G8 resolution: user overrode native-first for visuals, behavior stays).
- form-patterns.md § Search/Filter: filter dropdowns use the unified layer.
- a11y-patterns.md: note — one visual skin across dropdown-likes is fine; ARIA
  pattern still chosen per behavior (menu vs listbox vs combobox), add
  select/listbox row pointer.
- mobile-ux.md § Bottom Sheet: mobile form selects/pickers = same-skin bottom
  sheet, no nested scroll, preserved semantics.
- stacks/react.md § Behavior-First Components: one-line pointer — the project
  dropdown design layer (FE-DROPDOWN-LAYER-01) supplies the SKIN over these
  primitives; skin never replaces the primitive (audit R1 finding 1).

## Audit synthesis (round 1)

Reviewer FAIL: react.md behavior-first guidance was an unamended propagation
point (ACCEPTED — added to E2 + write scope), and c8's file count was
inconsistent (ACCEPTED — c8 now names the exact 7-file list).

## Dispatch plan

- Worker A: dropdown-layer.md only. Main: E2 amendments + read-back.
- Reviewer: same-reviewer plan audit now.

## WP4 acceptance (criterion c8)

- c8: dropdown-layer.md exists (rule + scope table + DS precedence + primitives
  requirement); rg FE-DROPDOWN-LAYER-01 present in exactly these 7 files:
  dropdown-layer.md, dev-frontend/SKILL.md, crud-ui.md, form-patterns.md,
  a11y-patterns.md, mobile-ux.md, stacks/react.md.
