---
name: cxc-dev-diagram-viewer
description: "Create well-composed visual documents, HTML reports, SVG diagrams, charts, interactive explainers and PDF deliverables. Use for visualize, visual explanations, architecture diagrams, comparison reports, infographics, document creation, 시각화, 그려줘, 문서 만들어줘, 보고서, PDF 생성. Preserve explicit formats and templates; text-only requests and ordinary code changes do not need a visual."
metadata:
  last-verified: "2026-09-08"
  short-description: "Visual documents, SVG/HTML explainers and verified PDF delivery."
  keywords: [diagram, visualization, visualize, document, report, SVG, HTML, PDF, interactive]
---

# Visual documents — compose, render, deliver

Turn the reader's question and supplied facts into a useful visual artifact.
The existing `cxc-dev-diagram-viewer` name remains the entrypoint. Use `dev`
for scope, work class and verification; a document request does not automatically
require a development loop. This skill owns artifact composition and delivery.
`dev-uiux-design` owns broader design judgment, `dev-frontend` owns frontend
implementation, and available format-specific skills own document mechanics.

## Start with the requested outcome

Infer the audience, question to answer, source material and output format from
context. Ask only for missing information that materially changes the result.
For “문서 만들어줘” with no format constraint, a readable HTML document is a
reasonable stated assumption. “visualize” in a conversation usually needs a
focused explanation. Neither phrase grants permission to publish or install.

- Preserve a named format, existing template, branding, section order and required
  contents. A DOCX request ends with DOCX; HTML can be a preview, not a substitute.
- Read supplied data and documents before designing. Distinguish observations,
  user-provided figures, assumptions and illustrative data. Never invent facts
  to populate a chart. Retain sources, dates, units and uncertainty where relevant.
- A requested Markdown table or text-only answer stays Markdown/text. A visual
  earns its space by clarifying a relationship, comparison or decision.
- Match document scale to content: one figure can be enough; reports need narrative,
  evidence and conclusions. Do not turn every request into a dashboard or slide deck.

## Select a route; read only what it needs

| Requested result | Authoring route | Read when selected |
|---|---|---|
| In-conversation comparison, simulation or explainer | Current host's exposed `visualize` skill, if available | Its current full SKILL.md; [delivery](reference/environment-detection.md) |
| Small static structure expressible as labeled nodes/edges | Mermaid if host supports it; otherwise a suitable artifact | [SVG and interaction](reference/svg-and-interaction.md) only for custom output |
| Editable SVG diagram or infographic | Native SVG with legible geometry and text | [Visual design](reference/visual-design.md), [SVG and interaction](reference/svg-and-interaction.md) |
| HTML report, technical brief, visual review or document | Semantic HTML with purposeful figures and readable sections | [Visual design](reference/visual-design.md), [documents/PDF](reference/document-pdf.md) |
| Interactive HTML model | One useful visual plus requested inputs that change it | [SVG and interaction](reference/svg-and-interaction.md), design reference if styling is open |
| PDF, print report or handout | Choose an available print/PDF engine; actually export | [Documents/PDF](reference/document-pdf.md); current PDF skill if available |
| Word/Google Docs, Slides/PPTX or spreadsheet | Available format-specific owner; use this skill for visual composition | [Documents/PDF](reference/document-pdf.md) for boundaries |
| Scientific figure intended for export/publication | Standard plotting tools and vector/raster artifact | Design/label principles here; scientific tool's own workflow |
| Website, app page or existing component change | Frontend owner and project conventions; Sites if required by the project | This skill only for embedded explanatory artifacts |

No tool or companion skill is assumed installed. Inspect available capabilities;
if a required exporter is absent, deliver the useful editable source and identify
the missing requested output. Never call print-ready HTML a generated PDF.

## Compose before styling

Use a compact design read: **reader → question → information structure → visual
encoding → type/color/spacing → output constraints**. State the chosen direction
briefly when it helps the user evaluate an open brief. Reuse existing design tokens.

