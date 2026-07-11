# 035 — 인터뷰 클로즈아웃 (3 스캔 라운드, I -> P)

- 스캔 증거: r1 인라인 triage(Boole+Volta 교차), r2 Nietzsche(설계 검증),
  r3 Peirce(ocx 공존 + 잔여 축). HIGH 모순 전부 계획 항목 또는 확정 답으로 해소.
- 진행 승인: 사용자 "cxc-loop, sol 서브에이전트 medium 무제한" (260710 오후) —
  마지막 질문 2개는 무응답 스킵이므로 권고 기본값을 가정으로 채택.

## 확정 (사용자 답 + 렌즈 검증)

1. 스킬/모델 전달은 **훅에서** 해결 (사용자: "pretooluse나 첫 spawn하면 hook 쓰면
   되는거 아님?" + "훅 주입 확장").
2. 훅 매처를 네이티브 V2 이름 `collaborationspawn_agent`까지 확장 (r2 HIGH).
3. V2 스폰: SKILL.md 본문 인라인 (멘션 파싱 부재 우회, r2 확인: 자식 첫 turn에
   그대로 도달, 크기 안전).
4. V2 model/effort 주입은 fork_turns none/정수일 때만; 생략/"all"이면 스킵 (r2).
5. leaf guard(D1/D2) V1 확장 — r3 확인: 독트린 충돌 없음, agent_id 스탬프 표면 중립.
6. D2 문구의 "developer message 오버라이드" 과장 제거 (r3 HIGH — 채널 우선순위 역전).
7. directive/doctrine 표면 중립 재서술 — 문구 고정 테스트 없음 (r3 확인).

## OPEN ASSUMPTIONS (미응답 → 권고 기본값 채택, 스티어링으로 번복 가능)

- OA-1 (ocx 공존): 감지 로직을 만들지 않는다. "명시 model 존중, 생략 시만
  subagents.json 역할 모델 주입" 규칙을 양 표면에 동일 적용 — ocx 가이던스를
  따른 호출은 model이 명시돼 오므로 충돌이 자연 해소 (r3 HIGH 모순 2건 회피).
- OA-2 (untracked GUI 토글): multi-agent-v2.ts + Dashboard 토글을 "정직한 라벨"로
  이번 패치에 포함 — 전역 스위치가 아니라 '플래그-폴백 모델만 적용, 카탈로그 고정
  모델(sol/terra/luna) 무영향, 새 세션부터'를 UI/응답에 명시.
- OA-3 (업스트림 예외): V2 full-fork(fork_turns 생략/"all")는 모델 오버라이드
  자체가 upstream 거부 — parity는 "가능한 표면에서 동일, 불가 지점은 문서화된
  예외"로 정의.
- OA-4 (라이프사이클): V1 close/resume vs V2 mailbox/followup_task 차이는 코드
  심(shim) 없이 독트린이 표면별 등가 절차를 병기하는 것으로 해소.
- OA-5 (effort): 저장된 effort는 양 표면 모두 계속 미주입… 이 아니라 — 모델
  주입과 동일 규칙으로 effort도 주입한다(설정 존재 + caller 생략 + fork 합법 시).
  현행 "no effort injection" 주석/문서와 상충하므로 B에서 주석·문서 동시 갱신.
  (사용자 "훅 주입 확장" 답의 자연 확장; 반대면 스티어링으로 제거.)
