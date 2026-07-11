# 011 - CLI/hook 검토 (사이클 1)

## 1. 검토 범위와 방법

검토 대상은 CLI 진입점 `bin/codexclaw.mjs`, 플러그인 manifest
`plugins/codexclaw/.codex-plugin/plugin.json`, 직속·deprecated hook JSON 20개,
`plugins/codexclaw/components/*` 8개 컴포넌트다. CLI 진입점은 스스로
`"thin delegator over compiled component CLIs"`라고 밝힌다(`bin/codexclaw.mjs:27-28`).
따라서 wrapper 디스패치만 읽지 않고 위임 대상의 TypeScript 소스까지 확인했다.

| 에이전트 | 모델 | 역할 | 왕복 |
|---|---|---|---:|
| Noether | `gpt-5.6-sol` | CLI 표면 읽기 전용 탐색 | 보고 1회 |
| Plato | `gpt-5.6-sol` | hook/FSM 읽기 전용 탐색 | 보고 1회 |
| Dalton | `gpt-5.6-sol` | 계획 A게이트 독립 리뷰 | 8라운드 |

연구 입력은 `000_plan.md`, `001_research_cli.md`, `002_research_hooks.md`, 섹션 계약은
`010_phase1_spec_cli_hooks.md`를 사용했다. 각 `path:line`은 연구 문서에서 복사하지 않고
현재 원본을 `nl -ba`로 다시 읽어 고정했다. 컴포넌트 테스트는 존재 여부와 파일 수만
집계했다. 내용 감사 제외는 `000_plan.md:100-103`의 OUT 계약을 따른다.

검증 명령:

```bash
node --check bin/codexclaw.mjs
node bin/codexclaw.mjs --help
find plugins/codexclaw/hooks -type f -name '*.json' -print | sort
python3 -c 'import json; print(len(json.load(open("plugins/codexclaw/.codex-plugin/plugin.json"))["hooks"]))'
for d in plugins/codexclaw/components/*; do find "$d/test" -type f 2>/dev/null | wc -l; done
rg -c ':[0-9]+' devlog/_plan/260710_repo_review/011_cli_hooks_review.md
```

## 2. CLI 표면 맵

| 명령 표면 | 디스패치 | 구현 위치 |
|---|---|---|
| `help`, `--help`, `-h` | `case`와 성공 종료(`bin/codexclaw.mjs:304-310`) | 인라인 `TOP_LEVEL_HELP`(`bin/codexclaw.mjs:173-216`) |
| `enable` | `runConfigGuard("enable")`(`bin/codexclaw.mjs:312-314`) | `config-guard/dist/cli.js`(`bin/codexclaw.mjs:37-46`) |
| `disable`, `uninstall` | `runConfigGuard("disable")`(`bin/codexclaw.mjs:315-318`) | `config-guard/dist/cli.js`(`bin/codexclaw.mjs:37-46`) |
| `status` | `runConfigGuard("status")`(`bin/codexclaw.mjs:319-321`) | `config-guard/dist/cli.js`(`bin/codexclaw.mjs:37-46`) |
| `doctor`, `reset` | 인수 전체를 `runCxcOps`에 전달(`bin/codexclaw.mjs:322-325`) | `cxc-ops/dist/cli.js`(`bin/codexclaw.mjs:48-57`) |
| `orchestrate <verb>` | 인수 전체를 `runPabcdState`에 전달(`bin/codexclaw.mjs:326-329`) | `pabcd-state/dist/cli.js`(`bin/codexclaw.mjs:59-68`) |
| `freeze` | 같은 PABCD 위임(`bin/codexclaw.mjs:330-335`) | `pabcd-state/dist/cli.js`(`bin/codexclaw.mjs:59-68`) |
| `metric` | 같은 PABCD 위임(`bin/codexclaw.mjs:337-340`) | `pabcd-state/dist/cli.js`(`bin/codexclaw.mjs:59-68`) |
| `divergence` | 같은 PABCD 위임(`bin/codexclaw.mjs:341-344`) | `pabcd-state/dist/cli.js`(`bin/codexclaw.mjs:59-68`) |
| `loop init\|show\|validate` | `loop`을 그대로 전달(`bin/codexclaw.mjs:345-350`) | `pabcd-state` goalplan CLI |
| `goalplan init\|show\|validate` | deprecated alias를 그대로 전달(`bin/codexclaw.mjs:345-350`) | `pabcd-state` goalplan CLI |
| `serve`, `service` | 인수 전체를 `runMessengerBridge`에 전달(`bin/codexclaw.mjs:351-355`) | `messenger-bridge/dist/cli.js`(`bin/codexclaw.mjs:103-112`) |
| `gui` | 의존성 확인 뒤 `npm run dev`(`bin/codexclaw.mjs:356-367`) | 진입점 인라인 Vite 실행 |
| `chat search`, `memory search` | 인수 전체를 `runRecall`에 전달(`bin/codexclaw.mjs:370-374`) | `recall/dist/cli.js`(`bin/codexclaw.mjs:81-90`) |
| `skill search\|show` | 하위 인수만 `runSkillSearch`에 전달(`bin/codexclaw.mjs:375-378`) | `skill-search/dist/cli.js`(`bin/codexclaw.mjs:114-123`) |
| `subagents` | 인수 전체를 `runSubagents`에 전달(`bin/codexclaw.mjs:379-381`) | `subagent-config/dist/cli.js`(`bin/codexclaw.mjs:70-79`) |
| `map [dir]` | `runRepoMap` 호출(`bin/codexclaw.mjs:382-385`) | vendored `repomap.py` 경로 조립(`bin/codexclaw.mjs:260-264`) |
| `provider` | 인수 없이 `runProvider` 호출(`bin/codexclaw.mjs:387-388`) | `provider-bridge/dist/cli.js`의 `detect`(`bin/codexclaw.mjs:92-101`, `bin/codexclaw.mjs:167-170`) |

