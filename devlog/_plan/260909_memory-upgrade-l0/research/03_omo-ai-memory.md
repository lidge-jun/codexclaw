# omo-ai@beta (5.0.0-0.beta.48) 메모리 시스템 분석

- 분석일: 2026-09-09
- 대상: npm `omo-ai@beta` = `5.0.0-0.beta.48` (`npm view omo-ai@beta version dist.tarball`)
- 증거: `/Users/jun/Developer/new/700_projects/codexclaw/tmp/memory-analysis-260909/evidence/omo-ai-beta.tgz` 를 `evidence/omo/` 에 풀어서 직접 읽음
- 핵심 코드: `evidence/omo/package/plugin/extensions/omo.js` (1,038,931 bytes, minify 되어 **1줄**). 줄 번호가 무의미하므로 아래 인용은 **바이트 오프셋(@@)** 으로 표기한다. 재현: `node -e 'const s=require("fs").readFileSync("omo.js","utf8"); console.log(s.slice(OFFSET, OFFSET+400))'`

## 0. 먼저: 기존 분석 문서와의 관계 (완전히 다른 시스템)

`/Users/jun/Developer/codex/010_memory-pipeline/10_omo_memory.md` (2026-06-27 기준) 는 omo 를 **OpenCode 위의 플러그인**으로 보고, 메모리의 본체를 `.omo/boulder.json` 작업상태 JSON + `.omo/tasks/` + 세션 트랜스크립트 도구로 정리했다. 그 문서는 "omo는 Claude Code 류의 `MEMORY.md`/Dream consolidation 과는 결이 다르다"고 명시한다.

**현재 beta 는 그 구조가 아니다.** package.json 이 스스로를 이렇게 설명한다:

```json
"description": "omo native edition - the senpi-based OMO harness. Beta channel only: npm i -g omo-ai@beta",
"dependencies": { "@code-yeongyu/senpi": "2026.9.7-2" }
```
(`evidence/omo/package/package.json`)

즉 호스트가 OpenCode → **senpi** 로 바뀌었고, 메모리는 boulder 작업상태가 아니라 **git 저장소 기반 memory filesystem + 백그라운드 reflection/dream/facts/memorian 에이전트**로 완전히 재작성됐다. 프롬프트 캐시 키가 `senpi-memory-v2` 로 박혀 있다(@@622163). boulder 자체는 아직 남아 있다 — `plugin/skills/` 에 `ulw-execute`("execute a Prometheus work plan with Boulder state", `plugin/README.md`) 가 있다. 하지만 **작업상태(boulder)와 장기기억(memory repo)은 이제 별개 계층**이고, 이 문서는 후자를 다룬다.

기존 `10_omc_memory.md`, `10_omx_memory.md` 는 이번 분석 범위에서 열지 않았다 (unknown: 그 문서들과의 대조).

---

## 1. 저장 위치 / 포맷 / 스키마

### 1.1 루트 경로

```js
function PP(e,t){let n=e.OMO_MEMORY_HOME;return void 0===n||""===n.trim()?IP(EP(),".omo","memory"):$P(t,n)}
```
(omo.js @@530765. `EP`=`homedir`, `IP`=`join`, `$P`=`resolve`)

기본값 **`~/.omo/memory`**, `OMO_MEMORY_HOME` 으로 재지정 가능.

### 1.2 identity 별 디렉토리 레이아웃

```js
var AP="agents";
function CP(e,t){let n=IP(e,AP,t),r=IP(n,"runtime");
 return{root:n,repo:IP(n,"repo"),runtime:r,
  locks:IP(r,"locks"),transcripts:IP(r,"transcripts"),
  reflection:IP(r,"reflection"),reflectionSessions:IP(r,"reflection-sessions"),
  worktrees:IP(r,"worktrees"),viewers:IP(r,"viewers"),
  pushQueue:IP(r,"push-queue"),factsQueue:IP(r,"facts-queue"),facts:IP(r,"facts"),
  notices:IP(r,"notices"),recall:IP(r,"recall"),
  recallLedger:IP(r,"recall","ledger"),recallPending:IP(r,"recall","pending")}}
```
(omo.js @@530872)

정리하면:

