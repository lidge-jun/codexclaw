# 001 — Research: cli-jaw dynamic skill loading + Codex skill mechanics

- Date: 2026-07-05
- Method: filesystem read of ../cli-jaw + codexclaw skills + system prompt inspection

---

## cli-jaw 스킬 시스템 구조

### skills_ref/ (dormant pool)

- 위치: `../cli-jaw/skills_ref/` (226개 스킬)
- 구조: `<skill-id>/SKILL.md` + optional `references/`, `scripts/`, `templates/`
- 레지스트리: `skills_ref/registry.json` — 이름, 설명, 카테고리, 요구사항, 설치 명령
- 공개 repo: `lidge-jun/cli-jaw-skills` (GitHub Pages 준비됨)

### registry.json 엔트리 예시

```json
{
  "1password": {
    "name": "1Password",
    "emoji": "🔐",
    "category": "utility",
    "description": "1Password CLI로 비밀번호·문서·OTP 조회.",
    "requires": { "bins": ["op"] },
    "install": "brew install 1password-cli"
  }
}
```

### 프롬프트 주입 패턴 (src/prompt/templates/skills.md)

```
### Active Skills ({{ACTIVE_SKILLS_COUNT}})
[매 턴 주입 — 설치된 스킬의 full context]

### Available Skills ({{REF_SKILLS_COUNT}})
These are reference skills — not active yet, but ready to use on demand.
How to use: read `{{JAW_HOME}}/skills_ref/<name>/SKILL.md`
To activate permanently: `cli-jaw skill install <name>`
```

핵심 인사이트: Available Skills 섹션은 **이름 목록만** 보여주고,
에이전트가 필요할 때 SKILL.md를 직접 읽는 구조.

### 런타임 레이어 (TypeScript)

- `src/core/skill-cache.ts`: SkillCommandEntry 캐시 (id, name, description, content)
- `src/cli/handlers-skill-invoke.ts`: `/skill:<id>` 슬래시 커맨드 → SKILL.md를 steerPrompt로 주입
- `src/prompt/builder.ts` (806L): getSystemPrompt()에서 동적 조립

---

## Codex 플랫폼 스킬 메커니즘 (실측)

### 시스템 프롬프트에 노출되는 것

`<skills_instructions>` 블록 안에 implicit=true인 스킬만 한 줄씩:
```
- codexclaw:cxc-dev: MUST USE for every coding task — classifies work depth...
  (file: /path/to/SKILL.md)
```

= 이름 + description + 파일 경로. SKILL.md 본문은 포함되지 않음.
에이전트가 태스크에 매칭한다고 판단하면 경로를 열어서 읽는 방식.

### allow_implicit_invocation 역할

- `true`: `<skills_instructions>`에 메타데이터 자동 노출
- `false`: 자동 노출 안 됨, `$name` 멘션이나 경로 직접 참조로만 로드
- `enabled: false` (config level): 양쪽 다 차단 (hard disable)

### codexclaw 현재 상태

- 23개 스킬 중 implicit은 `dev` 1개만
- 나머지 22개는 `skill-hub` catalog를 통해 on-demand 라우팅
- `skill-hub/references/catalog.md`가 레지스트리 역할 (이름, 경로, 카테고리, load_when)

---

## 핵심 결론

1. **동적 로딩은 이미 가능하고, codexclaw이 하고 있음** — 런타임 없이 문서 레이어로.
2. **cli-jaw와의 차이는 런타임 유무가 아니라 노출 범위** — cli-jaw는 Available Skills
   목록을 매 턴 프롬프트에 넣고, codexclaw은 skill-hub를 명시 로드해야만 catalog가 보임.
3. **implicit 확장으로 격차 해소 가능** — 자주 쓰이는 스킬 6개를 implicit으로 올리면
   에이전트가 존재를 인지하고 on-demand로 SKILL.md를 읽는 흐름이 완성됨.
4. **cli-jaw skills_ref/ 226개를 외부 dormant pool로 참조 가능** — plugin "skills" 경로
   밖에 두면 Codex가 발견하지 않고, skill-hub catalog에 경로만 등록하면 됨.

---

## agbrowse 상태

- 설치됨: `/Users/jun/.local/bin/agbrowse`
- helper: `plugins/codexclaw/skills/search/scripts/agbrowse_helper.py`
  - lazy resolve: $CODEXCLAW_AGBROWSE_PATH → PATH → adjacent checkout → install hint
- 현재 언급 위치: `search` SKILL.md (Tier 2 ladder) + `ultraresearch` SKILL.md
- 문제: search가 implicit-off이므로 에이전트가 agbrowse 존재를 인지 못함
- 해법: `dev`에 한 줄 광고 + `search` implicit으로 승격

---

## Hook 분석 요약

17개 hook 전수 조사 결과:
- Hard gate (에이전트가 "안 하겠다"해도 강제): 6개
- 기계적 캡처/자동 주입 (신뢰성 필수): 2개
- Advisory/discipline (skill 규칙으로 대체 가능): 9개

Advisory hook은 매 tool call마다 node 프로세스를 spawn하여 latency를 유발하지만,
실제로는 "에이전트에게 조언을 주입하는" 역할만 수행. 이는 skill 문서의 규칙으로
동일한 효과를 낼 수 있음 (토큰 비용 약간 상승 vs 실행 latency 제거 trade-off).
