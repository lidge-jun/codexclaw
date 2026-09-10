# 050 — wp5: 자연어 질의 완화

날짜: 2026-09-10 (KST). 워크트리 `/Users/jun/.codex/worktrees/3412/codexclaw`, HEAD `369ed0e1` (`codex/memory-l1-wp0-roadmap`).
이 문서는 구현 전 P-phase decade다. 코드는 바꾸지 않았다. 행 번호는 오늘 소스에서 다시 읽었다.

선행: `000_plan.md` wp5, `001_web-survey.md` S4 행(짧은 고신뢰 회수 > 넓은 top-k), `notes/01_regression-attribution.md` §자연어, `notes/04_recall-skill-and-nl-gap.md` §2·P1·P2.
후행: wp2(`query-words.ts` 심볼 경계) 머지 뒤에 착수. 스킬 문구는 wp3 소유라 이 사이클에서 `SKILL.md`를 고치지 않는다.

## (1) 목적과 범위

평가 원문 3건(D3/P2/R2)이 chat/memory 모두 0건인 한계를, 사용자 인덱스를 읽지 않는 합성 픽스처 위에서 깨고, 같은 predicate를 index 경로와 scan 경로에 적용한다.

설치본 BIN(`~/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs`)으로 오늘 재실행한 기준선:

| id | 질의 | chat n / ms / mode | memory n / ms (`--no-chat --no-refresh`) |
|---|---|---|---|
| D3 | 지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법 | 0 / 7736 / index | 0 / 81 |
| P2 | 코덱스를 재시작하면 플러그인이 사라지는 문제 | 0 / 240 / index | 0 / 47 |
| R2 | 2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록 | 0 / 408 / index | 0 / 66 |

대조(같은 BIN, 같은 날): `도그푸딩` chat n=3 / 160ms, `로컬 소스 서비스` chat n=3 / 273ms, `2.49.0 배포 npm` chat n=3 / 169ms, `LSP` memory n=2 / 28ms (relpath `MEMORY.md` ×2, excerpt에 `NaiControlsPanel` 없음).

### IN

- 공백 토큰을 8개에서 자르지 않는다. 8을 넘는 질의는 심볼·고유명사·숫자를 필수(AND), 나머지를 선택(OR)으로 두고 최소 매칭 수 `ceil(optional/2)`를 요구한다.
- chat 경로에 `--synonyms`(기본 off). 켜면 memory와 같은 `expandQueryWords` + `koreanStem`을 쓰되, chat term의 `boundary`는 항상 false(substring)로 둔다. index/scan 동등성(`test/index.test.ts:46`)을 깨지 않기 위함이다.
- 불용어는 최소 목록 `그/이/저/것/문제/방법`만. 심볼(`CI`)은 빼지 않는다. 전부 불용어면 원본을 유지한다.
- `synonyms.ts` 시드: 도그푸딩·재시작·검증·소스·코덱스 계열. 이미 있는 `plugin/플러그인`, `deploy/배포`는 넣지 않는다.
- 골든셋은 `test/fixtures.ts`를 확장한 합성 CODEX_HOME에서만 돈다. 라이브 인덱스·메모리 스토어에 의존하지 않는다.
- c-4(`LSP` ↛ `NaiControlsPanel`)와 c-5(활용형 `배포까지` → 문서 `배포`)를 그 합성 홈에서 재현한다.

### OUT

- 임베딩, dreaming, 네이티브 `memories.search` 재구현, 인덱스 스키마 범프(`INDEX_SCHEMA_VERSION` 유지 `"2"`, `index-db.ts:18`).
- `--any` 자동 켜기. `notes/04` 변형표에서 원문+`--any`는 n=3을 채우지만 정답이 아니다.
- chat에 심볼 경계 매칭 도입(memory R1 전용, `chat-search.ts:101-105`).
- `한` 어미 절단(`검증한`→`검증`). `MIN_STEM_SYLLABLES` 가드와 충돌한다(`synonyms.ts:126-127`, `notes/04` P2).
- `SKILL.md` 자연어 사다리(wp3), 버전 문자열 FILENAME 오분류(wp2), cwd 정체성 키(wp4).
- 라이브 12GB 인덱스에 대한 제품 스위트.

### 알고리즘 후보와 선택

오늘 소스에서 원문 3건을 `splitQueryWordsRaw`+`koreanStem`+`expandQueryWords`로 다시 분해했다(`query-words.ts:34-38`, `synonyms.ts:134-185`).

| 질의 | 공백 n | 지금 slice(8) | 심볼 | 어간 되는 항 | 어간 실패 |
|---|---:|---|---|---|---|
| D3 | 10 | `확인한` `방법` 폐기 | 없음 | 소스를→소스, 서비스에→서비스, 연결하고→연결, 동작까지→동작 | 지난번, 로컬, 실제, 정상, 확인한 |
| P2 | 5 | 캡 안 걸림 | 없음 | 코덱스를→코덱스, 재시작하면→재시작, 플러그인이→플러그인(+plugin), 사라지는→사라지 | 문제 |
| R2 | 9 | `기록` 폐기 | `2.49.0` FILENAME, `npm` SHORT_ASCII | 배포하고→배포(+deploy), 패키지가→패키지 | 소스인지, 검증한, 그, 진짜 |

후보 A. 현상 유지(8단어 AND). 오늘 기준선 6경로 0건. 기각.

후보 B. 단어 수 ≥5면 `--any` 자동. `notes/04` D3 `--any` 1위는 2026-07 로케일, P2 memory 1위는 ima2 재시작, R2 memory는 옛 npm 이름. 기각.

후보 C. 불용어만 제거. D3는 `방법` 하나 빠져도 9항 AND. P2는 `문제`를 빼도 `코덱스를` 원형이 chat에 남음. 기각(단독).

후보 D. 캡을 16으로만 올린다. AND 항이 늘어 R2는 더 엄격해진다. 기각(단독).

후보 E (채택). `MAX_WORDS=8`은 자르는 캡이 아니라 완화 임계값. 토큰은 `MAX_QUERY_TERMS=16`까지 유지. `groups.length > 8`이면 `isRequiredTerm`(심볼·버전·camelCase ASCII)은 필수 AND, 나머지는 선택, `minOptional = ceil(n_opt/2)`. 8 이하는 지금과 같은 전항 AND. 불용어 최소 목록은 필수 항에서만 빼고, chat `--synonyms`는 기본 off. 두 경로에 같은 `planMatches`.

