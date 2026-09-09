# 020 — wp2: #105 심볼 경계 회귀 (VERSION 분류 + 그룹 단위 완화)

날짜: 2026-09-10 (KST). 워크트리 HEAD `369ed0e1` (브랜치 `codex/memory-l1-wp0-roadmap`). 이 문서는 diff-level 구현 설계다. 코드는 아직 바꾸지 않았다.
근거: `000_plan.md` wp2, `001_web-survey.md` S4 exact 채널, `notes/01_regression-attribution.md` §회귀 1건, `notes/04_recall-skill-and-nl-gap.md` §1 행 9·R2 토큰. 아래 path:line은 이 HEAD에서 `nl -ba`로 재확인했다.

## 1. 목적과 범위

### IN

질의 단어 `2.49.0`이 FILENAME 정규식 `\.[a-z0-9]{1,5}$`에 걸려 심볼이 되고, 경계 판정이 앞 글자 `v`를 토큰 문자로 보아 MEMORY.md의 `v2.49.0` 청크를 놓치는 #105 회귀를 되돌린다. 설치본 기준선은 아래 §6 골든이다: `2.49.0 SLSA` → 2건(`memory_summary.md`, rollout `7x4X`), MEMORY.md 0건, warnings 빈 배열.

요구 (a): 버전 문자열을 FILENAME이 아닌 VERSION으로 분류하고, 경계 규칙에서 단독 `v`/`V` 접두를 인정한다.
요구 (b): 완화 재시도를 "AND 결과가 0건이면 모든 경계 그룹을 substring으로"에서 "코퍼스에서 경계 히트가 한 번도 없는 그룹만 substring으로"로 바꾼다.
요구 (c): c-4(`LSP`가 `NaiControlsPanel`을 배제) 유지.
요구 (d): 설치본 골든 기준선은 §6.

### OUT

- chat 검색. `chat-search.ts`는 `splitQueryWords`만 쓰고 경계 매칭을 쓰지 않는다 (`chat-search.ts:27`).
- 동의어 테이블·한국어 어간·8단어 캡·불용어. 그건 wp5.
- cxc-recall 스킬·docs-site. 스킬의 "empty answer is never the outcome" 과대 주장은 wp3 (`notes/04` §1 행 9).
- cwd/git origin 스코프 (wp4), 네이티브 주입 (wp7), memory-write gate (wp1).
- `INDEX_SCHEMA_VERSION` 변경. 이 패치는 recall 인덱스를 만지지 않는다.

### 채택하지 않는 대안

청크마다 "다른 그룹이 맞았으면 남은 경계 그룹을 substring으로" 여는 방식은 MEMORY.md도 복구하지만, `2.49.0 LSP`처럼 한 청크에 버전과 `NaiControlsPanel`이 같이 있으면 c-4 변형이 된다. MEMORY.md 복구는 VERSION+`v` 접두 경계(아래 (a))가 담당한다. 그룹 단위 완화(아래 (b))는 AND=0 경로의 정밀도만 담당한다.

AND 결과가 0이 아닌 한, 어떤 경계 그룹이 코퍼스 어딘가에서 이미 맞으면 그 그룹을 완화하지 않는다. 따라서 (b)만으로는 MEMORY.md 단독 탈락이 고쳐지지 않는다. 오늘 기준선이 그 형태다(`memory_summary.md`가 이미 `2.49.0` 경계를 만족해 완화 재시도가 열리지 않음, `memory-search.ts:466-467`, `notes/01` §회귀 1건).

## 2. 현재 코드

### 2.1 `2.49.0`이 FILENAME이 되는 지점

`plugins/codexclaw/components/recall/src/query-words.ts:54-74`:

```ts
/** Filename with an extension: hook.ts, plan.md. */
const FILENAME = /\.[a-z0-9]{1,5}$/;
/** Anything carrying a path separator: src/hook.ts. */
const PATH_LIKE = /[/\\]/;

export function isSymbolWord(rawWord: string): boolean {
  if (UPPER_ACRONYM.test(rawWord)) return true;
  const lower = rawWord.toLowerCase();
  return (
    SHORT_ASCII.test(lower) ||
    NUMERIC_ID.test(lower) ||
    SHA.test(lower) ||
    FILENAME.test(lower) ||
    PATH_LIKE.test(lower)
  );
}
```


이 HEAD에서 `node --experimental-strip-types`로 `isSymbolWord`를 재실행하면 `2.49.0`, `2.49`, `2.49.0-rc.1`, `v2.49.0`이 모두 `symbol:true`이고 `FILENAME.test(lower)`도 true다. `.0` / `.1` / `.49`가 `\.[a-z0-9]{1,5}$`에 맞기 때문이다. `hook.ts`도 FILENAME이다. `LSP`는 UPPER_ACRONYM이지 FILENAME이 아니다.

