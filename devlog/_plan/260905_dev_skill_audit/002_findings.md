# 모순·기술 오류·정책 질문 원장

확인일: 2026-09-05. 기준 SHA는 `000_plan.md`와 같다. **내부 충돌 10건, 외부 계약/기술 오류 4건, 범위·최신성 보완 5건, 정책 질문 2건**으로 분류했다. 중요도는 수정 순서를 위한 위험 판단이지 자동 merge 판정이 아니다. 이번에는 어떤 정책도 바꾸지 않았다.

## F01 — 사소한 수정의 기록 의무가 서로 반대다

- 유형: 내부 충돌 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev/SKILL.md:48`은 C0 기록 면제, C1은 기존 unit이 있을 때만 기록. `plugins/codexclaw/skills/pabcd/SKILL.md:258`은 C0/C1 모두 기록하고 unit이 없으면 생성하도록 한다. `plugins/codexclaw/skills/dev-scaffolding/references/implementation-log.md:75`도 후자를 따른다.
- 재현 입력: devlog 관례가 있는 저장소에서 오타 한 글자를 고친다. owner를 따라 읽으면 기록 생략, PABCD를 따라 읽으면 새 문서가 생긴다.
- 반증 확인: PABCD를 생략한다는 조건과 기록을 생략한다는 조건은 다르다. 두 문장 모두 기록 자체를 명시하므로 단순한 과정 깊이 차이로 설명되지 않는다.
- 수정 후보: C0/C1 예외를 `dev` 한 곳에 두고 나머지는 포인터로 만든다. 어떤 예외를 채택할지는 Q01.

## F02 — 로컬 UI 검증의 browser 우선순위 충돌

- 유형: 내부 충돌 / Medium / verified. 로컬 browser skill과의 통합 경계다.
- 근거: `plugins/codexclaw/skills/dev-testing/SKILL.md:195`의 QA ladder는 native 우선이며 200줄은 agbrowse의 built-UI driving을 금지한다. `/Users/jun/.codex/skills/agbrowse-browser/SKILL.md:164`의 QA routing은 같은 작업에 agbrowse 우선을 요구한다.
- 재현 입력: localhost UI에서 버튼 한 번 눌러 확인. 같은 작업에 agbrowse를 쓰라는 규칙과 쓰지 말라는 규칙이 함께 활성화된다.
- 별도 충돌: browser skill 44–48줄은 프로젝트에 `playwright-core` 설치를 안내하지만 `plugins/codexclaw/skills/dev/SKILL.md:165`는 ad-hoc QA용 driver 설치를 금지한다. 이번 조사에서는 설치하지 않았다.
- 반증 확인: public-web proof와 local QA의 서로 다른 ladder 자체는 모순이 아니다. 문제는 local QA 두 owner의 충돌이다.
- 수정 후보: 목적별 canonical owner와 현재 도구 가용성 fallback을 정한다. Q02.

## F03 — diagram의 내장 visualize 계약이 설치본과 다르다

- 유형: 외부 계약 오류 / High / verified.
- 근거: `plugins/codexclaw/skills/dev-diagram-viewer/upstream/visualize-upstream.md:10`은 1.0.11. `plugins/codexclaw/skills/dev-diagram-viewer/reference/visualize-contract.md:54`는 2 MB, 74줄은 `::codex-inline-vis`를 사용한다.
- 현재 설치본: `/Users/jun/.codex/plugins/cache/openai-bundled/visualize/1.0.29/skills/visualize/SKILL.md:68`은 1 MB. 82–87줄은 executor 절대 경로를 담은 visualization content reference를 요구한다. 40–51줄의 파일 위치 조건도 다르다.
- 실행 증거: `bash plugins/codexclaw/skills/dev-diagram-viewer/upstream/sync-check.sh` → exit 1, `1.0.11 -> 1.0.29`, 양쪽 hash 불일치.
- 재현 입력: 1.5 MB fragment를 옛 directive로 전달한다. 내장 계약에는 맞아도 현재 상류 계약을 만족하지 못한다.
- 한계: 실제 앱에서 렌더 실패까지 재현하지 않았다. 확정한 것은 **계약 불일치**이며 모든 구문이 즉시 실패한다고 주장하지 않는다.
- 수정 후보: 복사 계약을 갱신하거나 현재 skill로 위임. Q12.

## F04 — ASVS 5.0 이름 아래 장 번호와 자체 기준이 섞였다

- 유형: 외부 계약 오류 / High / verified.
- 근거: `plugins/codexclaw/skills/dev-security/references/asvs-checklist.md:1`은 ASVS 5.0이라 표기하지만 15줄은 V2 Authentication, 24줄은 V3 Session Management다. `plugins/codexclaw/skills/dev-security/SKILL.md:123`도 V2/V3를 가리킨다.
- 공식 5.0 원문 S07/S09에서는 인증이 V6, 세션이 V7이다. 공식 원문의 requirement ID와 자체 체크리스트 항목도 1:1 연결돼 있지 않다.
- 재현 입력: 이 체크리스트를 모두 통과한 후 “ASVS 5.0 L2 통과”라고 보고한다. 어떤 공식 requirement를 검증했는지 추적할 수 없다.
- 반증 확인: 항목 상당수는 유효한 보안 관행이다. 관행이 나쁘다는 뜻이 아니라, **공식 표준의 번호·레벨 준수 증거로 사용할 수 없다는 뜻**이다.
- 수정 후보: 자체 checklist임을 명시하고 공식 version + requirement ID + applicability + evidence 매핑을 별도로 둔다. Q07.

## F05 — React 참조가 UX에서 고른 icon library를 막는다

- 유형: 내부 충돌 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-uiux-design/SKILL.md:402`은 density별 Iconoir/Hugeicons/Untitled UI/Lucide 등을 허용. `plugins/codexclaw/skills/dev-frontend/SKILL.md:231`도 선택한 library 구현을 허용한다. 반면 `plugins/codexclaw/skills/dev-frontend/references/stacks/react.md:199`는 Phosphor 또는 Radix import만 정확히 쓰라고 한다.
- 재현 입력: 기존 DESIGN.md가 Iconoir를 선택한 React 앱. router는 유지, stack reference는 교체를 요구한다.
- 반증 확인: React 참조 문장은 예시 코드가 아니라 `EXACTLY` 명령이다. 기존 디자인 시스템 우선이라는 상위 규칙과 충돌한다.
- 수정 후보: stack reference의 고정 library 목록을 제거하고 Design Read 결정값을 소비. Q10.

