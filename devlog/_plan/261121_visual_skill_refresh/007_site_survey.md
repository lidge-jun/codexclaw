# 007 — Site survey: YC P26, Korean companies, foreign startups (2026-11-21, v2)

User request 2026-11-21: "최신 yc 스타트업들 이미지 따서 올해 p26 그리고 한국 대기업들(스타트업) +
외국 스타트업 공통된 특징을 뽑아서 정리". P26 is YC's Spring 2026 batch (formerly X26; 193
companies in the directory on 2026-11-21).

v2 replaces the first version after the reviews in [008](008_external_reviews.md). The first
probe picked Apple's country-banner button as the hero CTA, only looked for thick left
borders, and mixed two selection stages. Every number below comes from one probe-v2 record
per site plus a hand check of every selected CTA crop.

## Method

- **YC**: all 193 companies of `ycombinator.com/companies?batch=Spring 2026`, with the
  website taken from each company page.
- **Korea** (32, hand-picked): Toss, Toss Bank, Toss Payments, Kakao, KakaoBank, Naver
  (corporate site), Daangn, Woowahan, Coupang (aboutcoupang), Musinsa, Kurly, Ohouse, Channel
  Talk, Wanted, flex, Socar, Yanolja, Upstage, Rebellions, Wrtn, Liner, Sendbird, Moloco,
  Remember, Class101, Soomgo, Samsung, LG, SKT, Hyundai, LY, Krafton.
- **Foreign** (33, hand-picked): Linear, Vercel, Stripe, Raycast, Notion, Figma, Perplexity,
  Cursor, Anthropic, OpenAI, Dia, Framer, Supabase, Resend, Clerk, Mercury, Ramp, Retool,
  Granola, Attio, PostHog, Replit, Lovable, ElevenLabs, Mistral, Runway, Browserbase, Modal,
  Cognition, xAI, Aside, apple.com, apple.com/macbook-pro.
- **Capture**: headless Chrome, 1440x900, ko-KR locale, 3.5s after load, first viewport only.
- **Probe v2** (`cap/capture2.mjs`, `version: probe-v2`):
  - Headline: the largest visible text in the top 760px.
  - Hero CTA: the first filled control at or below the headline, within 420px. Header,
    modal and fixed overlays are excluded, and so are cookie, chat, language, carousel,
    login and search controls.
  - Header CTA: recorded separately.
  - Colors: normalized through a canvas, so oklch and display-p3 values count.
  - One-sided edges: all four sides, equal-width color-only edges, `::before`/`::after`
    rails and inset shadows.
  - Hero darkness: measured from the screenshot pixels.
- **Hand check**: every selected CTA crop (175) was inspected.
  - 14 were not primary actions: carousel arrows, prompt send buttons, a cookie button, a
    status pill and a "Backed by Y Combinator" badge.
  - 8 hue labels were wrong: dark gray or black buttons, a beige button, a white button on
    navy.
  - Labels are in `run2/hand_labels.json`.
- **Excluded**: LY (404 at the chosen URL), Liner (redirect notice), one blank page and one
  SSL failure. Final n is 191 YC, 30 Korea and 33 foreign.
- **Storage**: raw data and screenshots stay outside the repo (session `tmp/cap/run2/`). The
  catalog PDF shows them.

## Numbers

| Measure | YC P26 | Korea | Foreign |
|---|---|---|---|
| Hero CTA found and confirmed by hand | 131/191 | 7/30 | 17/33 |
| ... neutral (ink, white or gray fill) | **76/131 (58%)** | 4/7 | 11/17 (65%) |
| ... hue fill | 55/131 (42%) | 3/7 (Toss Payments blue, Rebellions green, Class101 orange) | 6/17 (Stripe, Mercury, Ramp, PostHog, apple.com x2) |
| Most common CTA hues (YC, probe before hand check) | sky/blue 19, red 11, orange 5, teal 4 | | |
| Hero CTA pill-shaped | 45/135 (33%) | 6/12 | 13/22 |
| Median corner radius of non-pill CTAs | 6px | 11px | 8px |
| CTA carries an SVG glyph | 57/135; glyph colored in 4 | 5/12; 1 colored | 9/22; 0 colored |
| One-sided accent on a card or callout (hand-checked) | **2/191** (Adialante callout, Silmaril cookie card) | **0/30** | **0/33** |
| Other one-sided edges detected | header rules, link underlines, page grid lines | text cursor (Upstage), ribbon ornament (Rebellions) | grid lines (Mistral) |
| At most one accent hue bin in the first viewport | 166/191 (87%) | 27/30 (90%) | 26/33 (79%) |
| Dark hero (screenshot luminance below 0.35) | 72/191 (38%) | 5/30 (17%) | 7/33 (21%) |
| Headline centered | 76/191 (40%) | 8/30 | 17/33 |
| Headline weight 400 to 600 | 150/191 (79%), median 500 | 17/30, median 600 | 28/33 (85%), median 500 |
| Median headline size | 66px | 40px | 54px |
| Negative tracking | 157/191 (82%) | 15/30 | 28/33 |
| Serif display headline | 34/191 (18%) | 0/30 | 1/33 (Anthropic) |
| Headline of 9 or fewer whitespace units | 176/191 | 27/30 | 30/33 |
| Headline ends with a period | 72/191 (38%) | 1/30 | 12/33 |
| Headline names AI or agents | 60/191 (31%) | 3/30 | 11/33 |
| Gradient on a small UI element (button or chip) | 43/191 | 5/30 | 15/33 |
| Gradient on a large background (20% or more of the viewport) | 84/191 (44%) | 2/30 | 7/33 |
| Gradient text | 14/191 | 1/30 | 3/33 |
| Large media (8% or more of the viewport) | 137/191 (72%) | 24/30 (80%) | 25/33 (76%) |
| Input embedded in the hero (prompt or email) | 20/191 | 7/30 | 4/33 |
| Median top-nav links | 5 | 5.5 | 6 |
| Emoji in visible text | 24/191 | 2/30 | 1/33 |

