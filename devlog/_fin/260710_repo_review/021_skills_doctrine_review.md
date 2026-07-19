# 021 - Skills/structure 독트린 일관성 검토 (사이클 2)

## 1. 검토 범위

B 시점에 `ls -1d plugins/codexclaw/skills/*/`와 `ls -1 structure/*.md`를 다시 실행했다.
skills 디렉터리는 27개, structure 문서는 8개다. `plugins/codexclaw/agents/*.toml`은
LEAF-TOPOLOGY 문구 대조에만 사용했다.

| # | skill 디렉터리 | 상태 |
|---:|---|---|
| 1 | `ast-grep/` | 활성 |
| 2 | `dev/` | 활성 |
| 3 | `dev-architecture/` | 활성 |
| 4 | `dev-backend/` | 활성 |
| 5 | `dev-code-reviewer/` | 활성 |
| 6 | `dev-data/` | 활성 |
| 7 | `dev-debugging/` | 활성 |
| 8 | `dev-devops/` | 활성 |
| 9 | `dev-frontend/` | 활성 |
| 10 | `dev-scaffolding/` | 활성 |
| 11 | `dev-security/` | 활성 |
| 12 | `dev-testing/` | 활성 |
| 13 | `dev-uiux-design/` | 활성 |
| 14 | `goalplan/` | deprecated, `cxc-loop` redirect |
| 15 | `interview/` | 활성 |
| 16 | `kwrite/` | 활성 |
| 17 | `loop/` | 활성 |
| 18 | `orchestrate/` | 활성 |
| 19 | `pabcd/` | 활성 |
| 20 | `qa/` | 활성 |
| 21 | `recall/` | 활성 |
| 22 | `remote/` | 활성 |
| 23 | `repo-map/` | 활성 |
| 24 | `search/` | 활성 |
| 25 | `skill-hub/` | deprecated, `cxc-dev` redirect |
| 26 | `lunasearch/` | 활성 |
| 27 | `ultraresearch/` | deprecated, `cxc-search` redirect |

| # | structure 문서 |
|---:|---|
| 1 | `structure/00_philosophy.md` |
| 2 | `structure/10_subagent_skill_routing.md` |
| 3 | `structure/20_pabcd_dispatch_doctrine.md` |
| 4 | `structure/30_contradiction_register.md` |
| 5 | `structure/40_enforcement_methods.md` |
| 6 | `structure/50_emergence_gap.md` |
| 7 | `structure/60_native_capabilities.md` |
| 8 | `structure/INDEX.md` |

deprecated 상태는 각 stub frontmatter의 `deprecated: true`와 redirect로 확인했다:
`goalplan`(`plugins/codexclaw/skills/goalplan/SKILL.md:2-6`),
`skill-hub`(`plugins/codexclaw/skills/skill-hub/SKILL.md:2-6`),
`ultraresearch`(`plugins/codexclaw/skills/ultraresearch/SKILL.md:2-6`).

## 2. 규칙 ID 교차표

