# 003 — cli-jaw vs codexclaw: Dynamic Skill Loading Comparison

- Date: 2026-07-05
- Purpose: dormant pool 구현 시 cli-jaw 패턴을 어디까지 따를지 결정

---

## 구조 비교

| 축 | cli-jaw | codexclaw |
|----|---------|-----------|
| 런타임 | TypeScript 서버 (builder.ts 806L) | 없음 (Codex 플랫폼 의존) |
| 프롬프트 조립 | `getSystemPrompt()` 동적 렌더링 | Codex `render_skills_section()` + skill-hub 문서 |
| 레지스트리 | `skills_ref/registry.json` (226 entries) | `skill-hub/references/catalog.md` (23 entries) |
| 활성/비활성 구분 | Active Skills / Available Skills 2섹션 | implicit (dev) / on-demand (나머지) |
| 동적 로딩 | 에이전트가 `skills_ref/<name>/SKILL.md` 읽기 | 에이전트가 `$name` 멘션 또는 path 열기 |
| 설치 명령 | `cli-jaw skill install <name>` | 해당 없음 (파일시스템에 두면 끝) |
| 슬래시 커맨드 | `/skill:<id>` → steerPrompt 주입 | 없음 (Codex에 슬래시 커맨드 없음) |

## 핵심 차이점

1. **cli-jaw는 Available Skills 목록을 매 턴 프롬프트에 넣는다**
   - 226개 이름이 항상 보임 → 에이전트가 "이런 게 있구나" 인지
   - codexclaw은 skill-hub를 명시 로드해야만 catalog가 보임

2. **cli-jaw는 설치/활성화 개념이 분리되어 있다**
   - `skill install` → Active Skills로 승격 (매 턴 full context 주입)
   - codexclaw은 plugin skills/ 안에 있으면 자동 발견 (implicit/explicit 제어만)

3. **cli-jaw는 서버가 프롬프트를 조립한다**
   - Available Skills 섹션의 스킬 수, 내용을 런타임에서 제어
   - codexclaw은 Codex 플랫폼의 `render_skills_section()` + 문서 레이어만 사용

## codexclaw에서 cli-jaw 패턴을 재현하는 방법

### Option A: skill-hub implicit + catalog 확장 (추천)

1. `skill-hub`를 implicit으로 올림 → 에이전트가 매 턴 "catalog router가 있다"를 인지
2. `skill-hub/references/catalog.md`에 외부 스킬 풀 경로 추가
3. 에이전트가 필요할 때 catalog 읽기 → 매칭되는 스킬 SKILL.md를 열기

토큰 비용: skill-hub 메타데이터 1줄 (~30토큰) 상시 + catalog 읽기 시 ~200토큰

**이것이 cli-jaw의 "Available Skills" 섹션과 동등한 효과를 문서 레이어로 달성하는 방법.**

### Option B: dev skill에 routing table 확장

`dev` SKILL.md의 surface routing table에 외부 스킬도 포함:
```
| Surface | Skill | Path |
| golang patterns | ext:golang-patterns | ../cli-jaw/skills_ref/golang-patterns/SKILL.md |
```

문제: dev가 이미 길어서 Level 2 비용 증가.

### Option C: external-catalog.md를 별도 skill로 만들기

`skills/external-catalog/SKILL.md`를 implicit으로:
- description: "226 reference skills from cli-jaw are available for on-demand use"
- 본문: registry.json에서 이름/설명/경로만 추출한 축약 catalog

문제: Level 1은 작지만, Level 2 (226개 목록)가 ~2000 토큰.
에이전트가 매번 이걸 열면 비효율.

### 결론: Option A 채택

- 최소 침습
- 이미 존재하는 skill-hub 구조 재사용
- Phase 1 (implicit 확장)에서 skill-hub를 implicit으로 올리면 자동 해결
- Phase 4에서 catalog.md에 external 섹션 추가하면 완성

---

## Dormant Pool 경로 선택지

| 경로 | 장점 | 단점 |
|------|------|------|
| `../cli-jaw/skills_ref/` 직접 참조 | 즉시 226개 사용 가능 | 상대 경로 의존, 이동 시 깨짐 |
| `plugins/codexclaw/skills_dormant/` | plugin 안에 정리됨 | 필요한 것만 복사해야 함 |
| `~/.codex/skills_dormant/` | user scope | plugin과 분리됨 |
| symlink to cli-jaw skills_ref | 두 장점 결합 | symlink 관리 |

**1차 결정**: `../cli-jaw/skills_ref/` 직접 참조.
이유: 이미 동일 머신에 공존, catalog에 절대 경로 기록하면 깨지지 않음.
나중에 독립 배포가 필요하면 복사본 또는 git submodule로 전환.

---

## 참고: cli-jaw registry.json 스키마

```json
{
  "skills": {
    "<skill-id>": {
      "name": "Display Name",
      "name_ko": "한국어 이름",
      "emoji": "🔐",
      "category": "utility|devtools|media|office|...",
      "description": "English description",
      "desc_ko": "한국어 설명",
      "requires": { "bins": ["binary-name"] } | null,
      "install": "brew install ..." | null,
      "version": "1.0.0"
    }
  }
}
```

codexclaw catalog에서 이 스키마를 참조할 때는 `category` + `description` +
경로만 있으면 충분. `requires`, `install`은 에이전트가 SKILL.md 본문에서 확인.