## F06 — “간단하게”의 density 방향이 한 문서 안에서 반대다

- 유형: 내부 충돌 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-uiux-design/SKILL.md:237`은 simple이면 세 dial 모두 감소. 266줄은 variance/motion만 감소하고 density는 유지하거나 증가.
- 재현 입력: 밀집 도구를 “좀 더 간단하게” 바꿔 달라는 요청. 앞 규칙은 밀도 감소, 뒤 규칙은 유지/증가.
- 반증 확인: STYLE_SAMPLE이라 강제가 아니더라도 동일 입력의 추론 안내가 갈린다는 문제는 남는다. 어느 쪽도 UX 표준이라고 주장하지 않는다.
- 수정 후보: 정보량, 조작 횟수, 장식량을 구분해 질문하고, density를 자동 산술로 바꾸지 않는다. Q11.

## F07 — 파일 길이의 예외 허용과 blocker가 엇갈린다

- 유형: 내부 충돌 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-architecture/SKILL.md:79`와 `plugins/codexclaw/skills/dev/SKILL.md:268`은 400줄 기준을 DEFAULT로 두고 사유가 있으면 초과 허용. `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:167`은 500줄 초과를 이미 쪼개는 중이 아니면 blocking finding으로 정한다.
- 재현 입력: 하나의 응집된 parser가 520줄이고 분리하지 않는 이유가 기록됨. architecture에서는 허용 가능하지만 reviewer는 blocker로 만든다.
- 반증 확인: 변경량 500줄 제한과 **파일 길이 500줄** 제한은 다른 규칙이다. 여기서는 후자만 문제 삼는다.
- 수정 후보: 길이는 검토 신호, 실제 위험은 trigger/impact로 판단할지 결정. Q08.

