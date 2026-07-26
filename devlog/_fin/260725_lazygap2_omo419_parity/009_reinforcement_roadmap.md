# 009 — 종합: 강화 로드맵 (lazygap2)

근거: `001`(축 A, Carson) + `002`(축 B, Godel), 둘 다 `VERDICT: COMPLETE`
상태: PLANNED — 이 사이클은 문서 전용, 코드 변경 0건

## 한 줄 요약

4.13 → 4.19.1 델타에서 codexclaw이 채택하는 upstream 메커니즘은 **12건**이다
(축 A: ADAPT 5 · 축 B: ADOPT 3 + ADAPT 4). 구현 슬라이스는 **14개**로, 산식은
`12 (채택 메커니즘) + 1 (소스 정체성 기반, codexclaw 쪽 신설) + 1 (A6 steering을 두 사이클로 분할)`
이다. "채택 메커니즘 수"와 "구현 슬라이스 수"는 다른 값이며 아래 표는 후자를 기준으로 한다.

**갱신 (2026-07-26):** Interview에서 `100`(P/A 규칙 보강)이 추가되고, D 단계 아카이브
규칙을 이행하는 `110`, 그리고 WP2 A 감사에서 이월된 `120`/`130`이 등록돼
구현 슬라이스는 **18개**다. `100`은 upstream 델타가 아니라 이 유닛의 감사 경험에서 파생됐으므로
채택 메커니즘 수(12)에는 포함되지 않는다.

전부 기존 표면 보강이며 새 훅 파일이나 새 서브에이전트 역할은 하나도 필요하지 않다.
upstream이 같은 기간에 키운 큰 표면(ultrawork 전역 모드, teammode 지속 orchestrator,
전용 역할군, stealth browser)은 전부 codexclaw의 LOCKED 원칙과 충돌해 REJECT다.

## 우선순위 매트릭스

