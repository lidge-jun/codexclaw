# Visual design for explanatory documents

Use this reference to choose composition and visual language before authoring.
These are agent instructions, not runtime enforcement or a mandatory template.
Preserve the requested format, supplied template, brand and content coverage.
Use [SVG and interaction](svg-and-interaction.md) for geometry and behavior.

## Establish the reading task

State the audience, the question the artifact answers, and its intended size.
Distinguish a document read once from a reference searched repeatedly.
Choose a useful first viewport: conclusion, decisive comparison or mechanism.
Keep assumptions and source dates visible near the claims they qualify.
Do not infer a slide deck, theme picker or interactive application from “visual.”

Example brief: “For engineering leads deciding capacity, compare observed demand
with modeled headroom; show units, assumptions and a changeable demand input.”
That suggests a comparison plus a local model, not a decorative architecture map.

## Select a representation

| Reader needs to… | Start with… | Preserve… |
|---|---|---|
| Compare exact values | Semantic table or aligned dot plot | Units, common scale and full labels |
| Understand change over time | Line chart with dated observations | Missing intervals and forecast boundary |
| Understand a mechanism | Annotated flow or sequence | Direction, action verbs and branching conditions |
| Find responsibility | Lanes or grouped hierarchy | Ownership and cross-boundary handoffs |
| Explore sensitivity | Input, computed result and comparison | Formula, range and baseline |
| Read an argument | Prose with supporting figures | Qualifications, evidence and counterexamples |

Give each figure one intended takeaway; write its caption before drawing it.
“Retries amplify load after timeouts” determines edges better than “System diagram.”
If labels explain everything while geometry explains nothing, revise the encoding.
For dense systems, pair a small overview with named detail sections and cross-links.
Do not require a diagram in every section or reduce nuanced evidence to captions.

## Compose a document, not a collection of panels

Group by the reader's question; use headings that identify the answer or subject.
Reserve the strongest size/contrast for the main result, then its supporting proof.
Use proximity and alignment before adding borders, backgrounds or containers.
Cards suit independently actionable items; aligned rows suit repeated comparisons.
Use numbering for order, stages or stable references, not decorative credibility.
Keep related charts adjacent with matched axes; stack them with the same order on mobile.
Separate evidence from interpretation with captions or labels, not unexplained color.
Place definitions near first use; put optional derivations in clearly named disclosure.
Long tables remain complete: split or paginate appropriately rather than dropping rows.

## Four optional art directions

### REPORT-DESIGN-01 A report is set like a publication, not a dashboard (STRICT for delivered reports)

The parts an agent reaches for by reflex are exactly what makes a page read as
machine-made. For a printed or PDF report these are not used:

| Reflex part | What a reader sees | Use instead |
|---|---|---|
| Row of big-number "stat cards" | a SaaS landing page | a small key-figures table: 지표 · 기준 · 현재 · 변화, or the number inside the sentence |
| Callout box with a colored left border, tinted rounded panel | a chatbot answer | an indented paragraph with a run-in bold heading and a hairline |
| Numbered circles, icon bullets, badge chips | a slide template | plain numbered list or prose |
| Box-and-arrow SVG as the default figure | a diagram of nothing | a chart with data (bar, line, dot), directly labeled, or no figure |
| Uppercase tracked eyebrow, decorative colored rule bar, gradient | a startup deck | the issuer name in small text and a 0.6pt rule |
| Every section with the same rhythm (heading → lead → table → source) | a generator | vary the page: one exhibit per page carries the argument, some sections are prose only |
| System default sans for everything | no identity | one heading face (a Korean serif such as Noto Serif KR / KoPubWorld Batang) and one body face (Pretendard / Apple SD Gothic Neo / Noto Sans KR), decided before writing |

What remains: hairlines (0.3–0.8pt) and white space to separate, type size and
weight to rank, one accent color used only for the series that carries the claim
and for the ask, tables with top and bottom rules and no fills, a narrow text
measure (about 36 Korean characters) with full-width exhibits. Decide the face
pair, the accent and the rule weights before writing (pair with
`dev-uiux-design` when the brief is open) and use nothing else. Real
McKinsey/MGI, Bain and Korean securities PDFs inspected 2026-09-09 all follow this
grammar; `assets/paged-report.html` implements it. Brand assets (logo, palette,
licensed type) replace the token block; they are not invented.

Choose one only when it fits the audience. These recipes illustrate decisions;
their colors, proportions and typefaces are replaceable, not universal bans.

### Technical review sheet — maintainers comparing mechanisms

- Surface `#f4f7fa`, ink `#152b3a`, accent `#176b83`; give state colors separate roles.
- Use a restrained sans heading/body stack; mono only for paths, identifiers and values.
- Compose a compact conclusion above a large mechanism figure and aligned evidence rows.
- Use lane headers and fine rules to expose boundaries; omit display-sized marketing text.
- Good for architecture and change reviews; excessive chrome would compete with topology.

### Editorial argument — policy or strategy readers

