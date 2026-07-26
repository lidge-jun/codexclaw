# 002 — 축 B: 스킬 / QA / 개발규율 / 배포 파리티 (omo 4.13.0 → 4.19.1)

조사: Sol 서브에이전트 "Godel" (explorer, read-only), 2026-07-25 · `VERDICT: COMPLETE`
대조 기준: `plugins/codexclaw/` 현행 트리 + `devlog/_plan/260723_deploy_readme/002_lazycodex_distribution.md`

> 축 B는 ultrawork/`ulw-*`/루프 훅을 제외한 절반이다. 그쪽은 `001`.
>
> **인용 규약(A 단계 정정):** upstream 인용은 전부 `devlog/.lazycodex/` 를 뿌리로 하는
> 완전 경로, codexclaw 인용은 `plugins/codexclaw/` 로 시작하는 완전 경로로 적는다.
> 생략(`...`)이나 암묵적 상대경로는 쓰지 않는다.

## 채택 우선순위 (Godel 결론)

1. QA 증거의 freshness · capture validity · motion-state 계약
2. 테스트 오라클 독립성 규칙
3. 소비자 기준 logging 규율
4. trust-boundary guard 삭제 전 adversarial regression
5. `cxc doctor`의 manifest/runtime-target 검증 확대

teammode 상태 머신, 5-agent 고정 리뷰, stealth browser / cookie 추출, LazyCodex 전용
bug-report 스킬은 채택하지 않는다. host-native · 3 base role · no-required-server 원칙과
중복 또는 충돌한다 (`structure/00_philosophy.md:62-89`, `devlog/_fin/lazygap/000_INDEX.md:17-42`).

조사 중 Godel이 실행했다고 **자기보고**한 항목 (재현되지 않음 → UNVERIFIED로 취급):
신규 teammode 지정 테스트 `19 pass, 0 fail`. 이 집계는 이후 독립 재현되지 않았으므로
검증 증거로 인용하지 않는다 (`009` 미검증 항목 참조). REJECT 결론은 소스 정독에 근거하며
이 집계에 의존하지 않는다.

메인 에이전트가 직접 재현한 것: codexclaw `npm run gate` → exit 0.
파일 수정 0건, untracked `devlog/_plan/260722_260722-repo-governance-config/` 보존.

## 판정표

