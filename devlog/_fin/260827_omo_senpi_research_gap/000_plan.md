# 260827 OMO beta + Senpi → CodexClaw 능동 조사 격차 분석 계획

Date: 2026-08-27
Session: `01a04292-0ed2-7172-87ae-1b2640d8626f`
Mode: HITL `cxc-loop`, 단일 work-phase, docs-only research
Class: C5 research → 이 사이클에서는 구현하지 않고 C2-C4 후보로 재분류한다.

## Loop spec

- Archetype: open-ended comparative research, evidence-backed collapse
- Trigger: OMO beta와 Senpi의 능동 조사·파싱·병렬 파견 메커니즘을 뜯어 CodexClaw의 현재 격차를 찾는다.
- Goal: 현재 원본 SHA에 고정된 소스 인용으로 ADOPT / ADAPT / REJECT / DEFER 판정과 의존 순서가 있는 업그레이드 후보를 남긴다.
- Non-goals: `plugins/codexclaw/` 프로덕션 수정, npm 설치, 전역 설정 변경, push, release, OMO/Senpi 코드의 직접 복사.
- Verifier: 아래 C 명령이 참조 클론 SHA, 문서 인용, 판정표, 프로덕션 무변경을 직접 읽는다.
- Stop condition: 두 원본과 CodexClaw의 대응 표면이 모두 인용되고, 격차마다 판정·위험·검증법·선행조건이 붙으면 종료한다.
- Memory artifact: 이 유닛의 `000-009` 문서와 `devlog/.omo`, `devlog/.senpi` 로컬 참조 클론.
- Expected terminal outcomes: `DONE`(비교·우선순위 확정), `NOOP`(실질 격차 없음), `BLOCKED`(원본 소스 접근 불가), `NEEDS_HUMAN`(서로 양립 불가능한 제품 방향), `UNSAFE`(자동 실행/권한 경계를 약화시키는 채택만 가능).
- Escalation: 두 개의 독립 explorer가 같은 조사 축에서 증거를 못 찾으면 main이 회수한다. 새 축을 worker에게 넘기거나 프로덕션 구현으로 확장하는 일은 새 PABCD 사이클로만 한다.

## 고정 원본

| 원본 | 로컬 경로 | 기준 | 용도 |
| --- | --- | --- | --- |
| Oh My OpenAgent | `devlog/.omo` | HEAD/tag/clone root version `84f98d8…` / `v5.0.0-beta.22` / `5.0.0-beta.22` | npm `omo-ai@beta=5.0.0-0.beta.22`의 registry `gitHead`와 같은 commit으로 고정 |
| Senpi | `devlog/.senpi` | local HEAD/main/origin-main `703d9d7…` | 조사 시작 시 `git ls-remote` main과 같은 commit으로 고정 |
| CodexClaw | repository worktree | 현재 HEAD + dirty 보존 | 비교 대상 |

두 참조 클론은 `.git/info/exclude`에만 등록한다. 부모 저장소의 배포 산출물이나 gitlink가 아니다.

### 외부 identity receipt (2026-08-27 Asia/Seoul)

다음 결과를 P에서 직접 얻었다. clone 내부 파일만으로 npm/remote 최신성을 추정하지 않는다.

```text
npm view omo-ai@beta name version dist-tags repository gitHead --json
version=5.0.0-0.beta.22
gitHead=84f98d8bd1b5c70c46e6f8a5613ffb3c787079db

git ls-remote https://github.com/code-yeongyu/oh-my-openagent.git refs/heads/dev
f356d17816aad57eb248b42a2f30ec0f1b14fde8

git ls-remote https://github.com/code-yeongyu/senpi.git refs/heads/main
703d9d7676b3419273765a4566dd02c1abe75d70
```

OMO의 최신 `dev`와 npm beta는 다르다. 이 유닛은 설치 대상인 beta만 판정한다.

## 현재 신호와 조사 가설

이전 `260725_lazygap2_omo419_parity`는 OMO 4.19.1의 loop/orchestration 델타를 조사했다. 이번에는 그 결론을 복사하지 않고 5.0 beta와 Senpi 최신 상태에서 다음 가설을 반증한다.

1. CodexClaw의 검색은 명시적 검색어와 phase discipline에는 강하지만, 사용자 문장에서 조사 필요성을 뽑아 query family와 후속 파견으로 바꾸는 활성화 계층이 약하다.
2. `cxc-search` Tier 3는 EXPAND/wave/claim-ledger 계약은 있으나 이를 능동적으로 실행시키고 결과를 다음 wave로 먹이는 런타임 상태가 없다.
3. CodexClaw은 leaf topology와 역할·skill attachment를 엄격히 지키지만, OMO/Senpi처럼 작업 중 발견한 후속 탐색을 background task/todo/goal 상태로 승격하는 표면은 약할 수 있다.
4. 반대로 OMO/Senpi의 편의 메커니즘 중에는 CodexClaw의 명시적 FSM, 사용자 승인, source-proof, bounded continuation보다 약한 것이 있다. 기능 수를 parity로 오판하지 않는다.

