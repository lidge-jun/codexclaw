# wp3 — 최소 훅: 짧은 phase pointer와 기존 보호 경계

## Current WP3 P revalidation (2026-09-05)

WP2 closed through its own C/D at source91e051df with118 fresh passing tests and
bounded native skill/read/application evidence. The next direction in037 is
binding: preserve modular references, remove the CHECK authority conflict and
resolve shared-family measurement before delivery comparisons. The native host
goal still has no exposed resume surface; no native DB state is forged.

The original H1 CHECK phrase `retain independent review` is NOT sufficient:
both original Korean C2 probes received a higher-priority directive and delegated
despite explicit no-delegation. Revalidate all phase pointer language as advisory
and scope-limited, not merely shorter. Existing trigger/state/guard mechanics stay
unchanged; do not implement a semantic classifier to guess user authority.

042_hook_scope_revalidation.md is the P amendment owner for exact hook strings and
their observed-trigger tests.043_shared_family_evidence.md is the P amendment owner
for an explicit extension to the existing opt-in evaluator: native thread identity
and shared session correlation are distinct. This offline evidence-schema change
is an explicit exception to the older no-new-schema wording below; runtime FSM,
goalplan, plugin config, hook registration and provider schemas do not change.
There is no new daemon, model client, proxy, packer or general trace framework.
Both amendment pages require independent audit before B; their existence is not
an implementation or adoption verdict. Original failures remain in the population.

Resolved precedence for implementation:042 R1–R5 and T1–T8 replace the older
H1–H6 string/test proposals wherever they conflict; H0 and untouched mechanical
contracts remain.043 adds only the explicit family-evidence branch in
scripts/probe-evidence.mjs, its existing evidence fixture extension and
test/probe-evidence-family.test.mjs. Schema1 remains direct-thread evidence;
schema2 sets pairedComparisonEligible=false and exposes a separate, scoped
familyComparisonEligibleForReview. It never satisfies a per-thread-attribution
row. Full-history and other supported native surfaces remain mandatory under050,
not waived by this initial legacyV1/direct-child mode.

Implementation ordering within this phase is evidence-contract prerequisites,
then scoped instructional text/H0 ownership, generated payload, regression checks
and real native comparisons.050 remains a separate mandatory cycle after this one.
Known response-tier echo stays excluded as the user directed; every observed
request still must carry the exact Astra/high/priority condition. Deduplicate
shared-family usage; never manufacture child-specific wire attribution.

## 상태와 실행 경계

- 작성일: 2026-09-05. **wp0 P의 문서 산출물이며 wp3 구현/검증 결과가 아니다.**
- 기준 checkout: `/Users/jun/.codex/worktrees/974c/codexclaw`.
- 확인한 source HEAD: `065fa1e887f1d64dcd9c822f34c5fb8626d80a55`.
- 아래 경로는 위 checkout 기준이다. line anchor와 before hunk는 이 HEAD에서 읽은 내용이다. wp3 P에서 선행 변경을 반영해 다시 대조한다.
- 최초 작성은 `040_minimal_hooks.md` NEW였으며 메인 통합 요청에 따라 이 파일 수정과 `050_skill_delivery_experiment.md` NEW까지 사용한다. 제품/source/test/설정/설치 변경, 테스트·빌드, goal/FSM 조작, nested agent, commit/push를 실행하지 않는다.
- [006 원격 프로브 조건](006_interview_remote_probes.md), [007 방법론 정렬](007_methodology_alignment.md)이 의미·권한의 입력이다. 기존 `000_plan.md`의 최초 HITL 조사 기록을 현재 정책으로 재해석하거나 이 문서에서 덮어쓰지 않는다. 메인이 전체 roadmap을 통합한다.

## Loop spec 및 의존성

| 항목 | wp3 계약 |
| --- | --- |
| Archetype | 보존 조건을 만족하는 안내문 축소. 새 실행 엔진을 만드는 최적화가 아님 |
| Trigger | 선행 roadmap의 loop 진입 의미와 agent-led skill/reference routing 계약 확정, baseline 측정 입력 확보 |
| Goal | 필요한 owner를 가리키는 짧은 phase 안내. session identity, 명시적 범위, 상태·증거·완료 계약 보존 |
| Non-goals | 새 dispatcher/runtime, 의미 분류 엔진, feature flag, skill registry, daemon, 자동 phase 전이, 동시 A/B 제품 구현 |
| Verifier | 아래 보존 fixture + 실제 설치 payload의 matched activation probe. 문자열 테스트만으로 모델의 규칙 적용을 입증하지 않음 |
| Stop condition | Strategy A가 승인된 범위에서 적용되고 보존·활성화·비용 증거를 확보했을 때 wp3 종료 판단. 실패는 축소 범위 재계획 |
| Memory artifact | 이 문서와 메인이 정한 동일 unit의 검증 기록. 임의 evidence/FSM 파일을 직접 만들지 않음 |
| Expected outcomes | A 채택 / 일부 축소 철회 / 보존 실패로 재계획. A 완료 뒤에도 050의 delivery 비교는 필수이며 전체 목표가 끝난 것이 아님 |
| Escalation | 기존 guard 의미를 바꿔야 하거나 새로운 외부 권한이 필요하면 메인에게 반환. 낮은 비용을 위해 권한·완료 증거를 약화하지 않음 |

의존 순서: **baseline과 관측 계약(wp1) → 진입/owner 계약(wp2) → wp3 A 안내문 축소 → 필수 delivery 실험(050) → 선택 결과의 최종 installed handoff**. [010 roadmap](010_roadmap_lock.md)의 initial goalplan lock에서 메인이 050 successor와 최종 handoff 의존성을 반영해야 한다. B trial은 A 이후 별도 full work-phase로 수행하며, selfload 채택만 결과에 따라 결정한다. A만 끝내고 프로젝트 방향을 완료했다고 보고하지 않는다.

선행 owner 계약의 필수 값:

