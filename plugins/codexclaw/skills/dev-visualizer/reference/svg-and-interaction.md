# SVG geometry and meaningful interaction

Use after [visual design](visual-design.md). This reference guides authoring;
it does not establish host capabilities or add runtime enforcement.
The current host contract governs inline output; requested files retain their format.

## Choose the layout authority

| Deliverable | Text layout | Appropriate export |
|---|---|---|
| Responsive HTML explanation | Semantic HTML in Grid/Flex normal flow | HTML; print through document owner |
| Editable standalone SVG | Measured SVG text and deliberate geometry | Real `.svg` with native text/shapes |
| HTML chart | SVG/canvas marks plus HTML labels/table as appropriate | Explicit vector or raster snapshot |
| Host-inline widget | Only the current host's supported layout | Export only through verified capability |

For HTML, do not place text-bearing nodes using hand-calculated absolute positions.
Use intrinsic sizing, `gap`, wrapping and `min-width: 0`; stack groups at narrow widths.
If SVG connects HTML nodes, derive endpoints from rendered node bounds in one coordinate
space; recompute after resize, font loading, content changes and disclosure.
Keep decorative connector overlays out of the reading order and pointer hit path.

Standalone SVG is a different medium: native coordinates are necessary and legitimate.
Measure text, size nodes, then arrange them; do not force labels into prechosen boxes.
Do not wrap an HTML screenshot in SVG and call it editable vector output.
`foreignObject` can use HTML flow in a browser, but is not a portable native-text export.
For a native SVG request, use `<text>`/`<tspan>` or disclose and test the specific viewer limit.

## Size for the actual reader

Choose a `viewBox`, intended display width and intended export dimensions together.
A `viewBox="0 0 960 480"` at 320 CSS px scales 14-unit labels to about 4.7px;
being vector does not make that readable. Container padding can reduce it further.
Measure the rendered SVG rectangle, not just the browser viewport.
For uniform scaling, use the smaller width/height scale when both constrain the viewport.
Adapt by reducing scope, splitting figures or making a narrow composition, not shrinking text.
A zoomable overview may have detail controls, but provide readable labels at the stated default size.
For fixed-size exports, state the intended size and inspect it; do not claim universal responsiveness.

## Measure, wrap, then lay out

1. Select font stack, real weight, size and line spacing; wait for available fonts to settle.
2. Measure each candidate line with the rendered SVG font, for example
   `getComputedTextLength()` on a measurement `<text>` element in the document.
3. Break at meaningful words/phrases; SVG `<text>` does not automatically wrap like a paragraph.
4. Emit one `<tspan>` per line with an explicit starting `x` and baseline offset.
5. Size the node from measured maximum width, line count, ascent/descent and padding.
6. Arrange nodes and route connectors outside label bounds; reserve room for arrowheads.
7. Inspect rendered bounds and actual screenshots, including the longest-label state.

Do not substitute character-count times a fixed width for measurement, especially with CJK.
If a token exceeds the line budget, widen/split the figure or wrap at grapheme boundaries;
never split surrogate pairs/combining sequences or silently remove qualifiers and units.
Re-measure after fallback fonts, changed text or changed weight. Canvas measurement can help
estimate layout, but inspect final SVG text because shaping and fallback may differ.
`getBBox()` helps inspect geometry; account separately for strokes, markers and clipping.
Do not use `textLength` to squeeze a long label into an unreadable narrow box.

Example native text structure; dimensions must still be measured for the chosen font:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"
     width="320" height="160" role="img" aria-labelledby="flow-title" aria-describedby="flow-desc">
  <title id="flow-title">검토 단계</title>
  <desc id="flow-desc">계약 조건 검토 후 담당자의 승인을 기다리는 단계.</desc>
  <rect x="16" y="28" width="288" height="104" rx="8" fill="#eef3f6"/>
  <text x="32" y="68" font-family="sans-serif" font-size="18" fill="#182c39">
    <tspan x="32">계약 조건 검토 후</tspan>
    <tspan x="32" dy="28">담당자 승인 대기</tspan>
  </text>