`orchestrate`의 실질 게이트는 wrapper 밖에 있다. 변경 명령은 명시적 `--session`이 없으면
거부되고(`plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:221-242`),
`A>B`는 `auditOutput`과 `auditVerdict`를 검사한다
(`plugins/codexclaw/components/pabcd-state/src/attest.ts:132-150`). `C>D`는
`checkOutput` 부재와 숫자형 non-zero `exitCode`를 거부한다
(`plugins/codexclaw/components/pabcd-state/src/attest.ts:152-165`).

## 3. 활성 hook 레지스트리

manifest의 hooks 배열은 13개다(`plugins/codexclaw/.codex-plugin/plugin.json:22-35`).
직속 JSON 13개는 전부 등록되어 있고 `_deprecated/` 7개는 전부 미등록이다.

| 상태 | 이벤트 | hook JSON | manifest |
|---|---|---|---|
| 활성 | `SessionStart` | `hooks/session-start-ensuring-provider-bridge.json` | `plugins/codexclaw/.codex-plugin/plugin.json:23` |
| 활성 | `SessionStart` | `hooks/session-start-announcing-map-affordance.json` | `plugins/codexclaw/.codex-plugin/plugin.json:24` |
| 활성 | `UserPromptSubmit` | `hooks/user-prompt-submit-checking-pabcd-trigger.json` | `plugins/codexclaw/.codex-plugin/plugin.json:25` |
| 활성 | `Stop` | `hooks/stop-checking-pabcd-continuation.json` | `plugins/codexclaw/.codex-plugin/plugin.json:26` |
| 활성 | `PreToolUse` | `hooks/pre-tool-use-guarding-goal-budget.json` | `plugins/codexclaw/.codex-plugin/plugin.json:27` |
| 활성 | `PreToolUse` | `hooks/pre-tool-use-guarding-interview-in-goal.json` | `plugins/codexclaw/.codex-plugin/plugin.json:28` |
| 활성 | `PreToolUse` | `hooks/pre-tool-use-guarding-goal-complete.json` | `plugins/codexclaw/.codex-plugin/plugin.json:29` |
| 활성 | `PostToolUse` | `hooks/post-tool-use-capturing-interview-answers.json` | `plugins/codexclaw/.codex-plugin/plugin.json:30` |
| 활성 | `SubagentStop` | `hooks/subagent-stop-verifying-evidence.json` | `plugins/codexclaw/.codex-plugin/plugin.json:31` |
| 활성 | `PreToolUse` | `hooks/pre-tool-use-attaching-skills.json` | `plugins/codexclaw/.codex-plugin/plugin.json:32` |
| 활성 | `PostCompact` | `hooks/post-compact-resetting-reinject-cursor.json` | `plugins/codexclaw/.codex-plugin/plugin.json:33` |
| 활성 | `PreToolUse` | `hooks/pre-tool-use-linting-apply-patch.json` | `plugins/codexclaw/.codex-plugin/plugin.json:34` |
| 활성 | `PostToolUse` | `hooks/post-tool-use-tracking-render-observations.json` | `plugins/codexclaw/.codex-plugin/plugin.json:35` |
| 비활성 | `PostCompact` | `hooks/_deprecated/post-compact-suggesting-recall.json` | 미등록 |
| 비활성 | `PostToolUse` | `hooks/_deprecated/post-tool-use-capturing-shell-friction.json` | 미등록 |
| 비활성 | `PostToolUse` | `hooks/_deprecated/post-tool-use-detecting-edit-shapes.json` | 미등록 |
| 비활성 | `PreToolUse` | `hooks/_deprecated/pre-tool-use-advising-on-friction.json` | 미등록 |
| 비활성 | `SessionStart` | `hooks/_deprecated/session-start-advertising-recall.json` | 미등록 |
| 비활성 | `SessionStart` | `hooks/_deprecated/session-start-injecting-project-rules.json` | 미등록 |
| 비활성 | `UserPromptSubmit` | `hooks/_deprecated/user-prompt-submit-suggesting-recall.json` | 미등록 |

