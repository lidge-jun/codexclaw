# 03 — 훅 런타임 감사 (S3)

날짜: 2026-09-10 (KST). 읽기 전용. 설치 캐시 `~/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619` (mtime 2026-09-10 06:23). 워크트리 HEAD 369ed0e1. 메인 세션 `01a0880e-149e-72d0-86db-53bd99bcac0e`.

롤아웃 범위: `~/.codex/sessions/2026/09/09`와 `09/10`의 `rollout-*.jsonl` 중 파일명 시각이 2026-09-09 15:00 이상. 파일명은 로컬 KST (근거: 메인 세션 파일명 `T06-23-39` vs session_meta.timestamp `2026-09-09T21:23:39.307Z` = UTC+9). 191개, 합계 635911474바이트.

훅 실행의 실제 기록 형태. 이 창에서 event_msg.payload.type이 hook_* 이거나 item.type이 Hook*인 레코드는 0건. 실행 증거는 다음이다.

- response_item / payload.type=message / role=developer / content_item_kinds=["hooks.additional_context"] — SessionStart, UserPromptSubmit, PreToolUse deny 주입.
- response_item / payload.type=custom_tool_call_output 본문의 `Command blocked by PreToolUse hook: [codexclaw MEMORY-WRITE-GATE]` — 게이트가 exec를 막은 뒤.
- type=compacted — 컴팩션 자체(훅 타입이 아님). 이 창에서 2건.

jsonl에 `source: compact` 필드는 0건. compact 재주입은 본문 `[cxc-recall] Context was just compacted`으로만 확인.

## 1. 등록·신뢰 상태

`~/.codex/config.toml:73` plugin_hooks=true. [hooks.state]는 674행부터. 다섯 훅 모두 `codexclaw@codexclaw:hooks/<file>:<event>:0:0` 키와 trusted_hash가 있다. `.codex-plugin/plugin.json`의 hooks 배열에도 다섯 파일이 들어 있다.

| 훅 파일 | 이벤트 | config.toml | trusted_hash 앞16 | 현재 JSON sha256 앞16 | 일치 |
|---|---|---|---|---|---|
| session-start-injecting-recall-context.json | SessionStart | 697-698 | 797c968d7c27dd2c | b61e95f8cd2df152 | 아니오 |
| post-compact-injecting-recall-context.json | PostCompact | 700-701 | edf979d4135581ac | de3f0e4a3015469c | 아니오 |
| post-compact-resetting-reinject-cursor.json | PostCompact | 739-740 | ccde59b7b74e2ed7 | 7e9d557ff27d29b9 | 아니오 |
| user-prompt-submit-detecting-recall-intent.json | UserPromptSubmit | 703-704 | 9b424d6b9d0b2673 | f75eb9ebc6d164ef | 아니오 |
| pre-tool-use-guarding-memory-write.json | PreToolUse | 676-677 | 4679e43b7647519c | 78d0c42a299922a2 | 아니오 |

JSON 바이트, command 문자열, PLUGIN_ROOT 치환 command, 가리키는 dist/cli.js 어느 것도 trusted_hash와 같지 않다. 해시 입력의 정확한 바이트열은 (unknown). 불일치인데도 훅은 돈다: 메인 세션 L9가 hooks.additional_context로 [cxc-recall]을 넣었고, L97이 MEMORY-WRITE-GATE deny를 넣었다.

