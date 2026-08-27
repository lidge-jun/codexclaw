# 번역·검증 원장

## 수용 기준

- 모든 페이지의 주 메시지가 한국어다.
- 표와 도표만 떼어 읽어도 한국어로 의미가 통한다.
- 번역투 대신 보고서 문체를 사용한다.
- 기술 식별자는 원문을 유지하되 주변 설명은 한국어다.
- 영문 잔존 검사는 허용 목록을 명시하고 실행한다.

## 허용 영문

허용은 아래 정확 토큰·형식에만 적용한다. 부분 문자열 일치는 금지한다.

- 정확 토큰: `CodexClaw`, `Codex`, `OMO`, `Senpi`, `PABCD`, `KPI`, `N/E`, `SHA`, `CI`, `SBOM`, `OS`, `LOC`, `GUI`, `API`, `MCP`, `TUI`, `FSM`, `FTS`, `SAST`, `SLO`, `RC`, `CWD`, `HEAD`, `Telegram`, `Discord`, `Linux`, `macOS`, `Windows`, `WSL`, `UX`, `CXC`, `MECE`, `DB`, `UI`, `CLI`, `DAG`, `GitHub`, `PDF`.
- 소스·도구 식별자 정확 토큰: `goalplan`, `Stop`, `SessionStart`, `Recall`, `map`, `unknown`, `claim`, `doctor`, `typecheck`, `lint`, `coverage`, `hook`, `benchmark`, `comparator`, `runner`, `search`, `show`, `ABI`, `manifest`, `payload`, `checkout`, `cold`, `warm`, `p50`, `p95`, `schema`, `compiler`, `bridge`, `helper`, `goal`, `terminal`, `cxc`, `run`, `recall`.
- 프로그램·근거 코드: `P1`~`P5`, `C1`~`C20`, `O1`~`O11`, `S1`~`S10`, 축 기호 `A`~`E`, 신뢰도 `H`, `M`.
- 파일 경로: `(?:[A-Za-z0-9._-]+/)+[A-Za-z0-9._/-]+(?::\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)?`와 정확히 일치하는 스팬만 허용한다.
- 버전: `v?\d+(?:\.\d+)+(?:[-+][A-Za-z0-9.]+)?`, SHA: `[0-9a-f]{7,64}`와 정확히 일치하는 스팬만 허용한다.
- 코드 심볼·명령은 위 정확 토큰 목록 또는 파일 경로 안에 포함된 경우에만 허용한다. 포괄적인 “기술 형식” 예외는 두지 않는다.
- 숫자·기호·비교식은 라틴 문자가 없으므로 별도 예외가 필요 없다.
- 검사기는 허용 스팬을 제거한 뒤 남는 `[A-Za-z]` 한 글자도 실패로 처리한다.

## 42쪽 범위 원장

| 페이지 | 영역 | 번역 | 잔존 영문 | 확대 렌더 | 상태 |
|---:|---|---|---|---|---|
| 1 | 표지·기준표 | 완료 | 0건 | PASS | PASS |
| 2–8 | 경영진 요약·전체 포트폴리오 | 완료 | 0건 | PASS | PASS |
| 9–15 | 전략·연구·지식·스킬 | 완료 | 0건 | PASS | PASS |
| 16–22 | 워크스페이스·멀티에이전트·증거·보안 | 완료 | 0건 | PASS | PASS |
| 23–28 | 원격 운영·콘솔·온보딩·관측·설정 | 완료 | 0건 | PASS | PASS |
| 29–33 | 플랫폼·배포·유지보수·성능·생태계 | 완료 | 0건 | PASS | PASS |
| 34–39 | 우선순위·로드맵·운영모델·이전·위험 | 완료 | 0건 | PASS | PASS |
| 40 | 방법론·근거 C1–C14 | 완료 | 0건 | PASS | PASS |
| 41 | 페이지-근거 지도·근거 C15–O11 | 완료 | 0건 | PASS | PASS |
| 42 | 점수 원장·불확실성·근거 S1–S10 | 완료 | 0건 | PASS | PASS |

JSON 영수증은 페이지 1~42를 개별 행으로 기록하며 묶음 행은 문서용 요약일 뿐이다.

## 검증 영수증

- `KOREAN_VERIFY PASS pages=42 residualLatin=0 metadata=PASS`
- `PDF_VERIFY PASS pages=42 contacts=3`
- `KOREAN_INSPECTION_LEDGER PASS rows=42`
- `DELTA_VERIFY PASS rows=11`
- SHA-256: `ce580b39dbe1d8601b5c7bd77fe4595f5dd5b36ce7edf081f7933672843dad98`
- 크기: 232,359 bytes
