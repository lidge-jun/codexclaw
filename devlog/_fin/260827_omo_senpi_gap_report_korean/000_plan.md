# 42쪽 격차 보고서 한국어 전면 교정

## 목표

`output/pdf/codexclaw-omo-senpi-gap-analysis-ko.pdf`의 사용자 가시 문구를 전부 자연스러운 한국어로 바꾼다. 영문은 제품명, 코드, 파일 경로, 약어, 고유 명령처럼 번역하면 의미가 훼손되는 기술 식별자에만 남긴다.

## 작업 등급

- C3: 42쪽 PDF 전체의 문안과 도표 레이아웃을 함께 바꾸고 렌더 검증이 필요하다.

## 범위

- 1~39쪽: 제목, 설명, 진단 질문, 의사결정 기준, 관찰 근거, 결론, 책임자, KPI, 위험, 도표·표 문구.
- 40~42쪽: 방법론, 근거 지도, 점수 원장, 불확실성 설명.
- 공통: 머리말, 꼬리말, 도표 제목, 표 머리글, 축, 상태 및 안내 문구.
- 제외: CodexClaw/OMO/Senpi, PABCD, KPI, N/E, SHA, 파일 경로, 코드 식별자, 버전.

## 검증

1. 42쪽 A4 구조·보안·텍스트 경계 검사.
2. 전체 페이지 PNG 렌더와 접촉면 3장 육안 검사.
3. `tmp/pdfs/verify_korean_localization.py`로 1~42쪽을 각각 검사한다. 경로·코드·정확 허용 토큰을 먼저 제거한 뒤 라틴 문자 하나라도 남으면 해당 페이지를 FAIL 처리한다. 한글 글자 1개 이상도 페이지별 필수다.
4. `pdftotext -layout` 결과를 페이지별로 저장하고, `localizationCoverage`, `residualLatin`, `hangulCount`를 42행 JSON 원장으로 남긴다. pypdf로 존재하는 모든 문서 정보 키를 순회하며 `/Title`, `/Subject`, `/Author`, `/Keywords`, `/Creator`, `/Producer`를 같은 규칙으로 검사한다. 제목·주제·작성자·생성기·프로듀서에는 한글이 필수다.
5. 42쪽 PNG를 모두 원본 크기로 확인한다. 접촉면은 탐색용이며 PASS 근거를 대신하지 않는다.
6. 한국어 문장 품질 전담 리뷰와 사실성·시각성 리뷰가 각각 PASS해야 한다.
7. 비보고서 작업 트리 기준선 보존.

검증 명령:

```text
/tmp/codexclaw-pdf-venv.PURmmc/bin/python tmp/pdfs/verify_korean_localization.py \
  output/pdf/codexclaw-omo-senpi-gap-analysis-ko.pdf \
  --ledger tmp/pdfs/korean-coverage.json
```

## 수정 파일

- `tmp/pdfs/build_codexclaw_gap_report.py`: 한국어 문안과 공통 UI 문자열.
- `tmp/pdfs/verify_korean_localization.py`: 페이지별 한글·잔존 영문 강제 검사.
- `output/pdf/codexclaw-omo-senpi-gap-analysis-ko.pdf`: 최종 산출물.
- `devlog/_fin/260827_omo_senpi_gap_report_korean/001_translation_ledger.md`: 번역·검증 원장.

## 사용자 가시 문구 인벤토리

- 공통 머리말·꼬리말·페이지 번호·축·범례.
- 성숙도 도표, 히트맵 도메인, 행렬 축, 콘솔 UI.
- 근거 요약, 진단 질문, 의사결정 기준, 관찰 근거, 결론.
- 책임자, 핵심 KPI, 주요 위험, 로드맵 통제 항목.
- 1~39쪽 PageSpec의 모든 필드와 동적 기본값.
- 35~38쪽 표의 머리글·셀, 40~42쪽 방법론·근거 지도·점수 원장.
- PDF 제목·주제 메타데이터.
