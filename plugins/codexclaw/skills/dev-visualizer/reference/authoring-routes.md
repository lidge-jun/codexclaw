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
| In-conversation comparison, simulation or explainer | Current host's exposed `visualize` skill, if available | Its current full SKILL.md; [delivery](environment-detection.md) |
| Small static structure expressible as labeled nodes/edges | Mermaid if host supports it; otherwise a suitable artifact | [SVG and interaction](svg-and-interaction.md) only for custom output |
| Editable SVG diagram or infographic | Native SVG with legible geometry and text | [Visual design](visual-design.md), [SVG and interaction](svg-and-interaction.md) |
| HTML report, technical brief, visual review or document | Semantic HTML with purposeful figures and readable sections | [Reader documents](reader-documents.md), [Visual design](visual-design.md), [documents/PDF](document-pdf.md) |
| Multi-page report for a decision maker (client report, research report, proposal, 보고서) | [Report writing](report-writing.md) storyline first, then [paged-report.html](../assets/paged-report.html) exported with `../scripts/export-paged-report.mjs` | [Report writing](report-writing.md), [Documents/PDF](document-pdf.md) REPORT-PRINT-01/QA-01 and the CJK recipe, [Visual design](visual-design.md) REPORT-DESIGN-01/VIZ-01 |
| Interactive HTML model | One useful visual plus requested inputs that change it | [SVG and interaction](svg-and-interaction.md), design reference if styling is open |
| PDF, print report or handout | Choose an available print/PDF engine; actually export | [Reader documents](reader-documents.md), [Documents/PDF](document-pdf.md); current PDF skill if available |
| Word/Google Docs, Slides/PPTX or spreadsheet | Available format-specific owner; use this skill for visual composition | [Documents/PDF](document-pdf.md) for boundaries |
| Scientific figure intended for export/publication | Standard plotting tools and vector/raster artifact | Design/label principles here; scientific tool's own workflow |
| Website, app page or existing component change | Frontend owner and project conventions; Sites if required by the project | This skill only for embedded explanatory artifacts |

No tool or companion skill is assumed installed. Inspect available capabilities;
if a required exporter is absent, deliver the useful editable source and identify
the missing requested output. Never call print-ready HTML a generated PDF.

