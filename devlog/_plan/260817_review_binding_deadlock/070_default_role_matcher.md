---
created: 2026-08-18
status: done
workPhase: wp7
tags: [codexclaw, review-binding, spawn-surface, multi-agent-v1, hook-matcher]
---

# 070 — matcher는 빈 문자열이 아니라 `default`를 받아야 했다

050은 결론이 반쯤 맞았다. 훅이 발화하지 않는다는 진단은 정확했고, 원인을
v1 스폰 표면에 둔 것도 맞다. 틀린 것은 마지막 고리다.

050은 "payload에 agent_type이 없다 → 빈 문자열로 도달한다"고 적고
matcher를 `^(explorer)?$`로 넓혔다. 빈 문자열을 받게 한 것이다. 그런데
런타임은 빈 문자열을 보내지 않는다. **역할 없이 스폰된 자식은
`default`로 정규화된다.** `^(explorer)?$`는 `""`와 `"explorer"`만
허용하므로 `default`는 여전히 걸러졌고, 훅은 050 이후에도 한 번도 돌지
않았다.

그 결과가 이번 세션의 8라운드다. r1부터 r8까지 리뷰어는 매번 정상 종료해
규격대로 서명했는데 라운드는 계속 `in_flight`였고, 에이전트는 매번 손으로
`review-round abort`를 쳐서 `inconclusive`로 닫았다. ledger에는
`review_signoff_ignored` 한 줄도 없다 — 판정을 버린 이유를 적는 코드가
observer **안에** 있는데, observer 자체가 호출되지 않았기 때문이다.

## 실측

추론이 아니라 살아있는 세션에서 확인했다.

1. 라운드 하나를 armed 상태로 만들고(`launchId: r1-hookprobe`, phase A)
   실제 v1 서브에이전트를 띄워 정확히 두 줄만 내게 했다:

   ```
   LAUNCH: r1-hookprobe
   VERDICT: PASS
   ```

   결과: `status: in_flight`, ledger 없음. 아무 일도 일어나지 않았다.

2. 같은 payload를 설치본 dist에 직접 넣으면 `approved`로 기록된다.
   observer 로직은 멀쩡하다. 호출이 안 될 뿐이다.

3. 그 자식의 session_meta:

   ```json
   {"source":{"subagent":{"thread_spawn":{"agent_role":null}}},
    "multi_agent_version":"v1","cli_version":"0.146.0"}
   ```

   역할이 `null`이다. v1 `spawn_agent` 스키마에 agent_type 인자가 아예
   없으니 파견하는 쪽이 라벨을 붙일 방법이 없다.

## 처방

matcher를 `.*`로 둔다. worker 제외는 observer 코드가 이미 하고 있고
(`agent_type === "worker"`면 즉시 반환), 그래서 영수증 게이트와 이
observer가 같은 자식을 두고 다투는 일은 여전히 없다.

`^(?!worker$).*$` 같은 부정형은 쓸 수 없다. 런타임 정규식 엔진이
look-around를 거부한다("look-around, including look-ahead and look-behind,
is not supported" — 바이너리 문자열로 확인).

역할 이름을 나열하는 방식(`^(default|explorer|reviewer|executor)$`)도
택하지 않았다. 런타임이 역할을 하나 더 만들면 같은 결함이 그대로 재발한다.
이 훅이 알아야 하는 것은 "worker가 아닌가"뿐이고, 그 판단은 코드가 한다.

## 같이 잡은 것

**`out` 오타.** `cli.ts`가 observer 결과를 선언되지 않은 `out`에
대입하고 있었다. ESM 모듈은 strict이므로 ReferenceError가 난다. 쓰기는
이미 끝난 뒤라(대입 전에 우변이 평가된다) 데이터는 안전했고 catch가
예외를 삼켜 겉으로는 멀쩡해 보였지만, 그 뒤 문장은 전부 건너뛰었다.

**이름 없는 드롭.** 라운드를 특정하기 전의 반환은 전부 조용했다. 이제
두 경우에 한 줄을 남긴다: 감사 라운드가 떠 있는데 자식이 파싱 가능한
서명 없이 끝난 경우(`review_signoff_unparsed`), 그리고 아무도 발급한 적
없는 launch id를 대는 경우. "리뷰어가 쓸 만한 말을 안 했다"와 "게이트가
고장났다"를 구분할 수 있어야 한다.

## 회귀 방어

테스트가 matcher를 런타임의 실제 역할 어휘에 묶는다 — `default`,
`explorer`, `reviewer`, `executor`, `""` 전부가 이 observer에 도달해야
한다. 이 테스트는 옛 matcher `^(explorer)?$`에서 실제로 실패하는 것을
확인했다. 좁히는 변경은 다시 나갈 수 없다.

## 남은 것

훅 설정은 세션 시작 시점에 고정된다. 재설치와 retrust를 마쳐도 **이미
돌고 있는 세션**은 옛 matcher로 계속 동작한다(040에서 관측한 그대로).
새 세션에서만 자동 기록이 산다.
