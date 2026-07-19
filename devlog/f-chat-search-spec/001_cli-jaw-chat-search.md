# 001 — cli-jaw Chat Search 구현 스펙

Source: `cli-jaw/src/routes/messages.ts` + `cli-jaw/src/core/db.ts`

## API

```
GET /api/messages/search?q=<query>&limit=20&days=&recent=&context=0
```

## DB Schema (jaw.db, better-sqlite3)

messages 테이블:
- id INTEGER PRIMARY KEY
- role TEXT (user|assistant|tool)
- content TEXT
- cli TEXT (nullable)
- model TEXT
- tool_log TEXT (nullable, sanitized JSON array)
- trace_run_id TEXT
- turn_id TEXT
- working_dir TEXT
- session_id TEXT
- created_at TEXT (ISO timestamp, auto)

## Search Query (prepared statement)

```sql
SELECT id, role, content, cli, tool_log, created_at,
  CASE WHEN content LIKE '%' || $q || '%' THEN 'content' ELSE 'tool_log' END AS match_field
FROM messages
WHERE (content LIKE '%' || $q || '%' OR tool_log LIKE '%' || $q || '%')
  AND session_id = $session_id
  AND ($days IS NULL OR created_at >= datetime('now', '-' || $days || ' days'))
  AND ($recent IS NULL OR id >= COALESCE(
    (SELECT id FROM messages WHERE session_id = $session_id ORDER BY id DESC LIMIT 1 OFFSET $recent), 0))
ORDER BY id DESC
LIMIT $limit
```

## Context Query

```sql
SELECT id, role, content, cli, created_at
FROM messages
WHERE session_id = $session_id
  AND id BETWEEN ($target_id - $range) AND ($target_id + $range)
ORDER BY id ASC
```

## Time-Window Search (memory context 용)

```sql
SELECT id, role, content, cli, created_at, session_id
FROM messages
WHERE created_at BETWEEN datetime($center, '-' || $window_hours || ' hours')
                    AND datetime($center, '+' || $window_hours || ' hours')
  AND (content LIKE '%' || $q || '%' OR ($q2 IS NOT NULL AND content LIKE '%' || $q2 || '%'))
ORDER BY created_at DESC
LIMIT $limit
```

## 핵심 설계 포인트

1. **No FTS**: jaw.db의 messages 검색은 순수 LIKE — 충분히 빠름 (SQLite + WAL)
2. **session_id scoped**: 현재 active session만 검색 (getActiveChatSession)
3. **match_field**: content와 tool_log 구분 — UI에서 다르게 표시
4. **days/recent 필터**: 시간 OR 최근 N개 메시지로 범위 제한
5. **context range**: id 범위로 주변 메시지 바로 가져옴

## codexclaw 적용 시 차이점

- codexclaw은 jaw.db 없음 → Codex rollout JSONL이 원본
- 이미 sidecar FTS index 있음 (recall/index.sqlite) → LIKE보다 훨씬 빠름
- session_id 대신 thread_id + cwd 기반 스코핑
- tool_log 대신 rollout의 tool call/output 라인이 match_field='tool_log'
