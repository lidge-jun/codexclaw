## 1. Component Identification

When the user describes UI in vague terms (e.g. "접히는 거", "팝업 같은 거"):
1. Recommend the best-fit component with reasoning: `<Name> — <what it does, why it fits>`
2. Confirm, then proceed

If the user already names a specific component, skip this step.
Reference: [component.gallery/components](https://component.gallery/components/)

For new React/Vue/Svelte/Next UI source files, prefer `.tsx` or typed component files when the repo supports TypeScript. Inherit `dev` TypeScript strict-compatibility rules.
If frontend structure is unclear, read existing source-of-truth docs first, then document pages, components, routes, state stores, and build commands in the repo's existing docs before broad implementation.

---

## 1.5 Objective Gates vs Style Samples

Two different kinds of rules live in this skill (see `dev` §0.2):
- **Objective UX gates (STRICT/DEFAULT)** — accessibility baseline (`platform-runtime.md` §7, §11), state coverage
  (loading/empty/error/permission), keyboard operability, visible focus, contrast. Missing
  these are review findings.
- **Style direction (STYLE_SAMPLE)** — design direction intake (§2), aesthetics, density profiles,
  product personalities, preset tokens, and the concrete values in `implementation.md` §4 and `anti-slop-enforcement.md` §5 (palettes, font
  choices, pixel max-widths). These illustrate acceptable choices; they are NOT
  requirements, must not override an existing design system (Design System Detection stays
  MANDATORY), and must never be enforced as universal taste (UX-STYLE-01).
## 2. Design Direction Intake

> When the user cannot articulate a clear design direction, load `dev-uiux-design` first —
> it owns intent discovery and direction selection. This section validates and implements
> the chosen direction; it does not choose independently.

Before coding, validate the design direction from `dev-uiux-design` (or a concrete brief):
- **Purpose**: What problem does this interface solve? Who uses it?
- **Surface**: Is this a working tool, dashboard, public service, AI workflow, game, landing page, or editorial surface?
- **Tone**: Confirm the direction. For product tools this often means quiet, dense, trustworthy, and fast rather than loud.
- **Constraints**: Framework, performance budget, accessibility requirements.
- **Signature**: What ONE visual signature will make this unforgettable? (the signature
  moment; supporting scroll reveals may exist alongside it per
  `motion.md` FE-MOTION-BUCKET-01)

When user intent is vague ("깔끔하게", "모던하게", "just make it look good"), read the `dev-uiux-design` skill and run the User Intent Discovery Protocol before making routing decisions.
If the user cannot answer these questions, use the `dev-uiux-design` skill's structured preference elicitation flow. Offer product references ("Notion 느낌? Linear 느낌?") and visual comparisons.

**Concept pass before code (pointer — canonical: `dev-uiux-design` §2.5 UX-CONCEPT-GEN-01):**
for C2+ expressive or brand-visible surfaces, load `dev-uiux-design` §2.5 before
implementation. It owns direction discovery, concept branching (open direction: 5
distinct isms → lock one → refine; concrete direction: 3-5 contextual variants),
synthesis, and direction lock. Resume here after `DESIGN.md` is locked.

Intentionality over intensity. Bold maximalism, refined minimalism, dense utility, and friendly consumer UI can all work when they match the domain.

---

## 3. Baseline Configuration

Adjust these dials based on what's being built. Present to user if unclear.

| Dial             | Default | Range | Meaning                              |
| ---------------- | :-----: | :---: | ------------------------------------ |
| DESIGN_VARIANCE  |    5    | 1-10  | 1=symmetric utility, 10=asymmetric art |
| MOTION_INTENSITY |    4    | 1-10  | 1=static, 10=cinematic choreography    |
| VISUAL_DENSITY   |    5    | 1-10  | 1=art gallery airy, 10=cockpit dense   |

After Design Read, set dials per `../../../dev-uiux-design/references/design-read.md` §2 Dial Setting.

Product density profile (D1-D8 in `product-density.md`) sets component class; VISUAL_DENSITY (1-10) sets spacing within that class. These are orthogonal axes.

Adapt dynamically based on user requests. Dashboard → density up. Portfolio → variance up. Data tool → motion down.
Korean app/tool surfaces usually need higher density and clearer hierarchy, not oversized hero text.

---
