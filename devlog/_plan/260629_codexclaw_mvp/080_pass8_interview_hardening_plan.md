# 080 — Pass 8: Interview 하드닝 (hardened plan)

Status: PLANNING (hardened) · Phase 1 루프의 Pass 8 (Pass 7 빌드·검증 이후) · 선행: Pass 1-7 완료

> 이 문서는 hardened 계획이다. 기계적으로 결정 가능한 모든 의사결정을 채웠다.
> jun에게 남긴 것은 genuinely open product/UX 선택지만 (`❓OPEN FOR JUN` 섹션).
> 리서치 MOC: [../260630_ouroboros_interview_research/000_moc.md](../260630_ouroboros_interview_research/000_moc.md)
>
> **Ground truth 소스 (실측 완료)**:
> - ouroboros clone: `devlog/_plan/260630_ouroboros_interview_research/.ouroboros/skills/{interview,auto,seed,evaluate}/SKILL.md`
> - codexclaw impl: `plugins/codexclaw/components/pabcd-state/src/{state.ts,hook.ts,parse.ts,cli.ts,fsm.ts}`
> - cli-jaw interview protocol: `~/.cli-jaw-3459/skills/dev-pabcd/SKILL.md`
> - codexclaw docs: `022.3_interview_goalmode_rules.md`, `023.1_interview_ipabcd_prompts.md`, `018.3_state_transition_injection.md`

## 목표

Interview(I) 단계를 "트리거 감지 + 짧은 디렉티브 주입"(Pass 2 수준)에서 **본격 인터뷰 엔진**으로
하드닝한다. gjc(cli-jaw)의 인터뷰 *알맹이*(4차원 추적·negativity bias·assumption 플래그·ready
criteria·elicitation)와 jawcode의 codex-native *배달*(stage-context 재주입·세션 스코프 상태)을
합치되, 두 구조의 원류인 **ouroboros(Q00)의 페르소나 기반 "모순 → 질문" 모델**을 채용한다.
하드닝 범위: state.ts 신규 필드, hook.ts 디렉티브 확장, 5-Mind 서브에이전트 role, hard gates,
readiness 로직, node:test, 슬라이스 순서. 코드 수정은 Pass 8 착수 시 실행.

## 핵심 구조 결정 (2026-06-30 jun 확정)

gjc = 서브에이전트가 질문 생성 / jawcode = 메인이 직접 질문 / ouroboros = 그 둘의 원류.

### D1 — 페르소나 범위: **5종 절충**

Contrarian · Socratic · Ontologist + Evaluator · Simplifier. (Nine Minds 전체 X — 9개 호출은 과함.)
5종은 "역할"이지 "동시 9-스폰"이 아님. 메인이 필요한 Mind만 골라 1~2개씩 호출.

### D2 — 실행 방식: **하이브리드 (역할 분리 엄격)**

핵심 루프(jun 확정):
```
서브에이전트: 모순점만 도출  →  메인: 질문 생성  →  메인: 플랜 수정  →  (다시) 메인: 질문  →  …반복
```

- **서브에이전트** = spec/코드/devlog 읽고 **모순·가정·누락만** 도출해 반환. 질문 생성 X, 플랜 수정 X,
  유저 호출 X. 순수 "모순 리스트" 생산자.
- **메인** = (1) 모순을 사용자 질문으로 변환·배달(`request_user_input`/elicitation),
  (2) **플랜을 직접 수정**(메인이 함, 서브 아님), (3) 다시 질문 — 루프.
- 9개 fan-out 금지 — 호출 수를 메인이 통제(필요 Mind만). codex `request_user_input`이
  Default/Plan 한정일 수 있어 유저 I/O는 반드시 메인이 중계.

### D3 — ⭐ codexclaw 고유: **메인이 플랜/devlog를 직접 수정** (기억만 X) — 실측 확정

**실측 결과 (ouroboros 소스 검증 완료)**:
- ouroboros는 인터뷰 도중 파일을 편집하지 않는다. interview SKILL.md는 MCP 서버에 state를 persist하고,
  종료 시 Seed YAML을 생성한다. seed SKILL.md의 QA refinement loop에서만 메인이 YAML을 **직접 편집**
  ("all revisions are direct YAML edits by you (main session)") — 하지만 이는 post-interview이다.
- 즉, **"인터뷰 도중 메인이 plan/devlog를 직접 편집"은 ouroboros에 없는 codexclaw 고유 확장**이다.
  ouroboros의 seed QA 직접 편집이 가장 가까운 analog이지만 시점이 다르다 (post-interview vs during-interview).