| 규칙 ID | skills/agents 선언 | structure 선언 | 판정 |
|---|---|---|---|
| `AUDIT-LOOP-01` | `plugins/codexclaw/skills/pabcd/SKILL.md:71`, `plugins/codexclaw/skills/pabcd/SKILL.md:133`; `plugins/codexclaw/skills/loop/SKILL.md:282-284`; `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:106-111`; `plugins/codexclaw/skills/search/SKILL.md:189-193` | `structure/20_pabcd_dispatch_doctrine.md:73-78` | **괴리.** structure는 reviewer dispatch를 구조적으로 보장한다고 쓰지만 PABCD는 provenance를 검증할 수 없는 form-only bar라고 명시한다. |
| `DEV-ROUTE-01` | `plugins/codexclaw/skills/dev/SKILL.md:133-145` | `structure/30_contradiction_register.md:33` | 일치. main agent의 STRICT MUST-READ와 subagent attachment를 같은 해법으로 기록한다. |
| `DISPATCH-ACTOR-01` | `plugins/codexclaw/skills/pabcd/SKILL.md:133`; `plugins/codexclaw/skills/loop/SKILL.md:285-292`; `plugins/codexclaw/skills/qa/SKILL.md:128-130` | `structure/20_pabcd_dispatch_doctrine.md:122-133`; `structure/10_subagent_skill_routing.md:170-173` | 의미 일치. 같은 문맥의 수정 라운드는 기존 agent를 재사용하고 최종 독립 gate는 fresh reviewer를 쓴다. |
| `DISPATCH-RETIRE-01` | `plugins/codexclaw/skills/loop/SKILL.md:118-119`, `plugins/codexclaw/skills/loop/SKILL.md:290-292` | `structure/20_pabcd_dispatch_doctrine.md:134-143`; `structure/10_subagent_skill_routing.md:172` | 본문 의미는 일치. structure/10의 `RETIRE-01` 축약은 규칙 ID 오기다. |
| `LEAF-TOPOLOGY-01` | `plugins/codexclaw/skills/pabcd/SKILL.md:409`; `plugins/codexclaw/agents/executor.toml:13-14`; `plugins/codexclaw/agents/reviewer.toml:13-14`; `plugins/codexclaw/agents/explorer.toml:14-15` | `structure/20_pabcd_dispatch_doctrine.md:111-120` | skill과 structure의 leaf 원칙은 일치. agents는 허용 token이 원래 dispatch task에 있어야 한다고 읽히지만 canonical은 child의 outgoing spawn message를 요구한다. |
| `LOOP-REPAIR-01` | `plugins/codexclaw/skills/pabcd/SKILL.md:376-381`; `plugins/codexclaw/skills/loop/SKILL.md:265-284` | `structure/20_pabcd_dispatch_doctrine.md:134-143` | skills 간 일치. structure는 dispatch retirement의 유사 규칙으로만 참조해 정의 전체를 소유하지 않는다. |
| `QA-TOOL-LADDER-01` | `plugins/codexclaw/skills/dev-testing/SKILL.md:230-252`; `plugins/codexclaw/skills/qa/SKILL.md:26-28` | `structure/60_native_capabilities.md:101-105` | 일치. built surface QA는 in-app browser가 첫 rung이다. |
| `SEARCH-BROWSE-01` | `plugins/codexclaw/skills/search/SKILL.md:65-93` | `structure/60_native_capabilities.md:101-105` | 일치. public-web proof는 agbrowse 우선이다. |
| `DISPATCH-TASK-01` | `plugins/codexclaw/skills/pabcd/SKILL.md:439-446`; `plugins/codexclaw/skills/qa/SKILL.md:112-115` | `structure/20_pabcd_dispatch_doctrine.md:104-110`, `structure/20_pabcd_dispatch_doctrine.md:175` | **부분 누락.** structure는 plan/context 전달만 적고 6요소 packet 계약은 싣지 않는다. |
| `LOOP-CONTINUE-01` | `plugins/codexclaw/skills/loop/SKILL.md:100-104`, `plugins/codexclaw/skills/loop/SKILL.md:217-225`; `plugins/codexclaw/skills/pabcd/SKILL.md:389-394` | 규칙 ID 없음 | skills-only. structure에 같은 ID의 독립 선언은 없다. |
| `SESSION-IDENTITY-01` | `plugins/codexclaw/skills/pabcd/SKILL.md:98-106`; `plugins/codexclaw/skills/loop/SKILL.md:16-21` | ID 없음. fork 완화책만 `structure/60_native_capabilities.md:113-117`에 있다. | skills-only. 동작 위험은 structure에 있으나 규칙 이름과 사용자 의무가 빠져 있다. |

## 3. canonical 소유 검증

canonical 소유 선언과 실제 현행 문구를 맞춰 본 결과 불일치는 2건이다.

### 3.1 implicit-visible 집합

skills canonical은 `{dev, search, interview, pabcd, recall, loop, dev-frontend,
dev-uiux-design}` 8개다
(`plugins/codexclaw/skills/dev/SKILL.md:177`). 2026-07-09에 추가된 두 frontend skill의
metadata도 `allow_implicit_invocation: true`다
(`plugins/codexclaw/skills/dev-frontend/agents/openai.yaml:5`,
`plugins/codexclaw/skills/dev-uiux-design/agents/openai.yaml:5`).

`structure/INDEX.md:138`은 6개 집합만 적고 모든 `dev-*`를 on-demand로 분류한다.
`structure/20_pabcd_dispatch_doctrine.md:162-168`도 6개 옛 집합에 deprecated `skill-hub`를
포함한다. canonical 선언이 structure 두 곳에 전파되지 않았다.

### 3.2 native surface owner 표

`structure/60_native_capabilities.md:14-16`은 native surface와 owning skill의 단일 inventory를
자처한다. 그러나 owner 표는 host goal을 `cxc-goalplan`, parallel lane을
`cxc-ultraresearch`, plugin discovery를 `cxc-skill-hub` 소유로 둔다
(`structure/60_native_capabilities.md:67-71`). 세 stub의 현행 redirect는 각각 `cxc-loop`,
`cxc-search`, `cxc-dev`다
(`plugins/codexclaw/skills/goalplan/SKILL.md:2-6`,
`plugins/codexclaw/skills/ultraresearch/SKILL.md:2-6`,
`plugins/codexclaw/skills/skill-hub/SKILL.md:2-6`). 단일 owner inventory의 소유자가
deprecated 이전 상태에 머물러 있다.

