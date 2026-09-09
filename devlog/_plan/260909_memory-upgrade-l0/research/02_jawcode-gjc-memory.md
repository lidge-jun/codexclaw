# jawcode / gjc(gajae-code) 메모리·컨텍스트 시스템 분석

조사일 2026-09-09. 대상 `/Users/jun/Developer/new/700_projects/jawcode` (이하 JWC),
비교 기준은 로컬에 벤더링된 gjc 원본 `devlog/_gjc_chase/gajae-code` (이하 GJC).

## 0. 근거 소스와 한계

gjc 원본을 npm/github에서 받을 필요는 없었다. 전체 소스가 이미 로컬에 있다.

| 소스 | 경로 | 성격 |
|---|---|---|
| GJC 원본 트리 | `devlog/_gjc_chase/gajae-code/` | `package.json` name `gajae-code`, `packages/*` 전체 소스 존재 |
| JWC 현행 트리 | `packages/`, `crates/` | fork 후 실제 코드 |
| fork 델타 문서 | `structure/40_fork-delta.md` | 밴드별 변경 요약 |
| 저장소 계약 문서 | `structure/22_session_storage.md` | 경로·스키마·주입 레일 정본 |
| 밴드 스냅샷 | `struct_har/gjc_origin/070_memory/`, `struct_har/jwc_patched/070_memory/` | 변경 전/후 대조 |

**중요한 한계 하나.** 벤더링된 GJC 스냅샷은 fork 시점 고정본이 아니라 upstream 추적본이다.
`gajae-code` 트리 mtime은 2026-07-09, JWC `packages/` 는 2026-06-26이고
`struct_har/gjc_origin/070_memory/01_overview.md:3` 는 upstream 기준 커밋을
`f0a8a3eb6e619392af4965273c3cf95c3faf4345` 로 적는다.
따라서 diff는 **양방향**이다. GJC에만 있는 코드가 전부 "jwc가 버린 것"은 아니고,
fork 이후 upstream이 새로 만든 것도 섞여 있다. 아래에서 이 둘을 구분해 표기한다.
어느 쪽인지 커밋으로 확정하지 못한 항목은 (unknown) 으로 남겼다.

---

## 1. GJC 원본의 메모리/세션 저장 구조

### 1.1 디스크 레이아웃

config root 이름만 다르고 구조는 동일하다.

```
GJC:  packages/utils/src/dirs.ts:23   export const CONFIG_DIR_NAME: string = ".gjc";
JWC:  packages/utils/src/dirs.ts:26   export const CONFIG_DIR_NAME: string = ".jwc";
```

JWC는 env override를 3단으로 유지해 gjc/pi 시절 홈을 그대로 읽는다
(`packages/utils/src/dirs.ts:119`):

```ts
return process.env.JWC_CONFIG_DIR ?? process.env.GJC_CONFIG_DIR ?? process.env.PI_CONFIG_DIR ?? CONFIG_DIR_NAME;
```

| 저장소 | 경로 | 근거 |
|---|---|---|
| 세션 JSONL | `~/.jwc/agent/sessions` | `packages/utils/src/dirs.ts:421` `getSessionsDir` |
| 메모리 아티팩트 | `~/.jwc/agent/memories` (state dir) | `packages/utils/src/dirs.ts:456` `getMemoriesDir` |
| 메모리 DB | `agent.db` (settings/auth와 **같은** DB) | `memories/index.ts` 가 `getAgentDbPath(agentDir)` 를 `openMemoryDb` 에 넘김 |
| prompt history | `~/.jwc/agent/history.db` (FTS5) | `structure/22_session_storage.md` 경로표 |

프로젝트별 격리는 cwd 인코딩 디렉터리다 (`memories/index.ts:1089-1096`):

```ts
export function getMemoryRoot(agentDir: string, cwd: string): string {
	return path.join(getMemoriesDir(agentDir), encodeProjectPath(cwd));
}
function encodeProjectPath(cwd: string): string {
	return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}
```

### 1.2 메모리 DB 스키마 (GJC 원본)

`devlog/_gjc_chase/gajae-code/packages/coding-agent/src/memories/storage.ts:47-88` 에서 3테이블.

