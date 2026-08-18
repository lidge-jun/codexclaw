---
created: 2026-08-18
status: research
tags: [codexclaw, audit, hooks, silent-drop, agent-type, gates]
---

# 000 — 침묵 드롭 전수 검사 (v0.2.4 직후)

v0.2.4가 고친 것은 하나의 matcher였다. 그 결함의 **부류**가 더 있는지 보려고
`xai/grok-4.6` 서브에이전트 6개를 병렬로 파견했다. 스코프는 훅 등록/런타임
matcher, observer 상태기계, 훅 디스패처, 훅 신뢰·빌드·배포, PABCD attest
게이트, 나머지 훅 핸들러.

지배 질문 하나로 통일했다: **잡으라고 만든 것을 조용히 놓치고, 놓쳤다는 말도
안 하는 곳이 또 있는가.**

아래는 내가 직접 재현한 것만 적는다. 감사자 보고 중 재현되지 않은 항목은
"미검증"으로 남겼다.

## 확정 — 같은 부류의 죽은 훅이 하나 더 있다

**worker 영수증 게이트가 발화하지 않는다.** `subagent-stop-verifying-evidence.json`의
matcher가 `^worker$`인데, v1으로 스폰된 자식은 전부 `default`다. v0.2.4에서
고친 것과 정확히 같은 메커니즘이고, 형제 훅만 남겨둔 것이다.

matcher를 `.*`로 넓히는 것으로는 안 된다. 핸들러도 독립적으로
`GATED_AGENT_TYPES = {"worker"}`를 요구한다(subagent-evidence.ts:41,187). 둘 다
같은 값을 요구하므로 둘 다 죽어 있다.

더 곤란한 것은 이게 단순 오타가 아니라는 점이다. v1 표면에서는 **쓰기
서브에이전트와 읽기 전용 감사자를 구분할 방법이 없다.** 둘 다 `default`로
온다. `default` 전체를 게이팅하면 읽기 전용 탐색까지 영수증을 요구받는다.
수정은 matcher 한 줄이 아니라 역할 식별 방법의 재설계다.

정황 증거: `/Users/jun/Developer/new/700_projects/*/.codexclaw/evidence-attempts/`의
마지막 기록이 **2026-07-20**이다. 그 뒤로 쓰기 서브에이전트를 계속 썼는데
게이트가 한 번도 걸리지 않았다.

## 확정 — CLI가 시키는 문구를 CLI의 파서가 거부한다

`review-round open`은 리뷰어에게 이렇게 끝내라고 출력한다
(review-round-cli.ts:217):

```
  LAUNCH: r16-20260818051111
  VERDICT: PASS | NEAR-PASS | FAIL
```

저 두 줄을 **그대로** `parseSignoff`에 넣으면 거부된다. 열거형 안내선을 그대로
베낀 리뷰어의 판정은 조용히 사라진다. 실측:

```
REJECT CLI template verbatim
PARSES plain PASS
REJECT PASS with note      (VERDICT: PASS (minor nits))
REJECT PASS.
REJECT bold                (**VERDICT: PASS**)
```

마지막 두 줄만 본다는 규칙 자체는 자기서명 방지로 정당하다. 문제는 그 위에
얹힌 **정확 토큰 일치**다. 괄호 주석, 마침표, 굵게, 코드펜스가 전부 탈락한다.
matcher를 고친 지금은 이것이 판정이 사라지는 가장 흔한 경로다.

## 확정 — `out`과 같은 미선언 변수가 하나 더 있다

`spawn-attach-hook.ts:885`의 `surfaceMarker`가 선언되어 있지 않다. 도달하면
ReferenceError → catch → 재작성 전체가 조용히 통과한다. 현재 상수값 때문에 그
분기에 도달하지 않지만, `out`이 그랬듯 잠복이다.

## 확정 — 워크트리 삭제 가드가 `$PWD`를 못 본다

토크나이저가 변수를 확장하지 않는다. 관리 워크트리 슬롯 기준 실측:

```
DENY   rm -rf .
DENY   rm -rf <slot>/repo
ALLOW  rm -rf "$PWD"
ALLOW  rm -rf $(pwd)
ALLOW  rm -rf -- "$PWD"
ALLOW  git clean -fdx
ALLOW  python3 -c "import shutil; shutil.rmtree('.')"
```