- 리서치 항목 7 해결: ouroboros에는 "기록하는 전용 장소"로 Seed YAML + `~/.ouroboros/seed-revisions/`
  감사파일이 있다. codexclaw의 직접 수정 대상 = 기존 devlog/plan 파일 (별도 seed 파일 신설 X, D4와 일치).

**auto 모드 — 실측 기반 설계 (기계적 결정)**:
- ouroboros auto SKILL.md의 auto-answerer 패턴 차용: `conservative_default` / `inference` / `assumption`
  세 가지 source로 자동 답변. `interview_closure_mode` = `None`(상호합의) | `ledger_only` | `safe_default`.
- codexclaw 매핑: **severity ≤ "low"** 모순은 메인이 conservative default로 자동 해결 (assumption으로
  기록), **severity "high"** 모순은 반드시 `request_user_input`으로 user에게 승격. "medium"은 auto-mode
  설정에 따라 (❓OPEN FOR JUN: auto-mode 기본 on/off).
- 루프는 max rounds로 bound (ouroboros `max_interview_rounds` 패턴). 기본값은 ❓OPEN FOR JUN.

### D4 — 루프: ouroboros 5단계 그대로 X, **codexclaw식 PABCD 반복**

- ouroboros Interview→Seed→Execute→Evaluate→Evolve를 verbatim 채용하지 않음.
- codexclaw = **PABCD를 여러 번 반복**하는 기존 모델 유지. 인터뷰 하드닝은 그 반복 루프 안의
  I 단계 강화로 흡수. "이 과정 자체를 codexclaw에 맞춘다"가 원칙.

## 차용 대상 (실측 확정)

- ouroboros 루프: Interview → Seed → Execute → Evaluate → Evolve. — **D4에 따라 verbatim 채용 X**,
  codexclaw PABCD 반복 루프 안의 I 단계 강화로 흡수.
- Nine Minds 중 5종만 (D1): Contrarian · Socratic · Ontologist · Evaluator · Simplifier.
  (Hacker, Researcher, Architect, Seed Architect는 제외 — 9개 fan-out 금지, D2.)
- ouroboros **codex 플러그인** 디렉토리 구조: `.claude-plugin/plugin.json` + `.codex/{hooks.json,config.toml}`
  + `skills/` 폴더. codexclaw는 이미 자체 `plugins/codexclaw/` 구조를 가지므로 구조 차용 X, 패턴만 참조.
- subagent fan-out: ouroboros는 `ouroboros_lateral_think` MCP tool로 persona를 병렬 spawn. codexclaw는
  codex native subagent (main agent가 spawn)로 대체 — MCP 서버 불필요 (MOC 가설 확인).
- **Refine gate**: ouroboros의 free-text 정제 게이트는 codexclaw에 적합 — `request_user_input`의
  `options` + "Other" free-form으로 동일 UX 달성. Pass 8에서 채용.
- **Dialectic Rhythm Guard**: ouroboros의 "3 consecutive non-user answers → next must go to user" 규칙.
  codexclaw auto-mode에 편입 — auto 연속 3회 후 다음 모순은 user 승격 (기계적 결정).

## 작업 슬라이스 (확정 — 의존성 순서)

1. **state.ts**: interview tracker 신규 필드 + strict-reconstruct 3-처 규칙 (§1).
2. **fsm.ts**: `canEnter("P")` 게이트 — `flags.interview`를 `isInterviewReady()` 결과로 파생 (§1.4).
3. **hook.ts**: `interviewDirective()` 확장 — 4차원 프로토콜 + 루프 단계 + 5-Mind specs + gates (§2, §3, §4).
4. **hook.ts**: `MIND_ROLE_PROMPTS` 상수 — 5종 role prompt (§3).
5. **hook.ts**: goal-mode ban + `request_user_input` hard dependency — directive text에 advisory + native (§4).
6. **test/state.test.ts + test/hook.test.ts + test/fsm.test.ts**: 신규 필드 + readiness + directive 내용 (§5).
7. **D4 통합**: 별도 5단계 루프 신설 X — 기존 PABCD I 단계 안에 흡수 (§6).

## 추가 리서치 항목 (D3 발 — 실측 완료, 해결)

- **auto 모드**: ouroboros auto SKILL.md의 `conservative_default`/`inference`/`assumption` source 패턴으로
  해결. severity 기반 자동 해결/승격 분기. Dialectic Rhythm Guard 편입.
- **서브에이전트 직접 편집 충돌**: D2에 따라 **서브에이전트는 편집 금지** (모순 도출만). 메인만 편집.
  충돌·동시성 문제 발생 안 함 — 서브는 read-only, 메인은 단일 writer.

