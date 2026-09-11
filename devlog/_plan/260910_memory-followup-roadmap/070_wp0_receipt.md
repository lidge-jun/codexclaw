# 070 — wp0 receipt: 로드맵 사이클 종결

날짜: 2026-09-10 (KST). 세션 01a0880e-149e-72d0-86db-53bd99bcac0e. 브랜치 `codex/memory-l1-wp0-roadmap`, 문서 커밋 `dd57a7df`.

## 결론

L1 사이클의 로드맵이 잠겼다. wp1~wp6 각각이 diff-level decade 문서(010~060)를 갖고, 독립 리뷰어(opus-5)가 3라운드 감사 끝에 PASS를 냈다. 다음 사이클은 wp1(게이트 오탐)과 wp2(심볼 경계)이며 서로 독립이라 어느 쪽이 먼저여도 된다. 이 사이클에서 코드는 바뀌지 않았다.

## 무엇이 바뀌었나

- `000_plan.md`: 진단 위에 L1 loop-spec(9필드 + 자원 한도), 독자 요약, work-phase 맵, PR 스택 결정, 아키텍트 상담 공백, 감사 기록 3라운드.
- `001_web-survey.md`: 원문 확인 출처 5개(claude-mem 훅 문서·이슈 #621, Claude Code 훅 레퍼런스, arXiv 2608.15008·2603.07670)와 미확인 요약 4건, 조사→work-phase 대응표.
- `010~060`: 파일 맵·before/after·활성화 시나리오·실측 검증 명령·PR 초안. 감사에서 접은 것: 게이트 파서의 공백 없는 리다이렉션 누락(UNSAFE 후보였음), `dedicated_tools` 분기의 도달 불가, index/scan 동등성 붕괴, doctor WARN의 bypass 5필드, 030↔040 계약, S2 메커니즘(stderr+exit 3), 파서 모듈 분리.
- `notes/00~08`: 오전 조사 근거. 06·07은 식별자를 뺀 축약본.

## 증거

- 검증 receipt: `.codexclaw/evidence/01a0880e-149e-72d0-86db-53bd99bcac0e/test-receipt.json` (명령 `/tmp/mfu-260910/check-docs.sh`, exit 0, commit dd57a7df, dirty false). 검사 항목: 번호 규칙, decade 6개 존재, 개인정보 grep 0, 인용 소스 경로 73개 실재 또는 NEW 선언, 필수 섹션, dist-freshness 통과.
- 리뷰어가 직접 실행한 검증: recall 137 pass, pabcd-state 1208 pass, cxc-ops 198 pass, dist-freshness 1 pass (전부 레포 러너, exit 0). 골든 기준선 재현: `2.49.0 SLSA` hits 2, 시놉시스 대조 exit 2.
- 감사 verdict: r1 GO-WITH-FIXES(5) → r2 GO-WITH-FIXES(1) → r3 PASS. 기록은 000 §A 감사 기록.

## 개선되지 않은 것, 죽은 가설 (LOOP-PESSIMIST-01)

- "제안 파서는 경계를 요구해도 안전하다"는 가설이 죽었다. 리뷰어가 실행으로 `echo hi>P`가 통과함을 보였고, 규칙을 "직전 문자 `-`/`<`와 따옴표 안만 제외"로 바꿨다. 잔여 `echo hi -> P`는 명시적 우회로 남는다.
- "`node --test` 직접 실행이 검증"이라는 전제가 틀렸다. 레포 러너 없이는 chat-fallback 테스트가 실인덱스를 읽는다. 여섯 문서에 정정 블록.
- 아키텍트 상담은 이 세션의 spawn 스키마에 `agent_type`이 없어 수행하지 못했다. 다음 사이클도 같은 제약이면 같은 공백이 반복된다.
- 지금 방향이 틀렸다고 판정할 증거: wp1 구현 후에도 라이브에서 읽기 명령이 게이트에 막히면(이 세션에서 4회 재현된 형태), 목적지 분류가 아니라 훅 matcher나 툴 이름 매핑이 원인이다.

## 다음

wp1 P: 010을 현재 트리와 대조(stale check)한 뒤 `shell-write-destinations.ts` 분리 구현. 브랜치 `codex/memory-l1-wp1-gate`는 이 브랜치(wp0) 위에 세우고 PR base는 dev.

