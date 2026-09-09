# 010 wp2: test.mjs 샤딩과 ci.yml 집계

## test.mjs `--shard i/n`

현재 `plugins/codexclaw/scripts/test.mjs`는 인자를 `node --test --test-concurrency=1`에 그대로 넘긴다(글롭은 node:test가 확장). 샤딩하려면 스크립트가 글롭을 직접 확장해야 한다.

- `--shard <i>/<n>` 인자를 파싱해 제거한다(1 ≤ i ≤ n). 없으면 기존과 동일.
- `fs.globSync`(Node 22+; CI는 Node 24)로 패턴을 확장하고, 경로를 POSIX 구분자로 정규화해 정렬한 뒤 `index % n === i-1`인 파일만 넘긴다(opencodex의 정렬 라운드로빈과 같은 규칙; Windows `\\`가 정렬을 바꾸지 않게). 빈 샤드는 오류(잘못된 n). `--shard`는 node에 넘기기 전에 제거한다(Node 24의 `--test-shard`는 다른 분할기라 쓰지 않는다).
- 테스트 `plugins/codexclaw/test/test-shard.test.mjs`: 헬퍼 `shardFiles(files, i, n)`과 `expandPatterns(patterns)`를 export해 (a) 모든 샤드의 합집합 = 전체, (b) 교집합 없음, (c) 순서 결정론(경로 구분자 무관), (d) 잘못된 `--shard` 문자열 거부, (e) 실제 `package.json`의 test 글롭을 확장하면 패턴마다 1개 이상, 전체 209개 안팎이고 2샤드 합이 전체와 같음을 검증한다.

## ci.yml

```yaml
jobs:
  test:            # ubuntu, autocrlf false, 전체 스위트 1회 → 뱃지 총계 측정 (기존 그대로)
  test-macos:      # macos, 전체 스위트 (186s, 샤딩 불필요)
  test-windows:
    strategy: { matrix: { autocrlf: [false, true], shard: [1, 2] }, fail-fast: false }
    timeout-minutes: 12
    steps: … npm test -- --shard ${{ matrix.shard }}/2 ; gate.mjs ; platform-smoke (shard 1만)
  ci:
    if: always()
    needs: [test, test-macos, test-windows]
    steps: 모든 needs.*.result == 'success' 인지 검사, 아니면 exit 1
```

- 뱃지 검사(`inventory.mjs --check --tests`)는 ubuntu 전체 레인에서만 한다. 샤드에서는 총계를 알 수 없다.
- `gate.mjs`는 빠르므로 모든 OS 잡에서 유지. `platform-smoke`는 OS당 한 번(Windows는 shard 1).
- 각 잡에 `timeout-minutes`(ubuntu 10, macos 12, windows 샤드 12).
- 아티팩트 이름에 shard를 넣는다: `receipts-${{ matrix.os }}-crlf${{ matrix.autocrlf }}-shard${{ matrix.shard }}` (같은 이름이면 upload-artifact@v4가 잡을 실패시킨다).
- 집계 `ci` 잡 이름은 고정. **main 룰셋 `protect-main`(id 20884837)은 지금 `test (ubuntu-latest, false)`, `test (windows-latest, false|true)`, `test (macos-latest, false)`와 packed-install의 artifact/install을 필수 체크로 요구한다.** 잡을 쪼개면 그 이름이 사라져 main으로 가는 PR이 영원히 pending이 되므로, wp4에서 dev 머지 직후 룰셋의 필수 체크를 `ci` + artifact/install로 바꾼다(`gh api -X PUT repos/lidge-jun/codexclaw/rulesets/20884837`; 변경 전 GET으로 원본을 evidence에 저장). dev는 룰셋이 없어 머지에 영향 없다.
- `concurrency: group: ci-${{ github.ref }}, cancel-in-progress: ${{ github.event_name == 'pull_request' }}`: PR의 연속 push만 이전 런을 취소하고, dev·main push는 SHA별 증거를 남긴다.
- 집계 잡은 `skipped`를 허용하지 않는다(opencodex의 skipped 허용 목록을 따르지 않는다). 모든 needs.*.result가 `success`여야 통과.

## 검증

- 로컬: `node plugins/codexclaw/scripts/test.mjs --shard 1/2 <globs>`와 `2/2`의 합이 전체와 같은지 파일 수로 확인; 새 단위 테스트 통과.
- PR CI: 새 워크플로의 모든 레그와 `ci` 집계 SUCCESS.