추가 리서치 항목은 모두 실측 완료. 미해결 항목은 `❓OPEN FOR JUN` 섹션 참조.

---

## §1 — State Model: Interview Tracker (state.ts)

### 1.1 설계 원칙

**CRITICAL — 3-처 strict-reconstruct 규칙** (기존 state.ts:62-77의 spread-less 리터럴):
`readState()`는 `defaultState()` 기반으로 **명시적 필드만** 재구성한다 (unknown-key passthrough 금지).
따라서 `interview` 신규 필드는 **반드시 3곳에 추가**:
1. `State` interface (`export interface State { ... interview: InterviewTracker | null; }`)
2. `defaultState()` 반환값 (`interview: null`)
3. `readState()`의 strict-reconstruct 리터럴 (`interview: parsed.interview ? reconstructInterview(parsed.interview) : null`)

누락 시 **조용히 drop** — 기존 `injectedTurns` 버그와 동일 패턴. 테스트로 방어 (§5).

### 1.2 TS Interface Sketch

```typescript
// state.ts — 신규 타입

export type Dimension = "goal" | "constraint" | "success" | "ontology";
export const DIMENSIONS: readonly Dimension[] = ["goal", "constraint", "success", "ontology"];

export type DimensionLevel = "low" | "mid" | "high" | "max";

export interface DimensionScore {
  level: DimensionLevel;    // assessment progression: low→max
  known: string[];           // resolved facts (moved from unknown[])
  unknown: string[];         // open questions still to resolve
  confidence: number;        // 0..1, overall confidence for this dimension
}

export type ContradictionSeverity = "low" | "medium" | "high";

export interface Contradiction {
  dimension: Dimension;
  contradiction: string;     // short description of the gap/conflict
  severity: ContradictionSeverity;
  evidence: string;          // file:line or quote from spec/plan/devlog
}

export interface InterviewTracker {
  rounds: number;            // interview round counter (bounds the loop)
  ready: boolean;            // cached readiness — isInterviewReady() result
  assumptions: string[];     // auto-resolved or unconfirmed assumptions (cross-dimension)
  contradictions: Contradiction[];  // current unresolved (resolved ones removed)
  dimensions: {
    goal: DimensionScore;
    constraint: DimensionScore;
    success: DimensionScore;
    ontology: DimensionScore;
  };
}

// State interface에 추가:
export interface State {
  phase: Phase;
  sessionId: string;
  slug: string;
  updatedAt: string;
  flags: Flags;
  supersededBy: string | null;
  injectedTurns: string[];
  interview: InterviewTracker | null;  // null = no interview started/completed
}
```

### 1.3 Factory + Reconstruct Helpers

```typescript
// state.ts — 신규 함수

function defaultDimension(): DimensionScore {
  return { level: "low", known: [], unknown: [], confidence: 0 };
}

export function defaultInterview(): InterviewTracker {
  return {
    rounds: 0,
    ready: false,
    assumptions: [],
    contradictions: [],
    dimensions: {
      goal: defaultDimension(),
      constraint: defaultDimension(),
      success: defaultDimension(),
      ontology: defaultDimension(),
    },
  };
}

function reconstructDimension(raw: unknown): DimensionScore {
  if (!raw || typeof raw !== "object") return defaultDimension();
  const d = raw as Record<string, unknown>;
  const level = d.level;
  return {
    level: level === "low" || level === "mid" || level === "high" || level === "max" ? level : "low",
    known: Array.isArray(d.known) && d.known.every((x) => typeof x === "string") ? d.known : [],
    unknown: Array.isArray(d.unknown) && d.unknown.every((x) => typeof x === "string") ? d.unknown : [],
    confidence: typeof d.confidence === "number" && d.confidence >= 0 && d.confidence <= 1 ? d.confidence : 0,
  };
}

function reconstructContradiction(raw: unknown): Contradiction | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const dim = c.dimension;
  const sev = c.severity;
  if (typeof c.contradiction !== "string" || typeof c.evidence !== "string") return null;
  if (dim !== "goal" && dim !== "constraint" && dim !== "success" && dim !== "ontology") return null;
  if (sev !== "low" && sev !== "medium" && sev !== "high") return null;
  return { dimension: dim, contradiction: c.contradiction, severity: sev, evidence: c.evidence };
}

function reconstructInterview(raw: unknown): InterviewTracker {
  if (!raw || typeof raw !== "object") return defaultInterview();
  const t = raw as Record<string, unknown>;
  const dims = t.dimensions;
  const contradictions = Array.isArray(t.contradictions)
    ? t.contradictions.map(reconstructContradiction).filter((c): c is Contradiction => c !== null)
    : [];
  return {
    rounds: typeof t.rounds === "number" && t.rounds >= 0 ? Math.floor(t.rounds) : 0,
    ready: t.ready === true,
    assumptions: Array.isArray(t.assumptions) && t.assumptions.every((x) => typeof x === "string") ? t.assumptions : [],
    contradictions,
    dimensions: dims && typeof dims === "object"
      ? {
          goal: reconstructDimension((dims as Record<string, unknown>).goal),
          constraint: reconstructDimension((dims as Record<string, unknown>).constraint),
          success: reconstructDimension((dims as Record<string, unknown>).success),
          ontology: reconstructDimension((dims as Record<string, unknown>).ontology),
        }
      : { goal: defaultDimension(), constraint: defaultDimension(), success: defaultDimension(), ontology: defaultDimension() },
  };
}
```

