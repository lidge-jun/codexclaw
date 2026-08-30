# OMO Senpi adapter + senpi-task — parser와 child lifecycle

OMO HEAD: `84f98d8bd1b5c70c46e6f8a5613ffb3c787079db`
Pinned Senpi peer declared by OMO: `2026.8.26-2`
Adjacent analyzed Senpi HEAD: `2026.8.27` — exact beta behavior로 승격하지 않는다.

## Parser stack

### Skill pointer — ADAPT narrowly

`skill-pointers`는 Senpi `input` event에서 `mass ulw`, `ulw-plan`, `ulw-loop`, `ulw-research` regex를 각각 검사한다: `devlog/.omo/packages/omo-senpi/src/components/skill-pointers/index.ts:23-58,82-123`. Idle이면 hidden custom message를 보내고 queued input이면 pointer text를 append-transform한다: `devlog/.omo/packages/omo-senpi/src/components/skill-pointers/index.ts:124-148`.

Positive: explicit target spelling. Negative: plain `ulw`, near miss, extension-origin, byte-zero `/skill:<same>`, 이미 같은 `<skill name>` marker가 있는 input. State는 없고 매 input 재검사한다.

CodexClaw에는 primary user prompt를 이처럼 rewrite하는 surface가 없다. 그대로 복사하면 untrusted pasted marker가 dedup을 spoof하고 hidden instruction이 authority를 늘린다. 필요한 것은 explicit research phrase를 **mode proposal/route directive**로 분류하는 좁은 parser이지, full skill pointer 강제 주입이 아니다.

### Ultrawork overlap — REJECT

Senpi adapter ultrawork regex는 exception 없이 `ultrawork|ulw` substring을 잡아 `ulw-research`도 ultrawork와 research pointer를 동시에 발화시킨다: `devlog/.omo/packages/omo-senpi/src/components/ultrawork/index.ts:4-15`, `devlog/.omo/packages/omo-senpi/src/components/skill-pointers/index.ts:52-58`. `/skill:ulw-research`만 양쪽 OMO injection을 억제하고 native expansion에 맡긴다: `devlog/.omo/packages/omo-senpi/src/components/ultrawork/index.ts:197-230`, `devlog/.omo/packages/omo-senpi/src/components/skill-pointers/index.ts:82-105`.

Generic `deep research`는 deterministic parser가 잡지 않는다. skill metadata가 activation을 주장할 뿐이다. CodexClaw이 이 overlap을 따라갈 이유가 없다.

## Arming과 compaction

Ultrawork arming은 `globalThis[Symbol.for("omo.ultrawork.arming")]`의 process-global Set에 session ID를 넣는다: `devlog/.omo/packages/omo-senpi/src/components/ultrawork/index.ts:67-140,214-246`. 첫 trigger는 full directive, 이후는 reminder다: `devlog/.omo/packages/omo-senpi/src/components/ultrawork/index.ts:283-383`.

Accepted compaction은 armed bit를 지우고 pending으로 바꾸지만 즉시 재주입하지 않는다. 다음 ulw mention이 와야 full directive가 돌아온다. Rejected compaction은 armed를 유지한다: `devlog/.omo/packages/omo-senpi/src/components/ultrawork/index.ts:122-140,246-275`.

CodexClaw의 repo-local session JSON + PostCompact reinjection이 더 durable하므로 이 state 모델은 REJECT한다.

## Todo fanout reminder

Ultrawork-armed session에서 첫 successful `todo init|append` 결과에 fanout economics prompt를 붙인다: `devlog/.omo/packages/omo-senpi/src/components/todo-fanout-reminder/index.ts:19-69`, `devlog/.omo/packages/omo-senpi/src/components/todo-fanout-reminder/reminder.ts:1-9`. 실제 spawn이 아니라 모델에게 “독립 부분/오버헤드/카테고리”를 판단하고 사용자에게 설명하라고 요구한다.

Cost/independence 판단은 ADAPT하지만 tool-result transformer와 ultrawork coupling은 REJECT한다. Composed compaction 시 ultrawork handler가 shared armed bit를 먼저 지우므로 isolated reminder test와 production order가 어긋날 가능성도 UNVERIFIED다: `devlog/.omo/packages/omo-senpi/src/extension/component-list.ts:27-35`, `devlog/.omo/packages/omo-senpi/src/components/ultrawork/index.ts:135-140`.

## `senpi-task` child engine

실제 child fanout은 Senpi core가 아니라 OMO adapter가 `@oh-my-opencode/senpi-task`를 등록해서 제공한다: `devlog/.omo/packages/omo-senpi/src/components/task/index.ts:1-25,205-230`.

- state dir 기본값은 project `.omo/senpi-task`; per-task record/event log가 durable하다: `devlog/.omo/packages/senpi-task/src/store/state-dir.ts:1-7`, `devlog/.omo/packages/senpi-task/src/store/record-store.ts:48-95`.
- single 또는 최대 16 batch task, background handle 반환: `devlog/.omo/packages/senpi-task/src/tools/task/params.ts:5-35`, `devlog/.omo/packages/senpi-task/src/tools/task/execute-batch.ts:92-128,264-285`.
- `resume_children`이면 shutdown 때 live handle을 정리하고 suspended record를 남기며 session start에 reconcile한다: `devlog/.omo/packages/senpi-task/src/lifecycle/shutdown.ts:9-35`, `devlog/.omo/packages/omo-senpi/src/components/task/event-bridge.ts:23-60`.
- reminder alone은 spawn하지 않는다. Model이 valid task call을 해야 한다.

CodexClaw은 host-native subagents를 사용하므로 child engine/state ID를 이중화하지 않는다. Whole engine은 REJECT다. Durable child result/evidence와 wake-source semantics는 native host event가 제공하는 범위에서만 ADAPT한다.

## 위험/미검증

- OMO는 Senpi `2026.8.26-2`를 pin하지만 adjacent latest는 `2026.8.27`; `$name`/`$skill:name`, input-hook order, expanded block format이 exact beta와 같은지 UNVERIFIED.
- queued `ulw-research`는 ultrawork가 먼저 긴 directive를 append한 뒤 skill-pointer가 transformed text를 다시 읽어 directive 내부의 `ulw-loop`까지 spillover할 가능성이 있다.
- process-global arming ledger는 shutdown cleanup이 없어 session ID 재사용/장기 process accumulation을 측정하지 않았다.
- Read-only explorer reported focused tests `0 pass / 4 fail` before test bodies because a workspace package was missing; raw command output is not committed. Source evidence만 사용한다.
