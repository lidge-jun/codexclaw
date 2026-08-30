# 000 — config-autopilot: Plan

## Objective

codexclaw가 사용자 `~/.codex/config.toml`의 **비-feature 키**를 안전하게 켜고 되돌릴 수 있게 만든다.
그리고 interview가 키워드 없이는 절대 뜨지 않는 현재 진입 규칙에 정책 층을 얹는다.

출발점은 260829_memory-upgrade 플랜의 wp5가 **실행 불가**라는 사실이다.
wp5는 `memories.dedicated_tools = true`를 요구하지만, config-guard가 가진 유일한 쓰기 경로는
`codex features enable <flag>` 위임이다. 그 경로로는 `[memories]` 테이블에 손이 닿지 않는다.

증거:

| 사실 | 근거 |
|---|---|
| `dedicated_tools`는 `[features]`가 아니라 `[memories]` 테이블 키 | `~/.codex/config.toml` 65행 `[features]` vs 454행 `[memories]`; codex-rs `config/src/types.rs:299,344` (기본값 false) |
| config-guard는 config.toml을 파싱하지 않는다고 스스로 선언 | `components/config-guard/src/features.ts:1-4` |
| 선언 어휘가 네 개 boolean 플래그로 닫혀 있다 | `features.ts:6` `DECLARED_FEATURES`, `features.ts:44` `declared.has(name)` 필터 |
| 유일한 직접 편집은 setter가 아니라 CLI 사후 복구 | `activate.ts:58` `preserveMultiAgentV2Table` |
| 참조 구현이 옆 저장소에 이미 있다 | opencodex `src/codex/features.ts:415` `setMaxConcurrentThreads` — "the codex CLI has no persisted setter for nested feature config (`-c` is per-invocation only)" |

## 온톨로지 정정 (렌즈 파견 결과, 초기 가정 폐기)

사용자 요청을 그대로 구현하면 엉뚱한 파일을 고치게 되는 지점이 세 곳 있었다.

| 초기 가정 | 실제 | 근거 |
|---|---|---|
| `dedicated_tools`를 `DECLARED_FEATURES`에 추가하면 된다 | 그 map에 **구조적으로 표현 불가**. `parseFeaturesList`가 선언 목록으로 필터하고, 애초에 `[features]` 소속이 아니다 | `features.ts:6,44` |
| interview를 기본으로 켜려면 `flags.interview`를 true로 | `flags.interview`는 **파생 예측자**(`isInterviewReady`). true로 두면 "인터뷰가 이미 끝났다"는 뜻이 되어 의도의 역이고, I→P 소프트 게이트를 자동 통과시킨다 | `interview.ts` `isInterviewReady`, `state.ts:392`, `orchestrate-cli.ts:513` |
| 진입 규칙만 바꾸면 끝 | goal 활성 시 interview는 **의도적으로** 억제되고 `request_user_input`은 하드 거부된다. 정책은 이 억제를 반드시 보존해야 한다 | `goal-active.ts:87` (fail-closed), `goal-gate.ts:61`, `hook.ts:707` |

추가로, 자동 활성화 자체가 선례와 충돌한다. `features.ts:18-20`은 `multi_agent_v2`를
"사용자 소유 스위치라 codexclaw가 강제하지 않는다"며 일부러 비선언으로 남겼다.
`dedicated_tools`는 같은 모양(off-by-default, 부수효과 있음)이므로 **기본 설치에서 자동으로 켜지 않는다.**
이 유닛이 만드는 것은 스위치를 켜는 기본값이 아니라, 켜고 되돌릴 수 있는 **정확한 표면**이다.

## Loop-spec