## 4. deprecated 잔존 참조

다음 명령을 B 시점에 재실행했다.

```bash
rg -n 'cxc-goalplan|cxc-skill-hub|cxc-ultraresearch' \
  plugins/codexclaw/skills structure plugins/codexclaw/agents
```

정확 일치는 17건이다. 현행 owner·catalog처럼 쓰인 활성형은 8건, deprecated 표기나
redirect 설명은 9건이다. agents 아래 일치는 0건이다.

| 이름 | 활성형 잔존 | 의도적 deprecated/redirect | 판정 |
|---|---|---|---|
| `cxc-goalplan` | native owner `structure/60_native_capabilities.md:67`; 현행 catalog `structure/INDEX.md:147` | README redirect `plugins/codexclaw/skills/README.md:24`; stub name/제목 `plugins/codexclaw/skills/goalplan/SKILL.md:2`, `plugins/codexclaw/skills/goalplan/SKILL.md:9` | 활성형 2, 의도적 3 |
| `cxc-skill-hub` | native owner·gap map `structure/60_native_capabilities.md:71`, `structure/60_native_capabilities.md:131`; 현행 catalog `structure/INDEX.md:162` | README redirect `plugins/codexclaw/skills/README.md:41`; stub name `plugins/codexclaw/skills/skill-hub/SKILL.md:2` | 활성형 3, 의도적 2 |
| `cxc-ultraresearch` | parallel owner·gap map `structure/60_native_capabilities.md:69`, `structure/60_native_capabilities.md:129`; 현행 catalog `structure/INDEX.md:166` | README redirect `plugins/codexclaw/skills/README.md:45`; former-name 표기 `plugins/codexclaw/skills/search/SKILL.md:116`; stub name/제목 `plugins/codexclaw/skills/ultraresearch/SKILL.md:2`, `plugins/codexclaw/skills/ultraresearch/SKILL.md:9` | 활성형 3, 의도적 4 |

활성형 8건은 redirect 목적지로 치환할 후보다. 의도적 9건은 deprecated 이름을 검색 가능하게
남기며 목적지를 함께 밝히므로 결함으로 세지 않았다.

## 5. 발견 사항

### High

**H-1. structure가 A게이트 reviewer provenance를 구조적으로 보장한다고 과장한다.**
`structure/20_pabcd_dispatch_doctrine.md:73-78`은 `"structurally needs a real reviewer dispatch"`라고
쓴다. canonical PABCD는 `"form-only bar: the gate cannot verify the paste's provenance"`라고
명시한다(`plugins/codexclaw/skills/pabcd/SKILL.md:133`). 운영자는 auditOutput 필드가 실제
독립 reviewer 파견까지 검증한다고 오해할 수 있다.

**H-2. A 감사에서 reviewer dispatch를 생략할 수 있는 상충 경로가 있다.**
structure는 `"a reviewer subagent or a direct file:line audit"`를 허용한다
(`structure/20_pabcd_dispatch_doctrine.md:101-103`). PABCD의 STRICT Audit loop는 independent
reviewer dispatch를 요구한다(`plugins/codexclaw/skills/pabcd/SKILL.md:133`). 어느 문서를
따르느냐에 따라 필수 독립 검토가 self-audit로 대체될 수 있다.

**H-3. live collab surface의 기본값이 정반대로 서술된다.**
`structure/10_subagent_skill_routing.md:9`은 `"the live spawn surface is multi_agent_v2"`라고
단정한다. native inventory는 V1 default, V2 manual opt-in으로 정의한다
(`structure/60_native_capabilities.md:24-35`, `structure/60_native_capabilities.md:117`). PABCD도
default namespace를 V1로 둔다(`plugins/codexclaw/skills/pabcd/SKILL.md:406`). 잘못된 전제를
따르면 `followup_task`와 `send_input` 계열을 뒤바꿔 호출한다.

### Med

**M-1. implicit-visible canonical 집합이 structure에 전파되지 않았다.**
현행 8개 집합은 `plugins/codexclaw/skills/dev/SKILL.md:177`에 있다. INDEX는 6개만 적고
(`structure/INDEX.md:138`), dispatch doctrine은 deprecated `skill-hub`를 포함한 옛 집합을
유지한다(`structure/20_pabcd_dispatch_doctrine.md:162-168`). 자동 노출 여부와 surface router
로드 기대가 문서마다 달라진다.

