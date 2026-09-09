# 000 — memory-upgrade L0: Plan

## 목표

codexclaw 메모리 레이어를 실제 코드로 강화한다. 260909 분석 8종(`research/01~08`)과 260909 정찰
3종(`010`/`011`/`012`)이 확정한 사실 위에서, 승인 게이트 한 쌍과 검색 정확도·스코핑·주입 밀도·랭킹
다섯 갈래를 구현하고 수동 스택 PR로 `dev`에 올린다.

승계 대상은 `devlog/_plan/260829_memory-upgrade/020_improvement_plan.md`다. 그 문서가 남긴 R1·R2·R5·
W2·`dedicated_tools` 활성화 항목을 이 사이클이 실제 구현으로 옮기고, 260909 설계 문서
(`research/08_codexclaw-memory-design.md`)가 추가한 P1-1~P1-4·P2-1·P2-3을 함께 담는다.

## 기준선과 핀

| 항목 | 값 |
|---|---|
| 워크트리 | `/Users/jun/.codex/worktrees/1fa9/codexclaw` |
| 브랜치 | `codex/memory-upgrade-l0` |
| 로컬 HEAD | `6e97e73d4f0a07ac220049d9f67ef71e29ba995c` |
| 정찰 시점 `origin/dev` | `6e97e73d` |
| 현재 `origin/dev` | `0cacdc8d2e8df26b96d47a325270cc7a25069904` (#98 머지) |
| 플러그인 버전 | `0.2.24` / 매니페스트 `0.2.24+codex.20260908031619` |
| 훅 개수 | 23파일 / 24핸들러 |

정찰 3종은 `6e97e73d`에서 수행됐고 그 뒤 `dev`가 `#98` 머지로 한 칸 전진했다. `#98`은 devlog 문서
커밋이라 이 사이클이 만지는 코드 표면과 겹치지 않지만, wp1 착수 시점에 `origin/dev`를 다시 받아
브랜치를 그 위에 세운다.

## 작업 등급

C4 구현 사이클. work-phase 여섯 개이고 각각이 하나의 완결된 PABCD 사이클이다. 프로덕션 코드
(`plugins/codexclaw/components/**`), 훅 매니페스트, 커밋된 `dist/`, 개수 결합 문서를 바꾼다.
wp0(이 문서)만 문서 전용이다.

## 정찰이 뒤집은 전제 네 가지

착수 전에 이것부터 봐야 한다. 승계 플랜과 설계 문서가 전제한 네 가지가 정찰에서 사실과 다르다는
것이 드러났고, 그중 둘은 그 자체로 수정 대상 버그다.

### T1 — PostCompact 주입은 모델에 도달하지 않는다. 그리고 훅을 Failed로 만든다

`research/08` P1-2는 "PostCompact 회수 예산을 SessionStart보다 작게"였다. 그 경로가 애초에 작동하지
않는다. codex-rs의 PostCompact 출력 와이어는 universal 필드만 받고 `deny_unknown_fields`가 붙어
있어서(`hooks/src/schema.rs:177-184`), `hookSpecificOutput` 키가 들어간 JSON은 파싱에 실패한다.
실패하면 `looks_like_json`이 참이라 핸들러가 **Failed로 기록되고** "hook returned invalid PostCompact
hook JSON output" 에러를 남긴다(`hooks/src/events/compact.rs:305-311`). 현재
`components/recall/src/hook.ts:259`가 정확히 그 봉투를 반환한다.

같은 레포의 다른 두 컴포넌트는 이미 이 사실을 알고 대응해 놨다 —
`components/pabcd-state/src/hook.ts:1924-1934`는 상태만 고치고 항상 빈 문자열을 반환하고,
`components/cxc-ops/src/map-affordance.ts:256-263`은 마커만 쓰고 다음 UserPromptSubmit에서 뱉는다.
`docs-site/src/content/docs/reference/hooks.md:99-101`에도 같은 취지의 경고가 있다. recall 컴포넌트만
이 교훈에서 빠져 있다.

**P1-2의 자리는 PostCompact가 아니라 SessionStart의 `source === "compact"`다.** compaction 직후
codex는 `SessionStartSource::Compact`를 큐에 넣고(`core/src/session/mod.rs:3865`) 다음 턴에 SessionStart
훅을 다시 발화시킨다(`core/src/hook_runtime.rs:128`). 그 payload의 `source` 필드가
`startup|resume|clear|compact` 중 하나다(`hooks/src/schema.rs:499-509`). SessionStart는
`additionalContext`를 정상적으로 받는다(`hooks/src/events/session_start.rs:262-267`).
현재 `components/recall/src/cli.ts:209`가 payload를 `{cwd?: string}`으로만 좁혀 읽어 이 필드를 버린다.

이 전제 뒤집힘은 등록된 성공 기준 c-8의 문면도 바꾼다. 아래 §성공 기준에서 재해석을 명시한다.

### T2 — 메모리 툴의 hook-facing 이름은 구분자가 없다 (추정, B 페이즈 첫 검증)

메모리 툴은 MCP가 아니라 extension 툴이고 `memories` 네임스페이스를 쓴다
(`ext/memories/src/lib.rs:18`). `ExtensionToolAdapter`는 `pre_tool_use_payload`를 재정의하지 않으므로
(`core/src/tools/handlers/extension_tools.rs:72-96`) 기본 구현이 쓰이고, 그것은
`flat_tool_name`으로 간다(`core/src/tools/registry.rs:801-808`). `flat_tool_name`은 네임스페이스와
이름을 **구분자 없이 이어붙인다**(`core/src/tools/mod.rs:40-54`).

그래서 훅이 보는 이름은 `memories.add_ad_hoc_note`가 아니라 **`memoriesadd_ad_hoc_note`**로 추정된다.
같은 현상을 이 레포가 이미 겪었다 — `components/subagent-config/src/spawn-attach-hook.ts:5-8`이 정확히
같은 근거로 `collaborationspawn_agent`를 다루고, matcher를 `^(collaboration[._]?)?spawn_agent$`처럼
방어적으로 쓴다(`spawn-attach-hook.ts:483-488`).

**직접 실행으로 확인하지 않았다.** 소스 3단 추론과 선례의 결합이 근거이고 문자열 자체는 코드베이스에
리터럴로 없다. wp1 B 페이즈의 **첫 검증 항목**으로 둔다(§wp1). 실측 전까지 matcher는
`^memories[._]?add_ad_hoc_note$` 형태의 방어형을 쓴다.

### T3 — `stage1_outputs`에 cwd 컬럼이 없다. `threads.cwd` 조인이 우회로다

`research/08` §7이 미확인으로 남기고 P1-1의 stage1 스코핑을 여기에 종속시켰던 항목이다. 실측 결과
`memories_N.sqlite`의 `stage1_outputs`는 10컬럼이고 `cwd`도 `git_branch`도 없다
(`011_survey_recall_search.md` §4.3). `research/04`가 적은 `Stage1Output`의 cwd 필드는 Rust in-memory
타입이고 영속 스키마에 들어가지 않았다. **stage1 컬럼 스코핑은 불가능하다.**

우회로는 `thread_id` → `state_N.sqlite`의 `threads.cwd` 조인이고, 그 코드는 이미 있다 —
`components/recall/src/threads-db.ts:25-51`의 `loadThreadMeta`가 `byId` Map을 만들어 준다.
`memory-search.ts:14`는 아직 `openReadOnlyDb` alias만 가져다 쓰고 `loadThreadMeta`를 부르지 않는다.
호출 한 줄과 조인 로직이 wp3의 실제 작업이다.

반면 `rollout_summaries/*.md`의 frontmatter `cwd:`는 실측 **256/256 전량 존재**한다
(`011` §4.2). 파일 경로 쪽 스코핑은 기존 `frontmatterThreadId`(`memory-search.ts:194-197`)와 같은
방식으로 바로 된다.

### T4 — 자동 주입 쿼리가 `basename(cwd)`라 해시 워크트리에서 항상 0건이다

이건 밀도 문제가 아니라 **커버리지 버그**다. `components/recall/src/hook.ts:159`가 검색 쿼리를
`basename(cwd)`로 잡기 때문에, 그 단어가 대화 본문에 문자열로 등장한 세션만 잡힌다. 워크트리 이름이
해시인 경우(`1fa9`) 거의 항상 0건이고, 실측으로 이 워크트리에서 CWD 블록이 통째로 비었다
(`012_survey_hook_injection.md` §1.1~§1.2).

사이드카 인덱스의 `files` 테이블은 `cwd` 컬럼을 이미 갖고 있어서(`index-db.ts:31-41`) 텍스트 매칭 없이
CWD로 세션을 직접 열거할 수 있다. 실측 1.2ms(12,745파일 / 1,214,276메시지). 즉 지금은 최근 작업이
있는데도 구조적으로 못 찾는 상태이고, wp4가 이걸 함께 고친다.

## 범위

- W2 승인 게이트 훅 — 승인 없는 `~/.codex/memories` 쓰기 차단. 대상은 두 표면이다: 메모리 쓰기 툴
  (T2의 이름)과 `apply_patch`/`Write`/`Edit`/셸을 통한 직접 파일 편집.
- `memories.dedicated_tools` 자동 활성화 — `cxc enable`이 켜고 `cxc disable`이 원복한다. W2와 한 쌍이며
  W2 없이 단독 활성화하지 않는다.
- R1 토큰 경계 일치 — 심볼형 질의의 substring 오매칭 제거.
- R2 한국어 어미 절단 + 동의어 확장 연쇄.
- P1-1 `cxc memory search --cwd` / `--cwd-only` 프로젝트 스코핑.
- R5 memory 히트 부족 시 chat 자동 보완.
- P1-2 compaction 인지 회수 캡 — SessionStart `source=compact` 분기. PostCompact 실버그 수정 포함.
- P1-3 자동 주입 2티어 밀도 + T4 커버리지 수정.
- P1-4 주입 블록 신선도 라벨.
- P2-1 chat search 랭킹 — `msgs_fts` BM25 레인 부활 + trigram RRF + recency.
- P2-3 hit-count 감점 — 자동 주입 경로 한정.

## 범위 밖

- `~/.codex` 전체 쓰기. 읽기 전용으로만 다룬다. 예외는 `cxc config set`의 매니페스트 경로를 통한
  `config.toml` 관리 키 하나뿐이고, 그것도 `cxc disable`이 원복을 보장한다.
- 임베딩 도입. `research/08` §5.1의 근거를 그대로 유지한다.
- 백그라운드 통합/dreaming 패스. `research/08` §5.2.
- 네이티브 `memories.search` 재구현. `research/08` §5.4.
- `INDEX_SCHEMA_VERSION` 상향. 올리면 `index-db.ts:84-91`이 drop-and-rebuild를 하고, 그건 실측 12GB /
  1,214,276메시지 전량 재파싱이다. `CREATE TABLE IF NOT EXISTS`만 `SCHEMA` 상수에 추가한다.
- self-heal(마켓플레이스 설치 경로)에 table-key를 태우는 일. `healedKeys`가 현재 feature 키 전용
  어휘라 마커 스키마 확장이 필요하고(`config-guard/src/self-heal.ts:36-45`), 독립적으로 되돌릴 수
  있는 별도 변경이어야 한다.
- P3 계열 전부 — PABCD phase 인지 회수, 검색 힌트 추출, memory search 인덱스화, ad_hoc 역류.
- `memory_summary.md` 포화 대응(`research/08` Q1). 사용자 결정 사항으로 남아 있다.
- 릴리스, npm 배포, 태그, `main` 머지.

## Work-phase map

| WP | 제목 | 의존 | 주 컴포넌트 |
|---|---|---|---|
| wp0 | docs-first 로드맵 확정 | — | (문서) |
| wp1 | W2 승인 게이트 훅 + `dedicated_tools` 자동 활성화 | wp0 | pabcd-state, config-guard |
| wp2 | R1 토큰 경계 + R2 한국어 활용형/동의어 | wp0 | recall |
| wp3 | P1-1 프로젝트 스코핑 + R5 chat 자동 보완 | wp2 | recall |
| wp4 | P1-2 compaction 캡 + P1-3 2티어 밀도 + P1-4 신선도 라벨 | wp0 | recall |
| wp5 | P2-1 BM25/RRF 랭킹 + P2-3 hit-count 감점 | wp2, wp4 | recall |

wp5의 의존이 둘인 이유는 갈라져 있다. P2-1(`index-search.ts`)은 wp2/wp3/wp4 어느 파일도 안 건드려
실제로 독립이고, P2-3은 `recall/src/hook.ts`를 wp4와 공유하므로 wp4 뒤여야 한다. 로드맵
(`020_roadmap.md` §6)에서 이 둘을 별도 레이어로 쪼갠다.

## work-phase별 대상 파일과 검증 명령

### wp0 — docs-first 로드맵

대상: `devlog/_plan/260909_memory-upgrade-l0/000_plan.md`(이 문서), `020_roadmap.md`.

검증:

```
ls devlog/_plan/260909_memory-upgrade-l0/
rg -n 'wp[0-5]' devlog/_plan/260909_memory-upgrade-l0/020_roadmap.md | head
```

코드 변경이 없으므로 스위트를 돌리지 않는다.

### wp1 — W2 승인 게이트 훅 + dedicated_tools 자동 활성화

**A(게이트) → B(활성화) 순서가 필수다.** B의 정당화가 A의 존재에 의존하므로
(`010_survey_hooks_config.md` §4.2), 역순이면 논증이 성립하지 않는 기간이 생긴다. 되돌릴 때는
반대로 B를 먼저 되돌린다.

대상 파일 — A:

- `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts` (신규)
- `plugins/codexclaw/components/pabcd-state/src/state.ts` (플래그 1개)
- `plugins/codexclaw/components/pabcd-state/src/hook.ts` (프롬프트 의도 감지)
- `plugins/codexclaw/components/pabcd-state/src/cli.ts` (새 event-slug 분기)
- `plugins/codexclaw/hooks/pre-tool-use-guarding-memory-write.json` (신규)
- `plugins/codexclaw/.codex-plugin/plugin.json` (hooks 배열)
- `plugins/codexclaw/components/pabcd-state/test/memory-write-gate.test.ts` (신규)
- 개수 결합 6표면: `plugins/codexclaw/test/hook-e2e.test.mjs:132`, `README.md`/`README.ko.md`/
  `README.zh.md` 배지, `plugins/codexclaw/inventory.json`, `docs-site/src/content/docs/reference/hooks.md`
- `plugins/codexclaw/test/manifest-policy.test.mjs` (matcher 고정)
- 해당 `dist/*.js`

대상 파일 — B:

- `plugins/codexclaw/components/config-guard/src/managed-keys.ts`
- `plugins/codexclaw/components/config-guard/src/activate.ts`
- `plugins/codexclaw/components/config-guard/src/cli.ts`, `features.ts` (경계 주석 정정)
- `plugins/codexclaw/components/config-guard/test/activate.test.ts`
- `docs-site/src/content/docs/guides/*`, `reference/commands.md`

검증:

```
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/config-guard/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/hook-e2e.test.mjs"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/manifest-policy.test.mjs"
node plugins/codexclaw/scripts/inventory.mjs --check
npm run gate
```

B 페이즈 첫 항목은 **T2 실측**이다. matcher를 확정하기 전에 훅 stdin의 `tool_name`을 덤프해
`memoriesadd_ad_hoc_note` 추정을 확인하거나 반증한다. 절차는 `020_roadmap.md` §1.3.

### wp2 — R1 토큰 경계 + R2 한국어

대상: `components/recall/src/query-words.ts`(신규), `synonyms.ts`, `memory-search.ts`,
`chat-search.ts`, `cli.ts`, `test/query-words.test.ts`(신규), `test/synonyms.test.ts`,
`test/memory-search.test.ts`, `skills/recall/SKILL.md`.

검증:

```
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/recall/test/*.test.ts"
node plugins/codexclaw/components/recall/dist/cli.js memory search "LSP" --limit 5
node plugins/codexclaw/components/recall/dist/cli.js memory search "opencodex 릴리즈" --limit 5
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

실행 검증 두 줄은 읽기 전용이고 `~/.codex`를 건드리지 않는다.

### wp3 — P1-1 스코핑 + R5 chat 보완

대상: `components/recall/src/memory-search.ts`, `threads-db.ts`(호출), `cli.ts`, `format.ts`,
`test/memory-search.test.ts`, `skills/recall/SKILL.md`.

검증:

```
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/recall/test/*.test.ts"
node plugins/codexclaw/components/recall/dist/cli.js memory search "배포" --cwd "$PWD" --limit 5
node plugins/codexclaw/components/recall/dist/cli.js memory search "배포" --cwd-only "$PWD" --limit 5
```

`--cwd`는 부스트, `--cwd-only`는 하드 필터다. 히트 0일 때 빈 결과가 아닌지가 c-6의 핵심이고,
워크트리 cwd 분포가 각 1건씩 흩어져 있다는 실측(`011` §4.2)이 부스트를 기본으로 두는 근거다.

### wp4 — 훅 주입 (compaction 캡 · 2티어 밀도 · 신선도 라벨)

대상: `components/recall/src/hook.ts`, `cwd-context.ts`(신규), `cli.ts`,
`test/hook.test.ts`, `docs-site/src/content/docs/reference/hooks.md`.

검증:

```
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/recall/test/*.test.ts"
printf '%s' '{"hook_event_name":"SessionStart","source":"startup","cwd":"'"$PWD"'"}' \
  | node plugins/codexclaw/components/recall/dist/cli.js hook session-start | wc -c
printf '%s' '{"hook_event_name":"SessionStart","source":"compact","cwd":"'"$PWD"'"}' \
  | node plugins/codexclaw/components/recall/dist/cli.js hook session-start | wc -c
printf '%s' '{"hook_event_name":"PostCompact","cwd":"'"$PWD"'"}' \
  | node plugins/codexclaw/components/recall/dist/cli.js hook post-compact | wc -c
```

두 SessionStart의 바이트 비교가 c-8을 대체 검증하고, PostCompact가 0바이트를 내는지가 T1 수정의
확인이다. 반드시 `test/hook.test.ts:86-119`의 기존 안전 테스트 2개(CWD 격리, 델리미터 탈출)를
살린 채로 통과해야 한다.

### wp5 — P2-1 랭킹 + P2-3 감점

대상: `components/recall/src/index-search.ts`, `index-db.ts`, `cli.ts`, `hook.ts`,
`test/index-rank.test.ts`(신규), `test/hook.test.ts`.

검증:

```
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/recall/test/*.test.ts"
rg -n 'INDEX_SCHEMA_VERSION' plugins/codexclaw/components/recall/src/index-db.ts
git diff origin/dev -- plugins/codexclaw/components/recall/src/index-db.ts | rg 'INDEX_SCHEMA_VERSION'
node plugins/codexclaw/components/recall/dist/cli.js chat search "opencodex release" --limit 5 --no-refresh
```

세 번째 줄이 비어야 한다 — 스키마 버전 상수가 diff에 등장하면 12GB 재빌드를 유발한다.

## 성공 기준 대응

| id | 시나리오 요지 | 담당 | 검증 위치 |
|---|---|---|---|
| c-1 | wp0 로드맵 문서 확정, wp별 대상 파일·검증 명령 명시 | wp0 | 이 문서 §work-phase별 + `020_roadmap.md` |
| c-2 | W2 훅이 승인 없는 메모리 쓰기(파일 편집 + 툴)를 차단, 양쪽 케이스 테스트 고정 | wp1-A | `memory-write-gate.test.ts` |
| c-3 | `cxc enable`이 `dedicated_tools`를 켜고 `disable`/`unset`이 원복, 매니페스트 기록 | wp1-B | `config-guard/test/activate.test.ts` |
| c-4 | `memory search "LSP"`가 substring 오매칭을 반환하지 않음 | wp2 | `query-words.test.ts` + 실행 |
| c-5 | 한국어 활용형 질의가 정규화·동의어로 결과를 냄, 회귀 고정 | wp2 | `synonyms.test.ts` |
| c-6 | `--cwd` 부스트 / `--cwd-only` 하드 필터, 히트 0에서 빈 결과 아님 | wp3 | `memory-search.test.ts` |
| c-7 | memory 0건 시 chat 보완이 도구 로그를 제외하고 동작 | wp3 | `memory-search.test.ts` |
| c-8 | 압축 경로 주입 예산이 일반 경로보다 작고 복구 지시문 유지 | wp4 | `hook.test.ts` + 바이트 비교 |
| c-9 | 2티어 주입이 하드 예산을 안 넘고 히트 0이면 빈 문자열 | wp4 | `hook.test.ts` |
| c-10 | 신선도 라벨이 untrusted 델리미터와 별개 축으로 들어감 | wp4 | `hook.test.ts` |
| c-11 | chat search가 BM25+trigram RRF+recency를 쓰고 `msgs_fts`가 실제 쿼리됨 | wp5 | `index-rank.test.ts` |
| c-12 | hit-count 감점이 자동 주입에만 적용, 명시 검색은 결정론적 | wp5 | `hook.test.ts` |
| c-13 | 전 work-phase가 스택 PR로 올라가고 각 최종 head CI 통과 | 전체 | GitHub Actions `ci.yml` |
| c-14 | 임베딩·dreaming·네이티브 재구현 없음, `~/.codex`는 쓰기 대상 아님 | 전체 | 최종 diff 검토 |

두 기준은 문면을 고쳐 읽어야 한다.

**c-8 재해석.** 등록 문면은 "PostCompact 주입 예산이 SessionStart보다 작고"인데, T1에 따라 PostCompact
경로에는 주입 자체가 없다. 실제로 검증할 명제는 **SessionStart(`source=compact`)의 주입 바이트가
SessionStart(`source=startup`)보다 작다**이고, "복구 지시문 유지"는 PostCompact 핸들러가 아니라 압축
분기의 SessionStart 문구가 갖는다. 기준을 약화시키는 게 아니라, 원래 의도(압축으로 번 자리를 메모리가
도로 먹지 않게)를 실제로 도달하는 경로로 옮기는 것이다.

**c-2 범위.** 등록 문면이 "파일 편집 및 add_ad_hoc_note"를 둘 다 요구한다.
`010_survey_hooks_config.md`는 툴 경로만 다뤘고, 직접 파일 편집 차단은 승계 플랜
(`260829_memory-upgrade/020_improvement_plan.md` §W2 범위 한계)이 열거한 `apply_patch` / 셸 리다이렉션 /
`Write`·`Edit` / `sed -i` / `tee`가 대상이다. wp1-A는 두 표면을 한 훅 파일의 matcher 합집합으로 덮는다.
호스트 내부 phase2 writer는 훅 경로를 타지 않으므로 차단 대상이 아니고, 차단하면 파이프라인이 깨진다.

## 위험과 완화

| # | 위험 | 근거 | 완화 |
|---|---|---|---|
| R-1 | T2 추정이 틀리면 matcher가 안 맞아 게이트가 조용히 무효 | 문자열이 코드베이스에 리터럴로 없음 | B 페이즈 첫 항목으로 stdin 덤프 실측. 방어형 matcher `^memories[._]?add_ad_hoc_note$`. 게이트는 fail-open이라 오탐 대신 미탐 방향 |
| R-2 | wp1-B가 A보다 먼저 landing되면 정당화 공백 | `managed-keys.ts:20-24`의 판별식 | 브랜치 체인 base 강제(B의 base = A), 머지는 bottom→top, 되돌리기는 B 먼저 |
| R-3 | `INDEX_SCHEMA_VERSION` 상향 시 12GB 재빌드 | `index-db.ts:84-91` | `SCHEMA` 상수에 `CREATE TABLE IF NOT EXISTS`만 추가, 버전 문자열 고정. wp5 검증 명령에 diff 확인 포함 |
| R-4 | `memory-search.ts`가 R1·R2·P1-1·R5 공통 파일이라 최대 충돌원 | `011` §8.2 | 그 파일을 만지는 전부를 한 체인의 연속 레이어로 직렬화. 병렬 브랜치에 두지 않는다 |
| R-5 | `recall/src/hook.ts`를 wp4와 P2-3이 공유 | `012` §6, `011` §7.3 | P2-3을 wp4 위 레이어로. P2-1만 병렬 허용 |
| R-6 | 훅 개수 23→24 부분 갱신 시 CI 실패 | `hook-e2e.test.mjs:132`, `inventory.mjs:196-206`, `skill-catalog.test.mjs:65-71` | 6표면을 한 커밋에 동시 갱신. 배지는 수동 편집 대신 `sync-readme-badges.mjs --write` |
| R-7 | `dist/` 미커밋으로 freshness 실패 | `dist-freshness.test.mjs:29-53` | src를 고친 커밋에 dist를 같이 담는다 |
| R-8 | 어미 절단 과잉으로 정밀도 하락 | `011` §3.6 | 어간 최소 2자, 한글 음절 전용, 원문 제거 없이 추가만, `--no-synonyms` opt-out 유지 |
| R-9 | RRF 후보 K 확대 시 지연 회귀 | BM25 top20이 146ms(`011` §6.3), K=500 미측정 | K를 limit의 5~10배로 상한. 전후 p50 측정, 회귀 시 기본 정렬을 시간순으로 유지 |
| R-10 | 주입 밀도 상승으로 닫는 태그가 잘림 | `hook.ts:199-201`이 통짜 절단 | 줄 단위 누적 + 푸터 예약(약 120자)을 밀도 작업의 **선결 조건**으로 |
| R-11 | `memory-search` ↔ `chat-search` 순환 import | `memory-search.ts:15` | `query-words.ts` 분리 + `RecallContextDeps` 스타일 의존성 주입 |
| R-12 | 써드파티 의존 유입 | `scripts/build.mjs:5-8` 계약 | RRF/BM25를 순수 SQL + JS로만. 테스트는 `node:test` + `node:assert/strict` |
| R-13 | `origin/dev`가 정찰 이후 전진 | `6e97e73d` → `0cacdc8d` | wp1 착수 시 재-베이스라인, 각 PR은 최종 head CI로 증명 |

## 승계 관계

`260829_memory-upgrade/020_improvement_plan.md`의 항목별 처리:

| 승계 항목 | 이번 사이클 |
|---|---|
| R1 토큰 경계 | wp2에서 구현 |
| R2 한국어 정규화 + 동의어 | wp2에서 구현 |
| R5 chat 자동 보완 | wp3에서 구현 |
| W2 승인 게이트 훅 | wp1-A에서 구현. 차단 도구 열거를 c-2 범위대로 유지 |
| §0.1 `dedicated_tools` | wp1-B에서 구현. "W2 배포 완료"라는 진입 조건을 브랜치 순서로 강제 |
| R3 지시어 해소 | 이번 범위 밖 |
| R4 memory FTS 사이드카 | 착수 조건(200ms 초과) 미충족. 범위 밖 |
| S1/S1b/S2/S3 저장 구조 | 범위 밖 |
| D1 `cxc memory doctor` | 범위 밖 |
| W1 git 이력 | 이미 철회됨 |
| W3 후보 제안기 | 범위 밖 |
| §0.4 정책 선택 | 사용자 결정 미완. `generate_memories`는 건드리지 않는다 |

