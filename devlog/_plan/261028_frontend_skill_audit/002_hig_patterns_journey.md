# 002 — HIG Patterns, Components and Inputs: journey-stage audit checks

Source: sol explorer `hig2` (gpt-6-sol, read-only), 2026-10-28. It read all 25 Patterns
pages, 12 Components pages and 3 Inputs pages through the same JSON endpoint (40 pages,
all HTTP 200). The packet excluded Apple-specific visuals and platform chrome.

Journey stages used: first run/onboarding, discovery/navigation, core task, input/data
entry, waiting/loading, errors/recovery, settings/accounts, help, leaving/returning.

## Raw explorer report (Korean, verbatim)

**HIG의 Patterns 25개 전체, 지정된 Components 12개와 Inputs 3개를 읽었어요.** 아래는 특정 기기의 외형이나 조작법을 제외하고, 웹·앱 제품의 사용자 여정에 적용할 수 있는 감사 항목이에요. 각 J 항목은 원칙과 렌더링된 UI에서 확인할 방법을 함께 적었습니다. 🌸

| 단계 | ID | 원칙 · 관찰 가능한 감사 체크 | HIG |
|---|---|---|---|
| 첫 실행·온보딩 | J-01 | 첫 화면에서 핵심 작업을 바로 시작할 수 있어야 해요. **체크:** 시작 화면이 준비되기 전에 불필요한 소개 화면이나 설정 절차가 가로막는지 확인해요. | [Launching](https://developer.apple.com/design/human-interface-guidelines/launching) |
| 첫 실행·온보딩 | J-02 | 온보딩이 필요하다면 짧고 선택 가능하게 만들고, 실제 행동으로 배우게 해요. **체크:** 건너뛰기와 첫 의미 있는 행동이 가능한지 확인해요. | [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) |
| 첫 실행·온보딩 | J-03 | 계정과 권한은 기능에 필요한 시점에 이유를 설명하며 요청해요. **체크:** 가입 전 체험이 가능한지, 권한 요청이 해당 기능의 맥락에서 나타나는지 확인해요. | [Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts), [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) |
| 탐색·내비게이션 | J-04 | 주요 목적지는 적은 수의 명확한 이름으로 드러내고, 현재 위치를 유지해요. **체크:** 섹션을 오갔다 돌아와도 위치와 작업 맥락이 보존되는지 확인해요. | [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) |
| 탐색·내비게이션 | J-05 | 자주 쓰는 행동은 눈에 띄게 두고 관련 행동끼리 묶어요. **체크:** 주요 명령을 긴 메뉴나 깊은 하위 메뉴 없이 찾을 수 있는지 확인해요. | [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [Menus](https://developer.apple.com/design/human-interface-guidelines/menus) |
| 탐색·내비게이션 | J-06 | 검색 위치와 검색 범위를 명확히 표시해요. **체크:** 검색창을 쉽게 찾을 수 있고, 현재 무엇을 검색하는지 결과와 함께 알 수 있는지 확인해요. | [Searching](https://developer.apple.com/design/human-interface-guidelines/searching) |
| 핵심 작업 | J-07 | 버튼은 실행 결과를 이름과 상태로 예측할 수 있게 해요. **체크:** 버튼의 목적, 누른 상태, 실행 가능 여부가 분명한지 확인해요. | [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) |
| 핵심 작업 | J-08 | 한 화면의 주요 행동에 시각적 우선순위를 주되, 파괴적 행동을 무심코 누르게 만들지 않아요. **체크:** 기본 행동과 삭제 같은 행동이 혼동되지 않는지 확인해요. | [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) |
| 핵심 작업 | J-09 | 표와 차트는 사용자가 수행할 분석에 맞게 고르고, 세부 정보는 필요할 때 열게 해요. **체크:** 단순 조회에는 읽기 쉬운 목록을, 관계 파악에는 설명과 접근 가능한 값이 있는 차트를 제공하는지 확인해요. | [Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data), [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) |
| 핵심 작업 | J-10 | 드래그 작업에는 유효한 목적지와 예상 결과를 보여주고 대체 조작도 제공해요. **체크:** 끌기 중 피드백이 있는지, 키보드나 메뉴로도 같은 작업을 할 수 있는지 확인해요. | [Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop), [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) |
| 입력·데이터 작성 | J-11 | 필요한 정보만 묻고, 선택지와 합리적 기본값으로 입력 부담을 줄여요. **체크:** 불필요한 필드가 없는지, 선택 가능한 값을 자유 입력으로 강요하지 않는지 확인해요. | [Entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data), [Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers) |
| 입력·데이터 작성 | J-12 | 필드의 목적과 오류를 입력하는 자리에서 설명해요. **체크:** 입력 후에도 식별 가능한 레이블, 논리적 탭 순서, 수정 방법이 있는 검증 메시지를 확인해요. | [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields), [Entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data) |
| 입력·데이터 작성 | J-13 | 켜짐·꺼짐 설정은 영향을 받는 대상과 현재 상태를 분명히 해요. **체크:** 토글의 레이블과 상태를 색만으로 판단해야 하는지 확인해요. | [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles) |
| 입력·데이터 작성 | J-14 | 포인터·터치·키보드로 핵심 작업을 일관되게 수행하게 해요. **체크:** 호버나 제스처로만 가능한 행동이 없는지, 키보드만으로 이동·실행할 수 있는지 확인해요. | [Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices), [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards), [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) |
| 기다림·로딩 | J-15 | 기다리는 동안 즉시 상태를 보여주고 가능한 다른 작업은 계속하게 해요. **체크:** 빈 화면 대신 내용의 자리나 상태가 보이고, 관련 없는 조작까지 막히지 않는지 확인해요. | [Loading](https://developer.apple.com/design/human-interface-guidelines/loading) |
| 기다림·로딩 | J-16 | 진행률을 알 수 있으면 정확하게 표시하고, 중단 가능할 때는 취소를 제공해요. **체크:** 진행 표시가 실제 작업과 일치하고 멈춘 상태나 취소 결과를 설명하는지 확인해요. | [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) |
| 오류·복구 | J-17 | 피드백의 방해 정도를 사건의 중요도에 맞춰요. **체크:** 일반 상태는 해당 요소 근처에, 조치가 필요한 중대한 문제만 대화상자에 나타나는지 확인해요. | [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) |
| 오류·복구 | J-18 | 대화상자는 무슨 일이 생겼고 어떤 선택을 할 수 있는지 직접 말해요. **체크:** 모호한 ‘확인’ 대신 결과를 나타내는 버튼과 안전한 취소 경로가 있는지 확인해요. | [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) |
| 오류·복구 | J-19 | 되돌리기의 대상과 결과를 예측하고 확인할 수 있게 해요. **체크:** 삭제·이동 후 복구 수단이 있고, 되돌린 결과가 화면에서 드러나는지 확인해요. | [Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo), [Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop) |
| 설정·계정 | J-20 | 대부분에게 맞는 기본값을 제공하고, 작업에만 영향을 주는 옵션은 그 작업 근처에 둬요. **체크:** 시작 전에 설정을 강요하는지, 보기·필터 옵션을 별도 설정 화면에서만 바꿀 수 있는지 확인해요. | [Settings](https://developer.apple.com/design/human-interface-guidelines/settings) |
| 설정·계정 | J-21 | 계정을 만들 수 있다면 삭제 경로와 처리 상태도 알기 쉽게 제공해요. **체크:** 계정 화면에서 삭제 시작점, 결과, 완료 예상 시점을 찾을 수 있는지 확인해요. | [Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts) |
| 도움말 | J-22 | 도움말은 현재 작업에 가까운 곳에서 짧고 실행 가능하게 제공해요. **체크:** 도움말이 실제 화면의 용어를 쓰며 다음 행동으로 연결되는지 확인해요. | [Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help) |
| 이탈·복귀 | J-23 | 사용자가 떠나도 작업과 위치를 보존하고 복귀 시 이어서 할 수 있게 해요. **체크:** 새로고침·재방문 뒤 작성 내용, 탐색 위치, 재생 지점이 적절히 유지되는지 확인해요. | [Launching](https://developer.apple.com/design/human-interface-guidelines/launching), [Multitasking](https://developer.apple.com/design/human-interface-guidelines/multitasking), [File management](https://developer.apple.com/design/human-interface-guidelines/file-management) |
| 이탈·복귀 | J-24 | 알림과 평가 요청은 중요도와 자연스러운 작업 중단 지점에 맞춰요. **체크:** 진행 중인 작업을 홍보·평가 요청이 끊지 않는지, 알림 종류를 사용자가 관리할 수 있는지 확인해요. | [Managing notifications](https://developer.apple.com/design/human-interface-guidelines/managing-notifications), [Ratings and reviews](https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews) |

**가져오지 못한 페이지:** 없어요. 확인한 JSON 원문은 40개 모두 HTTP 200이었습니다. 위 항목은 HIG를 일반 제품 감사 질문으로 옮긴 것이며, **WCAG 2.2 AA 적합성 판정 자체를 대신하지는 않아요.**

