# cxc-dev-visualizer 마무리와 열린 PR 머지 큐 (HOTL 로드맵)

기준 HEAD: `46e2a439` on `codex/dev-visualizer-rename` (base `origin/dev` = `5f11fb8b`). 세션: `01a08654-a5d0-71c0-a348-922a0b3ed7ff`.
goalplan: `.codexclaw/goalplans/hotl-1-finish-the-cxc-dev-visualizer-report-qual/`.
요청: "cjk나 aside 조사도 계속하면서 cxc-loop 한번 더 돌아서 완벽하게 하고 머지까지 완료해놔 그리고 내가 올린 다른 pr들도 pabcd 좀 돌면서 dev에 머지해놔". push·PR·merge 권한은 이 요청에 명시돼 있다. release·npm publish·deploy·브랜치 삭제는 포함되지 않는다.
이전 D 결론(`devlog/_plan/260909_visualizer_report_quality/000_plan.md`): 내용 층은 고쳤으나 v2의 생김새는 여전히 카드·콜아웃·둥근 박스·도식이라는 AI 템플릿 문법이고, 브랜드 자산 없이는 무명 템플릿에서 끝난다. 이번 루프는 그 방향을 그대로 잇는다.

## 독자 요약

여섯 work-phase다. wp1은 이 로드맵(docs-only). wp2는 스킬의 마지막 층인 디자인: 카드·박스를 걷어낸 편집 디자인 양식과 REPORT-DESIGN-01, Aside G 레인의 CJK 조판 규칙, v2 재출력과 fresh-read. wp3은 visualizer 브랜치 push·PR·CI·머지. wp4~wp6은 열린 PR 여섯 개를 mergeable → lidge-jun 충돌 → 포크 충돌 순으로 머지한다. 각 머지는 최종 헤드 CI SUCCESS와 `origin/dev` 조상 증명을 남긴다.

## Loop spec

| 항목 | 계약 |
|---|---|
| Class | wp2 C3(스킬 문서·자산·export 스크립트, 제품 런타임 코드 없음), wp3~wp6 C3(외부 상태 변경: push·merge) |
| Verifier | export QA PASS, fresh-read(무맥락 모델), 카탈로그·inventory 테스트, PR별 최종 헤드 GitHub Actions ci.yml SUCCESS, `git merge-base --is-ancestor` |
| Non-goals | release train, npm publish, GitHub native stack, 브랜치 삭제, 포크 PR 커밋의 squash·재작성(cherry-pick으로 Author 보존은 허용) |
| Write scope | 이 레포; client report v2 초안은 `<client workspace, outside the repo>/`(고객 작업 공간, 비공개); 비공개 감사 증거는 그 아래 `_skill-audit/` |
| Privacy gate | 이 레포는 PUBLIC. push 전에 PR 범위에서 고객·개인 식별자(고객사, client, client server, 동료, the issuing company, 메신저 원문, 고객 수치)를 grep으로 0건 확인. 위반 파일은 히스토리에서 제거(로컬 커밋만 존재하므로 soft-reset 후 재커밋) |
| Stop | wp6 D 종료, 모든 criteria met, 마지막 `origin/dev`가 여섯 PR과 visualizer 브랜치를 모두 포함 |
| Escalation | CI가 최종 헤드에서 실패하고 원인이 PR 범위 밖이면 NEEDS_HUMAN. 포크 PR push 거부는 NEEDS_HUMAN이 아니라 030 §C의 cherry-pick 대체 경로(Author 보존, squash 없음, 새 PR이 원 PR을 링크) |

## 단계 지도

| Work phase | 의존 | 문서 | 산출물 |
|---|---|---|---|
| wp1 | — | 이 파일, 010, 020, 030 | 로드맵 잠금 |
| wp2 | wp1 | [010_design_deslop.md](010_design_deslop.md) | REPORT-DESIGN-01, 편집 디자인 양식, CJK 규칙, v2 재출력, fresh-read |
| wp3 | wp2 | [020_visualizer_pr.md](020_visualizer_pr.md) | PR 생성·CI·머지·조상 증명 |
| wp4 | wp1 | [030_pr_queue.md](030_pr_queue.md) §A | #116, #112 머지 |
| wp5 | wp4 | [030_pr_queue.md](030_pr_queue.md) §B | #113, #111 리베이스·머지 |
| wp6 | wp5 | [030_pr_queue.md](030_pr_queue.md) §C | #110, #91 충돌 해결·머지 |

순서는 wp2 → wp3 → wp4 → wp5 → wp6. dev가 앞서 나가면 각 PR은 머지 직전에 최신 dev 위에서 CI를 다시 받는다.

## 결과 (2026-09-10)

| PR | 최종 헤드 | 머지 커밋 | 비고 |
|---|---|---|---|
| #117 visualizer | d900d155 | 5c9fd59f | 히스토리를 4개 커밋으로 재작성해 비공개 증거 제거 후 push |
| #116 subagent first fallback | 831b37fd | bef704ff | 포크 브랜치에 dev 머지 + 리뷰 소프트 2건 반영 (maintainer edit) |
| #112 release dispatch hardening | 9d3159e4 | fc12bde5 | dev 위로 두 번 rebase해 최신 CI |
| #113 pr lifecycle hygiene | 3fe44dc7 | d1f08e42 | README·inventory 재생성, CI 측정 테스트 수 2845로 정정 |
| #111 closed-pr branch cleanup | 3534a2d0 | 1ca63c86 | package.json test 글롭 충돌 해결 |
| #110 architect role | 03ff1edb | 369ed0e1 | 다른 세션이 dev를 미리 머지해 둬 충돌 0; 로드맵과 달리 #91보다 먼저 머지 |
| #91 executor registration | c2558a4c | 9dd8ae7b | #110 registrar 유지 + #91 executor 해석 결합, 양쪽 테스트 보존 |

각 머지 뒤 `git merge-base --is-ancestor <head> origin/dev` 확인, 증거는 `evidence/pr*-merge.json`(gh 출력). 임시 작업 트리는 이 세션의 WORKTREE-GUARD-03이 `git worktree remove`를 막아 외부에서 정리했다. 서브에이전트는 사용자 지시로 xai/grok-4.6만 사용(#110·#91 감사).
