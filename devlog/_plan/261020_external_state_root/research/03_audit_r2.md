# research/03 — plan audit round 2 (gpt-6.1-sol, high)

VERDICT: FAIL

`U` = `devlog/_plan/261020_external_state_root/`, `P` = `plugins/codexclaw/components/pabcd-state/src/`.

남은 차단 사항:

- **#1 — exclude로 tracked 파일은 보호되지 않아요.** 기존 tracked `codexclaw.json` 수정과 legacy `.gitignore` 재작성은 커밋 가능한 변경을 만들어요. 외부 저장 또는 tracked 파일 변경 거부가 필요해요. `U/004_audit_r1.md:7`, `P/interview-policy.ts:105`.
- **#2 후반 REBUT — 불충분해요.** origin 없는 기업 저장소도 존재해요. fixture 호환성과 수동 설정은 자동 `repo` 기본값의 개인정보 노출을 정당화하지 못해요. 미확인 owner는 보수적으로 처리해야 해요. `U/004_audit_r1.md:8`, `U/000_plan.md:32`.
- **#4 — symlink 검사 범위가 여전히 불완전해요.** base의 상위 구성요소와 외부 `devlog` 경로가 빠졌어요. `devlog`가 checkout을 가리키는 symlink면 계획 파일이 다시 기업 저장소에 생성돼요. `U/004_audit_r1.md:10`, `P/plan-cli.ts:178`, `P/plan-cli.ts:183`.
- **#6 — authoritative 복구 마커를 volatile로 분류할 수 없어요.** 외부 goalplan을 먼저 변경하고 ledger를 나중에 기록하므로, 사이에 worktree가 제거되면 복구에 필요한 유일한 정보가 사라져요. durable 복구 기록이 필요해요. `U/004_audit_r1.md:12`, `P/state.ts:207`, `P/orchestrate-cli.ts:966`, `P/orchestrate-cli.ts:1039`.
- **#7 — “두 번째 exists 검사로 fail-closed” 주장이 틀려요.** init은 한 번 읽고, 잠금 없이 overwrite 가능한 rename을 수행해요. 두 worktree가 모두 성공하며 서로의 criteria를 덮어쓸 수 있어요. 원자적 create가 필요해요. `U/004_audit_r1.md:13`, `P/goalplan-cli.ts:773`, `P/goalplan-cli.ts:794`, `P/goalplan.ts:933`.
- **#8 — migration 처리가 불완전해요.** 현재 checkout의 phase 검사만으로 다른 worktree writer나 검사 직후 시작한 writer를 막지 못해요. IDLE에도 미완료 복구 마커가 남을 수 있어요. P>A 재-attest 안내는 저장된 review 파일 경로·final-gate receipt 참조도 복구하지 못해요. 잠금과 참조 재바인딩/명시적 무효화가 필요해요. `U/004_audit_r1.md:14`, `P/orchestrate-cli.ts:1022`, `P/review-round-cli.ts:312`, `P/goalplan.ts:1881`.
- **#9 — atomic publication은 sync 직렬화가 아니에요.** pull/autostash가 진행 중인 writer와 경합하고, commit은 goalplan 변경과 ledger append 사이를 캡처할 수 있어요. 모든 writer와 공유하는 sync 잠금이 필요해요. Git 환경 정리도 기존 helper의 object-directory 변수 두 개가 빠졌어요. `U/004_audit_r1.md:15`, `P/orchestrate-cli.ts:981`, `P/orchestrate-cli.ts:986`, `P/source-identity.ts:61`.

잔여 판정:

- **#2 전반, #3, #10:** 계획상 수용 가능해요.
- **#5 REBUT:** 합리적이에요. attest 전체 보존은 별도 기능이며, 기존의 잘못된 ledger 보존 설명은 철회됐어요.
- **#6 나머지·#7 freeze 재분류:** 명시된 checkout 범위 정책으로 수용 가능해요.
- **#11:** 환경 격리는 개선됐지만 전체 외부 PABCD·review·D-close, 부분 migration, 동시 writer 검증이 여전히 빠졌어요.
- **#12–14:** 비차단이에요. Git 설정 미지원 시 안전한 fallback은 구체화해야 해요.

읽기 전용 소스 대조이며 파일 수정·테스트 실행은 하지 않았어요.
