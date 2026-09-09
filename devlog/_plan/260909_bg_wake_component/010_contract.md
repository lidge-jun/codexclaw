# 010 — bg-wake 계약 (wp1 빌드 산출물)

wp2가 이 문서를 그대로 구현한다. 설계 근거는 `000_plan.md`.

## 훅 입출력 계약

### Stop

입력(payload, snake_case): `session_id`, `cwd`, `stop_hook_active`.

출력은 둘 중 하나뿐이다.

빈 stdout + exit 0 — 놓아준다. 다음 경우 전부 여기로 간다.
- `<cwd>/.codexclaw/bg/disabled` 존재
- `CXC_BGWAKE`가 `0` / `off` / `false`
- 미전달 완료 없음
- 어떤 오류든 (레지스트리 파손, 파싱 실패, 권한 오류)

block — 미전달 완료가 있을 때만.

```json
{"decision":"block","reason":"<non-empty>"}
```

`reason`이 비면 Codex는 block이 아니라 Failed로 본다. 그래서 reason은 항상 최소 한 줄을 갖는다. `exit 2`는 절대 쓰지 않는다. stderr에 뭔가 있으면 그것이 block reason이 되어 버린다.

reason 형태.

```
[codexclaw bg] 백그라운드 작업 2건이 끝났습니다.
- build1 (complete, exit 0, 4m12s) — npm run build
- probe2 (failed, exit 1, 31s) — node scripts/probe.mjs
출력은 `cxc bg get <id> --tail 40`으로 봅니다. 전체 목록은 `cxc bg list`.
결과를 확인하고 필요한 후속 작업을 이어가세요.
```

### UserPromptSubmit

봉투를 고정한다. 다른 형태는 파싱되지 않거나 평문으로 취급된다.

```json
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"<text>"}}
```

`decision` 필드를 넣지 않는다. 여기서 block은 프롬프트를 막는다.

### SessionStart

같은 봉투에 `hookEventName: "SessionStart"`. 두 가지를 싣는다.

1. 인수한 미전달 완료 요약 (있을 때만)
2. 어포던스 한 줄 — 이 세션에 백그라운드 태스크가 하나라도 있을 때만 낸다. 없으면 조용히 빈 stdout.

인수 규칙: 같은 cwd에 `deliveredAt`이 null이고 `status`가 `running`이 아닌 레코드 중, `sessionId`와 `adoptedBy`가 모두 현 세션이 아닌 것에 `adoptedBy`를 현 세션으로 찍는다. 인수는 전달이 아니다. 전달은 이후 Stop이나 UserPromptSubmit이 한다.

## 웨이크 대상 판정

한 레코드가 지금 깨울 대상인지는 다섯 조건을 전부 만족할 때다.

1. `status`가 `complete` / `failed` / `cancelled` 중 하나
2. `deliveredAt`이 null
3. `sessionId` 또는 `adoptedBy`가 현재 세션
4. `endedAt`이 마지막 off 해제 시각보다 나중 (off 기간에 쌓인 것을 한꺼번에 쏟지 않기 위해)
5. 한 번에 최대 5건. 초과분은 다음 기회로 미룬다

## 상태 판정 (데몬 없음)

읽는 쪽이 판정한다.

- `status`가 `running`인데 `pid`(POSIX는 셸, Windows는 헬퍼)가 죽었으면 → `failed`, `exitCode`는 null, `endedAt`은 지금
- `pid`가 살아 있어도 그 프로세스의 시작 시각이 `startToken`과 다르면 PID 재사용이므로 죽은 것으로 본다
- 판정 결과는 레코드에 되쓴다. 매번 다시 계산하지 않는다

## CLI 계약

| 명령 | 출력 | 종료 코드 |
|---|---|---|
| `cxc bg run --note "..." -- <cmd...>` | id 한 줄 (`--json`이면 레코드) | 스폰 성공 0 |
| `cxc bg list [--json]` | 표 또는 JSON 배열 | 0 |
| `cxc bg get <id> [--tail N]` | 레코드 + 출력 꼬리 | 없는 id면 1 |
| `cxc bg cancel <id>` | 결과 한 줄. 이미 끝난 작업은 상태를 덮어쓰지 않는다 | 없는 id도 0 |
| `cxc bg off` / `on` / `status` | 현재 상태 한 줄 | 0 |
| `cxc bg removal` | 체크리스트 8항목 | 0 |
| `cxc bg drain --session <id> [--json]` | 전달 대상 + `deliveredAt` 기록. **off 스위치를 타지 않는다** — 스위치는 자동 웨이크를 끄는 것이고, 명시적으로 달라고 하면 준다 | 0 |

