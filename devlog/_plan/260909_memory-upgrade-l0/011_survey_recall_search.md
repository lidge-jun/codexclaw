# recall 검색 정확도·스코핑·랭킹 정밀 정찰 (WP2/WP3/WP5)

- 작성: 2026-09-09
- 워크트리: `/Users/jun/.codex/worktrees/1fa9/codexclaw` (브랜치 `codex/memory-upgrade-l0`, `6e97e73d`)
- 대상: `plugins/codexclaw/components/recall/` — src 14파일 1,996줄 / test 8파일 1,110줄
- 성격: P 페이즈 조사. 코드는 수정하지 않았다. 실측 명령은 모두 읽기 전용.
- 선행 노트: 이 디렉터리의 `research/01`(cli-jaw 랭킹), `research/05`(네이티브 결함), `research/08`(설계). 중복 서술은 참조로 대체한다.

---

## 0. 이 노트가 확정한 것

| 항목 | 08 노트의 상태 | 이 노트의 실측 결과 |
|---|---|---|
| `rollout_summaries` frontmatter `cwd:` | "실재한다"(1건 확인) | **256/256 전량 존재**. `git_branch:`는 226/256 |
| `stage1_outputs`에 `cwd` 컬럼 | §7 미확인 | **없다.** 10컬럼 전량 덤프 확인 → stage1 컬럼 스코핑 불가 |
| `msgs_fts` 사용처 | Q5 미결 | 정의·트리거만 존재, 쿼리 0건. **BM25는 즉시 가용**(실측 146ms) |
| 토큰 경계 오매칭 규모 | 미측정 | `id` 93.9%, `go` 83.2%, `pr` 74.5%, `fts` 100% 오매칭 |
| 한국어 어미 문제 규모 | 정성 서술 | `배포` 128회 중 77회(60%)가 어미 부착형 |

---

## 1. memory-search 파이프라인 전체

`searchMemory` (`src/memory-search.ts:245-306`)가 단일 진입점이다. 순서대로 본다.

### 1.1 질의 준비 (:254-256)

```
splitQueryWords(query)     chat-search.ts:85-91   소문자화 → \s+ 분리 → 최대 8단어
expandQueryWords(words)    synonyms.ts:54-66      단어당 OR-그룹, 그룹당 최대 8멤버
lowerPhrase                memory-search.ts:256   공백 정규화한 원문 전체 (구문 부스트용)
```

`opts.synonyms`가 false면 `words.map((w) => [w])`로 싱글턴 그룹이 된다(`:255`).

### 1.2 파일 수집 (:267-268)

`listMarkdownFiles` (`:179-192`)가 `memoriesDir(home)` 아래를 재귀 walk 한다. 점으로 시작하는 이름은 건너뛰고 `.md`만 수집한다. **인덱스 없이 매 질의마다 전량 스캔**이다. 실측 285파일 / 3.8MB에 41~69ms.

`days` 필터는 파일 mtime 기준(`:278`)이고, `scannedFiles`는 cutoff 통과 후에 증가한다(`:279`).

### 1.3 파일 단위 프리필터 (:280)

`matches(content.toLowerCase(), groups, anyMode)` — 전문을 통째로 소문자화해서 검사한다. 통과 못 하면 청킹조차 안 한다.

### 1.4 청킹 (:285, :200-220)

`paragraphChunks`는 **빈 줄 기준 문단 분할**이다. `splitLines`(CRLF 안전)로 자르고 빈 줄에서 버퍼를 flush 한다. 각 청크는 1-based `startLine`을 갖고, 이게 출력의 `relpath:line` 점프 앵커가 된다.

문제는 `MEMORY.md`가 891KB인데 문단 하나가 수백~수천 자라는 점이다. 청크 경계가 의미 경계와 무관하다.

### 1.5 매칭 (:287, :222-226)

```ts
const groupHit = (group) => group.some((w) => lowerText.includes(w));
return anyMode ? groups.some(groupHit) : groups.every(groupHit);
```

**그룹 간 AND, 그룹 내 OR.** `String.includes` = 부분문자열. R1의 근원이 여기다(§2).

### 1.6 스코어링 (:297 → :129-152, :119-122)

`scoreChunk(lowerText, groups, lowerPhrase)`:

| 요소 | 값 | 근거 |
|---|---|---|
| 그룹 커버리지 | 그룹당 +2 | `:146` |
| 밀도 | 그룹당 `bestOcc - 1`, occ는 5에서 절단 | `:139-147` |
| 구문 일치 | 그룹 2개 이상 + 원문 구문 포함 시 +5 | `:149` |
| 헤딩 | 청크가 `#`로 시작하면 +1 | `:150` |

밀도는 **그룹 내 최다 출현 멤버 하나**에만 붙는다(`:136-143`). 동의어 히트가 리터럴 히트보다 낮아지지 않게 하려는 의도이고, `test/synonyms.test.ts:14-19`가 이 성질을 고정한다.

`finalScore` (`:120-122`) = `scoreChunk + KIND_PRIORITY[kind] + recencyBoost(...)`. **높을수록 좋다** — cli-jaw는 BM25 관례로 낮을수록 좋으므로 부호가 반대다(`:75-78` 주석이 이 반전을 명시).

### 1.7 KIND_PRIORITY 실제 값 (:79-88)

```
summary   4     memory_summary.md
handbook  3     MEMORY.md
skill     2.5   skills/**
extension 2     extensions/**
raw       0.5   raw_memories.md
rollout   0     rollout_summaries/**
stage1    0     stage1_outputs 행
other     0
```

분류는 `kindOfRelpath` (`:63-72`) — 순수 경로 prefix 판정이다.

### 1.8 HALF_LIFE_HOURS 실제 값 (:91-100)

```
rollout   168h (7일)      stage1  168h      other  168h
raw       720h (30일)
extension 2160h (90일)
summary / handbook / skill = Infinity (감쇠 없음)
```

### 1.9 recencyBoost 계산식 (:108-117)