1. bare `cxc-loop` 실행 요청은 in-scope 계획을 HOTL로 완수하라는 뜻이다.
2. explicit interview-only / plan-only / HITL / read-only / no-goal 제한이 이 기본값보다 우선한다. `cxc-loop`를 설명·인용한 문장은 그 자체로 실행 권한이 아니다.
3. 일반 요청은 자동 HOTL이 아니다. HOTL도 push/merge/release/deploy/외부 메시지 권한을 추가하지 않는다.
4. agent는 필요한 SKILL을 읽고 해당 작업에 필요한 references만 선택한다. `cxc skill search`는 외부 카탈로그 검색이지 설치된 스킬의 native 목록 API가 아니다.

`plugins/codexclaw/skills/loop/SKILL.md:83-90`의 기존 HITL 기본 안내는 선행 owner 변경 대상이다. wp3가 이 파일을 다시 소유하지 않는다. 그 owner 변경과 아래 hook 문구가 함께 활성화되기 전에는 새 기본값이 전달됐다고 주장하지 않는다. initiative는 읽기 전용이며 `skills/dev-pabcd/SKILL.md:9`의 일반 승인 안내를 수정하지 않는다.

## 구조 결정과 현재 책임

현재/의도 dependency 방향은 동일하다:

```text
plugin.json → hook JSON → 기존 component dist/cli entry
  pabcd-state/cli → hook → state / goalplan / attest / receipts
  cxc-ops/cli → map-affordance → cxc-resolve
  subagent-config/spawn-attach-hook → store + final-gate-guard
```

변경 단위는 기존 plugin의 두 component 안에서 안내문을 수정하는 C3 slice다. guard/permission 의미를 바꾸는 발견은 별도 C4 영향 범위로 반환한다. 새 import/export, cross-component seam, state schema는 없다. 기존의 긴 `hook.ts`를 이번에 분할하지 않는다. 기능 축소와 모듈 재구성을 동시에 하면 보존 비교가 흐려진다. 파일 크기 기준의 예외는 이 제한된 안내문 교체에만 적용한다.

| 현재 근거 | 분류 | wp3 결정 |
| --- | --- | --- |
| `.codex-plugin/plugin.json:22-45` (실제 위치: `plugins/codexclaw/.codex-plugin/plugin.json`) | 23개 command 등록 | 초기 A에서 23개 유지. 등록 수 감소를 성과로 주장하지 않음 |
| `plugins/codexclaw/components/pabcd-state/src/hook.ts:290-431` | phase 본문 + B active-work-phase 한정 + I Mind 전달 | 본문은 축소, `phaseDirective`의 동적 B scope와 `interviewDirective`의 Mind 전달은 유지 |
| 같은 파일 `:660-846` | human chat parser, trigger, state/dedup, passive 재주입 | 분기·state writes·ledger·turnless 처리 그대로. 문자열 외의 변경 금지 |
| 같은 파일 `:607-610`, `:1979-1986` | bootstrap / compaction cursor의 silent state write | empty stdout이어도 삭제하지 않음 |
| 같은 파일 `:1793-1854` | active goal에서 Stop block, I/context-pressure/stagnation release | 결정과 counter 유지. render grounding은 soft advisory임을 유지 |
| `plugins/codexclaw/components/pabcd-state/src/cli.ts:321-342`, `:378-383` | child에도 worktree 보호, fail-closed interview, edit deny 우선 | 전혀 수정하지 않음 |
| `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:156-167`, `:254-267` | sessionbinding, PATH fallback, 기타 안내 | sessionbinding/PATH bytes 및 호출 위치 유지. loop 문구만 교체 |
| `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:751-936` | recursion deny + 본문 transport + scope prose + 설정 routing + final preflight | 초기 A 전체 그대로 |
| `plugins/codexclaw/components/pabcd-state/src/hook.ts:1905-1935`, `src/cli.ts:360-370` | interview capture/rescan, review observer, worker receipt gate | 기록 채널과 role 계약 그대로 |

주의: spawn의 `LEAF_GUARD_BLOCK`은 recursion deny 외의 모든 문장을 기계적으로 강제하지 않는다. arbitrary file write scope와 skill/reference 읽기는 모델 규율이다. final-gate spawn check는 marker-dependent early warning이며 authoritative completion validation을 대체하지 않는다 (`plugins/codexclaw/components/subagent-config/src/final-gate-guard.ts:8-18`). `goal-gate.ts:295-316`의 completion fail-open / interview exception deny 차이도 그대로 남긴다.

## Strategy A — wp3의 확정 제안

### H0 — Interview owner에 기존 의무를 먼저 보존

감사에서 hook 축소 전에 owner 이전이 빠진 부분을 발견했다. `plugins/codexclaw/skills/interview/SKILL.md`의 `## Question quality (INTERVIEW-Q-01)` 앞에 아래 절을 추가한다. 기존 hook.ts:306–315의 의무를 옮기는 것이며 새 전역 방법론을 추가하지 않는다.

```markdown
## Classify the loop before Plan

Before leaving Interview, identify whether the verifier defines done (specification
or repair) or only better (open-ended optimization), and record the corresponding
loop archetype. Ground the distinction in the repository and the user's outcome.
For a load-bearing architecture or workflow choice, explain the concrete trade-offs
before narrowing it; include a materially different approach when it helps expose
an assumption. When evidence cannot settle a cheap, bounded comparison, offer a
parallel spike and evidence-based selection. Do not invent irrelevant feature or
technology choices that the project already settles.
```

이 skill 파일을 wp3 MODIFY 지도에 추가한다. H0를 적용한 뒤 H1의 중복 hook 문구를 제거한다. native Interview fixture 두 개를 사용한다: 고정된 회귀 테스트 수리 요청은 done을 정의하는 검증기로, 훅 비용·스킬 신뢰성 개선 요청은 better를 정의하는 비교기로 분류해야 한다. 실제 응답이 비교 기준과 적절한 대안을 설명하고 Plan/구현에 들어가지 않는지 독립적으로 확인한다. 문구 존재 검사로 대체하지 않는다.

선제 본문 transport를 유지한 채 phase 안내를 owner pointer로 줄인다. 단, I의 state-grounding anchor와 Mind 전달, Windows attest recipe는 첫 축소에서 유지한다. pointer는 SKILL 본문이나 references를 hook이 대신 읽어서 붙인다는 뜻이 아니다.

### 변경 파일 지도: dependency order

