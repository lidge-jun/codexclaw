---
created: 2026-08-15
status: superseded
supersededBy: 061_review_binding.md
warning: 폐기됨 — open/close CLI는 자기 attest와 동형이다. 승인은 observer만 쓸 수 있어야 한다.
workPhase: wp5
tags: [codexclaw, review-round, a-to-b]
---

# 060 — A>B review-round 배선

## 왜 이것이 가장 중요한가

000의 계측: A>B가 323건 중 **124건(38%)** 0-1초 통과. 네 엣지 중 압도적 1위다.
사용자의 "심지어 A도 안 간다"가 이 수치다.

현재 A>B 게이트는 `auditOutput` 문자열과 `auditVerdict` 값만 본다.
리뷰어를 실제로 파견했는지 확인할 방법이 없어 자기가 쓴 문장으로 통과할 수 있다.

## 기존 자산

`review-round.ts`가 이미 갖춘 것:

- plan_audit 전용 purpose와 라운드 lifecycle
- launch ID, plan sha256, reviewer session 결속
- SourceIdentity 연동
- verdict → status 매핑 (pass/near-pass → approved, fail → changes_requested)
- **staleness 판정** — near-pass로 접은 계획은 문서가 바뀌므로 planSha256이 어긋나
  stale이 된다. 이게 다음 A>B를 실제로 게이트하는 신호다.

모듈 주석이 명시한다: "이 슬라이스는 상태 기계만 싣는다. A->B attest 게이트 배선은
CLI가 먼저 있어야 한다." **그 CLI를 만드는 것이 이 work-phase다.**

## 코드 실측 (wp6 P에서 확인)

### 이미 있는 것

`review-round.ts`는 상태 기계를 온전히 갖췄다: `openRound`, `markLaunching`,
`markInFlight`, `recordVerdict`, `staleness`, `effectiveRound`.
`ReviewRoundState`는 `roundId`/`purpose`/`planPath`/`planSha256`/
`status`/`lane`을 담고, `lane`에 `launchId`, `reviewerSession`,
`artifactSha256`, `sourceIdentity`, `verdict`가 있다.

`staleness(plan, roundId, currentPlanSha)`가 이 게이트의 실제 신호다:
terminal이 아니면 `open`, `planSha256`이 현재와 같으면 `fresh`, 다르면 `stale`.

### 감사가 지적한 조회 문제 (라운드 5 BLOCKER 2)

`effectiveRound()`는 terminal 상태를 **제외**한다(`review-round.ts:79,81`).
`approved`는 terminal이므로 승인된 라운드는 이 함수로 못 찾는다. 게다가
`recordVerdict`가 승인과 동시에 cursor를 지운다.

따라서 A>B 게이트는 별도 조회가 필요하다: **해당 purpose의 라운드 중
가장 최근 terminal 라운드**를 찾는 함수를 추가한다. 새 상태를 만들지 않고
기존 배열을 다른 기준으로 읽을 뿐이다.

## 변경

### 1. review-round CLI (신규)

- open: 라운드를 열고 plan sha256과 launch id를 기록한다.
- close: 리뷰어 회신(verdict + output)으로 라운드를 닫는다.
- show: 현재 라운드 상태.

### 2. A>B 게이트 배선

`orchestrate-cli.ts`의 A>B 경로에서 bound goalplan의 활성 plan_audit 라운드를
조회한다.

| 상태 | 동작 |
|------|------|
| approved + fresh | 통과 |
| approved + stale | 거부 — 계획이 승인 후 바뀌었다, 재감사하라 |
| changes_requested | 거부 — AUDIT-LOOP-01 |
| 라운드 없음 | 거부 — 리뷰어를 실제로 열어라 |
| goalplan 미결속(HITL) | 기존 form 게이트만 적용 (fail-open) |

### 3. SubagentStop 광역 관측 (감사 MAJOR 4 반영)

**기존 worker evidence deny 게이트는 건드리지 않는다.** 그 훅은
worker 전용 matcher를 유지하고(`subagent-evidence.test.ts:139`가 고정),
explorer를 그 deny 경로에 넣으면 정상 read-only 감사가 receipt 때문에 막힌다.

대신 **별도의 non-deny observer**를 둔다: explorer 포함 모든 SubagentStop을
받아 라운드 완료 사실만 기록하고, 절대 block하지 않는다.

## activation scenario

| 시나리오 | 트리거 | 관측 효과 |
|----------|--------|-----------|
| 라운드 없이 A>B | 바로 attest | 거부 + open 안내 |
| stale 승인 | 승인 후 계획 수정하고 A>B | 거부 + 재감사 안내 |
| 정상 | open → 리뷰어 파견 → close(pass) → A>B | 통과 |
| HITL 무영향 | slug 없는 세션 | 기존대로 |

## 한계

리뷰어 **품질**은 검증할 수 없다. 라운드를 열고 아무 문장으로 닫으면 통과한다.
이 게이트가 보장하는 것은 "감사 절차를 거쳤다"는 구조적 사실이지
"감사가 훌륭했다"가 아니다.
