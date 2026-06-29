# 100 — skill_hub 아키텍처

Status: RESEARCHED (J2) · work-phase 100

상위: [090_expansion_moc.md](090_expansion_moc.md)

## 목표 (jun 확정)
openclaw류로 skill_hub를 만들어 codex가 알아서 스킬을 골라 쓰게 한다.
**기본 트리거는 dev 스킬만 활성화** — 나머지는 hub에 등록되어 필요 시 codex가 선택.

## J2 조사 산출물

### 결론
- Codex의 스킬 선택은 별도 “hub 엔진”이 아니라 **로딩된 `SkillMetadata` 목록을 매 turn developer context에 렌더링하고, 모델이 `description`/명시 `$skill`을 보고 선택하는 방식**이다. 따라서 skill_hub는 런타임 코드가 아니라 **노출량을 줄인 라우터 스킬 + `policy.allow_implicit_invocation`/`skills.config` 활성 제어**로 설계한다.
- “기본 트리거 = dev 스킬만 활성”은 두 층으로 구현한다. (1) dev 계열만 implicit 허용/모델-visible 목록에 유지, (2) 나머지는 hub 스킬 안의 카탈로그와 `references/`로 보관하고 사용자가 명시하거나 hub가 필요성을 판단할 때만 읽게 한다.
- 현재 확인한 codex-rs에는 `diagram-html`, `mermaid`, `chart-json` 같은 네이티브 구조 렌더러가 없다. TUI는 Markdown/table 렌더러 중심이며 SVG 이미지는 local image attachment에서 unsupported로 처리된다. 그러므로 diagram/html 기능은 codexclaw에서 필요하면 별도 on-demand skill로 남긴다.

### 1. Codex 스킬 발견/스키마 실측
- 발견 root: `plugin_skill_roots`가 `SkillRoot { scope: User, plugin_id, plugin_root }`로 추가되고, repo `.agents/skills`도 project root부터 cwd까지 탐색된다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/loader.rs:253`, `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/loader.rs:361`.
- 스캔 방식: 각 root 아래를 BFS로 훑고, 숨김 경로는 건너뛰며, 파일명이 정확히 `SKILL.md`인 파일만 파싱한다. root 대비 최대 depth는 6, directory limit은 2000이다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/loader.rs:520`, `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/loader.rs:594`.
- `SKILL.md` frontmatter는 `name`, `description`, `metadata.short-description`만 읽는다. `name`이 없으면 parent directory name으로 fallback하고, `description`은 single-line sanitize 후 `SkillMetadata.description`이 된다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/loader.rs:638`, 기존 정리 `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/260629_codexclaw_mvp/021.1_codex_rs_skill_mechanism.md:9`.
- plugin skill은 namespace가 붙는다. `plugin_namespace_for_skill_path()`가 성공하면 `namespace:base_name` 형태가 된다. 현재 세션의 `plugin-creator`, `skill-creator`, `skill-installer`처럼 bundled/system skill은 namespace 없이 보이고, plugin skill은 `plugin_name:skill` 형태로 보일 수 있다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/loader.rs:699`.
- optional metadata는 skill directory의 `agents/openai.yaml`에서만 읽고, frontmatter가 아니다. 읽는 섹션은 `interface`, `dependencies`, `policy`이며 `policy.allow_implicit_invocation`이 여기 들어간다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/loader.rs:710`, `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/loader.rs:836`.

### 2. 항상 노출 vs 필요 시 선택 메커니즘
- Codex에는 “always active”라는 별도 manifest 플래그가 없다. 모델-visible 목록은 `outcome.allowed_skills_for_implicit_invocation()`만 대상으로 렌더링된다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/render.rs:160`.
- `allow_implicit_invocation` 기본값은 `true`다. 즉 `agents/openai.yaml`에서 `policy.allow_implicit_invocation: false`를 명시하지 않으면 해당 스킬은 자동 라우팅 후보가 된다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/model.rs:25`.
- per-skill enable/disable은 user/session layer의 `[[skills.config]]`에서 `name` 또는 `path` selector로 처리한다. 비활성 path는 모델-visible 목록과 implicit invocation에서 빠진다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/config/src/skills_config.rs:24`, `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/config_rules.rs:18`.
- turn prompt에는 `<skills_instructions>` developer block으로 “name + description + path” 목록이 들어가고, 사용 규칙은 “사용자가 `$SkillName`을 언급하거나 task가 description과 명확히 매칭되면 그 skill을 사용”이라고 명시된다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/render.rs:21`, `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/session/mod.rs:2738`.
- 명시 mention은 별도 수집된다. turn build에서 explicit skill mention을 수집하고, 선택된 skill body를 주입한다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/session/turn.rs:512`.