| 경로 | 역할 |
| --- | --- |
| `~/.omo/memory/agents/<identity>/repo` | **git 저장소. 기억의 본체** |
| `.../runtime/transcripts` | 대화 트랜스크립트 페이로드 + `state.json` |
| `.../runtime/reflection`, `reflection-sessions` | reflection 런 상태/완료 기록 |
| `.../runtime/worktrees` | reflection 이 작업하는 git worktree |
| `.../runtime/facts`, `facts-queue` | facts 추출 런/큐 |
| `.../runtime/recall/ledger`, `recall/pending` | memorian recall 이력/대기 |
| `.../runtime/locks`, `notices`, `push-queue`, `viewers` | 락, 알림, 미러 푸시 큐, palace HTML |

**identity 단위로 분리**된다. 여러 identity 가 각자 repo 를 가진다.

### 1.3 저장 포맷 — git + frontmatter 마크다운

git 이 필수다: `"Git is required for memory storage but was not found on PATH."`, `"Memory repository has no HEAD commit"` (omo.js). 모든 메모리 변경은 커밋된다.

파일 포맷은 `/init` 이 에이전트에게 지시하는 문구에 그대로 나온다(@@891549):

```
Every memory file uses this format:
---
description: <single-line purpose>
---
<body>

Store durable, generalizable knowledge, not transient session state. Do not overwrite existing files; extend them.
```

즉 **단일 라인 `description` frontmatter + 본문**. `description` 은 단순 주석이 아니라 **검색/주입의 1급 필드**다(3절, 2.2절).

### 1.4 repo 내부 티어 구조

reflection-persona.md 가 계약을 명시한다:

- **`system/`** — "always in-context. Reserve for identity, preferences, conventions, and active project context the agent needs on every turn."
- **`skills/`** — "procedural memory for specialized workflows."
- **그 외 전부(external memory)** — "reference material retrieved on demand by name and description."

코드의 분류 술어도 정확히 이 3분할이다:

```js
function ER(e){return e.startsWith("system/")&&e!==bR&&e!==_R&&e.endsWith(".md")}
function IR(e){return!e.startsWith("system/")&&!e.startsWith("skills/")}
```
(omo.js @@ `function ER(` 부근, hR/gR 직전)

코드에 하드코딩된 알려진 경로: `system/persona.md`, `system/identity.md`, `system/human.md`, `people/`, `skills/`, `skills/memory-discipline/SKILL.md`(@@638256), `notes/facts/<YYYY-MM>.md`(@@589939), `ARCHIVE.md`(dream-persona.md), `reference/`(dream-persona.md).

파일 간 참조는 **`[[path]]` 위키링크**다 (dream/reflection persona, memorian nudge 출력 모두 `[[...]]` 사용).

### 1.5 facts 파일

facts 추출기가 쓰는 경로는 월 단위 버킷이다:

```js
let a=e=>{let t=\`notes/facts/\${e.date.slice(0,7)}.md\`;i.set(t,[...i.get(t)??[],e])};
```
(omo.js @@589939 → `notes/facts/YYYY-MM.md`)

커밋 메시지에 writer 를 태깅한다(@@586790):

```js
[`chore(facts): extract ${u} ${1===u?"fact":"facts"}`,"","Generated-By: facts-extractor","Omo-Writer: facts-extractor",`Omo-Facts-Batch: ${c}`].join("\n")
```

메모리 도구 쪽도 `"Omo-Writer: memory-tool"` 트레일러를 쓴다. **누가 쓴 기억인지 git trailer 로 구분**한다.

### 1.6 원격 미러 (선택)

`/memory-repository set <url>` 로 **push-only 미러**를 붙인다. `"memory repository set to ...; initial push failed: .... Local commits are unaffected and every future commit retries the push."` — 로컬 우선, 푸시는 best-effort 재시도(`push-queue`).

---

## 2. 언제 읽고 언제 쓰는가

읽기 2경로(자동 주입 + 온디맨드), 쓰기 4경로(도구/사용자명령/백그라운드 reflection·dream/facts). 훅 기반이다.

### 2.1 읽기 (A) — 매 턴 시스템 프롬프트 자동 주입

```js
(n.length>0||r.length>0)&&(i.push("","<memory>"),n.length>0&&i.push(hR(n)),r.length>0&&i.push(gR(r)),i.push("</memory>"));
...
function(e){return["<memory_metadata>",`- AGENT_ID: ${e.agentId}`,"</memory_metadata>"].join("\n")}
```
(omo.js @@621588 부근)

