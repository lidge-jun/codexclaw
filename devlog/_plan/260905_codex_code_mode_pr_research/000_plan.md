# Codex 실행 기능과 upstream PR 흐름 조사

현재 상태 보충: 인터뷰와 initiative 대조 후 사용자가 시간 제한 없는 HOTL 실행을 승인했다. 실제 host goal을 등록하고 I → P override 전이를 기록했다. 초기 5개 work-phase를 문서 lock 전에 6개로 구체화해 전달 방식 비교를 독립 사이클로 추가했다. 현재 wp0는 docs-only roadmap 단계다. 아래는 최초 리서치의 범위·상태 기록이며, 실행 로드맵은 [010](010_roadmap_lock.md), 원격 조건과 방향은 [006](006_interview_remote_probes.md)·[007](007_methodology_alignment.md), 실제 기준선은 [008](008_baseline_observations.md)이 우선한다.

활성 goalplan: `.codexclaw/goalplans/implement-and-verify-the-agreed-researcher-style/goalplan.json`. 관리 worktree를 유지하며 branch `codex/agent-led-lazy-skills`를 제자리에서 생성했다. 제품 변경은 wp0 감사·문서 lock 이후 사이클에서 시작한다.

- 조사일: 2026-09-05 (KST)
- 작업 위치: `/Users/jun/.codex/worktrees/974c/codexclaw`
- 세션: `01a0702d-c493-7510-801f-7d8772a2689c`
- 모드: HITL, P 단계 조사. host goal 없음. A/B/C/D 완료를 주장하지 않는다.
- 범위: JS 실행, code mode, Node/CUA REPL, 도구 발견·노출, 실행 증거와 관련 upstream PR.

## Loop spec

| 항목 | 내용 |
| --- | --- |
| Archetype | 근거를 확인하며 채택 후보를 좁히는 문서 전용 조사 |
| Trigger | 로컬 참조뿐 아니라 PR 흐름을 조사해 devlog에 남겨 달라는 요청 |
| Goal | 현재 기능, 제거된 기능, 열린 제안, 별도 실험 후보를 구분한 조사 기록 |
| Non-goals | 런타임 복제, 코드·설정·설치 변경, 자동화 생성, push·merge·release |
| Verifier | PR별 GitHub 조회, 로컬 source anchor 확인, 문서 링크·JSON 정합성, `git diff --check` |
| Stop condition | 조사 문서와 근거 저장 후 HITL P에서 검토 대기 |
| Memory artifact | 이 디렉터리의 000–005 문서와 조회 메타데이터 |
| Outcome | 조사 산출물 작성 완료와 전체 PABCD 완료를 구분. 다음 단계는 NEEDS_HUMAN |
| Escalation | 실제 설정·실행 환경 변경은 별도 승인. 읽기 실패는 미검증으로 표시 |

## 문서 지도와 변경 범위

이 저장소의 기존 `devlog/_plan/YYMMDD_slug/` 및 3자리 번호 규칙을 재사용한다.

```text
260905_codex_code_mode_pr_research/
  000_plan.md                 조사 범위·상태·재개 지점
  001_research.md             현재 실행 환경과 핵심 판단
  002_pr_flow.md              병합·제거·후속 수정·열린 스택
  003_adoption_candidates.md  채택 후보와 검증 시나리오
  004_source_ledger.json      PR별 조회 메타데이터
  005_verification.md         조회 방법·검증 결과·한계
```

변경은 이 디렉터리의 NEW 문서 6개로 한정한다. 제품 구현 단계나 diff-level 구현 로드맵은 이번 요청에 포함하지 않는다. 후보를 실행 계획으로 채택하면 다음 P에서 정확한 수정 파일과 검증 명령을 확정하고, 사용자 확인 후 A로 이동한다.

읽기 순서: [조사 결과](001_research.md) → [PR 흐름](002_pr_flow.md) → [채택 후보](003_adoption_candidates.md). [조회 메타데이터](004_source_ledger.json)와 [검증 기록](005_verification.md)은 근거를 다시 확인할 때 읽는다.

## 판정 기준

- PR 상태와 `mergedAt`은 GitHub 원본 조회로 확인한다. 커밋 제목만 보고 병합 여부를 추정하지 않는다.
- 로컬 HEAD, GitHub main, 설치된 CLI, 현재 대화의 tool surface를 별도 기록한다.
- 검색 결과가 없다는 이유로 기능이나 PR이 없다고 단정하지 않는다.
- `store/load`를 영속 DB로, `Promise.all`을 실제 병렬 실행 보장으로 설명하지 않는다.
- 열린 PR의 API 이름이 현재 소스에도 있으면 구현·계약을 비교한다. OPEN을 곧 미구현으로 해석하지 않는다.
- PR 작성자의 테스트 보고는 참고 근거다. 이번 조사에서 테스트를 직접 실행했다는 뜻이 아니다.
- 새 기능이 아니라 기존 capability 활용으로 충분한지 먼저 판단한다.

## 기존 원칙과 연결

[Native-thin harness contract](../../../docs/native-thin-harness.md:5)는 실행 환경을 Codex 소유로 둔다. [Native capabilities](../../../structure/60_native_capabilities.md:82)는 기존 도구 지도다. 이번 조사는 두 문서를 변경하지 않는다. 채택 후보가 승인되기 전에는 일반 원칙이나 기본 동작을 바꾸지 않기 때문이다.

## FSM 기록

- `cxc orchestrate status --session 01a0702d-c493-7510-801f-7d8772a2689c`: IDLE 확인.
- `cxc orchestrate P --session 01a0702d-c493-7510-801f-7d8772a2689c`: IDLE → P 기록.
- `cxc-loop`의 HITL 확인 지점을 유지한다. 자동 계속 실행이나 전체 사이클 완료를 요청받지 않았으므로 goal을 만들지 않는다.
