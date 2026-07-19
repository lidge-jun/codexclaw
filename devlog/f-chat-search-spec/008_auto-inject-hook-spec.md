# 008 — CWD Auto-Inject Hook 확장 스펙 (방향 A)

## 목표

세션 시작 or user-prompt-submit 시 현재 CWD 관련 최근 작업 맥락을 자동으로
에이전트 context에 inject. "이 프로젝트에서 뭘 했었는지" 매 세션 기억.

## 현재 Hook 동작 (hook.ts)

```typescript
// session-start: 인덱스 상태만 출력
function handleSessionStart(indexStatusLine: string): string {
    return `[codexclaw] recall: ${indexStatusLine}`;
}

// user-prompt-submit: recall trigger 판별 (현재 미구현 수준)
function handleUserPromptSubmit(payload: UserPromptSubmitPayload): string { ... }

// post-compact: 맥락 손실 경고
function handlePostCompact(): string { ... }
```

## 확장 설계

### session-start Hook 확장

```typescript
function handleSessionStart(opts: { cwd: string; indexStatusLine: string }): string {
    // 1. cwd 기반 최근 chat search (last 3일, limit 5)
    const recentWork = searchChat("", {
        cwd: opts.cwd,
        days: 3,
        limit: 5,
        noRefresh: true,  // 빠르게
    });

    // 2. memory에서 cwd 관련 항목 (rollout summaries)
    const cwdName = basename(opts.cwd);
    const memHits = searchMemory(cwdName, { limit: 3 });

    // 3. compact summary 생성
    return formatAutoInjectSummary(recentWork, memHits);
}
```

### Auto-Inject Summary Format

```
[codexclaw] Recent work in this project (last 3 days):
• [Jul 14] PR triage + item-ID hardening + release 2.7.17
• [Jul 13] bridge.ts streaming fix
• [Jul 12] codex-rs source-of-truth analysis
Recall: 5 sessions found. Use `cxc search "<query>"` for detail.
```

Budget: max 500 chars → 에이전트 context window에 부담 없이 주입.

### user-prompt-submit Hook 확장

cli-jaw의 `buildTaskSnapshot()` 패턴 차용:
- 사용자 prompt에서 키워드 추출
- memory search → 관련 chunk top-2를 context로 삽입
- 단, 이미 recall skill이 수동으로 하는 것과 중복 → 조건부 활성:
  - query가 짧거나 모호할 때만 auto-inject
  - 명시적 recall trigger일 때는 수동 flow 존중

## 구현 위치

```
components/recall/src/
├── hook.ts             ← MODIFY: session-start에 cwd context 추가
├── auto-inject.ts      ← NEW: summary builder
└── chat-search.ts      ← (기존, 호출만)
```

## 제약

- index가 아직 없으면 (첫 사용) inject 스킵 → graceful degradation
- --no-refresh로 읽어서 hook latency 최소화 (< 100ms 목표)
- compact 후에도 re-inject → post-compact hook에서 같은 로직

## cli-jaw 대응 기능

cli-jaw의 `buildTaskSnapshot(query, budget)`:
- 사용자 prompt + 최근 메시지에서 키워드 추출
- searchIndex()로 memory chunk 검색
- diversifyHits (per-kind cap)
- budget 내에서 snippet 조립
- 매 턴마다 prompt에 삽입

codexclaw 차이: Codex 런타임은 hook output을 system prompt에 한 번만 넣고
compact까지 유지. 매 턴 주입 대신 "세션 시작 + compact 후"에 집중.
