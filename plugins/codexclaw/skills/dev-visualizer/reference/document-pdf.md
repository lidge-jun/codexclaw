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

For a multi-page report, start from [paged-report.html](../assets/paged-report.html)
and export with `scripts/export-paged-report.mjs`; the rules below are what that
asset implements. Visual style stays adaptable; the furniture does not.

### REPORT-PRINT-01 Page furniture for a paged report (STRICT)

1. `@page { size: A4 portrait; margin: 20mm 18mm 22mm 18mm }` unless the recipient's
   standard is Letter. Declare it; do not inherit the renderer default.
2. Page numbers on every page except the cover, from one mechanism only. In
   Chromium use the `@page` margin box `@bottom-center { content: counter(page) " / "
   counter(pages) }` and `@page :first { @bottom-center { content: none } }`.
3. A running header on every body page: document title left, date or section
   right. Chromium ignores `string-set`, so the header text is static in the CSS
   (edit it with the title) or supplied by Paged.js/WeasyPrint.
4. Contents page with page numbers. Chromium ignores `target-counter()`; mark each
   target `<section id="s1" data-toc="heading text">` and each entry
   `<span data-toc-for="s1"></span>`, then let the export script fill them from
   the rendered PDF in a second pass and verify them in a third extraction.
5. Break control: `.sheet { break-before: page }` only for cover, contents,
   summary and real chapter starts; body sections flow. `h2, h3, figcaption,
   caption { break-after: avoid }`, `p, li { orphans: 3; widows: 3 }`, `figure,
   tr, .callout { break-inside: avoid }`, `thead { display: table-header-group }`.
   Short tables (under about eight rows) take `class="keep"` so they never split
   leaving one row on the next page; a heading, its lead paragraph and a short
   table that must stay together go inside one `<div class="keep">`. Never
   `break-inside: avoid` on a whole long table or section, and do not put
   `break-after: avoid` on paragraphs: Chrome 152 then splits the paragraph and
   ignores `widows` (measured 2026-09-09, a one-line fragment at a page top).
6. Exhibits numbered and sourced (REPORT-EXHIBIT-01 in report-writing.md); text
   inside SVG at the print legibility floor (REPORT-VIZ-01 in visual-design.md).

Measured engine support (2026-09-09, HeadlessChrome 152, `--print-to-pdf`):

| Feature | Chromium 152 | Paged.js | WeasyPrint |
|---|---|---|---|
| `@page size/margin`, `:first` | yes | yes | yes |
| Margin boxes with `counter(page)`/`counter(pages)` | yes | yes | yes |
| `string-set` / `string()` running headers | no (static text only) | yes | yes |
| `target-counter()` contents page numbers | no (two-pass script) | yes | yes |
| `break-*`, `orphans`, `widows` | yes | yes | yes |
| JavaScript charts before print | yes | yes | no |

Probe: `devlog/_plan/260909_visualizer_report_quality/evidence/chrome-paged-probe.md`.

The generic fragment below remains for single documents that are not reports:

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

### CJK print recipe (klreq / jlreq / clreq, Chromium print, 2026-09-09)

Findings with sources are in `devlog/_plan/260909_visualizer_loop_merge/evidence/aside-G_cjk_typography.md`.
What they settle for an A4 report rendered by Chromium:

- Korean: word-based breaking (`word-break: keep-all`) for body text per klreq's
  author choice; character breaking only in narrow columns. `line-break: strict`
  enforces the line-start prohibitions (closing brackets, 가운뎃점, 마침표·쉼표).
  Horizontal Korean uses ASCII `.` `,` `?` `!` and full-width 「」『』《》〈〉 with
  `·` (U+00B7) for enumeration, never for ranges (ranges take `~`). First-line
  indent of 1em is the klreq default; a report may use paragraph spacing instead,
  but not both. Body 9.5–10.5pt with line-height 1.6–1.8 is Korean print practice,
  not a klreq number. `hanging-punctuation` is unsupported in Chromium; do not fake
  it with negative margins.
- Japanese: character breaking (`word-break: normal`) with `line-break: strict`
  for 禁則処理 (JIS X 4051 sets); `word-break: auto-phrase` on headings (Chrome
  119+, needs `lang="ja"`); `text-indent: 1em`.
- Chinese: `line-break: strict` for 避头尾, `text-indent: 2em` (首行缩进), regional
  font per locale (SC/TC) so Han unification does not swap glyph shapes.
- All three: `text-autospace: normal` and `text-spacing-trim: normal` where the
  font ships `halt`/`chws`; `text-align: justify; text-justify: inter-word` is the
  klreq default for body, left alignment is acceptable for reports; never
  `line-break: anywhere` on body text.

```css
:lang(ko) { font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  word-break: keep-all; line-break: strict; overflow-wrap: break-word; line-height: 1.7; }
:lang(ja) { font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif;
  word-break: normal; line-break: strict; text-indent: 1em; }
:lang(ja) h1, :lang(ja) h2 { word-break: auto-phrase; }
:lang(zh) { font-family: "Noto Sans SC", "PingFang SC", sans-serif; line-break: strict; text-indent: 2em; }
pre, code, table { text-autospace: no-autospace; line-break: normal; }
```

Embedding-safe families (all SIL OFL 1.1, PDF embedding allowed): Pretendard,
Noto Sans/Serif KR·JP·SC·TC, Source Han Sans/Serif (본고딕/본명조), IBM Plex Sans KR,
Nanum Gothic/Myeongjo. KoPub (Dotum/Batang/World) is free for print and PDF but web
serving via `@font-face` needs the publisher's approval. Subset to WOFF2 per
language when embedding; verify `halt`/`chws` in the build before relying on
`text-spacing-trim`. The template's stacks name these families and fall back to
system faces; the skill does not vendor font files.

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

### REPORT-QA-01 Render check before delivery (STRICT for delivered reports)

Run `node scripts/export-paged-report.mjs <in.html> <out.pdf>` (or `--qa-only
<pdf>` for a PDF from another engine). It reports page size, contents page
numbers, missing page numbers, an orphan fragment at the top of a page, a heading
stranded at the bottom, and pages with 30% or more of the text area blank. A
`REVIEW` verdict is read, each finding fixed or justified in the evidence note.
Then render the pages (`pdftoppm -r 60 -png`) and look at every page for what
text extraction cannot see: figure text under 8.5pt, low-contrast labels, a figure
separated from its heading, a table header row that failed to repeat, missing
Hangul glyphs, and a summary page that is mostly white. Yesterday's failure mode
was a PDF whose CSS looked right while page 5 opened with "구간입니다." alone and
three pages were half empty; the script and the page images are how that is caught.

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
