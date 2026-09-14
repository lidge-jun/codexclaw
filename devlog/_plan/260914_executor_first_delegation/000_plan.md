# 260914 planning consultation and implementation delegation

## Reader summary

이 변경은 명세·수정 범위·검증 방법이 확정된 구현을 executor에 우선 배정하고,
P 계획에 담당을 기록해 B에서 그 분담을 실행하도록 안내한다. 후속 변경은 기존
architect 절차도 P 진입 시 알린다. Architect가 설계를 제안하고, 메인이 실행 계획을
쓴 뒤, 같은 architect가 반영 상태를 확인하는 순서와 실제 결과를 계획에 남긴다.
메인이 최종 판단과 통합을 맡으며, 두 규칙 모두 모델이 따르는 지침이다.

근거와 소스 앵커는 [001_source_evidence.md](001_source_evidence.md)에 있다.
기존 executor 작업의 wp1–wp4와 검증 기록은 아래에 보존한다. 승인된 architect
후속 변경의 범위·분담·검증은 [040](040_architect_consultation.md)에 기록한다.

## Loop spec

| Field | Content |
| --- | --- |
| Loop archetype | satisfy-spec. 정해진 문구/배선을 넣고 실제 주입 출력으로 확인한다. |
| Trigger | 사용자 요청: 구현 위임을 기본값으로 만들어 메인 모델 비용을 줄이고, 로컬 구현 후 격리 환경에서 검증한 뒤 CXC에 PR. |
| Goal | P에서 구현 담당이 기록되고 B에서 그 담당이 실행되도록, dev/pabcd 지침과 P/B 단계 안내가 연결된다. |
| Non-goals | 전역 AGENTS.md 수정, 모델별 강제 규칙, 최소 호출 수 강제, 새 런타임 하드 게이트, 설치본 덮어쓰기, push/PR/merge/release. |
| Verifier | `node plugins/codexclaw/scripts/build.mjs`, `npm test`, 격리 CODEX_HOME 설치본에서의 실제 directive 출력. 아래 PLAN-VERIFIER-REAL-01 참고. |
| Stop condition | wp4의 격리 주입 증거와 로컬 커밋까지. push/PR은 별도 승인 단계. |
| Memory artifact | 이 유닛(`devlog/_plan/260914_executor_first_delegation/`)과 goalplan `cxc-executor-p-b-home-jun-code-worktrees-codexcl`. |
| Expected terminal outcomes | DONE = 문구·배선·테스트·격리 주입 증거·로컬 커밋 완료. NOOP = 동등 지침이 이미 존재. BLOCKED = 격리 설치가 호스트 제약으로 불가. NEEDS_HUMAN = 정책 문구 방향 결정 필요. |
| Escalation condition | 같은 packet을 서로 다른 에이전트가 두 번 실패하면 메인이 회수(DISPATCH-RETIRE-01). 계획에 없는 슬라이스를 B 중간에 위임하려면 P 수정이 먼저. |

## HOTL resource bounds

- Write scope: `/home/jun/code-worktrees/codexclaw/executor-first-delegation` 워크트리와
  네이티브 cwd `/home/jun/code/codexclaw`의 `.codexclaw/` 상태·증거, 그리고 wp4의 임시 CODEX_HOME.
- Tool/credential scope: 로컬 셸, git(로컬 커밋까지), 서브에이전트 dispatch. 네트워크·유료 API·계정 변경 없음.
- Token/cost budget: 호스트 토큰 예산은 설정하지 않음. 모델 비용은 메인 + executor 합산으로만 논의하고, 측정 없이 절감액을 주장하지 않는다.
- Wall-clock bound: 이 세션 내. 자원 한도 초과는 DONE이 아니라 BUDGET_EXHAUSTED.

## Work-phase map (dependency order)

| Phase | Outcome | Depends on | Doc |
| --- | --- | --- | --- |
| wp1 | 이 로드맵(문서만, 구현 없음) | — | 이 문서 |
| wp2 | 지침 문구: 판단 기준의 단일 소유자와 계획 규약 | wp1 | [010](010_wp2_policy_text.md) |
| wp3 | 단계 안내 배선: hook/CLI가 그 소유자를 가리킴 | wp2 | [020](020_wp3_directive_wiring.md) |
| wp4 | 격리 검증과 로컬 커밋 | wp3 | [030](030_wp4_isolated_verification.md) |

순서 근거(PHASE-SPLIT-01): 판단 기준이 먼저 존재해야 단계 안내가 그것을 가리킬 수 있고,
배선이 끝나야 격리 환경에서 실제 주입 문자열을 확인할 수 있다. 노력 크기로 자른 분할이 아니다.

## File change map