| # | upstream 메커니즘 (file:line) | 동작 | codexclaw 대응 (file:line) 또는 NONE | 판정 | tier | 근거 |
|---:|---|---|---|---|---|---|
| 1 | `devlog/.lazycodex/plugins/omo/skills/teammode/SKILL.md:30-67`; `devlog/.lazycodex/plugins/omo/skills/teammode/scripts/team-transport.mjs:1-55` | V2와 Codex App thread 중 하나를 사전 선택해 team 수명 동안 immutable 고정 | V1/V2 lifecycle은 `plugins/codexclaw/skills/pabcd/SKILL.md:339-346`; 지속 team registry는 NONE | REJECT | E5/E7 (+테스트 E8) | Codex가 agent/thread 수명을 이미 소유한다. 별도 `.codexclaw/teams` 계층은 host-native 책임을 복제하고 두 번째 orchestrator 상태를 만든다 |
| 2 | `devlog/.lazycodex/plugins/omo/test/teammode-transport.test.mjs:215-248`; `devlog/.lazycodex/plugins/omo/skills/teammode/scripts/team-state.mjs:262-276` | V2에는 런타임 archive가 없음을 명시하고 team-state 전용 archive와 구분 | `plugins/codexclaw/skills/pabcd/SKILL.md:343-346`은 `interrupt_agent`만 설명하고 close/archive 의미가 불명확 | **ADAPT** | E7 | V2에서 "archived/closed"라고 과장하지 않는 진실성 문장만 가져온다. team-state archive 구현은 가져오지 않는다 |
| 3 | `devlog/.lazycodex/plugins/omo/test/teammode-archive-ambiguity.test.mjs:11-43,46-98` | multi-host thread-id 모호성을 지속 team log에 남기고 archive는 계속 진행 | NONE | REJECT | E7/E8 | codexclaw은 Codex App thread registry를 소유하지 않는다. 올바른 소유자는 host thread API이며, plugin-local shadow archive는 진실원을 둘로 만든다 |
| 4 | `devlog/.lazycodex/plugins/omo/skills/visual-qa/SKILL.md:50-68,114-126` | reference를 untrusted data로 취급, 전체 화면 coverage · fresh capture · signature/compositing/dimension 검사 · motion frame 증거 요구 | `plugins/codexclaw/skills/qa/references/visual-qa.md:23-42,57-83`; `plugins/codexclaw/skills/dev-frontend/references/core/visual-verification.md:5-28` | **ADAPT** | E7 (validator 추가 시 E8) | viewport/DOM/runtime 증거는 이미 강하지만 source-vs-capture freshness, 파일 signature/compositing, rest/mid/settled motion 계약이 없다 |
| 5 | `devlog/.lazycodex/plugins/omo/skills/visual-qa/scripts/visual-qa.mjs:42-90,407-450` | 의존성 없는 PNG 픽셀 diff와 ANSI/CJK 인식 TUI width/border JSON 생성 | `plugins/codexclaw/skills/qa/SKILL.md:154-159`에서 동일 포트를 v2 후보로 명시 보류 | REJECT | 후보 E8 | 새 스냅샷에도 이 530줄 CLI의 positive fixture 테스트가 없다. 조사에서 확인된 것은 no-arg 오류 계약뿐. 기존 `view_image` 직접 검사 + inline width 확인 원칙을 뒤집을 증거가 없다 |
| 6 | `devlog/.lazycodex/plugins/omo/skills/visual-qa/SKILL.md:70-82`; `devlog/.lazycodex/plugins/omo/skills/visual-qa/references/agent-browser-setup.md:1-9` | in-app browser 다음으로 Playwright/agent-browser를 쓰고 없으면 global install | `plugins/codexclaw/skills/dev-testing/SKILL.md:193-203` | REJECT | E7 | in-app browser → Chrome → computer-use → 제한적 agbrowse 순서를 이미 소유한다. ad-hoc QA 중 browser driver 설치는 금지 경로다 |
| 7 | `devlog/.lazycodex/plugins/omo/skills/programming/SKILL.md:107-131` | 자연어 문구 대신 machine-consumed 구조를 테스트하고, expected를 DUT 출력에서 재계산하거나 override와 fallback을 같은 값으로 두는 vacuous test 금지 | 부분 대응 `plugins/codexclaw/skills/dev-testing/SKILL.md:384-408`; `plugins/codexclaw/skills/dev-testing/references/edge-first-testing.md:42` | **ADOPT** | E7 | prompt/prose seam, 독립 오라클, precedence fixture 차별화가 명시되지 않았다. 실제 false-green을 막는 좁고 일반적인 계약 |
| 8 | `devlog/.lazycodex/plugins/omo/skills/programming/references/logging.md:9-22,34-72` | 기존 logger/무로그 관행 우선, 소비자 기준 level, decision-point 배치, stable message + structured fields, one-event-one-line | **부분 대응.** `observability` 주제는 `dev-backend`로 라우팅되고 (`plugins/codexclaw/skills/dev/SKILL.md:90`), 그 라우팅은 production 표면으로 한정된다 (`plugins/codexclaw/skills/dev/SKILL.md:121`). CLI·library·script를 포함한 cross-surface logging 계약을 소유하는 문서는 없다 | **ADOPT** | E7 | 라우팅은 있으나 계약이 없다. "로그가 없던 라이브러리에 임의 도입 금지"와 "4xx는 서비스 실패가 아님"이 빠진 부분 |
| 9 | `devlog/.lazycodex/plugins/omo/skills/programming/scripts/typescript/check-no-excuse-rules.ts:22-61` | skill-cache가 아니라 caller 프로젝트의 TypeScript를 동적 resolve | project-native checker 원칙 `plugins/codexclaw/skills/dev/references/static-analysis-gate.md:6-25` | REJECT | E8 | codexclaw은 프로젝트 설정 checker를 canonical로 둔다. 별도 AST checker를 vendor하면 프로젝트 lint와 이중 소유가 된다 |
| 10 | `devlog/.lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md:52-55,86-87,141-163` | trust-boundary guard 삭제 전 hostile-input regression 요구, prose wording 테스트 금지, delete/reuse/native/simplify 사다리 | 필요성·재사용은 `plugins/codexclaw/skills/dev/SKILL.md:297-332`; slop 목록은 `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:343-358` | **ADOPT** | E7 | 삭제 사다리는 이미 등가라 중복하지 않는다. 빠진 부분은 boundary guard 제거 증명과 prose-vs-machine seam 구분 |
| 11 | `devlog/.lazycodex/plugins/omo/skills/review-work/SKILL.md:62-88,125-135`; `devlog/.lazycodex/plugins/omo/skills/start-work/SKILL.md:47-52,95-117` | 5개 고정 lane, exact-SHA 증거, PR/branch 전용 worktree, native browser QA | exact anchor/interdiff는 `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:381-388`; 적응형 병렬성 `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:331-333`; QA dual pass `plugins/codexclaw/skills/qa/SKILL.md:108-134` | **ADAPT** | E7 | exact base/head anchor는 이미 있다. "항상 5 lane"은 거부하고, 외부 PR branch를 checkout·실행할 때만 전용 review worktree를 요구하도록 좁힌다 |
| 12 | `devlog/.lazycodex/plugins/omo/skills/refactor/SKILL.md` 델타; `devlog/.lazycodex/plugins/omo/skills/start-work/SKILL.md:104-117` | V1/V2 도구 변환과 native-browser 우선순위 보강 | `plugins/codexclaw/skills/pabcd/SKILL.md:323-346`; `plugins/codexclaw/skills/dev-testing/SKILL.md:193-203` | REJECT | E5/E7 | 이미 단일 소유자에 존재. 여러 workflow 스킬에 호환성 보일러플레이트를 복제하면 drift가 늘어난다 |
| 13 | `devlog/.lazycodex/plugins/omo/skills/lcx-doctor/SKILL.md:64-76` | 기억된 레이아웃 대신 현재 manifest 선언 파일과 실행 target을 검사하고 materialized path rewrite 허용 | **부분 대응 (A 단계 정정).** runtime target 존재 검사는 이미 build 시점에 있다: `plugins/codexclaw/scripts/build.mjs:101-121`(hook command의 `${PLUGIN_ROOT}/*.js` 존재), `plugins/codexclaw/scripts/build.mjs:124-139`(MCP args `.js` 존재). doctor(`plugins/codexclaw/components/cxc-ops/src/doctor.ts:59-113,178-209`)는 이 검사를 재사용하지 않는다 | **ADAPT** | E8 | gap은 "검사가 전혀 없음"이 아니라 (a) doctor가 build 검증기를 재사용하지 않음, (b) 비어있지 않음·경로 포함·`commandWindows`·설치본 절대경로 materialization 미검사. 새 파서를 만들지 말고 build 검증기를 공용 모듈로 추출해 doctor가 확장 |
| 14 | `devlog/.lazycodex/plugins/omo/skills/lcx-report-bug/SKILL.md:85-114`; `devlog/.lazycodex/plugins/omo/skills/lcx-contribute-bug-fix/SKILL.md:89-108` | 최신 source cache를 복구·동기화한 뒤 repo 소유권에 따라 issue/PR 수행 | NONE | REJECT | E7 | LazyCodex mirror/upstream 전용 정책이다. GitHub connector/CLI가 host-native 표면이고, 진단과 외부 issue mutation은 분리해야 한다 |
| 15 | `devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/references/chrome-stealth.md:1-29,39-61,81-99` | 데몬성 CDP 프로세스, global agent-browser 설치, 로컬 브라우저 cookie 복호화·주입 | native QA/search 사다리 `plugins/codexclaw/skills/search/SKILL.md:64-84`; `plugins/codexclaw/skills/dev-testing/SKILL.md:193-203` | REJECT | E7 | 필수 로컬 CDP 프로세스, global runtime provisioning, credential 추출은 no-required-server · detect-only · credential-safety 경계와 맞지 않는다 |
| 16 | `d4c4f05` 시점의 `devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/scripts/tests/test_cookie_domain_filter.py:1-110`, `devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/scripts/tests/test_extract_cookies.py:1-245` 삭제 | cookie domain filtering, crypto, private atomic file, symlink 거부, stdin injection regression 제거 | NONE | REJECT (upstream 변경) | E8 regression | 현재 스냅샷 어디에도 이동 목적지가 없다. 이 스냅샷 기준으로는 move가 아니라 테스트 커버리지 회귀이며, `devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/ATTRIBUTION.md:19-20`이 여전히 "and their tests"라고 주장해 문서 불일치도 생겼다 |

