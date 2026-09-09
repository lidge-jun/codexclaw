# 260909 — bg-wake 컴포넌트 설계 (wp1)

상태: wp1 설계. 구현 없음. 감사 2회 반영본(1R fail → 2R near-pass, 잔여 10건 전부 fold).
근거 리서치: `devlog/_plan/260909_background_run_suspension_research`.

## 무엇을 만드는가

리서치의 Medium 옵션. Codex는 백그라운드 작업이 끝나도 부모의 새 턴을 열지 않는다(V1 `inject_fragment_without_turn`, V2 `trigger_turn = false`). codexclaw가 로컬 레지스트리를 들고 그 구멍을 메운다.

**Codex의 Stop 훅은 `{decision:"block", reason}`으로 턴을 잇는다.** camelCase이고 `reason`이 비면 block이 아니라 Failed다(`hooks/src/schema.rs:453-463`, `engine/output_parser.rs:290-347`). 런타임이 그 reason을 continuation prompt로 넣는다(`core/src/session/turn.rs:571-587`). pabcd-state가 이미 그 형태를 쓴다(`components/pabcd-state/src/hook.ts:1510-1515`).

부수 효과: 리서치 격차 4번 — Codex에는 모델이 볼 수 있는 백그라운드 목록 도구가 없다. `/ps`는 사람만 본다. `cxc bg list`가 그 자리를 메운다.

## 제1원칙: 끄기 쉬울 것

**환경변수는 실행 중 세션에 닿지 않는다.** 훅 런타임은 세션 시작 시 `std::env::vars_os()` 스냅샷을 뜨고(`hooks/src/registry.rs:71`) 실행할 때 `env_clear()` 후 재생한다(`engine/command_runner.rs:425-427`).

반면 훅의 cwd는 payload cwd로 설정된다(`engine/command_runner.rs:216-218`). 그래서 **파일 플래그가 즉시 먹는 유일한 수단**이다.

| 단계 | 방법 | 적용 | 범위 |
|---|---|---|---|
| 1 | `cxc bg off` → `.codexclaw/bg/disabled` | 다음 훅 실행부터 즉시 | 그 cwd만 |
| 1b | `CXC_BGWAKE=0` export | 새로 시작하는 세션부터 | 전역 |
| 2 | 매니페스트에서 bg-wake 훅 3줄 + 훅 파일 3개 제거 | 재설치 후 | 전역 |
| 3 | 컴포넌트 제거 (체크리스트) | 재설치 후 | 전역 |

플래그는 워크트리마다 따로 꺼야 한다. 홈 전역 즉시 스위치는 없다. 이 한계를 문서에 적는다.

**꺼 둔 동안 쌓인 완료 처리.** off 중에도 `cxc bg run`은 계속 받고 `deliveredAt`은 비어 쌓인다. 다시 켜는 순간 전부 깨우면 폭주하므로, 웨이크는 **한 번에 최대 5건, 그리고 플래그 해제 시각 이후 완료된 것만** 전달한다. 나머지는 `cxc bg list`에 남는다.

### 제거 체크리스트

감사가 실제로 센 접점이다. "디렉터리만 지우면 끝"은 거짓이므로 그렇게 적지 않는다.

1. `plugins/codexclaw/components/bg-wake/` 디렉터리
2. `plugins/codexclaw/hooks/`의 bg-wake 훅 파일 3개
3. `plugins/codexclaw/.codex-plugin/plugin.json` `hooks[]` 3줄
4. `plugins/codexclaw/scripts/build.mjs` `COMPONENTS` 1줄
5. `package.json` test glob 1줄
6. `plugins/codexclaw/bin/cxc.mjs` `COMMAND_TABLE`의 `bg` 1줄 + HELP 문자열(`:67`), `bin/codexclaw.mjs` case + HELP(`:249`), `plugins/codexclaw/test/payload-bin.test.mjs` 기대값
7. `package-lock.json`의 `@codexclaw/bg-wake` 워크스페이스 항목 — `npm install`로 재생성
8. `node plugins/codexclaw/scripts/inventory.mjs --write` 재실행. 훅 뱃지는 `README.md`, `README.ko.md`, `README.zh.md` **세 파일**에 있고 inventory가 셋을 함께 비교한다(`scripts/inventory.mjs:203-205,248-255,360-370`). 손으로 고치지 말고 반드시 `--write`로 돌린다.