| 항목 | 출처 | tier | 새 표면? | decade | 근거 |
| --- | --- | --- | --- | --- | --- |
| artifact 결박 A-리뷰 라운드 (A1) | `001` #4 | E8 | 아니오 (goalplan + attest 확장) | `010` | 가장 큰 구멍이다. 지금 A→B는 붙여넣은 텍스트만 보고 계획이 그 후 바뀌었는지, 그 리뷰가 이 라운드의 것인지 확인하지 못한다 |
| 소스 정체성 영수증 (A3/A5 공통 기반) | `001` #8/#10 | E8 | 신규 내부 모듈 | `020` | `030`·`040`·`070`이 모두 "이 증거가 어느 소스 상태의 것인가"를 필요로 한다 |
| 지속 최종 gate 상태 (A5) | `001` #10 | E8+E2 | 아니오 (goalplan 스키마) | `030` | 완료 게이트가 "작업·criteria 끝"만 보므로 최종 검증 미결 상태를 구조적으로 표현하지 못한다 |
| 최종 gate 선행조건 가드 (A3) | `001` #8 | E1 | 아니오 (기존 spawn 훅) | `040` | gate 상태(`030`)가 존재한 뒤에만 런타임에서 강제할 수 있다 |
| 진전 인식 Stop 정체 판정 (A4) | `001` #9 | E2 | 아니오 (기존 Stop 훅) | `050` | 단계-only 시그니처는 같은 단계에서 실제 진전이 있어도 예산을 소진시킨다 |
| 테스트 오라클 독립성 (B2) | `002` #7 | E7 | 아니오 (dev-testing) | `060` | false-green을 막는 좁은 계약 |
| slop 정리 안전성 (B4) | `002` #10 | E7 | 아니오 (dev-code-reviewer + dev-testing) | `061` | boundary guard 삭제 증명 |
| 리뷰 worktree 좁히기 (B5) | `002` #11 | E7 | 아니오 (dev-code-reviewer) | `062` | 외부 branch 실행 시에만 격리 요구 |
| V2 archive 진실성 문구 (축B #2) | `002` #2 | E7 | 아니오 (pabcd) | `063` | 런타임이 제공하지 않는 상태를 보고하지 않기 |
| logging 계약 (B3) | `002` #8 | E7 | 신규 reference 1개 | `064` | cross-surface logging 소유자 공백 |
| QA 증거 freshness/무결성 (B1) | `002` #4 | E7 (검증기 추가 시 E8) | 작은 스크립트 1개 | `070` | `020`의 소스 정체성을 소비 |
| manifest target 검증기 공용화 + doctor (B6) | `002` #13 | E8 | 아니오 (build 검증기 추출) | `080` | 새 파서를 만들지 않고 기존 build 검사를 공용화 |
| steering 트랜잭션 기반 (A6-1) | `001` #12 | E8 | 신규 CLI 서브버브 | `090` | 트랜잭션·lock·ledger 기반만 |
| steering mutation 계열 (A6-2) | `001` #12 | E8 | 아니오 (`090` 확장 + 스키마) | `091` | mutation 종류별 검증 규칙 |
| ~~spawn 안전 천장 (A2)~~ | `001` #7 | — | — | **없음** | **DEFER.** 관측된 마찰 증거 없이 기본 deny를 넣으면 정상적인 장기 goal을 차단할 수 있다. 재검토 조건 3개는 `001` A2 절 |

## 구현 decade 맵 (`010`-`130`, 이 유닛 안에 작성 완료)

각 행이 하나의 완전한 PABCD 사이클이고, **diff-level 문서는 이 사이클에서 작성됐다**
(DIFFLEVEL-ROADMAP-01). 의존 관계는 architecture/build 순서이며 노력·효과 버킷이 아니다
(PHASE-SPLIT-01).

| decade | 문서 | 실제 의존 | 의존 근거 |
| --- | --- | --- | --- |
| `010` | `010_review_round_binding.md` | `020` | `ReviewLane.sourceIdentity`가 `020`의 타입을 직접 쓴다 (4라운드 감사 8) |
| `020` | `020_source_identity_receipts.md` | 없음 | `010`/`030`/`040`/`070`이 소비할 공통 원시값 — **가장 먼저 구현한다** |
| `030` | `030_final_gate_state.md` | `010`, `020` | `reviewRoundId`는 `010`의 타입, `sourceIdentity`는 `020`의 모듈 |
| `040` | `040_final_gate_spawn_guard.md` | `030`, `020` | gate 상태(`030`)가 없으면 강제할 대상이 없고, 영수증 SHA 대조에 `020`의 `compareSource`를 직접 쓴다 |
| `050` | `050_progress_aware_stop.md` | 없음 | 기존 `updatedAt`·ledger 라인 수·work-phase id만 읽는다 |
| `060` | `060_test_oracle_integrity.md` | 없음 | 문서 전용, 소유자 `dev-testing` |
| `061` | `061_slop_cleanup_safety.md` | 없음 | 문서 전용, 소유자 `dev-code-reviewer` + `dev-testing` |
| `062` | `062_review_worktree.md` | 없음 | 문서 전용, 소유자 `dev-code-reviewer` |
| `063` | `063_v2_archive_truth.md` | 없음 | 문서 전용, 소유자 `pabcd` |
| `064` | `064_logging_contract.md` | 없음 | 문서 전용, 신규 reference |
| `070` | `070_qa_evidence_integrity.md` | `020` | `sourceSnapshotAt`이 `020`의 `sourceIdentity`를 쓴다 |
| `080` | `080_manifest_target_validator.md` | 없음 | build/doctor 내부, 다른 슬라이스와 무관 |
| `090` | `090_steering_transaction_substrate.md` | 없음 | goalplan에 `steeringLog`/ledger 이벤트를 더할 뿐 `010`의 타입을 쓰지 않는다 (3라운드 감사 6에서 가짜 의존 제거) |
| `091` | `091_steering_mutation_families.md` | `090` | `090`의 트랜잭션 위에 얹는다 |
| `100` | `100_plan_rule_hardening.md` | 없음 (다른 슬라이스 타입 미사용) | P/A 규칙 보강. `dev-testing/SKILL.md`를 `060`/`061`과 순차 공유 |
| `130` | `130_removed_backend_contract.md` | `060` | `manifest-policy.test.mjs:113-149`의 forbidden-backend 산문 검사를 삭제하고 보호를 `REVIEW-REMOVED-BACKEND-01` 리뷰 규칙으로 이전 — 독립 오라클(백엔드 registry)이 코드에 없어 자동 계약을 포기했다 (WP2 A 감사 3라운드) |
| `120` | `120_doc_sync_contracts.md` | `060` | `loop-activation-doc-sync`(10 단정)와 `emergence-doc-sync`(25 호출/36 실행)를 구조화 계약 비교로 재작성 — 스킬에 계약 필드 신설이 필요해 `060`에서 이월 (WP2 A 감사 2라운드) |
| `110` | `110_devlog_archive.md` | 나머지 전부 | 완료된 devlog 유닛을 `_fin/`으로 아카이브 — D 단계 규칙 (`plugins/codexclaw/skills/pabcd/SKILL.md:190`). 다른 슬라이스가 모두 닫힌 뒤에만 실행 |

실행 순서: `020`이 사슬의 뿌리다 — `020` → `010` → `030` → `040`.
`070`도 `020`에만 의존한다. 별도 사슬로 `090` → `091`.
`050`, `063`, `064`, `080`, `090`은 서로 및 위 사슬과 독립이므로 어느 순서로도 실행할 수 있다.

**독립 선언 정정 (Interview Mind, 2026-07-26):** `060`·`061`·`100`은 모두
`plugins/codexclaw/skills/dev-testing/SKILL.md`를 만지고, `061`·`062`는
`plugins/codexclaw/skills/dev-code-reviewer/SKILL.md`를 만진다. 이들은 독립이 아니라
**같은 파일 소유권을 순차 공유**한다 — 병렬 브랜치면 hunk 충돌이고, 순차면 뒤 슬라이스의
P가 앞 변경을 반영해 stale 검사를 해야 한다. `070`은 깨진 `020`에 의존한다.

> 번호는 문서 식별자이고 실행 순서가 아니다. `010`이 `020`보다 앞 번호지만
> `020`을 먼저 구현한다 (문서 번호를 바꾸면 기존 인용이 전부 깨지므로 순서만 명시한다).

A 단계 변경 이력 (리뷰어 블로커 7, 재감사 6):
가짜 의존(구 `030→020`, 구 `050→040`) 제거 · 4개 소유자를 묶었던 구 `040`을
`060`/`061`/`062`/`063`/`064`로 분해 (재감사에서 `062`를 worktree/archive 둘로 다시 분리) ·
독립 항목을 묶었던 구 `080` 분해 (A2는 DEFER) · 구 `090`(A6)을 `090`/`091` 두 사이클로 분할.
3라운드 감사 6에서 추가: 가짜 `090→010` 의존 제거, 누락된 `040→020` 의존 추가,
채택 메커니즘 수(12)와 구현 슬라이스 수(14)를 구분.
4라운드 감사 8에서 추가: 누락된 `010→020` 의존 추가(실행 뿌리는 `020`), 14 산식 명시.

## upstream이 우리 기록을 지나간 지점 (요약)

`001` 말미 표가 상세다. 갱신이 필요한 기존 기록:

- `devlog/_fin/lazygap/001` steering 하위행 — 재개방 (배치/스냅샷 확장).
- `devlog/_fin/lazygap/002` — upstream matcher 값 표기가 stale (executor 1종 → worker 3티어).
  codexclaw의 범용 `worker` 채택 결론은 유효.
- `devlog/_fin/lazygap/003` — 최종 gate 미결 continuation이 신규.
- `devlog/_fin/lazygap_impl/040` — 단계-only 정체 시그니처가 upstream보다 뒤처짐.
- `devlog/_plan/260723_deploy_readme/002` — "저장소 내부 one-SemVer" 표현 정정 필요
  (`002` 배포 정정 표 참조).
- `structure/00_philosophy.md` — host goal 쓰기를
  read-only로 서술한 부분이 `devlog/_fin/lazygap/000_INDEX.md:121-128`의 REVISED
  규칙보다 오래됐다 (A 단계, 리뷰어 블로커 8).

이 문서들은 이번 사이클에서 **수정하지 않았다**. 정정 사항은 여기와 `002`에 기록되어
있고, 실제 문서 패치는 해당 decade 구현 사이클의 SoT 동기화 단계에서 처리한다.

## 비목표 재확인 (LOCK 유지)

- 서브에이전트 역할 증설 금지 — 전문화는 `$cxc-*` skill attachment로.
  upstream의 metis/momus/librarian/gate-reviewer/티어 worker 전부 REJECT.
- 서버/데몬/LSP/CDP 상주 프로세스 금지 — stealth browser 계열 REJECT.
- host goal 쓰기는 **금지가 아니라 게이팅**이다 (A 단계, 리뷰어 블로커 8 반영).
  정확한 규칙: codexclaw은 interview freeze 승인 경계에서만 host goal을 쓰고,
  루프 중에는 절대 자기무장하지 않는다. 분해된 작업 상태(workPhases/tasks/criteria/
  evidence)는 프로젝트 로컬 `.codexclaw/`에 남는다. superseding SoT은
  `devlog/_fin/lazygap/000_INDEX.md:121-128` ("REVISED 2026-07-01")이고,
  `structure/00_philosophy.md`의 read-only 표현은
  그보다 앞선 기술이므로 정정 대상 목록에 넣었다.
  steering(`090`/`091`)은 어느 경우에도 프로젝트 로컬 상태만 변경한다.
- SessionStart 자동 업데이트·텔레메트리·사용자 config 변경 금지 —
  upstream의 V2 마이그레이션 훅 REJECT.
- 두 번째 지속 orchestrator 상태 금지 — teammode `team.json` 계층 REJECT.
- credential 추출/주입 금지.

## 미검증 항목 (사실 주장과 분리)

두 조사 보고의 UNVERIFIED를 합친 목록. 구현 사이클 진입 전 확인이 필요한 것에 표시했다.

- upstream 컴포넌트 테스트(spawn guard, stop resume, steering batch, checkpoint
  continuation, start-work continuation)는 벤더 스냅샷에 `vitest`가 없어 실행 불가.
  소스 계약만 정독됨 → **`010`/`050`/`090` 구현 전 해당 계약을 우리 테스트로 재현할 것.**
- Godel이 보고한 upstream teammode 테스트 `19 pass, 0 fail`은 재현되지 않았다.
  REJECT 결론에 영향은 없으나 검증 증거로 인용하지 않는다 (A 단계, 리뷰어 블로커 9).
- `subagent-limit-migration.test.mjs:211-233`은 upstream에서 실제 실패 중(환경 문제 아님).
  우리는 REJECT 대상이므로 영향 없음.
- npm registry 현재 버전, GitHub tag/release, upstream main manifest는 live 조회하지 않음
  → **배포 문구를 다시 쓸 때 재확인 필요.**
- `visual-qa.mjs`의 PNG 디코더/alpha/CJK 폭 정확도는 fixture 부재로 미검증.
  REJECT 결론을 뒷받침하는 사실.
- 삭제된 cookie 테스트의 이동 목적지 없음 — 비공개 monorepo 존재 여부는 미확인.
- Windows `commandWindows` 디스패치 동작 미실행 (패키징 사안).
- Codex App multi-host thread-id 모호성의 현재 host API 처리 여부 미조사.

## 이 사이클의 검증 증거

- 스냅샷 갱신: `devlog/.lazycodex` `d4c4f05` → `3efc603` (fast-forward pull, 21 commits).
  이 디렉터리는 `.gitignore:8`로 무시되는 독립 클론이므로 codexclaw 커밋에 포함되지 않는다.
- 조사: Sol explorer 2명 병렬, 두 보고 모두 `VERDICT: COMPLETE`.
- 감사: Sol reviewer 1명(Epicurus) 독립 리뷰 → 1라운드 `VERDICT: FAIL` (블로커 9건),
  전건 반영 후 재감사. 반영 내역은 아래 감사 기록 절.
- 메인 에이전트 직접 실행 (2026-07-25, cwd `/Users/jun/Developer/new/700_projects/codexclaw`):
  `npm run gate` → exit 0,
  `[codexclaw gate] OK — no status drift, false-enforcement prose, or count mismatch.`
- 리뷰어가 벤더 스냅샷에서 독립 실행: `node --test test/subagent-limit-migration.test.mjs`
  → 17건 중 16 pass / 1 fail, 실패 위치가 `001`의 주장과 일치.
- 서브에이전트 자기보고 중 재현되지 않은 집계는 검증 증거로 승격하지 않았다
  (위 미검증 항목 참조).
- 프로덕션 코드 변경 0건 — `git status --porcelain` 결과가 untracked 디렉터리 2개뿐이다:
  이 유닛(`devlog/_plan/260725_lazygap2_omo419_parity/`)과 기존에 있던 무관한 작업
  (`devlog/_plan/260722_260722-repo-governance-config/`, 보존됨).

## 감사 기록 (A 단계)

독립 리뷰어: Sol subagent "Epicurus" (explorer/reviewer, read-only),
`$cxc-dev-code-reviewer` + `$cxc-search` 첨부. 총 4라운드.

| 라운드 | verdict | 블로커 | 성격 | 처리 |
| --- | --- | --- | --- | --- |
| 1 | FAIL | 9 | decade 문서 미작성(DIFFLEVEL-ROADMAP-01), 존재하지 않는 인용 5건, 근거 불일치 인용 2건, doctor NONE 오판, A2 무근거 정책, final gate SHA 결박 부재, 가짜 의존/묶음 슬라이스, goal-DB SoT 충돌, 미재현 증거 승격 | 전건 수용, 반박 0 |
| 2 | FAIL | 8 | 1라운드 `009` 패치가 **적용 실패했는데 내가 확인하지 않음**, 인용 규약 미완, 19-pass 잔존, `020` untracked 구멍, final gate 우회 가능, 묶음 잔존, steering CLI 소유자 오인 + 스키마 소비자 누락, `010` 상태 머신 모호 | 전건 수용, 반박 0 |
| 3 | FAIL | 9 | 영수증 검증 누락, 라운드 용도 재사용, 축약 해시/no-git 모순, surface 생성 경로 부재, 헬퍼 3종 누락, 수치 모순, 경로 미완, UserPromptSubmit 잔재, 사전조사 누락 1건 | 전건 수용 → **P 복귀 후 계획 재작성** (LOOP-REPAIR-01) |
| 4 | FAIL | 9 | `sameSource` 유니온이 truthiness로 새는 문제, `validateGoalplan` 순수함수 경계, 영수증 스키마/파서 미정의, inconclusive 라운드 승인, QA 요구가 커서 null로 소멸, `schemaVersion` 다운그레이드, self-supersede, `010→020` 의존 누락, CLI 접두 문법이 자유문 파괴 | 전건 수용, 반박 0 |

### 반영 후 현재 상태 (정직한 기술)

4라운드 블로커까지 전부 반영했으나 **5라운드 감사는 받지 않았다.** LOOP-REPAIR-01 /
LOOP-DOOM-01의 반복 한도에 도달했고, 3라운드에서 이미 P 복귀·재작성을 한 번 수행했다.

따라서 이 유닛의 상태는 다음과 같다.

- **리서치 부분(`001`, `002`)은 검증된 산출로 취급할 수 있다.** 판정표의 사실 인용은
  1-4라운드에 걸쳐 반복 대조되어 남은 오류가 보고되지 않았고, 리뷰어도 4라운드
  non-blocking에서 이전 오류 인용들이 실제 경로·내용과 일치함을 확인했다.
- **decade 설계(`010`-`091`)는 마지막 감사를 통과하지 못한 상태다.** 4라운드 수정은
  반영됐지만 독립 확인을 받지 않았다. 각 decade의 P는 구현 직전에 그 문서를 현재 트리에
  대조해 재검증하도록 이미 규정되어 있으므로(LOOP-DOCS-FIRST-01 3항), 남은 설계 결함은
  해당 슬라이스의 P에서 잡는 것이 정상 경로다.
- 이 유닛을 **구현 착수 가능한 최종 설계로 승인하지 않는다.** `010`-`091`은
  "감사 4라운드를 거친 설계 초안"이며, 각 슬라이스 P에서 재검증이 필수다.

반복 감사가 수렴하지 않은 이유도 기록해 둔다: 이 유닛은 리서치 1건이 아니라 14개
구현 설계를 한 사이클에 담았다. 리뷰어가 매 라운드 더 깊은 층(스키마 → 소비자 →
타입 안전성 → 우회 경로)을 파고들 여지가 계속 있었다. 다음에 같은 규모를 다룰 때는
리서치 사이클과 설계 사이클을 분리하는 것이 맞다 — 이것이 이 유닛에서 얻은 실제 교훈이다.

### 비수렴 원인 재진단 (Interview Mind, 2026-07-26)

위 "스코프 과다" 진단은 **Mind 조사로 반증됐다.** blocker 분포를 실제로 세어 보니
round 4의 9건 중 **8건이 `010`→`020`→`030`→`040` 최종 gate 사슬 하나에 집중**되고
1건만 `091`이었다. 폭이 넓어서가 아니라 특정 설계 사슬의 밀도가 지배적이었다.

더 정확한 원인은 **P/A 규칙의 공백**이다. Mind 4명이 찾은 모순 41건(HIGH 19건)을
계열로 묶으면 8개이고, 그 8개 전부가 현행 규칙이 요구하지 않는 항목이다 —
검증 명령의 실행 가능성, 검증기의 관측 범위, 새 필드의 생성 사슬, 새 열거값의 소비자,
우회 경로 명시, 테스트 행의 도달 가능성, 문서 간 필드명 일치, 헤더 의존 드리프트.

즉 이것은 개인 실수의 반복이 아니라 **규칙이 잡아주지 못하는 결함 계열**이다.
사용자 요청("프롬프트 엔지니어링도 손봐")에 따라 `100_plan_rule_hardening.md`가
그 공백을 메우는 슬라이스로 추가됐다. 매핑 표는 그 문서에 있다.

### 리뷰 루프 종료 조건 (D2, 사용자 결정 2026-07-26)

지금까지 이 루프에는 실패측 종료 조건이 없었다 (blocker 9→8→9→9, 무한 루프).
이제 규칙이 있다.

> **2라운드 연속 개선이 없으면 정지한다.** 개선 없음 = 같은 결함 계열이 2라운드
> 연속 재발하거나 blocker 수가 감소하지 않음. 정지 시 설계 자산을 보존한 채
> 멈추고 현황을 보고한다. 성공 출구는 PASS 하나뿐이다.

이 기준을 4라운드 기록에 소급 적용하면 루프는 **2라운드에서 이미 정지해야 했다**
(9→8은 감소지만 결함 계열이 동일했다). 그 판정을 못 한 것이 4라운드까지 끌고 간 원인이다.