`readState()` 리터럴에 추가되는 줄 (기존 `injectedTurns` 줄 아래):
```typescript
    interview: parsed.interview ? reconstructInterview(parsed.interview) : null,
```

### 1.4 Readiness Logic + FSM Gate

```typescript
// state.ts — readiness predicate
export function isInterviewReady(tracker: InterviewTracker | null): boolean {
  if (!tracker) return false;
  const dims = Object.values(tracker.dimensions);
  return dims.every((d) => d.level === "max") && tracker.assumptions.length === 0;
}
```

**FSM 게이트 (fsm.ts) — 기계적 결정: `flags.interview` 파생 방식 채용 (backward-compatible)**:
- 기존 `canEnter("P")`는 `state.flags.interview === true`를 검사 (fsm.ts:12-15). 이 인터페이스를 유지.
- 메인 에이전트가 `isInterviewReady(state.interview)`가 true가 된 시점에 `flags.interview = true`로 설정.
- 이유: fsm.ts 인터페이스 변경 최소화, 기존 테스트 호환, `flags.interview`는 "인터뷰 완료" 여부의
  단일 boolean 게이트로 유지. `interview.ready`는 캐시된 파생값 (state에 저장하여 compaction 후 복원).
- 대안 고려: `canEnter("P")`에서 `interview?.ready` 직접 검사 → 기각 (FSM이 state 구조에 결합, 기존
  테스트 전면 수정 필요). `flags.interview` 파생 방식이 cleaner.

---

## §2 — Contradiction → Question → Plan-Edit Loop (Pipeline)

### 2.1 소유권 매트릭스 (file → role)

| 단계 | 소유자 | 파일 | 함수/위치 | 설명 |
|------|--------|------|-----------|------|
| 디렉티브 주입 | hook | `hook.ts` | `interviewDirective()` → `handleUserPromptSubmit()` | 4차원 프로토콜 + 루프 단계를 `additionalContext`로 주입 (Pass 2 메커니즘 유지) |
| 상태 read/write | state | `state.ts` | `readState()`/`writeState()` | interview tracker 영속화 (§1) |
| readiness 판정 | state | `state.ts` | `isInterviewReady()` | all-max + assumptions-empty |
| FSM 게이트 | fsm | `fsm.ts` | `canEnter("P")` | `flags.interview` 체크 (변경 없음) |
| 모순 도출 | subagent | (runtime spawn) | role prompt via `MIND_ROLE_PROMPTS` | codex native subagent, read-only, 구조화 JSON 반환 |
| 질문 생성 + 배달 | main | (runtime behavior) | directive text에 지시 | `request_user_input`으로 user에게 질문 |
| 플랜/devlog 직접 수정 | main | (runtime behavior) | directive text에 지시 | `apply_patch`/파일 편집으로 devlog/plan 직접 수정 (D3) |
| 상태 업데이트 | main | (runtime behavior) | directive text에 지시 | `writeState()`로 tracker 업데이트 |
| goal-mode gate | hook | `hook.ts` | directive text (advisory) | 022.3 A3: goal active 시 I-phase 금지 (advisory + native) |

**핵심**: 루프는 **main agent behavior** (directive text로 지시), code가 아니다. hook.ts는 디렉티브만
주입; state.ts는 영속화만 담당; subagent는 runtime에 spawn되어 모순만 반환. D2 역할 분리 엄수.

### 2.2 루프 단계 (directive text에 포함될 내용)