`$PWD`와 `$(pwd)`는 에이전트가 실제로 타이핑하는 철자다. 리터럴 `$PWD`를
경로로 비교하니 보호 대상과 안 맞고, 조용히 허용된다.

## 확정 — abort 표식이 리뷰어 신원 자리를 차지한다

`abortRound`가 `lane.reviewerSession`에 `"aborted: <reason>"` 문자열을 쓴다. 그
필드는 첫 서명이 라운드를 결속하는 자리이기도 하다. 그래서 뒤늦게 도착한 진짜
판정이 "이미 `aborted: aborted by the agent`가 서명함"으로 기록된다. 실제 원장에
그 줄이 있다.

판정을 적용하지 않는 동작 자체는 옳다(이미 닫힌 라운드다). 틀린 것은 **이유**다.

## 확정 — 게이트는 CLI를 쓸 때만 게이트다

감사자가 스크래치에서 재현한 것들:

- `state.slug`가 비면 A>B와 C>D가 붙여넣기만으로 통과한다. slug는 무결성 검사
  없는 문자열이다.
- `goalplan.json`에 `approved` 라운드를 손으로 써넣으면 결속 검사를 통과한다.
  observer가 돌 필요가 없다.
- `test-receipt.json`을 손으로 써도 C>D가 통과한다. 소스 코드 주석이 이미
  인정하고 있다("a hand-written file is still possible").
- 세션 state 파일에 `phase: "B"`를 직접 쓰면 `transition()` 자체를 건너뛴다.

이건 결함이라기보다 **위협 모델의 경계**다. 이 시스템은 정직한 에이전트의
실수와 게으름을 막지, 파일을 쓸 수 있는 적대적 에이전트를 막지 않는다. 다만
문서가 "에이전트는 자기 승인을 쓸 수 없다"고 단언하는 것은 과한 주장이다.

## 확정 — doctor의 PASS가 증명하지 못하는 것

`cxc doctor`는 실행 중인 바이너리에게 묻지 않는다. `hook-trust`의 identity
해시는 런타임 해시의 사본이지 같은 함수가 아니다. matcher 유효성도 JS
`RegExp`로 보는데 런타임은 Rust `regex`다. 두 엔진의 수용 언어가 다르므로,
한쪽이 받고 다른 쪽이 거부하는 패턴에서 doctor는 초록인데 훅은 죽는다.

지금 22개 matcher는 양쪽 모두에서 유효하다. 깨진 것은 게이트지 현재 값이 아니다.

## 미검증 (감사자 보고만 있고 내가 재현하지 않음)

- `handlePreToolUseFailClosed`가 parse-null에서 fail-open (HIGH 주장)
- Stop이 읽을 수 없는 goal DB를 "목표 없음"으로 처리 (HIGH 주장)
- oversized stdin에서 `worktree-guard-pretool`이 exit 1 + 빈 출력
- idle-edit의 `permissionDecision:"allow"` 봉투를 런타임이 폐기

마지막 항목은 감사자가 0.148.0-alpha.9 바이너리를 근거로 들었는데, 이 세션이
쓰는 런타임은 0.146.0이다. 버전이 다르므로 그대로 믿지 않는다.

## 반증된 가설

**스킬 주입 훅은 죽지 않았다.** matcher `^(collaboration[._]?)?spawn_agent$`가
모델이 보는 이름 `multi_agent_v1__spawn_agent`와 안 맞는 것은 사실이지만,
런타임이 훅에 넘기기 전에 `spawn_agent`로 정규화한다. 이 세션이 띄운 실제 v1
자식의 트랜스크립트에 `CXC-SKILL-AFFORDANCE` 마커가 찍혀 있는 것으로 확인했다.

처음에 이것을 최우선 용의자로 지목했는데 틀렸다. 훅 이름과 도구 이름은 다른
층위다.

## 우선순위 제안

1. worker 영수증 게이트 — 죽어 있고, 고치려면 v1에서 역할을 식별할 방법부터
   정해야 한다. 설계 판단이 필요하다.
2. `parseSignoff` — CLI 안내 문구와 파서를 일치시킨다. 둘 중 하나는 틀렸다.
3. `$PWD` 워크트리 가드 — 안전 경계다.
4. `surfaceMarker` 미선언 — 한 줄.
5. abort 표식 — 진단 정확도.
