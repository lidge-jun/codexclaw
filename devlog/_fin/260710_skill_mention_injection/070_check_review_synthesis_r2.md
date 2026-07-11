# 070 — C-Gate Review Round 2 Synthesis (Kierkegaard, VERDICT: FAIL, 3 High)

B1(v1 D1)은 리뷰어가 pre-unit provenance로 수용 종결. 새 3건은 모두 스캐너
엣지케이스로 ACCEPT. 같은 실패 계열(수제 마크다운 스팬 파서) 2연속 FAIL이므로
LOOP-REPAIR-01 root-cause 모드: 스팟 패치가 아니라 스캔 구조 자체를 교체한다.

## Root cause
스팬 탐지가 "현재 위치에서 앞을 다시 세는" 비단조(non-monotonic) 헬퍼들로
조립되어 있어 (a) 문자마다 런을 재계산해 O(n^2)가 재발하고 (b) CommonMark
규칙(닫는 펜스 뒤 공백만 허용, <=3 스페이스 들여쓰기, 제목 따옴표 안 괄호)이
헬퍼 사이에 흩어져 어긋난다.

## Fix design (repair r2)
단일 전진 상태기계로 재작성: 인덱스가 항상 단조 증가(모든 런/스팬을 한 번에
소비), 상태 = normal | fence(open run len) | inline-code(run len) 	| link.
- 펜스 열기/닫기: 줄 시작 기준, <=3 스페이스 들여쓰기 허용, 닫기는 run >= open
  이고 그 뒤 공백만.
- 틸드/백틱 런은 한 번의 스캔으로 통째 소비(문자별 재계산 금지).
- 링크 타깃: destination/title 문법 파싱(따옴표 제목 내부 괄호는 구조로 취급
  안 함); 전역 괄호 스택 폐기.
- 성능 테스트 3종: unmatched `[` / mid-line tilde run / paren-in-title 각
  128KiB < 1s.