## 소유권·신뢰 경계

기능 이름만으로 원본을 묶지 않는다. 모든 메커니즘 행은 아래 owner 중 하나를 쓴다.

| Owner | 의미 | evidence class |
| --- | --- | --- |
| Senpi core | dynamic system prompt, agent loop, builtin goal/todo/terminal/monitor | prompt-only / deterministic-runtime / test-only / executed 중 하나 |
| OMO Codex adapter | Codex hook parser, transcript suppression, Codex-specific skill arming | 같은 네 분류 |
| OMO Senpi adapter | Senpi prompt parser, skill pointer, session arming, OMO task/team extension | 같은 네 분류 |
| OMO shared skill/prompt | `ulw-research`, ultrawork prompt, loader-visible prose contract | 같은 네 분류 |
| OMO OpenCode runtime | delegate/background task, task graph, Ralph/goal runtime | 같은 네 분류 |
| CodexClaw | hook/FSM/runtime 또는 skill text contract | 같은 네 분류 |

각 행은 owner 외에도 `execution surface`, `trusted/untrusted input`, `state path + lifetime`, `output`, `disable/bypass`, `positive trigger`, `negative trigger`, `before→after observation`을 반드시 가진다. Senpi `IntentGate`처럼 모델에게 분류를 지시하는 텍스트는 parser/enforcement로 부르지 않는다.

## 조사 축과 산출물

| 문서 | 축 | 반드시 답할 질문 |
| --- | --- | --- |
| `001_omo_active_research.md` | OMO | ultrawork/ulw-research, IntentGate, trigger parser, dynamic prompt, background/task orchestration이 어디서 활성화되고 어떤 상태를 남기는가? |
| `002_senpi_active_research.md` | Senpi core | dynamic prompt, agent-loop parallelism, builtin goal/todo/terminal/monitor가 각각 무엇을 소유하고 후속 턴을 어떻게 예약하는가? |
| `003_omo_senpi_adapter.md` | OMO Senpi adapter | 결정적 keyword parser, skill pointer, compaction/session arming, OMO task/team child가 Senpi core와 어디서 갈리는가? |
| `004_codexclaw_current_surface.md` | CodexClaw | 현재 search/loop/dispatch/trigger/recall/divergence 구현과 문서 계약 중 실제 shipped·prompt-only·미구현 경계는 무엇인가? |
| `006_gap_matrix.md` | 종합 | 격차별 ADOPT/ADAPT/REJECT/DEFER, enforcement tier, 선행조건, 실패 위험, 활성화 증거, 구현 work-phase 후보는 무엇인가? |
| `009_closeout.md` | 검증 | 반증된 가설, 미검증 항목, fresh command output, 다음 사이클 권고를 기록한다. |

## 파견 계획

- Wave 1: OMO Codex parser, OMO Senpi parser/state, OMO shared `ulw-research`, OMO dynamic-agent prompt, OMO async/background queue, OMO persisted task graph, OMO goal/continuation, Senpi core prompt/parallelism, Senpi builtin goal/todo/terminal, CodexClaw shipped/runtime 경계를 독립 explorer가 조사한다.
- 4.19 baseline lane은 `devlog/_fin/260725_lazygap2_omo419_parity/001_axis_a_loop_orchestration.md:153-164`의 prior row와 현재 5.0 evidence를 직접 연결한다. 이 lane 없이는 `existing/changed/reopened` 판정을 만들지 않는다.
- Wave 2: Wave 1의 모순과 빈칸만 재질문한다. 동일 질문의 중복 파견은 하지 않는다.
- 모든 lane은 read-only이고 `$codexclaw:cxc-dev` + `$codexclaw:cxc-search`를 실제 skill attachment로 받는다.
- 반환 형식은 source `path:line`, 메커니즘의 입력→상태→출력 흐름, CodexClaw 대비 후보, 반증/미확인으로 통일한다.
- 각 반환은 `accepted / merged / rejected / retry` disposition과 이유를 `009_closeout.md` wave journal에 남긴다.
- Lane failure는 (a) 지정 owner를 다른 owner로 귀속, (b) source anchor 0개, (c) prompt text를 runtime으로 주장, (d) positive/negative trigger 중 하나 누락이다. 실패 시 같은 패킷을 다른 explorer에게 1회 재시도하고, 둘 다 실패하면 main이 회수한다.
- 런타임 동시 슬롯은 bounded wave로 사용한다. 완료 lane을 닫아 다음 wave를 채우며 총 파견 횟수 자체는 미리 제한하지 않는다.

## 변경 manifest