E가 P2(5단어)를 직접 완화하지는 않는다. P2는 시드(`코덱스`↔codex, `재시작`↔restart) + 이미 있는 `플러그인`↔plugin + 어간 + 불용어 `문제`로 복구한다. D3/R2는 9~10항이라 E의 필수/선택 분기가 연다.

`소스인지`는 현재 어미 목록에 `인지`가 없어 어간이 없다(`synonyms.ts:73-109`, 오늘 실측 `koreanStem("소스인지")===null`). `인지`만 2음절 어미로 추가한다. `한`은 넣지 않는다.

## (2) 현재 코드

### 2.1 토큰 캡 — query-words.ts:20-38

MAX_WORDS=8이 공백 split 직후 slice한다. D3 10단어·R2 9단어의 뒷항은 매칭 전에 사라진다.

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

심볼 판정은 같은 파일 query-words.ts:47-73. 2.49.0은 FILENAME `/\.[a-z0-9]{1,5}$/`에 걸려 isSymbolWord true. npm은 SHORT_ASCII. 한글 산문은 전부 false. Codex·BundledPluginsMarketplace는 대소문자 혼용이지만 isSymbolWord false(query-words.test.ts:48).

### 2.2 chat AND every — chat-search.ts:101-118, 302

chat은 소문자 substring AND이고 어간·동의어가 없다. 주석이 index/scan 오라클을 이유로 경계 매칭을 메모리에만 둔다고 적는다.

```ts
function entryMatches(lowerText: string, words: string[], anyMode: boolean): boolean {
  return anyMode ? words.some((w) => lowerText.includes(w)) : words.every((w) => lowerText.includes(w));
}
// searchChat: words = splitQueryWords(query); DEFAULT_DAYS = 7 (chat-search.ts:31)
```

scan 경로도 entryMatches를 쓴다(chat-search.ts:302). 파일 프리필터 rollout.ts:207-212도 words.every/some. 세 곳이 어긋나면 오라클이 깨진다.

### 2.3 index 경로 — index-search.ts:95-115, 147-149, 70-71

wordCondition은 3글자 이상 trigram MATCH, 미만 LIKE. candidateFilter는 단어 조건을 AND/OR로 잇는다. JS textMatches가 scan과 같은 substring AND를 한 번 더 적용한다(index-search.ts:203-206).

```ts
function wordCondition(word: string, params: unknown[]): string {
  if ([...word].length >= 3) {
    params.push(ftsQuote(word));
    return "m.id IN (SELECT rowid FROM msgs_tri WHERE msgs_tri MATCH ?)";
  }
  params.push("%" + escapeLike(word) + "%");
  return "lower(m.text) LIKE ? ESCAPE '\\'";
}
function textMatches(text: string, words: string[], anyMode: boolean): boolean {
  const lower = text.toLowerCase();
  return anyMode ? words.some((w) => lower.includes(w)) : words.every((w) => lower.includes(w));
}
```

FTS 레인은 같은 단어를 AND/OR로 MATCH한다(index-search.ts:168). 완화 predicate를 넣으면 SQL 후보는 상위집합, JS가 최종 술어여야 한다. poolSize는 min(500, max(100, limit*10)) (index-search.ts:70-71). K=500은 이미 상한이다.

### 2.4 memory 그룹 AND/OR — memory-search.ts:351-388, 466-467, 579-607

```ts
function matches(lowerText: string, groups: QueryGroup[], anyMode: boolean): boolean {
  const groupHit = (group: QueryGroup) => group.some((term) => termIncludes(lowerText, term));
  return anyMode ? groups.some(groupHit) : groups.every(groupHit);
}
const words = splitQueryWordsRaw(query);
const groups: QueryGroup[] = (opts.synonyms ?? true)
  ? expandQueryWords(words)
  : expandQueryWords(words).map((group) => [group[0]]);
```

memory 기본은 동의어 on(cli.ts:146). chat에는 --synonyms 플래그가 없다(cli.ts:25-51, 61-85). 완화 재시도는 후보 0건 + 경계항일 때만(memory-search.ts:466-467). 한글 자연어는 재시도가 열리지 않는다.

stage1 SQL은 그룹 안 OR, 그룹 사이 AND/OR 후 JS matches로 재검사한다(memory-search.ts:579-607). 새 predicate는 JS가 권위다. 선택 항이 늘면 SQL AND가 과하게 조이므로 SQL WHERE는 필수 그룹만 AND하고 선택 그룹은 생략한다.

### 2.5 동의어·어간 — synonyms.ts:31-58, 73-146, 163-185

있는 시드(오늘 파일): plugin/plugins/플러그인(49행), deploy/deployment/배포(53행), release/릴리스(54행), review/검토(56행).
없는 시드(notes/04 P1, 오늘 재확인): dogfooding/도그푸딩, codex/코덱스, restart/재시작, verify/검증, source/소스.

koreanStem은 Hangul-only, 최장 어미, MIN_STEM_SYLLABLES=2, HA_VERB_TAIL. 배포하고→배포, 재시작하면→재시작. 소스인지·검증한은 null.

### 2.6 픽스처와 오라클

buildCodexHome(test/fixtures.ts:71-163)은 trigram/zebra/한글 검색용 4개 rollout + MEMORY.md + stage1 두 행이다. D3/P2/R2 원문, LSP/NaiControlsPanel, 활용형 배포 문서가 없다.

test/index.test.ts:46-81 오라클은 11개 질의(최대 2단어, 전부 8 이하)에 대해 index recent = scan, relevance 집합 = scan 집합. 새 predicate가 두 경로에 같으면 이 케이스는 그대로 통과해야 한다.

c-4는 query-words.test.ts:98-128, 196-209 — LSP가 NaiControlsPanel 파일을 안 고르고, --no-synonyms여도 경계가 유지된다.
c-5는 synonyms.test.ts:72-88 — 배포까지가 문서 배포에 닿고, synonyms:false면 0. L0 전달 040_delivery.md:88는 메모리 기억 실행 기록이 없어 c-5를 부분으로 남겼다. wp5는 합성 홈에서 닫는다.

## (3) 변경 파일 맵

