# Typography Wrapping — CSS Text Control

Production CSS for text wrapping, line breaks, orphan prevention, and readable line lengths.
Apply globally in resets or design system base styles.

---

## Global Production Template (2026 Standard)

```css
/* Headings — balance for visual hierarchy */
h1, h2, h3, h4, h5, h6,
blockquote, figcaption, .hero-title {
  text-wrap: balance;
}

/* Short descriptors (1-3 lines) — balance, NOT pretty */
.hero-desc, .card-desc, .feature-desc,
.caption, .subtitle, .blurb {
  text-wrap: balance;
}

/* Body text (4+ lines) — pretty for orphan prevention */
p, li, dt, dd, .prose {
  text-wrap: pretty;
}

/* Editable content — stable for no-reflow typing */
[contenteditable], .live-text {
  text-wrap: stable;
}

/* Readable line lengths */
h1 { max-width: 50ch; }
h2 { max-width: 55ch; }
h3 { max-width: 60ch; }
p, li, article, .prose { max-width: 65ch; }

/* Korean: wrap by 어절 (word), never mid-word. Scope to ko ONLY —
   global keep-all degrades Chinese/Japanese wrapping (verified 2026-07-07,
   MDN + Naver SmartStudio). */
[lang|="ko"] {
  word-break: keep-all;
  overflow-wrap: break-word; /* escape hatch for long 어절 in narrow boxes */
}

/* URLs and unbreakable strings */
a[href], code {
  overflow-wrap: break-word;
}

/* Never-wrap elements */
.cta-label, .badge, .nav-link, .tag {
  white-space: nowrap;
}
```

**Fallback for older browsers:**
```css
@supports not (text-wrap: balance) {
  h1, h2, h3 { max-width: min(90vw, 45ch); }
}
```

---

## `text-wrap: balance`

Distributes characters evenly across lines. Prevents long first line + stubby orphan last line.

**When to use:** Headings, captions, blockquotes, hero titles, card titles.
**When NOT to use:** Body paragraphs (performance cost, limited to ~6 lines in Chromium, 10 in Firefox).

**Tailwind:** `text-balance`

Test with both centered AND left-aligned headings. Combine with `max-width` in `ch` units for best results.

---

## `text-wrap: pretty`

Higher-quality algorithm focused on the last few lines. Prevents typographic orphans.

**When to use:** Body copy, articles, prose, content-heavy sections.
**Tailwind:** `text-pretty`

---

## `text-wrap: stable`

Prevents reflow of previous lines during editing. Content before the cursor stays fixed.

**When to use:** `contenteditable`, note-taking fields, real-time collaborative editing, live chat input.

---

## Short Descriptors — `balance`, not `pretty`

Text that is 1-3 lines long (hero subtitle, card description, caption, feature blurb) is NOT a body paragraph. `text-wrap: pretty` has no meaningful effect on 1-3 lines — it targets the tail of long paragraphs.

**Use `text-wrap: balance` for all short descriptors.**

```css
/* Short descriptors — balance for orphan-free wrapping */
.hero-desc, .card-desc, .feature-desc,
.caption, .subtitle, .blurb {
  text-wrap: balance;
}
```

Add these to the Global Production Template alongside headings.

### `-webkit-line-clamp` disables `text-wrap`

When `-webkit-line-clamp` is active, the browser uses a legacy layout mode. `text-wrap: balance` and `pretty` have **zero effect**. If you need truncation with ellipsis, rely on `max-width` to control where breaks land — `text-wrap` cannot help.

---

## `max-width` in `ch` Units

| Element | Recommended `max-width` | Rationale |
|---------|------------------------|-----------|
| Hero title | 40–45ch | Short, punchy, fits viewport |
| **Hero subtitle/desc** | **35–40ch** | **Short descriptor — prevent orphans in 1-2 lines** |
| Section title | 50–55ch | Room for longer phrases |
| Card title | 30–35ch | Compact containers |
| **Card description** | **30–35ch** | **Short descriptor — tight containers amplify orphans** |
| **Caption / label** | **25–30ch** | **Short descriptor** |
| Body paragraph | 60–65ch | Optimal readability (45–75ch range) |
| Article/prose | 65ch | Standard reading measure |

Combine with fluid typography:
```css
h1 {
  font-size: clamp(2rem, 5vw + 1rem, 4rem);
  max-width: min(90vw, 45ch);
  text-wrap: balance;
}
```

---

## Rag Control

| Problem | Solution |
|---------|----------|
| Uneven rag (jagged right edge) | `text-wrap: pretty` on paragraphs |
| Orphaned last word | `text-wrap: pretty` or `text-wrap: balance` for short blocks |
| Very long lines | `max-width: 65ch` |
| Rivers in justified text | Avoid `text-align: justify` or add `hyphens: auto` + `lang` attribute |
| Heading stubs | `text-wrap: balance` + `max-width` in `ch` |

---

## Korean Short Text — `pretty` Does Not Work

`text-wrap: pretty` does NOT prevent orphans in Korean text under 3 lines. The algorithm targets the tail of long paragraphs; on short Korean text with `word-break: keep-all`, orphans like "합니다.", "화.", "입니다." pass through unchanged.

