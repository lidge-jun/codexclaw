# 040 — wp5: cxc config 표면 + 배포 경로

## 목표

wp2가 만든 setter와 wp4가 만든 정책을 사용자 손에 닿는 명령으로 노출한다.
그리고 그 표면이 재설치 후에도 살아남게 배포 경로를 정리한다.

## 왜 별도 phase인가

wp2/wp3/wp4는 각자 라이브러리 계층이고, 이 phase는 그 셋을 소비한다.
표면을 먼저 만들면 아직 없는 함수를 부르게 되므로 의존 순서상 마지막이다(PHASE-SPLIT-01).

## 파일 변경 맵

| 파일 | 동작 |
|---|---|
| `config-guard/src/cli.ts` | MODIFY — `config get|set|unset|list` 추가, `disable` 출력에 새 필드 반영 |
| `plugins/codexclaw/bin/cxc.mjs` | MODIFY — `config` 라우팅 |
| `config-guard/test/cli-config.test.ts` | NEW |
| `plugins/codexclaw/test/packaging.test.mjs` | MODIFY — 신규 dist 산출물 존재 확인 |
| `README.md` / `README.ko.md` | MODIFY — 설정 관리 절 (SOT-SYNC-01) |
| `config-guard/src/features.ts` | MODIFY — 상단 불변식 주석 갱신 (SOT-SYNC-01) |

## CLI 표면

    cxc config list                          # 화이트리스트 + 각 키의 현재 값 + caution
    cxc config get memories.dedicated_tools
    cxc config set memories.dedicated_tools true
    cxc config unset memories.dedicated_tools    # 매니페스트 priorValue로 되돌린다
    cxc config interview <off|new-unit|always>   # wp4 정책. 프로젝트 로컬

설계 규칙:

- `set`은 화이트리스트 밖 키를 **거부**한다. 임의 TOML 편집 도구가 되지 않는다.
  거부 메시지는 `cxc config list`를 안내한다.
- `set`은 `caution` 문구를 항상 먼저 출력한다. `dedicated_tools`의 경우
  "add_ad_hoc_note가 메모리 쓰기 경로를 연다"는 사실을 사용자가 보고 나서 결정한다.
- `enable`(설치)은 `CONFIG_MANAGED_KEYS`를 **건드리지 않는다**. `autoEnable`이 전부 false이므로
  설치는 플래그 네 개만 다루던 기존 동작 그대로다. 이게 `features.ts:18-20` 선례와의 일관성이다.
- `disable`은 플래그와 테이블 키를 함께 되돌리고, `restoredKeys` / `skippedExternal`을 출력한다.

출력 예:

    $ cxc config set memories.dedicated_tools true
    주의: memories/{list,read,search,add_ad_hoc_note} 네 도구가 열립니다.
          add_ad_hoc_note는 메모리에 새 노트를 만드는 쓰기 경로입니다.
    memories.dedicated_tools: (없음) -> true
    backup: /Users/…/.codex/config.toml.codexclaw-2026-08-29T…bak

## 배포 경로

편집 대상은 **repo 소스**다(`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/`).
플러그인 캐시(`~/.codex/plugins/cache/codexclaw/codexclaw/<version>/`)를 직접 고치면 재설치로 사라진다.
반영 순서:

1. repo에서 소스 수정 → `npm run build`로 각 컴포넌트 `dist/` 갱신
2. `npm test` 전체
3. `node plugins/codexclaw/scripts/inventory.mjs`로 인벤토리 갱신(신규 파일이 목록에 들어가야 한다)
4. hook JSON을 건드렸다면 `cxc hooks retrust` — 22개 해시가 핀되어 있으므로 편집 시 신뢰가 깨진다
5. `cxc doctor` overall PASS 확인
6. 재설치로 캐시에 반영

wp4가 hook JSON 자체를 바꾸지 않고 `hook.ts` 본문만 바꾸므로 4단계는 실제로는 불필요할 수 있다.
그래도 C에서 `cxc doctor`의 `hook-trust` 항목을 반드시 확인한다.

## 테스트 (c5 활성화 시나리오)

| # | 입력 | 기대 |
|---|---|---|
| 1 | `config set memories.dedicated_tools true` | 종료 0, 값 반영, caution 출력 |
| 2 | `config set tools.dangerous true` | 종료 2, "화이트리스트에 없음", 파일 무변 |
| 3 | `config get` 없는 키 | 종료 2 |
| 4 | `config list` | 화이트리스트 전 항목 + caution |
| 5 | `config interview always` | `.codexclaw/config.json` 기록 |
| 6 | `config interview bogus` | 종료 2, 파일 무변 |
| 7 | `enable` 실행 후 | `memories.dedicated_tools`가 여전히 부재(자동 활성화 없음) |
| 8 | packaging 테스트 | 신규 dist 산출물이 인벤토리에 존재 |

7번이 이 유닛의 정책 경계를 지키는 회귀 테스트다.

## 범위 경계

IN: 위 파일들. OUT: 실제 사용자 config.toml에 대한 테스트 쓰기(전부 임시 경로 주입),
npm 배포/버전 범프, GUI 표면.

## 검증

