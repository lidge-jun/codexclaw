# Source patterns and reuse ledger

Inspected **2026-09-08** with Aside search, original GitHub pages, API metadata and
pinned source files. This is a dated design/engineering survey, not a dependency
manifest. The shipped instructions and example are independently authored; no
upstream code, font binary, artwork or long prose passage is vendored here.

Star counts below are repository-wide snapshots, not skill usage or growth rates.
HEAD dates describe the default branch, not necessarily the last edit of a skill.
Source inspection proves what a project implements or documents; it does not prove
our output looks good. Rendered trials are required separately.

## Visual explanations and design

| Source and inspected revision | Snapshot | Useful pattern | Adaptation boundary |
|---|---|---|---|
| [visual-explainer](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/SKILL.md) | 9,664 stars; HEAD 2026-08-28 | Select representation by question; explain mechanisms; separate overview/detail; compose prose and tables | Do not adopt automatic HTML replacement of requested Markdown tables, fixed home paths, or compulsory zoom controls for tiny diagrams |
| [agent-html-skills / playground](https://github.com/f-labs-io/agent-html-skills/blob/d4f259ea4959aecd1240a10c60a950dfb6d1a3f5/plugins/html-skills/skills/html-interactive-playground/SKILL.md) | 55; 2026-09-02 | Visible parameters/units, immediate model consequences, reset and comparison sweeps | Do not import its Claude receiver, submission server, clipboard or publishing assumptions |
| [taste-skill](https://github.com/Leonxlnx/taste-skill/blob/ccbc15639c97057cbfcf32ecebc38ef716e4bb37/skills/taste-skill/SKILL.md) | 85,154; 2026-08-24 | Audience/page kind before layout variance, density and motion | Marketing/portfolio style constraints do not govern data reports; existing `dev-uiux-design` remains the taste owner |
| [design-taste / editorial-minimal](https://github.com/madebymustafa/design-taste/blob/c4a6bff0871eb4b15371b0e7d2751628b0ed4608/skills/editorial-minimal/SKILL.md) | 1; 2026-08-15 | Text measure, asymmetric hierarchy, rows and restrained rules | An optional genre, not evidence of broad adoption or a universal document look |
| [explainer-pack / aesthetic](https://github.com/Angelopvtac/explainer-pack/blob/09fd3f1de384d71858f0ba678af2abc5721907d1/skills/Explainer/References/Aesthetic.md) | 1; 2026-05-23 | Separate UI accent and semantic colors; direct labels; print tokens | Its skill's conflicting light-theme guidance is rejected; source popularity is limited |
| [visualise](https://github.com/bentossell/visualise/blob/35cd185b58af5db2f9d0fe13d9872b544a467483/SKILL.md) | 480; 2026-03-12 | Question-first SVG/HTML selection and local calculations | Renderer is not included; no host contract can be inferred; copy clearance incomplete |
| [show-html](https://github.com/GoDiao/show-html/blob/67b01f7a219a4fa76bd1c2232adb8c7dca95d51c/show-html/SKILL.md) | 4; 2026-05-23 | Index examples by comparison/explanation/tuning scenario | Mixed provenance; do not copy sample files without their specific notices |
| [html-effectiveness](https://github.com/ThariqS/html-effectiveness/tree/1787245d94aa680edf18b52027e3f859032776ba) | Mature comparator; README calls it unmaintained | Broader vocabulary for interactive explanations | Sample ideas, not a maintained runtime or reusable host integration |

Inspected license files:

- [visual-explainer MIT](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/LICENSE)
- [agent-html-skills MIT](https://github.com/f-labs-io/agent-html-skills/blob/d4f259ea4959aecd1240a10c60a950dfb6d1a3f5/LICENSE)
- [taste-skill MIT](https://github.com/Leonxlnx/taste-skill/blob/ccbc15639c97057cbfcf32ecebc38ef716e4bb37/LICENSE)
- [design-taste MIT](https://github.com/madebymustafa/design-taste/blob/c4a6bff0871eb4b15371b0e7d2751628b0ed4608/LICENSE)
- [explainer-pack MIT](https://github.com/Angelopvtac/explainer-pack/blob/09fd3f1de384d71858f0ba678af2abc5721907d1/LICENSE)
- [html-effectiveness Apache-2.0](https://github.com/ThariqS/html-effectiveness/blob/1787245d94aa680edf18b52027e3f859032776ba/LICENSE)

`visualise` declares MIT in its [README](https://github.com/bentossell/visualise/blob/35cd185b58af5db2f9d0fe13d9872b544a467483/README.md)
but no LICENSE file was found. `show-html`'s [README](https://github.com/GoDiao/show-html/blob/67b01f7a219a4fa76bd1c2232adb8c7dca95d51c/README.md)
describes MIT packaging and Apache-2.0 examples; its root LICENSE returned 404.
Both are observation-only comparators here.

## Documents, pagination and export

| Source and inspected revision | Snapshot | Useful pattern | Adaptation boundary |
|---|---|---|---|
| [gstack / make-pdf](https://github.com/garrytan/gstack/blob/0530392821c277b95e5cd65aa9d9fda4248718b2/make-pdf/SKILL.md) | 131,972 stars; HEAD 2026-09-06 | Explicit content → asset rendering → pagination → export pipeline | Preview can omit final diagram/image work; inspect final PDF. Reject silent readiness timeout and blanket keep-together rules for long tables |
| [glebis / pdf-generation](https://github.com/glebis/claude-skills/blob/d0bc2063d00d9d1a76d9fde5cd098fd8c92a68bc/pdf-generation/SKILL.md) | 372; 2026-09-02 | Small command wrapper with paper-size/TOC intent | [Generator](https://github.com/glebis/claude-skills/blob/d0bc2063d00d9d1a76d9fde5cd098fd8c92a68bc/pdf-generation/scripts/generate_pdf.py) does not implement every advertised styling setting; confirm flags in executed path |
| [WeasyPrint](https://github.com/Kozea/WeasyPrint/blob/e4b8b45e409392197441bc449d110f323b0eeb66/docs/api_reference.rst) | 9,569; 2026-09-07; mature engine | Static HTML/CSS print, page rules, vector SVG, font embedding | Render JS charts first with a suitable browser; Korean line-breaking and PDF conformance need actual validation |
| [Paged.js](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/polyfill/previewer.js) | 1,495; HEAD 2026-03-20 | Await completed pagination before browser export, inspect page boundaries | Later repository push date is not newer default-branch code; do not install for simple browser print |
| [Vivliostyle CLI](https://github.com/vivliostyle/vivliostyle-cli/blob/0db54ab6005ad20987de5ed36a8d543f82665f36/README.md) | 233; 2026-09-07; mature publishing system | Book/press outputs, bleed/crop marks and PDF/EPUB distinction | Comparator only; AGPL integration is not part of this skill upgrade |
| [HTML-to-PDF Fidelity Benchmark](https://github.com/NicolasMartalog/html-to-pdf-benchmark/blob/1a290622403ffbecc2065d6e00b0e25bae34f59e/run.mjs) | 0; 2026-07-20; recent, not popular | Distinct semantic markers, page counts, size/timing and raster checks | Vendor-maintained; first-page Chromium similarity does not measure whole-document quality |
| [Noto CJK / Korean distributions](https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/README.md) | GitHub displayed 4.0k; HEAD 2024-09-19 | Explicit Korean font family and distributed weights | Verify selected font exists and is used; font redistributions require their notices |
| [Anthropic PDF skill license](https://github.com/anthropics/skills/blob/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/pdf/LICENSE.txt) | Public repository; inspected 2026-09-08 | License exception discovery | Excluded from adaptation/copying: inspected PDF-specific license is proprietary, unlike some neighboring skills |

Inspected licenses and source details:

- [gstack MIT](https://github.com/garrytan/gstack/blob/0530392821c277b95e5cd65aa9d9fda4248718b2/LICENSE),
  [orchestrator](https://github.com/garrytan/gstack/blob/0530392821c277b95e5cd65aa9d9fda4248718b2/make-pdf/src/orchestrator.ts),
  [renderer readiness](https://github.com/garrytan/gstack/blob/0530392821c277b95e5cd65aa9d9fda4248718b2/lib/aside-render.ts),
  [print CSS](https://github.com/garrytan/gstack/blob/0530392821c277b95e5cd65aa9d9fda4248718b2/make-pdf/src/print-css.ts).
- [Glebis MIT](https://github.com/glebis/claude-skills/blob/d0bc2063d00d9d1a76d9fde5cd098fd8c92a68bc/LICENSE).
- [WeasyPrint BSD-3-Clause](https://github.com/Kozea/WeasyPrint/blob/e4b8b45e409392197441bc449d110f323b0eeb66/LICENSE),
  [shared font configuration example](https://github.com/Kozea/WeasyPrint/blob/e4b8b45e409392197441bc449d110f323b0eeb66/docs/first_steps.rst#L406-L424).
- [Paged.js MIT](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/LICENSE.md).
- [Vivliostyle AGPL-3.0](https://github.com/vivliostyle/vivliostyle-cli/blob/0db54ab6005ad20987de5ed36a8d543f82665f36/LICENSE).
- [Benchmark MIT](https://github.com/NicolasMartalog/html-to-pdf-benchmark/blob/1a290622403ffbecc2065d6e00b0e25bae34f59e/LICENSE).
- [Noto Sans OFL-1.1](https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/LICENSE).

## How the synthesis fits together

The reader's question chooses the representation. Audience and document genre
choose the composition. A single set of tokens joins prose, tables and SVG.
Interaction changes a real model, then print captures its chosen state. Output
engines supply the mechanics; final semantic and visual checks establish delivery.
This is why the source list becomes a few focused references rather than sixteen
competing style guides loaded on every request.

The current host's `visualize` skill supplies inline behavior; none of these
repositories supplies Codex renderer compatibility. Production frontend and
format-specific document owners remain authoritative in their own domains.

## Extending or refreshing the skill

Inspect the actual source file and its license at a recorded revision before
copying anything. Repository visibility and a README badge are insufficient when
a subdirectory has its own license. For copied/substantially adapted MIT/BSD
material retain required notices; Apache copies also need applicable notices and
modification markings. Inspect font/artwork licenses separately. Record source,
revision, changed file and retained notice location beside the adaptation.

Prefer independently authored recipes when only the general idea is needed.
Do not paste a conflicting upstream mandate into this skill. Recheck live dates
before describing a source as current; inspect examples before claiming visual
quality. Dependencies, accounts and host integrations require actual availability
and task authorization, not just a link in this ledger.
