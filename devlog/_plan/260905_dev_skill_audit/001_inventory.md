# 전체 인벤토리와 스킬별 진단

기준 HEAD: `048ae759c715051f2fde807624e85cf1ec6c6d55`. 설치본은 `0.2.16+codex.260830094500`이다. 2026-09-05에 원본과 설치본을 SHA-256으로 대조했다. **저장소는 13개 router, 본문 5,424줄, 전체 189개 파일, reference 계열 147개 파일**이다. C 독립 감사와 재검사 기준 **185개 동일, diagram 관련 4개 상이**, 설치본에 실질 파일 1개가 추가로 있다. 이 비교는 upstream Git 최신 여부까지 보증하지 않는다.

초기 스캔은 189개 모두 같다고 출력했으나 재검사와 일치하지 않았다. 그 원인은 확인하지 못했으므로 처음 수치를 현재 증거로 쓰지 않는다. 최초 기록은 commit `5b8a0379`에 남아 있고, 현재 manifest에는 양쪽 hash와 재검사 시각을 기록했다.

다른 파일은 `dev-diagram-viewer/SKILL.md`, `reference/visualize-contract.md`, `scripts/diagram-to-html.sh`, `upstream/visualize-upstream.md`다. 설치본에만 `upstream/extract-contract.mjs`가 있다. 설치본의 `.DS_Store` 16개는 Finder metadata라 실질 파일 비교에서 제외했다. 설치된 diagram은 visualize 1.0.22를 추적하고 이미 1 MB/절대 경로 content reference를 사용한다. 저장소의 1.0.11 계약 문제를 설치본에도 그대로 적용하지 않는다.

전체 파일과 hash는 [inventory.json](evidence/inventory.json)에 있다. 각 router의 `SKILL.md`를 끝까지 읽었다. reference는 모든 경로·hash를 수집했고, 아래 심층 목록은 본문까지 대조했다. 나머지 reference의 모든 기술 예제·버전·라이선스를 검증한 것은 아니다.

| 스킬 | 본문 줄 | 전체 파일 | reference | last-verified |
|---|---:|---:|---:|---|
| dev | 450 | 9 | 7 | 2026-07-02 |
| dev-architecture | 398 | 5 | 3 | 2026-07-02 |
| dev-backend | 429 | 21 | 17 | 2026-07-02 |
| dev-code-reviewer | 432 | 4 | 2 | 2026-07-02 |
| dev-data | 411 | 6 | 4 | 2026-07-02 |
| dev-debugging | 410 | 20 | 18 | 2026-07-02 |
| dev-devops | 430 | 15 | 13 | 2026-08-26 |
| dev-diagram-viewer | 437 | 8 | 3 | 2026-07-11 |
| dev-frontend | 427 | 46 | 39 | 2026-07-14 |
| dev-scaffolding | 337 | 7 | 3 | 2026-07-02 |
| dev-security | 315 | 11 | 9 | 2026-07-02 |
| dev-testing | 500 | 13 | 7 | 2026-07-02 |
| dev-uiux-design | 448 | 24 | 22 | 2026-07-14 |

## dev

- 역할: 공통 분류·안전·검증·router 선택.
- 검토: `plugins/codexclaw/skills/dev/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F01·F02·F07·F08·F14. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 가벼운 작업의 기록·검증 예외를 이 파일 하나에서 정할지.

## dev-architecture

- 역할: 모듈 경계·순환·검증 위치.
- 검토: `plugins/codexclaw/skills/dev-architecture/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F07·F12·Q03. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 도메인 불변식과 입력 schema 검증을 나눌지.

## dev-backend

- 역할: API·오류·큐·앱 운영 신호.
- 검토: `plugins/codexclaw/skills/dev-backend/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F13·Q04. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 기본 envelope/AppError/5초 queue 기준을 어느 조건에서 적용할지.

## dev-code-reviewer

- 역할: 감사·중요도·변경 파일 증거.
- 검토: `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F07·F18. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 길이만으로 merge blocker를 만들지, 실제 위험을 요구할지.

## dev-data

