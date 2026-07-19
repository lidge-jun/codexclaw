# 010 — Phase 1: Icon Strategy Skill Patches

Goal: make icon choice an explicit Design Read decision and give frontend
implementation a consistent library/custom-icon route. This phase modifies exactly
two skill files; icon guidance is inlined directly into new skill sections (no separate reference file).

## MODIFY `plugins/codexclaw/skills/dev-uiux-design/SKILL.md`

### 1. Modular References table (~lines 52-77)

Insert after `references/color-system.md` so the new design-system decision sits with
the other visual-language references:

No separate reference file is created in this phase. The icon strategy guidance is
inlined directly into §2.7 (UX-ICON-01). A standalone `references/icon-strategy.md`
may be extracted in a future pass if the section grows large enough to warrant it.

### 2. `§2 Design Read` mini `DESIGN.md` YAML (~lines 188-199)

Inside the existing fenced YAML block, insert the following after the `typography:`
body line and before the closing `---`:

```yaml
iconography:
  system: "<library-name>"  # Phosphor (default) | Iconoir | Untitled UI | Hugeicons | Lucide
  weight: "<weight>"        # regular (default) | light | bold | duotone | fill
  domain: "<strategy>"      # library-subset | custom-ima2 | premium-set | hybrid
  custom-trigger: "<when>"  # domain concepts not in library | brand-specific style needed
```

Keep `iconography` at the same top-level indentation as `colors` and `typography`.
The completed block must retain the current frontmatter delimiters and existing color
and type examples unchanged.

### 3. New `§2.7 Icon Strategy (UX-ICON-01, DEFAULT)` (~after line 390)

Insert immediately after `§2.6 Asset Production Handoff` and before `## 3. Korean
Design Vocabulary...`. Add the following section:

```md
## 2.7 Icon Strategy (UX-ICON-01, DEFAULT)

Choose iconography during Design Read, before frontend implementation. The AI selects
the domain-correct default from the density matrix; an explicit `DESIGN.md`
`iconography` block overrides that default. Do not ask the user unless icon direction
is a material brand decision that cannot be inferred from the brief.

| Product density | Typical surface | Recommended system library | Why |
|-----------------|-----------------|----------------------------|-----|
| D1 | Editorial, campaign, sparse portfolio | Iconoir | Airy 1.5px linework supports low-density, art-directed composition |
| D2 | Marketing site, premium consumer landing | Phosphor or Iconoir | Phosphor adds expressive weights; Iconoir stays restrained |
| D3 | Consumer product, content app | Phosphor | Broad semantics plus regular/fill/duotone hierarchy |
| D4 | SaaS product, general app UI | Phosphor | Default balance of clarity, coverage, and personality |
| D5 | Korean consumer app, feature-rich mobile | Phosphor + custom domain layer | System clarity with colorful product-specific concepts |
| D6 | Dense admin, B2B workflow | Hugeicons or Untitled UI | Higher coverage and neutral, precise forms |
| D7 | Finance, ops, analytics | Untitled UI or Hugeicons | Controlled neutral geometry at high information density |
| D8 | Developer tool, expert control surface | Hugeicons or Lucide | Maximum coverage; Lucide is acceptable only when ecosystem fit is intentional |

Routing:

1. Set `system` from the matrix and the product's visual language. Phosphor is the
   general default, not a universal mandate.
2. Respect an explicit user choice or existing `DESIGN.md` value over the inferred
   default.
3. Use the library for routine system semantics: navigation, actions, status, search,
   disclosure, and utility controls.
4. Trigger the ima2 icon pipeline when a domain concept has no clear library glyph,
   when forcing an approximate glyph would reduce comprehension, or when the brief
   requires a brand-specific visual style. Use a licensed premium set when it already
   supplies the needed coherent domain vocabulary.

Use three visual layers:

- **System icons — library:** routine interface semantics; one coherent library and
  weight language.
- **Domain icons — custom or premium:** product concepts, categories, KPIs, habits,
  services, or objects that generic libraries cannot represent precisely.
- **Brand icons — custom:** identity-bearing marks, characters, mascots, and signature
  illustrations; never substitute a generic stroke icon for a logo.

Korean consumer apps often carry more information and rely on colorful,
domain-specific category/KPI icons for fast scanning. For D4-D6 Korean-first apps,
prefer a restrained system library plus a coherent colored domain layer rather than
forcing every concept into monochrome outline icons.
```

The table is a default router, not a license to mix libraries within one layer.
Implementation-level package selection, weights, and custom conversion belong to
`dev-frontend` §4.

## MODIFY `plugins/codexclaw/skills/dev-frontend/SKILL.md`

### 1. Modular References table (~lines 32-62)

Insert after `references/core/asset-requirements.md`:

No separate reference file is created in this phase. Icon implementation guidance
is inlined into §4 as `FE-ICON-01`. A standalone reference may be extracted later.

### 2. `§4 Implementation` — Icon Implementation (~after asset block, line 223)

Insert after the `Visual verification` bullet and before
`### Cutout Asset Generation (FE-ASSET-BG-01 surface — STRICT)`:

```md
### Icon Implementation (FE-ICON-01, DEFAULT)

- **Library route:** install `npm install @phosphor-icons/react` by default. Use
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
```

Keep this subsection at heading level 3, parallel to `Cutout Asset Generation`, and
do not fold the custom route into the general bitmap generation list: icon tracing has
its own output and consistency contract.

### 3. `§5 Anti-Slop Enforcement` icon bullet (~line 262)

Replace the existing emoji/icon bullet with this expanded bullet; retain the current
STRICT emoji ban and the sentence “Use SVG icons (Lucide/Phosphor/Heroicons)” exactly:

```md
- **NEVER use emoji as UI visual elements** (feature icons, card icons, section markers, buttons) — emoji in production UI is the #1 AI slop signal. Use SVG icons (Lucide/Phosphor/Heroicons), but choose the set from the Design Read instead of treating that parenthetical as a default. Lucide-as-default is itself a 2025-2026 vibe-coded tell: detect icon-library monoculture when the project uses the same glyphs and weight as every shadcn starter. Prefer a domain-correct library and a deliberate domain/brand layer; do not swap libraries randomly for novelty. See `anti-slop.md § Emoji Slop`.
```

This replacement distinguishes two failures: emoji-as-control remains STRICT, while
unexamined Lucide/shadcn convergence is a DEFAULT anti-slop signal. It must not imply
that existing Lucide projects require migration when ecosystem consistency is the
intentional choice.

## Verification

After WP2 applies the patches:

```sh
rg -n 'iconography:|UX-ICON-01' plugins/codexclaw/skills/dev-uiux-design/SKILL.md
rg -n 'FE-ICON-01|@phosphor-icons/react|Lucide-as-default' plugins/codexclaw/skills/dev-frontend/SKILL.md
# Negative assertion: no phantom reference links added
rg -c 'references/icon-strategy.md|references/core/icon-strategy.md' plugins/codexclaw/skills/dev-uiux-design/SKILL.md plugins/codexclaw/skills/dev-frontend/SKILL.md && echo 'FAIL: phantom reference found' || echo 'OK: no phantom refs'
git diff --check -- plugins/codexclaw/skills/dev-uiux-design/SKILL.md plugins/codexclaw/skills/dev-frontend/SKILL.md
```

Manual checks: the YAML remains valid; `§2.7` is between `§2.6` and `§3`; the
frontend icon subsection is inside `§4` after visual-verification and before Cutout;
the emoji ban remains STRICT; no phantom reference-table links were added; no
reference file or third skill was modified.
