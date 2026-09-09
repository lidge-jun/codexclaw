# 041 — wp1 인도 영수증

작성 2026-09-09. wp1 = W2 승인 게이트 훅과 `memories.dedicated_tools` 자동 활성화 한 쌍.

## 인도물

| PR | 내용 | 최종 head CI |
|---|---|---|
| [#102](https://github.com/lidge-jun/codexclaw/pull/102) | PreToolUse 메모리 쓰기 게이트 + 훅 개수 12표면 갱신 | pass 9 / fail 0 / wsl 진행중 |
| [#106](https://github.com/lidge-jun/codexclaw/pull/106) | `memories.dedicated_tools` 설치 시 자동 활성화 | pass 10 / fail 0 |

## 순서가 규율인 이유

`managed-keys.ts:20-49` 주석이 자동 활성화를 금지하면서 남긴 조건은 "효과가 codexclaw 안에서 끝나는가 × 되돌리기를 매니페스트가 보장하는가"이고, 같은 파일 `caution` 문구가 "명시 요청 없는 쓰기를 막는 장치를 먼저 확인하세요"를 요구했다. #102 의 게이트가 그 장치다. 역순으로 머지하면 근거가 성립하지 않는 기간이 생긴다.

머지 순서는 #102 → #106.

## 게이트의 판정 근거

PreToolUse 페이로드에는 프롬프트가 없다(`schema.rs:278-296`). 그래서 UserPromptSubmit 이 남긴 세션 마커나 `cxc memory allow-write` 승인만이 판정 재료이고, 승인은 그것이 허용한 쓰기 한 번으로 소진된다. 실패 방향은 fail-open 이다 — 판정이 휴리스틱이므로 오탐은 곧 "사용자가 명시적으로 요청한 기억하기가 훅 버그로 영영 막힘"이 된다.

matcher 는 `memoriesadd_ad_hoc_note` 와 구두점 변형을 모두 받는다. 메모리 툴은 MCP 가 아니라 extension 툴이고 `ExtensionToolAdapter` 가 `pre_tool_use_payload` 를 재정의하지 않으므로 `flat_tool_name`(`core/src/tools/mod.rs:40-54`)이 네임스페이스와 이름을 구분자 없이 잇는다.

## 원복

`activate.ts` 가 feature 패스 이후에 키를 쓰고 매니페스트 `tableKeys` 에 기록한다. `deactivate.ts:130-157` 의 기존 순회가 그대로 원복하므로 그 코드는 수정하지 않았다. prior value 는 파일 스냅샷에서 읽어 세 경우(키 부재 / 사용자 false / 사용자 true)를 구분한다.

한계는 그대로 적는다. 원복은 `cxc disable` 실행을 전제하고, 디렉터리를 그냥 지우면 키가 남는다. 이는 기존 `[features]` 플래그 넷이 이미 공유하는 한계이지 이 키가 새로 들이는 위험은 아니다.

## 감사 반영

독립 감사가 훅 개수 결합을 6표면이 아니라 11표면으로 정정했고, 구현이 `cxc-ops/test/manifest-targets.test.ts:245` 에서 실패로 12번째를 찾았다. `how-it-works.md:36` 과 `plugin-manifest.md:19` 는 "Twenty-three" 스펠아웃이라 숫자 grep 으로 걸리지 않고, docs-site 4곳은 어떤 자동 검사에도 안 걸려 조용한 문서 드리프트가 된다.

## 검증

로컬 영수증 `.codexclaw/evidence/01a08397-.../test-receipt.json` — 2,013 tests / 2,012 pass / 0 fail. gui 는 이 워크트리에 `node_modules` 가 없어 제외했고 CI 3플랫폼에서 실행된다.