구조:

- `<self>` — `system/persona.md`, `system/identity.md` **본문 전체**를 `<projection>$MEMORY_DIR/system/persona.md</projection>` 태그와 함께 주입
- `<memory>` 안에
  - `hR()`(@@618419): 나머지 `system/*.md` 를 **경로 트리 + projection + description + 본문**으로 중첩 XML 주입
  - `gR()`(@@619149): external memory 를 `<external_projection>` 아래 **`├──`/`└──` ASCII 트리(경로만)** 로 주입. 본문 없음.
- `<memory_metadata>` — AGENT_ID

즉 **`system/` = 항상 전문 주입, external = 경로(+description)만 노출**. 에이전트는 트리를 보고 필요하면 읽으러 간다. 프롬프트 컴파일은 git HEAD 로 캐시된다(캐시 키 `sha256("senpi-memory-v2" + …) + ":" + agentId`, variant = HEAD sha, @@622163). `/recompile` 이 캐시를 버린다 — 단 "the current run keeps its prompt".

토큰 압력 경고도 여기 붙는다: `compile_warn_tokens` 기본 **30,000**(@@93143), 초과 시 `</memory_metadata>` 앞에 `~X/Y tokens (Z% of advisory); trim or demote stale system/ blocks via the memory tool or run /dream` 을 삽입.

### 2.2 읽기 (B) — memorian 자동 recall (핵심 신규 기능)

턴이 끝난 뒤 **별도의 작은 에이전트(memorian)** 가 최근 대화창과 렉시컬 후보를 보고, "지금 이 메모리를 알려주면 primary 의 다음 행동이 바뀌는가"만 판단한다.

memorian-persona.md 원문:

> Nudge only when a candidate memory would change the primary agent's next action: it contradicts the current approach, records a past failure of this same approach, answers a question the agent is about to re-derive, or names a constraint the agent is ignoring. Topical similarity alone is not enough
> ...
> Silence is the correct default: a useless nudge costs the primary agent attention on every following turn, while a missed one costs nothing — the agent can still find the file itself.

주입 형태(@@632333, `function uN`):

```js
return[`<recalled-memory source="[[${t(e.path)}]]">`,"A stored memory surfaced. It is a hint, not current state — verify before relying on it; read the source path for full contex…
```

훅은 `before_agent_start` 이고, 이미 노출한 경로는 ledger 에 `markSurfaced` 로 기록해 중복을 막는다:

```js
n.on("before_agent_start",async(r,i)=>{ … await e.ledgerFor(i).markSurfaced(r.id,s.map(e=>({path:e.path,hash:zB}))) … })
```

UI 표시는 `"Memory recalled"` + `"A stored memory matched the previous turn; it is a hint, not current state."`

트리거 가드가 촘촘하다: 후보 경로 목록이 이전과 같으면 스킵(`reason:"unchanged_candidates"`), 세션당 launch 200회 상한(`reason:"launch_ceiling"`), 동시 judge 수 제한(`reason:"judge_cap"`, 기본 2).

기본 설정: `nudge: { enabled: true, every_user_turns: 10 }`(@@90242), `recall: { enabled: true, max_items: 2 }`(@@90153, 최대 5).

### 2.3 읽기 (C) — 메모리 압력 notice

매 런에 `<memory_notice>` 블록을 별도 메시지(`display:false`)로 넣는다(@@749761):

```js
return["<memory_notice>",`- ${e} previous messages between you and the user are stored in recall memory`,
 …`- ${t} user turns since your last memory save. Save durable facts now, or decide nothing qualifies.`,
 …`- Soul updated by reflection ${n.sha.slice(0,7)} since your last run`,"</memory_notice>"].join("\n")
```

**"저장하라"고 매 턴 찌르는 넛지**가 프롬프트에 상주한다.

### 2.4 쓰기 (A) — `memory` 도구 (에이전트가 직접)

```js
command: Union([Literal("create"),Literal("str_replace"),Literal("insert"),Literal("delete"),
  Literal("rename"),Literal("update_description"),Literal("apply_patch")],
  {description:"The memory operation to perform."}),
reason: String({description:"Git commit message recorded for this memory change."}),
```
(omo.js @@908914)

