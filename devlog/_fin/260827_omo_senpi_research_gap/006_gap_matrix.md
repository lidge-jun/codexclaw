# Gap matrix — CodexClaw upgrade candidates

## 판정 요약

| ID | Gap / mechanism | Disposition | Priority | Existing owner | Activation evidence required |
| --- | --- | --- | --- | --- | --- |
| G1 | Generic semantic research parser | REJECT; named deep-research arm만 DEFER/ADAPT | conditional P2 | `pabcd-state` + `search` | explicit `ulw-research`/comprehensive swarm wording만 positive; ordinary explain/look-into/latest/quoted mode text는 negative |
| G2 | Tier 3 durable recovery | ADAPT by existing structured goalplan, no new FSM | P1 | `goalplan.ts` + `steering.ts` + `goalplan-cli.ts` + `search` | HITL/HOTL 경계를 보존한 뒤 work-phase/task/criterion을 mutation하고 ledger는 history만 기록 |
| G3 | Background child/monitor wake-source bus | DEFER / 현재는 REJECT | P3 | owner 없음; host mailbox only | live source를 CodexClaw이 직접 관측하는 surface가 생기기 전에는 state를 만들지 않음 |
| G4 | Activation trace가 dormant/self-report | DEFER, spawn referenced만 ADAPT 가능 | P2 | `cxc-ops` trace + spawn hook | parser fired/payload rewritten은 별도 class; host skill-load와 child compliance는 unobservable |
| G5 | Attachment source와 docs drift | ADOPT implementation + ADAPT docs | P0 | `search`, dispatch SOT | V1/V2 plaintext inline tests; opaque V2 affordance; omitted skill remains absent |
| G6 | OMO 5 research lineage가 더 깊음 | ADAPT | P2 | existing Tier3 journal | intent-diff/claim/observation/excursion schema completeness and counter-search closure |
| G7 | Native dispatch builder production caller 미확인 | DEFER | P2 | `subagent-config` | real caller path or explicit dormant verdict; no fake “wired” claim |
| G8 | OMO/Senpi scheduler, duplicate goal/todo/task engine | REJECT | — | host/native goal already owns | N/A; violates thin-host and duplicate-state boundary |
| G9 | Global ultrawork substring parser/process-global arming | REJECT | — | explicit loop/search triggers already own | false-positive matrix proves unsafe |
| G10 | Team dependency graph/claim runtime | DEFER | P3 | none | only if user asks durable team runtime; cycle/existence/claim/wake proofs required |

## G1 — Generic semantic parser는 격차가 아니다

- OMO/Senpi의 generic research/investigation 분류는 prompt-only IntentGate다. Deterministic parser는 named mode만 arm한다: `devlog/_fin/260827_omo_senpi_research_gap/001_omo_active_research.md:12-21`, `devlog/_fin/260827_omo_senpi_research_gap/002_senpi_active_research.md:18-26`, `devlog/_fin/260827_omo_senpi_research_gap/003_omo_senpi_adapter.md:7-21`.
- Generic `찾아봐/look into/explain`을 hook으로 잡으면 ordinary Tier1-2, Interview의 자체 “Research the repo first”, 변수/파일명, quoted directives까지 deep mode로 올릴 위험이 있다.
- 따라서 generic parser는 REJECT한다. 기존 `cxc-search` metadata/Intent Guard가 semantic routing을 맡긴다.
- 별도 수요 증거가 생기면 `detectDeepResearchRequest`를 DEFER/ADAPT할 수 있다. Positive는 `ulw-research`, `$cxc-search comprehensive/deep research`, “research swarm + wave journal + prove every claim”, “철저한 조사로 끝까지”처럼 named/strong deliverable marker가 결합된 경우다. Negative는 ordinary explain/look-into/latest, implementation discussion, code/quote, `ulw_helper.ts`, product-injected research wording이다.
- 이 parser도 directive만 낸다. create_goal, PABCD 전이, spawn은 하지 않는다.

## G2 — Existing goalplan을 authoritative research projection으로 확장

새 subsystem/FSM이나 ledger-derived projection을 만들지 않는다. Authoritative state는 지금 Stop/completion이 이미 읽는 `GoalplanWorkPhase.tasks[]`와 `criteria[]`다: `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:50-90,700-723,791-818`. Ledger는 append-only history일 뿐이며 state source가 아니다: 같은 파일 `:192-220,638-658`.

Canonical lifecycle mapping:

| Research lifecycle | Structured owner | Required mutation/history |
| --- | --- | --- |
| run open/close | existing research `GoalplanWorkPhase.status` | existing workphase start/done |
| lane dispatched / disposed | `GoalplanTask` pending/done; optional research metadata `{wave, axis, kind:"lane", outcome}` | new additive `add-task`, new fail-closed `resolve-task --outcome accepted|merged|rejected|retry`; append existing `task_done` with disposition |
| lead open/closed | `GoalplanTask` pending/done; kind `lead`, parent/source metadata | same task mutation path; retry creates a new pending task rather than reopening done history |
| claim open/proven/refuted | existing `GoalplanCriterion` open/met plus expected/captured evidence; optional claim verdict | existing `add-criterion`; new `capture-criterion --verdict proven|refuted` appends `criterion_met` only with evidence |
| wave start/close | a `wave-close-N` task plus lane/lead tasks carrying `wave` | wave closes only when its close task and all same-wave tasks are done; disposition summary goes to ledger detail |

Creation → serialization → deserialization → consumers:

