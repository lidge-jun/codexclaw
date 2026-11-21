# 030 — wp3: executable gates (ui-lint, copy-lint)

Amend to diff level at this cycle's P. Ideas from hallmark `sloplint`, taste `copy-lint`,
visual-explainer `look.mjs`, impeccable detector; code written fresh.

## Design

- Node 22+, no dependencies for static mode. Rendered mode uses `playwright-core` only if
  already resolvable; otherwise it reports `NOT_RUN` (never a pass), matching
  VIZ-VERIFY-SCALE-01's honesty rule.
- Output: human lines `FAIL|WARN|INFO <id> <file>:<line> <message>` and `--json`. Exit 0
  clean, 1 FAIL present, 2 WARN only, 3 could not run.
- Every finding id is a rule id that exists in a reference file, so a finding always points
  to its reason.

## ui-lint (dev-frontend/scripts/ui-lint.mjs)

Static (CSS/HTML/JSX/TSX text):
- FE-SIDE-ACCENT-01: single-side border wider than the others, one-sided inset shadow,
  positioned pseudo-element bar 2-8px wide.
- FE-COLOR-RESTRAINT-01: button-like selectors (`button`, `.btn*`, `[role=button]`,
  `bg-*` classes on `<button>`) with a chromatic background; more than one non-semantic hue
  in tokens.
- FE-GRADIENT-01/02: gradient fills on opaque functional surfaces; `background-clip: text`.
- Hallmark-like floor items codexclaw already states: `transition: all`, missing
  `:focus-visible`, missing `prefers-reduced-motion` with animations, `100vw` widths.
Rendered (`--render`, widths 390/768/1280): horizontal overflow, text < 12px, overlapping
text boxes, computed button background chroma, computed one-sided borders, a contact sheet
PNG for the agent to look at once.

## copy-lint (dev-frontend/scripts/copy-lint.mjs)

Reads visible copy only (skip script/style/svg/code/hidden). Ids from wp2's copy-tells.md.
English and Korean rule sets selected by `lang` / Hangul ratio. Cross-file mode compares first
headings across pages for shared phrases.

## Fixtures first (008 B6)

Write PASS / FAIL / UNCERTAIN fixtures before the linters: RTL and logical sides; right and
bottom edges; equal-width color-only edge; `::before` rail; child-element and SVG rails;
inset-shadow stripe; table separators and axes (PASS); labelled diff gutter (PASS);
underline-style tab indicator (PASS); focus ring vs accent selection ring (PASS vs FAIL);
brief-named brand primary (PASS with recorded exception); two colored CTAs (FAIL); primary
hover contrast under 4.5:1 (FAIL); multi-series chart (PASS in both frontend and visualizer
gates); native switch and forced-colors (PASS). Probe v2 from the survey (`cap/capture2.mjs`,
session tmp) is the starting point for the rendered mode; its false positives in 007 become
UNCERTAIN fixtures.

## Fixtures and tests

`dev-frontend/scripts/fixtures/{bad,good}/*.html` with expected findings; `node --test`
file under `plugins/codexclaw/scripts/tests/` so `test.mjs` picks it up. Run the linters on
the two dev-visualizer assets after wp1: both must be clean of FE-SIDE-ACCENT-01 and
FE-COLOR-RESTRAINT-01.

## Router wiring

dev-frontend SKILL.md: "Before claiming a C2+ visual surface done, run ui-lint and copy-lint;
an unrun lint is reported as not run". visual-audit-loop.md gains the lint as step zero.

## Acceptance

Fixtures pass; gate.mjs exit 0; linters exit 0 on both visualizer assets; a seeded bad
fixture exits 1 with the expected ids.
