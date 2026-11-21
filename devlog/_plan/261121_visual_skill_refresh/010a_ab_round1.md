# 010a — Owner A/B round 1 (2026-11-21, 21:32–21:33 KST)

The owner asked to settle the open questions by A/B testing: "내가 ab 테스트 하면서 구분해줄께
테스트 html 여러개 줘봐".

**Setup**
- 16 paired mockups of a GOAT landing page or app screen.
- Each pair differs in one variable only.
- Left/right sides are randomized on each load, and the labels stay hidden until after the
  vote.
- Votes were recorded by a loopback server to `votes.jsonl`.
- Pages and raw votes are session artifacts in `artifacts/abtest/` and are not committed.

## Results

| # | Variable | Winner | Time |
|---|---|---|---|
| t01 | Primary button on light hero: ink vs brand cobalt | **ink** | 5.0s |
| t02 | Primary over black-and-white product mock: ink vs brand | tie | 6.3s |
| t03 | Primary on dark hero: white (inverted ink) vs brand | tie | 13.2s |
| t04 | Toolbar: neutral capsule + monochrome SVG glyphs vs colored filled buttons | **neutral glyphs** | 3.7s |
| t05 | Sidebar selection: neutral step + bold vs tint + left bar + blue text | **neutral** | 3.4s |
| t06 | Callout: full hairline + bold first sentence vs left bar + tint | **full hairline** | 1.7s |
| t07 | 60px Hangul headline tracking: 0 vs -0.035em | **-0.035em** | 9.7s |
| t08 | Card radius: 8px vs 18px | **8px** | 5.3s |
| t09 | All gray vs neutral chrome with color only in the chart and figures | **color in data** | 1.8s |
| t10 | Headline with one word in serif italic color vs plain | **plain** | 1.9s |
| t11 | Uppercase eyebrow pill above H1 vs none | **none** | 2.5s |
| t12 | Number inside a sentence vs a stat strip | **in sentence** | 1.9s |
| t13 | Glyph + list vs three icon-tile cards | **glyph + list** | 4.1s |
| t14 | Korean copy: brand-only H1 with factual sub vs "AI 에이전트 운영의 새로운 기준" with tell-heavy sub | **tell-heavy** | 6.5s |
| t15 | English copy: literal outcome H1 + factual sub vs "The AI-native orchestration platform for modern teams." + buzzword sub | **buzzword** | 7.4s |
| t16 | CTA labels: "맥용 다운로드 / 문서 보기" vs "시작하기 / 자세히 알아보기" | **specific** | 6.1s |

## Reading

- **Visual direction confirmed (11 of 13 visual tests, every decided one).** Neutral primary,
  neutral glyph toolbar, neutral selection, no side bar, 8px radius, color only in data, no
  one-word accent, no eyebrow, numbers in sentences, no icon tiles. These were fast votes of
  1.7 to 5.3 seconds. FE-COLOR-RESTRAINT-01, FE-SIDE-ACCENT-01 and the slop-consensus tells
  now rest on owner preference as well as market data.
- **C1 (brand primary over a black-and-white mock) closed: no exception.** t02 tied, so there
  is no reason to add one. The rule stays: ink by default, and a brand primary only when the
  brief names it. The dark-hero inversion (t03) also tied, so the inverted-ink default stands.
- **Tracking changed.** The owner preferred -0.035em on large Hangul. This contradicted
  korea-2026.md ("avoid negative… default 0") and the -0.03em floor in FE-TYPO-FLOOR-01.
  Both were updated:
  - Hangul display from 40px up defaults to -0.02 to -0.035em, never past -0.045em.
  - Body and UI text stay at 0.
  - Kakao corp's -3px at 70px is the market precedent.
- **Copy is unresolved, and the test was confounded.** In t14 and t15 the "clean" variant
  changed two things at once:
  - t14 used a brand-only H1 ("GOAT"). t15 used a long literal H1 with a dense two-sentence
    sub.
  - The "slop" variant had a recognizable value headline and a short sub.
  - The owner also preferred the specific CTA labels (t16).

  So the owner may be rewarding a headline that states value, or rejecting density, rather
  than endorsing buzzwords. Two changes follow:
  - Changed now: slop-consensus no longer recommends a brand-only H1.
  - Deferred: the copy rules in wp2 wait for round 2, which isolates H1 structure, headline
    wording, sub wording, sub length, the brand-closing shape, imperative vs declarative,
    and contrast frames, one at a time.

## Files changed

- korea-2026.md: tracking rule and the matching bullet.
- anti-slop.md: Korean slop bullet; FE-TYPO-FLOOR-01 letter-spacing floor.
- slop-consensus-2026.md: tracking and hero-text rows.
- Gates: check-prompt-architecture OK, gate.mjs OK.
