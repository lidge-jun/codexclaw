# 030 — wp3: cxc-recall SKILL.md 재작성 + docs-site 잔여

날짜: 2026-09-10 (KST). 워크트리 `/Users/jun/.codex/worktrees/3412/codexclaw`, HEAD `369ed0e1` (`codex/memory-l1-wp0-roadmap`, 000_plan이 적은 origin/dev와 동일 트리).
이 문서는 Plan(decade)이다. 이 사이클에서 제품 코드·훅 JSON·설치 캐시는 바꾸지 않는다. Build가 복붙할 대상은 §4의 after 블록이다.

등급: C1 문서. 000_plan wp3, notes/04 18행 대조표, notes/02 P1, notes/06·07 외부 레인, notes/08 §5.2 docs-site 잔여.

---

## 1. 목적과 범위

목적은 두 개다. (a) `cxc-recall` SKILL.md를 오늘 아침 CLI와 같은 말로 바꾸고, 자연어 문장을 키워드로 쪼개는 절차와 히트 검증 규칙을 넣는다. (b) L0 이후 docs-site에 남은 훅 개수·PostCompact 문구·`allow-write`·`--rank`·`dedicated_tools`를 코드와 맞춘다. 코드 변경 없이 가장 큰 효과가 나는 자리라는 판정은 notes/04 로드맵 P0과 000_plan wp3이 같다.

### IN

- `plugins/codexclaw/skills/recall/SKILL.md` 전문 교체. `agents/openai.yaml`은 시그니처가 이미 맞으므로 유지 (`allow_implicit_invocation: true`, display_name `cxc-recall`).
- docs-site 잔여 7파일: `concepts/how-it-works.md`, `reference/commands.md`, `reference/hooks.md`, `reference/plugin-manifest.md`, `guides/native-tools.md`, `index.mdx`, `getting-started/installation.md`. 사용자 소스 목록은 앞 5개. 같은 24/25 숫자 잔여가 index·installation에 있어 같은 PR에 넣는다 (notes/08 §5.2, how-it-works.md:36, hooks.md:3,6, plugin-manifest.md:19, installation.md:101, index.mdx:151).
- 시놉시스 회귀 테스트 1파일 (USAGE 플래그 ⊆ SKILL Commands 펜스).

### OUT

- recall `src/*.ts` / `dist/*.js`. USAGE 문자열은 스킬이 따라간다. CLI를 이 사이클에서 바꾸지 않는다.
- 훅 JSON `statusMessage` (PostCompact recall의 "(codexclaw) Recovering recall context after compaction", hooks.md:40). 핸들러는 빈 문자열 (hook.ts:549-551). JSON을 고치면 `trusted_hash`가 바뀐다. wp3는 문서만 고친다.
- `synonyms.ts` 시드, chat 어간, 8단어 캡 코드 — wp5.
- cwd 정체성 키 — wp4. 스킬은 wp4 전 문구와 wp4 후 문구를 둘 다 싣고, 머지 시점은 wp4가 전 문구를 지운다.
- Aside 엔진·kim_wiki `wiki_lookup.py` — 별도 트랙. 스킬에는 "그 도구가 설치돼 있을 때만" 조건부 한 절.
- `guides/skills.md:74,108`의 "읽기 전용 검색" 한 줄. 플래그 상세는 commands·SKILL이 맡는다.
- `memories.add_ad_hoc_note` / `cxc memory allow-write` 동작 변경. allow-write는 commands.md에 적기만 한다.

성공 기준: (1) SKILL Commands 펜스의 플래그가 `cli.ts` USAGE와 같고, notes/04 18행이 스킬 본문에서 더 이상 거짓이 아니다. (2) docs-site가 plugin.json 28파일·29핸들러, PreToolUse x7+memory-write, SessionStart x8 (subagent-fallback + bg-wake), PostCompact recall silent, commands에 allow-write·`--rank`·dedicated_tools를 보인다. (3) 평가 원문 3건을 사다리대로 다시 쓰면 0건이 아니다 (코드 변경 없이 절차만).

---

## 2. 현재 코드

### 2.1 스킬 시놉시스가 USAGE보다 짧다

`cli.ts:25-51` USAGE (발췌):

```ts
const USAGE = [
  "cxc chat search \"<query>\" [--days N] [--cwd PATH] [--role r] [--source main|subagent|all]",
  "                           [--limit N] [--context N] [--any] [--all] [--no-tools]",
  "                           [--recent] [--scan] [--no-refresh] [--json]",
  "cxc chat index [--rebuild] [--status] [--json]",
  "cxc memory search \"<query>\" [--days N] [--limit N] [--any] [--no-synonyms]",
  "                             [--cwd PATH] [--cwd-only PATH] [--no-chat] [--json]",
  "",
  `  --days N     restrict to the last N days (chat default ${DEFAULT_DAYS}, 0 = full history)`,
  "  --cwd PATH   chat: only sessions under PATH; memory: rank hits under PATH first",
  "  --cwd-only PATH  memory search: drop hits recorded outside PATH",
  "  --role r     only messages with this role (user|assistant|tool)",
  "  --source s   main (default) | subagent | all",
  `  --limit N    max hits (chat default ${DEFAULT_LIMIT}, memory default ${DEFAULT_MEMORY_LIMIT})`,
  "  --rank       order by relevance (the default; accepted for explicitness)",
  "  --no-chat    memory search: do not fall back to raw chat when nothing matches",
  "  --no-refresh skip refresh-on-query ingest (fastest, index may be stale)",
  "  --json       machine-readable output (text fields clipped at 500 chars)",
  "  --full       with --json: emit unclipped text fields",
  "  --home PATH  search an alternate Codex home (default $CODEX_HOME ?? ~/.codex)",
].join("\n");
```


스킬 Commands 펜스 (`SKILL.md:28-34`)는 `--json`(index)·`--rank`·`--full`·`--home`이 없다. 오늘 재실행한 플래그 집합 차:

