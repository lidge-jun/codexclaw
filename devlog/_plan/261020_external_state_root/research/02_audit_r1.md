# research/02 — plan audit round 1 (gpt-6.1-sol, high)

VERDICT: FAIL

`P` = `plugins/codexclaw/components/pabcd-state/src/`, `U` = `devlog/_plan/261020_external_state_root/`. HEAD와 origin/dev 모두 `fff148fa`예요. 파일 수정·테스트 실행 없이 검토했어요.

**구현 전 차단 사항**

1. **커밋 가능한 파일이 인벤토리에서 빠졌어요.** `cxc config interview`는 여전히 루트 `codexclaw.json`을 생성해요. 또한 exclude 설치를 `ensureState`에만 연결하면 독립 CLI의 `.codexclaw/.gitignore` 생성 경로를 보호하지 못해요. 외부 모드의 설정 저장 위치와 모든 생성 진입점을 포함해야 해요. 근거: `P/interview-policy.ts:42`, `P/interview-policy.ts:105`, `P/codexclaw-dir.ts:4`, `U/010_wp1_resolver.md:38`.

2. **D2의 자동 local 전환은 보존 목표를 충족하지 못해요.** legacy marker 하나가 있으면 새 기록도 계속 제거 가능한 worktree에 쌓여요. origin 없는 Git 저장소도 자동 repo라 개인정보 보호 기본값이 약해요. legacy 읽기와 외부 쓰기를 분리하거나, 마이그레이션 전 durable 쓰기를 명시적으로 차단해야 해요. 근거: `U/000_plan.md:12`, `U/000_plan.md:32`.

3. **프로젝트 ID·설정 신뢰 경계가 불충분해요.** D5에는 경로 구분자·`..`·인코딩·`__` 결합 충돌의 처리 계약이 없어요. 설정 검사를 cwd만 기준으로 복제하면 하위 디렉터리 실행 시 checkout 안의 설정을 신뢰할 수 있고, 절대 root도 checkout 내부일 수 있어요. checkout 전체 기준 검사, 외부 root containment, 충돌 방지 ID, URL의 userinfo/query/fragment 제거를 명시해야 해요. owner 판정도 host와 결합해야 해요. 근거: `U/000_plan.md:32`, `U/000_plan.md:34`, `U/000_plan.md:38`, `P/agent-thread-permissions.ts:96`.

4. **D8은 “심볼릭 링크 없음”을 보장하지 않아요.** 현재 가드는 root 자체가 symlink면 그 대상도 신뢰하고, root 내부를 가리키는 parent symlink도 허용해요. goalplan 검사도 새로 추가되는 base/project 상위 경로를 검사하지 않아요. resolver부터 evidence/artifact까지 경로 구성요소 검사를 정의해야 해요. 근거: `U/010_wp1_resolver.md:57`, `P/subagent-evidence.ts:162`, `P/subagent-evidence.ts:164`, `P/source-receipt.ts:123`, `P/goalplan.ts:327`.

5. **D7의 attest 보존 근거가 사실과 달라요.** ledger에는 attest 전체가 아니라 `did`만 저장돼서 `auditOutput`, `checkOutput`, residual 등이 사라져요. `attest.json`을 scratch로 유지하려면 검증된 attest를 별도 durable 기록으로 남겨야 해요. 근거: `U/000_plan.md:42`, `P/orchestrate-cli.ts:1123`, `P/orchestrate-cli.ts:1129`, `P/state.ts:216`.

6. **추가 durable 데이터가 “나머지는 volatile”에 묻혔어요.** release candidate, objective metric 이력, divergence candidate archive가 빠졌고, 세션의 `dcloseRecovery`는 코드가 명시한 authoritative recovery state예요. 각각 외부 보존 여부와 복구 정책을 결정해야 해요. 근거: `P/release-cli.ts:56`, `P/release-cli.ts:182`, `P/metrics.ts:134`, `P/divergence.ts:198`, `P/state.ts:207`, `U/000_plan.md:42`.

