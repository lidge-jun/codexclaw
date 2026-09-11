# 020 wp3: visualizer 브랜치 PR·CI·머지

P 수정(2026-09-09 23:3x): 사용자 요청으로 [040_codexclaw_lessons.md](040_codexclaw_lessons.md)의 교훈 반영을 이 사이클의 B 앞부분에 넣는다(같은 PR). wp7은 머지 후 CHANGELOG·structure 기록 사이클로 남긴다.

0. 히스토리 정리(필수): 로컬 커밋 a2f67fe3·8b52c6be·46e2a439와 wp2 커밋에는 비공개 증거와 고객 수치 샘플이 있다. `git reset --soft 58311cc5`(rename 커밋) 후 비공개 파일을 제외하고 두세 개의 깨끗한 커밋으로 다시 만든다. 그 다음 `git log 58311cc5..HEAD --name-only`와 `git grep -n -e 고객사 -e client -e client server -e 동료 -e the issuing company -e 카카오 -- . ':!devlog/_fin'`가 0건인지 확인하고 결과를 evidence에 남긴다. 0건이 아니면 push하지 않는다.
1. `git fetch origin`; `codex/dev-visualizer-rename`을 최신 `origin/dev` 위로 rebase(충돌 시 README/inventory 뱃지·카탈로그는 `inventory.mjs --write`로 재생성).
2. 로컬 확인: `inventory.mjs --check`, skill-catalog·visualize-inspection·subagent-config 테스트. A 단계: reviewer 서브에이전트에게 export 스크립트와 SKILL/reference diff를 읽혀 blocker를 받는다(030과 같은 기준).
3. `git push -u origin codex/dev-visualizer-rename`; `gh pr create --base dev` 본문은 문제→변경→검증 순, 대화 이력 없이. 제목 `feat(dev-visualizer): rename from diagram-viewer, report storyline rules, A4 paged template and export QA`.
4. 최종 헤드 SHA로 ci.yml 전 job SUCCESS 대기(`gh pr checks --watch`). skipped/cancelled는 증거가 아니다.
5. `gh pr merge --merge`(레포 관행: dev로의 머지 커밋, #115 등 선례). 머지 후 `git fetch`, `git merge-base --is-ancestor <head> origin/dev`, `git diff --stat <head> origin/dev -- plugins/codexclaw/skills/dev-visualizer`가 비어 있음을 기록.
6. 이 worktree는 앱 관리 worktree이므로 브랜치를 지우지 않는다(WORKTREE-GUARD-01).
