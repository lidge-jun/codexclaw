# Anti-Slop — Banned AI Design Patterns (2026)

Specific patterns that mark output as "AI-generated." This is the comprehensive audit checklist.
Synthesized from taste-skill, redesign-skill, Anthropic frontend-design, and Koomook.

---

## Typography Slop Signals
- Unexamined default typography: browser defaults, framework defaults, or "Inter everywhere" without a reason
- Latin-first font choices applied to Hangul without testing CJK rhythm, line-height, and fallback behavior
- Space Grotesk used as the automatic "anti-Inter" choice
- System stacks used as a shortcut instead of a deliberate product typography decision

**Allowed when intentional**: `system-ui`, `-apple-system`, Pretendard, SUIT, Noto Sans KR, Apple SD Gothic Neo, and other platform/CJK-safe fallbacks.

**Do instead**: choose a domain-appropriate stack. For Korean-first UI, start with a CJK-safe product stack. For Latin-heavy display, consider Geist, Outfit, Cabinet Grotesk, Satoshi, Clash Display, GT America, or Neue Machina as accents.

---

## Typography Audit
- **Browser defaults or Inter everywhere** → Replace with a deliberate stack that fits the product and locale
- **Headlines lack presence** → Increase size, tighten letter-spacing, reduce line-height
- **Body text too wide** → Limit to ~65ch. Increase line-height
- **Only Regular (400) + Bold (700)** → Introduce Medium (500), SemiBold (600), or extremes (100 vs 900)
- **Numbers in proportional font** → Use mono or `font-variant-numeric: tabular-nums` for data
- **Missing letter-spacing** → Negative for large headers, positive for small caps/labels
- **All-caps subheaders everywhere** → Try lowercase italic, sentence case, or small-caps
- **Orphaned words** → Fix with `text-wrap: balance` or `text-wrap: pretty`
- **Only safe weights (400/500/600)** → Go to extremes: 100-200 (thin) vs 800-900 (black)
- **No `text-wrap` on any heading** → Apply `text-wrap: balance` globally to all h1-h6 (see `typography-wrapping.md`)
- **No `max-width` in `ch` units on headings or paragraphs** → h1: 50ch, h2: 55ch, p: 65ch
- **Heading breaks mid-phrase** → Review heading text at 390px, 768px, 1440px for balanced semantic breaks
- **Single word on last line of a heading** → `text-wrap: balance` or revise copy length
- **Body text lines exceeding 75 characters** → `max-width: 65ch` on paragraphs

---