| 순서 | 파일 / 작업 | delta와 완료 증거 |
| --- | --- | --- |
| 0 | 선행 owner 계약, baseline / DEPENDENCY ONLY | loop·pabcd·dev의 책임 및 bareloop 우선순위 확인. wp3가 선행 파일을 중복 편집하지 않음 |
| 1 | `plugins/codexclaw/components/pabcd-state/src/hook.ts` / MODIFY | H1 phase 본문, H2 loop arming return 문구만 교체. exported function signature/call sites/guards 유지 |
| 2 | `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts` / MODIFY | H3 loop affordance만 교체. binding/map/search/kwrite/background/PATH transport 유지 |
| 3 | `plugins/codexclaw/components/pabcd-state/test/hook.test.ts` / MODIFY | H2 literal snapshot 변경, H4 scope-first hook-output fixtures와 H5 phase-owner assertion 추가 |
| 3a | `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts` / MODIFY | H5의 실제 mode2 stdout owner assertion만 추가. I/Stop/recovery 기대값은 그대로 |
| 4 | `plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts` / MODIFY | H6 emitted loop scope assertion. sessionbinding/size/PATH 테스트 유지 |
| 5 | `docs/native-thin-harness.md` / MODIFY | H7: compact 안내와 guard/transport 보존 경계를 현행 SoT에 반영 |
| 6 | 위 두 component의 해당 generated dist / REGENERATE ONLY | 기존 build가 생성. 손으로 수정하지 않음. 설치 payload activation은 별도 승인 범위에서 메인이 수행 |

테스트 파일도 **향후 wp3 변경 제안**이다. 현재 wp0 문서 작성에서는 수정/실행하지 않는다. 별도 runtime/helper/config/schema/test harness를 추가하지 않는다.

### H1 — phase 본문: 정확한 before/after

대상: `plugins/codexclaw/components/pabcd-state/src/hook.ts:290-380`의 `PHASE_DIRECTIVES` 전체. 아래 diff 밖의 `activeWorkPhaseOpts`, `phaseDirective`, `interviewDirective`, `MIND_DISPATCH_DIRECTIVE` import/call, footer는 유지한다.

