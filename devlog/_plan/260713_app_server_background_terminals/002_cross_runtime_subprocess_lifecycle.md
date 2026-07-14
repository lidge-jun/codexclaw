# 교차 런타임 서브에이전트·서브프로세스 수명주기 조사

Date: 2026-07-13
Status: RESEARCH COMPLETE
Scope: Claude Code, OpenAI Codex, Gemini CLI, Aider, 기타 에이전트 런타임의 parent turn·subagent·background process 관계

## 1. 결론

주요 에이전트 런타임에서 **turn 종료와 process 종료는 같은 사건이 아니다.** 서브에이전트의 논리적 작업 단위, 부모 turn, 대화 session, 셸 session, OS process는 서로 다른 수명주기를 가진다.

- Claude Code의 foreground subagent는 부모 turn을 동기적으로 막지만, 이것이 자식 process tree의 정리를 보장하지는 않는다. background subagent는 독립적인 취소 경계를 가지며 부모 abort 뒤에도 살아남을 수 있다.
- Codex의 `spawn_agent`는 부모 turn을 자식 완료까지 암묵적으로 막지 않는다. 부모가 `wait`를 명시적으로 호출해야 하며, child thread가 끝나도 그 thread가 만든 background terminal은 남을 수 있다.
- Gemini CLI는 현재 session 안의 shell을 추적하는 기능이 있지만, 종료 시 process group 전체를 확실히 회수한다는 계약과 구현 증거가 부족하다. 장기 orphan 사례도 보고됐다.
- Aider의 `/run`은 동기 실행 중심이고 background process registry나 cleanup hook을 제공하지 않는다. Aider를 subprocess로 띄운 호출자가 바깥쪽 수명주기를 책임져야 한다.
- session 종료 시 전체 process를 정리하는 것이 여러 런타임의 설계 의도이지만, Claude Code와 Gemini CLI의 실제 사례에서는 이 경계마저 깨져 orphan process가 남는다.

따라서 Codexclaw는 `turn complete`, `child final`, `session closed`, `process exited`를 별도 상태로 다뤄야 한다. process 소유권과 정리는 암묵적 추론이 아니라 명시적인 handle, registry, 종료 정책, 최종 검증으로 관리해야 한다.

## 2. 질문별 답

| 질문 | 답 | 근거 요약 |
|---|---|---|
| 서브에이전트가 끝날 때까지 부모 turn이 유지되는가? | 런타임과 실행 모드에 따라 다르다. | Claude foreground는 block, Claude background는 분리, Codex는 spawn 후 명시적 `wait`가 필요하다. |
| 부모가 기다리면 child process도 함께 정리되는가? | 아니다. | agent task 완료와 OS process 종료는 별도 경계다. Codex에서는 child FINAL 뒤에도 terminal PID가 남는 것을 직접 관찰했다. |
| turn interrupt가 background terminal을 정리하는가? | 일반적으로 아니다. | Codex는 `Op::Interrupt`와 background-terminal cleanup을 의도적으로 분리한다. Claude도 background subagent에 독립 AbortController를 둔다. |
| session 종료가 모든 process를 정리하는가? | 설계 의도상 그렇더라도 신뢰할 수 있는 보장은 아니다. | Codex는 session shutdown에서 `terminate_all_processes()`를 호출한다. Claude Code와 Gemini CLI에서는 정상 종료·터미널 종료 뒤 orphan이 남은 사례가 보고됐다. |
| 다른 thread가 process handle을 이어받을 수 있는가? | handle 소유 범위를 벗어나면 안 된다. | 이전 실험에서 child의 unified-exec `session_id`를 부모가 사용하자 `Unknown process id`가 발생했다. |

## 3. 수명주기 층위

이 문제는 하나의 “작업 종료”로 묶으면 오판하기 쉽다. 최소한 다음 다섯 층을 분리해야 한다.

