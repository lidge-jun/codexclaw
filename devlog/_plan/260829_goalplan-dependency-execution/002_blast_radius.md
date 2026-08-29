# 002 — 소비자 파급 범위

출처: T2 파견. 결론부터: `dependsOn`을 선택 필드로 넣는 것만으로는 안전하지 않다.
reviver가 허용 필드만 재구성하므로 새 필드는 `readGoalplan()` 직후 메모리에서 사라지고
다음 쓰기에서 파일에서도 삭제된다.

## 소비자 × 읽는 필드 × 위험도

| 소비자 | 읽는 것 / 가정 | 위험 |
| --- | --- | --- |
| goalplan.ts (스키마 정본) | 타입 선언과 revive가 허용 필드만 재구성(440, 449). 쓰기는 객체 전체 직렬화(616) | 매우 높음 |
| goalplan.ts 파생 helper | remaining은 status만(700), nextOpenTask는 선언 순서 첫 pending(707), advance/effectiveActive는 배열 순서(1029, 1082) | 매우 높음 |
| goal-gate.ts | slug로 plan을 읽고 validateGoalplan 전체 결과를 complete 허용 조건으로(270). 읽기 실패도 거부 | 높음 |
| goalplan-cli.ts | show가 slug/objective/host/phase id·status·title/criteria 표시(275). init이 빈 workPhases 생성(324) | 중간 |
| orchestrate-cli.ts | gated edge에서 effectiveActive와 attest workPhaseId 일치 가정(492). D-close에서 advance 후 재기록(609, 674) | 매우 높음 |
| hook.ts Stop | 차단은 host goal/FSM 상태로 결정(1253). 진행 판정은 effectiveActive(988). 안내는 첫 open task와 첫 unmet criterion(1143) | 높음 |
| hook.ts 채팅 D-close | advance 후 goalplan 재기록(817, 893) | 매우 높음 |
| attest.ts | 파일을 읽지 않음. effectiveActive와 att.workPhaseId 일치 가정만(135) | 중간(간접) |
| review-round.ts | reviewRounds/커서/round 상태를 읽고 `{...plan}`으로 새 plan(53, 86) | 낮음(간접) |
| review-round-cli.ts | plan 읽고 effectiveActive를 round에 결합 후 재기록(201, 237). abort도 RMW(257) | 높음 |
| review-observer.ts | round/session/epoch/workPhase 결합 확인 후 verdict 기록·재기록(104, 137, 154) | 높음 |
| steering.ts | criteria/workPhases/steeringLog를 읽고 add-work-phase는 고정 shape로 생성(210, 239) 후 전체 기록(307) | 매우 높음 |
| subagent-config/final-gate-guard.ts | 공용 decoder 없이 JSON 직접 읽음. finalGate 경로와 criteria surface만(125, 136). 쓰지 않음 | 낮음 |
| cxc-ops/reset.ts, cli.ts | JSON 필드를 읽지 않고 디렉터리를 reset 단위로 취급(74, 131) | 낮음 |
| pabcd-state/cli.ts | loop/goalplan 명령을 라우팅만(151) | 낮음 |
| source-identity.ts | `.codexclaw/` 전체를 FSM 산출물로 보고 source-delta에서 제외 가능(139) | 낮음 |
| messenger-bridge/db.ts | 주석에만 등장. 파일·필드를 읽거나 쓰지 않음(354) | 없음 |
| skills/loop/SKILL.md | 사람이 직접 편집할 on-disk 스키마를 명시(239) | 높음(문서 계약) |

## 왜 "선택 필드 추가"가 안전하지 않은가

속성 접근 자체는 깨지지 않는다. 그런데 decoder를 고치지 않으면 필드가 조용히 유실되므로
데이터 계약은 즉시 깨진다. 유실 경로가 다섯 개다.

1. orchestrate-cli.ts D-close (advance → write)
2. hook.ts 채팅 D-close (advance → write)
3. steering.ts (applyOps → write)
4. review-round-cli.ts (open / abort)
5. review-observer.ts (verdict 기록)

즉 리뷰어가 종료하기만 해도 의존 정보가 날아간다. 그래서 wp2(reviver 보존)가 첫 구현 phase다.

## 의미가 깨지는 지점

`dependsOn`이 실행 순서를 제약한다면 현재 동작은 의미적으로 틀려진다.

- effectiveActiveWorkPhaseId는 첫 in_progress, 그다음 첫 pending을 고르고 의존을 안 본다.
- advanceWorkPhase도 현재 뒤 첫 pending을 바로 활성화한다.
- nextOpenTask도 의존 미충족 항목을 Stop 안내의 "다음 작업"으로 고를 수 있다.
- validateGoalplan에 미존재 참조·자기 참조·사이클·미완료 의존을 둔 done 검사가 없다.
- steering add-work-phase에 의존을 받을 입력 shape가 없다.

따라서 의미 있는 dependsOn은 하위 호환 메타데이터가 아니라 스케줄링 계약 변경이다.
이것이 wp2(저장만)와 wp4(해석)를 분리한 이유다.

## 반드시 손댈 파일

구현: goalplan.ts(타입·reviver·진단·무결성·의존 인식 선택·버전 정책), steering.ts(입력 shape·검증·생성),
goalplan-cli.ts(파서·도움말·표시), skills/loop/SKILL.md(스키마 계약).

회귀 테스트: goalplan.test.ts(왕복·선택·참조 거부), work-phase-states.test.ts(blocked/superseded 조합),
steering.test.ts(의존 포함 추가와 기존 필드 비유실), hook-continuation.test.ts(Stop 안내),
orchestrate-cli.test.ts(D-close가 미충족 의존을 활성화하지 않음), review-binding.test.ts(RMW 비유실),
final-gate.test.ts(v3·미래 버전 거부), goal-gate.test.ts(의존 위반 시 complete 거부).

대체로 코드 변경이 불필요: attest.ts, review-round.ts, review-round-cli.ts, review-observer.ts
(decoder가 보존하면 로직은 그대로. 단 비유실 테스트는 필요), final-gate-guard.ts, cxc-ops,
source-identity.ts, messenger-bridge/db.ts.
