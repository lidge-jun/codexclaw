# Intent Discovery Ladder

Use this ladder only when UX-INTENT-01 step 2 fails (one fork was insufficient)
or the user explicitly wants guided exploration. The compact flow in SKILL.md §1
(Design Read → ONE clarifying fork → proceed) is the default; this ladder is the
optional deepening path.

Rules:
- Use binary/ternary choices, not open-ended questions.
- Reference known products — users recognize what they want faster than they articulate it.
- If the diagram skill is available, offer: "참고로 스타일 비교를 다이어그램으로 보여드릴 수도 있어요."
- If the user names a specific product reference, skip remaining steps and map
  directly via `references/product-personalities.md`.

## Step 1 — Mood

Ask: "전체적인 분위기가 어떤 느낌이면 좋을까요?" / "What overall feeling should the product have?"

| Option | Signals | Product References |
|--------|---------|-------------------|
| 전문적/신뢰감 (Professional) | swiss, flat, restrained | Linear, Vercel, GitHub |
| 따뜻한/친근한 (Warm/Friendly) | rounded, warm-neutrals, illustrations | Notion, Airbnb, Toss |
| 고급스러운/세련된 (Premium) | generous-whitespace, thin-type, restrained-color | Apple, Stripe, Aesop |
| 재미있는/활기찬 (Fun/Energetic) | bright-colors, playful-shapes, bold-type | Figma, Discord |
| 대담한/독특한 (Bold/Distinctive) | brutalism, asymmetry, experimental | Gumroad, Nothing |

## Step 2 — Lightness

Ask: "밝은 화면이 좋으신가요, 어두운 화면이 좋으신가요?" / "Light or dark background?"

| Option | CSS |
|--------|-----|
| 밝은 배경 (Light) | `bg-white text-gray-900` |
| 어두운 배경 (Dark) | `bg-gray-950 text-gray-100` |
| 둘 다 (Both / auto) | `prefers-color-scheme` aware |

## Step 3 — Density

Ask: "화면에 정보가 많이 보이는 게 좋으신가요, 여유롭게 보이는 게 좋으신가요?" / "Dense or spacious?"

| Option | VISUAL_DENSITY | Tokens |
|--------|---------------|--------|
| 빽빽하게 (Dense) | 8-10 | `text-sm py-1 px-2 gap-1` |
| 보통 (Normal) | 4-7 | `text-base py-3 px-4 gap-4` |
| 여유롭게 (Spacious) | 1-3 | `text-lg py-8 px-8 gap-8` |

## Step 4 — Shape

Ask: "모서리가 각진 느낌이 좋으신가요, 둥근 느낌이 좋으신가요?" / "Sharp or rounded?"

| Option | CSS | Signals |
|--------|-----|---------|
| 각진 (Sharp) | `rounded-none` / 0-2px | Vercel, brutalism, swiss |
| 살짝 둥근 (Slightly rounded) | `rounded-md` / 6-8px | Linear, Notion, material |
| 많이 둥근 (Very rounded) | `rounded-2xl` / 16-24px | Figma, iOS, Toss |

## Step 5 — Viewport Priority

Ask: "주로 어떤 화면에서 볼 건가요?" / "What's the primary viewing device?"

| Option | Responsive Strategy | Key Constraint |
|--------|-------------------|----------------|
| 데스크탑 위주 (Desktop-first) | Desktop layout → tablet → mobile collapse | Data density OK, hover interactions OK |
| 모바일 위주 (Mobile-first) | Mobile layout → tablet → desktop expansion | Thumb zone, touch targets, minimal density |
| 둘 다 중요 (Both equally) | Design mobile AND desktop as separate compositions | Most work — section order/composition may differ |

Cross-ref: `references/responsive-nav.md` for canonical breakpoints, `dev-frontend/references/core/mobile-ux.md` for mobile rules.

## Step 6 — Reference

Ask: "혹시 '이런 느낌이면 좋겠다' 하는 사이트나 앱이 있으신가요?" / "Any website or app that feels like what you want?"

This single question often resolves all ambiguity. If the user names a product, map it via `references/product-personalities.md`.

## Vague Request Disambiguation

When the user gives feedback without specifics, translate:

| User says | Action |
|-----------|--------|
| "더 좋게" / "make it better" | Ask: "레이아웃? 색상? 타이포? 여백?" — identify the dimension |
| "더 전문적으로" / "more professional" | Increase whitespace, reduce color count to 2-3, tighten grid alignment |
| "더 모던하게" / "more modern" | Negative letter-spacing on headings, offer dark mode, reduce radius to 8px |
| "더 재미있게" / "more exciting" | Add one bold accent color, increase type contrast, add micro-animation on hover |
| "너무 심심해" / "too boring" | Add asymmetric layout, introduce one unexpected element, vary section rhythm |
| "너무 복잡해" / "too busy" | Reduce element count, increase whitespace, limit to 2 colors |
