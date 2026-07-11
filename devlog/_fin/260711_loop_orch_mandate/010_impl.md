# 010 — 구현: ORCH-MANDATE-01 (프롬프트 타임 arming 강제 + 스킬 정합)

- Date: 2026-07-11
- Class: C2 (훅 1개 분기 + directive 상수 + 스킬 문서 4곳)

## 런타임 (E2)

- `components/pabcd-state/src/hook.ts`:
  - `detectLoopArmRequest()` 신규 — cxc-loop/HOTL/goalplan/골플랜 토큰,
    continue-until-done 계열(EN), 루프+행동마커/끝까지/멈추지 말(KO). bare
    "loop"/"루프"는 의도적으로 제외(for-loop 버그 리포트 오발화 방지). HEURISTIC.
  - `LOOP_ARM_DIRECTIVE` 신규 — 5단계 arming 시퀀스(세션 id 규칙 → status →
    HOTL/HITL arming → edge별 `--attest` → D 후 P 재진입)와 "FSM 밖 작업은 루프
    진행이 아니다" 명제. GOAL-IDLE-CONTINUE-01(Stop 타임)의 프롬프트 타임 짝.
  - fail-closed 분기(`!orchestrationActive`)에서 루프 요청 감지 시 주입.
    agbrowse와 합성 가능. 모드 1(명시 트리거)이 항상 우선. **directive는 FSM을
    절대 움직이지 않는다** — arming은 여전히 에이전트의 명시 커맨드.

## 스킬 정합 (E7)

- `skills/loop/SKILL.md` — `## Orchestrate mandate (ORCH-MANDATE-01, STRICT)`
  캐논 섹션 신설: 내레이션 금지 명제 + 5단계 시퀀스 + 런타임 짝 명시.
- `skills/pabcd/SKILL.md` — Loop handoff 섹션에 ORCH-MANDATE-01 포인터 항목.
- `skills/interview/SKILL.md` — closeout fork `proceed` = 실제
  `cxc orchestrate P --session <id>` 전이(내레이션 불인정) 명시.
- `skills/dev/SKILL.md` — goal-mode 루프 문단에 edge-attest 강제 한 줄.

## 검증

- `node --test hook.test.ts`: 37/37 (신규 4: detect 진리표 / 미가동 주입 /
  모드1 우선 / agbrowse 합성).
- `npm run build` OK(102 files), `npm test` 1101 pass / 1 fail — 실패는
  `hook-continuation.test.ts:78` L11, **본 변경 이전부터** 유저 진행 중
  state.ts 리팩터(IDLE 정규화, state.ts:160)로 깨져 있던 것(260711 interview
  유닛에서 hunk-revert 대조로 확인). 본 유닛 무관.

## 잔여/가정

- detectLoopArmRequest 키워드는 큐레이션 — 오발화/미발화 사례가 쌓이면 진리표
  테스트에 케이스 추가로 조정.
- 가동 중(FSM active) 세션의 "phase 내레이션" 은 모드 2/3 stage header +
  Stop 훅(골 모드)이 기존대로 담당 — 프롬프트 타임 추가 강제는 이번 스코프 밖.