`expandQueryWords`는 원단어의 `isSymbolWord` 결과를 그룹 전원에 복사한다 (`synonyms.ts:163-185`). 질의 `2.49.0 SLSA`의 두 그룹은 둘 다 `boundary: true`가 된다. 설치본 토큰 분해는 `notes/01` §회귀 1건과 같다.

### 2.2 `v`가 경계를 막는 지점

`query-words.ts:84-108`:

```ts
const TOKEN_CHAR = /[A-Za-z0-9_]/;

function isBoundaryAt(lowerText: string, at: number, length: number): boolean {
  const before = at > 0 ? lowerText[at - 1] : "";
  const after = at + length < lowerText.length ? lowerText[at + length] : "";
  // Empty string (start/end of text) is a boundary: TOKEN_CHAR never matches "".
  return !TOKEN_CHAR.test(before) && !TOKEN_CHAR.test(after);
}

export function termIndexOf(lowerText: string, term: QueryTerm, from = 0): number {
  if (term.text === "") return -1;
  if (!term.boundary) return lowerText.indexOf(term.text, from);
  let at = lowerText.indexOf(term.text, from);
  while (at !== -1) {
    if (isBoundaryAt(lowerText, at, term.text.length)) return at;
    at = lowerText.indexOf(term.text, at + 1);
  }
  return -1;
}
```

`v`는 TOKEN_CHAR다. 소문자 텍스트 `v2.49.0`에서 질의 `2.49.0`의 `before`는 `v`이므로 경계 실패. 같은 파일을 질의 `v2.49.0 SLSA`로 치면 설치본이 MEMORY.md 2청크를 돌려준다(§6). 문서에 문자열이 없는 게 아니라 접두 `v` 경계만 실패한다.

`v`를 TOKEN_CHAR에서 빼면 `vid`가 심볼 `id`에 맞는다. 접두 예외는 VERSION 단어에만 둔다.

### 2.3 그룹 AND와 파일 프리필터

`memory-search.ts:351-355`:

```ts
function matches(lowerText: string, groups: QueryGroup[], anyMode: boolean): boolean {
  const groupHit = (group: QueryGroup) => group.some((term) => termIncludes(lowerText, term));
  return anyMode ? groups.some(groupHit) : groups.every(groupHit);
}
```

파일 루프는 파일 전체 텍스트 AND를 통과한 뒤에야 청크를 본다 (`memory-search.ts:418-429`). MEMORY.md 안의 `2.49.0`이 전부 `v2.49.0` 형태면 파일 프리필터에서 이미 탈락한다. per-file cap은 2 (`memory-search.ts:91-92`).

### 2.4 완화 재시도는 전체 0건일 때만

`memory-search.ts:94-100, 461-471`:

```ts
const RELAXED_PENALTY = 2;

  let candidates = collect(groups);
  if (candidates.length === 0 && hasBoundaryTerm(groups)) {
    candidates = collect(relaxQueryGroups(groups));
    if (candidates.length > 0) {
      for (const hit of candidates) hit.score -= RELAXED_PENALTY;
      warnings.push("no word-boundary matches — showing substring matches (lower confidence)");
    }
  }
```

`relaxQueryGroups`는 모든 그룹의 `boundary`를 false로 만든다 (`query-words.ts:137-139`). 오늘 골든은 이미 2건이라 이 분기를 타지 않고, MEMORY.md만 조용히 빠진다.

AND 의미상, 한 그룹이 코퍼스 전체에서 0건이면 AND 결과도 0건이다. 그 반대는 성립하지 않는다: 각 그룹이 다른 문서에 있으면 AND=0이어도 그룹 독립 히트는 0이 아니다. 현재 코드는 그 경우에도 모든 그룹을 substring으로 연다.

### 2.5 c-4가 서 있는 테스트

`test/query-words.test.ts:98-128`이 임시 home에 `NaiControlsPanel`(MEMORY.md)과 `The LSP server crashed`(real.md)를 넣고 `searchMemory("LSP")`가 `real.md`만 내게 한다. warnings에 `lower confidence`가 있으면 실패다. 같은 파일 `:130-154`는 real.md가 없을 때만 완화 재시도가 열리는지 본다. ranking.test.ts(`:1-99`)는 kind/recency만 보고 심볼 경계를 보지 않는다.

stage1 LIKE는 원래 substring 프리필터이고, 행 본문을 `matches`로 다시 검사한다 (`memory-search.ts:581-607`). 경계 의미는 JS 쪽에 있다.

## 3. 변경 파일 맵

