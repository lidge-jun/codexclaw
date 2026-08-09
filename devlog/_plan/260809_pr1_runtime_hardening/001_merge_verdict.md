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

## 4. 결정

**머지 실행** (조건: A단계 독립 감사에서 이 평가가 뒤집히지 않을 것). 절차: `gh pr ready 1` → `gh pr merge` → `gh pr view 1 --json state`로 MERGED 확인 → 로컬 dev는 pull하지 않고 원격 상태만 갱신 (로컬 dev는 미커밋/미푸시 커밋이 있어 원격 갱신과 별개).

실행 결과 (메인 세션, 2026-08-09T01:18:41Z): MERGED, squash 커밋 `dac77cc762edd3588f28d66acb4590bff85420ee`. 머지 방식은 이 문서의 `--merge` 대신 `--squash`로 실행했다 — dev가 linear 단일 커밋 관례이고 PR이 단일 커밋이라 정보 손실이 없다 (000 §8).

> provenance: 이 문서는 병렬 re-audit 세션(git author bitkyc08-arch, 2026-08-09 10:15 KST)이 작성했다. 검증 수치(1,453/1,507/gate/build)는 메인 세션이 별도 임시 워크트리(/tmp/cxc-pr1-A5jd)에서 독립 재실행해 일치를 확인했다.
