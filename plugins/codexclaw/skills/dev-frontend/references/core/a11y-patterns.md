# Accessibility Deep Patterns

Extends the baseline a11y rules in SKILL.md with ARIA authoring patterns, focus management, and screen reader testing.

## ARIA Widget Patterns

Note: a project may unify ALL dropdown-like surfaces under one visual skin
(`dropdown-layer.md` FE-DROPDOWN-LAYER-01), but the ARIA pattern is still
chosen per BEHAVIOR — menu vs listbox/select vs combobox vs dialog. One skin
never means one blanket component.

### Dialog (Modal)

```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Title</h2>
</div>
```

- Trap focus inside (Tab cycles through focusable elements)
- ESC closes, returns focus to trigger element
- `aria-modal="true"` tells screen readers to ignore background

### Tabs

```html
<div role="tablist" aria-label="Settings">
  <button role="tab" id="tab-1" aria-selected="true" aria-controls="panel-1">General</button>
  <button role="tab" id="tab-2" aria-selected="false" aria-controls="panel-2">Advanced</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">...</div>
```

- Arrow keys between tabs, Tab into panel content
- Home/End move to first/last tab

### Disclosure (Accordion)

```html
<button aria-expanded="false" aria-controls="content-1">Section</button>
<div id="content-1" hidden>...</div>
```

### Combobox (Autocomplete)

```html
<input role="combobox" aria-expanded="false" aria-controls="listbox-1" aria-autocomplete="list">
<ul role="listbox" id="listbox-1">
  <li role="option">Option 1</li>
</ul>
```

- Arrow keys navigate, `aria-activedescendant` tracks current
- Enter selects, ESC closes

### Toast / Live Region

```html
<div role="status" aria-live="polite" aria-atomic="true"></div>
```

- `polite`: announced after current speech
- `assertive`: interrupts — errors/critical alerts only

## Focus Management

### SPA Route Changes

- Move focus to `<main>` or new page `<h1>`
- Announce route via `aria-live` region
- Never leave focus on a destroyed element

### Dynamic Content

- Content loads: do NOT move focus unless user-initiated
- Content removed: move focus to nearest logical parent
- `tabindex="-1"` for programmatic focus targets

### Focus Order

- Tab order follows visual order (never `tabindex > 0`)
- `tabindex="0"` for custom interactive elements
- Never make non-interactive elements focusable without a role

## Keyboard Navigation

| Pattern | Keys | Behavior |
|---------|------|----------|
| Menu bar | Arrow L/R menus, Arrow D opens, ESC closes | WAI-ARIA menu |
| Grid | Arrow keys cell-to-cell, Enter activates | WAI-ARIA grid |
| Tree view | Arrow U/D siblings, R expand, L collapse | WAI-ARIA tree |
| Carousel | Arrow L/R slides, Tab to controls | Must have pause |
| Command palette | Type to filter, Arrow navigate, Enter select | Combobox variant |

## Screen Reader Testing

### Quick Test (Every Component)

1. Tab through: can you reach every interactive element?
2. Keyboard only: can you complete the task?
3. Focus indicator visible on every interactive element?
4. Every image/icon has appropriate alt text?

### Full Test (Before Release)

1. macOS VoiceOver (Cmd+F5) + Safari
2. Read page linearly — content order makes sense?
3. Navigate by headings (VO+Cmd+H) — logical outline?
4. Navigate by landmarks (VO+Cmd+L) — main, nav, footer present?
5. Interact with every widget — roles and states announced?
6. Error messages announced when they appear?
7. `prefers-reduced-motion` disables non-essential animation?

### Automated (CI)

- axe-core or Lighthouse accessibility audit (score ≥ 90)
- jest-axe / vitest-axe for component testing
- Pa11y for page-level scanning

## Color & Visual

- Never use color alone to convey meaning
- 3:1 contrast for UI components and graphical objects
- Support `forced-colors` (Windows High Contrast)
- Support `prefers-contrast: more`

## Pre-flight

- [ ] Every modal traps focus and returns focus on close
- [ ] Tab order matches visual order
- [ ] Live regions for dynamic status messages
- [ ] Keyboard reaches every interactive element
- [ ] VoiceOver heading navigation produces logical outline
- [ ] Color is never the sole state indicator

---

## Heading Level Continuity (FE-HEADING-LEVELS-01, DEFAULT)

Source: impeccable detector catalog (skipped heading levels rule).

Do not skip heading levels: `h1` -> `h3` without an `h2` is a semantic error
that breaks screen reader navigation and document outline.

Rules:
- Every page has exactly one `h1`.
- Heading levels increase by one: `h1` -> `h2` -> `h3`. Never skip.
- Heading levels may decrease by any amount (closing a subsection).
- Visual size is independent of semantic level — use CSS, not heading tags, for size.
- Components that render headings should accept a `level` prop or use `aria-level`
  to maintain correct nesting in any context.

Verification: run `document.querySelectorAll('h1,h2,h3,h4,h5,h6')` and check
that levels increase by at most 1. Automated: axe-core `heading-order` rule.
