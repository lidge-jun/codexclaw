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
- Purple gradient on white background (the #1 AI tell)
- Blue-to-indigo gradient buttons
- Oversaturated neon accents (keep saturation < 80%)
- Equally distributed pastel rainbows
- Pure black (#000000) backgrounds or text → off-black (`#0a0a0a`, Zinc-950)
- Mixing warm and cool grays in same project
- Generic `box-shadow` → tint shadows to background hue

**Do instead**: Zinc/Slate neutral base + ONE high-contrast accent. Tint shadows to background hue.

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
- Empty flat sections with no depth → add background imagery, patterns, or gradients

---

## The Anti-Convergence Rule

Each generation MUST be visually distinct from the last:
- Different font pairing each time
- Different primary aesthetic archetype
- Alternate light/dark themes
- Vary layout patterns (split → asymmetric → editorial → etc.)

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
