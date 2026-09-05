# Dev 스킬 최신화 전 조사

- 작성일: 2026-09-05 KST
- 기준 checkout: `/Users/jun/.codex/worktrees/297d/codexclaw`
- 기준 HEAD: `048ae759c715051f2fde807624e85cf1ec6c6d55`
- 세션: `01a0702d-41a2-7640-a78b-6e761b42e3ab`
- 분류: C3 docs-only. 실제 정책 개편은 인터뷰 전이므로 미결정이다.
- 범위: dev + dev-* 12개, 해당 파일 목록 전체, 관련 workflow/search/browser 규칙 대조.
- 제외: 스킬 수정, 코드 변경, 설정 변경, 설치, push/merge/release/deploy, 계정 생성과 메시지 전송.

## Loop spec

| 항목 | 계약 |
|---|---|
| Archetype | 조사 결과의 증거·범위 충족 여부를 확인하는 spec-satisfaction |
| Trigger | 사용자가 전체 조사와 모순 문서화를 끝낸 뒤 인터뷰 요청 |
| Goal | 개별 스킬 수정의 판단 근거와 질문을 devlog에 남김 |
| Stop | 13개 router 개별 검토, 근거 원장, 독립 감사, 문서 검증, D 종료 |
| Memory artifact | 이 unit과 session-bound goalplan/ledger |
| Verifier | 아래 inventory 실행, `git diff --check`, B에서 추가할 문서 검증기와 독립 감사 |
| Outcomes | 문서화 DONE / 구현 미착수. 접근 실패는 한계로 명시하고 대체 공식 출처 확인 |
| Escalation | 정책 선택은 인터뷰로 남김. 위험 권한이나 유료 접근 필요 시 해당 조사 중단 |
| Delegation | A 계획 감사 1명; C 새 감사 1명. 읽기만 허용. 두 reviewer가 같은 packet에 실패하면 본 세션이 회수 |
| Resources | 90분, 공식 페이지 proof 20회 이하, Aside read-only 1회·120초, 동시 reviewer 2명 이하, 구매 없음 |

## 한 사이클만 등록한 이유

`wp1`은 전체 조사와 문서화다. P→A→B→C→D가 모두 끝나면 host goal을 완료하고 HITL I로 전환한다. 이후 스킬별 수정은 사용자 답변을 받아 별도로 설계한다. 아직 결정하지 않은 개편안을 구현 단계로 등록하거나 diff 확정으로 위장하지 않는다. 이는 다단계 구현 로드맵을 잠그는 작업이 아니다.

## 구조와 변경 범위

기존 `devlog/_plan` → `_fin` 관례를 사용한다. source-of-truth는 `structure/INDEX.md`, `structure/00_philosophy.md`, `structure/20_pabcd_dispatch_doctrine.md`다. 이번에는 정책 자체를 바꾸지 않으므로 해당 SoT도 수정하지 않는다.

```text
plugins/codexclaw/skills/  읽기 전용 조사 대상
  dev/ + dev-*/           13개 router와 참조 목록
  pabcd/ loop/ search/    교차 규칙
devlog/_plan/260905_dev_skill_audit/
  000_plan.md            범위·단일 cycle 계약
  001_inventory.md       개별 스킬 진단·provenance·읽기 깊이
  002_findings.md        충돌·오래된 기술 안내·정책 판단 분리
  003_sources.md         공식 출처·Aside 증거 원장
  004_interview.md       질문과 미결정 사항
  010_docs_delivery.md   문서 변경 명세·검증 계약
  011_audit.md           A/C 감사와 판단
  012_verification.md    실행 결과와 D 종료
  evidence/              목록·읽기 증거·문서 검증기
```

## P 단계에서 실행한 검증

- `node --input-type=module -e '...fs.readdirSync("plugins/codexclaw/skills").../^dev($|-)/...'`: exit 0. router 이름·SKILL 길이·전체 파일 수를 직접 읽었다. 인벤토리 누락 검출용이지 문장의 타당성 증명은 아니다.
- `git diff --check`: exit 0. whitespace만 확인한다. 의미 검증은 하지 않는다.
- `cxc map plugins/codexclaw/skills`: exit 0. Python/JS helper 중심 맵이며 Markdown 규칙을 대신 읽어주지 않는다.
- `python3 plugins/codexclaw/skills/search/scripts/agbrowse_helper.py doctor`: exit 0, `/Users/jun/.local/bin/agbrowse` 확인.
- `aside --version`: exit 0, `1.26.902.1732`. 로그인 상태나 API 성공까지 증명하지는 않는다.
- `cxc receipt test --help`: 지원하지 않는 인자로 거절됨. 실행 계약은 실제 CLI 소스에서 확인 후 사용한다.

새 검증기는 기존 명령으로 가장하지 않는다. B에서 완성한 뒤 실제 파일 경로를 인자로 받아 검사하고, C에서 `cxc receipt test`로 재실행한다. 전체 테스트나 typecheck는 prose 변경을 검증하지 못하므로 실행하지 않는다.

## 완료 기준

1. 13개 router별 담당 영역·읽기 범위·모순 또는 검토 결과·인터뷰 질문.
2. 내부 충돌은 양쪽 file:line과 같은 입력에서 갈리는 행동을 기록. 기술 오류와 취향을 구분.
3. 공식 원문을 열어 기술 주장을 검증. 검색 요약만 읽은 것은 미검증으로 표시.
4. Aside를 실제 read-only 호출하고 결과 또는 정확한 실패를 남김. 비밀과 무관한 개인 정보는 기록하지 않음.
5. 독립 감사와 fresh 문서 검증. 이번 unit 이외 추적 파일 변경 없음.
6. 로컬 commit, D/IDLE, goalplan 검증 뒤 인터뷰. push는 하지 않음.

## D 종료

`wp1` 문서화는 DONE이다. C 최종 감사 PASS, 실문서 receipt 발행 후 D를 실행해 `close target wp1 is complete`와 IDLE을 확인했다. 구현은 미착수다. 이후 작업은 `004_interview.md`의 Q01부터 사용자의 정책 선택을 받는다. unit은 기존 관례대로 `_fin/260905_dev_skill_audit/`에 보관한다. 검증·정정 과정은 `011_audit.md`, `012_verification.md`에 있다.