```
INTERVIEW LOOP (main agent follows each turn while in I-phase):

1. INIT: read state.interview; if null, initialize with defaultInterview() and writeState.
2. SELECT: pick 1-2 Minds targeting the lowest-scoring dimensions (D1 — no 9-way fan-out).
3. SPAWN: dispatch codex subagent(s) with MIND_ROLE_PROMPTS[mind] + current spec/plan/devlog context.
4. COLLECT: subagent returns structured contradictions [{dimension, contradiction, severity, evidence}].
5. TRIAGE:
   - severity "high" → MUST escalate to user via request_user_input (auto-mode off-limits).
   - severity "medium" → escalate to user if auto-mode is OFF; auto-resolve if ON (record as assumption).
   - severity "low" → auto-resolve with conservative default, record in assumptions[] (auto-mode agnostic).
   - Dialectic Rhythm Guard: if 3 consecutive auto-resolves, next contradiction MUST escalate to user.
6. QUESTION: for each user-escalated contradiction, synthesize a focused question → call request_user_input.
   Apply Refine gate: structure free-text answers, confirm before absorbing (ouroboros Refine pattern).
7. APPLY: for each answer — (a) edit plan/devlog directly via apply_patch (D3), (b) update tracker:
   move contradiction from contradictions[] to dimensions[dim].known[], bump level if appropriate,
   remove from dimensions[dim].unknown[].
8. WRITE: writeState with updated interview tracker. Set flags.interview = isInterviewReady(tracker).
9. CHECK: if isInterviewReady() → exit loop, set flags.interview = true, advance to P.
   if not ready and rounds < max → increment rounds, go to step 2.
   if rounds >= max → (❓OPEN FOR JUN: closure policy — safe_default vs block).
```

### 2.3 hook.ts 변경사항 (코드 레벨)

`interviewDirective()` 확장 — 기존 4줄 → 다중 섹션 문자열:
```typescript
const INTERVIEW_PROTOCOL = [
  "[codexclaw: INTERVIEW — 4-Dimension Protocol]",
  "Track four dimensions: Goal, Constraint, Success criteria, Ontology.",
  "Each dimension has a level (low→mid→high→max), known[], unknown[], confidence.",
  "Interview is ready when all dimensions reach 'max' AND assumptions[] is empty.",
  "",
  "LOOP: subagent(contradictions) → main(question) → main(edit plan) → main(re-question) → repeat.",
  "Subagents: CONTRADICTIONS ONLY. Never ask questions, never edit plans, never call the user.",
  "Main: generate questions, deliver via request_user_input, edit plan/devlog directly, update state.",
].join("\n");

const INTERVIEW_GATES = [
  "[GATES]",
  "request_user_input: REQUIRED for interview. If unavailable → interview unavailable (fail-fast).",
  "  Detect feature flag default_mode_request_user_input. If off, guide user to enable (023.1).",
  "  NEVER auto-write config.toml. Fallback: MCP elicitation (tool_call_mcp_elicitation, Stable).",
  "Goal mode: interview is STRICTLY FORBIDDEN. If a codex goal is active, do NOT run I-phase.",
  "  Do NOT call request_user_input. Rely on codex native goal suppression (022.3 A3).",
].join("\n");
```

`interviewDirective()` = `[INTERVIEW_PROTOCOL, MIND_SPECS, INTERVIEW_GATES, LOOP_STEPS].join("\n\n")`

`handleUserPromptSubmit()` 변경: **없음** — 주입 메커니즘은 Pass 2 그대로 (trigger 감지 → idempotent
주입). 디렉티브 내용만 확장. goal-mode suppression은 payload에서 goal-active를 알 수 없으므로
directive text의 advisory rule에 의존 (022.3 A3 hybrid — Phase 1 한계 명시).

---

## §3 — 5-Mind Subagent Role Prompts

### 3.1 출력 계약 (모든 Mind 공통)

모든 subagent는 **동일한 출력 형식**으로 구조화 JSON을 반환:
```json
[
  {"dimension": "goal|constraint|success|ontology", "contradiction": "<short gap/conflict>", "severity": "low|medium|high", "evidence": "<file:line or quote>"}
]
```
- 빈 배열 = 모순 없음 (해당 Mind 관점에서).
- 절대 질문 생성 X, 플랜 수정 X, user 호출 X. D2 역할 분리.
- evidence는 실제 파일 경로/라인 또는 인용 (추측 금지, ouroboros inspect_code 패턴).

### 3.2 5-Mind Specs (MIND_ROLE_PROMPTS 상수 — hook.ts)

