---
name: cxc-dev-visualizer
description: "Use for visual explanations and documents. Triggers: diagrams, charts, interactive models, HTML reports, infographics, 시각화, 그려줘, 문서 만들어줘, 보고서, PDF 생성."
metadata:
  last-verified: "2026-09-20"
  short-description: "Visual documents, SVG/HTML explainers and PDF delivery, verified in proportion."
  keywords: [diagram, visualization, visualize, document, report, SVG, HTML, PDF, interactive, cover, contents, storyline]
---

# Visual documents — compose, render, deliver

Turn the reader's question and supplied facts into a useful visual artifact.
Use `dev`
for scope, work class and verification; a document request does not automatically
require a development loop. This skill owns artifact composition and delivery.
`dev-uiux-design` owns broader design judgment, `dev-frontend` owns frontend
implementation, and available format-specific skills own document mechanics.

## Select a route; read only what it needs

| Condition | Reference |
|---|---|
| Every artifact: caller scope and requested outcome | [Scope](reference/scope-and-maintenance.md), [authoring routes](reference/authoring-routes.md) |
| Choosing HTML, SVG, inline output, PDF, document format or scientific plotting | [Authoring routes](reference/authoring-routes.md) |
| Before composing/styling/building any visual | [Artifact composition](reference/artifact-composition.md) |
| Human-readable reports and documents | [Reader documents](reference/reader-documents.md), [report writing](reference/report-writing.md) |
| Research reports, analytical exhibits or English/bilingual output | [Research/language/exhibit routes](reference/artifact-composition.md#report-evidence-language-and-analytical-exhibits) |
| Computed/exported tiers, or any artifact in doubt | [Computed verification](reference/computed-verification.md) |
| PDF/print/paged report assurance profile | [Report pipeline](reference/report-pipeline.md) |
| Delivery, borrowing sources or refreshing the skill | [Delivery and provenance](reference/delivery-and-provenance.md) |

## Verify in proportion to what can break

**VIZ-VERIFY-SCALE-01 — the proof matches the failure it would catch.** Rendering an
artifact and reading the result costs a round trip, and much of what this skill
produces cannot fail out of sight: the reader sees an inline visual before a
screenshot could reach you, and a static page in normal flow shows its own text.
Spend the round trip where the visible result is computed rather than written.

| Delivering | Before delivery |
|---|---|
| An inline visual in this conversation, or a fenced diagram the host renders | Reread the source once and send it. The reader's screen is the render. |
| A small static HTML/SVG page in ordinary flow — prose, tables, hand-placed shapes, no runtime data, no library, no export | Reread the source, save it, return the link. |
| Anything whose visible result is computed — marks drawn from data, connector geometry derived from rendered bounds, a runtime library or webfont, an input that changes the output | DIAGRAM-RENDER-VERIFY-01 in full. |
| PDF, print output, or a multi-page paged report | DIAGRAM-RENDER-VERIFY-01 with a stated assurance profile. Merely saving or sharing a simple static HTML/SVG file does not promote it to this tier. |

Two rules hold in every tier. An unrun check is never written up as a passed one:
"not rendered — static HTML in normal flow" is honest, "verified" is not. And a
defect promotes the artifact: once the reader reports something wrong, or a first
render shows it, render each further fix before sending it. Nothing here is enforced
by a hook, and the calling task's own verification gate still governs its work.
