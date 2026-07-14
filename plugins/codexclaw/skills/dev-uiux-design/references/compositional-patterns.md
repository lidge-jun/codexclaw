# Compositional Patterns

Compositional patterns describe what a page **does structurally**: its hero function, navigation model, motion model, continuation cue, or content organization. They are orthogonal to the aesthetic directions in `design-isms.md`; combine one or two patterns with a compatible ism instead of treating a pattern as a new style.

Related: `design-isms.md` owns aesthetic directions and non-ism treatment/tone tags; `design-trends.md` owns dated axis prevalence and technique-level signals. This file remains canonical for the 15 pattern families, their frequencies, maturity, gates, and examples.

The frequencies below come from a 2026-07-14 corpus of 45 live sites across eight gallery sources. They are design-prior evidence, not market-share estimates. Maturity follows a hybrid lifecycle:

- **Core:** established across at least 3 galleries and useful independent of a currently fashionable rendering technique.
- **Emerging:** clears the 3-site/2-gallery evidence threshold but remains concentrated in a narrow context or implementation model.
- **Signature:** fewer than 3 sites or only one gallery; retain as an example under a family rather than promoting it to vocabulary.

No pattern is an accessibility exemption. Viewport locks, hidden navigation, tiny controls, hover-only discovery, and continuous motion require semantic landmarks, keyboard-visible alternatives, 44px targets, explicit progress, reduced-motion behavior, and a non-canvas route to core content.

## Hero Patterns

### Experiential Gate Hero

**Description:** The first viewport asks for a meaningful click, wheel gesture, consent/onboarding choice, or playful action before entering. The gate previews the experience's governing interaction rather than delaying access with decoration.

- **Frequency:** 7/45 sites, 4 galleries
- **Maturity:** Core
- **Compatible isms:** Liquid Editorial, Neobrutalism, Bauhaus, Memphis Design, Organic Capsule
- **Direction gate:** Use for campaigns, culture, entertainment, launches, and creative portfolios where entry is part of the premise. Do not use for task software, public services, urgent information, repeat visits, or any audience that needs immediate content access; always provide skip and keyboard paths.
- **Implementation pointer:** `dev-frontend/references/core/motion.md` for interaction and reduced-motion budgets; `a11y-patterns.md` for operable entry controls.
- **Representative sites:** Messenger, Don't Board Me, 21 Hrs, Brunello, Cobloc

### Proof-Object Hero

**Description:** A believable working interface, device, visualization, or product state appears before explanatory benefits. The object demonstrates the premise instead of acting as a boxed decorative screenshot.

- **Frequency:** 9/45 sites, 6 galleries
- **Maturity:** Core
- **Compatible isms:** Material Design, Flat Design, Swiss / International Typographic Style, Neobrutalism, Liquid Editorial, Organic Capsule
- **Direction gate:** Use for software, hardware, technical products, tools, and services whose value becomes clearer through direct evidence. Do not use a generic right-side mockup, illegible fake UI, or interaction that hides the primary proposition; regulated and procurement audiences need explicit supporting copy.
- **Implementation pointer:** `dev-frontend/references/core/asset-requirements.md` for hero proof assets and `responsive-viewport.md` for responsive staging.
- **Representative sites:** Igloo, Longbow, Interfere, Sky Clock, Drams

### Poster Hero

**Description:** One oversized, often cropped message and sparse utility text carry the viewport like a printed poster. Authored wrapping, scale, and negative space are the composition—not merely a large heading preset.

- **Frequency:** 7/45 sites, 5 galleries
- **Maturity:** Core
- **Compatible isms:** Swiss / International Typographic Style, Bauhaus, Liquid Editorial, AI Serif Editorial, Neobrutalism
- **Direction gate:** Use for editorial, fashion, culture, campaigns, type launches, and portfolios with a short, ownable statement. Do not use when users must compare features immediately, the message localizes unpredictably, or oversized type displaces operational tasks.
- **Implementation pointer:** `dev-frontend/references/core/typography-wrapping.md` for authored wraps and responsive type; `layout-discipline.md` for crop and spacing control.
- **Representative sites:** PP Neue Montreal, Benjamin Hoang, Shopify Design, Materials¹

### Atmospheric Product Portrait