프롬프트 스니펫: `"memory - edit omo memory blocks (create/str_replace/insert/delete/rename/update_description/apply_patch); auto-commits each chan…"`, 설명은 `"A convenience tool for memories stored in the omo memory repo that automatically commits changes."`

특징: **`reason` 이 필수이고 그게 곧 커밋 메시지**. `update_description` 이 별도 op 로 있는 건 description 이 검색 1급 필드이기 때문. 경로는 repo 밖으로 못 나간다 — `"Changed path escapes the memory repository: …"`.

### 2.5 쓰기 (B) — 백그라운드 reflection

트리거 기본값(@@89627):

```js
trigger: { step_count: 25, on_compaction: true }
reflection: { enabled:true, merge:"auto", category:"quick", timeout_minutes:15, sandbox:"auto" }
```

**25 스텝마다 + 컴팩션 시마다** reflection 서브에이전트를 띄운다. 이 에이전트는 `$MEMORY_DIR`(git worktree)와 `$TRANSCRIPT_PATH` 를 받아 자율적으로 메모리 파일을 고치고 커밋한다. 페르소나는 Investigate → Extract → (이하 Phase) 순서를 강제하고, 저장 우선순위를 못박는다: 실수/교정 > 선호/패턴 > 새 사실 > 모순 > 재사용 절차. 필터로 durable/already-captured/generalizable/절대날짜 변환/memory-vs-skill 을 거친다.

reflection 은 **별도 프로세스**로 뜬다. `memory-run-supervisor.mjs` 가 그 감독자다:
- `launch.json` 읽고 `--child-bootstrap` 로 detached 손자 프로세스 spawn
- `ledger.json` 에 pid/processStart 기록, `hardDeadlineAt` + `terminationGraceMs` 2단 타임아웃(SIGTERM → SIGKILL, win32 는 taskkill /T /F)
- 종료 시 `terminal-claim.json` 을 `link()` 기반 원자적 claim 으로 잡고 `outcome.json`/`final.json`/`abandoned.json` 기록
- pid 재사용 오탐 방지를 위해 **process start time**을 지문으로 씀 (linux `/proc/<pid>/stat` 20번째 필드, darwin `ps -o lstart=`)

에러 분류가 대단히 세밀하다: rate limit/quota/context overflow 를 정규표현식과 이름 집합으로 나누고(중국어 메시지 `使用上限`, `余额不足`, `请求过于频繁` 포함), context overflow 면 다음 attempt 로 모델을 낮춰 재시도(`ledger.json` 의 `nextAttempt`).

merge 는 `auto`|`integration`, 결과는 `"merge(reflection): …"` 커밋. 실패가 누적되면 `"Memory reflection failing · <streak> run(s)"` 경고를 띄운다.

### 2.6 쓰기 (C) — dream (idle consolidation)

기본값(@@90421):

```js
dream: { enabled:true, idle_minutes:30, min_hours_between:24,
         shutdown_launch:true, auto_select_max:5, auto_select_max_chars:150000 }
```

**30분 유휴 시, 최소 24시간 간격**으로 자동 실행. 종료 시에도 띄운다(`shutdown_launch`). 상태는 `runtime/dream/state.json` 의 `last_dream_at`.

reflection 이 "최근 한 구간"이라면 dream 은 "**전체 메모리 파일시스템 × 여러 대화**". Phase 는 Investigate → Consolidate → Skill Audit → People. 받는 입력이 7개인데 그중 두 개가 핵심이다:

- `$SKILLS_USAGE_PATH` — 스킬별 `{count, lastUsedAt}` 읽기 이력
- `$MEMORY_USAGE_PATH` — 메모리 파일별 `{count, lastUsedAt}` (`system/` 은 항상 주입되므로 제외)

이걸로 **티어 리밸런스**를 한다:

> An external file the agent keeps fetching turn after turn is hot: promote it to `system/`… A `system/` file nothing recent has needed is stale: demote it to `reference/`… Demotion is reversible: it MOVES the file to `reference/` with a `[[path]]` cross-reference at the former point of use. It never deletes content.

토큰 예산 계약도 있다: `totalTokens >= $SYSTEM_TOKEN_BUDGET` 이면 그 런은 반드시 `floor(0.8 * budget)` 아래로 내려야 한다.