- Loop archetype: verifier-defined. `npm test` + `cxc doctor`가 done을 정의한다.
- Trigger: 사용자 요청 — 도구 활성화까지 포함한 계획 확장, opencodex식 config.toml 자동 조작 배포, interview 기본 진입.
- Goal: `cxc`가 화이트리스트된 비-feature 설정 키를 켜고, 외부 드리프트 뒤에도 자기 것만 되돌리고, interview 진입을 정책으로 고를 수 있다.
- Non-goals: `generate_memories` 값 결정(260829_memory-upgrade 020 §0.4 미결, 사용자 소관), `~/.codex/memories` 쓰기, 실제 사용자 config.toml에 대한 이번 사이클 쓰기, `dedicated_tools` 기본 활성화.
- Verifier: `npm test` (node --test, 신규 테스트 포함), `cxc doctor` overall PASS.
- Stop condition: c1~c6 전부 met + 각 decade doc이 한 사이클로 소진.
- Memory artifact: 이 유닛 `devlog/_plan/260829_config-autopilot/` + 바인딩된 goalplan/ledger.
- Write scope: `plugins/codexclaw/components/config-guard/{src,test}`, `plugins/codexclaw/components/pabcd-state/{src,test}`, `plugins/codexclaw/hooks`, `devlog/_plan/260829_config-autopilot/`.
- Out-of-scope: `~/.codex/memories`(read-only 절대, md5 `9c6bdc0b2c879b0a3b20632aec83c81e`), 실제 `~/.codex/config.toml`, `devlog/_plan/260829_goalplan-dependency-execution/`(다른 세션 소유), `devlog/_plan/260829_memory-upgrade/`(선행 유닛, 참조만).
- 예상 종료: DONE. BLOCKED은 상위 API 부재, NEEDS_HUMAN은 generate_menories 결정 요구 지점, BUDGET_EXHAUSTED는 서브에이전트 쿼터 소진(이미 2기 사망 — MONTHLY_REQUEST_COUNT).
- HOTL 자원 경계: 도구 범위는 로컬 파일 편집 + `node --test` + `cxc`. 네트워크 쓰기 없음. push 없음. 벽시계 무제한, 서브에이전트는 쿼터 소진 상태라 인라인 검증 우선.

## Work-phase map (one phase = one full PABCD cycle)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp1 | 000 (이 문서) | docs-only 로드맵 — 아래 decade doc 전부를 diff-level로 작성하고 로드맵을 잠근다 | — |
| wp2 | 010 | `setTableKey` + `CONFIG_MANAGED_KEYS` 화이트리스트 (순수 문자열 변환 + 원자적 쓰기) | wp1 |
| wp3 | 020 | 매니페스트 v2 + 키 단위 드리프트 가드로 해제 대칭 복구 | wp2 (setter가 기록할 형태를 먼저 확정) |
| wp4 | 030 | interview 진입 정책 `off|new-unit|always` | wp1 (config-guard와 독립) |
| wp5 | 040 | `cxc config` 표면 + 패키징/doctor/hook-trust 반영 | wp2, wp3, wp4 |

의존 순서 근거(PHASE-SPLIT-01): wp2가 스키마/계약(어떤 키를 어떤 형태로 쓰는가)을 낳고,
wp3가 그 형태를 되돌리는 역함수를 만들고, wp5가 둘을 사용자 표면에 노출한다.
wp4는 다른 컴포넌트라 순서상 어디든 들어갈 수 있으나 wp5의 CLI 표면이 그것도 노출하므로 wp5 앞에 둔다.

## Accept criteria

goalplan `criteria[]`와 1:1로 대응한다.

- c1 — 이 유닛에 000/010/020/030/040이 diff-level로 존재하고 LEXICO-SPLIT-01(번호 분리, 연구/구현 혼합 금지)을 만족한다.
- c2 — `setTableKey`가 CRLF 파일, 주석 달린 키, 인접 테이블, `[memories]` 테이블 부재를 모두 보존/정확 처리한다. 활성화 시나리오: 각 케이스를 픽스처 문자열로 직접 넣어 반환값을 대조한다.
- c3 — 외부 writer가 config.toml을 수정한 뒤에도 `cxc disable`이 codexclaw가 설정한 키만 되돌리고 남의 변경은 남긴다. 활성화 시나리오: 매니페스트 기록 후 무관한 줄을 삽입하고 deactivate를 호출한다.
- c4 — 진입 정책이 `always`여도 goal 활성 상태에서는 진입하지 않는다. 활성화 시나리오: `getGoalActiveStatus`를 주입으로 `active`/`unreadable`로 고정하고 정책을 `always`로 둔다.
- c5 — `cxc config`가 화이트리스트 밖 키를 거부하고 doctor/packaging 테스트가 초록이다.
- c6 — 각 구현 사이클 종료 시 `npm test` 전체 통과 + 사용자 `~/.codex/memories` md5 불변.

## SoT sync target (SOT-SYNC-01)

`plugins/codexclaw/components/config-guard/src/features.ts` 상단 모듈 주석이 "이 모듈은 config.toml을
파싱하지 않는다"는 불변식을 선언한다. wp2가 그 불변식의 예외를 만들므로, 같은 사이클의 C에서
그 주석과 `README`의 설정 관리 절을 갱신한다. 새 파일 `toml-edit.ts`가 편집 책임을 단독으로 지고
`features.ts`는 위임 전용으로 남는 형태를 문서에 명시한다.

