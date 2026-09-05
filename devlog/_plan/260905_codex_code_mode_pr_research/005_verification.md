# 조사 근거와 검증 기록

## 조사 방법과 범위

- 조사일: 2026-09-05. `date -u` 관측값: `2026-09-05T06:12:40Z`.
- GitHub 원본 PR 33개: MERGED 27, OPEN 6. PR별 본문, 상태, 날짜, merge commit, 변경 파일 목록을 읽었다.
- PR 원문과 source를 함께 읽었다. 리뷰 댓글·CI 로그·release 포함 관계까지 전수 조사한 것은 아니다.
- 주요 검색어: `code mode`, `code-mode`, `code_mode`, `js_repl`, `node repl`, `node_repl`, `cua_repl`, `tool_search`.
- 공식 upstream source 및 GitHub PR이 주 근거다. 같은 저장소의 소스와 PR은 독립적인 두 기관의 검증이 아니다.

## 조회 경로와 실패 처리

1. hosted web search로 PR·issue 후보를 찾았다. 검색 snippet만으로 사실을 채택하지 않았다.
2. 로컬 `git log`의 기능 관련 commit에서 PR 번호를 추출했다.
3. `agbrowse` HTTP proof를 먼저 시도했다. `https://github.com/openai/codex/pull/40257`을 넣었지만 `finalUrl`은 `https://api.github.com/repos/openai/codex`였다. 결과가 `strong_ok`여도 PR 본문이 아니므로 PR 증거로 인정하지 않았다.
4. GitHub 전용 CLI/API로 정확한 PR을 조회했다. 이 경로에서 실제 본문·상태·merge SHA를 확인했다.
5. title search는 알고 있는 과거 PR도 누락했다. 검색 결과 수를 전체 모집단 크기로 쓰지 않았다. 최근 갱신된 OPEN PR 첫 100개를 REST API로 별도 읽고 관련 6개를 정독했다. 전체 OPEN PR 전수 조사는 아니다.
6. 로컬과 main의 compare API를 읽어 12커밋 차이를 확인했다. 그중 비동기 질문 PR 2개를 추가 조회했다.
7. OPEN 스택과 현재 소스의 모순을 발견해 `app/installed`의 별도 병합 PR #33843을 추가 확인했다.

재현용 읽기 명령:

```sh
gh pr view 40257 --repo openai/codex --json number,title,state,createdAt,mergedAt,closedAt,updatedAt,url,body,mergeCommit,baseRefName,headRefName,files
gh api 'repos/openai/codex/pulls?state=open&sort=updated&direction=desc&per_page=100'
gh api 'repos/openai/codex/compare/d2d5b70241fb448044c1c088a977cc720d70443a...ddf04ad26789d040f9ef6a96736f76602e35a6cc'
gh api repos/openai/codex/releases/latest
codex --version
codex features list
```

API의 `latest`·OPEN 상태는 시간이 지나면 달라진다. 이번 관측값은 [source ledger](004_source_ledger.json)가 기준이다.

## 확인된 코드 앵커

로컬 루트: `/Users/jun/Developer/codex/121_openai-codex`, HEAD `d2d5b70241fb448044c1c088a977cc720d70443a`.

| 계약 | 파일:행 |
| --- | --- |
| fresh isolate, helper, deferred inventory | `codex-rs/code-mode-protocol/src/description.rs:11` |
| removed JS REPL | `codex-rs/features/src/lib.rs:985` |
| removed flag 무시 테스트 | `codex-rs/features/src/tests.rs:589` |
| 모델 tool mode 우선순위 | `codex-rs/core/src/tools/mod.rs:68` |
| store 직렬화 제약 | `codex-rs/code-mode-runtime/src/runtime/callbacks.rs:205` |
| 셀 시작 snapshot, 완료 시 key merge | `codex-rs/code-mode-runtime/src/session_runtime/mod.rs:163`, `:279` |
| MCP 병렬 가능 여부 | `codex-rs/core/src/tools/handlers/mcp.rs:128` |
| 실제 scheduler admission | `codex-rs/core/src/tools/parallel.rs:155` |
| prewarm | `codex-rs/core/src/session_startup_prewarm.rs:185` |
| interrupt | `codex-rs/core/src/tasks/mod.rs:916` |
| tool inventory completeness | `codex-rs/core/src/tools/executed_tool_calls.rs:398` |
| CUA/Node-backed 서버 식별 | `codex-rs/protocol/src/mcp.rs:37` |
| 현재 app/installed 계약 | `codex-rs/app-server-protocol/src/protocol/v2/apps.rs:31` |

이것은 source inspection 근거다. 해당 함수와 테스트를 이번 조사에서 실행했다는 뜻이 아니다.

## 문서 검증

Node inline 검사로 아래 항목을 확인했다. 검사 입력에 이 문서 디렉터리를 절대 경로로 전달했으므로 실제 변경 대상을 읽었다.

- `004_source_ledger.json` 파싱, PR 33개의 번호 유일성.
- MERGED 항목의 `mergedAt`·merge SHA 존재, OPEN 항목에 merge 날짜가 없는지 확인.
- Markdown 내부 파일 링크의 대상 존재.
- 문서의 GitHub PR 링크가 source ledger에 등록돼 있는지 확인.
- Markdown 파일의 3자리 번호 규칙.

첫 검사 출력: `files=5, prs=33, MERGED=27, OPEN=6, localLinksChecked=4, result=PASS`. 이 기록 문서를 추가하기 전의 결과다.

6개 파일 검사 출력: `files=6, prs=33, MERGED=27, OPEN=6, localLinksChecked=5, prLinksChecked=82, result=PASS`, exit 0. 이후 000 문서에 내부 탐색 링크 5개를 추가했다.

탐색 링크 추가 후 재검사: `files=6, prs=33, merged=27, open=6, localLinksChecked=10, prLinksChecked=82, result=PASS`, exit 0.

이 unit만 staging한 뒤 `git diff --cached --check -- devlog/_plan/260905_codex_code_mode_pr_research`: 출력 없음, exit 0.

`git diff --check`는 untracked 문서 내용을 검사하지 않는다. 따라서 최종 whitespace 검사는 이 디렉터리만 staging한 뒤 `git diff --cached --check -- <unit>`로 수행한다. 테스트·빌드·typecheck·브라우저 조작·설정 변경은 이번 문서 작업에 필요하지 않아 실행하지 않는다.

## 상태와 다음 경계

P 진입은 persisted FSM에 기록됐다. `cxc orchestrate status --session 01a0702d-c493-7510-801f-7d8772a2689c`는 `phase=P`, `auditPassed=false`, `checkPassed=false`를 반환했다. 따라서 이 문서 검사는 P 단계의 산출물 점검이며 PABCD C-gate가 아니다.

`cxc-loop`의 HITL 확인 지점에서 멈춘다. 연구 문서는 작성됐지만 A/B/C/D, 설정 실험, 기능 채택은 아직 하지 않았다. 다음 단계 승인 전에는 폴더를 `_fin/`으로 이동하지 않는다.