| Path | Action | Phase |
| --- | --- | --- |
| `plugins/codexclaw/skills/dev/SKILL.md` | MODIFY: `### Implementation delegation` 신설 | wp2 |
| `plugins/codexclaw/skills/pabcd/references/plan-output.md` | MODIFY: `## Implementation ownership` 신설 | wp2 |
| `plugins/codexclaw/skills/pabcd/SKILL.md` | MODIFY: B 항목에 담당 실행 문장 | wp2 |
| `structure/20_pabcd_dispatch_doctrine.md` | MODIFY: DISPATCH-ECONOMY-01에 구현 담당 소유자 포인터 | wp2 |
| `structure/INDEX.md` | CONDITIONAL: 규칙/소유자 목록이 실제로 있을 때만 동기화. 없으면 `N/A + 이유` 기록 | wp2 |
| `plugins/codexclaw/components/pabcd-state/src/hook.ts` | MODIFY: P/B directive에 포인터 한 줄 | wp3 |
| `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts` | MODIFY: P/B 진입 성공 출력에 포인터 | wp3 |
| `plugins/codexclaw/components/pabcd-state/dist/hook.js`, `dist/orchestrate-cli.js` | REBUILD: 설치 payload가 dist를 쓰므로 빌드 산출물도 커밋 | wp3 |
| `plugins/codexclaw/components/pabcd-state/test/hook.test.ts` | MODIFY: P/B 포인터 단언 | wp3 |
| `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts` | MODIFY: P/B 출력 포인터 단언 + 다른 verb 미포함 | wp3 |
| `plugins/codexclaw/inventory.json` | 변경 없음 예상: `build.mjs`는 inventory를 재생성하지 않는다. 실제로 변하면 그때 함께 커밋 | wp3 |

Scope boundary (OUT): `/home/jun/.codex/AGENTS.md`, 설치본 `/home/jun/.codex/plugins/cache/**`,
`agents/*.toml` 역할 정의, fallback/모델 선택 코드, 새 CLI 서브커맨드, 전역 하드 게이트.

## Accept criteria

1. `dev/SKILL.md`에 구현 위임 기본값과 직접 구현 예외 3종이 있고, 예외가 아닌 사유
   ("순차 작업이라서", "이미 이해해서")를 명시적으로 배제한다.
2. `plan-output.md`가 파일 변경마다 담당과 직접 구현 사유를 요구한다.
3. `pabcd/SKILL.md` B가 계획된 담당을 실행하도록 dev 소유자를 가리킨다.
4. `phaseDirective("P")`와 `phaseDirective("B")` 출력에 포인터가 포함된다.
5. `orchestrate P` / `orchestrate B` 성공 출력에 같은 포인터가 포함되고, `status`와
   `A`/`C`/`D` 출력에는 포함되지 않는다.
6. `npm test` 0 failures, 빌드 exit 0.
7. 격리된 임시 CODEX_HOME의 설치본에서 P/B 진입 시 포인터가 실제 출력에 나타난다.
8. 변경이 `codex/executor-first-delegation`에 로컬 커밋되고 push는 없다.

### Conditional-path activation (C-ACTIVATION-GROUNDING-01)

이 유닛이 추가하는 유일한 조건부 경로는 "P/B일 때만 포인터를 붙인다"이다.
활성화 시나리오: wp3 테스트가 `P`와 `B`에 대해 포인터 포함을, `A`/`C`/`D`와
`status`에 대해 미포함을 각각 단언한다. 관측 효과: 두 경우의 실제 문자열 차이.
wp4는 같은 분기를 설치본에서 한 번 더 실행해 관측한다.

### PLAN-VERIFIER-REAL-01

| Verifier | 이 유닛의 변경을 실제로 읽는가 | 확인 방법 |
| --- | --- | --- |
| `npm test` | 예 | `package.json` test 글롭에 `components/pabcd-state/test/*.test.ts`가 포함됨 |
| `node plugins/codexclaw/scripts/build.mjs` | 예 | `src/*.ts` → `dist/*.js` 변환 대상에 hook/orchestrate-cli 포함 |
| 격리 CODEX_HOME 실행 | 예 | 설치된 payload의 `dist`를 직접 실행해 문자열 관측 |

`npm test` 실행 전 wp3에서 RED 확인(새 단언이 기존 코드에서 실패)을 먼저 남긴다.

### PLAN-BYPASS-NAMED-01

| Field | Value |
| --- | --- |
| Tier | E7 (agent-followed doctrine). 문구는 훅이 강제하지 않는다. |
| Executing surface | `UserPromptSubmit` 훅의 phase directive와 `cxc orchestrate` CLI 출력 |
| Known bypass | 모델이 주입된 문장을 읽고도 직접 구현할 수 있다. 훅 출력은 조언이며 차단이 아니다. |
| Residual risk | 실제 위임 비율은 보장되지 않는다. 효과는 관측으로만 판정한다. |
| Downgraded wording | 그렇다. "enforcement"가 아니라 "early warning/pointer"로 쓴다. |

### SoT sync target (SOT-SYNC-01)

`structure/20_pabcd_dispatch_doctrine.md`가 이 유닛의 SoT다. wp2에서 함께 패치한다.
`structure/INDEX.md`는 실제로 규칙/소유자 목록을 들고 있을 때만 동기화하고,
아니면 010 문서에 `N/A + 이유`로 남긴다.

## Implementation ownership (이 유닛 자체의 분담)

이 유닛은 제안하는 규칙을 스스로 적용한다.

```text
wp1 로드맵과 정책 문구 결정 — main: 판단 자체가 산출물이라 위임 불가
wp2 지침 문구 반영 — main: 문장 자체가 판단물이며 슬라이스가 작음
wp3 hook/CLI 배선과 테스트 — executor: 수정 파일과 검증 방법이 확정됨
wp4 격리 설치 검증 — main: 호스트 환경 조작과 증거 판정이 필요
```

wp3 위임 결과는 VCS diff로 검증한다(보고서만으로는 완료로 보지 않는다).
