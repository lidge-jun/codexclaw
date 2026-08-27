# Gap matrix — CodexClaw upgrade candidates

## 판정 요약

| ID | Gap / mechanism | Disposition | Priority | Existing owner | Activation evidence required |
| --- | --- | --- | --- | --- | --- |
| G1 | Generic semantic research parser | REJECT; named deep-research arm만 DEFER/ADAPT | P1 | `pabcd-state` + `search` | explicit `ulw-research`/comprehensive swarm wording만 positive; ordinary explain/look-into/latest/quoted mode text는 negative |
| G2 | Tier 3 durable recovery | ADAPT by reuse, no new FSM | P1 | existing goalplan/ledger + `search` | explicit arm 뒤 기존 goal/loop ledger에 wave/lead/claim events; parser가 goal/FSM을 자동 생성·이동하지 않음 |
| G3 | Background child/monitor wake-source bus | DEFER / 현재는 REJECT | P3 | owner 없음; host mailbox only | live source를 CodexClaw이 직접 관측하는 surface가 생기기 전에는 state를 만들지 않음 |
| G4 | Activation trace가 dormant/self-report | DEFER, spawn referenced만 ADAPT 가능 | P2 | `cxc-ops` trace + spawn hook | parser fired/payload rewritten은 별도 class; host skill-load와 child compliance는 unobservable |
| G5 | Attachment source와 docs drift | ADOPT implementation + ADAPT docs | P0 | `search`, dispatch SOT | V1/V2 plaintext inline tests; opaque V2 affordance; omitted skill remains absent |
| G6 | OMO 5 research lineage가 더 깊음 | ADAPT | P2 | existing Tier3 journal | intent-diff/claim/observation/excursion schema completeness and counter-search closure |
| G7 | Native dispatch builder production caller 미확인 | DEFER | P2 | `subagent-config` | real caller path or explicit dormant verdict; no fake “wired” claim |
| G8 | OMO/Senpi scheduler, duplicate goal/todo/task engine | REJECT | — | host/native goal already owns | N/A; violates thin-host and duplicate-state boundary |
| G9 | Global ultrawork substring parser/process-global arming | REJECT | — | explicit loop/search triggers already own | false-positive matrix proves unsafe |
| G10 | Team dependency graph/claim runtime | DEFER | P3 | none | only if user asks durable team runtime; cycle/existence/claim/wake proofs required |

## G1 — Generic semantic parser는 격차가 아니다

- OMO/Senpi의 generic research/investigation 분류는 prompt-only IntentGate다. Deterministic parser는 named mode만 arm한다 (`001`, `002`, `003`).
- Generic `찾아봐/look into/explain`을 hook으로 잡으면 ordinary Tier1-2, Interview의 자체 “Research the repo first”, 변수/파일명, quoted directives까지 deep mode로 올릴 위험이 있다.
- 따라서 generic parser는 REJECT한다. 기존 `cxc-search` metadata/Intent Guard가 semantic routing을 맡긴다.
- 별도 수요 증거가 생기면 `detectDeepResearchRequest`를 DEFER/ADAPT할 수 있다. Positive는 `ulw-research`, `$cxc-search comprehensive/deep research`, “research swarm + wave journal + prove every claim”, “철저한 조사로 끝까지”처럼 named/strong deliverable marker가 결합된 경우다. Negative는 ordinary explain/look-into/latest, implementation discussion, code/quote, `ulw_helper.ts`, product-injected research wording이다.
- 이 parser도 directive만 낸다. create_goal, PABCD 전이, spawn은 하지 않는다.

## G2 — Durable research run state

새 subsystem/FSM은 만들지 않는다. 사용자가 exhaustive research를 deliverable로 명시하고 main이 기존 `create_goal` + `cxc loop init`을 실행한 뒤에만 기존 goalplan/ledger에 optional research-run events를 붙인다.

- `research_run_opened`: axes, source territories, precision, stop rule.
- `research_lane_dispatched`: lane id, axis, skill payload receipt.
- `research_lane_disposed`: accepted/merged/rejected/retry + evidence anchors.
- `research_lead_opened/closed`: parent axis/claim, source, reason.
- `research_claim_recorded`: status, supporting/counter observations, evidence class.
- `research_wave_closed`: gaps, no-new-lead count, next wave/stop.

Main remains dispatcher. Child writes no journal. Runtime concurrency remains host-owned. Parser가 이 state를 자동 생성하지 않는다. 명시적으로 arm된 장기 조사에서만 Stop/compaction recovery가 “어디까지 조사했고 다음에 무엇을 파견할지”를 복원한다.

## G3 — Wake-source bus는 지금 만들지 않는다

Senpi는 extension event bus가 monitor/task active count를 직접 소유하지만 CodexClaw은 host-native child/terminal의 live channel을 관측하는 plugin surface가 없다. OMO parent wake도 OpenCode process queue다. label/count만 goalplan에 추가하면 실제 wake를 재현하지 못하고 stale state만 만든다.

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

Current `activated` wording collapses 1-5. MLB activation-baseline 작업과 분리한다. 이 upgrade에서는 spawn-time `referenced` event만 필요성이 입증될 때 재개방하고, main-turn `activated`는 생성하지 않는다.

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

## Dependency order

1. P0 docs/source-truth correction: G5.
2. P1 existing goalplan research events + EXPAND return contract: G2.
3. P2 evidence lineage subset: G6, after G2 has real lifecycle rows.
4. P2 named deep-research arm: G1, only after usage evidence and G2 persistence exist.

G3/G4/G7/G10은 현재 구현 roadmap 밖이다.

No implementation begins in this research cycle.
