# Vanilla Stack — HTML + CSS + JS (No Framework)

Rules for building production-quality frontends without React/Vue/etc.
Read `core/aesthetics.md` + `core/anti-slop.md` first.

---

## Core Principle: Zero Dependencies

Single self-contained HTML files with inline CSS/JS. No npm, no build tools, no bundler.
The file IS the deliverable.

---

## Structure

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page Title</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap" rel="stylesheet" />
  <style>
    /* === DESIGN TOKENS === */
    :root {
      --color-primary: #0ea5e9;
      --color-surface: #fafafa;
      --color-text: #18181b;
      --color-muted: #71717a;
      --font-display: 'Outfit', sans-serif;
      --font-body: 'Outfit', sans-serif;
      --radius: 0.75rem;
      --max-width: 1200px;
    }

    /* === RESET === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); color: var(--color-text); background: var(--color-surface); }

    /* === LAYOUT === */
    /* ... */

    /* === COMPONENTS === */
    /* ... */

    /* === ANIMATIONS === */
    /* ... */

    /* === RESPONSIVE === */
    @media (max-width: 768px) { /* ... */ }

    /* === REDUCED MOTION === */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <!-- Semantic HTML -->
  <script>
    // Minimal JS — progressive enhancement only
  </script>
</body>
</html>
```

---

## Typography

Use fonts from **Google Fonts** or **Fontshare** — never system fonts.

```html
<!-- Fontshare (free, high quality) -->
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400;500;700&display=swap" rel="stylesheet" />

<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap" rel="stylesheet" />
```

### Fluid Typography (Mandatory)
```css
h1 { font-size: clamp(2rem, 1rem + 3.6vw, 4rem); }
h2 { font-size: clamp(1.5rem, 1rem + 1.4vw, 2.25rem); }
p  { font-size: clamp(1rem, 0.95rem + 0.2vw, 1.125rem); }
```

**NEVER** use fixed `px` for text. Always `clamp()`.

---

## CSS Animation (Preferred over JS)

### Staggered Reveal on Load
```css
.reveal {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeUp 0.6s ease forwards;
}
.reveal:nth-child(1) { animation-delay: 0.1s; }
.reveal:nth-child(2) { animation-delay: 0.2s; }
.reveal:nth-child(3) { animation-delay: 0.3s; }

@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}
```

### CSS Custom Property for Stagger Index
```css
.reveal {
  animation-delay: calc(var(--index, 0) * 100ms);
}
```
```html
<div class="reveal" style="--index: 0">First</div>
<div class="reveal" style="--index: 1">Second</div>
```

### Hover Effects
```css
.card {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -15px rgba(0,0,0,0.08);
}
```

---

## Viewport Fitting (Critical for Full-Page Layouts)

```css
.section-full {
  min-height: 100dvh; /* NOT 100vh — iOS Safari breaks */
  display: grid;
  place-items: center;
  overflow: hidden;
}
```

**Content Density Limits per Section:**

| Type         | Maximum                                 |
| ------------ | --------------------------------------- |
| Hero         | 1 heading + 1 subtitle + 1 CTA          |
| Content      | 1 heading + 4-6 bullets OR 2 paragraphs |
| Feature grid | 1 heading + 6 cards max (2×3)           |
| Quote        | 1 quote (max 3 lines) + attribution     |

Content exceeds limits? Split into multiple sections.

---

## Responsive Layout

```css
/* Mobile-first */
.grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}

/* Container */
.container {
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 1rem;
}
```

**NEVER** use `calc()` flexbox math. Always CSS Grid.

---

## Progressive Enhancement

1. Content readable without JS
2. Layout works without CSS animations
3. JS adds interactivity, not structure
4. Use `<noscript>` for critical JS-dependent features

---

## Semantic HTML (Mandatory)

```html
<header>...</header>
<nav aria-label="Main navigation">...</nav>
<main id="main-content">
  <section aria-labelledby="features-heading">
    <h2 id="features-heading">Features</h2>
  </section>
</main>
<footer>...</footer>
```

Use `<button>` for actions, `<a>` for navigation. Never `<div onclick>`.

---

## File Delivery

Output a single `.html` file. All CSS in `<style>`, all JS in `<script>`.
Every section needs `/* === SECTION NAME === */` comments.
The file should be openable directly in a browser — no build step.
