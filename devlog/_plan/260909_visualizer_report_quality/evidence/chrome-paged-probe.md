# Chrome paged-media probe (2026-09-09)

Renderer: HeadlessChrome 152 via `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf`.
Probe file: a 5-page A4 HTML with cover, contents, two chapters (source in this session, /tmp/na-audit/probe/p.html).

| Feature | Result | Evidence |
|---|---|---|
| `@page { size: A4; margin }` | honoured | `pdfinfo`: Page size 594.96 x 841.92 pts (A4) |
| `@page @bottom-center { content: counter(page) " / " counter(pages) }` | honoured | `pdftotext` page 2 bottom line `2/5`, page 3 `3/5` |
| `@page :first { @bottom-center { content: none } }` | honoured | page 1 has no page number |
| `h1 { string-set: doctitle content() }` + `@top-left { content: string(doctitle) }` | ignored | no running title on pages 2–3; a static `content: "..."` string does print |
| `.toc a::after { content: leader(".") target-counter(attr(href url), page) }` | ignored | contents entries print without page numbers |
| `orphans/widows: 3`, `break-after: avoid` on h2 | honoured | no orphan lines in the probe |

Consequence for the skill: page numbers and cover suppression are pure CSS; running header text is static per document; contents page numbers come from `scripts/export-paged-report.mjs` (print, locate each `[data-toc]` heading with `pdftotext`, write into `[data-toc-for]`, print again, verify).

