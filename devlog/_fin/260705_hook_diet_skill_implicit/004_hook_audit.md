# 004 — Hook Audit: Keep vs Remove

- Date: 2026-07-05
- Method: 17개 hook json 전수 읽기 + 기능 분류

---

## 분류 기준

- **KEEP**: 에이전트가 "안 하겠다"해도 강제하거나, 기계적 정확성이 필수인 것
  - Hard gate (차단/거부)
  - Timing-dependent (세션 시작 시 한 번만, compaction 후 등)
  - Mechanical capture (파일에 정확히 기록)
  - AST-level correctness (사람보다 코드가 정확)

- **REMOVE**: 에이전트가 규칙을 읽고 따르면 충분한 것
  - Advisory (조언 주입)
  - Pattern detection (에이전트 자체가 더 잘 감지)
  - Redundant with platform (Codex 네이티브 기능과 중복)
  - Trigger detection (implicit skill이 대체)

---

## KEEP (8)

### 1. session-start-ensuring-provider-bridge.json
- Event: SessionStart
- Component: provider-bridge
- 기능: ocx 프로세스 감지, 포트 확인, 모델 목록 캐시
- KEEP 이유: 세션 시작 시 한 번만 실행, 타이밍 의존, 에이전트 인지 불가

### 2. stop-checking-pabcd-continuation.json
- Event: Stop
- Component: pabcd-state
- 기능: PABCD cycle 미완료 시 에이전트 멈춤 방지
- KEEP 이유: **가장 중요한 hook**. 에이전트가 D 없이 끝내려 할 때 강제로 잡음.
  skill 규칙만으로는 에이전트가 "충분하다"고 판단하면 무시할 수 있음.

### 3. pre-tool-use-attaching-skills.json
- Event: PreToolUse (matcher: spawn_agent)
- Component: subagent-config
- 기능: 서브에이전트 spawn 시 관련 skill을 자동 attach
- KEEP 이유: 서브에이전트에게 skill을 전달하는 건 기계적이어야 함.
  메인 에이전트가 까먹으면 서브에이전트가 규칙 없이 동작함.

### 4. post-compact-resetting-reinject-cursor.json
- Event: PostCompact
- Component: pabcd-state
- 기능: compaction 후 PABCD 상태 재주입
- KEEP 이유: compaction은 에이전트 인지 밖. 상태 복구 필수.

### 5. pre-tool-use-guarding-goal-budget.json
- Event: PreToolUse (matcher: create_goal)
- Component: pabcd-state
- 기능: goal 생성 전 예산/조건 확인
- KEEP 이유: hard gate. 조건 불충족 시 tool call 자체를 차단.

### 6. pre-tool-use-guarding-interview-in-goal.json
- Event: PreToolUse (matcher: request_user_input)
- Component: pabcd-state
- 기능: goal 모드에서 user-input 차단
- KEEP 이유: hard gate. goal 모드 interview 금지 정책의 강제 집행.

### 7. post-tool-use-capturing-interview-answers.json
- Event: PostToolUse (matcher: request_user_input)
- Component: pabcd-state
- 기능: 인터뷰 Q/A를 .codexclaw/interviews/<session>.jsonl에 기록
- KEEP 이유: 기계적 캡처. 에이전트가 "기록해라"는 규칙을 받아도 포맷/경로를
  정확히 맞추기 어렵고, 까먹을 확률 높음. 데이터 무결성 필수.

### 8. pre-tool-use-linting-apply-patch.json
- Event: PreToolUse (matcher: apply_patch|Write|Edit)
- Component: pabcd-state
- 기능: 패치 전 AST lint, 구조 검증
- KEEP 이유: AST 분석은 코드가 에이전트보다 정확. lint 결과를 에이전트에게
  피드백해서 패치를 수정하게 함. skill 규칙으로는 "lint 돌려"밖에 못 씀.

---

## REMOVE (9)

### 1. post-tool-use-capturing-shell-friction.json
- Event: PostToolUse (matcher: Bash)
- 기능: 셸 명령 에러 시 friction.log에 기록
- REMOVE 이유: 에이전트가 이미 에러 출력을 보고 있음. "반복 에러 기록" 규칙을
  dev skill에 넣으면 에이전트가 직접 기록 가능. hook이 하는 건 결국
  "에러 패턴 문자열을 파일에 append"인데, 에이전트도 할 수 있음.
- 흡수: `dev` §3 verification에 규칙 추가

