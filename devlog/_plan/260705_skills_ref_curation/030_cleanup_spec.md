# 030 — Cleanup Spec: cli-jaw skills_ref 부패 청소 (WP2 P-phase)

- Date: 2026-07-05
- Target repo: `../cli-jaw` (bitkyc08-arch/cli-jaw), 디렉토리 `skills_ref/`
- 원칙 (023): 원격 검색의 ground truth로 쓸 수 있게 registry를 신뢰 가능 상태로.
  삭제 최소화 — 중복은 `superseded_by` 마킹으로 랭킹 강등, 정보 보존.

---

## 실측 (2026-07-05 재검증)

- registry 231 / SKILL.md 보유 227 / 유령 6 / 미등록 2
- 잘린 설명(`...`) 34건
- requires 스키마 혼재: bins 35, env 20, system 3, binaries 2, optional_bins 1

## 작업 항목

### T1. 유령 6종 — 경로 승격 (audit 정정)
A-phase 감사 결과 6종 모두 **중첩 경로에 SKILL.md 존재** (예:
`differential-review/skills/differential-review/SKILL.md`,
`static-analysis/skills/codeql/SKILL.md`,
`terraform/code-generation/skills/terraform-style-guide/SKILL.md`).
삭제 대신 registry에 `entry` 필드(top-level 상대경로)를 추가해 실제 SKILL.md를
가리키게 한다. top-level SKILL.md 규약을 지키는 검색기는 `entry` 우선 참조.

### T2. 미등록 legacy 2종
pptx_original, xlsx_original → registry 등록하지 않고 디렉토리도 유지
(히스토리 보존). 단, 검색 대상에서 제외되도록 registry에 넣지 않는 것으로 종결.

### T3. 잘린 설명 34건 재생성
각 SKILL.md frontmatter `description`에서 첫 문장(최대 ~200자)을 추출해
registry `description`/`desc_en` 갱신. desc_ko는 기존 값 유지(잘리지 않은 경우).

### T4. requires 스키마 통일
정규형: `requires: { bins?: string[], env?: string[], system?: string[] }`
- `binaries` → `bins`로 개명 (2건)
- `optional_bins` → `optional: { bins: [...] }` 대신 **드랍하고 설명에 언급**
  (1건, 스키마 단순화 우선)

### T5. superseded_by 마킹 (020 클러스터 기반)
active 33종과 겹치지 않는 dormant 중복 하위 항목에 `superseded_by: "<skill-id>"`
필드 추가. 대상은 020의 드랍 후보 목록에서 active-우위가 명확한 것만 (약 25-30건):
debugging-helpers→dev-debugging, tdd→dev-testing, security-best-practices→dev-security 등.
claude-api 등 순수 래퍼도 삭제 대신 `superseded_by` 없이 `status: "claude-specific"`
마킹 (022 치환 정책과 일관: 존재는 보존, 검색 랭킹에서만 후순위).

### T6. active-only 스킬 반영
meta-test, search-route-test는 `~/.cli-jaw/skills/`에만 존재. cli-jaw 리포
관리 대상인지 불명(로컬 생성물일 가능성) → 이번 커밋에서 제외, 노트만 남김.

### T7. 검증 스크립트
`skills_ref/scripts/validate_public_surface.py`가 존재하나 이미 red
(`EXPECTED_SKILLS = 226` 하드코딩 vs 실제 227). 이 상수를 실측값으로 갱신하고,
registry 무결성 체크(모든 항목 SKILL.md 또는 entry 보유, requires 정규형,
description 비잘림)를 추가한 뒤 green 확인 후 커밋.

## 커밋/푸시

**audit 정정**: skills_ref는 cli-jaw의 서브모듈 (gitlink 160000, 원격
`github.com/lidge-jun/cli-jaw-skills`). 커밋은 skills_ref 내부 리포에서 수행하고,
cli-jaw 부모에는 포인터 업데이트 커밋. push는 cli-jaw-skills 원격으로 —
원격 검색(040)의 ground truth는 **cli-jaw-skills 리포의 raw URL**이 된다
(bitkyc08-arch/cli-jaw가 아님, 040 스펙에 반영할 것).

## Out of scope

- SKILL.md 본문 내용 수정 (claude→codex 치환은 040 검색 프리앰블 몫)
- 신규 스킬 작성, 외부 소스 import
- cli-jaw 랭킹 코드 수정 (superseded_by는 당장은 inert 메타데이터; 040의
  codexclaw 검색기가 1차 소비자)