`packaging.test.mjs`의 ENTRYPOINTS와 `build.test.mjs`의 COMPONENTS는 **부분 목록이다.** skill-search가 둘 다에 없는 선례가 있으므로 bg-wake도 넣지 않는다. 접점이 그만큼 줄어든다.

`cxc bg removal`이 이 체크리스트를 그대로 출력한다. wp3에서 8항목을 실제로 적용해 `build`/`test`/`gate`가 통과함을 실행으로 증명한다.

### 제거를 쉽게 만드는 제약

- `node:*`와 자기 파일만 import. cross-component dist import 금지.
- 다른 컴포넌트 **소스**는 한 줄도 수정하지 않는다. 컴포넌트 밖 배선은 불가피하며 체크리스트로 관리한다.
- `build.mjs`의 `COMPONENTS`를 `existsSync`로 필터해, 디렉터리만 먼저 지웠을 때 빌드가 깨지는 대신 조용히 빠지게 한다.

## 데이터 모델

`<cwd>/.codexclaw/bg/` 아래. `<taskId>.json`, `<taskId>.out`, `ledger.jsonl`, off 플래그 `disabled`.

| 필드 | 뜻 |
|---|---|
| `id` | 짧은 slug |
| `sessionId` | 등록 세션. 웨이크 대상 판정 |
| `adoptedBy` | 재시작 후 이 레코드를 인수한 세션 |
| `cwd`, `command`, `note` | |
| `pid`, `startToken` | 감시 프로세스. `startToken`은 PID 재사용 오판 방지용 시작 시각 지문 |
| `status` | `running` / `complete` / `failed` / `cancelled` |
| `exitCode`, `startedAt`, `endedAt` | |
| `deliveredAt` | 전달 시각. null이면 미전달 |

`deliveredAt`이 중심이다. "완료됐지만 안 알렸다"가 웨이크 조건이고, 한 번 찍으면 다시 깨우지 않는 멱등 키다.

## CLI 표면

`cxc bg run [--note "..."] -- <command...>` / `list [--json]` / `get <id> [--tail N]` / `cancel <id>` / `off` / `on` / `status` / `removal` / `drain --session <id> [--json]`.

`drain`은 `--session`을 필수로 받는다. 세션 필터 없는 drain은 다른 세션의 웨이크를 훔친다.

## 훅 배치 — 세 개

**Stop** — 미전달 완료가 있으면 `{decision:"block", reason}`으로 한 번 잇고 `deliveredAt`을 찍는다. 없으면 빈 stdout + exit 0.

**UserPromptSubmit** — 봉투는 `{ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }`로 고정한다(`pabcd-state/src/hook.ts:560-562`의 `buildContextOutput`과 동형). 여기서 `decision:"block"`을 내면 프롬프트 자체가 막힌다(`hooks/src/events/user_prompt_submit.rs:172-218`).

**SessionStart** — 감사 4·5가 지적한 재시작·압축 구멍을 메운다. PostCompact는 additionalContext를 못 실어서 recall도 빈 stdout으로 돌리고, 실제 복구 경로는 source `"compact"`인 SessionStart다(`components/recall/src/hook.ts:495-499,533-549`, `core/src/session/mod.rs:3865`).
여기서 두 가지를 한다.
- **인수(adoption).** 같은 cwd에 미전달 완료가 있는데 등록 세션이 지금 세션이 아니면 `adoptedBy`를 현 세션으로 찍는다. 그러면 이후 Stop/프롬프트가 전달할 수 있다. 이게 없으면 스레드가 끝난 뒤 미전달분은 영영 못 깨운다.
- **어포던스 한 줄.** `cxc bg list`가 있다는 것을 모델에게 알린다. 이게 없으면 "완료 통지"만 메우고 "목록 도구" 격차는 그대로다.

## 안전 장치

**무한 block 금지.** block 직전에 `deliveredAt`을 찍는다. 다음 Stop에서 같은 레코드는 미전달이 아니므로 놓아준다.

