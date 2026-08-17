---
created: 2026-08-17
status: design
workPhase: wp6
tags: [codexclaw, review-binding, spawn-surface, multi-agent-v1]
---

# 050 — v1 스폰 표면에서 감사 서명이 도달하지 못한다

## 실측 — 같은 결함이 이 세션에서 재발했다

wp5의 감사 라운드 r6을 열고 리뷰어를 파견했다. 리뷰어는 정상 종료했고
마지막 두 줄로 `LAUNCH: r6-20260817041935` / `VERDICT: FAIL`을 냈다.
그런데 라운드는 `in_flight`로 남았고 ledger에는 `review_signoff_ignored`
조차 없었다. 010에서 만든 진단 경로가 아예 발화하지 않은 것이다.

observer 로직 자체는 멀쩡하다. 같은 payload를 직접 stdin으로 넣으니
`status=changes_requested verdict=fail`로 정확히 기록됐다. 즉 **훅이
호출되지 않았다.**

## 원인 사슬

```
features.multi_agent_v2 = false        (codex features list로 실측)
  └─> v1 spawn_agent 표면이 활성
       └─> v1 스키마에 agent_type 필드가 없다
            └─> 파견 때 넘긴 agent_type:"explorer"가 조용히 버려진다
                 └─> SubagentStop payload에 agent_type이 없다
                      └─> 훅 manifest의 matcher "^explorer$"가 안 맞는다
                           └─> observer 미발화 → 라운드 영구 in_flight
                                └─> A>B 영구 거부
```

r1~r5가 기록된 것과 모순되지 않는다. 그 라운드들은 이전 턴에서 파견됐고,
그때는 v2 표면이 살아 있었다. 표면이 바뀐 뒤 열린 첫 라운드가 r6이고,
정확히 거기서부터 끊겼다.

`parse.ts:127`이 `agent_type` 부재를 이미 알고 있다 — `return null`로
payload를 통째로 버린다. 의도는 맞다(agent_type은 매처 키이자 게이트의
판별자다). 문제는 그 거부가 **아무 흔적도 남기지 않는다**는 것이다.
010에서 observer의 침묵을 없앴는데, 그보다 한 단계 앞의 침묵이 남아 있었다.

## 왜 이게 사용자가 신고한 그 증상인가

사용자 신고는 "A에서 서브에이전트 gate를 기록했는데 못 읽는다"였다.
000에서 잡은 재계획 레이스는 실재하는 별개 결함이고 고쳤다. 하지만
opencodex 세션 01a00d34의 r8이 `approved`였던 것과 달리, 이번 r6은
**열린 채로 아무것도 안 됐다.** 두 결함은 증상이 같고 원인이 다르다.

## 처방 1 — 매처를 표면 중립으로

훅 manifest의 `"matcher": "^explorer$"`는 v2 전용 가정이다. v1에는
맞출 agent_type이 없다. 매처를 넓히고 판별을 런타임으로 옮긴다:

```json
"matcher": "^(explorer)?$"
```

빈 문자열과 explorer만 통과시킨다. worker는 여전히 제외되므로
DISPATCH-AGENT-TYPE-01의 "worker는 영수증 게이트가 소유한다"는
분리가 유지되고, 두 SubagentStop 훅이 같은 자식을 놓고 경쟁하지 않는다.

## 처방 2 — parse가 agent_type 부재를 허용한다

`parseSubagentStop`이 `agent_type` 없는 payload를 버리는 대신 빈
문자열로 통과시킨다. 이 완화는 안전하다:

- 영수증 게이트(`subagent-evidence.ts:187`)는 `GATED_AGENT_TYPES`에
  `worker`만 담는다. 빈 문자열은 게이트를 트리거하지 않으므로 v1
  worker가 영수증을 우회하는 일은 생기지 않는다 — v1에는 worker를
  지정할 방법 자체가 없다.
- observer는 아래 처방 3으로 판별을 바꾼다.

## 처방 3 — observer는 서명으로 판별한다

`review-observer.ts:32`의 `if (payload.agent_type !== "explorer") return ""`를
바꾼다. 이 검사의 목적은 "worker의 종료는 영수증 게이트 것"이라는 분리이지
"explorer만 감사한다"가 아니다. 그리고 **서명이 있다는 것 자체가 이 자식이
리뷰어라는 증거다** — 서명은 라운드의 launchId를 들고 오고, 그 launchId는
우리가 발급한 것이다. 아무 자식이나 흉내낼 수 없다.

```ts
// worker는 영수증 게이트가 소유한다. 그 외(explorer, 그리고 agent_type을
// 실을 방법이 없는 v1 표면의 빈 값)는 아래 결속으로 판별한다.
if (payload.agent_type === "worker") return "";
```

### 서명만으로는 신원이 서지 않는다 (감사 r7 High 지적)

