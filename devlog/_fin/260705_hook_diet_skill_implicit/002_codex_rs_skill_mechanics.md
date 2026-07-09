# 002 — Codex-rs Skill System Internals (source analysis)

- Date: 2026-07-05
- Source: `~/developer/codex/004_skill-system/04_co_skill.md` (reverse-engineered from codex-rs)
- Relevance: implicit 확장 결정의 근거, dormant pool 설계의 기반

---

## Key Findings

### 1. allow_implicit_invocation 기본값은 `true`

```rust
// codex-rs/core/src/skills/loader.rs
struct Policy {
    allow_implicit_invocation: Option<bool>,  // 기본값 true
}
```

codexclaw이 대부분의 스킬을 `false`로 설정한 건 의도적 보수 전략이었지,
Codex 플랫폼의 기본 설계와는 반대. Codex는 스킬이 발견되면 기본적으로
시스템 프롬프트에 메타데이터를 노출하도록 의도함.

### 2. Progressive Disclosure 3단계 (공식 설계)

| 단계 | 내용 | 크기 | 로드 시점 |
|------|------|------|-----------|
| Level 1 — Metadata | name + description | ~100 words | 항상 (implicit=true일 때) |
| Level 2 — SKILL.md body | 전체 본문 | <5k words 권장 | explicit mention 시 |
| Level 3 — Bundled resources | scripts/, references/ | 무제한 | 에이전트가 개별 요청 시 |

**핵심**: implicit은 Level 1만 노출. 본문은 explicit trigger 때만 주입됨.
따라서 implicit=true로 올려도 토큰 비용은 Level 1 (한 줄) × N개뿐.

### 3. Explicit Trigger 메커니즘

두 가지 형태:
- `$skill-name` → name으로 매칭 (unique할 때만)
- `[$skill-name](skill://path/to/SKILL.md)` → path로 정확 매칭

`build_skill_injections()`가 SKILL.md 전체를 읽어서 `<skill>` 태그로 감싸
user message fragment에 주입. 이때만 Level 2 비용 발생.

### 4. Implicit은 "telemetry only" — 자동 본문 주입 아님

implicit path는 에이전트가 스크립트를 실행하거나 SKILL.md를 cat할 때
**감지 + 기록**만 함. 실제 본문 주입은 발생하지 않음.

```rust
// 감지 → emit telemetry only (no injection)
pub(crate) async fn maybe_emit_implicit_skill_invocation(...)
```

따라서 "implicit = 비싸다"는 오해. implicit은 순전히 **발견 가능성** 문제.

### 5. Skill Root 탐색 순서 (scope 우선순위)

```
Repo (cwd .codex/skills, .agents/skills)
  → User ($CODEX_HOME/skills, ~/.agents/skills)
    → Plugin roots
      → System ($CODEX_HOME/skills/.system)
        → Admin (/etc/codex/skills)
```

Plugin root가 User scope에 속함. codexclaw의 `plugins/codexclaw/skills/`가
여기에 해당.

### 6. 렌더링 구조 (render.rs)

`render_skills_section()`이 `<skills_instructions>` 태그를 생성:
```
- {name}: {description} (file: {path})
```

이것이 우리가 시스템 프롬프트에서 보는 한 줄짜리 메타데이터 엔트리.
implicit=true인 스킬만 여기에 나옴.

---

## Implications for Hook Diet Plan

### implicit 확장 근거 강화

- Codex 설계 의도 자체가 "스킬은 기본 implicit" → codexclaw의 false 전략은
  over-conservative였음
- Level 1 비용이 ~30토큰/스킬이므로 6개 추가 = ~180토큰 (무시 가능)
- implicit이 본문 주입을 트리거하지 않으므로 latency 영향 0

### Dormant pool 구현 근거

- Codex의 BFS 탐색은 root당 최대 2000 디렉터리, 깊이 6까지
- plugin "skills" path 밖에 두면 BFS 대상에서 제외됨
- `skill-hub` catalog에만 경로를 기록하면 에이전트가 explicit mention으로
  dormant 스킬의 SKILL.md를 직접 열 수 있음 (Level 2 on-demand)

### Hook vs Skill 분리 근거

- Codex의 skill은 "모델 컨텍스트에 주입되는 지시문 묶음"
- Hook은 Codex 런타임이 기계적으로 실행하는 코드
- Advisory/discipline 규칙은 skill의 역할 (Level 2 지시문)
- Hard gate/캡처는 hook의 역할 (런타임 인터셉트)
- 이 분리가 Phase 3 hook diet의 설계 원칙

---

## config_rules로 enabled/disabled 제어 가능

```toml
# codex.toml 예시
[[skills.config]]
selector = "Name(\"cxc-dev-frontend\")"
enabled = false
```

이건 hard disable (implicit + explicit 모두 차단).
codexclaw은 이걸 쓰지 않고 `allow_implicit_invocation: false`만 씀 →
explicit path는 항상 열려있음. 올바른 전략.