**Description:** A high-key or cinematic portrait/media field, minimal copy, and soft-focus or material transitions present the product as an atmosphere rather than a diagram. The media must be the subject, not generic gradient decoration.

- **Frequency:** 5/45 sites, 4 galleries
- **Maturity:** Emerging
- **Compatible isms:** Organic Capsule, Liquid Editorial, AI Serif Editorial, Liquid Glass, Art Deco
- **Direction gate:** Use for premium consumer, beauty, health, fashion, hospitality, and objects where material feeling influences purchase. Do not use for evidence-heavy B2B, public-service, or accessibility-critical tasks, or when stock imagery cannot carry a specific product truth.
- **Implementation pointer:** `dev-frontend/references/core/asset-requirements.md` for media production and poster states; `performance-budget.md` for cinematic asset budgets.
- **Representative sites:** Augen, Sky Clock, Vero, RISK

## Motion Patterns

Retrieval vocabulary: **transformed-scroll** maps to the scroll-linked axis row in `design-trends.md` and, when native document position stays fixed, to Fixed-Canvas Wheel Navigation below; **ambient-continuous** maps to the ambient-motion axis row and may support Atmospheric Product Portrait or Single-Verb Motion System when those full recipes match; **kinetic-type** maps to the kinetic-type axis row and may support Specimen-as-Hero or Single-Verb Motion System. Loader onboarding and single-verb already have canonical families below. These aliases do not create families: the 15-family boundary stays frozen.

### Fixed-Canvas Wheel Navigation

**Description:** Wheel input advances WebGL, canvas, or transformed scene state while native document position remains fixed. It is a state navigator, not a more elaborate form of ordinary scroll reveal.

- **Frequency:** 9/45 sites, 5 galleries
- **Maturity:** Emerging
- **Compatible isms:** Liquid Editorial, Neobrutalism, Bauhaus, Memphis Design, Organic Capsule
- **Direction gate:** Use for bounded experiences, product worlds, interactive stories, and creative showcases where sequential scenes are the content. Do not use for documentation, ecommerce catalogs, long-form reading, repeated-work tools, or audiences relying on native scrolling and assistive technology; provide direct controls and a linear route.
- **Implementation pointer:** `dev-frontend/references/core/motion.md` for scroll/state choreography and reduced motion; `a11y-patterns.md` for keyboard and semantic alternatives.
- **Representative sites:** RISK, Meech213, Beats in Space, Zauberberg

### Loader-as-System-Onboarding

**Description:** The loader or intro previews the site's visual grammar and interaction rules, with explicit skip and sound controls. It earns its time by teaching the system while real assets initialize.

- **Frequency:** 3/45 sites, 3 galleries
- **Maturity:** Emerging
- **Compatible isms:** Bauhaus, Swiss / International Typographic Style, Liquid Editorial, Neobrutalism, Memphis Design
- **Direction gate:** Use only when a genuinely heavy experiential surface needs startup time and the onboarding explains a recurring interaction. Do not add a loader to mask avoidable performance, delay repeat visits, or gate essential content; honor reduced motion and remembered skip state.
- **Implementation pointer:** `dev-frontend/references/core/motion.md` for intro sequencing and controls; `performance-budget.md` for loading honesty.
- **Representative sites:** Cobloc, SSTR, House of Honey

### Single-Verb Motion System

**Description:** One semantic transformation—assemble, refract, reveal, flow, or resolve—is repeated across loader, type, navigation, and content states. Repetition turns motion into product or brand meaning rather than a collection of entrance effects.

- **Frequency:** 8/45 sites, 5 galleries
- **Maturity:** Core
- **Compatible isms:** Any ism when the verb is domain-specific; strongest with Bauhaus, Swiss / International Typographic Style, Liquid Editorial, Neobrutalism, and Liquid Glass
- **Direction gate:** Use when the product, identity, or narrative has a clear action that can govern multiple states. Do not force an abstract verb onto unrelated components, mix several signature motions, or animate repeated-work tools beyond concise feedback.
- **Implementation pointer:** `dev-frontend/references/core/motion.md` for motion hierarchy, honesty, and choreography budgets.
- **Representative sites:** Cobloc, SSTR, Interfere, RISK, PP Neue Montreal

## Navigation Patterns

