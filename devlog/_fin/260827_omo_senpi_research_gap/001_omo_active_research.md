# OMO beta 5.0 — active research와 task runtime

Pinned HEAD: `84f98d8bd1b5c70c46e6f8a5613ffb3c787079db`
Evidence classes: `executed` / `deterministic-runtime` / `prompt-only` / `test-only`

## 결론

OMO에도 “일반 문장을 의미적으로 읽고 자동으로 `ulw-research`를 확정하는 deterministic parser”는 없다. Codex hook은 `ultrawork|ulw` 문자열만 보고 `ulw-plan`·`ulw-research`는 오히려 제외한다. OpenCode keyword detector도 ultrawork/team/hyperplan만 가진다. 일반 research/investigation 분류는 Sisyphus system prompt와 skill metadata에 맡긴다.

OMO가 앞서는 부분은 parser가 아니라 **활성화 이후의 연구 프로토콜**이다. `ulw-research`는 query axis, 실시간 wave journal, claim graph, observation manifest, counter-search, excursion fold-back, 최종 검증을 하나의 durable artifact lineage로 요구한다.

## 활성화 계층

| Surface | Class | Positive | Negative/bypass | State/output |
| --- | --- | --- | --- | --- |
| Codex ultrawork hook | executed | `ultrawork`, `ulw`, 심지어 `ulw_helper.ts`; regex `/(?:ultrawork\|ulw(?!-(?:plan\|research)))/i` | `ulw-plan`, `ulw-research`, generic `deep research`, context-pressure marker | transcript tail을 보고 `<ultrawork-mode>` pointer를 추가. 별도 durable state 없음. `devlog/.omo/packages/omo-codex/plugin/components/ultrawork/src/codex-hook.ts:5-7,31-38,41-116` |
| OpenCode keyword detector | deterministic-runtime | word-bounded `ultrawork|ulw`, team, hyperplan | code block, slash-leading command, non-OMO/background/planner agent, disabled keyword | 첫 real user text part에 directive append; generic research detector는 없음. `devlog/.omo/packages/omo-opencode/src/hooks/keyword-detector/constants.ts:33-54`, `devlog/.omo/packages/omo-opencode/src/hooks/keyword-detector/detector.ts:44-70`, `devlog/.omo/packages/omo-opencode/src/hooks/keyword-detector/hook.ts:55-113,231-245` |
| Sisyphus IntentGate | prompt-only | 매 turn research/investigation 포함 의미 분류 | 모델 variant/noncompliance; machine state 없음 | model-generated routing line. `devlog/.omo/packages/omo-opencode/src/agents/sisyphus/gpt-5-5.ts:68-96`, `devlog/.omo/packages/omo-opencode/src/agents/sisyphus/gemini.ts:213-246` |
| `ulw-research` skill | prompt-only | explicit `ulw-research`, ulw research wording, explicit deep/ultra-precise research | ordinary question/debugging/context gathering; runtime verifier 없음 | `.omo/ulw-research/<timestamp>` journal family와 cited synthesis. `devlog/.omo/packages/shared-skills/skills/ulw-research/SKILL.md:30-59,114-149` |

Codex adapter는 shared skill을 build time에 plugin skills tree로 복사할 뿐이다. generated metadata는 display name을 만들며 `allow_implicit_invocation` 같은 active-selector 계약을 추가하지 않는다: `devlog/.omo/packages/omo-codex/plugin/scripts/sync-skills.mjs:186-235,221-270`, `devlog/.omo/packages/omo-codex/plugin/.codex-plugin/plugin.json:21-30`.

## `ulw-research`에서 가져올 만한 것

### Claim-production lineage — ADAPT

- `intent-diff.md`: 기대 truth와 observed reality의 차이.
- `claim-graph.md`: claim, risk, support/counter observations, independence, status.
- `observation-manifest.md`: source, observer group, validity, contamination.
- `verification-economics.md`: error cost 대 proof cost.
- `cause-disappearance.md`: 원인 가설이 사라졌는지 추적.

정의는 `devlog/.omo/packages/shared-skills/skills/ulw-research/SKILL.md:61-71`에 있다. CodexClaw의 current Tier 3 journal은 searched/found/open과 claim/source만 요구하므로 이 lineage가 더 얕다.

### EXPAND tail + bounded excursion fold-back — ADAPT

각 worker가 `LEAD/DEAD END` tail을 반환하고 main이 실시간으로 journal에 접는다: `devlog/.omo/packages/shared-skills/skills/ulw-research/SKILL.md:96-112`. 새 lead의 excursion은 parent claim, ENTER/EXIT, depth, spent workers, changed answer를 기록한다: 같은 파일 `:127-145,195-245`.

