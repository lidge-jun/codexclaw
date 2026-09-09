# 05 — 프로젝트 스코핑의 정체성 문제 (관리형 워크트리)

날짜: 2026-09-10 (KST). 과제 S5. 읽기 전용.
워크트리 cwd: `/Users/jun/.codex/worktrees/3412/codexclaw`.
설치 CLI: `node /Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs`.

## 방법

- recall 인덱스: `sqlite3 -readonly /Users/jun/.codexclaw/recall/index.sqlite`. `files.cwd` 집계. 브리프가 적은 URI 형태 `sqlite3 'file:...?mode=ro'` 는 이 환경에서 `.schema` 가 `unable to open database file (14)` 로 실패했고, `-readonly` 는 성공했다. 이후 `select 1` 은 URI 경로로도 1을 반환했다. 본 집계는 모두 `-readonly` 결과.
- Codex state: 실제 파일은 `~/.codex/state_5.sqlite` (2026-09-10 06:29, WAL 동반). `threads` / `projects` / `project_roots` 스키마 확인 후 같은 `-readonly` 질의.
- 검색 재현: 설치본 `cxc.mjs memory search "메모리" --cwd|--cwd-only <이 세션 cwd> --no-refresh --json`. memory search 의 chat fallback 은 `noRefresh: true` 로 고정이라 인덱스를 쓰지 않는다 (`memory-search.ts:524-526`).
- session_meta: `~/.codex/sessions/**/*.jsonl` 120개 첫 줄 파싱 (최신 80 + 오프셋 샘플 40). 실패 0.
- git common dir: 이 워크트리와 메인 체크아웃에서 `git rev-parse --show-toplevel --git-common-dir --absolute-git-dir`.

분류 규칙 (사실, 이 노트에서 고정):

- `worktree`: cwd 가 `%/.codex/worktrees/%` 를 포함.
- `tmp`: cwd 가 `/tmp/%` 또는 `/private/tmp/%`.
- `main`: cwd 가 대소문자 무시로 `.../developer/new/700_projects/{codexclaw|opencodex|cli-jaw}` 또는 그 하위.
- 프로젝트 소속: cwd 가 `/{name}` 으로 끝나거나 `/{name}/` 세그먼트를 포함 (name ∈ codexclaw, opencodex, cli-jaw). 경로에 그 이름이 없는 tmp/기타는 해당 프로젝트 분모에 넣지 않음.

## 현재 매칭 규칙 (코드)

`normalizeCwd` / `cwdMatches` 는 구분자와 드라이브 문자만 접고, 경로 대소문자는 접지 않는 접두사 매칭이다.

- `plugins/codexclaw/components/recall/src/rollout.ts:77-90`: `s === p || s.startsWith(p + "/")`. 테스트는 `/proj/alpha` 가 `/proj/alpha/sub` 와 매칭하고 `/proj/alphabet` 과는 불일치 (`recall/test/round2.test.ts:111-114`, `cwd-scope.test.ts:281-287`).
- memory `--cwd` 는 필터가 아니라 `CWD_BOOST = 2` 가산 (`memory-search.ts:103-108, 315-325`). structured cwd 가 접두사 매칭되면 +2, 본문에 경로 문자열이 있으면 +1, 아니면 유지.
- memory `--cwd-only` 는 위 신호가 없으면 drop. 결과가 비면 경고 `no matches inside --cwd-only <prefix> — retry with --cwd ...` (`memory-search.ts:325, 478`).
- chat `--cwd` 는 SQL 접두사 필터: `f.cwd = ? OR f.cwd LIKE ?/%` (`index-search.ts:131-136`). 부스트가 없다.
- 훅의 cwd 컨텍스트는 **정확 일치** `WHERE cwd = ?` (`cwd-context.ts:84-89`). 주석이 이미 hash worktree 이름(`"1fa9"`)은 대화 텍스트에 안 나온다고 적는다 (`cwd-context.ts:4-7`).
- ingest 는 session_meta 에서 `threadId, cwd, source` 만 저장한다 (`rollout.ts:162-175`, `ingest.ts:99-127`). `files` 스키마에 git 컬럼 없음 (`index-db.ts:50-61`).

