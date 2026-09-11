# 060 — wp6: 네이티브 통합 보강

날짜: 2026-09-10 (KST). 워크트리 `/Users/jun/.codex/worktrees/3412/codexclaw`, HEAD `369ed0e1` (브랜치 `codex/memory-l1-wp0-roadmap`, 작성 시 `origin/dev`와 동일 트리).
이 문서는 diff-level 구현 설계서다. 코드는 바꾸지 않았다.

근거: [000_plan.md](000_plan.md), [001_web-survey.md](001_web-survey.md) §3 S1~S5, [notes/03_hook-runtime-audit.md](notes/03_hook-runtime-audit.md), [notes/08_carryover-backlog.md](notes/08_carryover-backlog.md).
000_plan의 원래 wp6은 관측만이었다. 웹 조사가 확정한 구현 범위는 001 §3 마지막 행이다: source별 브리핑(S3), 훅 출력 형식 회귀(S2), 프롬프트 엔티티 추출 후 표적 회수(S1 UserPromptSubmit), 신선도·정정 표기(S5).

항목 네 개. 검색 랭킹·인덱스 스키마·네이티브 memories 재구현·백그라운드 워커는 열지 않는다.

---

## 1. 목적과 범위

목적: 이미 도는 recall 훅과 memory search 출력 위에, 모델이 회수 도구를 쓰도록 안내를 맞추고, 검색 결과를 시간 축에서 읽을 수 있게 하며, 훅 stdout이 다시 깨지지 않게 테스트·doctor로 고정한다.

IN

- (1) SessionStart 브리핑을 `source`(startup / resume / compact)별로 형태 분기. 끝에 회수 안내 한 줄. `memories.dedicated_tools=true`이면 도구명 `memories.search`, 아니면 `cxc` 명령. 예산 초과 금지. cwd 히트 0이면 안내문만.
- (2) UserPromptSubmit recall-intent: 프롬프트에서 고유명사·파일명·버전·오류 문자열을 뽑아 표적 회수 제안 한 줄. 검색은 실행하지 않음. 훅 지연 목표 <100ms (S1 실측 UserPromptSubmit 12ms/25ms). 트리거 어휘 확장.
- (3) memory search 텍스트 출력에 `[age: Nd]`. 같은 주제의 더 최신 히트가 결과 집합 안에 있으면 `[newer: <relpath>]`. format 계층만. `rankAndTrim` 불변.
- (4) 모든 recall 훅 핸들러 stdout이 빈 문자열 또는 유효 JSON. `cxc doctor`가 `hooks.state` `trusted_hash`와 현재 훅 매니페스트 해시를 비교하고, 불일치는 WARN (PLAN-BYPASS-NAMED-01). FAIL 아님.

OUT

- cwd 정확 일치에서 git remote 정체성 키로 가는 일 (wp4, T4). `cwd-context.ts:84-92`는 읽기만.
- 자연어 질의 재작성·동의어 기본값 (wp5).
- 네이티브 요약 포화 (wp7). `use_memories=false` 일괄 off.
- PostCompact additionalContext 부활. `handlePostCompact`는 빈 문자열 유지 (`hook.ts:549-551`, T1).
- 임베딩, 백그라운드 워커, 네이티브 `memories.search` 재구현 (001 §4, 08 §5.4).
- `cxc memory doctor` 신설 (08 D1). 기존 `cxc doctor` 항목만 추가.
- 훅 JSON `timeout`/`statusMessage` 변경. 바꾸면 `identityHash`가 달라져 전 훅 drift가 난다 (`hook-trust.ts:101-131`).

---

## 2. 현재 코드

인용은 2026-09-10 HEAD `369ed0e1` 실측. notes의 행 번호와 같다.

### 2.1 SessionStart — compact만 분기, 안내문은 항상 나감

`handleSessionStart`는 `source === "compact"`일 때만 예산·문구가 바뀐다. `startup` / `resume` / `clear` / undefined는 같은 availability notice다.

`plugins/codexclaw/components/recall/src/hook.ts:499-530`:

```ts
export function handleSessionStart(status: string, cwd?: string, source?: string): string {
  const parts: string[] = [];
  const compacted = source === "compact";
  if (cwd) {
    const cwdCtx = buildCwdContext(cwd, DEFAULT_RECALL_DEPS, compacted ? COMPACTED_BUDGET : FULL_BUDGET);
    if (cwdCtx) parts.push(cwdCtx);
  }
  const cxc = CXC();
  const notice = compacted
    ? [
        "[cxc-recall] Context was just compacted. If any earlier detail is now missing,",
        "recover it from past sessions before asking the user to repeat themselves:",
        `  ${cxc} chat search "<distinctive terms>" --days 0 --context 2`,
        `  ${cxc} memory search "<topic>"`,
      ]
    : [
        "[cxc-recall] Past-session recall is available (read-only). Before asking the user",
        "about prior work — unfamiliar terms, lost context, \"그때/지난번/last time\" — run:",
        `  ${cxc} chat search "<terms>" --days 0   |   ${cxc} memory search "<topic>"`,
      ];
  if (status !== "") notice.push(`Index: ${status}. Details: $cxc-recall.`);
  else notice.push("Details: $cxc-recall.");
  parts.push(notice.join("\n"));
  return buildContextOutput("SessionStart", parts.join("\n\n"));
}
```

예산 상수: `FULL_BUDGET = { chars: 1400, topN: 5, snippet: 100 }` (`hook.ts:164`), `COMPACTED_BUDGET = { chars: 800, topN: 2, snippet: 100 }` (`hook.ts:172`). 예산은 `buildCwdContext` → `renderCwdBlock`에만 걸린다. notice는 예산 밖이다.

히트 0: `renderCwdBlock`은 body가 없으면 빈 문자열 (`hook.ts:318-319`). `handleSessionStart`는 cwd 블록이 비어도 notice를 붙인다. notes/03 §2: 이 창 SessionStart 주입 빈 문자열 0건, availability-notice 42건은 항상 342바이트.

`source=compact` 런타임: notes/03 §2. jsonl에 `source: compact` 필드 0건. 본문 `[cxc-recall] Context was just compacted`로만 확인. 같은 창 compact 2건 중 1건만 SessionStart가 재점화됨 (`01a08643` 있음, `01a08663` 없음). 훅은 source가 오면 분기하고, 런타임이 안 주면 못 탄다.

`dedicated_tools`: 훅은 설정 파일을 읽지 않는다. 설치가 키를 켠다 (`managed-keys.ts:68-77`, `memories/{list,read,search,add_ad_hoc_note}`). 안내문은 항상 `cxc chat/memory search`.

### 2.2 UserPromptSubmit — 관용구 매칭 후 고정 지시문