```ts
if (halfLife === Infinity || updatedAtMs === null || !isFinite) return 0;
ageHours = max(0, (nowMs - updatedAtMs) / 3_600_000);
boost    = 1.5 * exp(-ln2 * ageHours / halfLife);
if ((kind === 'rollout' || kind === 'stage1') && ageHours > halfLife * 2)
  return boost - min(2.0, (ageHours - halfLife*2) / (halfLife*2));
return boost;
```

범위는 `[-2.0, +1.5]`. 미래 타임스탬프는 age 0으로 클램프되어 +1.5를 받는다(`test/ranking.test.ts:45`가 고정).

여기에 구조적 왜곡이 있다. rollout/stage1의 kind priority가 0인데 stale 벌점은 최대 −2.0이다. 7일 반감기이므로 14일만 지나면 감점 구간이고, 실측 `rollout_summaries` 256개는 6~9월에 걸쳐 있다. 즉 **rollout_summaries는 사실상 항상 음수 점수**라서 `summary(4)`/`handbook(3)`를 이길 수 없다. 실측 `cxc memory search "ci"` 상위 5건이 `memory_summary.md` 2건 + `MEMORY.md` 2건 + `skills/` 1건으로 rollout이 한 건도 없다.

### 1.10 stage1 경로 (:302, :309-366)

파일 스캔과 별도의 SQL 경로다. 그룹 멤버마다 바인딩 파라미터 하나씩 만들어 `lower(raw_memory) LIKE ?n OR lower(rollout_summary) LIKE ?n`을 조립하고(`:331-338`), anyMode에 따라 `OR`/`AND`로 잇는다. 용어가 SQL 텍스트에 들어가지 않으므로 주입 안전이다.

md 파일에서 이미 잡힌 thread_id는 건너뛴다(`:345`, `matchedThreadIds`). 스코어링은 `raw_memory + rollout_summary` 통짜에 `scoreChunk` 1회 — **청킹이 없다**. 그래서 긴 행이 밀도 점수를 유리하게 먹는다.

### 1.11 다양화 + 절단 (:304, :155-170)

`rankAndTrim`은 점수 내림차순, 동점이면 `updatedAt` 문자열 내림차순으로 정렬한 뒤 **PER_FILE_CAP = 2**(`:60`)로 같은 relpath 3번째부터 버리고, limit 도달 시 중단한다.

cli-jaw `diversifyHits`는 relpath당 1 + kind별 상한(episode 2)인데(01 노트 §3.2), 여기는 relpath당 2에 kind 상한이 없다. 그래서 `memory_summary.md` 2 + `MEMORY.md` 2로 상위 4칸이 늘 고정된다(실측 `"ci"` 질의).

### 1.12 출력 (:304-305 → format.ts:52-66)

`excerptAround` (`:237-243`)가 첫 매칭 멤버 주변 400자를 잘라내고, `formatMemoryResult` (`format.ts:52-66`)가 다시 300자로 clip 한다. 400자를 만들어 300자로 자르는 이중 절단이다.


---

## 2. R1 — 토큰 경계

### 2.1 substring 매칭이 일어나는 정확한 줄

| 파일:라인 | 함수 | 역할 |
|---|---|---|
| `memory-search.ts:224` | `matches` 내부 `groupHit` | **핵심 게이트.** 청크/파일 매칭 판정 |
| `memory-search.ts:136,141` | `scoreChunk` | 밀도 카운트 `indexOf` 루프 |
| `memory-search.ts:149` | `scoreChunk` | 구문 부스트 |
| `memory-search.ts:231` | `firstPresentMember` | 발췌 앵커 |
| `memory-search.ts:239` | `excerptAround` | 발췌 위치 |
| `memory-search.ts:335` | stage1 SQL | `LIKE '%w%'` — SQL 쪽도 같은 문제 |
| `chat-search.ts:94` | `entryMatches` | 스캔 경로 |
| `rollout.ts:192-193` | `matchesFilePrefilter` | 파일 프리필터 |
| `index-search.ts:48-49` | `wordCondition` LIKE 폴백 | 2자 이하 단어 |
| `index-search.ts:44-46` | `wordCondition` trigram | 3자 이상 — trigram도 substring 의미 |

### 2.2 오매칭 실증

memories 코퍼스 285파일을 문단 청킹해서 substring 히트와 단어경계 히트를 센다:

```bash
python3 - <<'PY'
import re,glob
files=glob.glob('/Users/jun/.codex/memories/**/*.md',recursive=True)
def chunks(t):
    out=[];buf=[]
    for l in t.split('\n')+['']:
        if l.strip()=='':
            if buf: out.append('\n'.join(buf)); buf=[]
        else: buf.append(l)
    return out
for w in ['3956','ci','go','pr','id','fts']:
    rx=re.compile(r'\b'+re.escape(w)+r'\b',re.I); sub=tok=0
    for f in files:
        t=open(f,encoding='utf8',errors='ignore').read()
        for c in chunks(t):
            if w in c.lower():
                sub+=1
                if rx.search(c): tok+=1
    print(w, sub, tok)
PY
```

실측:

```
3956   substring=    12 token=     4 FP= 66.7%
ci     substring=  3027 token=  1314 FP= 56.6%
go     substring=   607 token=   102 FP= 83.2%
pr     substring=  7104 token=  1811 FP= 74.5%
id     substring=  4624 token=   280 FP= 93.9%
fts    substring=    41 token=     0 FP=100.0%
```

`fts`가 100%인 게 상징적이다. 41청크 전부 `drafts`, `conflicts` 같은 단어 내부다.

PR 번호 오매칭:

```bash
cxc memory search "3956" --limit 3
# 2번째 히트가 raw_memories.md 의 thread id 01a03956-6245-... 로, PR #3956 과 무관하다
```

사이드카 인덱스도 같다:

```bash
node -e "const{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/Users/jun/.codexclaw/recall/index.sqlite',{readOnly:true});
const r=db.prepare(\"SELECT m.text t FROM msgs_tri JOIN msgs m ON m.id=msgs_tri.rowid WHERE msgs_tri MATCH '\\\"git\\\"' LIMIT 300\").all();
console.log(r.length, r.filter(x=>!/\bgit\b/i.test(x.t)).length)"
# → 300 48   (16%가 digit / legitimate 등 단어 내부)
```