```diff
 const PHASE_DIRECTIVES: Partial<Record<Phase, string>> = {
   I: [
     "[codexclaw: INTERVIEW]",
-    "Clarify requirements before planning. Cover four dimensions — Goal, Constraint,",
-    "Success criteria, Ontology. Research the repo first, then ask focused questions.",
-    "GROUND EVERY QUESTION IN STATE, not in a blank slate (INTERVIEW-GROUND-01). Before",
-    "asking, fold the answers you already have into the tracker:",
-    "`cxc scan record --session <id> --derive --map <questionId>=<dimension> ...` reads the",
-    "captured answer ledger and writes each answered question into that dimension's known[]",
-    "and each unanswered one into unknown[]. Read the result back from",
-    "`.codexclaw/sessions/<id>.json` and let the weakest dimension pick your next question.",
-    "Then SHOW YOUR WORK before the question (INTERVIEW-RENDER-01): a short status block",
-    "naming what is now known, which dimension is weakest and why, and what the answer will",
-    "change. A question the user cannot situate reads as context-blind even when it is not.",
-    "Cite the repo evidence that triggered a brownfield question — the file, symbol, or",
-    "pattern — instead of asking the user to rediscover it.",
-    "Settle the loop archetype before P (INTERVIEW-CLASSIFY-01): does a verifier define",
-    "*done* (spec work), or only *better* (open-ended optimization)? Teach the decision",
-    "space, don't only narrow it (INTERVIEW-TEACH-01): options with per-option trade-offs",
-    "at every load-bearing altitude (stack/architecture/algorithm/evaluation), including",
-    "one atypical option; offer BOTH (parallel spike, select by evidence) when a",
-    "load-bearing choice is uncertain and a spike is cheap (INTERVIEW-DIVERGE-01).",
-    "When you ask, use request_user_input with background + 2-3 concrete options",
-    "(recommendation FIRST) + one impact/tradeoff sentence per option. Bundle questions only",
-    "when they are INDEPENDENT — never batch two where one answer changes the other",
-    "(INTERVIEW-INDEPENDENT-01); independence governs, not a count. Do NOT start implementing yet.",
+    "Load $codexclaw:cxc-interview for the four dimensions, question shape and readiness rules. Do not implement.",
+    "INTERVIEW-GROUND-01: `cxc scan record --session <id> --derive --map <questionId>=<dimension> ...`",
+    "records known[]/unknown[]; read `.codexclaw/sessions/<id>.json` before choosing the next question.",
+    "INTERVIEW-RENDER-01: show knowns, the weakest dimension and the answer's impact before the question.",
+    "INTERVIEW-INDEPENDENT-01: batch only INDEPENDENT questions; independence governs, not a count.",
   ].join("\n"),
   P: [
     "[codexclaw: PLAN]",
-    "Write a diff-level plan: file change map, scope boundary (IN/OUT), and testable",
-    "accept criteria. Open C2+ plans with a loop-spec header: loop archetype (from",
-    "Interview) · verifier (and what it measures) · stop condition · expected terminal",
-    "outcomes · escalation. For open-ended optimization add the divergence plan",
-    "(descriptor axes, candidate assignments, deterministic selection rule, telemetry",
-    "schema); a win/lose-only verifier means instrumentation is B's first work item.",
-    "Ground decisions in real code you have read. No implementation yet.",
+    "Load $codexclaw:cxc-pabcd for P: grounded diff-level plan, IN/OUT and testable acceptance. No implementation yet.",
+    "Use $codexclaw:cxc-dev to select required surface skills and only relevant references.",
   ].join("\n"),
   A: [
     "[codexclaw: AUDIT]",
-    "Audit the plan adversarially before building. Dispatch an independent reviewer",
-    "as a sub-agent with agent_type \"explorer\" (DISPATCH-AGENT-TYPE-01: there is no",
-    "\"reviewer\" agent_type - the reviewer ROLE maps to the explorer TYPE) to challenge",
-    "assumptions, find blockers, and verify references. If",
-    "spawn_agent is not in your visible tools, tool_search for it first. Reuse the SAME",
-    "reviewer across audit rounds (v2 surface: followup_task to its task_name; v1",
-    "surface: send_input to its agent_id). Name every required skill in the spawn message",
-    "with plugin-native",
-    "$codexclaw:cxc-* mentions ($codexclaw:cxc-dev-code-reviewer AND",
-    "$codexclaw:cxc-search plus the matching $codexclaw:cxc-dev-* surface skill). The",
-    "spawn-attach hook normalizes mentions and inlines SKILL.md bodies when the spawn",
-    "message reaches it as plaintext (native ChatGPT-backend V2 encrypts it — there only",
-    "the leaf guard and configured model/effort injection apply), and NEVER invents",
-    "skills the dispatcher did not name; the dispatcher still names every required skill. Ask",
-    "the reviewer to end with a final line: VERDICT: PASS | GO-WITH-FIXES (blockers=N)",
-    "| FAIL. A is a loop (AUDIT-LOOP-01): on FAIL, synthesize (REVIEW-SYNTHESIS-01),",
-    "amend the plan, re-audit with the SAME reviewer; advance only when YOU judge the",
-    "round pass or near-pass (all blocking findings folded into the plan or rebutted).",
+    "Load $codexclaw:cxc-pabcd for A and $codexclaw:cxc-dev-code-reviewer for the independent audit.",
+    "Keep the same reviewer across rounds; the main agent owns synthesis and advancement. Do not build yet.",
+    "Name the review, search and required surface skills in the dispatch packet; follow the owner's verdict contract.",
   ].join("\n"),
   B: [
     "[codexclaw: BUILD]",
-    "Implement the audited plan in small atomic commits. Verify as you go (run tests).",
-    "When delegating a build slice, put the surface's $codexclaw:cxc-dev-* mention in",
-    "the spawn message so the subagent loads the discipline. Stay inside the plan's",
-    "scope boundary; surface deviations instead of silently expanding.",
+    "Load $codexclaw:cxc-pabcd for B and $codexclaw:cxc-dev for the required surface skills.",
+    "Implement only the audited scope; verify within the authorized scope. Name required skills when delegating.",
   ].join("\n"),
   C: [
     "[codexclaw: CHECK]",
-    "Run the real verification: tests, type checks, and adversarial review. For the review",
-    "pass, dispatch with $codexclaw:cxc-dev-code-reviewer in the spawn message",
-    "(tool_search for spawn_agent first if it is not visible). For UI-facing changes,",
-    "also exercise the real flow (browser:control-in-app-browser / computer-use:computer-use)",
-    "and capture screenshot evidence per cxc-dev-testing TEST-CU-QA-01. Capture fresh",
-    "command output as evidence. Do not claim pass without artifact-level proof.",
-    "C-RENDER-GROUNDING-01: when this work-phase modified a render artifact (HTML, SVG,",
-    "layout CSS, canvas/animation/chart JS, JSX/TSX layout components), RUN it in its",
-    "execution environment, OBSERVE the output (read the screenshot back -- produced but",
-    "unread is not observation), and FIX what the observation reveals before C->D.",
-    "Defaults: 1280x720 viewport; drive stateful artifacts until the first interactive",
-    "state change. One clean observation suffices; re-render only after a change.",
-    "Well-formed (tsc/lint) is not correct -- static gates do not satisfy this rule.",
+    "Load $codexclaw:cxc-pabcd for C and $codexclaw:cxc-dev-testing for scoped verification; retain independent review.",
+    "C-RENDER-GROUNDING-01: changed render artifacts need RUN, OBSERVE, FIX evidence. No pass claim without fresh proof.",
   ].join("\n"),
   D: [
     "[codexclaw: DONE]",
-    "Summarize what was checked with evidence, update STATUS/devlog, and commit. Confirm",
-    "no pending work remains for this work-phase before closing. For loop/multi-pass",
-    "work add the pessimistic close-out (LOOP-PESSIMIST-01): what did NOT improve, which",
-    "hypothesis died, what evidence would falsify the direction — the next P quotes it.",
-    "D -> IDLE -> P is a context/bias flush: resume from disk artifacts, not transcript",
-    "momentum. A budget/time stop is BUDGET_EXHAUSTED with best-so-far, never done.",
+    "Load $codexclaw:cxc-pabcd for D: evidence-backed close-out of this work-phase, then IDLE.",
+    "For remaining authorized loop work, follow $codexclaw:cxc-loop from disk evidence. Budget/time stop is not done.",
   ].join("\n"),
 };
```

삭제되는 세부 규칙의 owner 확인: `plugins/codexclaw/skills/interview/SKILL.md:13-92`(질문/grounding), `plugins/codexclaw/skills/pabcd/SKILL.md:155-225`(각 phase·audit·render·close), `plugins/codexclaw/skills/dev/SKILL.md:129-158`(surface/dispatch skills). 문구의 이동은 규칙 삭제가 아니다. I의 `MIND_DISPATCH_DIRECTIVE`와 post-answer `RESCAN_REINJECT_DIRECTIVE`는 이번 축소에서 그대로 전달한다. 지침에 필요한 owner가 선행 skill diet에서 사라졌다면 H1을 적용하지 않고 먼저 owner 계약을 복구한다.

### H2 — bareloop HOTL은 scope-first advisory

대상: `plugins/codexclaw/components/pabcd-state/src/hook.ts:524-546`. `platform`별 `advance` 배열과 `PA_ATTEST_EXAMPLE`은 바꾸지 않는다. 권한/의미 판단을 새 regex로 옮기지 않는다.