**Mandatory rule for Korean short text (< 40 characters):** Always use `text-wrap: balance`. If `balance` still produces an orphan, adjust `max-width` by ±2-3ch.

```css
/* Korean short descriptors — explicit balance override */
[lang="ko"] .hero-desc,
[lang="ko"] .card-desc,
[lang="ko"] .subtitle {
  text-wrap: balance;
  word-break: keep-all;
}
```

This is the single most common Korean typography failure in AI-generated pages.

---

## `word-break` vs `overflow-wrap`

| Scenario | Use |
|----------|-----|
| Long URLs in narrow containers | `overflow-wrap: break-word` |
| Maximum flexibility with accurate sizing | `overflow-wrap: anywhere` |
| Aggressive character-level breaking | `word-break: break-all` |
| Korean 어절 (word) wrapping — `:lang(ko)` scope ONLY, degrades zh/ja globally | `word-break: keep-all` |
| User-generated content | `overflow-wrap: anywhere` |

**`word-break: break-word` is DEPRECATED** — use `overflow-wrap: break-word` instead.

---

## Responsive Heading Breaks

Do NOT use manual `<br>` tags for line breaks. They break on different viewports.

```css
/* If you must use <br> for a specific breakpoint: */
h1 br { display: none; }
@media (min-width: 768px) { h1 br { display: block; } }
```

**Preferred approach:** Let `text-wrap: balance` + `max-width` handle it naturally.

---

## `widows` and `orphans` (Print Only)

These CSS properties only work in multi-column layouts and paged media. NOT for standard web layouts.

For web, use `text-wrap: pretty` instead.

---

## Production Pattern

Common across Vercel, Linear, Stripe: `text-wrap: balance` on headings, `text-wrap: pretty` on body, `font-size: clamp()` for fluid scaling, tighter line-height (1.1–1.2) for headings.

For Korean-specific typography considerations, see also `korea-2026.md`.

---

## Natural Phrase Breaks at Any Width (FE-WRAP-NATURAL-01, DEFAULT)

Text MUST break at natural phrase boundaries — between thought units, never
mid-word/mid-phrase — and it must hold at ANY container width, not only
canonical breakpoints. Containers resize continuously (drag-resize,
split-screen, foldables, mobile URL-bar dvh changes, container-query
crossings); a heading that breaks well at 390/768/1024/1440 can still orphan
at 700px. Control break OPPORTUNITIES (`keep-all`, `max-width` in `ch`,
`text-wrap: balance`) instead of width-specific hacks (`<br>`, media-query
text swaps).

Korean facts (verified 2026-07-07, Tier-2: MDN, CSSWG Text 4, KLREQ, Chrome
DevRel, Naver SmartStudio):

- With `keep-all`, break opportunities are 어절 (space) boundaries;
  `text-wrap` only CHOOSES among existing opportunities — it cannot create
  Korean phrase boundaries.
- `word-break: auto-phrase` ships for JAPANESE only (Chrome 119+); do NOT
  rely on it for Korean. Treat it as ja-scoped progressive enhancement.
- KLREQ line rules are real for Korean (not just Japanese kinsoku): closing
  punctuation must not start a line; opening brackets must not end one;
  number/symbol runs should not split.
- Advanced editorial tactic: `Intl.Segmenter("ko", {granularity: "word"})`
  (Baseline 2024) + render-time `<wbr>` insertion at approved phrase
  boundaries under `keep-all`. Insert at RENDER time only — ZWSP/joiners
  stored in canonical content break search/copy/diff.
- Overflow risk: `keep-all` + long 어절 + narrow chips/buttons/table cells =
  clipping; always pair with `overflow-wrap: break-word` (or `anywhere` for
  user-generated/URL content — note it also shrinks min-content size).

### Dynamic-Viewport Verification (checklist)

- Sweep CONTAINER widths, not device presets: 160-900px in 8-16px steps for
  headings, cards, buttons, chips, sidebars, resizable panes, table cells.
- Test dvh/svh URL-bar changes, split-screen halves (640-1024px band, see
  `responsive-viewport.md`), foldable-narrow panes, container-query
  crossings, and 200% zoom / OS text scaling separately.
- Assert no overflow: `scrollWidth <= clientWidth` on text containers, plus
  screenshots for clipping/overlap at 2-3 arbitrary mid-widths.
- Korean fixtures: long single 어절, no-space strings, mixed
  Korean/Latin/number copy, URLs, punctuation-heavy lines; flag any
  mid-syllable split where `keep-all` is expected.
- Fluid type uses `clamp()` with rem/em bounds — never bare `vw`/`cqi` font
  sizes (zoom/user-font-size must keep working).

Judgment layer (when a break is "natural", review criteria):
`dev-uiux-design/references/typography-line-breaks.md § Dynamic Rewrap Judgment`.

## Sources

- [MDN: text-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap)
- [Chrome: CSS text-wrap balance](https://developer.chrome.com/docs/css-ui/css-text-wrap-balance)