### 2.1 ⭐ "감지 안 됨 + grep으로 발견" 2-경로 분리 (jun 요청 실측, 2026-06-30)
jun의 요구 — "자동 감지는 안 되다가 grep해서 이름으로 파악 가능하게" — 가 codex 네이티브로 성립함을 소스에서 직접 확정했다. 핵심은 **두 주입 경로가 서로 다른 게이트를 쓴다**는 것:

- **경로 1 (implicit, 항상-뜨는 목록)**: `build_available_skills()`가 `outcome.allowed_skills_for_implicit_invocation()`만 렌더링한다. 이 집합은 `is_skill_enabled() && allow_implicit_invocation()`로 필터된다. 따라서 `allow_implicit_invocation: false`인 스킬은 **`<skills_instructions>` 자동 목록에서 빠진다 = 감지 안 됨**. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/render.rs:165`, `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/model.rs:105`.
- **경로 2 (explicit mention)**: `select_skills_from_mentions()`는 후보를 거를 때 **`disabled_paths`와 중복(`seen_paths`)만 검사하고 `allow_implicit_invocation`은 검사하지 않는다**. 즉 이름(`$skill-name`) 또는 SKILL.md 경로로 명시 멘션되면 implicit가 false여도 선택·주입된다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-skills/src/injection.rs:322`.
- **결론**: `allow_implicit_invocation: false` = "자동 목록에서 사라지지만 이름을 알면(grep로 찾으면) 명시 호출로 살아남음". 디스크의 `SKILL.md`는 `rg`/`read`로 항상 접근 가능하므로, grep로 이름을 얻은 뒤 명시 호출하면 주입된다. **cli-jaw의 폴더분리(skills_ref 숨김 / skills 활성)와 동일한 효과를 codex는 frontmatter-인접 토글 한 줄로 달성.**

**축 구분(중요)** — 두 개념을 혼동하면 안 됨:
- `disabled`(`[[skills.config]] enabled=false` / `disabled_paths`): **두 경로 모두 차단**. implicit 목록에서도, 명시 멘션에서도 빠짐 = 완전 비활성.
- `allow_implicit_invocation: false`: **경로 1만 차단**. 명시 멘션(경로 2)은 통과 = grep-only 발견.
- codexclaw skill-hub가 원하는 것은 후자(implicit-off)이지 전자(disabled)가 아니다. on-demand 스킬을 `disabled`로 두면 grep로 찾아도 호출 불가가 되므로 설계 의도와 어긋난다.

**policy 위치 정정** — `policy.allow_implicit_invocation`는 `SKILL.md` frontmatter가 아니라 skill 디렉토리의 `agents/openai.yaml`에서 읽힌다(loader.rs:710,836). 본 문서 §5의 `agents/openai.yaml` 예시가 정본이며, frontmatter에는 `name`/`description`/`metadata.short-description`만 둔다.

### 3. plugin.json skills 연결
- Codex plugin manifest의 `skills` 필드는 plugin root 기준 `./`로 시작하는 상대 경로여야 한다. 해당 경로는 absolute path로 resolve된다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-plugins/src/manifest.rs:235`, `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-plugins/src/manifest.rs:397`.
- 기본 `skills/`와 custom skill path가 함께 skill roots로 들어갈 수 있다. 테스트상 `"skills": "./custom-skills/"`이면 `custom-skills`와 기본 `skills`가 모두 root에 잡힌다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core-plugins/src/manager_tests.rs:641`.
- OMO 실례는 `.codex-plugin/plugin.json`에서 `"skills": "./skills/"`를 선언하고, 각 `skills/<name>/SKILL.md`가 trigger-heavy `description`을 제공한다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/.codex-plugin/plugin.json:21`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/programming/SKILL.md:1`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/frontend/SKILL.md:1`.

### 4. OpenClaw/ClawHub류 hub 패턴
- OpenClaw 공식 문서는 skill을 `SKILL.md` frontmatter + markdown body로 정의하고, root 아래 어디든 `SKILL.md`가 있으면 발견한다고 설명한다. 설치형 registry인 ClawHub는 `SKILL.md`와 supporting files를 버전 관리하는 public registry다. 근거: `https://docs.openclaw.ai/tools/skills.md`, `https://docs.openclaw.ai/clawhub.md`.
- OpenClaw는 agent allowlist로 agent별 skill visibility를 제한한다. Codex에는 동일한 agent allowlist가 없으므로 codexclaw는 (a) `policy.allow_implicit_invocation`, (b) `skills.config` name/path disable, (c) hub skill 내부 카탈로그를 조합해 유사 효과를 만든다.
- OMO의 패턴은 “하나의 plugin namespace + 많은 trigger-rich skills”이다. codexclaw의 목표가 “dev 기본 활성 + 나머지 on-demand”라면 OMO처럼 모든 skill을 개별 implicit 후보로 열어두면 context budget과 과잉-trigger 문제가 생긴다. hub는 이 점을 완화하는 라우터 레이어다.

