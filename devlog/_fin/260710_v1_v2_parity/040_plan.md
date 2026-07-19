# 040 — V1/V2 동일동작 패치 계획 (P, diff-level)

- Date: 2026-07-10 / Session: 019f4a07-70d9-7fc3-bdcb-9276fa5f2522
- Class: C3 (컴포넌트 2개 + doctrine 다발, 훅 계약 변경 포함)

## Loop-spec

- Archetype: spec-satisfaction repair (verifier가 done을 정의).
- Trigger: 사용자 요청 "v1과 v2가 동일동작이 기대되도록 패치".
- Goal: 호스트 세션이 V1이든 V2든 codexclaw의 effective behavior가 동일 —
  자식에게 도달하는 스킬 본문, 모델/effort 라우팅, leaf guard, directive 안내.
- Non-goals: codex-rs 수정, opencodex 수정(별도 트랙 완료), ocx liveness 감지(OA-1),
  V2 wait/close 의미론의 코드 심(OA-4), goal DB/FSM 로직 변경.
- Verifier: 컴포넌트별 `npm test`(bun/node:test), tsc 클린, 라이브 프로브
  (sol 자식→손자 spawn으로 네이티브 V2 훅 발화+스킬 도달 실측).
- Stop: cr1-cr6 충족. Terminal: DONE | NEEDS_HUMAN(프로브에서 업스트림 거동이
  판독과 다를 때) | BLOCKED(백엔드 예약 스키마류 외부 요인).
- Escalation: 훅 출력 계약(updatedInput 전체 교체) 위반 발견 시 즉시 중단·재계획.
- 자원 한도: 이 세션 내 sol/medium 서브에이전트 무제한(사용자 승인), wall-clock
  상식선, write scope는 아래 IN 목록.

## Scope boundary

