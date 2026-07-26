# 260725 lazygap2 — omo 4.13.0 → 4.19.1 재파리티 · 계획 (P)

Session: `019f99ae-65c6-7dc0-b8bd-d771e78c5b66` · HITL cxc-loop, 단일 work-phase(docs-only)
Date: 2026-07-25

## 계기

벤더링된 upstream 스냅샷 `devlog/.lazycodex/`를 최신으로 당겼다.

```
before: d4c4f05d424451bdd917cfa3416dbab3ff973c95  2026-06-24  omo 4.13.0 / wrapper 0.2.2
after : 3efc603ac474f5a4f77001641d0b2736dc121e85  2026-07-22  omo 4.19.1 / wrapper 0.2.2
delta : 21 commits, 642 files, +279,439 / -11,173
```

`devlog/_fin/lazygap/`(000-010)은 4.13.0 이전 트리를 기준으로 작성된 기록이다.
이 유닛은 그 기록을 갱신하지 않고, **4.13 → 4.19.1 신규 델타만** 판정한다.

## 목표

1. 신규 델타에서 codexclaw이 ADOPT / ADAPT / REJECT 할 항목을 file:line 증거와 함께 확정한다.
2. 각 항목을 enforcement tier(E1-E8)와 실행 가능한 loop 후보에 매핑한다.
3. `devlog/_plan/260723_deploy_readme/002_lazycodex_distribution.md`(구 스냅샷 기준
   배포 기록)의 오류·확인 사항을 델타로 정정한다.

## 범위 경계

- IN: `devlog/_plan/260725_lazygap2_omo419_parity/` 문서 작성, `devlog/.lazycodex` 스냅샷 갱신.
- OUT: `plugins/codexclaw/` 프로덕션 코드/훅/스킬 수정, 버전 변경, push, 릴리스 액션.
  각 decade 문서(`010`-`130`)의 구현은 별도 PABCD 사이클에서 하나씩 수행한다.
  (2026-07-26: HOTL 루프가 실제로 그 사이클들을 실행 중이다 — 이 유닛은 더 이상 docs-only가 아니다.)
- 보존: 무관한 untracked 작업 `devlog/_plan/260722_260722-repo-governance-config/`.

## 조사 방식 (증거 기반)

두 축으로 Sol 서브에이전트(explorer, read-only)를 병렬 파견했다. 두 보고 모두
`VERDICT: COMPLETE`.

| 축 | 에이전트 | 범위 | 산출 |
| --- | --- | --- | --- |
| A | Carson (gpt-5.6-sol, medium) | ultrawork / `ulw-*` 가족, 신규 훅(spawn-guard, stop-resume, goal-budget), steering/checkpoint 컴포넌트, 신규 계약 테스트, plugin.json | `001` |
| B | Godel (gpt-5.6-sol, medium) | teammode 재작성, visual-qa + `visual-qa.mjs`, programming/logging, remove-ai-slops, review-work/start-work, lcx-*, ultimate-browsing, 배포·버전 체인 | `002` |

두 패킷 모두 codexclaw의 LOCKED 원칙을 판정 기준으로 명시했다: 서브에이전트 역할
증설 금지(3 base role + `$cxc-*` skill attachment), 서버/데몬/LSP 금지,
SessionStart 자동 업데이트·텔레메트리 금지, 그리고 host goal 쓰기의 게이팅
(interview freeze 승인 경계에서만, 루프 중 자기무장 금지 —
`devlog/_fin/lazygap/000_INDEX.md:121-128`). 파견 시점 패킷에는 이 마지막 항목이
"goal DB 쓰기 금지"라는 부정확한 형태로 적혀 있었고, A 단계에서 정정했다.

## 문서 맵 (LEXICO-SPLIT-01)

리서치 문서(000-009)와 구현 decade 문서(010-110)를 이 한 유닛 안에서 분리한다
(`lazygap` 선례의 번호 규약을 따르되, decade 문서를 별도 유닛으로 미루지 않는다).

