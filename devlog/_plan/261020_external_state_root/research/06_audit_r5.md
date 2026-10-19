# research/06 — plan audit round 5 (gpt-6.1-sol, high)

VERDICT: FAIL

- **차단 1개:** [goalplan-cli.ts:794](/Volumes/CLIsu/goat-worktrees/codexclaw/feat-external-state-root/plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:794)의 `loop init`은 잠금 없이 게시해요. `:773`의 부재 확인 후 다른 init이 같은 slug를 생성하고 sync가 잠금·비교를 수행해도, 지연된 init은 [goalplan.ts:933](/Volumes/CLIsu/goat-worktrees/codexclaw/feat-external-state-root/plugins/codexclaw/components/pabcd-state/src/goalplan.ts:933)의 무조건 rename으로 끼어들 수 있어요. 그 결과 init 또는 병합된 변경이 덮어써져요. **007:7의 “모든 writer가 같은 잠금을 사용한다”는 전제가 성립하지 않아요.** 생성도 공유 잠금으로 직렬화하거나, 원자적인 덮어쓰기 금지 게시가 필요해요.

잔여 사항:

- 확인한 기존 plan 수정 경로는 잠금 안에서 게시해요.
- `appendGoalplanLedger`는 자체 잠금이 없고 lifecycle은 잠금 해제 후 호출하지만, `O_APPEND`와 sync의 append-only 정책상 이번 교체 경합의 차단은 아니에요.
- `withGoalplanWriteLock`은 plan 부재 시 거부해요(`goalplan.ts:818`). 신규 원격 plan 적용은 별도 정의가 필요하지만 데이터 손실 차단은 아니에요.

읽기 전용 검토이며 수정·테스트 실행은 없어요.