```diff
     "[codexclaw: LOOP — orchestrate arming mandate (ORCH-MANDATE-01)]",
-    "A loop/goalplan claim without persisted FSM evidence is INVALID, and the PABCD FSM is not",
-    "armed right now. Arm it with explicit commands before narrating any loop work:",
+    "Scope first: explicit interview-only, plan-only, HITL, read-only or no-goal limits override the bare cxc-loop default.",
+    "A mention or quoted example alone is not authorization. This advisory never overrides the user's limits.",
+    "Load $codexclaw:cxc-loop and $codexclaw:cxc-pabcd. Bare cxc-loop execution means HOTL completion of in-scope work.",
+    "If the scope permits loop execution, arm the FSM explicitly; narrated phases are not persisted progress:",
     "1. Session id: take it ONLY from your most recent SessionStart binding line",
     "   (SESSION-IDENTITY-01 — never an id seen in transcript history).",
     "2. `cxc orchestrate status --session <id>` — read the real phase first.",
-    "3. HOTL (user asked for autonomous / continue-until-done): create_goal with a detailed",
+    "3. HOTL only within that authorization: create_goal with a detailed",
     '   objective -> `cxc loop init --objective "<same text>" --session <id>` -> register',
     "   workPhases[] + criteria[] in the goalplan -> `cxc orchestrate P --session <id>`.",
-    "   HITL (no such ask): enter the cycle explicitly via `cxc orchestrate I|P --session <id>`.",
+    "   Explicit interview/plan-only: stay within that requested stage, without creating a goal or implementing.",
+    "   Explicit HITL keeps human pause points. Read-only/no-FSM requests do not authorize mutating commands above.",
     ...advance,
```

같은 return 배열의 마지막 두 줄도 아래처럼 교체한다. 중간 attest keys, bound workPhaseId, D-close와 다음 P의 설명은 유지한다.

```diff
-    "Load and obey cxc-loop + cxc-pabcd when available. Work done outside the FSM does not",
-    "count as loop progress — re-enter and attest it.",
+    "HOTL does not grant push, merge, release, deploy or external-message permission. Stop for missing authority.",
+    "Only work authorized for a loop is subject to this arming advice; explicit scope always wins.",
```

이 hunk는 intent를 강제하는 guard가 아니다. 현행 `detectLoopArmRequest`는 설명/인용에도 맞을 수 있고, `handleUserPromptSubmit:713-727`의 early branch는 명시적 I/P 단어가 함께 있어도 arming 안내를 낼 수 있다. 이를 숨기지 않는다. branch는 여전히 `loopArmSeen`/turn dedup만 기록하고 새 host goal이나 phase를 만들지 않는다. 실제 모델이 scope-first를 지키지 못하면 A 채택 불가이며, hook이 자동 I/P 전이를 수행하도록 즉석 보완하지 않는다. 이미 active goal인 세션의 interview suppression/deny도 이번 범위에서 바꾸지 않는다.

### H3 — SessionStart의 loop 안내도 같은 우선순위

대상: `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:178-185`.

```diff
 export function renderLoopAffordance(): string {
   return resolveCxcCommands([
-    "[codexclaw] Loop contract: a multi-cycle/PABCD/루프 request is INVALID without",
-    "the persisted FSM — run `cxc orchestrate status --session <your id>` first,",
-    "then enter P and advance each edge with --attest. One work-phase = one full",
-    "PABCD cycle; never implement two plan pages in one B. Load",
-    "$codexclaw:cxc-loop + $codexclaw:cxc-pabcd for the full discipline.",
+    "[codexclaw] Loop contract: load $codexclaw:cxc-loop + $codexclaw:cxc-pabcd for an actual loop request.",
+    "Bare cxc-loop means scoped HOTL; explicit interview-only, plan-only, HITL and read-only/no-goal limits win.",
+    "For authorized orchestration, run `cxc orchestrate status --session <your id>` first.",
+    "One work-phase = one full PABCD cycle. No extra external permissions; a mention alone does not start a loop.",
   ].join(" "));
 }
```

`renderSessionBinding:156-167`, `runMapAffordanceSessionStart:254`의 binding 호출, `:260-267`의 PATH fallback은 **before = after**다. 아래 핵심 출력은 원문 그대로 남긴다.

```text
[codexclaw] This session's id is `<payload session_id>`.
--session <payload session_id>
IDENTITY RULE: use the MOST RECENT SessionStart binding line
```

위는 검사할 원문 조각이지 전체 binding 출력의 새 템플릿이 아니다. source의 전체 binding 문자열을 literal fixture로 고정해 비교한다. 새 session id를 추측하거나 cwd/최근 파일로 대체하지 않는다. map/search/kwrite/background 문구를 별도 owner 이전 없이 함께 지우지 않는다.

### H4 — loop scope hook-output test 추가 및 snapshot 변경

대상: `plugins/codexclaw/components/pabcd-state/test/hook.test.ts`. 기존 `posix arming directive is byte-identical to its pinned snapshot`의 `expected` 배열(`:248-272`)에 **H2의 두 diff를 같은 literal 값으로 적용**한다. `expected = loopArmDirective(...)`로 바꾸지 않는다. win32 test(`:232`)는 유지한다.

기존 loop-arm tests 뒤에 아래 test를 추가하는 제안이다. 현재 존재하는 `freshCwd`, `ups`, `readState`, `rmSync`를 재사용한다.

```diff
+test("wp3: loop arming output is scope-first and does not activate a phase", () => {
+  for (const prompt of [
+    "cxc-loop",
+    "cxc-loop, interview-only; do not create a goal",
+    "cxc-loop, plan-only; no implementation",
+    "cxc-loop로 인터뷰만 해줘. goal 만들지 마",
+    "cxc-loop로 계획만 작성해줘. 구현하지 마",
+    "Explain the quoted example cxc-loop; read-only, no FSM changes",
+  ]) {
+    const cwd = freshCwd();
+    try {
+      const out = handleUserPromptSubmit(ups(prompt, cwd, "scope-first", "t1"));
+      const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
+      assert.match(ctx, /explicit interview-only, plan-only/);
+      assert.match(ctx, /mention or quoted example alone is not authorization/);
+      assert.match(ctx, /HOTL does not grant push, merge, release, deploy or external-message permission/);
+      assert.ok(ctx.indexOf("Scope first:") < ctx.indexOf("create_goal"));
+      const state = readState(cwd, "scope-first");
+      assert.equal(state.phase, "IDLE");
+      assert.equal(state.orchestrationActive, false);
+      assert.equal(state.loopArmSeen, true);
+    } finally {
+      rmSync(cwd, { recursive: true, force: true });
+    }
+  }
+});
```

이 fixture는 host goal 생성 금지를 실증하지 않는다. hook 출력 순서와 기존 state side effect만 검증한다. 모델 실행의 no-goal/no-build 판정은 아래 activation matrix에서 별도로 수행한다.

### H5 — phase owner와 B scope의 추가 assertion

