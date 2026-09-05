# F01–F21 패치 처분

기준은 이전 audit의 source baseline이다. 설치 캐시·개인 skill은 이 작업에서 바꾸지 않았다. 아래는 적용된 변경이고, 최종 통합 감사 결과는 004에 추가한다.

| ID | 적용한 owner/consumer | 처분 |
|---|---|---|
| F01 | dev §0.1/§4, pabcd, scaffold implementation-log | 자동 기록 예외 통일; 명시 user/release 기록 계약은 보존 |
| F02 | dev/browser-routing, search/blocked-reader, testing, qa, frontend | Aside 선호·agbrowse 권장·가용 native 대체; built-UI 금지와 blind retry 제거 |
| F03 | diagram router/reference/upstream | frozen 계약 복제 제거; 현재 host skill 위임 및 fallback |
| F04 | security router/asvs-checklist | 공식 v5.0.0_release V6/V7, requirement evidence와 자체 checklist 구분; assurance 목표 보존 |
| F05 | React stack reference | 고정 icon pair 제거, 선택한 Design Read 소비 |
| F06 | UX inference/redesign arithmetic | simple의 상반된 density 산술 제거 |
| F07 | dev, architecture/checklist, reviewer | 수치만으로 blocker 승격 금지, 응집도·위험 근거 요구 |
| F08 | dev router | OLTP/backend와 analytics/data 분리 |
| F09 | debugging method + compact summary | 관련 검증만, 추가 발견과 수정 권한 분리 |
| F10 | scaffolding verification | docs/module/runnable scaffold 구분 |
| F11 | frontend/UX reference tables | private goalplan 대신 shipped dated-trend reference |
| F12 | architecture body/matrix/checklist/tree | shape parsing과 domain/state invariant 및 authz 분리 |
| F13 | backend checklist, data, api-design reference | existing/protocol contracts, error model, HTTP204 무본문 보존 |
| F14 | dev ESM rule | ESM 선호와 CJS interop/최적화 별도 검증 |
| F15 | data query guidance | non-executing EXPLAIN 우선; ANALYZE 실행·권한·격리·외부 부작용 명시 |
| F16 | debugging core + compact summary | 승인된 가역 완화와 영구 수정 RCA 순서 구분 |
| F17 | diagram current contract/render verification | primary interaction 실제 확인 |
| F18 | React reference + reviewer | Compiler 활성화·범위·profiler 기준으로 memo 판단 |
| F19 | devops image/lifecycle + security | 엄격한 image gate 유지, 일반 예외가 면제하지 못함; 외부 설정/automation 권한 별도 |
| F20 | scaffold language/name tables | importable Python package를 repo 폴더명과 분리 |
| F21 | pabcd/interview/dispatch/host matrix/diagram | actual schema/capability 기반; unsupported field 생략, format만으로 C1 단정하지 않음 |

부가 처분: Rust module/Cargo graph 단정, data 고정 배속, backend queue/connection 수치의 적용 범위를 보완했다. OTel 상태·Gateway 공식 권고는 유지했다. 나머지 모든 라이브러리 reference를 최신 버전으로 실행한 전수 인증은 아니다.

## 검증 경계

기존 6개 metadata 검사 + 새로운 helper regression1개(9개의 shell 호출), YAML17, exact-plan delivery, 새 상대 link 존재 확인, 독립 의미/시나리오 검토를 사용했다. Windows에서 실제 실행하지 않았으며 설치된 plugin을 갱신하지 않았다. source commit을 배포/릴리스 완료로 바꾸어 말하지 않는다.