### 2.3 심볼형 질의 판정 제안

토큰 경계를 모든 단어에 강제하면 한국어가 깨진다(`검색해봐`에서 `검색`을 못 찾음). 그래서 질의어별 판정이 필요하다. 다음 중 하나면 심볼로 보고 단어경계 매칭을 적용한다:

| 종류 | 판정 | 예 |
|---|---|---|
| 대문자 약어 | `/^[A-Z]{2,6}$/` (원문 기준, 소문자화 **전**) | `CI`, `PR`, `FTS`, `RRF` |
| 짧은 ASCII 영단어 | `/^[a-z]{1,3}$/` | `go`, `id`, `ci` |
| 숫자 전용 (PR/이슈/런번호) | `/^#?\d{2,10}$/` | `3956`, `#3956` |
| SHA | `/^[0-9a-f]{7,40}$/` | `6e97e73d` |
| 파일명 | `/\.[a-z0-9]{1,5}$/` | `hook.ts` |
| 경로 | `/[\/\\]/` 포함 | `src/hook.ts` |

핵심 제약: 원문 대소문자를 보존해야 대문자 약어를 판정할 수 있다. 현재 `splitQueryWords`가 `chat-search.ts:87`에서 즉시 소문자화를 때린다. 원문 단어 배열을 병행 반환하거나 별도 함수가 필요하다. (추정) 이게 이 WP에서 가장 넓게 번지는 변경이다 — `splitQueryWords`는 memory-search와 chat-search 양쪽이 쓴다.

경계 문자 정의도 손봐야 한다. 파일명/경로/SHA는 마침표·슬래시·하이픈이 단어 내부에 있으므로 `\b`가 그대로는 안 맞는다. **앞뒤가 `[A-Za-z0-9_]`가 아닐 것** 정도의 커스텀 경계가 안전하다. `hook.ts`는 `h` 앞과 `s` 뒤만 보면 되므로 이 정의로 `my-hook.tsx`를 배제한다.

한국어 단어는 이 판정에서 전부 제외된다 — 어떤 규칙도 안 걸리므로 기본 substring이 유지되고, 그게 §3에서 원하는 동작이다.


---

## 3. R2 — 한국어

### 3.1 synonyms.ts 현재 그룹 전량 (20개, `src/synonyms.ts:16-39`)

cli-jaw 이식 9개:

```
:18  preference, preferences, 선호, 취향, 환경설정
:19  decision, decisions, 결정, 선택, 방침
:20  project, projects, 프로젝트, 작업
:21  runbook, runbooks, 절차, 런북, 매뉴얼
:22  workflow, 워크플로우, 흐름
:23  pabcd, plan, audit, build, check, done
:24  fts, fts5, full-text-search
:25  bm25, ranking, relevance
:26  cli-jaw, cli_jaw, clijaw, jaw
```

codexclaw 도메인 추가 11개:

```
:28  memory, memories, 메모리, 기억
:29  search, 검색
:30  session, sessions, 세션
:31  error, errors, 오류, 에러, bug, 버그
:32  test, tests, 테스트
:33  skill, skills, 스킬
:34  plugin, plugins, 플러그인
:35  index, 인덱스
:36  hook, hooks, 훅
:37  config, configuration, 설정
:38  deploy, deployment, 배포
```

`GROUP_CAP = 8` (`:42`), `TERM_TO_GROUP` Map은 모듈 로드 시 1회 구축(`:44-47`).

### 3.2 expandQueryWords 호출 지점

**단 한 곳**: `memory-search.ts:255`.

```ts
const groups = (opts.synonyms ?? true) ? expandQueryWords(words) : words.map((w) => [w]);
```

`chat-search.ts`는 동의어를 전혀 안 쓴다. 08 노트 §7이 "이유가 코드에 없다"고 남긴 항목인데, 이 노트에서도 근거를 못 찾았다. (추정) WP2가 memory-search에만 적용된 채 끝난 것으로 보인다.

### 3.3 한국어 어미 문제의 실제 규모

`unicode61` 토크나이저는 한국어를 공백으로만 쪼갠다. `배포까지`와 `배포`가 다른 토큰이다. 사이드카 인덱스 실측:

```
msgs_fts MATCH "릴리스"      → 4,377행
msgs_fts MATCH "릴리스까지"  →    27행     ← 어미가 붙으면 별개 토큰
msgs_tri MATCH "릴리스"      → 5,208행     ← trigram은 substring이라 어미 무관
```

memories 코퍼스(3.8MB)의 어미 부착 비율:

| 어간 | 총 출현 | 단독 | 어미부착 | 부착률 | 상위 어미 |
|---|---|---|---|---|---|
| 배포 | 128 | 51 | 77 | **60%** | 까지29 하고9 해5 를4 |
| 검색 | 52 | 21 | 31 | **60%** | 으로7 해야4 해보고3 |
| 스킬 | 54 | 24 | 30 | **56%** | 을13 들을8 의4 |
| 세션 | 69 | 34 | 35 | **51%** | 을11 에서8 이5 |
| 릴리스 | 63 | 45 | 18 | 29% | 는4 까지3 와3 |

memory-search는 substring이므로 이 문제가 이미 없다 — `배포`로 검색하면 `배포까지`가 잡힌다. 진짜 문제는 반대 방향이다. 사용자가 `배포까지`라고 입력하면 `배포`만 있는 문서를 못 찾는다.

### 3.4 어미 절단을 넣을 위치

`expandQueryWords` 안이 맞다. 반환 타입이 이미 OR-그룹이라서, 어간을 그룹의 두 번째 멤버로 추가하면 매칭·스코어링·발췌 코드가 한 줄도 안 바뀐다.