</svg>
```

Give each figure unique IDs, escaped text, a descriptive title and useful description.
Keep `<defs>`/markers self-contained; define export styles inside the SVG rather than
depending on an HTML ancestor's CSS variables. Preserve text for editing and selection.
Converting text to paths sacrifices that property; offer it only as an explicitly chosen variant.
Check font embedding permissions if embedding fonts; otherwise disclose required fonts/fallbacks.
Reopen the saved SVG itself, XML-parse it and inspect a render at 320/736px and export size.
Check labels against node edges, other labels, connectors and the outer viewport.

## Interaction should answer a question

Name input → transformation → output before adding a control.
Good: requests/s → required capacity and monthly cost, with an explicit capacity model.
Weak: a slider that changes only decorative color while the explanation stays identical.
Use one shared state model to update values, marks, table, caption and export summary.
Local calculation/filtering must work without a model call or automatic message submission.
Treat imported data and returned selections as data; render labels with safe text insertion.

Example illustrative model, with every constant labeled as an assumption:

```text
input: demand r requests/s, integer 0..1000
assume: each server handles 100 requests/s; price $30/server/month; no redundancy
servers = ceil(r / 100); cost = servers * 30
baseline r=200 → 2 servers, $60/month
chosen r=350 → 4 servers, $120/month; reset returns to r=200
```

Explain that this models capacity, not latency or availability; disclose omitted costs.
Test boundaries 0, 100 and 101, a nondefault value, invalid input and reset.
Reject invalid input visibly instead of showing a plausible number from stale state.
Label controls with units/ranges; show current values as text and keep focus stable during updates.
Use native buttons, labeled inputs and disclosure controls; provide numeric input beside a slider
when precision matters. Keep drag/pan alternatives and zoom/reset buttons keyboard-reachable.
Expose focus visibly; use concise live announcements for committed changes, not every animation frame.
Tooltips must also be available on focus, and must not contain the only explanation of a mark.
Honor reduced motion, provide pause for ongoing animation and retain all meaning without movement.

## Dependencies, offline use and export state

| Mode | Promise only when… | Failure behavior |
|---|---|---|
| Fully embedded file | CSS, JS, data and required assets are inside it | Verify with network blocked |
| Local asset bundle | Relative files travel with the document | List the bundle; test moved location |
| Network-dependent page | Remote URLs and versions are declared | Show error plus usable static evidence |

A single HTML file with CDN scripts or remote fonts is not inherently offline.
Prefer small native controls and inline marks when they cover the task; use a library only
for a named need. Verify its current API, exact version, license and exporting behavior.
Do not install or start a server merely because an upstream skill assumes one.
Storage and agent bridges are optional host capabilities, not prerequisites for reading.
Use in-memory state by default; add persistence only when requested and actually supported.
If scripting or a dependency fails, retain labeled static data/assumptions and explain what is unavailable.

Before print/export, settle fonts and computation, stop animation and expose the chosen inputs.
Print a visible state summary with units and active filters; default and selected states must not mix.
Include required disclosed content, remove scroll clipping, and keep table rows and headers readable.
Do not compress a multipage table onto one page or silently print only the visible screenful.
Ensure canvas marks are captured by the exporter or provide an explicit static alternative.
Verify a nondefault state's printed value and marks against the live state; pagination belongs to
the document/PDF owner. A screenshot of HTML does not establish SVG or PDF export fidelity.

## Provenance

Original adaptation of [local parameter exploration](https://github.com/f-labs-io/agent-html-skills/blob/d4f259ea4959aecd1240a10c60a950dfb6d1a3f5/plugins/html-skills/skills/html-interactive-playground/SKILL.md#L35-L79)
and [SVG accessibility/direct annotation patterns](https://github.com/Angelopvtac/explainer-pack/blob/09fd3f1de384d71858f0ba678af2abc5721907d1/skills/Explainer/References/Aesthetic.md#L133-L180).
Sources inspected 2026-09-08; no receiver code, fixed theme or upstream implementation is copied.
