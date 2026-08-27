# Research closeout — wave journal, final verdict, next roadmap

Date: 2026-08-27
Outcome: `DONE` for docs-only research; no production implementation

## Source receipts

| Source | Pin | Fresh proof |
| --- | --- | --- |
| OMO beta | `84f98d8bd1b5c70c46e6f8a5613ffb3c787079db` / tag `v5.0.0-beta.22` | npm `omo-ai@beta=5.0.0-0.beta.22` registry `gitHead` matched; public GitHub commit opened |
| Senpi latest local comparison | `703d9d7676b3419273765a4566dd02c1abe75d70` / package `2026.8.27` | `git ls-remote` main matched; public GitHub commit opened |
| OMO's Senpi peer | package pin `2026.8.26-2` | source pin in `devlog/.omo/packages/omo-senpi/package.json:47-56`; exact peer checkout was not materialized |
| CodexClaw | `822ba3c4e3cffd3184d2944d28c2e5de2ac8baff` | current outer HEAD during research |

OMO beta와 Senpi latest의 날짜가 다르므로 latest Senpi source를 beta runtime proof로 사용하지 않았다.

## Wave journal

### A plan audit

| Agent | Scope | Disposition | Result |
| --- | --- | --- | --- |
| `01a04296-d569-7de3-be37-b7fc0ec86f74` | whole plan audit, same-reviewer round 2 | accepted/merged | Round 1 FAIL 6 blockers; ownership, activation traces, verifier, source receipt, prior-row key, lane retry를 plan에 반영. Round 2 GO-WITH-FIXES 잔여 2건도 exact commit/path gate와 version label로 반영. |
| `01a04298-69a9-7a50-a56d-46b7723f7a0b` | OMO plan coverage | accepted/merged | shared skill / Codex adapter / Ultimate runtime, async queue / task graph / goal을 분리. |
| `01a04298-6932-7c81-80a2-87703baf6efa` | Senpi ownership coverage | accepted/merged | core prompt, goal/todo/terminal, omo-senpi/senpi-task ownership을 분리. |
| `01a04298-6a37-7d30-b546-7888653779b9` | CodexClaw observability | accepted/merged | generic search prompt-only, dormant trace, V1/V2 docs drift 확인. |

### Wave 1 — source ownership and mechanism reconstruction

Main-session transcript records show all five spawns were authored with skill item paths `/Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.14+codex.260826140715/skills/dev/SKILL.md` and `/Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.14+codex.260826140715/skills/search/SKILL.md`. The repo commit does not contain raw spawn payload receipts, so this is `UNVERIFIED transcript self-report`, not artifact-level proof. Main session was the sole dispatcher; children reported read-only work and no recursion.

| Agent | Axis | Disposition | Key return / EXPAND |
| --- | --- | --- | --- |
| `01a042a0-382a-7763-a2a1-2be481ecebca` | OMO Codex + shared ulw-research + 4.19 delta | accepted/merged | generic research parser 없음; Codex regex matrix 17 pass; evidence-lineage delta. EXPAND host selector/E2E는 unobservable or dependency-blocked로 남김. |
| `01a042a0-389e-7940-94e3-4a53b9971a2f` | OMO Senpi adapter + senpi-task | accepted/merged | pointer/arming/task owner 분리, exact Senpi peer version caveat. Focused tests는 missing workspace package로 0 pass/4 pre-body fail; source-only로 강등. |
| `01a042a0-3912-7890-9670-b0e082b0f937` | OMO background queue + task graph | accepted/merged | scheduler/parent wake는 host runtime, generic task graph는 auto-dispatch 아님, team claim도 unblocking wake 없음. |
| `01a042a0-3a1d-7112-9568-a8d6e37e480d` | Senpi core prompt/parallel/goal/monitor | accepted/merged | IntentGate prompt-only, runtime parallel call은 host concern, wake-source goal continuation과 malformed-count gap. |
| `01a042a0-39a1-7771-82b2-d95b0729c649` | CodexClaw current surface | accepted/merged | six files 188 pass; generic Korean search false, explicit agbrowse true; attachment source/docs drift; activation trace dormant. |

Wave 1 stop: owner/state/output/bypass와 positive/negative trigger가 모든 주요 축에 채워졌고, 남은 EXPAND가 세 설계 crux로 수렴해 새 source territory 탐색을 멈췄다.

### Wave 2 — crux attack and collapse

Wave 2는 다른 model family로 세 축을 공격했다.

| Agent | Crux | Disposition | Collapse |
| --- | --- | --- | --- |
| `01a042a9-e366-7f10-a13b-052f36284c7f` | generic parser + new research FSM 반증 | accepted; previous G1 rebutted | Generic semantic research parser REJECT. Named explicit deep-research arm만 later ADAPT. New research FSM REJECT; existing goalplan reuse. |
| `01a042a9-e3da-7d01-a045-22a0e89f0e1a` | minimum Codex-native state | accepted/merged | 최우선은 goalplan-owned wave/lead/claim ledger. Scheduler/DAG/hidden wake/second DB REJECT. |
| `01a042a9-e468-7e40-8fd3-64e635c443e8` | Wave 1 gap falsification | accepted/merged | A/B/C/D/E confirmed, wake-source F weak/downstream. G3/G4 implementation priority를 하향. |

