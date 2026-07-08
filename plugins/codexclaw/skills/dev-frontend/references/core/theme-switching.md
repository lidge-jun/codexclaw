# Theme / Dark Mode

## Implementation

Use `data-theme` attribute on `<html>`, not class-based toggle.

```css
:root {
  --bg-primary: oklch(98% 0 0);
  --text-primary: oklch(15% 0 0);
}

:root[data-theme="dark"] {
  --bg-primary: oklch(12% 0 0);
  --text-primary: oklch(92% 0 0);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg-primary: oklch(12% 0 0);
    --text-primary: oklch(92% 0 0);
  }
}
```

- `data-theme` takes precedence over media query
- System preference is the fallback when no explicit choice
- All colors MUST use CSS custom properties
  (token layering + `oklch()`/`light-dark()` mechanics: `color-system.md`)

## Flash of Wrong Theme (FOWT) Prevention

```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    }
  })();
</script>
```

- Inline in `<head>`, before any stylesheet (< 200 bytes)
- SSR: read theme cookie server-side, set `data-theme` in HTML response

## Toggle Component

Three states: Light → Dark → System → Light.

- Store: `localStorage.setItem('theme', 'dark' | 'light' | 'system')`
- `system` removes `data-theme`, lets media query decide
- Accessible: `role="button"`, `aria-label="Switch to dark theme"`
- Position: header or settings, never hidden in submenu

## Theme Transition

```css
:root[data-theme-transitioning] * {
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease !important;
}
```

- Add transitioning attribute on toggle, remove after 200ms
- Only transition color properties
- Respect `prefers-reduced-motion`: skip transition
- Never animate on page load

## Component Checklist

- [ ] All colors use custom properties
- [ ] Shadows lighter in dark mode
- [ ] White-background images get border in dark mode
- [ ] SVG icons use `currentColor`
- [ ] Borders use surface-level difference in dark mode
- [ ] Charts/data-viz legible in both themes
- [ ] Form inputs have sufficient contrast in both themes

## Cross-references

- Dark token derivation: `dev-uiux-design/references/color-system.md`
- One theme per page: `consistency-locks.md`
