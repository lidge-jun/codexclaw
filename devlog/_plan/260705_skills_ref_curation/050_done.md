# 050 — Done: 전체 이니셔티브 마감 기록

- Date: 2026-07-05
- Scope: 260705_hook_diet_skill_implicit (WP1) + 260705_skills_ref_curation (WP2-3)
- 실행 형태: HITL PABCD 3 work-phases, 각각 P→A→B→C→D 풀 사이클, gpt-5.5 독립
  리뷰어 A-gate 3회

---

## WP1 — Hook Diet + Implicit Expansion (codexclaw 리포)

- implicit 셋: `{dev}` → `{dev, search, interview, pabcd, recall, skill-hub, loop}`
  (openai.yaml 6개 flip; 메타데이터 ~180 토큰 추가)
- dev SKILL.md: agbrowse HTTP-first 노트 + DEV-FRICTION-01/DEV-EDIT-SHAPE-01
  흡수 규칙 (제거된 advisory hook 대체)
- hooks: manifest 18→11 (병렬 작업의 render-observations hook 보존).
  제거 7종은 `hooks/_deprecated/`로 이동 (복원 가능)
- 문서/테스트 동기화: skill-hub SKILL.md, catalog.md, manifest-policy S3/L18/L19,
  hook-e2e 11-hook 단언
- 증거: npm test 687/687, cxc doctor PASS

## WP2 — skills_ref 청소 + push (cli-jaw-skills 서브모듈)

- registry.json: 유령 6종 entry-path 승격, 잘린 설명 34건 frontmatter 재생성
  (yaml block-scalar 4건 포함), requires 정규화 {bins,env,system},
  superseded_by 30건 + claude-specific 2건 마킹
- validator: EXPECTED_SKILLS 227 + registry 무결성 체크 추가, README/docs 갱신
- 커밋 93ca7c7 → lidge-jun/cli-jaw-skills main 푸시, cli-jaw 부모 포인터 2b9c7b51
  → bitkyc08-arch/cli-jaw dev 푸시
- 원격 검증: raw fetch로 231 entries / truncated 0 / entry·superseded_by 필드 확인
- 기존 test_cjk_regression 실패는 부모 커밋에서도 동일 (사전 존재, 스코프 밖)

## WP3 — cxc skill search (codexclaw 리포)

- 신규 `components/skill-search` (zero-dep): search/show 2 커맨드, 4 소스
  (jaw raw registry 1차, hermes raw catalog, clawhub tree API 1콜, gh 명시시)
- 키워드 스코어러 (superseded/claude-specific x0.5 강등, 숨김 없음),
  1h TTL 캐시 + stale fallback (CODEXCLAW_HOME 규약), 어댑터 프리앰블
  (claude→codex exec 치환, cxc-dev 우선)
- 라이브 스모크: telegram/tdd/hermes notes 검색, show 프리앰블 부착 확인

## 잔여/후속 (로드맵)

- clawhub.ai 레지스트리 API 연동 (tree API 대체) — clawhub 스킬이 13개라 급하지 않음
- cli-jaw 랭킹 코드의 superseded_by 소비 (cli-jaw 쪽 작업; codexclaw 검색기는 이미 소비)
- friction.jsonl 파이프라인 복원 여부 — 2주 관찰 후 판단 (Stop hook escalate 조언은
  현재 무해하게 무음)
- 021 외부 import 후보 18종 — 검색으로 로드는 이미 가능; 상시 노출이 필요해지면
  그때 개별 판단

## 성공 기준 대조 (010)

- [x] active 33종 보존 (드랍 0; superseded_by는 dormant에만)
- [x] 중복군 병합 근거 기록 (020 + registry 마킹)
- [x] SKILL.md 없는 유령 0 (entry 승격으로 전부 해소)
- [x] 외부 후보 목록 + 라이선스 (021; vendoring 안 하므로 부담 소멸)
- [x] `cxc skill search` 정제된 registry에서 동작 (라이브 스모크)
