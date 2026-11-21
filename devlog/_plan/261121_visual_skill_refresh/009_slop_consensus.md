# 009 — Slop consensus: X, deslop repos, vendor guides, measured detectors (2026-11-21)

User request 2026-11-21: "지금 공통된 규칙들이나 slop 디자인으로 지적되는것들도 찾아봐 x등에서 deslop 레포도
찾고". Result landed in the skill as
`dev-frontend/references/core/slop-consensus-2026.md` (FE-SLOP-CONSENSUS-01). This file holds
the evidence.

## 1. Where the conversation is (X, Nov 2026)

Searched X with the signed-in session: 9 queries, 188 unique posts, including "ai slop
design", "deslop", "unslop ui" and two Korean queries. View counts below were read from X on
2026-11-21.

| Post | Views | What it adds |
|---|---|---|
| @juampitech, anti-slop skill ranks (08-20, 08-21, 08-24) | 546k, 609k, 180k | Writing: stop-slop, no-ai-slop, humanizer, cursor/unslop. Code: dmmulroy/anti-slop, cursor thermo-nuclear, brianlovin/deslop. |
| @BenjaminUIX "10 skills that kill AI slop" (11-16) | 915k | uizze Anti UI Slop, Impeccable, Taste Skill, Emil, Vercel Web Design Guidelines, Anthropic frontend-design |
| @rauchg "Your next design system is… Markdown" (08-31) | 584k | DESIGN.md as the answer to slop |
| @aaayandev "Slop.md" (07-14) | 367k | An 80k-character design anti-slop guideline. Repo not found by search. |
| @jaimintf, @0xaditin "deslop any app" (10-29, 11-20) | 210k, 33k | Appllama mobile app-design skill (5.5k stars) |
| @chaotictransfem (09-16) | 141k | A Pangram-authored skill that deletes useless UI copy. Recommended on 11-09 as "the only UI deslop skill that consistently puts out good work". |
| @elayadesigns (08-04) | 84k | elayadesign/ai-design-skills (16k stars), with SlopScan for live pages |
| @michalmalewicz "SLOP IN A BOX" (11-19) | 1.5k | Icon in a tinted 40px box inside a same-hue card with a brighter border, 8px radius, 8 to 12px inset. "AI patterns come from what people overused before." |
| @ponceto91 (11-20) | 7.9k | The "AI slop aesthetic": dark navy, monospace, rounded corners, across pages, dashboards and slides |
| @daradoescode (11-14) | 5.5k | After 100+ generated sites: "skills only go so far"; image generation helps; plans to fine-tune |
| @dexhorthy "No AI Slop Manifesto" (11-14) | 66k | AI Engineer Code Summit; 300+ signatures. About code, not visual design. |

Takeaway: the discussion has moved from "purple gradient" to (a) named second-order looks,
(b) skills that delete rather than add, and (c) measurable detectors.

## 2. Deslop repositories (GitHub, 2026-11-21)

UI and visual deslop repos (stars, last push):

| Repo | Stars | Pushed | License | Distinctive idea |
|---|---|---|---|---|
| heydamir/unslop | 19,512 | 11-15 | CC-BY-4.0 | Audit, then a five-line direction (product, character, world, moments, signature), then nine passes. Quiet chrome plus "one bright element"; tinted neutral ramp; icons take the text color. |
| elayadesign/ai-design-skills | 16,233 | 11-01 | MIT | Landing-page and Figma skills; SlopScan checks live pages against the same rules |
| Appllama/appllama-skills | 5,554 | 11-21 | MIT | Mobile app design studied against top-grossing apps; simulator-verified |
| superdesigndev/superdesign-skill | 1,040 | 08-21 | MIT | Variant generation |
| felipebasurto/unslop-ui | 677 | 11-20 | MIT | Subtractive: deletes eyebrows, `01 //` numbering, subtitles that repeat titles, captions explaining buttons, fake LIVE dots. Reports what it kept on purpose. |
| erkamyaman/unslopovich | 272 | 11-20 | MIT | 31 detector rules grounded in a study of 5,008,684 low-rated app reviews: users complain about broken back gestures, keyboards covering inputs and hover-only UI, not about gradients |
| funboy322/avoid-ai-design | 167 | 11-18 | MIT | 81-tell catalog with first-order and second-order defaults (SD1 to SD9). Stack of 6 or more tells reads as a template (57 of 120 AI-built pages). Warns that "the mono-chrome move" is itself a default. |
| Gesso-Build/skills (anti-slop) | 95 | 10-27 | MIT | 73 deterministic HTML/CSS rules with thresholds and auto-fixes, graded FIX/FLAG/GATE/BASE (edge-stripe, ghost-card, fake-dot-viz, glyph-on-metric, not-x-but-y-cadence, fabricated-precision) |
| avivgerz-hue/unslop | 65 | 11-16 | MIT | 72-rule linter as CLI and MCP, with APCA contrast |
| AdrianKrebs/design-slop-cop | 19 | 07-07 | MIT | 14 computed-style checks run in Playwright, scored over 1,390 Show HN pages, with a labeled ground-truth set. Run on our sites in §4. |
| Vanszs/AntiSlopUI | 37 | 11-15 | MIT | Palette and research filter |

