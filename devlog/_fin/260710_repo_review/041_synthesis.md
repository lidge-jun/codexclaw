# 041 - 저장소 검토 교차 종합 (사이클 4)

## 1. 교차 발견

### 1.1 fail-open 완료 우회와 형식 gate

CLI/hook 검토의 `011#H-1`과 상태 검토의 `031#H-1`은 같은 경로를 양쪽에서 잡았다.
bound goalplan이 없거나 malformed면 `readGoalplan()`이 null을 반환하고, completion guard의
`if (plan)` 바깥으로 빠져 E8이 실행되지 않는다. `031#H-2`는 plan을 읽은 뒤에도 evidence가
non-empty 문자열인지밖에 확인하지 않는다고 지적한다.

독트린 쪽 `021#H-1`은 구조 문서가 reviewer provenance를 구조적으로 보장한다고 과장하며,
`021#H-2`는 direct self-audit를 허용해 mandatory reviewer 계약을 약화한다. 세 표면의 공통
원인은 "필드나 문자열이 있으면 절차가 실제로 수행됐다"고 간주하는 형식 gate다. runtime은
부재·파싱 실패를 fail-open으로 처리하고 문서는 그보다 강한 enforcement를 주장한다.

### 1.2 enforcement 서술과 runtime 실제의 분리

`011#M-3`은 `map --help`의 interpreter 우선순위가 주석 계약과 다르고, `011#M-5`는 저장 가능한
reasoning effort가 spawn payload에 반영되지 않는다고 기록한다. `021#H-3`은 live collab
surface의 기본값을 V2와 V1로 정반대 서술한 사례다. `021#M-4`도 recursion token의 위치를
agents와 canonical이 다르게 지정한다.

같은 패턴은 완료 경로에도 있다. `031#M-1`의 주석은 E8을 final D-close gate로 부르지만 실제
D-close 경로는 E8을 호출하지 않는다. `021#H-1`의 provenance 과장까지 합치면 주석, skill,
structure가 runtime보다 강한 보장을 말하는 경향이 반복된다. 문구 검토만으로는 실제 호출
경로의 fail-open, dead configuration, namespace 차이를 잡지 못한다.

### 1.3 스테일·수동 관리 SoT

`011#L-3`은 CLI 명령 목록이 헤더, help, switch 세 군데에 수동 중복된다고 지적한다.
`011#M-5`는 config schema와 runtime payload가 따로 진화한 결과다. 독트린에서는
`021#M-1`의 implicit-visible 집합, `021#M-2`의 deprecated owner 표, `021#M-3`의 INDEX catalog가
각각 canonical에서 뒤처졌다.

상태 계약도 구조화가 덜 됐다. `031#L-1`의 checkpoints/assumptions/steering은 전용 필드 없이
자유 문자열에 의존하고, `031#M-3`은 steering을 `created` event로 재사용한다. packet 계약이
structure SOT에 일부만 복제된 `021#L-2`까지 같은 원인이다. 선언을 여러 문서와 자유 문자열에
수동 복사하는 구조가 스테일과 의미 확장을 만든다.

### 1.4 상태 경계와 원장 무결성

`011#M-7`은 render ledger가 session별로 격리되지 않고, `011#M-8`은 plateau 판정이
work-phase 경계를 무시한다고 지적한다. `011#M-10`은 state 저장 뒤 ledger append가 실패하면
phase만 전진하는 비원자적 경로다.

상태 검토에서는 `031#M-2`가 goalplan ledger 185/355행의 선언 필드 결여를, `031#M-4`가
persisted state와 restore state의 차이를, `031#M-5`가 interview eventId 중복을 확인했다.
`031#H-3`의 D-close task 일괄 완료도 원장 상태가 proof보다 앞서 가는 사례다. 독트린의
`021#H-3`과 `021#M-4`는 같은 상태 작업이 V1/V2 lifecycle 및 token 위치 해석에 따라 달라지는
제어면 문제를 보탠다. 공통 결함은 session, work phase, event schema, proof의 경계가 저장 형식과
전이 로직에서 함께 강제되지 않는다는 점이다.

## 2. 우선순위 권고 Top 5

### 1. bound goalplan parse 실패를 fail-closed로 전환

근거: `011#H-1`, `031#H-1`, `031#H-2`, `021#H-1`.

session에 slug가 있으면 missing/malformed plan을 completion deny로 처리하고, evidence는 구조화된
artifact path, verifier command, exit code, 수집 시각을 검사한다. 완료 우회와 형식만 갖춘 허위
증거를 한 경계에서 차단한다.

### 2. D-close와 E8 완료 의미를 분리하고 task proof를 보존