모순 처리 규칙이 특히 좋다:

> when files disagree, never silently pick a winner. Keep both versions, mark the disagreement on each entry (a contradiction comment naming the other file and the evidence dates), and surface the conflict in your final report so a human decides.

스킬 감사에서도 **미사용은 보고만, 반증은 수정**으로 권한을 나눈다: "Usage data says it wasn't read; it doesn't say it's wrong."

### 2.7 쓰기 (D) — facts 추출기

`facts: { enabled:true, debounce_settles:4 }`(@@90332). 4회 settle 디바운스 후 실행. facts-persona.md 는 극도로 좁은 스키마만 허용한다:

```json
{"scope":"person","person":{"name":"...","aliases":["..."]},"text":"...","date":"YYYY-MM-DD"}
{"scope":"project","text":"...","date":"YYYY-MM-DD"}
```

> Extract only explicit, durable, atomic facts stated in the supplied payload.
> Use absolute dates. Resolve relative dates against `today` in the payload. Omit ephemera, guesses, plans not adopted, transient task state, and facts already contradicted in the same transcript.

인물 해소 실패 시 `scope:"project"` + `person-unresolved: ` 접두. 결과는 `notes/facts/<YYYY-MM>.md` 에 append.

facts 런은 다른 런과 달리 **모델 라우팅에서 fork 를 배제**한다: `if("facts"===t)return nL("quick",n,"surface_excluded")`.

---

## 3. 검색 / 랭킹 — 임베딩 아니다. 순수 렉시컬이다

**임베딩도 BM25 도 없다.** `omo.js` 전체에서 embedding/cosine/vector/BM25/idf 계열 식별자는 나오지 않는다 (검색 결과 유일 히트는 무관한 `"embedded_directive"`).

### 3.1 쿼리 파서 — 따옴표 구문 지원

```js
function TR(e){let t=[],n=[],r="",i=!1,o=!1,a=()=>{let e=r.trim();r="",e&&(i?n.push(e):t.push(e))};
 for(let t of e.trim())'"'!==t?i||!/\s/.test(t)?r+=t:a():(a(),i=!i);
 return i&&(o=!0),a(),o?{terms:e.trim().split(/\s+/)…,phrases:[]}:{terms:t,phrases:n}}
```
(omo.js @@623073)

공백 분리 term + `"..."` phrase. 따옴표가 안 닫히면 전체를 term 으로 폴백.

### 3.2 스코어러 — AND 매칭 + 위치 페널티 (낮을수록 좋음)

```js
function CR(e){return e.toLowerCase().replace(/\s+/g," ").trim()}
function OR(e,t){let n=CR(e);if(!n)return null;let r=0;
 for(let e of t.phrases){let t=CR(e);if(!t)continue;let i=n.indexOf(t);if(i<0)return null;r+=.1*i}
 for(let e of t.terms){let t=CR(e);if(!t)continue;let i=n.indexOf(t);if(i<0)return null;r+=i+Math.max(0,50-t.length)}
 return r}
```
(omo.js @@623356)

읽어야 할 성질:

1. **하나라도 없으면 `null` = 탈락.** 순수 AND. OR/부분매칭 없음.
2. 점수는 **첫 등장 인덱스의 합** — 앞쪽에 나올수록 낮은 점수 = 상위. 정렬은 `e.score-t.score` 오름차순.
3. phrase 는 `0.1 *` 가중 → 같은 위치면 phrase 매치가 10배 유리.
4. `Math.max(0,50-t.length)` — **짧은 term 에 최대 50 페널티**. 긴(=구체적인) term 이 유리하게 만드는 조잡하지만 의도된 IDF 대용.
5. 정규화는 lowercase + 공백 축약뿐. 형태소 분석/스테밍 없음 → **한국어 조사 붙은 검색어는 그대로 실패**한다.

### 3.3 두 개의 소비자

**(a) `/search` — 과거 세션 트랜스크립트**

```js
function RR(e,t,n={}){ … for(let t of e.listConversations()) … for(let e of t.messages){let t=OR(PR(e),i); …}
 return a.sort(…).slice(0,o).map(NR)}
```
(omo.js @@ `function RR(`)