실측 합계: 활성 13, 비활성 7, 전체 20.

## 4. hook 이벤트 맵

스펙이 지정한 다섯 런타임 이벤트만 이 표에 넣었다. `SubagentStop`과 `PostCompact`는
레지스트리에는 포함되지만 본 이벤트 맵의 다섯 항목 밖이다.

| 이벤트 | 설정·핸들러 | 책임 |
|---|---|---|
| `UserPromptSubmit` | hook command(`plugins/codexclaw/hooks/user-prompt-submit-checking-pabcd-trigger.json:3-8`) -> CLI dispatch(`plugins/codexclaw/components/pabcd-state/src/cli.ts:134-136`) -> `handleUserPromptSubmit`(`plugins/codexclaw/components/pabcd-state/src/hook.ts:334-371`) | line-anchored orchestrate 전이, 자연어 trigger, turn 중복 억제, phase directive 주입 |
| `PreToolUse` | goal dispatcher(`plugins/codexclaw/components/pabcd-state/src/cli.ts:122-128`, `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:217-224`), spawn dispatcher(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:323-328`), edit lint(`plugins/codexclaw/components/pabcd-state/src/comment-lint.ts:90-108`) | goal budget·Interview·완료 gate, spawn leaf topology·모델 라우팅, patch 정적 lint |
| `PostToolUse` | interview matcher(`plugins/codexclaw/hooks/post-tool-use-capturing-interview-answers.json:3-13`) -> `handlePostToolUse`(`plugins/codexclaw/components/pabcd-state/src/hook.ts:865-890`); render matcher(`plugins/codexclaw/hooks/post-tool-use-tracking-render-observations.json:3-13`) | Q/A ledger와 I-phase rescan, render 관찰·산출물 수정 기록 |
| `Stop` | hook command(`plugins/codexclaw/hooks/stop-checking-pabcd-continuation.json:3-8`) -> CLI dispatch(`plugins/codexclaw/components/pabcd-state/src/cli.ts:137-139`) -> `handleStop`(`plugins/codexclaw/components/pabcd-state/src/hook.ts:756-814`) | 활성 goal 지속, IDLE 재무장, context-pressure 해제, plateau divergence, 일반 phase block |
| `SessionStart` | provider command(`plugins/codexclaw/hooks/session-start-ensuring-provider-bridge.json:3-8`)과 map command(`plugins/codexclaw/hooks/session-start-announcing-map-affordance.json:3-8`) | provider 상태 주입(`plugins/codexclaw/components/provider-bridge/src/cli.ts:44-54`), session binding·repo map·skill search affordance 주입(`plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:155-187`) |

## 5. Stop-continuation 구현

상태는 `phase`, `orchestrationActive`, `stopBlockPhase`, `stopBlockCount`를 함께 보관한다
(`plugins/codexclaw/components/pabcd-state/src/state.ts:18-33`). `handleStop`은 I-phase를 먼저
해제하고, host goal 활성 여부와 in-flight 상태를 판정한다
(`plugins/codexclaw/components/pabcd-state/src/hook.ts:756-777`).

- **GOAL-IDLE-CONTINUE-01.** 활성 goal인데 cycle이 없으면 다음 P 진입 또는 정직한 goal 종료를
  요구한다. bound goalplan의 남은 작업과 증거 경로도 붙인다
  (`plugins/codexclaw/components/pabcd-state/src/hook.ts:653-686`).
- **종료 상한.** `MAX_STOP_BLOCKS = 3`이며 같은 phase의 네 번째 Stop에서 counter를 지우고
  해제한다(`plugins/codexclaw/components/pabcd-state/src/hook.ts:540-563`). 실제 chat/CLI
  전이는 counter를 0으로 되돌린다(`plugins/codexclaw/components/pabcd-state/src/hook.ts:485-496`,
  `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:309-310`).
- **context-pressure.** transcript 마지막 65,536바이트에서 세 marker 중 하나를 찾으면
  block을 생략한다(`plugins/codexclaw/components/pabcd-state/src/transcript.ts:17-24`,
  `plugins/codexclaw/components/pabcd-state/src/hook.ts:792-797`).
- **plateau.** objective kind가 `maximize`일 때만 최근 metric을 검사한다
  (`plugins/codexclaw/components/pabcd-state/src/hook.ts:722-730`). 같은 metric의 최근 두 값이
  개선되지 않으면 divergence block을 만들며 일반 block과 같은 3회 상한 뒤에 실행된다
  (`plugins/codexclaw/components/pabcd-state/src/metrics.ts:198-214`,
  `plugins/codexclaw/components/pabcd-state/src/hook.ts:795-797`).

## 6. guard/gate 구현

### LEAF-TOPOLOGY-01

활성 matcher는 `^spawn_agent$`다
(`plugins/codexclaw/hooks/pre-tool-use-attaching-skills.json:3-13`). V2는 `task_name` 또는
`fork_turns` 존재로 판별한다
(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:296-299`). child spawner는
`CXC-SUBSPAWN-ALLOWED`가 없으면 deny되고
(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:334-343`), 일반 V2 spawn에는
leaf 제약 블록이 prepend된다
(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:354-373`).

