# skills_ref 재편 (curation) — Plan

- Date: 2026-07-05
- Status: PLAN (P-phase)
- Parent initiative: 260705_hook_diet_skill_implicit Phase 4 (dormant pool)의 승격판.
  Phase 4가 "cli-jaw skills_ref를 그대로 참조"였다면, 이 계획은 **중복 제거 +
  유용성 선별 + 외부 생태계 최신화**를 거쳐 codexclaw 소유의 정제된 풀로 재편.

---

## 결정된 전제 (interview 확정, 023 개정 반영)

1. 검색 메커니즘: `cxc skill search <query>` CLI 서브커맨드 (no-server 철학 유지,
   상시 토큰 0, MCP tool 추가 없음).
2. 소스 위치 (023 개정): 로컬 vendoring 없음. 원격 4소스(cli-jaw GitHub, ClawHub,
   Hermes, gh 코드검색)를 `cxc skill search`가 직접 조회. cli-jaw skills_ref는
   부패 청소 후 push해서 원격 ground truth로 유지. $-멘션/implicit 비노출은
   자동 충족 (로컬 스킬 디렉토리 자체가 없음).
3. 호환성: 어댑터 프리앰블 — search/load 출력에 "외부 skill: Claude 도구명은 Codex
   등가물로 치환, codexclaw dev 규율 우선" 규칙 자동 부착.
4. registry: cli-jaw 리포 안에서 직접 정비 (frontmatter 재생성, 유령 제거, 스키마
   통일) 후 push. codexclaw는 fetch + 캐시(TTL)로만 사용.

## 신규 제약 (this turn)

- **Active 33종 무조건 유지**: `~/.cli-jaw/skills/`의 active 스킬 (browser, design,
  desktop-control, dev*, diagram, docx, github, goal, hwp, memory, pdf*, pptx,
  screen-capture, search, structured-renderers, telegram-send, video, xlsx 등)은
  중복 제거 대상에서 제외하고 반드시 포함.
- 재편 시 외부 최신 생태계 (openclaw GitHub, hermes 등) 조사해서 좋은 스킬은
  추가 후보로 검토.

## Phases

| Doc | Phase | 내용 | 상태 |
|-----|-------|------|------|
| 010 | Plan | 이 문서 | ✓ |
| 020 | Research (내부) | skills_ref dedupe 분석: 클러스터 15개, 유령 6, 231→90-110 권고 | ✓ |
| 021 | Research (외부) | openclaw/hermes/anthropic/openai/plugins 등 10개 소스 + import 후보 18 | ✓ |
| 022 | Policy amendment | claude-CLI 치환 정책(codex exec), ClawHub/Hermes 소스 지원, active 절대 보존 | ✓ |
| 023 | Remote-first pivot | 로컬 vendoring 폐기 → 원격 검색 일원화, skills_ref는 청소+push만 | ✓ |
| 030 | Cleanup spec | cli-jaw skills_ref 부패 청소 스펙 (유령/legacy/설명/스키마/superseded_by) | 로드맵 |
| 040 | Search tooling | `cxc skill search` 원격 검색 스펙 (4소스 + 캐시 TTL + 어댑터 프리앰블) | 로드맵 |
| 050 | Audit | A-phase 검증 후 B(구현) 진입 | 로드맵 |

## Research 핵심 결론 (020/021 요약)

- 231 → 약 90-110개 재편 권고. drop 대상: 유령 6, legacy 중복 2(pptx/xlsx_original),
  dev-* 라우터에 흡수된 주니어 헬퍼류, smarthome/개인 자동화, 순수 Claude-API 래퍼.
  (022: Claude CLI 참조 자체는 드랍 사유 아님 — `codex exec` 치환으로 keep 가능)
- active 33종 중 meta-test, search-route-test는 skills_ref에 없음 →
  `~/.cli-jaw/skills/`에서 별도 수급.
- 외부 도입 1순위: openai/plugins Codex-native 스킬 (react/shadcn/supabase/d3/sentry),
  Hermes MIT (gitnexus-explorer, oss-forensics, fastmcp), OK Skills Apache-2.0
  (browser-trace, codebase-design). 무라이선스 소스는 원문 vendor 금지.
- registry는 frontmatter에서 재생성 + 외부 소스별 metadata(hermes/openclaw) 필드를
  codexclaw 스키마로 정규화.

## 성공 기준

- [ ] active 33종 전부 신규 풀에 포함
- [ ] 중복군 (예: 유사 검색/브라우저/문서 스킬) 병합 근거 기록
- [ ] SKILL.md 없는 유령 항목 0
- [ ] 외부 신규 후보 목록에 도입 근거 + 라이선스 확인
- [ ] `cxc skill search` 가 정제된 registry에서 동작
