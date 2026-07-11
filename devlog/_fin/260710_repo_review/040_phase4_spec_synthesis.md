# 040 — Phase 4 스펙: 교차 종합 문서 (사이클 4)

산출물: `041_synthesis.md` (NEW). 근거 소스는 완성된 011/021/031.

## 산출물 섹션 스펙

| # | 섹션 | 내용 | 근거 소스 |
|---|------|------|-----------|
| 1 | 교차 발견 | 같은 원인이 복수 표면에 드러난 항목(fail-open 패턴, enforcement 서술 괴리, 문서-코드 스테일 등) — 011/021/031 각각 2건 이상 인용 | 011/021/031 |
| 2 | 우선순위 권고 Top 5 | 각 권고에 근거 문서 참조 + 기대 효과 1-2문장 | 011/021/031 |
| 3 | 루프 회고 | LOOP-PESSIMIST-01: 죽은 가설, 개선 안 된 것, 현 방향이 틀렸음을 보일 반증 조건 | 본 유닛 A게이트 라운드 이력 + ledger |
| 4 | E8 경로 서술 | 최종 E8 통과는 wp4 D-close 이후에만 가능(E8은 non-done phase를 전부 거부)하므로, 이 섹션은 그 의존 순서와 "goal 종료 시 GOAL-COMPLETE-GATE-01이 E8을 강제한다"는 사실을 서술하고, C 시점의 E8 출력(잔여 wp4로 인한 예상 FAIL)을 인용 | 메인 세션 실행 |

## 수용 기준

- 011/021/031의 발견을 각각 2건 이상 교차 인용하되, 식별 토큰 형식 `011#H-1`,
  `021#M-2`, `031#L-1`(문서 축약명 + '#' + 항목 번호)을 사용한다 — C가 소스별 고유
  토큰 수를 기계 검증한다.
- 권고마다 근거 문서 참조.
- 최종 E8 통과 출력은 wp4 D-close 직후 메인 세션이 실행해 goal 종료 보고와 유닛 ledger에
  기록한다(문서 자체에는 C 시점의 예상-FAIL 출력과 경로 서술만 들어간다).

## D-close 후 마감 시퀀스 (순서 고정)

`advanceWorkPhase()`는 workPhases만 갱신하고 criteria는 건드리지 않으므로(런타임에
criterion-marking 헬퍼 없음), 메인 세션이 명시적으로 수행한다. 이 시퀀스는 goalplan
태스크가 아니라 메인 세션 의무다(D-close가 wp4의 모든 태스크를 자동 done 처리하므로
태스크로 두면 원장이 거짓이 된다 — `goalplan.ts:299-323`):

1. `cxc orchestrate D --session <id>` — wp4 D-close (ledger에 4번째 D 전이 기록됨).
2. c5 기록: goalplan.json의 c5에 `capturedEvidence`(루트 ledger의 D 전이 4건 발췌 +
   시각)를 기입하고 `status: "met"`으로 마킹. c5의 증거 계약은 D 전이 4건까지만이다 —
   "최종 validate 통과 출력"을 c5 증거로 요구하면 자기 참조(validate는 c5 met 이후에만
   통과 가능)가 되므로, E8 통과 증명은 c5 밖의 goal 종료 관문(아래 3~4단계)이 담당한다.
   같은 단계에서 c6도 기록한다: 041의 교차 인용 토큰 카운트(C 검증 출력)를
   `capturedEvidence`로 기입하고 met 마킹 — c6를 빠뜨리면 3단계 E8이 unmet c6로
   실패한다(리뷰어 시뮬레이션 확인). (c1~c4는 각 사이클 D에서 기록 완료.)
3. 최종 E8: `node bin/codexclaw.mjs loop validate --slug codexclaw-devlog-260710-repo-review-000-plan-010 --cwd <root>`
   — 성공 exit 0 필수. 이 출력은 goal 종료 보고와 유닛 D 요약에 기록한다(c5 증거 아님).
4. `update_goal {status:"complete"}` — GOAL-COMPLETE-GATE-01이 같은 E8을 재실행해 이중 확인.

## C 검증 명령 (실행 가능형)

```bash
set -e
cd /Users/jun/Developer/new/700_projects/codexclaw
doc=devlog/_plan/260710_repo_review/041_synthesis.md
test -f "$doc"
# 소스별 "고유" 발견 토큰(예: 011#H-1) 2개 이상 — 중복 문자열은 sort -u로 접는다.
for src in 011 021 031; do
  n=$(rg -o "${src}#[HML]-[0-9]+" "$doc" | sort -u | wc -l | tr -d ' ')
  [ "$n" -ge 2 ] || { echo "FAIL: $src distinct finding tokens $n < 2"; exit 1; }
  echo "PASS: $src distinct=$n"
done
# C 시점 E8: 예상-실패 형태(wp4 not done)만 허용, 다른 실패는 C 실패.
out=$(node bin/codexclaw.mjs loop validate --slug codexclaw-devlog-260710-repo-review-000-plan-010 --cwd "$PWD" 2>&1) || true
echo "$out"
echo "$out" | grep -q 'not done' || { echo "FAIL: unexpected E8 shape"; exit 1; }
echo "$out" | grep -q 'no plan found' && { echo "FAIL: goalplan missing/corrupt"; exit 1; }
# 041 §4가 E8 출력을 실제로 인용했는지 검사.
rg -q 'loop validate.*FAIL|not done' "$doc" || { echo "FAIL: 041 §4 does not quote E8 output"; exit 1; }
echo "C PASS"
# 최종 E8 통과 검증(exit 0)은 wp4 D-close + c5/c6 기록 직후 별도 실행(마감 시퀀스 3단계).
```