senpi sessions 디렉토리(`.jsonl`)를 **매번 전량 스캔**한다. 인덱스 없음. 검색 대상 텍스트 `PR(e)` 는 messageType + content + reasoning + summary + toolCalls(name/arguments) + toolReturn + funcResponse 전부를 이어붙인 것 — **툴 호출과 리턴까지 검색된다**. 기본 limit 100, 날짜 필터 있음, 결과는 매치어를 `**bold**` 로 감싸 번호와 함께 출력.

**(b) memorian 후보 선별**

```js
var sN=200;
function lN(e,t,n){let r=Math.max(0,n.maxItems); … for(let t of e){if(n.surfaced.has(t.path))continue;
 let e=\`\${t.description}\n\${t.body}\`;let r=null;
 for(let t of i){let n=OR(e,t);null!==n&&((null===r||n<r)&&(r=n))}
 null!==r&&a.push({path:t.path,description:t.description,excerpt:cN(t.body,o),score:r})}
 return a.sort((e,t)=>e.score-t.score||e.path.localeCompare(t.path)).slice(0,r)}
```
(omo.js @@631368/@@631379)

메모리 파일의 `description + body` 를 대상으로 같은 `OR()` 를 돌리고, 여러 쿼리 중 **최소 점수(=최선)** 를 채택. `cN()` 은 첫 매치 주변 200자를 발췌한다. 이미 surfaced 된 경로는 제외.

**요약: 렉시컬 후보 생성 → LLM(memorian) 이 재랭킹/거부.** 랭킹의 품질은 스코어러가 아니라 **판정 에이전트**가 담당한다. memorian-persona.md 도 이걸 인정한다: "These are lexical matches; expect false positives."

---

## 4. 사용자 체감 UX

### 4.1 슬래시 명령 (`registerCommand` 실측 전량)

| 명령 | 설명(원문) |
| --- | --- |
| `/init` | Initialize the memory repository and instruct the agent to create initial memory. |
| `/memory` | View committed memory: HEAD, system bodies, external names, and uncommitted changes. |
| `/remember <text>` | Persist text to long-term memory via a memory-tool turn. |
| `/search <query> [--include-hidden]` | Search past session transcripts and show scored, numbered results. |
| `/reflect` | Request a memory reflection run now, optionally scoped and focused. |
| `/dream [--auto\|--recent N\|--conversation <ids>] [focus]` | Request a manual multi-conversation memory dream run. |
| `/facts` | Show facts-extraction queue/backoff state, or manually retry parked batches. |
| `/people` | Show the people roster and relationship graph, one person's record, or ask about them. |
| `/memfs <sub>` | Inspect and maintain the memory filesystem repository. (`diff`, `tokens` 등) |
| `/memory-repository <set\|unset\|status\|push> [url]` | Configure the push-only mirror remote. |
| `/recompile` | Recompile the memory block into the system prompt on the next agent run. |
| `/palace` | Generate the memory palace HTML viewer for the bound identity. |
| `/sleeptime` | Show the resolved sleeptime memory settings for this identity. |
| `/doctor` | Run deterministic memory health checks and repair skill frontmatter. |

### 4.2 자동성 — 기본이 전부 켜져 있다

`enabled: true` 기본값: reflection, nudge, facts, dream, people, sync, search, recall, write_notice, soul.edit_notice. 사용자가 아무것도 안 해도 25스텝마다 reflection, 10 user turn 마다 memorian, 30분 유휴에 dream 이 돈다.

`/remember` 조차 직접 파일을 쓰지 않는다 — **에이전트에게 메시지를 보낸다**:

```js
e.sendUserMessage(`[MEMORY REQUEST] Persist this as long-term memory if appropriate. Use your memory tools: choose the most appropriate memory file (create one if no relevant file exists), avoid duplicates, match the existing formatting of the file, then briefly confirm what you remembered and where you stored it.\n\n${o}`)
```
(omo.js @@889789)

즉 **모든 쓰기가 LLM 판단을 경유**한다. 결정론적 저장 경로가 없다.

### 4.3 가시성

- 상태줄에 `mem:<identity> <sha>` + `*`(dirty) / `(+N)`(reflection 백로그) / `!N`(연속 실패 3회 이상)
- `"Memory recalled <paths>"` (muted), `"Memory reflection started"`, `"Memory reflection <id> merged."`
- `"A memory soul file changed."` — persona/identity 변경 알림
- `/palace` 로 HTML 뷰어 생성 (`runtime/viewers`, `OMO_PALACE_DATA`)
- 모든 변경이 git 커밋이라 `/memfs diff` 로 검토 가능, 되돌리기는 git 그 자체

