# 010 — Patch Plan: Default Ism / Color / Line Breaks

Derived from `000_research.md`. Binding constraints from A-gate reviewer
(Mencius, round-2 PASS):

## Constraints (reviewer-agreed, verbatim commitments)

1. DEFAULT-ISM is the **UX-INTENT-01 step-3 fallback** — fires only after the
   Design Read and after the one blocking fork is resolved/unanswered; never a
   bypass; applied direction always stated as an explicit assumption. Lands as
   an amendment to dev-uiux-design SKILL.md §1 flow item 3 + a rule block.
2. Anti-Default reconciliation: rule text states "named, specific,
   domain-gated direction replaces generic LLM defaults; must NOT reintroduce
   generic glassmorphism/centered-card taste under a new label"; §2
   Anti-Default Discipline cross-refs the rule; dev-frontend anti-slop POINTS
   to it (no taste duplication).
3. color-system ownership split: uiux `references/color-system.md` = palette/
   judgment owner (generation method, hue budget, tools + when-to-use); NEW
   frontend `references/core/color-system.md` = implementation mechanics owner
   (custom-property token layering, oklch()+fallbacks, color-mix(),
   light-dark(), Tailwind v4/shadcn wiring, contrast verification tooling);
   cross-linked both ways, no canonical duplication.
4. frontend `typography-wrapping.md` EXTENDS existing sites (:39 template, :94
   CJK keep-all, :152 orphans, :186 responsive breaks): adds (i) explicit
   natural phrase-boundary requirement, (ii) dynamic-viewport/mid-breakpoint
   rewrap verification, (iii) container-query text-container note. No
   restatement.
5. uiux `typography-line-breaks.md` adds ONLY the dynamic rewrap/mid-width
   judgment layer + cross-refs frontend responsive-viewport.md; the
   390/768/1024/1440 checklist gains an "arbitrary-width drag check" line.

## WP2 — dev-uiux-design

1. SKILL.md: §1 UX-INTENT-01 step 3 amended to route expressive-surface
   no-answer cases to the new rule; new block "No-Brief Default Direction
   (UX-DEFAULT-ISM-01, DEFAULT; kit content STYLE_SAMPLE)" defining the
   Liquid Editorial kit + domain gate + assumption-statement duty; §2
   Anti-Default Discipline gains cross-ref sentence.
2. design-isms.md: add "1.13 Liquid Editorial (2026 default kit)" with CSS
   signature + Use/Avoid + provenance note (composite decision, sources
   dated).
3. color-system.md: replace the 3-tool line in Practitioner Notes with the
   vetted 2026 toolbox table (Lane B, status-dated) + when-to-use judgment +
   WCAG 2.2 / APCA stance; cross-link to frontend impl reference.
4. typography-line-breaks.md: constraint-5 additions.
5. Devlog 020 notes.

## WP3 — dev-frontend

1. NEW references/core/color-system.md (impl owner): token layering
   (primitive→semantic→component), oklch()+@supports fallback pattern (incl.
   the var()-fallback pitfall), color-mix state derivation, light-dark() +
   color-scheme vs [data-theme], Tailwind v4 @theme / shadcn @theme inline
   wiring, contrast tooling (WCAG 2.2 gate + APCA advisory), rule IDs
   FE-COLOR-TOKEN-01 (DEFAULT) / FE-COLOR-FALLBACK-01 (DEFAULT) /
   FE-COLOR-CONTRAST-01 (STRICT pointer to a11y). Cross-link uiux judgment
   side. Baseline dates from Lane B.
2. typography-wrapping.md: constraint-4 additions with rule ID
   FE-WRAP-NATURAL-01 (DEFAULT) — "text must break at natural phrase
   boundaries at ANY width" + Korean specifics (auto-phrase ja-only fact,
   KLREQ 금칙 note, Intl.Segmenter render-time wbr tactic as advanced option)
   + dynamic-viewport verification checklist (container-width sweep,
   dvh/zoom, scrollWidth assert).
3. SKILL.md routing table: add color-system.md row; update
   typography-wrapping.md row description (natural breaks + dynamic
   viewport).
4. anti-slop pointer per constraint 2 (one line, no taste duplication).
5. Devlog 030 notes.

## WP4 — fresh adversarial gate + validate + 050_done (unchanged)

## Verification

- `rg -n "UX-DEFAULT-ISM-01|Liquid Editorial" dev-uiux-design/` + SKILL wiring.
- `rg -n "FE-COLOR-TOKEN-01|FE-WRAP-NATURAL-01|light-dark|auto-phrase" dev-frontend/`.
- `cxc loop validate`; `git status` scope review each D-close.
