# 140 — 서브에이전트 role + .toml + 진단/운영

Status: RESEARCH COMPLETE (J6 실측 반영) · work-phase 140

상위: [090_expansion_moc.md](090_expansion_moc.md)

## 목표
omo의 에이전트 role(.toml)·teammode·진단/운영 컴포넌트를 분석해 codexclaw 서브에이전트
role 체계(Pass 5 B-opt2 inline)와 어떻게 맞물릴지 정리한다.

## 조사 대상
### agent role (.toml)
explorer / plan / librarian / metis / momus /
lazycodex-executor / lazycodex-qa-executor / lazycodex-code-reviewer /
lazycodex-gate-reviewer / lazycodex-clone-fidelity-reviewer

### teammode
멀티에이전트 역할 협업 모드.

### 진단/운영
telemetry / lcx-doctor / lcx-report-bug / lcx-contribute-bug-fix /
git-bash / git-bash-mcp / test-support

## J6 조사 산출물 (채울 항목)
### 1) .toml role 스키마 → codex agent role 매핑

**결론:** omo role `.toml`은 Codex agent-role 파일로 거의 그대로 이식 가능하다. 다만 Pass 5
Phase 1은 025의 B-opt2 결정대로 role 파일을 런타임 등록 대상으로 믿지 말고, `.toml`을
source-of-truth로 읽어 `spawn_agent({ message: "TASK: ... + role instructions inline" })`에
주입한다. Phase 2에서 role pickup이 확정되면 `agents/*.toml` 등록으로 전환한다.