따라서 메인 `.../700_projects/codexclaw` 와 관리형 워크트리 `~/.codex/worktrees/<slot>/codexclaw` 는 서로 접두사가 아니라서 같은 프로젝트로 묶이지 않는다. 이 워크트리 common dir 실측: 메인 체크아웃 `.git` 과 동일 (`/Users/jun/Developer/new/700_projects/codexclaw/.git`), git-dir 만 `.../.git/worktrees/codexclaw1`.

스킬 문구도 이 한계를 이미 전제한다: "a worktree checkout typically owns one summary or none, so a hard filter would answer nothing" (`skills/recall/SKILL.md:77-86`). #108 은 그 이유로 `--cwd` 를 부스트로 두었고, 워크트리↔메인 연합은 구현하지 않았다.

## (1) cwd 분포

인덱스 메타: `schema_version=2`, `last_ingest_at=2026-09-09T21:12:34.666Z` (KST 06:12). 이 워크트리 세션들은 그 이후(state `updated_at` 06:29 전후)라 `files.cwd` 에 이 cwd 가 0건인 것과 맞다.

### 전체 (프로젝트 무관)

recall `files` (롤아웃 파일, main+subagent, n=13194, cwd 결측 0):

| bucket | n | % |
| --- | ---: | ---: |
| main_700_projects (`.../700_projects/` 전체) | 7356 | 55.75 |
| worktree `~/.codex/worktrees/*` | 3096 | 23.47 |
| other | 2686 | 20.36 |
| tmp (`/tmp` + `/private/tmp`) | 56 | 0.42 |

Codex `threads` (세션, n=13226, cwd 결측 0; unarchived 12234):

| bucket | n | % | unarchived n | unarchived % |
| --- | ---: | ---: | ---: | ---: |
| main_700_projects | 7974 | 60.29 | 7245 | 59.22 |
| worktree | 3109 | 23.51 | 2941 | 24.04 |
| other | 2092 | 15.82 | 1997 | 16.32 |
| tmp | 51 | 0.39 | 51 | 0.42 |

worktree 슬롯 수: files 298개 distinct cwd, threads 잎 기준 opencodex 239 / cli-jaw 46 / codexclaw 12 / ima2-gen 5.

tmp 는 거의 `/private/tmp/...` 이다. 브리프가 적은 `/tmp/cxc-*` 패턴은 threads 5건뿐 (`/private/tmp/cxc-live` 3, `cxc-tool-progress*` 2). 세 대상 레포 잎 이름으로 분류되는 tmp 세션은 0.

other 의 큰 덩어리 (threads): `.cli-jaw*` 830, misc 662, `Developer/codex` 141, Desktop 132, 701_design-isms 102, home 96, Documents 68, 900-nypc 61. 프로젝트 홈(`~/.cli-jaw`)과 메인 체크아웃은 별 cwd 이다.

관련 부가 사실: macOS SQLite `LIKE` 는 ASCII 대소문자를 접지만, `cwdMatches` 는 접지 않는다 (`cwd-scope.test.ts:287`). 인덱스에 `/Users/jun/developer/new/700_projects/cli-jaw` (소문자 developer) 435 files 가 `/Users/jun/Developer/...` 와 별개 키로 존재한다. 워크트리 문제와 별개인 두 번째 정체성 균열.

### 세 프로젝트 — 워크트리 세션 비율

분모 = 해당 레포 이름 세그먼트를 가진 행. 분자 = 그 중 `~/.codex/worktrees/*`. tmp 는 이 분모에 안 들어간다 (경로에 레포 잎이 없음).

**threads (세션, 과제 질문의 기본 단위):**

| project | n | worktree_n | worktree % | main n | main % |
| --- | ---: | ---: | ---: | ---: | ---: |
| opencodex | 5794 | 2523 | **43.55** | 3271 | 56.45 |
| cli-jaw | 1976 | 417 | **21.10** | 1559 | 78.90 |
| codexclaw | 1539 | 141 | **9.16** | 1398 | 90.84 |

unarchived 만: opencodex 45.74% (2378/5199), cli-jaw 22.51% (394/1750), codexclaw 9.43% (141/1495).

**files (롤아웃 파일, subagent 포함):**

| project | n | worktree_n | worktree % | main n | main % |
| --- | ---: | ---: | ---: | ---: | ---: |
| opencodex | 5379 | 2518 | **46.81** | 2861 | 53.19 |
| cli-jaw | 1824 | 417 | **22.86** | 1407 | 77.14 |
| codexclaw | 1492 | 133 | **8.91** | 1359 | 91.09 |

