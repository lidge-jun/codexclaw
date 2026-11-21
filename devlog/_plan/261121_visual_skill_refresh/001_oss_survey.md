# 001 — OSS survey (2026-11-21)

Method: GitHub API metadata (`gh api repos/<r>`, 2026-11-21 KST), shallow clones read
locally, plus 2026-09/11 roundup articles. Stars measure attention, not quality. The earlier
survey is `plugins/codexclaw/skills/dev-visualizer/reference/source-patterns.md` (2026-09-08);
rows below are new or materially changed since then.

## Frontend / UI design skills

| Repo | Stars | Pushed | License | What it has that codexclaw lacks |
|---|---|---|---|---|
| nextlevelbuilder/ui-ux-pro-max-skill | 152,237 | 11-19 | MIT | A searchable CSV knowledge base (styles, palettes, font pairings, charts, UX rules, per-stack rules) queried by script before drawing. Broad, low opinion. |
| Leonxlnx/taste-skill | 119,434 | 11-08 | MIT | One skill only now (`design-taste-frontend` 2.5.1); older style skills moved to `taste-skill-classics`, image skills to `imagegen-skills`. Stop hook runs `gate.mjs` in a real browser at 1440/1024/768/390; 12 scripts (dealers for hero/moments, photos, icons, consistency, perf, copy-lint); asset library; 9 house rules. |
| pbakaus/impeccable | 114,172 | 11-21 | Apache-2.0 | One skill, 24 commands (shape, critique, audit, polish, bolder, quieter, distill, clarify, typeset, layout, colorize, animate, live, generate…). Rust detector engine with SARIF output and a post-edit hook; PRODUCT.md + DESIGN.md context; surface modes Persuade / Operate / Read / Experience; `craft-floor.md` bans (incl. one-sided bar on a rounded box, gradient text, eyebrow kickers, glass as decoration). Reviewer subagent definitions. |
| Nutlope/hallmark | 58,721 | 11-11 | MIT | 16-line Floor binding every output; `sloplint.mjs --render`; Reflex gates waivable on the record; 21 macrostructures; themes dealt per build to stop convergence; reads DESIGN.md first; brand-truth step. |
| emilkowalski/skills | 58,488 | 11-15 | MIT | 20 small motion/interaction skills (animate, review-animations, gestures, choreograph, apple-design). |
| vercel-labs/agent-skills `web-design-guidelines` | 34,623 | 11-20 | see repo | 100+ review rules (keyboard, focus, forms, motion, typography details) as a pre-ship review command. |
| google-labs-code/design.md | 28,991 | 11-18 | Apache-2.0 | DESIGN.md format spec: YAML tokens + prose rationale; `npx @google/design.md lint` (broken refs, WCAG contrast) and `diff`. |
| jakubkrehel/skills | 12,521 | 11-19 | MIT | 16 skills incl. better-writing (product microcopy), better-colors, interface-review, variant. |
| google-labs-code/stitch-skills | 11,124 | 11-20 | Apache-2.0 | Stitch MCP workflows; extract-design-md; taste-design. |
| Dammyjay93/interface-design | 6,014 | 06-20 | MIT | Product UI only; "if another AI would produce the same output, you failed"; token names that evoke the product world. |
| airtaxi/frontend-slop-guard | 2 | 10-19 | MIT | Ten named tells incl. "fingernail cards" (left accent bar), Korean README. Low adoption, useful as a checklist. |
| anthropics/skills `frontend-design` | 198,152 (repo) | 11-16 | Apache-2.0 (folder) | 71-line baseline; studio-lead framing; warns about the big-number-small-label default. |

Independent test, 2026-10-24 (Subframe): of four design skills asked to redesign one landing
page, only Impeccable changed the look; the others polished details. Their conclusion:
rules encode polish, curated references move the look.

## Visual / document skills

| Repo | Stars | Pushed | License | Relevant pattern |
|---|---|---|---|---|
| cathrynlavery/diagram-design | 69,422 | 11-19 | MIT | 50 diagram types as HTML+SVG; first-use style-guide gate (customize brand before shipping defaults); density target 4/10, split above 9 nodes; Mermaid/draw.io import. |
| nexu-io/open-design | 108,730 | 11-21 | Apache-2.0 | Local design workspace; 151 DESIGN.md brand packages; 562 SKILL.md; decks, live artifacts, HyperFrames video. Comparator only. |
| nicobailon/visual-explainer | 11,205 | 11-05 | MIT | v0.15: `kit/look.mjs` opens the page headless at 390 and 1280 and reports script errors, sideways scroll, labels < 12px, overlaps, heading gaps, then a contact sheet; one claim per figure, every arrow a verb, every number a picture; slides, video, PPTX export; reader comments in-page. |
| JimLiu/baoyu-skills | 27,761 | 11-20 | MIT | Image-model infographics (21 layouts x 22 styles). Different route (bitmap). |
| open-slide/open-slide | 9,819 | 11-20 | MIT | Agent slide framework, fixed 1920x1080 canvas. |

## Where codexclaw stands

- Ahead: Korean-first typography and copy, WCAG 2.2 AA ownership, experience audit, surface
  and density routing, evidence discipline, the paged PDF pipeline with `quality-gate.mjs`.
  No surveyed repo matches these.
- Behind: enforcement. Markdown words / scripts that check output (2026-11-21):

| Skill | MD words | Scripts |
|---|---|---|
| codexclaw dev-frontend | 53,084 | 2 (scaffold/bundle, no checks) |
| codexclaw dev-uiux-design | 28,189 | 0 |
| codexclaw dev-visualizer | 20,009 | 9 (report/PDF contracts) |
| taste-skill | 81,230 | 153 |
| hallmark | 103,729 | 15 |
| visual-explainer | 12,544 | 20 |

## Adoption boundary

Ideas only, written in our own words, as in the 2026-09-08 ledger. Apache-2.0 sources
(impeccable, open-design, design.md) would need NOTICE handling if anything were copied;
nothing is. Add the new rows to `source-patterns.md` in wp5.