Retrieval vocabulary: **hidden/minimal navigation** maps to the dated hidden-nav axis row in `design-trends.md`; select Diegetic Navigation, Edge-Rail Navigation Frame, or Adaptive Overlay Chrome only when the complete family contract matches. **counter/sequential navigation** maps to the dated counter/sequence evidence and usually resolves to Editorial Index / Roster or Edge-Peek Continuation Cue rather than a new family. Hidden chrome never removes orientation, semantic landmarks, keyboard access, or an alternate route.

### Diegetic Navigation

**Description:** Destinations and progress cues live inside the represented world or content sequence rather than in separate site chrome. A map, chapter, project row, or product object becomes the navigation surface.

- **Frequency:** 5/45 sites, 4 galleries
- **Maturity:** Core
- **Compatible isms:** Liquid Editorial, Swiss / International Typographic Style, Bauhaus, Neobrutalism, Skeuomorphism
- **Direction gate:** Use for narrative, exhibition, map, portfolio, and product-world experiences whose content supplies a clear mental model. Do not use when destinations are numerous, users must jump predictably between tasks, or meaning depends on hover or visual metaphor alone; retain landmarks and an alternate menu.
- **Implementation pointer:** `dev-frontend/references/core/a11y-patterns.md` for semantic navigation and `responsive-viewport.md` for mobile fallback.
- **Representative sites:** 21 Hrs, Interfere, Medium Rare, James Walsh

### Edge-Rail Navigation Frame

**Description:** Tiny fixed corner labels, vertical words, coordinates, or controls form a perimeter around a dominant center stage. The rail preserves orientation while allowing the main artifact to remain visually uninterrupted.

- **Frequency:** 16/45 sites, 7 galleries
- **Maturity:** Core
- **Compatible isms:** Flat Design, Swiss / International Typographic Style, Liquid Editorial, Neobrutalism, Bauhaus
- **Direction gate:** Use for portfolios, exhibitions, editorial showcases, and cinematic brand surfaces with 2–5 stable destinations. Do not use microtype or edge placement for dense product IA, touch-first audiences, localization with long labels, or controls that cannot meet target-size and contrast requirements.
- **Implementation pointer:** `dev-frontend/references/core/layout-discipline.md` for fixed perimeter geometry; `a11y-patterns.md` and `responsive-viewport.md` for targets and collapse behavior.
- **Representative sites:** Benjamin Hoang, RISK, Angela Ricciardi, Cantor8, Vero

### Adaptive Overlay Chrome

**Description:** Fixed controls keep their position and function while changing tone or contrast as underlying media changes. Adaptation protects legibility across cinematic chapters without adding a separate opaque header.

- **Frequency:** 3/45 sites, 3 galleries
- **Maturity:** Emerging
- **Compatible isms:** Liquid Glass, Organic Capsule, Liquid Editorial, Flat Design, AI Serif Editorial
- **Direction gate:** Use for media-led stories and full-bleed chapter systems where persistent controls must cross light and dark material. Do not use if contrast can be solved with stable tokens, if state changes flicker, or if the audience needs a conventional high-certainty header.
- **Implementation pointer:** `dev-frontend/references/core/top-bar.md` for overlay states, `color-system.md` for contrast tokens, and `motion.md` for transition restraint.
- **Representative sites:** Vero, RISK, Augen

## Typography Patterns

### Specimen-as-Hero

**Description:** The typeface, glyph construction, or typographic system is itself the product and hero subject. Interactive specimens, character assembly, and authored glyph scale replace generic product imagery.

- **Frequency:** 4/45 sites, 4 galleries
- **Maturity:** Core
- **Compatible isms:** Swiss / International Typographic Style, Liquid Editorial, Bauhaus, Neobrutalism, AI Serif Editorial
- **Direction gate:** Use for foundries, rebrands, editorial launches, design tools, and products whose typographic system is genuine evidence. Do not use specimen theatrics when the chosen font is generic, licensing/loading is unresolved, or content comprehension and localization are more important than display behavior.
- **Implementation pointer:** `dev-frontend/references/core/typography-wrapping.md` for responsive specimen behavior; `performance-budget.md` for font loading.
- **Representative sites:** PP Neue Montreal, Shopify Design, SSTR, Cobloc

