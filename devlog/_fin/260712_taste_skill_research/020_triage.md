---
created: 2026-07-12
tags: [codexclaw, taste, triage]
---

# Triage — Taste/Design Research Findings

## dev-uiux-design improvements

| # | Finding | Source | Action | Priority | Target |
|---|---------|--------|--------|----------|--------|
| U1 | Exact dial preset matrix (SaaS 7/6/4, Agency 9/8/3, etc.) | taste-skill | ACCEPT | P0 | §2 Dial Setting |
| U2 | Redesign arithmetic (preserve=match, overhaul=+2) | taste-skill | ACCEPT | P0 | §2 Dial Setting |
| U3 | Audience-first ownership ("audience picks, not your taste") | taste-skill | ACCEPT | P0 | §1 Intent Discovery |
| U4 | Expanded design-system routing (Polaris, Atlaskit, Primer) | taste-skill | ACCEPT | P1 | dev-frontend §12 |
| U5 | Real-system vs aesthetic honesty rule | taste-skill | ACCEPT | P1 | §2 Anti-Default |
| U6 | Canonical DESIGN.md schema unification (mini+persistent) | brandmd/Copernicus | ACCEPT | P0 | §2 + design-system-bootstrap |
| U7 | Anti-rationalization excuse tables (5 common shortcuts) | addyosmani | ACCEPT | P1 | new reference file |
| U8 | Content-data realism bans (locale names, organic metrics) | taste-skill | ACCEPT | P1 | anti-slop.md |

## dev-frontend improvements

| # | Finding | Source | Action | Priority | Target |
|---|---------|--------|--------|----------|--------|
| F1 | Hairline border + diffuse shadow ban | impeccable | ACCEPT | P0 | anti-slop.md |
| F2 | Icon tile above heading ban | impeccable | ACCEPT | P0 | anti-slop.md |
| F3 | Motion honesty invariant (dial > 4 = page must move) | taste-skill | ACCEPT | P0 | motion.md |
| F4 | Typography floors (line-height >= 1.3, body >= 12px) | impeccable | ACCEPT | P0 | anti-slop.md |
| F5 | Extreme tracking floor (letter-spacing never destructive) | impeccable | ACCEPT | P0 | anti-slop.md |
| F6 | One-marquee-per-page rule | taste-skill | ACCEPT | P1 | anti-slop.md |
| F7 | Clipped popover/tooltip detection | impeccable | ACCEPT | P1 | anti-slop.md |
| F8 | Aphoristic rebuttal cadence ban | impeccable | ACCEPT | P1 | anti-slop.md |
| F9 | Generic image hover zoom ban | impeccable | ACCEPT | P1 | anti-slop.md |
| F10 | Italic serif hero as AI tell | impeccable | ACCEPT | P0 | anti-slop.md |
| F11 | Serif-default suppression (Fraunces, Instrument Serif) | taste-skill | ACCEPT | P1 | anti-slop.md |
| F12 | Gradient text (background-clip: text) ban | impeccable | ACCEPT | P1 | anti-slop.md |
| F13 | Skipped heading levels | impeccable | ACCEPT | P1 | a11y-patterns.md |
| F14 | Broken/placeholder image detection | impeccable | ACCEPT | P0 | anti-slop.md |
| F15 | Second-order reflex test concept | impeccable | ACCEPT | P1 | anti-slop.md intro |

## ima2 integration improvements

| # | Finding | Source | Action | Priority | Target |
|---|---------|--------|--------|----------|--------|
| I1 | Image set continuity + per-section frame count | taste-skill | ACCEPT | P0 | asset-requirements.md |
| I2 | Composition-anchor rotation across multi-image sets | taste-skill | ACCEPT | P0 | UX-CONCEPT-GEN-01 |
| I3 | Reference-to-DESIGN.md via ima2 vision | brandmd/Copernicus | DEFER | P2 | needs ima2 feature work |
| I4 | Browser+vision fusion for automated design intake | brandmd/Copernicus | DEFER | P2 | needs brandmd-style pipeline |
| I5 | Reference-vs-implementation visual diff | Copernicus | DEFER | P2 | needs ima2 feature work |

## Architectural improvements (deferred)

| # | Finding | Source | Action | Priority |
|---|---------|--------|--------|----------|
| A1 | Executable anti-slop rule registry | impeccable | DEFER | P2 |
| A2 | Rendered-layout browser detector | impeccable | DEFER | P2 |
| A3 | Design-token drift detection | brandmd | DEFER | P2 |
| A4 | Explicit waiver model | impeccable | DEFER | P2 |
| A5 | Critique-to-polish persisted backlog | impeccable | DEFER | P2 |
| A6 | Provider-specific opt-in rules | impeccable | DEFER | P2 |