### 5. codexclaw skill_hub 설계

#### 디렉토리 구조
```text
plugins/codexclaw/
  .codex-plugin/plugin.json
  skills/
    dev/SKILL.md
    dev/agents/openai.yaml
    dev-architecture/SKILL.md
    dev-architecture/agents/openai.yaml
    dev-backend/SKILL.md
    dev-backend/agents/openai.yaml
    ...
    skill-hub/SKILL.md
    skill-hub/agents/openai.yaml
    skill-hub/references/catalog.md
    skill-hub/references/renderers.md
    on-demand/
      diagram/SKILL.md
      diagram/agents/openai.yaml
      pptx/SKILL.md
      pdf/SKILL.md
      xlsx/SKILL.md
      browser/SKILL.md
```

#### plugin manifest
```json
{
  "name": "codexclaw",
  "version": "0.1.0",
  "description": "cli-jaw-style development discipline and multi-model subagents for OpenAI Codex.",
  "skills": "./skills/",
  "hooks": [
    "./hooks/session-start.json",
    "./hooks/user-prompt-submit.json",
    "./hooks/stop.json"
  ],
  "interface": {
    "displayName": "codexclaw",
    "shortDescription": "Dev discipline, PABCD workflow, and on-demand skill hub for Codex",
    "category": "Developer Tools",
    "capabilities": ["Skills", "Hooks", "Workflow"]
  }
}
```

#### skill policy
- **Implicit-visible 기본값**: `dev`, `dev-debugging`, `dev-testing`, `dev-code-reviewer`, `dev-architecture`, `dev-frontend`, `dev-backend`, `dev-security`, `dev-data`, `dev-devops`, `dev-scaffolding`, `dev-pabcd`, `skill-hub`.
- **On-demand 기본값**: 문서/미디어/브라우저/검색/telegram/diagram/pptx/pdf/xlsx/video 등은 `agents/openai.yaml`에 `policy.allow_implicit_invocation: false`를 둔다. 단, explicit `$diagram` 또는 `@.../SKILL.md` mention으로 직접 주입할 수는 남긴다.
- **Hub 역할**: `skill-hub`는 implicit 허용하되 `description`을 “사용자가 dev 외 capability를 찾거나, 파일 형식/매체/외부 도구 작업이 필요한데 직접 skill을 명명하지 않았을 때 catalog를 읽고 필요한 skill을 명시 로드하라”로 제한한다.
- **Dev trigger 최소화**: `dev`는 “모든 개발 작업 시작 전 기본 discipline”으로 넓게 두고, role-specific dev skill들은 각각 change surface에만 매칭되도록 description을 유지한다. 이것이 “기본 트리거는 dev만 활성”의 실질 구현이다.

#### `agents/openai.yaml` 예시
```yaml
# skills/dev/agents/openai.yaml
policy:
  allow_implicit_invocation: true
interface:
  display_name: "Dev"
  short_description: "Default development discipline for Codex"
```

```yaml
# skills/on-demand/diagram/agents/openai.yaml
policy:
  allow_implicit_invocation: false
interface:
  display_name: "Diagram"
  short_description: "On-demand SVG/Mermaid/HTML diagram guidance"
```

#### `skill-hub/SKILL.md` frontmatter
```yaml
---
name: skill-hub
description: "Use when a task needs a non-default codexclaw capability not covered by the dev skills, or when the user asks what skills/tools are available. Read references/catalog.md, choose the smallest matching on-demand skill, then explicitly load/read that skill. Do not self-activate for ordinary coding tasks already covered by dev."
metadata:
  short-description: "Router for codexclaw on-demand skills"
---
```

#### `skill-hub/references/catalog.md` schema
```yaml
version: 1
default_implicit:
  - dev
  - dev-architecture
  - dev-backend
  - dev-code-reviewer
  - dev-data
  - dev-debugging
  - dev-devops
  - dev-frontend
  - dev-pabcd
  - dev-scaffolding
  - dev-security
  - dev-testing
  - skill-hub
on_demand:
  - name: diagram
    path: skills/on-demand/diagram/SKILL.md
    load_when:
      - "diagram / chart / graph / visualize / SVG / Mermaid / HTML rendering"
    native_codex_gap: "No diagram-html/mermaid/chart-json native renderer found in codex-rs."
  - name: pdf
    path: skills/on-demand/pdf/SKILL.md
    load_when:
      - "read/create/edit/review PDF files"
  - name: xlsx
    path: skills/on-demand/xlsx/SKILL.md
    load_when:
      - "spreadsheet, Excel, CSV analysis, formulas, charts"
```

