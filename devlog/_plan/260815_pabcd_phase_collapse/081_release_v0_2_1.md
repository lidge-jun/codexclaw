---
created: 2026-08-15
status: evidence
workPhase: wp5
tags: [codexclaw, release, evidence]
---

# 081 — v0.2.1 릴리스 기록

## 결과

`codexclaw v0.2.1  Latest  v0.2.1  2026-08-15T17:16:25Z`

- 릴리스 실행: `31897779412` conclusion=success
- 태그: `v0.2.1` → `a7398d90ddab1f1ca78ef5623816992d6f27fc6f`
- `dev`: `05d6fab4..d57b8e06` → `d57b8e06..a7398d90`
- `main`: `a7398d90` (fast-forward)
- leniency 플래그 없이 stable로 게시

## 게이트가 두 번 거부했고 두 번 다 옳았다

### 1차 거부 (31897415374)

```
release verify: NOT READY — 2 blocker(s):
  - platform-ci is missing
  - published tests=1678 but the measured suite reported 1702
```

두 번째가 진짜 결함이었다. 버전 범프를 `sed`로 하면서 README의 버전 문자열만
바꾸고 **테스트 배지는 0.2.0 시절 숫자 그대로** 뒀다. 게이트가 배지를 실측과
대조해 잡아냈다. 사람이 읽는 문서와 측정값이 갈라지는 정확히 그 지점이다.

`platform-ci`는 레이스였다 — 릴리스를 CI와 동시에 돌려서 exact-head 결론이
아직 없었다.

### 2차 거부 (31897640923)

```
release verify: NOT READY — 1 blocker(s):
  - platform-ci is missing
```

배지는 고쳤는데 같은 blocker가 남았다. API 조회를 직접 해보니:

```
CI | in_progress | null      | 17:12:14   <- main 승격이 새로 트리거
Packed install lifecycle | completed | success | 17:12:14
CI | completed | success     | 17:09:28   <- dev 푸시 때의 성공
```

워크플로가 `sort_by(.created_at) | last`로 최신 하나만 보므로, main 승격이
재트리거한 `in_progress`를 집어 `none`이 됐다. 앞선 성공 실행이 있는데도.

이건 릴리스 트레인의 알려진 특성이지 이번 변경의 결함이 아니다. 새 CI가
끝나기를 기다렸다가 3차에서 통과했다.

## 이번 릴리스에 담긴 것

세 게이트와 그 근거 문서:

- `CYCLE-COMPLETION-01` — 미완 task로 사이클을 닫지 못한다
- `TRIGGER-AUTHORITY-01` — 자연어가 진행 중인 사이클의 위상을 못 옮긴다
- `SOURCE-DELTA-01` — B에서 소스가 안 변하면 `B>C`를 거부한다

남은 것은 별도 work-phase로 등록돼 있다: `060`(A>B review-round 배선,
붕괴의 38%로 최다) 와 `070`(C>D source-bound receipt).

## 이 문서가 여기 있는 이유

`B>C`를 요청했더니 `SOURCE-DELTA-01`이 거부했다. 릴리스 작업이 B 진입 전에
끝나 있었기 때문이다(051과 같은 상황). 우회 플래그는 만들지 않았으므로,
B 안에서 이 기록을 써서 정당하게 통과한다.

게이트가 세 번째로 자기 저자를 막았고, 세 번 다 맞았다.