- Creation/mutation: extend `plugins/codexclaw/components/pabcd-state/src/steering.ts:34-66,130-190,202-245` with additive task creation and fail-closed task/criterion resolution; expose explicit verbs in `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:37-103,209-260`.
- Serialization: existing atomic `writeGoalplan` persists the structured projection, `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:620-636`.
- Deserialization: extend the task/criterion reviver near `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:449-454` to validate optional research metadata and reject unknown outcomes.
- Consumers: existing `nextOpenTask`, `unmetCriteria`, `advanceWorkPhase`, and `validateGoalplan` already keep pending tasks/open criteria visible to Stop/completion, `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:700-723,791-818,1029-1071`; render the wave/axis metadata in `goalplan-cli.ts` `show`.

Mode boundary:

- HITL exhaustive research may initialize/bind a local goalplan and enter PABCD, but never creates a host goal from “deep research” wording alone.
- HOTL may call `create_goal` only when the user separately requested autonomous/continue-until-done execution, per `plugins/codexclaw/skills/loop/SKILL.md:79-93`.
- Parser가 goal/FSM을 자동 생성하거나 이동하지 않는다. Main remains dispatcher; child writes no journal; runtime concurrency remains host-owned.

## G3 — Wake-source bus는 지금 만들지 않는다

Senpi core terminal/goal owns monitor counts and wake-source transport: `devlog/_fin/260827_omo_senpi_research_gap/002_senpi_active_research.md:37-50`. OMO child-task state and `source:"senpi-task"` active-count publication belong to the OMO Senpi adapter: `devlog/_fin/260827_omo_senpi_research_gap/003_omo_senpi_adapter.md:37-46`, `devlog/.omo/packages/omo-senpi/src/components/task/resumption-channel-emitter.ts:13-14,48-53,61-90`. OMO OpenCode parent wake is a separate process queue: `devlog/_fin/260827_omo_senpi_research_gap/001_omo_active_research.md:45-54`. CodexClaw은 host-native child/terminal의 live channel을 관측하는 plugin surface가 없으므로 label/count만 goalplan에 추가하면 실제 wake를 재현하지 못하고 stale state만 만든다.

- 현재 owner: host `wait_agent`/task mailbox. CodexClaw은 result/evidence tombstone만 관측할 수 있다.
- 따라서 hidden timer, event bus, liveness registry, Stop hold는 REJECT한다.
- 향후 host가 authenticated live source snapshot을 제공할 때만 DEFER를 재개방한다. 그때도 registered source, nonnegative integer, expiry, owner, drain evidence가 필수다.
- Research continuation은 G2의 open tasks/criteria와 기존 Stop remaining-work로 처리한다.

## G4 — Honest activation observability

Evidence classes:

1. `parser_fired` — deterministic hook branch.
2. `payload_rewritten` — spawn hook output with body hash/bytes.
3. `child_receipt` — child return includes requested lane/evidence.
4. `model_self_report` — skill use claim, never hard proof.
5. `host_unobservable` — implicit selector/load cannot be seen.

Current `activated` wording collapses 1-5: `plugins/codexclaw/components/cxc-ops/src/activation-trace.ts:18-43,54-150`. MLB activation-baseline 작업과 분리한다. 이 upgrade에서는 spawn-time `referenced` event만 필요성이 입증될 때 재개방하고, main-turn `activated`는 생성하지 않는다.

## G6 — Evidence lineage subset

Keep:

- expected truth vs observed reality;
- claim support + counter-observation;
- independent observation groups and contamination;
- bounded excursion ENTER/EXIT and answer delta;
- source validity timestamp for current claims.

Reject:

- always-full roster;
- second research team by default;
- compulsory PDF/DOCX/visual QA for code research;
- unlimited exploration overriding all budget boundaries.

Source: OMO schema is `devlog/.omo/packages/shared-skills/skills/ulw-research/SKILL.md:61-71,127-149,195-245`; current CodexClaw Tier 3 journal/claim contract is `plugins/codexclaw/skills/search/SKILL.md:126-177`.

## Prior 4.19 disposition keys

| Current gap | Prior row | Prior disposition | 5.0 result |
| --- | --- | --- | --- |
| G8 scheduler/duplicate runtime | `devlog/_fin/260725_lazygap2_omo419_parity/001_axis_a_loop_orchestration.md:26,30` automatic transition/multiple Stop owner + `devlog/_fin/260725_lazygap2_omo419_parity/002_axis_b_skills_qa_distribution.md:36-38` second orchestrator | REJECT | OMO/Senpi add more runtime machinery but do not change CodexClaw's thin-host boundary; REJECT 유지 |
| G9 global parser/arming | `devlog/_fin/260725_lazygap2_omo419_parity/001_axis_a_loop_orchestration.md:14-17` global ultrawork | REJECT | Codex hook unchanged; Senpi adapter overlap/process-global state is weaker; REJECT 유지 |
| G10 team graph | `devlog/_fin/260725_lazygap2_omo419_parity/002_axis_b_skills_qa_distribution.md:36-40` extra team/runtime ownership | REJECT/locked topology | claim graph alone은 auto-dispatch가 아니고 native Codex owner가 없어 DEFER 유지 |

## Dependency order

1. P0 docs/source-truth correction: G5.
2. P1 structured goalplan task/criterion projection + explicit mutation verbs: G2. Ledger events are history emitted by those successful mutations, never the state source.
3. P2 evidence lineage subset: G6, after G2 has real lifecycle rows.
4. P2 named deep-research arm: G1, only after usage evidence and G2 persistence exist.

Main-dispatch EXPAND wording is a `search/SKILL.md` contract first; it must not depend on dormant `routeDispatch`. G7 production caller proof remains outside P1. G3/G4/G7/G10은 현재 구현 roadmap 밖이다.

No implementation begins in this research cycle.
