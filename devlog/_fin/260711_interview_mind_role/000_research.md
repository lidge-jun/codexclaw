# 000 — cxc-interview Mind 디스패치 전용 서브에이전트 역할(옵트인) 리서치 캡처

- Date: 2026-07-11
- Phase: I/P 준비 — 구현 전 리서치 기록 (메인 세션 단독 탐색)
- 요청 원문 요지: "codexclaw에 옵트인 옵션으로, ../jawcode/devlog/gjc 정도로,
  cxc-interview를 서브에이전트와 함께 확장. 별도 에이전트를 만들고 모델
  추론강도를 지정해야 하도록."

## gjc 레퍼런스 (요청의 "정도로" 해석 근거)

- gjc(gajae-code)는 **per-role 모델 프로파일**을 제공: `codex-{eco,medium,pro}`
  — 전 역할 동일 모델에 **역할별 reasoning effort만 차등** 지정
  (`_gjc_chase/gajae-code/docs/models.md:209`). `pro`는 architect/critic/planner
  역할의 effort를 올리고, effort 접미사는 모델의 supported thinking range로
  클램프됨 (models.md:215).
- 즉 "gjc 정도로" = **역할 단위로 모델·추론강도를 명시적으로 고정하는 수준**의
  서브에이전트 정의. 전체 프로파일-티어 시스템까지는 요구 범위 아님(가정,
  040 OPEN ASSUMPTIONS 참조).

## 현행 인터뷰 런타임 (codexclaw)

- Mind 5종(contrarian/socratic/ontologist/evaluator/simplifier)은 **고정 프롬프트
  문자열**로만 존재 — `components/pabcd-state/src/minds.ts:33` `MIND_ROLE_PROMPTS`,
  동시 캡 3 (`MIND_CONCURRENCY_CAP`, minds.ts:23).
- 디스패치는 directive 텍스트 주입뿐: `MIND_DISPATCH_DIRECTIVE` (minds.ts:61)를
  `interviewDirective()`가 I-phase directive에 접합 (`pabcd-state/src/hook.ts:225,232`).
  호출부 3곳 모두 `payload.cwd` 접근 가능 (hook.ts:380, 440, 554).
- Mind 산출물 검증은 `normalizeMindOutput()` (minds.ts) — JSON 배열 strict 검증,
  round-mind correlation key. 이 계층은 역할화와 무관하게 재사용 가능.
- 골 방화벽: goal-active 시 인터뷰 전체 억제 + `request_user_input` hard-deny
  (skills/interview/SKILL.md "Goal firewall"). 이번 확장이 건드리면 안 되는 불변.

## 현행 서브에이전트 역할 인프라

- 역할 3종 고정: `ROLES = ["explorer","reviewer","executor"]`
  (`components/subagent-config/src/store.ts:15`). RoleConfig는 이미
  `mode/model/effort/promptOverride` 보유 (store.ts:38-52), effort 와이어 값
  `low|medium|high|xhigh` 검증 + full-fork 오버라이드 거부 규칙 문서화
  (store.ts:24-35, agents/README.md "Model / prompt override status").
- 역할→agent_type 매핑과 스킬 부착: `ROLE_AGENT_TYPE` (spawn-wrapper.ts:24),
  `ROLE_BASE_SKILLS` (spawn-wrapper.ts:80), `taskNameForRole` (spawn-wrapper.ts:316).
- 스폰 훅은 role 설정의 model/effort를 **호출자가 생략 + non-full-fork일 때**
  독립 주입 (agents/README.md). V1/V2 페이로드 경로는 260710_v1_v2_parity 트랙이
  소유 — 이번 유닛은 그 계약을 소비만 한다.
- 역할 enum 하드코딩 표면: cli.ts:28,38,43,86 / mcp.ts:19,46,80 /
  gui/src/pages/Subagents.tsx. 프롬프트 원본은 `agents/*.toml` (B-opt2 인라인
  주입, agents/README.md).

## 갭 (확장이 메우는 것)

1. Mind 워커는 역할이 아니므로 **모델/추론강도 지정 불가** — 항상 부모 모델/effort
   상속. gjc처럼 "인터뷰 렌즈는 저비용 모델 + 명시 effort"로 고정할 수 없음.
2. 프롬프트가 minds.ts 상수에만 있어 `agents/*.toml` 캐논 소스 체계 밖.
3. 옵트인 게이트 부재 — directive는 항상 인라인 프롬프트 디스패치만 안내.

## 결정에 영향 주는 제약

- store는 글로벌 Codex config를 절대 변경하지 않음 (store.ts 계약) → 옵트인은
  프로젝트 로컬 `.codexclaw/subagents.json` 안에 있어야 함.
- pabcd-state ↔ subagent-config는 별도 컴포넌트 패키지 — 옵트인 판독 시 순환
  의존 회피 필요 (040 §설계 결정 D3).
- LEAF-TOPOLOGY-01: interviewer 역할도 leaf — 재귀 스폰 금지 문구 필수.
