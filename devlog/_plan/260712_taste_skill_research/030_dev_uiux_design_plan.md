---
created: 2026-07-12
tags: [codexclaw, dev-uiux-design, improvement-plan]
---

# dev-uiux-design Improvement Plan

## U1+U2: Dial Preset Matrix + Redesign Arithmetic (P0)

**Target**: dev-uiux-design §2 Dial Setting, dev-frontend §3 Baseline Configuration

Add exact per-domain tuples and redesign operators:

```
## Dial Presets (FE-DIAL-PRESET-01)

| Use case | V | M | D | Notes |
|----------|---|---|---|-------|
| Landing (SaaS mainstream) | 7 | 6 | 4 | |
| Landing (Agency/creative) | 9 | 8 | 3 | |
| Portfolio (Designer/studio) | 8 | 7 | 3 | |
| Portfolio (Developer) | 6 | 5 | 4 | |
| Public-sector service | 3 | 2 | 5 | |
| Dashboard/SaaS admin | 3 | 2 | 6 | density profile D4-D5 |
| Finance/ops | 2 | 1 | 7 | density profile D6-D7 |
| Game | 8 | 7 | 4 | domain-specific |
| Korean consumer app | 5 | 4 | 5 | CJK density |

### Redesign Arithmetic
- Preserve redesign: match existing V and D, motion = match + 1
- Overhaul redesign: V + 2, M + 2, preserve D
- "Complex" in brief: increase density, NOT variance or motion
```

## U3: Audience-First Ownership (P0)

**Target**: dev-uiux-design §1 or §2 Anti-Default Discipline

Add explicit rule: "The audience picks the aesthetic, not the model's
taste. When audience signal and model preference conflict, audience wins."

## U5: Real-System vs Aesthetic Honesty (P1)

**Target**: dev-uiux-design §2 Anti-Default Discipline

Add rule: glassmorphism, bento, brutalism, Liquid Glass web approximations
are aesthetic directions, not design systems. Never present an aesthetic
approximation as if it were an official design system with components.

## U6: DESIGN.md Schema Unification (P0)

**Target**: dev-uiux-design §2 + references/design-system-bootstrap.md

Unify mini (YAML frontmatter) and persistent (prose headings) into one
canonical schema with:
- Token provenance (source: concept-variant | reference | existing-system)
- Observation confidence (observed | inferred | unknown)
- Existing-system mapping when detected
- Responsive/theme variant notes

## U7: Anti-Rationalization Tables (P1)

**Target**: new reference file `references/anti-rationalization.md`

Port Addy's compact format for top 5 agent shortcuts:

| Shortcut | Rebuttal | Red flag | Verification |
|----------|----------|----------|-------------|
| "Reference is only inspiration" | Exact tokens matter | Palette drift >2 stops | Screenshot color-pick |
| "One desktop screenshot is enough" | Mobile is a different product | No mobile screenshot | 4-viewport matrix |
| "Design system wasn't obvious" | Always check package.json first | New tokens invented | DS detection grep |
| "Concept art is close enough" | Generated text/logos are unreliable | No runtime screenshot | Browser verify |
| "A screenshot proves a11y" | Vision cannot test keyboard/SR | No keyboard test | Tab-through + axe |

## U8: Content-Data Realism (P1)

**Target**: anti-slop.md

Expand content realism bans:
- Locale-appropriate names (Korean names in Korean UIs)
- Organic, non-round metrics (not "10,000+" or "99.9%")
- Plausible brand references (not "Acme Corp" or "TechFlow")
- Non-generic testimonial avatars and names
- Concrete action verbs (not "Elevate", "Transform", "Unleash")
