# 003 — Current skill gap audit (dev-uiux-design and dev-frontend)

Sources: sol explorers `uiux` and `fe` (gpt-6-sol, read-only) on dev @ c12c71c8,
2026-10-28, plus main's own grep. Paths are absolute in the explorer reports.

## Main grep (verified by main)

- No reference in either skill defines a WCAG 2.2 AA conformance pass. Statements are
  scattered: `dev-frontend/references/core/platform-runtime.md:12,22`,
  `dev-frontend/references/core/color-system.md:125-131`,
  `dev-frontend/references/core/korea-2026.md:34,37`,
  `dev-frontend/references/core/a11y-patterns.md:131-133` (Lighthouse score >= 90 used as a
  pass bar), `dev-uiux-design/references/ux-preflight.md:70`,
  `dev-uiux-design/references/color-system.md:73,88`,
  `dev-uiux-design/references/favicon-logo.md:152,319`.
- `favicon-logo.md:319` calls `prefers-reduced-motion` "mandatory (WCAG 2.1 AA)". The
  matching criterion, 2.3.3 Animation from Interactions, is Level AAA (see 005).
- Neither SKILL.md nor any reference routes a multi-cycle design audit to cxc-loop or
  mentions goals. `rg -i 'ulw|ultrawork'` finds nothing in either skill (ulw is out of scope).
- `rg -i 'persona|journey'` finds only product-personality (brand) material, no user
  persona or journey procedure.

## dev-uiux-design explorer report (verbatim)

읽기 전용 감사 결과, **현재 문서는 디자인 방향을 고르는 데는 강하지만 제품 디자인 감사를 재현 가능한 절차로 수행하기에는 부족합니다.** 특히 페르소나·여정·이상 상태를 연결한 기준과, 현재 화면의 결함을 구현팀에 넘길 목록 형식이 없습니다.

| 필요 항목 | 이미 있는 내용 | 빠진 내용과 권장 위치 |
|---|---|---|
| 페르소나 추출 | Design Read가 대상 사용자와 제약을 읽고, 사용자 신호가 미감보다 우선한다고 명시합니다. [design-read.md:36](plugins/codexclaw/skills/dev-uiux-design/references/design-read.md:36), [design-read.md:95](plugins/codexclaw/skills/dev-uiux-design/references/design-read.md:95) | 역할, 목표, 사용 맥락, 숙련도, 접근성 요구, 근거와 추정의 구분이 없습니다. 신호 수집은 `intent-discovery.md`, 결과 필드는 `design-read.md`에 두는 것이 맞습니다. |
| 사용자 여정 | 첫 사용의 첫 유의미한 행동과 빈 화면·오류·로딩의 다음 행동을 다룹니다. [ux-states.md:5](plugins/codexclaw/skills/dev-uiux-design/references/ux-states.md:5), [ux-states.md:40](plugins/codexclaw/skills/dev-uiux-design/references/ux-states.md:40), [ux-states.md:77](plugins/codexclaw/skills/dev-uiux-design/references/ux-states.md:77) | 진입→핵심 과업→성공·실패·복귀까지의 단계, 사용자 기대, 마찰, 이탈 지점이 없습니다. 여정 표준은 `ux-states.md`, 감사 대상 여정 선택은 `design-read.md`에 두세요. |
| 이상 상태 정의 | Design Read는 방향·토큰·밀도 다이얼을 정하고, UX preflight는 전달 전 상태별 통과 여부를 확인합니다. [design-read.md:9](plugins/codexclaw/skills/dev-uiux-design/references/design-read.md:9), [ux-preflight.md:14](plugins/codexclaw/skills/dev-uiux-design/references/ux-preflight.md:14) | 페르소나별 과업 성공 조건과 이상적인 화면·흐름의 관찰 가능한 기준이 없습니다. `design-read.md`에 과업별 목표 상태를 정의하고 `ux-preflight.md`는 그 기준의 출고 확인만 맡기세요. |
| 냉정한 격차 목록 | 현 문서에는 긍정·금지 방향과 이진 사전 점검이 있습니다. [design-read.md:33](plugins/codexclaw/skills/dev-uiux-design/references/design-read.md:33), [ux-preflight.md:3](plugins/codexclaw/skills/dev-uiux-design/references/ux-preflight.md:3) | `현재 상태 → 이상 상태 → 사용자 영향 → 증거 → 심각도 → 수정 방향 → 검증 기준`을 한 행에 기록하는 목록이 없습니다. 감사 산출물 형식은 `design-read.md`, 미해결 중대 격차의 전달 차단 기준은 `ux-preflight.md`가 적합합니다. |
| 콘셉트 수준 anti-slop 위반 | 흔한 기본 미감은 열거되어 있고 콘셉트 판단과 렌더된 UI의 결함 탐지 간 소유권도 분명합니다. [design-read.md:103](plugins/codexclaw/skills/dev-uiux-design/references/design-read.md:103), [role-boundaries.md:5](plugins/codexclaw/skills/dev-uiux-design/references/role-boundaries.md:5) | 위반별 위치, 화면 증거, 도메인 부적합 이유, 대안, 예외 판단을 남기는 목록이 없습니다. `design-read.md`의 감사 결과에 추가하고, `anti-rationalization.md`에는 근거 없이 “의도한 스타일”로 면제하는 지름길을 막는 항목만 더하세요. 구현 단계의 렌더 결함 규칙은 기존 `dev-frontend` 소유입니다. |
| 구현 인계 | 방향 선택 뒤 `dev-frontend`를 읽으라는 경계와 자산 인계 규칙이 있습니다. [role-boundaries.md:5](plugins/codexclaw/skills/dev-uiux-design/references/role-boundaries.md:5), [asset-handoff.md:3](plugins/codexclaw/skills/dev-uiux-design/references/asset-handoff.md:3) | 페르소나·여정·목표 상태·격차·콘셉트 위반·우선순위·검증 기준을 묶어 넘기는 계약이 없습니다. 인계 필드는 `role-boundaries.md`에 정의하고, `dev-frontend`는 이를 받아 구현·렌더 검증하도록 연결하면 됩니다. |

