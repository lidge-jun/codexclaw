# research/04 — plan audit round 3 (gpt-6.1-sol, high)

VERDICT: FAIL

`U = devlog/_plan/261020_external_state_root/`
`P = plugins/codexclaw/components/pabcd-state/src/`

차단 사항:

- **#9 REBUT 불수용 — sync는 읽기 스냅샷 작업만 하지 않아요.** `pull --rebase --autostash`는 writer가 사용하는 파일을 교체해요. 동시 append가 덮이거나 교체 전 inode에 기록될 수 있어요. sync끼리의 잠금과 `merge=union`은 이를 막지 못해요. writer와 공유하는 배제 장치 또는 별도 checkout에서의 sync가 필요해요. `U/005_audit_r2.md:13`, `U/020_wp2_cli.md:9`, `P/goalplan.ts:955`.
- **sync 잠금 자체가 커밋돼요.** `<base>/.cxc-sync.lock`을 잡은 채 `git add -A`하지만 ignore 계획에는 해당 파일이 없어요. 다른 Mac이 받으면 잠금 획득이 계속 실패해요. `.migrate.lock`도 명시적으로 제외해야 해요. `U/005_audit_r2.md:12`, `U/005_audit_r2.md:13`, `U/000_plan.md:50`.
- **#2는 개인정보 노출만 해결해요.** origin 없는 기업 저장소의 자동 `local`은 devlog·ledger를 worktree 안에 남겨 삭제 시 잃고 sync도 건너뛰어요. 소유자 목표에 맞추려면 자동 external 또는 명시적인 지원 범위 예외가 필요해요. `U/005_audit_r2.md:8`, `U/000_plan.md:30`, `U/020_wp2_cli.md:9`.

잔여 사항:

- **#1·#4·#7:** 최신 disposition은 계획 수준에서 수용 가능해요.
- **#6 REBUT:** 드문 crash 후 worktree 삭제에서의 복구 손실은 잔여 위험으로 수용 가능해요. 다만 “`loop validate`가 누락 ledger를 보고한다”는 설명은 틀려요. 해당 검증은 ledger를 대조하지 않아요. `U/005_audit_r2.md:10`, `P/goalplan.ts:1656`.
- **#8:** stale 참조 경고는 수용 가능해요. migration 잠금을 writer가 따르지 않으므로 사전 phase 검사 이후의 쓰기 경쟁은 남아요. “atomic publication이므로 경합하지 않는다”는 설명은 철회해야 해요. `U/005_audit_r2.md:12`.
- **#11:** 제안된 통합 테스트는 개선됐지만 동시 writer와 sync·migration 경합 검증은 빠져 있어요.

읽기 전용 계획 감사이며 파일 변경·테스트 실행은 하지 않았어요.