| 파일 | NEW/MODIFY/DELETE | 변경 요지 | 예상 줄수 |
|---|---|---|---|
| `plugins/codexclaw/components/recall/src/query-words.ts` | MODIFY | VERSION 정규식, `isVersionWord`, `isSymbolWord`에서 VERSION을 FILENAME보다 먼저. `isBoundaryAt`이 VERSION 단어의 단독 `v`/`V` 접두를 경계로 인정. `relaxGroupsAt` 추가 | +45 / 기존 144 |
| `plugins/codexclaw/components/recall/src/memory-search.ts` | MODIFY | 첫 collect가 마크다운 파일 전체 텍스트로 그룹 존재를 기록. AND=0이면 stage1 presence 보정 후 miss 그룹만 `relaxGroupsAt` | +55 / 기존 631 |
| `plugins/codexclaw/components/recall/test/query-words.test.ts` | MODIFY | VERSION 분류, `v2.49.0` 경계, MEMORY.md 회귀 픽스처, 그룹 단위 완화 vs 전체 완화, c-4 유지 | +110 / 기존 210 |
| `plugins/codexclaw/components/recall/test/ranking.test.ts` | (변경 없음) | 심볼 분기 없음. 회귀 실행만 | 0 |
| `plugins/codexclaw/components/recall/dist/query-words.js` | MODIFY | 같은 커밋에 `npm run build` 산출물 | src와 동기 |
| `plugins/codexclaw/components/recall/dist/memory-search.js` | MODIFY | 위와 같음 | src와 동기 |

`synonyms.ts`는 `isSymbolWord`를 호출만 한다. `2.49.0`은 지금도 심볼이고 후에도 심볼이라 소스 변경 없음. dist/synonyms.js도 안 바뀐다.

## 4. 변경 상세

TypeScript 규칙: 써드파티 import 금지. 소스 import는 `../src/x.ts`처럼 확장자 포함. 테스트는 `node:test` + `node:assert/strict`.

### 4.1 `query-words.ts`

FILENAME 정규식 바로 위에 VERSION을 둔다. 분류는 선두 선택: VERSION이면 FILENAME으로 부르지 않는다. 질의 쪽 선택적 `v` 접두는 분류에만 넣는다(`v2.49.0`을 계속 FILENAME로 남기지 않기 위해). 경계 예외는 코어 버전(숫자로 시작)에만 적용한다.

**before** (`query-words.ts:54-74, 84-90, 126-139`): §2 인용과 동일.

**after** (해당 구간 교체·추가):

```ts
/** Dotted version: 2.49, 2.49.0, 2.49.0-rc.1. Optional leading v is classification only. */
const VERSION = /^v?\d+\.\d+(?:\.\d+)*(?:-[a-z0-9.]+)?$/;
/** Version core without a leading v — the slice we look up in haystack for query "2.49.0". */
const VERSION_CORE = /^\d+\.\d+(?:\.\d+)*(?:-[a-z0-9.]+)?$/;
/** Filename with an extension: hook.ts, plan.md. */
const FILENAME = /\.[a-z0-9]{1,5}$/;
/** Anything carrying a path separator: src/hook.ts. */
const PATH_LIKE = /[/\\]/;

export function isVersionWord(rawWord: string): boolean {
  return VERSION.test(rawWord.toLowerCase());
}

export function isSymbolWord(rawWord: string): boolean {
  if (UPPER_ACRONYM.test(rawWord)) return true;
  const lower = rawWord.toLowerCase();
  return (
    isVersionWord(rawWord) ||
    SHORT_ASCII.test(lower) ||
    NUMERIC_ID.test(lower) ||
    SHA.test(lower) ||
    FILENAME.test(lower) ||
    PATH_LIKE.test(lower)
  );
}

const TOKEN_CHAR = /[A-Za-z0-9_]/;

function isTokenEdge(ch: string): boolean {
  return ch === "" || !TOKEN_CHAR.test(ch);
}

function isBoundaryAt(lowerText: string, at: number, length: number): boolean {
  const before = at > 0 ? lowerText[at - 1] : "";
  const after = at + length < lowerText.length ? lowerText[at + length] : "";
  if (isTokenEdge(before) && isTokenEdge(after)) return true;
  const term = lowerText.slice(at, at + length);
  // v2.49.0 / (v2.49.0): a lone v immediately before a VERSION core is a
  // boundary iff the v itself sits on a token edge. av2.49.0 and 12.49.0 stay out.
  if (before === "v" && isTokenEdge(after) && VERSION_CORE.test(term)) {
    const beforeV = at >= 2 ? lowerText[at - 2] : "";
    return isTokenEdge(beforeV);
  }
  return false;
}

export function relaxGroupsAt(groups: QueryGroup[], indexes: ReadonlySet<number>): QueryGroup[] {
  return groups.map((group, i) =>
    indexes.has(i) ? group.map((term) => ({ text: term.text, boundary: false })) : group,
  );
}
```

