# 023 — Architecture Pivot: 로컬 vendoring 폐기, 원격 검색 일원화

- Date: 2026-07-05
- Supersedes: interview 확정 전제 2 (codexclaw 루트 `skills_ref/` vendored 스냅샷),
  022 Amendment 3의 "다중 소스 pull/sync" 파이프라인

---

## 전환 논리

LLM 에이전트는 거의 항상 온라인이다. dormant 스킬은 로드 시점에만 본문이 필요하고,
본문은 GitHub raw로 즉시 읽을 수 있다. 따라서:

- **로컬 복사본 불필요** — vendoring, sync 명령, 스냅샷 신선도 관리 전부 삭제.
- **`cxc skill search`는 원격 검색기**가 된다. 로컬에 두는 것은 검색 대상 소스
  목록(수 KB)뿐.

## 검색 대상 4소스

| 소스 | 위치 | 검색 방법 |
|------|------|-----------|
| cli-jaw skills_ref | github.com/bitkyc08-arch/cli-jaw (`skills_ref/`) | registry.json raw fetch → 메타데이터 매칭 → SKILL.md raw 로드 |
| ClawHub | github.com/openclaw/clawhub (+clawhub.ai) | 레지스트리/repo 검색 |
| Hermes | github.com/NousResearch/hermes-agent | repo tree/raw fetch (175 skills, MIT) |
| GitHub 일반 | `gh search code` / `gh api` | "SKILL.md + 키워드" 코드 검색 (rate-limit 유의) |

구현: `cxc skill search <query> [--source all|jaw|clawhub|hermes|gh]`
- 1차: cli-jaw registry.json 캐시(신선도 TTL) 대상 키워드 스코어링 — 가장 빠르고 정확
- 2차: clawhub/hermes 레지스트리 fetch
- 3차: gh 코드 검색 (명시 요청 시)
- 출력: 스킬 id + 설명 + **raw SKILL.md URL** + 어댑터 프리앰블(claude→codex exec
  치환, codexclaw dev 규율 우선). 에이전트는 URL을 fetch해서 그대로 스킬 로드.

## 남는 로컬 작업 = cli-jaw skills_ref 부패 청소 + push

새 리포/새 디렉토리 없음. 020 dedupe 조사는 "무엇을 청소할지" 목록으로 용도 변경:

1. registry.json 유령 6종 제거 또는 SKILL.md 보충 (differential-review,
   insecure-defaults, modern-python, property-based-testing, static-analysis, terraform)
2. 미등록 legacy 2종 정리 (pptx_original, xlsx_original — 삭제 또는 등록)
3. 잘린 설명 34건 (`...`) frontmatter에서 재생성
4. requires 스키마 통일 (bins/binaries/env/system 혼재 → 단일 스키마)
5. meta-test, search-route-test 등 active-only 스킬 skills_ref 반영 여부 결정
6. (선택) 중복 클러스터 하위 항목에 `superseded_by` 필드 마킹 — 삭제 대신 검색
   랭킹에서 강등. active 33종은 무조건 최상위 유지.
7. cli-jaw 리포에 커밋 + push → 원격 검색의 ground truth가 됨

삭제보다 마킹을 권하는 이유: 원격 검색에서는 저장 비용이 0이므로, 중복 스킬도
`superseded_by`로 남겨두면 정보 손실 없이 랭킹만 정리된다.

## 트레이드오프 (수용)

- 오프라인 시 dormant 스킬 사용 불가 — 수용 (에이전트는 거의 온라인).
- gh 코드 검색 rate limit — 3차 소스로만 사용, 1차는 registry 캐시.
- 외부 소스(clawhub/hermes) 스킬은 라이선스 표기 확인 후 로드만 (vendor 안 하므로
  라이선스 부담 자체가 소멸 — 021의 vendoring 제약 대부분 해소).

## Phase 재편성

- 030 Curation spec → **cli-jaw skills_ref 청소 스펙** (위 1-6 확정)
- 040 Import tooling → **`cxc skill search` 원격 검색 스펙** (4소스 어댑터, 캐시 TTL,
  어댑터 프리앰블 출력)
- 050 Audit 유지
