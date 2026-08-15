---
created: 2026-08-15
status: design
tags: [codexclaw, release, deploy]
unit: 260815_pabcd_phase_collapse
---

# 030 — 검증, dev 푸시, 정식 릴리스 배포

## 검증 순서

1. `cd plugins/codexclaw/components/pabcd-state && node --test` — 전체 통과.
   010/020의 신규 테스트가 포함되고, 기존 40개 테스트 파일에 회귀가 없어야 한다.
2. **dist 동기화** — 이 컴포넌트는 `dist/*.js`를 저장소에 커밋한다. 훅이
   `dist/cli.js`를 직접 실행하므로, src만 고치고 dist를 안 맞추면
   **설치본에서 수정이 아예 동작하지 않는다.** 릴리스 전 필수 확인 항목이다.
3. **실물 거부 관찰** — 테스트가 아니라 실제 CLI로 0초 back-fill을 시도해
   거부 출력과 비영 exit code를 눈으로 확인한다. 이것이 c3의 증거다.
4. **회귀 관찰** — 정상 사이클이 여전히 통과하는지 실물로 확인한다(c4).

## 커밋

000 제약대로 사용자의 미커밋 작업은 건드리지 않는다. 커밋 대상은:

- `devlog/_plan/260815_pabcd_phase_collapse/` (이 유닛)
- `plugins/codexclaw/components/pabcd-state/src/` 변경분
- `plugins/codexclaw/components/pabcd-state/dist/` 대응 빌드
- `plugins/codexclaw/components/pabcd-state/test/` 신규 테스트

건드리지 않을 것 (사용자 소유, untracked):

- `devlog/_plan/260722_260722-repo-governance-config/`
- `devlog/_plan/260814_260814-fix-main-ci-windows-worktree/`
- `mktemp:` 디렉터리

`git add`는 경로를 명시한다. `git add -A`는 쓰지 않는다.

## 푸시

사용자가 "푸시하고 배포까지 완료해놔"로 명시 승인했다(LOOP-GIT-01의 ESCALATE
예외 — 승인된 범위 안에서 진행). `dev` 브랜치에 푸시한다. force push는 하지 않는다.

## 릴리스

저장소 정식 메커니즘을 쓴다. 직접 `npm publish`는 하지 않는다.

1. 현재 릴리스 상태 확인 — `gh release list`, 현재 버전 surface 확인.
2. 버전 결정 — 현재 stable은 `0.2.0`. 이 변경은 게이트 동작을 바꾸는
   기능 추가이므로 `0.2.1`이 적절하다. `check-versions.mjs`가 모든 버전
   surface의 정합을 강제하므로 그 스크립트를 통과시켜야 한다.
3. `release.yml` workflow_dispatch로 배포. `release-gate`가 receipt를 요구하며,
   `--allow-deferred` 같은 leniency 플래그는 쓰지 않는다.
4. 실행 결론이 success인지, 릴리스 페이지에 실제로 올라왔는지 확인한다.
   초록 체크만으로 완료를 주장하지 않는다.

## 완료 판정

c5는 푸시된 SHA와 원격 ref로, c6은 실행 id와 릴리스 페이지 출력으로 닫는다.
어느 하나라도 확인 못 하면 해당 criterion은 열어둔 채 실제 상태를 보고한다.