`termIndexOf` 시그니처는 그대로 두고, 내부 `isBoundaryAt`만 위 의미로 바꾼다. `relaxQueryGroups`는 기존 테스트가 쓰니 유지하고, 구현은 `relaxGroupsAt(groups, new Set(groups.keys()))`로 위임해도 된다.

haystack는 이미 소문자라 접두 `V`는 `v`로 들어온다. 질의 `V2.49.0`은 `isVersionWord` true, 매칭 텍스트는 `v2.49.0` 전체라 접두 예외가 필요 없다.

`2.49.0.md`는 VERSION_CORE에 안 맞고 FILENAME(`.md`)으로 남는다. `hook.ts` / `my-hook.tsx` 기존 경계는 TOKEN_CHAR가 그대로라 변함이 없다.

### 4.2 `memory-search.ts`

`matches` 위의 `groupHit`를 파일 스코프 함수로 올린다. `collect`가 마크다운 파일 전체 텍스트로 원 그룹 presence를 적게 한다. AND=0 재시도는 miss 그룹만 연다.

**before** (`memory-search.ts:351-355, 402-418, 461-471`): §2 인용.

**after**:

```ts
function groupHit(lowerText: string, group: QueryGroup): boolean {
  return group.some((term) => termIncludes(lowerText, term));
}

function matches(lowerText: string, groups: QueryGroup[], anyMode: boolean): boolean {
  return anyMode ? groups.some((g) => groupHit(lowerText, g)) : groups.every((g) => groupHit(lowerText, g));
}

function markGroupPresence(lowerText: string, groups: QueryGroup[], present: boolean[]): void {
  for (let i = 0; i < groups.length; i++) {
    if (!present[i] && groupHit(lowerText, groups[i])) present[i] = true;
  }
}
```

`collect` 파일 루프, `scannedFiles += 1` 다음:

```ts
      const lowerFile = content.toLowerCase();
      if (tallyPresence) markGroupPresence(lowerFile, groups, present);
      if (!matches(lowerFile, active, anyMode)) continue;
```

`collect` 시그니처를 `(active: QueryGroup[], tallyPresence: boolean): MemoryHit[]`로 늘린다. `present`는 `searchMemory` 스코프의 `boolean[]`(길이 = 원 그룹 수)다. 두 번째 collect는 `tallyPresence: false`.

AND=0일 때 stage1 보정. LIKE는 원래 substring이라, 행을 넓게 읽은 뒤 JS 경계로 그룹을 표시한다. AND=0 경로에서만 호출한다.

```ts
function fillStage1Presence(
  home: string,
  groups: QueryGroup[],
  present: boolean[],
  cutoffMs: number | null,
  warnings: string[],
): void {
  if (present.every(Boolean)) return;
  const dbPath = memoriesDbPath(home);
  if (!dbPath) return;
  let db: ReturnType<typeof openReadOnlyDb> | null = null;
  try {
    db = openReadOnlyDb(dbPath);
    const rows = db
      .prepare(
        "SELECT raw_memory, rollout_summary, source_updated_at FROM stage1_outputs",
      )
      .all() as Array<Record<string, unknown>>;
    for (const r of rows) {
      const updatedSec = typeof r.source_updated_at === "number" ? r.source_updated_at : null;
      if (cutoffMs && updatedSec !== null && updatedSec * 1000 < cutoffMs) continue;
      const body = `${String(r.raw_memory ?? "")}\n${String(r.rollout_summary ?? "")}`.toLowerCase();
      markGroupPresence(body, groups, present);
      if (present.every(Boolean)) return;
    }
  } catch (err) {
    warnings.push(`memories db unreadable (${err instanceof Error ? err.message : String(err)})`);
  } finally {
    db?.close();
  }
}
```

재시도 블록 교체 (`memory-search.ts:461-471`):

```ts
  const present = groups.map(() => false);
  let candidates = collect(groups, true);
  if (candidates.length === 0 && hasBoundaryTerm(groups)) {
    fillStage1Presence(home, groups, present, cutoffMs, warnings);
    const miss = new Set<number>();
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].some((t) => t.boundary) && !present[i]) miss.add(i);
    }
    if (miss.size > 0) {
      candidates = collect(relaxGroupsAt(groups, miss), false);
      if (candidates.length > 0) {
        for (const hit of candidates) hit.score -= RELAXED_PENALTY;
        warnings.push("no word-boundary matches — showing substring matches (lower confidence)");
      }
    }
  }
```

경고 문자열에 `lower confidence`를 남긴다. 기존 테스트가 그 부분 문자열을 본다 (`query-words.test.ts:141, 167`).

import에 `relaxGroupsAt`를 추가한다. `relaxQueryGroups`는 memory-search가 더 이상 안 쓰면 import에서 뺀다.

