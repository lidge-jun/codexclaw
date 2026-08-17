---
created: 2026-08-17
status: record
workPhase: wp5
tags: [codexclaw, release, outcome]
---

# 060 — 결과 기록

## 무엇이 실제로 고쳐졌나

사용자 신고는 "A에서 서브에이전트 gate를 기록했는데 못 읽는다"였다.
증상은 하나였지만 **원인은 둘**이었고, 둘 다 이 사이클에서 잡혔다.

### 결함 1 — 재계획 레이스 (000/032, 커밋 337add01)

A>P로 재계획하면 새 planEpoch가 발급된다. 그전에 파견된 리뷰어가 늦게
끝나면 observer의 epoch 검사에 걸려 서명이 조용히 버려지고 라운드는
`in_flight`로 영구 정지한다. opencodex 세션 01a00d34에서 실측한 그대로다.

수정: `roundByLaunchId()`로 서명이 들고 온 launch id로 라운드를 먼저 찾고,
`isSuperseded()`를 CAS **이전에** 판정하며, 재계획이 무효화한 라운드를
`supersedeStaleRounds()`가 닫는다. 그리고 observer의 모든 거부가
`review_signoff_ignored`로 ledger에 사유를 남긴다 — 침묵 실패가 이 결함을
진단 불가능하게 만든 진짜 원인이었다.

### 결함 2 — v1 스폰 표면 (050, 커밋 543a402)

이건 결함 1을 고치는 도중 **이 세션에서 재발해서** 잡혔다. 라운드 r6을 열고
리뷰어를 파견했는데 정상 종료하고 서명까지 냈는데도 라운드가 열린 채였고,
심지어 방금 만든 진단 기록조차 없었다. 훅이 아예 호출되지 않은 것이다.

원인 사슬은 `features.multi_agent_v2 = false`에서 시작한다. v1 스폰
스키마에는 `agent_type` 필드가 없어서 파견 때 넘긴 값이 버려지고,
SubagentStop payload에 그 필드가 없으니 훅 매처 `^explorer$`가 안 맞는다.

수정: 매처를 `^(explorer)?$`로 넓히고(worker는 여전히 제외되므로 영수증
게이트와 경쟁하지 않는다), observer는 "explorer인가"가 아니라 "worker가
아닌가"로 판별한다. 그 대가로 잃은 신원은 라운드가 되찾는다 — 첫 서명이
라운드를 그 agent_id에 결속하고, 이후 다른 자식의 서명은 거부된다.

## 감사가 실제로 한 일

5라운드(r6~r10)에서 FAIL 4번이 나왔고, 전부 내가 틀린 것이었다.

| 라운드 | 판정 | 잡아낸 것 |
|--------|------|-----------|
| r6 | FAIL | 040이 존재하지 않는 npm 발행 경로를 검증 단계로 기술 (private:true, 워크플로에 publish 없음) |
| r7 | FAIL | agent_type 검사 제거로 리뷰어 신원 소실 / v2 플래그 파서가 한 형태만 인식 / 훅 재신뢰 누락 / parse.ts 완화는 observer 경로와 무관 |
| r8 | FAIL | 040이 옛 SHA를 고정해 검증 없는 커밋이 승격될 수 있음 |
| r9 | FAIL | inventory.json이 stale이라 릴리스가 아티팩트 생성 전에 거부 / PATH `cxc` retrust는 작업 트리를 신뢰시켜 실행 불가 |
| r10 | PASS | 네 closure 전부 검증, 릴리스 시퀀스 실행 가능 |

r9의 inventory 지적이 특히 값졌다. 그대로 갔으면 릴리스 워크플로가
아티팩트를 만들기도 전에 실패했다. 감사가 없었으면 실패한 릴리스를 보고
원인을 다시 찾고 있었을 것이다.

## 배포 검증

- dev head `cabfc743` — CI, Packed install lifecycle 모두 success
- main 승격 후 재발화된 두 워크플로도 같은 SHA에서 success
- 릴리스 run 32023366302 success
- `v0.2.3`이 Latest, prerelease=false, draft=false
- 태그가 `cabfc743`을 가리키고 origin/main의 조상 관계 확인
- 에셋 3개: payload tar.gz, SHA256SUMS, candidate manifest
- 루트 스위트 1714/1714

## 로컬 설치본

`0.2.3+codex.20260817035223` -> `0.2.3+codex.20260817044718`로 재설치하고
설치본 payload를 대상으로 훅 22개를 재신뢰했다. 캐시본의 matcher가
`^(explorer)?$`이고 dist에 신원 결속 코드가 들어간 것을 확인했다.

실행 중인 이 세션의 훅은 시작 시점 설정을 계속 쓰므로, 새 훅이 자동으로
발화하는 것은 **새 세션에서** 확인해야 한다. 이 사이클에서는 설치본
`cli.js`에 v1 payload를 직접 넣어 동작을 확인했다:

- agent_type 없는 서명 -> 라운드 `approved` (수정 전에는 불가능)
- bystander의 상반된 서명 -> 거부 + ledger에 `already signed by ...`

## 남은 것

없다. 다만 사용자가 Codex를 재시작하면 새 훅이 이 세션에서도 자동 발화한다.