- Surface `#fffdf9`, ink `#242320`, accent `#315c9b`; keep charts' semantic palette distinct.
- Pair a serif display face with a readable sans body; verify the required language coverage.
- Use an asymmetric opening, a narrow reading column and occasional full-width comparisons.
- Use pull quotes only for meaningful source quotations with attribution; no invented testimony.
- Good for a sustained argument; switch to denser aligned rows for audit evidence.

### Operational reference — repeated expert lookup

- Surface `#151c21`, ink `#edf2f5`, accent `#e9b85c`; provide deliberate paper-safe colors.
- Use compact sans headings, aligned numeric columns and stable positions for labels/units.
- Put a status summary above indexed sections; let the reader reach raw values quickly.
- Use shape and text as well as status color; animate only a change that needs attention.
- Good for live or frequently revisited evidence; a dark palette alone does not imply freshness.

### Teaching notebook — learners testing a causal model

- Surface `#f8faf4`, ink `#243329`, accent `#35634d`; highlight one changing variable at a time.
- Use generous body leading, short headings and a stable baseline beside the experiment.
- Sequence question, prediction, control and observed/model output; expose assumptions nearby.
- Use direct annotations and a visible reset; avoid scroll animation that hides causal steps.
- Good for guided understanding; keep an equivalent static explanation available for print.

## Type and CJK hierarchy

Set type by role: title, section heading, body, caption, data and code.
For ordinary screen documents, start around 16–18px body and 1.5–1.75 leading;
adjust after inspecting the actual face, density and intended viewing distance.
Use rem for document text so one root setting scales it coherently.
Start Latin prose around 60–70ch; `ch` measures the zero glyph, not CJK characters.
For Korean, Chinese and Japanese, judge the actual column and glyphs at rendered width.
Use language-appropriate fallbacks and real weights; Latin-only fonts cannot establish CJK quality.
Avoid applying Latin uppercase/tracking treatments to whole Korean or Japanese headings.
Use size, weight, spacing and position to distinguish CJK headings from body text.

```css
.reading { max-inline-size: 65ch; line-height: 1.65; }
.reading:lang(ko) { max-inline-size: 36em; word-break: keep-all; }
.reading p { overflow-wrap: anywhere; }
.reading h1, .reading h2 { text-wrap: balance; }
.reading code, .reading a { overflow-wrap: anywhere; }
.numeric { font-variant-numeric: tabular-nums; }
```

This is a starting point, not proof of correct wrapping. Set the document's `lang`.
Keep Korean phrase boundaries where possible; allow emergency wrapping of long tokens.
Do not apply Korean `keep-all` indiscriminately to Chinese/Japanese line breaking.
Inspect mixed Hangul/Latin identifiers, punctuation, units and fallback glyphs.
Fix stranded endings such as “합니다.” by adjusting measure or phrasing without changing meaning.
Do not insert viewport-specific hard breaks or ellipsize evidence to make a heading fit.
Check font-loaded and fallback states; do not assume matching font names mean identical metrics.

## Truthful charts and evidence

### REPORT-VIZ-01 Print legibility floor for figures (STRICT for PDF delivery)

A figure is scaled to the text column when printed, so size type by its printed
result, not by its on-screen viewBox. With a 174mm column and `viewBox` width 720,
1 SVG unit prints at about 0.69pt: labels need `font-size` 13 or more to print at
9pt, and body-role text 15 or more. Check the scale factor for the viewBox you use
and keep printed text at 8.5pt or larger, in ink no lighter than the document's
secondary text color (contrast 4.5:1 or better); light gray (`#8894a0`) labels do
not survive print. A figure that restates a table on the same page is removed.
Verify on the rendered page image, not in the browser at 100%.

- State source, observation period, units, denominator and relevant aggregation/filter.
- Mark illustrative data and modeled/forecast values explicitly; do not imply measurements.
- Use zero baselines for bars encoding magnitude; disclose justified truncation on other axes.
- Use comparable axes across comparisons; disclose log scales and avoid decorative 3D distortion.
- Encode area by area, not radius; prefer position/length when precise comparison matters.
- Keep missing data distinct from zero; show uncertainty when the source provides it.
- Do not connect missing observations or extrapolate without labeling the inference.
- Calculate totals from unrounded data; explain rounding differences rather than altering rows.
- Use labels, patterns or shapes alongside color; supply an accessible table for exact values.
- In filtered views, identify both selected and total populations so the denominator stays clear.

## Review and provenance

Inspect the first viewport, longest text and dense comparisons at 320, 360, 736
and 1280 CSS pixels, plus the requested output size. Resize between presets.
Check zoom, contrast, reading order and that decorative emphasis does not outrank evidence.
This review is an authoring obligation; a source scan alone cannot establish visual success.

Original synthesis of mechanism/composition guidance and audience-first selection:
[visual-explainer, pinned skill](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/SKILL.md#L32-L109)
and [taste-skill, brief inference](https://github.com/Leonxlnx/taste-skill/blob/ccbc15639c97057cbfcf32ecebc38ef716e4bb37/skills/taste-skill/SKILL.md#L13-L75).
Sources inspected 2026-09-08; recipes and examples above are newly authored.