- 역할: ETL·분석·품질·백필.
- 검토: `plugins/codexclaw/skills/dev-data/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F08·F13·F15·Q05. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: OLTP는 backend로 분리하고 수치 추천을 benchmark 조건으로 남길지.

## dev-debugging

- 역할: 재현·반증·원인 추적.
- 검토: `plugins/codexclaw/skills/dev-debugging/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F09·F16. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 진단 요청과 수정 요청, 장애 완화와 원인 규명을 구분할지.

## dev-devops

- 역할: 배포·릴리스·인프라·브랜치 정리.
- 검토: `plugins/codexclaw/skills/dev-devops/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F16·F19·Q06. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 저장소 설정 자동 변경과 기술 권고를 분리할지.

## dev-diagram-viewer

- 역할: 시각화 출력·검증·upstream 계약.
- 검토: `plugins/codexclaw/skills/dev-diagram-viewer/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F03·F17·F21. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 상류 계약을 복사 유지할지, 현재 설치된 skill로 위임할지.

## dev-frontend

- 역할: 구현·반응형·접근성·시각적 검증.
- 검토: `plugins/codexclaw/skills/dev-frontend/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F02·F05·F11·F18. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 디자인 방향은 UX owner에 두고 스택 참조는 구현만 맡길지.

## dev-scaffolding

- 역할: 구조·문서 위치·초기 설정.
- 검토: `plugins/codexclaw/skills/dev-scaffolding/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F01·F10·F20. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 문서 scaffold와 실행 가능한 앱 scaffold의 검증을 나눌지.

## dev-security

- 역할: 위협 모델·인증·공급망 정책.
- 검토: `plugins/codexclaw/skills/dev-security/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F04·F19·Q07. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: ASVS 공식 requirement 추적과 자체 체크리스트를 분리할지.

## dev-testing

- 역할: 검증 깊이·회귀·CI·QA 도구.
- 검토: `plugins/codexclaw/skills/dev-testing/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F02·F09·F12·F17. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 테스트 범위와 browser routing을 중앙에서 정할지.

## dev-uiux-design

- 역할: 디자인 판단·상태 의미·방향 선택.
- 검토: `plugins/codexclaw/skills/dev-uiux-design/SKILL.md:1`부터 본문 전체와 router metadata.
- 진단: F05·F06·F11. 상세 근거는 `002_findings.md`, 판단 질문은 `004_interview.md`.
- 인터뷰: 강제 기본 스타일·생성 개수와 예시를 분리할지.

## 심층 대조한 참조와 주변 계약

- `dev/references/skill-ownership.md`
- `dev-architecture/references/circular-dependencies.md`
- `dev-frontend/references/stacks/react.md`
- `dev-scaffolding/references/implementation-log.md`
- `dev-security/references/asvs-checklist.md`
- `dev-security/references/supply-chain-sbom.md`
- `dev-diagram-viewer/upstream/sync-check.sh`, `upstream/visualize-upstream.md`
- `dev-diagram-viewer/reference/visualize-contract.md`의 파일·크기·출력 계약과 현재 visualize 대응 구간
- `pabcd`, `loop`, `interview`, `search` 본문, `structure/00_philosophy.md`, `structure/20_pabcd_dispatch_doctrine.md`
- 로컬 browser skill 본문, aside-jun 본문과 deep-research reference
- `dev-security/references/owasp-top10.md`의 cookie/CSRF 관련 구간은 부분 검토. 전문 검토로 세지 않는다.

## 링크 스캔의 오탐 제거

기계 스캔은 6개 경로를 찾지 못했다. reviewer/debugging/devops의 4개 항목은 바로 앞에서 다른 owner를 지정한 참조여서, 단순히 현재 폴더 기준으로 풀면 오탐이 된다. 확정 누락은 frontend/UX 두 군데의 `.codexclaw/goalplans/.../090-synthesis.md`다(F11). 스캔 결과와 실제 결함 수를 혼동하지 않는다.

## 미검증 영역

모든 reference 전문의 API 예제를 실행하거나 라이브러리 최신 버전을 전수 대조하지 않았다. dbt/Flink/Kafka, 모바일 프레임워크, CSS 지원표, Mermaid 유형표, 공급망 명령별 현재 인자는 스킬별 개편 때 버전 고정 후 확인한다. `last-verified`가 오래됐다는 사실만으로 기술 오류를 확정하지 않는다.
