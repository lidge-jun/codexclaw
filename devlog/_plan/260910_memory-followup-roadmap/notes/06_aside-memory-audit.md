# 06 — Aside 메모리 검색 감사 (Aside 자체 조사, 축약본)

날짜: 2026-09-10 (KST). 조사 주체: `aside exec --permission full-access` (읽기 전용). 원본 노트는 개인·거래처 식별자(사용자 페이지, 워크스페이스명, Slack ID, 호스트명)를 담고 있어 체크아웃 밖
`tmp/memory-followup-260910/notes/06_aside-memory-audit.full.md`(메인 체크아웃, 미추적)에 둔다. 이 문서는 DEV-PRIVACY-01에 따라 식별자를 뺀 요약이다.

## 재현 결과 (2026-09-10)

| 질의 | 저장소 실제 문자열 존재 | 검색 결과 | 판정 |
|---|---|---|---|
| 존재하지 않는 무작위 문자열 | 0 (`rg --fixed-strings` NO_HITS) | 10건, 점수 0.683~0.532 | 컷오프 없음 |
| 한국어 고유명사 2단어(워크스페이스명 + 봇 이름) | 20청크가 두 단어를 모두 포함(프로젝트 페이지 7청크) | top-10에 정답 페이지 없음, 1위 0.682는 무관 사용자 페이지 | 어휘 채널 부재 |
| 같은 사실의 영어 질의 | 동일 | 1위 0.850 정답 청크 | 임베딩이 영어 heading에 정렬 |

엔진: `moss-minilm` 384차원 코사인 top-k. 인덱스 6,299행 / 102 경로 (09-09 5,048에서 25% 증가). 설정에 scoreCutoff·minScore·dedupe·hybrid·bm25 키 없음.

## 원인 (확인 / 가설 구분)

- 확인: 점수 컷오프가 없다. 무의미 질의와 한국어 오탐이 같은 천장(≈0.68)을 쓴다.
- 확인: 검색 측 dedupe가 없다. 같은 `path`의 이웃 청크(줄 겹침 93.6%, 보폭 median 450 / 청크 800~1024자)가 top-N을 점유한다.
- 확인: dreaming/decay는 2,288 change 중 deleted 0, shrink 3.23%. L1 규칙(USER ≤5KB, MEMORY ≤3KB) 대비 실측 15.8 / 4.1KB.
- 가설: 청크 heading이 영어라 한국어 질의 벡터가 멀다. 라틴 토큰 고유명사는 영어 질의의 앵커로만 작동한다.

## 로드맵 입력

Aside 쪽 P0: (1) 기본 minScore 0.72 컷오프(재측정 필요), (2) 고유명사 exact/lexical 채널(`--mode hybrid|semantic|exact`), (3) path 단위 dedupe, (4) 도구 `memory_search`에 score·chunkId·lineEnd 노출.
P1: 청크 보폭/heading 경계 청킹, 페이지 중복 서술 접기, L1 캡 강제, 에피소딕 랭킹 페널티, 연합 회수 계약(`--json`, 0.72 컷, path dedupe, exact fallback)을 codexclaw 스킬에 고정.
P2: 다국어 임베딩 교체, retention 의미 문서화, dreaming deleted 경로, L1/TAXONOMY 동기화 가드, 평가 세트 고정.

codexclaw 관점에서 지금 할 수 있는 것은 P1의 "연합 회수 계약"뿐이다. 엔진 변경은 Aside 별도 트랙이며 L0 회귀와 무관하다.