무제한 파견을 “무한 recursion”으로 만들지 않고 main-owned wave로 유지하는 데 유용하다.

### 최대 roster·별도 role·PDF/DOCX default — REJECT

항상 슬롯을 가득 채우고, debate member를 강제하고, 기본 deliverable을 PDF+DOCX로 잡는 규칙은 문제 크기와 무관하게 비용과 산출물을 키운다: `devlog/.omo/packages/shared-skills/skills/ulw-research/SKILL.md:73-85,151-160`. CodexClaw의 base explorer topology와 최소 산출물 원칙을 유지한다.

## Background/task runtime

OMO Ultimate는 OpenCode runtime을 직접 소유하므로 process-local scheduler와 별도 ID를 만든다.

- `run_in_background=true`면 `bg_*` record와 child session을 만들고 즉시 handle을 반환한다; false/omitted면 sync poll/result를 반환한다: `devlog/.omo/packages/omo-opencode/src/tools/delegate-task/tools.ts:91-132,218-223`, `devlog/.omo/packages/omo-opencode/src/tools/delegate-task/background-task.ts:216-223`.
- queue/concurrency state는 process-memory map이며 default concurrency는 5, `0`은 무한이다: `devlog/.omo/packages/omo-opencode/src/features/background-agent/manager.ts:248-282`, `devlog/.omo/packages/omo-opencode/src/features/background-agent/concurrency.ts:25-84`.
- completion은 parent를 wake하지만 result는 `background_output`이 나중에 session history에서 읽는다: `devlog/.omo/packages/omo-opencode/src/features/background-agent/background-task-notification-template.ts:74-109`, `devlog/.omo/packages/omo-opencode/src/tools/background-task/create-background-output.ts:135-200`.
- follow-up은 같은 child session을 resume하지만 substantive follow-up prompt 자체는 모델이 정한다: `devlog/.omo/packages/omo-opencode/src/tools/delegate-task/tools.ts:123-127`, `devlog/.omo/packages/omo-opencode/src/features/background-agent/manager.ts:1288-1349`.

CodexClaw에서 scheduler/result store를 복제하는 것은 REJECT다. native `spawn_agent`/wait/followup을 써야 한다. 다만 parent-wake accounting, terminal failure 기록, explicit sync/background decision은 ADAPT할 수 있다.

## Task graph 판정

- Generic task CRUD는 `blocks/blockedBy`를 저장하지만 cycle/existence/reciprocal validation, claim gate, auto-dispatch가 없다: `devlog/.omo/packages/omo-opencode/src/tools/task/types.ts:6-69`, `task-create.ts:67-103`, `task-update.ts:84-142`, `task-list.ts:48-76`. “그래프가 있다”와 “그래프가 실행된다”를 구분해야 한다.
- Team tasklist는 claim lock과 blocker recheck를 제공한다: `devlog/.omo/packages/team-core/src/team-tasklist/claim.ts:58-96`. 그러나 blocker 완료가 자동 wake/dispatch로 이어지지 않고 member prompt가 다음 claim을 요구한다: `devlog/.omo/packages/omo-opencode/src/features/team-mode/member-guidance.ts:16-18,41-44`.

CodexClaw의 얇은 host 정책에는 generic dependency graph를 바로 넣지 않는다. 연구 wave lineage가 먼저이고, multi-writer durable team runtime은 DEFER다.

## 4.19 → 5.0 keyed delta

| Prior | 4.19 disposition | 5.0 concrete delta | New disposition |
| --- | --- | --- | --- |
| `001_axis_a_loop_orchestration.md:14-17` global ultrawork | REJECT | Codex hook source 변화 없음; suppression도 유지 | REJECT 유지 |
| 같은 문서 `:20-22,130-140,155-163` separate ulw-research/roles | REJECT, search Tier 3로 흡수 | shared skill `+128/-12`; claim lineage, excursion, ulw-loop default, format gate, source provenance 보강. Activation은 여전히 prompt-only | 별도 skill/role REJECT, evidence method만 ADAPT |
| `002_axis_b_skills_qa_distribution.md:152-166` package/hook distribution | correction | adapter/package `5.0.0-beta.22`, manifest 23 hooks/skills tree 유지 | NEW gap 없음 |

## 검증 상태

- Read-only explorer reported OMO Codex trigger tests `17 pass / 0 fail` and a prompt matrix, but raw command output is not committed; this is `UNVERIFIED reported evidence` and is not the basis of the verdict.
- Explorer reported OpenCode/skill sync tests failed before test bodies due to missing workspace package resolution; raw output is not committed. 그 행은 source-traced로만 표기한다.
- OMO 문서 자체에도 runtime과 어긋난 부분이 있다. 예: background completion guide와 실제 general manager, team task storage 설명. 채택 시 docs보다 source가 우선이다.
