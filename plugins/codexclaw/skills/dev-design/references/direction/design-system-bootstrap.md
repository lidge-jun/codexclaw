## 1. Design System Bootstrap

When starting a new project or establishing a design system, use this token architecture template.

### Token Template
```css
:root {
  /* Spacing (4px base) */
  --space-0: 0; --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;

  /* Radius */
  --radius-none: 0; --radius-sm: 4px; --radius-md: 8px;
  --radius-lg: 12px; --radius-xl: 16px; --radius-full: 9999px;

  /* Elevation */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 2px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);

  /* Timing — canonical values in Motion Tokens below */
  --duration-fast: 150ms; --duration-normal: 250ms; --duration-slow: 400ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Typography */
  --font-sans: 'Geist', system-ui, -apple-system, sans-serif;  /* Never default to Inter — see SKILL.md font rules */
  --font-mono: 'Geist Mono', 'SF Mono', monospace;
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-base: 1rem;
  --text-lg: 1.125rem; --text-xl: 1.25rem; --text-2xl: 1.5rem; --text-3xl: 2rem;
}
```

### Component Hierarchy
- **Atoms:** Button, Input, Badge, Avatar, Icon, Toggle, Checkbox, Radio
- **Molecules:** Form Field (label + input + error), Card, Menu Item, Search Bar, Stat Card
- **Organisms:** Navigation Bar, Sidebar, Data Table, Form Section, Modal/Dialog, Command Palette

### Motion Tokens

```css
:root {
  /* Easing */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Duration */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-glacial: 600ms;

  /* Composed */
  --transition-default: var(--duration-normal) var(--ease-default);
  --transition-enter: var(--duration-normal) var(--ease-out);
  --transition-exit: var(--duration-fast) var(--ease-in);
}
```

### Z-Index Scale

```css
:root {
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-popover: 500;
  --z-toast: 600;
  --z-tooltip: 700;
  --z-max: 9999;          /* debug overlays only */
}
```

- Never use raw z-index numbers — always token reference
- `z-max` reserved for dev tools
- Modal backdrop = `--z-modal - 1` (399)

### Breakpoint Tokens

```css
/* Reference values — use in @media or container queries */
--bp-sm: 640px;
--bp-md: 768px;
--bp-lg: 1024px;
--bp-xl: 1280px;
--bp-2xl: 1536px;
```

Note: CSS custom properties cannot be used in `@media` queries directly. These are reference values for documentation and JS usage. For CSS, use raw values with a comment referencing the token name.

### Token Naming Convention

| Pattern | Example | Use |
|---------|---------|-----|
| Semantic | `--color-text-primary`, `--spacing-section` | Component usage |
| Scale | `--space-4`, `--radius-lg` | Design system primitives |
| Composed | `--transition-enter` = `duration + ease` | Shorthand combinations |

Semantic tokens reference scale tokens. Components use semantic tokens. Never reference scale tokens directly in components.

### Extending Existing Systems (shadcn/ui)
- Inspect existing installed components before adding new ones.
- Use the project's `components.json`, aliases, tokens, and registry conventions.
- Do not hallucinate components — verify against local source.
- New components must use the same token variables as existing ones.

### DESIGN.md Format

A project-root `DESIGN.md` persists design tokens and decisions across sessions. Structure:

```markdown
# Design System — [Project Name]

## Tokens
<!-- Paste the Token Template and Motion Tokens from above -->

## Colors
<!-- Semantic color palette: --color-text-primary, --color-bg-surface, etc. -->

## Components
<!-- Component inventory with variants and states -->

## Rules
<!-- Project-specific constraints: font stacks, icon system, motion policy -->
```

Keep `DESIGN.md` under 300 lines. Reference it from SKILL.md routing table, not inline.

