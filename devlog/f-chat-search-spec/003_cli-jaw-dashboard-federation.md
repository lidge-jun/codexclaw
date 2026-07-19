# 003 — cli-jaw Dashboard Federation 구현 스펙

Source: `cli-jaw/src/manager/memory/`

## 아키텍처 개요

cli-jaw는 하나의 머신에서 여러 인스턴스(포트)를 띄울 수 있음.
Dashboard는 이 모든 인스턴스를 횡단 검색하는 federated search 제공.

## Instance Discovery (`instance-discovery.ts`)

```typescript
interface InstanceMemoryRef {
    instanceId: string;       // port number as string
    homePath: string;         // ~/.cli-jaw (or per-port home)
    homeSource: 'profile' | 'default-port';
    port: number;
    label: string | null;
    dbPath: string;           // structured memory index.sqlite
    hasDb: boolean;
    chatDbPath: string;       // jaw.db (messages)
    hasChatDb: boolean;
}
```

Discovery flow:
1. `loadDashboardRegistry()` → registry.json에서 등록된 인스턴스 목록
2. 각 인스턴스의 homePath 결정 (profile override or port-based default)
3. index.sqlite + jaw.db 존재 여부 probe
4. blacklist 패턴 제외 (smoke test, backup 등)

## Memory Federation (`federation.ts`)

```typescript
function searchFederated(query: string, opts: FederatedSearchOptions): FederatedSearchResult
```

- 각 instance의 index.sqlite를 read-only로 열고
- `searchIndexReadOnly(dbPath, query)` 호출 (BM25 + trigram + LIKE)
- 결과를 RRF로 cross-instance ranking
- schema 호환성 probe (hasSynonyms, hasTrigram, chunksColumns)
- 에러/경고 종류: missing_db, open_failed, query_failed, corrupt, native_module_mismatch, schema_mismatch

## Chat Federation (`chat-federation.ts`)

```typescript
function searchChatFederated(query: string, opts: ChatFederatedSearchOptions): ChatFederatedResult
```

- 각 instance의 jaw.db를 read-only로 열고
- word-split → LIKE OR 조건 (content + tool_log)
- days 필터 옵션
- perInstanceLimit 계산: `ceil(globalLimit / instances) * 2`
- 전체 결과를 created_at DESC로 정렬 후 globalLimit 적용

## Result Reranking (`result-rerank.ts`)

```typescript
function rerankAcrossInstances(
    perInstance: Array<{ ref: InstanceMemoryRef; hits: SearchHit[] }>,
    opts: { perInstanceLimit: number; globalLimit: number }
): FederatedHit[]
```

RRF (k=60):
- 각 인스턴스에서 perInstanceLimit만큼 가져옴
- rank 기반 score: `1 / (k + rank)`
- tie-breaker: instanceId → relpath → source_start_line
- globalLimit으로 최종 trim

## Hybrid Search (`hybrid-search.ts`)

```typescript
function hybridMerge(opts: { ftsHits, vecHits, limit, k? }): HybridHit[]
```

- FTS hits에 RRF score 부여 (rank 기반)
- Vec hits에 RRF score 부여 (rank 기반)
- 동일 chunk (instanceId:relpath:startLine) key로 score 합산
- hybridScore DESC 정렬

## codexclaw 적용 가능성

Codex는 single-home (`~/.codex`) 런타임이라 multi-instance federation은 불필요.
하지만 federation 패턴 자체는 "chat search + memory search를 통합 ranking" 하는 데
재사용 가능:
- chat hits (from recall index) + memory hits (from memories/) → RRF merge
- 이것이 Unified Search (방향 C)의 핵심 구현 아이디어