`RECALL_PATTERNS` (`hook.ts:76-93`): `그때`는 `그|한|했|만든|작업`이 뒤따라야 한다. `지난\s*번`, `지난\s*세션`, `저번\s*(에|세션|주|것|거)`, `last\s+(time|session|week)` 등은 이미 있다. `그때` 단독, `이전에 했`, `prior work`는 없다.

`handleUserPromptSubmit` (`hook.ts:136-145`)는 `detectRecallIntent`가 참이면 `buildDirective()`만 넣는다. 프롬프트 토큰을 뽑지 않고 검색도 하지 않는다.

`plugins/codexclaw/components/recall/src/hook.ts:110-141`:

```ts
function buildDirective(): string {
  const cxc = CXC();
  return [
    "[cxc-recall] The prompt references past work. Before asking the user to re-explain,",
    "search prior sessions (read-only):",
    `  ${cxc} chat search "<distinctive terms>" --days 0   # full-history FTS over ~/.codex`,
    `  ${cxc} memory search "<topic>"                      # durable per-thread summaries`,
    "Add --context 2 to read around a hit, --cwd <repo> to scope. Details: $cxc-recall.",
  ].join("\n");
}

export function handleUserPromptSubmit(payload: UserPromptSubmitPayload): string {
  try {
    if (payload.hook_event_name !== "UserPromptSubmit") return "";
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    if (!detectRecallIntent(prompt)) return "";
    return buildContextOutput("UserPromptSubmit", buildDirective());
  } catch {
    return "";
  }
}
```

notes/03 §2: user-prompt-nudge 25건, 항상 367바이트. S1은 UserPromptSubmit을 큐에 넣고 즉시 반환(<100ms). 우리는 검색을 열지 않음으로 그 예산을 지킨다.

### 2.3 검색 출력 — 절대 시각만, 주제 정정 없음

`plugins/codexclaw/components/recall/src/format.ts:52-66`:

```ts
export function formatMemoryResult(result: MemorySearchResult): string {
  const lines: string[] = [];
  lines.push(`# ${result.hits.length} memory hits (${result.scannedFiles} files scanned, ${result.elapsedMs}ms)`);
  if (result.hits.length === 0) lines.push("(no matches)");
  for (const hit of result.hits) {
    lines.push("");
    const loc = hit.startLine !== null ? `${hit.relpath}:${hit.startLine}` : hit.relpath;
    const when = hit.updatedAt ? ` [${hit.updatedAt}]` : "";
    const cwd = hit.cwd ? ` {${hit.cwd}}` : "";
    lines.push(`(${hit.origin}/${hit.kind}) ${loc}${when}${cwd}`);
    lines.push(clip(hit.excerpt, EXCERPT));
    lines.push("---");
  }
  appendWarnings(lines, result.warnings);
  return lines.join("\n");
}
```

`MemoryHit.updatedAt`는 ISO 문자열 (`memory-search.ts:438, 540, 619`). `rankAndTrim` (`memory-search.ts:203-218`)은 score desc, 동점이면 `updatedAt` desc. 08 S1 `stale_after`/`verify_live`는 없다. P1-4 신선도 라벨은 주입 블록 `PAST SNAPSHOT as of ${latestDate}` (`hook.ts:294-297`)뿐이고 검색 랭킹·요약 합성에는 없다.

### 2.4 훅 stdout 계약과 doctor

봉투: `buildContextOutput` (`hook.ts:123-133`)는 본문이 있으면 `JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext } })` 뒤에 개행, 빈 본문은 빈 문자열. PostCompact는 항상 빈 문자열 (`hook.ts:549-551`). CLI `runHook` (`cli.ts:218-239`)는 파싱 실패 시 0으로 종료하고 stdout을 안 쓴다.

S2 (claude-mem #621): ANSI/비JSON stdout이 SessionStart를 깨뜨림. 우리 회귀 테스트는 핸들러 단위 문구 매칭만 있고 (`hook.test.ts:55-104`), 빈 문자열 또는 유효 JSON 불변식은 없다. `hook-e2e.test.mjs`는 recall 훅 파일 세 개를 호출하지 않는다.

doctor `hook-trust` (`doctor.ts:440-489`): `diagnoseHookTrust`가 identityHash와 config `trusted_hash`를 비교한다. identityHash는 훅 JSON 파일 sha256이 아니라 event+matcher+handler canonical JSON의 sha256이다 (`hook-trust.ts:101-131`). drifted/untrusted는 지금 FAIL (`doctor.ts:475`). 테스트가 FAIL을 고정한다 (`hook-trust.test.ts:240-256, 538-543`).

notes/03 §1: 다섯 recall 훅 모두 config `trusted_hash`와 현재 JSON 파일 sha256이 불일치인데 훅은 실행된다 (메인 세션 L9 additional_context, L97 MEMORY-WRITE-GATE). 해시 입력 바이트열은 unknown. 불일치가 실행을 막지 않으므로 doctor가 이 불일치를 FAIL로 올리면 설치 직후 항상 빨간 불이 된다.

### 2.5 cwd-context (변경 없음, 인용만)

`listCwdSessions`는 `WHERE cwd = ? AND source = 'main'` 정확 일치 (`cwd-context.ts:84-92`). 관리형 워크트리 첫 슬롯은 cwd 블록이 비고 notice만 남는다 (notes/03 §7). T4는 wp4.

---

## 3. 변경 파일 맵

| 파일 | NEW/MODIFY/DELETE | 변경 요지 | 예상 줄수 |
|---|---|---|---|
| `plugins/codexclaw/components/recall/src/hook.ts` | MODIFY | source별 notice, dedicated_tools 안내 한 줄, `extractRecallTargets`, 트리거 어휘, SessionStart opts | +90 / ~15 |
| `plugins/codexclaw/components/recall/src/format.ts` | MODIFY | `[age: Nd]` · `[newer: relpath]` 텍스트 라벨. hits 배열 순서 불변 | +55 |
| `plugins/codexclaw/components/recall/src/cli.ts` | — | `handleSessionStart`에 source 전달은 이미 있음 (`cli.ts:228-229`). dedicatedTools 읽기는 hook.ts 내부 | 0 |
| `plugins/codexclaw/components/cxc-ops/src/doctor.ts` | MODIFY | `hook-trust` drifted → WARN. evidence에 file sha256. untrusted(항목 없음)는 FAIL 유지 | ~20 |
| `plugins/codexclaw/components/cxc-ops/src/hook-trust.ts` | MODIFY | `HookTrustResult`에 훅 JSON 파일 sha256 필드 | ~15 |
| `plugins/codexclaw/components/recall/test/hook.test.ts` | MODIFY | source 3형태, 회수 안내, 엔티티 줄, stdout 계약, 트리거 확장 | +90 |
| `plugins/codexclaw/components/recall/test/format-freshness.test.ts` | NEW | age/newer 라벨, 랭킹 불변 | ~90 |
| `plugins/codexclaw/components/cxc-ops/test/hook-trust.test.ts` | MODIFY | drifted 기대를 FAIL→WARN. file_sha256 evidence | ~25 |
| `plugins/codexclaw/components/recall/src/cwd-context.ts` | — | 변경 없음 | 0 |
| `plugins/codexclaw/components/recall/src/memory-search.ts` | — | 변경 없음 (랭킹 불변) | 0 |
| `plugins/codexclaw/hooks/session-start-injecting-recall-context.json` | — | 변경 없음 (timeout/statusMessage 유지) | 0 |
| `plugins/codexclaw/hooks/user-prompt-submit-detecting-recall-intent.json` | — | 변경 없음 | 0 |
| `plugins/codexclaw/hooks/post-compact-injecting-recall-context.json` | — | 변경 없음. statusMessage는 구식이지만 identityHash 고정 | 0 |
| `plugins/codexclaw/components/recall/dist/hook.js` | MODIFY | `npm run build` 동봉 | src 대응 |
| `plugins/codexclaw/components/recall/dist/format.js` | MODIFY | 동봉 | src 대응 |
| `plugins/codexclaw/components/cxc-ops/dist/doctor.js` | MODIFY | 동봉 | src 대응 |
| `plugins/codexclaw/components/cxc-ops/dist/hook-trust.js` | MODIFY | 동봉 | src 대응 |

TypeScript 규칙: 써드파티 import 금지. 소스 import는 `../src/x.ts`처럼 확장자 포함. 테스트는 `node:test` + `node:assert/strict`. recall이 config-guard를 import하지 않는다.

---

## 4. 변경 상세

### 4.1 SessionStart source 분기 + 회수 안내 한 줄

활성화 (C-ACTIVATION-GROUNDING-01)

| 입력 | 분기 | 관측 |
|---|---|---|
| stdin `source: "startup"` (또는 생략/`clear`), cwd 히트 ≥1 | FULL_BUDGET cwd 블록 + startup notice + 회수 한 줄 | additionalContext에 `Recent work`, `PAST SNAPSHOT`, 회수 한 줄. compact 문구 없음 |
| `source: "resume"`, cwd 히트 ≥1 | FULL_BUDGET cwd 블록 + resume notice + 회수 한 줄 | Resuming/pause 계열. `compacted` 없음 |
| `source: "compact"`, cwd 히트 ≥1 | COMPACTED_BUDGET (topN=2) + compact notice + 회수 한 줄 | `Context was just compacted`. 세션 줄 ≤2. cwd 블록 ≤800 |
| 위 세 source, cwd 히트 0 | cwd 블록 없음 | 안내문(+Index)만. `<untrusted-recall-data>` 없음 |
| config `[memories] dedicated_tools = true` | 회수 한 줄이 `memories.search` | `cxc memory search` 병기 가능. `add_ad_hoc_note` 안 적음 |
| dedicated_tools false/부재/파싱 실패 | 회수 한 줄이 `cxc chat search` / `cxc memory search` | 훅 fail-open |

before: §2.1 인용.

after (`hook.ts`). `handleSessionStart`에 선택 opts를 더해 테스트가 실기 config를 안 읽게 한다. 기존 `import { existsSync } from "node:fs"` (`hook.ts:31`)에 `readFileSync`를 더하고, `basename` import (`hook.ts:32`)에 `join`을 더한다.

```ts
const RECOVERY_LINE_BUDGET = 160;

