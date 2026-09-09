# Document authoring and PDF delivery

Use this reference for reports, proposals and other flowing documents.
Choose the requested medium before choosing the renderer. A PDF is a fixed
snapshot; an HTML tool and an editable Word document have different contracts.

## Preserve the source contract

- Inspect supplied documents, all relevant tabs/pages, templates and examples.
- Inventory headings, tables, footnotes, captions, citations and required fields.
- Preserve their meaning, order, relationships and native editing affordances.
- Keep supplied text and data separate from assumptions or illustrative examples.
- State units, reporting period, rounding and source provenance near the data.
- Use real headings, lists, table cells and links, not screenshots of paragraphs.
- Retain the editable source alongside an export when the user needs revisions.
- Do not flatten forms, signatures, spreadsheets or slide objects implicitly.
- For AcroForms, verify canonical field values as well as visible appearances.
- For native Docs/Word/Sheets/Slides, use the available format-specific owner.
  Preserve document tabs, formulas, notes and template constraints as applicable.
- HTML-to-DOCX conversion is not a promise of identical pagination or native charts.
- A PDF preview never substitutes for an explicitly requested editable deliverable.

## Select a route from observed capabilities

| Requested result | Suitable route | Boundary to explain |
| --- | --- | --- |
| Interactive report | Semantic HTML, CSS, inline SVG and small local JS | PDF cannot retain controls |
| HTML plus PDF | Existing browser print/export API | Freeze and verify current state |
| Static paged report | Available WeasyPrint with HTML/CSS | Does not execute JavaScript |
| Book or press layout | Available Paged.js/Vivliostyle or publishing tool | Verify CSS support and license |
| Editable Word/Slides | Available native/document owner | Preserve native structure first |
| Fixed drawing/form | Available PDF authoring/form tool | Verify text, fields and geometry |

Probe existing executables/modules before promising a route. Do not install,
reconfigure a browser, or launch a service outside the user's authorized scope.
Read the current exporter API; browser bindings differ in options and units.
A browser screenshot, successful open command or HTML file is not a PDF export.

## Build the reading order

Structure follows [Reader documents](../../dev/references/reader-documents.md);
the rest of this section is print-specific.

Use a bounded text measure and a clear heading scale; avoid a cover that pushes
all useful information off the first page. Label chart axes and disclose units.
Keep a chart's source data in a table or equivalent readable text.
Long tables belong in normal flow and may occupy as many pages as needed.
Use explicit chapter breaks only at real reading boundaries, not every section.

## HTML print baseline

This is an adaptable fragment, not a compulsory visual style:

```css
@page { size: A4; margin: 18mm 16mm 20mm; }
@media print {
  .screen-controls { display: none !important; }
  html, body, main { width: auto; max-width: none; margin: 0; }
  body { background: white; color: #16191e; font-size: 11pt; }
  .table-scroll { overflow: visible; max-height: none; }
  table { width: 100%; table-layout: fixed; break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; } /* a final total, not repeated */
  tr { break-inside: avoid; }
  th, td { overflow-wrap: anywhere; }
  h2, h3 { break-after: avoid; }
  p { widows: 3; orphans: 3; }
  figure { break-inside: avoid; }
  img, svg { max-width: 100%; height: auto; }
  .chapter { break-before: page; }
}
```

Use `<caption>`, `<thead>`, `<tbody>` and `<th scope="col|row">` correctly.
Never apply `break-inside: avoid` to an entire long table or containing section.
For a row taller than a page, allow that row to fragment or redesign its content
into smaller semantic records; do not shrink the whole document to fit one page.
Remove screen-only fixed heights, sticky positioning and overflow clipping.
Repeating headers must be observed in the resulting PDF, not inferred from CSS.
Keep footnotes and sources printable. Do not blanket-hide every footer or aside.
Use only one page-number mechanism, with enough reserved margin for its text.
Margin boxes, named pages and running headers differ across rendering engines.

## Fonts and Korean text

Choose a Korean-capable family deliberately, including the required weights.
A useful local fallback order is Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic,
then sans-serif. Availability differs by machine; the family list embeds nothing.
For reproducible delivery, bundle licensed font files or embed them in the HTML.
Retain font notices and verify embedding/redistribution terms for the exact files.
Do not copy a font from a commercial product merely because the browser loads it.
Use `lang="ko"`, natural phrase boundaries and comfortable line-height.
Browser `word-break: keep-all` plus `overflow-wrap` can help long Korean labels;
verify the renderer's support instead of assuming the same result in WeasyPrint.
Its inspected CSS reference explicitly excludes `line-break` support.
Test Hangul, Hanja where relevant, Latin, currency and composed/decomposed text.
A glyph may extract correctly while displaying as a missing-glyph box.

