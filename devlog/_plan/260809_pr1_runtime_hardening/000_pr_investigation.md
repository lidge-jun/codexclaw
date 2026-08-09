# PR #1 "fix: harden runtime boundaries and resource lifecycles" 조사 (000)

- 날짜: 2026-08-09
- 세션: `019fe3f5-9734-7340-899b-89726e83250f` (WP2)
- PR: https://github.com/lidge-jun/codexclaw/pull/1 — Ingwannu, DRAFT, 2026-07-27 생성, base `dev`, head `agent/harden-runtime-boundaries` @ `8f2efabfe3c0e10df76521e7d063f13a099526fe` (단일 커밋)

## 1. 메타데이터 (gh pr view 1 --json, 2026-08-09 캡처)

- state: OPEN, isDraft: **true**, mergeable: MERGEABLE, mergeStateStatus: UNSTABLE
- changedFiles: 104, +3773 / -1095
- CI: `enforce-target` pass (유일한 체크)

## 2. 변경 지형

| 영역 | 파일 |
|---|---|
| 신규 보안 경계 | `cxc-ops/src/hook-trust.ts`, `cxc-ops/src/manifest-targets.ts` (+ 테스트) |
| messenger-bridge | src 21개 + dist + 테스트 14개 (event-log backpressure, media streaming/concurrency, runner JSONL/output 바운드, job retention, process-group shutdown 등) |
| pabcd-state | `goal-gate.ts`, `goalplan.ts`, `orchestrate-grammar.ts`, `cli.ts`, `subagent-evidence.ts` (+ 테스트) |
| recall | `hook.ts`, `index-db.ts` |
| subagent-config | `cli.ts`, `spawn-attach-hook.ts`, `store.ts` (+ 테스트) |
| GUI | `App.tsx`, `api.ts`, 페이지 3개, `server/middleware.ts`, `usePolling.ts` |
| 문서 | `README.md`, `docs/security-hardening.md` (신규) |

본문 주장: 루프백 API 경계의 bounded JSON parsing, goalplan/recall/subagent 설정 하드닝, recursion grant의 parent-minted one-use capability, Git-tracked subagent override의 digest-bound review token, media overload 거부, stale job reconcile, job row pruning. 검증 주장: npm test 1453 pass, build 119 파일, GUI build/tsc, npm audit 0, gate 통과.

## 3. staleness / 중첩 분석 (로컬 fetch 후)

- PR base: `098c6da0` (2026-07-26). 그 이후 `origin/dev`에 22개 커밋이 올라감 (최신: `b31791a6` worktree-identity guardian 기록).
- dev 측 22개 커밋이 건드린 파일과 PR이 건드린 파일의 교집합: **5개뿐** (`README.md`, `cxc-ops/test/manifest-targets.test.ts`, `pabcd-state/src/cli.ts`, `pabcd-state/dist/cli.js`, `test/hook-e2e.test.mjs`). 핵심 하드닝 파일은 dev가 안 건드렸으므로 PR이 이미 상쇄된(superseded) 수정은 아니다.
- 현재 `origin/dev` 대비로도 live delta 존재 확인:
  - `goal-gate.ts`: +11/-1 — `validateGoalplan`에 source-identity/receipt 인식 검증 주입 (dev에는 없음)
  - `runner.ts`: +115/-12, `spawn-attach-hook.ts`: +111/-62
- GitHub mergeable=MERGEABLE (충돌 없음).

## 4. 평가 기준 (머지 판단 룰)

머지 조건 (모두 충족 시):
1. A단계 독립 리뷰어가 full diff를 대조해 "본문 주장과 코드 일치, blocker/high 회귀 없음" 판정.
2. 로컬에서 PR head를 현재 dev에 머지한 임시 워크트리에서 `npm test` + `npm run build` 통과 (1453 주장의 독립 재현).
3. DRAFT 사유가 코드 완성도 문제가 아니라고 판단될 것 (본문/리뷰 스레드 근거).

머지 보류 조건 (하나라도 해당 시): 리뷰어 blocker, 로컬 머지+테스트 실패, dev의 22개 커밋과 의미 충돌 발견, DRAFT가 미완성 신호로 확인.

머지 실행 시나리오: `gh pr ready 1` → `gh pr merge 1 --squash`(저장소 관례 확인 후 결정) — 사용자가 PR #1에 한해 머지 승인. 로컬 dev(ahead 3)는 건드리지 않고 push하지 않음.

## 5. P단계 스팟체크 메모

- `goal-gate.ts` diff: `source-identity.ts`/`source-receipt.ts` import — 두 파일은 PR head와 origin/dev 양쪽에 실재 (신규 미포함 파일 참조 아님, 컴파일 단절 아님).
- PR이 dist/ 컴파일 산출물을 src와 함께 커밋 — 이 저장소 관례와 일치 (dist 디렉터리가 버전 관리됨).
- 단일 커밋 +3773/-1095는 리뷰 단위로 크다. 머지한다면 squash와 다름없는 형태라 이력 관점 손실은 적음.