### 4.4 온보딩

`/init` 이 repo 를 만들고 에이전트에게 초기 메모리 작성을 시킨다. `system/human.md` 는 "what you know about the user: goals, preferences, collaboration style" 로 안내된다. 에이전트 자신을 위한 `skills/memory-discipline/SKILL.md` 도 seed 로 심는다 — "It routes knowledge between memory notes, skills, and people records, specifies the card and observation formats, and explains when to reach for /reflect, /dream, /search, and /people."

---

## 5. 좋은 아이디어

**1. git 을 저장 엔진으로 쓴 것.** 커밋 = 감사로그, HEAD = 프롬프트 캐시 키, worktree = 백그라운드 에이전트의 격리 작업공간, push 미러 = 백업/동기화. 별도 DB/마이그레이션/충돌해결을 전부 git 에 위임했다. `Omo-Writer:` trailer 로 작성 주체까지 구분한다. 특히 프롬프트 캐시 variant 를 HEAD sha 로 쓰는 건 무효화 로직을 공짜로 얻는 설계다.

**2. 2티어 주입 (전문 vs 트리+description).** `system/` 만 항상 전문 주입하고 나머지는 경로+설명만 노출한다. 컨텍스트 비용은 상수로 묶이고, 나머지는 에이전트가 필요할 때 가져간다. description 을 1급 필드로 승격하고 `update_description` 을 별도 op 로 둔 게 일관적이다.

**3. 사용 이력 기반 티어 리밸런스.** `$MEMORY_USAGE_PATH`/`$SKILLS_USAGE_PATH` 의 `{count, lastUsedAt}` 로 hot 은 승격, cold 는 강등한다. 무엇을 항상 들고 다닐지를 추측이 아니라 **관측 데이터**로 정한다. 강등이 삭제가 아니라 이동 + `[[path]]` 링크 남기기라 되돌릴 수 있다.

**4. memorian 의 침묵 기본값.** "Silence is the correct default: a useless nudge costs the primary agent attention on every following turn, while a missed one costs nothing." 자동 recall 시스템이 보통 실패하는 지점(주제 유사도만으로 시끄럽게 끼어들기)을 정면으로 겨냥했다. "행동을 바꿀 때만" 이라는 기준, hint 200자 1문장 제한, `surfaced` 중복 억제, launch 200회 상한까지 비용을 여러 겹으로 묶었다.

**5. recall 을 사실이 아니라 힌트로 프레이밍.** `"It is a hint, not current state — verify before relying on it"`. 오래된 기억이 현재 상태를 덮어쓰는 사고를 프롬프트 층위에서 막는다.

**6. 모순을 자동 병합하지 않음.** dream 은 충돌 시 양쪽을 남기고 각각에 반대 파일과 증거 날짜를 표시한 뒤 사람에게 보고한다. 조용한 승자 선택이 없다.

**7. 권한 분리 원칙: 미사용은 보고, 반증은 조치.** 스킬 감사에서 "usage data says it wasn't read; it doesn't say it's wrong." 통계적 신호와 인과적 증거를 다르게 대우한다.

**8. 백그라운드 런의 프로세스 위생.** pid + process-start-time 지문으로 pid 재사용 오탐 차단, `link()` 기반 원자적 terminal claim, 2단 타임아웃, 죽은 claimant 회수, context-overflow 감지 시 모델 강등 재시도. 이 정도로 방어적인 서브프로세스 감독자는 흔치 않다.

**9. facts 스키마의 협소함.** 두 가지 shape 만 허용하고 절대날짜를 강제한다. 자유서술 기억이 쓰레기로 변하는 걸 스키마로 막는다.

## 6. 약점

**1. 검색이 순수 AND + 위치 페널티다.** `OR()` 는 term 하나만 없어도 `null` 을 반환한다. 동의어, 오타, 부분일치, 형태 변화 전부 못 잡는다. 점수도 "첫 등장 인덱스 합"이라 **문서 앞부분 편향**이 있고 매치 횟수/문서 길이를 전혀 안 본다 — 긴 문서에서 뒤쪽에 정확히 있는 내용이 앞쪽에 스치듯 언급된 문서에 진다. `Math.max(0,50-len)` 는 IDF 흉내지만 실제 코퍼스 빈도와 무관하다.