## Readiness and current-state export

1. Wait for `document.fonts.ready`; check required fonts actually loaded.
2. Await image decoding and the chart library's explicit render completion.
3. Disable animation for export and finish any asynchronous pagination pass.
4. Commit the selected values into visible text and SVG/canvas output.
5. Record parameter names, values and units in a printable summary.
6. Export using print media with deliberate size, margins and background options.
7. Reopen the written PDF and compare it to the selected nondefault state.

`networkidle`, a sleep, or a font-ready promise alone does not prove chart readiness.
Fail with the missing readiness condition when a bounded wait expires.
Do not silently print defaults after a pagination timeout.
Use a print event only for synchronous state synchronization; precompute any
asynchronous work before invoking print. Avoid resetting state in `beforeprint`.
For browser Save as PDF, explain that the user must finish the system print dialog;
calling `window.print()` alone does not create or verify a file.

## WeasyPrint and other no-JavaScript paths

WeasyPrint lays out HTML/CSS without running scripts. Supply complete static HTML,
SVG and tables; pre-render JavaScript charts and resolve interaction values first.
Do not send an empty chart container and assume its script will execute.
If capturing a browser DOM, serialize current text/attributes and replace canvases
with image assets; canvas pixels and input properties do not survive plain HTML
serialization automatically. Remove controls/scripts from the static export.
Resolve relative asset paths against a deliberate base directory.
When using `@font-face` in its Python API, share a `FontConfiguration` between CSS
and `HTML.write_pdf`; check current documentation for the installed version.
Prefer SVG for chart lines and labels when the renderer supports the features used.
PDF/A, PDF/UA or tagged-output options require independent conformance validation.

## Output QA and evidence

- Check file existence, nonzero size, parsability, page count and page dimensions.
- Extract text; reconcile all records, totals, final-row marker and selected inputs.
- Render every PDF page to images with an available tool such as `pdftoppm`.
- Inspect those images for missing glyphs, truncation, overlap and unintended blanks.
- Check the ending too: a nearly empty page containing only a short source note
  may need local spacing or page-break adjustment. Keep the source note and
  readable type; do not drop records or shrink the whole report to reduce pages.
- Name the pages containing table continuations and verify repeated column headers.
- Inspect links, bookmarks, forms and accessible reading order when required.
- Compare charts with their underlying values; color must not carry meaning alone.
- Exercise keyboard changes and reset; test narrow/tablet/desktop HTML separately.
- Test offline with requests blocked when offline operation is promised.
- Record renderer/version, input state, commands, outcomes and artifact paths.

If export is unavailable, deliver the authorized editable source and precise manual
export steps, labeled PDF NOT GENERATED. If rasterization or extraction is absent,
state that specific check as NOT RUN; a successful export is not visual QA.
Do not install tools automatically or present an unperformed check as passing.

## Original runnable example

Open [editorial-report.html](../assets/editorial-report.html) directly in a browser.
It contains 72 static illustrative records, a cost scenario, accessible SVG and
print rules. Defaults remain readable without JS; interaction needs JS.
When replacing its data, regenerate the static totals, chart baseline and model
constants from the same input. Editing table rows alone leaves stale example
numbers elsewhere. Reconcile initial and nondefault states with the new rows.
Change the cost increase, then print: the visible scenario is the export source.
Fonts use local Korean fallbacks; deterministic cross-machine typography needs
licensed embedded fonts. This is an optional layout, not a universal house style.

## Source provenance

Original guidance synthesized from source inspection on 2026-09-08; no upstream
skill text, implementation or assets copied. See the main-owned source ledger.
Relevant primary locators: [WeasyPrint fonts and CSS](https://github.com/Kozea/WeasyPrint/blob/e4b8b45e409392197441bc449d110f323b0eeb66/docs/api_reference.rst),
[Paged.js preview lifecycle](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/polyfill/previewer.js),
[Gstack export orchestration](https://github.com/garrytan/gstack/blob/0530392821c277b95e5cd65aa9d9fda4248718b2/make-pdf/src/orchestrator.ts),
and [Noto font license](https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/LICENSE).