| 층위 | 완료·종료의 의미 | 흔한 오해 |
|---|---|---|
| Parent turn | 모델이 현재 응답 생성을 끝냈거나 interrupt됨 | turn이 끝났으니 child와 shell도 끝났다고 간주 |
| Subagent task/thread | child가 최종 결과를 반환하거나 취소됨 | child final이 child가 만든 모든 process의 종료를 뜻한다고 간주 |
| Agent session | 대화·thread가 닫히거나 runtime이 shutdown됨 | session close hook이 항상 실행되고 process tree를 완전히 회수한다고 간주 |
| Shell/tool session | runtime registry가 보유한 `session_id`·`processId`가 종료됨 | registry handle을 다른 thread에서도 사용할 수 있다고 간주 |
| OS process tree | 실제 PID와 자손 process가 모두 종료됨 | 직접 child 하나에 signal을 보내면 손자까지 정리된다고 간주 |

안전한 구현은 위 상태를 각각 관찰하고, `child final → owned process registry 확인 → graceful terminate → bounded wait → forced kill → empty registry/process-tree 검증` 순서로 닫아야 한다.

## 4. Claude Code

### 4.1 Subagent 실행 모드

Claude Code 공식 문서에서 subagent는 별도 context window, system prompt, tool 권한을 가진 독립 agent instance다. Agent tool로 시작하며 실행 모드는 크게 두 가지다.

| 모드 | 부모와의 관계 | 취소 경계 | 수명주기 의미 |
|---|---|---|---|
| Foreground | 부모 turn이 child 완료까지 동기적으로 block | 부모와 shared AbortController | 부모가 기다리지만 process cleanup까지 보장하는 것은 아니다. |
| Background | 부모가 child와 병행 진행 | child가 independent AbortController 사용 | 부모 abort 뒤에도 child가 계속 실행될 수 있다. |