```typescript
type Mind = "contrarian" | "socratic" | "ontologist" | "evaluator" | "simplifier";

const MIND_ROLE_PROMPTS: Record<Mind, string> = {
  contrarian: [
    "CONTRARIAN: Challenge every stated goal/constraint as if it's wrong.",
    "Find assumptions treated as facts, constraints that may not hold, goals that conflict with reality.",
    "Output contradictions in the goal/constraint dimensions. Be skeptical, not rude.",
  ].join(" "),

  socratic: [
    "SOCRATIC: Probe for missing definitions, vague terms, and unmeasurable language.",
    "Find where 'fast', 'scalable', 'easy' etc. lack precise meaning, where success criteria are fuzzy.",
    "Output contradictions where terms lack operational definitions across all dimensions.",
  ].join(" "),

  ontologist: [
    "ONTOLOGIST: Check entity/relationship completeness against the spec.",
    "Find missing entities, undefined fields, circular references, data model gaps.",
    "Output contradictions in the ontology dimension. Verify against actual code structures.",
  ].join(" "),

  evaluator: [
    "EVALUATOR: Test success criteria for measurability and parsimony.",
    "Find criteria that are implementation steps (not outcomes), unmeasurable predicates, or over-fragmentation.",
    "Output contradictions in the success dimension. 3-7 outcome-level items is the target range.",
  ].join(" "),

  simplifier: [
    "SIMPLIFIER: Find over-engineering, redundant constraints, and scope creep.",
    "Find complexity that can be removed without losing the core outcome, constraints that overlap.",
    "Output contradictions where the plan is more complex than the goal requires.",
  ].join(" "),
};
```

### 3.3 Mind 선택 전략 (메인 agent — directive text에 지시)

- 메인은 **필요한 Mind만 1-2개** 호출 (D1, D2 — 9-way fan-out 금지).
- 선택 기준: **lowest-scoring dimension**에 해당하는 Mind 우선.
  - goal이 low → contrarian + socratic
  - constraint가 low → contrarian + simplifier
  - success가 low → evaluator + socratic
  - ontology가 low → ontologist + simplifier
- 최대 2개 동시 spawn (codex native subagent 병렬). 결과 merge 후 step 5(triage)로.

---

## §4 — Hard Gates

### 4.1 request_user_input 가용성 (022.3 + 023.1)

**결정 (기계적 — 022.3에 이미 확정)**:
- Interview는 `request_user_input`에 **HARD dependency** (022.3). unavailable → interview unavailable,
  fail-fast report. silent degradation 금지.
- 탐지: directive text가 메인에게 지시 — feature flag `default_mode_request_user_input` 확인.
  hook 자체는 config.toml을 읽지 않음 (hook payload에 config 정보 없음).
- flag off 시: user에게 활성화 안내 (023.1). **NEVER auto-write config.toml** (Phase 1 config-untouched).
- fallback: MCP elicitation (`tool_call_mcp_elicitation`, Stable, default ON) — 023.1에 명시된 대안.

**어디서 시행**: `interviewDirective()` 내 `INTERVIEW_GATES` 텍스트 (advisory, main agent behavior).
hook 코드 레벨에서는 시행 불가 (payload에 feature flag 정보 없음). Phase 1 = advisory + native.

### 4.2 Goal-Mode Interview Ban (022.3 A3)

**결정 (기계적 — 022.3 A3에 이미 확정, 변경 없음)**:
- Goal mode active 시: I-phase 트리거 금지, `request_user_input` 호출 금지.
- **Phase 1 시행 = ADVISORY + native** (022.3 A3 hybrid):
  1. directive text (`INTERVIEW_GATES`)에 "NEVER interview in goal mode" 경고 — main agent가 준수.
  2. codex native suppression (`core/src/goals.rs`: user activity suppresses auto-continuation)에 의존.
  3. DEFERRED (post-Phase-1): PreToolUse hard-deny on `request_user_input` while goal active —
     thread-store goal-read path 증명 후 (022.3, 019.2 Q-GM-1-followup). Pass 8 범위 외.
- **hook.ts에서 goal-check 불가**: goal-active가 hook payload에 없음 (022.3에서 검증 완료).
  따라서 `handleUserPromptSubmit()`에 goal 분기 추가 X. advisory text만으로 시행.

### 4.3 Dialectic Rhythm Guard (ouroboros 차용)

**결정 (기계적 — ouroboros interview SKILL.md 패턴)**:
- 연속 3회 auto-resolve (severity low 또는 auto-mode medium) 후, 다음 모순은 **반드시** user에게 승격.
- auto-mode가 user를 소외시키는 것 방지 (ouroboros "3 consecutive non-user answers" 규칙).
- 카운터: `interview.rounds` 또는 별도 auto-streak 카운터 (구현 시 선택, 둘 다 기능 동일).
- user가 직접 답하면 카운터 reset (ouroboros 패턴과 일치).