매니페스트 요지 (캐시 hooks/*.json, mtime 2026-09-10 06:23):

- SessionStart recall: node PLUGIN_ROOT/components/recall/dist/cli.js hook session-start, timeout 10.
- PostCompact recall: 같은 CLI hook post-compact, timeout 10. 핸들러는 항상 빈 문자열 (캐시 components/recall/src/hook.ts:533-551).
- PostCompact PABCD cursor: components/pabcd-state/dist/cli.js hook post-compact. stdout도 빈 문자열 (pabcd-state/src/hook.ts:1949-1956).
- UserPromptSubmit recall intent: recall CLI hook user-prompt-submit, timeout 5.
- PreToolUse memory-write: pabcd-state CLI hook pre-tool-use-memory-write, matcher `^(memories[._]?add_ad_hoc_note|apply_patch|Write|Edit|Bash)$`. 런타임 SHELL_TOOLS는 Bash|shell|exec_command|local_shell (memory-write-gate.ts:68). 데스크톱 exec/exec_command에도 deny가 실제로 걸렸다.

## 2. SessionStart recall 주입 (15:00 KST 이후)

[cxc-recall] developer 메시지 89건, 모두 hooks.additional_context.

| kind | 건수 | utf-8 바이트 |
|---|---|---|
| availability-notice (Past-session recall is available) | 42 | 항상 342 |
| cwd-context (Recent work — cwd) | 21 | 156-330 (평균 312.8) |
| user-prompt-nudge (The prompt references past work) | 25 | 항상 367 |
| compact-recovery-notice (Context was just compacted) | 1 | 343 |

cwd-context가 있는 세션은 같은 메시지에 availability-notice도 붙는다 (handleSessionStart가 둘을 잇는다, hook.ts:499-530). cwd-context가 없는 세션은 notice만 남는다. 주입 전체가 빈 문자열인 SessionStart는 이 창에서 0건 — cwd 블록이 비어도 notice는 나간다.

source=compact 사례: 1건. rollout-2026-09-09T22-03-04-01a08643-c74a-7f83-8153-5419b90447a4.jsonl L2606 type=compacted 뒤 L2619 developer hooks.additional_context 907자. 본문이 Recent work(opencodex) + Context was just compacted. timestamp 2026-09-09T21:33:02.470Z = 2026-09-10 06:33 KST (재설치 06:23 이후). cwd는 관리형 워크트리 ~/.codex/worktrees/ae6a/opencodex.

같은 창의 다른 compact: 01a08663-0007 L132 type=compacted (cwd ~/Developer/new/700_projects/codexclaw). 이후 SessionStart hooks.additional_context가 다시 안 붙었다. compact마다 source=compact SessionStart가 재점화되는 것은 아니다.

## 3. PostCompact Failed 여부

현재 설치본 PostCompact recall 핸들러는 항상 빈 문자열 (hook.ts:533-551). 주석이 말하는 옛 실패 문자열은 `hook returned invalid PostCompact hook JSON output`. 그 문자열이 들어간 롤아웃 12개 중 cutoff 이후는 대체로 에이전트가 hook.ts를 sed/rg로 읽은 CommandExecution이거나, 이 조사 병렬 세션의 검색 명령이다. content_item_kinds가 Failed이거나 event_msg hook-failed 타입은 이 창에서 못 찾았다.

판정: 머지 전 PostCompact가 Failed로 찍히던 회귀는 L0가 빈 stdout으로 고친 상태다. cutoff 이후 실제 compact 2건 중 1건은 SessionStart compact-recovery가 모델에 들어갔고, PostCompact 자체 additionalContext는 설계상 없다. 런타임 Failed 기록은 이 창에서 확인하지 못함.

## 4. memory-write gate가 막은 명령

deny developer 메시지(hooks.additional_context) 10건 + 대응 custom_tool_call_output. 대상 경로 카운트: ~/.codex/memories/MEMORY.md 6, memories 루트 2, rollout_summaries/*.md 2.

실제 차단 명령 (command_head, 중복·조사 스크립트 자기참조 제외):

1. 01a085d9 — `sed -n '458,490p' ~/.codex/memories/MEMORY.md; rg ... ~/.aside`. 대상 MEMORY.md. 읽기 전용 sed.
2. 01a085e0 — python3 heredoc이 Path('~/.codex/memories/MEMORY.md').read_text() 후 print 포맷에 `->`. 대상 MEMORY.md. `->`의 꺾쇠가 write-verb로 매칭.
3. 01a08655 L19 — sed 스킬 파일 + `rg ... ~/.codex/memories/MEMORY.md`. 대상 MEMORY.md.
4. 01a08655 L47 — `sed -n '1,260p' ~/.codex/memories/rollout_summaries/2026-09-04T11-22-14-jBOL-....md`. 대상 그 요약 파일.
5. 01a08664 — `rg ... ~/.codex/memories/MEMORY.md ... 2>/dev/null`. 대상 MEMORY.md. `2>/dev/null`의 꺾쇠.
6. 01a086e0 — `rg ... '<prose>' ~/.codex/memories/MEMORY.md`. 대상 MEMORY.md. 패턴 `<prose>`의 꺾쇠.
7. 01a087ef — `sed -n` MEMORY.md + cat 요약 파일. 대상 MEMORY.md.
8. 01a08805 (메모리 상태 점검) — sed -n 요약 파일과 MEMORY.md. 대상 요약 파일.
9. 01a0880e L97-98 (메인 세션) — mkdir -p 워크트리 devlog/_plan/.../notes 와 /tmp/mfu-260910 후 cat 리다이렉트 heredoc. 본문에 memories 절대 경로 문자열. 실제 쓰기 대상은 워크트리 devlog. 게이트 대상은 memories 루트.
10. 01a08812-ddd3 — `cd ~/.codex/memories && python3`로 rollout_summaries 목록. 대상 memories 루트. 잘린 command_head에는 sed/꺾쇠가 안 보여, 훅이 받은 tool_input과 head가 같은지는 (unknown).

오탐: 1-9. 전부 메모리 디렉터리를 쓰려는 명령이 아니다. cat/rg만 있고 꺾쇠가 없으면 통과한다 (테스트 memory-write-gate.test.ts:174-182가 그 경우만 고정).

## 5. 오탐 원인 (행 번호)

설치 캐시와 워크트리 src는 diff -q 동일. 인용은 캐시 components/pabcd-state/src/memory-write-gate.ts = 워크트리 plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts.

- 157-161행 주석: 셸 토큰을 고의로 넓게 모아 memories를 언급하는 모든 토큰을 쓴다. 목적지는 리다이렉션이 아니라 토큰 집합이다.
- 163-169행 shellPathTokens: 공백·세미콜론·파이프·괄호·꺾쇠로 쪼갠 뒤 includes("memories")인 토큰을 모은다. heredoc 본문, rg 패턴, 파이썬 Path('.../memories/...')도 토큰이 된다. 괄호 분할 때문에 Path('~/.codex/memories/MEMORY.md')에서 절대 경로가 따로 떨어진다.
- 119-123행 isMemoryPath: 그 토큰을 절대경로로 풀어 memories 루트이거나 그 아래이면 히트. 목적지 파일이 워크트리여도, 본문에 루트 문자열이 있으면 루트가 target이 된다.
- 212행 write-verb 정규식: 리다이렉트 꺾쇠, tee, sed, cp, mv, rm, touch, mkdir, dd, write, install. cat/rg는 빠져 있지만 (a) 단어 경계 sed는 `sed -n` 읽기까지 잡고 (b) 리다이렉트 패턴은 아무 곳의 꺾쇠에 걸린다 (2>/dev/null, `->`, 정규식 `<prose>`).
- 207-219행: write-verb가 한 번이라도 있으면 memories 토큰을 목적지로 본다. 어디에 쓰는가가 아니라, 명령 문자열에 쓰기 표시와 memories 경로가 공존하는가.

테스트 공백 (memory-write-gate.test.ts:174-182): cat/rg 읽기 허용, echo를 memories/notes.md로 리다이렉트하면 차단, 워크트리 out.txt로 리다이렉트하면 허용. sed -n, 2>/dev/null, 본문에만 memories 경로가 있는 heredoc은 없다.

이건 #102가 만든 표면이다. 브리프의 devlog heredoc이 본문 경로 문자열 때문에 차단된 것과 메인 세션 L97-98이 같은 분기.

## 6. 메인 세션 재현 (실행했으나 파일은 안 씀)

라이브 차단 원문 (01a0880e L98 custom_tool_call_output): mkdir -p 워크트리 devlog/_plan/260910_memory-followup-roadmap/notes 와 /tmp/mfu-260910 후 그 notes/00_brief.md로 cat 리다이렉트 heredoc. 본문에 memories 절대 경로.

설치 CLI로 stdin만 넣고 분류 (아무 것도 안 씀). `node <cache>/components/pabcd-state/dist/cli.js hook pre-tool-use-memory-write`:

| 명령 | Bash | exec_command |
|---|---|---|
| sed -n 1p ~/.codex/memories/MEMORY.md | deny / MEMORY.md | deny / MEMORY.md |
| cat ~/.codex/memories/MEMORY.md | allow | — |
| rg foo ~/.codex/memories | allow | — |
| rg foo ~/.codex/memories 2>/dev/null | deny / memories 루트 | — |
| mkdir+cat 리다이렉트 /tmp/mfu-260910/dry/should-not-exist.md, 본문이 memories 루트 | deny / memories 루트 | deny / memories 루트 |
| echo hi 리다이렉트 /tmp/mfu-260910/dry/out.txt | allow | — |
| python Path(MEMORY.md).read_text() (꺾쇠 없음) | allow | — |
| 위와 같되 print('x -> y') | deny / MEMORY.md | — |

/tmp/mfu-260910/dry 는 생기지 않음 (훅만 호출, 셸 미실행).

최소 재현 명령 (실행하면 게이트가 막고 파일은 안 생긴다):

    mkdir -p /tmp/mfu-260910/dry && cat > /tmp/mfu-260910/dry/should-not-exist.md <<'EOF'
    ~/.codex/memories
    EOF

또는 읽기만: `sed -n '1p' ~/.codex/memories/MEMORY.md`.

## 7. 관리형 워크트리 cwd — 이 세션 01a0880e

session_meta: cwd /Users/jun/.codex/worktrees/3412/codexclaw, timestamp 2026-09-09T21:23:39.307Z.

L7-10이 모두 hooks.additional_context다.

- L7 124자 — provider-bridge JSON.
- L8 4818자 — 세션 id 바인딩/맵/스킬 카탈로그.
- L9 328자 / utf-8 342바이트 — `[cxc-recall] Past-session recall is available ... Index: 13194 files / 1226523 messages, last ingest 2026-09-09T21:12:34.666Z.` Recent work 블록 없음. 빈 문자열 아님.
- L10 1320자 — MANAGED WORKTREE identity guard.

listCwdSessions는 `WHERE cwd = ? AND source = 'main'` 정확 일치 (cwd-context.ts:84-92). 슬롯 3412의 이전 main 세션이 인덱스에 없으면 cwd 블록은 빈 문자열이고 notice만 남는다 (hook.ts:503-507).

같은 창에서 관리형 워크트리 SessionStart:

- notice만: 3412/codexclaw (이 세션), a892, c228, 1315, d2c7, 816a, 9263, 0ec2, b5ba, 3813, 172b, 1907, affe, 67e3, bd77, f9c2, a615, bbf2 등. 슬롯이 처음이거나 인덱스에 그 cwd가 없음.
- notice+cwd-context: ae6a/opencodex, e805/codexclaw, c0a4/opencodex. 같은 슬롯에 이전 main 세션이 있는 경우.

관리형 워크트리라고 해서 주입이 항상 빈 문자열은 아니다. 이 세션(3412)은 cwd 블록이 비고 notice 342바이트만 들어갔다.

## 로드맵 입력

(a) 회귀 여부

- MEMORY-WRITE-GATE 오탐 (읽기 sed, 2>/dev/null, 본문에만 있는 memories 경로, 비메모리 목적지 heredoc): #102 L0 회귀. 게이트 자체가 L0 신설이고, 테스트가 cat/rg만 허용해 sed/꺾쇠 부수 매칭을 못 잡는다.
- PostCompact Failed: L0가 고친 옛 회귀. 현재 핸들러는 빈 stdout. cutoff 이후 Failed 훅 이벤트는 확인 못 함.
- 관리형 워크트리 SessionStart cwd 블록 부재: #108 exact-cwd 설계의 결과 (회귀라기보다 슬롯 cwd가 인덱스에 없을 때의 빈 블록). 주입 전체는 빈 문자열이 아니고 342바이트 notice가 남는다. 슬롯을 재쓰면 cwd-context가 붙기도 한다 (ae6a).
- trusted_hash 불일치: 실행은 되므로 기능 회귀는 아님. 재설치 후 해시 미갱신은 운영 이슈.

(b) 수정 후보

P0 — memory-write-gate.ts 셸 분류를 목적지 기준으로. 212행 리다이렉트/sed를 실제 리다이렉션과 sed -i로 좁히고, 163-169행은 본문 문자열이 아니라 실제 쓰기 경로만. 검증: 위 표의 sed -n / 2>/dev/null / 본문-only heredoc을 단위 테스트로 고정한 뒤 `node .../pabcd-state/dist/cli.js hook pre-tool-use-memory-write` stdin deny/allow. 라이브는 `sed -n '1p' ~/.codex/memories/MEMORY.md`가 통과해야 함.

P1 — 관리형 워크트리 recall 주입을 슬롯 cwd가 아니라 저장소 정체성(remote/gitdir/worktree root)으로 묶기. cwd-context.ts:84-92 exact cwd=? 가 원인. 검증: 빈 슬롯에서 SessionStart 픽스처를 넣고 `[cxc-recall] Recent work`가 같은 레포의 이전 main 세션을 포함하는지, 01a0880e 같은 신규 슬롯 롤아웃 L9에 Recent work가 생기는지.

P2 — PostCompact 후 SessionStart source=compact 재점화가 세션마다 다른 이유 (01a08643 vs 01a08663) 확인. 검증: compact 전후 jsonl에서 type=compacted 다음 hooks.additional_context + Context was just compacted 존재.

P2 — 플러그인 재설치 후 trusted_hash를 현재 매니페스트에 맞추거나, 불일치여도 실행되는 조건을 문서화. 검증: 다섯 JSON sha256과 ~/.codex/config.toml [hooks.state] 비교.

P2 — memory-write-gate.test.ts:174에 sed -n, 2>/dev/null, `<prose>`, 본문-only memories 경로 heredoc을 회귀 테스트로 추가.