`SKILL.md`는 **63줄, 3,757문자**입니다(`wc -lm`; 바이트는 3,807). 본문 라우팅 표에는 `role-boundaries`, `lazy-user-gate`, `intent-discovery`, `design-read`, `concept-exploration`, `asset-handoff`, `icon-strategy`, `topic-index`의 **8개 행**이 있습니다. [SKILL.md:27](plugins/codexclaw/skills/dev-uiux-design/SKILL.md:27) `references/`에는 **30개 파일**이 있고, `topic-index.md`의 행은 23개입니다. 이 색인은 스타일·패턴·상태·사전 점검 등의 주제별 참조를 나열하며, `design-trends.md`가 두 번 등장합니다. [topic-index.md:5](plugins/codexclaw/skills/dev-uiux-design/references/topic-index.md:5), [topic-index.md:27](plugins/codexclaw/skills/dev-uiux-design/references/topic-index.md:27) 감사 경로를 추가한다면 `SKILL.md`에서 조건을 라우팅하고 `topic-index.md`에는 한 행으로만 색인하면 됩니다.

정리할 오래된 참조도 있습니다. `intent-discovery-ladder.md`와 예시는 현재 `SKILL.md`에 없는 `§1`·`§2`를 가리킵니다. [intent-discovery-ladder.md:4](plugins/codexclaw/skills/dev-uiux-design/references/intent-discovery-ladder.md:4), [design-read-example.md:3](plugins/codexclaw/skills/dev-uiux-design/references/design-read-example.md:3) `anti-rationalization.md`의 `dev-frontend §12`·`§14`도 현재 모듈형 라우팅 표와 맞지 않습니다. [anti-rationalization.md:13](plugins/codexclaw/skills/dev-uiux-design/references/anti-rationalization.md:13), [dev-frontend/SKILL.md:18](plugins/codexclaw/skills/dev-frontend/SKILL.md:18)

**부모가 판단할 부분:** 방향이 불명확할 때 `intent-discovery.md`의 기본 “Liquid Editorial”을 먼저 적용할지, `concept-exploration.md`의 다섯 방향 비교를 먼저 할지 선후가 명확하지 않습니다. [intent-discovery.md:12](plugins/codexclaw/skills/dev-uiux-design/references/intent-discovery.md:12), [concept-exploration.md:38](plugins/codexclaw/skills/dev-uiux-design/references/concept-exploration.md:38) 파일은 수정하지 않았습니다.

## dev-frontend + cxc-qa explorer report (verbatim)

**판정:** 렌더링된 화면을 검사하고 QA 증거를 남기는 규칙은 있지만, 발견한 위반을 ID별로 추적해 수정 전후 증거와 재검증 결과까지 닫는 감사 절차는 아직 연결되어 있지 않아요. 아래는 요청하신 파일만 읽은 결과예요. 파일은 수정하지 않았습니다. 🌸

