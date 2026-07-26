# 063 — V2 서브에이전트 archive 진실성 문구

출처: `002` #2 (ADAPT / E7) · 의존: 없음 · 상태: PLANNED
소유자: `plugins/codexclaw/skills/pabcd/SKILL.md` 단일

## 문제

`plugins/codexclaw/skills/pabcd/SKILL.md:353-354`은 `interrupt_agent`만 설명하고
close/archive의 의미를 규정하지 않는다. upstream은 V2 표면에 런타임 archive가 없다는
사실을 테스트로 고정했다
(`devlog/.lazycodex/plugins/omo/test/teammode-transport.test.mjs:215-248`;
`devlog/.lazycodex/plugins/omo/skills/teammode/scripts/team-state.mjs:262-276`은 그 archive가
로컬 상태 전용임을 보여준다).

존재하지 않는 런타임 동작을 "archived"/"closed"라고 보고하면 거짓 진술이다.
codexclaw이 스스로 금지하는 false-enforcement 산문과 같은 종류의 문제다.

## WP5 판정: NOOP (A 감사 2라운드, 리뷰어 Boyle)

**이 슬라이스는 구현하지 않는다.** 감사에서 근거가 무너졌다.

### 왜 NOOP인가

초안의 전제는 "V2 줄이 close/archive에 침묵해서 V1과의 대비로 오해된다"였다.
실측 결과 그 오해가 성립할 여지가 없다.

| 근거 | 위치 | 내용 |
| --- | --- | --- |
| 절 자체가 계약임을 선언 | `plugins/codexclaw/skills/pabcd/SKILL.md:347` | "**Lifecycle contract.**" |
| V1/V2 대비가 이미 명시적 | 같은 파일 `:351-354` | `close_agent`/`resume_agent`는 V1 줄에만 있다 |
| **더 강한 문장이 이미 존재** | `plugins/codexclaw/skills/lunasearch/SKILL.md:23-24` | "V1 also has `close_agent`/`resume_agent`; **V2 has only `interrupt_agent`**" |
| 같은 취지 | `plugins/codexclaw/skills/search/SKILL.md:142-148` | 동일 대비 서술 |

추가하려던 문장보다 `lunasearch:23-24`가 이미 더 명확하다. 실제 결함·사고·거짓 주장
사례가 하나도 제시되지 않았으므로, 한 문장을 위해 별도 PABCD 사이클을 도는 것은
절차만 늘리는 일이다.

### 초안이 틀렸던 부분 (기록)

리뷰어가 런타임을 직접 확인했다 (`codex-cli 0.144.5`): V2는 `followup_task`,
`send_message`, `wait_agent`, `interrupt_agent`를 노출하고 `interrupt_agent`는 **현재 턴만
멈추며 에이전트를 재사용 가능한 상태로 남긴다.** `close_agent`/`resume_agent`는 V1 전용이다.

초안이 쓰려던 "dropped the agent from local tracking"은 **codexclaw에 없는 동작**이다.
그 표현은 upstream OMO의 team-state
(`devlog/.lazycodex/plugins/omo/skills/teammode/scripts/team-state.mjs:262-276`)에서 온 것이고,
codexclaw은 에이전트 레지스트리를 갖고 있지 않다
(`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:405-429`는 V2 spawn
형태와 도구 네임스페이스만 구분한다). 그대로 넣었으면 **없는 기능을 안내하는 문장**이 됐다.

### 남은 실물 개선 하나

`interrupt_agent`가 턴만 멈춘다는 사실은 어느 문서에도 없다. 이것은 이 슬라이스가
찾아낸 진짜 공백이지만 V2 archive 진실성과는 다른 주제이므로, `120`(doc-sync 계약)의
scope에 얹는다 — 거기서 `loop`↔`pabcd` 계약 블록을 만들 때 함께 처리한다.

