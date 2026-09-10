# 076 — wp6 receipt: 네이티브 통합 보강

날짜: 2026-09-10 (KST). 세션 01a0880e-149e-72d0-86db-53bd99bcac0e. 브랜치 `codex/memory-l1-wp6-native`(origin/dev 9384a4f5 위), 구현 커밋 `7f21ed65`. 구현은 opus-5 실행 서브에이전트, 검증·통합·관측은 메인.

## 결론

웹 조사(001 §3)가 권한 네 항목이 기존 훅과 인덱스 위에서 들어갔다. SessionStart는 source별로 브리핑 형태를 나누고 끝에 회수 안내 한 줄을 붙이며(`dedicated_tools = true`면 `memories.search`, 아니면 cxc 명령), UserPromptSubmit은 recall 의도가 잡힐 때 프롬프트에서 뽑은 표적 용어를 제안하고(검색 미실행), memory search 출력은 `[age: Nd]`·`[newer: <relpath>]` 라벨을 달며(랭킹 불변), 훅 출력 계약(exit 0·stderr ANSI 없음·stdout JSON 또는 빈 문자열)이 자식 프로세스 테스트로 고정됐다. doctor는 trusted_hash drift만 있으면 WARN, 항목 없음은 FAIL이다.

## 무엇이 바뀌었나

- `recall/src/hook.ts`: `handleSessionStart(…, opts?)` source 분기(startup/clear는 기존 문구, resume은 재개 문장 추가, compact는 기존 COMPACTED_BUDGET 경로) + 160자 캡 회수 안내; `dedicatedToolsEnabled()`(`codexHome()/config.toml` `[memories]` 테이블, fail-open false); `extractRecallTargets`(버전·파일명·오류 코드·CamelCase·따옴표, 최대 4) + "Suggested recall terms:"; 트리거 어휘 5개 추가(`그때` 단독 제외); `assertLegalHookResult` export.
- `recall/src/format.ts`: `[age: Nd]`(nowMs 주입 가능), 다른 파일의 더 최신 히트가 같은 특징 토큰을 가지면 `[newer: …]`.
- `cxc-ops/src/doctor.ts`·`hook-trust.ts`: drift만 WARN("trusted_hash drift (reinstall updates it; hooks still run)"), untrusted 포함 시 FAIL 유지, `file_sha256` 근거.
- 테스트 +15(recall 191, cxc-ops 199), NEW `format-freshness.test.ts`, 자식 프로세스 계약 테스트(빈 임시 CODEX_HOME/CODEX_SQLITE_HOME/CODEXCLAW_HOME). dist 4파일. 배지 2993→3007.

계획과의 차이: compact 브리핑은 두 줄 명령 대신 단일 회수 안내로 통일; resume 문구는 "recall is available" 뒤에 덧붙임(감사 제약 1); `fileSha256`은 `HookEntry`에 위치.

## 증거

- receipt `.codexclaw/evidence/01a0880e-149e-72d0-86db-53bd99bcac0e/test-receipt.json`: `/tmp/mfu-260910/check-wp6.sh` exit 0 @ 7f21ed65 — dist CLI로 SessionStart startup/resume/compact 3형태(350/429/336바이트, exit 0, ANSI 없음, 회수 안내 포함), config 픽스처 `dedicated_tools = true`에서 `memories.search` 안내, UserPromptSubmit 표적 제안(`hook.ts`·`2.49.0`), 실인덱스 `2.49.0 SLSA` 출력에 age 4·newer 3, 스위트 390 + 38 pass.
- 이 머신의 doctor는 FAIL이다: #119 bg-wake·#116 fallback 훅이 `hooks.state`에 아직 없어(untrusted) 설계대로 FAIL, drift 1건은 같은 줄에 표시. 재설치 후 `cxc hooks retrust`가 처방이다.
- 감사: grok-4.6 리뷰어 GO-WITH-FIXES(3 High + Medium + Low) → 구현 제약으로 접어 C 테스트가 확인.

## §10 관측 항목 실측 (2026-09-10, 메인)

| 항목 | 실측 |
|---|---|
| compaction 후 SessionStart 재점화 | 09-09 15:00 이후 rollout 526개 중 `compacted` 11건, 그 직후 6항목 안에 `[cxc-recall]`/compact 문맥 주입 7건(64%). 나머지 4건은 compaction 뒤 사용자 턴이 없었거나 SessionStart가 재발화되지 않은 것으로 보이며 원인 분리는 미완(unknown) |
| `memories.search` 호출 빈도 | 같은 창에서 최상위 function_call로 `memor*` 이름 0건. Desktop이 `exec` 코드모드 안에서 호출하면 집계에 안 잡히므로 하한값이다(이 세션 자체가 `tools.memories__read`를 exec 안에서 썼다) |
| rollout_summaries 상한 | 256개 = `max_raw_memories_for_consolidation` 상한 그대로(notes/02) |
| `msgs_fts` 바이트 | `msgs_fts_data` 319,176 블록, 1,252,722,036 바이트(약 1.25GB, 인덱스 12.1GB의 10%) |
| 훅 `--no-refresh`와 신규 워크트리 주입 | wp4로 워크트리가 같은 origin에 묶이므로 신규 슬롯에서도 메인 체크아웃 세션이 Recent work에 들어간다(074 골든). refresh 지연 자체는 별도 측정 안 함 |

## 개선되지 않은 것 (LOOP-PESSIMIST-01)

- 표적 회수 제안은 안내문일 뿐 검색을 대신 실행하지 않는다. 에이전트가 제안을 따르는 비율은 이 사이클이 측정하지 못한다.
- 네이티브 요약 포화(92.5%)와 rollout_summaries 256 상한은 codexclaw 코드로 못 줄인다(000 wp7 결정 항목 그대로).
- 방향이 틀렸다는 신호: 회수 안내 한 줄이 들어간 뒤에도 recall 도구 호출이 늘지 않으면 안내 위치(브리핑 끝)가 아니라 모델의 도구 선택 정책이 병목이다.

