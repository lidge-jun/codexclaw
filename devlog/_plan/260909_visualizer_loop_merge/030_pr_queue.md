# 030 wp4~wp6: 열린 PR 머지 큐

조회 시각 2026-09-09 23:1x KST. `gh` 계정 lidge-jun(admin), dev 미보호, 포크 PR 셋은 maintainerCanModify=true.

| PR | head | 소유 | 상태 | 충돌 | 단계 |
|---|---|---|---|---|---|
| #116 subagent first fallback | codex/subagent-first-fallback c00ade15 | thisisjun786 포크 | MERGEABLE, CI 11 SUCCESS | 없음 | wp4 |
| #112 release dispatch hardening | codex/release-dispatch-hardening 61ca6f74 | lidge-jun | MERGEABLE, CI SUCCESS | 없음 | wp4 |
| #113 pr lifecycle hygiene | codex/pr-lifecycle-hygiene 262b3832 | lidge-jun | CONFLICTING | README.ko.md | wp5 |
| #111 closed-pr branch cleanup | codex/closed-pr-branch-cleanup 645f43e3 | lidge-jun | CONFLICTING | README.ko.md | wp5 |
| #110 architect role | codex/architect-role-proposal a5b381ec | thisisjun786 포크 | CONFLICTING, CI 10 SUCCESS | 미조사 | wp6 |
| #91 executor role registration | fix/executor-role-registration 9a546f06 | thisisjun786 포크 | CONFLICTING | 미조사 | wp6 |

## 공통 절차 (PR 하나 = 사이클 안의 한 task)

P: `gh pr view`로 head/base/mergeable/reviews/checks를 다시 읽는다(외부 행동 직전 재확인). 변경 파일과 본문을 읽고 dev와의 의미 충돌(같은 파일을 다른 PR이 바꾸는지)을 본다.
A: reviewer 서브에이전트에게 diff를 읽혀 blocker를 받는다(코드 PR). 문서·CI 워크플로 PR은 main이 직접 읽고 검토 기록을 남긴다.
B: 충돌 PR은 `/private/tmp/cxc-pr<N>-260909` 임시 작업 트리에서 `git rebase origin/dev`(lidge-jun 브랜치) 또는 `git merge origin/dev`(포크 브랜치, 원저자 커밋 보존) 후 push. 포크는 `git push https://github.com/thisisjun786/codexclaw.git HEAD:<branch>`(maintainer edit). 리베이스로 SHA가 바뀌면 PR 본문에 이유를 한 줄 남긴다.
C: 최종 헤드 SHA의 ci.yml 전 job SUCCESS(`gh pr checks <N> --watch`). dev가 그 사이 움직였으면 다시 얹고 다시 받는다.
D: `gh pr merge <N> --merge`, `git fetch`, ancestor 증명, 다음 PR로. 임시 작업 트리는 정리하되 브랜치는 남긴다.

## A. wp4 (#116, #112)

기존 11/11 SUCCESS는 옛 dev(5f11fb8b) 기준이라 wp3 머지 뒤에는 stale이다. 재트리거: #112는 `git rebase origin/dev` 후 push, #116은 포크 브랜치에 `git merge origin/dev` 후 push(ci.yml은 pull_request 헤드 push에 돈다). 각 머지 뒤 다음 PR도 같은 방식으로 최신 dev 위에서 CI를 다시 받는다. #116은 포크·1,482줄 추가·subagent-config 코드라 reviewer 서브에이전트 감사를 받는다(blocker 기준: 테스트 없는 동작 변경, 기존 테스트 삭제, 권한·경로 탈출, 비밀값). #112는 release.yml 77줄, main이 직접 읽는다.

## B. wp5 (#113, #111)

둘 다 README.ko.md 뱃지/카운트 충돌이고, 둘 다 package.json `test` 글롭을 고치므로 두 번째 리베이스는 package.json에서도 충돌한다. 각각 origin/dev에 리베이스하고 `inventory.mjs --check`(hooks 수가 바뀌면 `--write`)로 README를 재생성한 뒤 push. `.github/scripts/*.test.cjs`가 package.json test 글롭에 들어가 CI `npm test`에서 도는지 확인한다. 안 돌면 blocker이며, 그 PR의 B에서 글롭을 추가한다.

## C. wp6 (#110, #91)

포크 PR. `git merge origin/dev`로 해결해 원저자 커밋을 보존한다. #110(architect role, 54 files)과 #91(executor registration, 34 files)은 같은 subagent-config 영역을 건드리므로 #116 머지 후 충돌 범위를 다시 잰다. 두 PR이 서로 겹치면 #91(더 오래됨, fix)을 먼저 올린다. reviewer 서브에이전트 감사 필수(blocker 기준은 §A와 같다). push가 거부되면 lidge-jun 브랜치를 만들어 원 커밋을 `git cherry-pick`으로 옮기고(Author 보존, squash 없음, 머지 해결 커밋만 내 이름), 새 PR이 원 PR을 링크한다. 이는 NEEDS_HUMAN이 아니라 정규 대체 경로다.
