# 030 — 재스캔 r3 (Peirce/gpt-5.6-sol): ocx 공존 축 + 잔여 결정축

새 사용자 제약: opencodex(ocx) 프록시가 이미 프록시 레이어에서 양쪽 표면에
<multi_agent_mode> 위임 가이던스(preferred model/effort + 5모델 로스터)를 주입 중.
"ocx가 돌 때는 codexclaw가 중복하지 말고, 주입할 때는 ocx와 같은 양식으로."
(이 세션 자체가 실증 — surface=v1, sol/medium 가이던스 수신 중.)

## 판정

- [HIGH][모순] "ocx 실행 중이면 codexclaw 전면 침묵"은 불안전 — ocx는
  injectionModel/로스터가 없으면 V2 가이던스를 아예 안 내고, V1도 max/ultra 미만
  + injectionModel 부재면 침묵 (responses.ts:187,223). 프로세스 존재가 아니라
  **가이던스 발화 자격**을 감지해야 함.
- [HIGH][모순] 기존 provider-bridge 감지는 ocx 라우팅 증거가 아님 —
  `ocx status --json` 파싱 성공만으로 mode:"provider"가 되고(running=false여도),
  SessionStart 훅은 JSON 컨텍스트 한 줄만 주입하며 spawn 훅은 그걸 소비하지 않음
  (detect.ts:16,84). 카탈로그 파일 존재는 캐시 유래라 liveness 증명 불가.
- [MED][모순] 모델 권위 이원화 — V1 훅은 caller가 model을 생략했을 때만
  subagents.json 모델을 주입. ocx 가이던스가 Y를 선호해도 caller가 생략하면
  codexclaw가 X를 조용히 주입해 developer 가이던스와 충돌 (responses.ts:235 vs
  spawn-attach-hook.ts:449,459). 우선순위 규칙 필요: 명시 > (ocx 선호?) > 역할 설정.
- [HIGH][모순] D2 leaf guard 문구의 "developer message보다 우선" 주장은 성립 불가
  — ocx Proactive는 developer 채널, D2는 task message 채널이라 우선순위가 역전.
  실제 강제는 D1 훅 거부뿐. 문구 재작성 필요(과장 제거).
- [LOW][확인] leaf guard V1 확장은 독트린 충돌 없음 — Tier 3 wave/spark lane/감사자는
  전부 메인 세션 디스패치 지시이며, agent_id 스탬프는 표면 중립이라
  isSubagentSpawner가 V1에서도 정확 (060_leaf_agent_hardening.md:15).
- [LOW][확인] A/B/C directive 문구를 고정하는 테스트 없음 — 표면 중립 재서술 안전.
- [HIGH][모순] untracked GUI 토글은 "전역 V1/V2 스위치"라는 거짓 표면 — 플래그는
  unpinned 모델(gpt-5.5 등)만 뒤집고 Sol/Terra/Luna는 카탈로그 고정. ocx의
  카탈로그 리싱크/"새 세션부터" 경고도 없음 (multi-agent-v2.ts:85, Dashboard.tsx:275).

## triage 처분

- ocx 공존 정책(감지 신호 + 모델 권위 우선순위) → 사용자 질문 (HIGH, 설계 갈래).
- untracked multi-agent-v2.ts + GUI 토글 처분 → 사용자 질문 (HIGH, 소유권 갈래).
- leaf guard V1 확장 → 확인됨: 확장 안전. 권고안으로 질문에 포함 (경량).
- D2 문구 과장 제거, directive 표면 중립 재서술 → 계획 항목 확정 (질문 불요).
