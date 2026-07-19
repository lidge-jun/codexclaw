# 005 — codexclaw Recall 기존 구현 상세

Source: `codexclaw/plugins/codexclaw/components/recall/src/`

## 파일 구조

```
components/recall/src/
├── cli.ts             — entry point: cxc chat search / cxc memory search / cxc chat index
├── chat-search.ts     — dual-path: sidecar FTS index OR raw JSONL scan
├── memory-search.ts   — paragraph-chunk + stage1_outputs search
├── index-db.ts        — sidecar index schema (msgs, msgs_fts, msgs_tri)
├── index-search.ts    — FTS query execution (trigram ≥3, LIKE <3, JOIN files)
├── rollout.ts         — JSONL parser + meta reader + file lister
├── threads-db.ts      — Codex state.db thread metadata loader
├── paths.ts           — CODEX_HOME/CODEXCLAW_HOME resolution
├── format.ts          — text/json output formatters
├── synonyms.ts        — curated ko/en synonym expansion
├── hook.ts            — Codex hook integration (session-start, user-prompt-submit)
├── sqlite.ts          — better-sqlite3 wrapper (read-only / read-write)
└── ingest.ts          — rollout JSONL → index.sqlite ingest pipeline
```

## Sidecar Index Schema (`~/.codexclaw/recall/index.sqlite`)

```sql
-- meta: schema_version, last_ingest_at
CREATE TABLE files (
    path TEXT PRIMARY KEY,
    mtime_ms INTEGER, size INTEGER,
    thread_id TEXT, cwd TEXT, source TEXT, date TEXT,
    bytes_ingested INTEGER, last_ord INTEGER
);
CREATE TABLE msgs (
    id INTEGER PRIMARY KEY,
    path TEXT, ord INTEGER, ts TEXT, role TEXT,
    match_field TEXT, synthetic INTEGER, text TEXT
);
CREATE VIRTUAL TABLE msgs_fts USING fts5(text, content='msgs', content_rowid='id', tokenize='unicode61');
CREATE VIRTUAL TABLE msgs_tri USING fts5(text, content='msgs', content_rowid='id', tokenize='trigram');
-- triggers: msgs_ai (INSERT), msgs_ad (DELETE) keep FTS in sync
```

## Chat Search Flow (chat-search.ts)

1. `searchChat(query, opts)` entry
2. Index path 시도:
   - `openIndex(path)` or `openIndexReadOnly(path)`
   - optional `ingest(home, db, 0)` — refresh changed files
   - `queryIndex(db, opts)` — FTS query
   - fallback: scan path (JSONL 직접 읽기)
3. Scan path:
   - `listRolloutFiles(home, days)` — date-directory pruning
   - per-file: meta read → source/cwd filter → content read → word match
   - contextWindow() for --context

## Index Search Flow (index-search.ts)

```sql
SELECT m.id, m.path, m.ord, m.ts, m.role, m.match_field, m.text,
    f.thread_id, f.cwd, f.source
FROM msgs m JOIN files f ON f.path = m.path
WHERE <word conditions> AND <filters>
ORDER BY m.ts DESC LIMIT ?
```

Word condition per word:
- `[...word].length >= 3` → `m.id IN (SELECT rowid FROM msgs_tri WHERE msgs_tri MATCH ?)`
- shorter → `lower(m.text) LIKE ? ESCAPE '\\'`

Filters: synthetic, match_field, role, ts >= cutoff, source, cwd (prefix match).

## Memory Search Flow (memory-search.ts)

1. `searchMemory(query, opts)` entry
2. `~/.codex/memories/` 하위 모든 .md 파일 scan
3. paragraph chunking (heading 혹은 blank-line split)
4. word group matching (synonym expanded)
5. stage1_outputs 테이블 추가 검색 (memories_N.sqlite)
6. Scoring: textScore (coverage + density + phrase bonus) + kindPriority + recencyBoost
7. rankAndTrim (per-file cap 2, limit)

## Hook Integration (hook.ts)

- `session-start` → recall index status line 출력
- `user-prompt-submit` → 사용자 query에서 recall hint 여부 판단
- `post-compact` → compact 후 맥락 손실 경고

## 현재 한계

1. **Chat + Memory 분리됨**: 두 결과를 합쳐서 보는 unified view 없음
2. **CWD auto-scope 미약**: `--cwd` 있지만 수동 지정 필요
3. **세션 시작 시 자동 context inject 없음**: hook이 status만 출력, snapshot 미포함
4. **Dashboard/UI 없음**: CLI only
5. **Embedding 없음**: pure text matching (FTS + LIKE + synonym)