해석: opencodex 는 세션의 약 44%가 관리형 워크트리라, cwd 접두사 스코프를 메인 체크아웃에 걸면 거의 절반이 빠지고, 워크트리에 걸면 메인이 빠진다. codexclaw 는 비율이 작지만 (9%), **지금 이 세션이 그 9% 쪽**이다.

네이티브 memories `rollout_summaries` 256개 전부 leading `cwd:` 있음. 같은 분류로 worktree 75 (29.3%). 세 프로젝트 요약: opencodex 67/173 = 38.73%, cli-jaw 5/32 = 15.62%, codexclaw 2/15 = 13.33%. 이 워크트리 cwd 의 요약은 **0**. 메인 체크아웃 요약 13.

## (2) 이 세션 cwd 로 검색 재현

대상 cwd: `/Users/jun/.codex/worktrees/3412/codexclaw`.

state `threads` 이 cwd: **8건** (부모 01a0880e… + S1–S8 서브에이전트). 전부 `git_origin_url=https://github.com/lidge-jun/codexclaw.git`, `git_branch` 빈 문자열. recall `files` 이 cwd: **0건** (`last_ingest_at` 이후 생성이라 `--no-refresh` 와 일치).

명령 1 (부스트):

```
node .../cxc.mjs memory search "메모리" --cwd /Users/jun/.codex/worktrees/3412/codexclaw --no-refresh --json
```

결과: exit 0, hits=20, warnings=[], scannedFiles=285, elapsedMs=789. **20건 모두 이 cwd 가 아니다.** 상위 cwd 분포: null(핸드북/summary/raw/extension) + cli-jaw 메인 + ima2-gen + `~/.cli-jaw` + **다른 슬롯** `~/.codex/worktrees/1fa9/codexclaw` + Documents/Codex + opencodex 메인. 같은 레포의 메인 체크아웃 히트는 상위 20에 없고, 다른 워크트리 슬롯 1건은 접두사가 달라 부스트 대상이 아니다. `CWD_BOOST` 가 실제로 붙은 히트는 0으로 보는 것이 맞다 (structured cwd 불일치, 본문에 이 절대 경로가 나온 흔적 없음).

명령 2 (하드 필터):

```
node .../cxc.mjs memory search "메모리" --cwd-only /Users/jun/.codex/worktrees/3412/codexclaw --no-refresh --json
```

결과: exit 0, hits=**0**, scannedFiles=285, elapsedMs=4030, warnings:

`no matches inside --cwd-only /Users/jun/.codex/worktrees/3412/codexclaw — retry with --cwd to rank it first instead`

chat fallback 도 hard scope 일 때만 cwd 를 넘긴다 (`memory-search.ts:531`). 인덱스가 이 cwd 0건이라 백필도 비고, 경고는 cwd-only 공란 경고만 남는다. elapsed 가 부스트 쪽(789ms)보다 긴 것은 빈 메모리 결과에 이어 12GB 인덱스 chat 질의가 붙은 정황과 맞다.

대조 (실행하지 않고 코드+분포로 확정): 같은 질의를 메인 체크아웃 `--cwd-only /Users/jun/Developer/new/700_projects/codexclaw` 에 걸면 이 워크트리 8세션·다른 슬롯 요약은 제외되고, 메인 13개 요약만 산다. 두 접두사는 서로 `cwdMatches` 가 false.

## (3) 대안 설계

ingest 시점 git 정보 — **jsonl 에 이미 있다.** 샘플 120개 session_meta 중 120이 `cwd`, 119가 `payload.git` 객체. 관측 필드:

- `git.commit_hash` (119/120)
- `git.repository_url` (119/120)
- `git.branch` (58/120; 이 워크트리 샘플은 branch 키 없음, 메인은 `branch: "dev"`)

이 워크트리 실측 (jsonl 첫 줄):

`~/.codex/sessions/2026/09/10/rollout-2026-09-10T06-28-53-01a08812-df3a-7fe0-b8ff-4f754927bb74.jsonl`
`cwd=/Users/jun/.codex/worktrees/3412/codexclaw`
`git={commit_hash: 369ed0e110ad77a4bcfa1784ac5156b89a754a42, repository_url: https://github.com/lidge-jun/codexclaw.git}`

메인 체크아웃 샘플 `.../2026/09/09/rollout-2026-09-09T20-32-16-01a085f0-a7b9-70c1-9336-f83cb36e0c16.jsonl` 도 같은 `repository_url`, `branch: "dev"`.

