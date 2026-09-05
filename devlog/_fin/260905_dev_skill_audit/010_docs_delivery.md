# wp1 문서 산출 명세

의존성: `000_plan.md`의 범위. 이 문서는 스킬 개편안이 아니라 이번 조사 산출물의 계약이다.

## 파일 변경표

모두 NEW이며 기존 문서는 삭제·수정하지 않는다. 종료 시 unit 전체만 `_fin/260905_dev_skill_audit/`로 보관한다.

| 파일 | 필수 내용과 구조 |
|---|---|
| 001_inventory.md | 기준 SHA, installed/source 비교, 13개 이름별 행, reference 파일 수, 검토 깊이, 미검증 영역 |
| 002_findings.md | finding ID, 유형, 중요도, 양쪽 path:line, 재현 입력, 행동 차이, 수정 후보와 사용자 질문 |
| 003_sources.md | ID, URL, 발행일 또는 미표시, 확인일, 공식성, proving surface, 읽은 내용과 한계 |
| 004_interview.md | 의존 순서에 따른 개별 질문, 첫 질문, 미결정 답변을 답한 것으로 취급하지 않는 경계 |
| 011_audit.md | A reviewer 실제 verdict와 disposition, C 새 검토, 반론과 수정 |
| 012_verification.md | fresh 명령과 결과, 원장 참조, 구현 미착수, 실제 종료 상태 |
| evidence/inventory.json | 모든 dev family 파일의 상대 경로·크기·SHA256, installed 비교 |
| evidence/verify.mjs | Node 표준 라이브러리만 사용. 인자로 받은 unit을 읽고 13개 coverage·파일 hash·finding/source ID·citation 경로·필수 문서·범위를 검증 |
| evidence/* | 필요한 공개 조사 증거. 개인 데이터와 credentials 제외 |

본문은 조사 후 실제 근거로 채운다. 없는 결론을 계획 단계에서 완성본으로 만들지 않는다. P의 계획은 위 파일 집합과 필수 필드를 확정하며, 변경 범위 밖의 스킬 diff는 생성하지 않는다.

## 검증 설계

`node <unit>/evidence/verify.mjs <unit>`로 해당 unit을 직접 읽는다. 누락 router, 원본 hash drift, 존재하지 않는 citation, source 상태 혼동, 범위 밖 변경은 실패 처리한다. 문장 판단과 기술 근거가 서로 맞는지는 독립 reviewer가 직접 확인한다.

문서만 추가하는 작업이므로 제품 테스트는 N/A다. P에서 새 검증기를 존재하는 검증기로 주장하지 않았으며 B 구현 후 A 계약과 대조하고 C에서 실제 동작을 확인한다.

## A 감사 반영: 거절 경로 검증

검증기는 읽은 입력을 순수 검증 함수에 전달한다. `--self-test`는 정상 fixture와 결함을 하나씩 넣은 독립 in-memory fixture를 비교한다. 실제 스킬이나 evidence 파일을 훼손하지 않는다.

| 변형 | 기대 결과 |
|---|---|
| 정상 fixture | 오류 0개 |
| router 1개 누락 | COVERAGE 오류 |
| 원본 hash 다른 값 | HASH 오류 |
| 존재하지 않는 citation | CITATION 오류 |
| source 상태를 verified로 쓰고 증거 제거 | SOURCE 오류 |
| 허용 범위 밖 파일 변경 목록 | SCOPE 오류 |

각 negative는 해당 오류가 반드시 발생해야 self-test가 통과한다. 검증 명령 자체의 입력 경로가 없을 때도 nonzero 종료를 확인한다. 이 검사는 의미 판단을 대체하지 않는다.