---

## §5 — node:test Plan

기존 테스트 패턴 (`test/state.test.ts`, `test/hook.test.ts`, `test/fsm.test.ts`) 준수.
`node:test` + `node:assert/strict`, `mkdtempSync`/`rmSync` fresh-cwd 패턴 유지.

### 5.1 state.test.ts — 신규 테스트

```
test("interview: defaults to null on fresh state")
test("interview: null roundtrips through write -> read")
test("interview: defaultInterview() has all 4 dimensions at low, empty arrays, ready=false")
test("interview: full tracker roundtrips through write -> read")
test("interview: unknown keys in nested dimensions are dropped (strict reconstruct)")
  — persist {interview:{dimensions:{goal:{level:"max",bogus:1}}}} → read → no 'bogus' key
test("interview: invalid dimension level -> defaults to 'low' (strict reconstruct)")
  — persist {interview:{dimensions:{goal:{level:"ULTRA"}}}} → read → level === "low"
test("interview: invalid confidence (NaN, >1, <0) -> defaults to 0")
test("interview: contradictions with invalid dimension/severity are dropped, valid ones kept")
test("interview: contradictions: non-array -> []")
test("isInterviewReady: null -> false")
test("isInterviewReady: all max + assumptions empty -> true")
test("isInterviewReady: one dimension not max -> false")
test("isInterviewReady: all max but assumptions non-empty -> false")
test("isInterviewReady: all max but contradictions non-empty -> false")
  — unresolved contradictions mean not ready (they must be triaged first)
```

### 5.2 hook.test.ts — 신규 테스트

```
test("interviewDirective: contains 4-dimension names (Goal, Constraint, Success, Ontology)")
test("interviewDirective: contains loop description (subagent contradictions → main question)")
test("interviewDirective: contains goal-mode ban text")
test("interviewDirective: contains request_user_input hard dependency text")
test("interviewDirective: contains all 5 Mind names")
test("interviewDirective: length < 32k (buildContextOutput cap)")
test("handleUserPromptSubmit: interview trigger injects expanded directive (not the old 4-line stub)")
test("handleUserPromptSubmit: interview directive is idempotent per turn (existing behavior preserved)")
```

### 5.3 fsm.test.ts — 신규 테스트

```
test("canEnter P: interview ready flag true -> ok (backward compat, existing test preserved)")
test("canEnter P: interview ready flag false -> blocked (existing test preserved)")
  — no new test needed; flags.interview derivation is main-agent behavior, not FSM code
```

---

## §6 — Slice Ordering + PABCD Integration (D4)

### 6.1 슬라이스 순서 (의존성 기반 — 확정)

| 순서 | 슬라이스 | 파일 | 선행 | 산출물 |
|------|---------|------|------|--------|
| S1 | Interview tracker state | `state.ts` | 없음 | `InterviewTracker`, `DimensionScore`, `defaultInterview()`, `reconstructInterview()`, `isInterviewReady()` + 3-처 규칙 |
| S2 | FSM gate 확인 | `fsm.ts` | S1 | `canEnter("P")` 변경 없음 (backward compat), 주석으로 `flags.interview` 파생 명시 |
| S3 | Expanded directive | `hook.ts` | S1 | `interviewDirective()` 다중 섹션 (protocol + loop + gates) |
| S4 | 5-Mind role prompts | `hook.ts` | S3 | `MIND_ROLE_PROMPTS` 상수, `Mind` type, 선택 전략 directive |
| S5 | Hard gates text | `hook.ts` | S3 | `INTERVIEW_GATES` (request_user_input + goal-mode ban + Rhythm Guard) |
| S6 | Tests | `test/*.test.ts` | S1, S3, S4 | state.test.ts 신규 ~14 tests, hook.test.ts 신규 ~7 tests |
| S7 | D4 통합 검증 | (문서) | S1-S6 | 별도 5단계 루프 신설 X 확인, I 단계 강화가 PABCD 반복에 흡수됨 |

S1-S2는 state layer, S3-S5는 hook layer, S6는 검증, S7는 설계 검증. 각 슬라이스는 atomic commit 단위.

### 6.2 D4 — PABCD 반복 루프에 흡수 (별도 5단계 X)

