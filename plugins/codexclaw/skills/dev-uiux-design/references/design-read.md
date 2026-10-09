## 2. Design Read (MANDATORY for new pages, components, or layouts. Optional for ≤5-line patches — see dev §0.1 Patch Fast-Path.)

Before generating ANY frontend code, produce a Design Read. If the project has a `DESIGN.md` file, read it first — its tokens and prose override everything below.

Inspect provided visual references with `view_image` before writing the Design
Read. Asset production and rendered-requirement definition are owned by `dev-frontend`;
QA protocol and verification proof execution are owned by `cxc-dev-testing`.

### Output format (mini DESIGN.md)

Filled-in example: `design-read-example.md`.

```yaml
---
name: <project-name>
colors:
  primary: "<hex>"
  accent: "<hex>"
  background: "<hex>"
typography:
  heading: { fontFamily: <font>, fontSize: <size> }
  body: { fontFamily: <font>, fontSize: <size> }
iconography:
  system: "<library-name>"  # Phosphor (default) | Iconoir | Untitled UI | Hugeicons | Lucide
  weight: "<weight>"        # regular (default) | light | bold | duotone | fill
  domain: "<strategy>"      # library-subset | custom-ima2 | premium-set | hybrid
---
```

Reading this as: <page kind> for <audience>, with a <vibe> language.
<1-2 sentences: specific reference, not adjectives. "1970s lecture handout" > "modern and clean">

Do's: <context-specific positive from brief>
Don'ts: <context-specific ban from brief>

### Signals to read
1. Page kind — landing (SaaS/consumer/agency/event), portfolio, redesign, editorial, app UI, tool UI
2. Vibe words — what the user said or implied
3. Reference signals — URLs, screenshots, brands named
4. Audience — B2B procurement vs design-conscious consumer vs recruiter
5. Existing brand assets — logo, color, type, photography
6. Quiet constraints — accessibility-first, public-sector, regulated, kids

### Dial Setting (MANDATORY — immediately after Design Read)

From the Design Read, derive and declare three dials before any code:

```
DESIGN_VARIANCE: <1-10>
MOTION_INTENSITY: <1-10>
Product density profile: <D1-D8> (see dev-frontend/references/core/product-density.md)
Reasoning: <one sentence explaining why these values match the brief>
```

Inference rules:
- Corporate/gov/utility → VARIANCE 2-4, MOTION 1-3, density D2-D3
- Marketing/landing → VARIANCE 4-7, MOTION 5-7 (scroll-motion floor applies, FE-MOTION-BUCKET-01), density D2-D3
- Creative/portfolio/editorial → VARIANCE 6-9, MOTION 5-7 (landing-bucket scroll floor applies, FE-MOTION-BUCKET-01), density D1-D3
- Dashboard/SaaS/admin → VARIANCE 2-4, MOTION 1-2 (scroll-driven = 0), density D4-D5
- "Complex" in brief → increase density profile (functional depth), NOT VARIANCE or MOTION
- "Simple" in brief → determine whether it means fewer choices, less decoration, or less information; do not automatically decrease information density

"복잡하다" = high DESIGN_VARIANCE is WRONG. Complexity means more features/data/flows, not more visual tricks (carousels, parallax, animations).

### Dial Presets (UX-DIAL-PRESET-01, STYLE_SAMPLE)

Source: taste-skill v2 (62k stars). Exact tuples for common use cases.
Presets are illustrative starting points, not authoritative constraints. They may
fall outside the rough inference ranges. Prefer the brief, existing design system,
accessibility and task evidence; record a different choice without treating it as failure.

| Use case | V | M | D | Notes |
|----------|---|---|---|-------|
| Landing (SaaS mainstream) | 7 | 6 | 4 | |
| Landing (Agency/creative) | 9 | 8 | 3 | |
| Landing (Premium consumer) | 7 | 6 | 3 | |
| Portfolio (Designer/studio) | 8 | 7 | 3 | |
| Portfolio (Developer) | 6 | 5 | 4 | |
| Editorial / Blog | 6 | 4 | 3 | |
| Public-sector service | 3 | 2 | 4 | |
| Dashboard / SaaS admin | 3 | 2 | 5 | |
| Finance / ops | 2 | 1 | 7 | density D6-D7 |
| Game | 8 | 7 | 4 | domain-specific |
| Korean consumer app | 5 | 4 | 5 | CJK density |

**Redesign arithmetic** (DEFAULT):
- Preserve redesign: V = match existing, M = match + 1, D = match existing
- Overhaul redesign: V = existing + 2, M = existing + 2, D = match existing
- "Complex" in brief: increase density (D), NOT variance or motion
- "Simple" in brief: reduce the complexity the user actually names; derive density from the task, not a fixed arithmetic rule

Score existing surface using preset rules. Clamp all arithmetic to 1-10 / D1-D8.
Example: existing SaaS 7/6/4 preserve -> 7/7/4; overhaul -> 9/8/4.

**Audience-first ownership** (UX-AUDIENCE-01, DEFAULT):
The audience picks the aesthetic, not the model's taste. When audience signal
and model preference conflict, audience wins. The dial presets above encode
audience expectations — a public-sector audience expects trust-first restraint;
an agency audience expects high variance. Override with stated rationale only.

Before declaring or shipping motion, read [Motion Honesty](../../dev-frontend/references/core/motion.md#motion-honesty-fe-motion-honesty-01-default) (FE-MOTION-HONESTY-01).

### Anti-Default Discipline
Do not default to: warm beige backgrounds, centered hero, three equal feature cards, generic glassmorphism, Inter + slate-900, card-based everything. These are LLM defaults. Reach past them BASED ON the design read.
The same discipline applies to printed and PDF documents, where the defaults are stat-card rows, tinted callouts with a colored left border, numbered circles and box-and-arrow figures; the document grammar (hairlines, type hierarchy, one accent, data charts) is `dev-visualizer` REPORT-DESIGN-01.
Award evidence is a dated sample, not an exemption or universal prohibition. Consult
`design-trends.md` and its actual sources, explain the surface-specific
purpose, and retain accessibility. Do not depend on a private goalplan synthesis.
When no brief exists at all, the sanctioned replacement for these generic
defaults is the named kit in `intent-discovery.md` UX-DEFAULT-ISM-01 — deliberate, domain-gated,
and stated as an assumption; it is not an exemption from this discipline.

If the brief is ambiguous, follow UX-INTENT-01: Design Read → ONE clarifying fork → proceed.

### DESIGN.md persistence
If the project needs persistent design tokens across sessions, save the Design Read as a full `DESIGN.md` in the project root. Format spec: `design-system-bootstrap.md § DESIGN.md Format`.

---
