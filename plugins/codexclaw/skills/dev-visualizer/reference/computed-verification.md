# Computed and exported artifact verification

**DIAGRAM-RENDER-VERIFY-01 — for the computed and exported tiers, and for any
artifact you have reason to doubt:** render the final artifact, read the
screenshot/page, fix clipping, collisions, empty charts and runtime errors. Inspect
the longest labels at narrow and wide widths appropriate to the artifact; for
responsive HTML include 320/736px and the intended desktop size. SVG text must remain
legible at its intended display/export sizes, not merely within a valid viewBox.

The paged-report exporter may run a bounded `--dump-dom` SVG crossing diagnostic
on the final filled HTML. It is supplementary P2 review evidence: a crossing is
a review finding, while a timeout, malformed result, or sampling cap is recorded
in `report.notes` and does not change the PDF verdict; the PDF page remains the
authority for print inspection.

For interaction, change the primary input and observe the resulting marks/values;
exercise keyboard access and reset when provided. A static screenshot is not
interaction proof. For PDF, inspect the **actual exported pages**, including
multipage tables, final content, Korean glyphs and selected scenario state.
Print CSS or a PDF filename alone proves nothing. For a delivered PDF/print/paged report, run the
export script's QA (REPORT-QA-01) and the fresh-reader check on the rendered pages
(REPORT-FRESH-01); an orphan line at the top of a page, a heading stranded at the
bottom, a half-empty page or a figure whose text prints under 8.5pt is a defect.

How much of that verification a PDF/print/paged report owes is a **choice stated up front**, not a
fixed tax. Reading every rendered page is expensive, and a draft does not earn it.
Pick a receipt profile — `draft`, `standard` or `publication` — per
[report pipeline](report-pipeline.md) REPORT-ASSURANCE-01, and report the
verdict with the profile and the checks it omitted. A lighter profile is honest; a
draft presented as a verified publication is not.

**DIAGRAM-SYNTAX-01:** use an existing supported parser/checker where available.
XML validation can catch malformed SVG; it cannot catch overlapped labels. Do not
invent a Mermaid CLI parse command or install a runner just for incidental proof.

**DIAGRAM-A11Y-01:** provide names/descriptions, meaningful heading order, data/text
alternatives, visible keyboard focus, non-color meaning, readable contrast and
reduced motion where applicable. These are composition decisions and apply to the
smallest inline visual. The separate inspection pass — reading actual contrast and
reading order in the rendered result — belongs to the tiers that already render;
adding ARIA does not establish accessibility conformance either way.
