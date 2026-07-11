---
created: 2026-07-11
tags: [codexclaw, pabcd-initiative, docs-site, detail-pages, plan, diff-level]
---

# WP4 — detail doc pages (diff-level plan)

Status: PLANNED (rev 4 — A-gate round 1: 3 blockers ACCEPT + advisories
folded; round 2: 1 blocker (reviewer decorrelation) ACCEPT; round 3
decorrelated: 1 blocker (incident set not enumerable) ACCEPT)

## Loop-spec header

- Loop archetype: spec-satisfaction (verifier = content-evidence audit +
  rendered-screenshot QA).
- Trigger: goal WP4 — fill the four skeleton pages with research-grounded
  content in the locked visual language.
- Goal: `pages/{origin,skills,delegation,loop}.html` become full documents:
  Korean editorial body, hero-consistent design, every factual claim anchored
  to a devlog/doctrine/arXiv source.
- Non-goals: new site sections, palette/typography changes, remote deploy,
  doctrine edits.
- Verifier (all three mechanical; round-1 blockers #1-#3):
  1. Evidence audit, rg-enumerable: every rule ID matching
     `[A-Z]+(-[A-Z]+)*-\d{2}`, every arXiv ID, and every member of the
     CLOSED incident set {"NEXT NATION", "019f4407", "2604.20938"} (the only
     incidents the accepted lane evidence names; rg for these exact literals)
     appearing in rendered page HTML must have an adjacent
     anchor (`.refnote`/`.evidence .src`/link); every `file:line` anchor
     target exists on disk; every arXiv URL is a member of the 005
     claim-ledger EXACT-SET (10 IDs); `rg -i "todo|lorem|placeholder|TBD"`
     over `pages/` returns empty.
  2. Browser QA at ALL FOUR viewports 390/768/1024/1440 per page (parity with
     WP3 gate), over local HTTP with network on so Pretendard/Archivo CDN
     faces actually render; view_image read-back; no overlap/overflow.
  3. Link + asset integrity: every internal href AND every referenced asset
     (webp/css/fonts) returns 200 on the local server sweep.
- Stop condition: all four pages pass all three verifiers.
- Memory artifact: this doc + 041 impl record.
- Expected terminal outcome: DONE.
- Escalation condition: research lanes returning without verbatim anchors
  once -> re-dispatch with tightened packet; twice (distinct agents) ->
  DISPATCH-RETIRE-01, main reclaims the research slice.
- Write scope: `../pabcd_initiative/docs-site/pages/*.html`, minor additive
  CSS in `assets/site.css` (page-level components only; ink/neutral — the
  vermilion accent stays square-motif + rare emphasis per DESIGN.md, no new
  accent-colored component families), this devlog unit.
- Motion: no new motion on doc pages (D3 density); index scroll reveal does
  not leak into pages.

## Delegation plan (DISPATCH-ECONOMY-01 applied)

| Slice | Axis call | Disposition |
| --- | --- | --- |
| Origin-story evidence mining (pabcd_initiative devlog/backlog + codexclaw devlog: game-dev failures, lazy done, dead-branch incident, verification-gate origins) | specifiable + verifiable (anchors) + no verdict ownership | DISPATCH lane A (explorer) |
| Skill-split + loop-contract evidence mining (skills/dev-* routers, cxc-loop/cxc-pabcd SKILL.md, doctrine §HITL/HOTL) | same | DISPATCH lane B (explorer) |
| Plan A-gate adversarial review | audit = dispatchable, verdict returns to main | DISPATCH reviewer |
| Korean editorial copy + page composition + evidence synthesis | judgment-owned (design voice, claim triage) | MAIN |
| Page markup/CSS build | small, coupled to copy | MAIN |

Batch-spawn lanes A+B together, single synthesis by main (batch+synthesis
preference). RETURN FORMAT per DISPATCH-TASK-01: verbatim anchors mandatory
(file:line quotes, exact figures, URLs). Decision boundary (doctrine §3):
lanes return anchors only and settle nothing — no claim is accepted into a
page until main records an accept/reject/merge disposition per lane in
`041_wp4_impl_record.md` BEFORE synthesis (triage-disposition obligation).
Model routing: lanes A/B inherit the main model (specifiable research
packets); the A-gate reviewer routes to a DECORRELATED model family per
REVIEW-DECORRELATE-01 — rounds 1-2 ran same-family (recorded deviation);
the closing verdict comes from a decorrelated-family reviewer (gpt-5.6-sol).

## Page content maps (diff-level)

1. `origin.html` — sections: (a) 실패 모드 카탈로그 (lazy-completion 선언,
   검증 없는 done, 컨텍스트 붕괴/dead branch — lane A anchors), (b) 사건이
   규칙이 된 경로 (NEXT NATION dead branch -> C-ACTIVATION-GROUNDING-01 등
   활성화-증거 규칙), (c) 게임개발이 앞당긴 문제들 (시각 상태·비결정성·
   에셋 파이프라인 검증), (d) 왜 FSM + attestation인가. Fig: cut_fsm 재사용
   금지 — 텍스트 중심, 인용 블록 스타일 추가.
2. `skills.html` — (a) 모놀리스의 실패(컨텍스트 예산·활성화), (b) 라우터 +
   references 점진 공개 구조, (c) 13-스킬 패밀리 맵(표), (d) 75-grade
   업그레이드에서 굳은 규칙들 (DIFFLEVEL-ROADMAP-01, PHASE-SPLIT-01,
   LEXICO-SPLIT-01, UNIT-RESIDENCE-01, SOT-SYNC-01 — lane B anchors).
3. `delegation.html` — (a) 갈등에서 시작(복잡성 축 vs SPECIALIST-CRUX-01
   모순), (b) 3축 판별표, (c) triage disposition 의무 + 모델 라우팅, (d)
   arXiv 근거표 (WP2 claim-ledger 인용, 10편 중 페이지 논지에 걸리는 것
   전부 + 저등급 플래그 2건 정직 표기), (e) speculative dispatch 기본 금지.
   Fig.02 dispatch cutout 유지.
4. `loop.html` — (a) HITL 단계 규율(전이는 attest로만), (b) HOTL goalplan
   계약(성공 기준·체크포인트·증거 원장·divergence/collapse), (c)
   Stop-continuation 정책, (d) 품질 게이트와 리소스 바운드. Fig.03 gate
   cutout 유지.

공통: page-body에 h2 밴드 + 인용/앵커 각주 스타일(모노 소형, 파일경로 또는
arXiv ID). 디자인 토큰 변경 없음, 추가 CSS는 인용 블록/표 확장만.

## Accept criteria (c4)

- 4 pages fully written, Korean editorial voice; placeholder rg sweep empty.
- Verifier 1 evidence audit passes as specified (mechanical enumeration).
- 390/768/1024/1440 스크린샷 per page, view_image 판독, 오버랩/오버플로 0,
  CDN 폰트 렌더 확인(local HTTP + network).
- 내부 링크 + 에셋 참조 전수 200 (local HTTP sweep).
