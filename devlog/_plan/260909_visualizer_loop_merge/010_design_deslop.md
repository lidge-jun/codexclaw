# 010 wp2: 디자인 de-slop, CJK 조판, v2 재출력

## 문제

v2 PDF는 논지와 조판 결함은 해결됐지만 시각 문법이 AI 템플릿이다. 확인된 신호: 큰 숫자 카드 4개 가로 배열, 왼쪽 색 띠 콜아웃, 동그라미 번호 목록, 연한 배경의 둥근 박스, 사각형+화살표 도식, 대문자 자간 eyebrow와 파란 룰바, 모든 절이 같은 리듬(제목→도입→표→자료), 시스템 기본 서체. 실제 McKinsey·증권사 PDF는 박스가 거의 없고 괘선·여백·서체 위계로 구분하며 강조색 하나를 드물게 쓰고 데이터 차트가 페이지의 주인이다.

## 변경 (diff-level)

1. `reference/visual-design.md`: REPORT-DESIGN-01 (STRICT for delivered reports) 추가. 금지 부품을 이름으로 나열(stat card grid, left-border callout, numbered circle list, tinted rounded box, box-and-arrow SVG as default, uppercase tracked eyebrow, decorative rule bar). 대체: 괘선(0.5pt)과 여백, 서체 위계(제목 서체 1 + 본문 서체 1), 강조색 1개를 도표의 핵심 시리즈와 요청 사항에만, 지표는 작은 표 또는 문장 속 숫자, 도식은 데이터가 있는 차트 우선, 페이지마다 시각적 사건 하나. 작업 순서: 쓰기 전에 서체 두 벌·강조색·괘선 규칙을 정하고(dev-uiux-design과 짝) 그것만 쓴다.
2. `assets/paged-report.html` 재작성: 편집 디자인. 표지는 서체와 여백으로만(룰바 제거, 발행 조직명은 상단 작은 글자, 제목 크게, 하단 메타는 한 줄 괘선 위). 요약 페이지는 프로즈 + 핵심 수치 표(3~4행, 기준→현재→변화). 본문은 좁은 본문 폭(약 120mm)과 바깥 여백(약 40mm)에 캡션·자료·주석을 두는 2단 격자. 표는 상하 괘선만. 그림은 데이터 있는 SVG 막대/선 차트 예시 1개(직접 라벨, 강조 시리즈 1개). 콜아웃은 들여쓰기 + 작은 제목으로. 브랜드 토큰 블록 유지. 서체: Pretendard(본문)/Noto Serif KR(제목) 폰트 스택, 없으면 Apple SD Gothic Neo·Noto Sans KR로 폴백(임베딩은 라이선스 확인 후, G 레인 결과 반영).
3. CJK 조판: G 레인(Aside 세션 `9jEqOLwYyRrG4sTs`, 결과는 `~/.aside/u/0/research/260909-report-style/G_cjk_typography.md` → 이 unit의 `evidence/aside-G_cjk_typography.md`로 복사) 도착 후 `document-pdf.md` "Fonts and Korean text" 절에 ko/ja/zh 인쇄 CSS 레시피(word-break/line-break/text-spacing/hanging-punctuation, 행간, 본문 크기)와 폰트 표(라이선스·임베딩 가능)를 넣는다. wp2 D 시점에 미도착이면 CJK 항목은 wp2 acceptance에서 제외하고 criterion c-2는 열어 둔 채 wp3 P에서 다시 본다(도착 시 wp3 안에서 접거나 wp7 amendment).
   양식의 샘플 내용은 가상의 회사·수치로 바꾼다(현재 샘플은 고객 수치를 담고 있어 공개 레포에 나갈 수 없다).
4. `scripts/export-paged-report.mjs`: 새 격자에서도 QA 동작 확인(여백이 넓어지면 blank 비율 계산의 areaBottom/top 가정 점검).
5. client report v2 재출력(`<client workspace>/client-report_v2.{html,pdf}`, 레포 밖), fresh-read(google-antigravity/gemini-3.8-flash, 렌더링 페이지만) 재실행, 슬롭 신호 잔존 여부를 직접 묻는다. fresh-read 결과는 고객 내용을 인용하므로 `_skill-audit/`에 두고 devlog에는 요약 3줄만 적는다.
6. SKILL.md 라우팅 표와 skills/README 설명 갱신, `devlog/_plan/260909_visualizer_report_quality/000_plan.md`에 이 단계의 결론 추가. 그 unit의 `evidence/`에서 비공개 파일(neuralarcade-v2.html, qa-v2-neuralarcade.txt, fresh-read-v2-gemini.md, audit-gemini-3-8-flash.md, qa-before-after.md의 고객 인용)을 `_skill-audit/`로 옮기고 devlog에는 파일명과 요약만 남긴다.

## 검증

- export QA PASS(양식·v2), 페이지 이미지 육안 확인(표지·요약·본문·부록), REPORT-VIZ-01 인쇄 크기 확인.
- fresh-read: 답·근거·요청 + "AI 템플릿처럼 보이는 요소" 질문에 남은 항목 0~1개.
- `node plugins/codexclaw/scripts/test.mjs` skill-catalog, visualize-inspection; inventory --check.

## 하지 않는 것

Devfiance 브랜드 자산(로고·지정색·서체) 생성. 자산이 오면 토큰 블록에 꽂는다.

## D 결론 (wp2)

양식은 명조 제목·괘선·단일 강조색·데이터 막대 차트로 다시 짰고(`a917fbfb`), 회사·수치는 가상으로 바꿨다. REPORT-DESIGN-01(visual-design.md)과 CJK 인쇄 레시피·OFL 폰트 표(document-pdf.md, G 레인 근거 `evidence/aside-G_cjk_typography.md`)를 넣었다. 양식 7쪽 PASS. client report v2(레포 밖)는 8~9쪽으로 재출력, 사각형+화살표 도식을 캠페인별 ROAS 전후 막대 차트로 교체, fresh-read(gemini-3.8-flash, `_skill-audit/fresh-read-v3-gemini.md`)는 카드·동그라미 번호·화살표 블록 제거와 데이터 차트, 주장형 목차를 개선으로 판정했고, 지적한 고아 제목과 백지 페이지는 절 제목+도입+첫 표를 `.keep`으로 묶어 해결했다. 남은 QA P2 하나(5쪽 하단 31% 공백)는 3절 제목 고립을 피한 대가로 수용한다. 교훈: 제목+도입+첫 표는 기본으로 묶는다(document-pdf REPORT-PRINT-01 항목 5에 반영됨). 방향 유지: 다음은 wp7(codexclaw 전반 반영) → wp3(PR).