Wave 2 stop: 세 lane이 독립적으로 “parser보다 research memory”에 수렴했고 새 High gap이 나오지 않았다. `cxc-search`의 3-no-lead 규칙을 문자 그대로 세 번 채운 것은 아니지만, 이 task는 local implementation-source comparison이고 crux 세 개가 모두 disposition을 얻어 더 파견할 독립 축이 사라졌다.

## Final gap verdict

가장 큰 격차는 **능동 parser가 아니라 durable execution memory**다.

CodexClaw은 이미:

- generic search의 semantic routing prose;
- explicit agbrowse parser;
- native subagent dispatch와 skill attachment;
- persistent goalplan/FSM/Stop continuation;
- source-proof search rules를 갖고 있다.

하지만 Tier 3의 wave, open lead, claim proof, disposition은 transcript/main-agent discipline에만 있고 goalplan/ledger에 남지 않는다. compaction 뒤 “다음에 무엇을 파견해야 하는가”를 runtime이 복원할 수 없다.

## Recommended implementation roadmap

1. **P0 docs/source-truth correction** — `spawn-attach-hook.ts`의 V1/V2 common inline truth에 맞춰 `search/SKILL.md`, dispatch/native capability docs를 고친다. Omitted skill은 절대 invent하지 않는다.
2. **P1 structured goalplan research projection** — existing research work-phase 아래 tasks가 lane/lead/wave-close를, criteria가 claim proof를 소유한다. `steering.ts`/`goalplan-cli.ts`에 additive create와 fail-closed resolve/capture verbs를 추가하고, Stop/completion은 이미 읽는 pending task/open criterion을 그대로 소비한다. Ledger는 run/lane/lead/claim/wave lifecycle의 history를 mirror하며 state를 재구성하지 않는다.
3. **P1 main-dispatch return contract** — `search/SKILL.md`의 main-agent spawn packet에 EXPAND tail을 요구하고, main이 반환을 structured task/criterion mutation으로 기록한다. Dormant `routeDispatch` builder에는 의존하지 않는다; G7 caller proof 없이는 builder wiring을 별도 구현하지 않는다.
4. **P2 evidence lineage** — expected truth, support/counter observation, source validity, contamination, excursion ENTER/EXIT를 existing task/criteria/ledger에 map한다.
5. **Conditional P2 named deep-research arm** — 실사용에서 Tier 3 under-fire 증거가 있을 때만 explicit `ulw-research`/`deep research`/`심층 조사` directive를 추가한다. Ordinary 검색/설명/latest에는 fire하지 않고 goal/create/spawn/FSM을 자동 실행하지 않는다. Deep research wording alone never authorizes `create_goal`; HOTL still requires separate autonomous/continue-until-done intent.

## Rejected transfers

- OMO global ultrawork substring parser와 OMO Senpi adapter process-global arming.
- OMO maximum-roster/team/librarian topology와 mandatory PDF/DOCX.
- OpenCode BackgroundManager/parent-wake queue/result archive.
- Senpi duplicate goal/todo/background terminal runtime와 hidden continuation loop.
- `senpi-task` child engine와 second task ID/state directory.
- generic semantic “researchy sentence” parser.
- unobservable main-turn skill activation을 hard evidence로 기록하는 trace.

## Pessimist record

- Hypothesis killed: “OMO/Senpi가 의미 기반 active research parser로 앞선다.” 실제 parser는 named modes/keywords이고 semantic intent는 prompt-only다.
- Hypothesis weakened: “wake-source accounting을 바로 Stop에 넣으면 된다.” CodexClaw이 host live source를 관측하지 못하므로 stale/fake state가 된다.
- Not improved: exact OMO beta peer Senpi `2026.8.26-2` E2E는 materialize하지 않았다. Latest `2026.8.27`은 비교 후보일 뿐이다.
- Wrong-direction signal: implementation이 새 scheduler, hidden timer, goal DB, task ID namespace, generic research regex를 만들기 시작하면 이 결론을 위반한다.

## Verification status

- Production code modified: 0.
- Reference clone dirtiness: 0.
- Explorer-reported focused evidence, without committed raw output receipt: OMO Codex `17 pass`; CodexClaw six-file `188 pass`. Treat as `UNVERIFIED reported evidence`, not the basis of the final source-backed verdict.
- Explorer-reported blocked evidence, without committed raw output receipt: OMO Senpi command `0 pass / 4` dependency-resolution failures before test bodies. All affected claims are source/test-only.
- Final independent citation/semantic audit: pending C.

## C review synthesis

First C review of commit `ae5e812ff848cf860d0185756b7383aee58862a3` returned roadmap `FAIL` and factual `NEAR-PASS`.

- Accepted: generic parser/new FSM/scheduler/wake bus/duplicate DB rejections and durable research memory as the central gap.
- Fixed: ledger-only false state, inconsistent lifecycle names, dormant builder dependency, mode-triggered `create_goal`, G1 priority, prior-row keys, OMO Senpi ownership, wake-source citation, reported-vs-executed labels, spawn receipt strength, claim-level citations.
- Canonical post-fix state: structured work-phase/tasks/criteria are authoritative; successful CLI/steering mutations mirror history to the ledger; Stop/completion never reduce state from prose ledger events.