`readRolloutMeta` 는 이 객체를 버린다 (`rollout.ts:162-175`). 반면 Codex `threads` 는 이미 `git_sha`, `git_branch`, `git_origin_url` 컬럼을 갖고, 전체 13226 중 origin 11446 (86.5%), sha 11942, branch 10926. 워크트리만 보면 origin 3056/3109 (98.3%) 로 메인보다 더 잘 채워져 있다. **`loadThreadMeta` 는 `git_branch` 만 읽고 `git_origin_url` 은 버린다** (`threads-db.ts:32-40`).

`threads.project_id` 는 13226건 전부 NULL. `projects` / `project_roots` 는 메인 체크아웃 경로만 들고 워크트리를 포함하지 않는다. 네이티브 프로젝트 키는 지금은 검색에 쓸 수 없다.

common dir 은 session_meta 에 없다. 살아 있는 체크아웃에서 `git rev-parse --git-common-dir` 으로만 얻는다. 이 워크트리는 메인 `.git` 과 동일함이 확인됨. 삭제된 슬롯 235개(opencodex files 기준)는 ingest 당시가 아니면 common dir 을 재현할 수 없다.

`cxc session bind` 는 PABCD 소스 바인딩이다 (`session-source.ts:27-36, 98-116`). 필드: `nativeCwd, sourceRoot, commonDir, gitDir`. 이 워크트리 `./.codexclaw/sources` 없음, 메인 체크아웃 sources 도 0파일. recall 인덱스가 읽지 않음.

### 비교

| 키 | 장점 | 단점 | 인덱스 스키마 | ingest 시 획득 |
| --- | --- | --- | --- | --- |
| 지금: cwd 접두사 | 구현·테스트 단순, 서브디렉터리 세션을 한 체크아웃으로 묶음 | 워크트리·tmp·대소문자 변형을 다른 프로젝트로 봄. opencodex 세션 44%가 이 구멍 | 변경 없음 (현재) | session_meta.cwd (이미 저장) |
| git remote URL (`git.repository_url` / `threads.git_origin_url`) | 메인↔워크트리가 같은 값으로 이미 기록됨. 이 세션 8건과 메인 요약이 같은 URL. 삭제된 워크트리도 jsonl 에 영구 보존 | cli-jaw 는 origin 이 두 개 (`bitkyc08-arch/cli-jaw` 1129 vs `lidge-jun/cli-jaw.git` 829). `.git` 유무·https/ssh 정규화 필요. origin 결측: codexclaw 195/1539 (12.7%), opencodex 45, cli-jaw 9 | recall `files` 에 컬럼 추가가 정석. 검색 시점 `threads.git_origin_url` 조인만으로도 stage1/요약(thread_id 있는 것)은 스키마 없이 가능 | **가능, jsonl 에 있음.** git 명령 불필요 |
| repo 이름 (basename) | 워크트리 슬롯 이름이 달라도 잎이 `codexclaw` | 동명 레포 충돌. `cli-jaw-pr473` 같은 변형, `~/.cli-jaw` 홈과 혼동 여지. 잎만으로는 origin 이전(fork)을 구분 못 함 | 저장 안 해도 cwd 에서 파생 가능 | cwd 파생, git 불필요 |
| git worktree common dir | 같은 객체 저장소의 모든 워크트리를 물리적으로 한 키로 묶음. session bind 가 이미 이 값으로 신원을 검사함 | session_meta 에 없음. 죽은 워크트리는 재계산 불가. 메인 cwd 문자열과는 다른 값이라 검색 UX 에 매핑 필요 | 컬럼 추가 또는 파생 테이블 | 살아 있는 cwd 에서만 `git rev-parse`. jsonl 만으로는 **불가** |
| codexclaw session bind | 이미 commonDir+sourceRoot 를 불변 파일로 고정 | PABCD 세션만, 이 머신에 bind 파일 0. 네이티브 세션 전체의 키가 아님. recall 이 읽지 않음 | recall 스키마와 무관 (`.codexclaw/sources/<id>.json`) | bind 를 실행한 세션만. ingest 기본 경로 아님 |

