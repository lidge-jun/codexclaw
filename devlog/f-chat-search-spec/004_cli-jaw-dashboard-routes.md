# 004 — cli-jaw Dashboard Memory Routes 스펙

Source: `cli-jaw/src/manager/routes/dashboard-memory.ts`

## Router 구조

`createDashboardMemoryRouter(opts)` — Express router, 127.0.0.1 origin 검증.

Options:
- managerPort: number
- scanSupplier: () => ScanItemForFederation[]
- embeddingConfig: () => EmbeddingConfig | null
- vecStore: () => VecStore | null
- dashboardHome: string

## Endpoints

### GET /instances
검색 가능한 인스턴스 목록 반환.

### GET /search
```
?q=<query>&instance=<id,...>&limit=50&offset=0&mode=fts5|embedding|hybrid
```

Mode routing:
- `fts5` (default): `searchFederated()` → FTS5 + trigram per instance
- `embedding`: provider.embed(query) → vecStore.searchScoped() → vector similarity
- `hybrid`: FTS5 + embedding → `hybridMerge()` RRF

Response: `{ ok, mode, hits, total, offset, hasMore, warnings, instancesQueried, instancesSucceeded }`

### GET /chat/search
```
?q=<query>&instance=<id,...>&limit=50&days=N
```

`searchChatFederated()` → 모든 인스턴스 jaw.db 횡단 검색.
Response: `{ ok, hits, warnings, instancesQueried, instancesSucceeded }`

### GET /read
```
?instance=<id>&path=<relpath>
```

Security:
- realpath resolution → symlink 거부
- memRoot 밖 escape 거부
- .md 확장자만 허용
- 256KB 상한

### GET /embed-config
현재 embedding 설정 반환 (apiKey masking).

### POST /embed-config
embedding.json 업데이트. optional `test: true`로 connection test 포함.

### POST /reindex
모든 인스턴스 chunk → embedding sync.

### GET /embed-state
embedding pipeline 상태: 설정 유효성, vec 개수, source chunks 대비 coverage.

### GET /embed-estimate
reindex 비용 추정: chunks, tokens, 예상 시간, 예상 비용 (provider별 단가).

### GET /reindex-stream (SSE)
streaming reindex progress: `{ instanceId, done, total }` → `{ complete, results }`.

## codexclaw 적용 노트

Dashboard route 패턴은 codexclaw에 그대로 적용하기에는 over-engineering:
- Codex에 web dashboard 서버를 따로 띄우는 건 무거움
- 대신 **CLI 기반 unified search** + 선택적 **Codex plugin MCP tool** 이 더 적합
- MCP tool로 노출하면 Codex 에이전트가 직접 검색 → dashboard 없이도 같은 효과
