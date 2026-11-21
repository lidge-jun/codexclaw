# Slop consensus 2026 — what independent sources agree on

Read during a visual audit, before shipping a new or redesigned surface, and when writing
lint rules. [anti-slop.md](anti-slop.md) remains the main ban list. This file adds the tells
that several independent sources now name and that anti-slop.md did not cover, the
"tasteful" defaults with their coordinates, and the places where sources disagree, each with
the choice codexclaw makes. Surveyed 2026-11-21. Evidence and counts:
`devlog/_plan/261121_visual_skill_refresh/009_slop_consensus.md`.

Sources weighed most:
- Vendor guidance: Anthropic `frontend-design` (its five calibration clusters) and OpenAI's
  GPT-5.5 frontend prompt guide.
- Measured detectors: Adrian Krebs' design-slop-cop (14 computed-style checks over 1,390 Show
  HN pages) and Gesso anti-slop (73 rules with thresholds).
- Deslop skills: impeccable, hallmark, taste-skill, heydamir/unslop, avoid-ai-design,
  unslop-ui, unslopovich.

## Stacking (FE-SLOP-CONSENSUS-01, DEFAULT)

**The rule.** One tell proves little; a stack of tells reads as generated. Count the tells
below plus those in anti-slop.md on the rendered first viewport and on each repeated
section. Three or more that the brief did not ask for means redesign that section; do not
patch tells one at a time.

**Why these thresholds.**
- Krebs calls 4 or more of his 14 checks "High". 22% of recent Show HN pages reached it.
- avoid-ai-design treats 6 or more distinct tells on one page as a template.
- Shipped company sites in the 2026-11-21 survey rarely stack more than one or two.

