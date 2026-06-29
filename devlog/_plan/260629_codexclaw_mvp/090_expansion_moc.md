# 090 — Expansion MOC: cli-jaw 커맨드/스킬 + lazycodex 컴포넌트 포팅 분석

Status: DECISION LEDGER + decade map · 2026-06-30 (jun 확정) · Phase 1 이후 확장 work-phases

> 이 문서는 jun의 결정을 1:1로 기록한 원장이다. 후보 풀(cli-jaw 미포팅 커맨드/스킬 + omo
> 컴포넌트)을 십의 자리 work-phase로 분해했다. 각 decade는 독립 stub 문서를 가지며,
> 분석(조사 대상)은 gpt-5.5 서브에이전트 병렬 파견으로 채운다.
>
> 후보 풀 원본 출처:
> - cli-jaw: `~/.cli-jaw-3459/skills/` (31 skills) + `cli-jaw --help` 커맨드 표면
> - lazycodex(omo): `devlog/.lazycodex/plugins/omo/{components,skills,agents}` (gitignored)

## Decade map (확정)

| Decade | work-phase | 다루는 항목 | 처리 방식 |
|--------|-----------|------------|----------|
| 090 | cli-jaw 커맨드 → codex-native 매핑 | chat search, task, bgtask, worker status/watch, hooks inspect, dispatch, service/clone, doctor/reset | codex-rs 시스템프롬프트 실측 후 매핑 |
| 100 | skill_hub 아키텍처 | 스킬 노출 방식 (openclaw류), codex 자동 사용, 기본 트리거 = dev 스킬만 활성 | 설계 |
| 110 | dev 스킬 13종 콘텐츠 포팅 + omo 스킬 통합 | dev/dev-* 13종 실제 콘텐츠 포팅 + comment-checker/refactor/remove-ai-slops/review-work/git-master/init-deep/programming/debugging/frontend/ultimate-browsing/ultraresearch/visual-qa 흡수 | dev 스킬에 통합 |
| 120 | 통합 search 허브 | cli-jaw 4-tier + lazycodex search + codex browser-use/computer-use + 한국어 검색 intent guard + agbrowse 쿼리 플래닝 | 병합 설계 |
| 130 | 코드 인텔리전스 | lsp/lsp-daemon/lsp-tools-mcp, codegraph, ast-grep | 조사 |
| 140 | 서브에이전트 role + .toml + 진단/운영 | explorer/plan/librarian/metis/momus, executor/qa-executor/code-reviewer/gate-reviewer/clone-fidelity-reviewer, teammode, telemetry/lcx-doctor/lcx-report-bug/lcx-contribute-bug-fix, git-bash/git-bash-mcp/test-support | 분석 |
| 150 | 채널 배달 | telegram-send / discord 연결 | 후순위 (~150) |

## 결정 원장 (jun, 2026-06-30) — 항목별 1:1 기록

### cli-jaw 커맨드 표면
- **memory** (search/read/save) — PASS. codex에 내부 메모리가 이미 있으니 포팅 안 함.
- **chat search** (--days/--recent/--context) — CANDIDATE 보류. codex-rs에 동등 구현이
  있는지 서브에이전트 1개 파견해 확인. (→ 090)
- **task** (add/done/list/assign/--after) — codex-rs의 todo로 대체. (→ 090, codex-rs 시스템프롬프트 실측)
- **bgtask** (서버 소유 백그라운드) — codex-rs로 구현. 이미 codex 시스템프롬프트에 등록돼
  있을 것으로 추정 → codex-rs 시스템프롬프트 뜯어보기. (→ 090)
- **worker status|watch** — 위와 동일 (codex-rs 시스템프롬프트 실측). (→ 090)
- **hooks inspect** — 위와 동일. (→ 090)
- **dispatch** — 위와 동일 (native spawn_agent 매핑). (→ 090)
- **service / clone** — codex 런타임에 위임. (→ 090, 위임 명시만)
- **doctor / reset** — 계획한다 (codexclaw 자체 진단/리셋). (→ 090)

### search 계열
- **search 4-tier 에스컬레이션** — lazycodex와 합침. 단 web 탐색은 codex의 browser-use /
  computer-use를 이용. lazycodex search도 탐색 대상. (→ 120)
