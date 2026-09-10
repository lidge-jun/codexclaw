# 075 — wp5 receipt: 자연어 질의 완화

날짜: 2026-09-10 (KST). 세션 01a0880e-149e-72d0-86db-53bd99bcac0e. 브랜치 `codex/memory-l1-wp5-nl-query`(origin/dev 19e2dd5d 위), 구현 커밋 `69a3115c`. 구현은 opus-5 실행 서브에이전트, 검증·통합은 메인.

## 결론

9단어 이상 질의가 잘리지 않고, 심볼·버전·고유명사를 필수(AND), 나머지를 ceil(n/2) 쿼터로 매칭하는 MatchPlan 하나를 chat index·chat scan·memory가 공유한다. 8단어 이하는 이전 전항 AND 그대로다. 합성 골든셋(D3/P2/R2 chat+memory n≥1, c-4·c-5 유지, index/scan 동등성 오라클 2종×2모드)이 테스트로 고정됐고, 실인덱스에서는 D3 chat 0→2(7.3초→0.75초), D3 memory 0→3, P2 chat `--synonyms` 0→3이 됐다.

## 무엇이 바뀌었나

- `query-words.ts`: `MatchPlan`/`compileMatchPlan`/`planMatches(lowerText, plan)`/`isRequiredTerm`/`dropStopwords`(그/이/저/것/문제/방법)/`MAX_QUERY_TERMS=16`; `MAX_WORDS=8`은 절단이 아니라 완화 임계.
- `chat-search.ts` `--synonyms`(기본 off) + `chatMatchPlan`; `index-search.ts` 세 지점(relevance 재검사·top-up·recent)에 `planMatches` 최종 술어, recent는 `planPoolSize`(필수 0개면 2000)로 fetch 후 `limit+1` 절단, `candidateFilter`는 withWords 분기만 교체(#127 cwd/repo_key 꼬리 유지), `laneQuery` 헬퍼; `rollout.ts` scan 경로 같은 predicate; `memory-search.ts` `collect` 안에서 plan 재컴파일(#125 `relaxGroupsAt` 재시도 유지), stage1 필수 0개 `WHERE 1`; `synonyms.ts` 시드 5그룹 + 어미 `인지`; `cli.ts` 플래그·USAGE.
- 테스트 +19(177): NEW `nl-query.test.ts`, `fixtures.ts addNlGoldenCorpus`, query-words/synonyms/index 테스트 갱신(MAX_WORDS 절단 핀 → 임계). SKILL.md Commands 펜스에 `--synonyms`, Two engines·사다리 문단 갱신. 배지 2974→2993.

계획과의 차이: 상수명 `QUERY_STOPWORDS`; R2 픽스처는 옛 8단어 AND로도 매칭되는 문장을 피해 선택 원형 4개만 포함(회귀 증명 유지); `matchesFilePrefilter`에 `planIsEmpty` 가드; CLI 플래그 배선 테스트 1건 추가.

## 증거

- receipt `.codexclaw/evidence/01a0880e-149e-72d0-86db-53bd99bcac0e/test-receipt.json`: `/tmp/mfu-260910/check-wp5.sh` exit 0 @ 69a3115c — 합성 골든 58 pass, 실인덱스 D3 chat 2 / D3 memory 3 / P2 chat --synonyms 3 / LSP 전부 경계 / `2.49.0 SLSA` MEMORY.md 포함, recall 177 pass, dist-freshness·packaging·synopsis 7 pass.
- 감사: grok-4.6 리뷰어 GO-WITH-FIXES(3 High + 2 Medium) → 구현 제약으로 접음, C 테스트가 확인(relax 재시도 테스트, cwd-scope 테스트, nl-query 골든).

## 개선되지 않은 것 (LOOP-PESSIMIST-01)

- 실인덱스에서 P2(5토큰, 완화 분기 꺼짐)와 R2(필수 `2.49.0∧npm`과 굴절형이 한 메시지에 없음)는 여전히 0. 합격 기준은 합성 골든셋이고 라이브는 참고다.
- D3 chat의 히트 2건은 어절 겹침 순위라 정답 스레드가 아니다. 스킬 사다리(재작성)는 여전히 필요하다.
- 방향이 틀렸다는 신호: 필수어 0개 긴 질의가 recent 모드에서 pool 2000 이상을 요구해 지연이 통제의 20배를 넘으면 쿼터 규칙이 아니라 SQL 측 절단이 원인이다.

## 다음

wp6(네이티브 통합 보강)만 남았다.

