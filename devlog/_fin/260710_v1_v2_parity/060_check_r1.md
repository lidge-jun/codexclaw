# 060 — C-gate r1 합성 (Helmholtz/gpt-5.6-sol, VERDICT: FAIL, High 5)

통과 확인: 스위트 전부(128/18/18/19/393-1), 매처 통상형, V1 정규화 정합,
full-fork 게이트, 독립 필드 주입, 교체 봉투 키 보존, D1 루트/자식 구분,
카탈로그 핀, effort 집합.

## 수리 계획 (전부 수용)

- F1 (수용, 메인) inlineSkillBodies 강화: 조기 크기 가드, 정규식 strip →
  선형 단일패스 closed-block 스캐너, dedupe는 검증된 닫힌 블록만 인정
  (미닫힘 opener는 평문 취급). 미닫힘/중첩/빈블록/초대형 테스트 추가.
- F2 (수용, 워커) Dashboard: v2 폴백 선택 시 역할 컨트롤 숨김 + "V1 spawns
  only" 문구 → 컨트롤 상시 노출 + 표면 중립 서술.
- F3 (수용, 커밋 시점) dist/multi-agent-v2.js가 gitignore에 걸림 →
  커밋 때 git add -f (다른 tracked dist와 일관).
- F4 (수용, 워커) pabcd hook.ts A-directive "only normalizes" → 훅의 실제
  동작(정규화+V2 인라인+model/effort 라우팅+가드, 단 누락 스킬은 발명 안 함)
  반영; structure/60 금지 문구에 대체 경로(스키마 미노출이어도 인자 수용) 설명 보강.
- F5 (수용, 메인) 매처 e2e 보강: manifest의 matcher 정규식을 파싱해
  positive(spawn_agent, collaborationspawn_agent, collaboration.spawn_agent) /
  negative(shell, multi_agent_v1.spawn_agent) 이름 집합 검증 + collaboration
  이름으로 실제 dist 구동 케이스.

잔여(수용된 비차단): GUI tsc 베이스라인 결함(패치 무관), 신규 세션 라이브
스모크(세션 훅 스냅샷 신선도 문제로 이월).
