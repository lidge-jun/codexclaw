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
+  "ONTOLOGIST: Check entity/relationship completeness against the spec.",
+  "Find missing entities, undefined fields, circular references, data model gaps.",
+  "Output contradictions in the ontology dimension. Verify against actual code structures.",
+  ].join(" "),
+
+  evaluator: [
+    "EVALUATOR: Test success criteria for measurability and parsimony.",
+    "Find criteria that are implementation steps (not outcomes), unmeasurable predicates, or over-fragmentation.",
+    "Output contradictions in the success dimension. 3-7 outcome-level items is the target range.",
+  ].join(" "),
+
+  simplifier: [
+    "SIMPLIFIER: Find over-engineering, redundant constraints, and scope creep.",
+    "Find complexity that can be removed without losing the core outcome, constraints that overlap.",
+    "Output contradictions where the plan is more complex than the goal requires.",
+  ].join(" "),
+};
+```
