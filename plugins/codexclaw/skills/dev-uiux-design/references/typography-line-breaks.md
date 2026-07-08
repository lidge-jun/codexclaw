# Typography Line Breaks — Design Judgment Guide

When to apply text wrapping control, how to evaluate line break quality, and what to check during visual verification.

Read `dev-frontend/references/core/typography-wrapping.md` for the CSS implementation.

---

## 1. The Problem

AI-generated and unreviewed web pages share a common tell: **uncontrolled text wrapping**. Headings break at arbitrary points, creating orphaned words, lopsided rags, and awkward visual rhythm.

**Before (slop):**
```
Connects to what you
already run                    ← "already run" orphaned, feels broken
```

**After (controlled):**
```
Connects to what
you already run                ← Balanced, intentional
```

The difference is subtle but immediately signals whether a page was designed or merely generated.

---

## When Each Tool Applies

| Element | Tool | Rationale |
|---------|------|-----------|
| Hero headline | `text-wrap: balance` + `max-width: 40-45ch` | High-visibility, must look intentional on every viewport |
| **Hero subtitle/description** | **`text-wrap: balance`** + `max-width: 35-40ch` | **Short descriptor — `pretty` is insufficient at 1-2 lines** |
| Section title | `text-wrap: balance` + `max-width: 50-55ch` | Consistency across sections |
| Card title | `text-wrap: balance` + `max-width: 30-35ch` | Tight containers need compact control |
| **Card description (1-3 lines)** | **`text-wrap: balance`** + `max-width: 30-35ch` | **Short descriptor — orphans extremely visible in small containers** |
| **Caption / label text** | **`text-wrap: balance`** + `max-width: 25-30ch` | **Short descriptor — same reason** |
| Body paragraph (4+ lines) | `text-wrap: pretty` + `max-width: 65ch` | Orphan prevention at paragraph end |
| CTA/button label | Manual — keep to 1 line | Never let a CTA break across lines |
| Navigation links | No wrapping needed | Always single-line |
| Stat label | `max-width: 20ch` | Keep compact under the number |
| Badge/tag text | `white-space: nowrap` | Never wrap |

### Short Descriptors — The Missing Category

Text that is **1-3 lines long** is neither a heading nor a body paragraph. Examples:
- Hero subtitle / description
- Card description / preview text
- Product one-liner
- Testimonial snippet
- Feature description under an icon

**Rule: Short descriptors MUST use `text-wrap: balance`, not `pretty`.**

`text-wrap: pretty` optimizes the last few lines of long paragraphs. On 1-2 line text, the algorithm has nothing to redistribute — orphans pass through unchanged. `balance` distributes characters evenly across ALL lines, which is exactly what short text needs.

**Before (pretty on short text — orphan passes through):**
```
마다가스카르 바닐라 시럽과 벨벳 스팀밀크의 조
화.                                              ← "화." orphaned
```

**After (balance on short text — redistributed):**
```
마다가스카르 바닐라 시럽과
벨벳 스팀밀크의 조화.                             ← balanced
```

---

## Heading Break Quality Criteria

When reviewing a heading visually, check:

