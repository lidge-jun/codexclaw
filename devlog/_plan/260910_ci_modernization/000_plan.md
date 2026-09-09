# CI 현대화: 샤딩, WSL 게이팅, 집계 체크 (HOTL 로드맵)

기준 HEAD: `origin/dev` = `a4396f28`. 세션: `01a08654-a5d0-71c0-a348-922a0b3ed7ff`. goalplan: `hotl-modernize-codexclaw-ci-per-cxc-dev-devops-1`.
요청: cxc-dev-devops 규칙대로 오래 걸리는 잡(WSL)은 dev·preview·main push에서만 돌리고, 오래 걸리는 스위트는 opencodex 사례처럼 샤딩. 현재 PR(#118)의 CI가 안정된 뒤 시작한다(확인: #118 헤드 b1e76d34 전 체크 SUCCESS).
이전 goal의 D 결론: 여덟 PR을 dev에 넣는 동안 매 PR마다 WSL 잡(13~14분)이 임계 경로였고, Windows 테스트 잡(9분)이 그다음이었다. 이 unit은 그 비용을 줄이는 쪽으로 방향을 잇는다.

## 독자 요약

PR 한 건의 CI 벽시계 시간은 WSL 잡이 정한다(817초). WSL은 wp07의 drvfs/ext4 신호를 검증하는 통합 라인용 증거이지 PR 리뷰용이 아니므로 push(main·preview·dev)와 dispatch에서만 돌린다. Windows 테스트(515~553초)는 2샤드로 나눠 절반으로 줄이고, 샤드는 `scripts/test.mjs --shard i/n`으로 파일 목록을 결정론적으로 나눈다. Ubuntu 전체 스위트 1개 레인은 그대로 두어 테스트 뱃지 총계를 잰다. 잡이 늘어나므로 `if: always()` 집계 잡 `ci` 하나가 모든 레그를 needs로 묶어 실패·취소·예상 밖 skip을 하나의 체크로 드러낸다(opencodex ci.yml의 `ci` 집계 잡과 같은 이유).

## 측정 기준선 (dev push, 2026-09-10)

| 워크플로 / 잡 | 시간 |
|---|---|
| ci.yml test (ubuntu, autocrlf=false) | 120s |
| ci.yml test (macos) | 186s |
| ci.yml test (windows, false) | 515s |
| ci.yml test (windows, true) | 553s |
| wsl.yml wsl | 817s |
| packed-install artifact ×3 / install ×2 | 12~41s |

## Loop spec

| 항목 | 계약 |
|---|---|
| Class | C3 (CI 워크플로 + 테스트 러너 스크립트; 제품 런타임 코드 없음, 릴리스 경로 영향 있음) |
| Verifier | actionlint(있으면), `test.mjs --shard` 단위 테스트, PR 최종 헤드에서 새 ci.yml 전 레그 SUCCESS + 집계 `ci` SUCCESS, 머지 후 dev push 런에서 WSL 두 잡 SUCCESS |
| Non-goals | self-hosted runner, paths-filter 기반 스킵(작은 레포라 불필요), release.yml 변경, preview 브랜치 생성 |
| Stop | wp4 D: 머지 + dev push 증거 |
| Escalation | 새 ci.yml이 PR에서 빨간불이고 원인이 워크플로 밖이면 NEEDS_HUMAN |

## 단계 지도

| Work phase | 문서 | 산출물 |
|---|---|---|
| wp1 | 이 파일, 010, 020 | 로드맵 잠금 |
| wp2 | [010_shard_and_aggregate.md](010_shard_and_aggregate.md) | test.mjs --shard + 테스트, ci.yml 샤딩·타임아웃·집계 잡 |
| wp3 | [020_wsl_gating.md](020_wsl_gating.md) | wsl.yml 트리거·분할·타임아웃, README CI 절 |
| wp4 | 020 §머지 | PR·CI·머지·dev push 증거 |

Privacy gate(DEV-PRIVACY-01): 이 unit은 CI 설정만 다루며 고객·개인 데이터가 없다.

## 결과 (2026-09-10)

PR #121(헤드 50f6609c) 머지 커밋 `ba458867`. PR에서 새 ci.yml이 그대로 돌아 Windows 샤드 4개, macOS, ubuntu 전체 레인, 집계 `ci` 모두 SUCCESS(`evidence/pr121-checks.json`). 첫 헤드에서는 ubuntu 레인이 뱃지 총계(2941≠2945)로 실패했고 집계 `ci`가 그것을 FAILURE로 드러냈다(집계가 설계대로 동작한 증거). dev push `ba458867`에서 CI와 WSL(wsl-drvfs, wsl-ext4) 모두 SUCCESS(`evidence/dev-push-ba458867-runs.json`, 잡별 시간 포함). main 룰셋 20884837의 필수 체크를 `ci` + artifact/install로 갱신(`evidence/ruleset-20884837-before.json`, `-after.json`). 이 unit의 기록 커밋은 별도 문서 PR로 dev에 올린다.