```
"배포까지"  →  ["배포까지", "배포"]        (어간 추가, 원문이 리드 유지)
"결정"      →  ["결정", "decision", ...]   (기존 동의어 경로 그대로)
"배포를"    →  ["배포를", "배포", "deploy", "deployment"]
                                            ← 절단 후 동의어 조회까지 연쇄
```

연쇄 순서가 중요하다. 절단을 먼저 하고 절단된 어간으로 `TERM_TO_GROUP`을 다시 조회해야 `배포를` → `deploy`가 성립한다. 현재 코드는 원문 소문자 1회만 조회한다(`synonyms.ts:57`).

밀도 스코어링이 그룹 내 최선 멤버만 쓰므로(`memory-search.ts:136-143`) `배포까지`와 `배포`가 같은 그룹에 있어도 이중 계수는 안 된다. `test/synonyms.test.ts:14-19`가 이미 지키는 성질이다.

### 3.5 안전한 절단 규칙 범위

**최소 어간 길이 2자**를 절대 조건으로 둔다. 1자 어간은 오매칭이 폭발한다.

허용 어미 목록 (실측 상위 빈도에서 도출, 길이 내림차순 매칭):

```
3자: 에서는, 으로는
2자: 에서, 으로, 에는, 이나, 까지, 부터, 처럼, 보다, 마다, 라고, 하고, 해서, 하는, 한테, 들을, 들이, 에게
1자: 을, 를, 이, 가, 은, 는, 의, 에, 도, 과, 와, 만, 로
```

### 3.6 과도 절단 위험

| 입력 | 순진한 절단 | 결과 |
|---|---|---|
| `검사` | `검` + `사` | 어간 1자 → 최소 2자 규칙으로 차단 |
| `도구` | 어미 아님(어두) | 접미 매칭만 하므로 안전 |
| `고의` | `고` | 1자 → 차단 |
| `하고` | `하` | 1자 → 차단 |
| `릴리스` | `스`는 목록에 없음 | 안전 |
| `문서를` | `문서` | 정상 |
| `인덱스도` | `인덱스` | 정상 |

방어 3개:

- **어간 2자 이상** — 1자 어간은 절단하지 않는다
- **한글 음절만** (`/^[가-힣]+$/`) — 영문/숫자/혼합 토큰은 대상이 아니다
- **원문을 그룹에서 제거하지 않는다** — 절단은 항상 추가이므로 최악의 경우도 재현율만 늘고 정밀도가 조금 떨어지는 선이다. 원문이 리드 멤버로 남으므로 발췌 앵커(`firstPresentMember`)도 원문을 우선한다

(추정) 절단 어간이 흔한 단어여서 노이즈가 늘 위험은 남는다. 그룹 확장은 OR이고 `--no-synonyms`로 이미 opt-out 경로가 있으니 그걸 재활용하면 된다.


---

## 4. P1-1 — 스코핑

### 4.1 frontmatter 파싱 코드 위치

`frontmatterThreadId` (`memory-search.ts:194-197`):

```ts
function frontmatterThreadId(content: string): string | null {
  const m = /^thread_id:\s*(\S+)/m.exec(content.slice(0, 2_000));
  return m ? m[1] : null;
}
```

호출은 `:281` 한 곳. 반환값은 히트의 `threadId` 필드로 쓰이고, `matchedThreadIds` 집합에 들어가 stage1 중복 제거(`:345`)에 쓰인다. 앞 2,000자만 보는데 실측 frontmatter는 4~5줄 최대 400자여서 여유가 충분하다.

### 4.2 cwd 필드 실재 확인

```bash
for f in /Users/jun/.codex/memories/rollout_summaries/*.md; do
  sed -n '1,8p' "$f" | grep -oE '^[a-z_]+:'
done | sort | uniq -c | sort -rn
```

```
 256 updated_at:
 256 thread_id:
 256 rollout_path:
 256 cwd:
 226 git_branch:
```

**256개 전량에 `cwd:`가 있다.** 순서는 `thread_id` → `updated_at` → `rollout_path` → `cwd` → (`git_branch`). `---` 델리미터는 없다. 파일 맨 앞 몇 줄이 `key: value`이고 빈 줄 뒤에 `# 제목`이 온다. 기존 `/^key:\s*(\S+)/m` 정규식이 그대로 통한다.

cwd 값 분포 (상위):

```
106  /Users/jun/Developer/new/700_projects/opencodex
 28  /Users/jun/Developer/new/700_projects/cli-jaw
 14  /Users/jun/Developer/new/700_projects/ima2-gen
 13  /Users/jun/Developer/new/700_projects/codexclaw
  5  /Users/jun/.cli-jaw
  1씩 /Users/jun/.codex/worktrees/{f994,ec3e,eb75,eaa1,dd7f,db0b,d778,d17f,cf54,cd7a,ca1d}/...
```

워크트리가 각각 1건씩 흩어져 있다. `--cwd`를 하드 필터로만 쓰면 워크트리에서 히트가 0~1건이 된다. 08 노트 P1-1이 "부스트 + `--cwd-only` 하드 필터"로 나눈 판단이 실측으로 뒷받침된다. **부스트가 기본이어야 한다.**

주의: `rollout_path`도 `/Users/jun/...` 값을 갖는다. `^cwd:`로 앵커해야 헷갈리지 않는다(기존 정규식이 이미 `^` + `m` 플래그를 쓴다).

### 4.3 stage1 스키마 실측 — cwd 컬럼 없음

```bash
python3 -c "
import sqlite3,glob
p=sorted(glob.glob('/Users/jun/.codex/memories_*.sqlite'))[-1]
con=sqlite3.connect('file:'+p+'?mode=ro',uri=True)
for r in con.execute(\"select sql from sqlite_master where type='table'\"): print(r[0])"
```

```sql
CREATE TABLE stage1_outputs (
    thread_id TEXT PRIMARY KEY,
    source_updated_at INTEGER NOT NULL,
    raw_memory TEXT NOT NULL,
    rollout_summary TEXT NOT NULL,
    rollout_slug TEXT,
    generated_at INTEGER NOT NULL,
    usage_count INTEGER,
    last_usage INTEGER,
    selected_for_phase2 INTEGER NOT NULL DEFAULT 0,
    selected_for_phase2_source_updated_at INTEGER
)
```