Code and prose deslop repos, recorded but out of scope for these skills: peteromallet/
desloppify (4,145), hardikpandya/stop-slop (19,101), petergyang/no-ai-slop (13,686),
theclaymethod/unslop (1,193), FeedHive/ai-slop-detector (120 writing patterns). Their prose
lists feed wp2.

Already in 001: impeccable, taste-skill, hallmark, ui-ux-pro-max, interface-design,
Anthropic frontend-design, Vercel web-design-guidelines, jakub and emil skills.

## 3. Vendor guidance now names the defaults

- **Anthropic `frontend-design`** lists five clusters that generated design currently falls
  into:
  1. Cream `#F4F1EA`, a high-contrast serif and a terracotta accent near `#D97757`
     ("Anthropic's own Claude-interaction accent").
  2. Near-black with one acid-green or vermilion accent.
  3. Broadsheet hairlines with zero radius.
  4. The SaaS-card kit: identical rounded cards, one radius, the same `rgba(0,0,0,.1)`
     shadow, gradient washes.
  5. Template chrome: an ALL-CAPS eyebrow on every heading, `A · B · C` meta strings,
     `WORD — fragment` labels, `#0B0B0B` used for black, mono for small labels, and a `→`
     on links.

  Its first-listed typographic tell is accenting one word in a headline.
- **OpenAI GPT-5.5 frontend prompt guide**:
  - No cards inside cards; page sections are full-width bands, never floating cards.
  - No gradient orbs or bokeh blobs.
  - Cards 8px radius or less.
  - Letter spacing 0, never negative; do not scale font with viewport width.
  - Icons, not text pills, for familiar commands; lucide inside buttons.
  - No in-app text describing the app.
  - The hero H1 is the brand, product or literal offer.
  - No one-note palettes; explicitly limit purple or purple-blue, beige/cream/sand/tan, dark
    blue or slate, and brown/orange/espresso.
  - Verify with Playwright screenshots.

Both vendors now ship "don't look like us" lists. That is the strongest available signal for
the second-order defaults, and the reason the consensus file gives coordinates.

## 4. Measured: design-slop-cop on our 254 sites vs 1,390 Show HN pages

Krebs' detector was run unchanged on every site from 007: system Chrome, 1440x900, en-US,
light scheme, with a playwright-core shim. All 254 sites scored, 0 errors. The Show HN
baseline comes from his published tier files (1,390 pages). Our run used his current 14
patterns. The Show HN files predate `hero_font_mix` and include two older patterns
(`icon_card_grid`, `all_caps_headings`), so totals are comparable only per pattern.

| Tier (patterns hit) | Show HN | YC P26 | Korea | Foreign |
|---|---|---|---|---|
| High (4+) | 20% | **17%** | **0%** | 9% |
| Medium (2-3) | 33% | 37% | 27% | 30% |
| Low (0-1) | 47% | 46% | 73% | 61% |

| Pattern | Show HN | YC P26 | Korea | Foreign |
|---|---|---|---|---|
| perma dark mode | 34.7 | 25.7 | 13.3 | 21.2 |
| gradients | 26.0 | 41.9 | 26.7 | 54.5 |
| center-aligned hero | 20.9 | 5.2 | 0 | 6.1 |
| hero eyebrow pill | 16.5 | 16.8 | **0** | 3.0 |
| numbered steps | 16.3 | 13.6 | 6.7 | 12.1 |
| FAQ accordion | 14.2 | 24.1 | 3.3 | 3.0 |
| glassmorphism | 14.0 | 15.7 | 13.3 | 21.2 |
| slop fonts | 10.4 | 4.2 | 0 | 0 |
| accent stripe (top/left colored border) | 6.3 | 3.7 | **0** | 3.0 |
| purple accent | 5.4 | 3.7 | 3.3 | 6.1 |
| colored glows | 5.4 | 3.1 | 3.3 | 0 |
| stat banner row | 5.0 | 12.6 | 16.7 | 3.0 |
| sidebar emoji | 1.4 | 0.5 | 0 | 3.0 |
| hero font mix (one word in another face) | n/a | **23.6** | **0** | 6.1 |

