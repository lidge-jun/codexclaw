## 4. Implementation

Read `aesthetics.md` for full guidelines. Summary:

- **Typography**: Use domain-appropriate typography. For Korean-first UIs, prioritize CJK-safe stacks before Latin display fonts. Apply `text-wrap: balance` on all headings **AND short descriptors** (hero subtitle, card description, caption — anything 1-3 lines). Use `text-wrap: pretty` only on body paragraphs (4+ lines). `pretty` has no effect on short text and will leave Korean orphans like "합니다." or "화." on a line alone. See `typography-wrapping.md` for full rules.
- **Color**: Max 1 accent. Use neutral bases (Zinc/Slate) with singular high-contrast accent — avoid purple-on-white. One-note means the ENTIRE page is dominated by variations of a single hue family. One accent color with neutral bases is correct, not one-note.
- **Layout**: Match the product surface. Avoid centered-card/hero patterns in repeated-use tools.
- **Motion**: See `motion.md`. One signature moment + a few
  supporting reveals > 10 scattered effects; landing-bucket floor/ceiling per
  FE-MOTION-BUCKET-01.
- **Assets**: Use screenshots, product images, diagrams, charts, illustrations, generated bitmaps, or soft 3D only when they add product meaning. Never ship a placeholder. Prefer real/generated image or video assets over CSS gradient washes. Read any design reference or captured screenshot back into context with `view_image` before matching it. Third-party captures follow `reference-capture.md` (analysis-only, provenance manifest).

  1. **Probe**: `ima2 status` → `ima2 serve` if down → recheck.
  2. **Generate**: `ima2 gen` with explicit long prompts; `--ref` for style anchors.
  3. **Inspect**: `view_image` every candidate.
  4. **Synthesize**: element ledger per FE-ASSET-SELECT-01.
  5. **Iterate**: `ima2 edit` for targeted fixes.
  6. **Verify**: browser screenshot of rendered result.

  Fallback: `$imagegen` only when ima2 is truly unavailable.

  `ima2` supports multi-candidate generation (`-n N`, multimode, and independent CLI
  parallel; FE-ASSET-PARALLEL-01), prompt builder, session style sheets, and provider
  routing (GPT/Grok/Gemini; FE-ASSET-PROVIDER-01). Monitor parallel jobs with
  `ima2 ps --json` and cancel unwanted jobs with `ima2 cancel <id>`. For motion assets,
  use `ima2 video` under FE-MOTION-VIDEO-01. Prompts must specify subject, composition,
  palette, lighting, style, and aspect per `asset-requirements.md`.

  Concept mockups guide implementation and are not shipped; production assets require candidate inspection and selection; cutout assets additionally follow FE-ASSET-BG-01.
- **Visual verification**: exercise the changed flow using the available capability selected by `../../../dev/references/browser-routing.md` and `dev-testing` §4.7. Read rendered output and verify the interaction; no single optional browser is mandatory.

### Icon Implementation (FE-ICON-01, DEFAULT)

- **Library route:** install `@phosphor-icons/react` by default. Use
  `iconoir-react`, `@untitledui/icons`, `@hugeicons/react`, or `lucide-react` only when
  the Design Read selects Iconoir, Untitled UI, Hugeicons, or Lucide respectively;
  confirm the exact package and license before installation.
- **Custom route:** generate the approved icon artwork with `ima2 icon`, trace it with
  `vtracer`, optimize the SVG with `svgo`, then convert it with `svgr` when a React
  component is required. Preserve an editable source asset and inspect both the SVG
  and rendered component before shipping.
- **Layer consistency:** use one library per icon layer. Do not mix Phosphor navigation
  with Lucide content icons; a separate custom/premium domain layer is allowed only
  when it is deliberately art-directed as a layer.
- **Weight semantics:** `regular` is the default state, `fill` indicates selected or
  active state, and `duotone` is reserved for empty states or illustrative emphasis.
  Keep size, optical weight, color behavior, and accessible labels consistent.

### Cutout Asset Generation
Every cutout asset MUST follow `asset-requirements.md` § Asset Background Strategy; load it with `ima2 skill front ref asset-requirements` when ima2 is available.
---