| 테이블 | 역할 |
|---|---|
| `threads` | id, updated_at, rollout_path, cwd, source_kind |
| `stage1_outputs` | thread별 raw_memory, rollout_summary, rollout_slug |
| `jobs` | kind/job_key/status/worker/lease/retry/watermark |

phase2 잡 키는 `global:${cwd}` 라서 cwd 단위로 격리된다.

### 1.3 쓰기 파이프라인 — 2단 배치

`memories/index.ts:171-180` (JWC 현행, GJC도 동일 계열):

```ts
async function runMemoryStartup(options: {...}): Promise<void> {
	await runPhase1(options);
	await runPhase2(options);
	await options.session.refreshBaseSystemPrompt?.();
}
```

- **Phase 1 (스레드별 추출)**: 세션 `*.jsonl` 스캔 → `upsertThreads` → `claimStage1Jobs` 로
  원자적 클레임 → 모델 호출 → `stage1_outputs` upsert → global watermark enqueue.
  현재 스레드는 제외한다 (`index.ts:190` `getSessionId()` 를 `collectThreads` 에 전달).
- **Phase 2 (cwd별 통합)**: `listStage1OutputsForGlobal` → consolidation 모델 →
  `MEMORY.md` / `memory_summary.md` 파일 산출 (`index.ts:793-794`).

대상 필터 기본값 (`memories/memory-config.ts:46-64`): idle ≥12h, ≤30d, startup당 최대 64 rollout,
stage1 동시성 8, 리스 120s.

**트리거가 startup 단 하나다.** 타이머도, 세션 종료 훅도, 토큰 임계 트리거도 없다
(`structure/22_session_storage.md` §쓰기 경로). 이건 GJC/JWC 공통 제약이다.

### 1.4 읽기 경로 — 요약 1파일 주입

GJC 원본의 주입은 `memory_summary.md` 파일 하나를 시스템 프롬프트 꼬리에 붙이는 게 전부다.
`memories/index.ts:120-144`:

```ts
const summaryPath = path.join(memoryRoot, "memory_summary.md");
...
const truncated = truncateByApproxTokens(summary, cfg.summaryInjectionTokenLimit);
```

기본 5000 토큰 캡 (`memory-config.ts` `summaryInjectionTokenLimit: 5_000`).
`struct_har/gjc_origin/070_memory/02_logic_changes.md:5` 도 같은 말을 한다:
"gjc memories: startup·`memory_summary.md` 주입".

즉 **GJC 원본에는 쿼리 기반 검색 주입이 없다.** 매 턴 프롬프트에 맞춰 골라 넣는 층이 없고,
세션 시작 시 고정된 요약 한 덩이만 들어간다.

### 1.5 백엔드 추상화

GJC도 백엔드 인터페이스는 이미 갖고 있었다
(`devlog/_gjc_chase/gajae-code/packages/coding-agent/src/memory-backend/types.ts`):

```ts
export type MemoryBackendId = "off" | "local" | "hindsight";
```

`beforeAgentStartPrompt?(session, promptText)` 훅도 GJC `types.ts:63` 에 이미 존재한다.
다만 GJC에서 이 훅을 구현하는 건 `hindsight` (원격 백엔드)뿐이고,
`local-backend.ts` 는 구현하지 않는다. 이 사실이 다음 절의 핵심이다.

---

## 2. JWC가 바꾼 부분과 이유

`structure/40_fork-delta.md:261-265` §070 — Memory 가 요약 정본이다:

> - jwc: memories startup stage1→phase2; 주입 `memory_summary.md` + (local) Task Snapshot·`local-query`/`memory-fts` (**99.01** 마감·테스트·문서 동기화 중).
> - cli-jaw 패리티: BM25/RRF/trigram 일부 후속

실제 코드 델타는 아래 5개다. 전부 JWC 방향 추가이고 GJC에는 없다.

### 2.1 신규 파일 4개 (JWC only)

```
GJC memories/:  index.ts, storage.ts                          (2개)
JWC memories/:  index.ts, storage.ts,
                local-query.ts (24,279B), memory-fts.ts,
                memory-config.ts, memory-quality.ts,
                memory-model-resolution.ts                     (7개)
```