export interface SessionStartOptions {
  /** Injected in tests. Absent → read CODEX_HOME/config.toml fail-open. */
  dedicatedTools?: boolean;
}

import { codexHome } from "./paths.ts";

export function dedicatedToolsEnabled(home?: string): boolean {
  try {
    // A2 (audit round 1): resolve through paths.ts codexHome() ($CODEX_HOME ?? ~/.codex);
    // an unset CODEX_HOME must not disable the branch.
    const root = home ?? codexHome();
    const text = readFileSync(join(root, "config.toml"), "utf8");
    const body = memoriesTableBody(text);
    if (body === null) return false;
    return /^[ \t]*dedicated_tools[ \t]*=[ \t]*true[ \t]*(?:#.*)?$/m.test(body);
  } catch {
    return false;
  }
}

function memoriesTableBody(text: string): string | null {
  const rows = text.split(/\r?\n/);
  const start = rows.findIndex((l) => /^[ \t]*\[memories\][ \t]*(?:#.*)?$/.test(l));
  if (start === -1) return null;
  const rest = rows.slice(start + 1);
  const end = rest.findIndex((l) => /^[ \t]*\[/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

function recoveryLine(cxc: string, dedicatedTools: boolean): string {
  const line = dedicatedTools
    ? `Recall: memories.search "<topic>" (native). Also: ${cxc} memory search "<topic>"`
    : `Recall: ${cxc} chat search "<terms>" --days 0  |  ${cxc} memory search "<topic>"`;
  return line.length <= RECOVERY_LINE_BUDGET ? line : line.slice(0, RECOVERY_LINE_BUDGET);
}

function sessionNotice(
  source: string | undefined,
  cxc: string,
  status: string,
  dedicatedTools: boolean,
): string {
  const src = source ?? "startup";
  const head =
    src === "compact"
      ? [
          "[cxc-recall] Context was just compacted. If any earlier detail is now missing,",
          "recover it from past sessions before asking the user to repeat themselves.",
        ]
      : src === "resume"
        ? [
            "[cxc-recall] Resuming this session. Prior context may be incomplete after a pause.",
            "Before asking the user to re-explain, recover from past sessions.",
          ]
        : [
            "[cxc-recall] Past-session recall is available (read-only). Before asking the user",
            "about prior work — unfamiliar terms, lost context, \"그때/지난번/last time\" — recover it.",
          ];
  const out = [...head, recoveryLine(cxc, dedicatedTools)];
  if (status !== "") out.push(`Index: ${status}. Details: $cxc-recall.`);
  else out.push("Details: $cxc-recall.");
  return out.join("\n");
}

export function handleSessionStart(
  status: string,
  cwd?: string,
  source?: string,
  opts: SessionStartOptions = {},
): string {
  const parts: string[] = [];
  const compacted = source === "compact";
  if (cwd) {
    const cwdCtx = buildCwdContext(
      cwd,
      DEFAULT_RECALL_DEPS,
      compacted ? COMPACTED_BUDGET : FULL_BUDGET,
    );
    if (cwdCtx) parts.push(cwdCtx);
  }
  const dedicatedTools = opts.dedicatedTools ?? dedicatedToolsEnabled();
  parts.push(sessionNotice(source, CXC(), status, dedicatedTools));
  return buildContextOutput("SessionStart", parts.join("\n\n"));
}
```

예산: cwd 블록은 기존 `renderCwdBlock` all-or-nothing. notice는 예산 밖이되 회수 한 줄은 160자 이내. compact 실측 907자(notes/03 §2) + 160 < MAX_CTX 32768 (`hook.ts:121`). cwd topN은 안 줄인다. `clear`는 startup과 같은 형태 (기존 테스트 `hook.test.ts:98-102`). `fork`는 Codex 스키마에 없다 (001 S3).

`cli.ts:228-229`는 이미 `payload.source`를 넘긴다. 시그니처 네 번째 인자는 기본값이라 CLI 변경 없음.

### 4.2 UserPromptSubmit 표적 회수 제안 (검색 없음)

활성화

| 입력 | 분기 | 관측 |
|---|---|---|
| `지난번 2.49.0 provenance 검증` | intent 참, 엔티티 추출 | additionalContext에 기존 지시문 + `Suggested recall terms: 2.49.0 provenance` 한 줄. 검색 히트/Index/excerpt 없음 |
| `그때 hook.ts MEMORY-WRITE-GATE` | intent 참 | terms에 `hook.ts`, `MEMORY-WRITE-GATE` |
| `add a --json flag` | intent 거짓 | 빈 문자열 |
| `run cxc chat search "trigram"` | ALREADY_RECALLING | 빈 문자열 |
| 8KB 프롬프트 + intent 참 | 정규식만 | `extractRecallTargets` <20ms. searchMemory/searchChat/openIndex 미호출 |

트리거 확장. 지금 이미 잡는 것: `그때 그 작업`, `지난번`, `지난 세션`, `저번 세션`, `예전에 만든`, `기억나`, `뭐였지`, `last time`, `last session`, `what did we do`, `remember when`, `discussed previously` (`hook.ts:77-92`, `hook.test.ts:18-40`, `round2.test.ts:78-80`).

`RECALL_PATTERNS` 배열 끝에 추가:

```ts
  /이전에\s*(하|했|만든|작업|얘기|말)/,
  /그\s*세션/,
  /그때에(?:는|도)?/,
  /\bprior\s+(work|session|conversation)\b/i,
  /\ba\s+while\s+ago\b/i,
```

`그때` 단독은 넣지 않는다. `그때 그 작업`은 기존 78행이 잡는다.

엔티티 추출. `query-words.ts`의 `isSymbolWord`는 `2.49.0`을 FILENAME으로 본다 (`query-words.ts:55`). 그건 wp2 범위라 여기서 고치지 않고, 추출기는 자체 정규식을 쓴다.

```ts
const VERSION_RE = /\b\d+\.\d+(?:\.\d+)?\b/g;
const FILE_RE = /\b[\w.-]+\.(?:ts|tsx|js|mjs|cjs|json|md|toml|py|rs)\b/g;
const ERROR_RE = /\b(?:[A-Z]{2,}(?:-[A-Z0-9]+)+|ERR_[A-Z0-9_]+)\b/g;
const CAMEL_RE = /\b[A-Z][a-zA-Z]*[A-Z][A-Za-z0-9]*\b/g;
const QUOTED_RE = /["'`]([^"'\n]{3,60})["'`]/g;
const TARGET_STOP = new Set([
  "그때", "지난번", "지난", "저번", "예전", "세션", "작업", "기억", "뭐였지",
  "last", "time", "session", "previous", "previously", "remember",
]);

export function extractRecallTargets(prompt: string, cap = 4): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = raw.trim();
    if (t.length < 2 || t.length > 60) return;
    const key = t.toLowerCase();
    if (TARGET_STOP.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };
  for (const re of [VERSION_RE, FILE_RE, ERROR_RE, CAMEL_RE]) {
    re.lastIndex = 0;
    for (const m of prompt.matchAll(re)) push(m[0]);
  }
  QUOTED_RE.lastIndex = 0;
  for (const m of prompt.matchAll(QUOTED_RE)) push(m[1]);
  return out.slice(0, cap);
}

function buildDirective(targets: readonly string[] = []): string {
  const cxc = CXC();
  const rows = [
    "[cxc-recall] The prompt references past work. Before asking the user to re-explain,",
    "search prior sessions (read-only):",
    `  ${cxc} chat search "<distinctive terms>" --days 0   # full-history FTS over ~/.codex`,
    `  ${cxc} memory search "<topic>"                      # durable per-thread summaries`,
    "Add --context 2 to read around a hit, --cwd <repo> to scope. Details: $cxc-recall.",
  ];
  if (targets.length > 0) {
    rows.push(`Suggested recall terms: ${targets.join(" ")} (search not run by this hook).`);
  }
  return rows.join("\n");
}

export function handleUserPromptSubmit(payload: UserPromptSubmitPayload): string {
  try {
    if (payload.hook_event_name !== "UserPromptSubmit") return "";
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    if (!detectRecallIntent(prompt)) return "";
    return buildContextOutput("UserPromptSubmit", buildDirective(extractRecallTargets(prompt)));
  } catch {
    return "";
  }
}
```

검색 금지: 이 함수 경로에 `searchChat` / `searchMemory` / `openIndex` / `listCwdSessions` 호출이 있으면 구현 오류. UserPromptSubmit timeout 5초 훅 JSON은 그대로 둔다 (`user-prompt-submit-detecting-recall-intent.json`).

### 4.3 format 계층 신선도·정정 라벨

활성화

| 입력 | 분기 | 관측 |
|---|---|---|
| hit.updatedAt = now-3d | age | 헤더에 `[age: 3d]`. ISO `[updatedAt]`는 유지 |
| hit.updatedAt null | age 생략 | `[age:` 없음 |
| 결과 집합에 같은 주제 토큰(버전/파일/CamelCase)을 공유하고 updatedAt이 더 최신인 다른 relpath | newer | 오래된 히트 헤더에 `[newer: MEMORY.md]` 형태. 최신 히트에는 newer 없음 |
| 두 히트가 주제를 안 나눔 | newer 생략 | 랭킹 순서 = 입력 hits 순서 |
| JSON `--json` | format 미적용 | MemoryHit 필드 그대로. age/newer 키 추가 금지 |

before: §2.3.

after (`format.ts`). `searchMemory` / `rankAndTrim` / `MemoryHit` 타입은 안 만진다.

```ts
const TOPIC_TOKEN = /\b\d+\.\d+(?:\.\d+)?\b|\b[\w.-]+\.(?:ts|tsx|js|mjs|json|md)\b|\b[A-Z][a-zA-Z]*[A-Z][A-Za-z0-9]*\b/g;

export function ageDays(updatedAt: string | null, nowMs: number): number | null {
  if (!updatedAt) return null;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000));
}

function topicTokens(hit: MemoryHit): Set<string> {
  const bag = `${hit.relpath} ${hit.excerpt}`;
  const out = new Set<string>();
  TOPIC_TOKEN.lastIndex = 0;
  for (const m of bag.matchAll(TOPIC_TOKEN)) out.add(m[0].toLowerCase());
  return out;
}

function sharesTopic(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

/** Pure labels. Does not sort or copy score. */
export function newerRelpath(hit: MemoryHit, hits: readonly MemoryHit[]): string | null {
  if (!hit.updatedAt) return null;
  const mine = Date.parse(hit.updatedAt);
  if (!Number.isFinite(mine)) return null;
  const myTopic = topicTokens(hit);
  if (myTopic.size === 0) return null;
  let best: MemoryHit | null = null;
  let bestTs = mine;
  for (const other of hits) {
    if (other === hit || other.relpath === hit.relpath || !other.updatedAt) continue;
    const ts = Date.parse(other.updatedAt);
    if (!Number.isFinite(ts) || ts <= bestTs) continue;
    if (!sharesTopic(myTopic, topicTokens(other))) continue;
    best = other;
    bestTs = ts;
  }
  return best ? best.relpath : null;
}

export function formatMemoryResult(result: MemorySearchResult, nowMs = Date.now()): string {
  const rows: string[] = [];
  rows.push(`# ${result.hits.length} memory hits (${result.scannedFiles} files scanned, ${result.elapsedMs}ms)`);
  if (result.hits.length === 0) rows.push("(no matches)");
  for (const hit of result.hits) {
    rows.push("");
    const loc = hit.startLine !== null ? `${hit.relpath}:${hit.startLine}` : hit.relpath;
    const when = hit.updatedAt ? ` [${hit.updatedAt}]` : "";
    const cwd = hit.cwd ? ` {${hit.cwd}}` : "";
    const age = ageDays(hit.updatedAt, nowMs);
    const ageBit = age === null ? "" : ` [age: ${age}d]`;
    const newer = newerRelpath(hit, result.hits);
    const newerBit = newer ? ` [newer: ${newer}]` : "";
    rows.push(`(${hit.origin}/${hit.kind}) ${loc}${when}${cwd}${ageBit}${newerBit}`);
    rows.push(clip(hit.excerpt, EXCERPT));
    rows.push("---");
  }
  appendWarnings(rows, result.warnings);
  return rows.join("\n");
}
```

E4 (`2.49.0 provenance` 1위가 2.48 세션, 08): 랭킹은 그대로 두고, 2.48 히트 옆에 더 최신 2.49 히트의 relpath를 붙인다. `formatChatResult`는 이 항목에서 안 만진다.

### 4.4 훅 stdout 회귀 + doctor WARN

활성화

| 입력 | 분기 | 관측 |
|---|---|---|
| `handleSessionStart(...)` 임의 status/cwd/source | stdout 계약 | 빈 문자열이 아니면 `JSON.parse` 성공, `hookSpecificOutput.hookEventName === "SessionStart"`, ANSI 없음, 끝에 개행 |
| `handleUserPromptSubmit` intent 참/거짓 | 참이면 JSON, 거짓이면 빈 문자열 | 거짓 경로에 `{`로 시작하는 쓰레기 없음 |
| `handlePostCompact()` | 항상 빈 문자열 | JSON 없음 (T1, `hook.ts:549-551`) |
| CLI `hook session-start` stdin 비JSON | fail-open | exit 0, stdout 빈 문자열 (`cli.ts:237-238`) |
| doctor, trusted_hash ≠ identityHash (drifted) | WARN | 다른 FAIL이 없으면 overall WARN. repair에 `cxc hooks retrust` (`--bootstrap-ok` 없음) |
| doctor, 섹션 없음 (untrusted) | FAIL 유지 | 지금 테스트 `hook-trust.test.ts:523-532` |
| doctor, identityHash 일치 | PASS | file sha256이 trusted_hash와 달라도 PASS (해시 입력이 파일 바이트가 아님, notes/03 §1) |

훅 결과 헬퍼 (`hook.ts` export, 테스트가 재사용). A/B7: S2(claude-mem #621)의 실제 실패는 stderr의 ANSI와 exit 3이므로 stdout·stderr·exit code를 함께 본다:

```ts
export interface HookResult { stdout: string; stderr: string; code: number; }

export function assertLegalHookResult(r: HookResult): void {
  if (r.code !== 0) throw new Error(`hook exited ${r.code}`);
  if (/\x1b\[/.test(r.stderr)) throw new Error("hook wrote ANSI to stderr");
  if (r.stdout === "") return;
  if (/\x1b\[/.test(r.stdout)) throw new Error("hook wrote ANSI to stdout");
  const parsed: unknown = JSON.parse(r.stdout);
  if (typeof parsed !== "object" || parsed === null) throw new Error("hook stdout is not a JSON object");
}
```

`handleSessionStart` / `handleUserPromptSubmit` / `handlePostCompact`의 모든 테스트 경로와, 추가 케이스(빈 payload, 잘못된 event 이름, 프롬프트에 ANSI)에서 `assertLegalHookResult`가 throw하지 않음(핸들러를 자식 프로세스 `dist/cli.js hook <event>`로 실행해 stdout/stderr/exit code를 함께 잡음).

doctor. `runHookTrustCheck` `doctor.ts:475` before:

```ts
severity: results.length === 0 ? "WARN" : failed.length === 0 ? "PASS" : "FAIL",
```

after:

```ts
const driftedOnly = failed.length > 0 && neverTrusted.length === 0;
severity:
  results.length === 0 ? "WARN"
  : failed.length === 0 ? "PASS"
  : driftedOnly ? "WARN"   // PLAN-BYPASS-NAMED-01: mismatch does not fail the plugin
  : "FAIL",
```

`neverTrusted`는 이미 `doctor.ts:463`에 있다. evidence 한 건당 `file_sha256=`를 붙인다. `listHookEntries`가 읽는 훅 JSON 파일 바이트의 sha256 hex (앞 16자면 notes/03 표와 대조 가능). 판정은 identityHash(`entry.hash`) vs `actual`이다. 파일 sha256 ≠ trusted_hash는 증거일 뿐 실패 조건이 아니다.

`hook-trust.ts`: `HookTrustResult`에 `fileSha256: string`을 넣고, `listHookEntries` 루프에서 `createHash("sha256").update(readFileSync(realPath)).digest("hex")`. `createHash`는 이미 import되어 있다 (`hook-trust.ts` 상단, identityHash가 사용).

테스트 수정:

- `hook-trust.test.ts:240` 제목 `fails with per-hook drift evidence` → `warns with per-hook drift evidence`
- `hook-trust.test.ts:256` `assert.equal(drifted.severity, "FAIL")` → `"WARN"`
- `hook-trust.test.ts:543` 동일
- `hook-trust.test.ts:523` untrusted FAIL는 유지
- evidence에 `file_sha256=` 매칭 추가

`cxc-ops.test.ts` healthy PASS 픽스처는 identityHash를 config에 넣으므로 그대로 PASS (`cxc-ops.test.ts:95-137`).

---

## 5. 테스트 계획

| 파일 | 케이스 | 활성화 시나리오 → 관측 |
|---|---|---|
| `recall/test/hook.test.ts` | startup notice | `handleSessionStart("", undefined, "startup")` JSON. `recall is available`. `compacted` 없음. 회수 한 줄에 `cxc chat search` (`opts.dedicatedTools` false/생략) |
| 동 | resume notice | `source: "resume"` → pause/Resuming. `compacted` 없음 |
| 동 | compact notice | `source: "compact"` → `compacted`. cwd 있으면 topN=2 (기존 `hook.test.ts:239` 유지) |
| 동 | 히트 0 | cwd 없이 호출 → `<untrusted-recall-data>` 없음, 안내문만 |
| 동 | dedicated_tools | `handleSessionStart("", undefined, "startup", { dedicatedTools: true })` → `memories.search`. false면 그 문자열 없음 |
| 동 | 트리거 확장 | `이전에 했던 배포`, `prior work on ingest` → `detectRecallIntent` true. `add a --json flag` false 유지 |
| 동 | 표적 제안 | `지난번 2.49.0 provenance와 hook.ts` → additionalContext에 `Suggested recall terms:` 및 `2.49.0`, `hook.ts`. memory hits 헤더 없음 |
| 동 | 검색 미실행 | 본문에 Index/excerpt/`# N memory hits` 없음으로 고정 |
| 동 | stdout 계약 | 위 모든 출력 + `handlePostCompact()` + 잘못된 event 이름에 `assertLegalHookResult` |
| 동 | extract 지연 | 8000자 프롬프트에서 `extractRecallTargets` elapsed < 20ms |
| `recall/test/format-freshness.test.ts` | age | frozen nowMs, updatedAt now-3d → `[age: 3d]`. null → age 없음 |
| 동 | newer | 같은 excerpt 토큰 `2.49.0`, relpath 다른 두 히트, 오래된 쪽에 `[newer: MEMORY.md]`. 새쪽에는 newer 없음 |
| 동 | 주제 불일치 | excerpt `alpha` vs `beta` → newer 없음 |
| 동 | 랭킹 불변 | format 호출이 `result.hits` 배열을 재정렬하지 않음 (호출 전후 relpath 순서 동일) |
| 동 | 기존 envelope | `# N memory hits`, `MEMORY.md:line`, `---` 유지 (`memory-search.test.ts:86-92`와 공존) |
| `recall/test/hook.test.ts` | CLI fail-open | `main(["hook","session-start"])` stdin `not-json` → 0, stdout 빈 문자열 |
| `cxc-ops/test/hook-trust.test.ts` | drifted WARN | stale trusted_hash → severity WARN, evidence에 key·expected·actual·file_sha256 |
| 동 | untrusted FAIL | 섹션 없음 → FAIL + `--bootstrap-ok` repair 유지 |
| 동 | trusted PASS | identityHash 일치 → PASS, repair undefined. file_sha256 ≠ hash여도 PASS |
| `recall/test/round2.test.ts` | gap4 | 기존 discussed previously / already-recalling 억제 유지 |

JSON 검색 출력에 age 필드를 넣는 테스트는 만들지 않는다 (format 계층만).

신규 테스트 파일 골격 (`format-freshness.test.ts`):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { formatMemoryResult, ageDays, newerRelpath } from "../src/format.ts";
import type { MemoryHit, MemorySearchResult } from "../src/memory-search.ts";

const NOW = Date.parse("2026-09-10T00:00:00Z");

function hit(partial: Partial<MemoryHit> & Pick<MemoryHit, "relpath" | "excerpt" | "updatedAt">): MemoryHit {
  return {
    origin: "file",
    kind: "handbook",
    threadId: null,
    startLine: 1,
    cwd: null,
    score: 1,
    ...partial,
  };
}

test("ageDays: ISO timestamps become whole days, null stays unlabeled", () => {
  assert.equal(ageDays(new Date(NOW - 3 * 86_400_000).toISOString(), NOW), 3);
  assert.equal(ageDays(null, NOW), null);
});

test("newerRelpath: older same-topic hit points at the newer relpath; ranking order is unchanged", () => {
  const oldHit = hit({
    relpath: "rollout_summaries/old.md",
    excerpt: "2.49.0 provenance check",
    updatedAt: new Date(NOW - 14 * 86_400_000).toISOString(),
    score: 9,
  });
  const newHit = hit({
    relpath: "MEMORY.md",
    excerpt: "2.49.0 provenance verified",
    updatedAt: new Date(NOW - 1 * 86_400_000).toISOString(),
    score: 3,
  });
  const hits = [oldHit, newHit]; // ranking already placed old first
  assert.equal(newerRelpath(oldHit, hits), "MEMORY.md");
  assert.equal(newerRelpath(newHit, hits), null);
  const result: MemorySearchResult = { hits, warnings: [], scannedFiles: 2, elapsedMs: 1 };
  const text = formatMemoryResult(result, NOW);
  const first = text.indexOf("rollout_summaries/old.md");
  const second = text.indexOf("MEMORY.md");
  assert.ok(first >= 0 && second > first, "format must not reorder hits");
  assert.match(text, /\[age: 14d\]/);
  assert.match(text, /\[newer: MEMORY.md\]/);
});
```

---

## 6. 검증 명령 (PLAN-VERIFIER-REAL-01)

작성 시 이 워크트리에서 실행한 결과. 구현 전 기준선이다. 구현 후 같은 명령을 다시 돌린다.

```text
$ node --version
v24.17.0

$ cd plugins/codexclaw/components/recall && node --test
exit=1
tests 138, pass 137, fail 1
fail: test/chat-fallback.test.ts:176
  "cli: memory search falls back to the real chat engine, and --no-chat opts out"
  assertion: "the chat corpus answered where memory could not"
이 실패는 wp6 범위 밖 (chat fallback CLI). wp6 구현이 이 파일을 만지지 않으면 기준선으로 남는다.
hook.test.ts / format-freshness 신규는 이 명령의 기본 glob test/*.test.ts 에 포함된다.

$ cd plugins/codexclaw/components/cxc-ops && node --test
exit=0
tests 198, pass 198

$ node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
exit=0
pass 1  (F1: committed dist/ is in sync with src/)
```

명령이 변경 대상 파일을 읽는 근거

- `cd plugins/codexclaw/components/recall && node --test`: Node 기본 테스트 glob이 cwd 아래 `**/*test*.ts`. `test/hook.test.ts`가 `../src/hook.ts`를 import하고, 신규 `test/format-freshness.test.ts`가 `../src/format.ts`를 import한다.
- `cd plugins/codexclaw/components/cxc-ops && node --test`: `test/hook-trust.test.ts`가 `../src/doctor.ts`의 `runHookTrustCheck`와 `../src/hook-trust.ts`를 import한다.
- `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"`: argv가 그 테스트 파일. 테스트는 `scripts/build.mjs`의 `COMPONENTS` + `listTsFiles(src)`로 커밋된 `dist/*.js`를 바이트 비교한다. recall `hook.ts`/`format.ts`, cxc-ops `doctor.ts`/`hook-trust.ts`가 바뀌면 대응 dist가 stale로 실패한다.

구현 후 기대: recall `node --test`는 chat-fallback 1건 외 신규 케이스 pass. chat-fallback을 이 PR에서 고치지 않으면 exit 1이 기준선이다.

---

## 7. dist 재생성

src를 고친 같은 커밋에 `npm run build` 결과 dist를 담는다 (dist-freshness F1).

바뀔 파일

- `plugins/codexclaw/components/recall/dist/hook.js`
- `plugins/codexclaw/components/recall/dist/format.js`
- `plugins/codexclaw/components/cxc-ops/dist/doctor.js`
- `plugins/codexclaw/components/cxc-ops/dist/hook-trust.js`

`cli.ts`를 안 바꾸면 `recall/dist/cli.js`는 그대로. `hook.ts`가 `readFileSync`/`join`을 쓰면 `hook.js`만 변한다.

---

## 8. 위험·롤백

- 회수 한 줄이 compact 직후 컨텍스트를 다시 채운다. S4는 넓은 주입이 decision-making을 해친다고 했다. 한 줄·160자 캡으로 막는다. cwd topN은 안 늘린다.
- `source=compact` SessionStart가 세션마다 안 올 수 있다 (notes/03: 2건 중 1건). 훅 분기는 입력이 있을 때만 탄다. 런타임 미발화는 wp6가 못 고친다. 000_plan 관측 항목으로 남긴다.
- 엔티티 오탐: 파일명·버전이 있는 일반 지시(`hook.ts`를 고쳐)가 지난번 없이 오면 intent 거짓이라 제안 줄이 안 나간다. intent가 열린 뒤에만 추출한다.
- doctor drifted WARN: 예전 FAIL을 보던 스크립트는 overall FAIL을 잃는다. PLAN-BYPASS-NAMED-01. untrusted(미승인)는 FAIL이라 첫 설치 미승인 경로는 남는다.
- identityHash ≠ 파일 sha256은 정상이다. 파일 sha256 불일치를 FAIL로 쓰면 notes/03 표 때문에 항상 실패한다.
- 훅 JSON statusMessage를 고치면 전 머신 trusted_hash drift. 이 PR에서 훅 JSON은 안 고친다.
- T2 툴 이름 stdin 덤프, T4 `--no-refresh` 신규 워크트리 0건은 이 PR OUT (08).

롤백: 위 src+dist 네 쌍과 테스트 파일을 revert. 훅 JSON·인덱스·config.toml은 안 건드렸으므로 설정 롤백은 없다.

---

## 9. PR 제목·본문 초안

제목:

`feat(recall): source-shaped briefings, targeted recall hints, and freshness labels`

본문:

```markdown
## Summary

SessionStart recall injection now branches on source (startup / resume / compact)
and ends with a one-line recall pointer: `memories.search` when
`memories.dedicated_tools` is on, otherwise `cxc chat/memory search`. Empty cwd
hits still emit the pointer only.

UserPromptSubmit still does not search. On recall-intent it appends extracted
terms (version / filename / error token / CamelCase) as a suggestion line.
Trigger idioms add 이전에 했 / prior work; existing 그때/지난번/last time keep working.

`cxc memory search` text output labels each hit `[age: Nd]` and, when a newer
same-topic hit is in the same result set, `[newer: <relpath>]`. Ranking is
unchanged.

Recall hook handlers are tested to emit empty string or parseable JSON (S2).
`cxc doctor` `hook-trust` reports identityHash drift as WARN, not FAIL
(PLAN-BYPASS-NAMED-01); missing trust entries remain FAIL.

## Stack

This repo's `enforce-pr-target` requires every PR base to be `dev`. Stacking is
local branch chain + merge order, not GitHub `base: previous-PR`.

| order | branch | PR | depends on (merge order) |
| --- | --- | --- | --- |
| wp0 | `codex/memory-l1-wp0-roadmap` | roadmap docs | `dev` |
| wp1 | gate false-positive | C2 | `dev` (independent) |
| wp2 | symbol boundary | C2 | `dev` (independent) |
| wp3 | skill/docs | C1 | after wp1/wp2 merge for wording |
| wp4 | project identity | C3 | after wp3 |
| wp5 | NL query | C3 | after wp2 |
| **wp6** | **this PR** | **C3** | **`dev` (independent of wp1–wp5 code)** |

wp3 skill text may later mention the new briefing forms; this PR does not edit
the skill.

## Test plan

- `cd plugins/codexclaw/components/recall && node --test`
- `cd plugins/codexclaw/components/cxc-ops && node --test`
- `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/dist-freshness.test.mjs`
- same commit includes rebuilt `dist/hook.js`, `dist/format.js`, `dist/doctor.js`, `dist/hook-trust.js`
```

베이스: `dev`. 브랜치 제안: `codex/memory-l1-wp6-native-integration`.

## 검증 명령 정정 (메인, 2026-09-10 07:25)

이 문서가 기록한 recall 컴포넌트 `node --test` exit 1(`chat-fallback.test.ts:176`)은 코드 결함이 아니라 러너 미사용 탓이다. 그 테스트는 memory→chat 폴백이 사이드카 인덱스를 읽는데, `CODEXCLAW_HOME`을 덮지 않으면 사용자 실인덱스(12GB)를 읽어 합성 픽스처 `aardwolf`를 못 찾는다. 레포 러너 `plugins/codexclaw/scripts/test.mjs`(`CODEXCLAW_HOME`을 임시 디렉터리로 덮음, test.mjs:7-11)로 돌리면 9/9 통과, exit 0이다(메인 세션 실측). 이후 모든 C 단계 검증은 다음 형태를 쓴다.

```bash
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/<comp>/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

## A 감사 반영 (round 1, 2026-09-10)

blocker #2(도달 불가 분기): §4.1의 `dedicatedToolsEnabled()`가 `CODEX_HOME` 환경변수만 보고 비어 있으면 false를 반환한다. 이 환경에서 `CODEX_HOME`은 unset이라(실측) 분기가 프로덕션에서 절대 켜지지 않는다. 수정: `recall/src/paths.ts:12-17`의 `codexHome()`(`$CODEX_HOME ?? ~/.codex`)을 써서 `<codexHome>/config.toml`을 읽고 `[memories] dedicated_tools = true`를 정규식으로 확인한다. 테스트는 임시 홈에 config.toml 픽스처를 두고 `CODEX_HOME`을 그 경로로 설정해 두 분기(true → "memories.search 도구를 쓰라", false/파일 없음 → "cxc memory search 명령")를 모두 활성화한다.

blocker #4(PLAN-BYPASS-NAMED-01, doctor hook-trust WARN 강등):

| 필드 | 값 |
|---|---|
| tier | E1 (진단 출력, 강제 없음) |
| 실행 표면 | `cxc doctor` CLI가 사람 또는 에이전트에게 WARN 행을 출력. 훅 실행을 막지 않음 |
| 알려진 우회 | doctor를 안 돌리면 아무 신호 없음; 재설치 직후 해시가 갱신되지 않아도 훅은 실행됨(notes/03 §1 실측) |
| 잔여 위험 | 매니페스트가 변조돼도 WARN일 뿐. 신뢰 결정은 Codex 런타임(`hooks.state.trusted_hash`)이 하며 codexclaw가 대신할 수 없음 |
| 문구 강등 | "trusted_hash mismatch → FAIL"에서 "→ WARN(drift)"로 강등. "항목 없음"은 FAIL 유지 |
| final enforcement layer | none (Codex 런타임의 훅 신뢰 프롬프트가 유일한 강제층이며 이 레포 밖) |

B7(S2 메커니즘): claude-mem #621의 실제 실패는 `console.error()`로 ANSI를 **stderr**에 쓰고 exit 3으로 끝나는 것이다. §4.4의 훅 출력 형식 테스트는 stdout 검사에 더해 (a) exit code가 0인지, (b) stderr가 비어 있거나 ANSI 이스케이프(`\x1b[`)를 포함하지 않는지를 검사한다. 헬퍼 이름을 `assertLegalHookResult`에서 `assertLegalHookResult({stdout, stderr, code})`로 바꾼다.

B4(000과의 정합): 000 §work-phase 맵의 wp6 설명을 이 문서 기준(src 4파일 구현)으로 갱신했고, 000이 열거한 관측 항목 5개(compaction 재점화 편차, `--no-refresh`와 신규 워크트리 주입, `memories.search` 호출 빈도, `msgs_fts` 바이트, rollout_summaries 256 상한)는 이 문서 §10 "관측 항목(코드 변경 없음)"으로 옮겨 wp6의 C 단계에서 실측 결과를 receipt에 첨부한다. 실측이 설계를 뒤집으면 P 수정으로 처리한다.

## 10. 관측 항목 (코드 변경 없음, wp6 C에서 실측)

| 항목 | 명령/방법 | 기록 위치 |
|---|---|---|
| compaction 후 SessionStart source=compact 재점화가 세션마다 다른 이유 | 최근 rollout jsonl에서 `type=compacted` 다음 `hooks.additional_context` 유무 집계 | 070_wp6_receipt.md |
| 훅 `--no-refresh`와 신규 워크트리 주입 0건의 관계 | 신규 슬롯에서 SessionStart 픽스처 실행, 인덱스 refresh 전후 비교 | 동일 |
| `memories.search` 호출 빈도 | 09-09 이후 rollout에서 tool call 이름 집계 | 동일 |
| `msgs_fts` 바이트 | `sqlite3 -readonly` dbstat 또는 페이지 수 | 동일 |
| rollout_summaries 256 상한 영향 | 파일 수·날짜 분포와 `max_raw_memories_for_consolidation` 대조 | 동일 |

행 번호 정정: `hook.ts:110-145`, `hook.ts:499-531`, `format.ts:52-67`.


## P 재검증 (wp6 사이클, 2026-09-10)

기준 트리 = origin/dev(#128 머지 직후). 계획 이후 `recall/src/hook.ts`는 wp4(#127)가 `listCwdSessions` 호출부와 "Recent work — project" 문구를 바꿨고(cwd-context.ts repo_key 연합), `format.ts`·`cxc-ops/src/doctor.ts`·`hook-trust.ts`는 계획 시점과 동일하다. §4.1의 SessionStart 분기는 #127의 cwd-context 호출을 그대로 감싸고, `dedicatedToolsEnabled`는 A 감사 반영대로 `paths.ts codexHome()`을 쓴다. §4.4의 훅 결과 헬퍼는 `assertLegalHookResult({stdout, stderr, code})`(자식 프로세스 실행). §10 관측 항목은 C에서 실측해 receipt에 붙인다. B는 행이 아니라 심볼로 patch한다. 브랜치 `codex/memory-l1-wp6-native`.



## A 감사 반영 (wp6 round 1, 2026-09-10)

리뷰어(grok-4.6) GO-WITH-FIXES(blocker 3, Medium 1, Low 1). 구현 제약으로 접는다.

1. resume 안내문은 기존 테스트가 요구하는 "recall is available" 문구를 유지한다(resume 전용 문구는 그 뒤에 덧붙이는 형태). `hook.test.ts:98-102`의 startup/resume/clear 루프는 그대로 통과해야 한다.
2. `handleSessionStart`의 `dedicatedTools` 기본값은 이 머신 config(`[memories] dedicated_tools = true`)를 읽으므로, 기존 SessionStart 테스트(`hook.test.ts:74, :94` `/cxc chat search/`)는 `{ dedicatedTools: false }`를 명시하거나 테스트 홈의 config.toml 픽스처로 분기를 고정한다. §5의 "false/생략 → cxc chat search" 기대에서 "생략"을 뺀다. 분기 활성화 테스트는 두 값을 모두 명시.
3. §4.2 활성화 행의 프롬프트를 `그때 그 작업 hook.ts MEMORY-WRITE-GATE`(현재 `detectRecallIntent` 참)로 바꾼다. `그때` 단독은 트리거가 아니다.
4. Medium: §4.4 자식 프로세스 테스트는 `hook-e2e.test.mjs:10-16,124`의 `emptyCodexHome()` 패턴대로 `CODEX_HOME`·`CODEX_SQLITE_HOME`을 빈 임시 홈으로 고정한다(러너의 `CODEXCLAW_HOME`만으로는 라이브 `~/.codex`를 읽는다).
5. Low: doctor WARN 강등이 바꾸는 기존 단언은 `hook-trust.test.ts:256`, `:543`(drifted FAIL→WARN, :240 제목)이고 `:527`(untrusted FAIL)은 유지.

