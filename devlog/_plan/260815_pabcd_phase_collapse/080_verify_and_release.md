---
created: 2026-08-15
status: design
workPhase: wp7
supersedes: [030_verify_and_release.md]
tags: [codexclaw, release, deploy]
---

# 080 — 통합 검증 + dev 푸시 + 정식 릴리스 배포

이 문서가 구 `030_verify_and_release.md`를 대체한다. 그 문서는 폐기된
010/020 설계(시간 임계값, 0초 back-fill 실물 검증)를 전제하고 있었다.

**모든 게이트(030~070)가 들어간 뒤에 실행한다.** 감사관이 지적한 순서 오류를
반영해 goalplan에서도 이 work-phase를 마지막으로 옮겼다 — 반쪽 게이트를
릴리스하고 핵심 변경을 검증 없이 남기지 않기 위해서다.

## 검증

1. `npm run build` (루트, canonical) — dist 동기화. 훅이 `dist/cli.js`를
   직접 실행하므로 이걸 빠뜨리면 **설치본에서 수정이 전혀 동작하지 않는다.**
2. `node --test` (pabcd-state) — 전체 통과. 현재 테스트 파일은 **43개**다.
3. 실물 거부 관찰 — 테스트가 아니라 실제 CLI로:
   - 030: pending task 상태에서 D → 거부, phase는 C 유지
   - 040: 자연어 "구현해" → phase 불변
   - 050: 빈 B에서 C → 거부
   - 060: 라운드 없이 A>B → 거부
   - 070: exitCode 없이 D → 거부
4. 회귀 관찰 — 정상 사이클이 끝까지 통과하는지 실물로 확인.

## 커밋

경로를 명시한다. `git add -A`는 쓰지 않는다.

포함: 이 devlog 유닛, `plugins/codexclaw/components/pabcd-state/`의 src/dist/test.

**제외 (사용자 소유, untracked)**: `devlog/_plan/260722_*`,
`devlog/_plan/260814_*`, `mktemp:` 디렉터리.

## 푸시

사용자가 "푸시하고 배포까지 완료해놔"로 명시 승인했다. dev에 푸시하고
force push는 하지 않는다.

## 릴리스

정식 메커니즘만 쓴다. 직접 `npm publish` 금지.

1. 현재 stable은 v0.2.0(2026-08-15 게시, Latest 확인됨).
2. 게이트 동작을 바꾸는 기능 추가이므로 0.2.1.
3. `check-versions.mjs`가 모든 버전 surface 정합을 강제한다 — 현재
   "every surface declares 0.2.0"이므로 전부 함께 올려야 한다.
4. `release.yml` workflow_dispatch. leniency 플래그 금지.
5. 실행 결론 success + 릴리스 페이지 실물 확인. 초록 체크만으로 완료를 주장하지 않는다.

## 완료 판정

c5는 푸시된 SHA와 원격 ref로, c6은 실행 id와 릴리스 페이지 출력으로 닫는다.
확인 못 한 criterion은 열어둔 채 실제 상태를 보고한다.