| 파일 | 종류 | 변경 요지 | 예상 줄수 |
|---|---|---|---:|
| plugins/codexclaw/components/recall/src/query-words.ts | MODIFY | MAX_QUERY_TERMS=16, slice 교체, dropStopwords, isRequiredTerm, MatchPlan/compileMatchPlan/planMatches | +90 |
| plugins/codexclaw/components/recall/src/synonyms.ts | MODIFY | 시드 5그룹, 어미 인지 | +8 |
| plugins/codexclaw/components/recall/src/chat-search.ts | MODIFY | ChatSearchOptions.synonyms, split→compileMatchPlan, entryMatches→planMatches | +25 / -15 |
| plugins/codexclaw/components/recall/src/index-search.ts | MODIFY | IndexQueryOptions.plan, SQL은 필수 AND, JS는 planMatches, 빈 필수일 때 pool 2000 | +40 / -20 |
| plugins/codexclaw/components/recall/src/memory-search.ts | MODIFY | dropStopwords+compileMatchPlan, matches→planMatches, stage1 SQL 필수만 AND | +20 / -15 |
| plugins/codexclaw/components/recall/src/rollout.ts | MODIFY | matchesFilePrefilter가 MatchPlan 수신 | +10 / -6 |
| plugins/codexclaw/components/recall/src/cli.ts | MODIFY | chat --synonyms (기본 off), USAGE 한 줄 | +8 |
| plugins/codexclaw/components/recall/test/fixtures.ts | MODIFY | addNlGoldenCorpus: D3/P2/R2+c-4/c-5 합성 세션·md | +90 |
| plugins/codexclaw/components/recall/test/nl-query.test.ts | NEW | 골든셋 활성화 시나리오 | +180 |
| plugins/codexclaw/components/recall/test/query-words.test.ts | MODIFY | slice 16, compileMatchPlan, 불용어 vs CI | +60 |
| plugins/codexclaw/components/recall/test/synonyms.test.ts | MODIFY | 새 시드, 소스인지→소스→source, 한 가드 유지 | +40 |
| plugins/codexclaw/components/recall/test/index.test.ts | MODIFY | 9단어 오라클 1행 | +8 |
| plugins/codexclaw/components/recall/dist/{query-words,synonyms,chat-search,index-search,memory-search,rollout,cli}.js | MODIFY | 같은 커밋에 npm run build | 생성 |

SKILL.md, INDEX_SCHEMA_VERSION, 훅, cwd-scope는 손대지 않는다.

## (4) 변경 상세

import 규칙: 써드파티 금지, 소스는 `../src/x.ts`처럼 확장자 포함, 테스트는 `node:test` + `node:assert/strict`. `query-words.ts`는 `synonyms.ts`를 import하지 않는다(순환: synonyms.ts:24-28가 query-words를 가져간다). 확장은 호출부가 한다.

### 4.1 query-words.ts

before (`query-words.ts:20-38`): MAX_WORDS=8로 slice. MatchPlan 없음.

after — 기존 MAX_WORDS는 완화 임계로 남기고, 아래를 같은 파일 하단에 추가. splitQueryWordsRaw의 slice 인자만 MAX_QUERY_TERMS로 바꾼다. isSymbolWord/termIncludes는 그대로.

```ts
export const MAX_QUERY_TERMS = 16;
export const EXPERIMENTAL_STOPWORDS = new Set(["그", "이", "저", "것", "문제", "방법"]);

export type MatchPlan = {
  required: QueryGroup[];
  optional: QueryGroup[];
  minOptional: number;
  anyMode: boolean;
};

export function isRequiredTerm(rawWord: string): boolean {
  if (isSymbolWord(rawWord)) return true;
  // Codex, BundledPluginsMarketplace — mixed-case ASCII proper nouns.
  return /^[A-Za-z][A-Za-z0-9]*$/.test(rawWord) && /[A-Z]/.test(rawWord) && /[a-z]/.test(rawWord);
}

export function dropStopwords(rawWords: string[]): string[] {
  const kept = rawWords.filter(
    (w) => !EXPERIMENTAL_STOPWORDS.has(w.toLowerCase()) || isSymbolWord(w) || isRequiredTerm(w),
  );
  return kept.length > 0 ? kept : rawWords;
}

export function compileMatchPlan(
  groups: QueryGroup[],
  rawWords: string[],
  anyMode: boolean,
  relax: boolean,
): MatchPlan {
  if (anyMode || !relax) {
    return { required: groups, optional: [], minOptional: 0, anyMode };
  }
  const required: QueryGroup[] = [];
  const optional: QueryGroup[] = [];
  for (let i = 0; i < groups.length; i++) {
    const raw = rawWords[i] ?? groups[i][0]?.text ?? "";
    if (isRequiredTerm(raw)) required.push(groups[i]);
    else optional.push(groups[i]);
  }
  return { required, optional, minOptional: Math.ceil(optional.length / 2), anyMode: false };
}

export function allGroups(plan: MatchPlan): QueryGroup[] {
  return [...plan.required, ...plan.optional];
}

export function planMatches(lowerText: string, plan: MatchPlan): boolean {
  const groupHit = (group: QueryGroup) => group.some((term) => termIncludes(lowerText, term));
  if (plan.anyMode) return allGroups(plan).some(groupHit);
  if (!plan.required.every(groupHit)) return false;
  if (plan.optional.length === 0) return true;
  return plan.optional.filter(groupHit).length >= plan.minOptional;
}
```

splitQueryWordsRaw after:

```ts
export function splitQueryWordsRaw(query: string): string[] {
  return query.split(/\s+/).filter((w) => w.length > 0).slice(0, MAX_QUERY_TERMS);
}
```

채택 E의 동작 예(오늘 실측 토큰). 불용어 적용 후 compileMatchPlan:

- D3 10항, 방법 제거 → 9 > 8, 필수 0, 선택 9, minOptional=5. 문서가 로컬·소스를·실제·서비스에·연결하고·정상·동작까지를 가지면 7≥5로 통과. 지난번·확인한은 빠져도 된다.
- P2 5항, 문제 제거 → 4 ≤ 8, 전항 AND. chat 기본(동의어 off)은 코덱스를 원형 필수. --synonyms on이면 (코덱스를|코덱스|codex) ∧ (재시작하면|재시작|restart) ∧ (플러그인이|플러그인|plugin) ∧ (사라지는|사라지).
- R2 9항, 그 제거 후 8그룹이지만 relax는 rawAll.length=9>8 이라 켠다. 필수 {2.49.0, npm}, 선택 6, minOptional=3.

완화 임계는 groups.length가 아니라 호출부가 넘기는 relax다. dropStopwords 뒤에 토큰이 8 이하로 줄어도, 원문 rawAll.length > MAX_WORDS이면 필수/선택 분기를 탄다.

R2: rawAll=9 → relax true, drop 그 → 8그룹. 필수 {2.49.0, npm}, 선택 6, minOptional=3. 문서가 2.49.0 ∧ npm ∧ (배포|패키지|소스|검증한|기록) 중 3이면 통과.