`stop_hook_active`를 릴리스 가드로 쓰지 않는다. pabcd-state는 그 가드를 지웠고(`hook.ts:14`), 따라가면 HOTL 연속 Stop 동안 완료가 묻힌다. 멱등 키만으로 유한성을 보장한다.

**pabcd-state와의 공존은 문제없다.** 같은 Stop에 훅이 여럿이면 Codex는 전부 돌리고, 둘 다 block이면 reason을 이어 붙이고 continuation fragment도 모두 넣는다(`hooks/src/events/stop.rs:413-437`). 어느 한쪽이 이기지 않는다.
비용은 있다. bg-wake의 block도 Stop 이벤트를 하나 더 만들고 pabcd-state는 Stop마다 `MAX_STOP_BLOCKS` 정체 예산을 올린다(`hook.ts:1363-1369`). 완료가 있을 때만, 완료당 한 번만 block하므로 소모는 제한적이다. wp3에서 실측한다.

**fail-open은 빈 stdout + exit 0.** 잘못된 JSON은 Failed이고 `exit 2` + stderr는 **block으로 취급된다**(`hooks/src/events/stop.rs:343-352`). 오류 경로는 반드시 아무것도 출력하지 않고 0으로 끝낸다.

**세션 격리.** 레지스트리는 cwd 단위라 같은 디렉터리의 다른 세션이 파일을 공유한다. 웨이크는 `sessionId` 또는 `adoptedBy`가 현 세션일 때만, 목록은 전부 보여 준다.

**서브에이전트 한계.** 루트 Stop만 이 훅을 돌리고 스폰된 자식은 SubagentStop이다(`core/src/hook_runtime.rs:383-387`). 자식이 `CODEX_THREAD_ID`로 등록하면 부모 Stop과 id가 어긋난다. SessionStart 인수가 일부 구제하지만, **`cxc bg run`은 메인 세션에서 쓰는 것을 전제로 문서화한다.**

**reset 접점.** `.codexclaw/bg/`는 `cxc reset --state`로 지워지지 않고 `reset all`에서만 사라진다(`components/cxc-ops/src/reset.ts:5-11`). reset.ts를 수정하지 않는다. 대신 `cxc bg`에 자체 정리 명령을 두고 이 동작을 문서에 적는다.

**허용 손실.** `deliveredAt`을 찍은 뒤 JSON 실패, 빈 reason, 또는 continuation 없는 block으로 Codex가 무시하면(`core/src/session/turn.rs:588-593`) 그 완료는 유실된다. 무한 block을 막는 대가다. 검증 계획에 명시적으로 넣는다.
압축 직후에도 `deliveredAt`이 이미 찍힌 완료 본문은 재주입되지 않는다. 미전달분만 SessionStart가 살린다.

## 하지 않는 것

- 상류 자동 감지. 사용자가 명시적으로 배제했다.
- Codex의 `unified_exec` 세션이나 서브에이전트 스레드를 직접 들여다보기. 내부 상태에 붙으면 상류가 바뀔 때 같이 깨진다. bg-wake는 자기가 띄운 프로세스만 안다.
- 데몬. 감시자는 태스크당 detached 프로세스 하나이고 판정은 읽는 쪽에서 한다.

## 검증 계획

- 파일 플래그 off일 때 세 훅 모두 빈 stdout + exit 0
- 미전달 완료가 있을 때만 Stop이 block하고 두 번째 Stop은 놓아줌
- UserPromptSubmit이 정확한 `hookSpecificOutput` 봉투를 내고 block을 내지 않음
- SessionStart 인수가 다른 세션의 미전달분을 현 세션으로 넘김
- 오류 주입 시 빈 stdout + exit 0 (block으로 오인되지 않음)
- 재활성화 시 5건 상한과 해제 시각 필터가 동작
- `deliveredAt` 이후 유실이 허용 손실임을 테스트로 문서화
- `npm run build`, `npm test`, `npm run gate` 통과
- 제거 체크리스트 8항목을 실제로 적용한 뒤 같은 명령이 통과함을 실행으로 증명

