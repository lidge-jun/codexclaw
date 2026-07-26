# 001 — 축 A: 루프/오케스트레이션 파리티 (omo 4.13.0 → 4.19.1)

조사: Sol 서브에이전트 "Carson" (explorer, read-only), 2026-07-25 · `VERDICT: COMPLETE`
대조 기준: `plugins/codexclaw/` 현행 트리 + `devlog/_fin/lazygap/`(4.13 이전 기록)

> 축 A는 upstream 델타의 루프/디스패치/훅 절반만 다룬다. 스킬·QA·배포는 `002`.
>
> **인용 규약(A 단계 정정):** upstream 인용은 전부 `devlog/.lazycodex/` 를 뿌리로 하는
> 완전 경로로 적는다. codexclaw 인용은 `plugins/codexclaw/` 로 시작하는 완전 경로로 적는다.
> 생략(`...`)이나 암묵적 상대경로는 쓰지 않는다.

## 판정표

| # | upstream 메커니즘 (file:line) | 동작 | codexclaw 대응 (file:line) 또는 NONE | 판정 | tier | 근거 |
|---:|---|---|---|---|---|---|
| 1 | `devlog/.lazycodex/plugins/omo/skills/ultrawork/SKILL.md:10-23,105-135`; `devlog/.lazycodex/plugins/omo/test/ultrawork-skill-pointer.test.mjs:30-55` | 472줄 바인딩 모드를 설치하고 UserPromptSubmit이 4KiB 미만 포인터를 주입 | `plugins/codexclaw/skills/pabcd/SKILL.md:1-6`; `plugins/codexclaw/skills/loop/SKILL.md:45-85`; 단계별 주입 `plugins/codexclaw/components/pabcd-state/src/hook.ts:312-325,485-587` | REJECT | E4+E7 | **판단(추론):** 컴팩트 포인터 기법 자체는 유효하나 전역 "ultrawork" 표면은 `cxc-dev`/`cxc-pabcd`/`cxc-loop`와 역할이 겹친다. 근거는 세 스킬의 트리거 범위가 이미 그 영역을 덮는다는 점(위 3개 인용)이며, `structure/00_philosophy.md:33-58`은 별도 사실 — enforcement가 hook 표면에서만 나오고 스킬 산문은 model-autonomous라는 것 |
| 2 | `devlog/.lazycodex/plugins/omo/skills/ultrawork/SKILL.md:128-153` | 활성화마다 무제한 host goal 생성 강제 | goal 생성은 HOTL 한정·명시적 자율 요청 필요: `plugins/codexclaw/skills/loop/SKILL.md:54-68,128-151` | REJECT | E7 (예산 검사만 E1) | HITL/HOTL 경계를 붕괴시킨다. codexclaw의 host goal 쓰기는 interview freeze 승인 경계에서만 허용되고 루프 중 자기무장은 금지 (`devlog/_fin/lazygap/000_INDEX.md:121-128`) |
| 3 | `devlog/.lazycodex/plugins/omo/skills/ulw-plan/SKILL.md:10-14,26-46,88-107` | 고정 planner 페르소나 + 별도 worker에게 구현 이관, `metis`/`momus` 등 전용 역할 | 계획 종합은 main 소유, 3 base role 매핑: `structure/20_pabcd_dispatch_doctrine.md:98-117` | REJECT | E7 | LOCKED "역할 증설 금지" 및 main 소유 원칙 위반 (`devlog/_fin/lazygap/000_INDEX.md:17-30`) |
| 4 | `devlog/.lazycodex/plugins/omo/test/ulw-plan-review-state-contract.test.mjs:56-139,141-212,243-292` | 리뷰 라운드 상태를 지속화하고 각 레인을 plan SHA-256 · roundId · launchId · workspace root · 세션 영수증에 결박, stale/late/mismatch 완료는 fail-closed | **NONE.** A→B는 붙여넣은 리뷰 출력과 판단 verdict만 요구하고 artifact digest·라운드 정체성·리뷰어 영수증이 없다: `plugins/codexclaw/components/pabcd-state/src/attest.ts:148-190`; goalplan에 리뷰 라운드 상태 없음 `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:63-88` | **ADAPT** | E8 | stale-review 구멍을 실제로 닫는다. base `reviewer` 하나를 유지하면서 artifact/라운드 CAS만 이식하고 upstream의 이중 전용역할 토폴로지는 버린다 |
| 5 | `devlog/.lazycodex/plugins/omo/skills/ulw-plan/SKILL.md:72-79`; `devlog/.lazycodex/plugins/omo/skills/ulw-plan/references/intent-unclear.md:19-25,41-44`; `devlog/.lazycodex/plugins/omo/test/ulw-plan-scope-contract.test.mjs:12-23` | 임의 축소·인접기능 확장 금지 | 하향 재정의 금지 + append-only work-phase: `plugins/codexclaw/skills/loop/SKILL.md:272-297`; 소유 결정은 main `structure/20_pabcd_dispatch_doctrine.md:161-173` | REJECT | E7 | 동일 계약이 이미 존재. 용어/스캐폴드 이식은 중복 계획 표면만 만든다 |
| 6 | `devlog/.lazycodex/plugins/omo/skills/ulw-research/SKILL.md:72-104,106-135`; `devlog/.lazycodex/plugins/omo/test/ulw-research-skill-contract.test.mjs:20-29` | `ultraresearch` → `ulw-research` 개명 + 팀/역할 스웜, orchestrator 소유 journal | codexclaw은 이미 이를 별도 스킬이 아니라 검색 사다리 Tier 3로 흡수했다: `plugins/codexclaw/skills/search/SKILL.md:118-125` ("Deep Research Protocol (opt-in, formerly cxc-ultraresearch)"); 구현 기록 `devlog/_fin/lazygap_impl/070_agbrowse_adapt_ultraresearch.md:92-112` | REJECT | E5+E7 | 개명 이식은 이득이 없다. codexclaw은 별도 스킬을 없애고 Tier 3로 통합했으므로 upstream보다 표면이 적다. librarian/gate 역할은 역할 로스터 LOCK 위반 |
| 7 | `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/spawn-guard.ts:10-27,43-52,96-100`; `devlog/.lazycodex/plugins/omo/hooks/pre-tool-use-guarding-ulw-loop-spawns.json:3-15` | 세션당 루프 spawn 수를 세고 총량 상한(기본 60) 초과 시 deny | 재귀는 막고 leaf 제약을 주입하나 총 fan-out 상한 없음: `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:723-787`; 경제성 교리 `structure/20_pabcd_dispatch_doctrine.md:157-195`; host 동시성 한계는 이미 존재 `structure/20_pabcd_dispatch_doctrine.md:138-141` | **DEFER** (A 단계 하향, 기존 ADAPT 철회) | E1 (도입 시) | 관측된 마찰 증거가 없는 상태에서 기본 누적 상한을 넣으면 정상적인 장기 goal(임의 개수 work-phase 연결, `plugins/codexclaw/skills/loop/SKILL.md:279-284`)을 사전 경고 없이 차단할 수 있다. HOTL 자원 한계는 이미 계획이 명시하는 방식이다 (`plugins/codexclaw/skills/loop/SKILL.md:264-270`). 실측 마찰이 나온 뒤 opt-in bound로만 재검토 |
| 8 | `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/spawn-guard.ts:54-83` | code-review·manual-QA 산출물이 존재·비어있지 않을 때까지 최종 gate 리뷰 spawn을 deny | C 단계 산문은 테스트·독립 리뷰어를 요구하지만 PreToolUse가 선행 산출물을 검증하지 않음: `plugins/codexclaw/components/pabcd-state/src/hook.ts:257-267`; spawn 훅은 토폴로지·스킬·라우팅만 (`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:705-845`) | **ADAPT** | E1 | 순서 불변식만 이식. 전용 gate-reviewer 역할 대신 명시 마커를 감지하고, 영수증을 **정확한 소스 SHA에 결박**해 검증한다 (A 단계 강화, A3 참조) |
| 9 | `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/stop-resume-hook.ts:32-48,61-88` | 미완 세션 goal에 대해 Stop을 블록하고, ledger 라인 수 변화 시 two-strike 예산을 리셋, 무진전이면 stuck 마커 기록 | Stop guard는 단계 전이에서만 리셋되고 동일 단계로 상한: `plugins/codexclaw/components/pabcd-state/src/hook.ts:708-730,914-993`; 이미 활성 host goal을 요구하고 잔여 작업을 명명 (`plugins/codexclaw/components/pabcd-state/src/hook.ts:945-982`) | **ADAPT** | E2 | 활성 goal 무장 규칙과 단일 Stop 훅을 유지하되, 정체 시그니처를 "단계"에서 "단계 + 지속 진전"으로 강화. local-plan-only 무장은 채택하지 않음 |
| 10 | `devlog/.lazycodex/plugins/omo/components/start-work-continuation/src/boulder-reader.ts:37-57`; `devlog/.lazycodex/plugins/omo/components/start-work-continuation/src/plan-checklist.ts:30-77`; `devlog/.lazycodex/plugins/omo/components/start-work-continuation/src/codex-hook.ts:18-39` | 체크리스트가 전부 완료돼도 최종 gate가 미결이면 continuation 유지, 코드펜스 인식 파싱으로 오탐 방지 | 완료 검증은 work phase·criteria·evidence만 보고 최종 gate 영수증이 없음: `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:266-295` | **ADAPT** | E8+E2 | goalplan 검증에 명시적 최종 gate 상태를 추가. Markdown 체크박스 파싱은 이식하지 않고 구조화 JSON을 유일 진실원으로 유지 |
| 11 | `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/checkpoint-continuation.ts:16-27,29-68` | checkpoint 성공이 local goal을 전진시키고 다음 지시 또는 blocked 핸드오프를 출력 | D가 work-phase 커서를 전진 (`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:298-349`); 활성 goal IDLE Stop이 다음 P 명령을 명명 (`plugins/codexclaw/components/pabcd-state/src/hook.ts:828-865`); 명시적 P 재진입 요구 (`plugins/codexclaw/skills/loop/SKILL.md:292-297`) | REJECT | E2+E8 | 기능적 등가물이 존재. 자동 P 진입은 명시적 전이 불변식 위반 |
| 12 | `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/steering-batch.ts:35-59,62-95`; `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/steering.ts:107-120,190-225`; `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/steering-snapshot.ts:4-38` | steering 배치를 원자적으로 적용, idempotency key로 중복 제거, 약화/보호 편집 거부, 변경분만 스냅샷 | 스킬 계약은 steering을 약속하나 shipped ledger는 6개 lifecycle 이벤트뿐이고 steering 상태 없음: `plugins/codexclaw/skills/loop/SKILL.md:196-208`; `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:75-88` | **ADAPT** | E8 | `lazygap/001`에 대한 실질적 신규 확장. 명시적 `cxc loop steer` 트랜잭션으로 구현하고 host goal DB는 건드리지 않는다. 규모가 커서 두 사이클로 분할 (`009` decade map 참조) |
| 13 | `devlog/.lazycodex/plugins/omo/hooks/subagent-stop-verifying-lazycodex-executor-evidence.json:3-15`; `devlog/.lazycodex/plugins/omo/components/lazycodex-executor-verify/src/codex-hook.ts:9-33` | 영수증 강제를 executor 1종에서 모델 티어 3종 worker로 이관 | 범용 `worker`가 이미 경로·심링크·비어있음·컨텍스트 압력·시도 상한으로 게이팅: `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts:34-58,93-115,186-235`; matcher `plugins/codexclaw/hooks/subagent-stop-verifying-evidence.json:3-15` | REJECT | E1급 SubagentStop 블록 | 이미 닫힌 동작. 티어별 역할 이식은 역할 증설 금지 위반이고, 모델 선택은 `.codexclaw/subagents.json`의 몫 |
| 14 | `devlog/.lazycodex/plugins/omo/test/multi-agent-v2-regression.test.mjs:9-69`; `devlog/.lazycodex/plugins/omo/test/subagent-limit-migration.test.mjs:29-73,211-349` | SessionStart 마이그레이션이 사용자 config를 편집하고 V2 토글·동시성 상향(V1 `max_threads=1000`) | codexclaw은 config 마이그레이션 없이 spawn 시점에 V1/V2 처리: `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:719-747,771-832` | REJECT | E8 테스트 / 사다리 밖 런타임 변경 | SessionStart 자동 변경 금지 LOCK 위반이며 사용자 소유 설정을 우회 (`devlog/_fin/lazygap/000_INDEX.md:117-118`). 지정 테스트 1건은 실제 실패 중 — 아래 재현 증거 절 참조 |
| 15 | `devlog/.lazycodex/plugins/omo/.codex-plugin/plugin.json:22-45`; `devlog/.lazycodex/plugins/omo/hooks/pre-tool-use-guarding-ulw-loop-spawns.json:1-18`; `devlog/.lazycodex/plugins/omo/hooks/stop-checking-ulw-loop-resume.json:1-17` | spawn-guard와 loop-resume를 별도 훅으로 등록 | codexclaw은 spawn 정책 훅 1개 + PABCD Stop 훅 1개: `plugins/codexclaw/.codex-plugin/plugin.json:22-40` | REJECT (매니페스트 형태) | E1+E2 | 채택 메커니즘은 기존 핸들러 안에 넣는다. Stop 소유자가 둘이면 upstream처럼 중재 로직이 필요해지고 상태 모호성만 늘어난다 (`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/stop-resume-hook.ts:139-192`) |
| 16 | `devlog/.lazycodex/plugins/omo/hooks/pre-tool-use-enforcing-unlimited-goal-budget.json:3-15`; `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/codex-hook.ts:43-45,105-118` | `objective` 외 필드가 있는 `create_goal` deny | 기존 `plugins/codexclaw/hooks/pre-tool-use-guarding-goal-budget.json:3-15`; HOTL 계약 `plugins/codexclaw/skills/loop/SKILL.md:128-151` | REJECT | E1 | lazygap 구현으로 이미 닫힘. 4.19 델타는 Windows 디스패치/문구 변경일 뿐 |