같은 `hook.test.ts`의 `phase directives use resolvable skill mentions for spawn messages` (`:101`) 뒤에 추가한다. 기존 B active-work-phase test (`:343`)는 삭제하지 않는다.

```diff
+test("wp3: phase pointers retain owners and active work-phase boundaries", () => {
+  for (const phase of ["P", "A", "B", "C", "D"] as const) {
+    assert.match(phaseDirective(phase), /\$codexclaw:cxc-pabcd/);
+  }
+  assert.match(interviewDirective(), /\$codexclaw:cxc-interview/);
+  assert.match(interviewDirective(), /Mind dispatch/i);
+  assert.match(phaseDirective("P"), /No implementation yet/);
+  assert.match(phaseDirective("A"), /cxc-dev-code-reviewer/);
+  assert.match(phaseDirective("C"), /C-RENDER-GROUNDING-01/);
+  const bound = phaseDirective("B", { activeWorkPhase: { id: "wp3", title: "minimal hooks" } });
+  assert.match(bound, /ACTIVE WORK-PHASE: wp3 — minimal hooks/);
+  assert.match(bound, /other work-phases are OUT OF SCOPE until D closes/);
+});
```

source helper뿐 아니라 기존 UPS explicit/changed-phase 경로에서 owner pointer가 실제 stdout에 도달함을 다음 두 hunk로 검증한다. footer, phase/lastInjectedPhase/injectedTurns의 기대값은 바꾸지 않는다. I의 전용 delivery tests는 아래 표처럼 유지한다.

`plugins/codexclaw/components/pabcd-state/test/hook.test.ts:146-151`:

```diff
     assert.equal(parsed.hookSpecificOutput.additionalContext, withFooter(phaseDirective("P"), "P"));
+    assert.match(parsed.hookSpecificOutput.additionalContext, /\$codexclaw:cxc-pabcd/);
+    assert.match(parsed.hookSpecificOutput.additionalContext, /No implementation yet/);
```

`plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts:213-220`:

```diff
     assert.equal(parsed.hookSpecificOutput.additionalContext, withFooter(phaseDirective("A"), "A"));
+    assert.match(parsed.hookSpecificOutput.additionalContext, /\$codexclaw:cxc-pabcd/);
+    assert.match(parsed.hookSpecificOutput.additionalContext, /\$codexclaw:cxc-dev-code-reviewer/);
     assert.equal(readState(cwd, "s1").lastInjectedPhase, "A");
```

### H6 — SessionStart의 새 우선순위 assertion

대상: `plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts:109-120`. 기존 assertion에 추가하며 600문자 상한을 완화하지 않는다.

```diff
   assert.match(text, /cxc-loop/);
+  assert.match(text, /Bare cxc-loop means scoped HOTL/);
+  assert.match(text, /explicit interview-only, plan-only, HITL/);
+  assert.match(text, /No extra external permissions/);
   assert.ok(text.length < 600, "affordance must stay a one-liner-ish pointer");
```

같은 test의 emitted `additionalContext`에도 추가한다:

```diff
   assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Loop contract:/);
+  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Bare cxc-loop means scoped HOTL/);
+  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /explicit interview-only, plan-only, HITL/);
+  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /No extra external permissions/);
```

`G3: session-id binding line rides the SessionStart envelope` (`:122`), payload cwd/malformed fallback (`:142`), JSON wiring (`:165`), degraded PATH (`:173`)는 보전한다. full binding literal comparison은 아래 test로 추가한다. fork replay 후 마지막 binding을 쓰는지는 모델 probe에서도 확인한다.

```diff
+test("wp3: SessionStart preserves the complete binding literal for each session", () => {
+  for (const id of ["parent-session", "child-session"]) {
+    const expected = [
+      `[codexclaw] This session's id is \`${id}\`. Every mutating`,
+      "`cxc orchestrate` command (I/P/A/B/C/D/reset) MUST pass",
+      `\`--session ${id}\` — the implicit latest-session fallback is`,
+      "disabled for writes, which prevents ACCIDENTAL implicit-fallback",
+      "collisions between concurrent/forked sessions.",
+      "IDENTITY RULE: use the MOST RECENT SessionStart binding line in your",
+      "current context as the only source of your session id — older binding",
+      "lines or other ids in transcript/history belong to prior/parent sessions;",
+      "never pass those to a mutating command.",
+    ].join(" ");
+    const cwd = tmp();
+    const out = runMapAffordanceSessionStart(JSON.stringify({ cwd, session_id: id }), cwd);
+    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
+    assert.equal(renderSessionBinding(id), expected);
+    assert.equal(ctx.split("\n\n")[0], expected);
+  }
+});
```

### H7 — 현행 SoT에 동기화

대상: `docs/native-thin-harness.md:42-44`. wp3 C에서 implementation과 일치할 때만 적용하는 제안이다.

```diff
 - C0/C1 retain fast paths; higher-risk work earns deeper process
