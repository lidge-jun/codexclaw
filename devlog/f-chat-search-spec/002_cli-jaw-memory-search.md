# 002 — cli-jaw Memory Search 구현 스펙

Source: `cli-jaw/src/memory/indexing.ts` + `cli-jaw/src/memory/runtime.ts` + `cli-jaw/src/routes/jaw-memory.ts`

## API

```
GET /api/jaw-memory/search?q=<query>
```

## 저장소 구조 (advanced memory, ~/.cli-jaw/memory/structured/)

```
structured/
├── profile.md          (kind: profile)
├── shared/             (kind: shared)
│   └── soul.md
├── episodes/           (kind: episode)
│   └── digests/        (kind: episode-cold)
├── semantic/           (kind: semantic)
├── procedures/         (kind: procedure)
└── sessions/           (kind: sessions)
```

## Indexing (index.sqlite, better-sqlite3)

### Schema

```sql
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    relpath TEXT NOT NULL,
    kind TEXT NOT NULL,
    home_id TEXT NOT NULL DEFAULT '',
    source_start_line INTEGER NOT NULL,
    source_end_line INTEGER NOT NULL,
    source_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
);
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    content, relpath UNINDEXED, kind UNINDEXED,
    tokenize = 'unicode61'
);
CREATE VIRTUAL TABLE chunks_trigram USING fts5(
    chunk_id UNINDEXED, relpath UNINDEXED, body,
    tokenize = 'trigram'
);
```

### Chunking 알고리즘 (chunkMarkdown)

1. frontmatter 파싱 → meta + body 분리
2. heading (h1-h3) 단위로 split
3. 각 chunk에 메타 prefix 부착: `Source: <relpath>\nKind: <kind>\nHeader: <path>`
4. hash: `hashText(relpath:startLine:body)`

### Search 알고리즘 (searchIndexCore)

1. **CJK Detection**: query에 CJK 문자 포함 시:
   - ≥3 chars → trigram FTS MATCH
   - <3 chars → LIKE fallback

2. **Non-CJK Path**:
   - synonym expansion → word groups
   - BM25 search (chunks_fts MATCH)
   - LIKE fallback (per word)
   - trigram search (full query)
   - RRF merge (BM25 + trigram, k=60)

3. **Final scoring**: computeFinalScore (kind priority + BM25 rank)

### Kind Priority 기반 scoring

cli-jaw의 `computeFinalScore`는 BM25 raw score + kind별 보정:
- profile: 높은 우선순위
- shared: 높음
- procedure: 중간
- semantic: 중간
- episode: 낮음
- episode-cold: 가장 낮음

## Embedding 확장 (optional)

```
cli-jaw/src/manager/memory/embedding/
├── vec-store.ts      (SQLite-backed vector store)
├── provider.ts       (OpenAI/Gemini/Voyage/Vertex/local)
├── sync.ts           (chunk → embed → upsert)
├── hybrid-search.ts  (FTS5 + vector RRF merge)
├── state-machine.ts  (embedding pipeline state)
└── index.ts          (exports)
```

hybrid merge: FTS hits + vec hits → RRF (k=60) → combined score

## codexclaw 적용 시 핵심 차이

- codexclaw memory는 `~/.codex/memories/` (Codex 네이티브 구조)
  - memory_summary.md, MEMORY.md, raw_memories.md
  - rollout_summaries/*.md, extensions/, skills/
- 이미 paragraph-chunk + synonym expansion 구현됨 (memory-search.ts)
- 부족한 것: FTS5 index (현재 파일 직접 스캔), embedding layer, 통합 검색 CLI