판정 합계 (A 단계 정정 후): ADOPT 0 · ADAPT 5 (#4, #8, #9, #10, #12) · DEFER 1 (#7) · REJECT 10.

`#7`은 리뷰어 블로커 5를 받아들여 ADAPT → DEFER로 하향했다. 상세는 아래 A2 절.

## ADAPT diff-level 스케치

### A1 — artifact 결박 A-리뷰 라운드 (#4)

- `components/pabcd-state/src/goalplan.ts`에 `ReviewRoundState` 추가:
  `roundId`, `planPath`, `planSha256`, `status`, 그리고 base reviewer 레인 하나
  (`launchId`, `reviewerSession`, `workspaceRoot`, `artifactSha256`, `verdict`).
  종단 상태는 `approved | changes_requested | inconclusive`.
- `attest.ts` 옆에 리뷰 상태 모듈: 계획 전체를 해시한 뒤에만 새 라운드를 개시하고
  `pending → launching → in_flight → terminal`을 CAS로 지속화. 영수증 전에 끊긴
  launch는 `inconclusive`, stale/중복 완료는 현재 라운드를 변경하지 못한다.
- A→B attest 요구사항 확장: 현재 계획 해시 == `planSha256`, 리뷰어 세션/launch/round
  정체성 일치, 종단 verdict가 approved 또는 기존 near-pass 판단 형식.
  `auditOutput`은 진단 증거로 남기고 정체성 증명으로 쓰지 않는다.
- 테스트: R2 이후 도착한 R1 완료 / 승인 후 계획 변경 / 중복 완료 / 리뷰어 영수증 누락.

### A2 — 세션당 spawn 안전 천장 (#7)

**상태: DEFER (A 단계에서 ADAPT 철회).**

철회 근거 — 기본값으로 켜지는 누적 deny는 정당화되지 않는다:

- 관측된 마찰 증거가 없다. 이 유닛은 codexclaw에서 과도한 fan-out이 실제 문제를 일으킨
  사례를 하나도 제시하지 못한다.
- 한 goal이 임의 개수의 work-phase를 연결하는 것은 설계된 정상 동작이다
  (`plugins/codexclaw/skills/loop/SKILL.md:279-284`). 세션 누적 상한은 정상적인 장기
  루프를 사전 경고 없이 중단시킬 수 있다.
- HOTL 자원 한계는 이미 "각 계획이 명시한다"는 방식으로 존재한다
  (`plugins/codexclaw/skills/loop/SKILL.md:264-270`), host 동시성 한계도 이미 문서화돼 있다
  (`structure/20_pabcd_dispatch_doctrine.md:138-141`).
  런타임 deny를 추가하면 계획 소유 예산과 훅 소유 예산이 이중화된다.

재검토 조건 (전부 충족 시에만 P로 복귀):

1. 실제 codexclaw 세션에서 fan-out 폭주가 관측되고 ledger/전사 증거가 남았다.
2. 그때도 기본 ON이 아니라 **사용자 또는 goalplan이 명시한 opt-in bound만** 집행한다.
3. decade 문서가 work-phase 경계 리셋, 검색 wave 계수, 재시도 회계를 먼저 정의한다.

### A3 — 최종 gate 선행조건 가드 (#8)

- C 단계 리뷰어 패킷에 명시 마커(예 `[CXC-FINAL-GATE]`)를 정의. "review" 같은 일반
  단어로 최종 gate 의도를 추론하지 않는다.
- 기존 spawn PreToolUse 핸들러 확장: 세션 결박 goalplan/evidence 경로 해석 →
  비어있지 않은 test/check 영수증 요구 → work-phase가 browser/GUI/TUI criterion을
  선언한 경우에만 수동/렌더 QA 요구 → 없으면 누락 경로를 명시해 deny.
- **SHA 결박 (A 단계 추가, 리뷰어 블로커 6):** "비어있지 않음"만으로는 stale 리뷰를
  막지 못한다. 영수증마다 그것이 검증한 소스 상태를 기록한다 —
  `git rev-parse HEAD` + dirty 여부(dirty면 추적 파일 내용 해시). gate spawn은
  test 영수증 · QA 영수증 · 현재 워킹 트리가 **같은 소스 정체성**을 가리킬 때만 통과한다.
  하나라도 다르면 어떤 영수증이 어느 SHA에 묶였는지 명시해 deny.
  이는 기존 리뷰어 계약의 base/head anchor 요구와 같은 방향이다
  (`plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:381-388`).
- 기존 `reviewer → explorer` 매핑 유지, `$cxc-dev-code-reviewer` 첨부. gate 역할 신설 없음.

### A4 — 진전 인식 Stop 정체 판정 (#9)

- 세션 상태에 `stopProgressSignature` 추가. 구성: 현재 단계 + goalplan `updatedAt`
  또는 append-only ledger 라인 수 + 현재 work-phase id (+ 선택적으로 최신 캡처 증거 정체성).
- `bumpStopCounter`를 시그니처 기반으로 변경 — 변하면 연속 블록 수 리셋, 같으면 증가.
- 현행 무장/해제 규칙 전부 보존: I 단계 해제, 비활성 goal 해제, 컨텍스트 압력 해제,
  총 상한 유지 (`plugins/codexclaw/components/pabcd-state/src/hook.ts:935-993`). `stop-checking-ulw-loop-resume.json`은 추가하지 않는다.
- 상태 경로 도출 전 goal/work-phase id를 검증한다.

### A5 — 지속 최종 gate 완료 상태 (#10)

- `Goalplan`에 `finalGate` 추가: `status: pending | in_flight | approved | inconclusive`,
  `artifactPath`, `artifactSha256`, `reviewerSession`, `reviewRoundId`, `verdict`,
  그리고 **`sourceIdentity`** — `{ commitSha, dirty, treeHash? }`.
- **SHA 결박 (A 단계 추가, 리뷰어 블로커 6):** `artifactSha256`은 리뷰 산출물 문서의
  해시일 뿐 검증된 코드 상태의 해시가 아니다. gate가 `approved`가 되려면
  test 영수증 · QA 영수증 · reviewer verdict가 **모두 같은 `sourceIdentity`** 를 증명해야
  하고, 이후 소스가 바뀌면 gate는 자동으로 `inconclusive`로 떨어진다.
  이 결박이 없으면 "final gate"는 이름만 gate이므로, 결박을 구현하지 못하면 A5 자체를 철회한다.
- `validateGoalplan`: 최종 gate가 approved이고 현재 산출물에 결박되지 않으면
  `update_goal complete` 실패.
- `buildGoalIdleBlock`: 작업·criteria가 끝났고 gate만 미결일 때 "final gate pending" 명명.
- 작업 상태는 JSON에 유지. devlog Markdown 체크박스를 런타임 진실로 파싱하지 않는다.

### A6 — 원자적·컴팩트 steering 트랜잭션 (#12)

- 명시 명령: `cxc loop steer --session <id> --batch-json <path-or-json>`.
- 허용 변경은 codexclaw 어휘로 매핑 — pending work phase append/split/reorder,
  pending 문구 수정, criterion 수정, phase block/supersede, ledger 주석.
- 쓰기 전에 복제 계획에 배치 전체를 검증: host goal 필드·완료 상태·증거 삭제 거부,
  criteria 약화 및 범위 축소 거부, evidence·rationale·idempotency key 요구,
  done/in-flight 유닛 변경은 명시적 block/supersede 전이만 허용.
- 프로젝트 로컬 mutation lock 아래 계획을 한 번 쓰고 ledger를 한 번 append.
  항목 하나라도 무효면 배치 전체 거부.
- ledger before/after는 계획 카운터와 변경된 work phase만 담고 전체 계획 2부를 담지 않는다.
- 상태 변경 경계는 명시 CLI다. **UserPromptSubmit 안내 주입은 이 ADAPT의 범위에서
  제외한다** (3라운드 감사 8) — 안내가 없어도 기능이 완전하고, 열어 두면 범위가 흐려진다.
  필요해지면 별도 decade로 다룬다.

## REJECT 근거 요약

- **전역 ultrawork 모드 + 필수 goal**: 기존 3개 스킬과 역할이 겹치고 HITL/HOTL 경계를 지운다
  (`devlog/.lazycodex/plugins/omo/skills/ultrawork/SKILL.md:105-153`).
- **전용 역할군(metis/momus/librarian/gate-reviewer/티어 worker)**: 3 base role +
  skill attachment LOCK 위반 (`devlog/_fin/lazygap/000_INDEX.md:17-30`).
- **planner 소유 구현 이관**: 요구사항 질문·계획 종합·루프 상태는 main 소유
  (`structure/20_pabcd_dispatch_doctrine.md:98-117,161-173`).
- **`ultraresearch` → `ulw-research` 개명**: codexclaw은 별도 스킬을 없애고 검색 사다리
  Tier 3로 흡수했다 (`plugins/codexclaw/skills/search/SKILL.md:118-125`).
- **SessionStart config 마이그레이션 / 극단적 thread 상한**: 사용자 설정 변경 금지 위반.
- **local-plan-only Stop 무장**: upstream은 `.omo` 상태만으로 재개
  (`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/stop-resume-hook.ts:37-47`);
  codexclaw은 자율 continuation에 활성 native goal을 의도적으로 요구
  (`plugins/codexclaw/components/pabcd-state/src/hook.ts:945-970`).
- **Stop 소유자 복수화**: upstream은 중재 로직이 필요해졌다
  (`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/stop-resume-hook.ts:139-192`).
- **Markdown 체크리스트 상태**: 타입화된 work phase/task/criteria가 이미 있다
  (`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:30-72`).
- **worker 티어 SubagentStop matcher**: 범용 강제가 이미 더 강하고 역할 중립적이다.
- **매니페스트만 이식**: 신규 훅 2개 등록은 독립적 가치가 없다.
- **기본 spawn 천장 (#7)**: A 단계에서 DEFER로 하향 — 위 A2 절 참조.

## upstream이 우리 lazygap 기록을 지나간 지점

| lazygap 행 | 4.13 시점 기록 | 4.19.1 이동 | 귀결 |
|---|---|---|---|
| `001` steering | 단일 제안/감사 + 증거·before/after·idempotency (`devlog/_fin/lazygap/001_loop_goalplan_state.md:13-18`) | 전부-또는-무 배치 + 변경분 스냅샷 (`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/steering-batch.ts:35-59`; `devlog/.lazycodex/plugins/omo/components/ulw-loop/src/steering-snapshot.ts:4-38`) | steering 구현 하위행만 재개방. goalplan 기반 자체는 닫힘 유지 |
| `001` checkpoint | checkpoint 검증 + ledger append (`devlog/_fin/lazygap/001_loop_goalplan_state.md:15-17`) | 같은 CLI 작업에서 다음 goal 지시를 출력 (`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/checkpoint-continuation.ts:16-68`) | 신규 gap 없음. D→IDLE→명시 P가 등가이고 FSM 소유를 보존 |
| `002` SubagentStop | matcher `^lazycodex-executor$` (`devlog/_fin/lazygap/002_subagent_evidence_gate.md:17-22`) | 3종 worker 티어로 이동 (`devlog/.lazycodex/plugins/omo/hooks/subagent-stop-verifying-lazycodex-executor-evidence.json:3-15`) | lazygap의 upstream 값 표기는 stale. codexclaw의 범용 `worker` 채택은 그대로 유효 |
| `003` Stop 깊이 | 잔여 작업 기반 continuation (`devlog/_fin/lazygap/003_stop_continuation_depth.md:11-15`) | 진전 키 기반 strike + 훅 중재 추가 (`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/stop-resume-hook.ts:32-88,139-192`) | 진전 민감 정체 판정만 기존 Stop 핸들러에 흡수 |
| `003` 최종 완료 | 잔여 항목 0이면 정지 | gate 미결이면 0에서도 continuation (`devlog/.lazycodex/plugins/omo/components/start-work-continuation/src/boulder-reader.ts:37-57`) | E8 완료 검증기에 지속 최종 gate 상태 추가 |
| `007` research | `ultraresearch` EXPAND/journal shipped (`lazygap_impl/070:92-112`) | `ulw-research`로 개명 + 팀/claim 계측 확장 | 이름·역할 토폴로지는 LOCK 유지. 내용 파리티는 `002`의 몫 |
| `008` dispatch | skill attachment + V1/V2 페이로드 한계 (`devlog/_fin/lazygap/000_INDEX.md:104-113`) | 총 fan-out + 최종 gate 선행조건 deny 추가 (`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/spawn-guard.ts:17-27,43-83`) | 이미 닫힌 attachment 작업을 넘는 신규 E1 후보 |
| `lazygap_impl/040` | 텍스트 전용 work-aware Stop + 단계 정체 상한 (`devlog/_fin/lazygap_impl/000_INDEX.md:55-57`) | ledger 이동 시 strike 리셋 (`devlog/.lazycodex/plugins/omo/components/ulw-loop/src/stop-resume-hook.ts:71-88`) | 기존 구현이 무효는 아니지만 단계-only 시그니처는 upstream보다 뒤처졌다 |

> 위 표의 `001`/`002`/`003`/`lazygap_impl/040` 행 이름은 `devlog/_fin/lazygap/` 및
> `devlog/_fin/lazygap_impl/` 아래 문서를 가리키는 라벨이고, 파일 인용은 각 칸에 완전 경로로 있다.

## UNVERIFIED / 검증 한계 (Carson 자기보고)

- upstream 집계 테스트 실행은 27/35 완료. Codex 리뷰 상태 5건은 통과했으나
  shared-OpenCode 리뷰 5건과 shared scope 1건은 벤더 스냅샷 밖 monorepo 파일을 못 찾음.
  `ulw-research-skill-contract`는 `@oh-my-opencode/shared-skills` import 실패.
- `subagent-limit-migration.test.mjs:211-233`은 기능적으로 실패:
  `features.multi_agent_v2.enabled`가 제거되지 않고 `false`로 남았다. 환경 문제가 아니다.
- Codex 전용 리뷰 상태만 돌린 focused run은 5/5 통과.
- spawn guard / stop resume / steering batch / checkpoint continuation /
  start-work continuation 컴포넌트 테스트는 벤더 스냅샷에 `vitest`가 없어 실행 불가.
  소스 계약만 정독했으므로 런타임 동작은 여기서 독립 확인되지 않았다.
- 훅 JSON의 `commandWindows` 추가는 관측했으나 Windows 디스패치는 실행하지 않았다.
  패키징 파리티 사안이며 축 A 채택 판단 대상이 아니다.
- 저장소 파일·git 상태 변경 없음.

## 재현된 테스트 증거 (A 단계, 리뷰어가 독립 실행)

리뷰어 Epicurus가 벤더 스냅샷에서 직접 실행:
`node --test test/subagent-limit-migration.test.mjs` → 17건 중 16 pass / 1 fail.
실패 건은 `devlog/.lazycodex/plugins/omo/test/subagent-limit-migration.test.mjs:211-233`으로
Carson의 실패 주장과 일치한다. 이 항목만 재현 확인됐고, Carson의 다른 성공 집계는
재현되지 않았으므로 위 UNVERIFIED에 남긴다.
