# CodexClaw current surface — active parser, research state, attachment truth

Pinned HEAD: `822ba3c4e3cffd3184d2944d28c2e5de2ac8baff`

## 요약

CodexClaw은 loop/recall/FSM continuation은 deterministic runtime이 강하다. 반면 generic search/research activation, Tier 3 wave execution, claim journal은 prompt-only다. 사용자가 짚은 함정은 실제로 존재한다.

## Current mechanism matrix

| Surface | Class | Positive / negative | State/output | 판정 |
| --- | --- | --- | --- | --- |
| Generic 한국어/영어 search | prompt-only | SKILL metadata `검색/찾아봐/latest/current` / host가 skill을 고르지 않음 | load/selection state 없음. `plugins/codexclaw/skills/search/SKILL.md:2-14,244-266`, `plugins/codexclaw/skills/search/agents/openai.yaml:1-5` | GAP |
| explicit agbrowse search | deterministic-runtime | `agbrowse` + search action / 일반 `찾아봐`, implementation discussion | UserPromptSubmit directive + session dedupe. `plugins/codexclaw/components/pabcd-state/src/hook.ts:212-223,616-690` | ADOPT current narrow route |
| Tier 3 research | prompt-only | deliberate comprehensive research / ordinary lookup | 2+ wave/journal/claim ledger를 요구하지만 executor/state machine 없음. `plugins/codexclaw/skills/search/SKILL.md:118-177` | GAP |
| research dispatch builder | deterministic library, test-only as production path | explicit `routeDispatch(intent=research)` / direct native spawn | explorer + cxc-search payload를 만들지만 production caller 미확인. `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts:428-500` | DEFER caller proof |
| spawn attachment hook | deterministic-runtime | supplied plaintext recognized mention / omitted skill, opaque body | V1/V2 plaintext body inline; encrypted V2 self-load affordance. `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:745-827` | ADOPT impl, docs drift fix |
| loop + Stop | deterministic-runtime | loop phrase mandate; active goal+phase Stop / no goal, I, context/cap | repo-local session counters + block reason. `plugins/codexclaw/components/pabcd-state/src/hook.ts:232-249,625-639,1275-1336` | ADOPT |
| recall | deterministic-runtime | 지난번/last session / neutral/already-searching | CWD local context and explicit search directive. `plugins/codexclaw/components/recall/src/hook.ts:60-129,150-260` | ADOPT |
| divergence | deterministic record state | explicit CLI, flat maximize plateau / improving/inactive | mode JSON/candidate JSONL; mode itself은 Stop activation을 통제하지 않음. `plugins/codexclaw/components/pabcd-state/src/divergence.ts:111-196`, `plugins/codexclaw/components/pabcd-state/src/hook.ts:1208-1238` | ADAPT semantics |
| activation trace | test-only/dormant | env=1 + direct TraceBuilder caller / normal session | four-layer JSONL builder는 있으나 production caller/CLI 없음. `plugins/codexclaw/components/cxc-ops/src/activation-trace.ts:1-12,45-150`, `plugins/codexclaw/components/cxc-ops/src/cli.ts:72-132` | GAP |

## Wave 1 reported probes

- Generic `최신 모델 찾아봐`, bare `검색`: CodexClaw parser `false`.
- `agbrowse로 최신 모델 찾아봐`: parser `true`.
- Scoped six test files: `188 pass / 0 fail`.

위 결과는 read-only explorer report이며 raw command output은 commit에 없다. 따라서 `UNVERIFIED reported evidence`다. Source 자체는 generic search가 runtime parser가 아니라 host implicit selection + skill prose라는 판정을 독립적으로 지지한다. Host가 실제로 어떤 skill body를 load했는지는 repo에서 관측할 수 없다.

## Attachment source/docs drift

Runtime source는 260818 이후 V1과 plaintext V2 모두 full SKILL body를 inline한다. V1 link가 자동 확장된다는 과거 가정이 틀렸음을 source comment가 직접 기록한다: `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:789-805`.

반면 search skill과 dispatch SOT 일부는 아직 V1 parser expansion / V2-only inline을 설명한다: `plugins/codexclaw/skills/search/SKILL.md:194-223`, `structure/20_pabcd_dispatch_doctrine.md:228-247`. 구현은 살아 있으나 docs가 stale이다.

Body delivery와 child compliance는 별개다. Opaque native V2는 body 대신 affordance만 줄 수 있다: `spawn-attach-hook.ts:813-827`.

## Dormant activation trace

`TraceBuilder`는 installed/visible/activated/referenced를 기록하지만 caller가 선언한 self-report다. 실제 host skill load를 관찰하는 hook은 없다: `components/cxc-ops/src/activation-trace.ts:18-43,54-150`, `structure/40_enforcement_methods.md:126-137`. MLB receipt도 activation baseline을 missing으로 남긴다: `components/pabcd-state/src/release-gate.ts:387-395`.

따라서 이를 무작정 wire해서 `activated`를 hard evidence로 쓰면 거짓 observability가 된다. Parser fired, spawn rewritten, child return cited는 관측 가능하다. Host implicit skill loaded/child obeyed는 분리해 `UNOBSERVABLE` 또는 self-report로 표시해야 한다.

## Existing strengths to preserve

- 별도 scheduler/server/role 없이 native host tools 사용.
- main-only dispatch, leaf topology, explicit skill attachment.
- durable FSM/goalplan/ledger와 exact session identity.
- Stop owner 하나와 bounded release.
- recall은 prompt injection의 untrusted delimiter를 명시하고 local cache를 rebuildable로 둔다: `components/recall/src/hook.ts:141-196`, `components/recall/src/index-db.ts:1-27`.

이 경계 때문에 OMO/Senpi whole-runtime copy는 격차 해소가 아니라 architecture regression이다.