## F08 — DB router가 OLTP를 data로 보내고 data는 되돌린다

- 유형: 내부 충돌 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev/SKILL.md:140`의 Database/schema/data → dev-data. `plugins/codexclaw/skills/dev-data/SKILL.md:28`은 app CRUD/OLTP/transactional schema에는 활성화하지 말고 backend DB reference를 읽으라고 한다.
- 재현 입력: 주문 테이블 인덱스 수정. hub 경로와 owner의 활성화 금지가 동시에 걸린다.
- 수정 후보: OLTP/schema/migration과 analytics/ETL/backfill을 hub부터 분리. Q05.

## F09 — 디버깅 지침이 최소 검증·수정 범위를 다시 넓힌다

- 유형: 내부 충돌 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-testing/SKILL.md:371`은 C0/C1에 작은 검증만 요구. `plugins/codexclaw/skills/dev-debugging/SKILL.md:192`와 240줄은 full suite를 요구하고, 196줄은 같은 유형의 모든 인스턴스를 고치라고 한다.
- 재현 입력: 한 모듈의 버그 하나를 고치도록 허용된 작업. 해당 테스트로 끝낼지 전체 suite와 인접 수정까지 할지 달라진다.
- 반증 확인: 같은 유형을 **찾는 것**은 좋은 점검이다. 발견한 모든 곳을 고칠 권한까지 생기는 것은 아니다. 사용자 지시가 로컬 suite를 금지하면 그 지시가 우선한다.
- 수정 후보: class/risk별 verification owner로 위임하고 추가 발견은 보고와 수정 권한을 분리. Q09.

## F10 — 문서 scaffold에도 설치·빌드 완료를 요구한다

- 유형: 범위 보완 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-scaffolding/SKILL.md:3`은 documentation scaffolding까지 활성화. 324–336줄은 post-scaffold에 dependency install/build/test/lint/두 번째 실행을 요구하며 실패하면 incomplete로 취급. `plugins/codexclaw/skills/dev/SKILL.md:116`은 docs-only에 code gate가 없다고 명시한다.
- 재현 입력: 이번처럼 기존 unit 관례로 조사 문서만 추가. 제품 설치·빌드는 문서 타당성을 관찰하지 못한다.
- 반증 확인: 앱을 생성하는 scaffold에는 적절하다. heading에 runtime scaffold 조건이 빠진 범위 누수다.
- 수정 후보: docs/module/app/deploy scaffold 별 적용 gate를 나눈다. Q13.

## F11 — 디자인 예외 근거가 배포되지 않는 goalplan 경로다

- 유형: 외부 계약 오류 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-frontend/SKILL.md:39`, `plugins/codexclaw/skills/dev-uiux-design/SKILL.md:78`의 `../../../../.codexclaw/goalplans/.../090-synthesis.md`가 checkout에서 존재하지 않는다. `.gitignore:4`는 `.codexclaw/`를 제외한다.
- 재현 입력: 새 checkout에서 award 기반 예외를 판단하기 위해 참조를 연다. 근거 파일이 없다.
- 반증 확인: 일반 devlog 경로나 owner를 앞 문장에서 지정한 상대경로와 다르다. 여기서는 직접 연결된 goalplan 파일이 실제로 없다. 다른 사람 기계에도 반드시 없다고 단정하지는 않는다.
- 수정 후보: 필요한 근거를 배포되는 reference로 옮기거나 안정된 공개/저장소 URL을 사용. Q10.

## F12 — 도메인 불변식 검사와 중복 입력 검증이 같은 금지로 묶인다