`--session` 없는 `drain`은 사용법을 출력하고 아무것도 찍지 않는다.

## 파일 레이아웃

```
<cwd>/.codexclaw/bg/
  disabled          # 존재하면 웨이크 off. 내용은 해제 판정용 타임스탬프
  <id>.json         # 레코드
  <id>.out          # 합쳐진 stdout/stderr
  <id>.exit         # 종료 코드. 감시 데몬 대신 셸이 스스로 쓴다
  <id>.out.helper.cjs # Windows 전용 2-hop 헬퍼. 자기가 출력 파일을 열고 종료 코드를 쓴다
  enabled-at        # 마지막 'bg on' 시각. 웨이크 조건 4의 기준
  ledger.jsonl      # registered / completed / delivered / adopted / disabled / enabled
```

레코드 쓰기는 원자적이다. 임시 파일에 쓰고 rename한다. `ledger.jsonl`은 append-only 저널이라 append로 쓴다. 기존 컴포넌트의 `atomic-write.ts`와 같은 방식이되, cross-component import 금지 제약 때문에 자체 구현을 둔다.

## 구현 제약 재확인

- import는 `node:*`와 `./*.ts`만
- 다른 컴포넌트 소스 수정 없음
- 오류는 전부 삼키고 빈 stdout + exit 0
- 테스트는 `node --test`, 파일시스템은 `mkdtemp` 임시 디렉터리



## 감사 1회차(fail) 반영

- `cxc bg on`은 이미 ON이면 `enabled-at`을 다시 쓰지 않는다. 다시 쓰면 대기 중이던 완료가 게이트에 걸려 삼켜진다.
- `drain`은 `wakeSuppressed`를 타지 않는다. 자동 웨이크와 수동 회수는 다른 것이다.
- `cancel`은 먼저 `reconcile`하고, `running`이 아니면 아무것도 하지 않는다. 죽일 때는 `startToken`으로 우리 프로세스인지 확인한다.
- Windows는 한 줄 `cmd /c`가 아니라 배치 파일을 썼다. 260910 실측 후 이 경로 자체가 Node 헬퍼로 교체되었으므로 이 항목은 이력이다. 아래 "Windows 경로" 절이 현행이다.
- 훅의 `stdout.write`도 try 안에 넣는다. EPIPE로 죽으면 stderr 스택 + 비0 종료가 되고, Codex는 그걸 Stop block으로 읽는다.
- `markDelivered`는 레코드마다 독립적으로 찍는다. 하나가 실패해도 나머지는 전달되고, 실패한 것은 미전달로 남아 다음에 다시 깨운다.
- SessionStart 어포던스는 이 세션이 소유한 작업이 있을 때만 낸다.


## Windows 경로 (260910 실측 반영)

POSIX는 셸이 자기 종료 코드를 쓴다. Windows는 그럴 수 없다. libuv가 detached로 띄운 첫 홉은 외부 자식에게 쓸 수 있는 stdout을 주지 못해, cmd 배치의 리다이렉트가 아무것도 잡지 못했다(030 v3).

그래서 Windows는 Node 헬퍼를 두 번째 홉으로 쓴다. 헬퍼가 `<id>.out`을 직접 열고, 그 핸들로 사용자 명령을 argv로 spawn하고, 종료 코드를 tmp+rename으로 쓴다. cmd를 거치지 않으므로 인용 규칙도 사라진다.

측정된 계약 차이:

- 없는 실행 파일은 `exitCode 127`이다.
- **cmd 내장 명령은 실행되지 않는다.** `echo`, `dir`, `exit` 같은 것은 `cmd /c ...`로 감싸야 한다. 감싸면 출력과 종료 코드 모두 정상이다.
- 기록되는 `pid`는 셸이 아니라 헬퍼의 것이다. `cancel`과 `startToken`이 그 pid를 가리킨다.
- 헬퍼가 종료 코드를 쓰기 전에 죽으면 exit 파일이 없고, 레코드는 나이 기반 백스톱으로 `failed` + `exitCode: null`이 된다.