Readings:
- **YC P26 scores like Show HN.** 17% of the batch is High, against 20% for Show HN. Korean
  companies have no High page; foreign leaders 9%. This matches the Neon reading in 007 that
  YC P26 carries an agent-built convergence package.
- **The clearest YC tells relative to established companies:**
  - One word in a different face in the hero: 23.6% YC vs 0% Korea.
  - An eyebrow pill above the hero: 16.8% vs 0%.
  - A FAQ accordion: 24% vs 3%.
- **Gradients alone do not discriminate.** 54.5% of the foreign leaders trip the gradients
  check. Keep gradients as a stacking signal, not a single-hit verdict, which is what
  FE-SLOP-CONSENSUS-01 says.
- **The colored side or top stripe is the tell the owner named.** A designer quoted by Krebs:
  "colored left borders are almost as reliable a sign of AI-generated design as em-dashes
  for text". It appears on 6.3% of Show HN pages and 0% of Korean companies. FE-SIDE-ACCENT-01
  stands.
- Stat banner rows are common on Korean corporate pages (16.7%: Toss, Moloco) and on YC.
  Counted as a tell only in a stack.

## 5. Consensus count (keyword level)

Each source's text was searched for 54 canonical tells (`tmp/oss/matrix.py`). There are 18
sources: the 16 skill repos plus the OpenAI guide and slop-cop. Most-named:

1. render and look (18)
2. start from a reference (17)
3. em dashes (15)
4. default fonts (13)
5. hype words (13)
6. purple, glow, eyebrow, emoji icons, orbs (12 each)
7. gradient text, navy/terminal theme, tracked caps, status dots, fade-up on every section,
   vague CTAs, executable detector (11 each)

This is mention counting, not agreement on thresholds. Use it to rank attention, not as
evidence that a tell is bad.

Before this cycle codexclaw had no text for five tells: status dots, monospace as costume,
nested cards, the sparkle-for-AI glyph, and redundant subtitle or caption copy. After
`slop-consensus-2026.md`, every tell in the list is covered at keyword level.

## 6. Disagreements recorded (choices in the consensus file)

| Topic | Sources disagree | Choice in the consensus file |
|---|---|---|
| Letter spacing | OpenAI "0, not negative" vs impeccable floor vs 82% negative tracking on leaders (007) | Kept negative tracking on display only |
| Card radius | OpenAI 8px or less vs impeccable 12 to 16px | Radius by density |
| Icon set | OpenAI recommends lucide vs old codexclaw "avoid Lucide exclusively" | The codexclaw line was rewritten: the tell is mixing sets and strokes |
| Status dots | heydamir allows a status-dot signature vs others ban decorative dots | Real state only |
| Viewport-scaled type | OpenAI says no vs codexclaw `clamp(...vw...)` | Left to wp4 |

## 7. Changes made this cycle

- NEW `dev-frontend/references/core/slop-consensus-2026.md` with FE-SLOP-CONSENSUS-01:
  - the stacking rule
  - 12 new tells
  - second-order defaults with coordinates
  - "the monochrome move is also a default", paired with FE-COLOR-RESTRAINT-01 through the
    "one rich moment" rule
  - the disagreement table
- `anti-slop.md`: a pointer near the top; the Lucide line replaced.
- `topic-index.md` and the dev-frontend router: one row each.
- Gates: check-prompt-architecture OK, gate.mjs OK.

## 8. For wp3 (lint)

- Port ideas from slop-cop: computed-style checks with no LLM judging and about 5 to 10%
  false positives by its manual QA, plus a labeled ground-truth file. Do not copy code;
  it is MIT, but we write our own.
- Port ideas from Gesso: thresholds per rule and FIX/FLAG/GATE grades.
- Reuse our 254-site run as a regression corpus. Fixtures must pass on Korean pages: Korea
  scored 0% High.

## Limits

- X search returns top posts only, and view counts are point-in-time.
- The Show HN baseline is Krebs' published snapshot from his earlier pattern set.
- slop-cop ran with en-US locale while 007 used ko-KR.
- Keyword consensus over-counts generic words: "reference", "render", and the em-dash
  character inside prose.