| 필요한 단계 | 현재 근거 | 공백과 권장 소유 파일 |
|---|---|---|
| 위반 사항 대장 | [anti-slop.md:3](plugins/codexclaw/skills/dev-frontend/references/core/anti-slop.md:3)에 점검 목록과 [개별 규칙 ID](plugins/codexclaw/skills/dev-frontend/references/core/anti-slop.md:403)가 있어요. QA는 [규칙별·영역별 판정](plugins/codexclaw/skills/qa/references/visual-qa.md:95)을 요구합니다. | 발견 건마다 고유 ID, 규칙 ID, 위치, 심각도, 상태, 수정 책임을 기록하는 형식이 없어요. **소유:** `dev-frontend/references/core/anti-slop-enforcement.md`. |
| 위반별 화면 증거 | [visual-verification.md:11](plugins/codexclaw/skills/dev-frontend/references/core/visual-verification.md:11)는 뷰포트·상태별 캡처를, [visual-qa.md:28](plugins/codexclaw/skills/qa/references/visual-qa.md:28)는 캡처를 다시 열어 확인하도록 해요. [evidence-contract.md:3](plugins/codexclaw/skills/qa/references/evidence-contract.md:3)는 시나리오별 보관 경로를 정합니다. | **각 위반 ID**에 정확한 경로·뷰포트·상태·영역·스크린샷을 묶는 규칙이 없어요. **소유:** 캡처 절차는 `visual-verification.md`, 증거 스키마는 `qa/references/evidence-contract.md`. |
| 수정 전후 쌍과 판정 규칙 | [render-grounding.md:3](plugins/codexclaw/skills/dev-frontend/references/core/render-grounding.md:3)은 실제 렌더 관찰→수정→재실행을 요구하고, [visual-qa.md:39](plugins/codexclaw/skills/qa/references/visual-qa.md:39)는 기준 이미지가 있을 때 픽셀 비교를 허용해요. | 동일 경로·뷰포트·상태의 **before/after 쌍**, 위반별 검증 명령과 명시적 통과 조건은 없어요. **소유:** `visual-verification.md`; QA 판정 기록은 `qa/references/evidence-contract.md`. |
| 수정 후 재검증 | [visual-qa.md:61](plugins/codexclaw/skills/qa/references/visual-qa.md:61)은 마지막 편집 이후 캡처만 최종 PASS의 근거로 인정해요. [evidence-contract.md:23](plugins/codexclaw/skills/qa/references/evidence-contract.md:23)는 실행하지 못한 시나리오를 FAIL로 기록합니다. | 대장의 모든 위반 ID가 새 캡처와 검증 결과로 닫혀야 한다는 종료 조건이 없어요. **소유:** `visual-verification.md`, 최종 증거 규칙은 `qa/references/evidence-contract.md`. |
| PR 전후 비교 | [visual-verification.md:141](plugins/codexclaw/skills/dev-frontend/references/core/visual-verification.md:141)은 보고서에 스크린샷 경로를 요구해요. | PR 본문에 위반 ID별 전후 이미지와 검증 결과를 싣는 계약은 요청 범위의 파일에 없어요. **소유:** `dev-frontend/references/core/visual-verification.md`에 디자인 감사용 PR 섹션을 정의하고, PR 일반 규칙과의 연결은 부모가 판단하면 됩니다. |
| 여러 차례 감사 반복 | [iterative-design.md:26](plugins/codexclaw/skills/dev-frontend/references/core/iterative-design.md:26)는 디자인 변형을 반복하는 절차예요. [durable-goalplan.md:8](plugins/codexclaw/skills/loop/references/durable-goalplan.md:8)는 HOTL 목표와 지속 계획을, [durable-goalplan.md:66](plugins/codexclaw/skills/loop/references/durable-goalplan.md:66)은 증거를 가진 기준을 정의해요. | 창의적 변형 반복과 **위반 수정 감사 반복**의 라우팅이 구분되지 않아요. `dev-frontend/SKILL.md`의 [모듈 라우팅 표](plugins/codexclaw/skills/dev-frontend/SKILL.md:18)에 다회 감사 시 `cxc-loop`로 넘기는 조건을 두는 편이 명확해요. |

`cxc-loop add-criterion --surface web`은 웹 시나리오를 목표 기준으로 등록합니다([durable-goalplan.md:95](plugins/codexclaw/skills/loop/references/durable-goalplan.md:95)). 해당 기준의 충족에는 새 증거가 필요하고([durable-goalplan.md:75](plugins/codexclaw/skills/loop/references/durable-goalplan.md:75)), 기록된 final gate가 있는 계획에서는 웹 기준에 QA 영수증이 요구돼요([durable-goalplan.md:71](plugins/codexclaw/skills/loop/references/durable-goalplan.md:71)). `cxc-qa`는 시나리오별 `verdict.json`을 검증해 집계 영수증을 생성하지만([evidence-contract.md:44](plugins/codexclaw/skills/qa/references/evidence-contract.md:44)), 현재 final gate가 그 경로를 자동 발견하지 못해 `finalGate.qaReceiptPath` 연결이 필요합니다([evidence-contract.md:62](plugins/codexclaw/skills/qa/references/evidence-contract.md:62)).

**부모에게 남길 판단:** 위반 ID마다 QA 시나리오를 만들지, 여러 위반을 화면·상태별 시나리오에 묶을지 정해야 해요. 현재 증거 계약은 시나리오 단위여서 이 매핑을 정해야 대장과 영수증을 일관되게 연결할 수 있습니다.