### 4.2 synonyms.ts

before SYNONYM_GROUPS 마지막 네 줄(synonyms.ts:53-58):

```ts
  ["deploy", "deployment", "배포"],
  ["release", "releases", "릴리스", "릴리즈"],
  ["commit", "commits", "커밋"],
  ["review", "reviews", "리뷰", "검토"],
  ["branch", "branches", "브랜치"],
];
```

after — 있는 plugin/deploy는 중복 추가하지 않는다. 도그 푸딩(공백 둘)은 한 토큰이 아니므로 시드에 넣지 않는다. 두 단어 질의 도그 푸딩은 기존 AND로 이미 산다(오늘 chat n=3).

```ts
  ["deploy", "deployment", "배포"],
  ["release", "releases", "릴리스", "릴리즈"],
  ["commit", "commits", "커밋"],
  ["review", "reviews", "리뷰", "검토"],
  ["branch", "branches", "브랜치"],
  ["dogfooding", "도그푸딩"],
  ["codex", "코덱스"],
  ["restart", "재시작"],
  ["verify", "verification", "verified", "검증", "provenance"],
  ["source", "소스"],
];
```

KOREAN_ENDINGS 2음절 구간에 "인지"를 넣는다(synonyms.ts:77-94, 이미 길이 내림차순 sort). 소스인지→소스(2음절). 인지 단독은 stem 빈 문자열 → MIN_STEM_SYLLABLES에 걸린다. 한은 넣지 않는다.

source↔소스 양방향은 영어 source 질의 노이즈 위험이 있다(thread_source, source files). 골든셋과 기존 "trigram" 오라클이 깨지는지로 판정하고, 깨지면 한글 질의에서만 stem lookup이 영어 시드를 타도록 expandQueryWords를 바꾸지 말고 이 그룹을 뺀다(후퇴는 시드 한 줄).

### 4.3 chat-search.ts + rollout.ts

ChatSearchOptions에 `synonyms?: boolean`(기본 false)를 더한다. searchChat 본문:

before (chat-search.ts:116-118):

```ts
  const anyMode = opts.any ?? false;
  const words = splitQueryWords(query);
```

after:

```ts
import { expandQueryWords } from "./synonyms.ts";
import {
  splitQueryWordsRaw,
  dropStopwords,
  compileMatchPlan,
  planMatches,
  MAX_WORDS,
  type MatchPlan,
} from "./query-words.ts";

function groupsForChat(raw: string[], synonyms: boolean): QueryGroup[] {
  if (!synonyms) return raw.map((w) => [{ text: w.toLowerCase(), boundary: false }]);
  return expandQueryWords(raw).map((g) => g.map((t) => ({ text: t.text, boundary: false })));
}

function buildPlan(query: string, anyMode: boolean, synonyms: boolean): MatchPlan {
  const rawAll = splitQueryWordsRaw(query);
  const raw = dropStopwords(rawAll);
  return compileMatchPlan(groupsForChat(raw, synonyms), raw, anyMode, rawAll.length > MAX_WORDS);
}
```

entryMatches는 삭제하고 planMatches(lowerText, plan)로 교체한다. searchViaIndex/searchViaScan에 words 대신 plan을 넘긴다. scan의 matchesFilePrefilter(content.toLowerCase(), words, anyMode)는 matchesFilePrefilter(content.toLowerCase(), plan)으로.

rollout.ts:207-212 after:

```ts
import { planMatches, type MatchPlan } from "./query-words.ts";
export function matchesFilePrefilter(lowerContent: string, plan: MatchPlan): boolean {
  return planMatches(lowerContent, plan);
}
```

기존 테스트가 words[] 시그니처를 직접 부르면 그 호출만 plan으로 바꾼다. grep 대상: matchesFilePrefilter.

### 4.4 index-search.ts

IndexQueryOptions.words/anyMode를 plan: MatchPlan으로 교체한다. candidateFilter withWords 분기:

```ts
function groupCondition(group: QueryGroup, params: unknown[]): string {
  const parts = group.map((t) => wordCondition(t.text, params));
  return "(" + parts.join(" OR ") + ")";
}

function candidateFilter(opts: IndexQueryOptions, withWords = true): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const conds: string[] = [];
  if (withWords) {
    const req = opts.plan.required.map((g) => groupCondition(g, params));
    if (req.length > 0) conds.push("(" + req.join(" AND ") + ")");
    // optional은 SQL에 넣지 않는다. AND하면 minOptional보다 조이고, OR하면 12GB에서 과다 후보.
    // JS planMatches가 최종 술어(index-search.ts:203-206와 같은 역할).
  }
  // synthetic/tools/role/cutoff/source/cwd 조건은 그대로
  return { where: conds.length > 0 ? conds.join(" AND ") : "1", params };
}

function textMatches(text: string, plan: MatchPlan): boolean {
  return planMatches(text.toLowerCase(), plan);
}
```

필수 0(D3): candidateFilter의 단어 절이 비어 필터만 남는다. 이 때만 poolSize를 2000으로 올린다.

```ts
function poolSize(limit: number, requiredCount: number): number {
  const base = Math.min(500, Math.max(100, limit * 10));
  return requiredCount === 0 ? Math.min(2000, Math.max(base, 1000)) : base;
}
```

laneRanks 입력 단어: 필수 그룹의 lead text. 필수 0이면 선택 그룹 중 글자 수 ≥3 lead를 OR MATCH(상한 6개, 긴 것 우선). ranking은 후보를 넓힐 뿐 술어가 아니다.

index/scan 동등성은 `planMatches(plan, text)`를 세 지점에 최종 술어로 두는 것으로 지킨다(A3): (1) relevance 경로 `rankedRows`의 후보 재검사(`index-search.ts:203-206`의 `textMatches` 자리), (2) recent 경로(`index-search.ts:243-249`)의 행 필터 — 현재 JS 술어가 없다, (3) top-up 스윕(`index-search.ts:213-221`)의 행 필터. recent 경로는 `LIMIT limit + 1` 선절단(`index-search.ts:247`) 때문에 술어를 붙이면 페이지가 덜 찰 수 있으므로 fetch 크기를 `poolSize(limit, requiredCount)`(필수어 0개면 2000)로 올리고 술어 적용 후 `limit + 1`로 자른다. §5의 동등성 테스트는 필수어 1개 이상과 0개 오라클을 relevance/recent 두 모드로 돌려 scan 결과와 집합 비교한다(`test/index.test.ts:65` 비교 함수 재사용).

### 4.5 memory-search.ts

