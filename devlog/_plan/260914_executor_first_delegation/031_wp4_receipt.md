# 031 wp4 receipt — 격리 환경 관측 증거

실행일 2026-09-14. 워크트리 /home/jun/code-worktrees/codexclaw/executor-first-delegation, 브랜치 codex/executor-first-delegation.
격리 홈 `/home/jun/tmp/cxc-exec-first-home-01a09f4f`, 설치본
`0.2.28+codex.20260914090142`.

## 실제 설치본 무변경

```text
files=3601 digest=ffd090c279d72db000f008e42210e740b183d9ebc568a6aaae2e68f714e6c4a8  -   (BEFORE)
files=3601 digest=ffd090c279d72db000f008e42210e740b183d9ebc568a6aaae2e68f714e6c4a8  -   (AFTER)
REAL INSTALL UNCHANGED
```

두 스캔 모두 성공했고 파일 수가 0이 아니며 서로 같다.

## 훅 경로 (UserPromptSubmit, 설치본 dist/cli.js)

세 호출 모두 자기 단계 헤더를 갖고 실행됐다(turn_id t1/t2/t3).

| 프롬프트 | 헤더 | 구현 담당 포인터 |
|---|---|---|
| orchestrate P | `[codexclaw: PLAN]` | 있음 — "Record implementation ownership per planned change: a specified slice defaults to the configured executor, main needs a stated reason ($codexclaw:cxc-dev Implementation delegation)." |
| orchestrate A | `[codexclaw: AUDIT]` | 없음 |
| orchestrate B | `[codexclaw: BUILD]` | 있음 — "Execute the plan's recorded implementation ownership; an unassigned slice needs a P amendment, and main verifies a returned diff rather than the report." |

## CLI 경로 (설치본 bin/cxc.mjs, 별도 픽스처)

```text
orchestrate P: current=IDLE -> P (IDLE → P, session cli) [implementation ownership: record an owner per planned change (cxc-dev Implementation delegation)]   exit=0
orchestrate A: current=P -> A (P → A, session cli)                                                                                                          exit=0
orchestrate B: current=A -> B (A → B, session cli) [implementation ownership: execute the plan's recorded owners; a new handoff needs a P amendment]         exit=0
session=cli phase=B interview=false auditPassed=true checkPassed=false                                                                                       exit=0
```

P와 B에만 붙고 A와 status에는 붙지 않는다. 네 호출 모두 exit 0이므로
거부 메시지가 음성 결과를 만든 경우가 아니다.

## 워크트리 쪽 증거 (wp3에서 확보)

- RED: 기준 커밋 1a063c76 임시 워크트리에 새 테스트만 얹어 3건 실패 재현.
- GREEN: 현재 HEAD에서 183/183, 전체 `npm test` 3152개 중 3079 pass / 0 fail / 73 skipped.
- `node plugins/codexclaw/scripts/gate.mjs` exit 0.

## 재현 스크립트

`/var/tmp/cxc-wp4-verify-01a09f4f.sh` — 격리 설치본에 대해 위 관측을 다시 실행하고
단언한다. 픽스처는 매 실행마다 새로 만든다.

## 증명하지 않은 것

실제 비용 절감. 그것은 동일 조건에서 메인+executor 합산 비용을 측정해야 하며
이 유닛의 범위 밖이다. 호스트 제약 하나를 기록해 둔다: 이 머신에는 `/tmp/.git`이 있어
TMPDIR을 분리하지 않으면 무관한 GUI project-root 테스트가 실패한다.
