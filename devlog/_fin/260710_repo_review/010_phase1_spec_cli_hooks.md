# 010 — Phase 1 스펙: CLI/hook 검토 문서 (사이클 1)

산출물: `011_cli_hooks_review.md` (NEW). 이 스펙은 사이클 1 P의 사전 확정본이며,
B는 이 스펙을 그대로 실행한다. 근거 소스는 유닛 내 영속 연구 문서 001/002.

## 산출물 섹션 스펙

| # | 섹션 | 내용 | 근거 소스 |
|---|------|------|-----------|
| 1 | 검토 범위와 방법 | 대상 경로, 파견 에이전트(모델/역할/왕복), 검증 명령 | 본 유닛 000/001/002 |
| 2 | CLI 표면 맵 | `bin/codexclaw.mjs` 명령별 디스패치 표(위임 컴포넌트 포함) | `001_research_cli.md` §1 |
| 3 | 활성 hook 레지스트리 | `plugins/codexclaw/hooks/*.json` 전수 vs `plugins/codexclaw/.codex-plugin/plugin.json` hooks 배열 — 활성 13/전체 20 표 | manifest 실측(B에서 `ls`+`python3 json` 재실측) |
| 4 | hook 이벤트 맵 | 5개 이벤트 핸들러 위치·책임 | `002_research_hooks.md` §1 |
| 5 | Stop-continuation 구현 | GOAL-IDLE-CONTINUE-01, MAX_STOP_BLOCKS=3, context-pressure, plateau | `002_research_hooks.md` §2 |
| 6 | guard/gate 구현 | LEAF-TOPOLOGY-01, GOAL-COMPLETE-GATE-01 | `002_research_hooks.md` §3 |
| 7 | 발견 사항 | High/Med/Low 번호 목록, `path:line`+인용, 001§3+002§4 통합(스팟체크 통과분만) | 001/002 |
| 8 | 테스트 존재 표 | `plugins/codexclaw/components/*/test` 존재 여부(내용 감사 제외 사유) | B에서 `ls` 실측 |
| 9 | 리뷰어 verdict | A게이트 라운드 이력(1~N)과 최종 verdict | 리뷰어 반환문 + `.codexclaw/evidence/` |

## 수용 기준

- 실제 `path:line` 근거 5개 이상(예상 15+), 인용 경로는 저장소 루트 기준 실존 경로.
- 스팟체크(000_plan 공통 정의: seed 기록, 무작위 3건 원본 대조) 통과.
- verdict 기록 포함.

## C 검증 명령 (실행 가능형)

```bash
set -e
cd /Users/jun/Developer/new/700_projects/codexclaw
doc=devlog/_plan/260710_repo_review/011_cli_hooks_review.md
test -f "$doc"
n=$(rg -c ':[0-9]+' "$doc"); [ "$n" -ge 5 ] || { echo "FAIL: citations $n < 5"; exit 1; }
echo "PASS: citations=$n"
# 스팟체크(수동 단계): python3 random.seed(<attest 기록>)로 인용 3건 추출,
# nl -ba <원본> | sed -n '<라인>p' 대조 — 불일치 1건이라도 있으면 C 실패로 B 재작업.
```
