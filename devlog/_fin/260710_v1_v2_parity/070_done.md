# 070 — D 마감 (terminal outcome: DONE, 라이브 스모크 1건 이월)

## 검증 증거 (fresh)

- 전체 스위트 1058/1059 — 유일 실패는 문서화된 선행 실패
  (`hook-continuation.test.ts` "inactive goal allows I-trigger", 본 패치 이전
  main에서 재현 확인, Nash 증거 수록). `npm run gate` OK. build OK (101 files).
- A-gate: Anscombe(sol/medium) 3라운드 — r1 FAIL(2H: 인라인 오버플로 규칙,
  activate.ts 사문 분기 오판) → r2 FAIL(1H: 스코프 자기모순) → r3 PASS.
- C-gate: Helmholtz(sol/medium) 4라운드 — r1 FAIL(5H) → r2 FAIL(스캐너 이차시간
  +중첩) → r3 FAIL(균형 중첩 이차시간, 무효 스케일링 테스트) → r4 PASS
  (실측 1k/2k/4k/8k = 0.57/0.64/0.36/0.67ms, 선형 확인).
- 라이브 프로브(Hypatia, V1 표면): 스킬 본문 도달 블라인드 센티널 정확
  ("## Source-Proof Invariant (read first)" / "## Notes"), bare→link 정규화 실증.
- 라이브 프로브(Halley): V1 자식은 spawn 도구 자체가 없어 손자 스폰 불가
  ("tools.spawn_agent is not a function") — 네이티브 V2 collaboration 경로와
  V1 leaf guard 신동작의 라이브 관찰은 **신규 세션 스모크로 이월** (현 세션이
  rebuild 이전 훅 스냅샷으로 구동 중임을 dist 직접 구동 대조로 확인).

## 남은 확인 (다음 세션)

1. 새 codex 세션(아무 모델)에서 서브에이전트 하나 스폰 → 받은 메시지에
   `[CXC-LEAF-GUARD]`가 보이는지 (V1 guard 신동작).
2. 네이티브 Sol/Terra 세션에서 스폰 → 자식이 `<skill name="cxc-...">` 블록을
   받는지 (매처 `collaborationspawn_agent` 발화 + V2 인라인).

## 비관적 마감 (LOOP-PESSIMIST-01)

- 죽은 가설: "message 멘션은 v1+v2 공용 채널" (2c3801a1의 전제) — 업스트림
  소스 판독으로 반증, 훅 인라인으로 대체.
- 개선 안 된 것: V2 wait가 내용을 반환하지 않는 비대칭은 코드로 메꾸지 않음
  (OA-4, 독트린 병기로만 해소). ocx 모델 권위 이원화는 "명시 존중" 규칙으로
  회피했을 뿐 동기화는 미해결 (OA-1 후속 트랙 후보).
- 방향을 반증할 증거: 신규 세션 스모크에서 collaboration 매처가 불발하면
  훅 이름 판독(flat_tool_name 무구두점)이 틀린 것 — 그 즉시 매처 재조사.
