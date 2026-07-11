# Phase 2: Full Reference File Mapping

## ima2-front/references/ (from dev-frontend core/ + stacks/)

### Keep at full depth (core frontend knowledge)
| codexclaw source | ima2 target | lines | notes |
|---|---|---|---|
| anti-slop.md (338) | anti-slop.md | ~300 | remove cxc-dev refs, add ima2 gen for real assets |
| aesthetics.md (327) | aesthetics.md | ~300 | full paraphrase, ima2 asset prompts |
| asset-requirements.md (353) | asset-pipeline.md | ~350 | already done, extend to match |
| motion.md (1072) | motion-video.md | ~400 | condense motion patterns + ima2 video pipeline (already ~130, needs expansion) |
| layout-discipline.md (161) | layout-discipline.md | ~150 | hero grammar, bento, section diversity |
| responsive-viewport.md (139) | responsive-viewport.md | ~130 | breakpoints, containment, container queries |
| mobile-ux.md (144) | mobile-ux.md | ~140 | thumb zone, touch targets, mobile composition |
| typography-wrapping.md (270) | typography-wrapping.md | ~200 | condense, keep Korean orphan rules |
| color-system.md (132) | color-system.md | ~130 | oklch, hue budget, contrast gates |
| a11y-patterns.md (134) | a11y-patterns.md | ~130 | ARIA, focus, keyboard |
| performance-budget.md (106) | performance-budget.md | ~100 | CWV, bundle limits |
| seo-baseline.md (123) | seo-baseline.md | ~120 | meta, JSON-LD, OG |
| theme-switching.md (82) | theme-switching.md | ~80 | dark mode toggle |
| visual-verification.md (102) | visual-verification.md | ~100 | screenshot gates |
| korea-2026.md (174) | korea-2026.md | ~170 | Korean service patterns |
| ux-writing-ko.md (62) | ux-writing-ko.md | ~60 | Korean UI copy |
| preflight-full.md (58) | preflight.md | ~60 | already done, extend |

### Keep at condensed depth
| codexclaw source | ima2 target | lines | notes |
|---|---|---|---|
| product-density.md (53) | product-density.md | ~50 | density profiles |
| consistency-locks.md (20) | consistency-locks.md | ~20 | color/shape locks |
| crud-ui.md (53) | crud-ui.md | ~50 | list/detail/form basics |
| liquid-glass.md (181) | liquid-glass.md | ~120 | condense, keep layer discipline |
| top-bar.md (126) | top-bar.md | ~100 | geometry, scroll state |
| dropdown-layer.md (110) | dropdown-layer.md | ~80 | unified dropdown skin |
| logo-sections.md (194) | logo-sections.md | ~120 | marquee, grid, grayscale |
| brand-asset-sourcing.md (122) | brand-asset-sourcing.md | ~100 | Simple Icons, SVGL |
| iterative-design.md (90) | iterative-design.md | ~90 | LLM convergence, Diverge-Kill-Mutate |
| prototype-variants.md (54) | prototype-variants.md | ~50 | ?variant= switchers |
| soft-3d-asset-gates.md (70) | soft-3d-asset-gates.md | ~70 | Toss-style vs slop |
| reference-capture.md (120) | reference-capture.md | ~80 | capture mechanics, provenance |
| i18n-global.md (104) | i18n-global.md | ~100 | RTL, Intl API |

### Stack refs (keep at condensed depth)
| codexclaw source | ima2 target | lines | notes |
|---|---|---|---|
| react.md (264) | stacks/react.md | ~200 | RSC, hooks, TanStack |
| nextjs.md (219) | stacks/nextjs.md | ~180 | App Router, cache |
| vanilla.md (226) | stacks/vanilla.md | ~180 | zero-dep, progressive enhancement |
| svelte.md (235) | stacks/svelte.md | ~180 | Svelte 5 Runes |
| astro.md (204) | stacks/astro.md | ~160 | Islands, multi-framework |
| mobile-native.md (281) | stacks/mobile-native.md | ~200 | RN/Expo, Flutter, Swift |

## ima2-uiux/references/ (from dev-uiux-design)

### Keep at full depth
| codexclaw source | ima2 target | lines | notes |
|---|---|---|---|
| design-isms.md (194) | design-isms.md | ~190 | needs full expansion from current 66 |
| product-personalities.md (118) | product-personalities.md | ~115 | needs full expansion from current 47 |
| ux-states.md (197) | ux-states.md | ~190 | needs full expansion from current 41 |
| color-system.md (80) | color-system.md | ~80 | palette generation |
| typography-line-breaks.md (193) | typography-line-breaks.md | ~190 | heading breaks, Korean |
| design-system-bootstrap.md (133) | design-system-bootstrap.md | ~130 | DESIGN.md format |
| favicon-logo.md (355) | favicon-logo.md | ~300 | favicon set, logo, OG |
| form-patterns.md (118) | form-patterns.md | ~110 | validation, multi-step |
| layout-macrostructures.md (54) | layout-macrostructures.md | ~50 | page/component layouts |
| responsive-nav.md (66) | responsive-nav.md | ~65 | nav patterns by density |
| logo-trust-sections.md (96) | logo-trust-sections.md | ~90 | marquee vs grid |
| visual-hierarchy.md (115) | visual-hierarchy.md | ~110 | 6 levers |
| mobile-native-ux.md (207) | mobile-native-ux.md | ~200 | iOS HIG, Material 3 |
| ux-preflight.md (65) | ux-preflight.md | ~65 | UX state checklist |
| design-read-example.md (33) | design-read-example.md | ~33 | filled example |

### Already done (extend)
| ima2 current | lines | action |
|---|---|---|
| intent-discovery-ladder.md | 86 | keep as is |
| korean-design-vocabulary.md | 52 | keep as is |
| anti-slop-judgment.md | 39 | expand to ~80 |

## Summary
- ima2-front: ~30 core + 6 stack = ~36 reference files, ~4000 lines
- ima2-uiux: ~17 reference files, ~2000 lines
- Total: ~53 reference files, ~6000 lines
- Estimated work: 5-6 PABCD phases
