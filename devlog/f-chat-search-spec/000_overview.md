# f-chat-search-spec — Feature Spec: CWD-Scoped Session Search

Date: 2026-07-15
Status: research phase

## Motivation

codexclaw sessions 간 작업 맥락 전달이 안 됨. cli-jaw는 chat search / memory search /
dashboard federation 기능이 잘 갖춰져 있어서 과거 세션에서 무엇을 했는지 즉시 검색 가능.
codexclaw에도 `cxc chat search` / `cxc memory search`가 이미 존재하지만 현재 CWD 안
전체를 더 공격적으로 서치할 수 있는 통합 인터페이스가 필요.

## 비교 대상: cli-jaw의 검색 아키텍처

### 1. Chat Search (messages table, per-instance jaw.db)
- LIKE 기반 word match (`content LIKE '%word%' OR tool_log LIKE '%word%'`)
- session_id scoped
- 날짜 필터 (`datetime('now', '-N days')`)
- match_field: content | tool_log
- 결과: id, role, content, cli, created_at

### 2. Memory Search (indexed structured markdown, index.sqlite)
- FTS5 (`chunks_fts`, BM25 ranking) + trigram (`chunks_trigram`, CJK-capable)
- markdown file -> chunk -> index
- hybrid: BM25 + trigram RRF (Reciprocal Rank Fusion)
- kind priority: profile > shared > procedure > semantic > episode
- recency boost: half-life decay

### 3. Dashboard Federation (multi-instance)
- `instance-discovery.ts`: registry-based home dir resolution
- `federation.ts`: 모든 인스턴스의 index.sqlite를 cross-search
- `chat-federation.ts`: 모든 인스턴스의 jaw.db를 cross-search
- `result-rerank.ts`: RRF로 cross-instance ranking
- `hybrid-search.ts`: FTS5 + embedding vector RRF merge

### 4. Dashboard Memory Routes
- `GET /api/dashboard/memory/search`: FTS5 / embedding / hybrid 모드
- `GET /api/dashboard/memory/chat/search`: 채팅 메시지 federated 검색
- `GET /api/dashboard/memory/read`: instance별 memory file 읽기
- `GET /api/dashboard/memory/instances`: 검색 가능 인스턴스 목록
- `POST /api/dashboard/memory/reindex`: embedding re-sync

## codexclaw 기존 검색 아키텍처 (cxc-recall)

### Chat Search (`components/recall/src/chat-search.ts`)
- Codex rollout JSONL (`~/.codex/sessions/`) 스캔 or 사이드카 FTS index
- 인덱스: `~/.codexclaw/recall/index.sqlite`
  - `msgs_fts` (unicode61) + `msgs_tri` (trigram) — external-content FTS5
  - auto-refresh on query (ingest changed files)
- `--days N` (default 7, 0=all), `--cwd PATH`, `--source main|subagent|all`
- `--context N` 주변 메시지 포함

### Memory Search (`components/recall/src/memory-search.ts`)
- `~/.codex/memories/` 아래 markdown 파일 paragraph-chunk scan
- stage1_outputs (memories_N.sqlite) 도 검색
- synonym expansion (ko/en curated)
- kind priority + recency boost (half-life decay) 방식 — cli-jaw와 유사

## Gap Analysis: 뭐가 부족한가

| 기능 | cli-jaw | codexclaw | Gap |
|------|---------|-----------|-----|
| 전체 이력 FTS | ✅ jaw.db + index.sqlite | ✅ index.sqlite | 동등 |
| CWD scoped search | ✅ session working_dir | ✅ --cwd 플래그 | 동등 |
| Multi-instance federation | ✅ dashboard registry | ❌ single home | GAP |
| Embedding hybrid search | ✅ vec-store + RRF | ❌ FTS only | GAP |
| Dashboard UI | ✅ web dashboard | ❌ CLI only | GAP |
| Real-time auto-inject | ✅ task snapshot per turn | ❌ hook only | 부분 |
| CWD 전체 자동 서치 | ❌ (수동) | ❌ | BOTH LACK |

## 구현 방향 후보

A. **CWD-Scoped Auto-Search on Session Start**: 세션 시작 시 현재 cwd의 최근
   작업 맥락을 자동으로 inject (recall hook 확장)

B. **Federation Layer**: codexclaw도 multi-home 검색 (Codex는 보통 single-home이라
   우선순위 낮음)

C. **Unified Search CLI**: `cxc search "<query>"` — chat + memory 통합 결과,
   cwd 기본 스코프, 결과 ranking 통합

D. **Dashboard/Web UI**: browser-based search + read (cli-jaw dashboard 처럼)

E. **Embedding Search**: local/remote embedding 기반 semantic search 추가

## 추천 우선순위

1. **C (Unified Search)** — 가장 실용적, 기존 인프라 위에 바로 구축 가능
2. **A (Auto-Inject)** — hook 확장으로 세션마다 cwd context를 바로 삽입
3. **D (Dashboard)** — 시각적 탐색, 하지만 구현 비용 높음
4. **E (Embedding)** — semantic gap 커버, 하지만 provider 의존성
5. **B (Federation)** — Codex single-home에서는 우선순위 가장 낮음
