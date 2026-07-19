# 006 — cli-jaw Embedding Layer 스펙

Source: `cli-jaw/src/manager/memory/embedding/`

## 컴포넌트

### vec-store.ts
- SQLite-backed vector storage
- `searchScoped(queryVec, limit, instanceIds)` → 가까운 chunks
- `setConfig(key, value)` — 메타데이터 저장 (provider, model, lastSyncAt)
- `getConfig(key)` — 메타데이터 읽기
- 거리 계산: cosine similarity (혹은 L2)

### provider.ts
- 지원 providers: `openai`, `gemini`, `voyage`, `vertex`, `local`
- `createProvider(config)` → `{ embed(texts: string[]) → number[][] }`
- batch embedding (보통 20개 chunk/batch)

### sync.ts
- `syncAllInstances({ instances, vecStore, provider, onProgress? })`
- 각 인스턴스의 index.sqlite에서 chunks 읽기
- chunk content → provider.embed() → vecStore에 upsert
- content_hash 기반 dedup (변경된 chunk만 re-embed)

### hybrid-search.ts
- `hybridMerge({ ftsHits, vecHits, limit, k=60 })` → HybridHit[]
- 동일 chunk 식별: `instanceId:relpath:startLine`
- dual-RRF: FTS rank score + vec rank score 합산
- `hybridScore` DESC 정렬

### state-machine.ts
- `getEmbeddingState({ settings, vecStore, dashboardRunning, totalSourceChunks, lastTestResult })`
- 상태: not_configured → configured → tested → syncing → synced
- UI 표시용 상태 머신

## EmbeddingConfig 인터페이스

```typescript
interface EmbeddingConfig {
    enabled: boolean;
    provider: 'openai' | 'gemini' | 'voyage' | 'vertex' | 'local';
    model: string;
    dimensions?: number;
    apiKey?: string;
    baseUrl?: string;
    searchMode: 'fts5' | 'embedding' | 'hybrid';
}
```

## 비용 구조

| Provider | Cost/M tokens |
|----------|---------------|
| openai   | $0.02         |
| gemini   | $0 (free)     |
| voyage   | $0.02         |
| vertex   | $0.000025     |
| local    | $0            |

## codexclaw 적용 판단

Embedding layer는 nice-to-have지만 현재 즉시 필요한 것은 아님:
- codexclaw의 주 사용 패턴은 "이 CWD에서 뭘 했었지?" → keyword match로 충분
- semantic gap (다른 단어로 같은 의미 검색) 이 문제되면 그때 추가
- 우선순위: Unified CLI → Auto-inject hook → (optional) embedding
- 구현한다면 provider는 gemini (무료) or local이 적합 (비용 0)
