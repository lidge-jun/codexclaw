# 003 — 독트린 대조 탐색 보고 (탐색 에이전트 Rawls, gpt-5.6-sol)

수집: 2026-07-10, 사이클 2 선행 탐색. 읽기 전용. 사이클 2 B의 근거 소스.

## 1) 규칙 ID 교차표

| 규칙 ID | skills 선언 | structure 선언 | 대조 결과 |
|---|---|---|---|
| `AUDIT-LOOP-01` | `pabcd/SKILL.md:71,133`; `loop/SKILL.md:283`; `dev-code-reviewer/SKILL.md:110`; `search/SKILL.md:191` | `structure/20_pabcd_dispatch_doctrine.md:77` | **괴리** — 런타임 보장 수준과 reviewer 필수성이 다름 |
| `DEV-ROUTE-01` | `dev/SKILL.md:133-142` | `structure/30_contradiction_register.md:33` | 일치 |
| `DISPATCH-ACTOR-01` | `pabcd/SKILL.md:133`; `loop/SKILL.md:291`; `qa/SKILL.md:130` | `structure/20_pabcd_dispatch_doctrine.md:122-133`; `structure/10_subagent_skill_routing.md:184` | 일치 |
| `DISPATCH-RETIRE-01` | `loop/SKILL.md:119,292` | `structure/20_pabcd_dispatch_doctrine.md:134-140` | 의미 일치; `structure/10_subagent_skill_routing.md:184`는 오기 `RETIRE-01` 사용 |
| `LEAF-TOPOLOGY-01` | `pabcd/SKILL.md:409`; agents `executor.toml:13-14`, `reviewer.toml:13-14`, `explorer.toml:14-15` | `structure/20_pabcd_dispatch_doctrine.md:111-120` | skill↔structure 일치; agent 프롬프트의 예외 토큰 위치가 다름 |
| `LOOP-REPAIR-01` | `pabcd/SKILL.md:133,376-381`; `loop/SKILL.md:265-283` | `structure/20_pabcd_dispatch_doctrine.md:140` | skills 간 일치; structure는 비유적 참조만 |
| `QA-TOOL-LADDER-01` | `dev-testing/SKILL.md:230-252`; `qa/SKILL.md:26-28` | `structure/60_native_capabilities.md:101-105` | 일치 |
| `SEARCH-BROWSE-01` | `search/SKILL.md:65-93` | `structure/60_native_capabilities.md:101-105` | 일치 |
| `DISPATCH-TASK-01` | `pabcd/SKILL.md:439-442`; `qa/SKILL.md:113` | ID 없음; `structure/20_pabcd_dispatch_doctrine.md:104-110`에 부분 내용만 | structure SOT 부분 누락 |
| `LOOP-CONTINUE-01` | `loop/SKILL.md:103,217`; `pabcd/SKILL.md:389-394` | ID 없음 | skills-only |
| `SESSION-IDENTITY-01` | `pabcd/SKILL.md:98-106`; `loop/SKILL.md:19-21` | ID 없음; 완화책만 `structure/60_native_capabilities.md:116` | skills-only |

## 2) Canonical 소유 검증

일치: LOOP-REPAIR-01 canonical(`loop/SKILL.md:282` → `pabcd/SKILL.md:376-381`), lifecycle 소유(`structure/20:122-140`), SESSION-IDENTITY-01(`pabcd/SKILL.md:98-106`), QA 소유(`dev-testing:230-269`/`qa:30-37`), Interview canonical(`interview/SKILL.md:23-89`), deprecated redirect 3종 목적지 실존.

불일치:
- visibility canonical은 `dev/SKILL.md:176`의 8개 집합(+ `dev-frontend/agents/openai.yaml:5`, `dev-uiux-design/agents/openai.yaml:5`)인데 `structure/INDEX.md:138`은 6개, `structure/20_pabcd_dispatch_doctrine.md:163-168`은 deprecated `skill-hub` 포함 옛 집합.
- `structure/60_native_capabilities.md:15-16`은 단일 소유 인벤토리 선언이지만 소유 표(`:67,69,71`)가 deprecated 스킬을 현행 owner로 유지.

## 3) Deprecated 잔존 참조

- `cxc-goalplan` 활성형: `structure/60_native_capabilities.md:67`; `structure/INDEX.md:147,168`.
- `cxc-skill-hub` 활성형: `structure/20_pabcd_dispatch_doctrine.md:167`; `structure/60_native_capabilities.md:71,131`; `structure/INDEX.md:162,168`.
- `cxc-ultraresearch` 활성형: `structure/60_native_capabilities.md:69,129`; `structure/INDEX.md:166`.
- 의도적 redirect 표기(결함 아님): `structure/INDEX.md:239`; `loop/SKILL.md:161`; `search/SKILL.md:116`; `pabcd/SKILL.md:104`; `dev/SKILL.md:176,180`; `skills/README.md:24,41,45`.

## 4) 발견 사항

1. **High:** `structure/20_pabcd_dispatch_doctrine.md:77-78` "structurally needs a real reviewer dispatch" vs `pabcd/SKILL.md:133` "form-only bar: the gate cannot verify the paste's provenance" — 허위 enforcement claim.
2. **High:** `structure/20_pabcd_dispatch_doctrine.md:101-102`는 A 감사를 "reviewer subagent or a direct file:line audit"로 허용, `pabcd/SKILL.md:133`은 reviewer dispatch를 STRICT 요구 — 따르는 문서에 따라 dispatch 생략 가능.
3. **High:** `structure/10_subagent_skill_routing.md:9` "live spawn surface is multi_agent_v2" vs `pabcd/SKILL.md:406` + `structure/60_native_capabilities.md:24-35,117` V1 default/V2 opt-in — namespace/lifecycle verb 선택 오류로 직결.
4. **Med:** visibility 집합 불일치(`structure/INDEX.md:138`, `structure/20:163-168` 스테일).
5. **Med:** `structure/60_native_capabilities.md:67,69,71` deprecated 스킬을 owner로 지정 — redirect 선언과 정면 충돌.
6. **Med:** `structure/INDEX.md:147,162,166` deprecated 3종을 표기 없이 현행 catalog처럼 서술.
7. **Med:** agents toml 예외 토큰 위치("your dispatcher's task message", `executor.toml:14` 등) vs canonical("outgoing message", `pabcd/SKILL.md:409`) — 의도된 재귀 dispatch도 거부될 수 있음.
8. **Low:** `structure/10_subagent_skill_routing.md:184` `RETIRE-01` 오기(canonical: `DISPATCH-RETIRE-01`).
9. **Low:** `DISPATCH-TASK-01` packet 계약(6요소, `pabcd/SKILL.md:439-442`)이 dispatch SOT(`structure/20:104-110`)에 부분만 반영.

## 5) 사용한 명령

```bash
rg --files plugins/codexclaw/skills structure plugins/codexclaw/agents
rg -n -o '\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[0-9]{2}\b' <허용 범위>
comm -12 <(rg ... skills | sort -u) <(rg ... structure | sort -u)
rg -n -i 'canonical wording|canonical owner|owned by|single source of truth' <허용 범위>
rg -n 'cxc-goalplan|cxc-skill-hub|cxc-ultraresearch' <허용 범위>
```

모든 명령은 읽기 전용, 파일 무수정.
