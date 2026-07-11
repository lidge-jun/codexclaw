# Dropdown Design Layer - Implementation Guide

Canonical owner for the unified dropdown DESIGN LAYER: visual skin and scope.
ARIA and keyboard patterns stay in `a11y-patterns.md`; material rules stay in
`liquid-glass.md`; mobile sheet behavior stays in `mobile-ux.md`; form workflow
gates stay in `crud-ui.md`.
---
## Unified Skin (FE-DROPDOWN-LAYER-01, DEFAULT)
On projects with a custom design surface, recommend one unified custom dropdown
design layer over browser-default dropdowns: ONE visual skin across nav menus,
filter dropdowns, form `<select>`, comboboxes, search suggestions, date pickers,
and mobile pickers.
The shared skin contract:
- Near-opaque solid surface, following the bar-spawned surface rule in
  `liquid-glass.md` `FE-LIQUID-STATE-01`.
- Blur-free by default; do not inherit top-bar transparency states.
- Radius tier from the project scale, usually 12-20px for panels.
- One shadow language for elevation; avoid stacking multiple nested shadows.
- Typography aligned to the product UI scale, not decorative hero type.
- Short, calm motion: opacity/translate only, usually 120-180ms.
- Item hover, active, selected, and focus states use fill/tint, not rest-state
  capsule borders inside the panel.

Dropdown panels follow the same fills-not-borders convention as
`FE-PILL-NEST-01` (whose canonical scope is pill containers with radius
>= 24px / the 9999px chrome class): child rows and controls render no capsule
borders or outlines at rest, even though panels themselves sit in the 12-20px
radius tier. Hover, active, selected, and `aria-current` fills remain legal.
## Skin Is Not Behavior
One SKIN does not mean one ARIA pattern.
Behavior comes from a behavior-correct headless or proven primitive selected
for the pattern: menu, listbox/select, combobox, date picker, or the repository's
equivalent. Prefer Radix, React Aria, Base UI, mature design system primitives,
or the existing local primitive layer.

Hand-rolled dropdown behavior is banned for production UI. Do not invent focus
management, typeahead, roving tabindex, escape handling, or outside-click
closing from scratch.
## Design System Precedence
Design System Detection in `dev-frontend/SKILL.md` Section 12 wins.
When MUI, Carbon, Fluent, Ant Design, Chakra, Mantine, Polaris, or a comparable
system governs the project, unify by theming that system's menus, selects,
popovers, comboboxes, and pickers. Do not rebuild them just to get a custom
skin unless the project already has an approved headless replacement path.
## Scope Table
| Surface | Primitive | Skin notes |
| --- | --- | --- |
| Nav menu | Menu / navigation menu primitive | Near-opaque spawned panel; tap path required for hover menus; no glass transparency. |
| Filter dropdown | Menu, listbox, or popover with controls | Same panel shell; preserve checkbox/radio state clarity and dense scanning. |
| Form select | Select / listbox primitive | Skin trigger and panel while preserving label, error, autofill, name/value, and keyboard behavior. |
| Combobox / search | Combobox primitive | Same panel shell; suggestions, loading, empty, and selected states share item tokens. |
| Date picker | Date picker / calendar primitive | Same outer shell; calendar grid may use its own selected-day fill and focus ring. |
| Mobile picker | Sheet / drawer / native-safe picker primitive | Same skin translated to a bottom sheet; no hover dependency or nested scrolling. |
## Mobile Contract
Mobile uses the same dropdown skin as the bottom sheet surface. Hover-spawned
desktop menus need a tap alternative on touch devices. Use a sheet, drawer,
popover picker, or proven mobile picker primitive with correct focus, dismissal,
and scroll locking. Avoid nested scrolling: the sheet owns the scroll area, and
internal option lists are bounded only when the primitive handles them cleanly.
See `mobile-ux.md`.
## Form Semantics
Skinned form selects still behave like form controls. They keep visible and
programmatic labels, helper text, validation errors, disabled/read-only states,
autofill where relevant, keyboard operability, and stable submission semantics.
The visual layer must not break `crud-ui.md` gates: users can scan a form, see
required/error states, tab through fields, open a select, choose, recover from
errors, and submit without pointer-only behavior.
## CSS Tokens (STYLE_SAMPLE)
```css
:root {
  --dropdown-surface: rgb(255 255 255 / 0.96);
  --dropdown-border: rgb(17 24 39 / 0.08);
  --dropdown-radius: 16px;
  --dropdown-shadow: 0 18px 48px rgb(15 23 42 / 0.16);
  --dropdown-hover: rgb(15 23 42 / 0.06);
  --dropdown-active: rgb(15 23 42 / 0.10);
  --dropdown-focus: rgb(37 99 235 / 0.22);
  --dropdown-motion: 140ms ease;
}
.dropdown-surface {
  background: var(--dropdown-surface);
  color: rgb(17 24 39);
  border: 1px solid var(--dropdown-border);
  border-radius: var(--dropdown-radius);
  box-shadow: var(--dropdown-shadow);
  font: inherit;
}
.dropdown-item {
  border: 0;
  border-radius: 8px;
  background: transparent;
  transition: background-color var(--dropdown-motion), color var(--dropdown-motion);
}
.dropdown-item:hover,
.dropdown-item[data-highlighted] { background: var(--dropdown-hover); }
.dropdown-item[aria-selected="true"],
.dropdown-item[data-state="checked"] { background: var(--dropdown-active); }
.dropdown-item:focus-visible {
  outline: 2px solid var(--dropdown-focus);
  outline-offset: 2px;
}
```
## Verification Hooks
Check the keyboard path per primitive: tab entry/exit, arrows where expected,
typeahead or text input behavior, escape close, trigger focus return, and form
submission for selects.
Render the dropdown over the busiest background it can cover and verify normal
contrast, item state contrast, focus visibility, and shadow separation.
On mobile, verify the sheet or picker tap path, scroll locking, no nested scroll
trap, safe-area spacing, and reduced-motion behavior.