행 수 516. **cwd도 git_branch도 없다.** 04 노트가 `Stage1Output` 구조체에 있다고 적은 건 Rust in-memory 타입이고 영속 스키마에는 안 들어갔다. 08 노트 §7의 미확인 항목이 이걸로 해소된다 — stage1 컬럼 스코핑은 불가능하다.

우회로 둘:

- `raw_memory` 본문에 `cwd: /path` 문자열이 들어 있다(실측: `raw_memories.md:12562` 히트가 `cwd: /Users/jun/Developer/new/700_projects/opencodex`를 본문으로 포함). `LIKE`로 근사 가능하지만 (추정) 형식 보장이 없다.
- `thread_id` → `state_N.sqlite`의 `threads.cwd` 조인. `threads-db.ts:25-51`의 `loadThreadMeta`가 이미 `byId` Map을 만들어 준다. **이쪽이 정확하고 이미 있는 코드다.** memory-search는 아직 threads-db를 안 부르고 `openReadOnlyDb` alias만 쓰므로(`memory-search.ts:14`) 호출 한 줄 추가면 된다.

### 4.4 다른 kind의 cwd

`MEMORY.md`는 산문 관례로 `applies_to: cwd=/Users/jun/...` 형식을 쓴다(실측 히트 `MEMORY.md:3914`). 05 노트가 "런타임이 파싱하는 스키마가 아니다"라고 지적한 그것이다. 청크 본문에 대상 cwd 문자열이 있으면 가산하는 식의 부스트로는 쓸 수 있다. (추정) 형식이 통일돼 있지 않아 하드 필터에는 부적합하다.

---

## 5. R5 — 자동 보완 (memory-search → chat-search)

### 5.1 현재 호출 관계

`memory-search.ts:15`가 `chat-search.ts`에서 `splitQueryWords` 하나만 import 한다. 역방향 의존은 없다. 즉 memory-search에서 `searchChat`을 부르면 **순환 import**가 생긴다.

해소 방법 둘:

- `splitQueryWords`를 `query-words.ts`(신규)로 옮기고 양쪽이 그걸 import. 순환이 끊긴다.
- `hook.ts:135-139`의 `RecallContextDeps` 패턴대로 **의존성 주입**. memory-search가 `opts.searchChat?: typeof searchChat`을 받고 `cli.ts`가 주입한다. 테스트에서 chat 경로를 끌 수 있는 장점이 있다.

(추정) 후자가 이 레포 관례에 맞다. `hook.ts`가 이미 같은 모양이고 `DEFAULT_RECALL_DEPS`라는 선례가 있다.

### 5.2 필요한 인터페이스

`searchChat(query, opts)` 시그니처는 이미 충분하다(`chat-search.ts:97`). 보완 호출에 필요한 옵션:

```ts
searchChat(query, {
  home,                 // 동일 home 전파 (필수)
  days: 0,              // 전체 이력
  limit: 5,             // 보완이므로 소량
  noRefresh: true,      // 보완 경로가 ingest 를 트리거하면 안 된다
  includeTools: false,
  source: 'main',
  context: 0,
})
```

`noRefresh: true`가 특히 중요하다. `chat-search.ts:167-176`의 refresh 경로가 `ingest()`를 부르는데, 12GB 인덱스에 대해 이건 memory-search의 41ms 예산을 압도한다. `hook.ts:166`의 자동 주입도 같은 이유로 `noRefresh: true`를 쓴다.

### 5.3 --no-tools 상당 옵션 — 있다

| 층 | 이름 | 위치 |
|---|---|---|
| CLI 플래그 | `--no-tools` | `cli.ts:66` 파서 등록, `cli.ts:40` usage |
| 옵션 필드 | `includeTools?: boolean` | `chat-search.ts:39` (기본 true) |
| CLI 매핑 | `includeTools: values['no-tools'] !== true` | `cli.ts:111` |
| 인덱스 SQL | `m.match_field = 'content'` | `index-search.ts:61` |
| 스캔 파싱 | `parseRollout(content, includeTools)` | `chat-search.ts:273`, `rollout.ts:238-252` |

memory search 쪽에는 이 플래그가 없다(`cli.ts:132-138`의 옵션 조립부에 매핑 없음). `parseFlags`는 chat/memory 공용이라 플래그 자체는 이미 파싱되고, 매핑 한 줄만 추가하면 된다.

보완 결과를 `MemoryHit`으로 바꾸려면 새 origin이 필요하다. 현재 `origin: "file" | "stage1"`(`memory-search.ts:48`)에 `"chat"`을 더하고 `MemoryKind`에도 대응 값을 넣어야 `KIND_PRIORITY`/`HALF_LIFE_HOURS` 레코드가 exhaustive를 유지한다 — `Record<MemoryKind, number>`이므로 타입이 강제한다. `format.ts:60` 출력에도 나타난다.

발동 조건 후보는 파일+stage1 히트 수가 임계 미만일 때다. (추정) 임계 0이면 정말 아무것도 없을 때만이라 안전하고, 3 정도면 보완 효과가 크지만 지연이 늘 수 있다.


---

## 6. P2-1 — 랭킹

### 6.1 index-db.ts의 FTS 정의 (`src/index-db.ts:29-68`)

```sql
-- :54-56
CREATE VIRTUAL TABLE msgs_fts USING fts5(
  text, content='msgs', content_rowid='id', tokenize='unicode61');
-- :57-59
CREATE VIRTUAL TABLE msgs_tri USING fts5(
  text, content='msgs', content_rowid='id', tokenize='trigram');
```

둘 다 external-content 테이블이고 `msgs`가 content table이다.

트리거 (`:60-67`):

```sql
CREATE TRIGGER msgs_ai AFTER INSERT ON msgs BEGIN
  INSERT INTO msgs_fts(rowid, text) VALUES (new.id, new.text);
  INSERT INTO msgs_tri(rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER msgs_ad AFTER DELETE ON msgs BEGIN
  INSERT INTO msgs_fts(msgs_fts, rowid, text) VALUES ('delete', old.id, old.text);
  INSERT INTO msgs_tri(msgs_tri, rowid, text) VALUES ('delete', old.id, old.text);
END;
```

