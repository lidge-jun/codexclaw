# 007 — Site survey: YC P26, Korean companies, foreign startups (2026-11-21)

User request 2026-11-21: "최신 yc 스타트업들 이미지 따서 올해 p26 그리고 한국 대기업들(스타트업) +
외국 스타트업 공통된 특징을 뽑아서 정리". P26 is YC's Spring 2026 batch (formerly X26; 193
companies in the directory on 2026-11-21).

## Method

- YC list: `ycombinator.com/companies?batch=Spring 2026`, all 193 loaded, website read from
  each company page.
- Korea: 32 sites (Toss, Toss Bank, Toss Payments, Kakao, KakaoBank, Naver, Daangn,
  Woowahan, Coupang, Musinsa, Kurly, Ohouse, Channel Talk, Wanted, flex, Socar, Yanolja,
  Upstage, Rebellions, Wrtn, Liner, Sendbird, Moloco, Remember, Class101, Soomgo, Samsung,
  LG, SKT, Hyundai, LY, Krafton).
- Foreign: 33 (Linear, Vercel, Stripe, Raycast, Notion, Figma, Perplexity, Cursor,
  Anthropic, OpenAI, Dia, Framer, Supabase, Resend, Clerk, Mercury, Ramp, Retool, Granola,
  Attio, PostHog, Replit, Lovable, ElevenLabs, Mistral, Runway, Browserbase, Modal,
  Cognition, xAI, Aside, apple.com, apple.com/macbook-pro).
- Capture: headless Chrome, 1440x900, ko-KR locale, 3.5s after load, first viewport only.
  The computed-style probe measured the hero headline (font, size, weight, tracking,
  alignment), the first filled button-like control in the viewport (cookie, chat, language,
  login and slider controls filtered out), one-sided borders, gradients, emoji, distinct
  hues, eyebrows above the headline and large media.
- Excluded 4: LY (404 at the chosen URL), Liner (redirect notice), one blank page, one SSL
  failure. n = 191 YC / 30 Korea / 33 foreign.
- Scripts and raw data stay outside the repo (session tmp `cap/`); screenshots appear in
  the catalog PDF only (third-party pages, not committed).

## Numbers

| Measure | YC P26 | Korea | Foreign |
|---|---|---|---|
| Hero CTA present (filled, first viewport) | 139/191 | 16/30 | 22/33 |
| CTA neutral (ink, white or gray) | **65%** | **75%** | **73%** |
| CTA hue-filled | 35% (sky/blue 17, red 13, teal 5, orange 5) | 25% | 27% |
| CTA pill-shaped | 37% | 31% | 45% |
| CTA contains an SVG glyph | 29% | 31% | 36% |
| Chromatic one-sided accent bar anywhere in viewport | **0%** | **0%** | **0%** |
| Distinct accent hues, 1 or fewer | 90% | 90% | 79% |
| Dark first viewport | 26% | 10% | 21% |
| Headline centered | 40% | 13% | 39% |
| Negative tracking on headline | 80% | 33% | 82% |
| Headline median size / weight | 65px / 500 | 28px / 600 (portals use h1 for logos) | 49px / 425 |
| Serif display headline | 16% | 0% | 6% |
| Eyebrow above headline | 47% (uppercase 19%) | 17% | 36% |
| Emoji in visible text | 12% | 7% | 3% |
| Large photo/product media in viewport | 65% | 80% | 73% |
| "Backed by YC" mark visible | 13% | | |
| Headline mentions AI or agents | 40% | 8% | 44% |
| Headline ends with a period | 53% | 4% | 34% |
| Median headline words | 6 | 3 | 6 |

Top display faces: YC Inter 21, Geist 19, Playfair 5, Manrope 5, Newsreader 5, Archivo 5;
Korea Pretendard 13 of 30, then house faces (Toss Product Sans, Karrot Sans, KakaoSmall);
foreign mostly custom house faces (sohne, CursorGothic, anthropicSerif, figmaSans, pplxSans,
NotionInter, Geist, SF Pro).

## Common traits (all three groups)

1. **Controls are neutral.** Two thirds to three quarters of hero CTAs are ink on light or
   white on dark. Hue on the button is the minority choice everywhere, and YC P26 is where
   it is most common (a blue or red "Book a demo").
2. **Nobody uses a colored side bar.** 0 of 254 sites. The pattern lives in AI-generated
   UIs, not in shipped company sites. wp1's ban matches the market.
3. **One hue or none.** 79 to 90% of pages show at most one accent hue in the first
   viewport. Color comes from photography or product imagery (65 to 80% carry large media),
   not from UI chrome.
4. **The product or a real photo is the hero.** Korean sites lead with photographs of
   people and places, foreign ones with product UI; abstract gradient heroes are rare.
5. **Light by default.** Dark first viewports are a minority (10 to 26%); devtools (Linear,
   Raycast, Modal, Resend) are the dark cluster.
6. **Glyph-bearing buttons are common** (about a third of CTAs carry an SVG arrow or
   download glyph), always monochrome.

## Where the groups differ

- **Korea**: brand name closes the headline ("동네를 여는 문, 당근", "차가 필요할 땐, 쏘카",
  "쉽고 빠른 PG 연동 토스페이먼츠"); short headlines (median 3 words), almost no trailing
  period, little tracking, Pretendard as the common face, left-aligned headlines, AI rarely
  named in the headline. Portals (Naver, Musinsa, Kurly, Yanolja) are dense commerce grids
  with service icon rows: color comes from many product photos.
- **YC P26**: AI or agents in 40% of headlines; "X for Y" noun headlines ("AI Workforce for
  Biopharma", "Cloud Computers for AI Agents", "Phone numbers for AI Agents"); half end with
  a period; an eyebrow (often "Backed by Y Combinator") above the headline in 47%; serif
  display faces in 16% (Playfair, Newsreader, Instrument Serif); Inter and Geist dominate.
  These are the tells codexclaw's anti-slop list already names, which is evidence that
  agent-built sites converge.
- **Foreign leaders**: custom house typefaces, pill CTAs most often (45%), white CTA on dark
  for devtools; one-line claims about the product's job ("Your shortcut to everything.",
  "Deploy now").

## What this changes in the skills

- wp1 confirmed by data: neutral CTA and no side bar are the market default, not an
  aesthetic preference.
- wp2 (copy): add the Korean "benefit, brand" headline shape as a positive move; add "X for
  Y" noun headline, "Backed by" eyebrow and trailing-period headline to the YC-convergence
  tells, capped not banned.
- wp4: record "neutral controls, color in content" as an observed direction with these
  counts and the date.
- Catalog PDF (artifact) shows the contact sheets and per-site rows.

## Limits

First viewport only; one locale; computed styles miss canvas, video and pseudo-element
paint (a `::before` side bar would be missed; the zero is "no border-based side bar"); "CTA"
is the first filled control after filtering, so a site whose primary action is a text link
reads as "none"; Korean headline size is low because portals put logos in h1. Sample: all
of P26, but a hand-picked 32 Korean and 33 foreign sites.
