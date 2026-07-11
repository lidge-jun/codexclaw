# 260710 repo_review — 검토 루프 로드맵 (000_plan)

## 목표

codexclaw 저장소를 세 갈래로 나눠 검토하고, 갈래마다 완전한 PABCD 사이클 하나를 배정해
검토 문서를 이 유닛 폴더에 남긴다. 마지막에 교차 종합 문서로 닫는다.

- 세션: `019f4857-9455-7312-9865-c89df3d5a69f` (HOTL, goal 활성)
- goalplan slug: `codexclaw-devlog-260710-repo-review-000-plan-010`
- 루프 아키타입: spec-satisfaction (검증자 = 문서 존재 + 근거 인용 실검증 + E8 게이트)
- 종료 조건: 4 사이클 D-close(최소 3+ 충족), 유닛 문서 13개 전부 존재 — 000 계획 1 +
  001~004 영속 연구 4 + 010/020/030/040 phase 스펙 4 + 011/021/031/041 검토 산출물 4 —
  그리고 `cxc loop validate` 통과
- 자원 한도: wall-clock 90분. 서브에이전트 수/토큰 무제한(사용자 명시).
- 서브에이전트: `gpt-5.6-sol`, 읽기 전용 탐색과 리뷰어는 파일 쓰기 금지, 쓰기는 메인 세션이 담당.

## 유닛 문서 구조 (LEXICO-SPLIT-01)

- `000_plan.md` — 본 계획. `001~004_research_*.md` — 탐색 에이전트 보고 영속화(000번대 연구).
- `010/020/030/040_phaseN_spec_*.md` — 각 사이클의 decade 스펙 문서(사전 확정, DIFFLEVEL 등가물).
- `011/021/031/041_*.md` — 각 사이클의 검토 산출물(같은 decade 내 스펙 다음 번호).

## Work-phase 맵 (의존 순서)

| 사이클 | 문서 | 대상 | 의존 |
|--------|------|------|------|
| 1 | `011_cli_hooks_review.md` | `bin/codexclaw.mjs` 위임기 + `plugins/codexclaw/components/*`(pabcd-state 등 실소스) + `plugins/codexclaw/hooks` + 활성 hook 레지스트리(`plugins/codexclaw/.codex-plugin/plugin.json`의 hooks 항목 — hooks/ 디렉터리의 JSON 20개 중 manifest에 등록된 13개만 활성; 문서에 활성/비활성 표 필수) | 없음 (기반: 코드가 SSOT) |
| 2 | `021_skills_doctrine_review.md` | `plugins/codexclaw/skills/*` vs `structure/*.md` 독트린 일관성 | 사이클 1의 코드-현실 파악을 전제로 문서-코드 괴리를 판정 |
| 3 | `031_state_goalplan_review.md` | `.codexclaw` 상태/goalplan/ledger 스키마 + E8 게이트 | 사이클 1의 컴포넌트 파악 전제 |
| 4 | `041_synthesis.md` | 사이클 1~3의 교차 종합 + 우선순위 권고 | 사이클 1·2·3 전부 |

> A게이트 보정(사이클 1): 최초 계획의 `cli/src`는 빈 디렉터리로 확인됨(탐색 에이전트 Noether,
> `bin/codexclaw.mjs:27-28` "thin delegator over compiled component CLIs"). 검토 대상을
> `bin/codexclaw.mjs` + `plugins/codexclaw/components/*` 실소스로 정정한다.

## 각 문서의 diff-level 스펙

### 011_cli_hooks_review.md (사이클 1, NEW)

섹션 구성:
1. 검토 범위와 방법 — 읽은 파일 목록, 파견한 에이전트, 검증 명령.
2. CLI 표면 맵 — `cxc` 하위 명령별 구현 파일 `path:line` 표.
3. orchestrate 게이트 로직 — transition/attest(A>B, C>D), `--session` 필수화의 코드 근거.
4. hook 이벤트 맵 — UserPromptSubmit/PreToolUse/PostToolUse/Stop/SessionStart 핸들러 위치.
5. Stop-continuation 구현 — GOAL-IDLE-CONTINUE-01, MAX_STOP_BLOCKS, plateau block.
6. 발견 사항 — 심각도(High/Med/Low)별 번호 목록, 각 항목 `path:line` + 인용.
7. 리뷰어 verdict 기록.