근거: `031#H-3`, `031#M-1`, `031#H-2`, `021#H-1`.

D-close는 cycle 종료만 기록하고 task/criterion 완료는 개별 proof가 있을 때만 전이시키는 계약이
필요하다. "final D-close gate"와 실제 completion guard의 이름·호출 위치를 일치시키면 자동 done과
사후 E8의 의미 혼동이 줄어든다.

### 3. CLI·skill·structure 표를 canonical schema에서 생성

근거: `011#L-3`, `011#M-3`, `011#M-5`, `021#M-1`, `021#M-2`, `021#M-3`, `031#L-1`.

명령 registry, implicit-visible 집합, deprecated redirect, owner map, goalplan field를 기계 판독 가능한
단일 schema에 두고 help·INDEX·structure 표를 생성한다. CI drift 검사가 runtime과 문서의 수동 복사
차이를 즉시 실패시킨다.

### 4. state와 ledger를 versioned schema로 통합 검증

근거: `011#M-7`, `011#M-8`, `011#M-10`, `031#M-2`, `031#M-3`, `031#M-4`, `031#M-5`.

session/workPhaseId를 모든 관련 row의 필수 key로 만들고 event union, 중복 ID, 교차 필드 invariant,
append 원자성을 validator와 migration에서 검사한다. 과거 loose row는 version별 decoder로 읽어
runtime state와 감사 원장의 분리를 막는다.

### 5. subagent lifecycle·token·effort 계약을 payload 테스트로 고정

근거: `011#H-2`, `011#M-5`, `021#H-3`, `021#M-4`, `021#L-2`.

V1/V2별 canonical payload fixture에서 TASK packet, outgoing recursion grant, model/effort, leaf guard를
end-to-end assertion한다. agents 문구와 spawn builder가 같은 fixture를 소비하면 child가 token 위치나
surface 기본값을 다르게 해석할 여지가 줄어든다.

## 3. 루프 회고

### A게이트 이력

메인 세션 집계 기준 A게이트는 총 12라운드다. 사이클 1은 8라운드로 라운드 1-7 FAIL 뒤
라운드 8 PASS를 받았다. 사이클 2는 GO-WITH-FIXES(blockers=1), 사이클 3은
GO-WITH-FIXES(blockers=2), 사이클 4는 GO-WITH-FIXES(blockers=3)였다. 사이클 1의 반복
합성은 `devlog/_plan/260710_repo_review/000_plan.md:105-190`에 남아 있다.

### 죽은 가설

| 가설 | 반증과 처분 |
|---|---|
| 문서 생산 유닛에는 phase별 decade 분리가 필요 없다 | 사이클 1 라운드 1 반박은 라운드 2-3에서 철회됐다. 010/020/030/040 스펙과 011/021/031/041 산출물을 분리했다. |
| cycle 4 C에서 최종 E8이 통과할 수 있다 | wp4는 C 뒤 D-close에서야 done이 된다. 라운드 5가 의존순서 불가능을 재현해 C는 예상-FAIL, 최종 pass는 post-D로 이동했다. |
| c5 evidence에 최종 validate PASS를 포함할 수 있다 | c5가 met이어야 validate가 통과하므로 자기 참조다. 라운드 7에서 c5를 D 전이 4건 증명으로 한정했다. |
| post-D 마감 작업을 wp4 task로 추적할 수 있다 | D-close가 wp4 task를 모두 done 처리한다. wp4-t4는 원장을 거짓으로 만들어 goalplan task 밖의 메인 세션 의무로 옮겼다. |
| `|| true`로 FAIL 출력을 캡처하면 E8 검증이 충분하다 | missing plan과 임의 실패도 성공 shell로 바뀌었다. 사이클 3 A게이트에서 고쳤지만 사이클 4 검증 설계에서 같은 마스킹 문제가 다시 제기돼 예상 reason assertion을 추가했다. 두 번 재발한 가설이다. |
| 선행 연구의 line/count를 그대로 재사용해도 된다 | 사이클 2 stale line과 사이클 3 goalplan ledger 증가가 반증했다. B 시점 전 인용 재해석과 가변값 재실측을 의무화했다. |

### 개선 안 된 것

- fail-open completion 경로와 evidence 진위 미검증은 문서로 확인했을 뿐 runtime에서 고치지 않았다.
- CLI/help, skill visibility, owner map, INDEX는 여전히 수동 관리다. 다음 변경에서 같은 drift가 다시
  생길 수 있다.
- loose ledger row, duplicate interview event, cross-session render ledger는 migration 없이 남아 있다.
- A게이트가 blocker를 많이 잡았지만 E8 마스킹과 stale 참조가 다음 사이클에서 반복됐다. fold 기록은
  재발 방지 장치가 아니다.