### 2.2 FTS5 인덱스 추가

`storage.ts` diff (GJC → JWC):

```diff
+import { ensureMemoryFtsIndexes, syncStage1FtsRow } from "./memory-fts";
@@ openMemoryDb
+	db.run("PRAGMA busy_timeout = 5000");
 	db.exec(`
 PRAGMA journal_mode=WAL;
-PRAGMA busy_timeout=5000;
+CREATE TABLE IF NOT EXISTS memory_hit_counts (
+	ref TEXT PRIMARY KEY,
+	hit_count INTEGER NOT NULL,
+	last_hit_at INTEGER NOT NULL
+);
+	ensureMemoryFtsIndexes(db);
```

`busy_timeout` 을 `exec` 블록에서 `run` 단독 호출로 뺀 것도 실질 수정이다.
bun:sqlite 에서 다중 스테이트먼트 `exec` 안의 PRAGMA는 적용이 보장되지 않는다.
(이 의도는 코드에 주석이 없어 추론이다 — 커밋 메시지로 확정 못 함, (unknown))

FTS 테이블은 2종 (`memory-fts.ts:7-8`):

- `stage1_outputs_fts` — `thread_id UNINDEXED, raw_memory, rollout_summary, tokenize='unicode61'`
- `memory_artifacts_fts` — `ref UNINDEXED, body` (`MEMORY.md`/`memory_summary.md` 본문용)

stage1은 INSERT/DELETE 트리거로 동기화하고, **UPDATE 트리거는 일부러 안 쓴다**.
`memory-fts.ts:35` 에서 기존 DB의 update 트리거를 제거한다:

```ts
db.exec("DROP TRIGGER IF EXISTS stage1_outputs_fts_au");
```

대신 UPDATE 경로는 `syncStage1FtsRow` 로 delete+insert 수동 처리한다
(`memory-fts.ts:67-79`, 주석: "used on UPDATE paths that skip the broken FTS5 update trigger").
`storage.ts:348` upsert 직후 이 함수를 부른다.

### 2.3 매 턴 Task Snapshot 주입 (가장 큰 동작 변화)

GJC의 `local-backend.ts` 에는 없던 훅을 JWC가 구현했다.
`memory-backend/local-backend.ts:26-35`:

```ts
async beforeAgentStartPrompt(session, promptText) {
	const prompt = promptText.trim();
	if (!prompt) return undefined;
	const agentDir = session.settings.getAgentDir();
	const cwd = session.sessionManager.getCwd();
	const memCfg = loadMemoryConfig(session.settings);
	const body = buildLocalTaskSnapshot(agentDir, cwd, prompt, 4, { searchMode: memCfg.searchMode });
	if (!body) return undefined;
	return `<memories>\nTask snapshot (local memory hits for this turn):\n\n${body}\n</memories>`;
}
```

**이유**: GJC 주입은 세션 시작 시 고정 요약 1개라, 세션 도중 주제가 바뀌면 무관한 요약만 남는다.
JWC는 사용자 프롬프트 문자열을 쿼리로 써서 매 턴 상위 4건을 새로 뽑는다.
훅 자체는 upstream(GJC)이 hindsight 원격 백엔드용으로 만들어 둔 것을
로컬 백엔드에 처음 배선한 것이다 (`types.ts:66` 시그니처 동일).

`buildLocalTaskSnapshot` (`local-query.ts:585-606`) 은 `topN * 3` 만큼 뽑아
ref 중복 제거 + episode 최대 2건 캡을 걸고 topN까지만 남긴다.

### 2.4 스코어링 — cli-jaw 시맨틱 부분 이식

`local-query.ts:40-49`. **낮을수록 좋은 점수**다 (주석: "Lower is better (cli-jaw score semantics)").

```ts
const KIND_WEIGHT: Record<LocalMemoryKind, number> = { profile: -4, shared: -3, episode: 0 };
const SYNONYM_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [["pabcd", "plan", "audit", "build", "check", "done"]];
```

최종 점수 조립 (`local-query.ts:235`, FTS 경로):

```ts
score: KIND_WEIGHT.episode + row.rank * 0.01 + recencyBoost(row.generated_at, nowSec),
```

즉 **kind 우선치 + BM25 rank(0.01 가중) + recency** 3요소. 검색 모드는 3단
(`memory-config.ts:3`): `"hybrid" | "fts" | "like"`, 기본 `hybrid` =
FTS 먼저 시도하고 결과 0건이면 LIKE로 폴백 (`local-query.ts:213-243`).

`structure/22_session_storage.md` §cli-jaw 원본 대조 표에 따르면
**아직 이식 안 된 것**: trigram 토크나이저(CJK 매칭), RRF 융합(k=60), 정확일치 보너스.
CJK 검색은 `unicode61` 토크나이저라 실질적으로 LIKE 폴백에 의존한다.

### 2.5 품질 게이트 — hit-count 감점과 compaction 인지 캡

`memory-quality.ts` 는 JWC 신규 파일이다. 헤더 주석:
"Local memory quality gates (99.01 M9): character budgets, post-compaction recall caps,
and hit-count dedup".

**(a) 과다 회수 감점** (`memory-quality.ts:45-59`):

```ts
const count = hitCounts.get(hit.ref) ?? 0;
const penalty = count >= threshold ? (count - threshold + 1) * 0.5 : 0;
return { hit, score: hit.score + penalty };
```

같은 ref가 반복해서 뽑히면 점수를 올려(=나쁘게) 가라앉힌다. `memory_hit_counts` 테이블이
이걸 위해 추가됐다.

**(b) compaction 이후 회수 캡** (`memory-quality.ts:20-38`):

```ts
export function sessionIsCompactionAware(entries: SessionEntry[]): boolean {
	return getLatestCompactionEntry(entries) !== null;
}
export function resolveSnapshotLimits(config, isCompacted): MemorySnapshotLimits {
	if (isCompacted) {
		return { topN: config.compactedTaskSnapshotTopN, ... };
	}
	...
}
```

세션이 이미 compaction을 겪었으면 스냅샷 topN·문자 예산·스니펫 길이를 전부 축소본으로 바꾼다.
메모리 주입이 compaction으로 확보한 여유를 바로 다시 먹는 걸 막는 장치다.

### 2.6 mem0 백엔드 추가

`memory-backend/resolve.ts` diff:

```diff
-export type MemoryBackendId = "off" | "local" | "hindsight";
+export type MemoryBackendId = "off" | "local" | "hindsight" | "mem0";
+	if (id === "mem0") return mem0Backend;
```

`packages/coding-agent/src/mem0/` 6파일 신규 (backend/client/config/scope/state).
GJC에는 이 디렉터리가 없다.

### 2.7 안 바꾼 것 (의도적)

`structure/22_session_storage.md` cli-jaw 대조표 §"jwc 1차 결정":

- 저장 포맷: markdown+frontmatter로 안 바꾸고 **upstream SQLite 엔진 그대로** (070 확정 1)
- 쓰기 파이프라인: cli-jaw의 flush(10메시지마다)/reflect(24h 스로틀) **비이식**,
  upstream stage1/phase2 유지 (070 확정 7)
- TUI/Web 세션 **비공유**. 공유 대상은 스킬과 OAuth뿐 (D6)

---

## 3. compaction / 컨텍스트 관리 전략

메모리와 별개 층이다. 코드는 `packages/agent/src/compaction/` 9파일(~3,300줄).
GJC/JWC 모두 같은 파일 구성이고 7개 파일 전부 내용이 다르다 (`diff -rq`).

### 3.1 임계 계산

`compaction/compaction.ts:220-229` 기본값:

```ts
export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
	enabled: true,
	strategy: "context-full",
	thresholdPercent: 73,
	thresholdTokens: -1,
	reserveTokens: 16384,
	keepRecentTokens: 20000,
	autoContinue: true,
	remoteEnabled: true,
};
```

핵심은 **출력 예약분을 입력 예산에서 뺀다**는 것이다 (`compaction.ts:295-303` 주석):

> 400K-context 모델이 128K max output을 예약하면 15% 바닥(60K)이 아니라 128K를 예약하므로,
> 입력은 340K가 아니라 272K 근처에서 잘린다.

`resolveThresholdTokens` (`compaction.ts:320-355`) 는 퍼센트 임계와
`contextWindow - maxOutputTokens` 중 **작은 쪽**을 택한다.

### 3.2 usage 과소보고 폴백 (JWC 고유, 081.7)

`agent-session.ts:7343-7350` 주석이 문제를 그대로 적어 놨다:

> Some providers (e.g. cursor) under-report usage (input: 0, tiny totalTokens),
> which keeps the usage-based count below threshold forever and silently
> disables auto-compaction.

```ts
const contextTokensBeforeMaintenance = Math.max(promptTokens, this.#estimateMessagesTokens());
```

프로바이더 usage와 자체 토크나이저 추정치 중 **큰 값**을 쓴다.
`structure/40_fork-delta.md:282` 가 이걸 fork 델타(081.7)로 명시한다.
또 하나: 총 usage가 아니라 **prompt(input) 측**과 비교한다.
총합을 쓰면 긴 답변 직후 곧바로 compaction이 터진다.

### 3.3 prune → compact 사다리

임계를 넘으면 곧장 요약하지 않는다 (`agent-session.ts:7354-7368`):

```ts
if (!shouldCompact(contextTokensBeforeMaintenance, ...)) return;
const pruneResult = await this.#pruneToolOutputs();
const contextTokens = pruneResult
	? Math.max(Math.max(0, promptTokens - pruneResult.tokensSaved), this.#estimateMessagesTokens())
	: contextTokensBeforeMaintenance;
if (shouldCompact(contextTokens, ...)) {
	const promoted = await this.#tryContextPromotion(assistantMessage);
	if (!promoted) {
		await this.#runAutoCompaction("threshold", false);
	}
}
```

3단이다: **prune → 모델 승격(더 큰 컨텍스트 모델로 전환) → 요약**.
요약은 마지막 수단이다.

### 3.4 prune 규칙

`compaction/pruning.ts:23-28`:

```ts
export const DEFAULT_PRUNE_CONFIG: PruneConfig = {
	protectTokens: 40_000,
	minimumSavings: 20_000,
	protectedTools: ["skill", "read"],
	staleOverridableTools: ["read"],
};
```

- 최근 40K 토큰치 도구 출력은 건드리지 않는다.
- 절감이 20K 미만이면 아예 실행 안 한다 (`pruning.ts:341`).
- `skill`/`read` 는 보호. 단 `read` 는 **stale일 때만** 보호 해제
  (같은 파일을 다시 읽었으면 앞 결과는 폐기 가능).

prune이 통째 버리지 않고 **digest를 남기는 게 핵심**이다 (`pruning.ts:67-100`):

```ts
if (toolName === "bash") {
	const exitCode = ...;
	const tail = text.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
	const error = firstErrorLine(text);
	return [`exit=${exitCode}`, tail ? `tail=${tail}` : undefined, error ? `error=${error}` : undefined, ...].join("; ");
}
if (toolName === "search" || toolName === "grep") {
	// matches=N; files=M; error=...
}
```

결과는 `[Output truncated - 1234 tokens; exit=0; tail=...]` 형태.
digest 자체가 컨텍스트를 먹지 않도록 상한을 건다 (`pruning.ts:41-42, 105-115`):
generic 문구 토큰의 1.25배 또는 +24토큰 중 큰 값.

### 3.5 휘발성 컨텍스트 pruning (JWC only)

`session/volatile-context-pruning.ts` 는 JWC에만 있다 (GJC `session/` 목록에 없음).

```ts
const SUPERSEDED_VOLATILE_CONTEXT_NOTICE = "[superseded volatile context pruned]";
const SUPERSEDED_SINGLETON_REMINDER_TYPES = new Set([
	"todo-write-error-reminder", "resolve-reminder", "eager-todo-prelude",
]);
```

매 프롬프트마다 재생성되는 project context와 싱글턴 리마인더는
**최신 1개만 남기고** 과거 사본을 1줄 notice로 치환한다 (`volatile-context-pruning.ts:19-38`).
`#pruneToolOutputs` 안에서 도구 출력 prune보다 먼저 돈다 (`agent-session.ts:6822-6827`).

### 3.6 컷 포인트 선정

`compaction.ts:607-680` `findCutPoint`. 뒤에서부터 토큰을 누적하다
`keepRecentTokens`(20K)를 넘으면 **유효 컷 포인트**에서 자른다.
도구 결과 위치에서는 절대 자르지 않는다 (tool_call/tool_result 짝이 깨지므로).
턴 중간에서 잘리면 `findTurnStartIndex` 로 그 턴을 시작한 user 메시지를 찾아
`isSplitTurn` 을 표시하고, 별도의 turn-prefix 요약 프롬프트를 돌린다
(`compaction.ts:1249` `TURN_PREFIX_SUMMARIZATION_PROMPT`).

### 3.7 원격 compaction과 진행률

`compaction/openai.ts` (561줄)가 OpenAI 원격 compaction을 처리한다.
`MIN_REMOTE_SUMMARY_CHARS = 80` (`compaction.ts:236`) — 원격 요약이 80자 미만이면
degenerate로 보고 로컬 요약 경로로 폴백한다.

진행률은 11개 phase × 8개 segment로 세분화돼 있다 (`compaction.ts:63-90`):
`preparing / awaiting_hooks / customizing_prompt / remote_summarization /
summarizing_history / summarizing_turn_prefix / summarizing_short / finalizing /
persisting / completed / cancelled / failed`.

### 3.8 브랜치 요약

`compaction/branch-summarization.ts` — 세션 트리에서 다른 지점으로 이동할 때
떠나는 브랜치를 요약해 남긴다 (파일 헤더 주석 1-6행).
선형 히스토리가 아니라 트리 구조라서 필요한 장치다.

### 3.9 GJC에만 있는 것 (fork 이후 upstream 진화, 이식 후보)

`GJC pruning.ts` 는 761줄, JWC는 356줄이다. GJC에만 있는 함수:

- `pruneAssistantToolArguments` (`GJC pruning.ts:534`) — 도구 **결과**뿐 아니라
  assistant가 보낸 **인자**도 prune. `EDIT_TOOL_NAMES = {edit, write, apply_patch, ast_edit}`,
  `APPLY_PATCH_HEADER` 정규식으로 패치 본문을 헤더만 남기고 접는 로직이 있다.
- `shouldRunMaintenancePrune` (`GJC pruning.ts:720-729`) — **프롬프트 캐시 경제성 게이트**:

```ts
/* Pruning forces a prompt-cache-epoch reset, so it only runs when opted in AND the
   estimated stale savings clear a high minimum AND exceed the one-time reset cost. */
export function shouldRunMaintenancePrune(args: {
	enabled: boolean; estimatedSavings: number; minSavings: number; cacheEpochResetCost: number;
}): boolean {
	if (!args.enabled) return false;
	if (args.estimatedSavings < args.minSavings) return false;
	return args.estimatedSavings > args.cacheEpochResetCost;
}
```

- `session/cache-economics.ts`, `session/context-estimation.ts`,
  `session/file-mention-pruning.ts` — GJC `session/` 에만 존재.
  `context-estimation.ts` 는 skills/tools/system prompt 토큰을 메시지와 분리 계산해
  status line과 `/context` 패널이 **같은 숫자**를 보고하도록 강제한다
  (파일 헤더 주석: "they MUST report the same numbers").

이것들이 JWC에 없는 이유는 (unknown)이다. fork 이후 upstream 신규일 가능성이 높지만
커밋 대조로 확정하지 못했다.

### 3.10 도구 층 컨텍스트 절약 — pi-shell minimizer

`crates/pi-shell/src/minimizer/` 에 명령별 출력 축약 정의가 100개 이상 TOML로 들어있다
(`defs/gcc.toml`, `defs/basedpyright.toml`, `defs/tofu-plan.toml`, `defs/du.toml` 등)
+ 언어별 필터 (`filters/go.rs`, `filters/git.rs`, `filters/dotnet.rs`).
compaction 이전에 **애초에 컨텍스트로 들어오는 양을 줄이는** 층이다.
개별 TOML 내용까지는 열어보지 않았다 (범위 밖).

---

## 4. codexclaw가 훔쳐올 만한 아이디어 5개

### (1) 요약 전에 prune, prune 전에 모델 승격 — 3단 사다리

근거: `agent-session.ts:7354-7368`.
codexclaw는 compaction을 단일 이벤트로 다루는데, jawcode는
"임계 도달 → 쓸모없는 도구 출력 접기 → 재측정 → 그래도 넘치면 큰 모델로 승격 →
그래도 안 되면 요약" 순이다. 요약은 정보 손실이 가장 큰 연산인데 가장 마지막에 온다.
PABCD 루프처럼 도구 출력이 많은 워크로드에서 특히 이득이 크다.

### (2) prune할 때 digest를 남기기

근거: `pruning.ts:67-100` `resultDigest`.
`[Output truncated]` 만 남기면 에이전트는 그 명령이 성공했는지조차 모른다.
`exit=0; tail=<마지막 줄>; error=<첫 에러 줄>` 를 남기면 토큰은 거의 안 쓰면서
"이미 해봤고 성공했다"는 사실이 보존된다. digest 상한(generic의 1.25배)까지 같이 가져오면 된다.

### (3) compaction 이후 회수 예산 축소

근거: `memory-quality.ts:20-38` `sessionIsCompactionAware` + `resolveSnapshotLimits`.
메모리 주입과 compaction을 독립적으로 두면, 힘들게 압축한 자리를 메모리가 도로 채운다.
"이 세션은 이미 압축된 적 있다"를 신호로 삼아 주입 topN·문자 예산을 자동으로 줄이는 건
구현 비용 대비 효과가 크다. codexclaw의 PostCompact 훅에 바로 붙는 자리다.

### (4) hit-count 감점으로 회수 다양성 확보

근거: `memory-quality.ts:45-59`, `memory_hit_counts` 테이블.
`penalty = (count - threshold + 1) * 0.5` 한 줄이면
매번 똑같은 상위 문서만 올라오는 문제가 완화된다.
테이블 하나(ref, hit_count, last_hit_at)와 곱셈 하나로 끝난다.

### (5) 프로바이더 usage를 믿지 말고 자체 추정치와 max 비교

근거: `agent-session.ts:7343-7350`.
`Math.max(promptTokens, this.#estimateMessagesTokens())`.
usage를 과소보고하는 프로바이더(주석에 cursor 명시)에서는 auto-compaction이
**조용히 영구 비활성화**된다. 실패가 소리 없이 일어나는 종류라 더 위험하다.
codexclaw가 라우팅으로 여러 프로바이더를 태우는 구조라면 정확히 같은 함정을 밟는다.

### 보너스 — 캐시 경제성 게이트 (GJC 쪽, 이식 난도 낮음)

`GJC pruning.ts:720-729`. prune은 프롬프트 캐시 에폭을 리셋시키므로
**절감량이 리셋 비용을 넘을 때만** 실행한다. prune을 공짜로 취급하지 않는 관점 자체가 유용하다.

---

## 5. 확인 못 한 것 (unknown)

- GJC/JWC diff에서 어느 쪽이 fork 델타이고 어느 쪽이 fork 이후 upstream 신규인지,
  `pruning.ts` (761 vs 356줄), `cache-economics.ts`, `context-estimation.ts`,
  `file-mention-pruning.ts` 에 대해 커밋 단위로 확정하지 못했다.
- `busy_timeout` 을 `exec` 에서 `run` 으로 분리한 의도는 코드 주석이 없어 추론이다.
- `crates/pi-shell/src/minimizer/` 개별 TOML 규칙의 축약 강도는 미조사.
- gjc의 npm 배포본과 이 벤더링 스냅샷의 일치 여부는 미검증 (다운로드 안 함 — 로컬 소스로 충분).
- 런타임 실측 없음. 전부 정적 코드 독해다. 임계·예산 수치는 기본값이며 실제 설정 반영 아님.