근거:
- omo role 파일은 공통적으로 `name`, `description`, `nickname_candidates`, `model`,
  `model_reasoning_effort`, 일부 `service_tier`, `developer_instructions`를 top-level에 둔다.
  예: explorer는 `model = "gpt-5.4-mini"`, `model_reasoning_effort = "low"`,
  `service_tier = "fast"`와 read-only developer instructions를 가진다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml:1-9`).
- Codex는 agent role 파일 파서에서 `name`, `description`, `nickname_candidates`를 role metadata로
  읽고 나머지를 `ConfigToml`로 flatten한다
  (`/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/config/agent_roles.rs:217-225`).
  이후 파싱 시 metadata 3개는 제거하고 남은 TOML을 role config layer로 반환한다
  (`/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/config/agent_roles.rs:295-314`).
- Codex role 적용은 role layer를 session-flag precedence로 삽입한다. role layer에
  `model_provider`/`service_tier`가 없으면 caller의 현재 provider/service tier를 보존한다
  (`/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/agent/role.rs:32-38`,
  `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/agent/role.rs:72-80`).
- per-role `model` override는 실제 테스트로 확인된다. role 파일에 `model = "role-model"`이
  있으면 적용 후 `config.model`이 `role-model`이 된다
  (`/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/agent/role_tests.rs:348-376`).
- spawn-agent tool description도 role 파일의 `model`, `model_reasoning_effort`, `service_tier`를
  “cannot be changed”/우선 적용되는 locked settings로 노출한다
  (`/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/agent/role.rs:250-298`).
- Codex role discovery는 config layer의 `[agents]` 선언과 config folder의 `agents/` 디렉터리를
  모두 본다. 따라서 plugin-provided pickup은 별도 확인이 필요하지만, config-layer pickup 자체는
  구현되어 있다
  (`/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/config/agent_roles.rs:18-23`,
  `/Users/jun/Developer/codex/121_openai-codex/codex-rs/core/src/config/agent_roles.rs:73-80`).

스키마 매핑:

| omo `.toml` 필드 | Codex 매핑 | codexclaw Pass 5 처리 |
|---|---|---|
| `name` | role name. 없으면 선언 key hint 사용 가능 | inline role source id. Phase 2 role file name과 일치 |
| `description` | spawn-agent available roles 설명에 노출. Codex는 description 필수 검증 | role 선택 가이드/GUI 표시문 |
| `nickname_candidates` | Codex `AgentRoleConfig.nickname_candidates` | 선택: UI/로그 표시용 |
| `developer_instructions` | flatten된 `ConfigToml.developer_instructions` | Phase 1 핵심: `message`에 inline 주입 |
| `model` | role layer config. session flag보다 우선 | Phase 1은 default만 사용; Phase 2 multi-model 후보 |
| `model_reasoning_effort` | role layer config + spawn spec locked setting | Phase 2 role별 effort preset |
| `service_tier` | role layer에 있으면 spawn request tier보다 우선 | fast reviewer/explorer 최적화 후보 |
| tool scope | 별도 allowlist 필드 없음. `ConfigToml` flatten이므로 sandbox/MCP 등 config는 이론상 가능 | MVP에서는 instructions로 read-only/write scope 강제. 별도 tool allowlist는 추가하지 않음 |

### 2) omo role → codexclaw Pass 5 inline role 매핑

**권고:** Pass 5 기본 role은 `explorer`, `executor`, `reviewer` 3개로 유지한다. omo의 10개 role은
새 role을 늘리기보다 inline prompt template 변형으로 흡수한다.

| omo role | 관찰된 성격 | codexclaw inline role | 이식 방식 |
|---|---|---|---|
| `explorer` | 로컬 코드베이스 read-only search, absolute path 결과, 병렬 검색 규율 (`explorer.toml:8-75`) | `explorer` | 그대로 핵심 explorer template. 단 `omo sparkshell`, LSP tool명은 Codex-native 도구명으로 치환 |
| `librarian` | 외부 OSS/docs researcher, SHA-pinned GitHub permalink, read-only (`librarian.toml:8-76`) | `explorer` variant | `external_research=true` variant. 120 search 허브와 연결 |
| `plan` | 구현 금지 planner, `.omo/plans/<slug>.md` 작성 (`plan.toml:7-38`) | 보류 / PABCD planner | Pass 5 subagent 기본 role에는 넣지 않음. PABCD Plan phase helper로 흡수 가능 |
| `metis` | pre-planning gap/ambiguity/risk analyst, read-only (`metis.toml:7-64`) | `reviewer` variant | plan-audit reviewer로 흡수 |
| `momus` | plan executability reviewer, OKAY/ITERATE/REJECT (`momus.toml:7-68`) | `reviewer` variant | plan gate reviewer로 흡수 |
| `lazycodex-executor` | smallest correct change, shared worktree guard, artifact evidence (`lazycodex-executor.toml:7-24`) | `executor` | executor 기본 prompt에 scope/evidence discipline 반영 |
| `lazycodex-qa-executor` | real-surface QA, `manualQa` matrix, artifact refs (`lazycodex-qa-executor.toml:7-22`) | `executor` variant | `qa_executor` mode. product edits 금지 unless explicit |
| `lazycodex-code-reviewer` | diff/test/risk code review, slop/overfit check, report artifact (`lazycodex-code-reviewer.toml:7-29`) | `reviewer` | code-review reviewer template |
| `lazycodex-gate-reviewer` | final user-outcome gate, evidence re-audit, APPROVE/REJECT (`lazycodex-gate-reviewer.toml:7-23`) | `reviewer` | final gate reviewer template |
| `lazycodex-clone-fidelity-reviewer` | clone/design-system fidelity, token/live DOM checks (`lazycodex-clone-fidelity-reviewer.toml:7-31`) | `reviewer` variant | frontend/design-specific reviewer. 110 dev-uiux/design refs와 연결 |

### 3) teammode 동작 방식 → 채택 여부

**권고:** MVP Pass 5의 기본 멀티에이전트는 `multi_agent_v1.spawn_agent` 기반 inline subagent로 유지하고,
omo teammode는 “durable team / cross-thread coordination” 확장으로 보류한다. 이유는 teammode가
단순 subagent가 아니라 별도 Codex thread lifecycle, `.omo/teams` 상태, thread title hook,
worktree integration까지 요구해 MVP scope를 크게 넓히기 때문이다.

근거:
- teammode는 “plain subagents”와 “team”을 명확히 구분한다. 완전히 isolated된 작업이나 목표가
  모호한 작업은 plain subagents를 쓰고, 상호 반응/협업이 필요한 경우만 team을 쓰라고 한다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md:14-27`).
- leader는 구현하지 않고 orchestration/verification/integration을 맡으며 code edit은 member에게
  위임한다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md:29-37`).
- team state는 script가 `.omo/teams/{session_id}/team.json`, `guide.md`, `artifacts/`로 관리한다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md:56-81`).
- team member는 `multi_agent_v1.spawn_agent`가 아니라 반드시 `codex_app.create_thread`로 만든
  durable Codex thread여야 한다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md:83-104`).
- worktree 충돌 격리와 merge-commit integration까지 포함한다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md:119-128`).
- 별도 PostToolUse hook은 `create_thread`/`codex_app.create_thread` 뒤 descriptive title 설정을
  추가 context로 강제한다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/teammode/hooks/hooks.json:1-17`,
  `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/teammode/src/codex-hook.ts:39-67`).

codexclaw 채택안:
- **MVP:** `explorer/reviewer/executor` inline role + `spawn_agent`/`wait_agent`만 사용.
- **후속:** “team mode”를 별도 feature flag로 설계. `.codexclaw/teams` 상태, Codex thread tool
  availability check, title hygiene hook, worktree integration이 모두 준비될 때만 활성화.

### 4) 진단/운영 컴포넌트 중 codexclaw doctor/reset(090)에 흡수할 것

**흡수 권장:**
- `lcx-doctor`의 evidence-bound PASS/WARN/FAIL report template과 workflow. 특히 `/tmp`에 최신
  LazyCodex/Codex source를 매번 sync하고, local install/config/plugin payload/runtime probe/drift를
  비교하는 방식은 codexclaw doctor에 직접 유용하다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/lcx-doctor/SKILL.md:12-43`,
  `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/lcx-doctor/SKILL.md:44-69`).
