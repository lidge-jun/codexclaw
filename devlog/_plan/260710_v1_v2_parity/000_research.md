# 000 — V1/V2 동일동작(parity) 패치 리서치 캡처

- Date: 2026-07-10
- Session: 019f4a07-70d9-7fc3-bdcb-9276fa5f2522
- Phase: I (interview) — 구현 전 리서치 기록
- Method: 커밋 히스토리 + devlog 정독(메인), sol/medium 탐색자 2기 병렬 조사
  (Volta: codexclaw 내부 갭 스윕 / Boole: codex-rs 업스트림 V1·V2 차이 조사,
  둘 다 $cxc-search 스킬 첨부, SEARCH-ATTACH-01)

## 배경 (히스토리 타임라인)

- `22e1de2c` (260709 16:19) dev2: multi_agent_v2 전면 전환 — config-guard 선언,
  spawn 빌더 v2 페이로드(task_name/fork_turns 필수), doctrine 문서 V2화.
- `eb82daf6` dist 리빌드, `ae701751` leaf-agent 하드닝(LEAF-TOPOLOGY-01,
  재귀 spawn 훅 거부 + leaf guard 블록).
- `6772923a` (260709 19:00) V1 기본값 복귀 — config.toml v2=false, config-guard
  v2 선언 제거, 빌더 task_name/fork_turns optional화, doctrine "v1-default /
  v2-opt-in". 단 **문서·directive·빌더 방출값 상당수는 V2 시대 그대로 잔존**.
- `2c3801a1` (260710) spawn 시 $cxc 멘션 정규화(normalizeSkillMentions) —
  v1/v2 공용 채널(message 멘션)은 이때 정리됨.
- 첨부 대화(opencodex 트랙): Sol/Terra=V2, Luna=V1 (models.json 모델별
  multi_agent_version이 전역 플래그보다 우선, 첫 turn에 세션 고정).
  hide_spawn_agent_metadata=false 노출 + fork_turns="none"/부분 fork일 때만
  모델 오버라이드 적용. opencodex에는 collabSurface() 3상태 감지 + v2 주입 +
  ensureHideSpawnAgentMetadata()가 이미 랜딩됨 (별도 저장소 트랙).
- **260710 12:24 후속(opencodex 트랙 반전)**: ChatGPT 백엔드가 네이티브 모델에서
  `collaboration.spawn_agent`를 예약 함수로 취급 — `hide_spawn_agent_metadata=false`로
  스키마가 서버 선언과 달라지자 "Invalid Value: 'tools' ... reserved for use by this
  model" 거부. **config 노출 접근 전면 철회** (config.toml 테이블 제거,
  ensureHideSpawnAgentMetadata 삭제). 대체 경로: multi_agents_v2/spawn.rs:180의
  인자 파서는 스키마 노출과 무관하게 model/reasoning_effort를 항상 수용 →
  **프롬프트-온리 오버라이드**("스키마에 안 보여도 인자를 넣어라")로 전환.
  또한 네이티브 v2 스폰은 flat이 아니라 **`collaboration.` 네임스페이스**로
  도착함이 실증됨(기존 flat 가정은 v1 오분류를 유발) — opencodex 감지는 동반
  도구 기준(send_input류=v1 / send_message·followup_task류=v2)으로 수정됨.
  ⇒ codexclaw 파급: (a) 훅 매처 `^spawn_agent$`가 네이티브 v2에서
  `collaborationspawn_agent`(hook_names.rs:41 무구두점 연결)를 못 잡을 가능성이
  이론이 아니라 실전 경로 — 로컬 훅 발화 여부 스모크 필수. (b) doctrine의
  "hide_spawn_agent_metadata=false 설정" 안내는 금지 패턴으로 교체.

## 목표 문장 (사용자 요청 원문 요지)

"v1과 v2가 동일동작이 기대되도록" — 호스트 세션이 V1 콜랩 툴셋이든 V2든,
codexclaw가 만들어내는 effective behavior(스킬 주입, 모델 라우팅, leaf 가드,
phase directive, doctrine 안내)가 같아야 한다.

## Volta 스윕 — 갭 인벤토리 (18항, 원문은 세션 로그)

### 코드 드리프트 (핵심)

1. **빌더가 항상 V2 페이로드 방출** — revert 후 task_name/fork_turns가 타입상
   optional이 됐지만 `buildSpawnPayload`/`routeDispatch`는 무조건 둘 다 넣는다.
   V1 빌더 경로 자체가 없음. spawn-wrapper.ts:329,371,467
2. **표면 감지가 페이로드 마커 기반** — `isV2SpawnInput`은 task_name/fork_turns
   존재로 판정. 빌더 출력이 V1 호스트에서도 V2 훅 경로를 탄다. 호스트
   multi_agent_v2 상태와 교차 검증 없음. spawn-attach-hook.ts:367,401
3. **V1 items 빌더(buildSpawnItems) 미배선** — 테스트/문서에만 존재, 실제 진입점
   (`resolveSpawnPayloadWithSkills`/`routeDispatch`)은 message 멘션만 사용.