## Content Structure Patterns

### Spatial Portfolio Canvas

**Description:** Pointer-led or viewport-locked discovery replaces ordinary vertical document flow while auxiliary navigation remains fixed. Projects occupy a navigable field rather than a stack of cards.

- **Frequency:** 6/45 sites, 3 galleries
- **Maturity:** Emerging
- **Compatible isms:** Flat Design, Swiss / International Typographic Style, Liquid Editorial, Neobrutalism, Memphis Design
- **Direction gate:** Use for small, highly visual portfolios and exhibitions where exploration is itself a selection criterion. Do not use for large archives, mobile-primary audiences, keyboard-dependent workflows, or recruiter/client tasks that need fast scanning; provide an index/list mode.
- **Implementation pointer:** `dev-frontend/references/core/responsive-viewport.md` for viewport and mobile alternatives; `a11y-patterns.md` for non-pointer access.
- **Representative sites:** Meech213, Beats in Space, Zauberberg, Angela Ricciardi

### Editorial Index / Roster

**Description:** Names, numbered rows, chapters, or disciplinary headings replace card grids and serve as both content and navigation. Hierarchy comes from sequence, type, and metadata rather than containers.

- **Frequency:** 8/45 sites, 5 galleries
- **Maturity:** Core
- **Compatible isms:** Swiss / International Typographic Style, Liquid Editorial, Bauhaus, Flat Design, Neobrutalism, AI Serif Editorial
- **Direction gate:** Use for portfolios, archives, studios, publications, annual reports, and collections where comparison and sequence matter. Do not use when items need rich visual comparison at a glance or when labels alone are ambiguous; preserve thumbnails or summaries on focus/tap, not hover only.
- **Implementation pointer:** `dev-frontend/references/core/layout-discipline.md` for list/grid rhythm; `typography-wrapping.md` for row hierarchy.
- **Representative sites:** Medium Rare, James Walsh, Jacky Winter, Making Software, Foundation Labs

### Edge-Peek Continuation Cue

**Description:** A cropped brand mark, adjacent-project sliver, or partial next chapter signals that content continues beyond the current frame. It replaces a generic arrow only when the crop clearly predicts the direction of travel.

- **Frequency:** 4/45 sites, 3 galleries
- **Maturity:** Core
- **Compatible isms:** Liquid Editorial, Swiss / International Typographic Style, Flat Design, Organic Capsule, Neobrutalism
- **Direction gate:** Use in sequential portfolios, horizontal galleries, chapter stories, and full-screen viewers where spatial continuation is central. Do not rely on it as the only control, use it where clipping looks accidental, or obscure content on small screens; pair it with labels, counters, or buttons.
- **Implementation pointer:** `dev-frontend/references/core/layout-discipline.md` for controlled overflow; `responsive-viewport.md` for mobile continuation cues.
- **Representative sites:** Angela Ricciardi, RISK, Vero, SiteInspire unusual-layout portfolio examples

### Instrument-Panel Editorial

**Description:** Expressive central media or type is framed by telemetry, mono labels, grids, counters, schematics, or diagnostic modules. The utility layer gives precision and context without turning the page into a generic dashboard.

- **Frequency:** 7/45 sites, 5 galleries
- **Maturity:** Core
- **Compatible isms:** Swiss / International Typographic Style, Bauhaus, Neobrutalism, Liquid Editorial, Material Design
- **Direction gate:** Use for engineering, architecture, research, industrial products, technical culture, and data-rich editorial stories where metadata is meaningful. Do not add fake coordinates, diagnostics, or tiny mono labels as sci-fi decoration; nonexpert audiences need plain-language interpretation and readable defaults.
- **Implementation pointer:** `dev-frontend/references/core/layout-discipline.md` for grid and framing; `product-density.md` for information density; `typography-wrapping.md` for utility type.
- **Representative sites:** SSTR, Longbow, Making Software, Monolog, Cantor8

## Composition rule

Prefer one governing pattern and, at most, one supporting pattern. Repeat the same logic across type, navigation, motion, and proof. Originality usually comes from this coherent rule—not from stacking ornamental styles. Re-evaluate Emerging patterns on later crawls; future additions require 3+ sites across 2+ galleries or remain signatures beneath an existing family.