| 문서 | 내용 |
| --- | --- |
| `000_plan.md` | 이 문서 — 계기, 목표, 범위, 조사 방식, 문서 맵 |
| `001_axis_a_loop_orchestration.md` | 축 A 판정표 16행 (ADAPT 5 / DEFER 1 / REJECT 10) + 스케치 + upstream 이동 표 |
| `002_axis_b_skills_qa_distribution.md` | 축 B 판정표 16행 (ADOPT 3 / ADAPT 4 / REJECT 9) + 스케치 + 배포 기록 정정 |
| `009_reinforcement_roadmap.md` | 종합: 우선순위, decade 맵, 비목표 재확인, 미검증 항목, 감사 기록 |
| `010_review_round_binding.md` | 리뷰 라운드 상태 + A→B attest 결박 |
| `020_source_identity_receipts.md` | 소스 정체성 영수증 모듈 (`030`/`040`/`070`의 기반) |
| `030_final_gate_state.md` | 최종 gate 상태 + 완료 검증기 + IDLE Stop 문구 |
| `040_final_gate_spawn_guard.md` | 최종 gate 선행조건 spawn 가드 |
| `050_progress_aware_stop.md` | 진전 인식 Stop 정체 판정 |
| `060_test_oracle_integrity.md` | 테스트 오라클 독립성 규칙 |
| `061_slop_cleanup_safety.md` | slop 정리 안전성 규칙 |
| `062_review_worktree.md` | 리뷰 worktree 요구 좁히기 |
| `063_v2_archive_truth.md` | V2 서브에이전트 archive 진실성 문구 |
| `064_logging_contract.md` | logging 계약 reference |
| `070_qa_evidence_integrity.md` | QA 증거 무결성 + `verdict.json` 필드 |
| `080_manifest_target_validator.md` | manifest target 검증기 공용화 + doctor 확장 |
| `090_steering_transaction_substrate.md` | steering 트랜잭션 기반 |
| `091_steering_mutation_families.md` | steering mutation 계열 + 검증 규칙 |
| `100_plan_rule_hardening.md` | P/A 단계 규칙 보강 (프롬프트 엔지니어링, 사용자 요청) |
| `120_doc_sync_contracts.md` | doc-sync 테스트를 구조화 계약 비교로 재작성 (`060`에서 이월) |
| `130_removed_backend_contract.md` | removed-backend 보호를 리뷰 규칙으로 이전 — 독립 오라클이 없어 자동 계약 포기 (`060`에서 이월) |
| `110_devlog_archive.md` | 완료 devlog 유닛 `_fin/` 아카이브 (D 단계 규칙 이행) |

각 decade 문서는 하나의 완전한 PABCD 사이클이며 변경 파일 맵 · before→after ·
수용 기준 테스트 표 · 범위 밖을 담는다 (DIFFLEVEL-ROADMAP-01).
의존 순서는 `009`의 decade 맵에 있다.

decade 문서의 변경 파일 맵에 나오는 "신규" 경로는 아직 존재하지 않는 계획된 파일이다.
기존 파일을 가리키는 인용과 구별하기 위해 각 표의 변경 유형 칸에 `신규`를 명시했다.

**A 단계 정정:** 최초 P는 decade 문서를 "다음 사이클"로 미뤘다. 리뷰어가 이를
LOOP-DOCS-FIRST-01 / DIFFLEVEL-ROADMAP-01 위반으로 지적했고
(`plugins/codexclaw/skills/loop/SKILL.md:93-107`,
`plugins/codexclaw/skills/pabcd/SKILL.md:194-203`) 이 사이클 안에서 전부 작성했다.

## 수용 기준 (검증 가능)

1. `001`/`002` 모든 사실 주장에 `file:line` 인용이 있다.
2. 모든 행이 ADOPT / ADAPT / DEFER / REJECT 중 하나로 판정되고 근거가 codexclaw 기존 표면
   (또는 `structure/00_philosophy.md` / `lazygap/000_INDEX.md`)을 인용한다.
3. `009`의 각 채택 항목이 tier와 decade 문서에 매핑된다. **DEFER 항목은 decade를 갖지
   않으며, 그 사실이 `009`에 명시된다** (현재 A2 1건).
4. `002`가 `260723_deploy_readme/002_lazycodex_distribution.md`의 각 주장을
   CONFIRMED / CHANGED / CORRECTION 으로 처리한다.
5. 미검증 항목이 UNVERIFIED로 분리되어 사실 주장과 섞이지 않는다.
6. 프로덕션 코드 변경 0건. `git status`로 확인.
7. 모든 인용이 실제로 존재하고 주장한 내용을 담는다 (A 단계 추가). 인용 규약:
   각 인용은 완전 경로로 적고 `...` 생략을 쓰지 않는다. 예외는 **같은 표 행 또는 같은
   문장 안에서 이미 완전 경로가 나온 파일을 다시 가리키는 후속 `:N`** 뿐이며,
   그 경우 앞선 완전 경로가 대상 파일을 특정한다 (4라운드 감사 9에 대한 명시적 규약).
   배포 정정 표의 `(:N)`은 기준 문서의 행 번호이고 표 머리에 그 사실이 적혀 있다.
8. 각 decade 문서가 변경 파일 맵 · before→after · 수용 기준 테스트 · 범위 밖을
   담는다 (A 단계 추가).
9. decade 맵의 의존 관계가 실제 코드 의존이며, 한 슬라이스가 독립 소유자 여럿을
   묶지 않는다 (A 단계 추가).

## A-phase 반영 (감사 결과 접기)

반영 내역은 `009` 말미의 감사 기록 절에 적는다.

## Interview 결정 (2026-07-26, 사용자 승인)

감사 4라운드 FAIL 이후 Interview를 열고 Mind 4명으로 모순을 재스캔한 뒤, 사용자가 다음을
결정했다. 이 결정이 이후 사이클의 경계다.

### D1 — 위험 사슬 분리 (사용자 선택)

Mind 조사로 round 4 blocker 9건 중 8건이 `010`→`020`→`030`→`040` 최종 gate 사슬과 `091`에
집중된 것이 확인됐다. 나머지 7개 슬라이스는 어떤 라운드에서도 blocker 출처로 지목되지 않았다.

