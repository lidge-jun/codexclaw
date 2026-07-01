# 007 — 구현실전 3-레퍼런스 교차검증 (cli-jaw 원칙 / jawcode API / lazycodex 플러그인)

Status: CANONICAL FINDINGS · jun 2026-06-30 · gpt-5.5 ×3 병렬 (Galileo=cli-jaw, Godel=jawcode, Faraday=omo)

> 세 레퍼런스를 실측 비교한 결과, codexclaw 플랜의 **구조적 갭 13건(high)** 발견. 핵심: "native goal에
> 100% 위임"은 overclaim이다. cli-jaw(원칙)·jawcode(fork 실전)·omo(plugin 실전) 모두 native goal은
> **continuation 구동에만** 쓰고 plan/ledger/evidence는 파일로 따로 든다. codexclaw도 동일해야 한다.

## ★ R-1 (정정): native goal = continuation 구동 전용, 보조 ledger는 codexclaw 소유
- jawcode: `.jwc/goal/{brief.md,goals.json,ledger.jsonl}` + checkpoint/quality-gate hash (goal-engine.ts:134/179/1294).
- omo: native goal은 continuation owner지만 `.omo/ulw-loop/`에 plan-io 원자쓰기 + ledger append (plan-io.ts:55/105).
- **결정**: codexclaw도 native `ThreadGoal`은 자율 continuation 구동에만 위임하고, **plan hash / checkpoints /
  assumptions / phase-evidence는 codexclaw 소유 보조 ledger(`.codexclaw/`)에 둔다.** INDEX의 "goal lifecycle
  100% 위임" 문구는 "continuation 구동만 위임, 감사추적은 codexclaw 소유"로 정정. (L10.3 / INDEX A-block)

## ★ R-2: 증거 게이트(attest)가 prompt prose로 격하됨 — 런타임 enforcement 필요
- cli-jaw: forward P→A→B→C→D는 `--attest` 강제(GATED_TRANSITIONS), agent 무증거 전진은 409 reject; C→D는
  checkOutput+exitCode:0 필수 (state-machine.ts:646, attestation.ts:36/107).
- codexclaw: shipped `fsm.ts`는 flag 게이트만 있고 A/C entry가 무조건 open, `--attest` 객체 없음. 122_L12.2는
  "server-gated --attest 제거"라 명시 → **증거 게이트가 prompt 텍스트로만 남음**(원칙 상실).
- **결정**: codexclaw FSM에 **플러그인-네이티브 구조적 attest enforcement**를 둔다. flag(auditPassed/checkPassed)를
  "증거 객체가 기록돼야만 true"로 강제. prompt prose는 게이트가 아니다. (L1 fsm.ts 보강 — 신규 loop 필요)

## ★ R-3: "supersede ≠ skip phases" — goal 모드가 PABCD를 건너뛰면 안 됨
- cli-jaw: goal "supersedes gates" = 유저 대기 제거지 P/A/B/C/D 생략이 아님; 매 work-phase = 1 full PABCD,
  anti-skip (goal/SKILL.md:46, heartbeat.ts:120/124/132).
- codexclaw 위험: native goal continuation은 그냥 "계속 일해"라 PABCD를 통째로 건너뛸 수 있음. Stop hook은 passive.
- **결정**: native goal continuation이 codexclaw PABCD에 **진입·전진하도록** 묶는다. "no questions"가 "no PABCD"가
  되면 안 됨. continuation 턴에 phase directive 주입 + 증거 없는 전진 차단. (L9/L10/L11 + 신규 continuation loop)

## ★ R-4: IDLE/complete 상태 부재 — 스코프 drift 제어 구멍
- cli-jaw/jawcode: IDLE(닫힌 상태)+complete 존재; D가 사이클을 닫고 D→IDLE→P로 다음 work-phase. header 억제도 이에 의존.
- codexclaw: shipped phase = `I|P|A|B|C|D`만, default `I`, D 다음 nextPhase=null(IDLE 아님). 철학문서의 "D의 IDLE 복귀로
  스코프 drift 제어" 주장과 코드가 모순.
- **결정**: FSM에 **IDLE(또는 complete 닫힘 상태)를 명시적으로** 추가하고, D가 orchestration을 닫아야 다음 work-phase
  P 진입 가능하게 한다. (L1 state.ts/fsm.ts 보강 — 신규 loop)

## ★ R-5: 인터뷰 증거 carry — objective+hash만으론 부족
- cli-jaw: I→P에 `interview`/`seedSpec`/`researchReport` 구조 carry, C가 Seed AC 증거 검사.
- codexclaw: native create_goal은 objective-only, shipped State에 tracker/seed/researchReport 없음.
- **결정**: freeze가 **구조적 evidence bundle**(dimensions/assumptions/contradictions/seed·AC/research report)을
  `.codexclaw/` plan artifact로 굳히고, goal 진입 시 그 ref를 주입. objective+hash만으로 핸드오프하지 않는다. (L8/L10.3)

