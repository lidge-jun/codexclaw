# 005 — Audit: Plan Review (PABCD A-phase)

- Date: 2026-07-05
- Phase: A (Audit of 000_plan.md)

---

## Audit Checklist

### Phase 1 — Implicit Expansion

- [x] 대상 6개 식별 완료
- [x] Codex-rs 소스 확인: implicit 기본값 true, Level 1만 노출, 본문 주입 없음
- [x] 토큰 비용 추정 완료 (~180 토큰, 무시 가능)
- [x] 작업 범위: openai.yaml 6파일 수정 only
- [ ] 누락 확인: `orchestrate` skill도 implicit 후보 아닌가?
  - 결론: 아님. orchestrate는 CLI 명령 (`cxc orchestrate P`) 직접 실행이라
    에이전트가 이미 pabcd/loop skill 통해 라우팅됨. 단독 implicit 불필요.

### Phase 2 — agbrowse 노출

- [x] agbrowse 설치 확인: `/Users/jun/.local/bin/agbrowse`
- [x] 현재 노출 위치: search SKILL.md (Tier 2 ladder) + helper script
- [x] 해법: dev SKILL.md에 한 줄 추가
- [ ] 추가 고려: search implicit 승격으로 이중 노출 → OK (중복 아닌 보완)

### Phase 3 — Hook Diet

- [x] 17개 전수 조사 완료 (004_hook_audit.md)
- [x] KEEP 8 / REMOVE 9 분류 완료
- **수정 발견**: `session-start-injecting-project-rules` 재평가 필요

#### session-start-injecting-project-rules 재평가

소스 확인 결과 (`rules.ts`):
1. `.codexclaw/rules/*.md` 파일들을 읽어서 concatenate + dedup + 8000자 cap
2. 없으면 fallback으로 프로젝트 루트 `AGENTS.md`를 읽음
3. `additionalContext` envelope으로 SessionStart에 주입

**Codex 네이티브 AGENTS.md 주입과의 차이점**:
- Codex 네이티브: 프로젝트 루트 AGENTS.md만 읽음
- 이 hook: `.codexclaw/rules/*.md` (다중 파일) + AGENTS.md fallback

**현재 실제 상태**:
- `.codexclaw/rules/` 디렉토리가 존재하지 않음
- 따라서 현재는 AGENTS.md fallback만 작동 → Codex 네이티브와 중복

**결정**:
- 즉시 제거 가능 (현재 중복 상태)
- 단, `.codexclaw/rules/` 기능을 활용할 계획이 있다면 유지해야 함
- **Plan 수정**: REMOVE 유지하되, "향후 `.codexclaw/rules/` 필요 시 복원"을
  risk mitigation에 추가

### Phase 4 — Dormant Pool

- [x] Option A/B/C 평가 완료
- [x] cli-jaw skills_ref 경로 확인
- [x] registry.json 스키마 파악
- [ ] 미결정: 어떤 카테고리의 스킬을 우선 catalog에 올릴지
  - 이건 Phase 4 진입 시 결정해도 됨 (optional phase)

---

## Plan Amendments (Audit 결과)

### Amendment 1: project-rules hook 제거 확정

004_hook_audit.md의 REMOVE #5 "확인 사항" 해소:
- hook이 `.codexclaw/rules/*.md` + AGENTS.md fallback을 읽는 것 확인
- 현재 rules 디렉토리 부재 → 실질적으로 Codex 네이티브와 100% 중복
- 제거 확정. rules 기능이 나중에 필요하면:
  a) hook을 복원하거나
  b) `dev` skill에서 "세션 시작 시 .codexclaw/rules/ 확인" 규칙으로 대체

### Amendment 2: REMOVE hook 최종 9개 확정 (변동 없음)

원래 plan대로 9개 제거. 재평가해도 결론 동일.

### Amendment 3: Risk table 추가 항목

| Risk | Severity | Mitigation |
|------|----------|------------|
| .codexclaw/rules/ 기능 나중에 필요 | Low | hook 파일을 _deprecated/로 이동 (삭제X), 복원 용이 |

---

## Audit 종합 판정

Plan은 **실행 가능** (Go). 누락 사항 없음. 수정 사항 반영 후 B-phase 진입 가능.

### 실행 우선순위 (단계 간 의존성)

```
Phase 1 (implicit 확장) ← 독립, 즉시 가능
Phase 2 (agbrowse 노출) ← Phase 1과 병행 가능
Phase 3 (hook diet)     ← Phase 1 완료 후 (recall/pabcd implicit이 선행조건)
Phase 4 (dormant pool)  ← Phase 1-3 완료 후, optional
```

Phase 1+2를 먼저 실행하고, implicit 확인 후 Phase 3 진행이 안전한 순서.
