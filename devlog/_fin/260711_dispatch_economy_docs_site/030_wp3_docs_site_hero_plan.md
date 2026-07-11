---
created: 2026-07-11
tags: [codexclaw, pabcd-initiative, docs-site, hero, plan, diff-level]
---

# WP3 — pabcd_initiative docs-site skeleton + ima2 hero (diff-level plan)

Status: PLANNED (rev 2 — A-gate round 1: 4 blockers, all ACCEPT)

## Design Read + Dial Setting (round-1 blocker #1)

Reading this as: a methodology documentation hub + initiative landing for
developers who run agentic coding loops, with a technical-editorial language —
"a field manual built on top of research notes", not a SaaS marketing page.
Audience: engineers evaluating/adopting the PABCD discipline. Brand signal:
"PABCD Initiative" wordmark-as-headline; identity is anonymous rules /
agent-neutral doctrine (README.md:7 "de-branded... anonymous rules"), so the
visual voice is austere, evidential, print-inflected — never playful mascot or
startup gradient.

Do's: evidence-density, editorial asymmetry, one strong accent, real generated
imagery as the hero stage. Don'ts: gradient washes, glassmorphism cards, split
hero, emoji icons, marketing cliches ("Elevate", "Seamless").

```
DESIGN_VARIANCE: 6
MOTION_INTENSITY: 3
Product density profile: D2 (index landing) / D3 (doc pages)
Reasoning: expressive brand-visible hero on an editorial docs surface — variance
above template default, motion restrained to feedback + at most one scroll
reveal (docs credibility), landing density for index and document density for
detail pages.
```

Final palette/type token VALUES are locked by the element-ledger synthesis
(image rounds below); this Design Read sets direction, not hex values.

## Loop-spec header

- Loop archetype: spec-satisfaction (verifier = rendered-screenshot QA, not a metric).
- Trigger: goal WP3; user asked for a docs-site with an ima2-generated hero in
  `../pabcd_initiative`.
- Goal: a static docs-site skeleton whose hero page a visitor can open locally,
  with a generated bitmap hero (no gradient/SVG hero), brand-first viewport,
  next-section hint visible.
- Non-goals: remote deployment, JS framework/build pipeline, ima2-gen code changes,
  WP4 detail-page content (skeleton links only in this phase).
- Verifier: hero bitmap file exists (non-placeholder, >100KB sanity); page renders in
  a real browser over local HTTP (not `file://`); screenshots at 390 / 768 / 1024 /
  1440 px widths pass overlap/overflow + next-section-hint checks
  (`cxc-dev-testing` §4.6 pattern: browser -> screenshot -> `view_image`)
  (round-1 blocker #3: full checklist viewports).
- Stop condition: criteria c4 evidence captured.
- Memory artifact: this doc + DESIGN.md in docs-site + concept ledger below.
- Expected terminal outcome: DONE (imagegen fallback allowed with explicit note).
- Escalation condition (bidirectional): upward — ima2 generation failing twice on
  distinct requests -> main switches to `imagegen` fallback (stated in D); downward —
  none planned (asset generation and build stay with main: hero design synthesis is
  judgment-owned; page markup is small enough that dispatch overhead exceeds the win).
- Write scope: `../pabcd_initiative/docs-site/**` (new), this devlog unit (plan,
  ledger, concept assets under `assets/concepts/`). Nothing else.

## Design decisions (main-owned judgment)

- Surface: developer-facing initiative/doctrine documentation site. Expressive hero
  is allowed (brand surface), but detail pages stay readable-editorial, not
  marketing. Density: landing-bucket for index, document-bucket for pages.
- Process: UX-CONCEPT-GEN-01 + UX-IMAGE-FIRST-01 (no ism named in brief) — Round 1:
  5 detailed ism-direction renders via `ima2 gen` (server already up, OAuth authed:
  probe evidence in session); HOTL auto-pick with recorded reasoning; Round 2: 3
  refinements `--ref` anchored; synthesize element ledger -> `DESIGN.md`; then code.
  Every render is READ BACK with `view_image` (a produced-but-unread render is not
  observation) and scored per FE-ASSET-SELECT-01 (subject fidelity, composition,
  palette, text render, asset-type fit, technical quality); the ledger records
  per-token source variant + why (round-1 blocker #2).
- Stack: vanilla HTML+CSS multi-page (no build step — user opens files directly or
  via a trivial static server). Shared `assets/site.css`, per-page HTML.
- Hero grammar: full-bleed generated bitmap as stage, H1 = "PABCD Initiative"
  (brand-name headline per hero discipline), <=4 text elements, no split hero, no
  text-in-card over hero, next-section hint within first viewport on 390/768/1440.
- Typography: Korean-first body (site copy in Korean) -> Pretendard variable via
  jsDelivr CDN `<link>` with `font-display: swap` and full system CJK fallback stack
  (`-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`) so
  offline/`file://` degrades gracefully; QA screenshots run over local HTTP with
  network on, so the intended face IS what gets verified (round-1 blocker #4).
  `text-wrap: balance` on headings/short descriptors. Letter-spacing 0.
- Color: OKLCH-derived single accent + tinted neutrals; final values locked by the
  element ledger in DESIGN.md (not pre-committed here to avoid overriding synthesis).
- Pages in skeleton: `index.html` (hero + section stubs linking the 4 WP4 pages) +
  `assets/` + `DESIGN.md`. WP4 fills the detail pages with content and matching CSS.

## File change map

1. `devlog/.../assets/concepts/wp3_r1_{01..05}.png`, `wp3_r2_{06..08}.png` — concept renders.
2. `../pabcd_initiative/docs-site/DESIGN.md` — synthesized element-ledger design lock.
3. `../pabcd_initiative/docs-site/index.html` — hero page + section stubs.
4. `../pabcd_initiative/docs-site/assets/site.css` — tokens from DESIGN.md.
5. `../pabcd_initiative/docs-site/assets/hero.png` (or .webp) — final hero bitmap
   (fresh `ima2 gen` at hero aspect, informed by ledger, not a concept-render reuse).
6. QA screenshots into `devlog/.../assets/qa/wp3_*.png`.

## Accept criteria (c4)

- Hero bitmap exists at docs-site/assets/, generated this phase (ima2 primary;
  imagegen fallback explicitly noted if used).
- Browser render screenshots at ALL FOUR viewports (390 / 768 / 1024 / 1440) show: full-bleed hero,
  brand H1 visible in first viewport, next-section hint visible, no text overlap
  or overflow, no gradient-only hero.
- DESIGN.md exists with per-token source-variant citations (element ledger).
