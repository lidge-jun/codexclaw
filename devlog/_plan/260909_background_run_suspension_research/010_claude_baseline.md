# 010 — Claude 쪽 기준선 (wp2)

사용자가 말한 "Claude의 백그라운드 서브에이전트나 세션"이 정확히 무엇인지 확정한다.
표면마다 다음을 기록한다. 부모 턴을 블로킹하는가, 턴 종료 후에도 사는가, 나중에 다시 붙을 수 있는가.

증거 등급: [S] = 로컬 소스 스냅샷 150_claude_code (2026-03경, 메인 미검증), [D] = 공식 문서 code.claude.com (L7 회수, 메인 재방문 안 함).
도구 이름은 이동 표적이다. 소스 스냅샷과 현재 문서가 다르면 현재 동작 판정은 문서를 따른다.

## 1. 셸 백그라운드

**Bash `run_in_background`** [S][D] — 명령을 백그라운드 태스크로 띄우고 즉시 task ID를 반환한다. 출력은 파일로 나가고 나중에 `Read`로 읽는다. 타임아웃에 걸린 전경 명령은 죽이지 않고 자동으로 백그라운드로 옮긴다(BashTool.tsx:967-971). 자동 전환 예외는 소스 기준으로 `DISALLOWED_AUTO_BACKGROUND_COMMANDS = ['sleep']` 하나뿐이고 첫 토큰만 본다(BashTool.tsx:220-221, 307-314). 감사에서 정정: git은 자동 백그라운드 예외가 아니라 별도 검증 경로다.
소스: `src/tools/BashTool/BashTool.tsx:989-1000`이 `spawnBackgroundTask()` 후 빈 stdout과 `backgroundTaskId`만 돌려준다 [S].
턴 관계: 부모 턴을 블로킹하지 않는다. 완료는 `<task-notification>`으로 큐에 들어간다.

