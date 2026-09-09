# bg-wake

백그라운드 작업 레지스트리와 **완료 웨이크**. Codex는 자식 프로세스나 서브에이전트가 끝나도 부모의 새 턴을 열지 않는다(V1 `inject_fragment_without_turn`, V2 `trigger_turn = false`). 이 컴포넌트가 그 구멍을 메운다.

설계 근거: `devlog/_plan/260909_bg_wake_component/000_plan.md`, 계약: `010_contract.md`.
왜 필요한지: `devlog/_plan/260909_background_run_suspension_research/030_synthesis.md`. 상류 이슈 openai/codex #15723, #22003, #42908.

## 쓰는 법

```
cxc bg run --note "야간 빌드" -- npm run build     # 즉시 id 반환, 턴을 붙잡지 않음
cxc bg list                                        # 모델이 볼 수 있는 백그라운드 목록
cxc bg get <id> --tail 40                          # 출력 꼬리
cxc bg cancel <id>
```

작업이 끝나면 다음 Stop 훅이 턴을 한 번 이어서 결과를 알린다. 턴이 이미 끝났으면 다음 프롬프트에 주입되고, 세션이 바뀌었으면 SessionStart가 인수해서 그다음에 전달한다. 같은 완료로 두 번 깨우지 않는다.

## 끄는 법

```
cxc bg off      # 이 워크트리, 즉시. 재시작·재설치 불필요
cxc bg on
cxc bg status
```

전역으로 끄려면 `export CXC_BGWAKE=0`. 다만 **새로 시작하는 세션부터** 적용된다. 훅 런타임은 세션 시작 시점의 환경을 스냅샷해서 재생하기 때문에(`codex-rs/hooks/src/registry.rs:71`, `engine/command_runner.rs:425-427`), 이미 열린 세션에는 닿지 않는다. 그래서 즉시 끄는 수단은 파일 플래그다.

끈 동안에도 `cxc bg run`은 계속 받고 기록도 남는다. 다시 켜면 그 사이에 끝난 작업은 웨이크하지 않고 목록에만 남는다. 한꺼번에 쏟아지지 않게 하기 위해서다. 필요하면 `cxc bg drain --session <id>`로 직접 받아간다. drain은 스위치를 타지 않는다.

## 지우는 법

```
cxc bg removal
```

8단계 체크리스트를 출력한다. 디렉터리만 지우면 되지 않는다. 빌드 컴포넌트 목록, 매니페스트 훅 항목, test glob, 디스패처 동사, lockfile, inventory 재생성까지 포함이다.

## 설계 메모

**데몬이 없다.** 상주 감시 프로세스를 두지 않는다. POSIX에서는 `cxc bg run`이 띄우는 셸이 자기 종료 코드를 `<id>.exit`에 직접 쓴다. Windows에서는 셸이 그 일을 하지 못한다는 것을 실측해서(030 v3) 작업당 Node 헬퍼 하나가 그 자리를 대신한다. 어느 쪽이든 작업 하나에 프로세스 하나이고, 읽는 쪽이 그 파일과 PID 생존으로 상태를 판정한다.

**Codex 내부에 붙지 않는다.** `unified_exec` 세션이나 서브에이전트 스레드를 들여다보지 않는다. 자기가 띄운 프로세스만 안다. 상류가 바뀌어도 같이 깨지지 않게 하려는 것이다.

**다른 컴포넌트를 참조하지 않는다.** import는 `node:*`와 `./*.ts`뿐이다. 그래서 디렉터리를 통째로 지워도 나머지 빌드가 돈다.

## 알려진 한계

Windows 경로는 2026-09-10에 실제 Windows 머신(10.0.26200)에서 측정했다. 근거는 `devlog/_plan/260909_bg_wake_component/030_windows_validation.md`.

- **Windows에서 cmd 내장 명령은 직접 실행되지 않는다.** `cxc bg run -- echo hi`는 실패로 끝난다. `cxc bg run -- cmd /c echo hi`로 감싸면 출력과 종료 코드 모두 정상이다. 헬퍼가 argv를 CreateProcess로 바로 넘기기 때문이고, 그 대가로 cmd 인용 문제가 통째로 사라졌다.
- 없는 실행 파일은 종료 코드 127로 기록된다.
- Windows에서 기록되는 pid는 셸이 아니라 헬퍼의 것이다. `cancel`은 헬퍼를 죽인다. 측정한 실행에서는 자식도 함께 멈췄지만, 그 측정이 OpenSSH 세션에서 이뤄져 잡 오브젝트가 개입했을 수 있다. **대화형 로컬 세션은 확인하지 않았다.**
- 서브에이전트는 SubagentStop을 타므로 루트 Stop 훅과 세션 id가 어긋난다. `cxc bg run`은 메인 세션에서 쓰는 것을 전제로 한다.
- `deliveredAt`을 찍은 뒤 런타임이 block을 버리면 그 완료는 유실된다. 무한 block을 막는 대가로 받아들인 손실이다.
- `.codexclaw/bg/`는 `cxc reset --state`로 지워지지 않는다. `reset all`에서만 사라진다.