anyMode=true이고 0건이면 모든 그룹이 독립적으로도 0이다. miss 집합은 경계 그룹 전부가 되고, 동작은 지금과 같다.

AND=0인데 모든 경계 그룹이 독립 히트를 가진 교차 공백은 더 이상 전체 substring으로 열지 않는다. 이게 (b)의 동작 변경이다.

### 4.3 테스트 추가 (`query-words.test.ts`)

import에 `isVersionWord`, `relaxGroupsAt`를 추가한다.

```ts
test("isVersionWord: dotted versions are VERSION, not prose or filenames", () => {
  for (const w of ["2.49.0", "2.49", "2.49.0-rc.1", "v2.49.0", "V2.49.0"]) {
    assert.ok(isVersionWord(w), `${w} is VERSION`);
    assert.ok(isSymbolWord(w), `${w} stays a symbol`);
  }
  for (const w of ["hook.ts", "plan.md", "package.json", "src/hook.ts", "LSP", "3956", "deploy"]) {
    assert.ok(!isVersionWord(w), `${w} is not VERSION`);
  }
  assert.ok(isSymbolWord("hook.ts"));
  assert.ok(!isSymbolWord("deploy"));
});

test("termIndexOf: VERSION core allows a lone v/V prefix as a boundary", () => {
  const v = bounded("2.49.0");
  assert.ok(termIncludes("slsa provenance, v2.49.0", v));
  assert.ok(termIncludes("released (v2.49.0) today", v));
  assert.ok(termIncludes("V2.49.0".toLowerCase(), v));
  assert.ok(termIncludes("2.49.0", v), "bare form still matches");
  assert.ok(!termIncludes("av2.49.0", v), "v must itself be a token edge");
  assert.ok(!termIncludes("12.49.0", v), "leading digit stays a token char");
  assert.ok(!termIncludes("2.49.00", v), "trailing digit is inside the token");
  assert.ok(!termIncludes("vci runner", bounded("ci")), "v-prefix exception is VERSION-only");
  assert.ok(termIncludes("see hook.ts for details", bounded("hook.ts")));
  assert.ok(!termIncludes("edit my-hook.tsx now", bounded("hook.ts")));
});

test("memory search: 2.49.0 SLSA recovers v2.49.0 handbook while summary already matches", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-r1-version-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(
      join(mem, "memory_summary.md"),
      "# Summary\n\nOpenCodex 2.49.0 HOTL release, SLSA provenance.\n",
    );
    writeFileSync(
      join(mem, "MEMORY.md"),
      "# Handbook\n\nSLSA provenance, v2.49.0\n\nFor v2.49.0, main SHA verified with SLSA.\n",
    );
    writeFileSync(join(mem, "noise.md"), "# Noise\n\nNaiControlsPanel notes, no version.\n");
    const r = searchMemory("2.49.0 SLSA", { home });
    const paths = new Set(r.hits.map((h) => h.relpath));
    assert.ok(paths.has("memory_summary.md"), "summary keep");
    assert.ok(paths.has("MEMORY.md"), "handbook v-prefix recovered");
    assert.ok(!paths.has("noise.md"));
    assert.ok(!r.warnings.some((w) => w.includes("lower confidence")), "strict v-prefix, no relax");
    assert.ok(r.hits.some((h) => h.relpath === "MEMORY.md" && /v2\.49\.0/i.test(h.excerpt)));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: c-4 LSP still excludes NaiControlsPanel when a real hit exists", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-r1-c4-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "MEMORY.md"), "# Notes\n\nTouched NaiControlsPanel and negativePrompt.\n");
    writeFileSync(join(mem, "real.md"), "# Real\n\nThe LSP server crashed.\n");
    const r = searchMemory("LSP", { home });
    assert.ok(r.hits.length >= 1);
    assert.ok(r.hits.every((h) => h.relpath === "real.md"));
    assert.ok(!r.warnings.some((w) => w.includes("lower confidence")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("memory search: relaxes only the boundary group that missed the whole corpus", () => {
  const home = mkdtempSync(join(tmpdir(), "recall-r1-group-miss-"));
  try {
    const mem = join(home, "memories");
    mkdirSync(mem, { recursive: true });
    writeFileSync(join(mem, "real-lsp.md"), "# Real\n\nThe LSP server crashed.\n");
    writeFileSync(join(mem, "glued.md"), "# Glued\n\nNaiControlsPanel and PR3956 together.\n");
    writeFileSync(join(mem, "both.md"), "# Both\n\nThe LSP server and PR3956 shipped.\n");
    const r = searchMemory("3956 LSP", { home });
    const paths = r.hits.map((h) => h.relpath);
    assert.ok(paths.includes("both.md"), "substring 3956 + boundary LSP");
    assert.ok(!paths.includes("glued.md"), "NaiControlsPanel must not satisfy LSP after group-miss relax");
    assert.ok(!paths.includes("real-lsp.md"), "no 3956 in the standalone LSP file");
    assert.ok(r.warnings.some((w) => w.includes("lower confidence")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
```

