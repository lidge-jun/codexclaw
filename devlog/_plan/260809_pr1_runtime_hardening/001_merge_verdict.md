# PR #1 머지 판정 (001)

- 날짜: 2026-08-09
- 세션: `019fe3f5-9734-7340-899b-89726e83250f` (WP2)
- 조사 문서: `000_pr_investigation.md` (메타데이터/변경 지형/staleness 분석은 그쪽 참조)
- 이 문서는 직접 실행 검증 결과와 머지 판정만 담는다.

## 1. diff 직독 메모 (000의 변경 지형 표 보강)

- `cxc-ops/hook-trust.ts`: 플러그인 manifest hook 경로에 containment 추가 — 절대경로 거부, `..` 이스케이프 거부, symlink realpath 이스케이프 거부 (`containedPluginFile`). 진짜 path-traversal 방어다.
- `cxc-ops/manifest-targets.ts`: 같은 성격의 검증 강화 + 비문자열 hook 엔트리 타입 가드. 기존에는 이스케이프 검사가 `existsSync`/`statSync` 이후에 와서 순서도 바꿨다.
- `messenger-bridge/runner.ts`: 자식 출력 8 MiB 상한 (`MAX_RUNNER_OUTPUT_BYTES`), JSONL 이벤트 라인 8 MiB 상한, thinking/tool 입력/fail 메시지 single-line 절단, `terminateChild`가 detached process group 전체에 SIGTERM→SIGKILL (손자 프로세스가 fd를 물고 `close`를 막는 케이스 대응).
- src와 dist(체크인된 빌드 산출물)가 함께 갱신됨.

## 2. 검증 (직접 실행, 2026-08-09)

| 검증 | 명령 | 결과 |
|---|---|---|
| PR head 테스트 | `/tmp/codexclaw-pr1` (worktree @ `8f2efabf`) 에서 `npm ci && npm test` | **1,453 pass / 0 fail** (PR 본문 주장과 일치) |
| 머지 시뮬레이션 | `git checkout -b pr1-merge-sim origin/dev && git merge --no-ff pr-1-review` | 텍스트 충돌 0 (GitHub MERGEABLE과 일치) |
| 머지 결과 테스트 | merge-sim 트리에서 `npm test` | **1,507 pass / 0 fail** (PR 1,453 + dev 신규 54) |
| gate | merge-sim 트리에서 `npm run gate` | OK |
| build | merge-sim 트리에서 `npm run build` | OK — 120 files |

배경 수치: PR의 merge-base는 `098c6da0`이고 origin/dev는 그 이후 22커밋 전진 (worktree-guardian, stacked-PR 스킬 등). 텍스트 충돌은 없지만 파일 5개가 양쪽에서 건드려져 의미 충돌 가능성이 있었다 (README.md, manifest-targets.test.ts, pabcd-state/src+dist/cli.ts, hook-e2e.test.mjs) — merge-sim 테스트가 이를 해소한다.

## 3. 의미 평가

의미 있다고 판단한다. 근거:

1. 방어 내용이 실재한다. hook manifest 경로 containment와 symlink 이스케이프 검사는 codexclaw가 외부 플러그인 manifest를 읽는 구조상 실질적인 공격면이다.
2. runner 출력 상한과 process-group 종료는 messenger-bridge가 장시간 codex exec 자식을 띄우는 구조의 실제 리소스 리스크를 막는다.
3. 변경마다 테스트가 딸려 있고 (104 파일 중 test 파일 다수), 최신 dev에 대한 머지 시뮬레이션까지 전 구간 녹색이다.
4. 유저(저장소 owner)가 "의미있다면 머지해도 돼"로 이 PR의 머지를 명시 승인했다.

리스크/유의:

- DRAFT 상태다. 머지하려면 `gh pr ready`로 전환해야 한다 — owner 승인 하에 진행.
- 2주 stale이라 향후 drift가 다시 생길 수 있으니 머지 후 로컬 dev에 pull해서 후속 작업은 최신 base에서 해야 한다.
- 단일 squash 커밋 1개라 리뷰 granularity가 낮다 — 영역별로 커밋이 나뉘었으면 더 좋았을 것 (non-blocking).

## 4. 결정과 실행 결과

**머지 실행됨** (2026-08-09T01:18:41Z): `gh pr ready 1` → `gh pr merge 1 --squash`. state=MERGED, merge commit `dac77cc762edd3588f28d66acb4590bff85420ee`, mergedBy=lidge-jun. 실행 주체는 이 세션의 병렬 continuation (ledger A→B 01:18:31, B→C 01:19:52). 머지 후 `gh pr list`는 오픈 PR 0건.

## 5. 사후 감사 (독립 reviewer Plato, 019fe417, sol/medium — 머지 후 완료)

판정: **GO-WITH-FIXES (blockers=0)** — 머지 정당성 사후 확인.

- 본문 7개 주장 전부 코드와 일치 (hook stdin 4 MiB 바운드 `spawn-attach-hook.ts:71,937-949`, JSONL 라인 8 MiB `runner.ts:64,412-436`, one-use capability `:353-367,:370-383`, digest-bound review token `store.ts:176-230`, media overload 게이트 `media-handler.ts:33-58`, stale job reconcile/prune `db.ts:193-209,989-1002`, 출력 바운드+process-group 종료 `runner.ts:63,277-315`).
- 회귀 사냥 3지점(appendBoundedOutput/singleLine, event-log backpressure, goal-gate source-identity): 정상 입력 무파괴 확인. 경계값 정확.
- merge-sim `npm test` 독립 재현: 1507 pass / 0 fail.
- 교집합 5개 파일 재계산 일치, 신규 TODO/FIXME 0건.

### 후속 과제 (non-blocking High, 이 유닛 스코프 밖 — 별도 구현 유닛 후보)

1. `pabcd-state/src/subagent-evidence.ts:206-210` — catch-all 경로가 attempt 계수 없이 무조건 block을 반환한다. 지속적인 내부 오류(attempts 경로 IO 실패 등)가 있으면 SubagentStop이 무한 block돼 세션이 갇힐 수 있다. catch 경로에도 시도 횟수 계수 + N회 후 release 가드가 필요하다 ("never trap a session" 불변식 복원).
2. `subagent-evidence.ts` + `spawn-attach-hook.ts` — read-only 자동 면제(EVIDENCE_EXEMPT_TOKEN 자동 주입, context-pressure release)가 삭제됐다. 의도된 fail-closed 전환이지만, read-only intent에 기대던 기존 dispatcher 프롬프트는 머지 후 evidence gate에 걸린다. doctrine/프롬프트 정합성 점검 필요.
3. (Low) `subagent-evidence.ts:118` `transcriptHasContextPressure`는 프로덕션 호출이 없는 dead export; `media-handler.ts:124-129` legacy `downloadFile` 폴백은 버퍼링 후 크기 검사.
