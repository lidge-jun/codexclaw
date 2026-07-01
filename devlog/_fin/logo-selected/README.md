# codexclaw Logo Selection

Status: APPLIED - 2026-06-30

## Selected Direction

User selected the h3 / option 3 direction: a split mark combining a Codex-style blossom
left half with an OpenClaw-style crimson claw right half.

## Source Assets

- Final generated bitmap:
  `/Users/jun/.codex/generated_images/019f17b1-9f0e-77c1-906b-879e5de9511f/ig_01253fa65ffce2f0016a4388f5ade4819abcf2d507a0c40ab9.png`
- Preserved repo copy:
  `devlog/_plan/logo-selected/codexclaw-final.png`
- Earlier h3 crop:
  `devlog/_plan/logo-selected/codexclaw-h3-selected.png`
- Reference sheets:
  `devlog/_plan/logo-i2i-half/_contact-sheet.png`
  `devlog/_plan/logo-fusion/_contact-sheet.png`

## Applied Site Assets

- README logo: `docs-site/public/logo.png`
- Starlight nav logo: `docs-site/src/assets/codexclaw-nav.png`
- Splash hero image: `docs-site/src/assets/codexclaw-hero.png`
- Open Graph card: `docs-site/public/og.png`
- Favicon/PWA set:
  `favicon.ico`, `favicon.svg`, `icon.svg`, `apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`, `icon-maskable.png`, `site.webmanifest`

## Verification

- `cd docs-site && npm run build` passed.
- Local preview served `/codexclaw/logo.png` and `/codexclaw/og.png` with HTTP 200.
- In-app browser checked desktop, 1024px, 768px, 390px, and 320px layouts.
- Result: no horizontal overflow, hero image loaded, nav logo loaded, favicon/head links present.