### GOAL-COMPLETE-GATE-01

활성 matcher는 `^update_goal$`다
(`plugins/codexclaw/hooks/pre-tool-use-guarding-goal-complete.json:3-13`). guard는
`update_goal {status:"complete"}`만 잡고, PABCD cycle 진행 중이면 거부한다
(`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:178-188`). session에 slug가 있으면
goalplan을 읽어 E8 결과를 검사한다
(`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:190-200`). `blocked`와 비-complete
업데이트는 통과하며 IO·parse 오류도 fail-open이다
(`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:172-174`,
`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:202-204`).

## 7. 발견 사항

### High

**H-1. 손상·누락 bound goalplan이 완료 gate를 우회한다.**
`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:190-193`의 `"if (plan)"`은 plan이
있을 때만 E8을 실행한다. `readGoalplan`은 부재·읽기 실패·파싱 실패를 모두 `null`로 접는다
(`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:161-168`, `"returns null on absent/unreadable/malformed"`).
slug가 남아 있어도 파일 손상이나 삭제가 완료 허용으로 바뀐다.

**H-2. recursion token이 child에 노출되고 전체 leaf guard를 제거한다.**
leaf 문구가 child에게 token 이름을 직접 보여 준다
(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:209-210`,
`"CXC-SUBSPAWN-ALLOWED lifts constraint (1)"`). deny 조건은 단순 substring 검사다
(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:340-343`,
`"!outgoing.includes(SUBSPAWN_TOKEN)"`). token이 있으면 constraint (1)만이 아니라 guard 전체가
빈 문자열이 된다(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:360-365`).
child가 자기 메시지에 token을 넣으면 재spawn 제한과 FSM·goal 금지, 쓰기 범위 제약이 함께 사라진다.

### Med

**M-1. GUI spawn 오류가 성공 종료로 바뀔 수 있다.**
`plugins/codexclaw/gui`에서 실행한 `npm`의 `status`가 숫자가 아니면 0을 반환한다
(`bin/codexclaw.mjs:366-367`, `"typeof res.status === \"number\" ? res.status : 0"`).
`spawnSync` 자체 오류가 호출자에게 성공으로 보일 수 있다.

**M-2. 실패한 repo-map venv가 다음 실행에서 재사용될 수 있다.**
초기 유효성은 파일 존재만 본다(`bin/codexclaw.mjs:265-266`, `"existsSync(venvPython)"`). pip
실패는 메모리의 `hasVenv`만 false로 바꾼다(`bin/codexclaw.mjs:272-276`). 남은 interpreter는
다음 프로세스에서 기존 venv 경로로 선택된다(`bin/codexclaw.mjs:248-250`). 깨진 환경이
지속적으로 fallback보다 앞선다.

**M-3. `map --help`의 interpreter 우선순위가 주석 계약과 다르다.**
주석은 help를 bare `python3` 경로로 명시한다(`bin/codexclaw.mjs:225-227`). 실제 최종 반환은
`env.CODEXCLAW_PYTHON || "python3"`다(`bin/codexclaw.mjs:251`). help가 dep-free 고정 경로가
아니며 잘못된 override 때문에 실패할 수 있다.

**M-4. `uv` 탐지가 종료 코드를 무시한다.**
`bin/codexclaw.mjs:280`은 `"!spawnSync(...).error"`만 검사한다. 실행 파일이 존재하지만
`uv --version`이 non-zero인 경우도 사용 가능으로 분류해 다음 실행 실패를 늦춘다.

**M-5. reasoning effort 설정이 runtime payload에 반영되지 않는다.**
설정 해석은 `effort: cfg.effort`를 보존한다
(`plugins/codexclaw/components/subagent-config/src/store.ts:171-180`). V2 payload는
`agent_type`, `message`, `task_name`, `fork_turns`만 만든다
(`plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts:371-383`), hook도 V2에서
`"never gets model routing or effort inference"`라고 명시한다
(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:354-355`). 저장 가능한
설정이 실행 시 무효라 운영자가 라우팅을 잘못 판단할 수 있다.

