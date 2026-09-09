# 072 — wp2 receipt: 심볼 경계 회귀

날짜: 2026-09-10 (KST). 세션 01a0880e-149e-72d0-86db-53bd99bcac0e. 브랜치 `codex/memory-l1-wp2-symbol`(origin/dev 91745432 위), 구현 커밋 `01902837`.

## 결론

`2.49.0 SLSA`가 MEMORY.md의 `v2.49.0` 청크를 완화 경고 없이 다시 찾는다(실인덱스 실측: 설치본 2건 → 워크트리 4건, MEMORY.md 2건 포함). `LSP` 결과는 이전 빌드와 바이트 단위로 같다(c-4 유지). 완화 재시도는 전체가 아니라 코퍼스 어디에도 없는 경계 그룹만 연다.

## 무엇이 바뀌었나

- `recall/src/query-words.ts`: VERSION/VERSION_CORE 정규식, `isVersionWord`, 심볼 판정에 VERSION 선행, `isBoundaryAt`의 v접두 예외(토큰 가장자리의 단독 v), `relaxGroupsAt` 추가, `relaxQueryGroups`는 위임(감사 반영: 126-139는 추가이며 `hasBoundaryTerm` 유지).
- `recall/src/memory-search.ts`: `groupHit`/`markGroupPresence` 분리, `collect(active, tallyPresence)`, AND=0일 때 `fillStage1Presence`(stage1_outputs 읽기 전용)로 그룹 존재를 보정한 뒤 miss 집합만 완화.
- `test/query-words.test.ts` +5(VERSION 분류, v접두 경계, 2.49.0 SLSA 복구, c-4 유지, 그룹 단위 완화).
- dist `query-words.js`, `memory-search.js` 재생성. 테스트 배지 2951→2956.

## 증거

- receipt `.codexclaw/evidence/01a0880e-149e-72d0-86db-53bd99bcac0e/test-receipt.json`: `/tmp/mfu-260910/check-wp2.sh` exit 0 @ 01902837 — 골든 2건(워크트리 dist, 실인덱스 `--no-refresh`) + recall 142 pass + dist-freshness·packaging 5 pass.
- 감사: 020에 대해 grok-4.6 리뷰어 GO-WITH-FIXES(Medium 1) → 접음(near-pass). 리뷰어가 recall 137/137 실행.
- 원격 CI: PR 최종 head 전건 통과 후 머지(아래 갱신).

## 개선되지 않은 것 (LOOP-PESSIMIST-01)

- chat 경로는 여전히 경계 매칭이 없다(wp5 범위). 
- 그룹 단위 완화는 AND=0에서만 열린다. 모든 경계 그룹이 각자 히트하는데 교집합이 빈 경우는 이제 substring으로 열지 않는다(의도된 동작 변경, 020 §4.2).
- 방향이 틀렸다는 신호: 실사용에서 "lower confidence" 경고가 사라지면서 정답도 같이 사라지는 질의가 보고되면, 그룹 존재 판정이 파일 전체 텍스트 기준이라 청크 단위 교차 공백을 못 여는 것이 원인이다.

## 다음

wp3 P: 030(cxc-recall SKILL.md 재작성 + docs-site)을 현재 트리와 대조. wp1·wp2가 모두 dev에 있어야 문구가 확정된다.