- 유형: 내부 충돌 / High / verified.
- 근거: `plugins/codexclaw/skills/dev-architecture/SKILL.md:241`은 in-process domain entity constructor validation을 금지. `plugins/codexclaw/skills/dev-testing/SKILL.md:307`은 domain invariants를 허용 guard로 열거한다.
- 재현 입력: 이미 number로 parsing된 시작·종료 값으로 기간 객체를 만들 때 `start <= end`를 검사한다. 타입 모양은 유효해도 도메인 상태는 잘못될 수 있다.
- 반증 확인: architecture의 보안·deserialization 예외는 일반 도메인 불변식 예외가 아니다. 모든 함수에 schema 검사를 반복하자는 뜻도 아니다.
- 수정 후보: 입력 parsing, domain invariant, authz, 내부 assertion의 정의와 owner를 나눈다. Q03.

## F13 — backend 예외가 data·최종 checklist에서 사라진다

- 유형: 범위 보완 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-backend/SKILL.md:310`은 기존 계약과 GraphQL/gRPC/SSE envelope 예외를 허용. `plugins/codexclaw/skills/dev-data/SKILL.md:374`는 frontend용 data API에 standard envelope를 의무화한다. backend 271줄은 기존 오류 관례 우선인데 420줄은 AppError hierarchy를 checklist로 다시 고정한다.
- 재현 입력: 기존 GraphQL 분석 API나 Result 기반 API. 상위 예외를 모르는 checklist만 읽으면 계약을 바꾸게 된다.
- 반증 확인: 상위 예외를 상속한다고 해석하면 해결 가능하다. 그래서 직접 기술 오류가 아니라 **예외 상속의 모호함**으로 분류했다.
- 수정 후보: checklist에도 applicable 조건을 남기고 별도 규칙을 복제하지 않는다. Q04.

## F14 — CommonJS에 관한 선호와 기술 사실이 섞였다

- 유형: 범위 보완 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev/SKILL.md:291`은 ESM을 의무화하면서 CommonJS require가 tree-shaking과 static analysis를 깨뜨린다고 일반화한다.
- 원문 확인: S01의 Node 문서는 ESM/CommonJS 상호운용과 동기 ESM에 대한 require 지원을 설명한다. Node 지원 여부는 bundler 최적화 보장을 의미하지 않는다.
- 재현 입력: CJS가 필수인 도구 설정 또는 기존 CJS 저장소. 기존 관례와 runtime 계약을 확인하지 않고 ESM으로 바꿀 수 있다.
- 반증 확인: 정적 ESM이 최적화에 유리하다는 취지를 부정하지 않는다. **모든 static analysis가 불가능하다는 근거는 아니며**, 라이브러리·실행기 조건이 빠져 있다.
- 수정 후보: ESM은 새 코드의 조건부 선호로, 호환성은 실제 런타임·번들러로 확인. Q01/Q03.

## F15 — EXPLAIN ANALYZE를 읽기 전용 진단처럼 일반화할 위험

- 유형: 외부 계약 오류 / High / verified.
- 근거: `plugins/codexclaw/skills/dev-data/SKILL.md:347`은 production query마다 EXPLAIN ANALYZE를 요구하지만 write query의 실행 부작용과 환경 제한을 적지 않는다.
- 공식 원문 S04: ANALYZE는 쿼리를 실제 실행하며 SELECT도 함수 등의 부작용이 있을 수 있다. 쓰기문은 영향 방지 예제로 transaction/rollback을 제시한다.
- 재현 입력: UPDATE 기반 backfill의 비용을 조사한다며 production에서 EXPLAIN ANALYZE 실행. 조사만 허용받았어도 데이터가 바뀔 수 있다.
- 반증 확인: replica/fixture에서 실행한다는 범위가 있으면 문제를 피한다. 현재 문장은 환경을 지정하지 않는다. rollback도 외부 부작용 전체를 보장하는 만능 안전장치는 아니다.
- 수정 후보: 기본 EXPLAIN과 실제 실행 프로파일링을 나누고 후자는 쓰기 권한·격리·부작용 검토를 요구. Q05.

## F16 — 장애 완화와 원인 조사 순서가 충돌한다