### 2. pre-tool-use-advising-on-friction.json
- Event: PreToolUse (matcher: Bash)
- 기능: 이전 friction 기반으로 "이거 주의해"라는 조언 주입
- REMOVE 이유: 순수 advisory. 에이전트가 friction.log를 읽고 스스로 판단 가능.
  hook이 하는 건 "friction.log 읽어서 경고 메시지 생성"뿐.
- 흡수: `dev` §3에 "재시도 전 .codexclaw/friction.log 확인" 규칙

### 3. post-tool-use-detecting-edit-shapes.json
- Event: PostToolUse (matcher: apply_patch)
- 기능: 유사한 패치가 반복되면 경고
- REMOVE 이유: 패턴 인식은 에이전트의 강점. "3회 유사 패치 감지 시 리팩터로
  전환"이라는 규칙이 hook보다 더 유연하게 동작함. hook은 단순 문자열 유사도만
  보지만, 에이전트는 의미적 유사성을 판단 가능.
- 흡수: `dev` §3에 규칙 추가

### 4. subagent-stop-verifying-evidence.json
- Event: SubagentStop (matcher: worker)
- 기능: worker 서브에이전트 결과에 evidence가 있는지 검증
- REMOVE 이유: evidence 검증은 메인 에이전트가 결과를 받아서 하는 게 더 자연스러움.
  hook이 하는 건 "결과에 특정 패턴이 있는지 체크 → 없으면 경고" 수준.
  pabcd skill에 "서브에이전트 결과 검증 절차" 명시하면 더 풍부한 검증 가능.
- 흡수: `pabcd` SKILL.md에 서브에이전트 결과 검증 규칙

### 5. session-start-injecting-project-rules.json
- Event: SessionStart
- 기능: AGENTS.md / .codex/ rules를 세션 시작 시 주입
- REMOVE 이유: **Codex 플랫폼이 이미 AGENTS.md를 네이티브로 주입함**.
  중복. 다만 codexclaw-specific rules (.codexclaw/ 안의 것)가 있다면 확인 필요.
- 확인 사항: hook이 AGENTS.md 외에 추가로 주입하는 게 있는지 코드 확인 후 제거

### 6. session-start-advertising-recall.json
- Event: SessionStart
- 기능: "recall 기능이 있다"는 것을 세션 시작 시 알림
- REMOVE 이유: `recall`을 implicit으로 올리면 시스템 프롬프트에 메타데이터 한 줄로
  항상 보임. hook이 하는 "알림"보다 더 지속적이고 자연스러운 노출.

### 7. user-prompt-submit-suggesting-recall.json
- Event: UserPromptSubmit
- 기능: 사용자 메시지에 "이전에", "지난번" 등 패턴 감지 시 recall 제안
- REMOVE 이유: implicit skill의 description에 trigger words를 넣으면 에이전트가
  자연어 이해로 더 정확하게 recall 필요성을 판단함. hook의 regex 매칭보다 우수.

### 8. post-compact-suggesting-recall.json
- Event: PostCompact
- 기능: compaction 후 "이전 컨텍스트가 사라졌으니 recall 써라" 제안
- REMOVE 이유: `post-compact-resetting-reinject-cursor` (KEEP)가 이미 compaction 후
  상태 복구를 담당. recall 제안은 에이전트 자체 판단으로 충분 (implicit 노출).
  또는 KEEP hook에 recall 힌트 한 줄을 추가하는 게 더 효율적.

### 9. user-prompt-submit-checking-pabcd-trigger.json
- Event: UserPromptSubmit
- 기능: 사용자 메시지에 PABCD 트리거 패턴 감지 시 I/P phase 진입 제안
- REMOVE 이유: `pabcd`와 `interview`를 implicit으로 올리면 에이전트가 trigger words를
  description에서 보고 자연스럽게 진입 판단. hook의 regex보다 에이전트의 의미 이해가
  더 정확. 또한 `dev` skill의 C5 classifier가 이미 "ambiguous → interview-first"를 안내.

---

## 제거 시 예상 latency 개선

현재: 매 Bash call → 2 hooks (friction capture + advise), 매 apply_patch → 2 hooks
(lint + edit-shape), 매 user message → 2 hooks (pabcd trigger + recall suggest)

제거 후: Bash → 0 hook, apply_patch → 1 hook (lint만), user message → 0 hook

각 hook이 node 프로세스 spawn + 10s timeout이므로, 체감 개선:
- Bash: ~200-500ms 절약/call
- apply_patch: ~100-250ms 절약/call
- user message: ~200-500ms 절약/turn
- session start: ~100-200ms 절약 (recall + rules 제거)

총: 빈번한 coding 세션에서 턴당 0.5-1.5초 절약 예상.
