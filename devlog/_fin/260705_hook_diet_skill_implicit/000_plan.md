# Hook Diet + Skill Implicit Expansion

- Date: 2026-07-05
- Status: PLAN (pre-implementation)
- Trigger: hook 과다 → latency + 유지보수 부담; on-demand skill이 implicit 부족으로
  miss되는 문제; agbrowse 노출 부재로 browser skill로 우회하는 비효율.
- Prior art: cli-jaw `skills_ref/` + `registry.json` 226-skill dormant pool 조사 완료.

---

## Background

### 현재 상태

- plugin.json에 17개 hook 등록
- 매 tool call (apply_patch, Bash, spawn_agent 등)마다 최대 3-4개 hook이 node 프로세스
  spawn → 10s timeout 대기 → latency 누적
- 스킬 23개 중 implicit은 `dev` 1개뿐 → 나머지는 에이전트가 존재를 모르는 채 miss
- agbrowse (`/Users/jun/.local/bin/agbrowse`)가 설치되어 있으나 `search` skill
  (implicit-off) 안에만 언급 → 에이전트가 browser skill로 바로 가는 비효율

### cli-jaw 참조 패턴

cli-jaw는 `skills_ref/`에 226개 스킬을 dormant로 두고:
- `registry.json`에 이름/설명/카테고리만 기록
- 프롬프트 `skills.md` 템플릿에서 **Active Skills** (설치됨) / **Available Skills**
  (레퍼런스만) 2단계로 노출
- 에이전트가 Available 스킬을 쓸 때 `skills_ref/<name>/SKILL.md`를 on-demand로 읽음
- 서버 런타임(`builder.ts`, `skill-cache.ts`)이 프로그래매틱 프롬프트 조립

codexclaw은 런타임 없이 **문서 레이어** (skill-hub catalog + openai.yaml
`allow_implicit_invocation`)로 동일 구조를 달성:
- Codex 플랫폼이 implicit=true 스킬을 `<skills_instructions>`에 메타데이터 한 줄로 노출
- implicit=false 스킬은 `$name` 멘션이나 SKILL.md 경로로 explicit 로드
- 비용: 메타데이터 ~30 토큰/스킬 → 6개 추가해도 ~180 토큰

---

## Phase 1 — Implicit Expansion (6 skills)

### 대상

| Skill | 이유 |
|-------|------|
| `search` | 한국어 검색 intent, agbrowse ladder 자연 노출 |
| `interview` | I-phase 진입 soft trigger 다양 ("물어봐", "확인해봐", "요구사항") |
| `pabcd` | "계획 세워줘", "체계적으로", "단계별로" soft trigger |
| `recall` | "지난번에", "아까 그거", "전에 한 거" 문맥 의존 |
| `skill-hub` | "뭐가 있지?", "무슨 스킬" capability discovery |
| `loop` | Stop 시점 continuation을 위해 존재 인지 필요 |

### 작업

각 스킬의 `agents/openai.yaml`에서:
```yaml
policy:
  allow_implicit_invocation: true
```

파일 6개 수정. 리스크: 없음 (메타데이터 노출만).

---

## Phase 2 — agbrowse 노출

### 문제

agbrowse가 PATH에 있지만 에이전트가 모름 (search skill이 implicit-off였으므로).
Phase 1에서 search를 implicit으로 올리면 메타데이터는 보이지만, agbrowse 자체는
SKILL.md 본문 안에 있어서 에이전트가 SKILL.md를 읽기 전까진 여전히 모름.

### 해법

`dev` SKILL.md (always-on, implicit)에 capabilities note 한 줄 추가:

```markdown
## §X.1 Available proof tools
- `agbrowse` is on PATH for HTTP-first URL verification.
  For any URL proof, prefer `agbrowse fetch <url> --json` before browser tools.
  Full ladder: `$cxc-search` Tier 2.
```

이러면 에이전트가 매 코딩 턴에 dev를 읽을 때 agbrowse를 인지하고, 필요하면
search skill을 로드해서 전체 tier ladder를 따름.

---

## Phase 3 — Hook Diet (17 → 8)

### 유지할 Hook (8개)

