# Serif Renaissance + Death of the Split Hero

Date: 2026-07-09
Method: cxc-search Tier 3 — 2 parallel GPT-5.5 explorers (Carson: serif renaissance /
Fermat: split-hero decline), live computed-style measurements + Tier-2 opened sources.
Follows: 000_research.md (OpenAI grammar / blurred naturalism / product-led heroes)

---

## 1. Serif renaissance (Carson) — real but UNEVEN

### Verified cases (live computed styles, 2026-07-09)
| Brand | Reality |
| --- | --- |
| Anthropic/Claude | Strongest case. Identity by **Geist** (Styrene by Commercial Type + Tiempos by Klim), now evolved to custom `Anthropic Serif/Sans/Mono`. claude.ai H2: Anthropic Serif **56px / weight 330** / lh 67.2; UI = Anthropic Sans 15-16px/500-550. anthropic.com: H1 sans, editorial H2s in serif ~68px/400. |
| Perplexity | Main app is sans (`pplxSans`); the serif proof is **Comet** (Editorial New primary, by Studio Freight — Fonts In Use 2025-10-23). |
| Manus | Live: Libre Baskerville display 36px/400, system sans UI. |
| Runway | PARTIAL: loads JHA Times Now but current hero renders `abcNormal` 48px/400. |
| Attio | PARTIAL: loads Tiempos Text but hero is Inter Display 64px/600. |
| Mistral | COUNTEREXAMPLE: `ALTMistral` sans 96px/500 + Space Mono. |
| Medium (precedent) | GT Super **120px/400** display + Sohne 13-14px UI — canonical editorial pairing. |

### Why (WIRED 2026-06-05 "AI Has Come for Serif Fonts")
Serif signals humanity/scholarship/print-trust against AI coldness ("Perplexity is for
people"). Semiotics: serif=human hand/books; warm off-white page metaphor; sans=usable UI;
mono=technical legitimacy; editorial layout="we are thoughtful and cited".
**Backlash label exists: "tasteslop"** — serif as a generic AI-premium shortcut is already
being called out. Serif adoption must be earned by editorial content structure, not pasted on.

### The actual web grammar
NOT "make everything serif". It is a **three-role system**:
**display serif (large, LIGHT weight 330-400, never bold-heavy) + sans UI + mono accent**.
Note the weights: Claude 330, Medium 400, Anthropic 400. Bold display serif is not the pattern.

### Korean equivalent
Editorial myeongjo exists but no verified KR-AI-brand myeongjo wave. Webfont ranking:
- **MaruBuri** (Naver, 명조/부리, ExtraLight-Bold): best warm KR display serif; 400-600 headline, never tiny UI.
- **Noto Serif KR**: best coverage/weights; heavy CJK payload — subset or variable.
- Nanum Myeongjo: literary but dated for premium tech. Chosun Myeongjo: newspaper authority signal.
- Pairing grammar: myeongjo display + Pretendard/SUIT/system sans UI.

## 2. Split hero is a dead default (Fermat)

### Diagnosis
"Left bold headline + right boxed screenshot" = the exhausted Stripe(2020)->Linear(2023)
template lineage. Named critique trail: "The Linear effect" (Rectangle 2023-01-10),
"Linear Copycats" (Built With Bricks 2024-02-14), Nordcraft "why do all websites look the
same" (2024-09-03, answer: show don't tell), LogRocket treats "Linear Design" as a
reproducible template category (2026-02-03), Matt Strom-Awn "same-ification".

### What top sites do instead (live-verified 2026-07-09)
| Composition | Who |
| --- | --- |
| Centered stacked over full-width media | OpenAI (Introducing GPT-Live), Dia, Framer, Raycast |
| Product-as-stage: headline spans width, huge UI rises full-width below | Linear, Cursor (left copy + full-width interactive demo BELOW, not beside) |
| Editorial/institutional opener (text-led, no screenshot) | Anthropic |
| Evolved split: copy left, giant animated canvas behind/right (not a boxed card) | Stripe, Vercel |
| Centered consumer hero over full-bleed photography | Toss |

Core inversion: **the product visual stops being a polite right-column card and becomes
the STAGE** — background, environment, full-width surface, or interactive demo.

### Trend labels (verified)
story-driven heroes (SaaSFrame 2026), scrollytelling/motion (Figma 2026), immersive 3D
(Digidop 2025), dimensionality/layers (Contra 2026). Bento already "overused" per Digidop.

### When split is still legitimate
Conversion-focused paid-acquisition B2B landing pages where 5-second clarity beats brand
memorability (Unbounce anatomy). No universal A/B proof either way (VWO: context-dependent).

## 3. Amendment plan for dev-frontend (SoT -> codexclaw/cli-jaw)

1. **layout-discipline.md — new "Hero Composition Grammar (2026)" section**:
   split hero(left text/right boxed mockup) demoted to conversion-LP-only pattern;
   default menu = centered-stacked-over-media, product-as-stage, editorial opener,
   evolved-split-with-canvas, full-bleed consumer photo hero. Product visual must be
   stage/environment, never a boxed right-column card. Korean note: Toss = centered over
   full-bleed, not left-Pretendard-bold + right mockup.
2. **anti-slop.md — new tells**: "left bold headline + right boxed screenshot card" as
   Linear-template slop signal; "serif-as-premium-shortcut (tasteslop)" signal.
3. **aesthetics.md — Serif Discipline rewrite**: from "VERY DISCOURAGED, rare" to a
   domain-gated three-role system (display serif light 330-400 + sans UI + mono accent)
   legitimate for AI/editorial/research/trust surfaces; keep ban for dashboards/tools;
   keep Fraunces/Instrument Serif ban; add rotation additions (Tiempos, Editorial New,
   GT Super class) + measured sizes/weights.
4. **korea-2026.md — Korean serif display subsection**: MaruBuri/Noto Serif KR guidance,
   myeongjo display + Pretendard UI pairing, payload caveat.
5. Cross-ref 000_research.md items (expressive/functional layer split, capsule grammar,
   product-led hero motion combos) into motion.md/aesthetics.md while at it.

## Sources (Tier-2 opened)
geist.co/work/anthropic; type.today/en/journal/anthropic (2024-04-04); claude.ai +
anthropic.com + manus.im + runwayml.com + perplexity.ai + medium.com + attio.com +
mistral.ai live computed styles (2026-07-09); fontsinuse.com Comet (2025-10-23) +
JHA Times Now + Sohne; grillitype.com GT Super; WIRED serif piece (2026-06-05);
hangeul.naver.com MaruBuri; notofonts/noto-cjk; blog.nordcraft.com (2024-09-03);
rectangle.substack.com Linear effect (2023-01-10); builtwithbricks.io (2024-02-14);
blog.logrocket.com Linear Design (2026-02-03); mattstromawn.com same-ification;
aimers.io (2025-10-13); openai.com; linear.app; stripe.com; vercel.com; raycast.com;
arc.net; diabrowser.com; cursor.com; framer.com; toss.im (all live 2026-07-09);
saasframe.io 2026; figma.com trend report 2026; digidop.com 2025; contra.agency 2026;
paddlecreative.co.uk 2025; unbounce.com anatomy/best-practices; vwo.com ab-testing.