**2. 한국어에서 특히 취약.** lowercase + 공백 축약이 전처리의 전부다. 조사가 붙은 "메모리를" 은 "메모리" 와 매치되지 않고, 띄어쓰기가 다르면 그대로 탈락한다. 이 사용자 환경에서는 실질적인 제약이다.

**3. `/search` 에 인덱스가 없다.** 매 호출마다 세션 `.jsonl` 전량을 파싱하고 메시지마다 문자열을 조립(`PR()`)한다. 세션이 쌓일수록 선형으로 느려진다.

**4. 모든 쓰기가 LLM 을 경유한다.** `/remember` 조차 에이전트에게 보내는 메시지다. "if appropriate" 라서 **사용자가 명시적으로 기억하라고 한 것도 저장 안 될 수 있고**, 어디에 저장됐는지도 에이전트 재량이다. 결정론적 저장 경로의 부재는 신뢰성 문제다.

**5. 백그라운드 에이전트가 기억을 자율 수정한다.** reflection/dream 이 사람 확인 없이 파일을 고치고 커밋한다. 잘못된 일반화("실수/교정"을 잘못 읽은 것)가 `system/` 에 들어가면 이후 모든 턴을 오염시킨다. git 이력이 있으니 복구는 되지만, **발견**은 사용자 몫이다. `"A memory soul file changed."` 알림과 `streak` 경고가 완화책이지만 사전 승인은 없다.

**6. 비용.** reflection 25스텝마다 + 컴팩션마다, memorian 10턴마다(세션당 최대 200회), facts 디바운스 4, dream 하루 1회. 전부 별도 LLM 호출이다. 라우팅 로직이 quick/fork 를 저울질하고 컨텍스트 창 80% 초과를 피하는 걸 보면 설계자도 인지하고 있지만, 체감 비용은 사용자가 부담한다.

**7. `system/` 토큰 예산이 사후적이다.** 기본 30k 를 넘으면 프롬프트에 경고를 넣고 dream 이 다음 런에서 줄인다. 그 사이 턴들은 계속 비대한 프롬프트를 지불한다. 하드 상한이 아니라 advisory 다.

**8. 문서/스킬 seed 의 자기참조 위험.** `skills/memory-discipline/SKILL.md` 를 memory repo 안에 심는데, dream 의 스킬 감사 대상이기도 하다. 자기 자신을 수정할 수 있는 구조다 (unknown: 실제로 보호되는지 확인 못함).

**9. identity 바인딩 실패 시 조용히 죽는 경로들.** `"No bound memory session."`, `"no memory identity resolved; check the memory config for this project"` — 프로젝트별 identity 해소가 안 되면 메모리 기능 전체가 비활성이다. 사용자가 이걸 알아채기 어렵다.

---

## 7. 확인 못한 것 (unknown)

- `~/.omo/memory` 실제 인스턴스를 실행/생성해보지 않았다. 모든 내용은 **정적 코드 + 페르소나 문서 기반**이다. 런타임에서 실제로 생성되는 파일 내용(예: `state.json`, `ledger` 의 정확한 필드 전량)은 미검증.
- GitHub 저장소(`code-yeongyu/oh-my-openagent`)의 공개 문서와 대조하지 않았다. package.json 의 repository 필드로 존재는 확인되지만, 번들이 build 산출물이라 원본 TS 소스와의 1:1 대조는 못 했다.
- `10_omc_memory.md`, `10_omx_memory.md` 는 읽지 않았다.
- `/people` 의 카드/관찰 포맷 세부, `dream-persona.md` Phase 4(People) 이후 내용은 부분만 읽었다.
- `compile_warn_tokens` 의 토큰 추정이 `bytes/4` 라는 건 `/memfs tokens` 출력 문자열(`"System prompt token estimate (bytes/4)"`)로만 확인했다.
- reflection 의 `merge:"auto"` vs `"integration"` 의 실제 동작 차이는 미확인.
- senpi 본체(`@code-yeongyu/senpi`)는 별도 패키지라 받지 않았다. 세션 `.jsonl` 포맷은 omo 쪽 리더 코드로만 역추론했다.
