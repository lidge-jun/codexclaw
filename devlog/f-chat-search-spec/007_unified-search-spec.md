# 007 — Unified Search 구현 스펙 (방향 C)

## 목표

`cxc search "<query>"` 하나로 chat + memory를 통합 검색, CWD 자동 스코핑.

## CLI Interface

```
cxc search "<query>" [--cwd PATH] [--days N] [--limit N] [--source chat|memory|all]
                     [--context N] [--any] [--json] [--no-refresh]
```

Defaults:
- `--cwd`: 현재 working directory (자동)
- `--days`: 0 (전체 기간)
- `--limit`: 20
- `--source`: all (chat + memory 통합)
- `--context`: 1 (chat hits에만 적용)

## Internal Flow

```
1. query → splitQueryWords()
2. parallel:
   a. searchChat(query, { cwd, days, limit: limit*2, context, ... })
   b. searchMemory(query, { days, limit: limit*2, ... })
3. merge results:
   - chat hits → normalize to UnifiedHit { origin: 'chat', ... }
   - memory hits → normalize to UnifiedHit { origin: 'memory', ... }
4. rank: RRF-style merge (chat rank + memory rank)
   OR simpler: interleave by recency (ts-based)
5. trim to --limit
6. format output
```

## UnifiedHit 타입

```typescript
interface UnifiedHit {
    origin: 'chat' | 'memory';
    ts: string;              // ISO timestamp (chat: message ts, memory: file mtime)
    text: string;            // excerpt (chat: message, memory: chunk)
    role?: string;           // chat only
    kind?: MemoryKind;       // memory only
    relpath?: string;        // memory only
    threadId: string | null;
    title: string | null;    // thread title
    cwd: string | null;
    score: number;           // unified ranking score
}
```

## Ranking Strategy

Option A (simple, RRF-like):
```
chatScore = 1 / (60 + chatRank)
memScore  = 1 / (60 + memRank)
unified   = max(chatScore, memScore)  // 동일 thread면 합산
```

Option B (timestamp-weighted):
```
ageHours = (now - ts) / 3600000
recency  = 1 / (1 + ageHours / 168)  // 1주 half-life
score    = textRelevance * recency
```

Option C (hybrid): B를 base로, chat/memory source에 따라 weight 조절
- chat hit: weight 1.0 (가장 직접적 맥락)
- memory rollout hit: weight 0.9
- memory handbook/summary: weight 1.2 (curated = 신뢰도 높음)

**추천: Option C** — cli-jaw의 kind priority 패턴과 가장 유사하면서 실용적.

## Output Format (text)

```
[2026-07-14 15:32] (assistant) «PR triage loop» {/Users/jun/.../opencodex}
  The stripInvalidItemIds function was added to handle...
  [context: 1 before / 1 after]

[memory] rollout_summaries/2026-07-14T...md:10-12 (rollout)
  PR triage, Responses item-ID hardening, and release 2.7.17...

── 4 chat + 2 memory hits (12ms) ──
```

## 구현 위치

```
components/recall/src/
├── unified-search.ts   ← NEW: 통합 검색 로직
└── cli.ts              ← MODIFY: `cxc search` 커맨드 추가
```

## 의존성

- `chat-search.ts` (기존)
- `memory-search.ts` (기존)
- `format.ts` (확장: unified format 추가)

## 구현 난이도

LOW — 기존 두 검색 엔진 위에 thin merge layer. 핵심 로직 ~100줄.