**Ctrl+B** [D] — 이미 돌고 있는 전경 Bash와 에이전트를 백그라운드로 보낸다. 2025-08-07 1.0.71에 Bash용으로 들어왔고 2026-01 2.1.x에서 에이전트까지 통합됐다. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`로 전부 끌 수 있다.

**출력 회수와 중지** [D] — 현재 공식 도구 표에 `BashOutput`/`KillShell`은 없다. `TaskOutput`은 출력 파일을 `Read`하라며 deprecated이고 중지는 `TaskStop`이다. `/bashes`는 `/tasks`의 별칭으로만 남았다.
소스 스냅샷도 같은 방향이다. `TaskOutputTool`이 `aliases: ['AgentOutputTool','BashOutputTool']`, `TaskStopTool`이 `aliases: ['KillShell']` [S].

**Monitor** [D, 소스 좌표 없음] — 이 스냅샷 트리에 `src/tools/MonitorTool` 경로가 없어 코드로 대조할 수 없다. 문서 기준으로는 백그라운드 명령의 stdout을 줄 단위 또는 WebSocket 프레임 단위 이벤트로 밀어 넣어, 폴링 없이 진행 중에 반응하게 한다. 사용자가 말한 "대기한 채로 추적"에 가장 직접적으로 대응하는 표면이다.

**`TaskOutput(block=true)`** [S] — 100ms 폴링으로 완료를 기다리는 별도 도구 호출이다. 부모 런을 서스펜드하는 것이 아니라 모델이 스스로 고른 블로킹 대기다. 현재 문서에서는 deprecated.

## 2. 서브에이전트

**Agent 도구(구 Task)** [S][D] — 2.1.63에서 `Task`가 `Agent`로 개명, 별칭 유지. 자식은 자기 컨텍스트에서 돌고 부모에게는 최종 텍스트만 돌려준다.

**동기 vs 비동기** [S] — `shouldRunAsync`가 갈림길이다. `run_in_background === true`이거나 에이전트 정의가 `background: true`이거나 코디네이터/fork/assistant 모드이거나 `proactiveModule?.isProactiveActive()`면 비동기다(AgentTool.tsx:567).
비동기: `void runAsyncAgentLifecycle(...)` 후 즉시 `{status:'async_launched', agentId}` 반환. 주석이 "부모의 abort controller에 연결하지 않는다 — 사용자가 ESC를 눌러도 백그라운드 에이전트는 살아야 한다"고 명시한다 [S].
동기: `runAgent` 이터레이터를 끝까지 소비. 부모 턴의 툴콜이 열린 채로 대기한다 [S].

**전경에서 배경으로 전환** [S] — 동기 에이전트도 도중에 백그라운드로 넘길 수 있다. 루프가 `Promise.race([nextMessage, backgroundSignal])`을 돌다가 시그널이 오면 부모는 `async_launched`를 반환하고 자식은 계속 돈다.

**현재 기본값** [D] — v2.1.198부터 서브에이전트는 기본 백그라운드이고, 결과가 당장 필요할 때만 모델이 전경을 요청한다. 인터랙티브 fork 모드가 켜져 있으면 전부 백그라운드로 강제되고 모델은 전경을 요청할 수 없다. 동시 실행 한도는 기본 20(`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`), 중첩 깊이 기본 3.

**완료 알림 경로** [S][D] — 자식이 끝나면 `<task-notification>` XML을 전역 큐에 넣는다. 기본 우선순위는 `later`라 사용자 입력을 굶기지 않는다(messageQueueManager.ts:137-143). 다만 셸 완료 알림은 Monitor가 켜져 있으면 `next`로 올라간다(LocalShellTask.tsx:169). REPL은 턴과 턴 사이에 이 큐를 비운다. 진행 중인 쿼리 루프도 조건이 맞으면 mid-turn attachment로 끌어올 수 있지만, 그것도 원래 assistant 생성을 이어 붙이는 것이 아니라 다음 API 호출의 새 입력 쪽에 붙는 것이다 [S].
코디네이터 프롬프트가 이 계약을 모델에게 직접 설명한다. 에이전트를 띄운 뒤 무엇을 띄웠는지 짧게 말하고 응답을 끝내라, 결과를 지어내지 마라, 워커 결과는 user-role 메시지로 도착한다 [S].

## 3. 세션

**저장과 재개** [S][D] — 메인 세션은 UUID `sessionId`의 JSONL. CLI `-c/--continue`, `-r/--resume [id]`, `--session-id`, `--fork-session`. SDK는 `continue` / `resume: <sessionId>` / `forkSession`.
재개는 저장된 대화를 다시 열고 새 프롬프트로 이어가는 것이지, 멈춰 있던 생성을 그 지점부터 잇는 것이 아니다 [D].

**sidechain** [S] — 서브에이전트 전사는 메인 JSONL이 아니라 `.../{sessionId}/subagents/agent-{agentId}.jsonl`에 `isSidechain: true`로 따로 쌓이고 `/resume` 목록에서 걸러진다. `resumeAgentBackground`는 그 파일을 읽어 자식을 백그라운드로 재시작한다.

**Detached background session** [D] — agent view (`claude agents`, `claude --bg`, `/background`). 터미널을 떼도 supervisor가 세션 전체를 계속 돌린다. 리서치 프리뷰.
`/background`(별칭 `/bg`)가 현재 대화를 백그라운드 세션으로 옮긴다. 문서 문장: "Background sessions don't need any terminal open to keep working" [D].
소스 스냅샷에는 이것의 대응물이 없다. 비슷해 보이는 `LocalMainSessionTask`는 같은 프로세스 안에서 현재 쿼리를 백그라운드 태스크로 넘기고 UI만 비우는 것이고(LocalMainSessionTask.ts:1-8), 이 스냅샷에서 Ctrl+B의 세션 경로는 컴파일 시점에 꺼져 있다(SessionBackgroundHint.tsx:47-70). 감사에서 정정: detached supervisor는 [D]만 있고 이 트리에 소스 대응이 없다 [S].

**`/subtask` vs `/fork`** [D] — `/subtask`는 대화를 상속한 백그라운드 서브에이전트를 띄우고 결과가 이 대화로 돌아온다. `/fork`는 대화를 별도 백그라운드 세션으로 복사하고 원본은 계속 돈다.

## 4. SDK와 훅

**streaming input mode** [D] — 권장 모드. 긴 수명 프로세스처럼 입력을 받고 메시지 큐, 인터럽트, 권한, 세션 관리가 된다.

**`interrupt()`** [D] — streaming input 모드에서만 동작한다. 현재 턴만 끊고 세션은 살아 있어 다음 프롬프트로 이어간다.

**Stop 훅의 `decision: "block"`** [D] — 에이전트가 멈추려는 시점에 이유를 주고 한 턴 더 돌게 한다. 8회 연속이면 런타임이 덮어쓰고 끝낸다. 반대로 모든 이벤트의 top-level `continue: false`는 에이전트를 완전히 멈춘다.

**`PreToolUse`의 `permissionDecision: "defer"`** [D] — `-p` 비대화형에서만 존중된다. 프로세스가 그 도구 호출을 보존한 채 종료하고, 호스트가 입력을 모은 뒤 같은 세션을 resume한다. 인터랙티브에서는 경고 후 무시된다.
이것이 Claude 진영에서 "런을 중지하고 나중에 재개"에 가장 가까운 1급 메커니즘이다.

**Dynamic workflows** [D] — 문서 원문: "a runtime executes it in the background while your session stays responsive", "Workflows run in the background, so the session stays responsive while agents work". `/workflows` progress view에서 `p`가 pause/resume, `x` stop, `r` restart. 다만 "You can resume a run within the same Claude Code session"이고 "No mid-run user input", "Only agent permission prompts can pause a run"이라는 제약이 붙는다. 즉 workflow의 pause는 대화 턴의 pause가 아니라 스크립트 런의 pause다.

## 5. 부모 런 park는 Claude에도 없다

L1이 `waiting_for_child`, `parkQuery`, `suspendParent`, `parentWaiting`, `yieldUntilChild`, `waitForSubagent`, `wait_for_child`로 소스를 훑었고 매칭이 없었다 [S].
`waiting_for_agents`는 headless `print.ts`가 턴이 끝난 뒤 백그라운드 에이전트를 기다리며 프로세스를 붙잡는 종료 폴링이다. `suspend`는 유닉스 SIGTSTP다.

즉 Claude의 모델도 부모 생성을 얼렸다가 같은 지점에서 잇는 것이 아니다. 부모의 선택지는 세 가지다. 동기 Agent 툴콜로 열린 채 기다리거나(이 경우 부모 턴은 점유된다), 백그라운드로 띄우고 계속 일하거나, 턴을 끝내는 것. 어느 쪽이든 자식 결과는 다음 턴의 입력으로 들어온다. 사용자가 좋다고 느끼는 부분은 park가 아니라 이것이다. 자식을 띄운 뒤 부모가 자유로워지고, 완료가 스스로 대화에 돌아오며, 그 사이에 목록을 보고 붙었다 뗄 수 있다는 것.

## 6. 공식 문서 원문 (Aside 브라우저로 직접 확인, [D] 승격)

sub-agents (https://code.claude.com/docs/en/sub-agents):

> Foreground subagents block the main conversation until complete. Permission prompts are passed through to you as they come up.

> Where fork mode is off, Claude runs the subagent in the background by default and in the foreground when it needs the result before continuing.

> A background subagent's results reach Claude as a completion notification in a later turn. Claude waits for that notification before reporting the subagent's results, and if you ask about progress first, it reports that the subagent is still running.

tools-reference (https://code.claude.com/docs/en/tools-reference), Monitor:

> Runs a command in the background and feeds each output line back to Claude, so it can react to log entries, file changes, or polled status mid-conversation. Can also open a WebSocket and treat each incoming message as an event.

> The Monitor tool lets Claude watch something in the background and react when it changes, without pausing the conversation.

hooks (https://code.claude.com/docs/en/hooks), PreToolUse defer:

> "defer" exits gracefully so the tool can be resumed later.

> "defer" is for integrations that run claude -p as a subprocess and read its JSON output... It lets that calling process pause Claude at a tool call, collect input through its own interface, and resume where it left off. Claude Code honors this value only in non-interactive mode with the -p flag. In interactive sessions it logs a warning and ignores the hook result.

> The hook returns permissionDecision: "defer". The tool doesn't execute. The process exits with stop_reason: "tool_deferred" and the pending tool call preserved in the transcript.

제약도 원문에 있다. defer는 그 턴에 도구 호출이 하나일 때만 동작하고, 여러 개면 경고와 함께 무시된다. 재개 시 도구가 사라졌으면 stop_reason은 tool_deferred_unavailable이 된다.

agent view (https://code.claude.com/docs/en/agent-view):

> Background sessions don't need any terminal open to keep working.

workflows (https://code.claude.com/docs/en/workflows):

> a runtime executes it in the background while your session stays responsive

> You can resume a run within the same Claude Code session.

> Only agent permission prompts can pause a run.

이 인용들이 5절의 결론을 다시 확인해 준다. Claude의 "백그라운드"는 부모 생성을 얼리는 것이 아니라, 부모를 자유롭게 두고 완료를 다음 턴 알림으로 돌려주는 것이다. 유일하게 프로세스를 도구 호출 지점에 멈추는 defer조차 인터랙티브에서는 무시되고 -p 호스트 통합 전용이다.

## 기준선 요약 (wp3가 대조할 항목)

1. 셸을 백그라운드로 띄우고 부모는 계속 간다
2. 타임아웃 시 자동 백그라운드 전환
3. 실행 중인 전경 작업을 사후에 백그라운드로 보내는 단축키
4. 세션 내 백그라운드 작업 목록 UI와 attach/stop
5. 스트림 기반 추적(Monitor), 폴링 없이 중간 반응
6. 서브에이전트 기본 백그라운드, 부모 턴 비블로킹
7. 자식 완료가 다음 턴 입력으로 자동 재진입
8. 터미널을 떼도 사는 detached 세션
9. 세션 저장/재개/fork
10. 도구 호출을 보존한 채 프로세스 종료 후 재개(PreToolUse defer)
11. Stop 훅으로 멈추지 말고 한 턴 더
12. 입력이 오면 깨는 블로킹 sleep (프로액티브 `Sleep`, tools.ts:25-27)
13. 실행 중인 에이전트에 메시지를 붙이는 attach (`SendMessage`, SendMessageTool.ts:520-536)
14. 수명 내내 running으로 남는 in-process teammate (headless 종료 폴링이 의도적으로 제외, print.ts:2427-2434)
15. detached supervisor 세션과 in-process 백그라운드 태스크의 구분