before (memory-search.ts:385-388): splitQueryWordsRaw + expandQueryWords, matches every.

after:

```ts
const rawAll = splitQueryWordsRaw(query);
const raw = dropStopwords(rawAll);
const groups: QueryGroup[] = (opts.synonyms ?? true)
  ? expandQueryWords(raw)
  : expandQueryWords(raw).map((group) => [group[0]]);
const plan = compileMatchPlan(groups, raw, anyMode, rawAll.length > MAX_WORDS);
```

collect/searchStage1의 matches(lower, groups, anyMode)를 planMatches(lower, plan)로 교체. scoreChunk/firstPresentMember는 allGroups(plan)을 넘긴다(선택 항 미매칭은 기존처럼 coverage 0).

stage1 SQL WHERE: 필수 그룹만 AND(그룹 안 OR). 선택 그룹은 SQL에 넣지 않고 JS planMatches가 걸러낸다. 필수 0이면 WHERE 1 + JS minOptional — stage1 행 수가 작아(라이브 수백) 전수 스캔이 맞다.

### 4.6 cli.ts

parseArgs options에 synonyms: { type: "boolean", default: false }를 추가한다. --no-synonyms는 memory 기본 on을 끄는 기존 플래그로 남긴다.

runChatSearch opts에 `synonyms: values.synonyms === true`.

USAGE (cli.ts:26-28, 48 근처) after 한 줄:

```
  --synonyms   chat search: ko/en synonyms + korean stem (default off; memory stays on unless --no-synonyms)
```

chat 시놉시스 줄에 [--synonyms]를 넣는다. memory 줄은 그대로 [--no-synonyms].

### 4.7 fixtures.ts — addNlGoldenCorpus

buildCodexHome는 ingest===4 계약을 깨지 않게 그대로 둔다(index.test.ts:33). 골든셋은 별 함수.

```ts
export const THREAD_NL_D3 = "019f0000-0000-7000-8000-00000000d301";
export const THREAD_NL_P2 = "019f0000-0000-7000-8000-00000000d302";
export const THREAD_NL_R2 = "019f0000-0000-7000-8000-00000000d303";

export function addNlGoldenCorpus(root: string): void {
  const today = dateParts(0);
  const dir = join(root, "sessions", today.y, today.m, today.d);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T11-00-00-${THREAD_NL_D3}.jsonl`),
    sessionMeta(THREAD_NL_D3, "/proj/alpha", false, today.iso) +
      message("user", "도그 푸딩 세팅좀 해줘 ff 하고", today.iso) +
      message(
        "assistant",
        "로컬 소스를 bun link 로 실제 서비스에 연결하고 healthz :10100 정상 동작까지 확인했다. dogfooding complete.",
        today.iso,
      ),
  );
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T12-00-00-${THREAD_NL_P2}.jsonl`),
    sessionMeta(THREAD_NL_P2, "/proj/alpha", false, today.iso) +
      message("user", "코덱스 재시작하니 플러그인이 사라짐", today.iso) +
      message(
        "assistant",
        "Codex를 재시작하면 BundledPluginsMarketplace 플러그인이 사라지는 문제가 재현된다. plugin wipe.",
        today.iso,
      ),
  );
  writeFileSync(
    join(dir, `rollout-${today.y}-${today.m}-${today.d}T13-00-00-${THREAD_NL_R2}.jsonl`),
    sessionMeta(THREAD_NL_R2, "/proj/alpha", false, today.iso) +
      message("user", "2.49.0 provenance 확인해", today.iso) +
      message(
        "assistant",
        "2.49.0 npm latest gitHead 가 그 소스와 같다. 배포 패키지 검증한 기록. provenance SLSA.",
        today.iso,
      ),
  );

  const mem = join(root, "memories");
  mkdirSync(mem, { recursive: true });
  writeFileSync(join(mem, "nl-d3.md"), "# dogfooding\n\n로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인. bun link healthz 10100.\n");
  writeFileSync(join(mem, "nl-p2.md"), "# plugin wipe\n\nCodex restart 후 BundledPluginsMarketplace 플러그인이 사라지는 문제.\n");
  writeFileSync(join(mem, "nl-r2.md"), "# 2.49.0 provenance\n\n2.49.0 npm 패키지가 그 소스인지 검증한 기록. gitHead SLSA.\n");
  writeFileSync(join(mem, "nl-c4-mismatch.md"), "# Notes\n\nTouched NaiControlsPanel and negativePrompt.\n");
  writeFileSync(join(mem, "nl-c4-real.md"), "# Real\n\nThe LSP server crashed.\n");
  writeFileSync(join(mem, "nl-c5.md"), "# 운영 노트\n\n첫 배포 이후 인덱스 재생성이 필요했다.\n");
}
```

sessionMeta/message는 같은 파일의 비공개 함수다. export하거나 addNlGoldenCorpus를 fixtures.ts 안에 둔다(후자).

D3 채팅 문장에는 지난번·확인한·방법이 없다. 완화 없이는 0, minOptional=5면 로컬/소스를/실제/서비스에/연결하고/정상/동작까지로 7≥5.
P2 채팅 문장은 Codex·재시작·플러그인이 사라지는. chat 기본은 코덱스를 원형 미스. --synonyms면 코덱스→codex.
R2 문장은 2.49.0 ∧ npm ∧ 소스/검증한/기록/배포/패키지. 필수 2 + 선택 ≥3.

## (5) 테스트 계획

새 파일 `plugins/codexclaw/components/recall/test/nl-query.test.ts`. 합성 홈만 사용(`buildCodexHome` + `addNlGoldenCorpus`). `--home`과 `--index-path`를 픽스처 안으로 고정해 라이브 12GB 인덱스를 읽지 않게 한다(오늘 `chat-fallback.test.ts:176` aardwolf 실패는 이 누락이 원인).

