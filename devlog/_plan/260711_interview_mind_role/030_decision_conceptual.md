# 030 — 결정: 옵션 0 채택 (개념 레벨 개선만, 신규 역할/옵트인 폐기)

- Date: 2026-07-11
- 유저 결정: "굳이 interview[전용 역할/옵트인] 필요없고 그냥 개념적으로만 더
  interview가 잘되도록 개선하자."

## 채택안 (구현 완료)

- `components/pabcd-state/src/minds.ts` — `MIND_DISPATCH_DIRECTIVE`에
  MIND-SPAWN-SHAPE-01 블록 추가:
  - 스폰 셰이프: agent_type "explorer" / task_name `mind_<mindname>` /
    non-full-history fork (V2 `fork_turns:"none"`, V1 fork_context 생략) —
    C2 caveat 해소(full fork면 오버라이드 거부 + 역할 설정 주입 스킵).
  - effort 라우팅: Mind는 explorer 역할 설정을 탐 — `cxc subagents set explorer
    --effort ...`로 고정하거나 reasoning_effort 명시 전달 (C4는 소프트 규율로 수용).
  - 렌즈는 무상태 — 인터뷰 스냅샷(차원 점수/knowns/OPEN ASSUMPTIONS/플랜 초안
    경로)을 task 메시지에 동봉 (인터뷰 품질 개선 본체).
- `skills/interview/SKILL.md` — Runtime Status에 동일 계약 + C3 키워드 오분류
  caveat(리뷰 단어 포함 시 reviewer 설정 적용, 무해) 문서화.
- `components/pabcd-state/test/minds.test.ts` — MIND-SPAWN-SHAPE-01 계약 테스트.

## 폐기/보류

- 040 플랜(interviewer 4번째 역할 + 옵트인 술어) — **보류**. C1(인터뷰 전용
  노브)·C4(effort 하드 강제)가 실제 요구로 승격될 때만 재개. 020 리스캔이
  근거: 스폰 경로·model/effort 주입은 이미 존재, Mind는 explorer 설정을 탄다.
