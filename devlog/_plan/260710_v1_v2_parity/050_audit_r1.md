# 050 — A-gate r1 합성 (Anscombe/gpt-5.6-sol, VERDICT: FAIL, blockers=2)

## Blocker 수용/반박

- B1 (HIGH, 수용) 인라인 크기 초과 규칙 미정의 → **원자적 스킵 규칙** 채택:
  정규화된 message + 전체 인라인 본문 후보의 합이 MAX_NORMALIZE_LENGTH를 넘으면
  본문을 하나도 붙이지 않고 정규화 message만 유지(멘션 라인은 남으므로 정보
  손실은 링크 수준). 부분 부착·절단 없음 — 결정적 출력 단언 가능.
- B2 (HIGH, 수용) activate.ts의 multi_agent_v2 분기는 실제로 사문(DECLARED_FEATURES
  루프 안이라 도달 불가; GUI 토글은 preserveMultiAgentV2Table를 직접 호출) →
  S4를 "사문 분기 제거 + 실제 호출부(multi-agent-v2.ts) 주석 문서화"로 정정.

## Non-blocking 반영

- F3 effort 주입을 model 분기에서 **분리**: 각각 caller 생략 여부를 독립 판정,
  둘 다 !isFullHistoryFork 게이트. 혼합 케이스 테스트 4종 추가.
- F4 S4에 GUI handler 테스트 + gui build + config-guard dist 동기화 추가.
- F5 프로브 관찰 강화: 손자는 인라인 본문에만 존재하는 센티널(정확한 헤딩 문자열)
  을 그대로 인용해 보고해야 성공 판정.
- F6 S3 인용 attest.ts:132 → :143 정정.

## 검증 확인(리뷰어 교차 확인 통과 항목)

- 매처 3형 수용, isFullHistoryFork 업스트림 정합, V1 effort 합법,
  메인 세션 D1 무영향(agent_id는 ThreadSpawn 자식만), S1/S2 순차 무충돌,
  dist 리빌드 양 컴포넌트 포함.