- 유형: 내부 충돌 / High / verified.
- 근거: `plugins/codexclaw/skills/dev-debugging/SKILL.md:37`은 어떤 fix 제안보다 RCA 완료를 먼저 요구. `plugins/codexclaw/skills/dev-devops/SKILL.md:366`은 active incident에서 mitigation first, diagnosis second.
- 재현 입력: 장애가 진행 중이고 이미 검증된 rollback 경로가 있다. 한쪽은 원인 입증을 기다리고 다른 쪽은 승인된 완화를 먼저 한다.
- 반증 확인: 영구 수정과 가역적 완화가 다른 행위라고 정의하면 양립 가능하다. 현재 debugging의 core principle에는 이 구분이 없다.
- 수정 후보: incident mitigation 예외를 명시하되 배포·rollback 권한을 자동 부여하지 않는다. Q09.

## F17 — interactive diagram의 최초 상호작용 검증이 빠진다

- 유형: 내부 충돌 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-diagram-viewer/SKILL.md:411`은 interaction verification optional. `plugins/codexclaw/skills/pabcd/SKILL.md:184`는 stateful artifact의 첫 상호작용까지 실행하도록 한다. 현재 visualize 1.0.29 70줄도 primary interaction 갱신 확인을 요구한다.
- 재현 입력: slider가 있는 차트가 처음만 렌더되고 slider callback이 깨짐. 그림만 본 검증은 통과하지만 상태 전환 검증은 실패한다.
- 수정 후보: static/render/interactive의 검증 범위를 나누고 사용자에게 약속한 상호작용은 확인한다. Q12.

## F18 — React Compiler를 약속한 router와 실제 참조의 깊이가 다르다

- 유형: 범위·최신성 보완 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-frontend/SKILL.md:335`은 Compiler를 React reference로 보낸다. 그러나 `plugins/codexclaw/skills/dev-frontend/references/stacks/react.md:219`의 memo 안내에는 compiler 설정 여부의 분기가 없다. `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:275`도 rerender 대응으로 memo를 먼저 나열한다.
- 공식 원문 S02: Compiler가 활성화된 경우 component memoization을 자동 적용한다. Compiler 미사용 프로젝트에서 수동 memo가 쓸모없다는 뜻은 아니다.
- 반증 확인: React reference 220줄은 수동 useMemo를 측정 뒤 쓰라고 제한한다. 이 좋은 조건은 유지해야 한다. 진단은 “memo 전부 제거”가 아니라 **compiler 상태를 확인하는 안내 부족**이다.
- 수정 후보: 설치 버전·compiler 활성화·측정 결과를 먼저 읽는다. Q10.

## F19 — 취약점 예외와 저장소 설정 변경의 정책 경계

- 유형: 정책 질문 / Medium / verified text, intent unresolved.
- 근거: `plugins/codexclaw/skills/dev-devops/SKILL.md:77`은 image HIGH/CRITICAL 무예외 차단. `plugins/codexclaw/skills/dev-security/references/asvs-checklist.md:90`은 owner/기한/완화책을 둔 예외를 허용. `plugins/codexclaw/skills/dev-security/references/supply-chain-sbom.md:125`도 기한 있는 예외를 언급한다.
- 반론: image gate만 의도적으로 더 엄격할 수 있으므로 이를 확정 모순으로 세지 않는다. 그 차이를 문서화할지 Q06/Q07에서 결정한다.
- 별도 권한 위험: devops 216줄은 branch auto-delete 설정과 scheduled automation을 의무화한다. 유지보수 권고가 외부 설정 변경 권한까지 뜻하지는 않는다. 조사·리뷰 요청에서는 실행하지 않아야 한다.

## F20 — Python package 폴더에 kebab-case를 적용한다