**M-2. native owner 표가 deprecated 스킬을 현행 소유자로 지정한다.**
`structure/60_native_capabilities.md:67-71`은 `cxc-goalplan`, `cxc-ultraresearch`,
`cxc-skill-hub`를 owner로 둔다. 각 stub은 `deprecated: true`와 새 목적지를 선언한다
(`plugins/codexclaw/skills/goalplan/SKILL.md:2-6`,
`plugins/codexclaw/skills/ultraresearch/SKILL.md:2-6`,
`plugins/codexclaw/skills/skill-hub/SKILL.md:2-6`). ownership 탐색이 redirect stub에서 한 번
더 꺾이고 단일 inventory 선언도 깨진다.

**M-3. INDEX가 deprecated 3종을 표기 없이 현행 catalog처럼 노출한다.**
`structure/INDEX.md:147`, `structure/INDEX.md:162`, `structure/INDEX.md:166`은 각각 durable
goalplan, catalog router, multi-wave research 역할을 현재 기능으로 서술한다. deprecated나
redirect 목적지가 없어 독자가 세 stub을 신규 작업의 canonical entry로 선택할 수 있다.

**M-4. recursion grant token의 위치 계약이 agents와 canonical에서 다르다.**
agents는 `"your dispatcher's task message contains CXC-SUBSPAWN-ALLOWED"`라고 쓴다
(`plugins/codexclaw/agents/executor.toml:13-14`,
`plugins/codexclaw/agents/reviewer.toml:13-14`,
`plugins/codexclaw/agents/explorer.toml:14-15`). canonical은 recursive spawn의 outgoing
message에 token을 넣으라고 요구한다(`plugins/codexclaw/skills/pabcd/SKILL.md:409`). 원래
dispatch에만 token이 있으면 child의 새 spawn message 검사에서 grant가 보이지 않을 수 있다.

### Low

**L-1. `DISPATCH-RETIRE-01` 규칙 ID가 structure/10에서 축약됐다.**
`structure/10_subagent_skill_routing.md:172`는 `"DISPATCH-ACTOR-01/RETIRE-01"`로 쓴다.
canonical ID는 `DISPATCH-RETIRE-01`이다
(`structure/20_pabcd_dispatch_doctrine.md:134-140`). ID 기반 검색과 자동 대조에서 같은 규칙이
둘로 갈라진다.

**L-2. DISPATCH-TASK-01의 6요소 packet이 dispatch SOT에 부분 반영됐다.**
PABCD는 `TASK`, `SCOPE`, `MUST DO`, `MUST NOT`, `PROOF`, `RETURN FORMAT`을 요구한다
(`plugins/codexclaw/skills/pabcd/SKILL.md:439-445`). structure는 relevant plan/context를
inline하라는 요구만 둔다(`structure/20_pabcd_dispatch_doctrine.md:107-110`)면서 규칙 ID를
별도 행에만 붙인다(`structure/20_pabcd_dispatch_doctrine.md:175`). structure만 읽은 dispatcher가
proof나 금지 범위를 빼먹을 수 있다.

## 6. 리뷰어 verdict

사이클 2 A게이트 판정은 **GO-WITH-FIXES (blockers=1)**이다. 증거는
`.codexclaw/evidence/repo-review-cycle2-a-gate-20260710T053232+0900.md`에 있다.

blocking finding은 003의 stale `path:line`을 020이 전면 재검증하도록 강제하지 않았다는 점이다.
B 처분으로 021에 채택한 모든 인용을 원본에서 재해석했고, 연구 문서의 번호를 복사하지 않았다.
확인된 이동은 다음과 같다.

- `plugins/codexclaw/skills/dev/SKILL.md` 기존 176 -> 현재 `plugins/codexclaw/skills/dev/SKILL.md:177`
- `structure/10_subagent_skill_routing.md` 기존 184 -> 현재 `structure/10_subagent_skill_routing.md:172`
- `plugins/codexclaw/skills/search/SKILL.md` 기존 191 -> 현재 `plugins/codexclaw/skills/search/SKILL.md:192`

deprecated 절은 003의 예전 목록을 채택하지 않고 B 시점 `rg` 결과 17건을 새로 분류했다.
A게이트의 blocker는 이 전면 재해석 의무를 문서 작성 절차에 폴드해 처분했다. 별도 재리뷰
판정은 없으므로 기록상 최종 verdict는 **GO-WITH-FIXES (blockers=1)**로 유지한다.