- 총 라운드 집계와 verdict receipt의 단위가 한 schema로 고정되지 않았다. 회고 수치도 수동 합산에
  의존한다.

### 반증 조건

현 권고 방향이 맞다는 주장은 다음 중 하나가 실패하면 철회한다.

- malformed bound plan fixture가 `update_goal complete`를 deny하지 않으면 fail-closed 설계는 미완료다.
- generated help/INDEX/owner map과 runtime registry의 byte-level 또는 semantic diff가 CI에서 통과하면
  canonical schema 전략이 drift를 막지 못한 것이다.
- versioned ledger validator가 기존 185개 loose row를 읽지 못하거나 새 loose row를 허용하면 migration
  전략이 틀렸다.
- payload fixture가 V1/V2 실제 spawn 입력과 달라 effort·token·leaf guard를 재현하지 못하면 subagent
  계약 테스트는 장식에 불과하다.
- wp4 D-close와 c5/c6 기록 뒤에도 최종 E8이 exit 0이 아니면 본 문서의 완료 의존순서가 틀렸다.
- 다음 work phase에서 stale citation 또는 `|| true` 마스킹이 다시 blocker가 되면 현재의 수동 fold
  절차는 재발 방지에 실패한 것이다.

## 4. E8 경로 서술

사이클 4 C 시점의 read-only validate 출력:

```text
[codexclaw loop validate: codexclaw-devlog-260710-repo-review-000-plan-010] FAIL
  - 1 work phase(s) not done: wp4
  - 2 unmet criterion/criteria: c5, c6
exit=1
```

이 FAIL은 예상된 상태다. 041의 token 검증과 내용 확인은 C에서 끝나지만 wp4 status는 아직
`in_progress`이고, `advanceWorkPhase()`는 D-close 때 wp4를 `done`으로 바꾼다. c5는 루트 ledger의
네 번째 D 전이 뒤에야 증거를 가질 수 있고, c6는 본 문서의 소스별 고유 token count를 C에서 확보한
뒤 기록해야 한다.

의존 순서는 고정이다.

1. C에서 `011`/`021`/`031` 고유 finding token을 각각 2개 이상 확인하고 위 예상-FAIL 형태를
   확인한다. 이 단계에서 exit 1을 pass로 바꾸지 않고 reason이 wp4/c5/c6인지 판정한다.
2. wp4 D-close로 네 번째 D 전이를 root ledger에 기록하고 wp4를 `done`으로 만든다.
3. c5에 D 전이 4건과 수집 시각을 기록해 `met`으로 바꾸고, c6에 본 문서 token count 검증 출력을
   기록해 `met`으로 바꾼다. final validate 출력은 c5 자체의 evidence로 넣지 않는다.
4. 최종 `cxc loop validate`를 실행해 exit 0을 확인한다.
5. `update_goal {status:"complete"}`를 호출한다. GOAL-COMPLETE-GATE-01이 bound goalplan의 E8을
   다시 실행해 cycle 외부에서 두 번째 완료 관문을 건다.

따라서 C 시점 FAIL은 오류가 아니라 post-D 증거가 아직 생성될 수 없다는 표시다. wp4 D-close,
c5/c6 기록, 최종 E8 exit 0, GOAL-COMPLETE-GATE-01 순서를 바꾸면 self-reference나 premature
completion이 다시 생긴다.

## 5. 리뷰어 verdict

사이클 4 A게이트 판정은 **GO-WITH-FIXES (blockers=3, 모두 Med)**다. 증거는
`.codexclaw/evidence/repo-review-cycle4-a-gate-20260710T055800+0900.md`에 있다.

폴드 내역:

- 교차 참조를 `011#H-1` 형식의 고유 token으로 고정하고 `sort -u` 기반 소스별 2개 minimum을
  수용 기준에 넣었다. 041은 각 token을 실제 발견 제목과 대조해 채택했다.
- C 시점 E8을 단순 non-zero로 취급하지 않고 `wp4 not done`, `c5/c6 unmet`의 정확한 예상 출력을
  §4에 기록했다. 최종 pass는 wp4 D-close 뒤로 유지했다.
- post-D sequence에 c5뿐 아니라 c6 token-count evidence 기록을 포함했고, cycle 4 verdict를 별도
  §5로 남겼다.

세 blocker는 본 문서 구조와 검증 계약에 폴드했다. 별도 재리뷰 판정은 없으므로 기록상 최종
verdict는 **GO-WITH-FIXES (blockers=3)**로 유지한다.