4. (parity OK) 스킬 결정(ROLE_BASE_SKILLS/SURFACE_SKILL)은 표면 중립.
5. **모델 라우팅 비대칭** — `.codexclaw/subagents.json` 역할 모델이 V1 훅
   경로에서만 주입, V2는 명시적으로 미주입. 같은 설정, 다른 effective 모델.
   spawn-attach-hook.ts:425,449
6. **effort는 양쪽 다 미주입인데 문서는 주입 주장** — agents/README.md:45 등.
7. **leaf guard(D1 거부 + D2 블록)는 V2 전용** — V1 스폰은 훅에서 아무 가드도
   못 받음. (V2 무깊이제한이 근거였지만 "동일동작" 관점에선 비대칭.)
8. (parity OK) 멘션 정규화는 버전 분기 앞에서 공용.
9. **pabcd-state A directive가 V2 서사 잔존** — "DIRECT since the dev2 switch",
   followup_task/task_name만 안내, V1 send_input/resume 경로 부재.
   hook.ts:162, attest.ts:132
10. (parity OK) goal-gate.ts는 버전 무관.
11. **config-guard는 V2 완전 비관리(의도)** — multi_agent만 선언,
    hide_spawn_agent_metadata 처리 없음. activate.ts의 v2 테이블 복구 분기는
    현재 선언 목록상 도달 불가(사문).
12. **untracked `multi-agent-v2.ts` + GUI 토글이 별도로 v2 플래그 관리** —
    소유권 분산 (working tree에 미커밋 상태로 존재).
13. **doctrine이 V2-first** — search/sparksearch/loop/pabcd SKILL.md,
    structure/20이 task_name/followup_task/send_message/no-close를 규범으로
    서술, V1 등가 절차(send_input/resume/close, wave 재시도) 없음.
14. **문서가 죽은 V1 items 경로를 계속 주장** — structure/10:69 등 6곳.
15. **"effort-silent spawn은 high 주입" 스테일 주장** — pabcd:409, structure/20:113, 60:44.
16. **docs-site 혼재** — native-tools.md는 "V2 not instructed until it ships"
    (수동 opt-in/GUI 토글과 모순), subagents.md는 현 비대칭을 사실대로 기록.
17. **테스트가 '동일동작'이 아니라 '비대칭'을 핀** — wrapper 테스트 V2 전용,
    훅 테스트는 V1=모델주입/V2=leaf가드를 그대로 고정.
18. **커버리지 공백** — V1-legal 빌더 통합 테스트, 동일 의도 V1/V2 페이로드
    비교 테스트, V2 모델 parity 테스트, V1 leaf parity 테스트 전무.

부수 관찰: `hook-continuation.test.ts` "inactive goal allows I-trigger" 1건이
현 working tree에서 단독 재현 실패(본 패치와 무관, 선행 조사 필요).

## Boole 업스트림 조사

(도착 시 010_upstream_facts.md로 기록)

## 열린 설계 질문 (인터뷰 대상)

- Q1 "동일동작"의 기준면: (a) 훅/빌더가 호스트 버전을 감지해 각 표면의 문법으로
  같은 의미를 재현 (b) V1 표면을 V2 의미론으로 승격 (c) 최소공통분모로 하향.
- Q2 모델/effort 주입의 목표 상태: V2에도 모델 주입? (fork_turns 제약 감안)
  effort는 계속 미주입으로 통일하고 문서를 고칠 것인가, 주입을 복원할 것인가.
- Q3 leaf guard를 V1에도 확장? (V1은 close/resume가 있어 깊이 폭주 위험이 낮음)
- Q4 호스트 버전 감지 방법: config.toml 읽기 vs 페이로드 마커 유지 vs
  hook stdin의 세션 메타. (모델별 multi_agent_version 오버라이드 때문에
  config만으론 부정확 — Sol/Terra는 플래그 없이도 V2.)
  260710 추가: opencodex는 동반-도구 시그니처 감지로 해결 — codexclaw 훅도
  tool_name/네임스페이스+페이로드 마커 조합으로 판별하는 안이 유력해짐.
- Q5 doctrine 서술 전략: 이중 문법 병기 vs 표면 중립 서술 + 부록 표.
- Q6 untracked multi-agent-v2.ts/GUI 토글의 처리(커밋? 통합? 폐기?).
- Q7 (신규, HIGH) 네이티브 v2에서 codexclaw PreToolUse 훅이 발화하는가 —
  `collaborationspawn_agent` 이름으로 도착하면 `^spawn_agent$` 매처 불발.
  매처 확장(정규식) vs codex-rs 정규화에 의존 vs 실측 후 결정.
- Q8 (신규, HIGH) V2 spawn message는 스킬 멘션이 주입되지 않는다(turn.rs:524,
  InterAgentCommunication 제외)는 Boole 판독이 맞다면, V2에서의 스킬 전달
  대체 채널은? (전문 인라인 삽입 / full-fork 상속 의존 / followup_task 경유 /
  프롬프트-온리 안내) — Turing 렌즈 검증 대기 중.