## 6. A단계 독립 감사 결과 (reviewer Peirce, sol/medium)

VERDICT: MERGE-WITH-FIXES (blockers=3). phantom claim 0, 테스트 물력화 0, src↔dist 샘플 4개 일치, dev 22커밋과 merge-tree 클린. 주장↔코드 매핑 전수 일치.

Medium 4건 (모두 신규 메커니즘의 잔여 결함, 기존 동작 회귀 아님; 리뷰어는 이 중 1·3·4를 머지 전 수정 권장 blockers=3으로 계수):

1. evidence gate 영구 트랩 가능 — `pabcd-state/src/subagent-evidence.ts:196-210`: `.codexclaw/evidence/` 쓰기가 지속 실패하면 기존 MAX_ATTEMPTS fail-open 상한이 사라지고 무한 block.
2. one-use capability 위조 가능 — `subagent-config/src/spawn-attach-hook.ts:354-390`: grant 파일이 무인증 JSON이라 shell 실행 가능한 child가 self-mint 가능 (다만 그런 child는 `codex exec` 직접 실행 등 더 쉬운 우회가 있어 실질 심각도 제한적).
3. runner stderr 여전히 unbounded — `messenger-bridge/src/runner.ts:449`: stdout JSONL은 8MiB 바운드, stderr는 무제한 누적.
4. Git-tracked 설정 판정이 git 오류 시 fail-open — `subagent-config/src/store.ts:174-184`: `git ls-files`(1.5s timeout) 실패 시 tracked 파일이 trust token 없이 적용됨.

Low 4건: oversizedHookOutput이 dev의 worktree-guard-pretool 이벤트 미커버, 만료 grant 파일 미정리, SIGKILL unconditional 발사(PID-reuse 윈도우), recall cwd 정확 매칭.

disposition: contributor fork 브랜치(`Ingwannu:agent/...`)에 대한 push는 사용자 승인 범위 밖이라 PR에 fold하지 않고, §8의 후속 구현 유닛 시드로 기록.

## 7. B단계 독립 검증 (임시 워크트리, 2026-08-09)

`/tmp/cxc-pr1-A5jd`에 origin/dev + origin/pr/1 머지 트리를 만들어 재현:

- `git merge --no-edit origin/pr/1` — 충돌 없음 (merge commit 74164d18)
- `npm test` — **1507 pass / 0 fail** (25.9s). author 주장 1453은 PR base 시점; dev 신규 테스트 합류분 포함
- `npm run build` — OK, 120 files compiled, layout validated
- `npm run gate` — OK (no status drift / false-enforcement / count mismatch)

## 8. 머지 결정과 결과

판정: **MERGE 실행**. 근거:

1. P단계 머지 조건 3개 충족 — High/Critical/회귀 없음(§6), 로컬 머지+테스트+빌드+게이트 전부 green(§7), DRAFT는 미완성 신호가 아니라 보류 신호(§3, PR 코멘트는 bot의 브랜치 리타겟 기록뿐, 리뷰 스레드 없음).
2. "의미 있는가": 모든 하드닝 주장이 실제 코드와 테스트로 존재, 현재 dev에 아직 없는 live delta, 충돌 없이 적용됨.

실행 기록:

- `gh pr ready 1` → "marked as ready for review"
- `gh pr merge 1 --squash` → **state: MERGED**, mergeCommit `dac77cc762edd3588f28d66acb4590bff85420ee`, mergedAt 2026-08-09T01:18:41Z
- squash 선택 근거: dev 이력이 linear 단일 커밋 관례, PR이 단일 커밋이라 정보 손실 없음. contributor fork 브랜치는 삭제하지 않음.

후속 구현 유닛 시드 (미승인, 제안만): §6 Medium 4건 수정 — evidence gate에 fail-open 상한 복원(escalation 후 최대 N회), recursion grant에 HMAC 서명, runner stderr 바운드(예: 1MiB ring buffer), git tracked 판정 fail-closed 전환. 각각 PR이 도입한 파일에 대한 국소 수정이라 C2 규모 예상.

잔여 리스크 메모: 로컬 dev는 origin/dev 대비 ahead 5 / behind 1 (기존 3 + WP1 docs 커밋 + 병렬 re-audit fold 커밋 `3cf45633`; behind 1은 이 머지의 squash 커밋). 로컬 dev는 push/pull하지 않는 한 원격과 diverge 상태가 된다. push는 사용자 승인 전까지 하지 않음. 병렬 세션의 잔여물(브랜치 `pr-1-review`/`pr1-merge-sim`, 워크트리 `/private/tmp/codexclaw-pr1`)은 내 소유가 아니라 보존.
