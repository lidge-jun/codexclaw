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