**M-6. loose 자연어 trigger가 directive와 FSM phase를 분리한다.**
trigger 경로는 `orchestrationActive`와 `lastInjectedPhase`만 저장하고 `phase`를 바꾸지 않는다
(`plugins/codexclaw/components/pabcd-state/src/hook.ts:360-369`). 기본 phase는 `IDLE`이다
(`plugins/codexclaw/components/pabcd-state/src/state.ts:62-72`). Stop은 실제 phase와
`orchestrationActive`로 in-flight를 판정한다
(`plugins/codexclaw/components/pabcd-state/src/hook.ts:766-777`). 화면에는 P/A/B/C directive가
나왔는데 Stop은 IDLE 재무장 경로를 탈 수 있다.

**M-7. render ledger 판정이 session별로 격리되지 않는다.**
row에는 `sessionId`가 있다
(`plugins/codexclaw/components/pabcd-state/src/render-observations.ts:54-60`). 조회 함수는 session
인수 없이 kind만 검사하고(`plugins/codexclaw/components/pabcd-state/src/render-observations.ts:124-131`),
cycle 시작 reset은 공용 파일 전체를 비운다
(`plugins/codexclaw/components/pabcd-state/src/render-observations.ts:109-119`). 병렬 session이 서로의
관찰을 충족시키거나 지울 수 있다.

**M-8. plateau 판정이 work-phase 경계를 무시한다.**
metric row는 `workPhaseId`를 저장한다
(`plugins/codexclaw/components/pabcd-state/src/metrics.ts:8-16`). 판정은 session의 전체 기록에서
`metricName`만 같은 row를 모은다
(`plugins/codexclaw/components/pabcd-state/src/metrics.ts:198-209`,
`"records.filter((r) => r.metricName === latest.metricName)"`). 이전 work phase 값이 새 phase의
plateau를 조기에 만들 수 있다.

**M-9. context-pressure marker가 tail에서 오래 살아남으면 continuation이 계속 풀린다.**
최근 65,536바이트 전체를 읽고(`plugins/codexclaw/components/pabcd-state/src/transcript.ts:17-24`,
`plugins/codexclaw/components/pabcd-state/src/transcript.ts:37-44`) substring 하나만 있어도 true다
(`plugins/codexclaw/components/pabcd-state/src/transcript.ts:64-68`). Stop은 이 값이 true면 즉시
빈 응답을 반환한다(`plugins/codexclaw/components/pabcd-state/src/hook.ts:792-797`). recovery가
끝난 뒤에도 marker가 tail에서 밀려날 때까지 goal continuation이 해제될 수 있다.

**M-10. FSM state와 ledger 기록이 비원자적이다.**
chat 전이는 state를 먼저 저장한 뒤 ledger를 append한다
(`plugins/codexclaw/components/pabcd-state/src/hook.ts:485-498`). 일반 hook dispatcher는 예외를
삼키고 빈 출력을 낸다(`plugins/codexclaw/components/pabcd-state/src/cli.ts:131-136`,
`plugins/codexclaw/components/pabcd-state/src/cli.ts:184-185`). ledger append만 실패하면 phase는
전진하고 감사 기록은 빠진다.

### Low

