# Internationalization (i18n) Global

## Architecture

```
src/locales/
  ko.json     — Korean
  en.json     — English
  i18n.ts     — config + loader
```

- All user-facing strings in locale files — never hardcode in components
- ICU message format for pluralization and interpolation
- Namespace by feature: `{ "auth": { "login": "로그인" } }`
- Fallback chain: user preference → browser locale → default locale
- Libraries: `next-intl` (Next.js), `react-intl`, `i18next` (agnostic)

## RTL Layout

```html
<html dir="rtl" lang="ar">
```

Use CSS logical properties everywhere:

```css
margin-inline-start: 1rem;     /* not margin-left */
padding-inline-end: 0.5rem;    /* not padding-right */
text-align: start;              /* not left */
```

- Flexbox `row` and Grid auto-reverse in RTL — no changes needed
- Directional icons (arrows, progress): `transform: scaleX(-1)` in RTL
- Non-directional icons (search, close): no change
- Numbers always LTR: `direction: ltr; unicode-bidi: embed`
- Never use `float: left/right` — use flexbox/grid

## Pluralization

| Language | Forms | Example |
|----------|-------|---------|
| English | one, other | 1 item, 2 items |
| Korean | other | 1개, 2개 |
| Arabic | zero, one, two, few, many, other | 6 forms |
| Russian | one, few, many, other | 4 forms |

```json
{ "items": "{count, plural, =0 {No items} one {# item} other {# items}}" }
```

- Never concatenate for pluralization (`count + " items"`)
- Test with 0, 1, 2, 5, 21 (catches most plural bugs)

## Date, Number, Currency

```javascript
new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(date)
// → "2026년 6월 8일"

new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(50000)
// → "₩50,000"
```

- Always use `Intl.DateTimeFormat` / `Intl.NumberFormat`
- Currency symbol position varies by locale
- Decimal separator varies: `.` (en), `,` (de, fr)
- Relative dates: `Intl.RelativeTimeFormat`

## Locale Switching UI

- Dropdown in footer or settings
- Show name in own script: "한국어", "English", "日本語"
- Never use flags for languages (flags = countries, not languages)
- Persist: localStorage + URL prefix (`/ko/about`, `/en/about`)
- URL prefix strategy is best for SEO
- Never auto-redirect by IP without an override

## Content Expansion

| Language | vs English | Risk |
|----------|-----------|------|
| German | +30% | Button/label overflow |
| Finnish | +30-40% | Same |
| Arabic | +20-25% | Plus RTL |
| Chinese | -30 to -50% | Characters wider |

- Design with 40% expansion headroom
- Test with German pseudo-locale
- Never fixed `width` on text containers — use `min-width` + flex
- `text-overflow: ellipsis` + `title` tooltip as last resort

## Pre-flight

- [ ] All user-facing text in locale files, not hardcoded
- [ ] CSS uses logical properties (`margin-inline-start`)
- [ ] Dates/numbers use `Intl` API
- [ ] Buttons/labels have 40% expansion headroom
- [ ] Language switcher uses language names, not flags

## Cross-references

- Korean-specific: `korea-2026.md`
- Korean UX writing: `ux-writing-ko.md`
- CJK wrapping: `typography-wrapping.md`
