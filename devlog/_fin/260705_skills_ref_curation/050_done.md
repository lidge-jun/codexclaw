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

## 잔여/후속 (로드맵) — WP4 갱신 (2026-07-05)

- [x] clawhub.ai 레지스트리 API 연동 — WP4에서 완료. tree API 폐기,
  `/api/v1/search` 마켓플레이스 검색 (무인증, 서버 랭킹) + packages file 엔드포인트로
  body 로드. repo 13개 대신 마켓플레이스 전체가 검색 대상.
- [x] cli-jaw superseded_by 소비 — WP4에서 완료 (gpt-5.5 worker, cli-jaw
  e86b1091). 프롬프트는 lookup-only 가드 유지(설계 의도 존중), 대신
  `skill list --inactive`가 `→ superseded by <target>` / `[claude-specific]`
  주석 + 후순위 정렬, `skill info`가 두 필드 표시. push 완료.
- [ ] friction.jsonl 파이프라인 복원 여부 — 2주 관찰 후 판단 (Stop hook escalate
  조언은 현재 무해하게 무음)
- [ ] 021 외부 import 후보 18종 — 검색으로 로드는 이미 가능; 상시 노출이
  필요해지면 그때 개별 판단

### WP4 기록

P: clawhub API + cli-jaw 소비 조사 (gpt-5.5 researcher — clawhub.ai openapi 발견,
   cli-jaw 가드 테스트가 프롬프트 주입을 의도적으로 금지함을 확인 → CLI 주석으로 전환)
A: 리서치 검증 (curl 라이브 확인 포함)
B: codexclaw clawhub 어댑터 교체 + cli-jaw skill.ts 주석 (worker 병렬)
C: skill-search 18 테스트 green, 전체 687 green, 라이브 스모크 2건, cli-jaw
   worker evidence receipt (subagent-stop hook 검증 통과)
D: 커밋 2건 (codexclaw + cli-jaw e86b1091) / cli-jaw push 완료

## 성공 기준 대조 (010)

- [x] active 33종 보존 (드랍 0; superseded_by는 dormant에만)
- [x] 중복군 병합 근거 기록 (020 + registry 마킹)
- [x] SKILL.md 없는 유령 0 (entry 승격으로 전부 해소)
- [x] 외부 후보 목록 + 라이선스 (021; vendoring 안 하므로 부담 소멸)
- [x] `cxc skill search` 정제된 registry에서 동작 (라이브 스모크)