1. **No orphaned single word** — The last line should have at least 2 words (or ~33% of the longest line's length)
2. **Balanced distribution** — Line lengths should be roughly equal, not one long line + one short stub
3. **Semantic grouping** — Breaks should happen between thought units, not in the middle of a phrase
4. **Viewport resilience** — The heading should look good at 390px, 768px, 1024px, AND 1440px, and at ARBITRARY widths between them (drag-resize / split-screen check — see the dynamic rewrap layer below)
5. **Language-aware** — Korean (한글) headings with `word-break: keep-all` to prevent mid-word breaks

**Bad breaks (cut mid-phrase):**
```
Everything you check in Datadog, without leaving
vim                                               ← orphan
```

**Good breaks (between thought units):**
```
Everything you check in Datadog,
without leaving vim                               ← balanced, semantic
```

---

## Dynamic Rewrap Judgment (verified 2026-07-07)

Text must break at natural phrase boundaries at ANY width, not just canonical
breakpoints — containers resize continuously (drag-resizable panels,
split-screen halves, foldables, mobile URL-bar dvh changes, container-query
crossings). Judgment layer on top of the criteria above:

- Breaks are chosen by the browser at render width; a heading that breaks
  semantically at 390/768/1024/1440 can still orphan at 700px. Judge text in
  CONTAINERS (sidebar, modal, half-window), not only device presets.
- Prefer break-opportunity control (`keep-all`, `balance`, `max-width` in
  `ch`) over width-specific hacks (`<br>`, manual media-query text swaps) —
  hacks guarantee bad breaks at in-between widths.
- Korean note: `text-wrap` only chooses among EXISTING break opportunities;
  with `keep-all`, opportunities are 어절 boundaries — verify long 어절 and
  mixed ko/Latin strings don't overflow narrow chips/buttons.
- Mechanics + verification checklist (container-width sweep, dvh/zoom,
  overflow asserts): `dev-frontend/references/core/typography-wrapping.md`
  § Dynamic-Viewport Verification and
  `dev-frontend/references/core/responsive-viewport.md` (container queries,
  split-screen band).

## Visual Verification Additions

Add these checks to the UX pre-flight:

- [ ] Hero headline renders balanced on desktop (1440px) AND mobile (390px)
- [ ] No heading has an orphaned single word on the last line
- [ ] Section titles do not exceed 55ch per line
- [ ] Body paragraphs do not exceed 65ch per line
- [ ] CTA buttons do not break across lines at any viewport
- [ ] Korean headlines preserve word integrity (no mid-syllable breaks)
- [ ] `text-wrap: balance` is applied to all headings globally

---

## Common Mistakes

| Mistake | Why it happens | Fix |
|---------|---------------|-----|
| Using `<br>` for line breaks | Works at one viewport, breaks at others | Use `text-wrap: balance` instead |
| `max-width` in `px` | Doesn't adapt to font size changes | Use `ch` units |
| No `max-width` on headings | Lines stretch full container width | Add `max-width: 45-55ch` |
| `text-wrap: balance` on body text | Performance cost, limited to ~6 lines | Use `text-wrap: pretty` for paragraphs |
| Ignoring mobile line breaks | Heading looks good on desktop but orphans on mobile | Test at 390px |
| Same `max-width` for all heading levels | Different font sizes produce different visual widths | Scale `max-width` by heading level |

---

## Korean Typography Notes

```css
[lang="ko"] {
  word-break: keep-all;
  overflow-wrap: break-word;
}

[lang="ko"] h1, [lang="ko"] h2 {
  text-wrap: balance;
  word-break: keep-all;
}
```

`word-break: keep-all` is critical for Korean — without it, browsers break Hangul at any syllable boundary, creating unreadable mid-word splits.

### Korean Orphan Criteria (MANDATORY)

Korean text with `word-break: keep-all` prevents mid-word breaks but creates a specific orphan pattern: the last word gets pushed to a new line alone. This is especially visible with verb endings.

**Korean last-line minimum:** The last line must contain at least **4 characters (2 syllable blocks)** or **33% of the longest line's width**. A line with only "합니다.", "화.", "입니다.", or any 1-3 character fragment is ALWAYS wrong.

**Common Korean orphan patterns (all failures):**
```
직접 로스팅한 싱글 오리진 원두와 제철 디저트를 매일 준비
합니다.           ← FAIL: "합니다." alone (3 chars + punctuation)

마다가스카르 바닐라 시럽과 벨벳 스팀밀크의 조
화.               ← FAIL: "화." alone (1 char + punctuation)

16시간 저온 추출 콜드브루에 부드러운 우유를 더했습니
다.               ← FAIL: "다." alone (1 char + punctuation)
```

**Fix priority for Korean short text:**
1. Use `text-wrap: balance` (not `pretty`) — this alone fixes most cases
2. If `balance` still orphans, adjust `max-width` by ±2-3ch to shift the break point
3. As last resort, rewrite the copy to avoid the orphan

**`text-wrap: pretty` does NOT solve Korean orphans in short text.** The `pretty` algorithm targets the last 4-8 lines of long paragraphs. On 1-3 line Korean text, it has no effect — the orphan passes through unchanged. This is the single most common Korean typography failure in AI-generated pages.

### `-webkit-line-clamp` Conflict

`-webkit-line-clamp` (used for "show 2 lines with ellipsis") **disables `text-wrap` entirely**. The browser switches to a legacy layout mode where `balance` and `pretty` have no effect.

If you need line clamping AND orphan control:
- Accept that clamped text will have uncontrolled wrapping, OR
- Set `max-width` carefully so the natural break avoids orphans, OR
- Use JavaScript-based truncation that preserves `text-wrap`