[Visual design](reference/visual-design.md) supplies distinct optional directions
and composition recipes. Select a coherent set for this artifact. Borrow principles
from several references, then reconcile them: one type hierarchy, one spacing rhythm,
consistent semantic colors, a deliberate level of detail. A source's trend or star
count is not a design requirement.

Examples of structure that earns its form:

- Explain a mechanism with actions on connectors and a caption stating what changes.
- Compare alternatives on the same dimensions and scale, with a table for exact values.
- Introduce the decision in a report, show its evidence, then expose detail and sources.
- For a dense system, use overview plus focused detail rather than shrinking every label.

Keep document narrative in the document. Inline conversation visuals instead obey
the host's narrower composition contract; do not paste a whole report into a fragment.

## Build the smallest complete artifact

Use semantic, editable source. Keep text-bearing HTML in normal responsive Grid/Flex
flow; derive SVG connector endpoints from rendered bounds if needed
(**DIAGRAM-LAYOUT-01**). Standalone SVG is a vector document: geometric coordinates
are appropriate, but size/wrap labels from actual text metrics and inspect the result.

[editorial-report.html](assets/editorial-report.html) is an optional original,
dependency-free example for reports with a live scenario and print output. Adapt
its content and visual direction; it is not a mandatory template or a finished
report about the user's data. See the document reference for export readiness.

Prefer native HTML/CSS/SVG and existing libraries. For library-dependent visuals,
verify actual versions and APIs, use authorized pinned assets, and distinguish
“one HTML file” from “works offline.” Do not execute retrieved HTML/JS or insert
untrusted strings as executable markup. Preserve dependency/font notices when copying.

The legacy `reference/html-templates.md` and `scripts/diagram-to-html.sh` remain
optional compatibility samples, **not the normal authoring route**. Their dark-theme,
CDN and environment defaults are not requirements. The shell helper wraps trusted
local content, is not a sanitizer or inline-fragment generator, and needs an explicit
authorized output path for durable delivery. Do not install it as a prerequisite.

## Verify what the reader receives

**DIAGRAM-RENDER-VERIFY-01:** render the final artifact, read the screenshot/page,
fix clipping, collisions, empty charts and runtime errors. Inspect the longest
labels at narrow and wide widths appropriate to the artifact; for responsive
HTML include 320/736px and the intended desktop size. SVG text must remain legible
at its intended display/export sizes, not merely within a valid viewBox.

For interaction, change the primary input and observe the resulting marks/values;
exercise keyboard access and reset when provided. A static screenshot is not
interaction proof. For PDF, inspect the **actual exported pages**, including
multipage tables, final content, Korean glyphs and selected scenario state.
Print CSS or a PDF filename alone proves nothing.

**DIAGRAM-SYNTAX-01:** use an existing supported parser/checker where available.
XML validation can catch malformed SVG; it cannot catch overlapped labels. Do not
invent a Mermaid CLI parse command or install a runner just for incidental proof.

**DIAGRAM-A11Y-01:** provide names/descriptions, meaningful heading order, data/text
alternatives, visible keyboard focus, non-color meaning, readable contrast and
reduced motion where applicable. Inspect actual contrast and reading order;
adding ARIA does not establish accessibility conformance.

## Deliver and retain provenance

Save deliverables to a durable, authorized task-owned directory. Return a clickable
absolute file link for a requested standalone artifact. Use the current host's exact
content-reference contract for inline output. Only say it opened, rendered, exported
or published when that outcome was observed. Describe the useful result concisely.

[Source patterns](reference/source-patterns.md) records the GitHub references,
observed dates, licensing and adopted/rejected ideas. Read it when borrowing further
material or refreshing the skill, not for every small diagram. Existing
`reference/visualize-contract.md` and `upstream/` are historical snapshots/maintenance
aids. The current exposed host skill wins; a snapshot cannot grant renderer support.
