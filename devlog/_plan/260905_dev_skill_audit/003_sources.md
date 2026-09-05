# 원문 조사 원장

확인일은 모두 2026-09-05 KST. 현재 공식 문서와 구현 소스 확인을 선택했다. hosted web search는 URL 발견에만 쓰고, 원문은 `agbrowse fetch --json --browser never`로 열었다. 본문이 없으면 render로 올렸다. 숫자를 최신처럼 맞추기 위한 전면 업그레이드 조사는 하지 않았다.

인용문·실제 응답 metadata의 발췌는 [sources.json](evidence/sources.json)에 있다. 원문 전체 복사본은 아니며, 원문 URL을 다시 열어 확인할 수 있다. 독립된 두 번째 기관의 교차 검증은 하지 않았다. S07/S09는 같은 OWASP 프로젝트의 서로 다른 장이다.

| ID | 공식 원문 | 확인 내용 | 상태·표면 |
|---|---|---|---|
| S01 | [Node ESM](https://nodejs.org/api/esm.html) | CommonJS interop와 동기 ESM require 조건. bundler 최적화와 runtime 지원을 혼동하지 않음 | verified / HTTP |
| S02 | [React memo](https://react.dev/reference/react/memo) | Compiler 사용 시 자동 memoization. 미사용 프로젝트에까지 일반화하지 않음 | verified / rendered main |
| S03 | [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | SameSite의 역할과 한계, framework 보호·token·Fetch Metadata 선택 조건 | verified / HTTP, 본문 길이 제한 있음 |
| S04 | [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html) | ANALYZE 실제 실행과 부작용 주의 | verified / HTTP |
| S05 | [Python PEP 8](https://peps.python.org/pep-0008/) | module/package 명명. repo 폴더와 importable package를 구분 | verified / HTTP |
| S06 | [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) | Gateway 권고, Ingress frozen, 제거 계획 없음 | verified / HTTP |
| S07 | [ASVS 5.0 Authentication](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md) | V6 장 이름과 공식 requirement 구조 | verified / public endpoint에서 원본 파일 |
| S08 | [OpenTelemetry status](https://opentelemetry.io/status/) | JS/Python traces·metrics Stable, logs Development. backend 문구 유지 근거 | verified / HTTP |
| S09 | [ASVS 5.0 Session Management](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x16-V7-Session-Management.md) | V7 장 이름과 공식 requirement 구조 | verified / public endpoint에서 원본 파일 |
| S10 | [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model) | 충돌하는 skill 지침의 점검, 사용자 지시의 우선순위 명시 | verified / HTTP, endpoint resolver 끈 재시도 |

날짜: S05의 Created는 2001-07-05, S08의 page Last modified는 2025-02-12. 나머지는 읽은 구간에 발행일이 없어 미표시로 남겼다. 검색 엔진의 crawl 날짜를 발행일로 바꾸지 않았다. `/current`, `/api`, GitHub master 문서는 움직이는 URL이므로 스킬 수정 시 다시 확인한다.

S10은 공식 OpenAI 문서 조사 지침으로 확인했다. 이 페이지의 기술·모델 변경 사항은 이번 범위가 아니며, 모델 마이그레이션이나 설정 변경을 하지 않았다.

## 검색 흐름과 오판 방지

1. query family: Node interop / React Compiler / cookie-CSRF.
2. source gap 확장: ASVS chapter / PostgreSQL ANALYZE / Python package / Gateway API / OTel status.
3. runtime integration: 설치된 visualize의 실제 계약과 source-router 비교. native tool schema는 이번 호출 가능한 목록으로 확인.
4. 근거가 충분한 공식 문서에서 멈췄다. 광범위 swarm이나 별도 Deep Research 서비스는 쓰지 않았다.

이번 실행에서 fetch envelope만 믿으면 틀리는 두 사례를 직접 봤다.

- React HTTP 응답: `ok=true`, `strong_ok`였지만 내용은 navigation shell이었다. 대상 주장이 없으므로 증거로 기각했다. browser required가 CDP 연결 실패로 exit 1 → `agbrowse start` → 재시도에서 main 본문 확인. native 도구로 바꿀 필요는 없었다.
- OpenAI 첫 응답: `strong_ok`지만 public endpoint resolver가 대상 기사 대신 RSS를 가져왔다. `--no-public-endpoints` 재시도에서 실제 기사를 읽었다.

이는 `cxc-search`의 Source-Proof Invariant가 필요한 실례다. 성공 상태와 제목만으로 출처 검증을 통과시키면 안 된다. 해당 도구의 구현 수정은 이번 범위 밖이다.

## Aside 조사

사용자가 지정한 Aside를 실제로 사용했다. 로그인된 X 검색은 일반 HTTP에서 얻기 어려워 service global을 선택했다. `exec --permission full-access`는 필요하지 않았고, 설정이나 credential 저장소를 읽거나 바꾸지 않았다.

명령: `perl -e 'alarm shift; exec @ARGV' 120 aside repl "const r = await twitter.search('agent skills instructions contradictions', { count: 5 }); ..."`

- CLI: 1.26.902.1732.
- 결과: exit 0, 표시된 실행 998ms, 2건 반환.
- 후보: [skills 논의](https://x.com/SpiritofAlyahw/status/2095984559401910548), [agent architecture 글 소개](https://x.com/YarosTime/status/2088875409173561536).
- 판정: 기술 모순의 직접 근거로 부적합. 전자는 제한된 주장, 후자는 소개 링크라 채택하지 않았다. 검색을 실행했다는 증거이지 내용이 참이라는 증거가 아니다.
- 전송·follow·like·설정 변경·신규 로그인 없음. 계정 식별자·cookie·무관한 개인 내용은 기록하지 않았다.

증거: [observations.json](evidence/observations.json). Aside를 사용했다는 요청은 충족했지만 유의미한 primary source를 찾았다고 과장하지 않는다.

## 판정 범위

확인한 기술 주장은 원문과 연결했다. 최신 버전 전체 목록, 보안 준수 인증, 모든 library 예제의 실행 검증은 산출물이 아니다. 표준 준수 여부는 항목별 applicability와 실제 제품 증거 없이는 선언하지 않는다.
