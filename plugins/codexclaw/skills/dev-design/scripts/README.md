# Scripts

## Lint: `ui-lint.mjs`, `copy-lint.mjs`, `seo-lint.mjs`

Executable checks for the rules this skill writes down. Zero dependencies, Node 22+. Run them
before claiming a C2+ visual surface done, and report the result. **Honesty rule:** a check
that did not run is reported as not run, never as passed. `NOT_RUN` lines and exit 3 mean
exactly that.

```bash
node scripts/ui-lint.mjs page.html src/styles/ [--render] [--json]
node scripts/copy-lint.mjs page.html draft.md [--json] [--year 2026]
node scripts/seo-lint.mjs dist/ | page.html | https://site [robots.txt] [sitemap.xml] [--json]
```

**Advisory, not a style.** The lints exist to catch breakage, not to narrow the design. FAIL is
reserved for objective defects (content that never becomes visible, a timeline reset by
declaration order, no `<title>`, JSON-LD that does not parse, blocked search bots, the color and
side-accent rules the owner validated). Everything about scroll craft, page shape and SEO polish
is WARN/INFO: weigh it, keep it when the concept wants it, and say why in the ship note.

Output: `FAIL|WARN|INFO <rule-id> <file>:<line> <message>` (line 0 = rendered finding with no
source line; the message names the viewport and element). `--json` prints
`{tool, findings:[{level,id,file,line,message}]}`.

| Exit | Meaning |
|---|---|
| 0 | No FAIL or WARN (INFO allowed) |
| 1 | At least one FAIL |
| 2 | WARN only |
| 3 | Could not run: missing input, or `--render` without a browser (`NOT_RUN`) |

### ui-lint

Static mode reads `.html .htm .css .jsx .tsx .vue .svelte` (style blocks, inline styles,
class utilities). `--render` opens `.html` files and `http(s)` URLs at 390 and 1280 px through
`playwright-core` when it can be imported (normal resolution, or `PLAYWRIGHT_CORE_PATH`; on
macOS it uses installed Google Chrome). Otherwise it prints `NOT_RUN` and exits 3.

| Id | Level | Static check | Render check |
|---|---|---|---|
| FE-SIDE-ACCENT-01 ([anti-slop](../references/build/anti-slop.md)) | FAIL | One side of a box thicker than the others (any side, physical or logical); equal-width edge in a different hue; one-sided inset shadow; positioned `::before`/`::after` rail 2-8px; `border-l-4`-style utilities. Exempt: `hr`, table cells, `[role=tab]` underlines, focus rules, `.gutter`/`[data-gutter]` | Computed one-sided borders, pseudo rails and inset-shadow rails on boxes 18px or taller |
| FE-COLOR-RESTRAINT-01 ([color system](../references/build/color-system.md)) | FAIL / WARN | Chromatic fill on button-like selectors or `bg-<hue>-NNN` on buttons (FAIL) unless the file opts in with `/* brand-primary: <reason> */` or `data-brand-primary`; with the opt-in, more than one hue family on buttons is still FAIL; chromatic button label (WARN); more than one non-semantic accent family in tokens (WARN) | Computed chromatic button fills |
| FE-COLOR-CONTRAST-01 ([color system](../references/build/color-system.md)) | FAIL | — | Hovers each text button; FAIL when rest contrast passes 4.5:1 and hover drops below it (the specificity bug class) |
| FE-GRADIENT-TEXT-01 ([anti-slop](../references/build/anti-slop.md)) | FAIL | `background-clip: text`, `bg-clip-text` | — |
| FE-GRADIENT-02 ([anti-slop](../references/build/anti-slop.md)) | WARN | Gradient fill on buttons, cards, panels, callouts | — |
| FE-AI-TELL-01 ([enforcement](../references/build/anti-slop-enforcement.md)) | FAIL / WARN | Emoji used as an icon in buttons, links, headings, list items (FAIL); `transition: all` / `transition-all` (WARN, motion.md) | — |
| FE-SLOP-CONSENSUS-01 ([slop consensus](../references/build/slop-consensus-2026.md)) | WARN / INFO | Eyebrow above the H1; card nested in a card; orb/bokeh blobs; three or more distinct tells in one file (INFO, stacking) | — |
| FE-TYPO-FLOOR-01 ([anti-slop](../references/build/anti-slop.md)) | WARN | — | Visible text under 12px |
| FE-VISUAL-AUDIT-02 ([visual audit loop](../references/build/visual-audit-loop.md)) | FAIL / WARN | — | Horizontal overflow (FAIL with a responsive viewport meta, WARN without); overlapping text boxes confirmed by hit-testing (WARN) |
| FE-SCROLL-BASE-01 ([scroll interaction](../references/build/scroll-interaction.md)) | WARN / FAIL | Element hidden (opacity 0 / visibility hidden) in its base rule next to a scroll timeline (WARN) | Scrolls the page at 1280px with reduced motion emulated, then with JavaScript off; FAIL when text stays invisible |
| FE-SCROLL-GUARD-01 | FAIL / INFO | `animation-timeline` declared before the `animation` shorthand (FAIL, the timeline is reset); no `@supports`, no reduced-motion guard, bare percentage ranges on `view()`, `overflow: hidden` wrapper around `view()` users (INFO) | — |
| FE-SCROLL-NATIVE-01 | WARN / INFO | `wheel`/`touchmove` listener that cancels scrolling (WARN); root `y mandatory` snap, `scroll-behavior: smooth` outside `no-preference`, smooth-scroll libraries (INFO) | — |
| FE-SCROLL-ANCHOR-01, FE-SCROLL-PERF-01 | INFO | Sticky header + `#anchors` without `scroll-padding-top`; scroll listener not passive or reading layout; scroll-linked keyframes animating layout/paint | — |