기존 `memory search: symbol queries stop matching inside longer words (R1)`(`:98-128`)는 그대로 둔다. 위 c-4 테스트는 그 픽스처를 평가 용어(c-4)에 맞춘 중복이며, 하나가 빠지면 안 된다.

기존 `zero boundary matches fall back`(`:156-178`, PR3956 단독)은 miss 집합이 그 한 그룹이라 통과해야 한다. `embedded-only symbol falls back`(`:130-154`)도 같다.

`ranking.test.ts`는 수정하지 않는다. 구현 후 `node --test test/ranking.test.ts`로 실행만 한다.

## 5. 테스트 계획

| 파일 | 케이스 | 활성화 입력 | 타는 분기 | 관측 |
|---|---|---|---|---|
| query-words.test.ts | isVersionWord 분류 | `2.49.0`, `v2.49.0`, `hook.ts` | `isSymbolWord`가 VERSION을 FILENAME보다 먼저 | version true, hook.ts는 version false·symbol true |
| query-words.test.ts | v 접두 경계 | haystack `slsa provenance, v2.49.0` / `av2.49.0` / `12.49.0`, term `2.49.0` boundary | `isBoundaryAt` VERSION 예외 | 첫 텍스트 히트, 뒤 둘 미스. `vci`는 `ci` 미스 |
| query-words.test.ts | FILENAME 유지 | `hook.ts` vs `my-hook.tsx` | TOKEN_CHAR 기본 경계 | 기존과 동일 |
| query-words.test.ts | 2.49.0 SLSA 회귀 | summary에 bare `2.49.0`+SLSA, MEMORY.md에 `v2.49.0`+SLSA, noise에 NaiControlsPanel | 첫 collect 경계 매칭 (완화 없음) | 두 파일 히트, warning 없음, noise 없음 |
| query-words.test.ts | c-4 | MEMORY.md=`NaiControlsPanel`, real.md=`The LSP server` | 첫 collect 성공 → 완화 안 탐 | relpath 전부 real.md |
| query-words.test.ts | 그룹 단위 미스 | 질의 `3956 LSP`, 파일 both=LSP경계+PR3956, glued=NaiControlsPanel+PR3956, real-lsp=LSP만 | AND=0 → 3956만 miss → `relaxGroupsAt({0})` | both만 히트, glued 배제, lower confidence 경고 |
| query-words.test.ts | 기존 PR3956 단독 | MEMORY.md=`Shipped PR3956` | AND=0, 그룹 1개 miss | 1건 + 경고 |
| query-words.test.ts | 기존 완화 후 strict 파일 추가 | 이어서 `PR #3956` 파일 작성 | 두 번째 검색은 첫 collect 성공 | clean.md만, 경고 없음 |
| ranking.test.ts | (기존 4건) | zebra ranking fixture | kind/recency | 순서 불변 |
| 설치본 골든 | `2.49.0 SLSA` | 라이브 memories, --limit 5 --no-chat --no-refresh --json | 구현·재설치 후 | MEMORY.md 복구, memory_summary.md 유지. 기준선은 §6 |

라이브 `LSP` 검색은 설치본에서 히트 2건 모두 MEMORY.md이고 excerpt에 NaiControlsPanel이 0건이다(§6). 유닛 c-4가 배제 규칙을 고정하고, 라이브는 구현 후 같은 명령으로 NaiControlsPanel excerpt가 0건인지 다시 본다.

## 6. 검증 명령 (PLAN-VERIFIER-REAL-01)

실행 시각 2026-09-10 KST, HEAD `369ed0e1`, 코드 변경 없음.

### 6.1 컴포넌트 테스트

```
cd plugins/codexclaw/components/recall && node --test
```

exit code **1**. 138 tests, pass 137, fail 1. 실패는 `test/chat-fallback.test.ts:176` `cli: memory search falls back to the real chat engine, and --no-chat opts out` (aardwolf가 채팅 코퍼스에서 안 나옴). wp2 대상 파일이 아니다.

대상 파일만:

```
cd plugins/codexclaw/components/recall && node --test test/query-words.test.ts test/ranking.test.ts test/memory-search.test.ts
```

exit code **0**. 23 tests, pass 23. `node --test test/query-words.test.ts`가 `../src/query-words.ts`와 `../src/memory-search.ts`를 import한다. ranking은 `../src/memory-search.ts`만.

### 6.2 dist-freshness