| # | Hook file | Event | 유지 이유 |
|---|-----------|-------|-----------|
| 1 | session-start-ensuring-provider-bridge | SessionStart | 타이밍 의존 (ocx 감지) |
| 2 | stop-checking-pabcd-continuation | Stop | hard gate (에이전트 강제 잡기) |
| 3 | pre-tool-use-attaching-skills | PreToolUse(spawn_agent) | spawn 시 자동 skill 주입 |
| 4 | post-compact-resetting-reinject-cursor | PostCompact | 상태 복구 (에이전트 인지 불가) |
| 5 | pre-tool-use-guarding-goal-budget | PreToolUse(create_goal) | hard gate |
| 6 | pre-tool-use-guarding-interview-in-goal | PreToolUse(request_user_input) | hard gate |
| 7 | post-tool-use-capturing-interview-answers | PostToolUse(request_user_input) | 기계적 캡처 |
| 8 | pre-tool-use-linting-apply-patch | PreToolUse(apply_patch) | AST lint 정확성 필수 |

### 제거 대상 (9개) — skill 흡수

| # | Hook file | 흡수 위치 | 방법 |
|---|-----------|-----------|------|
| 1 | post-tool-use-capturing-shell-friction | `dev` §3 | 규칙: "셸 에러 시 .codexclaw/friction.log에 기록" |
| 2 | pre-tool-use-advising-on-friction | `dev` §3 | 규칙: "재시도 전 friction.log 확인" |
| 3 | post-tool-use-detecting-edit-shapes | `dev` §3 | 규칙: "3회 유사 패치 감지 시 리팩터로 전환" |
| 4 | subagent-stop-verifying-evidence | `pabcd` / `dev` | 서브에이전트 결과 검증 절차를 skill에 명시 |
| 5 | session-start-injecting-project-rules | 제거 only | Codex 네이티브 AGENTS.md 주입과 중복 확인 |
| 6 | session-start-advertising-recall | 제거 only | `recall` implicit으로 대체 |
| 7 | user-prompt-submit-suggesting-recall | 제거 only | 위와 동일 |
| 8 | post-compact-suggesting-recall | 제거 only | 위와 동일 |
| 9 | user-prompt-submit-checking-pabcd-trigger | 제거 only | `pabcd` implicit으로 대체 |

### 작업 순서

1. skill 흡수 대상 (1-4)의 규칙을 `dev` SKILL.md / `pabcd` SKILL.md에 추가
2. Codex 네이티브 AGENTS.md 주입 확인 → (5) 제거 가능 여부 판단
3. plugin.json `hooks` 배열에서 9개 제거
4. hook json 파일 삭제 (또는 `_deprecated/`로 이동)
5. 테스트: 세션 시작, tool call 시 latency 비교

---

## Phase 4 — Dormant Skill Pool (optional, future)

cli-jaw `skills_ref/` 226개를 codexclaw에서 활용하는 경로:

1. `skill-hub/references/external-catalog.md` 생성:
   - `../cli-jaw/skills_ref/registry.json`에서 이름/설명/경로 추출
   - 에이전트가 catalog에서 매칭되는 스킬 발견 시 경로로 직접 읽기
2. 또는 `skills_dormant/` 디렉토리를 plugin `"skills"` 경로 밖에 두기:
   - Codex가 자동 발견하지 않음 (시스템 프롬프트 0 토큰)
   - skill-hub catalog에만 등록 → on-demand 로드

이 phase는 Phase 1-3 완료 후 별도 판단.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Hook 제거 후 discipline miss | Medium | 2주 관찰; miss 발생 시 skill 규칙 강화 또는 hook 복원 |
| implicit 증가로 토큰 비용 상승 | Low | +180 토큰 (무시 가능) |
| friction/edit-shape 기록 누락 | Medium | dev skill 규칙의 STRICT 등급 부여 |
| project-rules 중복 제거 후 miss | Low | Codex 네이티브 AGENTS.md 주입 확인 후에만 제거 |

---

## Success Criteria

- [ ] implicit 7개 (dev + 6) 정상 노출 확인
- [ ] agbrowse가 dev 읽기만으로 인지되는지 확인
- [ ] hook 8개 상태에서 PABCD full cycle 정상 동작
- [ ] tool call latency 체감 개선 (hook node spawn 9회 감소)
- [ ] 2주간 discipline miss 0건