| 경로 | 작업 | 목적 |
| --- | --- | --- |
| `.git/info/exclude` | MODIFY, local only | `devlog/.omo`, `devlog/.senpi`를 부모 저장소에서 제외 |
| `devlog/.omo/` | local reference clone | OMO beta source proof |
| `devlog/.senpi/` | local reference clone | Senpi source proof |
| `devlog/_fin/260827_omo_senpi_research_gap/000_plan.md` | NEW | 조사 계약과 범위 |
| 같은 유닛 `001-006`, `009` | NEW | 소유자별 분석, 감사, 격차 행렬, 검증·종료 기록 |

프로덕션 파일 변경은 0건이어야 한다. 기존 dirty `scripts/dev-symlink.sh`, 다른 untracked devlog 유닛과 `mktemp:`는 건드리지 않는다.

## 수용 기준

1. 두 클론 HEAD가 고정 SHA와 정확히 일치한다.
2. OMO/Senpi의 각 핵심 주장에 로컬 `path:line` 인용이 있고, owner/evidence class/execution surface/input/state lifetime/output/bypass가 적힌다.
3. CodexClaw 대응 주장은 현재 checkout의 `path:line`으로 검증하며 prompt contract와 runtime enforcement를 구분한다.
4. parser/research/ULW 행마다 positive trigger와 negative trigger, before→after state, observable output이 있다. compaction/queued-turn 관련 행은 그 수명도 소스 또는 테스트로 확인한다.
5. 격차 행렬의 모든 행은 ADOPT / ADAPT / REJECT / DEFER 중 하나, 우선순위, 의존성, 위험, 활성화 검증을 갖는다.
6. 기존 4.19.1 parity와 겹치는 행은 `prior document + prior row`, `4.19 disposition`, `5.0 evidence`, `concrete delta`, `new disposition`, `reason`을 모두 쓴다. 선례가 없으면 `NEW`로 표시한다.
7. 미검증 추정은 `UNVERIFIED`로 분리한다.
8. `plugins/codexclaw/`, `structure/`, tracked config에는 이 사이클의 변경이 없다.
9. `009_closeout.md`에 실제 spawn agent id, attached skill paths, lane disposition, wave-1 빈칸, wave-2 follow-up 또는 stop reason을 남긴다. 이는 child가 skill을 실제 사용했다는 증명은 아니며 payload/return receipt로만 표기한다.

## C verifier 사전 점검

SHA 명령만 P에서 exit 0과 target-read를 확인했다. 아직 없는 문서용 명령은 preflight가 아니며 B 뒤 실행한다. Markdown 의미 완전성과 주장-인용 적합성은 자동 gate로 과장하지 않고 C의 독립 human/adversarial review로 판정한다. B에서 문서 commit을 만든 뒤 `git show --check`로 tracked artifact를 관찰한다.

```bash
test "$(git -C devlog/.omo rev-parse HEAD)" = 84f98d8bd1b5c70c46e6f8a5613ffb3c787079db
test "$(git -C devlog/.senpi rev-parse HEAD)" = 703d9d7676b3419273765a4566dd02c1abe75d70
rg -n "ADOPT|ADAPT|REJECT|DEFER|UNVERIFIED" devlog/_fin/260827_omo_senpi_research_gap/006_gap_matrix.md
rg -n "devlog/\.(omo|senpi)/.+:[0-9]+|plugins/codexclaw/.+:[0-9]+|structure/.+:[0-9]+" devlog/_fin/260827_omo_senpi_research_gap/*.md
unit_add_commit="$(git log -1 --format=%H --grep='^docs: analyze OMO beta and Senpi research gaps$' -- devlog/_fin/260827_omo_senpi_research_gap)"
unit_base="$(git rev-parse "$unit_add_commit^")"
final_commit="$(git rev-parse HEAD)" # C close 시 literal SHA를 checkOutput에 남긴다.
test "$(git show -s --format=%s "$unit_add_commit")" = "docs: analyze OMO beta and Senpi research gaps"
test "$(git ls-tree -r --name-only "$final_commit" -- devlog/_fin/260827_omo_senpi_research_gap | wc -l | tr -d ' ')" = 8
test -z "$(git diff --name-only "$unit_base..$final_commit" | rg -v '^devlog/_fin/260827_omo_senpi_research_gap/' || true)"
git diff --check "$unit_base..$final_commit" -- devlog/_fin/260827_omo_senpi_research_gap
git log --oneline "$unit_base..$final_commit" -- devlog/_fin/260827_omo_senpi_research_gap
git status --short -- plugins/codexclaw structure
```

`rg`는 존재성/count 보조 증거일 뿐 row 완전성이나 인용 진실성을 인증하지 않는다.

P 시작 baseline에서 `git status --short -- plugins/codexclaw structure`는 빈 출력이었다. 전체 worktree에는 기존 `scripts/dev-symlink.sh` 수정과 다른 untracked devlog/mktemp 항목이 있었으므로 전체 clean을 주장하지 않는다.