7. **D6의 기존 키만으로는 병렬 worktree가 격리되지 않아요.** freeze manifest는 세션 키 없이 `interview/freeze.json` 하나라 서로 덮어써요. goalplan 생성도 존재 확인 후 쓰기라 두 worktree의 동시 init이 경합해요. branch partition은 불필요하지만 manifest 키와 원자적 create 정책은 필요해요. 근거: `U/000_plan.md:40`, `P/freeze-cli.ts:104`, `P/freeze-cli.ts:121`, `P/goalplan-cli.ts:773`, `P/goalplan-cli.ts:794`.

8. **D12의 부분 이동은 상태를 분열시켜요.** destination ledger 충돌로 legacy ledger가 남고 goalplans만 이동하면 자동 모드는 계속 local이라 이동된 plan을 못 읽어요. 기존 `planUnit`·review 파일 경로·receipt 참조도 이동만으로 복구되지 않아요. migration 완료 상태, 경로 재바인딩 또는 명시적 무효화, 실행 중 writer 차단이 필요해요. 근거: `U/020_wp2_cli.md:10`, `U/000_plan.md:32`, `P/plan-gate.ts:79`, `P/review-round-cli.ts:158`, `P/review-round-cli.ts:312`, `P/orchestrate-cli.ts:85`.

9. **D11 sync의 저장소 경계·동시성 계약이 없어요.** base가 상위 Git 저장소의 하위 폴더이면 “Git repo인가” 검사만으로 부족하고, 기존 index 변경까지 commit할 수 있어요. root 일치 검사, 기존 staged 상태 처리, Git routing 환경변수 제거, writer와의 동기화가 필요해요. pull이 활성 goalplan을 바꾸거나 commit이 plan/ledger 중간 상태를 담아서는 안 돼요. 근거: `U/020_wp2_cli.md:9`, `P/source-identity.ts:56`, `P/goalplan.ts:806`.

10. **D10은 비바인딩 goal 완료까지 막아요.** 계획대로 none에서 writability probe가 실패하면 `unrecordableVerdictStatus`가 unreadable을 반환하고, goalplan 유무와 관계없이 완료가 거절돼요. none의 기본 goal 동작과 실제 미검증 verdict 처리 정책을 분리해야 해요. 근거: `U/010_wp1_resolver.md:46`, `P/subagent-evidence.ts:388`, `P/goal-gate.ts:245`.

11. **테스트 격리와 통합 검증이 부족해요.** wrapper는 HOME을 바꾸지 않고 상속된 `CODEXCLAW_STATE_ROOT/MODE`도 유지해요. 계획의 직접 `node --test` 명령은 wrapper까지 우회해요. 임시 HOME과 환경 정리, 외부 모드 전체 PABCD/리뷰/receipt 흐름, 부분 migration·동시 writer·두 Mac의 분기된 sync 검증을 추가해야 해요. 근거: `plugins/codexclaw/scripts/test.mjs:74`, `plugins/codexclaw/scripts/test.mjs:77`, `U/010_wp1_resolver.md:68`, `U/010_wp1_resolver.md:72`, `U/020_wp2_cli.md:22`.

**비차단 제안**

12. **hook 성능 예산을 추가하세요.** 프로세스 캐시는 hook 호출 간 유지되지 않고, resolver 호출마다 설정을 다시 읽어요. foreign origin·여러 durable 조회·큰 ledger를 넣은 cold/warm p95를 기존 harness로 비교하면 좋아요. 근거: `U/010_wp1_resolver.md:32`, `P/hook.ts:484`, `plugins/codexclaw/scripts/hook-bench.mjs:6`.

13. **파일 기반 Git 해석의 지원 범위를 고정하세요.** `include/includeIf`, `config.worktree`, URL rewrite, 하위 디렉터리 실행에서 안전한 fallback과 진단이 필요해요. 근거: `U/000_plan.md:38`, `U/010_wp1_resolver.md:19`.

14. **공유 root에서 reset의 범위를 명시하세요.** 기존 checkout 단위 reset을 durable root에 연결하면 다른 worktree의 ledger·goalplans까지 삭제해요. CLI 출력과 테스트에서 프로젝트 전체 삭제임을 드러내야 해요. 근거: `U/010_wp1_resolver.md:51`, `plugins/codexclaw/components/cxc-ops/src/reset.ts:68`, `plugins/codexclaw/components/cxc-ops/src/reset.ts:78`.