**UPDATE 트리거는 없다.** ingest가 항상 DELETE + INSERT로만 동작하기 때문이다(`ingest.ts:140-141`). 스키마 주석이 이 계약을 명시한다(`index-db.ts:8-11`).

`msgs_fts` 사용처:

```bash
grep -rn "msgs_fts" src/ test/
# src/index-db.ts:8   (주석)
# src/index-db.ts:54  (CREATE)
# src/index-db.ts:61  (INSERT 트리거)
# src/index-db.ts:65  (DELETE 트리거)
# src/index-db.ts:87  (스키마 버전 불일치 시 DROP)
```

**쿼리가 0건이다.** 08 노트 Q5/P1-5가 물은 게 이거고, 답은 "채워져 있는데 아무도 안 읽는다"이다. 실측 `msgs_fts_data` 314,426행 — 데이터는 살아 있다.

### 6.2 index-search.ts의 실제 쿼리 (`src/index-search.ts:82-88`)

```sql
SELECT m.id, m.path, m.ord, m.ts, m.role, m.match_field, m.text,
       f.thread_id, f.cwd, f.source
  FROM msgs m JOIN files f ON f.path = m.path
 WHERE <conds>
 ORDER BY m.ts DESC
 LIMIT ?
```

`ORDER BY m.ts DESC` (`:86`) — **순수 시간순, 관련도 0**. `LIMIT opts.limit + 1`로 절단을 감지한다(`:88, :91-93`).

WHERE 조건 조립 (`:58-80`):

| 조건 | 라인 | SQL |
|---|---|---|
| 단어 (3자 이상) | `:44-46` | `m.id IN (SELECT rowid FROM msgs_tri WHERE msgs_tri MATCH ?)` |
| 단어 (2자 이하) | `:48-49` | `lower(m.text) LIKE ? ESCAPE` |
| synthetic | `:60` | `m.synthetic = 0` |
| tools | `:61` | `m.match_field = 'content'` |
| role | `:62-65` | `m.role = ?` |
| days | `:66-69` | `m.ts >= ?` |
| source | `:70-73` | `f.source = ?` |
| cwd | `:74-80` | 구분자 인지 3중 조건 (`/repo`가 `/repo2`를 안 잡음) |

단어 조건은 anyMode에 따라 `AND`/`OR`로 이어지고(`:59`), 전체는 `AND`로 결합된다(`:85`).

### 6.3 BM25 가용성 — 실측

```bash
node -e "const{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/Users/jun/.codexclaw/recall/index.sqlite',{readOnly:true});
let s=Date.now();
const a=db.prepare('SELECT rowid, bm25(msgs_fts) sc FROM msgs_fts WHERE msgs_fts MATCH ? ORDER BY sc LIMIT 20')
          .all('\"opencodex\" AND \"release\"');
console.log(a.length, Date.now()-s+'ms')"
```

| 질의 | 결과 | 지연 |
|---|---|---|
| `bm25(msgs_fts)` opencodex AND release top20 | 20행 | **146ms** |
| `msgs_tri MATCH opencodex` top20 | 20행 | 15ms |
| `msgs_fts` count 릴리스 | 4,377 | 2ms |
| `msgs_tri` count 릴리스 | 5,208 | 2ms |
| `msgs_fts` count ci | 65,171 | 8ms |
| `msgs_tri` count ci | **0** | 0ms |

환경: node `v24.17.0`, sqlite `3.53.0`. `bm25()` 보조 함수가 그대로 동작한다. 새 의존성이 없다.

`ci` 행이 이 표에서 가장 중요하다. trigram은 3-gram이라 2자를 아예 못 다루고(0행), fts는 65,171행을 즉시 준다. **두 레인이 상호 보완적**이라는 실증이다.

### 6.4 BM25 부착 지점

`wordCondition` (`:43-50`)이 지금은 문자열 하나를 뱉는다. RRF를 하려면 레인별로 id 목록을 따로 뽑아야 하므로 구조가 바뀐다:

```
현재:  words → conds[] → 하나의 SELECT → rows (ts DESC)

제안:  words ─┬→ fts 레인:  SELECT rowid, bm25(msgs_fts) FROM msgs_fts
              │             WHERE msgs_fts MATCH <q> ORDER BY bm25 LIMIT K
              └→ tri 레인:  SELECT rowid FROM msgs_tri
                            WHERE msgs_tri MATCH <q> LIMIT K
                    ↓
              RRF 융합: 1/(60 + rank),  fts 1.0 / tri 0.8
                    ↓
              필터 적용 (synthetic/role/days/source/cwd)
                    ↓
              recency 가산 → 최종 정렬 → LIMIT
```

RRF 파라미터는 cli-jaw `indexing.ts:591-602` 기준 `k=60`, 가중 BM25 1.0 / trigram 0.8이다(research/01 §3.3). **부호를 먼저 정해야 한다** — cli-jaw는 낮을수록 좋고 codexclaw memory-search는 높을수록 좋다(`memory-search.ts:75-78` 주석이 이 반전을 명시). chat search에 도입할 때 어느 관례를 쓸지 정해두지 않으면 두 검색이 엇갈린다.

필터 적용 위치가 설계 갈림길이다. 융합 후에 필터를 걸면 K개 후보 중 대부분이 필터에 걸려 날아가서 최종 히트가 limit에 못 미칠 수 있다(`--cwd`가 좁을 때). 레인 SQL 안에 필터를 밀어넣으면 `msgs_fts`/`msgs_tri`가 `msgs`/`files`와 조인돼야 해서 MATCH 최적화가 약해진다. (추정) K를 limit의 5~10배로 넉넉히 잡고 융합 후 필터가 단순하다. 실측 146ms가 K=20 기준이므로 K=500에서의 지연은 별도 측정이 필요하다.

