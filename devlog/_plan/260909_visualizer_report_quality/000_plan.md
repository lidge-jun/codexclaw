# cxc-dev-visualizer: rename and report quality (storyline, cover/contents, print QA)

기준 HEAD: `5f11fb8b` (origin/dev). 브랜치: `codex/dev-visualizer-rename`. 세션: `01a08654-a5d0-71c0-a348-922a0b3ed7ff`.
요청: 스킬 이름을 `cxc-dev-visualizer`로 바꾸고, 어제 이 스킬로 만든 고객사 보고서가 왜 슬롭처럼 읽히는지 서브에이전트(anthropic/claude-opus-4-6, google-antigravity/gemini-3.8-flash)와 Aside 조사 레인으로 감사한 뒤, 컨설팅·증권사·공공 보고서 관행과 patina를 참고해 글쓰기 규칙과 표지·목차가 있는 PDF 양식을 넣는다.

## 독자 요약

어제 PDF가 슬롭처럼 읽힌 이유는 세 층이다. 문서 층: 절 제목이 주제형이라 논지가 쌓이지 않고, 요약이 조각 불릿이며, 공급자 활동(커밋 수)이 근거 자리에 있다. 조판 층: Letter 판형, 쪽번호 없음, 5쪽 머리에 "구간입니다." 고아줄, 절마다 강제 페이지 나눔으로 반쪽 빈 페이지, 6pt 회색 도표 글자. 규칙 층: reader-documents의 "기승전결 never for reports" 문장이 서사 자체를 버리라는 뜻으로 읽혔고, document-pdf의 인쇄 CSS가 "adaptable, not compulsory"라 지켜지지 않았으며, 렌더 확인 체크리스트가 없었다.

고친 것: 스킬을 `dev-visualizer`로 옮기고(옛 폴더는 redirect), `reference/report-writing.md`(REPORT-STORY/SUMMARY/PARA/REGISTER/EXHIBIT/ANATOMY/BRAND/POLISH/FRESH)를 추가하고, `assets/paged-report.html`(A4 표지·목차·요약·본문·부록·고지, 브랜드 토큰 블록)과 `scripts/export-paged-report.mjs`(2패스 목차 쪽번호 + 조판 QA, `--qa-only`)를 넣었다. `document-pdf.md`에 REPORT-PRINT-01/QA-01과 측정된 엔진 지원표, `visual-design.md`에 REPORT-VIZ-01, reader-documents의 기승전결 문장을 고쳤다.

## 증거

| 파일 | 내용 |
|---|---|
| `evidence/audit-gemini-3-8-flash.md` | google-antigravity/gemini-3.8-flash 감사: SCQA 서사 실종, 주제형 제목, 6pt 도표, 고아줄, 규칙 초안 REPORT-STORY/PRINT/VIZ/QA |
| (없음) | anthropic/claude-opus-4-6 감사는 45분 넘게 결과 파일을 쓰지 못하고 종료됨(사용자 확인 "뒤졌어"). Gemini 감사와 fresh-read로 대체 |
| `evidence/fresh-read-v2-gemini.md` | v2 보고서 fresh-reader 검증(gemini-3.8-flash, 렌더링 페이지만 읽음): 답·근거·요청은 통과, 표가 페이지 경계에서 1행만 넘어가는 절단(6~7, 7~8쪽)과 명사형 소제목 지적 → `table.keep`·`.keep` 래퍼와 주장형 소제목으로 수정, 재검사 PASS |
| `evidence/qa-v2-neuralarcade.txt` | v2 PDF `--qa-only` 결과 |
| `evidence/aside-A_consulting.md` | Minto 피라미드 3원칙·SCQA, McKinsey action title·dot-dash·ghost deck, Zelazny 5 비교, Bain answer-first·At a Glance, BCG·MGI 리포트 해부 |
| `evidence/aside-B_korea.md` | 금투협 조사분석자료 규정, 삼성·SK·교보증권 리포트 해부(1쪽 요약·자료: 줄·컴플라이언스), KDI/한은/행안부 편람·청와대 매뉴얼(두괄식, 문장 2~3줄, `2026. 9. 9.`, 이중피동 금지), 평서체/합쇼체/개조식 구분 |
| `evidence/aside-D_opensource.md` | patina(MIT, D/P 레인, droppedNumbers 검증, KR AI 신호 목록), Paged.js/WeasyPrint/Typst/Quarto 페이지 퍼니처, Vale/textlint 규칙 |
| (레포 밖) 동료 피드백 원문 | 동료 피드백(비공개 메신저, 원문은 레포 밖): em dash·AI 말투가 PDF에 그대로, 첫 페이지부터 Devfiance로, the issuing company 양식·BI 일관성, 잘 읽히게가 본질 |
| `evidence/chrome-paged-probe.md` | Chrome 152 인쇄 CSS 지원 측정 |
| `evidence/qa-before-after.md` | 어제 PDF와 새 양식의 스크립트 QA 결과 |
| `evidence/aside-C_japan_intl.md` | 일본 셀사이드(1쪽 대시보드, 주장형 헤드라인)·白書(概要 별책, 総目次/目次/凡例)·NRI/MRI(提言① 제목), GS/MS/JPM(3질문 Overview), GAO Highlights, GOV.UK, World Bank/IMF/OECD, Deloitte/PwC/EY 비교표 |
| `evidence/aside-F_chatgpt_pro.md` | ChatGPT Pro(@github + PDF) 의견: Aside 세션 `9RO6smtQfn6zbpDU`가 비동기 진행 중, 도착 시 추가 |

## 검증

- `node plugins/codexclaw/scripts/inventory.mjs --check`: 29 skills OK.
- `node plugins/codexclaw/scripts/test.mjs` skill-catalog, visualize-inspection, subagent-config: 229 pass.
- 양식 export: 6쪽 A4, 목차 쪽번호 6건 일치, QA PASS; 페이지 이미지 육안 확인(표지·목차·요약·본문 2쪽·부록).
- 어제 PDF `--qa-only`: Letter, 쪽번호 없음 8쪽, 고아줄 p5, 공백 p2 검출.

## 남은 것

- Aside F(ChatGPT Pro) 결과 반영.
- v2 초안(`<client workspace, outside the repo>/client-report_v2.{html,pdf}`)은 동료 검토용이며 원본은 그대로 둠. Devfiance 표기, em dash 0건, 8쪽 A4, QA PASS.
- patina CLI 설치 여부 확인 후 REPORT-POLISH-01의 실행 경로 확정.
- PR 생성과 머지는 별도 승인 후.