초안은 여기서 "서명이 launchId를 들고 오니 아무 자식이나 흉내낼 수 없다"고
썼다. **틀렸다.** 리뷰어가 근거를 댔고 확인했다:

- `mintLaunchId`(review-round.ts:102)는 `r7-20260817043826` 꼴이다.
  라운드 번호 + 타임스탬프. 비밀이 아니고 예측 가능하다.
- 자식 훅은 **부모의 session_id를 그대로 물려받는다**(cli.ts:242 주석).
  그래서 `ownerSessionId !== sessionId` 검사는 같은 부모의 다른 자식을
  전혀 걸러내지 못한다.
- `agent_id`는 수리 후 `reviewerSession`으로 **기록만** 될 뿐 검사되지 않는다.

즉 `agent_type`이 하던 유일한 신원 역할을 없애고 그 자리에 아무것도 놓지
않았다. 같은 세션의 무관한 자식이 launchId를 한 번 보기만 하면 라운드를
닫을 수 있다. v2에서도 explorer 자식이 여럿이면 같은 구멍이 있었고, v1에서는
모든 자식으로 넓어진다.

### 처방 3b — 라운드에 리뷰어를 사전 결속한다

표면이 무엇을 실어주든 상관없는 신원을 우리가 만든다. `review-round open`이
라운드를 열 때 `reviewerAgentId`는 아직 없다(파견 전이다). 그래서 순서를
뒤집는다: **처음 도착한 서명이 그 라운드의 리뷰어를 확정하고, 이후 다른
agent_id의 서명은 거부된다.**

이것으로 막히는 것: 리뷰어가 PASS를 낸 뒤 다른 자식이 판정을 덮어쓰는 것,
그리고 라운드당 정확히 한 자식만 판정을 쓴다는 불변식.

막지 못하는 것도 정직하게 적는다: 진짜 리뷰어보다 **먼저** 종료하는 무관한
자식이 있다면 그 자식이 리뷰어로 확정된다. 이 잔여 위험을 없애려면 파견
시점에 agent_id를 라운드에 심어야 하는데, 파견은 우리가 아니라 에이전트가
하므로 CLI가 관측할 수 없다. 대신 `recordVerdict`가 `reviewerSession`을
남기므로 누가 닫았는지는 항상 감사 가능하다. 그리고 서명 형식(마지막 두
줄이 정확히 LAUNCH/VERDICT)은 우연히 만족되지 않는다 — 무관한 자식이
이 형식으로 끝나려면 그렇게 지시받았어야 한다.

```ts
if (round.lane.reviewerSession && round.lane.reviewerSession !== agentId) {
  return ignore("another agent already signed this round");
}
```

판별 순서: 서명 파싱 실패면 즉시 반환하므로, 리뷰어가 아닌 자식의 종료는
여전히 아무 일도 일으키지 않는다.

### 처방 2는 철회한다 (감사 r7 지적)

`parseSubagentStop` 완화는 **observer 경로와 무관하다.** `cli.ts:295`에서
`subagent-stop-review` 이벤트는 `handleReviewObserver(raw)`를 직접 부르고,
`parseSubagentStop`은 영수증 게이트 분기에서만 쓰인다. 내가 경로를 확인하지
않고 고쳤다. 되돌린다 — worker 게이트의 입력 계약을 이유 없이 넓히는 변경일
뿐이다.

## 처방 4 — `review-round open`이 표면을 보고 말한다

현재 출력은 "Dispatch an independent reviewer (agent_type explorer)"다.
v1 세션에서 이 지시는 **실행 불가능하다.** 넘겨도 버려진다. 게이트가
지킬 수 없는 지시를 내리는 것이 이 결함을 사용자 눈에 "훅이 없어졌다"로
보이게 만든 부분이다.

`multi_agent_v2` 플래그를 읽어 표면을 판정하고, v1이면 agent_type 문구를
빼고 "서명 두 줄"만 요구한다. 처방 1~3이 v1에서도 기록을 성립시키므로
이 지시는 이제 참이다.

## 검증

- red 테스트: agent_type 없는 SubagentStop payload로 서명을 넣으면
  수정 전에는 라운드가 in_flight로 남고, 수정 후 approved가 된다.
- worker 회귀: agent_type:"worker" payload는 서명이 있어도 observer가
  기록하지 않는다(영수증 게이트 소유).
- 실물: 이 세션에서 v1로 리뷰어를 다시 파견해 라운드가 실제로 닫히는 것을
  관찰한다. 프로브가 아니라 실사용 경로여야 한다.

## 스코프 밖

- `multi_agent_v2`를 켜는 것으로 때우기. 사용자 환경 설정이고, v1은
  지원 표면이다. 표면을 바꿔 증상을 감추는 것은 수정이 아니다.
- 서명 형식 변경, 결속(planEpoch/launchId) 정책 변경.