Display faces:

- **YC**: Inter 20 and Geist 17, then Playfair, Instrument Sans, Newsreader and Archivo at 5
  each.
- **Korea**: Pretendard on 14 of 30 sites; the rest use house faces such as Toss Product
  Sans, Karrot Sans and KakaoBig.
- **Foreign leaders**: mostly house faces, such as sohne, CursorGothic, figmaSans, pplxSans,
  NotionInter, SF Pro and Geist.

## What the evidence supports

1. **Neutral CTAs are the majority, but not by much.** 58 to 65% of confirmed hero CTAs are
   ink, white or gray. Colored CTAs are also common (about 40%), most often blue.
   FE-COLOR-RESTRAINT-01 is a house choice that the market leans toward, not what everyone
   does. The colored counterexamples (Toss Payments, Stripe, Ramp, apple.com) stay visible
   in the catalog.
2. **One-sided accent bars on cards are almost absent.** There are 2 cases in 254 first
   viewports, both YC. The other single-side edges were dividers, underlines, grid lines or
   ornaments, which FE-SIDE-ACCENT-01 does not count as accents.
3. **Glyphs in buttons are monochrome.** About 4 in 10 CTAs carry an SVG arrow, download or
   app glyph, and only 5 of 71 glyphs were colored.
4. **Headlines are medium weight and compact.** About 80% use weight 400 to 600, and most
   have 9 or fewer whitespace units. This contradicts the anti-slop advice in
   `aesthetics.md` that favors weight extremes (100-200 vs 800-900); wp4 corrects it.
5. **The accent palette is narrow.** 79 to 90% of pages show at most one accent hue bin.
   This counts CSS colors only; color that comes from imagery was not measured.
6. **Light pages dominate outside YC.** Dark heroes appear on 38% of YC pages and about 20%
   of the others.

## Reviewer-observed traits (Neon, from screenshots; not measured)

- **Shared across groups**:
  - Product UI "peeking" in at the bottom of the hero (Daangn, Linear, Panacea).
  - A one-row nav with one or two actions on the right.
  - A monochrome customer-logo strip.
  - Warm off-white canvases (Anthropic, Akkari, Panacea).
  - A two-button pair: a primary plus a quieter secondary.
  - A split layout for B2B, a centered layout for prompt or brand products.
- **Korea**:
  - Full-bleed brand film heroes with no CTA (Toss, KakaoBank), which is why 17 of 30
    Korean pages have no hero CTA.
  - Quick-menu icon docks on portals (Kurly, Wanted).
  - 3D clay illustration (Toss Bank).
  - A floating chat button.
  - Headlines shaped as "benefit, brand" ("동네를 여는 문, 당근", "차가 필요할 땐, 쏘카").
- **YC P26 convergence package**:
  - A cream canvas, a serif H1, a "Backed by Y Combinator" pill and cards below.
  - One or two highlighted, italic or color-swapped words in the H1.
  - Dark cinematic stock-photo heroes.
  - "A. B. C." and "Don't X, Y" frames.
  - "The AI-native [X] for [Y]".
  - wp2 treats these as capped tells shown with counterexamples, not as bans (008 C2).

## Limits

- **Coverage**: first viewport only, one desktop size, one locale, anonymous visit.
- **Sample**: the Korean and foreign lists are hand-picked and mix product pages, corporate
  sites (Naver, Coupang) and portals.
- **CTA detection**: a text link used as the primary action reads as "no CTA".
- **Edge detection**: misses SVG rails and child-element bars.
- **Gradient counts**: grouped by element role (UI, background, text), not by visual weight.
- **Hand labels**: one reviewer (the agent).
- **Scope**: these are dated observations of one batch, not trends or outcome measures.
