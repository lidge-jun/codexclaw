# 074 — wp4 receipt: 프로젝트 정체성 키

날짜: 2026-09-10 (KST). 세션 01a0880e-149e-72d0-86db-53bd99bcac0e. 브랜치 `codex/memory-l1-wp4-identity`(origin/dev b60d0ca8 위), 구현 커밋 `222ff8e0`. 구현은 opus-5 실행 서브에이전트, 검증·통합은 메인.

## 결론

관리형 워크트리가 메인 체크아웃과 같은 프로젝트로 묶인다. 이 워크트리 cwd로 `memory search "메모리" --cwd-only`가 0건(chat 폴백만)에서 메모리 아티팩트 7건(메인 체크아웃 기록 3건 포함, cli-jaw/opencodex 0건)으로 바뀌었다. 인덱스 스키마 버전은 "2" 그대로이고 설치본 0.2.24와 같은 인덱스를 공유해도 깨지지 않는다.

## 무엇이 바뀌었나

- NEW `recall/src/repo-key.ts`: `normalizeRepoKey`(scp/ssh/https/git → `host/owner/name`, .git·trailing slash 제거, host 소문자, 경로 대소문자 유지), `readOriginUrl`(`git -C cwd config --get remote.origin.url`, 1.5초 타임아웃, 실패 시 null), `repoKeyForCwd`, `repoKeysEqual` + `test/repo-key.test.ts`.
- `rollout.ts` `readRolloutMeta`: `payload.git.repository_url` → `RolloutMeta.repoKey`. `threads-db.ts` `loadThreadMeta`: `git_origin_url` SELECT(구 state db용 fallback SELECT 포함) → `ThreadMeta.gitOriginUrl`.
- `index-db.ts`: `files.repo_key` nullable 컬럼을 PRAGMA table_info 가드 후 ALTER(`ensureRepoKeyColumn`); 신규 DB는 SCHEMA에 포함. `ingest.ts`: INSERT에 repo_key, lazy backfill(skip 검사 앞·파일 트랜잭션 밖, 1,000행 배치, `repo_key IS NULL AND cwd IS NOT NULL AND thread_id IS NOT NULL`, 멱등).
- 소비 4곳: `memory-search.ts` `scopeAdjust`(같은 origin = 접두사 히트와 같은 CWD_BOOST), `index-search.ts` `candidateFilter`(repoThreadIds를 queryIndex 안에서 계산), `chat-search.ts` scan 필터, `cwd-context.ts` `listCwdSessions`(훅). `cwdMatches`에 `caseInsensitive` 옵션(darwin에서 `FOLD_CWD_CASE`).
- SKILL.md "Until wp4" 문단 → 같은 git origin 연합 문구. 테스트 +20(158), 배지 2958→2978.

계획과의 차이: repoThreadIds를 chat-search에서 넘기지 않고 queryIndex가 이미 읽는 thread meta에서 계산(state db 이중 open 회피); `round2.test.ts`/`hook.test.ts` 수정 불필요(기존 단언이 문자열을 안 봄); 신규 DB가 컬럼을 바로 만들므로 ALTER 경로를 위한 in-place 마이그레이션 테스트를 추가.

## 증거

- receipt `.codexclaw/evidence/01a0880e-149e-72d0-86db-53bd99bcac0e/test-receipt.json`: `/tmp/mfu-260910/check-wp4.sh` exit 0 @ 222ff8e0 — 골든(메모리 7 / 메인 3 / 외부 0 / 경고 0) + recall 158 pass + dist-freshness·packaging·synopsis 7 pass.
- 실데이터 마이그레이션 증명(실행 에이전트, 메인이 결과 확인): 12GB 인덱스의 APFS 클론(`/tmp/mfu-260910/idx-copy.sqlite`)에서 refresh 1회 후 schema_version "2" 유지, files 13,247 중 repo_key 10,875행 채움, msgs 1,227,785(감소 없음), cli-jaw 포크 둘이 분리. 사용자 실인덱스는 바이트·mtime 불변(12,122,701,824 / 09:05).
- 감사: grok-4.6 리뷰어 PASS(Low 2 반영).

## 개선되지 않은 것 (LOOP-PESSIMIST-01)

- 설치본 0.2.24가 같은 인덱스를 다시 ingest하면 그 파일 행의 repo_key가 NULL로 돌아가고(INSERT OR REPLACE 명시 컬럼), 다음 신코드 backfill이 다시 채운다 — 일시적 스코프 공백.
- origin이 없는 디렉터리(git 밖, /tmp 체크아웃 등)는 접두사 규칙 그대로다.
- 방향이 틀렸다는 신호: 서로 다른 포크(같은 owner/name이 아닌)가 같이 묶이는 사례가 나오면 정규화가 너무 느슨한 것이다(현재는 owner/name 대소문자를 보존해 분리).

## 다음

wp5(자연어 완화)·wp6(네이티브 통합) ready. 12GB 클론 `/tmp/mfu-260910/idx-copy.sqlite*`은 검증 후 지운다.

