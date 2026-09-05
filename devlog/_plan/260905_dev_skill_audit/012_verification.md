# 검증과 종료 기록

## 현재 기록 범위

B 문서 산출물을 작성했다. C 검사와 독립 감사, D 종료는 아래에 실제 결과를 추가한 뒤 완료로 표시한다. 이 문서는 아직 실행하지 않은 명령을 통과로 표시하지 않는다.

## 산출물

- `000_plan.md`: 한 docs-only cycle과 인터뷰 경계.
- `001_inventory.md`: 13개 router별 진단, 189개 파일 provenance, 읽기 깊이와 한계.
- `002_findings.md`: 21개 항목. 내부 충돌/외부 계약 오류/범위 보완/정책 질문 분리.
- `003_sources.md`: 공식 원문 10개와 Aside 실행, 기각한 fetch 결과.
- `004_interview.md`: 답변되지 않은 첫 질문과 스킬별 후속 질문.
- `010_docs_delivery.md`: 문서 계약과 negative 검증.
- `011_audit.md`: 실제 독립 감사와 지적 수용 기록.
- `evidence/`: 인벤토리·출처·관찰값·문서 검증기. 제품 코드는 포함하지 않는다.

## 검증의 한계

전체 제품 테스트나 빌드는 실행하지 않는다. 문서 hash/목록/참조 무결성과 변경 범위를 검사하고, 문장과 근거의 의미 일치는 독립 감사로 검토한다. 이 검증은 기존 21개 항목의 결함이 고쳐졌다는 증거가 아니다.

## B/C/D 실행 기록

- B: `node <unit>/evidence/verify.mjs --self-test` → exit 0. 정상 fixture와 COVERAGE/HASH/CITATION/SOURCE/SCOPE negative 5개를 독립 확인했다.
- B 최초 실제 문서 검사: exit 1, implementation-log 88줄 인용이 실제 78줄 파일을 벗어난다고 검출했다. 75줄로 고치고 다시 실행해 exit 0을 확인했다. 의미상 더 정확한 다른 인용 번호도 직접 대조해 수정했다.
- B/C 실제 문서 검사: `DOCS PASS: 13 routers; 189 source hashes; 59 citations; 21 findings; 10 sources; 12 scoped paths`, exit 0.
- 누락 unit 입력: `node <unit>/evidence/verify.mjs <unit>/does-not-exist` → exit 1, ENOENT. 오류를 성공으로 삼킨 검증기가 아님을 확인했다.
- C: `cxc receipt test --session 01a0702d-41a2-7640-a78b-6e761b42e3ab -- node <unit>/evidence/verify.mjs --self-test` → exit 0, session evidence 아래 test-receipt.json 생성. 최종 tree 검사 receipt는 감사 보완을 마친 뒤 다시 생성한다.
- checkpoint: `5b8a0379` — `docs: audit dev skills before modernization interview`. 문서/evidence 12개만 포함했다. push하지 않았다.
- 도구 경로: PATH의 cxc는 `/Users/jun/Developer/new/700_projects/codexclaw/bin/codexclaw.mjs`로 연결돼 있다. 실행 cwd와 session state는 이 managed worktree에 유지했다. 활성 worktree를 이동하거나 교체하지 않았다.
- browser cleanup: 이번에 시작한 agbrowse Chrome을 `agbrowse stop`으로 종료했다. Aside는 한 번의 repl 실행 후 정상 종료했다.
- C 독립 감사와 D: 아직 대기 중. 아래 후속 기록으로 실제 결과를 남긴다.

## C 감사 보완

독립 감사 B1을 수용했다. 이전 `DOCS PASS`는 repository hash만 확인했으므로 설치본 동일성의 증거가 아니었다. manifest의 설치본 hash·추가 파일과 validator를 보완했고 185개 동일/4개 상이/1개 실질 추가를 직접 확인했다. 처음의 189개 동일 주장은 현재 결론에서 철회했다. 자세한 원인·판단은 `011_audit.md`에 기록했다.

최종 C 재검증은 `VERDICT: PASS`, blocker 0개다. 같은 reviewer가 보완된 7개 파일과 실제 설치본을 다시 읽었다. goalplan의 기존 task outcome은 불변이므로 덮어쓰지 않고 `cxc loop steer`의 `docs-audit-provenance-correction-20260905` annotate로 초기 equality 부분을 정정했다. 원장 이력을 삭제하지 않았다.

## C 검증 결과

```text
SELF-TEST PASS: valid fixture + 5 independent negative fixtures
DOCS PASS: 13 routers; 189 source hashes; 59 citations; 21 findings; 10 sources; 12 scoped paths
INSTALLED PASS: 185 equal; 4 different; 1 substantive extra file(s)
```

각 명령 exit 0. 최종 C receipt 발행과 D 종료 후 아래에 종료 결과를 추가한다.