### 6.5 기본 정렬 정책

08 노트 Q4가 미결로 남긴 항목이다. `ORDER BY ts DESC`는 예측 가능하고 관련도 정렬은 "그때 그거"에 강하다. 실행 관점에서 양쪽을 다 넣는 게 코드 비용이 거의 같다 — 융합 결과에 `ORDER BY ts DESC`를 걸면 시간순, 융합 점수순으로 걸면 관련도순이다. 플래그 하나(`--rank` 또는 `--recent`)와 기본값 결정만 남는데, 이건 코드 조사로는 답이 안 나오는 사용자 결정 사항이다.

---

## 7. P2-3 — hit-count 감점

### 7.1 감점 테이블 위치

`~/.codexclaw/recall/index.sqlite` 안에 새 테이블을 두는 게 맞다. 근거는 `index-db.ts:3-11`의 파생 캐시 계약이다 — 삭제해도 재빌드 비용뿐. 별도 파일을 만들면 정리 대상이 하나 늘고 P4(되돌릴 수 있음)의 "지우면 중립으로 복귀"가 두 곳으로 흩어진다.

```sql
CREATE TABLE IF NOT EXISTS recall_hit_counts (
  ref TEXT PRIMARY KEY,      -- thread:<id> | file:<relpath>
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TEXT NOT NULL
);
```

여기 함정이 하나 있다. `INDEX_SCHEMA_VERSION`(`index-db.ts:18`, 현재 "2")을 올리면 `:84-91`이 drop-and-rebuild를 하는데, 이 재빌드는 실측 12GB / 1,214,276 메시지 전량 재파싱이다. 사용자에게는 수십 분급 정지다.

대안은 `CREATE TABLE IF NOT EXISTS`를 `SCHEMA` 상수에 추가하되 버전은 안 올리는 것이다. `openIndex`가 매번 `db.exec(SCHEMA)`를 돌리므로(`:78`) 기존 인덱스에 테이블만 추가로 생기고 FTS 데이터는 보존된다. (추정) 이쪽이 사용자 체감상 압도적으로 낫다. 다만 `openIndexReadOnly` 경로(`:103-106`)는 스키마를 안 만들므로 테이블 부재를 견뎌야 한다.

### 7.2 감점 공식

jawcode `memory-quality.ts:45-59` (research/02 §2.5): `penalty = (count - threshold + 1) * 0.5`. memory-search 점수 스케일에서 커버리지 1그룹이 +2이므로 0.5 단위 감점은 "같은 문서가 4번 나오면 그룹 하나만큼 손해"가 된다. 스케일이 맞는다.

### 7.3 자동 주입 경로와 명시 검색 경로의 코드 분기

두 경로가 코드상 완전히 갈라져 있다.

```
명시 검색:
  bin/codexclaw.mjs → cli.ts:224-226 main()
                    → runChatSearch (cli.ts:90-123)   / runMemorySearch (cli.ts:125-144)
                    → searchChat(query, opts)         / searchMemory(query, opts)

자동 주입:
  Codex hook  → cli.ts:230-232 main() kind==='hook'
              → runHook(event) (cli.ts:201-220)
              → handleSessionStart (hook.ts:212-233) / handlePostCompact (hook.ts:239-259)
              → buildCwdContext (hook.ts:156-206)
              → deps.searchChat(cwdName, {...})       (hook.ts:162-169)
```

분기점은 `cli.ts:230`의 `if (kind === "hook")` 한 줄이고, 그 아래로는 두 경로가 만나지 않는다.

감점을 자동 주입에만 적용하는 방법 둘:

- `ChatSearchOptions`/`MemorySearchOptions`에 `hitCountPenalty?: boolean`(기본 false)을 추가하고 `buildCwdContext`만 true를 넘긴다. CLI는 이 플래그를 노출하지 않는다.
- 카운트 갱신과 감점 적용을 `hook.ts` 안에서만 한다. `searchChat`이 준 히트를 `buildCwdContext`가 재정렬한다. 검색 코어를 안 건드리므로 명시 검색의 결정론성이 **구조적으로** 보장된다.

(추정) 후자가 P3(경계를 실행 경로로 긋는다)에 더 맞는다. 옵션 플래그는 언젠가 누가 CLI에 노출시킬 수 있지만, hook.ts 안에만 있으면 그럴 수 없다.

카운트 쓰기는 읽기 전용 인덱스 열기와 충돌한다. `buildCwdContext`가 `noRefresh: true`를 쓰고(`hook.ts:166`) 그러면 `chat-search.ts:152-154`가 `openIndexReadOnly`를 탄다. 카운트를 쓰려면 별도 read-write 핸들이 필요하고, 실패는 fail-soft여야 한다(훅은 이미 전체가 fail-open — `cli.ts:217-219`).


---

## 8. 예상 변경 파일과 충돌 관계

### 8.1 파일별 변경 규모

| 파일 | 현재 | 관련 WP | 예상 증분 | 성격 |
|---|---|---|---|---|
| `src/synonyms.ts` | 67 | R2 | +50~70 | 어미 절단 + 절단 후 재조회 |
| `src/memory-search.ts` | 366 | R1·R2·P1-1·R5 | +120~180 | 토큰경계, cwd 파싱/부스트, chat 보완, origin 확장 |
| `src/chat-search.ts` | 327 | R1·R5 | +20~40 | `splitQueryWords` 이전, 심볼 판정 노출 |
| `src/index-search.ts` | 156 | R1·P2-1 | +90~130 | 2레인 분리 + RRF + 필터 재배치 |
| `src/index-db.ts` | 122 | P2-3 | +12~20 | `recall_hit_counts` DDL |
| `src/cli.ts` | 256 | 전부 | +30~50 | 새 플래그 + usage |
| `src/hook.ts` | 260 | P2-3 | +40~60 | 감점 적용 + 카운트 갱신 |
| `src/format.ts` | 102 | R5 | +5~10 | 새 origin 표시 |
| 신규 `src/query-words.ts` | — | R1·R5 | ~60 | 심볼 판정 + 토큰경계 + 순환 해소 |
| `skills/recall/SKILL.md` | — | 전부 | +20~30 | 새 플래그 문서화 |
| 테스트 (신규/증분) | 1,110 | 전부 | +250~350 | §8.3 |

