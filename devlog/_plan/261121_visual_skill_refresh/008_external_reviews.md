# 008 — External reviews and dispositions (2026-11-21)

User request: "6.2 astra한테 검토해봐 aside neon 한테도 물어보고". Two independent read-only
reviews of 000 to 007, 010, the applied wp1 rules and the catalog PDF:

- **Astra** (`aside/gpt-6.2-astra`): methodology, HIG reading, rule precision, catalog.
- **Neon** (`aside/gemini-4-neon`): visual traits from the screenshots, Korean vs YC
  patterns, Apple references, copy rules, catalog.

Full texts are kept in the session tmp (`review-astra.md` 74 lines, `review-neon.md` 200
lines), not committed. Below: each finding, verdict, and what changed.

## A. Real defects (fixed this cycle)

| # | Finding | Source | Disposition |
|---|---|---|---|
| A1 | The wp1 CSS sample had `.btn:hover` (0,2,0) beating `.btn-primary` (0,1,0): hovered primary became near-white text on near-white, about 1.11:1. | Astra §3 | **Fixed.** Primary states scoped as `.btn.btn-primary:hover/:active`; one `light-dark()` token family; forced-colors border. Rendered check in headless Chrome: primary rest/hover/active 17.31 / 12.32 / 9.06 (light), 17.12 / 12.06 / 9.24 (dark); secondary 13.97 or higher. |
| A2 | Probe picked the wrong CTA: Apple's country-banner "계속" was counted as neutral hero CTA on both Apple pages (the real CTA is Apple Blue `#0071E3`); Yanolja "이전 배너", Sendbird site chooser, LG popup control also counted. Ramp (lime) and Supabase missed. | Astra §1, Neon §1A | **Fixed in probe v2** (`cap/capture2.mjs`): headline = largest visible text in the top 760px; hero CTA = first filled control at or below the headline within 420px, outside header/modal/fixed overlays, after a wider noise filter; header CTA recorded separately; every candidate keeps bounds, surface, glyph paint and a crop. All 258 sites re-run; 007 numbers replaced. |
| A3 | Side-accent detector only saw a thick physical-left border; "0/254" was over-claimed and attributed to AI. | Astra §1, §4 | **Fixed.** v2 checks all four sides, equal-width color-only edges, `::before`/`::after` rails and inset shadows. 007 now states what was measured and drops the AI-origin sentence. |
| A4 | Stats mixed two selection stages (`cta` vs `ctaClass`), so SVG/pill shares did not share a denominator. | Astra §1 | **Fixed.** All 007 numbers rebuilt from one v2 record per site (`run2/metrics.jsonl`, `version: probe-v2`). |
| A5 | 006 amendment silently widened "one brand-colored primary" to "one or two" (Apple's prominent count). | Astra §2 | **Fixed.** Rule keeps exactly one, color on the fill only, label white or ink, logo color is not authorization. |
| A6 | Rule wording had loopholes: no scope (data, system colors, focus), no surface polarity (ink primary is wrong on dark/photo heroes), accent-tinted selection still taught in FE-COLOR-ACCENT-SURFACE-01. | Astra §3, Neon §4A | **Fixed.** FE-COLOR-RESTRAINT-01 rewritten: scope = authored chrome, exclusions listed, theme-relative ink (light fill on dark or photo), states tested in light/dark/forced-colors, checkable lint conditions. FE-COLOR-ACCENT-SURFACE-01 now says its channels are for status/data panels and selected controls stay neutral. |
| A7 | FE-SIDE-ACCENT-01 named only some implementations and had no non-accent list. | Astra §3 | **Fixed.** Any side, physical or logical, any implementation, colored or neutral; dividers, gridlines, prose underlines and focus perimeters are explicitly not accents; data-gutter conditions tightened. |
| A8 | HIG translation errors in 006: icon weights in CSS px are ours, not Apple's; "prefer text or images" is not "no mix"; "avoid offering an app appearance setting" is not a web ban; "always include Cancel" only for destructive alerts. Missed counterexamples: tinted prominent Done in toolbars, green default iOS switch, user-chosen macOS sidebar accent, multi-series charts. | Astra §2 | **Fixed in 006** (corrections section). Counterexamples recorded as "Apple does X; house rule does Y because the owner directive". |
| A9 | Catalog: HIG card image overflow on p.5; "CTA 없음" denominators missing; obscured captures (modals, banners) not marked; p.11 wasted. | Astra §5, Neon §6 | **Fixed in catalog v2**: card images constrained, denominators on every number, obscured flag from `modalVisible`, Apple pages shown as a measurement-failure-turned-fixed case, new pattern pages with enlarged CTA crops. |

## B. Accepted additions (recorded, applied in later phases)

| # | Finding | Source | Where |
|---|---|---|---|
| B1 | Shared traits 007 missed: app UI "peek" framing at the bottom of the hero; one-row minimal nav with 1 to 2 actions on the right; input-embedded heroes (prompt or email); monochrome customer-logo strip; medium headline weights 400 to 600 (conflicts with anti-slop's "100-200 vs 800-900 extremes" advice); warm off-white canvases; two-button pairing; rounded-rect CTAs (6 to 10px) more common than pills; split layout for B2B vs centered for brand/prompt products. | Neon §1B | 007 "Reviewer-observed traits" (labelled as observation, not measurement). v2 measures what it can: weights, pill share, `heroInput`, nav link count. The weight conflict goes to wp4 as a correction of `aesthetics.md`. |
| B2 | Korean-specific: CTA-less full-bleed brand film heroes (Toss, KakaoBank); portal quick-menu icon docks (Kurly, Wanted); 3D clay illustration (Toss Bank); floating chat button. | Neon §2A | 007 Korea section; korea-2026.md in wp4. |
| B3 | YC P26 convergence package: cream canvas + serif H1 + "Backed by Y" pill + cards below; one or two highlighted/italic/color-swapped words in the H1; dark cinematic stock hero; "A. B. C." and "Don't X, Y" frames; "The AI-native [X] for [Y]". | Neon §2B | wp2 copy tells and anti-slop convergence list, as **caps with counterexamples**, not hard fails (see C2). |
| B4 | Apple references to add: HIG `inspectors`, `split-views`, `pop-up-buttons`, `steppers`, `boxes`, `path-controls`, `token-fields`; Finder toolbar (monochrome capsule, color only on tag dots), Notes inspector, Photos, iOS Health/Stocks; and the line between Apple OS chrome (neutral) and apple.com marketing (one blue CTA). | Neon §3 | 006 section 4; catalog shows apple.com blue CTA vs app chrome. |
| B5 | Compact verbal hierarchy is the best-supported cross-group trait: headings of at most 9 whitespace units on most captured pages. | Astra §4 | 007 (recomputed on v2 headlines). |
| B6 | Lint must define PASS / FAIL / UNCERTAIN fixtures first: RTL, right and bottom edges, equal-width colored edge, pseudo/child/SVG rails, table separators, labelled diff row, focus vs selection, brand opt-in, multi-series chart (must pass both frontend and visualizer gates), native controls. | Astra §3, top 5 | 030_phase3.md fixture list. |

## C. Not adopted (with reason)

| # | Finding | Source | Why not |
|---|---|---|---|
| C1 | Allow a brand-colored primary whenever the hero is mostly black-and-white product UI (Notion, Toss Payments, Ramp, Supabase), where an ink button competes with the mockup. | Neon §4B | The owner directive is explicit. The case is real, so the rule keeps the brief-named exception and the theme-relative inversion; the catalog shows these sites as counterexamples so the owner can decide. Escalated as an open question, not decided by the agent. |
| C2 | Hard bans: Korean H1 2 to 5 eojeol with no period; English "no trailing period", "no X for Y", "no YC eyebrow". | Neon §5 | Astra: periods, "X for Y" and a truthful YC badge can be right; counts are from one dated batch with no outcome measure. wp2 encodes them as caps/WARN with a good counterexample next to each, after the Korean sample validation in 020. |
| C3 | "One hue, one meaning" as a global unique mapping. | 006 draft | Astra: Apple means "don't let neighboring colors mislead", not a global one-to-one map. Rewritten as local. |

## D. Open question for the owner

C1: on a hero whose main visual is a black-and-white product mock (Notion, Toss Payments,
Ramp, Supabase pattern), should the brand-colored primary be allowed without the brief naming
it? Current rule: no. Evidence is in the catalog pattern pages.