- `lcx-doctor`의 known issue lookup과 debugging handoff. codexclaw doctor도 FAIL을 단순히
  “재설치하세요”로 끝내지 말고 upstream/open issue와 source drift를 연결해야 한다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/lcx-doctor/SKILL.md:70-77`).
- telemetry의 failure behavior 패턴만 선택 흡수: hook failure는 startup을 막지 않고 local JSONL
  diagnostics에만 기록한다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/telemetry/README.md:77-90`).
- `test-support`의 package/hook/MCP/plugin JSON fixture validators는 codexclaw component packaging
  smoke test helper로 재사용 가치가 높다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/test-support/package-smoke-fixture.ts:42-64`,
  `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/test-support/package-smoke-fixture.ts:96-146`).

**흡수 보류 / 별도 후순위:**
- telemetry analytics 자체는 MVP doctor/reset에 넣지 않는다. omo telemetry는 anonymous daily-active
  PostHog event, opt-out env, daily dedupe state를 가진다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/telemetry/README.md:1-6`,
  `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/telemetry/README.md:49-75`).
  codexclaw MVP에는 privacy/consent/endpoint policy가 아직 없으므로 local diagnostics pattern만
  차용한다.
- `lcx-report-bug`/`lcx-contribute-bug-fix`는 doctor/reset의 core가 아니라 follow-up workflow다.
  다만 bug routing template, latest-source comparison, repo ownership decision은 후속
  “report bug / contribute fix” skill로 분리 가치가 있다
  (`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/lcx-report-bug/SKILL.md:1-18`,
  `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/lcx-contribute-bug-fix/SKILL.md:1-23`).

### 5) git-bash / test-support의 Codex 네이티브 대체 가능성

**git-bash:** 대부분 Codex native shell로 대체 가능. omo `git-bash`는 Windows에서 built-in
`exec_command`보다 OMO `git_bash` MCP를 우선 쓰라는 1회 reminder hook이며, PostCompact 때 reminder
marker를 reset한다
(`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/git-bash/hooks/hooks.json:1-29`,
`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/git-bash/src/codex-hook.ts:38-87`).
codexclaw는 Codex runtime의 shell abstraction을 우선 믿고, Windows shell 문제가 실측될 때만
동등 reminder hook을 추가한다. `git-bash-mcp`는 현재 조사 tree에 `dist/cli.js`만 있고 source가
보이지 않아, MVP 설계 근거로 삼기보다 “binary/vendor component”로만 취급한다
(`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/git-bash-mcp/dist/cli.js`).

**test-support:** native 대체보다 “테스트 유틸 흡수”가 맞다. 파일은 JSON schema-ish validator와
fixture reader로 구성되어 package metadata, hooks, MCP, plugin manifest의 shape를 검증한다
(`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/test-support/package-smoke-fixture.ts:5-40`,
`/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/test-support/package-smoke-fixture.ts:88-158`).
codexclaw packaging/doctor smoke tests에 그대로 유사 구조를 두는 것이 Codex native 대체보다 낫다.

## ✅ JUN 결정 반영 (090.1, 2026-06-30)
- **role 등록 방식** (J-8) = **inline-only(B-opt2) 유지**. `spawn_agent({message})`에 role 지시를
  인라인 주입하고 `.toml`은 source-of-truth로만 읽는다. config에 role 설치 안 함(plugin manifest에
  agents 필드 없음 확인됨). first-class 등록은 Phase 2에서 pickup 경로 검증 후로 보류.
- **read-only 강제** (J-9) = **프롬프트-only 수용**. tool allowlist로 강제하지 않고 "read-only"는
  규율 가이드 + 출력 계약(reviewer/Mind는 "수정 금지, 발견만 반환")으로 둔다. codexclaw 신뢰기반 철학 일치.
- **role namespace** (J-14) = ops role(explorer/reviewer/executor)과 Pass 8 `mind-*` role을 **단일
  taxonomy + 접두사**로 통합(`mind-*` vs 기능 role). MVP는 둘 다 inline, Phase 2 GUI에서 first-class 승격.