IN: plugins/codexclaw/components/subagent-config/{src,test,dist},
  plugins/codexclaw/components/pabcd-state/{src,test,dist} (directive 문자열만),
  plugins/codexclaw/components/config-guard/{src,test,dist} (untracked
  multi-agent-v2.ts 정직화 + dist 동기화, A-r2),
  plugins/codexclaw/gui/{src/api.ts,src/server,src/pages/Dashboard.tsx,test}
  (정직 필드 계약 + 토글 카피 + handler 테스트, A-r2),
  plugins/codexclaw/hooks/*.json (매처),
  plugins/codexclaw/skills/{dev,pabcd,search,lunasearch,loop}/SKILL.md,
  plugins/codexclaw/agents/README.md, structure/{10,20,40,60,INDEX}.md,
  docs-site guides (native-tools, subagents, skills), 이 devlog 유닛.
OUT: codex-rs, opencodex, ~/.codex/config.toml, goal-gate/goalplan 로직,
  interview 캡처 경로(별도 버그 — hook-continuation 테스트 1건 선행 실패 포함).

## Accept criteria

- cr1 매처: `collaborationspawn_agent`(및 `collaboration.spawn_agent` 변형)로
  도착한 PreToolUse가 스킬 훅에 매칭·처리된다 — 유닛 + e2e 테스트.
- cr2 V2 스킬 도달: V2-shape 스폰의 message에 있는 cxc 멘션이 SKILL.md 본문
  블록으로 인라인된다(dedupe, 존재 검사, 크기 가드) — 유닛 테스트 + 라이브 프로브.
- cr3 모델/effort parity: caller가 생략했고 fork가 full-history가 아닐 때
  subagents.json의 역할 model+effort가 V1·V2 모두 주입되고, full-fork면 양쪽 다
  건드리지 않는다 — 동일 의도 V1/V2 비교 테스트.
- cr4 leaf guard parity: D1 재귀 거부 + D2 블록이 V1 스폰에도 적용되고, D2
  문구의 developer-message 오버라이드 과장이 제거된다.
- cr5 doctrine 정합: V2-first 잔재(dev2 서사, followup_task-only, items 사문,
  effort-주입 스테일 주장, hide_spawn_agent_metadata 권고)가 표면 중립/이중 문법
  서술로 교체되고 rg 잔재 스캔이 0이다.
- cr6 스위트: subagent-config·pabcd-state·config-guard 전체 테스트 + tsc 클린,
  dist 리빌드 커밋.

## Work-phase map (B 슬라이스, 병렬 가능)

### S1 — spawn-attach-hook 코어 (subagent-config) [worker 1]

1. `hooks/pre-tool-use-attaching-skills.json` matcher:
   `"^(collaboration[._]?)?spawn_agent$"`.
2. `spawn-attach-hook.ts`:
   - tool_name 수용: `spawn_agent` | `collaborationspawn_agent` |
     `collaboration.spawn_agent` (정규화 helper `isSpawnToolName`).
   - 표면 판별 재정의: tool_name이 collaboration계면 → V2 확정; 아니면 기존
     payload 마커(isV2SpawnInput). 모순 조합은 보수적으로 기존 마커 우선.
   - V2 경로: normalizeSkillMentions 후 **inlineSkillBodies(message, skillsDir)**
     신설 — 인식된 cxc 멘션(표준 3형)마다 `<skill name="cxc-<f>">…본문…</skill>`
     블록을 message 말미에 1회 부착(마커 dedupe), 총합 사후 크기 가드
     (MAX_NORMALIZE_LENGTH 재사용), 멘션 라인은 유지(가독/추적용).
     **크기 초과 규칙(원자적, A-r1 B1)**: 정규화 message + 전체 인라인 후보 합이
     한도를 넘으면 본문을 하나도 부착하지 않고 정규화 message만 반환 —
     부분 부착/절단 없음, 결정적 출력.
   - V2 모델 라우팅: V1과 동일 규칙 — caller 생략 + !isFullHistoryFork일 때
     subagents.json 역할 모델 주입. effort도 동일 규칙으로 주입(OA-5).
     V1 경로에도 effort 주입 추가(현행 model만 → model+effort).
     **model/effort 독립 판정(A-r1 F3)**: 각 필드의 caller 생략 여부를 따로
     판정해 주입(공통 게이트는 !isFullHistoryFork) — caller model+effort 생략,
     caller effort+model 생략, caller effort 우선, default-모드 effort 4케이스
     테스트.
   - leaf guard: D1/D2를 V1 분기로 확장(isSubagentSpawner는 표면 중립 — r3 확인).
     D2/D2-coordinator 문구에서 "override any Proactive developer message" 삭제,
     "hard constraints from your dispatcher" 유지.
   - 주석 갱신(v1-only 모델 라우팅/no-effort 서술 제거).
3. 테스트: 매처 e2e(collaboration 이름), 인라인(성공/dedupe/미존재 폴더/크기 초과),
   V2 모델+effort 주입(fork_turns none/"3"/생략/"all"), V1 effort 주입,
   V1 leaf guard, **동일 의도 V1/V2 effective-payload 비교**(cr3), 기존 스위트 갱신
   (V1=no-guard를 핀하는 기존 단언 반전).

### S2 — spawn-wrapper 빌더 정합 [worker 1과 같은 컴포넌트, 순차]

- `buildSpawnPayload`/`routeDispatch`: 현행 V2-shape 유지하되 문서·주석을
  "훅이 표면 무관 parity를 보장"으로 갱신; `buildSpawnItems` JSDoc에 dormant
  (v1 items 채널은 훅 밖 수동 경로) 명시. agents/README effort 스테일 주장 수정.

### S3 — pabcd-state directive 표면 중립화 [worker 2]

- hook.ts A/B/C directive: "v2 collab tools DIRECT since the dev2 switch" 서사
  제거 → "reuse the SAME reviewer across rounds (v2: followup_task to its
  task_name; v1: send_input to its agent_id)" 식 이중 병기. attest.ts:143 동일
  (A-r1 F6 인용 정정).
- MIND_DISPATCH/RESCAN 문구 점검(표면 언급 있으면 동일 처리). dist 리빌드.
- 테스트: 문구 고정 테스트 없음(r3 확인) — 의미 앵커(멘션 해석 가능성) 유지 확인.

### S4 — config-guard/GUI 정직화 [worker 3]

- untracked `multi-agent-v2.ts` 커밋 + 응답에 정직 라벨 필드 추가
  (`appliesTo: "flag-fallback models only"`, `catalogPinned: ["gpt-5.6-sol",…]`,
  `effectiveFrom: "new sessions"`), Dashboard 토글 카피 동일 갱신.
- activate.ts의 multi_agent_v2 분기는 **사문**(DECLARED_FEATURES 루프 내부라
  도달 불가; 실제 토글은 multi-agent-v2.ts의 preserveMultiAgentV2Table 직접 호출,
  A-r1 B2) → 사문 분기 제거, preserveMultiAgentV2Table 호출부에 소유권 주석.
- GUI 검증(A-r1 F4): gui handler 테스트(getMultiAgentSurface 정직 필드) +
  `npm run build`(gui) + config-guard dist 동기화.

### S5 — doctrine/docs 스윕 [worker 4]

- Volta #13-16 목록 전체: skills(dev/pabcd/search/lunasearch/loop) +
  structure/10·20·40·60 + docs-site(native-tools "not instructed until ships"
  삭제, subagents 현행화, skills 유지) + hide_spawn_agent_metadata 권고 금지 패턴
  교체("스키마 미노출이어도 인자는 수용됨" 안내로) + effort-주입 스테일 주장 수정
  (S1이 주입을 복원하므로 "설정 시 주입, 미설정 시 상속"으로).
- SEARCH-ATTACH-01: V2 멘션 미주입 사실 반영 — "훅이 V2에서 본문 인라인으로
  변환"을 정식 채널로 기술.

### S6 — 검증/프로브 [메인]

- 전 컴포넌트 테스트 + tsc + dist 리빌드 + rg 잔재 스캔.
- 라이브 프로브: sol/medium 자식(V2 표면)에 SUBSPAWN 토큰 부여 → 손자 spawn
  메시지에 $cxc-search 멘션 → 손자가 스킬 본문 수신했는지 자기 보고. 훅 발화
  여부는 메시지 내 LEAF/인라인 마커로 판정. **관찰 강화 + 블라인드(A-r1 F5,
  A-r2)**: 손자에게 기대 답을 알려주지 않는다 — "수신한 <skill> 블록의 첫 번째
  H2 헤딩과 마지막 H2 헤딩을 그대로 인용하라" 같은 비공개 구조 사실 추출을
  지시하고, 답을 사후에 SKILL.md 파일과 대조해 판정. 프로브 지시문에 기대
  문자열을 절대 포함하지 않는다.

## 리스크 레지스터

- R1 네이티브 V2 훅 이름이 판독과 다를 가능성(예: 구두점 포함) — 프로브가 판정,
  매처는 두 변형 모두 수용해 완충.
- R2 인라인 본문이 encrypted_content 경유 시 예상과 다르게 렌더 — 프로브 판정.
- R3 V1 leaf guard가 기존 사용 패턴(메인 세션 디스패치)에 오탐 — isSubagentSpawner
  는 자식 세션에서만 참, 메인 세션 무영향(r3 확인). 기존 e2e 반전으로 커버.
- R4 dist/src 이중 관리 누락 — cr6에 dist 리빌드 명시.
