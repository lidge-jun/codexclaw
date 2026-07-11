# 030 — Phase 3 스펙: 상태/goalplan/E8 게이트 검토 문서 (사이클 3)

산출물: `031_state_goalplan_review.md` (NEW). 근거 소스는 상태 탐색 보고(파견 완료,
수신 시 `004_research_state.md`로 영속화) + 메인 세션의 loop CLI 실행 출력.

## 산출물 섹션 스펙

| # | 섹션 | 내용 | 근거 소스 |
|---|------|------|-----------|
| 1 | .codexclaw 지형 | sessions/ledger/goalplans/interviews/evidence/divergence 파일 스키마 실측 표 | `004_research_state.md` §1 (B에서 재실측) |
| 2 | sessions 스키마 대조 | `<id>.json` 실측 vs `components/pabcd-state/src/state.ts` 타입 | 004 §2 |
| 3 | goalplan 계약 대조 | `skills/loop/SKILL.md` Shipped schema 절 vs `goalplan.ts` 구현 — 양방향 누락 필드 | 004 §3 |
| 4 | E8 실패 조건 전수 | `goalplan.ts` validate의 실패 조건 나열 + 미검증 한계(인용 진위) | 004 §4 |
| 5 | ledger 이벤트 대조 | 실측 이벤트 vs SKILL.md 선언 6종. 004 §5의 카운트(337행, 185/337 등)는 수집 시점 스냅샷이므로 B 시점에 반드시 재실측해 현재 값으로 수록(스냅샷 인용 시 수집 시각 병기) | 004 §5 + B 재실측 |
| 6 | E8 실행 증거 | 본 세션 `cxc loop validate` 실제 출력 — 사이클 3 시점의 FAIL 출력(잔여 work-phase로 인한 정상 동작 증거)과 실패 사유 해석. 최종 통과는 wp4 D-close 후에만 가능함을 명시 | 메인 세션 실행 |
| 7 | 발견 사항 | High/Med/Low, `path:line`+인용(스팟체크 통과분만) | 004 §6 |
| 8 | 리뷰어 verdict | A게이트 이력 + 최종 verdict | 리뷰어 반환문 |

## 수용 기준

- 실측 `path:line`/실행 출력 근거 5개 이상, 스팟체크(공통 정의) 통과, verdict 기록.

## C 검증 명령 (실행 가능형)

```bash
set -e
cd /Users/jun/Developer/new/700_projects/codexclaw
doc=devlog/_plan/260710_repo_review/031_state_goalplan_review.md
test -f "$doc"
n=$(rg -c ':[0-9]+' "$doc"); [ "$n" -ge 5 ] || { echo "FAIL: citations $n < 5"; exit 1; }
echo "PASS: citations=$n"
# E8은 사이클 3 시점에는 잔여 wp3/wp4로 인해 FAIL이 정상 — 단, "예상된 실패 형태"인지 assert:
# 출력에 'not done'(잔여 phase 사유)이 있어야 하고, 'no plan found' 등 다른 실패는 C 실패.
out=$(node bin/codexclaw.mjs loop validate --slug codexclaw-devlog-260710-repo-review-000-plan-010 --cwd "$PWD" 2>&1) || true
echo "$out"
echo "$out" | grep -q 'not done' || { echo "FAIL: E8 output is not the expected incomplete-plan failure"; exit 1; }
echo "$out" | grep -q 'no plan found' && { echo "FAIL: goalplan missing/corrupt"; exit 1; }
# 스팟체크(수동 단계): 공통 정의대로 무작위 3건 원본 대조(seed는 attest 기록).
true
```
