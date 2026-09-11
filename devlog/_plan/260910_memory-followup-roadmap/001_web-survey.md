# 001 — 웹 조사: 에이전트 메모리·리콜 하네스 사례와 Codex 네이티브 통합 지점

날짜: 2026-09-10 (KST). 조사 방식: 호스트 web_search로 후보를 찾고(Tier 1), 아래 표의 출처는 전부 원문을 열어(curl, 2026-09-10) 인용 문장을 확인했다(Tier 2). 검색 결과 요약만 있고 원문을 못 연 항목은 "미확인"으로 표시했다. 이 문서는 연구 문서이며 diff를 담지 않는다(LEXICO-SPLIT-01).

## 1. 원문 확인 출처

| # | 출처 | 확인한 내용 | 우리에게 주는 함의 |
|---|---|---|---|
| S1 | [claude-mem Hooks architecture](https://docs.claude-mem.ai/hooks-architecture) | SessionStart 훅은 cwd에서 프로젝트명을 뽑고 SQLite에서 최근 세션 요약 10개·관찰 50개(기본)를 읽어 "progressive disclosure index"(표 형태, 상세는 검색 도구로)를 stdout으로 주입. startup/clear/compact에서 실행. UserPromptSubmit은 세션 레코드 생성·프롬프트 저장 후 즉시 반환(비차단, suppressOutput). 설계 패턴: Fire-and-Forget(훅은 큐에 넣고 즉시 반환), Queue-Based Processing(캡처와 처리 분리), Graceful Degradation("Memory system failure shouldn't break Claude Code" — 실패는 로그만 남기고 `continue:true`), Progressive Enhancement. 실측 지연 목표 <100ms, SessionStart(context) 평균 45ms/p95 120ms, UserPromptSubmit 12ms/25ms. | codexclaw recall과 골격이 같다(SQLite 인덱스 + 훅 주입). 차이: 우리는 프로젝트 식별이 cwd 정확 일치(관리형 워크트리에서 빈 블록), UserPromptSubmit이 프롬프트를 기록·회수하지 않음, 게이트 실패가 세션을 막음(오탐). 백그라운드 워커는 도입하지 않는다(범위 밖). |
| S2 | [claude-mem issue #621](https://github.com/thedotmack/claude-mem/issues/621) | 2026-01-08, bug 확정·closed. user-message-hook.js가 `console.error()`로 ANSI 색 텍스트를 **stderr**에 쓰고 exit 3으로 끝나 SessionStart:startup 훅 오류 발생(리뷰어가 GitHub API 원문으로 재확인). "SessionStart hooks should return valid JSON." | 우리가 #104에서 고친 PostCompact 봉투 오류와 같은 계열. 훅 출력 형식 회귀 테스트는 stdout뿐 아니라 stderr와 exit code까지 봐야 한다(wp6 §4.4). |
| S3 | [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks) | SessionStart 입력에 `source`: "startup" / "resume" / "clear" / "compact" / "fork". resume/fork에는 `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired` 등 추가 필드. SessionStart 출력 `additionalContext`는 첫 프롬프트 전에 컨텍스트에 추가. PostCompact 입력은 `trigger`, `compact_summary`이고 decision control 없음("can't affect the compaction result but can perform follow-up tasks"). 파싱 실패 stdout은 non-blocking 오류로 진행. | Codex 훅 스키마와 비교 기준. Codex의 SessionStart source(`startup|resume|clear|compact`, codex-rs hooks/src/schema.rs:499-509, 260909 000_plan T1)는 fork를 제외하면 같다. Codex PostCompact는 `deny_unknown_fields`라 Claude Code보다 엄격하며(#104), compact_summary 필드 유무는 (unknown). |
| S4 | [arXiv 2608.15008 Harness the Memory](https://arxiv.org/abs/2608.15008) | 2026-08-15. 26개 지표·3개 모델·4개 벤치마크. "no single substrate consistently dominates: broad retrieval benefits long-context factual QA, while excessive retrieval can harm sequential decision-making by shifting attention away from action-critical context." substrate routing을 필수 요소로 제안. | 세션 시작 주입은 작게, 깊은 회수는 도구 호출로. 코딩 에이전트는 decision-making 쪽이므로 넓은 top-k 주입이 해롭다는 근거. 우리 2티어 주입(#104)과 네이티브 요약 포화 대응(wp7) 방향을 지지. |
| S5 | [arXiv 2603.07670 Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670) | 2026-03-08 서베이. write–manage–read 루프, 3차원 분류(시간 범위·표현 기질·제어 정책), "write-path filtering, contradiction handling, latency budgets, privacy governance"를 공학 현실로 명시. | 검색 결과에 신선도·정정 관계를 표기하는 항목(S1 낡음 표기, 이전 사이클 이월)의 근거. write-path filtering은 우리 게이트의 역할이며, 읽기를 막는 건 이 역할이 아니다. |

## 2. 검색 요약만 있고 원문 미확인

| 항목 | 요약이 말한 것 | 처리 |
|---|---|---|
| 세션 브리핑 형태(목표/결정/최근 변경/실패/제약/리스크 + 회수 안내문), 예산 비율(브리핑 5~15%, 회수 10~20%) | 여러 실무 글의 합성 | 형태만 차용하고 비율 숫자는 인용하지 않는다. |
| exact·semantic·temporal·entity 채널 라우팅 | S4의 substrate routing과 일치 | S4를 근거로 쓴다. |
| Mem0([arXiv 2504.19413](https://arxiv.org/abs/2504.19413)), Letta core/archival | 임베딩·사실 통합, 에이전트 주도 이동 | 이전 사이클 폐기(임베딩) 유지. 비교 참고만. |
| learn.chatgpt.com Codex Memories/Hooks 페이지 | /memories, SessionStart·PostCompact 문서화; `dedicated_tools`·`memories.search`는 공개 문서에 없음 | 리스크로 기록: 우리가 쓰는 표면은 소스·실측으로만 확인된 비공개 표면. 업스트림 변경 시 깨질 수 있으므로 wp6에 "설치된 codex 버전 재검증" 항목을 둔다. |

## 3. 우리 코드와의 대응 (조사 → work-phase)

| 사례가 권하는 것 | 현재 codexclaw | 대응 work-phase |
|---|---|---|
| 메모리 실패가 주 작업을 막지 않는다 (S1 Graceful Degradation) | PreToolUse 게이트가 읽기 sed·본문 경로 문자열 명령을 차단(이 세션 3회) | wp1 |
| exact 채널은 식별자·버전·파일명을 정확히 잡아야 한다 (S4 routing) | `2.49.0`을 FILENAME 심볼로 보고 `v2.49.0` 경계 실패 | wp2 |
| 브리핑 끝에 회수 도구 안내, 질의 라우팅 (S1 progressive disclosure, S4) | 스킬에 자연어 분해 절차 없음, 과대 주장 14항목 | wp3 |
| 프로젝트 식별 (S1 "extracts project name from cwd") | cwd 정확 일치·접두사; 워크트리 23.5%가 다른 프로젝트로 취급 | wp4 |
| 짧은 고신뢰 회수 > 넓은 top-k (S4) | 8단어 AND 전부 만족 요구, 긴 문장 0건 | wp5 |
| source별 브리핑(S3), 훅 출력 형식 회귀 방지(S2), 프롬프트에서 엔티티 추출 후 표적 회수(S1 UserPromptSubmit) , 신선도·정정 표기(S5) | source=compact 분기는 #104로 존재, 출력 형식 테스트 없음, recall-intent 훅은 안내만, 낡음 표기 없음 | wp6 |

## 4. 하지 않는 것 (조사 결과로 재확인)

백그라운드 워커·데몬(S1의 Bun worker) 도입, 임베딩, 클라우드 동기화, 네이티브 memories 검색 재구현. 이 사이클은 기존 훅·SQLite 인덱스·스킬 위에서만 보강한다.