수용 기준: 실제 코드 `path:line` 근거 5개 이상. 스팟체크(무작위 3건 인용을 실제 파일에서 재확인) 통과.

### 021_skills_doctrine_review.md (사이클 2, NEW)

섹션 구성:
1. 검토 범위 — skills 디렉터리 목록, structure/*.md 목록.
2. 독트린 규칙 이름space 대조 — 같은 규칙 ID가 skills와 structure 양쪽에 있을 때 문구 일치/괴리 표.
3. deprecated 스킬 상태 — cxc-goalplan/cxc-skill-hub/cxc-ultraresearch의 잔존 참조 여부.
4. 모순/스테일 후보 — 각 항목에 양쪽 파일 `path:line` 근거.
5. 발견 사항(심각도별) + 리뷰어 verdict.

수용 기준: skills/structure 파일 근거 5개 이상, 스팟체크 통과.

### 031_state_goalplan_review.md (사이클 3, NEW)

섹션 구성:
1. `.codexclaw/` 상태 파일 지형 — sessions/ledger/goalplans/interviews 스키마 실측.
2. goalplan 스키마 vs cxc-loop 스킬 문서의 계약 대조.
3. loop CLI(E8 validate) 동작 검토 — 실제 실행 출력 근거.
4. 발견 사항(심각도별) + 리뷰어 verdict.

수용 기준(측정 가능형): (a) 실측 `path:line`/실행 출력 근거 5개 이상, (b) 스팟체크 —
문서의 인용 중 무작위 3건을 메인 세션이 원본 파일에서 재확인해 일치(불일치 시 C 재작업),
(c) 리뷰어 VERDICT 라인이 문서에 기록됨. E8 validate는 capturedEvidence 존재만 보므로
인용 진위는 이 스팟체크가 담당한다(검증 절차를 C attest의 checkOutput에 기록).

### 041_synthesis.md (사이클 4, NEW)

섹션 구성:
1. 세 검토의 교차 발견(같은 원인이 여러 표면에 드러난 항목).
2. 우선순위 권고 Top 5 — 각 항목에 근거 문서 참조.
3. 루프 운영 회고(LOOP-PESSIMIST-01): 죽은 가설, 개선 안 된 것.

수용 기준: 011/021/031의 발견을 각각 2건 이상 교차 인용, 권고마다 근거 문서 참조.

## 사이클 공통 절차

각 사이클: `P`(스펙 stale 체크·갱신) → `A`(독립 리뷰어 파견, VERDICT 수취, AUDIT-LOOP-01)
→ `B`(탐색 에이전트 보고 통합, 메인 세션이 문서 작성) → `C`(인용 스팟체크 + 파일 실재 검증)
→ `D`(요약 attest, goalplan criterion에 capturedEvidence 기록).

**스팟체크 정의(전 사이클 공통, C게이트):** 해당 사이클 문서의 `path:line` 인용 전체에서
무작위 3건을 추출(`shuf`/python random, seed는 attest에 기록)해 메인 세션이 원본 파일의
해당 라인을 직접 읽어 인용과 대조한다. 1건이라도 불일치하면 C 실패 → B로 되돌아가 수정.
대조 명령과 출력은 C attest의 `checkOutput`에 기록한다.

## OUT (범위 밖)

- 코드 수정. 이 루프는 검토 문서 생산만 한다. 발견 사항은 권고로만 남긴다.
- devlog/_plan/260710_repo_review/ 밖의 파일 쓰기 (goalplan/ledger 갱신, 그리고 goal 종료 시
  이 유닛을 `devlog/_fin/`으로 이동하는 아카이브 절차는 예외).
- node_modules, docs-site, mockup-scroll-motion 검토.
- `plugins/codexclaw/gui`(GUI 프론트엔드)와 컴포넌트 테스트 스위트의 내용 검토 — 본 루프는
  제어면(CLI 위임기, hook/FSM 컴포넌트, 스킬 독트린, 상태 스키마)에 집중한다. 단, 011에서
  각 컴포넌트의 테스트 존재 여부는 표로 기록한다(내용 감사 제외 사유 포함).

## A게이트 라운드 1 합성 (REVIEW-SYNTHESIS-01)

리뷰어(Dalton, gpt-5.6-sol) VERDICT: FAIL, 블로커 5건. 처리:

1. GUI/테스트 범위 누락(High) — **수용(부분)**: OUT에 명시적 제외+사유 추가, 010에 테스트
   존재 표 추가. 전량 커버는 goal 산출물 정의(검토 문서 4~5개) 밖이라 확장하지 않는다.
2. decade 문서 부재/000 혼합(High) — **반박(기록)**: 본 유닛은 코드 구현이 아니라 문서 생산
   유닛이며, 000_plan의 "각 문서의 diff-level 스펙" 절이 각 phase의 사전 스펙(정확한 경로,
   NEW, 섹션 구조, 수용 기준)을 담는다. DIFFLEVEL-ROADMAP-01의 의도(각 사이클 P가 사전
   스펙에서 출발)는 충족되고, 산출물 자체가 decade 문서(010/020/030/040)다.
3. `_fin/` 종료 절차 충돌(High) — **수용**: OUT 예외로 아카이브 이동 명시.
4. 040의 사이클 배정 불일치(High) — **수용**: 종합을 사이클 4로 승격(040 = phase 4 decade).
   goalplan에 wp4 추가. 총 4 사이클.
5. 사이클 3 기준 측정 불가/E8 한계(High) — **수용**: 030/각 문서 수용 기준을 스팟체크
   절차(무작위 3건 재확인)로 측정 가능화, E8 한계를 계획에 명기.

## A게이트 라운드 2 합성 (REVIEW-SYNTHESIS-01)

리뷰어 VERDICT: FAIL (High 3, Med 1). 근거: `.codexclaw/evidence/repo-review-a-gate-round2-20260710T044603+0900.md`. 처리:

1. DIFFLEVEL/LEXICO 미충족(High) — **수용**: 반박을 철회하고 `001_cycle_specs.md`(000번대
   연구/설계 문서)에 각 사이클 문서의 사전 스펙을 실행 가능한 정밀도(섹션별 예상 내용,
   근거 소스 경로, 수용 기준, C 검증 명령)로 작성. 산출물이 "코드 diff"가 아닌 문서-생산
   유닛이므로 diff-level의 등가물은 "섹션·소스·검증 명령이 사전 확정된 스펙"으로 정의한다.
2. UNIT-RESIDENCE-01(High) — **수용**: 유닛을 `devlog/_plan/260710_repo_review/`로 이동
   완료. goal 종료 시 `devlog/_fin/`으로 아카이브.
3. 활성 hook 레지스트리 누락(High) — **수용**: 사이클 1 대상에 manifest(hooks 13/20) 대조
   표를 추가.
4. 사이클 2 스팟체크 미정의(Med) — **수용**: 스팟체크 정의를 전 사이클 공통 절차로 승격.

## A게이트 라운드 3 합성 (REVIEW-SYNTHESIS-01)

리뷰어 VERDICT: FAIL (High 3). 근거: `.codexclaw/evidence/repo-review-a-gate-round3-20260710T045103+0900.md`. 처리:

1. 단일 001에 4개 phase 설계 혼합(High) — **수용**: 001을 폐기하고 phase별 decade 스펙
   문서(010/020/030/040)로 분리. 산출물은 같은 decade의 011/021/031/041로 재번호.
   000번대는 영속 연구 문서(001~004)로만 사용.
2. 실행 불가 스펙(placeholder 명령, 비영속 근거, 오경로)(High) — **수용**: 각 스펙에
   실행 가능한 C 검증 명령 블록 명시. 탐색 보고를 001~003(+004 예정)으로 유닛 내 영속화.
   `components/...` 경로를 `plugins/codexclaw/components/...` 전체 경로로 정정.
3. goalplan stale(High) — **수용**: wp1 제목에서 cli/src 제거, c1에 스펙/연구 문서 요건
   반영, 문서 수 기준을 "산출물 4개 전부 + 스펙/연구 문서"로 정정.

## A게이트 라운드 4 합성 (REVIEW-SYNTHESIS-01)

리뷰어 VERDICT: FAIL (High 4). 근거: `.codexclaw/evidence/repo-review-a-gate-round4-20260710T050031+0900.md`. 처리:

1. 004 부재(High) — **수용**: 상태 탐색 보고 수신 즉시 `004_research_state.md`로 영속화 완료.
2. 문서 수 모순(High) — **수용**: 종료 조건을 13개(위 명세)로 정정.
3. goalplan stale(High) — **수용**: objective의 구 산출물명을 011/021/031/041로, wp 태스크
   문구를 스펙(010/020/030/040)=사전 확정·산출물(011/021/031/041)=B 작성으로 정정, c5를
   4 사이클 D-close로 갱신.
4. C 명령 비강제(High) — **수용**: 각 스펙의 C 명령을 임계값 실패 시 비-0 종료하는
   assert형으로 교체(rg -c 수치 비교, 사이클 4는 소스별 개별 >=2, E8은 exit code 전파).

## A게이트 라운드 5 합성 (REVIEW-SYNTHESIS-01)

리뷰어 VERDICT: FAIL (High 1, Med 1). 근거: `.codexclaw/evidence/repo-review-a-gate-round5-20260710T050607+0900.md`. 처리:

1. E8 통과 시점의 의존 순서 모순(High) — **수용**: wp4는 C 통과 후 D에서야 done이 되므로
   사이클 4 C에서 E8 통과를 요구하는 것은 구조적으로 불가능(리뷰어의 시뮬레이션 증거 채택).
   040 스펙 §4를 "E8 경로 서술"로 교체: C 시점 출력은 예상-FAIL 인용, 최종 통과 검증은
   wp4 D-close 직후 메인 세션이 별도 실행(goal 종료 전 필수 관문, GOAL-COMPLETE-GATE-01이
   update_goal 시점에 어차피 E8을 강제). 030 §6도 "FAIL 출력의 정상성 해석"으로 정정.
2. 스테일 참조(Med) — **수용**: 000_plan 82행(041 수용 기준)을 011/021/031로, 102행(OUT의
   테스트 표 배정)을 011로 정정.

## A게이트 라운드 6 합성 (REVIEW-SYNTHESIS-01)

리뷰어 VERDICT: FAIL (High 2). 근거: `.codexclaw/evidence/repo-review-a-gate-round6-20260710T050955+0900.md`. 처리:

1. post-D E8 시퀀스 불완전(High) — **수용**: `advanceWorkPhase()`가 criteria를 갱신하지
   않는다는 리뷰어 시뮬레이션 채택. 040 스펙에 "D-close 후 마감 시퀀스" 절 신설:
   D-close → c5 증거 기록(met, 4건 D 전이 발췌) → 최종 E8(exit 0) → update_goal complete.
2. wp4 태스크 문구 모순(High) — **수용**: goalplan wp4 태스크를 4단계로 재구성,
   "loop validate 통과"를 B/C에서 제거하고 D-close 후 마감 시퀀스(wp4-t4)로 분리.

## A게이트 라운드 7 합성 (REVIEW-SYNTHESIS-01)

리뷰어 VERDICT: FAIL (High 1, Med 1). 근거: `.codexclaw/evidence/repo-review-a-gate-round7-20260710T051346+0900.md`. 처리:

1. c5 자기 참조(High) — **수용**: c5의 증거 계약을 "루트 ledger의 D 전이 4건 발췌+시각"으로
   한정. 최종 E8 통과 증명은 c5 밖의 goal 종료 관문(D-close 후 마감 시퀀스 3~4단계 +
   GOAL-COMPLETE-GATE-01)이 담당한다고 c5 시나리오와 040 스펙에 명기.
2. wp4-t4 원장 왜곡(Med) — **수용**: D-close가 태스크를 자동 done 처리하므로 wp4-t4를
   태스크에서 제거, 마감 시퀀스를 "goalplan 태스크가 아닌 메인 세션 의무"로 040 스펙에 명기.
