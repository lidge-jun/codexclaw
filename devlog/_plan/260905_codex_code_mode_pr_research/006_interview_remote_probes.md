# 인터뷰 보충: 원격 실험 조건과 남은 결정

## 사용자 확정 조건

- `cxc-loop`를 진입점으로 에이전트가 필요한 스킬을 동적으로 선택하고, 불필요한 훅을 줄이는 방향.
- macmini에 SSH로 접속해 CodexClaw를 업데이트하며 프로브·테스트.
- 먼저 원격 OCX 업데이트. 이어 CodexClaw 업데이트도 명시적으로 승인.
- 프로브 모델은 `gpt-6-astra`, reasoning `high`, Fast.
- `codex exec`의 승인·sandbox 우회 옵션과 로그를 사용.

위 승인은 최초 000 문서의 설치 변경 제외 범위를 원격 OCX·CodexClaw 업데이트에 한해 넓힌다. 제품 코드 수정, push, merge, release 또는 Codex CLI 자체 업그레이드를 뜻하지 않는다.

## 실제 환경 작업 결과

접속 대상은 SSH 설정과 연결로 확인한 `macmini-cf`이며, 원격 사용자는 `junny`, hostname은 `juniui-Macmini.local`이다.

| 항목 | 실행과 확인 |
| --- | --- |
| OCX 시작 상태 | 2.39.0, `/Users/junny/opencodex` 소스 설치, clean `dev`, upstream `origin/dev` |
| `ocx update` | 소스 설치이므로 git pull·bun install을 안내하고 종료. 이 단계만으로는 업데이트되지 않음 |
| 소스 업데이트 | `git pull --ff-only`, `bun install --frozen-lockfile`, `bun link` 완료 |
| OCX 결과 | 2.43.0, HEAD `a687eb735afc7307f902816972c2f8fb522ed2f3`, clean |
| 서비스 | `ocx service restart` 후 launchd loaded, `/healthz` status ok, version 2.43.0, PID 38505, 127.0.0.1:10100 listener 확인 |
| CLI 링크 | `ocx`와 `opencodex` 모두 global `@bitkyc08/opencodex/bin/ocx.mjs` 경로를 가리킴 |
| CodexClaw | `codex plugin marketplace upgrade codexclaw --json` errors 없음; `codex plugin add codexclaw@codexclaw --json` 성공 |
| 플러그인 결과 | `0.2.16+codex.260830094500`, `/Users/junny/.codex/plugins/cache/codexclaw/codexclaw/0.2.16+codex.260830094500`; `cxc --version` 일치 |
| Codex CLI | 0.146.0 확인. 이번 요청에서 CLI 자체 업그레이드는 하지 않음 |

원격 `codex exec --help`에서 `--dangerously-bypass-approvals-and-sandbox`, `--json`, `-o`, `-C`, `-m`, `-c`를 확인했다. `--dangerously-bypass-hook-trust`는 별도 옵션이므로 추가 승인으로 해석하지 않는다. trust 거절을 감추면 훅 실험을 왜곡할 수 있다.

모델 실행 프로브는 아직 시작하지 않았다. `gpt-6-astra/high/Fast`는 목표 조건이지 적용 검증 결과가 아니다. 실행 단계에서 요청의 모델·reasoning·service tier와 실제 응답/라우팅을 확인한다. 모델 대체나 Fast 해제를 조용히 하지 않는다.

## 실험 기본 경계

- 전용 프로브 디렉터리와 candidate별 격리된 plugin/config 상태를 기본안으로 삼는다. 승인 우회는 격리를 제공하지 않으므로 전용 디렉터리를 보안 sandbox라고 부르지 않는다.
- stdout JSONL, stderr, 최종 응답, effective config, 설치 버전·source SHA, 종료 코드를 구분해 남긴다. 인증정보는 로그에서 제외한다.
- baseline/candidate는 동일 모델·입력·검증 조건으로 비교한다. 코드 변경 후의 성능 실험과 첫 연결 확인을 구분한다.
- 필수 스킬 적용·세션/워크트리 보호·완료 증거를 보존하는 후보끼리 반복 훅 실행·주입 문맥·실패 복구 비용을 비교한다.
- 현행 선제 본문 주입과 관측된 실패에만 작동하는 fallback은 서로 다른 설계다. 단순히 이름만 fallback으로 바꾸지 않는다.

## Mind 교환과 질문 선별

- 성공 기준 lens: `01a0703f-f0a6-7f01-87e2-ee23eef2def1`.
- 제약 lens: `01a0703f-f00b-77b0-bd33-78781dee622d`.
- 두 explorer를 non-full-history로 시작하고 사용자 추가 조건을 전달했다. 이어 메인이 질문 후보를 반박해 같은 두 agent에게 재검토를 요청했다.
- “필수 스킬 누락을 감수할 것인가”는 사용자 질문에서 제외했다. 신뢰성 보존은 기존 계약이며, 전달 방식 선택은 메인이 동일 fixture 프로브로 판단한다.
- “본문 주입을 절대 금지할 것인가”도 지금은 묻지 않는다. 사용자는 훅 감소를 원했지 모든 본문 전달을 금지하지 않았다.
- 남은 제품 의미 질문: bare `cxc-loop`가 스킬 자동 선택만 뜻하는지, 계획 확인 후 자동 진행인지, 전체 PABCD 자동 진행인지.

### 사용자 답변과 재스캔

`loop_default_behavior` 답변: “동적으로 판단하는데 보통 cxc-loop로 해줘 이러면 HOTL로 모든 계획을 완수하라는거야 로그를 봐도 좋아.”

제품 의미는 bare `cxc-loop` → HOTL로 모든 in-scope 계획 완수로 확정한다. 기존 HITL 기본값은 유지할 제약이 아니라 변경 대상이다. 이것이 외부 쓰기 권한까지 확대하는 것은 아니다.

답변을 `cxc scan record --derive --map loop_default_behavior=ontology`로 반영하고 같은 두 Mind에게 현재 I 상태·확정 조건과 함께 재검토를 요청했다. 새 사용자 결정이 필요한 모순은 없다는 반환을 받았다. 본문 주입 여부나 임의 개선율을 추가 질문하지 않고 동일 fixture 실험으로 결정한다.

tracker의 수동 `--unknown` 문구는 대응하는 실제 question text와 달라 `--derive`가 자동 제거하지 못했다. 이를 해결된 질문으로 숨기거나 상태를 직접 덮어쓰지 않는다. 후속 known과 이 문서가 이전 gap을 명시적으로 대체한다. 네 차원을 모두 질문·답변·map으로 충족했다고 주장하지 않으며, 이후 I→P 이동은 정상 gate 또는 이유를 적은 공식 override로 기록한다.

## 상태

사용자가 인터뷰 계속을 선택한 뒤 적용 범위를 질문했으나, 답변은 프로젝트 방향 자체이며 initiative 원문을 보라는 교정이었다. 해당 선택지 질문은 철회했다. [007 방법론 정렬](007_methodology_alignment.md)이 최신 해석이다. 별도 경량 프로필을 기본 계획으로 만들지 않는다.

`cxc orchestrate I --session 01a0702d-c493-7510-801f-7d8772a2689c`로 실제 P → I 전이를 기록했다. host goal은 만들지 않았다. 의미 질문의 답변과 Mind 재스캔까지 마쳤다. 이번 인터뷰에서 제품 훅 구현은 시작하지 않는다.
