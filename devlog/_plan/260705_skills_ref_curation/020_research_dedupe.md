# 020 — Research: skills_ref 내부 중복 분석 (gpt-5.5 explorer)

- Date: 2026-07-05
- Source: read-only explorer over `../cli-jaw/skills_ref/` (registry + frontmatter + spot-read)

---

## Inventory 실측

| 항목 | 수 |
|------|----|
| registry 항목 | 231 |
| 최상위 디렉토리 | 242 |
| SKILL.md 보유 디렉토리 | 227 |
| registry 유령 항목 (SKILL.md 없음) | 6 — differential-review, insecure-defaults, modern-python, property-based-testing, static-analysis, terraform |
| 미등록 SKILL.md | 2 — pptx_original, xlsx_original (legacy 중복) |
| 비스킬 지원 디렉토리 | .codexclaw, .github, .pytest_cache, __pycache__, docs, references, scripts, tests, ooxml_core |
| active 중 skills_ref 부재 | meta-test, search-route-test (~/.cli-jaw/skills에만 존재 → import 시 active 디렉토리에서 별도 수급 필요) |

## 주요 중복 클러스터 (keep → drop)

| 클러스터 | Keep | Drop 후보 |
|----------|------|-----------|
| 검색/리서치 | search, research-worker | deep-research, exa-search, web-ai, documentation-lookup |
| 브라우저/데스크톱 | browser, desktop-control, screen-capture | web-routing, vision-click, atlas |
| 에이전트 루프 | dev-pabcd, goal | autonomous-loops(claude -p 의존), continuous-agent-loop, claude-devfleet, ralphinho-rfc-pipeline, team-builder |
| 플래닝 | dev-pabcd, goal | blueprint, writing-plans, architecture-decision-records |
| 디버깅 | dev-debugging | debugging-helpers, debugging-checklist, error-message-explainer, log-summarizer, linter-fix-guide |
| 테스트/검증 | dev-testing | tdd, verification-loop, plankton-code-quality |
| 코드리뷰 | dev-code-reviewer | requesting-code-review, receiving-code-review(유용 부분 병합), differential-review(유령) |
| 보안 | dev-security | security-best-practices, security-threat-model, insecure-defaults(유령), static-analysis(유령) |
| 아키텍처/백엔드 | dev-architecture, dev-backend, dev-data | senior-architect, api-design-reviewer, database-designer, database-migrations |
| DevOps | dev-devops | deployment-patterns, docker-patterns, terraform(유령) |
| 프론트/디자인 | dev-frontend, dev-uiux-design, design | ui-design-system, web-artifacts-builder, liquid-glass-design, theme-factory, canvas-design |
| 오피스 문서 | docx, pdf, pdf-vision, pptx, xlsx, hwp | pptx_original, xlsx_original |
| Notion | notion (1개로 통합) | notion-knowledge-capture, notion-meeting-intelligence, notion-research-documentation, notion-spec-to-implementation |
| 미디어 생성 | imagegen, video, transcribe | fal-image-edit, nano-banana-pro, sora, speech, tts (프로바이더 래퍼) |
| 언어/프레임워크 팩 | python/golang/rust-patterns 등 선별 | 다수 *-tdd, *-verification 니치 팩 |

## 카테고리별 keep 비율 권고

| 카테고리 | 현재 | 권고 keep |
|----------|------|-----------|
| orchestration | 13 | 13 (전부 active) |
| devtools | 146 | ~55-70 |
| productivity | 25 | ~8-10 |
| ai-media | 16 | ~4-6 |
| utility | 12 | ~7-8 |
| communication | 8 | ~2-3 (telegram-send 필수) |
| automation | 5 | ~2-3 |
| smarthome | 2 | 0 |
| research/visualization/media | 4 | 4 |

**종합: 231 → 약 90-110개로 재편** (active 33종 전부 포함).

## codexclaw와의 이름 충돌 주의

skills_ref의 dev, dev-architecture ... dev-uiux-design, search 13종은 codexclaw
plugin skills와 이름이 겹침. dormant pool은 plugin 밖(`skills_ref/`)이므로 Codex
노출 충돌은 없으나, `cxc skill search` 결과에서 "codexclaw 내장 스킬이 우선,
dormant 동명 스킬은 참고용" 규칙을 어댑터 프리앰블에 포함해야 함.
