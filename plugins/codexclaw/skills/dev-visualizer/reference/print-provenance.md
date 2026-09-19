# Print provenance

Where the print and typography rules in this skill come from. These are summaries of
measurements taken during development; the raw session ledgers are not shipped, because
they carry scratch paths and tool-specific identifiers that mean nothing to a consumer
of the skill (issue #182).

Read these as dated observations, not as ongoing compatibility guarantees. A renderer
that behaved a certain way on one version may not on the next.

## Chromium probe {#chromium-probe}

**Measured 2026-09-09, headless Chromium 152.**

- `@page` margin boxes are honoured, and `counter(page)` / `counter(pages)` resolve.
- `string-set` and `target-counter()` are **not** supported.

The second point is the reason `export-paged-report.mjs` prints twice: a table of
contents cannot reference page numbers in CSS, so the script prints once, locates each
`[data-toc]` heading in the extracted text, writes the number into the matching
`[data-toc-for]` element, and prints again. A third extraction verifies the numbers still
hold.

Scope: this was measured on one engine at one version. Other engines were not tested, and
nothing here says a future Chromium keeps the same behaviour.

## CJK typography {#cjk-typography}

**Reviewed 2026-09-09 against Korean-language print output.**

- Line breaking and justification for CJK text differ enough from Latin defaults that
  the same CSS produces visibly different rag and spacing.
- Font fallback is the common failure: a missing glyph renders as a substituted or blank
  box that a text-extraction check does not notice, because the character is present in
  the text layer.

The practical consequence is in `document-pdf.md`: a font check that cannot run is
recorded as NOT RUN rather than passing, and a rendered-page review is required for
mixed-script documents rather than relying on extracted text.

Scope: observations from reviewing rendered output, not a systematic survey. The original
review notes carried tool-specific citation identifiers that are meaningless outside the
session that produced them; they are deliberately not reproduced here.

## Report-writing sources {#report-writing}

**Inspected 2026-09-09.** The structural conventions in `report-writing.md` were drawn
from published report and technical-writing guidance reviewed at that date, then reduced
to the rules that changed something about how a report is built here. The reduction is
the contribution; the reading list is not reproduced, because a list of titles is not
evidence that a rule is right.