합계 (추정) 700~1,000줄.

### 8.2 충돌 관계 — 같은 PR로 묶어야 하는 것

```
그룹 A ─ 질의 정규화 (R1 + R2)
  query-words.ts(신규) · synonyms.ts · memory-search.ts(:224 matches, :129 scoreChunk,
  :229 firstPresentMember, :237 excerptAround, :331 stage1 SQL) · chat-search.ts(:85)
  → 매칭 술어를 통째로 바꾸므로 쪼갤 수 없다. splitQueryWords 이동이 chat-search 를 끌어들인다.

그룹 B ─ 스코핑 (P1-1)
  memory-search.ts(:194 frontmatter, :245 searchMemory, :309 searchStage1)
  · threads-db.ts(신규 호출) · cli.ts(--cwd 매핑)
  → memory-search.ts 를 A 와 공유한다. ★ A 와 같은 PR 이거나 엄격한 순서가 필요하다.

그룹 C ─ chat 랭킹 (P2-1)
  index-search.ts · index-db.ts(주석) · cli.ts(--rank/--recent)
  → memory-search.ts 를 안 건드린다. A/B 와 독립.

그룹 D ─ hit-count (P2-3)
  index-db.ts(DDL) · hook.ts
  → index-db.ts 를 C 와 공유하지만 C 는 주석만 고친다. 실질 충돌 낮음.

그룹 E ─ 자동 보완 (R5)
  memory-search.ts · format.ts · cli.ts
  → memory-search.ts 를 A/B 와 공유. ★ 셋 중 마지막이어야 한다.
```

`memory-search.ts`가 A·B·E 세 그룹의 공통 파일이고 이게 최대 충돌원이다. 선택지 셋:

- **A+B+E 를 PR 하나로** — 리뷰 단위가 400줄 근처로 커지지만 rebase 지옥이 없다
- **A → B → E 순차 스택** — 각 PR이 작지만 앞 PR 머지 전까지 뒤가 못 움직인다
- **A만 먼저 독립 머지, B·E는 이후** — R1/R2가 가장 급하고 효과가 크므로 (추정) 실용적

`cli.ts`는 A·B·C·E 전부가 손대지만 각자 다른 라인(플래그 등록 `:56-77`, 옵션 조립 `:102-116`/`:132-138`, usage 배열 `:25-47`)이라 충돌이 기계적으로 잘 풀린다.

### 8.3 테스트 러너와 패턴

- 러너는 **node:test**다. vitest 아님 — `recall/package.json:8`이 `"test": "node --test"`
- 루트 `package.json`의 `test` 스크립트가 `plugins/codexclaw/scripts/test.mjs`에 glob을 넘긴다. recall 몫은 `plugins/codexclaw/components/recall/test/*.test.ts`
- `test.mjs`는 `--test-concurrency=1`로 직렬 실행하고 `CODEXCLAW_HOME`을 임시 디렉터리로 덮는다 (운영자 설정 오염 방지)
- import 스타일: `import test from "node:test"` + `import assert from "node:assert/strict"`, 소스는 `../src/x.ts` (확장자 포함, Node 타입 스트리핑)
- 픽스처는 `test/fixtures.ts`의 `buildCodexHome(home)`이 합성 CODEX_HOME을 만든다. 날짜가 `Date.now()` 상대(`fixtures.ts:16-22`)라 `--days` 테스트가 가능하다
- 랭킹 테스트는 **공유 픽스처 home의 mtime을 절대 안 건드린다** — `ranking.test.ts:1-5` 헤더가 명시. 격리 temp home + `utimesSync`를 쓴다
- 결정론: `MemorySearchOptions.nowMs`(`memory-search.ts:29`)가 시계 주입 seam이다. 새 랭킹 테스트도 이걸 써야 한다
- 빌드는 `scripts/build.mjs`가 `stripTypeScriptTypes`로 `src/*.ts → dist/*.js`. **써드파티 import 금지**이므로 RRF/BM25는 순수 SQL + JS로만 짜야 한다(`build.mjs:5-8` 주석이 계약을 명시)
- `dist/`가 커밋된다(14파일 실재). 소스 변경 시 재생성이 필요하다

새 테스트 배치 제안: R1/R2는 `synonyms.test.ts` + 신규 `query-words.test.ts`, P1-1은 `memory-search.test.ts`, P2-1은 신규 `index-rank.test.ts`, P2-3은 `hook.test.ts`.

---

## 9. 확인하지 못한 것

- RRF 융합의 실제 지연. BM25 단독 top20이 146ms인 건 쟀지만 K=500 두 레인 + JS 융합의 종단 지연은 안 쟀다. 현재 인덱스 경로가 밀리초급이므로 회귀 여부는 구현 후 측정이 필요하다
- 12GB 인덱스에서 `msgs_fts`가 차지하는 비중. `msgs_fts_data` 314,426행은 셌지만 바이트는 안 쟀다. Q5의 "지우면 인덱스가 작아진다" 쪽 이득 크기가 미확인이다
- 어미 절단 규칙의 정밀도 손실. 코퍼스 통계로 부착률은 쟀지만 절단 도입 전후의 상위 5건 품질 비교는 골든 셋이 있어야 한다. 이 노트 범위 밖이다
- `raw_memory` 본문의 `cwd:` 문자열 형식 일관성. 히트 하나에서 봤을 뿐 516행 전수 확인은 안 했다
- `chat-search`가 동의어를 안 쓰는 이유. 코드·주석·테스트 어디에도 근거가 없다 (08 노트 §7과 동일한 미해결)
- `memory_summary.md`가 실측 상위를 독점하는 현상이 사용자 체감상 좋은지 나쁜지. `"ci"` 질의 하나로 관찰했고, 이게 KIND_PRIORITY 설계 의도대로인지 과한지는 판단 근거가 부족하다