- 유형: 범위 보완 / Medium / verified.
- 근거: `plugins/codexclaw/skills/dev-scaffolding/SKILL.md:186`은 Python feature folder를 kebab-case로 만들고 `__init__.py`를 둔다. 200줄의 일반 폴더 규칙도 같다.
- 공식 원문 S05: module/package는 짧은 lowercase 이름을 사용한다. module의 가독성을 위해 underscore를 허용하며 package에는 underscore도 권장하지 않는다. hyphen을 dotted import 식별자로 쓰는 일반 Python package 예제가 아니다.
- 재현 입력: `order-items/__init__.py`를 만든 뒤 일반 import 문으로 해당 package를 불러오려 한다. 프로젝트 디렉터리 이름과 importable package 이름은 구분해야 한다.
- 반증 확인: distribution 이름이나 import하지 않는 최상위 디렉터리에는 hyphen을 쓸 수 있다. 모든 폴더의 hyphen이 오류라는 주장이 아니다.
- 수정 후보: language별 importable package 명명과 repo 디렉터리 명명을 분리. Q13.

## F21 — 도구 이름·분류·가용성의 고정 계약

- 유형: 정책 질문 / Medium / observed, broader support unresolved.
- 근거: `plugins/codexclaw/skills/pabcd/SKILL.md:163`은 `agent_type: explorer`를 지정하도록 하지만 이번 호스트의 실제 spawn schema에는 agent_type이 없다. `structure/60_native_capabilities.md:88`의 update_plan도 이번 callable inventory에는 없다. `plugins/codexclaw/skills/dev-diagram-viewer/SKILL.md:339`는 CDN script 포함 diagram을 항상 C1로 분류하지만 dev의 dependency/security 승격과 조건을 맞춰야 한다.
- 반증 확인: 다른 Codex surface에는 해당 필드·도구가 존재할 수 있다. 전역 삭제가 아니라 **현재 callable schema 확인 후 지원 기능만 사용**하는 원칙이 필요하다.
- 이번 처리: 지원하지 않는 필드는 보내지 않았고 별도 read-only packet으로 감사 범위를 제한했다. native plan 도구가 없어서 devlog와 goalplan을 사용했으며 도구를 호출했다고 주장하지 않았다.
- 수정 후보: host capability adapter와 sample/version 표를 분리. Q02/Q12.

## Q 및 보류 항목 — 확정 오류로 세지 않은 것

- Q03: `dev-architecture/references/circular-dependencies.md:53`의 Rust module/cargo dependency 설명은 계층 구분이 필요해 보인다. 이번에는 Rust 재현·공식 원문 대조를 하지 않았으므로 unverified.
- Q04: backend의 5초 queue 전환, SSE 6개, fixed reconnect 수치는 제품/HTTP 버전/인프라에 따라 달라질 수 있다. 각각을 최신 표준이라고 확정하지 않는다.
- Q05: `dev-data/SKILL.md:287`의 Polars 5–10배 문구에는 데이터·버전·benchmark 출처가 없다. 수치의 일반성은 unverified이며 반대 수치를 만들어 대체하지 않는다.
- Q07: cookie 기본값과 CSRF의 연결을 보강할 후보. S03은 SameSite만으로 대부분의 CSRF 방어를 대체할 수 없다고 설명한다. 기존 OWASP reference에 CSRF cookie 설정이 있으므로 “bundle 전체에 CSRF가 없다”고 주장하지 않는다.
- search 본문 70줄의 PRIMARY와 281줄의 OPT-IN/옛 rung 번호는 같은 파일의 drift다. 스킬이 설치 필수라는 뜻인지 runtime 선택이라는 뜻인지 구분해 함께 정리할 후보로 남긴다.

## 반증 때문에 제외한 주장

- OTel JS/Python logs가 아직 Development라는 backend 안내: S08 원문과 일치. 오래된 날짜만 보고 잘못됐다고 판정하지 않았다.
- Kubernetes가 Gateway API를 권고한다는 설명: S06과 일치. 다만 공식 문서는 Ingress 제거 계획이 없다고 밝힌다. 신규 사용 금지는 로컬 정책이며 Kubernetes의 사용 불가 선언이 아니다.
- 6개 missing-link 후보 모두 broken이라는 주장: 4개는 owner-qualified pointer의 기계 오탐이다.
- dev 파일 400줄 초과 자체를 전부 결함으로 세는 주장: 본문 분할 여부는 의도·응집도·컨텍스트 비용을 판단해야 한다.