### copy-lint

Reads visible text only (script, style, svg, code, pre, noscript, template, `[hidden]`,
`aria-hidden` removed) or `.md`/`.txt` drafts (fenced code removed). Korean rules apply when
a segment's Hangul share is over 30%. Ids and levels are the table in
[copy-tells.md](../references/copy/copy-tells.md) (FE-COPY-TELLS-01): `copy-residue`,
`copy-invented-figure`, `copy-fake-proof`, `copy-default-cast`, `copy-stale-year`, `copy-meta`
(FAIL); `copy-hype-word`, `copy-stock-phrase`, `copy-em-dash` (more than 1),
`copy-contrast` (more than 2 in headings and taglines), `copy-two-fragment` (more than hero +
2), `copy-imperative-chain-ko` (3+ in a row), `copy-translationese-ko`,
`copy-honorific-overuse-ko`, `copy-exclaim` (WARN); `copy-vague-cta`, `copy-headline-period`,
`copy-headline-length-ko` (INFO). Owner-register devices within budget (name + beat, 대구,
"-다.", imperative or contrast headlines, "새로운 기준") are not reported. Client copy quoted
from the brief is waived by the brief.

### seo-lint

Reads the served HTML as text, which is what a crawler or a live-fetching answer engine sees
before scripts run. Walks a directory for `.html`; checks a `robots.txt` / `sitemap.xml` next to a
page or passed explicitly; fetches `/robots.txt` for a URL. Ids are defined in
[SEO and GEO](../references/build/seo-baseline.md).

| Id | FAIL | WARN / INFO |
|---|---|---|
| SEO-META-01 | no `<title>` | no description/viewport/lang/canonical, relative canonical/og:image, `noindex` (WARN); long title/description, missing OG/Twitter (INFO) |
| SEO-STRUCTURE-01 | — | no `<h1>`, `<img>` without `alt` (WARN); several H1s, skipped levels, no `<main>` (INFO) |
| SEO-JSONLD-01 | JSON-LD does not parse; FAQPage question not visible | AggregateRating/Review (WARN); FAQPage after the 2026-05-07 rich-result removal, no JSON-LD (INFO) |
| GEO-VISIBLE-01 | — | under ~40 words of server text plus scripts (client-only shell); JSON-LD name/headline/price not in visible text; `nosnippet`/`noarchive`/`ai-grounding:disallow` |
| GEO-ANSWER-01 | — | no literal sub line under the H1 (INFO) |
| GEO-AGENT-01 | — | clickable `div` without role, links without names or `href`, unlabeled inputs |
| SEO-CRAWL-01 | Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot or PerplexityBot blocked site-wide | retired `anthropic-ai` / `Claude-Web` tokens (INFO) |
| SEO-DISCOVERY-01 | — | no `Sitemap:` line, sitemap URLs without `lastmod`; `changefreq`/`priority` (INFO) |

### Tests and calibration

`plugins/codexclaw/test/design-lint.test.mjs` and `seo-lint.test.mjs` run the `fixtures/bad` and `fixtures/good`
pages, requires the dev-visualizer assets to produce no FAIL, checks that every id exists in
the references, and exercises `--render` (hover-contrast and rail fixtures) when a browser is
available. Calibration on 10 Korean company sites (2026-11-21): 0 FE-SIDE-ACCENT-01 FAILs;
remaining FAILs were a real colored CTA (flex) and desktop pages served to a 390px viewport.

## Project scripts

Utility scripts for React/artifact-based frontend projects.

### `init-artifact.sh`
Initializes a new React + TypeScript + Tailwind project aligned with [platform rules](../references/build/platform-runtime.md#12-frontend-platform-rules).

```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

Creates:
- React 19 + TypeScript via Vite 8 (Rolldown/Oxc default)
- Tailwind CSS v4 through `@tailwindcss/vite`
- CSS-first theme tokens in `src/index.css`
- Path aliases (`@/`) configured
- `cn()` utility and `components.json` compatible with shadcn/ui
- A minimal responsive app with loading, empty, and success state examples

Requirements:
- Node.js 20.19+ or 22.12+
- pnpm

### `bundle-artifact.sh`
Bundles a React app into a single self-contained HTML file.

```bash
bash scripts/bundle-artifact.sh
```

Creates `bundle.html` with all JS, CSS, and dependencies inlined.

**Requirements**: `index.html` in project root.

### `shadcn-components.tar.gz`
Legacy pre-packaged shadcn/ui components. The current scaffold does not extract it by default because Tailwind v4 projects should follow local registry and CSS-token conventions.

## When to Use

- **React/Next.js artifacts**: Use `init-artifact.sh` to scaffold, `bundle-artifact.sh` to package
- **Vanilla HTML**: Not needed — output single `.html` file directly
- **Svelte/Vue**: Not applicable — use framework-specific scaffolding

## Note on Framework Agnosticism

These scripts are React-specific. For other stacks:
- **Next.js**: Use `npx create-next-app@latest`
- **Svelte**: Use `npx sv create`
- **Vue**: Use `npm create vue@latest`
- **Vanilla**: No scaffolding needed — single file output