| id | 파일 | 입력 | 타는 분기 | 관측 |
|---|---|---|---|---|
| G-D3-chat | nl-query.test.ts | chat D3 원문, synonyms off, days 0 | rawAll=10>8, 방법 drop, 필수0 선택9 min=5, index+scan | n≥1, 히트 텍스트에 bun link 또는 healthz, index 집합=scan 집합 |
| G-D3-mem | nl-query.test.ts | memory D3 원문, --no-chat | 같은 plan, 어간 소스/서비스/연결/동작 | n≥1, relpath nl-d3.md |
| G-P2-chat-off | nl-query.test.ts | chat P2 원문, synonyms off | 4≤8 전항 AND, 코덱스를 원형 | n=0 (문서 Codex) |
| G-P2-chat-on | nl-query.test.ts | chat P2, synonyms true | 코덱스→codex, 재시작, 플러그인 | n≥1, 히트에 BundledPluginsMarketplace 또는 plugin wipe |
| G-P2-mem | nl-query.test.ts | memory P2 | 기본 synonyms on | n≥1, relpath nl-p2.md |
| G-R2-chat | nl-query.test.ts | chat R2 원문, synonyms off | rawAll=9>8, 그 drop, 필수 2.49.0∧npm, minOptional=3 | n≥1, 히트에 gitHead 또는 provenance |
| G-R2-mem | nl-query.test.ts | memory R2, --no-chat | 소스인지→소스→source, 배포→deploy | n≥1, relpath nl-r2.md |
| G-R2-nosyn | nl-query.test.ts | memory R2, synonyms false | 어간/시드 없음, 완화는 유지 | n≥1 (2.49.0∧npm∧검증한/기록/소스 표면) |
| G-c4 | nl-query.test.ts | memory LSP | 경계 매칭, 완화 재시도 안 열림(real.md 존재) | hits every relpath===nl-c4-real.md, NaiControlsPanel 파일 없음 |
| G-c5 | nl-query.test.ts | memory 배포까지 | koreanStem+시드 | n≥1 nl-c5.md; synonyms false면 0 |
| G-c5-mem-recall | synonyms.test.ts | 메모리 기억 | 기존 그룹 memory/메모리/기억 | 영어-only 문서 decision과 같이, 기억→memory 히트 (L0 부분 c-5 닫기) |
| Q-stop-CI | query-words.test.ts | dropStopwords(["CI","문제"]) | 심볼 보존 | ["CI"] |
| Q-stop-all | query-words.test.ts | dropStopwords(["그","문제"]) | 전부 불용어면 원본 유지 | length 2 |
| Q-slice | query-words.test.ts | 17 토큰 | MAX_QUERY_TERMS | length 16; 10토큰은 10 |
| Q-required | query-words.test.ts | isRequiredTerm | 2.49.0, npm, CI, Codex, BundledPluginsMarketplace true; 배포하고, 코덱스 false | |
| Q-plan-d3 | query-words.test.ts | compileMatchPlan D3 토큰 | relax true | required=[], optional=9, minOptional=5 |
| Q-plan-short | query-words.test.ts | compileMatchPlan(["trigram","korean"]) | relax false | required 2, optional 0 — 기존 AND |
| Q-any | query-words.test.ts | anyMode true, 10단어 | --any가 minOptional을 이김 | plan.anyMode true, optional [] |
| S-인지 | synonyms.test.ts | koreanStem("소스인지") | 어미 인지 | "소스"; koreanStem("인지") null; koreanStem("검증한") null |
| S-시드 | synonyms.test.ts | expandQueryWords(["도그푸딩"]), ["코덱스를"], ["재시작하면"], ["검증한"] | 시드+어간 | 도그푸딩 그룹에 dogfooding; 코덱스를 그룹에 코덱스+codex; 재시작+restart; 검증한은 한 미절단이라 verify 없음 |
| O-9word | index.test.ts | "please deploy the trigram index for korean search extra" | 9>8 완화, extra는 선택 | viaIndex recent 집합 = viaScan 집합 (기존 11행에 추가) |
| 동 | O-9word-required (A3) | 필수어 1개 이상 포함 9단어 오라클을 relevance/recent 두 모드로 돌려 scan 결과와 집합 동일 (test/index.test.ts:65 비교 함수) |
| 동 | O-9word-relevance (A3) | 필수어 0개 9단어 오라클을 relevance 모드로 돌려 scan과 집합 동일 — recent 행(O-9word)과 함께 세 지점 술어를 모두 활성화 |
| O-old | index.test.ts | 기존 11행 | 2단어 AND | 그대로 통과 |
| N-empty | nl-query.test.ts | zxqv84721무지개잠수함 | 부재 | n=0, 경고만 |

G-P2-chat-off n=0은 의도: chat 동의어 기본 off를 고정한다. 원문 P2를 chat에서 살리려면 --synonyms가 필요하다는 계약.

## (6) 검증 명령

오늘(2026-09-10) 이 워크트리에서 실행한 결과. 구현 전 기준선이다.

```
cd plugins/codexclaw/components/recall && node --test
```

exit 1. 138 tests, pass 137, fail 1. 실패: test/chat-fallback.test.ts:176 `cli: memory search falls back to the real chat engine, and --no-chat opts out` — aardwolf가 픽스처 세션에만 있고 CLI가 기본 사이드카 인덱스를 연다. wp5 범위 밖. glob: `node --test`가 이 디렉터리의 `test/*.test.ts`를 전부 로드하고, 그 파일들이 `../src/query-words.ts` `chat-search.ts` `index-search.ts` `memory-search.ts` `synonyms.ts` `cli.ts`를 import한다.