`CLAUDE_CODE_FORK_SUBAGENT=1`은 spawn을 background로 강제하고, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`는 이를 덮어쓴다. 조사 시점 문서에는 최대 5단계 nesting이 기록돼 있다.

### 4.2 Background bash

Claude Code의 bash command는 매 호출마다 완전히 새로운 shell을 만드는 모델이 아니라 persistent shell session으로 관리된다. `run_in_background` 또는 `Ctrl+B`로 background task를 만들고, `bash_1`, `bash_2` 같은 ID를 통해 `BashOutput`, `KillBash`, `/bashes`로 조회·종료한다.

- 같은 Claude session 안에서는 turn을 넘어 추적된다.
- session restart 뒤에는 shell과 cwd·env·children을 이어받지 못한다.
- 문서상 session 종료 시 정리를 기대할 수 있지만, 실제 issue에서는 process group 신호 전파가 빠져 orphan이 남는 사례가 반복 보고됐다.

### 4.3 문서 계약과 실제 동작의 간극

GitHub issue #19045, #20369, #51516, #72109는 Linux, macOS, WSL/systemd 환경에서 정상 종료나 터미널 종료 후에도 child process가 남는 사례를 보고한다. orphan은 PID 1뿐 아니라 `systemd --user`로 reparent될 수 있어 단순히 PPID 1만 찾는 reaper도 충분하지 않다.

보고된 규모는 process당 약 200–400MB, 수십 개 누적, 단일 orphan 약 30GB까지 다양하다. 이는 공식 cleanup 의도를 구현 보장으로 취급하면 안 된다는 강한 신호다. 다만 개별 issue의 수치와 재현 조건은 upstream issue report이므로 이 문서의 ledger에서는 `lead`로 분류한다.

커뮤니티 workaround는 대체로 소유 process tree에 `SIGTERM`을 보내고 약 3초 기다린 뒤 생존 자손에 `SIGKILL`을 보내는 방식이다. `cc-reaper`처럼 subagent, MCP server, plugin process를 여러 층으로 추적하는 도구도 등장했다.

## 5. OpenAI Codex

### 5.1 Parent turn과 child agent

`codex-rs/core/src/tools/handlers/multi_agents.rs`의 계약은 `spawn_agent`, `send_input`, `wait`, `resume_agent`, `close_agent` 다섯 함수로 분리돼 있다. `spawn_agent`는 child 완료까지 부모를 암묵적으로 block하지 않는다. 부모는 child 상태를 나중에 `wait`로 명시적으로 수집해야 한다.

따라서 Codex에서 “부모 turn이 살아 있으니 child가 아직 실행 중이다” 또는 “부모가 응답을 끝냈으니 child도 끝났다”는 추론은 모두 안전하지 않다. agent orchestration 상태와 process 상태를 각각 조회해야 한다.

### 5.2 Turn interrupt와 background terminal

PR #14602에서 background terminal은 turn interrupt 뒤에도 유지되는 방향으로 정리됐다. `Op::Interrupt`는 더 이상 background terminal을 닫지 않으며, 전체 정리 명령은 `/clean`에서 `/stop`으로 이름이 바뀌었다.

- `turn/interrupt`: 현재 task 취소
- `/stop`: session이 가진 background process 전체 정리
- session shutdown: `unified_exec_manager.terminate_all_processes()` 호출

즉, `turn/interrupt ≠ process termination`은 우연한 누락이 아니라 현재 Codex lifecycle의 명시적 분리다. `/stop`은 전체 종료만 지원하므로 per-process target이 필요하다는 요청도 issue #17821에 남아 있다.

### 5.3 Child thread와 process handle의 소유 범위

이전 세션의 로컬 실험은 source-level 계약과 같은 방향을 보였다.

| 실험 | 관찰 | 해석 |
|---|---|---|
| Child가 unified-exec background session 생성 | handle이 child thread에만 보임 | unified-exec session handle은 thread-local ownership을 가진다. |
| 부모가 child의 `session_id`로 `write_stdin` 호출 | `Unknown process id` | ID 문자열만 전달해서 registry ownership을 이전할 수 없다. |
| Child가 `FINAL_ANSWER` 반환 | terminal PID가 9초 이상 생존 | child logical completion이 process teardown을 호출하지 않는다. |
| 30초 bounded probe | 자연 종료까지 확인 | 남은 process가 반드시 무한 orphan은 아니지만, 자연 종료 전까지는 실제로 살아 있다. |

Issue #23292와 #29275도 child thread보다 process가 오래 사는 UX 간극을 다룬다. session shutdown의 `terminate_all_processes()`는 최종 방어선이지만, child thread가 끝나는 순간의 cleanup hook은 아니다.

### 5.4 App-server lifecycle surface와의 관계

이 폴더의 `001_codex_rs_runtime_guide.md`가 정리한 app-server API는 같은 thread/session registry에 남아 있는 unified-exec process를 `list`, `terminate`, `clean`할 수 있다. 이것은 turn 완료를 process 완료로 간주하지 않고 별도의 control plane을 둔 사례다.

다만 process registry는 app-server instance와 loaded thread의 소유 범위에 묶인다. 별도 app-server나 다른 thread에서 ID만 재사용해 attach할 수 없다. 이 제한은 로컬 실험의 `Unknown process id`와 같은 원칙을 보여준다.

## 6. Gemini CLI

Gemini CLI 공식 shell 문서는 shell command가 `bash -c` 또는 플랫폼 shell을 통해 실행되고, background shell을 `/shells`에서 확인할 수 있다고 설명한다. 이 inventory는 현재 CLI session의 registry이지 durable scheduler나 cross-session attachment 계약이 아니다.

조사 lane에서 확인한 구현상 위험은 다음과 같다.

- process group 또는 cgroup 단위 teardown이 없다.
- CLI entrypoint에 종료 시 모든 자손을 회수하는 명확한 `SIGHUP`·`SIGTERM` handler가 부족하다.
- 장기 실행 orphan과 종료되지 않은 port holder로 인한 Windows `EADDRINUSE` 사례가 보고됐다.
- 30분 inactivity 뒤 force-exit하는 community watchdog 제안이 있었지만 merge되지 않았다.

“47일 이상 생존, 232시간 이상 CPU 사용” 같은 수치는 실제 issue·report에 기반한 위험 신호지만, 이 문서 작성 시점에 독립 재현하지 않았으므로 `lead`로 유지한다. 공식적으로 확인할 수 있는 범위는 shell tool과 session-local `/shells` control surface이며, 종료 신뢰성은 별도 검증 대상이다.

## 7. Aider

Aider의 `/run`은 shell command를 실행하고 결과를 대화에 반영하는 동기 실행 흐름이다. 조사한 범위에서는 다음 lifecycle 기능이 없다.

- background spawn API
- 장기 process의 PID·process-group registry
- poll·resume·targeted terminate API
- Aider 종료 시 호출되는 process-tree cleanup hook

따라서 Aider 자체가 장기 process supervisor 역할을 한다고 가정해서는 안 된다. 자동화 도구가 Aider를 subprocess로 시작한다면, 그 호출자가 process group 생성, timeout, signal escalation, descendant reap을 책임져야 한다.

## 8. 기타 런타임

Cursor, Windsurf, Amazon Q CLI에서는 이번 조사로 검증 가능한 상세 subprocess lifecycle 계약을 확보하지 못했다. closed-source이거나 agent 실행과 terminal 실행의 경계가 문서에 충분히 드러나지 않았다.

이 부재는 “cleanup이 된다”는 증거가 아니다. Codexclaw에서 이 런타임들을 지원할 때는 다음 정보를 런타임별로 새로 확인해야 한다.

1. foreground·background agent spawn의 block semantics
2. child cancel이 shell process group까지 전파되는지
3. turn, session, app shutdown 각각의 cleanup hook
4. process ID의 registry scope와 reattach 가능 여부
5. crash·SIGKILL·terminal close 뒤 orphan 회수 방식

## 9. 일반 에이전트 런타임 설계 패턴

### 9.1 Session당 subprocess

Claude Agent SDK hosting 문서는 하나의 Session을 하나의 SDK subprocess로 운영하는 모델을 설명한다. 운영 패턴은 대체로 다음 네 가지로 나뉜다.

| 패턴 | 장점 | lifecycle 부담 |
|---|---|---|
| Pre-warmed long-lived | 낮은 시작 지연 | 누적 state와 orphan 감시가 필요하다. |
| Ephemeral rehydrating | 종료 경계가 분명함 | 매번 state 복원 비용이 든다. |
| Explicit state ownership | session·process 소유자가 명확함 | registry와 handoff protocol을 직접 설계해야 한다. |
| Network boundary isolation | runtime crash와 권한을 격리 | 별도 control plane과 인증이 필요하다. |

`N sessions = N subprocesses` 구조에서는 session registry와 OS process registry가 어긋나지 않도록 생성·종료를 하나의 owner가 맡아야 한다.

### 9.2 Process group과 단계적 interrupt

arXiv 2603.05344는 Unix에서 `start_new_session=True`로 독립 process group을 만들고 `os.killpg`로 그룹 전체에 signal을 보내는 패턴을 사용한다. interrupt token은 여섯 phase boundary에서 polling하며, 빠른 연속 keypress를 한 번만 처리하는 guard와 thread-safe injection queue를 둔다.

핵심은 직접 child PID 하나가 아니라 **소유한 process group 전체**를 종료 대상으로 삼는 것이다. Windows에서는 Job Object, Linux production에서는 cgroup 같은 플랫폼별 primitive가 같은 역할을 한다.

### 9.3 Timeout-enforced hook

Antigravity CLI hook 사례는 hook subprocess에 15–60초 범위 timeout을 두고, `timeout=0`이면 즉시 종료하는 경계를 둔다. hook은 agent 본체와 같은 수명주기를 가진다고 가정하지 않고, 시작할 때부터 종료 budget을 부여한다.

### 9.4 Sandbox-as-lifecycle

ephemeral container나 microVM을 process owner로 두면 destroy-on-exit 자체가 최종 cleanup primitive가 된다. E2B의 Firecracker microVM처럼 빠른 부팅을 제공하는 sandbox는 leaked descendant를 VM 경계째 폐기할 수 있다.

반대로 LangChain, AutoGen, SWE-Agent를 비롯한 많은 framework는 기본적으로 subprocess·`exec()` 호출을 제공할 뿐, isolation과 descendant cleanup을 자동 보장하지 않는다. framework tool API가 있다는 사실과 OS-level lifecycle 보장은 별개다.

### 9.5 MCP의 책임 경계

MCP specification은 transport와 session lifecycle을 정의하지만, host가 시작한 MCP server나 그 server가 만든 임의 subprocess의 OS-level 정리 정책까지 규정하지 않는다. spawn, signal, process-group ownership, restart, reap은 host 구현 책임이다.

## 10. 교차 런타임 비교

| 런타임 | Parent가 child 완료까지 자동 block | Background process가 turn 뒤 생존 | Session 종료 시 cleanup 의도 | 실제 orphan 위험 |
|---|---|---|---|---|
| Claude Code foreground | 예 | 가능 | 있음 | 높음: 다중 플랫폼 issue |
| Claude Code background | 아니오 | 예 | 있음 | 높음: 독립 abort + cleanup issue |
| OpenAI Codex | 아니오, 명시적 `wait` | 예 | `terminate_all_processes()` | 중간: source상 최종 정리 경로는 있으나 child final과 분리 |
| Gemini CLI | agent orchestration 계약 불명확 | session-local shell 기준 가능 | 명확한 process-group 보장 부족 | 높음: 장기 orphan lead |
| Aider | `/run`은 동기 | 자체 관리 기능 없음 | caller 책임 | caller 구현에 따라 결정 |
| 일반 framework | 구현별 상이 | 흔함 | 구현별 상이 | isolation이 없으면 높음 |

공통분모는 “turn 종료를 cleanup trigger로 간주할 수 없다”는 점이다. block 여부는 모델 응답 흐름을 설명할 뿐, process tree의 종료를 증명하지 않는다.

## 11. Claim Ledger

상태 정의:

- `verified`: 공식 문서, upstream source·PR, 또는 이번 로컬 실험에서 직접 확인한 계약
- `lead`: GitHub issue, community report, 2차 자료, 또는 아직 독립 재현하지 않은 구현 주장

| Claim | Source URL | Source type | Lane | Status |
|---|---|---|---|---|
| Claude subagent는 독립 context·prompt·tool을 가지며 foreground와 background 실행을 지원한다. | [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) | 공식 문서 | 1 — Averroes | verified |
| Claude foreground는 부모를 block하고 background는 독립 취소 경계를 가진다. | [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) | 공식 문서 | 1 — Averroes | verified |
| Claude background bash는 ID로 조회·종료되며 session 안에서 추적된다. | [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) | 공식 문서 | 1 — Averroes | verified |
| Claude Code 종료 뒤 Linux에서 다수 orphan이 PID 1로 reparent된다. | [anthropics/claude-code#19045](https://github.com/anthropics/claude-code/issues/19045) | GitHub issue | 1·2 — Averroes·Avicenna | lead |
| Claude Code가 background process를 정리하지 않는 기존 사례가 있다. | [anthropics/claude-code#6594](https://github.com/anthropics/claude-code/issues/6594) | GitHub issue | 1 — Averroes | lead |
| macOS VS Code terminal 종료 뒤 대형 orphan process가 남을 수 있다. | [anthropics/claude-code#20369](https://github.com/anthropics/claude-code/issues/20369) | GitHub issue | 2 — Avicenna | lead |
| WSL에서는 orphan이 PID 1이 아니라 `systemd --user`로 reparent될 수 있다. | [anthropics/claude-code#51516](https://github.com/anthropics/claude-code/issues/51516) | GitHub issue | 2 — Avicenna | lead |
| 정상 exit·message replay 흐름에서도 다수 orphan이 장기간 남을 수 있다. | [anthropics/claude-code#72109](https://github.com/anthropics/claude-code/issues/72109) | GitHub issue | 2 — Avicenna | lead |
| Codex multi-agent spawn은 child 완료를 암묵적으로 기다리지 않고 별도 `wait`를 제공한다. | [multi_agents.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/multi_agents.rs) | upstream source | 3 — Nietzsche | verified |
| Codex agent orchestration의 wait semantics가 별도 개선 대상으로 다뤄졌다. | [openai/codex#23292](https://github.com/openai/codex/issues/23292), [openai/codex#28792](https://github.com/openai/codex/pull/28792) | issue·PR | 3 — Nietzsche | verified |
| Codex turn interrupt는 background terminal을 자동 종료하지 않으며 `/stop`이 별도 cleanup 경계다. | [openai/codex#14602](https://github.com/openai/codex/pull/14602) | upstream PR | 3 — Nietzsche | verified |
| Codex session shutdown은 `terminate_all_processes()`를 호출한다. | [codex.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/codex.rs) | upstream source | 3 — Nietzsche | verified |
| Codex child thread가 끝난 뒤에도 process가 남는 UX 간극이 보고됐다. | [openai/codex#29275](https://github.com/openai/codex/issues/29275) | GitHub issue | 3 — Nietzsche | lead |
| Codex `/stop`의 per-process targeting이 별도 요구사항으로 제안됐다. | [openai/codex#17821](https://github.com/openai/codex/issues/17821) | GitHub issue | 3 — Nietzsche | lead |
| Gemini CLI는 shell tool과 `/shells` session inventory를 제공한다. | [Gemini CLI shell tool](https://google-gemini.github.io/gemini-cli/docs/tools/shell.html) | 공식 문서 | 4 — Godel | verified |
| Gemini CLI에는 process-group cleanup이 부족하고 장기 orphan 사례가 있다. | [gemini-cli issues](https://github.com/google-gemini/gemini-cli/issues) | issue 조사 lead | 4 — Godel | lead |
| Aider `/run`은 동기 command 실행이며 background lifecycle registry가 없다. | [Aider in-chat commands](https://aider.chat/docs/usage/commands.html) | 공식 문서·source 조사 | 4 — Godel | verified |
| Claude Agent SDK hosting은 Session당 SDK subprocess 모델을 설명한다. | [Claude Agent SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting) | 공식 문서 | 5 — Herschel | verified |
| 독립 process group과 `os.killpg`는 agent subprocess tree cleanup의 실전 패턴이다. | [arXiv:2603.05344](https://arxiv.org/html/2603.05344v1) | 연구 논문 | 5 — Herschel | verified |
| Antigravity CLI hook은 timeout으로 subprocess 실행 경계를 제한한다. | [Agent hooks in Antigravity CLI](https://medium.com/google-cloud/a-developers-guide-to-agent-hooks-in-antigravity-cli-4c1440febd11) | 기술 글·2차 자료 | 5 — Herschel | lead |
| ephemeral microVM·sandbox destroy는 process cleanup의 강한 최종 경계다. | [Agentic design patterns](https://www.augmentcode.com/guides/agentic-design-patterns) | 기술 가이드·2차 자료 | 5 — Herschel | lead |
| MCP는 임의 subprocess의 OS-level lifecycle을 표준화하지 않으며 host가 책임진다. | [MCP lifecycle specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle) | 공식 specification | 5 — Herschel | verified |

## 12. Codexclaw 패치 시사점

### 12.1 상태 모델

Codexclaw 문서와 runtime adapter는 다음 상태를 한 boolean으로 합치지 않아야 한다.

```text
agent_running
agent_final_received
terminal_registered
terminal_exit_observed
session_shutdown_started
session_cleanup_verified
```

`agent_final_received=true`만으로 `terminal_exit_observed=true`를 설정하면 안 된다. child가 만든 process의 handle이 child-local이면 부모가 그 handle을 직접 조작할 수 있다고 가정해서도 안 된다.

### 12.2 명시적 소유권

process record에는 최소한 다음 owner 정보를 남겨야 한다.

- runtime instance ID
- parent session·thread ID
- spawning agent ID
- tool call ID
- runtime process/session handle
- OS PID 또는 process-group ID가 확인된 경우 그 값
- created time, last activity, bounded deadline

handle은 opaque token으로 취급한다. 다른 thread나 runtime instance에서 같은 문자열을 재사용해 attach하지 않는다.

### 12.3 종료 순서

권장 teardown은 다음과 같다.

1. runtime-native targeted terminate 사용
2. registry에서 종료 상태 poll
3. bounded grace period 적용
4. 소유권이 확인된 process group에만 강제 종료
5. registry empty와 descendant 부재를 각각 검증
6. 실패 시 orphan lead를 남기고 reaper에 인계

임의 PID guessing, 전체 사용자 process scan 뒤 blind `kill`, 부모 PID 하나만 종료하는 방식은 금지해야 한다.

### 12.4 Turn과 session hook

- Turn completion hook: process를 자동 종료하지 말고, 살아 있는 terminal을 inventory에 남긴다.
- Child close hook: child-owned terminal 정책을 실행하되 parent가 접근할 수 없는 handle은 runtime owner에게 cleanup을 요청한다.
- Session shutdown hook: 모든 owned process에 graceful→forced teardown을 실행한다.
- Crash recovery: 이전 registry와 실제 process를 대조하는 startup reaper를 둔다.

foreground command, intentional background service, bounded probe는 종료 정책이 달라야 한다. 특히 dev server처럼 turn을 넘어 살아야 하는 process를 turn hook에서 죽이면 기능이 깨진다.

### 12.5 검증 계약

패치는 최소한 다음 경우를 자동 또는 수동 probe로 검증해야 한다.

| Case | 기대 결과 |
|---|---|
| Child final 후 bounded background process | child는 끝나고 process는 deadline까지 관찰 가능 |
| 부모가 child-local handle 사용 | 명시적인 ownership error, 임의 attach 없음 |
| Turn interrupt | intentional background process 유지 |
| Targeted terminate | 해당 process만 종료, 다른 process 유지 |
| Session shutdown | owned registry empty + descendant 없음 |
| Runtime crash·terminal close | startup reaper가 stale owner를 식별 |
| SIGTERM 무시 child | grace period 뒤 process group 강제 종료 |
| WSL/systemd reparent | PPID 1 전제 없이 owner metadata로 탐지 |

### 12.6 문서 표현

Codexclaw의 lifecycle 안내는 다음 문장을 계약으로 삼아야 한다.

> Turn 완료는 process 종료 증거가 아니다. Agent 완료, terminal registry 제거, OS process tree 종료를 각각 확인한다.

Codex app-server의 `list`·`terminate`·`clean`은 이 원칙을 구현하는 current control surface로 소개하되, 같은 app-server instance와 loaded thread에 묶인다는 제한을 함께 적어야 한다.

## 13. 방법론 메모

이번 조사는 세션 `019f5b11-dc49-7bb2-b828-0ce9f41f0860`에서 `cxc-sparksearch` 5-lane swarm으로 시작했다.

| Lane | Researcher | 조사 대상 | 최종 실행 상태 |
|---|---|---|---|
| 1 | Averroes | Claude Code 공식 문서 | serial fallback 완료 |
| 2 | Avicenna | Claude Code GitHub issue와 실제 동작 | serial fallback 완료 |
| 3 | Nietzsche | OpenAI Codex `codex-rs` source | serial fallback 완료 |
| 4 | Godel | Gemini CLI, Aider, 기타 runtime | serial fallback 완료 |
| 5 | Herschel | 일반 agent runtime 설계 패턴 | serial fallback 완료 |

초기에는 `gpt-5.3-codex-spark` worker 5개를 병렬 실행했으나 모두 `reasoning.context=all_turns` 불일치로 실패했다. 모델을 지정하지 않은 serial fallback으로 각 lane을 다시 실행해 결과를 회수했다.

증거 해석 원칙은 다음과 같다.

- 공식 문서와 upstream source는 공개 계약 확인에 사용했다.
- GitHub issue와 community reaper는 위험 탐색용 lead로 사용했다.
- issue의 자원 사용량과 장기 orphan 수치는 독립 재현 없이 일반화하지 않았다.
- Codex의 thread-local handle과 child FINAL 뒤 process 생존은 이전 세션의 bounded local probe로 보강했다.
- 서로 다른 런타임의 ID·session·process 개념을 같은 것으로 간주하지 않았다.

## 14. 다음 단계

- [ ] Claude Code 최신 버전에서 foreground, background, `/exit`, terminal close별 orphan matrix를 macOS와 Linux에서 재현한다.
- [ ] Gemini CLI 장기 orphan lead의 정확한 issue URL과 현재 source의 signal handler·process-group 경로를 고정한다.
- [ ] Codex child FINAL 뒤 app-server `thread/backgroundTerminals/list`가 보이는 상태를 redacted evidence로 저장한다.
- [ ] Codex session shutdown 뒤 `terminate_all_processes()`가 descendant까지 닫는지 bounded integration probe를 추가한다.
- [ ] Codexclaw lifecycle 문서에 `turn complete ≠ process exit` 계약과 opaque handle ownership 규칙을 반영한다.
- [ ] targeted terminate → grace period → process-group kill → empty verification 순서의 공통 teardown policy를 설계한다.
- [ ] WSL `systemd --user`, macOS terminal close, Windows Job Object를 포함한 cross-platform reaper 전략을 비교한다.
- [ ] intentional background server와 leaked orphan을 구분할 owner metadata·deadline schema를 정의한다.
- [ ] startup stale-process reconciliation과 session shutdown cleanup을 별도 acceptance case로 만든다.
- [ ] `001_codex_rs_runtime_guide.md`의 app-server 계약과 후속 phase 문서의 표현이 이 연구 결론과 일치하는지 audit한다.
