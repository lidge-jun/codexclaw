# 020 — 재스캔 r2 (Nietzsche/gpt-5.6-sol, 사용자 설계 검증)

사용자 선택 설계: (1) V2 스폰에서 PreToolUse 훅이 SKILL.md 본문을 message에 인라인,
(2) 같은 훅이 subagents.json의 model/effort를 V2 페이로드에 주입.

## 판정 (codex-rs 소스 인용은 세션 로그 원문)

- [HIGH][모순] 네이티브 V2 훅 이름 = `collaborationspawn_agent` (namespace 기본
  `collaboration` + flat_tool_name 무구두점 연결, registry.rs:713 특례는 plain/V1만).
  현행 매처 `^spawn_agent$` (hooks/pre-tool-use-attaching-skills.json) 불발.
  ⇒ 매처 확장이 이 패치의 선결 항목. 비네임스페이스 V2 경로는 provider
  namespace_tools=false일 때만 존재(Sol/Terra 기본 경로 구제 불가).
- [MED][확인] 훅 재작성은 V2 핸들러의 인자 파싱/encrypted_content 랩 **이전**에
  실행 (registry.rs:495,518 → multi_agents_v2/spawn.rs:50,111). 자식은 스폰 직후
  그 communication으로 시드되어 NEW_TASK 입력으로 받음 — 멘션 파싱 없이도
  인라인 본문이 그대로 보임 (agent/control/spawn.rs:392, session/mod.rs:2935).
  ⇒ **훅-인라인 설계 성립.**
- [MED][확인] updatedInput은 deny_unknown_fields로 재역직렬화되지만 model/effort는
  known field라 통과. full-history 거부는 훅 **이후** 발화 — 훅은 fork_turns가
  생략/공백/"all"이면 model/effort 주입을 스킵해야 함 (spawn.rs:67,178,199).
  ⇒ **모델 주입 설계 성립(가드 조건부).**
- [LOW][확인] 크기 한계 없음: message는 무제한 문자열, ~100KB 인라인은
  MAX_NORMALIZE_LENGTH(256KiB)와 Sol/Terra 372k 컨텍스트에 여유.
- [HIGH→계획항목] 현행 훅은 설계의 어느 쪽도 미구현 (V2 분기=정규화+leaf guard만,
  모델 라우팅 V1 전용) — 이건 모순이 아니라 이번 패치의 작업 정의 그 자체.

## 스캔 라운드 처분

- HIGH(매처 불발): 사용자 질문 불요 — 계획의 선결 작업으로 확정 (매처를
  `^(collaboration)?[._]?spawn_agent$` 류로 확장 + 실측 스모크).
- MED 2건: 설계 확인이므로 계획에 가드 조건으로 반영.
- OPEN ASSUMPTION (미해결 MED): full-fork(fork_turns=all) V2 스폰은 모델
  오버라이드 불가가 업스트림 규칙 — parity의 정의를 "가능한 표면에서 동일,
  불가능한 지점은 문서화된 예외"로 잡는다.
