# 009 — 구현 계획 (Implementation Plan)

## Phase 1: Unified Search CLI (가장 빠른 ROI)

### Scope
- `cxc search "<query>"` 커맨드 추가
- chat + memory 통합 결과, CWD 자동 스코핑
- 기존 `chat-search.ts` + `memory-search.ts` 위에 thin merge layer

### Tasks
1. `unified-search.ts` 신규 파일 (UnifiedHit 타입, merge logic, scoring)
2. `cli.ts` 확장: `search` 커맨드 라우팅 추가
3. `format.ts` 확장: unified 결과 포맷
4. 테스트: `test/unified-search.test.ts`

### Estimated: 2-3시간 (구현 + 테스트)

---

## Phase 2: Auto-Inject Hook

### Scope
- session-start 시 CWD 최근 작업 요약 자동 inject
- post-compact 시 re-inject

### Tasks
1. `auto-inject.ts` 신규 파일 (summary builder)
2. `hook.ts` 수정: session-start/post-compact에서 auto-inject 호출
3. Budget-capped output (500 chars)
4. Graceful degradation (index 없으면 스킵)

### Estimated: 1-2시간

---

## Phase 3 (Optional): Memory FTS Index

### Scope
- memory-search를 paragraph scan에서 FTS index로 업그레이드
- cli-jaw의 chunks_fts + chunks_trigram 패턴 차용

### Tasks
1. `memory-index-db.ts` 신규: memory chunk indexing
2. `memory-search.ts` 수정: index가 있으면 FTS 경로, 없으면 scan fallback
3. reindex 커맨드: `cxc memory index [--rebuild]`

### Estimated: 3-4시간

---

## Phase 4 (Optional): Embedding

### Scope
- semantic search 추가 (FTS gap: 다른 단어 같은 의미)
- gemini or local provider (비용 0)

### Estimated: 4-6시간 (provider integration + vec store)

---

## 우선 구현 순서

```
Phase 1 (unified CLI) ──→ Phase 2 (auto-inject) ──→ Phase 3 (memory FTS)
                                                            ↓
                                                    Phase 4 (embedding, optional)
```

## Source 참조 경로

| 참조 | 경로 |
|------|------|
| codexclaw recall | `plugins/codexclaw/components/recall/src/` |
| cli-jaw chat search | `../cli-jaw/src/routes/messages.ts` |
| cli-jaw memory index | `../cli-jaw/src/memory/indexing.ts` |
| cli-jaw memory runtime | `../cli-jaw/src/memory/runtime.ts` |
| cli-jaw federation | `../cli-jaw/src/manager/memory/` |
| cli-jaw dashboard routes | `../cli-jaw/src/manager/routes/dashboard-memory.ts` |
| cli-jaw embedding | `../cli-jaw/src/manager/memory/embedding/` |

## Decision Log

- Federation (방향 B): SKIP — Codex single-home, 불필요
- Dashboard UI (방향 D): DEFER — CLI + MCP tool이면 충분
- Embedding (방향 E): Phase 4, optional
- **방향 C + A 가 즉시 구현 대상**
