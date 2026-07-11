# Korean Services — Emphasized Panel Field Measurements

**Date**: 2026-07-09 (live Playwright DOM inspection, Tier 2)

Korean premium product UIs are consistently **flat tint + optional border,
subtle/no shadow** on functional highlighted panels. Gradients appear only as
hero backgrounds, illustration/mockup surfaces, or marketing ambience.

| Service | Emphasized/functional card | Gradient? |
| --- | --- | --- |
| Toss Pay | white `rgb(255,255,255)` / gray `rgb(242,244,246)` cards, border 0, no shadow, r32 | Hero bg only (`linear-gradient(rgb(232,243,255), rgb(245,252,255))`) |
| Kakao Business | flat solid pastels `rgb(142,198,255)` / `rgb(194,225,255)` / `rgb(203,241,228)`, border 0, no shadow | None |
| Naver Corp / WORKS | flat `rgb(242,244,245)`; product cards flat tints `rgb(241,238,255)` / `rgb(229,244,255)`, r8 | None (some bg images) |
| Channel Talk | white card + `1px solid rgba(0,0,0,.08)`; add-on `rgba(215,242,231,.6)` | Only inside a phone-mockup illustration |
| Daangn | `rgb(243,244,245)` tiles, border 0, no shadow, r12 | None |

Sources (opened live): pay.toss.im/pay, business.kakao.com, navercorp.com,
naver.worksmobile.com, channel.io/kr + /kr/pricing, daangn.com/kr.

Takeaway: matches the global finding — solid neutral/pastel tint, light border
if needed, no decorative gradient fill on functional panels.