INDEX_SCHEMA_VERSION 은 `"2"` 이고, 버전 불일치는 files/msgs 를 drop 후 12GB 재파싱한다 (`index-db.ts:33-36, 125-140`). git URL 컬럼은 `recall_hit_counts` 처럼 `ALTER TABLE` / 읽기 측 NULL 허용으로 넣는 편이 재빌드를 피한다. 검색 시점 state db 조인만 쓰면 recall 스키마 변경은 필수가 아니다. chat SQL 필터(`index-search.ts:131-136`)까지 URL 로 바꾸려면 `files` 컬럼 또는 ingest 시 denorm 이 필요하다.

## 로드맵 입력

(a) 회귀 여부: **#108 이 도입한 설계 공백이지, 예전에 되던 워크트리↔메인 연합이 깨진 코드 회귀는 아니다.** L0 이전에는 memory `--cwd` 자체가 없었고, cwd 가 다른 세션은 원래 한 프로젝트로 안 묶였다. #108 은 접두사 부스트/필터를 넣으면서 관리형 워크트리(opencodex 세션의 44%)를 명시적으로 다른 프로젝트처럼 취급하게 됐다. 이 세션에서 `--cwd-only` = 0건, `--cwd` 부스트 무효는 그 동작의 직접 결과다. 네이티브 `threads.git_origin_url` / session_meta.`git.repository_url` 은 L0 이전부터 있었고 cxc 가 안 읽은 것이다. 게이트 오탐·자연어 0건과는 별 층.

(b) 수정 후보

- **P0** 프로젝트 키를 cwd 접두사 + git remote URL 로 확장. `--cwd <worktree>` / `--cwd-only <worktree>` 가 같은 `repository_url` 의 메인 체크아웃 히트를 포함하게. URL 정규화(`.git` 제거, 소문자 host, ssh↔https)와 origin 결측 시 cwd 접두사 fallback.
- **P1** chat `--cwd` SQL 과 훅 `listCwdSessions` 정확 일치(`cwd-context.ts:89`)도 같은 키로 연합. 지금 훅은 슬롯 로컬 세션만 주입한다.
- **P1** macOS 경로 대소문자: `/Users/jun/developer/...` 435 files 가 `Developer` 질의에 안 맞음. `cwdMatches` 에 호스트 정책(case-insensitive volume) 또는 저장 시 canonicalize.
- **P2** repo basename 단독 키는 쓰지 말 것 (충돌). common dir 은 살아있는 워크트리의 보조 확인용. session bind 를 recall 키로 승격하지 말 것 (커버리지 0).
- **P2** Codex `projects.project_id` 가 채워지기 전에는 의존하지 말 것 (현재 전부 NULL, roots 는 메인만).

(c) 대상 파일과 검증

- P0 검색 조인: `components/recall/src/threads-db.ts` (`git_origin_url` SELECT), `memory-search.ts` `scopeAdjust` / `buildCwdScope`, `rollout.ts` `cwdMatches` 옆에 URL 매칭.
- P0 ingest denorm (chat SQL용): `rollout.ts` `readRolloutMeta` 가 `payload.git.repository_url` 파싱, `ingest.ts` INSERT, `index-db.ts` 컬럼 추가(버전 범프 없이), `index-search.ts` WHERE.
- 테스트: `recall/test/cwd-scope.test.ts` 에 메인 cwd 질의 ↔ 워크트리 기록 히트 연합, 다른 origin 은 제외, origin 결측은 cwd fallback.
- 검증 명령 (인덱스를 건드릴 때만 refresh, 회귀 확인은 `--no-refresh`):

```
node <cache>/bin/cxc.mjs memory search "메모리" --cwd-only /Users/jun/.codex/worktrees/3412/codexclaw --no-refresh --json
node <cache>/bin/cxc.mjs memory search "메모리" --cwd-only /Users/jun/Developer/new/700_projects/codexclaw --no-refresh --json
node <cache>/bin/cxc.mjs chat search "메모리" --cwd /Users/jun/.codex/worktrees/3412/codexclaw --no-refresh --json
sqlite3 -readonly ~/.codex/state_5.sqlite "SELECT git_origin_url, COUNT(*) FROM threads WHERE cwd LIKE '%/codexclaw' OR cwd LIKE '%/worktrees/%/codexclaw' GROUP BY 1;"
```

성공 기준: 워크트리 `--cwd-only` 가 0건에서, 메인 체크아웃 cwd 를 가진 codexclaw 요약/stage1 을 포함하고, cli-jaw/opencodex origin 은 포함하지 않음. 현재 재현은 0건 + 메인 미포함이 실패 기준선.