### 6. diagram/html native renderer 판정
- 로컬 codex-rs 검색에서 `diagram-html`, `mermaid`, `chart-json`, `compose-block` 네이티브 renderer는 발견되지 않았다. 확인 명령: `rg -n "diagram-html|mermaid|chart-json|compose-block|structured-render" core tui app-server protocol`.
- TUI renderer는 Markdown event를 `ratatui` line으로 바꾸는 low-level renderer이며 table/wrapping/file-link 처리가 중심이다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/tui/src/markdown_render.rs:1`.
- SVG는 local image attachment에서 `unsupported image/svg+xml`로 처리되는 테스트가 있다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/protocol/src/models.rs:3008`.
- 결론: diagram/html 렌더가 필요한 경우 Codex native 기능에 기대지 말고, codexclaw `diagram` on-demand skill을 유지한다. 다만 기본 implicit 후보에는 넣지 않는다.

### 6.5 웹 교차검증 — codex 스킬 동적 로딩 (jun 요청)
J2의 codex-rs 소스 판독을 OpenAI 공식 문서로 교차검증했고 1:1 일치한다 (web search, 2026-06-30):
- **동적 발견 가능**: codex는 새로 설치된 skill을 자동 감지한다(미표시 시 codex 재시작). skill = `SKILL.md`를 가진 폴더. 근거: `https://developers.openai.com/codex/skills`.
- **`allow_implicit_invocation`**: `agents/openai.yaml`에 위치, 기본값 `true`. `false`면 implicit 자동 트리거에서 빠지지만 explicit `$skill` 호출은 유지. (J2 §2 model.rs:25와 일치)
- **`skills.config` (config.toml)**: per-skill enable/disable selector. `path`/`name` 지정 + `enabled = false`로 삭제 없이 비활성. 근거: `https://developers.openai.com/codex/config-reference`. (J2 §2 skills_config.rs:24와 일치)
- **플러그인 = 권장 배포 경로**: skills + app + MCP를 번들. 근거: `https://developers.openai.com/codex/plugins`.
- 판정: "기본 트리거 = dev만 활성"은 런타임 hub 엔진 없이 (1) dev 계열 `allow_implicit_invocation: true`, (2) 나머지 on-demand `false` + `skill-hub` 라우터, (3) optional `skills.config` override 조합으로 100% 달성 가능. 웹·소스 양쪽 확인 완료.

### 구현 체크리스트
- `plugins/codexclaw/.codex-plugin/plugin.json`에 `"skills": "./skills/"` 유지.
- dev 계열과 `skill-hub`에는 `agents/openai.yaml policy.allow_implicit_invocation: true`.
- on-demand 계열에는 `policy.allow_implicit_invocation: false`.
- `skill-hub/references/catalog.md`를 생성해 on-demand skill의 trigger, path, load policy, native gap을 중앙 등록.
- README/설치 문서에 optional 사용자 override 예시 추가:
  ```toml
  [[skills.config]]
  name = "codexclaw:diagram"
  enabled = true
  ```
- 변환 시 frontmatter에는 `name`, `description`, `metadata.short-description`만 넣고, `keywords/search_terms/default_prompt`는 frontmatter에 넣지 않는다.

## ✅ JUN 결정 반영 (090.1, 2026-06-30)
- **기본 implicit 노출 집합** (J-6) = `dev` + `search` + `pdf`만 `allow_implicit_invocation:true`.
  나머지 dev-* router 및 모든 on-demand 스킬은 `false`(off) + skill-hub 라우터로 발견.
  - `search`는 lazycodex(omo) 컨벤션대로 노출(120 search-hub와 연결).
  - `pdf`(읽기/리뷰)는 codex 표준 스킬 형태로 노출.
- **skill-hub 부트스트랩** (J-11) = `skill-hub`는 implicit-visible **필수 노출**. 그 description이
  "dev/search/pdf 외 역량은 여기 catalog를 읽고 grep으로 on-demand 스킬을 찾아 명시 호출하라"는
  진입점 역할. 즉 grep-only 발견의 포인터를 skill-hub가 항상 제공(포인터 없는 발견 가정 폐기).
- 셋의 정합: 100/110/STATUS 3자 불일치(H4)는 "구현(Pass4) 기준 = dev만 implicit"에 search/pdf를
  추가한 형태로 통일. role별 dev-* router는 off 유지.
