## Report evidence, language and analytical exhibits

For a report that answers research questions, use the existing model and
[research handoff](report-pipeline.md); source-only intake performs no
retrieval. Preserve unknown provenance and unanswered questions. For English or
bilingual output, use [English authoring](english-authoring.md), choose
source/output languages separately, and preserve values and qualifications. Choose
[exhibit recipes](exhibit-recipes.md) by question and evidence; a table
or prose is valid. These are report tools, not prerequisites for a simple HTML edit.

## Compose before styling

Start from the reader contract and document type in
[Reader documents](reader-documents.md), then run a compact design
read: **reader → question → information structure → visual encoding →
type/color/spacing → output constraints**. State the chosen direction
briefly when it helps the user evaluate an open brief. Reuse existing design tokens.

[Visual design](visual-design.md) supplies distinct optional directions
and composition recipes. Select a coherent set for this artifact. Borrow principles
from several references, then reconcile them: one type hierarchy, one spacing rhythm,
consistent semantic colors, a deliberate level of detail. A source's trend or star
count is not a design requirement.

Examples of structure that earns its form:

- Explain a mechanism with actions on connectors and a caption stating what changes.
- Compare alternatives on the same dimensions and scale, with a table for exact values.
- Pick the genre first: decision memo, research synthesis, explanation or history,
  how-to or reference. It selects the structure and the review questions
  (REPORT-STORY-00). Evidence goes in an appendix in every genre.
- Decision documents and explanations follow [Reader documents](reader-documents.md):
  answer first, headings that state findings. A research synthesis instead ends at what
  is unresolved, and a reference ends at the definitions — neither owes the reader an ask.
- A report over about four pages follows [Report writing](report-writing.md):
  write the storyline before any HTML, make every section heading carry that unit's
  content, give the summary a full page that stands alone, number and source every
  exhibit, hold one register, and name the issuing organization the way the reader knows
  it. Cover and contents pages are part of the document, not decoration.
- For a dense system, use overview plus focused detail rather than shrinking every label.

Keep document narrative in the document. Inline conversation visuals instead obey
the host's narrower composition contract; do not paste a whole report into a fragment.

## Brand gate (VIZ-BRAND-01, DEFAULT)

Before styling the first artifact in a project, look for an existing visual identity, in
this order:

1. `DESIGN.md` or `design.md` at the root (YAML tokens plus prose).
2. Brand or design tokens in the codebase (CSS custom properties, a Tailwind theme, a
   tokens JSON).
3. A brand the brief names.

If one exists, use its colors, type and radius and nothing else. If none exists, use this
skill's neutral defaults and say so once in the delivery note ("no brand tokens found;
neutral defaults used"). Do not ask again on later artifacts in the same task, and do not
invent a brand palette.

## House rules

These apply to every artifact unless the brief or the project's brand says otherwise. They
are owned by `dev-design`; this section restates what an artifact needs so the skill also
works standalone.

- **Color carries data, controls stay neutral.**
  - Interactive controls in an artifact (scenario buttons, toggles, print buttons) are ink
    or outlined neutrals.
  - The single accent marks the series, number or element that carries the claim; focus
    and prose links may use it too.
  - Rule: FE-COLOR-RESTRAINT-01 in `dev-design` (`references/build/color-system.md`) when that skill is installed.
- **No one-sided accent bars.**
  - Callouts, notes, scenarios and quotes take a full hairline border, an indent with a
    run-in bold lead, or nothing. Never a colored or thick left or top stripe.
  - Rule: FE-SIDE-ACCENT-01 in `dev-design` (`references/build/anti-slop.md`).
- **Diagram choice and labeling** follow [diagram types](diagram-types.md): one claim per
  figure, a verb on every edge, a mark for every number, about 9 nodes before splitting.
- **Korean headings and copy.**
  - Korean reader-facing headings follow the owner register in
    `dev-design`'s copy registers (`references/copy/copy-registers.md`).
  - Reports keep their own register rules in [report writing](report-writing.md), and a
    report's finding headings are full sentences.

## Build the smallest complete artifact

Use semantic, editable source. Keep text-bearing HTML in normal responsive Grid/Flex
flow; derive SVG connector endpoints from rendered bounds if needed
(**DIAGRAM-LAYOUT-01**). Paint connectors before labels they pass behind. A label
placed on a connector needs a paper-coloured halo with `paint-order: stroke`, or
it must move clear; a halo cannot cover a connector painted later. Standalone SVG
is a vector document: geometric coordinates are appropriate, but size/wrap labels
from actual text metrics and inspect the result.

[editorial-report.html](../assets/editorial-report.html) is an optional original,
dependency-free example for reports with a live scenario and print output. Adapt
its content and visual direction; it is not a mandatory template or a finished
report about the user's data. See the document reference for export readiness.
[paged-report.html](../assets/paged-report.html) is the A4 report skeleton set as a
publication (REPORT-DESIGN-01: hairlines and type, one accent, a data chart, no
cards or tinted boxes): cover, contents with page numbers, summary page, flowing
body with claim headings and numbered exhibits, appendix and notice, with a
house-style token block at the top. Its company and numbers are fictional.
`../scripts/export-paged-report.mjs <in.html> <out.pdf>` prints it with a local
Chromium, fills the contents page numbers in a second pass and reports layout
findings; `--qa-only <pdf>` audits a PDF from any engine.

Prefer native HTML/CSS/SVG and existing libraries. For library-dependent visuals,
verify actual versions and APIs, use authorized pinned assets, and distinguish
“one HTML file” from “works offline.” Do not execute retrieved HTML/JS or insert
untrusted strings as executable markup. Preserve dependency/font notices when copying.

The legacy `html-templates.md` and `../scripts/diagram-to-html.sh` remain
optional compatibility samples, **not the normal authoring route**. Their dark-theme,
CDN and environment defaults are not requirements. The shell helper wraps trusted
local content, is not a sanitizer or inline-fragment generator, and needs an explicit
authorized output path for durable delivery. Do not install it as a prerequisite.