## Banned Color Patterns
- Gradient soup: the 2026 #1 AI tell. Purple-on-white was the old obvious tell; layered gradient washes, gradient cards, gradient borders, and glow soup are the current-generation failure.
- Purple gradient on white background (legacy AI tell)
- Blue-to-indigo gradient buttons
- Oversaturated neon accents (keep saturation < 80%)
- Equally distributed pastel rainbows
- Pure black (#000000) backgrounds or text → off-black (`#0a0a0a`, Zinc-950)
- Mixing warm and cool grays in same project
- Generic `box-shadow` → tint shadows to background hue

**Do instead**: Zinc/Slate neutral base + ONE high-contrast accent. Tint shadows to background hue.

## Gradient Budget (FE-GRADIENT-01, DEFAULT)

Gradient overuse is the top 2026 anti-slop signal. Treat every gradient as a scarce semantic device, not as default texture.

- Max 1 ambient/background gradient wash per viewport
- Gradients on 3+ sibling cards in one section → flatten to solid surfaces with border/elevation hierarchy
- Background wash + card gradients + gradient borders + glow shadows stacked on one page = gradient soup, regardless of hue
- Radial glow washes behind dark heroes are decorative filler unless they model a real light source
- Every gradient must encode something: depth, light, state, or one brand moment. "Empty area needed texture" is not a reason.

### Opaque Functional Surfaces (FE-GRADIENT-02, DEFAULT, verified 2026-07-09)

A tinted gradient wash on an OPAQUE functional panel — `background:
linear-gradient(accent-tint, transparent), surface` on cards, panels, sidebars,
callouts, badges, or buttons inside tools/dashboards — is the product-UI
equivalent of gradient soup, regardless of hue. It reads as dated marketing
chrome: color as decoration instead of state, and contrast that varies
top-to-bottom so text/borders/nested controls fight a changing background.

Decision rule (surface role x opacity):

```text
Ambient / expressive / translucent / media-like surface
  -> gradient allowed if it encodes brand mood, light, depth, or material.
Opaque + functional (repeated cards, panels, sidebars, badges, task UI)
  -> NO gradient fill. Emphasize with exactly ONE channel:
     flat alpha/step tint | 1px accent border or ring | left/top accent bar |
     elevation shadow | semantic status token.
```

What premium systems do instead (measured 2026-07-09): Primer
`--bgColor-accent-muted` flat fill + `--borderColor-accent-muted`; Radix accent
steps 3-5 for component backgrounds, 6-8 for borders; shadcn flat `--accent`
surface tokens; Geist neutral surface + accent border on selected; Stripe Apps
neutral panel body + small accent bar. Korean premium services (Toss, Kakao,
Naver, Channel Talk, Daangn — live-measured) all use flat tint/border on
functional panels; their gradients live only in hero backgrounds and
illustrations. See `color-system.md` § Accent Surface Emphasis for token
recipes.

## One-Note Theme Ban (FE-ONENOTE-01, DEFAULT)

Full-page single-hue theming where background, borders, text accents, badges, glows, and imagery all resolve to one hue family. This is the 2026 dark-mode equivalent of purple-on-white.

- Dark terminal green / Matrix hacker themes for AI and devtool products are the #1 dark-mode tell
- Cyber cyan, retro CRT amber, and synthwave magenta full-page washes fail the same way
- Symptom check: sample 5 random UI elements (border, badge, accent text, glow, image tint); if 4+ share one hue ±30°, the page is one-note
- Generated imagery color-matched to the theme hue compounds the problem — the image must carry its own palette or add contrast, not echo the wash

**Do instead**: neutral dark base (Zinc-950/`#0a0a0a`) + ONE accent applied to <10% of surface area (primary CTA, active states, key data). Imagery and charts supply the remaining color variation.

## Premium-Consumer Palette Ban (MANDATORY)

For premium-consumer briefs (cookware, wellness, artisan, luxury, heritage, DTC home, travel):

### Banned default backgrounds (warm paper/cream/chalk/bone):
`#f5f1ea` `#f7f5f1` `#fbf8f1` `#efeae0` `#ece6db` `#faf7f1` `#e8dfcb` `#f7f6f3`

### Banned default accents (brass/clay/oxblood/ochre):
`#b08947` `#b6553a` `#9a2436` `#9c6e2a` `#bc7c3a` `#7d5621`

### Banned default text (espresso/warm near-black):
`#1a1714` `#1a1814` `#1b1814`

Override: ONLY when the brand brief explicitly names warm beige/cream colors.
For alternative palettes, see `aesthetics.md § Color & Theme`.

---

## Banned Layouts
- Everything centered with uniform padding
- Oversized bold hero text inside apps, tools, dashboards, admin, finance flows, or public services
- 3 equal cards in a row (the "feature row" cliché)
- Uniform rounded corners on every element (vary: tight on inner, soft on containers)
- Centered hero with gradient background + Inter heading
- Card-heavy dashboards where every metric is boxed
- Complex flexbox `calc()` percentage math → CSS Grid
- `height: 100vh` → `min-height: 100dvh` (iOS Safari)
- No max-width container → add `max-w-7xl mx-auto`
- Cards all forced to equal height → allow variable or masonry
- Dashboard always has left sidebar → try top nav, command menu, collapsible panel
- No overlap or depth → use negative margins for layering
- Symmetrical vertical padding → bottom often needs to be slightly larger (optical)
- Buttons not bottom-aligned in card groups → pin to bottom
- Feature lists at different vertical positions → align across columns
- Mathematical centering that looks optically wrong → adjust 1-2px

## 2026 Product Slop
- Asset-free pages: abstract gradients, blobs, and generic icons where a product/screenshot/diagram/chart is needed
- Fake dashboards with random numbers and no decision value
- Landing-page composition inside repeated-work tools
- AI tool surfaces with no pending, cancel, retry, undo, provenance, or permission states
- Trust-heavy domains using playful visuals without semantic purpose
- Soft 3D miniatures copied from generic icon packs instead of a brand-consistent asset system
- Giant centered Korean headlines used as decoration rather than hierarchy

## AI Tell Patterns (Extended)
- Version labels in hero (V0.6, BETA, INVITE-ONLY)
- Section-number eyebrows (001 · Capabilities, 06 · how it works)
- Middle-dot rationing: max 1 per metadata line
- Em-dash (—) ban — use hyphen, comma, period, or restructure
- "Quietly in use at" / "Quietly trusted by" social-proof headers
- Weather/locale strips unless genuinely place-focused
- Scroll cues (↓ scroll, Scroll to explore)
- Decorative dots before nav/list items
- Photo-credit captions on stock/AI-generated images
- Fake product previews built from styled divs
- Version footers on marketing pages (v1.4.2, Build 0048)
- Decoration text strips at hero bottom (BRAND. MOTION. SPATIAL.)
- "Stage 1 / Phase 01"-style generic step labels
- Pills/labels overlaid on images
- Scoring/progress bars as comparison visuals on landing pages
- Same generated/stock image used twice on one page (hero + detail crop / zoomed tile) → each image slot earns distinct content or gets cut
- Monospace uppercase Latin micro-labels stamped on every card of a Korean-first page (COMMAND TRACE, LIVE VISUAL) → card-level labels count toward the eyebrow budget (see `layout-discipline.md`)

### Self-Describing Meta Copy (FE-METACOPY-01, DEFAULT)

UI copy must describe the product value, user job, data, or state. It must not describe the mockup, layout, responsive behavior, or design system.

- Copy narrating its own layout: "벤토 보드에 겹쳐 보여주는 목업입니다", "이미지 타일을 다른 배율로 재사용", "cards connect like circuits"
- Copy narrating responsive behavior: "작은 화면에서는 단일 열로 접힙니다", viewport-size pill rows (390 / 768 / 1440) as content
- Cards named after design artifacts instead of user jobs: VIEWPORT MATRIX, DETAIL CROP, BENTO ROOM
- Copy describing the agent/process that built the page rather than what the user gets

**Test**: could a real user say what job this element does for them? If the copy only makes sense to the designer or prompt author, it is meta copy. Design rationale belongs in DESIGN.md, never in the UI.

### Copy Self-Audit (MANDATORY — pre-delivery)

Before delivering any page, read all visible text aloud (mentally). Check:
- No em-dashes (—) anywhere
- No "We believe" / "Our mission" / "Reimagine" / "Elevate" filler
- No lorem-adjacent placeholder copy disguised as real content
- Headlines could not describe a different product/company

## Banned Logo/Integration Section Patterns
- Generic stroke icons (Lucide/Heroicons/Feather) used as brand logos → use actual brand SVGs from Simple Icons, SVGL, or press kits (see `brand-asset-sourcing.md`)
- Individual hover effects on non-clickable logo walls → trust signals, not navigation. No per-item hover.
- CSS Grid logo wall with orphan cells (1 logo alone on last row) → use flexbox `justify-content: center` or marquee
- Static grid for 8+ logos → CSS marquee (infinite scroll, `translateX(-50%)`, duplicated track)
- Fast marquee animation (<15s) → slow and steady (30-40s, `linear`) feels premium
- Missing `prefers-reduced-motion` on logo marquee → mandatory accessibility
- Logo marquee without edge fade → add `mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent)`
- Colorful logos clashing with each other → uniform `filter: grayscale(1) brightness(0.7); opacity: 0.5`

## Korean Slop
- Translationese: "원활한 경험을 제공합니다", "혁신적인 솔루션", "처리가 완료되었습니다"
- Bureaucratic labels where simple Korean works
- Honorific overuse in everyday product actions
- Korean text clipped inside fixed-width buttons
- Negative letter-spacing blindly applied to Hangul
- Cute visual assets treated as a Korean default rather than a domain decision
- Childish copy in finance, public service, auth, payment, security, B2B, admin, or developer tools
- Oversized ultra-bold Hangul hero: Latin-poster sizing/weight on long Korean copy (100px+ / weight 800-900 / line-height ~0.9) reads as a heavy graphic mass even on landing/campaign surfaces — Korean premium services size heroes ~56-72px / weight 700 / line-height 1.25-1.4 (see `korea-2026.md` § Korean Hero / Large Display Type)
- Split-hero template (FE-HERO-SPLIT-01): left bold headline + right boxed screenshot/device-mockup card is the exhausted Stripe->Linear template lineage ("Linear Design" is a reproducible kit category, 2026) — never choose it unprompted; build it only on explicit user request (paid-conversion LPs are the one context to *propose* it). Default: make the product visual the stage (full-width, background, environment, or interactive demo), never a right-column card (see `layout-discipline.md` § Hero Composition Grammar)
- "tasteslop" serif shortcut: adopting a display serif purely as an AI-premium signal, without editorial structure (long-form typography, page-like surfaces, restrained palette), is the named 2026 backlash tell — serif direction is domain-gated and must be earned, at light display weights 330-400, never pasted onto a SaaS layout (see `aesthetics.md` § Serif Discipline)

---

## Emoji Slop (CRITICAL)

Emoji as visual elements is the strongest AI-generated tell in 2026 frontend. Human designers never ship emoji as feature icons, section markers, or decorative elements in production UI.

| Context | Verdict | Do Instead |
|---------|---------|------------|
| Feature card icons (📋 🧠 🎯) | **BANNED** | Lucide/Phosphor/Heroicons SVG icon |
| Section headers / bullets | **BANNED** | Typographic hierarchy or icon component |
| Button labels or CTA | **BANNED** | Text only, or SVG icon + text |
| Alt text / aria-label | **BANNED** | Descriptive text |
| Code comments / markup | **BANNED** | Plain text |
| Chat/messaging UI (user content) | Allowed | User-generated content is exempt |
| Internal CLI output / logs | Allowed | Functional status indicators (✅ ❌) acceptable in terminal |

**Why it's slop:** Emoji have fixed rendering per OS, no brand alignment, no size control, inconsistent cross-platform, and signal "AI threw this together" to any designer or user.

---

## Banned Interaction Patterns
- Generic circular loading spinners → skeleton loaders matching layout
- Default browser focus rings → `focus-visible:ring-2`
- Custom mouse cursors (outdated, accessibility issue)
- Neon/outer glow `box-shadow` effects
- Oversized gradient-fill text headers
- No hover states on buttons → add background shift, scale, or translate
- No active/pressed feedback → `scale(0.98)` or `translateY(1px)`
- Instant transitions (zero duration) → 200-300ms smooth transitions
- Dead links pointing to `#` → link to real destinations or visually disable
- Scroll jumping → `scroll-behavior: smooth`
- Animations using `top`/`left`/`width`/`height` → `transform`+`opacity`
- `window.alert()` for errors → inline error messages

---

## Banned Content (The "Jane Doe" Effect)
- Generic names: "John Doe", "Sarah Chan", "Jack Su"
- Generic company names: "Acme", "Nexus", "SmartFlow", "TechFlow"
- Predictable numbers: `99.99%`, `50%`, `$9.99`, `1234567`
- AI copywriting: "Elevate", "Seamless", "Unleash", "Next-Gen", "Cutting-edge", "Revolutionary", "Game-changer", "Delve", "Tapestry", "In the world of..."
- Exclamation marks in success messages → be confident, not loud
- "Oops!" error messages → "Connection failed. Please try again."
- Passive voice → active: "We couldn't save" not "Mistakes were made"
- Same date on all blog posts → randomize
- Same avatar for multiple users → unique for each
- Lorem Ipsum → write real draft copy
- Title Case On Every Header → sentence case
- Filler text that describes instead of demonstrates

---

## Banned Component Defaults
- shadcn/ui in generic default state → MUST customize radii, colors, shadows
- Default Tailwind blue (`bg-blue-500`) as primary
- Default browser form elements without styling
- Lucide/Heroicons egg avatar as placeholder → picsum.photos or SVG UI Avatars
- Pill-shaped "New"/"Beta" badges → square badges, flags, or plain text
- 3-card carousel testimonials with dots → masonry wall, embedded social, rotating quote
- Modals for everything → inline editing, slide-over panels, expandable sections
- Avatar circles exclusively → try squircles or rounded squares
- Sun/moon dark mode toggle → dropdown, system preference, or settings
- 4-column footer link farm → simplify
- Accordion FAQ → side-by-side list, searchable help, progressive disclosure

## Soft 3D / Character Asset Slop
These are not banned by default, but they must pass `soft-3d-asset-gates.md`.

Slop signals:
- generic public 3D icon pack
- random cute object unrelated to the product
- inconsistent lighting, material, or perspective
- low-polish AI output
- decorative overload
- asset competing with headline or CTA
- heavy 3D scene with no product value

---

## Iconography Audit
- **Lucide/Feather exclusively** → Use Phosphor, Heroicons, or custom set
- **Rocketship for "Launch", shield for "Security"** → less cliché: bolt, fingerprint, spark, vault
- **Inconsistent stroke widths** → standardize one stroke weight globally
- **Missing favicon** → always include branded favicon
- **Stock "diverse team" photos** → real photos, candids, or consistent illustration style

---

## Code Quality Audit
- Div soup → semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`
- Inline styles mixed with CSS classes → move to styling system
- Hardcoded pixel widths → relative units (`%`, `rem`, `max-width`)
- Missing or empty `alt` text on meaningful images
- Arbitrary z-index `9999` → clean z-index scale
- Commented-out dead code → remove before shipping
- Import hallucinations → verify every import exists in `package.json`
- Missing meta tags → `<title>`, `description`, `og:image`

---

## Strategic Omissions (What AI Forgets)
- No legal links (privacy policy, terms) in footer
- No "back" navigation → dead ends in user flows
- No custom 404 page
- No form validation (client-side)
- No "skip to content" link (a11y)
- No cookie consent (if jurisdiction requires)
- Random dark sections in a light page → commit to one theme or use subtle shade shifts
- Empty flat sections with no depth → add background imagery, patterns, or an ambient gradient (marketing/ambient surfaces only — never gradient fills on opaque functional panels; see FE-GRADIENT-02)

---

## The Anti-Convergence Rule

Each generation MUST be visually distinct from the last:
- Different font pairing each time
- Different primary aesthetic archetype
- Alternate light/dark themes
- Vary layout patterns (split → asymmetric → editorial → etc.)

This applies to separate design rounds or concept directions, not to candidate variations within the UX-CONCEPT-GEN-01 locked-concept synthesis workflow.

---

## Redesign Fix Priority Order

When fixing an existing project, apply in this order for max impact / min risk:

1. **Font swap** — biggest instant improvement
2. **Color palette cleanup** — remove clashing/oversaturated
3. **Hover + active states** — makes it feel alive
4. **Layout + spacing** — proper grid, max-width, consistent padding
5. **Replace generic components** — swap cliché patterns
6. **Add loading/empty/error states** — makes it feel finished
7. **Polish typography scale** — the premium final touch

---

## Second-Order Reflex Test (FE-REFLEX-TEST-01, DEFAULT)

Source: impeccable (40k stars, 2026-07-12 research).

Anti-slop detection operates at two levels:

- **First-order reflex**: can the palette and theme be guessed from the product
  category alone? (e.g. "fintech" → dark + cyan accent → AI default)
- **Second-order reflex**: can the *alternative* aesthetic be guessed from the
  category plus its obvious anti-reference? (e.g. "fintech that's NOT dark" →
  warm cream + serif → the fashionable anti-template)

Both are convergence signatures. A direction that passes the first-order test but
fails the second is still a learned template — the model replaced one default with
its current-fashion opposite. True domain-correct design emerges from the Design
Read's specific audience/purpose/constraint signals, not from "what's the opposite
of the obvious choice."

---

## Convergence Composition Tells (FE-CONVERGENCE-01, DEFAULT)

Source: impeccable detector catalog (46 rules, 8 domains) + taste-skill v2 (62k stars).

These are specific multi-element compositions that are statistically overproduced
by AI agents. A single trait may be legitimate; the convergence signature is the
indiscriminate combination.

### Visual Detail Tells

- **FE-BORDER-SHADOW-01**: Hairline border (1px) + diffuse box-shadow on the same
  element. Edge defines boundary OR elevation creates depth — not both. This is the
  #1 generated-UI composite tell. Fix: choose one; if elevation, remove the border;
  if boundary, remove or tighten the shadow.

- **FE-ICON-TILE-01**: Rounded-square icon container (40-64px, border-radius 12-16px,
  tinted background) stacked directly above a feature-card heading. The composition
  is the tell, not individual icons or cards. Fix: inline the icon beside the heading,
  use it as a list marker, or omit it if the heading is self-explanatory.

- **FE-ITALIC-SERIF-HERO-01**: Oversized italic serif headline in a hero section,
  now a major AI-premium convergence shortcut. Not the same as a general serif ban —
  the specific italic + oversized + startup/premium hero composition is the tell.
  Fix: if serif is the deliberate typographic direction, use roman weight at a
  considered scale; italic serif heroes need explicit design rationale.

- **FE-HERO-METRIC-01**: Giant number + small label + supporting stats row + gradient
  accent in a hero section. This exact scaffold is a dashboard-marketing convergence
  pattern. Fix: metrics belong in a dedicated stats section, not as hero filler.

### Typography Tells

- **FE-TYPO-FLOOR-01**: Typography floors (STRICT thresholds):
  - Body line-height: >= 1.3 (1.5 preferred for readability)
  - Body font-size: >= 12px (never smaller for readable prose)
  - Letter-spacing: never below -0.03em (destructive tracking floor)
  - Wide positive tracking (> 0.05em) on body copy is also a tell
  - Single font family with no role differentiation (heading/body/code/label all
    the same family, weight, and scale) is a flat-hierarchy signal

- **FE-SERIF-DEFAULT-01**: Fraunces and Instrument Serif as unexamined creative-font
  defaults. Random serif words embedded inside sans-serif headlines (mixed emphasis)
  without typographic rationale. Italic descenders clipping adjacent elements.
  Fix: choose the typographic direction deliberately; if serif, commit to it across
  the appropriate roles.

### Copy Tells

- **FE-APHORISM-01**: Aphoristic rebuttal cadence — manufactured short contrasts
  used as section headings or hero copy: "Not a feature. A platform." / "Stop
  managing. Start leading." / "Less noise. More signal." This pattern is generated-
  copy cadence, not concise writing. Fix: write copy that names the specific user
  benefit without the theatrical pivot.

- **FE-CONTENT-REALISM-01**: Content-data realism bans:
  - Generic startup names: "Acme", "Nexus", "SmartFlow", "TechVault"
  - Round vanity metrics: "10,000+", "99.9%", "500+ companies"
  - Generic testimonial avatars and names: "Jane D.", "Alex M."
  - Locale-inappropriate names (Latin names in Korean-first UIs)
  - Non-specific action verbs: "Elevate", "Transform", "Unleash", "Revolutionize"
  Fix: use locale-appropriate specific names, organic non-round numbers, and
  concrete verbs that describe the actual product action.

### Interaction Tells

- **FE-IMAGE-HOVER-01**: Generic hover zoom/rotation on every card image. Reflexive
  `transform: scale(1.05)` or `rotate(2deg)` on imagery is a default tell; hover
  transforms belong on interactive controls that change state, not on decorative
  images. Fix: remove image hover transforms unless the image IS the interactive
  target (gallery, lightbox).

- **FE-MARQUEE-01**: One marquee/ticker per page maximum. Two or more scrolling
  elements on one page is repetition slop. Fix: keep the strongest one; demote
  others to static sections.

- **FE-GRADIENT-TEXT-01**: Gradient text via `background-clip: text` + gradient
  background is now an overused AI tell. Ban as default; allow only with explicit
  design rationale and a fallback `color` for browsers that don't support it.

### Layout Tells

- **FE-CLIP-OVERFLOW-01**: Clipped popover/tooltip — an `overflow: hidden` or
  `overflow: clip` ancestor trapping a positioned child (tooltip, dropdown, popover).
  This is a common generated-UI layout bug, not an aesthetic choice. Fix: move the
  positioned element to a portal, or use `overflow: visible` on the clipping ancestor.

- **FE-PLACEHOLDER-IMG-01**: Broken or placeholder images in shipped UI. Empty `src`,
  `data:` URIs, `placeholder.com`, `via.placeholder.com`, `picsum.photos`, or
  `/api/placeholder/` URLs are shipping tells. Fix: use real assets (generated via
  ima2 or sourced from brand kits); never ship placeholder URLs.

- **FE-GRADIENT-STRIPE-01**: Decorative repeating-gradient stripes or grid overlays
  as background texture. The gradient budget (FE-GRADIENT-01) catches broad overuse;
  this catches the specific hairline repeating-gradient/grid-background provider
  signature. Fix: use a real texture image or remove the pattern.
