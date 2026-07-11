# 020 — 리스캔: 스폰 경로는 이미 있다 — "옵션 0" (caveat만 결정) 검토

- Date: 2026-07-11
- 유저 반문: "지금도 서브에이전트 spawn은 있지 않나? 옮겨오기/옵트인 없이
  그 로직의 caveat만 결정하면 되는 것 아닌가?"

## 확인 결과 — 반문이 맞다

- Mind 디스패치는 이미 codex 네이티브 `spawn_agent`를 탄다 (MIND_DISPATCH_DIRECTIVE가
  메인 세션에 지시, minds.ts:61). 모든 스폰은 spawn-attach 훅을 통과.
- 훅은 **이미 모든 스폰에** `.codexclaw/subagents.json`의 model/effort를 주입한다
  — 단 (a) 호출자가 해당 필드를 생략했고 (b) full-history fork가 아닐 때
  (spawn-attach-hook.ts 헤더 주석, `isFullHistoryFork` :371).
- 역할 판별은 `inferRole(agentType, message)` (:351): worker→executor,
  explorer+리뷰 키워드→reviewer, 그 외→**explorer**. Mind 스폰(agent_type
  explorer)은 오늘도 explorer 역할 설정을 그대로 탄다.
- 즉 `cxc subagents set explorer --effort low` 만으로 Mind 스폰의 추론강도를
  지금 당장 고정할 수 있다. 신규 역할·store 스키마·옵트인 없이.

## 옵션 0 — caveat만 결정 (최소 경로: minds.ts directive 문구 + SKILL.md 한 문단)

결정해야 할 caveat 4개:

- **C1 — 노브 공유**: Mind는 explorer 역할 설정을 공유한다. 인터뷰 전용
  강도(탐색용 explorer와 다른 값)는 불가능. 이걸 수용하면 store/GUI 작업 전부
  불필요 — 040 플랜의 존재 이유는 오직 "인터뷰 전용 노브 + 강제 지정"뿐.
- **C2 — full-fork 함정 (유일한 실질 수정)**: V2 스폰의 `fork_turns` 기본값은
  "all"(전체 히스토리 fork) → 업스트림이 오버라이드를 거부하고 훅도 주입을
  건너뜀. 현행 MIND_DISPATCH_DIRECTIVE는 스폰 형태(fork_turns:"none")를 지시하지
  않는다 → directive에 스폰 셰이프 한 줄 추가 필요. agents/README.md의 스폰
  예시가 이미 쓰는 형태와 동일.
- **C3 — 키워드 오분류**: `inferRole`은 메시지 내 "review/verify/검증/검토" 등으로
  reviewer로 승격시킨다 (REVIEW_KEYWORDS :331). Evaluator 렌즈(성공기준 검증)
  디스패치 메시지에 "검증"이 섞이면 reviewer 설정이 적용될 수 있음. 영향은
  "어느 설정이 적용되나"뿐(훅 주석도 low risk 명시) — 수용할지, directive에
  키워드 회피 문구를 넣을지 결정.
- **C4 — "지정해야하도록"의 약화**: 옵션 0에서 강제는 불가능 — explorer 설정이
  비어 있으면 조용히 부모 상속. 강제(effort 미지정 시 불활성/거부)는 설정
  스키마가 있어야 하므로 040 플랜(D2 술어)으로만 가능. "directive가 명시 지정을
  지시" 수준의 소프트 규율로 충분한지가 핵심 결정.

## 갈림길

- **옵션 0 채택 시**: 변경 = minds.ts directive 텍스트(C2 셰이프 + C3 문구) +
  skills/interview/SKILL.md Runtime Status 한 문단 + directive 스냅샷 테스트.
  040 플랜은 보류(에스컬레이션 경로로 보존).
- **040 유지 시**: 인터뷰 전용 노브(C1 거부) 또는 하드 강제(C4 거부)가 요구일 때만.

권고: 옵션 0 먼저. C1/C4를 수용 가능하면 040은 실익 대비 표면적(신규 역할,
store 마이그레이션, GUI, 문서 5곳)이 과하다.