- USAGE: `--all --any --context --cwd --cwd-only --days --full --home --json --limit --no-chat --no-refresh --no-synonyms --no-tools --rank --rebuild --recent --role --scan --source --status`
- SKILL 시놉시스: 위와 같으나 `--full --home --rank` 없음
- `--index-path`는 parseFlags(`cli.ts:84,125`)에만 있고 USAGE에도 없다. 스킬에 넣지 않는다 (notes/04 #18).

### 2.2 기본값·엔진·JSON이 스킬 주장과 다르다

chat 기본일수 7, 상한 포함 limit (`chat-search.ts:31-33,113-114`):

```ts
export const DEFAULT_DAYS = 7;
export const DEFAULT_LIMIT = 50;
  const days = opts.days ?? DEFAULT_DAYS;
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
```

memory 기본일수 0=전체, limit 20 (`memory-search.ts:34,377,379`):

```ts
export const DEFAULT_MEMORY_LIMIT = 20;
  const limit = Math.max(opts.limit ?? DEFAULT_MEMORY_LIMIT, 1);
  const days = opts.days ?? 0;
```

단어 캡 8, 불용어 없음 (`query-words.ts:20-21,34-38`):

```ts
/** Query words beyond this count are dropped (cli-jaw parity). */
export const MAX_WORDS = 8;
export function splitQueryWordsRaw(query: string): string[] {
  return query
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, MAX_WORDS);
}
```

chat는 소문자 substring AND이고 어간·동의어가 없다 (`chat-search.ts:101-108`). includeTools 기본 true (`cli.ts:120`, `chat-search.ts:202,240`). `--no-refresh`가 없으면 sidecar ingest (`chat-search.ts:181-189`):

```ts
    if (!opts.noRefresh && !readOnly) {
      const empty =
        (db.prepare("SELECT COUNT(*) AS n FROM files").get() as { n: number }).n === 0;
      if (empty) {
        process.stderr.write(
          "recall: building the sidecar index for the first time — subsequent queries are instant\n",
        );
      }
      const r = ingest(shared.home, db, 0);
      refreshed = r.ingested + r.appended;
    }
```

`cxc chat index --rebuild`는 msgs/files를 지운다 (`cli.ts:173-174`). 스킬 24행 "never modify anything"은 이 두 경로와 모순이다. 대상은 `~/.codexclaw/recall/index.sqlite`이지 `~/.codex` 원문이 아니다.

trigram/LIKE는 chat index만 (`index-search.ts:4-8,95-102`). memory의 심볼 경계 fallback은 `hasBoundaryTerm`일 때만 (`memory-search.ts:461-471`). 한글 문장은 boundary=false라 재시도가 없고, 재시도가 0이면 빈 결과다. 스킬 63행 "empty answer is never the outcome"은 거짓이다. 오늘 원문 3건이 반례 (notes/04 §2).

JSON 스키마가 갈린다.

chat (`chat-search.ts:82-98`) + clip 플래그 (`format.ts:85-102`, `cli.ts:128`):

```ts
export type ChatSearchResult = {
  hits: ChatHit[];
  warnings: string[];
  scannedFiles: number;
  matchedFiles: number;
  totalFiles: number;
  elapsedMs: number;
  mode: "index" | "scan";
  index?: {
    lastIngestAt: string | null;
    files: number;
    sourceFiles: number;
    staleFiles: number;
    readOnly: boolean;
  };
};
```

memory (`memory-search.ts:220-225`):

```ts
export type MemorySearchResult = {
  hits: MemoryHit[];
  warnings: string[];
  scannedFiles: number;
  elapsedMs: number;
};
```

스킬 121-122행이 양쪽에 `{hits, warnings, scannedFiles, totalFiles, elapsedMs, mode}`를 붙인다. memory에는 `mode`/`totalFiles`가 없다.

memory 0건 → chat 최대 5, tool 제외, noRefresh 강제 (`memory-search.ts:514-531`). `--no-chat`면 주입 자체를 안 한다 (`cli.ts:154`). 이 동작은 스킬 98-103과 일치한다. 사다리 108-116은 fallback을 단계로 안 적는다.

### 2.3 훅 목록은 plugin.json이 28파일·29핸들러

`plugin.json:22-50` hooks 배열은 28파일이다(계획 시점 25 + #119 bg-wake 3). compact-affordance 파일(`post-compact-injecting-bg-terminal-affordance.json`)이 PostCompact와 UserPromptSubmit을 같이 등록하므로 핸들러는 29개다.

| 이벤트 | 파일 수 | 비고 |
|---|---:|---|
| SessionStart | 8 | how-it-works·index는 x6. 빠진 파일: `session-start-announcing-subagent-fallback.json` (#116), `session-start-adopting-background-completions.json` (#119) |
| UserPromptSubmit | 5 | compact-affordance 겸직 포함, `user-prompt-submit-delivering-background-completions.json` (#119) |
| Stop | 2 | `stop-waking-on-background-completion.json` (#119) |
| PreToolUse | 7 | how-it-works 표는 x6, memory-write 행이 없음. index.mdx 숫자는 이미 x7 |
| PostToolUse | 2 | |
| SubagentStop | 2 | |
| PostCompact | 3 | recall 핸들러는 고의 silent (`hook.ts:549-551`) |

PostCompact recall (`hook.ts:539-551`):

```ts
/**
 * PostCompact: side-effect-free no-op. ALWAYS returns "".
 * ...
 */
export function handlePostCompact(cwd?: string): string {
  void cwd;
  return "";
}
```

복구 문구는 SessionStart `source === "compact"` (`hook.ts:501-533`). how-it-works.md:48 "invoke recall recovery"는 이 코드와 모순. hooks.md:105-109는 맞다.

`cxc enable`이 `memories.dedicated_tools`를 켠다 (`managed-keys.ts:66-80`, autoEnable true). 쓰기 도구는 PreToolUse memory-write 게이트가 막는다. native-tools.md:93 "memories remain flag-gated"는 설치 경로와 어긋난다.

`cxc memory allow-write`는 recall이 아니라 pabcd-state (`bin/cxc.mjs:164-165`, `memory-cli.ts:25-35`). commands.md live 표에 없다.

### 2.4 SKILL.md 크기 제한

전역 바이트/줄 캡은 스킬 로더·`skill-catalog.test.mjs`·`manifest-policy.test.mjs`에 없다. 있는 제한은 다음뿐이다.

- `repo-map-packaging.test.mjs:191`: **repo-map 폴더만** `SKILL.md` 줄 수 ≤ 500.
- frontmatter 금지 필드 `license`/`keywords` (`manifest-policy.test.mjs:27-44`).
- implicit set에 `recall` 포함 (`manifest-policy.test.mjs:51-54`, `agents/openai.yaml:5`).
- 현재 카탈로그 최장 스킬은 `dev-testing/SKILL.md` 500줄. recall은 148줄 / 7945바이트.
- skill-creator는 하드 캡이 없고 "entrypoint should be as short as the task permits", 조건부 상세는 `references/`로 넘기라고만 한다.

wp3 본문은 사다리가 매 회수에 필요하므로 SKILL.md 한 파일에 둔다. 목표 줄 수 280±30, 상한 500 (카탈로그 최장·repo-map 핀과 같은 수). `references/` 분할은 이 사이클 OUT.

### 2.5 네이티브 주입·외부 레인 (스킬에 한계로만)

주입 요약은 cwd를 보지 않는다 (notes/02 §2.2). User preferences는 세션 인용 승격 (notes/02 §2.5). 라이브 AGENTS.md가 우선 (notes/02 P1). 설정 키로 2500 토큰·cwd 필터를 줄 수 없다.

Aside는 컷오프·path dedupe·exact 채널이 없다 (notes/06). 스킬 계약: 설치돼 있을 때만, top score < 0.72면 의미 검색 실패, `rg --fixed-strings`, path dedupe.

kim_wiki entries는 대표 문서만 후보 (notes/07). 스킬 계약: 설치돼 있을 때만, 레인 점수 비합산, entries 0이면 nodes/raw가 가리킨 상세를 `rg`.

---

## 3. 변경 파일 맵

| 파일 | NEW/MODIFY/DELETE | 변경 요지 | 예상 줄수 |
|---|---|---|---|
| `plugins/codexclaw/skills/recall/SKILL.md` | MODIFY | 시놉시스=USAGE, 14+항목 정정, 사다리, 검증 규칙, 서브에이전트·워크트리(wp4 전/후), native vs cxc, 조건부 외부 레인 | 148 → 262 |
| `plugins/codexclaw/skills/recall/agents/openai.yaml` | (유지) | 변경 없음 | 0 |
| `plugins/codexclaw/test/recall-skill-synopsis.test.mjs` | NEW | USAGE 플래그 ⊆ SKILL Commands 펜스, 금지 문구 부재 | ~80 |
| `docs-site/src/content/docs/concepts/how-it-works.md` | MODIFY | 28파일/29핸들러, SessionStart x8·UserPromptSubmit x5·Stop x2, PreToolUse x7+memory-write, PostCompact silent | ~24 |
| `docs-site/src/content/docs/reference/commands.md` | MODIFY | allow-write 행, chat `--rank`, memory days=0, dedicated_tools 주석 | ~25 |
| `docs-site/src/content/docs/reference/hooks.md` | MODIFY | 28/29, fallback 행 추가, PostCompact recall은 stdout 빈 문자열이라고 본문에 명시 (JSON statusMessage는 그대로) | ~15 |
| `docs-site/src/content/docs/reference/plugin-manifest.md` | MODIFY | hooks JSON을 plugin.json 28파일과 동일하게 | ~24 |
| `docs-site/src/content/docs/guides/native-tools.md` | MODIFY | dedicated_tools는 `cxc enable`이 켠다. memories가 "future/flag-gated"가 아님 | ~8 |
| `docs-site/src/content/docs/index.mdx` | MODIFY | Hooks 행 24/25 x6 → 28/29, SessionStart x8 | 1 |
| `docs-site/src/content/docs/getting-started/installation.md` | MODIFY | 24/25 → 28/29 | 2 |

dist: src를 안 고치므로 `npm run build` 재생성 대상 없음. §7.

---

## 4. 변경 상세

### 4.1 18항목 정정 표 (notes/04 §1, 행 번호 재확인)

000_plan이 "14항목"으로 묶은 것과 같은 표다. 행이 18개인 이유는 시놉시스 누락·스키마·과대 주장·사다리 공백을 한 표에 넣었기 때문이다. after는 전부 새 SKILL.md §4.2에 대응한다.

| # | 지금 스킬 주장 | 구현 | 새 스킬 |
|---|---|---|---|
| 1 | index 시놉시스에 `[--rebuild] [--status]`만 (SKILL.md:32) | USAGE `[--json]` (cli.ts:29, 185-188) | index 줄에 `[--json]` |
| 2 | 시놉시스에 `--home` 없음 (SKILL.md:29-34), 본문만 (127-130) | USAGE `--home PATH` (cli.ts:51, 83, 124, 147) | chat/memory 시놉시스에 `--home PATH` |
| 3 | `--full` 없음 | `--full`+`--json`이면 clip 생략 (cli.ts:50, 79, 128; format.ts:85-102) | 시놉시스+`--full` 설명 |
| 4 | 시놉시스에 `--rank` 없음 (본문은 relevance만, 46-49) | `--rank` 플래그 (cli.ts:44, 73, 121) | 시놉시스+`--rank`는 기본값의 이름 |
| 5 | chat `--days` 기본 7 (40-41) | `DEFAULT_DAYS = 7` (chat-search.ts:31, 113) | 유지 |
| 6 | memory `--days` 기본값 없음 (33, 37-41) | 기본 **0=전체** (memory-search.ts:379) | "memory default 0, chat default 7" |
| 7 | `--limit` 숫자 없음 | chat 50, memory 20, chat 상한 200 (cli.ts:38; chat-search.ts:32-33,114; memory-search.ts:34,377) | 두 기본값 명시 |
| 8 | JSON을 양쪽에 같은 스키마 (121-122) | chat은 matchedFiles/index/clipped 추가, memory는 hits/warnings/scannedFiles/elapsedMs만 (chat-search.ts:82-98; memory-search.ts:220-225) | 스키마 분리 |
| 9 | "empty answer is never the outcome" (61-63) | fallback은 memory+hasBoundaryTerm만 (memory-search.ts:461-471). 한글 문장·chat AND 실패는 빈 결과 | 문구 삭제. 빈 결과는 흔하다 |
| 10 | 양 엔진 trigram (50) | trigram/LIKE는 chat index만 (index-search.ts:4-8,95-102). memory는 paragraph scan (memory-search.ts:351-354,386-388) | chat only |
| 11 | "never modify anything" (24) | `--no-refresh` 없으면 ingest (chat-search.ts:181-189). `--rebuild`는 DELETE (cli.ts:173-174) | sidecar만 쓴다, `--no-refresh`로 막는다 |
| 12 | "Words AND together"만 (39) | 최대 8단어 이후 폐기 (query-words.ts:20-21,34-38). stopword 0건 | MAX_WORDS=8, 불용어 없음 |
| 13 | `--no-synonyms` = literal (73) | 동의어·어간 버림 (cli.ts:48; memory-search.ts:386-388). chat에는 플래그가 무의미 | 유지 + chat에는 효과 없음 |
| 14 | memory 0건이면 chat 최대 5, tool 제외 (98-103) | `want = min(limit, 5)`, noRefresh, tools 기본 제외 (memory-search.ts:514-531). `--no-chat`면 없음 (cli.ts:154) | 사다리 5단계로 승격 |
| 15 | `--no-tools`만 나열 (30) | includeTools 기본 **true** (cli.ts:120; chat-search.ts:202,240) | 기본이 tool_log를 맞춘다, 회수는 `--no-tools` |
| 16 | memory 규칙이 리콜 일반처럼 배치 (52-71) | 심볼 경계·어간·동의어는 memory only (chat-search.ts:101-108,118) | "Two engines" 절로 분리 |
| 17 | 사다리 1단계가 원문 distinctive terms (108-116) | 자연어 분해·`--any` 금지·native 분담 없음 | §4.2 사다리 |
| 18 | (숨은) `--index-path` | USAGE에도 없음 (cli.ts:84,125) | 스킬에 안 넣음 |

### 4.2 새 SKILL.md 전문 (복붙)

아래를 `plugins/codexclaw/skills/recall/SKILL.md`에 그대로 덮어쓴다. frontmatter description/triggers는 현행을 유지한다 (implicit 라우팅 표면).

````markdown
---
name: cxc-recall
description: "MUST USE for past-session recall — when a term from prior work is unfamiliar, context feels lost after a compact/restart, or the user references earlier work (그때, 지난번, 저번 세션, 예전에 했던, 기억나?, last time, previous session, what did we do). Searches past Codex conversations and the Codex memory store from the CLI before asking the user. Triggers: recall, 리콜, past session, chat search, memory search, 지난 세션, 이전 작업, 뭐였지, 어떻게 했었지."
metadata:
  short-description: "Read-only recall search over ~/.codex: past chats (FTS-indexed) + memory store."
---

# recall — Past-Session Recall Search

Codex already persists every session (`~/.codex/sessions/**/rollout-*.jsonl`) and a
per-thread memory store (`~/.codex/memories/`). This skill is the discipline for
SEARCHING that history instead of asking the user to repeat themselves.

Injected `memory_summary.md` and SessionStart snippets are locators, never proof.
Search, then open the winning file, before answering a past-work question.

## Recall Lookup Scope (read first)

When ANY of these happen, search BEFORE asking the user:

- A term, file, decision, or codename from prior work is unfamiliar.
- Context seems lost after a compact, restart, or session handoff.
- The user references earlier work: "그때 그거", "지난번에 하던 거", "저번 세션에서",
  "예전에 만든", "last time", "the thing we did earlier", "as discussed previously".
- You are about to write "I don't have context about X" — search X first.

`cxc chat search` and `cxc memory search` do not write Codex session files or the
memory store. They are not write-free against the sidecar: without `--no-refresh`,
`cxc chat search` refreshes the sidecar index at `~/.codexclaw/recall/index.sqlite`,
and `cxc chat index --rebuild` deletes and re-ingests that index. Pass
`--no-refresh` when the index must stay untouched. Never call
`memories.add_ad_hoc_note` from this skill.

## Commands

```
cxc chat search "<query>" [--days N] [--cwd PATH] [--role r] [--source main|subagent|all]
                          [--limit N] [--context N] [--any] [--all] [--no-tools]
                          [--recent] [--rank] [--scan] [--no-refresh] [--json] [--full]
                          [--home PATH]
cxc chat index [--rebuild] [--status] [--json]
cxc memory search "<query>" [--days N] [--limit N] [--any] [--no-synonyms]
                            [--cwd PATH] [--cwd-only PATH] [--no-chat] [--json]
                            [--home PATH]
```

Flags that live in the CLI USAGE and are easy to miss:

- `--rank` — relevance order (the default; accepted for explicitness). `--recent`
  is newest-first.
- `--full` — with `--json`, skip the 500-char clip.
- `--home PATH` — search an alternate Codex home (default `$CODEX_HOME` ?? `~/.codex`).
- `--json` on `cxc chat index` prints index status as JSON.

Defaults that matter:

- Words AND together; pass `--any` for OR. Quote the whole query.
- After a space split, at most 8 words are kept (`MAX_WORDS`). There is no
  stopword list, so 그 / 진짜 / 지난번 / 문제 / 방법 stay required AND terms.
- Do not paste a Korean or English sentence as-is. Do not use `--any` on a long
  sentence — it fills the page with common-word noise and is not a relevance rewrite.
- `--days` defaults to **7 for chat** and **0 (full history) for memory**. They
  are different. Pass `--days 0` on chat for full history.
- `--limit` defaults: chat 50 (cap 200), memory 20.
- `--source main` is default; subagent transcripts need `--source subagent|all`.
- Harness-injected synthetic messages are hidden; `--all` reveals them.
- Chat matches tool call/output (`tool_log`) by default. Recall questions should
  pass `--no-tools`.
- Chat hits come back BY RELEVANCE: a BM25 lane and a trigram lane are fused
  (reciprocal rank fusion) and freshness breaks ties among comparable matches.
  Pass `--recent` for newest-first. This ordering is chat index only; memory
  ranks by its own chunk score (group coverage, density, kind, freshness).

## Two engines (do not mix their rules)

Chat (`cxc chat search`, sidecar FTS index):

- Lowercase substring AND (OR with `--any`). No Korean stemming. No synonym table.
- Drop particles yourself (`코덱스를` → `코덱스` or `codex`).
- Trigram FTS for words of length >= 3; LIKE fallback below that. This is chat index only.
- Empty results are possible. There is no substring fallback for a failed AND.

Memory (`cxc memory search`):

- Paragraph scan over `~/.codex/memories/` (MEMORY.md, memory_summary.md,
  rollout_summaries, stage1, ad-hoc notes).
- Korean ending trim + ko/en synonym expansion (unless `--no-synonyms`).
  `--no-synonyms` on chat is a no-op because chat never expands.
- Symbol-shaped words — uppercase acronyms (`CI`, `LSP`), one-to-three-letter
  ASCII (`go`, `id`), numbers (`3956`, `#3956`), SHAs, dotted versions (`2.49.0`,
  `v2.49.0`; judged before the filename rule), filenames and paths — match on
  word boundaries only. `LSP` does not return `NaiControlsPanel`. A version
  written as `v2.49.0` in the corpus still matches the query `2.49.0`: a lone
  token-edge `v` before a version counts as a boundary.
- When a query finds nothing at all, memory retries with substring matching
  only for the boundary groups that occur nowhere in the corpus, and warns
  `lower confidence`. A group that does hit on boundaries keeps its precision,
  so `3956 LSP` never lets `LSP` match inside `NaiControlsPanel`. Korean prose
  has no boundary term, so that retry does **not** run for it. Empty results
  are common for unsplit sentences.
- Trimming only ever adds terms; the word you typed still anchors the excerpt.
  Stems shorter than two syllables are never produced, so `검사` is not split
  into `검`.

## Natural-language → keyword ladder

Do not start with the user's sentence. Rewrite, then search. Each rewrite is its
own query (`--days 0`, chat then memory unless the noun is known to live in notes):

1. Proper nouns / versions / hostnames / filenames as a single token
   (`BundledPluginsMarketplace`, `2.49.0`, a thread id).
2. Korean/English synonym pair of that noun (`도그푸딩` and `dogfooding`,
   `플러그인` and `plugin restart`, `배포` and `provenance` / `SLSA`).
3. Short 2–3 word keyword query (`로컬 소스 서비스`, `2.49.0 배포 npm`).
4. `cxc chat search "<keywords>" --days 0 --no-tools` — find the conversation.
   Add `--context 2`. Add `--source all` if the work was delegated.
5. `cxc memory search "<keywords>"` — durable summary. Omit `--no-chat` so empty
   memory can backfill up to 5 raw messages labelled `(chat/chat)`.
6. Open the winning rollout / memory file (`rollout_path` is on the hit). Do not
   answer from the excerpt.
7. Only if the rewritten queries miss, ask the user and list what you searched.

Worked recoveries (eval 2026-09-10): the sentences
`지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법`,
`코덱스를 재시작하면 플러그인이 사라지는 문제`,
`2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록`
are 0 hits as-is. They recover as `source dogfooding` / `plugin restart` /
`2.49.0 배포 npm`.

## Result checks (before treating a hit as the answer)

- Request vs completion: a user line or "진행할게" is a locator, not proof.
  Prefer assistant text that names the outcome (healthz, npm latest, recovered).
- Version-string trap: a hit that contains `2.49.0` may be the previous release
  bumping *toward* 2.49.0. Check the title/date/task_outcome. Do not take the
  first version match. `2.49.0 provenance` ranked a 2.48 session first.
- Correction history: later ad-hoc notes and MEMORY.md entries override older
  summaries. If two hits disagree, read the newer file, then the rollout.
- `--any` hits are not evidence by mere existence.

## Subagent / managed worktree

- Chat default `--source main` hides subagent transcripts. Delegated work:
  `--source all` or `--source subagent`.
- This skill's CLI search is allowed in a read-only subagent. Do not ask the
  parent or the user to recap a term until the ladder above has run.

Managed-worktree cwd (Codex app hash-named checkouts under `~/.codex/worktrees`):

- **Until wp4 (project identity key) lands.** `--cwd PATH` only boosts; it does
  not hide other projects. A worktree path is a different prefix from the main
  checkout, so `--cwd-only <worktree>` currently returns 0 hits even when the
  same repo has summaries under the main checkout. Do not start with
  `--cwd-only`. Pass the main checkout path to `--cwd`, or omit the flag. If
  `--cwd-only` warns it emptied the result, retry `--cwd`.
- **After wp4.** `--cwd <worktree>` includes hits that share the same git
  `repository_url` as that worktree (the main checkout of the same origin).
  `--cwd-only` still hides other remotes. Sessions with no origin fall back to
  cwd prefix. When wp4 merges, delete the "Until wp4" paragraph and keep this
  one.

## Native `memories.*` vs `cxc`

When Codex `[memories] dedicated_tools=true` (codexclaw `cxc enable` turns this
on), `memories.search` / `memories.read` / `memories.list` search the memory
store as dedicated tools (path-scoped, `match_mode` any | all_on_same_line |
all_within_lines). They do not search session JSONL.

Use them to open a known memory file or to scan MEMORY.md without a shell. They
are not a substitute for `cxc chat search --days 0`. `cxc memory search` adds
ko/en synonyms, Korean stems, cwd boost, kind priority, and chat fallback — use
it when the native tool returns nothing or only the saturated `memory_summary.md`.

Native injection limits (not a cxc bug):

- The injected `memory_summary.md` is **not** filtered by the current cwd. Other
  projects' blocks ride along.
- `## User preferences` is promoted from session quotes. The quoted instruction
  may not be this task's authorization. Live AGENTS.md wins.
- Re-search MEMORY.md `applies_to: cwd=` when the summary is too global.

## Optional extra lanes (only if the tool is installed)

These are not part of cxc. Skip the whole section when the binary is missing.

- **Aside** (`aside` on PATH): `aside memory search --json "<q>"`. If the top
  score is below 0.72, treat the semantic lane as a miss. Recover proper nouns
  with `rg --fixed-strings`. Dedupe by `path` (neighbor chunks of the same file
  are not extra evidence).
- **kim_wiki** (`~/kim_wiki/scripts/ask.py` exists):
  `python3 ~/kim_wiki/scripts/ask.py "<q>"`. Do not add entries/raw/nodes scores
  together. If the entries lane is empty, open the detailed document that
  nodes/raw pointed at and confirm with `rg`.

## Scoping memory search to a project

`--cwd <path>` ranks memories recorded under that working directory first; it
does not hide anything else. That is deliberate. The memory store is heavily
concentrated in a few long-running projects, and a worktree checkout typically
owns one summary or none, so a hard filter would answer nothing exactly when you
most need history. A boost puts the project's own memories on top and keeps the
rest reachable below them.

`--cwd-only <path>` is the hard filter, for when unrelated projects are noise
rather than context. When it empties the result, the output says so and points
back at `--cwd`. See "Subagent / managed worktree" before using it on a
Codex-managed worktree.

Scope comes from a rollout summary's `cwd:` frontmatter, and for stage1 rows
from a thread-id join against the Codex state db (`stage1_outputs` stores no
working directory). Curated files such as MEMORY.md carry no cwd at all, so a
chunk that names the path in prose counts as a weaker signal at half the boost
— that is what keeps handbook rules inside a `--cwd-only` result. Prefix
matching is separator-aware: `/repo` never matches `/repo2`. Every hit prints
its `{cwd}` when one is known.

## When memory has nothing

The memory store is consolidated on a delay, so a topic from an hour ago may
have no summary yet. When `cxc memory search` finds no artifact, it answers
from the raw chat corpus instead: up to five session messages, labelled
`(chat/chat)`, with a warning saying the result was substituted. Tool call and
output text is excluded — it matches almost any query and drowns out what was
actually said. Pass `--no-chat` for a memory-only answer.

The backfill never refreshes the sidecar index, so it costs a query rather than
an ingest, and `--cwd-only` stays in force across it.

## Reading results

Text mode prints `[timestamp] (role) «thread title» {cwd}` + excerpt per hit.

Chat `--json` returns `{hits, warnings, scannedFiles, matchedFiles, totalFiles,
elapsedMs, mode, index?, clipped}`. `mode` is `index` (sidecar FTS) or `scan`
(raw JSONL fallback). Pass `--full` to skip 500-char clipping.

Memory `--json` returns `{hits, warnings, scannedFiles, elapsedMs}` only.
There is no `mode` / `totalFiles` field.

Warnings are non-fatal degradations (missing state db, truncation at --limit,
chat fallback) — read them.

## Scope: single Codex home (deliberate non-goal)

Recall searches ONE Codex home per invocation — `$CODEX_HOME ?? ~/.codex`,
overridable per query with `--home <path>`. Cross-home federation is an
explicit non-goal.

## Maintenance

The sidecar index self-refreshes on every chat query (changed files only) unless
`--no-refresh`. `cxc chat index --status` shows freshness; `--rebuild` drops and
re-ingests after schema-level doubts. Deleting `~/.codexclaw/recall/index.sqlite`
is always safe (rebuildable cache).

## Automatic session-start injection

Separate from these commands, the SessionStart hook injects a short CWD-scoped
list of recent sessions, including the start that follows a compaction. That
list rotates: a session already injected several times is pushed back so a
start sees something it has not seen yet. Counts live in the same rebuildable
sidecar, so deleting the index also resets the rotation to plain newest-first.

The rotation applies to the automatic injection ALONE. `cxc chat search` and
`cxc memory search` never consult it: the same query returns the same ranking
however many times you run it. After compaction the same hook re-fires with
`source=compact` and a smaller block plus a recovery pointer; the PostCompact
recall handler itself emits nothing.
````

### 4.3 시놉시스 테스트 NEW

`plugins/codexclaw/test/recall-skill-synopsis.test.mjs` (복붙). 써드파티 import 없음.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const skillMd = readFileSync(join(pluginRoot, "skills", "recall", "SKILL.md"), "utf8");
const cliTs = readFileSync(join(pluginRoot, "components", "recall", "src", "cli.ts"), "utf8");

function flagsIn(text) {
  return [...new Set(text.match(/--[a-z0-9-]+/g) || [])].sort();
}

test("recall SKILL.md Commands fence lists every cli.ts USAGE flag", () => {
  const usage = cliTs.slice(cliTs.indexOf("const USAGE"), cliTs.indexOf("].join"));
  const fence = /## Commands\n\n```\n([\s\S]*?)\n```/.exec(skillMd);
  assert.ok(fence, "SKILL.md has no Commands fence");
  const usageFlags = flagsIn(usage);
  const skillFlags = flagsIn(fence[1]);
  const missing = usageFlags.filter((f) => !skillFlags.includes(f));
  assert.deepEqual(missing, [], `USAGE flags missing from SKILL synopsis: ${missing.join(" ")}`);
});

test("recall SKILL.md no longer claims empty answers are impossible", () => {
  assert.doesNotMatch(skillMd, /empty answer is never the outcome/i);
  assert.doesNotMatch(skillMd, /never modify anything/i);
  assert.match(skillMd, /0 \(full history\) for memory/);
  assert.match(skillMd, /chat index only/i);
  assert.match(skillMd, /Do not use `--any` on a long/);
});
```


### 4.4 docs-site before/after

#### how-it-works.md:36-48

before:

```
Twenty-four registered hook files provide 25 event handlers connecting Codex lifecycle events to state, covering session start,
orchestration, recall injection, pre/post-tool guards, subagent evidence, and compaction
recovery:
...
| `SessionStart` (x6) | provider-bridge, pabcd-bootstrap, feature-healing, map-affordance, recall-context, session-start-detecting-managed-worktree | Detect `ocx` status; bootstrap session state; heal declared soft flags (hard flags require `cxc enable`); announce affordances; inject recall context; check managed-worktree identity. |
| `PreToolUse` (x6) | goal-budget, interview-in-goal, goal-complete, skill-attach, edit-lint, pre-tool-use-guarding-managed-worktree-deletion | Guard goals, deny interview in goal mode, gate goal completion, attach skills to spawns, lint edits, guard managed-worktree deletion. |
| `PostCompact` (x3) | reinject-cursor, recall-context, bg-terminal-affordance | Reset the PABCD reinjection cursor; invoke recall recovery; queue an affordance marker for a later root prompt. |
```

after:

```
Twenty-eight registered hook files provide 29 event handlers connecting Codex lifecycle events to state, covering session start,
orchestration, recall injection, pre/post-tool guards, subagent evidence, and compaction
recovery:
...
| `SessionStart` (x8) | provider-bridge, pabcd-bootstrap, feature-healing, map-affordance, subagent-fallback, recall-context, session-start-detecting-managed-worktree, bg-wake (session-start) | Detect `ocx` status; bootstrap session state; heal declared soft flags (hard flags require `cxc enable`); announce affordances; announce the subagent fallback protocol; inject recall context; check managed-worktree identity. |
| `PreToolUse` (x7) | goal-budget, interview-in-goal, goal-complete, skill-attach, edit-lint, pre-tool-use-guarding-managed-worktree-deletion, pre-tool-use-guarding-memory-write | Guard goals, deny interview in goal mode, gate goal completion, attach skills to spawns, lint edits, guard managed-worktree deletion, deny unsolicited writes under the Codex memories directory. |
| `PostCompact` (x3) | reinject-cursor, recall-context, bg-terminal-affordance | Reset the PABCD reinjection cursor; emit nothing from recall PostCompact (recovery rides SessionStart `source=compact`); queue an affordance marker for a later root prompt. |
```

#### commands.md live 표 + recall sub-grammar

live 표 `cxc memory search` 다음에 한 행:

```
| `cxc memory allow-write` | pabcd-state | Record a one-shot grant so the next memory write in that session passes the PreToolUse memory-write gate (`cxc memory allow-write --session <id>`). |
```

recall grammar after — chat 줄에 `[--rank]`를 `[--recent]` 옆에 넣고, 설명 문단에 아래를 더한다:

```
`--rank` names the default relevance order. Memory `--days` defaults to 0 (full
history); chat `--days` defaults to 7. `cxc enable` turns on
`memories.dedicated_tools` so the native `memories.search` / `read` / `list` /
`add_ad_hoc_note` tools appear. The write tool still needs an explicit user
request or `cxc memory allow-write`.
```

chat 시놉시스 after (commands.md:164-169 교체):

```
cxc chat search "<query>" [--days N] [--cwd PATH] [--role user|assistant|tool] [--source main|subagent|all]
                         [--limit N] [--context N] [--any] [--all] [--no-tools]
                         [--recent] [--rank] [--scan] [--no-refresh] [--json] [--full] [--home PATH]
cxc chat index [--rebuild] [--status] [--json] [--home PATH] [--index-path PATH]
cxc memory search "<query>" [--days N] [--limit N] [--any] [--no-synonyms]
                          [--cwd PATH] [--cwd-only PATH] [--no-chat] [--json] [--home PATH]
cxc memory allow-write --session <id>
```

`--index-path`는 사이트 commands에 이미 있다. 테스트용이라 SKILL에는 안 넣는다. 사이트는 현행 유지.

#### hooks.md:3,6 + 표에 fallback 행

before 제목/도입: "24 hook files and 25 event handlers" / "registers 24 hook files with 25 event handlers".

after: "28 hook files and 29 event handlers" 두 곳 (A 감사 반영: #119 bg-wake 3파일이 계획 이후 들어옴; plugin.json:22-50 기준).

표에서 `pre-tool-use-attaching-skills.json` 다음에 fallback 행을, 표 끝에 bg-wake 3행을 plugin.json 순서대로 넣는다(command/statusMessage/timeout은 각 훅 JSON 원문에서 채운다):

```
| `session-start-announcing-subagent-fallback.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/subagent-config/dist/fallback-dispatch-cli.js" hook session-start` | `(codexclaw) Loading subagent fallback protocol` | 10 s |
| `stop-waking-on-background-completion.json` | `Stop` | — | (plugin.json #119 bg-wake) | see hook JSON | see hook JSON |
| `user-prompt-submit-delivering-background-completions.json` | `UserPromptSubmit` | — | (plugin.json #119 bg-wake) | see hook JSON | see hook JSON |
| `session-start-adopting-background-completions.json` | `SessionStart` | — | (plugin.json #119 bg-wake) | see hook JSON | see hook JSON |
```

PostCompact recall 설명 (hooks.md:105-109)은 이미 silent로 맞다. 표 statusMessage "(codexclaw) Recovering recall context after compaction"은 훅 JSON 원문이므로 표는 유지하고, "What each hook does" 문장에 "statusMessage는 등록 문자열이고 stdout은 빈 문자열"을 한 줄 보탠다. 훅 JSON은 수정하지 않는다.

#### plugin-manifest.md:19 + Registered hooks JSON

`hooks` 셀 after: "Twenty-eight JSON files defining 29 event handlers; one file handles two events".

JSON 배열 after (`plugin.json:22-50`과 동일, 28개; 현행 사이트는 23파일이라 fallback·memory-write·bg-wake 3파일이 빠져 있다):

```json
"hooks": [
    "./hooks/session-start-ensuring-provider-bridge.json",
    "./hooks/session-start-bootstrapping-pabcd-state.json",
    "./hooks/session-start-healing-declared-features.json",
    "./hooks/session-start-announcing-map-affordance.json",
    "./hooks/user-prompt-submit-checking-pabcd-trigger.json",
    "./hooks/stop-checking-pabcd-continuation.json",
    "./hooks/pre-tool-use-guarding-goal-budget.json",
    "./hooks/pre-tool-use-guarding-interview-in-goal.json",
    "./hooks/pre-tool-use-guarding-goal-complete.json",
    "./hooks/post-tool-use-capturing-interview-answers.json",
    "./hooks/subagent-stop-verifying-evidence.json",
    "./hooks/subagent-stop-observing-review.json",
    "./hooks/pre-tool-use-attaching-skills.json",
    "./hooks/session-start-announcing-subagent-fallback.json",
    "./hooks/post-compact-resetting-reinject-cursor.json",
    "./hooks/pre-tool-use-linting-apply-patch.json",
    "./hooks/post-tool-use-tracking-render-observations.json",
    "./hooks/session-start-injecting-recall-context.json",
    "./hooks/post-compact-injecting-recall-context.json",
    "./hooks/post-compact-injecting-bg-terminal-affordance.json",
    "./hooks/user-prompt-submit-detecting-recall-intent.json",
    "./hooks/session-start-detecting-managed-worktree.json",
    "./hooks/user-prompt-submit-guiding-worktree-rename.json",
    "./hooks/pre-tool-use-guarding-managed-worktree-deletion.json",
    "./hooks/pre-tool-use-guarding-memory-write.json",
    "./hooks/stop-waking-on-background-completion.json",
    "./hooks/user-prompt-submit-delivering-background-completions.json",
    "./hooks/session-start-adopting-background-completions.json"
]
```

#### native-tools.md:93 근처 마지막 문단

before:

```
CSV batch fan-out via `spawn_agents_on_csv` and `memories` remain flag-gated and are
documented as future surfaces. V2 is live through catalog selection or the fallback
feature flag; it is not part of this "not shipped" set.
```

after:

```
CSV batch fan-out via `spawn_agents_on_csv` remains flag-gated and is documented as a
future surface. `memories.dedicated_tools` is not: `cxc enable` turns it on so
`memories.search` / `read` / `list` / `add_ad_hoc_note` appear, and `cxc disable`
restores the previous value. The write tool is still denied unless the user asked
to remember something or the session holds a `cxc memory allow-write` grant.
V2 is live through catalog selection or the fallback feature flag; it is not part
of this "not shipped" set.
```

#### index.mdx:151

before: `24 registered files, 25 handlers: `SessionStart` x6, ... `PreToolUse` x7, ...`

after: `28 registered files, 29 handlers: `SessionStart` x8, `UserPromptSubmit` x5, `PreToolUse` x7, `PostToolUse` x2, `Stop` x2, `SubagentStop` x2, `PostCompact` x3.`

#### installation.md:101-102

before: `codexclaw registers 24 hook files containing 25 event handlers.`

after: `codexclaw registers 28 hook files containing 29 event handlers.`

---

## 5. 테스트 계획

| 파일 | 케이스 | 활성화 시나리오 | 관측 |
|---|---|---|---|
| NEW `test/recall-skill-synopsis.test.mjs` | USAGE ⊆ Commands 펜스 | `cli.ts` USAGE 블록에서 `--[a-z0-9-]+`를 뽑고 SKILL Commands 펜스와 비교 | missing 배열 빈 목록. 오늘 기준 실패 집합은 `--full --home --rank` (exit 2). after는 pass |
| 같은 파일 | 금지 문구 | SKILL 본문에 `empty answer is never the outcome`, `never modify anything` | doesNotMatch |
| 같은 파일 | 엔진 분리·days·`--any` | 본문에 memory days=0, "chat index only", 긴 문장에 `--any` 금지 | match |
| 수동 (사다리, 코드 변경 없음) | D3 원문 | `cxc chat search "지난번 로컬 소스를…" --days 0 --limit 3 --json --no-tools --no-refresh` | n=0 (현재도 0, 회귀 기준) |
| 수동 | D3 사다리 | `source dogfooding` / `로컬 소스 서비스` 같은 2-3단어 | n>0, 1위가 09-09 도그푸딩 완료 쪽 (notes/04 §2) |
| 수동 | P2 사다리 | `plugin restart` chat, `BundledPluginsMarketplace` memory | n>0 |
| 수동 | R2 사다리 | `2.49.0 배포 npm` chat | n>0. `2.49.0 provenance`는 n>0이어도 1위가 2.48이면 스킬 검증 규칙의 오인 사례로 남긴다 (코드로 안 고침) |
| 수동 | 서브에이전트 | 위임 작업 질의에 `--source main` vs `--source all` | main이 숨기면 all이 연다 |
| 문서 빌드 | how-it-works 훅 표 | `rg -n "PreToolUse \(x6\)|invoke recall recovery|Twenty-four registered" docs-site/src` | 0건 |
| 문서 빌드 | plugin-manifest 배열 | 사이트 JSON 파일명 집합 == plugin.json hooks | 25==25, fallback·memory-write 포함 |
| 기존 | `manifest-policy.test.mjs` implicit set | recall yaml true | 유지 |
| 기존 | repo-map 500줄 핀 | recall SKILL 줄 수 | ≤500이면 이 핀과 무관하게 pass (핀은 repo-map 전용) |
| 기존 | recall `node --test` | 컴포넌트 스위트 | wp3이 src를 안 바꾸므로 베이스라인과 같아야 한다. 오늘 베이스라인은 §6 |

에이전트 행동 시나리오 (자동 테스트 아님, Check 단계 리뷰):

- 사용자가 "지난번에 그거"라고만 하면 원문 문장을 chat에 넣지 않고 고유명사·2-3단어로 쪼갠 뒤 `--days 0 --no-tools`를 친다.
- 히트가 사용자 "진행할게"이면 완료로 답하지 않고 rollout을 연다.
- 관리형 워크트리에서 `--cwd-only $PWD`를 먼저 치지 않는다 (wp4 전).
- `aside`가 없으면 Aside 절을 건너뛴다.

---

## 6. 검증 명령 (PLAN-VERIFIER-REAL-01)

오늘 2026-09-10, 이 워크트리에서 실행한 결과. wp3이 src를 안 바꾸므로 after도 같은 명령을 다시 돌린다. 시놉시스 테스트만 after에서 0으로 바뀐다.

### 6.1 recall 컴포넌트

```
cd plugins/codexclaw/components/recall && node --test
```

exit **1**. glob: `node --test`가 이 cwd의 `test/*.ts`를 읽는다 (15파일). 실패 1개: `test/chat-fallback.test.ts:176` "cli: memory search falls back to the real chat engine, and --no-chat opts out" — 픽스처 단어 `aardwolf`가 CLI 경로에서 0건. wp3 쓰기 집합 밖. Build는 이 실패를 새 회귀로 보지 않는다. 같은 스위트에서 hook PostCompact silent 케이스(`hook.test.ts`, "post-compact emits nothing")는 pass.

근거 한 줄: 인자가 없으므로 러너가 `plugins/codexclaw/components/recall/test/` 아래를 전부 연다.

### 6.2 dist-freshness

```
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

exit **0** (1 pass, 2182ms). `scripts/test.mjs:9`가 `process.argv.slice(2)`를 `node --test`에 그대로 넘기므로 저 경로 한 파일을 연다. 그 테스트는 `scripts/build.mjs`의 `COMPONENTS`·`listTsFiles`로 각 컴포넌트 `src/*.ts`를 읽고 커밋된 `dist/*.js`와 비교한다. wp3 src 변경이 없으므로 after도 0이어야 한다.

### 6.3 시놉시스 vs USAGE (오늘 한 줄)

```
python3 -c 'from pathlib import Path; import re; root=Path("."); skill=(root/"plugins/codexclaw/skills/recall/SKILL.md").read_text(); cli=(root/"plugins/codexclaw/components/recall/src/cli.ts").read_text(); u=cli[cli.find("const USAGE"):cli.find("].join")]; usage=sorted(set(re.findall(r"--[a-z0-9-]+", u))); m=re.search(r"## Commands\n\n```\n(.*?)\n```", skill, re.S); sk=sorted(set(re.findall(r"--[a-z0-9-]+", m.group(1)))); missing=[f for f in usage if f not in sk]; print("MISSING", " ".join(missing) or "(none)"); raise SystemExit(2 if missing else 0)'
```

오늘 exit **2**, 출력 `MISSING --full --home --rank`. 이 명령은 SKILL.md Commands 펜스와 `cli.ts` `const USAGE` 블록만 읽는다. after 기대: exit 0, `MISSING (none)`. §4.3 테스트가 같은 비교를 node:test로 고정한다.

동치 rg (플래그 추출만, 차집합은 수동):

```
rg -o -- '--[a-z0-9-]+' plugins/codexclaw/components/recall/src/cli.ts
rg -o -- '--[a-z0-9-]+' plugins/codexclaw/skills/recall/SKILL.md
```

### 6.4 docs-site 빌드

`docs-site/package.json` scripts.build = `astro build`. 오늘 `docs-site`에 node_modules가 없어 `npm ci --ignore-scripts`(exit 0, 473 packages) 뒤 `npm run build`를 실행했다.

exit **0**. 26 page(s), how-it-works / commands / hooks / plugin-manifest / native-tools / installation / index가 모두 생성됨. 경고: `Entry docs → 404 was not found` (기존). 이 명령은 `docs-site/src/content/docs/**`를 읽어 `docs-site/dist/`에 쓴다. after도 exit 0.

잔여 문자 스윕 after 기대 0건:

```
rg -n "Twenty-four registered|24 hook files|24 registered files|PreToolUse \(x6\)|invoke recall recovery|memories remain flag-gated" docs-site/src
```

### 6.5 줄 수 상한 (after)

```
wc -l plugins/codexclaw/skills/recall/SKILL.md
```

오늘 148. after 본문 262줄 / 13904바이트 (≤500). 500을 넘기면 카탈로그 최장 스킬과 같은 수가 되므로 사다리를 references/로 나눈다. repo-map 500줄 핀은 repo-map 전용이다.

---

## 7. dist 재생성

src를 고치지 않는다. `dist-freshness`가 비교하는 `plugins/codexclaw/components/*/dist/*.js`는 이 커밋에서 그대로다. `npm run build`를 같은 커밋에 담을 대상 없음. 스킬 md·docs-site md·테스트 mjs만 커밋한다.

설치 캐시 스킬 바이트는 머지 후 재설치 때까지 구본이다. Check 단계: 재설치 후 캐시 `skills/recall/SKILL.md`와 워크트리 파일이 `diff` 0행.

---

## 8. 위험·롤백

- 스킬이 길어지면 매 회수 컨텍스트가 는다. 280줄은 현행 search(241)·interview(230)와 같은 대역. 500을 넘기면 사다리·외부 레인을 `references/ladder.md`로 옮긴다.
- wp4 전/후 문구가 한 파일에 공존한다. wp4가 전 문구를 안 지우면 에이전트가 모순된 cwd 규칙을 읽는다. wp4 decade가 이 파일의 "Until wp4" 삭제를 IN에 넣어야 한다.
- Aside 0.72는 notes/06이 "재측정 필요"라고 적은 값이다. 엔진이 바뀌면 스킬 숫자만 고친다. 미설치 호스트는 그 절을 건너뛴다.
- 훅 JSON을 이 PR에서 고치면 trusted_hash 불일치가 실행 이슈로 번진다. 문서만 고친다.
- 롤백: 해당 파일 git revert. 훅·dist·config.toml은 손대지 않았으므로 설치본 동작은 스킬 본문이 구버전으로 돌아가는 것 외에 변하지 않는다. 재설치 전에는 캐시 스킬이 신본/구본 중 설치 시점 것이다.

`chat-fallback.test.ts:176` 베이스라인 실패는 wp3이 고치지 않는다. 이 실패가 머지 게이트를 막으면 별 이슈로 연다.

---

## 9. PR 제목·본문 초안

제목:

`docs(recall): rewrite cxc-recall skill against the live CLI and close docs-site L0 leftovers`

본문:

```
## Summary

cxc-recall SKILL.md claimed empty answers never happen, that both engines use
trigram FTS, and that chat/memory share one JSON schema. None of that matches
cli.ts / chat-search.ts / memory-search.ts. The rewrite lists the live USAGE
flags, splits the two engines, and adds the natural-language → keyword ladder
that already recovers the three eval sentences as `source dogfooding` /
`plugin restart` / `2.49.0 배포 npm`.

docs-site still said 24 hook files / 25 handlers and "invoke recall recovery"
on PostCompact. plugin.json has 28 files / 29 handlers; recall PostCompact
returns "". This PR also documents `cxc memory allow-write`, `--rank`, and
`memories.dedicated_tools` auto-enable.

## Stack

This repo's enforce-pr-target forces every PR onto `dev`. Stacking is the
local branch chain plus merge order, not GitHub `base`.

| order | phase | branch (proposed) | PR base | merge after |
|---:|---|---|---|---|
| 1 | wp1 memory-write gate | codex/memory-l1-wp1-gate | dev | — |
| 2 | wp2 symbol-boundary | codex/memory-l1-wp2-symbol | dev | — |
| 3 | wp3 skill + docs-site | codex/memory-l1-wp3-recall-skill | dev | wp1·wp2 문구가 스킬과 안 싸우는지만 확인. 코드 의존 없음 |
| 4 | wp4 identity key | (later) | dev | 이 PR의 "Until wp4" 문단을 삭제 |

## Test plan

- [ ] `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/recall-skill-synopsis.test.mjs`
- [ ] `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/dist-freshness.test.mjs`
- [ ] `cd plugins/codexclaw/components/recall && node --test` (baseline: chat-fallback.test.ts:176 fail)
- [ ] `cd docs-site && npm run build`
- [ ] USAGE vs SKILL flag set empty
- [ ] ladder rewrites of the three eval sentences are n>0
```

## 검증 명령 정정 (메인, 2026-09-10 07:25)

이 문서가 기록한 recall 컴포넌트 `node --test` exit 1(`chat-fallback.test.ts:176`)은 코드 결함이 아니라 러너 미사용 탓이다. 그 테스트는 memory→chat 폴백이 사이드카 인덱스를 읽는데, `CODEXCLAW_HOME`을 덮지 않으면 사용자 실인덱스(12GB)를 읽어 합성 픽스처 `aardwolf`를 못 찾는다. 레포 러너 `plugins/codexclaw/scripts/test.mjs`(`CODEXCLAW_HOME`을 임시 디렉터리로 덮음, test.mjs:7-11)로 돌리면 9/9 통과, exit 0이다(메인 세션 실측). 이후 모든 C 단계 검증은 다음 형태를 쓴다.

```bash
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/<comp>/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

## A 감사 반영 (round 1, 2026-09-10)

blocker #5(030↔040 계약): 이 문서가 wp4에 요구한 "Until wp4" 문단 삭제를 040 §1 IN에 넣었다(040의 A 감사 반영 참조). wp3 머지 시점의 SKILL.md는 "`--cwd`는 접두사 부스트만 하므로 관리형 워크트리에서는 `--cwd-only`에 메인 체크아웃 경로를 넘겨라"를 담고, wp4가 그 문단을 "같은 git origin의 세션을 함께 묶는다"로 교체한다. 두 문구가 동시에 존재하는 커밋은 없다.

검증 명령 정정: §6.1의 `cd <comp> && node --test`는 레포 러너 형태로 읽는다(문서 말미 정정 블록).


## P 재검증 (wp3 사이클, 2026-09-10)

기준 트리 `e23e1285`(origin/dev, #124·#125 머지 직후). 계획 이후 바뀐 대상은 `docs-site/.../reference/hooks.md`뿐이며(wp1이 Pre-tool guards 목록에 memory-write 항목 7줄 추가), §4.4의 hooks.md 변경(제목 개수 28/29, subagent-fallback 표 행, PostCompact 문장)과 겹치지 않는다. §2.1의 "Pre-tool guards에 memory-write가 없다"는 wp1로 해소됐으므로 이 사이클은 그 항목을 다시 넣지 않는다. SKILL.md·cli.ts USAGE·나머지 docs-site 파일은 계획 시점과 동일. wp1(게이트)·wp2(심볼 경계)가 dev에 있으므로 SKILL.md 문구("--cwd-only는 wp4 전까지 메인 체크아웃 경로", 심볼 경계·완화 설명)를 그대로 확정한다. 브랜치 `codex/memory-l1-wp3-skill`(origin/dev 위).



## A 감사 반영 (wp3 round 1, 2026-09-10)

리뷰어(grok-4.6) FAIL 3 + Medium 1을 본문(§4.2 SKILL 전문, §4.4)에 접었다.

1. Two engines: 심볼 목록에 dotted VERSION(`2.49.0`, `v2.49.0`, 파일명 규칙보다 먼저)과 v접두 경계 예외를 넣고, 완화 재시도를 "전체 0건일 때 코퍼스 어디에도 없는 경계 그룹만 substring, 잡힌 그룹은 경계 유지(`3956 LSP`에서 LSP는 NaiControlsPanel에 안 붙음)"로 고쳤다(#125 동작).
2. `chat index only`를 한 줄 평문으로 바꿔 §4.3 테스트 정규식과 맞췄다.
3. 훅 개수: 계획 이후 #119(bg-wake 3파일: `stop-waking-on-background-completion`, `user-prompt-submit-delivering-background-completions`, `session-start-adopting-background-completions`)가 들어와 plugin.json은 28파일/29핸들러다. §4.4의 after를 28/29와 이벤트 분해(SessionStart 8, UserPromptSubmit 5, Stop 2, PreToolUse 7, PostToolUse 2, SubagentStop 2, PostCompact 3)로 고쳤고, hooks.md 표에는 fallback 행 외에 bg-wake 3행을, plugin-manifest.md JSON 배열은 `plugin.json:22-50` 전체(28개)를 그대로 복사한다. P 재검증이 plugin.json을 안 본 것이 원인이다.
4. Medium: Commands 절의 BM25/RRF 문장을 chat 한정으로 고치고 memory는 자체 청크 점수라고 명시했다.

