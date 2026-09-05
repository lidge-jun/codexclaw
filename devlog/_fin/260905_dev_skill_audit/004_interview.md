# 스킬별 인터뷰 준비

상태: 조사 완료 후 사용할 질문 목록. **답변은 아직 없다. 정책은 승인되지 않았다.** 목록을 한 번에 질문하지 않고, 답변에 따라 다음 스킬의 질문을 다시 고른다.

## 알려진 것

- 목표: dev family를 하나씩 최신화한다.
- 순서: 전체 조사·devlog 문서화 → 사용자 인터뷰 → 선택한 스킬의 수정 계획.
- 제약: 이번 cycle은 문서만 변경. 시작 시 worktree 변경은 없었다. 재검사에서 source/설치본 189개 중 185개가 같고 diagram 4개가 달랐다. 설치본 상태를 저장소 baseline과 구분한다.
- 성공 기준: 서로 충돌하는 명령을 줄이고 실제 가능한 도구·공식 계약에 맞춘다. 취향을 기술 오류로 취급하지 않는다.
- 약한 차원: Constraint/Ontology. 공통 의무·예외·분야별 선택권의 경계를 아직 정하지 않았다.

## 첫 질문 — dev의 C0/C1 기록 정책

근거 F01: dev는 작은 수정 기록을 면제하고 PABCD/scaffolding은 의무화한다.

제안: 오타·주석처럼 동작이 안 바뀌는 C0은 devlog를 생략하고, C1은 기존 unit이 있을 때만 짧게 기록한다. 새 추상화·보안·데이터 위험이 있으면 예외 대상이 아니다.

질문: **이 C0/C1 예외를 공통 규칙으로 통일할까?**

추천 이유: 현재 dev의 class별 깊이를 유지하고 같은 작은 수정에 서로 다른 문서 의무가 걸리지 않게 한다. 아직 선택은 아니다. 모든 작업을 기록하려는 의도라면 반대 방향으로 통일할 수 있다.

## 이후 질문 순서

순서는 빠른 수정/어려운 수정이 아니라 의존 관계를 따른다. 공통 규칙과 도구 경계를 먼저 정해야 분야별 문장을 그 기준으로 고칠 수 있다. 아래는 **인터뷰 순서**이며 미승인 구현 workPhases가 아니다.

| 질문 | 주 대상 | 결정할 경계 | 연결 근거 |
|---|---|---|---|
| Q01 | dev | C0/C1 기록 예외, 공통 STRICT와 프로젝트 선호의 분리 | F01/F14 |
| Q02 | dev-testing + search/browser | public proof / local QA / 로그인 브라우저의 owner와 fallback | F02/F21 |
| Q03 | dev-architecture | schema parsing·도메인 불변식·authz·내부 assertion 구분, 규모 수치의 성격 | F07/F12 |
| Q04 | dev-backend | 기존 envelope·오류 관례를 유지할 조건, queue/connection 숫자의 지위 | F13/F14 |
| Q05 | dev-data | OLTP/분석 분리, 실쿼리 진단 권한, 성능 수치의 benchmark 근거 | F08/F15 |
| Q06 | dev-devops | 배포·설정·자동화 권한, image vulnerability 예외 정책 | F16/F19 |
| Q07 | dev-security | 자체 checklist와 ASVS 준수 증거 분리, cookie/CSRF 적용 항목 | F04/F19 |
| Q08 | dev-code-reviewer | 파일 길이만으로 blocker를 만들지, risk 근거를 요구할지 | F07/F18 |
| Q09 | dev-debugging | 진단과 수정, incident mitigation, 추가 발견의 수정 범위 | F09/F16 |
| Q10 | dev-frontend | stack reference의 고정 icon 제거, compiler 조건, 예외 근거 배포 | F05/F11/F18 |
| Q11 | dev-uiux-design | simple/density 의미, 기본 kit·생성 개수·dial을 예시로 둘 범위 | F06 |
| Q12 | dev-diagram-viewer | 현재 visualize 위임 vs 복사 계약 유지, interaction 최소 검증 | F03/F17/F21 |
| Q13 | dev-scaffolding | docs/app scaffold 분리, 언어별 package 명명, 공통 unit 정책 상속 | F01/F10/F20 |

dev-testing은 Q02의 도구 역할뿐 아니라 Q09에서 class별 검증 깊이의 owner로 다시 확인한다. 한 답이 다른 질문의 전제를 바꾸면 해당 질문은 고쳐서 묻는다.

## 답변 처리

1. 사용자 답변을 known/decision으로 기록한다. 추천 문장을 답변으로 취급하지 않는다.
2. 연결 finding과 owner·consumer를 다시 대조한다.
3. 충돌이 해소되지 않았으면 다음 구현으로 넘어가지 않는다.
4. 선택한 스킬의 실제 diff·검증 범위를 계획하고 승인 경계를 확인한다.
5. 캐시 설치본 수정이나 release는 별도 요청 없이는 하지 않는다.

## 미결정 항목

- 개인용 강한 취향을 보존할 영역과 범용 기본 규칙을 나눌 영역.
- 상류 계약을 복사해 고정할지, 동적으로 읽을지.
- 오래된 source provenance를 어느 주기·사건에 다시 검증할지.
- 문서 감사의 수동 판단과 자동 검증을 어디서 나눌지. 문구 존재 테스트로 의미 검증을 흉내 내지 않는다.
