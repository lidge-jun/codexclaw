# 020 — Phase 2 스펙: 스킬/독트린 일관성 검토 문서 (사이클 2)

산출물: `021_skills_doctrine_review.md` (NEW). 근거 소스는 영속 연구 문서 003.

## 산출물 섹션 스펙

| # | 섹션 | 내용 | 근거 소스 |
|---|------|------|-----------|
| 1 | 검토 범위 | skills 디렉터리 전수 목록, structure/*.md 8개 | B에서 `ls` 실측 |
| 2 | 규칙 ID 교차표 | 규칙 ID별 skills/structure 선언 위치·일치 여부 | `003_research_doctrine.md` §1 |
| 3 | canonical 소유 검증 | 소유 선언 vs 실제 위치, 불일치 2건 상세 | `003_research_doctrine.md` §2 |
| 4 | deprecated 잔존 참조 | 3종 스킬의 활성형 잔존 위치 전수 | `003_research_doctrine.md` §3 (B에서 rg 재실측) |
| 5 | 발견 사항 | High/Med/Low, `path:line`+인용(스팟체크 통과분만) | 003 §4 |
| 6 | 리뷰어 verdict | A게이트 이력 + 최종 verdict | 리뷰어 반환문 |

## 수용 기준

- skills/structure `path:line` 근거 5개 이상, 스팟체크(공통 정의) 통과, verdict 기록.

## C 검증 명령 (실행 가능형)

```bash
set -e
cd /Users/jun/Developer/new/700_projects/codexclaw
doc=devlog/_plan/260710_repo_review/021_skills_doctrine_review.md
test -f "$doc"
n=$(rg -c ':[0-9]+' "$doc"); [ "$n" -ge 5 ] || { echo "FAIL: citations $n < 5"; exit 1; }
echo "PASS: citations=$n"
# 스팟체크(수동 단계): 공통 정의대로 무작위 3건 원본 대조(seed는 attest 기록).
```