```
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

루트에서 실행. exit code **0**. 근거: `scripts/test.mjs:9`가 `process.argv.slice(2)`를 `node --test --test-concurrency=1`에 넘긴다. 인자 파일이 `dist-freshness.test.mjs:32-47`에서 `COMPONENTS`(`build.mjs:27`, 배열에 `"recall"` 포함)를 순회하고 `listTsFiles(src)`로 `recall/src/query-words.ts`, `recall/src/memory-search.ts`를 읽어 `compileSource` 결과와 tracked `recall/dist/*.js`를 바이트 비교한다. 지금 둘 다 src와 dist가 같다.

### 6.3 골든 기준선 (설치본 CLI)

BIN: `node /Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs`

```
node <BIN> memory search "2.49.0 SLSA" --limit 5 --no-chat --no-refresh --json
```

exit code **0**. scannedFiles=285, elapsedMs=29, warnings=`[]`.

| # | relpath | startLine | kind | score | excerpt 앞부분 |
|---|---|---|---|---|---|
| 1 | memory_summary.md | 50 | summary | 9 | OpenCodex 2.49.0 HOTL release delivery … SLSA provenance |
| 2 | rollout_summaries/2026-09-09T05-16-09-7x4X-opencodex_249_hotl_release_deployment.md | 56 | rollout | 6.49 | Version pre-move PR #4115 … package.json from 2.49.0 to 2.50.0 |

hitCount **2**. MEMORY.md 없음.

같은 BIN으로 질의만 `v2.49.0 SLSA`로 바꾸면 hitCount **3**, relpath `MEMORY.md:35`, `MEMORY.md:23`, 위 rollout. excerpt에 `SLSA provenance, v2.49.0` / `For v2.49.0, main SHA`. 문서에 문자열이 있고, 질의에서 `v`를 빼면 경계가 놓친다.

같은 BIN `memory search "LSP" --limit 5 --no-chat --no-refresh --json`: hitCount 2, 둘 다 MEMORY.md, excerpt 중 NaiControlsPanel 0건, warnings 빈 배열.

구현 후 같은 골든 명령의 합격선: MEMORY.md가 히트에 있고, memory_summary.md가 유지되고, warnings에 lower confidence가 없고, LSP 라이브 excerpt에 NaiControlsPanel이 없다. per-file cap=2이므로 MEMORY.md 청크는 최대 2개다. 오늘 `v2.49.0 SLSA`가 그 2청크를 이미 보여 주므로 `2.49.0 SLSA`의 기대 히트는 summary 1 + handbook 2 + rollout 1 = 4(limit 5).

## 7. dist 재생성

src를 고치는 커밋에 루트 `npm run build` 결과 dist를 같이 담는다. freshness 테스트가 tracked dist와 `compileSource(src)` 바이트를 비교한다 (`dist-freshness.test.mjs:1-8, 45-47`).

바뀌는 dist:

- `plugins/codexclaw/components/recall/dist/query-words.js`
- `plugins/codexclaw/components/recall/dist/memory-search.js`

안 바뀌는 dist: `synonyms.js`, `chat-search.js`, `cli.js` 및 나머지 recall dist. synonyms.ts 소스가 그대로면 컴파일 바이트도 그대로다.

## 8. 위험·롤백

- VERSION이 `1.2` / `file.1`을 삼킬 수 있다. `1.2`는 VERSION이 맞다(점 버전). `file.1`은 VERSION_CORE가 선두 숫자를 요구해서 FILENAME으로 남는다. 테스트에 적어 둔다.
- `2.49.0`이 `2.49.0-rc.1` 안에 맞는다. after 문자가 `-`라 TOKEN_CHAR가 아니다. 지금 FILENAME 분류에서도 같은 결과다. 바꾸지 않는다.
- 그룹 단위 완화 이후, AND=0·교차 공백 질의는 예전보다 결과가 적을 수 있다. 예전에는 모든 심볼을 substring으로 열었다. c-4를 지키려면 그 후퇴가 맞다. 픽스처 `glued.md`가 그 후퇴를 고정한다.
- stage1 presence는 AND=0일 때만 전표 스캔한다. 주석의 516행 규모. 골든 285파일 검색이 29ms였고, 0건 경로에만 추가된다. `days` 컷오프는 fillStage1Presence에도 같은 `cutoffMs`를 넘긴다.
- `v` 예외를 비-VERSION에 적용하면 `vid`→`id`. VERSION_CORE 가드가 막는다. 테스트 `vci runner`.
- 롤백: 이 두 src+dist와 테스트 추가분을 revert하면 #105 도입 당시 경계로 돌아간다. 게이트·스킬·인덱스는 손대지 않으므로 롤백 범위가 그 파일들이다.

## 9. PR 제목·본문 초안

제목: `fix(recall): match v-prefixed versions and relax only missing symbol groups`

본문:

```
#105 classified `2.49.0` as FILENAME because FILENAME=/\.[a-z0-9]{1,5}$/ matches `.0`. Token-boundary matching then treats the leading `v` in MEMORY.md `v2.49.0` as a token character, so the handbook chunks drop. Relaxed retry only runs when the whole AND pass is empty, and memory_summary.md already matches, so the miss stays silent.

This patch:
- classifies `v?\d+\.\d+(\.\d+)*(-[A-Za-z0-9.]+)?` as VERSION before FILENAME
- accepts a lone v/V prefix as a boundary for VERSION cores (`v2.49.0` yes, `av2.49.0` / `12.49.0` no)
- on zero AND hits, substring-relaxes only boundary groups with zero independent corpus hits

c-4 remains: `LSP` does not hit `NaiControlsPanel` when a standalone LSP chunk exists.

Baseline (installed CLI, 2026-09-10): `memory search "2.49.0 SLSA" --limit 5 --no-chat --no-refresh --json` → 2 hits (memory_summary.md, rollout 7x4X), 0 MEMORY.md. Same query with a leading v already returns MEMORY.md:23 and :35.

Stack (enforce-pr-target: every GitHub PR base is `dev`; stack is local branch parentage + merge order):

| order | work-phase | local branch | PR base | depends on |
|---|---|---|---|---|
| 1 | wp1 memory-write gate | codex/memory-l1-wp1-write-gate | dev | — |
| 2 | wp2 symbol boundary (this) | codex/memory-l1-wp2-symbol-boundary | dev | merge wp1 first |
| 3 | wp3 recall skill rewrite | (later) | dev | merge wp2 first |

Test: `cd plugins/codexclaw/components/recall && node --test test/query-words.test.ts test/ranking.test.ts`
Dist: commit `npm run build` output for recall/dist/query-words.js and memory-search.js.
```

## 검증 명령 정정 (메인, 2026-09-10 07:25)

이 문서가 기록한 recall 컴포넌트 `node --test` exit 1(`chat-fallback.test.ts:176`)은 코드 결함이 아니라 러너 미사용 탓이다. 그 테스트는 memory→chat 폴백이 사이드카 인덱스를 읽는데, `CODEXCLAW_HOME`을 덮지 않으면 사용자 실인덱스(12GB)를 읽어 합성 픽스처 `aardwolf`를 못 찾는다. 레포 러너 `plugins/codexclaw/scripts/test.mjs`(`CODEXCLAW_HOME`을 임시 디렉터리로 덮음, test.mjs:7-11)로 돌리면 9/9 통과, exit 0이다(메인 세션 실측). 이후 모든 C 단계 검증은 다음 형태를 쓴다.

```bash
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/<comp>/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

## A 감사 반영 (round 1, 2026-09-10)

blocker 없음. Low: §2의 "`splitQueryWords`만 쓰고"는 `chat-search.ts:27`이 `splitQueryWords, MAX_WORDS` 둘을 import하므로 "경계 매칭 함수를 쓰지 않고"로 읽는다. 본론(chat 경로에 경계 매칭 부재)은 그대로다.


## P 재검증 (wp2 사이클, 2026-09-10)

기준 트리 `91745432`(origin/dev, #124 머지 직후). `git diff --stat 369ed0e1 HEAD -- plugins/codexclaw/components/recall`이 비어 있어 §2 인용 행(`query-words.ts:54-74, 84-90, 126-139`, `memory-search.ts:351-355, 461-471`)은 그대로다. A 감사 반영(Low 1건)이 접혀 있으므로 이 문서를 그대로 실행한다. 브랜치 `codex/memory-l1-wp2-symbol`(origin/dev 위), PR base dev. wp1과 독립.



## A 감사 반영 (wp2 round 1, 2026-09-10)

리뷰어(grok-4.6) GO-WITH-FIXES(Medium 1): §4.1 after 펜스를 `query-words.ts:126-139`의 교체로 적용하면 `hasBoundaryTerm`(127-129)과 `relaxQueryGroups`(137-139)가 사라져 4.2의 재시도와 기존 테스트(`query-words.test.ts:82`)가 깨진다. 결정: 126-139는 **교체가 아니라 추가**다. `hasBoundaryTerm`은 그대로 두고, `relaxQueryGroups`는 `relaxGroupsAt(groups, new Set(groups.keys()))`에 위임하는 구현으로 유지하며, `relaxGroupsAt`은 그 아래에 추가한다. §4.1의 "after (해당 구간 교체·추가)" 문구는 이 절이 우선한다. Low: 헤더 HEAD는 P 재검증(91745432)이 덮고, 테스트의 `relaxGroupsAt` import는 직접 호출이 없으면 넣지 않는다.