```
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

exit 0. pass 1 (`F1: committed dist/ is in sync with src/`). 인자 glob은 `plugins/codexclaw/test/dist-freshness.test.mjs` 한 파일. 테스트 본문이 `COMPONENTS`의 각 `src/**/*.ts`를 `listTsFiles`로 읽고 `compileSource`한 뒤 같은 상대경로 `dist/*.js`와 바이트 비교한다. recall src 16파일이 이 경로로 읽힌다.

구현 후 같은 두 명령 + 골든셋만:

```
cd plugins/codexclaw/components/recall && node --test test/nl-query.test.ts test/query-words.test.ts test/synonyms.test.ts test/index.test.ts
```

라이브 기준선 재확인(인덱스를 쓰지 않게 --no-refresh). BIN은 설치 캐시:

```
BIN=~/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs
node "$BIN" chat search "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법" --days 0 --limit 3 --json --no-tools --no-refresh
node "$BIN" memory search "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법" --days 0 --limit 3 --json --no-chat --no-refresh
node "$BIN" chat search "코덱스를 재시작하면 플러그인이 사라지는 문제" --days 0 --limit 3 --json --no-tools --no-refresh
node "$BIN" memory search "코덱스를 재시작하면 플러그인이 사라지는 문제" --days 0 --limit 3 --json --no-chat --no-refresh
node "$BIN" chat search "2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록" --days 0 --limit 3 --json --no-tools --no-refresh
node "$BIN" memory search "2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록" --days 0 --limit 3 --json --no-chat --no-refresh
```

오늘 hit 수: 위 6행 모두 n=0 (chat D3 7736ms, P2 240ms, R2 408ms; memory 81/47/66ms). 구현·재설치 후 목표는 합성 테스트 n>0이고, 라이브는 n>0을 기대하되 정답 스레드는 스킬 사다리(wp3)가 책임진다. `--any`로 n만 채우면 실패로 본다.

K=500 비교 명령(구현 전후 같은 BIN, --no-refresh). poolSize는 index-search.ts:70-71의 500 상한. 필수 0 분기는 2000으로 올린 뒤 elapsedMs를 나란히 적는다.

```
BIN=~/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs
# 짧은 통제
node "$BIN" chat search "도그푸딩" --days 0 --limit 3 --json --no-tools --no-refresh
node "$BIN" chat search "로컬 소스 서비스" --days 0 --limit 3 --json --no-tools --no-refresh
# 긴 AND (오늘 7736ms)
node "$BIN" chat search "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법" --days 0 --limit 3 --json --no-tools --no-refresh
# 필수 심볼 포함
node "$BIN" chat search "2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록" --days 0 --limit 3 --json --no-tools --no-refresh
```

오늘 통제: 도그푸딩 160ms n=3, 로컬 소스 서비스 273ms n=3, 2.49.0 배포 npm 169ms n=3. D3 7736ms는 8항 trigram AND 교집합이 빈 결과일 때의 비용. 채택 E는 D3 SQL에서 단어 AND를 빼므로 7736ms보다 줄거나, 필수0 pool=2000 스윕만큼 늘 수 있다. 구현 후 elapsedMs가 통제(≤300ms)의 20배를 넘으면 pool을 500으로 되돌리고 SQL에 선택 항 중 가장 긴 2개를 AND 프리필터로 넣는 후퇴를 연다.

## (7) dist 재생성

src를 고치면 같은 커밋에 `npm run build`(plugins/codexclaw/scripts/build.mjs, COMPONENTS에 recall 포함) 결과 dist/*.js를 담는다. dist-freshness가 src→dist 바이트를 다시 계산한다.

이 사이클에서 내용이 바뀌는 추적 dist:

- plugins/codexclaw/components/recall/dist/query-words.js
- plugins/codexclaw/components/recall/dist/synonyms.js
- plugins/codexclaw/components/recall/dist/chat-search.js
- plugins/codexclaw/components/recall/dist/index-search.js
- plugins/codexclaw/components/recall/dist/memory-search.js
- plugins/codexclaw/components/recall/dist/rollout.js
- plugins/codexclaw/components/recall/dist/cli.js

cli.js는 chat-search/query-words re-export를 컴파일한 결과라 USAGE 문자열이 들어간다. cwd-context.js, format.js, hook.js, index-db.js, ingest.js, paths.js, sqlite.js, text-lines.js, threads-db.js는 import 그래프가 안 바뀌면 바이트 동일해야 한다. 스키마 버전 문자열은 dist에 넣지 않는 한 index-db.js도 그대로.

## (8) 위험·롤백

| 위험 | 근거 | 완화 |
|---|---|---|
| 9단어 이상 기존 질의 의미가 바뀜 | 지금 slice(8)이 9번째를 버려 AND가 우연히 성공 | 8 이하는 전항 AND 유지. 오라클에 9단어 1행. 롤백은 compileMatchPlan의 relax 플래그를 false로 고정 |
| 필수 0 + pool 2000이 12GB에서 느림 | 오늘 D3 8-AND가 이미 7736ms | 비교 명령. 20× 통제 초과 시 pool 500 + 최장 선택 2항 SQL AND 후퇴 |
| source↔소스 노이즈 | 양방향 시드 | 오라클·nl-query 회귀. 깨지면 시드 한 줄 삭제 |
| 불용어 이/그 가 짧은 질의 붕괴 | dropStopwords 전부 제거 시 원본 유지, CI는 심볼 보존 | Q-stop-* |
| chat --synonyms가 index/scan 불일치 | 한쪽만 expand | groupsForChat을 두 경로 앞에서 한 번만. O-9word |
| c-4 후퇴 | 선택 OR가 LSP를 느슨하게 | LSP는 1단어 ≤8, 전항 AND+경계 유지. G-c4 |
| stage1 SQL을 선택 AND로 남기면 R2 0건 유지 | memory-search.ts:595 | 필수만 SQL AND |
| 라이브 n>0이 오답 | notes/04 --any 반례 | 합성 골든셋이 합격 기준. 라이브는 참고 |
| chat-fallback aardwolf 실패가 CI를 가림 | 오늘 exit 1, 라이브 인덱스 누수 | wp5에서 --index-path를 CLI 테스트에 넣는 것은 OUT. 실패를 이 PR 탓으로 적지 않는다 |

롤백: query-words.ts의 compileMatchPlan을 `return { required: groups, optional: [], minOptional: 0, anyMode }`로 되돌리면 술어가 전항 AND로 돌아간다. slice를 8로 되돌리면 D3/R2 뒷단어도 다시 버린다. 시드/인지 어미는 독립적으로 되돌릴 수 있다.

## (9) PR 제목·본문 초안

제목: `fix(recall): relax long natural-language AND without breaking index/scan parity`

본문:

```
긴 한국어 문장 질의(D3/P2/R2)가 공백 8단어 AND + chat 무어간 때문에 0건이다.
MAX_WORDS=8은 자르지 않고 완화 임계로 쓴다. 9단어 이상은 심볼/고유명사/숫자를 필수 AND,
나머지를 ceil(n/2) 선택 매칭으로 둔다. chat --synonyms는 기본 off.
불용어는 그/이/저/것/문제/방법만. 동의어 시드에 도그푸딩/코덱스/재시작/검증/소스를 더하고
어미 인지를 추가한다. index와 scan은 같은 planMatches를 쓴다.

검증: components/recall node --test (nl-query/query-words/synonyms/index),
dist-freshness, 설치본 원문 3건은 구현 전 n=0 기준선 기록.

Stack (enforce-pr-target: every PR base is dev; local branch chain + merge order):

| order | work-phase | branch (local) | PR base | merge after |
|-------|------------|----------------|---------|-------------|
| 1 | wp1 gate | codex/memory-l1-wp1-gate | dev | — |
| 2 | wp2 symbol | codex/memory-l1-wp2-symbol | dev | 독립, wp5보다 먼저 |
| 3 | wp3 skill | codex/memory-l1-wp3-skill | dev | wp1+wp2 |
| 4 | wp4 identity | codex/memory-l1-wp4-identity | dev | wp3 |
| 5 | wp5 NL (this) | codex/memory-l1-wp5-nl | dev | wp2 (query-words 공유) |

wp5 로컬 브랜치는 wp2 머지 커밋 위에 쌓는다. PR target은 여전히 dev다.
```

성공 기준: 합성 홈에서 D3 chat/memory n>0, P2 memory n>0, P2 chat는 --synonyms on일 때만 n>0, R2 chat/memory n>0, c-4 LSP↛NaiControlsPanel, c-5 배포까지→배포, index/scan 집합 동일, --no-synonyms가 시드 확장을 끈다. 라이브 원문 3건 n>0은 보너스이지 이 PR의 단독 게이트가 아니다.

## 검증 명령 정정 (메인, 2026-09-10 07:25)

이 문서가 기록한 recall 컴포넌트 `node --test` exit 1(`chat-fallback.test.ts:176`)은 코드 결함이 아니라 러너 미사용 탓이다. 그 테스트는 memory→chat 폴백이 사이드카 인덱스를 읽는데, `CODEXCLAW_HOME`을 덮지 않으면 사용자 실인덱스(12GB)를 읽어 합성 픽스처 `aardwolf`를 못 찾는다. 레포 러너 `plugins/codexclaw/scripts/test.mjs`(`CODEXCLAW_HOME`을 임시 디렉터리로 덮음, test.mjs:7-11)로 돌리면 9/9 통과, exit 0이다(메인 세션 실측). 이후 모든 C 단계 검증은 다음 형태를 쓴다.

```bash
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/<comp>/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

## A 감사 반영 (round 1, 2026-09-10)

blocker #3(index/scan 동등성): `index-search.ts:243-249`의 recent 경로에는 JS 술어가 없고, top-up 스윕(:213-221)도 `textMatches`를 적용하지 않는다. 선택 그룹을 SQL WHERE에서 빼면 필수어 0개 질의에서 recent 모드가 "최신 limit+1건"으로 퇴화한다. 수정: `planMatches(plan, text)`를 (1) 관련도 경로의 후보 필터, (2) recent 경로의 행 필터, (3) top-up 스윕의 행 필터 세 곳 모두에 최종 술어로 적용한다. §4.4에 이 세 지점을 path:line으로 적고, §5 테스트 표에 "필수어 0개 9단어 질의를 relevance/recent 두 모드로 돌려 히트 집합이 같다"(index/scan 동등성 확장, `test/index.test.ts:65` 비교 함수 재사용) 케이스를 추가한다. 오라클 문장은 필수어가 최소 1개 있는 것과 0개인 것 두 종류를 둔다.

행 번호 정정: §4 before 인용 `chat-search.ts:116-118`은 117행(`const source = ...`)을 생략 표시 없이 뺐다. 전체 인용으로 읽는다.


## P 재검증 (wp5 사이클, 2026-09-10)

기준 트리 `19e2dd5d`(origin/dev, #127 머지 직후). 계획 이후 recall src가 wp2(#125: query-words VERSION/relaxGroupsAt, memory-search groupHit/markGroupPresence/fillStage1Presence/collect(active,tallyPresence))와 wp4(#127: repo-key.ts, rollout readRolloutMeta.repoKey, index-search candidateFilter repo_key/repoThreadIds, memory-search scopeAdjust repoKey, chat-search scan 필터, cli 도움말)로 바뀌었다. 이 문서의 §2 인용 행 번호는 밀렸고 일부 before 블록은 현재 코드와 다르다. B는 심볼로 찾아 patch하며 다음을 지킨다: (1) `planMatches`를 relevance 후보 재검사·recent 행 필터·top-up 스윕 세 지점에 최종 술어로(A3), recent fetch는 `poolSize`로 올린 뒤 술어 적용 후 `limit+1` 절단; (2) `splitQueryWordsRaw`/`MAX_WORDS`는 VERSION 분류·relaxGroupsAt와 공존(자르지 않고 완화 임계로); (3) chat `--synonyms`는 기본 off; (4) 불용어는 `그/이/저/것/문제/방법`만; (5) 골든셋 픽스처는 합성 홈만 쓰고(`--home`·`--index-path` 고정) 실인덱스를 읽지 않는다; (6) index/scan 동등성 테스트에 필수어 0개·1개 이상 오라클을 relevance/recent 두 모드로. 브랜치 `codex/memory-l1-wp5-nl-query`(origin/dev 위).



## A 감사 반영 (wp5 round 1, 2026-09-10)

리뷰어(grok-4.6) GO-WITH-FIXES(blocker 3, Medium 2). 전부 구현 제약으로 접는다(B가 준수, C가 테스트로 확인).

1. memory-search: `planMatches`를 검색 시작 시 한 번 컴파일한 고정 plan에 묶지 않는다. `collect(active, tallyPresence)` 안에서 `compileMatchPlan(active, raw, anyMode, relax)`를 다시 만들어 #125의 `relaxGroupsAt(groups, miss)` 재시도가 boundary:false 그룹으로 매칭되게 한다. `markGroupPresence`는 원본 groups 기준 유지. `searchStage1`은 필수어 0개면 `WHERE 1`(빈 conds로 잘못된 SQL 금지).
2. index-search: `candidateFilter`(시그니처 `ResolvedQuery`)는 withWords 분기만 교체한다. #127의 synthetic/tools/role/cutoff/source 조건과 cwd 접두사 OR `f.repo_key` OR `repoThreadIds IN` 꼬리는 원문 유지, 필수어 SQL과 AND로 결합. `laneRanks` 입력은 필수 lead(필수 0이면 선택 ≥3자 lead OR, 상한 6). A3 세 지점(relevance 재검사·top-up 스윕·recent 행 필터) + recent `poolSize` fetch 후 `limit+1` 절단 유지.
3. 픽스처 G-R2-chat: R2 assistant 문장에 선택 원형을 3개 이상 넣는다(예: `2.49.0 npm 패키지가 진짜 그 소스인지 검증한 기록. 배포하고 provenance`)여야 synonyms-off minOptional=3을 채운다.
4. Medium: 회귀 범위 문구를 "E 분기(필수/선택)는 8단어 이하에서 꺼진다; 불용어·시드·`인지` 어미는 8단어 이하에도 적용되며 P2(5토큰)는 그 층으로 복구된다"로 정정. `query-words.test.ts:34`의 MAX_WORDS 절단 핀은 새 동작(자르지 않고 완화 임계)에 맞게 갱신.
5. Medium: `planMatches` 인자 순서는 §4.1 타입대로 `planMatches(lowerText, plan)`로 세 지점 통일.