→ **감사 대상을 깨진 5개(`010`, `020`, `030`, `040`, `091`)로 좁힌다.** 나머지 7개는
통과 처리한다. 다만 이 통과는 "검토됐다"가 아니라 "지적이 없었다"에 근거하므로,
미검토로 인한 침묵일 가능성을 별도 Mind가 검증하고 그 결과를 `009`에 남긴다.

**D1 전제 반증 (Mind "Linnaeus", 재스캔 2라운드):** 그 검증을 실제로 돌린 결과
**"깨끗한 7개"는 존재하지 않는다.** 8개 문서(050·060·061·062·063·064·070·080)를
실제 코드에 대조해 모순 9건(HIGH 6건)이 나왔고, 침묵 판정은 다음과 같다.

| 슬라이스 | 판정 | 대표 결함 |
| --- | --- | --- |
| `050` | 결함 | `bumpStopCounter`는 `cwd`/`state`만 받고 goalplan을 읽지 않는다 (`plugins/codexclaw/components/pabcd-state/src/hook.ts:721-730`). 설계가 쓴다고 한 `updatedAt`·work-phase id·ledger 라인 수가 그 지점에 없다. 게다가 제안 pseudocode는 첫 관측을 0으로 시작해 기존 1-시작 규칙을 깨고 release를 한 칸 밀어낸다 (`test/hook-continuation.test.ts:443-455`) |
| `060` | 결함 | 사전조사가 `components/*/test/*.ts`만 훑어 `plugins/codexclaw/test/*.mjs` 트리를 통째로 빠뜨렸다. `manifest-policy.test.mjs:153-169`, `loop-activation-doc-sync.test.mjs:20-34`, `emergence-doc-sync.test.mjs:20-52`에 산문 정규식 단정이 더 있다 — "위반 2건 확정"이 거짓 |
| `061` | 미검토 | `060`과 같은 `dev-testing/SKILL.md` 구역, `062`와 같은 `dev-code-reviewer/SKILL.md` 구역을 만진다 |
| `062` | 결함 | 삽입 위치를 §5로 적었으나 `REVIEW-INTERDIFF-01`은 §6 이후 별도 절이다 (`dev-code-reviewer/SKILL.md:303-329` vs `:331-388`) |
| `063` | 결함 | `archiv|closed` 전수 검색이 devlog `_fin/` 아카이빙 서술(`pabcd/SKILL.md:188-192`)과 V2 lifecycle 서술(`:339-346`)을 구분하지 못한다 |
| `064` | 결함 | `dev-backend`가 이미 observability/logging 소유자다 (`dev-backend/SKILL.md:12-16`, `references/core/observability.md:83-99`). 무조건 stack 보존 요구는 그 문서의 info/warn stack 금지와 충돌 |
| `070` | 결함 | `verdict.json`은 HTTP·CLI·TUI·web·GUI 5개 표면 공용 스키마인데 (`qa/SKILL.md:56-76`) PNG 매직바이트를 필수로 요구하면 3개 표면의 정상 PASS를 거부한다. IHDR 크기와 비교할 선언 크기 필드도 없다 |
| `080` | 미검토 | ESM import 자체는 가능하나 런타임 패키징·설치 경로 파싱·doctor 통합이 침묵으로 정당화될 복잡도가 아니다 |

**독립성 주장도 반증됐다:** `060`+`061`이 `dev-testing/SKILL.md`의 같은 구역을,
`061`+`062`가 `dev-code-reviewer/SKILL.md`의 인접 구역을 만진다. 별도 사이클로 돌리면
쓰기 소유권이 겹친다. `070`은 깨진 `020`에 의존하므로 독립 통과가 불가능하다.

→ **따라서 D1의 "7개 통과"는 성립하지 않는다.** 분리 자체는 유효하지만 (위험이
`010`-`040` 사슬에 집중된 것은 사실), 나머지를 무검토 통과시킬 수는 없다.
어느 쪽으로 갈지는 사용자 결정 사항으로 남긴다 (아래 D4).

### D2 — 리뷰 루프 종료 조건 (사용자 선택)

지금까지 문서 루프에는 실패측 종료 조건이 없어 무한 루프였다 (blocker 9→8→9→9).

→ **2라운드 연속 개선이 없으면 정지한다.** 개선 없음의 판정 기준:
같은 결함 계열이 2라운드 연속 재발하거나, blocker 수가 감소하지 않는 경우.
정지 시 설계 자산을 보존한 상태로 멈추고 현황을 보고한다 (LOOP-REPAIR-01과 동일한 기준).

### D3 — 자율성 범위 (사용자 선택)

→ **커밋하고 푸시하면서 진행한다.** `codex/` 접두 브랜치를 쓴다.
DEV-GIT-PUSH-01의 기본은 푸시 금지지만, 사용자가 이 스코프에 대해 명시적으로 승인했다.
승인 범위는 이 유닛의 작업이며, 그 밖으로 확장하지 않는다.