`npm test` 전체 + `cxc doctor` overall PASS + `cxc config list` 수동 실행 출력.


## A-phase 감사 정정 (파견 감사자 Pauli, GO-WITH-FIXES blockers=5)

### B1·B2 (High) — 두 bin이 모두 인자를 버린다

`bin/cxc.mjs:149`의 config-guard 분기는 `[subcommand]` 하나만 넘긴다.
`cxc config set memories.dedicated_tools true`가 컴포넌트에 `["config"]`로 도착해 키와 값이 사라진다.
루트 `bin/codexclaw.mjs:199`는 더 나쁘다 — `runConfigGuard(subcommand)`가 스칼라 파라미터다.
그리고 계획의 파일 맵에 루트 bin이 아예 없었다.

정정:

- `bin/cxc.mjs`: `config`만 `process.argv.slice(2)` 전체를 넘기도록 특수화하고,
  `enable|disable|status|uninstall`은 기존 단일 인자 계약을 유지한다. 147행 주석도 갱신.
- `bin/codexclaw.mjs`: 파일 맵에 **추가**. `runConfigGuard(args)`로 바꾸고 기존 호출 3곳을 배열 형태로,
  `case "config":`를 추가해 `process.argv.slice(2)`를 전달.
- `payload-bin.test.mjs:36`이 루트 bin의 `case` 목록과 `COMMAND_TABLE` 키 일치를 단언하므로
  둘 중 하나만 고치면 그 테스트가 잡는다. 다만 인자 유실은 못 잡으므로 별도 테스트가 필요하다.

### B3 (High) — set이 매니페스트에 기록하지 않으면 되돌릴 수 없다

가장 중요한 지적이다. `activate()`는 `tableKeys: {}`를 쓰고 "cxc config set만 여기 추가한다"고 주석을 남겼다.
`deactivate()`는 **기록된 것만** 순회한다. 따라서 `set`이 config.toml만 쓰고 매니페스트를 갱신하지 않으면
그 키는 **영구히 되돌릴 수 없다.** wp3에서 만든 복원 장치가 무용지물이 된다.

정정: `set`은 한 경로에서 네 가지를 모두 한다.

1. `activate`의 명명 규칙으로 config.toml 백업(`.codexclaw-<timestamp>.bak`)
2. `setTableKey`로 키 쓰기
3. `tableKeys[managedKeyId] = { table, key, priorValue, appliedValue, setByCodexclaw }` upsert
   + `postActivateHash` 갱신
4. 매니페스트가 없으면 **거부하고** `cxc enable`을 먼저 실행하라고 안내한다.
   빈 매니페스트를 즉석에서 만드는 쪽은 `flags`가 비어 설치 상태를 거짓으로 표현하므로 택하지 않는다.

테스트 필수: `config set` → `disable` 이 키를 원상복구한다(end-to-end).

### B4 (Medium) — codexclaw.json 소유자는 pabcd-state다

`CONFIG_FILENAME`/`readInterviewPolicy`가 pabcd-state에 있고 그 컴포넌트의 hook이 매 프롬프트마다 읽는다.
config-guard는 pabcd-state에 의존하지 않으며 다른 파일(`~/.codex/config.toml`)을 소유한다.
writer를 config-guard에 두면 교차 의존이나 상수 중복 중 하나가 생긴다.

정정: `cxc config interview`는 **pabcd-state**로 라우팅한다. `writeInterviewPolicy()`를 reader 옆에 두고
디스패처가 `config`의 **하위 명령으로** 갈라 보낸다: `interview` → pabcd-state,
`list|get|set|unset` → config-guard.

### B5 (Low) — help 계약과 usage 문자열

`cli-usage.test.mjs:42`가 `loop|scan|receipt`에만 `--help` exit 0을 요구한다.
`config`를 그 목록에 넣고, `cxc.mjs`의 HELP 블록과 `config-guard/src/cli.ts:81` usage 문자열도 갱신한다.

### 계획 본문 오류 정정

앞선 절의 테스트 표 5행이 `.codexclaw/config.json`을 적었다. 실제 구현 경로는 **저장소 루트 `codexclaw.json`**이다
(wp4의 B4·B5 정정 결과). 표를 그 경로로 고친다.

### 파일 변경 맵 갱신

| 파일 | 동작 |
|---|---|
| `bin/cxc.mjs` | MODIFY — `config` 인자 보존 라우팅 + 하위 명령 분기 |
| `bin/codexclaw.mjs` | MODIFY — `runConfigGuard(args)` 가변화 + `case "config"` |
| `config-guard/src/cli.ts` | MODIFY — `config list|get|set|unset` + usage |
| `config-guard/src/config-set.ts` | NEW — 백업·쓰기·매니페스트 upsert를 한 경로로 묶는다 |
| `pabcd-state/src/interview-policy.ts` | MODIFY — `writeInterviewPolicy()` 추가 |
| `pabcd-state/src/cli.ts` | MODIFY — `config interview` 처리 |
| `config-guard/test/config-set.test.ts` | NEW — set→disable 왕복 포함 |
| `plugins/codexclaw/test/cli-usage.test.mjs` | MODIFY — `config` 추가 |