**확인 (D4 원칙 유지)**:
- ouroboros의 Interview → Seed → Execute → Evaluate → Evolve 5단계를 **verbatim 채용하지 않음**.
- 인터뷰 하드닝 = 기존 PABCD의 **I 단계 확장**. I 단계가 끝나면 기존대로 P → A → B → C → D → (반복).
- I 단계 내부의 모순→질문→수정 루프(§2.2)는 I 단계의 내부 구현이지, 별도 phase가 아님.
- multi-pass 작업 = 여러 PABCD pass (기존 dev-pabcd "work-phase = one PABCD cycle" 원칙 유지).
  각 pass의 I 단계에서 interview tracker가 초기화되거나 (새 work-phase) 이전 pass의 tracker를
  이어받아 (같은 goal의 연속 work-phase) 진행. 이어받기 여부는 ❓OPEN FOR JUN.

### 6.3 파일 영향도 요약

| 파일 | 변경 유형 | 라인 추정 |
|------|-----------|-----------|
| `src/state.ts` | MODIFY — 신규 타입 + 함수 + reconstruct | +~120 lines (interface ~40, helpers ~80) |
| `src/hook.ts` | MODIFY — directive 확장 + MIND_ROLE_PROMPTS | +~60 lines |
| `src/fsm.ts` | MODIFY — 주석만 (코드 변경 없음) | +~3 lines |
| `test/state.test.ts` | MODIFY — 신규 ~14 tests | +~120 lines |
| `test/hook.test.ts` | MODIFY — 신규 ~7 tests | +~50 lines |
| `test/fsm.test.ts` | MODIFY — 주석만 | +~2 lines |

모든 파일 500-line 제한 내 (dev 규칙). `state.ts`는 ~120 + 기존 ~120 = ~240. `hook.ts`는 ~60 + ~130 = ~190.

---

## ❓OPEN FOR JUN — Genuinely Open Product/UX Decisions

아래 항목만 jun의 결정이 필요하다. 나머지는 모두 기계적으로 결정 완료.

1. **Auto-mode 기본 on/off**: severity "medium" 모순을 자동 해결(assumption 기록)할지 user 승격할지의
   기본값. on = 유저 부담 최소 (ouroboros auto 패턴), off = 모든 medium을 user에게 (cli-jaw 보수).
   D3가 auto-mode "필요"라고 했으나 기본값은 UX 선택.

2. **Max rounds 기본값**: 인터뷰 루프를 몇 round까지 돌릴지 (ouroboros `max_interview_rounds`).
   도달 시 closure policy: `safe_default` (남은 gap을 conservative default로 채움) vs `block` (user에게
   "해결 안 된 모순이 남았다" 보고 후 정지). ouroboros는 `safe_default` + `ledger_only` + genuine-deadlock
   3종 closure를 구분 — codexclaw는 어디까지 채택할지.

3. **Contrarian aggressiveness 톤 조정**: Contrarian role prompt의 "Be skeptical, not rude" 라인의
   강도. 너무 약하면 모순 도출 부족, 너무 강하면 user 경험 저하. prompt 튜닝은 jun의 product call.

4. **Interview tracker 이어받기 (cross-pass)**: 같은 goal의 여러 work-phase(PABCD pass) 간에
   `state.interview`를 초기화할지 이어받을지. 초기화 = 각 pass 독립 인터뷰 (cli-jaw "I 단계는
   언제든 복귀 가능"와 일치). 이어받기 = goal 단위 인터뷰 추적 (ouroboros session persistence와 유사).

5. **Elicitation fallback 우선순위**: `request_user_input` flag off 시 — MCP elicitation
   (`tool_call_mcp_elicitation`, Stable)을 즉시 사용할지, 아니면 user에게 flag 활성화를 먼저 권유할지.
   023.1은 "guide user to enable (or use MCP elicitation)"으로 둘 다 허용. 우선순위는 UX 선택.
   Plain-text fallback은 022.3이 금지하므로 선택지에서 제외 (fail-fast only).

6. **`flags.interview` 설정 주체**: 메인 agent가 `isInterviewReady()` true 시 자동 설정(현재 설계) vs
   user가 "인터뷰 끝" 명시적 선언 필요. 자동 = goal-mode와 충돌 시 코너케이스 (goal mode는 인터뷰
   금지이므로 자동 설정이 goal mode에서 발생할 수 없음 — 자동이 안전). 명시적 = user 통제 강화.
   현재 설계(자동)가 기계적으로 안전하지만, user 통제 선호도는 product call.

---

## 상태

- 2026-06-30: stub 생성. ouroboros 리서치 폴더와 상호 링크. 실 설계는 Pass 7 이후 착수.
- 2026-06-30: **hardened** — ouroboros 소스 실측 완료. D1-D4 유지·심화. §1-§6 기계적 결정 충완.
  ❓OPEN FOR JUN 6항만 잔존. 코드 수정은 Pass 8 착수 시.