판정 합계: ADOPT 3 (#7, #8, #10) · ADAPT 4 (#2, #4, #11, #13) · REJECT 9.

## ADOPT / ADAPT diff-level 스케치

### B1 — 시각 증거 완결성 (#4, ADAPT)

- `plugins/codexclaw/skills/qa/references/visual-qa.md`에 규칙 추가:
  - `QA-CAPTURE-INTEGRITY-01`: screenshot signature, 요청 dimension, 완전 합성 프레임 검증.
  - `QA-EVIDENCE-FRESHNESS-01`: 최종 PASS 산출물의 mtime이 마지막 렌더 소스 편집 이후.
  - `QA-MOTION-EVIDENCE-01`: 인터랙티브 모션은 rest/mid/settled, 충실도는 settled-to-settled 비교.
  - reference 주석은 untrusted 비교 데이터임을 명시.
- `plugins/codexclaw/skills/qa/SKILL.md:68-90`의 `verdict.json`에
  `capturedAt`, `sourceSnapshotAt`, `captureChecks` 추가.
  `sourceSnapshotAt`은 `001` A3/A5의 `sourceIdentity`(commit SHA + dirty)와 같은 값을 쓴다 —
  QA 영수증과 최종 gate가 같은 소스 정체성을 공유해야 한다.
- 선택적 검증기: 의존성 없는 작은 `skills/qa/scripts/validate-evidence.mjs`로
  timestamp/signature/dimension/artifactRefs 비어있지 않음만 검사. 픽셀 디코더와
  TUI 스코어러는 추가하지 않는다. 검증: 스크립트 fixture 테스트 + `npm run gate`.

### B2 — 테스트 오라클 완결성 (#7, ADOPT)

- `plugins/codexclaw/skills/dev-testing/SKILL.md`의 Patch Integrity Gate 뒤에:
  - `TEST-PROMPT-SEAM-01`: 산문 문구/스냅샷은 테스트하지 않고 파싱된 frontmatter,
    라우팅 선택, machine token만 검사.
  - `TEST-ORACLE-INDEPENDENCE-01`: expected 값을 DUT 출력에서 파생 금지.
  - `TEST-PRECEDENCE-FIXTURE-01`: override·default·fallback은 서로 다른 fixture 값 사용.
  - regression을 임시로 되살렸을 때 해당 테스트가 실패하는 mutation 확인 권장.
- 검증: 신규 규율을 실제로 적용하는 가장 가까운 precedence/routing suite +
  기존 `npm test`, `npm run gate`.

### B3 — logging 계약 (#8, ADOPT)

- 신규 canonical 소유자 `plugins/codexclaw/skills/dev/references/logging.md`,
  `skills/dev/SKILL.md` §5에서 라우팅.
- 계약: 기존 logger 또는 "무로그" 관행 우선 / 소비자와 행동을 말할 수 없으면 emit 금지 /
  boundary·상태 전이·결정 지점·최종 핸들러에서만 기록 / stable message + structured fields,
  log-and-rethrow 중복 금지 / error 직렬화 fixture와 secret redaction.
- 검증: 문서 단계는 독립 리뷰 + `npm run gate`. 이후 실제 logger 변경은 프로덕션
  formatter가 Error type/message/stack을 보존하는지 확인하는 targeted 테스트.

### B4 — slop 정리 안전성 (#10, ADOPT)

- `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:343-358`:
  trust-boundary validation/error handling 삭제는 malformed/hostile input regression
  없이는 High blocker. 산문 파일은 machine-consumed seam이 없으면 phrase/snapshot 테스트 금지.
- `skills/dev-testing/SKILL.md`: guard 제거 mutation에서 regression 테스트가 반드시 실패해야 함을 명시.
- 검증: boundary guard를 실제로 제거하는 변경마다 RED mutation → 복원 GREEN 증거.
  일반 정리에는 기존 affected suite + Patch Integrity Gate.

### B5 — 리뷰 worktree 요구 좁히기 (#11, ADAPT)

- `plugins/codexclaw/skills/dev-code-reviewer/SKILL.md` §5:
  외부 PR/branch를 checkout하거나 그 branch에서 테스트·QA를 실행할 때만 전용 named
  worktree 필수. 현재 task 소유 branch/worktree를 검토할 때는 중복 생성 금지.
  base/head SHA를 결과에 기록하고 head가 바뀌면 기존 verdict를 current로 재사용 금지.
- 검증: review 패킷에 절대 worktree 경로 + `git rev-parse HEAD` 포함,
  `REVIEW-INTERDIFF-01` anchor 누락 시 full review fallback.

### B6 — doctor runtime-target 검증 (#13, ADAPT)

- **먼저 중복을 없앤다:** `plugins/codexclaw/scripts/build.mjs:101-139`의 hook/MCP target
  존재 검사 로직을 공용 모듈(예 `plugins/codexclaw/scripts/lib/manifest-targets.mjs`)로
  추출하고, build와 doctor가 **같은 검증기**를 호출하게 한다. doctor에 별도 파서를 새로
  쓰지 않는다 (리뷰어 블로커 4).
- 공용 검증기를 확장해 build가 아직 안 보는 것을 추가: 비어있지 않음(0바이트 거부),
  plugin root 경로 포함, `commandWindows` 변형, 설치본의 절대경로 materialization.
  target이 존재하고 비어있지 않으면 PASS/WARN, 없거나 0바이트면 FAIL.
- `plugins/codexclaw/components/cxc-ops/test/cxc-ops.test.ts`: hook command target 누락 → FAIL,
  0바이트 dist target → FAIL, 유효한 절대 materialized target → PASS.
  폐기된 미선언 경로는 요구하지 않는다. 추출한 공용 모듈에 대한 단위 테스트도 함께.
- 검증: targeted cxc-ops 테스트, `npm test`, `npm run gate`, payload-only doctor smoke.

## REJECT 근거 요약

- **teammode 런타임 전체**: host agent/thread 상태 위에 두 번째 지속 orchestrator를 세운다.
  신규 19개 테스트는 upstream 구현의 내부 일관성을 증명하지만 codexclaw 제품 적합성을
  증명하지 않는다 (`test/teammode-transport.test.mjs:56-83,95-168`).
- **고정 5-agent 리뷰**: codexclaw은 도메인 폭이 한 reviewer 컨텍스트를 넘을 때만 병렬화한다
  (`skills/dev-code-reviewer/SKILL.md:331-333`). 고정 fan-out은 토큰 비용과 병합 잡음을 상시화한다.
- **`visual-qa.mjs`**: 객관 지표는 유용하지만 현재 기록이 현장 마찰 확인 전 vendor를 명시 보류하고
  (`plugins/codexclaw/skills/qa/SKILL.md:154-159`), 신규 스냅샷에도 fixture 테스트가 없다.
- **global agent-browser / CloakBrowser 설치**: native 도구 우선, ad-hoc QA용 driver 설치 금지.
- **cookie 추출**: credential material과 OS keyring을 다루는 별도 보안 제품 면적이며,
  이를 지키던 355줄 테스트가 오히려 삭제됐다.
- **`check-no-excuse-rules.ts`**: caller-project resolution 수정 자체는 타당하나 codexclaw은
  프로젝트 native `tsc`/ESLint/Biome를 진실원으로 둔다
  (`plugins/codexclaw/skills/dev/references/static-analysis-gate.md:6-39`).
- **LazyCodex 전용 doctor/report/contribute 스킬**: product/repository 라우팅 규칙이 일반화되지 않는다.
  채택 대상은 doctor의 manifest 기반 검사 원리뿐.
- **auto-update / telemetry / provisioning**: 새 manifest에도 SessionStart updater와 telemetry
  훅이 있다 (`devlog/.lazycodex/plugins/omo/.codex-plugin/plugin.json:23-27`).
  codexclaw의 LOCKED 비목표 (`devlog/_fin/lazygap/000_INDEX.md:117-118`).

## 배포 기록 정정 (`devlog/_plan/260723_deploy_readme/002_lazycodex_distribution.md` 대비)

> "기존 주장" 칸의 `(:9-13)` 형태는 **기준 기록 파일
> `devlog/_plan/260723_deploy_readme/002_lazycodex_distribution.md`의 행 번호**다.
> "새 증거" 칸의 경로는 전부 완전 경로다.

| 기존 주장 | 4.19.1 스냅샷 판정 | 새 증거 |
|---|---|---|
| npm wrapper는 thin alias, `omo install --platform=codex`로 전달 (`:9-13`) | CONFIRMED, 델타 없음 | `devlog/.lazycodex/bin/lazycodex-ai.js:5-19` |
| wrapper 패키지는 bin/README/LICENSE만 ship (`:12-13`) | CONFIRMED | `devlog/.lazycodex/package.json:6-16` — `d4c4f05`와 byte-equivalent, 버전도 `0.2.2` 유지 |
| 루트 marketplace manifest 경로 + relative source (`:36-38`) | CONFIRMED | `devlog/.lazycodex/.agents/plugins/marketplace.json:1-16` — 이 파일에 델타 없음 |
| v4.19.1 manifest가 hook 23개 (`:39-41`) | 이제 로컬로도 CONFIRMED | `devlog/.lazycodex/plugins/omo/.codex-plugin/plugin.json:1-45` (version `4.19.1`, hook 23) |
| 벤더 스냅샷은 wrapper 0.2.2 / omo 4.13.0 (`:45-47`) | **CHANGED** | 이제 wrapper `0.2.2` / plugin `4.19.1` |
| "npm + tag + manifest 전체에 하나의 OmO SemVer" (`:48-49`) | **CORRECTION** | 저장소 내부에서는 정렬되지 않는다 — wrapper `0.2.2` 대 plugin `4.19.1`. live npm/tag 정렬이 거짓이라는 뜻은 아니지만, 벤더 repo 자체가 one-SemVer라는 표현은 부정확하다 |
| 공개 install/update wrapper 체인 (`:9-11,50-53`) | 요청 표면에 코드 델타 없음 | `devlog/.lazycodex/package.json:1-16`, `devlog/.lazycodex/bin/lazycodex-ai.js:5-35` unchanged — 이번 sync는 wrapper install/update 로직을 바꾸지 않았다 |
| native marketplace 경로 지원 (`:23-26,57-62`) | CONFIRMED | manifest와 relative source 유지 |
| hook 승인/해시 drift (`:27-28`) | 구조 CONFIRMED, 동작 재검증 안 함 | manifest가 hook 파일을 직접 열거 (`devlog/.lazycodex/plugins/omo/.codex-plugin/plugin.json:22-45`) |
| `.omo` 파일 기반 lifecycle 상태 (`:29-30`) | CONFIRMED + upstream 확장 | teammode도 `.omo/teams/<session>/team.json` + lock/atomic rename 사용 (`devlog/.lazycodex/plugins/omo/skills/teammode/SKILL.md:119-134`; `devlog/.lazycodex/plugins/omo/skills/teammode/scripts/team-state.mjs:342-374,448-449`). codexclaw에는 이식하지 않는다 |
| wrapper 추가는 provisioning 필요가 커질 때만 (`:63-65`) | 코드 형태로 CONFIRMED | wrapper는 여전히 thin forwarder (`devlog/.lazycodex/bin/lazycodex-ai.js:5-35`) |
| ONE SemVer를 codexclaw takeaway로 채택 (`:69`) | 정책은 유효, upstream 예시는 약화 | 새 스냅샷은 upstream 내부에 wrapper/plugin 버전 분리가 실제로 존재함을 보여준다 |
| doctor를 일찍 제공 (`:73-74`) | CONFIRMED + 신규 실행 항목 | upstream doctor가 manifest 선언 runtime target과 materialization 차이를 검사하도록 강화 (`devlog/.lazycodex/plugins/omo/skills/lcx-doctor/SKILL.md:69-76`) → 이 부분만 ADAPT (#13), 단 codexclaw엔 build 시점 검사가 이미 있으므로 공용 모듈 추출 형태로 |

## ultimate-browsing 테스트 삭제 판정

이동이 아니라 스냅샷 테스트 회귀다.

- 두 테스트는 `d4c4f05`에 각각 110줄·245줄로 존재했고 현재 삭제됐다.
- 현재 트리 전체에서 `DomainFilter`, `test_chromium_extract_with_injected_keyring`,
  `test_cookie_output_refuses_symlinks`의 대체 테스트가 발견되지 않았다.
- 런타임 cookie 스크립트는 문서상 여전히 제공된다
  (`devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/ATTRIBUTION.md:19-20`;
  `devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/references/chrome-stealth.md:81-99`).
- 위 `ATTRIBUTION.md`가 "and their tests"를 유지해 삭제와 문서가 불일치한다.

"source monorepo로 이동" 증거가 나오기 전까지는 배포 스냅샷의 커버리지 삭제로 취급한다.

## UNVERIFIED (Godel 자기보고)

- npm registry의 현재 `lazycodex-ai`/`oh-my-openagent` 버전, GitHub tag/release,
  main branch manifest는 이번 로컬 델타 조사에서 live 조회하지 않았다.
- 삭제된 cookie 테스트가 비공개/별도 upstream monorepo에 남아 있는지는 확인되지 않았다.
  이 저장소에는 이동 목적지가 없다.
- `visual-qa.mjs`의 PNG 디코더, alpha 감지, CJK 폭 계산은 fixture suite가 없어 정확도 미검증.
  확인한 것은 CLI no-command 오류와 소스 구현뿐.
- `lcx-doctor`의 최신 source clone/cache 복구는 실제 corrupt-cache fixture로 실행하지 않았다.
- Codex App multi-host thread-id 모호성이 현재 host API에서 해결됐는지 조사하지 않았다.
- 루트 설치기의 SessionStart auto-update, uninstall 소유권 정리, permission 변경 동작은
  이번 지정 배포 파일에 델타가 없어 재실행하지 않았다.