**Brief overrides.** A pinned brief wins for any single tell (Anthropic: "the brief's own
words always win").

## Tells that were missing from anti-slop.md

| Tell | Who names it | Do instead |
|---|---|---|
| **Cards inside cards; page sections styled as floating cards** | Anthropic (SaaS-card kit), OpenAI ("do not put UI cards inside other cards… page sections must be full-width bands"), Gesso, unslopovich, hallmark, impeccable | Sections are full-width bands or unframed layouts with a constrained inner width. Cards only for repeated items, modals and genuinely framed tools. |
| **Slop in a box**: an icon in a tinted square inside a same-hue card with a brighter border (40px inner box, 8px radius, 8 to 12px inset) | Malewicz (X, 2026-11-19); extends FE-ICON-TILE-01 | Inline glyph beside the heading, or no icon. Never two nested tinted boxes of the same hue. |
| **One word accented in the headline** (color, italic, weight, highlighter, gradient) | Anthropic (first listed typographic tell), avoid-ai-design SD5, Krebs, Neon review of YC P26 | Let size, weight and the line break carry the headline. If something must stand out, make it the thing that matters (a number, a name) through the type system. FE-ITALIC-SERIF-HERO-01 is the serif-italic case of this. |
| **Template chrome**: tracked ALL-CAPS labels above every heading, `A · B · C` meta strings, `WORD — fragment` labels, a `→` glued to every link and button, tinted near-black `#0B0B0B` standing in for ink | Anthropic cluster 5, hallmark floor 9 and 10, avoid-ai-design SD4, unslopovich | Keep a label only when it says something the heading does not; body face, sentence case. One arrow only where the link leaves the page or starts a flow. |
| **Decorative status dots and pulsing "LIVE" badges** | unslopovich, unslop-ui, hallmark floor 10, taste copy tells | Show a dot only for a state that can change and is wired to real data, with a text label. A categorical dot that encodes data is allowed. |
| **Sparkle glyph as the sign for "AI"** | unslopovich (sparkle-icon), Malewicz example | Name the action ("Summarize", "Draft reply") with a plain verb; use the product's own glyph or none. |
| **Gradient orbs, bokeh blobs, radial color washes behind content** | OpenAI ("do not add discrete orbs, gradient orbs, or bokeh blobs"), heydamir/unslop, Krebs (colored glows) | A real image, a product state or a flat surface. FE-GRADIENT-01 still governs any remaining gradient. |
| **Fake data visualization**: rows of equal dots, sparklines with no data, a glyph pasted on every metric, progress rings standing in for content | Gesso (fake-dot-viz, glyph-on-metric), impeccable craft floor | Either a chart from real data, labeled directly, or the number in a sentence. |
| **Redundant UI copy**: a subtitle that repeats the title, a caption explaining the button next to it, helper text on obvious fields, in-app text that describes the app's own features | unslop-ui, pangram "delete useless UI copy" skill, OpenAI ("do not use visible, in-app text to describe the application's features"), FE-METACOPY-01 | Delete first, then rewrite what remains. Keep accessible names and labels tied to real state. |
| **Monospace as a "technical" costume** | Anthropic cluster 5, impeccable, avoid-ai-design SD4 | Mono for code, commands and tabular data a reader scans; nothing else. |
| **Fake window chrome**: traffic-light dots around a generic panel as the hero | avoid-ai-design SD7, hallmark floor 11 | A real screenshot or a real state drawn in the product's own UI. |
| **Airy card dashboard**: every widget a floating card with 14-24px gutters, two-line 56px+ rows, 10-16px radius, greige page background | Owner review 2026-11-21 ("업무용인데 간격이 넓다", "이런 회색이 아니다"); Anthropic cluster 4; OpenAI ("SaaS, CRM… quiet, utilitarian… dense but organized") | FE-DENSITY-01 numbers and FE-NEUTRAL-RAMP-01 achromatic or cool grays; one surface split by hairlines. |
| **One radius and one soft grey shadow on every card** (`rgba(0,0,0,.1)`) | Anthropic cluster 4, Gesso (heavy-box-shadow, over-rounded-card) | Radius and elevation follow hierarchy. Declare elevation once (FE-BORDER-SHADOW-01). |

## Second-order defaults, with coordinates

This extends the second-order reflex test in [anti-slop.md](anti-slop.md). These are what models produce once told to avoid purple. Each is legitimate when the brief
asks for it and a tell when it appears regardless of the subject.

| Cluster | Coordinates | Named by |
|---|---|---|
| Cream page, high-contrast serif, terracotta or clay accent | ground near `#F4F1EA`, accent near `#D97757` (Claude's own UI accent) | Anthropic cluster 1, avoid-ai-design SD1 |
| Near-black page with one acid-green or vermilion accent, often mono | `#0B0B0B` to `#111` | Anthropic cluster 2, SD2 |
| Broadsheet cosplay on a non-publication | hairline rules everywhere, radius 0, dense columns | Anthropic cluster 3, SD3 |
| Vendor-named palettes | purple or purple-blue; beige, cream, sand, tan; dark blue or slate (`#0f172a`); brown, espresso and orange | OpenAI GPT-5.5 frontend guide, SD9 |
| The purple escape | emerald or teal as the lone accent nobody asked for | SD8, Gesso (indigo-accent, safe-green-default) |
| Dark navy, monospace, rounded corners | the "AI slop aesthetic" meme of dashboards and slides | X (2026-11-20), Krebs (perma dark mode is his most common hit, 35% of Show HN) |

**The monochrome move is also a default.** avoid-ai-design lists "the mono-chrome move" next
to cream-terracotta and near-black-lime.

**How this fits FE-COLOR-RESTRAINT-01.** Neutral chrome is the owner's contract; it is not
permission for a world-less gray page. Keep the chrome quiet and give the screen one rich
moment drawn from the product: a real photograph, a product state, a chart with real data or
a rendered object. This is Anthropic's "spend your boldness in one place" and heydamir's "one
bright element". The neutral ramp may lean slightly toward the product's material (chroma of
0.02 or less) and still counts as neutral.

## Where sources disagree, and the codexclaw choice

| Topic | Positions | Choice |
|---|---|---|
| Letter spacing | OpenAI: "letter spacing must be 0, not negative". impeccable: floor -0.04em. Survey: 82% of YC and foreign headlines use negative tracking. | Latin display from 28px up: -0.01 to -0.03em. Hangul display from 40px up: -0.02 to -0.035em (owner blind A/B, 2026-11-21). Body and UI text in any script: 0. |
| Card radius | OpenAI: 8px or less. impeccable: 12 to 16px. Survey: median non-pill CTA radius 6 to 11px. | Tools and dense apps: 8px or less. Marketing: 16px or less. Radius steps follow hierarchy. |
| Icon set | OpenAI: lucide inside buttons. heydamir: the project's set, else lucide. Older codexclaw line: avoid "Lucide exclusively". | Use the project's set; lucide is an acceptable default. The tell is mixing sets or strokes, not the library. |
| Status dots | heydamir: a status dot can be a product's signature. Others: decorative dots are a tell. | Only for real, changing state or encoded categories, always with a text label. |
| Hero text | OpenAI: H1 is the brand, product or literal offer; value props go in supporting copy. In the owner's blind A/B (2026-11-21) a brand-only H1 ("GOAT") lost to a value headline twice, so a bare name is not enough. | The H1 states what the visitor gets; the brand may close it ("동네를 여는 문, 당근"). Round 2 of the A/B isolates wording from structure before wp2 fixes copy rules. |
| Viewport-scaled type | OpenAI: do not scale font size with viewport width. codexclaw: `clamp()` with vw in places. | Open; resolved in the wp4 platform refresh. |