- **통합 search 허브** (built-in web → browser CDP → progrok → web-ai) — lazycodex와 병합. (→ 120)
- **agbrowse research plan 쿼리 플래닝** — search 계열로 흡수, 조사. (→ 120)
- **한국어 "검색" intent guard / 쿼리 리라이트** — 반드시 한다. search 계열. (→ 120)

### dev 스킬 13종
- dev / dev-architecture / dev-backend / dev-frontend / dev-data / dev-devops / dev-security /
  dev-testing / dev-debugging / dev-code-reviewer / dev-scaffolding / dev-uiux-design / dev-pabcd
  — 기록. Pass 4의 "라우터 role"을 넘어 실제 콘텐츠 포팅 대상. (→ 110)

### 기타 운영 스킬 (codexclaw 미언급)
- **별도 페이즈 100** = skill_hub. openclaw류로 skill_hub를 만들어 codex가 알아서 쓰게.
  **기본 트리거는 dev 스킬만 활성화.** (→ 100)
- **diagram** (SVG/Mermaid/Chart.js) — codex에 html 띄우는 기능이 있을 것 → codex(나)의
  시스템프롬프트 조사. (→ 100 부속 조사 / 090 codex-rs 실측에 포함)
- **structured-renderers** — 필요없음. codex 의존.
- **github** (gh CLI) — lazycodex와 합쳐 skill 등록? codex 기본 스킬에도 있을 것 → 확인. (→ 110/140 조사)
- **telegram-send / 채널 배달** — ~150에서 telegram/discord 연결. (→ 150)

### lazycodex(omo) 컴포넌트
- **ulw-loop** (work continuation + goal-status FSM) — PABCD 반복이 사실상 loop →
  계획 문서(017/080) 보강. (→ 017/080 augment)
- **start-work-continuation** (Stop 훅 자동 재개) — 뭔지 조사. (→ 090/조사)
- **ultrawork / ulw-plan** (explore-first + 승인 게이트) — PABCD 쪽에 보강. (→ 017/080 augment)
- **bootstrap** (설치/초기화) — 반영해야 함 → 설치(028.1/027)에 반영. (→ install augment)
- **코드 인텔리전스 (lsp/codegraph/ast-grep)** — 십의 자리(130)에서 조사. (→ 130)
- **comment-checker** — dev-debugging/dev 스킬에 통합. (→ 110)
- **refactor / remove-ai-slops / review-work / git-master / init-deep / programming / debugging /
  frontend / ultimate-browsing / ultraresearch / visual-qa** — dev 스킬에 통합. (→ 110)
- **teammode** — 멀티에이전트 역할, 십의 자리(140)에서 분석. (→ 140)
- **agent role .toml** (explorer/plan/librarian/metis/momus, executor/qa-executor/code-reviewer/
  gate-reviewer/clone-fidelity-reviewer) — 십의 자리(140)에서 분석. (→ 140)
- **진단/운영** (telemetry/lcx-doctor/lcx-report-bug/lcx-contribute-bug-fix, git-bash/git-bash-mcp/
  test-support) — 십의 자리(140)에서 분석. (→ 140)

## 기존 문서 보강 항목 (decade 신설 아님)
- 017_pabcd_loop_plan.md / 080 — ulw-loop + ultrawork/ulw-plan 패턴 흡수 보강.
- 028.1_install_activation.md / 027 — omo bootstrap 패턴 반영.

## 서브에이전트 조사 파견 (gpt-5.5 병렬)
분석 stub들은 아래 조사 작업으로 채운다. 모델 = gpt-5.5, 병렬, read-only 격리.
- J1 codex-rs 시스템프롬프트 실측 (task/todo, bgtask, worker, hooks, dispatch/spawn_agent, chat search 유무, diagram/html) → 090
- J2 skill_hub 노출/자동사용/기본트리거 설계 (openclaw + codex skill 메커니즘) → 100
- J3 dev 스킬 13종 + omo 스킬 통합 매핑 → 110
- J4 통합 search 허브 (cli-jaw 4-tier + omo search + codex browser/computer use + 한국어 guard + agbrowse) → 120
- J5 코드 인텔리전스 (lsp/codegraph/ast-grep) → 130
- J6 서브에이전트 role + .toml + 진단/운영 → 140
- J7 start-work-continuation + ulw-loop/ultrawork 보강 노트 → 017/080

## 상태
- 2026-06-30: decade map 확정, 결정 원장 기록 완료. stub 생성 + 서브에이전트 파견 진행.
