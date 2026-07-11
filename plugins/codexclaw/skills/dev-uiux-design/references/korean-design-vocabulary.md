# Korean Design Vocabulary

Map common Korean design descriptors to concrete tokens. When the user uses
these words, translate before implementing.

## Translation Table

| Korean | Literal | CSS/Token Translation |
|--------|---------|----------------------|
| 깔끔하게 | cleanly | Generous whitespace (24-48px gaps), strict grid, max 2-3 colors, saturation < 60%, 1px borders or none, 4-8px radius, single font, no/subtle shadows |
| 모던하게 | modern | Geometric sans-serif (Geist/Outfit), negative letter-spacing on headings, dark mode or high-contrast light, 8-16px radius, spring micro-interactions |
| 고급스럽게 | luxurious | Very generous whitespace (48-96px padding), thin weights (300-400), refined sans by default, serif only with editorial/luxury rationale, low-saturation palette, slow animations (800ms+), 0-4px radius |
| 심플하게 | simply | Max 3-4 element types per screen, 1-2 colors, single font, 2-3 size steps, hidden/minimal navigation, zero decoration |
| 트렌디하게 | trendy | Glassmorphism, bento grid, gradient mesh, variable fonts — ask for a reference site |
| 따뜻하게 | warmly | Warm hue range (stone/amber/orange), 12-20px radius, warm-tinted shadows rgba(180,140,100,0.1), rounded or humanist sans |
| 차가운 | cold/cool | Cool grays (slate/zinc), blue-tinted whites, geometric sans, thin weights, 0-8px radius |
| 감성적으로 | emotionally | Editorial/lifestyle, serif display + sans body, muted/pastel colors, generous line-height, photography-heavy |

## Clarifying Questions per Term

- 깔끔: "Notion처럼 따뜻한 깔끔함인지, Vercel처럼 차가운 깔끔함인지요?"
- 모던: "다크 모드 + 날카로움(Linear)인지, 화이트 + 미니멀(Vercel)인지요?"
- 고급: "브랜드 고급감(Apple/Stripe)인지, 패션 럭셔리(Art Deco)인지요?"
- 심플: "기능이 적은 건지, 기능은 많지만 화면이 심플해 보이길 원하는 건지요?"

## Quick-Match Table

Rapid lookup: user word → concrete starting point.

| User (KO) | User (EN) | Start From | Dark? | Radius | Density | Font |
|------------|-----------|------------|-------|--------|---------|------|
| 깔끔하게 | Clean | Notion or Vercel | No | 8px | 4-7 | Geist / Pretendard |
| 모던하게 | Modern | Linear or Vercel | Yes | 6px | 4-7 | Geist / Outfit |
| 고급스럽게 | Premium | Apple or Stripe | Either | 0-4px | 1-3 | Satoshi / system thin-300 |
| 심플하게 | Simple | Vercel | Either | 0px | 1-3 | Geist |
| 따뜻하게 | Warm | Notion or Toss | No | 12px | 4-7 | Pretendard / Cabinet Grotesk |
| 재미있게 | Fun | Figma | No | 16px+ | 4-7 | Custom grotesque |
| 전문적으로 | Professional | Linear or GitHub | Either | 6px | 4-7 | Geist / Outfit |
| 대담하게 | Bold | Neobrutalism | No | 0px | 4-7 | Black 900 |
| 감성적으로 | Aesthetic | Editorial | No | 0-4px | 1-3 | Serif display |
| 트렌디하게 | Trendy | Ask for reference | Either | 12px | 4-7 | Variable font |

## Font Selection Guidelines

- **Typography stance (UX-TYPE-01)**: sans by default. Use serif only when the brief, brand system, or stated editorial/premium rationale supports it; do not inject one serif word into an otherwise sans headline for spice. When serif is justified (AI-product/editorial/research/trust surfaces), use the three-role system — display serif at light weights 330-400 + sans UI + mono accent — never as a bare AI-premium shortcut ("tasteslop"); gates in `dev-frontend` `aesthetics.md`.
- **Primary default**: Geist (modern SaaS, Vercel ecosystem)
- **Korean-first**: Pretendard. Close alternatives: SUIT, Wanted Sans, LINE Seed KR, Noto Sans KR, Spoqa Han Sans Neo, Source Han Sans KR.
- **Light centered Korean hero**: 300-400 weight is display-only (>= ~40px) for FE-HERO-LIGHT-CENTER-01.
- **Warm/editorial**: Outfit or Cabinet Grotesk
- **Premium/luxury**: Satoshi or system thin weights
- **Korean serif display**: MaruBuri (Naver) 400-600 for editorial Hangul headlines, paired with Pretendard UI.
- **Avoid defaulting to Inter** (DEFAULT) — #1 AI-generated UI tell.