+
+Phase hooks carry compact owner pointers and current work-phase scope; the agent
+loads the applicable skill and references. Session identity, transition/evidence
+checks and bounded Stop continuation remain separate mechanical responsibilities.
+The initial guidance reduction retains existing spawn skill-body transport.
+A bare cxc-loop execution request means scoped HOTL, but explicit interview-only,
+plan-only, HITL, read-only and no-goal limits take precedence. It grants no extra
+external permissions. Self-loading transport requires measured parity before adoption.
```

## 기존 동작 보존 증거: 바꿀 assertion과 남길 assertion

| 파일 / 기존 test anchor | wp3 처리 | 증명하는 것 / 한계 |
| --- | --- | --- |
| `pabcd-state/test/hook.test.ts:232`, `:248` | win32 recipe 유지, POSIX literal만 H2로 교체 | 문구 변경이 PowerShell attest 경로를 깨지 않음. 실제 Windows 전체 실행 성공 주장은 아님 |
| `pabcd-state/test/hook-continuation.test.ts:128-211` | L17 Mind, WP4 grounding/render/independence와 explicit/passive I 전달 tests 유지 | H1의 짧은 I도 기존 literal anchor와 Mind를 전달. assertion 완화로 성공시키지 않음 |
| 같은 파일 `:213-239`, `:725-756` | mode2/mode3 및 PostCompact cursor tests 유지 | 출력의 본문은 바뀌어도 phase/flags/counter, cursor 회복, stage marker 유지 |
| `pabcd-state/test/hook.test.ts:343`, `:853`, `:1056`, `:1484` | B scope, source-delta, invalid dependency D-close, same-turn dedup 유지 | 자연어 안내 교체가 transition/close 증거 경로를 건드리지 않음 |
| `pabcd-state/test/hook-continuation.test.ts:481`, `:529`, `:539`, `:552`, `:963` | Stop idle cap, interactive release, I release, stagnation/absolute cap 유지 | HOTL 의미를 이유로 guard counter/permission을 우회하지 않음 |
| `pabcd-state/test/goal-gate.test.ts`, `session-split.test.ts`, `interview-ledger.test.ts:267` | 수정 없이 영향 검증 | goal completion/interview deny, parent-child 분리, post-answer capture/rescan 보존 |
| `subagent-config/test/spawn-attach-hook.test.ts:387-439`, `:474`, `:617`, `:843-910`, `:960-1022` | 수정 없이 영향 검증 | grant replay/deny, full-history, items/full replacement, V1/V2 inlining 및 affordance 보존 |
| `plugins/codexclaw/test/hook-e2e.test.mjs:127-142`, `:686-740` | 23개 literal/target/matcher 및 opaque payload checks 그대로 | 줄어든 hook 개수로 test를 고치지 않음. 실제 host의 암호화·context 소비는 별도 관측 |
| `cxc-ops/test/map-affordance.test.ts:109-165` | loop 의미 assertion만 추가; binding/size/cwd/wiring 유지 | sessionbinding은 map 광고와 함께 삭제되지 않음 |

위 표에서 `pabcd-state/`, `cxc-ops/`, `subagent-config/`는 모두 `plugins/codexclaw/components/` 아래다. source helper를 자기 자신과 비교하는 tests만으로 보존을 판단하지 않는다. baseline/candidate의 stdout envelope에서 허용된 안내문 값만 비교 제외하고, state/ledger/deny/block/updatedInput의 나머지는 동일 fixture로 대조한다. timestamp/nonce는 각각 의미·형태와 참조 일관성을 검사하며 비교를 위해 임의로 제거하지 않는다.

## Process hook 삭제 결정

**wp3 A는 등록 삭제 0개로 결정한다.** 이 단계의 성과는 안내문 bytes와 규칙 적용이며 process/IO 감소가 아니다. 본문만 줄여놓고 no-op/process 비용을 줄였다고 보고하지 않는다.

| 후보 | 현재 결정 / 조건 |
| --- | --- |
| `hooks/user-prompt-submit-detecting-recall-intent.json` | 순수 recall nudge의 가장 작은 삭제 후보. A 이후 별도 채택 판정에서 explicit/implicit past-work 요청 모두 agent recall 규율이 보존될 때만 manifest 등록 제거. recall CLI/skill과 startup recovery까지 같이 지우지 않음 |
| `hooks/post-compact-injecting-bg-terminal-affordance.json` | context 실제 소비를 먼저 확인. PABCD `hook.ts:1965-1977`은 PostCompact additionalContext가 무시된다고 기록하지만 cxc-ops는 출력함. source comment만으로 삭제 안전성 또는 recovery 효용을 확정하지 않음 |
| map SessionStart, worktree rename, recall startup/compact | 각각 sessionbinding/PATH, rename role guidance, CWD-local recovery와 결합됨. 계약을 옮기고 관측하기 전 삭제하지 않음 |
| spawn, goal, worktree deletion, bootstrap, cursor, evidence/review/capture/Stop | 이름에 guidance가 포함되어도 삭제 후보가 아님. mechanical/evidence channel 보존 |

이름을 바꾸거나 여러 JSON을 하나로 합치는 것은 process 감소가 아니다. 서로 다른 tool matcher의 goal guard를 합쳐도 한 호출당 기존에는 하나만 선택되므로 자동 성능 개선으로 계산하지 않는다. 삭제를 채택하는 successor는 exact manifest diff와 해당 count/registration tests를 먼저 문서화한다. 현행 runtime parser와 hook trust를 우회하는 임시 설정/하드코딩 flag는 금지한다.

## Strategy B — A 이후 필수 비교, 채택은 증거로 결정

완전한 trial 변경안과 fixture/판정/복구 계획은 [050_skill_delivery_experiment.md](050_skill_delivery_experiment.md)에 있다. **실험 실행은 필수이고 B 채택은 조건부다.** A의 실제 candidate를 baseline으로 삼아, 기존 inlining과 delivered-only selfload를 동일 조건에서 비교한다. 이 실험이 끝나기 전에는 전체 lazy-delivery 방향을 완료했다고 선언할 수 없다.

메인이 wp0 lock에서 별도 successor work-phase를 명시한다. 050은 A를 의존하고 최종 installed handoff는 050의 비교·선택 증거를 의존한다. A/B를 하나의 B 단계에 병렬 구현하거나 hardcoded flag로 둘 다 제품에 넣지 않는다. 기존 V1 실패 기록은 negative fixture의 근거이지 이번 실험을 건너뛰거나 B를 미리 탈락시키는 근거가 아니다.

현재 artifact가 selfload의 필수 규칙 누락/범위 위반/복구 비용 악화를 보여주면 최종 선택은 inlining 유지일 수 있다. 접근 불가·관측 실패는 미측정 상태이지 inlining 우세의 증거가 아니다. 050은 새 dispatcher/runtime이나 존재하지 않는 skill-read 감지 API를 추가하지 않는다.

## 의미 있는 activation / 측정 계약

기준 모델·호스트는 006의 `macmini-cf`, `gpt-6-astra`, high, Fast다. 이것은 요청 조건이며 이 문서에서 effective 적용을 확인한 결과가 아니다. 동일 prompt/fixture/권한/환경으로 baseline과 A를 비교하고, 필수 delivery 실험에서는 **A를 새 baseline**으로 삼는다. 008의 requested/forwarded priority와 authoritative scheduler 확인의 차이도 기록한다.

| 입력/상태 | 확인해야 할 실제 결과 |
| --- | --- |
| ordinary small coding/read-only 요청 | 필요한 dev/router만 선택; loop goal/새 FSM ceremony가 생기지 않음 |
| bare `cxc-loop` 실행 요청, 권한 충분 | main이 owner 계약을 읽고 scoped HOTL의 필요한 단계/증거를 실제 진행. hook 문구만 HOTL인 것은 실패 |
| loop + interview-only / plan-only / no-goal / 인용 설명, fresh inactive goal | goal 생성·B 구현·허용 밖 도구 호출 없음. 출력은 요청 단계에 머묾. H4는 이 모델 결과를 대신하지 못함 |
| 기존 active goal + I 요청 | 현행 suppress/deny/release를 관측. 직접 goal DB/FSM를 고쳐 I를 열지 않음; scope 충돌은 메인에게 보고 |
| fork/new session + parent transcript | 최신 SessionStart id로 status/허용된 mutation만 호출. parent id 재사용 없음 |
| phase 전환 / 같은 phase / compaction | compact full pointer 또는 stage header가 원래 경로로 전달; cursor/counter/goalplan 보존. owner 읽기와 reference 재선택은 필요한 만큼만 |
| reviewer/worker, V1/V2, plaintext/opaque, full/fresh history | role별 규칙·모델·effort·input keys, recursion deny와 receipt/observer 동작 보존. native items/link/body의 존재와 실제 규칙 적용을 별도 기록 |
| 거부/실패/누락 skill, required reference, malformed/oversize | 실패가 성공으로 세탁되지 않음. 필요한 규칙을 못 읽으면 결손을 보고하고 필요한 작업은 멈춤. 모델/도구/feature를 조용히 대체하지 않음 |
| 미완료 목표 / stale receipt / 관리 worktree 삭제 / authority 부족 | completion/deletion guard 유지; 외부 권한 없는 동작 실행 없음. '끝까지'를 권한 확대에 쓰지 않음 |

기록은 metadata, selected SKILL body, selected references, hook additionalContext를 분리한다. 호출 수, matcher hit, silent stateful 결과, deny/block, 추가 bytes, process creation, file IO, cold/warm p50/p95, failure/recovery 비용도 분리한다. `hook-bench.mjs:23-47`는 matcher를 버리고, `:60-73`는 generic event fixture, `:106`은 stdout-empty를 no-op으로 세므로 현재 결과를 실제 no-work 비율로 쓰지 않는다. 측정 개선은 메인의 선행 관측 slice 소유이며 wp3가 새 harness/runtime을 만들지 않는다.

채택 기준: 필수 guard/role/scope/완료 negative case 위반은 0건이어야 한다. baseline의 실패를 candidate에서 반복했다고 보존 성공으로 세지 않는다. 실제 SKILL/ref 적용과 성공률, 누락·재시도·recovery 비용을 paired 결과로 비교하고 표본 수/변동/한계를 함께 공개한다. 임의 개선율을 사후로 정하지 않는다. 줄어든 bytes와 늘어난 self-load tool/IO 비용을 함께 판단한다. source-only 및 fixture-only 증거는 real native activation과 구분한다.

## 향후 검증 명령 — 현재 NOT RUN

현재 요청의 no-tests/no-build가 PABCD의 일반 'verifier를 미리 실행' 지침보다 우선한다. 아래 명령은 파일/호출 경로를 읽어 대상 연결만 확인했으며 exit code, 테스트 pass, 설치 적용을 주장하지 않는다. 메인이 승인한 원격 candidate checkout을 working directory로 사용한다. 경로는 그 checkout 상대경로다.

```sh
node --test plugins/codexclaw/components/pabcd-state/test/hook.test.ts plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts
node --test plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts plugins/codexclaw/components/pabcd-state/test/session-split.test.ts plugins/codexclaw/components/pabcd-state/test/interview-ledger.test.ts plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts
npm run build
node --test plugins/codexclaw/test/hook-e2e.test.mjs
node plugins/codexclaw/scripts/hook-bench.mjs --json --iterations 20
```

첫 두 명령은 direct test file 인자로 source handlers를 읽는다. `package.json:22`의 build는 `plugins/codexclaw/scripts/build.mjs`로 연결되며 `build.mjs:97-102`의 기존 manifest target validator를 재사용한다. E2E는 compiled entrypoint/manifest를 읽으므로 build 이후다. 마지막 command는 process baseline 참고용이며 matcher/activation 한계를 고치지 않은 상태에서는 최종 parity verifier가 아니다. 20은 script 반복 횟수 예시이지 모델 표본 수나 통계적 충분성 선언이 아니다.

설치 검증은 source SHA → generated dist → 설치 payload/manifest → hook trust → fresh session → 실제 모델 출력/도구 trace 순서다. live session이 이전 payload를 보유할 수 있으므로 현재 대화가 새 hook을 읽었다고 가정하지 않는다. hook trust 실패를 approval/sandbox bypass로 덮지 않는다. 재설치/retrust/재시작 및 외부 쓰기는 메인의 명시적 승인 범위를 따른다.

## wp0 문서 인계와 wp3 잔여 위험

- 현재 문서 인계: `040_minimal_hooks.md` 수정과 필수 successor 계획 `050_skill_delivery_experiment.md` 신규 작성. 다른 메인/병렬 lane 문서는 수정하지 않는다.
- H1–H7은 제안이며 적용하지 않았다. source/test/manifest/skill/initiative 수정과 테스트·빌드는 하지 않았다.
- 가장 큰 위험은 pointer가 정상 출력돼도 모델이 owner를 읽거나 역할 규칙을 적용하지 않는 경우다. 문자열 green만으로 A 또는 B를 채택하지 않는다.
- H2/H3는 explicit scope 우선순위를 전달하지만 의미를 강제하지 않는다. false-positive loop trigger를 완전히 해결했다는 주장은 제외한다.
- A는 process 비용을 줄이지 않는다. B 비교는 필수 successor, B 채택과 process 등록 삭제는 별도 증거 판단이다. main은 initial goalplan에 비교 완료를 넣되 A/B를 동시 제품 구현으로 넣지 않는다.
- 현재 guard의 fail-open 구간과 native event 소비 불확실성은 문구 축소로 해결되지 않는다. 발견된 다른 결함을 이 slice에 섞지 않는다.