## ★ R-6: HOTL stop/pause 감사 누락
- cli-jaw: blocked/paused goal은 기록된 progress + 독립 리뷰어 + `goal pause --agent --audit` 필수(typed pauseAudit).
- codexclaw: L11은 Active 감지/인터뷰 deny만, Paused/Blocked는 goal-inactive 취급, 감사 정책 없음.
- **결정**: HOTL 완료/중단 게이트로 **stop/pause 감사**(독립 리뷰 + evidence bundle)를 포팅. native goal status flip만으로
  pause/block/complete하지 않는다. (신규 loop — Cluster 1 또는 goal-port)

## 구현-적합 갭 (omo/jawcode 실전이 증명한 추가 보강)
- **R-7 native goal 활성화 bridge**: freeze 후 native `create_goal`을 실제로 호출시키는 handoff directive가 없음.
  omo는 `get_goal`→objective-only `create_goal` 지시문(codex-goal-instruction.ts:51), jawcode는 pending-request를
  AgentSession이 소비. **결정**: codexclaw도 freeze 후 "get_goal 스냅샷 → objective-only create_goal" 활성화
  directive를 둔다(skill/hook). plugin은 직접 createGoal 못 부르니 **directive 주입 + 생성된 goal row 검증**으로. (L10.3)
- **R-8 per-turn 주입 커버리지**: jawcode는 fork라 매 prompt build에 주입. codexclaw hook은 UserPromptSubmit-only —
  **native goal 자율 continuation 턴에 UserPromptSubmit hook이 실제 발화하는지 미검증**. 안 되면 "per-turn" 주장 격하 또는
  다른 주입면 필요. **결정**: 구현 전 codex-rs로 continuation 턴의 hook 발화 여부 실측(신규 research). 못 하면 PostCompact 등 보강.
- **R-9 fail-closed deny**: cli.ts가 모든 IO 실패를 삼켜 exit-0(fail-safe). goal-active 판정 불가 시 인터뷰 deny가 사라짐.
  **결정**: PreToolUse deny는 **strict 경로** — goal-active 판정 불가(unreadable) 시 deny(fail-closed)로, 글로벌 fail-safe에
  안 삼켜지게 분리. (L11.2)
- **R-10 hook matcher 범위**: omo는 PreToolUse에 `^create_goal$` matcher로 해당 툴만 hook. codexclaw는 매 툴 실행.
  **결정**: plugin.json hook에 narrow matcher 적용(create_goal, request_user_input). (L3/L11)
- **R-11 idempotency**: omo는 transcript marker 스캔 + context-pressure 억제. codexclaw는 `injectedTurns` 로컬 플래그만 —
  compaction 후 취약. **결정**: transcript-marker/락 추가. (L2 hook 보강)
- **R-12 hook 등록면**: omo는 UserPromptSubmit/PreToolUse/PostCompact/Stop/SubagentStop. codexclaw는 PostCompact/
  SubagentStop 없음. **결정**: PostCompact(idempotency 복구)·SubagentStop 필요성 명시 결정 또는 불요 사유 문서화. (L2/L6)
- **R-13 install bootstrap**: omo bootstrap은 config.toml 갱신 + hook trust 재스탬프 + agent 링크(version-aware, degraded-
  not-fatal). codexclaw L6은 `codex features enable`만, hand-written TOML 금지. **결정**: "config untouched" 불변식과
  hook-trust/agent 등록 책임의 경계를 명확히 — codex 플러그인 인스톨러가 그걸 맡는지 실측, 아니면 bootstrap 단계 추가. (L6)

## 신규 loop / 보강 대상 요약
- L1(상태엔진): IDLE/complete 상태 + 구조적 attest enforcement 추가 → **신규 보강 loop 필요**(shipped 코드 수정).
- L8/L10.3: evidence bundle freeze + native create_goal 활성화 bridge.
- L11.2: fail-closed strict deny 분리.
- L2: transcript idempotency + PostCompact 등록 검토.
- L6: bootstrap(hook trust/agent 등록) 경계 명확화.
- 신규: HOTL stop/pause 감사 loop + native-goal↔PABCD continuation 묶기 loop.
- 보조 ledger 결정: native goal은 continuation only; plan/ledger/evidence는 `.codexclaw/` 소유.

## jawcode가 가졌고 codexclaw(plugin)는 없는 능력 (설계 제약으로 못박을 것)
- AgentSession 내부 직접 호출(createGoal/replaceGoal, active tools, hidden message append) — plugin 불가.
- 매 prompt-builder 주입(hook event 독립) — plugin은 hook 이벤트에 의존.
- 런타임 tool wrapping(권한/실행 전 차단) — plugin은 PreToolUse deny envelope로만.
- → 그래서 codexclaw는 "hook+directive+native goal" 조합으로 등가 효과를 내야 하며, fork 수준 보장을 가정하면 안 된다.