**L-1. repo-map ENOENT 진단이 실제 실패 명령을 숨긴다.**
선택 명령은 `sel.cmd`인데 모든 ENOENT 메시지는 `"python3 not found"`다
(`bin/codexclaw.mjs:281-285`). `uv`, venv, 사용자 override 실패도 Python 설치 문제로 오진된다.

**L-2. 공백뿐인 `CODEXCLAW_PYTHON`이 실행 파일명으로 채택된다.**
override는 trim 없이 truthiness만 검사한다(`bin/codexclaw.mjs:238-240`). 같은 값은 venv
bootstrap도 막는다(`bin/codexclaw.mjs:268-270`). 공백 환경 변수가 정상 fallback과 복구 경로를
동시에 차단한다.

**L-3. 명령 목록이 세 군데에서 수동 중복된다.**
파일 헤더 목록(`bin/codexclaw.mjs:5-25`), `TOP_LEVEL_HELP`(`bin/codexclaw.mjs:173-212`),
`switch (cmd)` registry(`bin/codexclaw.mjs:304-390`)가 별도 관리된다. 신규 명령이나 alias가
일부 표면에만 반영될 가능성이 있다.

## 8. 테스트 존재 표

| 컴포넌트 | `test/` | 파일 수 |
|---|---:|---:|
| `config-guard` | 있음 | 3 |
| `cxc-ops` | 있음 | 4 |
| `messenger-bridge` | 있음 | 32 |
| `pabcd-state` | 있음 | 27 |
| `provider-bridge` | 있음 | 1 |
| `recall` | 있음 | 8 |
| `skill-search` | 있음 | 4 |
| `subagent-config` | 있음 | 6 |

8개 컴포넌트 전부 `test/`가 있다. 이 표는 존재 여부와 파일 수만 말한다. 테스트 케이스의
적정성, assertion 품질, 누락 경로, flaky 여부는 감사하지 않았다. 본 루프가 CLI/hook/FSM
제어면에 집중하고 컴포넌트 테스트 스위트 내용은 OUT으로 둔 계약
(`devlog/_plan/260710_repo_review/000_plan.md:100-103`) 때문이다.

## 9. 리뷰어 verdict

Dalton(`gpt-5.6-sol`)이 같은 계획을 8라운드 연속 감사했다. 라운드 1~7은 FAIL, 라운드 8은
PASS다.

| 라운드 | 판정 | 핵심 블로커 | 증거 |
|---:|---|---|---|
| 1 | FAIL | GUI/테스트 범위, decade 문서, `_fin/` 종료, 040 배정, 측정 불가 기준 | `devlog/_plan/260710_repo_review/000_plan.md:105-119`; `.codexclaw/evidence/repo-review-a-gate-round1*` receipt는 현재 없음 |
| 2 | FAIL | DIFFLEVEL/LEXICO, UNIT-RESIDENCE, 활성 hook registry, cycle 2 spot check | `.codexclaw/evidence/repo-review-a-gate-round2-20260710T044603+0900.md` |
| 3 | FAIL | phase 설계 혼합, 실행 불가 스펙·오경로, stale goalplan | `.codexclaw/evidence/repo-review-a-gate-round3-20260710T045103+0900.md` |
| 4 | FAIL | 004 부재, 문서 수 모순, stale goalplan, 비강제 C 명령 | `.codexclaw/evidence/repo-review-a-gate-round4-20260710T050031+0900.md` |
| 5 | FAIL | C-before-D E8 의존순서 모순, stale 참조 | `.codexclaw/evidence/repo-review-a-gate-round5-20260710T050607+0900.md` |
| 6 | FAIL | post-D c5 기록 누락, wp4 task 시점 모순 | `.codexclaw/evidence/repo-review-a-gate-round6-20260710T050955+0900.md` |
| 7 | FAIL | c5 자기 참조, wp4-t4 원장 왜곡 | `.codexclaw/evidence/repo-review-a-gate-round7-20260710T051346+0900.md` |
| 8 | PASS | 라운드 7 블로커 해소, blocking finding 없음 | `.codexclaw/evidence/repo-review-a-gate-round8-20260710T051642+0900.md` |

라운드 1의 합성 기록은 계획에 남아 있다(`devlog/_plan/260710_repo_review/000_plan.md:105-119`).
라운드 2~7의 FAIL 합성과 수용 내역도 같은 계획에 이어진다
(`devlog/_plan/260710_repo_review/000_plan.md:121-190`). 라운드 8 evidence의 최종 줄은
`VERDICT: PASS`다. 최종 판정은 **PASS**다.
