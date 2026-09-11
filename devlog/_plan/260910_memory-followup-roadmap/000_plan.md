# 000 — memory-followup: 진단과 로드맵

날짜: 2026-09-10 (KST). 워크트리 `/Users/jun/.codex/worktrees/3412/codexclaw`, HEAD = `origin/dev` `369ed0e1` (detached).
이 문서는 진단(§결론~§근거 노트, 2026-09-10 오전 작성)과 그 위에 세운 L1 사이클 계획(§L1 계획, 같은 날 오후 추가)이다. 근거는 `notes/01~08`이고, 각 노트는 xai/grok-4.6 서브에이전트 7개와 Aside exec 1개가 읽기 전용으로 독립 조사한 결과다. 웹 조사는 `001_web-survey.md`, 각 work-phase의 diff-level 설계는 `010~060`이다.

## 독자 요약

문제: 2026-09-09 L0 사이클(#100~#108) 뒤 "메모리 상태 점검" 평가가 검색 품질·주입·게이트 문제를 보고했고, 무엇이 L0 탓인지 불분명했다. 답: L0가 만든 회귀는 게이트 오탐(#102)과 버전 문자열 경계(#105) 두 건이고, 자연어 0건·요약 포화·Aside·위키 문제는 원래 있던 한계다. 이 유닛은 그 두 회귀를 고치고, 스킬을 실제 CLI에 맞추며, 관리형 워크트리를 같은 프로젝트로 묶고, 자연어 질의를 완화하고, 웹 사례가 권하는 네이티브 훅 통합(source별 브리핑, 표적 회수 제안, 신선도 라벨, 훅 출력 형식 고정)을 추가한다. 바뀌는 대상은 codexclaw 사용자(에이전트가 과거 작업을 더 잘 찾고, 읽기 명령이 게이트에 막히지 않음)이며 ~/.codex와 Codex 업스트림은 건드리지 않는다.

## L1 계획 (loop-spec)

| 필드 | 내용 |
|---|---|
| Loop archetype | satisfy-spec. 등록 기준 c-1~c-8(goalplan `codexclaw-l1-memory-followup-2026-09-10-devlog-p`)을 충족하면 끝. 최적화 루프 아님 |
| Trigger | 사용자 요청 2026-09-10: 웹 사례·오픈소스를 참고해 네이티브 통합 보강안을 문서화(PABCD)하고, 여러 PABCD로 보강 PR을 스택으로 올려 머지까지 |
| Goal | dev에 PR 7개(문서 1 + 구현 6)가 순서대로 머지되고, 설치본에서 게이트 오탐·심볼 경계·스킬 불일치·워크트리 스코핑·자연어 0건이 해소됨 |
| Non-goals | ~/.codex 및 메모리 저장소 편집, codex-rs 수정, Aside 엔진, kim_wiki, 임베딩·dreaming·백그라운드 워커, 네이티브 memories 검색 재구현, 릴리스/npm, main 승격, 승인 없는 ad-hoc 노트 |
| Verifier | 컴포넌트 단위 테스트를 레포 러너로: `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/<comp>/test/*.test.ts"`(recall, pabcd-state, cxc-ops; 러너가 CODEXCLAW_HOME을 임시로 덮어 실인덱스 오염을 막음 — 직접 `node --test`는 chat-fallback 테스트가 실인덱스를 읽어 거짓 실패), `dist-freshness.test.mjs`, 골든셋 명령(§골든셋), 각 PR 최종 head의 원격 CI 전건, `git merge-base --is-ancestor <head> origin/dev`. 조건부 경로의 활성화 시나리오는 각 decade 문서 §테스트 계획이 명시 |
| Stop condition | c-1~c-8 전부 capturedEvidence로 met, 모든 PR 머지. 또는 BLOCKED(원격 권한·CI 인프라 3회 연속)/NEEDS_HUMAN(인덱스 재ingest 결정, wp7 선택)/BUDGET_EXHAUSTED |
| Memory artifact | 이 유닛(`devlog/_plan/260910_memory-followup-roadmap/`): 000 진단·계획, 001 웹 조사, 010~060 decade, 07x receipt, notes/ 근거. goalplan ledger `.codexclaw/goalplans/.../ledger.jsonl` |
| Expected terminal outcomes | DONE = 위 stop condition. 부분 머지 상태로 예산이 끝나면 머지된 PR/미머지 PR을 구분해 보고하고 goal은 열어둔다 |
| Escalation condition | 게이트 수정이 진짜 쓰기 차단을 약화하면 중단(UNSAFE). 스키마 변경이 12GB 재ingest를 요구하면 사용자 결정. 서브에이전트 2개가 같은 슬라이스에 실패하면 메인이 회수(DISPATCH-RETIRE-01); 워커에 슬라이스를 미는 건 P 수정으로만 |
| 자원 한도 | 사용자가 별도 토큰/시간 한도를 정하지 않음. 도구 범위: 이 워크트리 쓰기, gh(PR 생성·머지), 서브에이전트(grok-4.6, opus 허용), 웹 조사. 자격증명 추가 없음 |

### 아키텍트 상담 (미충족 기록)

phase-plan.md는 P에서 `agent_type: "architect"` 서브에이전트 상담을 요구한다. 이 세션의 spawn 스키마에는 `agent_type` 필드가 없어(도구 선언 확인, 2026-09-10) 계약대로 파견할 수 없고, 규칙상 explorer/reviewer로 대체하지 않는다. 상담 공백으로 기록한다. 대신 각 decade 문서는 독립 조사 에이전트가 소스를 직접 읽고 썼고, A 단계에서 독립 리뷰어가 감사한다.

### work-phase 맵과 decade 문서

| wp | decade 문서 | 의존 | 산출 PR |
|---|---|---|---|
| wp0 | 000, 001, 010~060 (문서만) | — | PR-0 docs |
| wp1 | 010_wp1_memory-write-gate.md | wp0 | PR-1 |
| wp2 | 020_wp2_symbol-boundary.md | wp0 | PR-2 |
| wp3 | 030_wp3_recall-skill.md | wp1, wp2 | PR-3 |
| wp4 | 040_wp4_project-identity.md | wp3 | PR-4 |
| wp5 | 050_wp5_natural-language-query.md | wp2 | PR-5 |
| wp6 | 060_wp6_native-integration.md | wp0 | PR-6 |

각 후속 사이클의 P는 자기 decade 문서를 현재 트리와 대조(stale check)한 뒤 수정하고 실행한다. 순서는 의존 구조(PHASE-SPLIT-01)이지 난이도가 아니다: wp1·wp2는 독립 기반, wp3는 둘의 결과 문구를 담고, wp4는 wp3의 워크트리 안내를 갱신하며, wp5는 wp2의 query-words 위에 선다.

### PR 스택 결정 (DEV-STACK-01)

스택한다. 부분들이 의존 순서를 가지며(위 표) 한 PR로 묶으면 recall 컴포넌트 전체를 한 번에 리뷰해야 한다. 이 레포는 `enforce-pr-target`이 모든 PR base를 dev로 강제하므로 GitHub dependent base를 쓸 수 없다. 이전 사이클(#100~#108)과 같이 로컬 브랜치 체인(`codex/memory-l1-wpN-*`, 각 브랜치는 부모 브랜치 위) + 전 PR dev 타깃 + 본문 스택 표 + 머지 순서로 대체한다. 부모가 머지되면 자식을 `origin/dev` 위로 리베이스하고 `--force-with-lease`로 갱신한다. 네이티브 스택은 사용자가 요청하지 않았으므로 쓰지 않는다(DEV-STACK-OPT-IN-01). 머지는 사용자가 이 세션에서 명시 허용했다.

### A 감사 기록 (wp0)

round 1 (2026-09-10, 독립 리뷰어 opus-5, `cxc-dev-code-reviewer`·`cxc-search` 첨부): GO-WITH-FIXES, blocker 5. (1) 010 제안 파서가 공백 없는 리다이렉션 `>`/`>>`/`>|`를 놓침 → 규칙 수정·픽스처·bypass 표에 접음, 파서를 별도 모듈로 분리. (2) 060 `dedicated_tools` 분기가 `CODEX_HOME` unset 환경에서 도달 불가 → `paths.ts codexHome()` 사용. (3) 050 recent 경로·top-up 스윕에 술어 부재로 index/scan 동등성 붕괴 → `planMatches`를 세 지점에 적용, 동등성 테스트 확장. (4) 060 doctor WARN 강등에 PLAN-BYPASS-NAMED-01 5필드 부재 → 표 추가. (5) 030↔040 "Until wp4" 문단 계약 불일치 → 040 IN에 편입. Medium 5건(B4 wp6 기술 불일치, B5 정정 블록 위치, B6 구버전 CLI INSERT OR REPLACE 공존, B7 S2 stderr/exit 3, B8 파일 크기)도 각 문서 "A 감사 반영" 절에 접었다. 리뷰어는 검증 명령 4종을 직접 실행해 전부 exit 0을 확인했고, 골든 기준선(`2.49.0 SLSA` hits 2, 시놉시스 대조 exit 2)을 재현했다. 재감사는 같은 리뷰어에게 보낸다.


round 2 (같은 리뷰어): GO-WITH-FIXES, blocker 1 — "반영이 부록에만 있고 B가 복붙할 본문(§4 코드·§3 파일 맵·§5 픽스처·§8 bypass)은 round 1 그대로". 본문을 직접 치환했다: 010 §4.1 경계 요구 제거 + `>|` 보호 코드, §3 파서 모듈 분리 4행, §5 픽스처 3행, §8 9번 항목(잔여 `echo hi -> P` 포함); 060 §4.1 `codexHome()` + import, §4.4 `assertLegalHookResult({stdout,stderr,code})`, PR 표 C3; 050 §4.4 세 지점 술어 + recent fetch 크기; 040 §1 OUT 한정 + §3 SKILL.md 행; 000 의존 블록 wp6 재기술. Low(`<prose>` 설명, "정규식" 표현)는 010 §4.1 주석에서 따옴표 제외로 설명을 바꿔 닫았다.

---

# 진단 (2026-09-10 오전)

## 결론

"메모리 상태 점검" 태스크가 보고한 문제 대부분은 L0 작업(#100~#108)이 만든 것이 아니다. 자연어 질의 0건은 머지 전 `0cacdc8d`에서도 같은 규칙(공백 토큰·최대 8단어·AND)으로 0건이고(`notes/01` §자연어), 주입 요약 포화·과거 지시의 선호 일반화·중복은 Codex 네이티브 통합 파이프라인의 동작이며(`notes/02`), Aside 무관 후보와 위키 대표 문서 편중은 각각 다른 저장소의 엔진 문제다(`notes/06`, `notes/07`).

L0가 실제로 만든 회귀는 두 건이다. #102 memory-write gate가 읽기 전용 `sed`와, 실제 쓰기 대상이 메모리 밖인데 명령 본문에 메모리 경로 문자열이 있는 명령을 쓰기로 분류한다(`memory-write-gate.ts:163-169, 211-212`; 이 세션에서 devlog heredoc이 차단된 것이 재현 사례). #105 심볼 경계 매칭이 `2.49.0`을 FILENAME 심볼로 보고 MEMORY.md의 `v2.49.0` 청크를 놓치며, 완화 재시도는 전체 0건일 때만 열려 조용히 탈락한다(`query-words.ts:55-72, 84-90`, `memory-search.ts:466-467`).

L0가 개선한 것도 실측됐다. chat 검색 순위(#103)와 memory→chat 폴백(#108)은 머지 전보다 정답을 위로 올린다(`notes/01` §개선). 되돌릴 이유는 없다.

설계 공백 한 건이 새로 드러났다. #108의 `--cwd` 스코핑은 경로 접두사라 관리형 워크트리(전체 세션의 23.5%, opencodex는 43.6%)가 메인 체크아웃과 다른 프로젝트로 취급된다. 이 세션 cwd에서 `--cwd-only`는 0건이다. `session_meta.git.repository_url`은 jsonl에 이미 있고(샘플 119/120) `threads.git_origin_url`도 86.5% 채워져 있는데 ingest가 버린다(`notes/05`).

## 기준선

| 항목 | 값 |
|---|---|
| 설치 캐시 | `~/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619` — 버전 문자열은 09-08 스탬프지만 내용은 09-10 06:23 재설치본(#108 `normalizeCwd` 포함) |
| 설정 | `[memories] generate_memories=true use_memories=true dedicated_tools=true`, `plugin_hooks=true` |
| Codex 런타임 | Desktop 0.153.4. 로컬 소스는 `rust-v0.153.0` 이후 memories v2 커밋이 있으나 사용자 config는 V1 경로 (`notes/02`) |
| recall 인덱스 | 13,194 files / 1,226,523 msgs, schema 2, 12.1GB, last ingest 09-10 06:12 KST |
| 네이티브 요약 | `memory_summary.md` 9,245B ≈ 2,312/2,500 토큰(92.5%), `rollout_summaries` 256개 = 선택 상한 |
| 훅 | recall/게이트 훅 5개 등록·실행됨. config `trusted_hash`와 현재 JSON sha256은 5개 모두 불일치이나 실행은 된다 (`notes/03` §1) |

## 진단표

| 증상 | 층 | 판정 | 근거 |
|---|---|---|---|
| 자연어 문장 질의 chat/memory 0건 | cxc 검색 | 원래 한계. 260829 계획이 이미 같은 실패를 적음 | notes/01 §자연어, notes/04 §2, notes/08 E1 |
| `2.49.0 SLSA`가 MEMORY.md 청크를 놓침 | cxc 검색 | **#105 회귀** | notes/01 §회귀 1건 |
| 읽기 `sed` / 본문 경로 문자열 heredoc / `2>/dev/null`이 게이트에 차단 | cxc 훅 | **#102 회귀** | notes/03 §3, notes/08 E6·E7, 이 세션 재현 |
| 관리형 워크트리에서 `--cwd-only` 0건, SessionStart cwd 블록 없음 | cxc 검색·훅 | #108 설계 공백(회귀 아님) | notes/05, notes/03 §2 |
| chat 상위 결과가 요청/시작 메시지라 완료 여부 불명 | cxc 검색·스킬 | 원래 한계. 스킬에 검증 규칙 없음 | notes/04 §4 |
| `2.49.0 provenance` 1위가 2.48 세션 | cxc 검색·스킬 | 원래 한계(S1 낡음 표기 미착수) | notes/08 E4 |
| 요약 포화 92.5%, 세션 지시 승격, 중복, 타 프로젝트 이력 | Codex 네이티브 | 회귀 아님. 설정 키 없음(2,500은 const, cwd 비필터) | notes/02 §표 |
| `private devlog stays separate`가 현행 AGENTS.md와 충돌 | Codex 네이티브 + 사용자 관행 | 회귀 아님. ad-hoc 정정 노트로 완화 가능(승인 필요) | notes/02 §증상표 |
| Aside가 없는 문자열에 0.53~0.68로 10건, 한국어 고유명사 미스, 이웃 청크 중복 | Aside 엔진 | 회귀 아님. 컷오프·exact 채널·dedupe 부재 | notes/06 |
| 위키 entries가 상세 문서를 못 봄, raw가 흔한 단어에 밀림 | kim_wiki 스크립트 | 회귀 아님 | notes/07 |
| PostCompact 훅 Failed | cxc 훅 | L0가 고친 옛 회귀. 현재 빈 stdout, cutoff 이후 Failed 기록 없음 | notes/03 §로드맵 |
| 스킬 문서가 "빈 결과는 없다", 양 엔진 trigram, 동일 JSON 스키마를 주장 | cxc 스킬 | L0와 같이 온 문서 과대 주장 | notes/04 §1 (14항목 대조표) |

## 로드맵

work-phase마다 하나의 PABCD 사이클이다. 등급은 cxc-dev 분류. 전부 `dev` 타깃 PR이고 스택은 이전 사이클과 같이 로컬 브랜치 체인 + 머지 순서로 대체한다(이 레포의 enforce-pr-target 때문).

### wp1 — P0 · memory-write gate 오탐 (C2)

목적지 기준으로 셸 분류를 다시 짠다. 리다이렉션(`>`, `>>`, `tee`)과 `sed -i`처럼 실제로 파일을 쓰는 형태만 쓰기로 보고, 본문에 메모리 경로 문자열이 있어도 목적지가 메모리 밖이면 통과시킨다. `2>/dev/null` 같은 stderr 리다이렉션은 목적지 판정에서 제외한다.

- 대상: `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts` (163-169 토큰 수집, 211-212 sed/꺾쇠 규칙), `test/memory-write-gate.test.ts:174` 이후.
- 회귀 픽스처: (1) `sed -n '1p' <memories>/MEMORY.md` 허용 (2) 본문에만 메모리 경로가 있고 목적지가 devlog인 heredoc 허용 (3) `cat x 2>/dev/null` 허용 (4) `sed -i`·`>` 목적지가 메모리면 계속 거부 (5) `memories.add_ad_hoc_note` 툴 거부 유지(c-2).
- 검증: 유닛 테스트 + 설치본 `node <cache>/components/pabcd-state/dist/cli.js hook pre-tool-use-memory-write`에 stdin 픽스처를 넣어 allow/deny. 라이브는 이 세션의 차단 명령이 통과해야 한다.
- 문서: `docs-site/.../reference/hooks.md`의 게이트 설명 갱신.

### wp2 — P0 · #105 심볼 경계 회귀 (C2)

버전 문자열(`\d+\.\d+(\.\d+)?`)을 FILENAME으로 분류하지 않거나, 경계 판정에서 `v` 접두를 허용한다. 완화 재시도를 "전체 0건"에서 "그룹 단위 미스"로 넓혀 MEMORY.md처럼 한 소스만 조용히 빠지는 경우를 없앤다.

- 대상: `components/recall/src/query-words.ts` (FILENAME/`isSymbolWord`, 경계 판정), `memory-search.ts:461-471` (relax 조건), `test/query-words.test.ts`, `test/ranking.test.ts`.
- 검증: `memory search "2.49.0 SLSA" --limit 5 --no-chat --no-refresh`가 MEMORY.md 청크를 복구하고 memory_summary.md 히트를 유지. `memory search "LSP"`가 `NaiControlsPanel`을 계속 배제(c-4 유지).

### wp3 — P0 · cxc-recall 스킬 재작성 + docs-site 잔여 (C1 문서)

스킬을 실제 CLI에 맞추고, 자연어 질의를 다루는 절차를 넣는다. 코드 변경 없이 가장 큰 효과가 나는 자리다(`notes/04` 결론).

- 정확성 수정 14항목(`notes/04` §1 표): `--rank`·`--home`·`--json` 시놉시스, memory `--days` 기본 0, memory/chat JSON 스키마 분리, "빈 결과는 없다" 삭제, trigram은 chat만, `--no-refresh` 없으면 사이드카 ingest가 일어난다는 사실, 최대 8단어·불용어 없음 명시, `--any`는 긴 문장에 쓰지 말 것.
- 자연어→키워드 사다리: 고유명사·버전·파일명 추출 → 한/영 동의어 2~3개 → 2~3단어 질의 여러 번 → 병합. 평가 followups(`source dogfooding`, `plugin restart`, `2.49.0 provenance`)가 이미 이 경로로 복구된 증거다.
- 결과 검증 규칙: 요청/시작 메시지와 완료 답변 구분, 버전 문자열 일치 ≠ 해당 릴리스 증거, 정정 이력(나중 메모리가 앞선 것을 뒤집는지) 확인, `rollout_path`로 원문 열기.
- 상황별 안내: 서브에이전트 `--source`, 관리형 워크트리에서 `--cwd`(부스트) vs `--cwd-only`(현재 0건 위험, wp4 전까지 메인 체크아웃 경로를 넘길 것), 네이티브 `memories.search`(요약·MEMORY.md·ad-hoc)와 cxc(원문 대화·rollout_summaries·cwd 스코프)의 분담.
- 외부 레인 계약: Aside `aside memory search --json`은 top score < 0.72면 의미 검색 실패로 보고 `rg --fixed-strings`로 고유명사를 복구, path 단위 dedupe(`notes/06`). 위키 `ask.py "<q>"`는 entries/raw/nodes 점수를 합산하지 않고 entries 0건이면 nodes/raw가 가리킨 상세 문서를 `rg`로 연다(`notes/07`).
- 네이티브 주입 한계 명시: 요약은 cwd 비필터, User preferences는 세션 인용 승격이라 현재 태스크 권한과 다를 수 있음, 라이브 AGENTS.md가 우선(`notes/02` P1).
- docs-site: `how-it-works.md` PreToolUse x7 + memory-write, PostCompact silent, `commands.md`에 `allow-write`·`--rank`·`dedicated_tools` (`notes/08` §5.2).
- 검증: 시놉시스와 `cli.ts` USAGE 대조, 평가 원문 3건이 사다리대로 재작성했을 때 0건이 아닌지, 설치 캐시 재설치 후 스킬 바이트 동일.

### wp4 — P1 · 프로젝트 정체성 키 (C3)

cwd 접두사에 git 원격 URL을 더한다. `--cwd <worktree>`가 같은 `repository_url`의 메인 체크아웃 히트를 포함하고, 훅 cwd-context도 같은 키로 묶는다.

- 대상: `rollout.ts` `readRolloutMeta`(`payload.git.repository_url` 파싱), `ingest.ts` INSERT, `index-db.ts` 컬럼 추가(스키마 버전 정책 결정 필요), `index-search.ts` WHERE, `threads-db.ts`(`git_origin_url` SELECT), `memory-search.ts` `scopeAdjust`/`buildCwdScope`, `cwd-context.ts:84-92`(exact cwd 조인), `test/cwd-scope.test.ts`.
- URL 정규화: `.git` 제거, host 소문자, ssh↔https 동치. origin 결측은 cwd 접두사 fallback. repo basename 단독 키는 쓰지 않는다(충돌). macOS 경로 대소문자(`/Users/jun/developer` 435 files)는 `cwdMatches`에 볼륨 정책 또는 저장 시 canonicalize.
- 검증: 이 세션 cwd로 `--cwd-only`가 0건에서 codexclaw 메인 체크아웃 요약을 포함하고 cli-jaw/opencodex origin은 제외. 신규 슬롯 SessionStart에 `[cxc-recall] Recent work`가 같은 레포의 이전 세션을 포함.

### wp5 — P1 · 자연어 질의 완화 (C3)

골든셋을 먼저 고정하고 코드를 바꾼다. 평가 cases.json의 D3/P2/R2와 followups 7건, 260829가 적은 활용형·지시어 질의를 `test/fixtures`로.

- 후보 동작: (1) chat 경로에도 memory의 한국어 어간·조사 분리를 옵션(`--synonyms`, 기본 off)으로, (2) 8단어 캡을 넘는 문장은 잘라내지 말고 고유명사·심볼을 필수어(AND)로, 나머지를 OR로, (3) 불용어 실험 — `그`/`문제`류를 빼되 `CI` 같은 2자 심볼과 충돌하지 않는지 테스트, (4) 동의어 시드에 도그푸딩/재시작/검증/배포 계열 추가.
- 대상: `query-words.ts`, `chat-search.ts`, `index-search.ts`, `memory-search.ts`, `synonyms.ts`, `cli.ts`, `test/synonyms.test.ts`, `test/index.test.ts`(index/scan 동등성 유지).
- 검증: 골든셋에서 원문 3건이 n>0, 기존 c-4/c-5 유지, `--no-synonyms` 회귀 없음, K=500 지연 전후 비교.

### wp6 — P1 · 네이티브 통합 보강 + 관측 (C3)

웹 조사(001 §3)가 확정한 네 항목을 구현한다(설계: 060). SessionStart 브리핑을 `source`(startup/resume/compact)별로 나누고 끝에 회수 안내 한 줄(`dedicated_tools`가 켜져 있으면 `memories.search`, 아니면 `cxc memory search`), UserPromptSubmit에서 고유명사·파일명·버전·오류 문자열을 뽑아 표적 회수 제안(검색은 실행하지 않음, 훅 지연 유지), memory search 텍스트 출력에 `[age: Nd]`·`[newer: <relpath>]` 라벨(랭킹 불변), 훅 출력 형식 회귀 테스트(stdout·stderr·exit code)와 `cxc doctor`의 trusted_hash drift WARN. 대상: `recall/src/hook.ts`, `format.ts`, `cxc-ops/src/doctor.ts`, `hook-trust.ts` + 테스트 + dist.

같은 사이클의 C에서 아래 미증 항목을 실측해 receipt에 붙인다(코드 변경 없음, 060 §10). 실측이 설계를 뒤집으면 P 수정으로 처리한다.

- compaction 후 SessionStart `source=compact` 재점화가 세션마다 다른 이유(`01a08643`에는 있고 `01a08663`에는 없음).
- 훅 `--no-refresh`와 신규 워크트리 주입 0건의 관계, `--cwd-only` 0건 지연 2.7초.
- `dedicated_tools` 켠 뒤 모델이 `memories.search`를 실제로 부르는 빈도(rollout에서 tool call 집계).
- `msgs_fts` 바이트, `rollout_summaries` 256 상한의 영향.

### wp7 — P2 · 네이티브 주입 포화 대응 (결정 선행)

codexclaw 코드로는 못 줄이는 자리다. 선택지를 사용자에게 올리고 결정 후 착수한다.

- (a) 방치 + 스킬에 한계 명시(wp3에 포함, 추가 비용 0).
- (b) ad-hoc 정정 노트로 구식 사실(private devlog 분리 규칙 폐기 등)을 덮어쓰기 — 사용자의 "기억해둬" 승인이 있어야 쓴다. 통합 모델이 노트를 무시할 수 있다.
- (c) 업스트림 제안(`ext/memories/src/prompts.rs`, `consolidation.md`, `config/src/types.rs`): 주입 토큰 상한 키, `What's in Memory`를 현재 프로젝트 패밀리로 제한, 선호에 applies_to/유효기간, 라이브 AGENTS.md와 충돌 시 폐기. 0.153.4 vs HEAD v2 차이를 먼저 확인.
- (d) `use_memories=false`로 전체 off — 네이티브 도구 지침까지 잃으므로 긴급 우회 외에는 비권장.

### 별도 트랙 (이 레포 밖)

- Aside 엔진: minScore 컷오프(0.72 재측정), exact/lexical 채널, path dedupe, 도구 `memory_search`에 score 노출, 청크 보폭, L1 캡 강제, dreaming deleted 경로 (`notes/06`).
- kim_wiki: `wiki_lookup.py` 후보를 상세 문서까지 확장, lexicon 생성 (`notes/07`).

## 순서와 의존

```
wp1 (게이트)          독립
wp2 (심볼 경계)       독립
wp3 (스킬·docs)       wp1·wp2 머지 후 문구 확정, wp4 전까지 --cwd-only 주의 문구 유지
wp4 (정체성 키)       wp3 뒤 (스킬의 워크트리 안내를 갱신)
wp5 (자연어)          wp2 뒤 (query-words 공유), 골든셋 선행
wp6 (네이티브 통합)   wp0 뒤, wp1~wp5 코드와 독립 (hook.ts·format.ts·doctor.ts)
wp7 (네이티브)        사용자 결정 뒤
```

wp1·wp2·wp3가 P0이고 각각 하루 안에 끝나는 크기다. wp4·wp5는 스키마와 골든셋이 걸려 있어 A(감사) 단계에서 범위를 다시 자른다.

## 골든셋 (회귀 기준 명령)

`BIN=/Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619/bin/cxc.mjs`. 인덱스를 건드리지 않으려면 chat과 폴백에 `--no-refresh`.

```bash
# wp2 회귀: 설치본 2건 → 목표 3건 이상(MEMORY.md 복구)
node "$BIN" memory search "2.49.0 SLSA" --days 0 --limit 5 --json --no-chat --no-refresh
# c-4 유지
node "$BIN" memory search "LSP" --limit 5 --json --no-chat --no-refresh
# wp5 목표 (현재 양쪽 0)
node "$BIN" chat search "지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법" --days 0 --limit 3 --json --no-tools --no-refresh
node "$BIN" memory search "코덱스를 재시작하면 플러그인이 사라지는 문제" --days 0 --limit 3 --json --no-chat --no-refresh
node "$BIN" chat search "2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록" --days 0 --limit 3 --json --no-tools --no-refresh
# 개선 유지 (1위가 도그푸딩 제목 스레드)
node "$BIN" chat search "도그푸딩" --days 0 --limit 3 --json --context 0 --no-tools --no-refresh
# wp4 목표 (현재 0건)
node "$BIN" memory search "메모리" --cwd-only /Users/jun/.codex/worktrees/3412/codexclaw --no-refresh --json
```

wp1 게이트 픽스처는 `notes/03` §3 표의 명령을 그대로 쓴다(메모리 경로를 셸 본문에 넣는 명령이므로 테스트는 stdin JSON 픽스처로).

## 결정이 필요한 것

1. wp7 선택지 (a)~(d). (b)는 사용자의 명시적 "기억해둬"가 있어야 한다.
2. wp4 인덱스 스키마: 컬럼 추가를 버전 범프 없이 할지(기존 인덱스 12.1GB 재ingest 비용) — `notes/05` P0는 범프 없는 추가를 제안.
3. wp5 chat 동의어 기본값(off 유지 권장)과 불용어 도입 여부.
4. 스킬 외부 레인(Aside 0.72 컷, 위키 ask.py)을 codexclaw 공개 스킬에 넣을지, 개인 스킬(`~/.codex/skills`)로 둘지. 경로가 사용자 홈 고유라 공개 스킬에는 "있으면 쓰는" 조건부 문구가 맞다.

## 하지 않을 것 (이전 사이클 폐기 유지)

임베딩 도입(Aside 재현이 다시 반례), dreaming, 네이티브 memories 검색 재구현, 크로스홈 federation, `~/.codex/memories` 직접 편집(다음 Phase 2가 되돌린다), 승인 없는 ad-hoc 노트 쓰기.

## 근거 노트

| 파일 | 레인 | 조사 주체 |
|---|---|---|
| notes/00_brief.md | 공용 브리프 | 메인 |
| notes/01_regression-attribution.md | 머지 전/후 25케이스 재실행 | grok-4.6 |
| notes/02_native-injection-audit.md | Codex 네이티브 요약·주입·설정 | grok-4.6 |
| notes/03_hook-runtime-audit.md | 훅 등록·rollout 실측·게이트 오탐 원인 | grok-4.6 |
| notes/04_recall-skill-and-nl-gap.md | 스킬 대조 14항목·자연어 재현·타 하네스 비교 | grok-4.6 |
| notes/05_project-identity-scoping.md | cwd 분포·워크트리 비율·정체성 키 설계 | grok-4.6 |
| notes/06_aside-memory-audit.md | Aside 엔진 (축약본) | Aside exec |
| notes/07_wiki-lookup-gap.md | kim_wiki 스크립트 (축약본) | grok-4.6 |
| notes/08_carryover-backlog.md | 260829/260909 이월 항목 상태표·docs-site 대조 | grok-4.6 |

06·07의 원본은 사용자 페이지명·거래처 워크스페이스·Slack ID·호스트명·개인 이력을 담고 있어 DEV-PRIVACY-01에 따라 체크아웃 밖 `tmp/memory-followup-260910/notes/*.full.md`(메인 체크아웃, 미추적)에 두었다. 조사 중 만든 머지 전 공유 클론은 `/tmp/mfu-260910/premerge`이며 원본 레포는 읽기만 했다.
