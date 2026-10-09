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

