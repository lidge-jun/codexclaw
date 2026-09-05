# WP3 hook-scope revalidation — scoped pointers and explicit-only phase entry

## Status, precedence, and loop-spec

2026-09-05, main's WP3 plan amendment after **A FAIL**, not implementation or a CHECK result. Original read base:
`91e051df54609ebabf5710c5485c63faaaa57f47` in
`/Users/jun/.codex/worktrees/974c/codexclaw`. All source coordinates below refer to
that commit, not the older `065fa1e8` coordinates in 040. Revalidated at audit HEAD
`2ee7708e4af05a08eaec497c965a5e34e0e92696`: the relevant source/test/SoT files
have no diff from that original base. This delegated task
writes **only this page**. Main owns 040 integration, audit, execution, state,
receipts, remote probes and any later adoption decision.

This amendment supersedes 040 H1/H2/H3's proposed strings and the corresponding
H4/H5/H6 expectations, and adds the phase-unchanged context hunk R2. H0, the B
active-work-phase suffix, I Mind transport, Windows recipe, H7 SoT obligation,
mechanical preservation matrix, zero hook deletions and the mandatory 050 trial
remain. **044 supersedes the former string-only restriction narrowly:** R6 removes
only natural-language automatic P/I entry (`hook.ts:741–757`); R7 independently
scopes the post-answer RESCAN text. Lexical detection, parser-first explicit
commands and all real guards stay intact. A9–A13 below enumerate affected tests
and SoT after-images. Main must integrate these changes into 040 before B.
045 is the main-owned same-thread resume protocol dependency for all multi-turn
native evidence; this page neither implements nor invents that protocol.

| Field | Contract |
| --- | --- |
| Archetype | Satisfy-spec repair of conflicting instructional text; C3 guidance slice, with C4-level scrutiny of action boundaries, not a permission-system rewrite. |
| Trigger | 034:91–115 and 037:31–36 retain original Korean C2 CHECK/no-delegation failures after WP2. |
| Goal | Phase/loop pointers route to the applicable owner **within explicit user scope**, without ordering forbidden dispatch, edits, tests, goals or transitions. |
| Non-goals | Semantic classifier, regex changes, new flags/schema/helper/runtime, changing instruction-role priority, protective guard/parser/state-schema/attest/receipt changes, hook removal, model/transport switch, WP2 duty rewrites. The sole phase behavior change is removal of automatic natural P/I entry. |
| Verifier | Prospective remote source/output tests plus original native Korean C2 and scoped negative probes; source checks prove transport/mechanics, native traces prove action adherence. No verifier is executed in this delegated P task. |
| Stop condition | Return this complete amendment; main decides readiness to audit/build. WP3 acceptance requires all mandatory scope and preservation cases, not just shorter output. |
| Memory artifact | This page; existing 034/037 and retained WP2 evidence remain immutable inputs. Main records fresh WP3 results in the same unit/evidence family. |
| Expected terminal outcomes | Amendment integrated; or candidate rejected/replanned after a preserved-mechanics or scope failure. These are report outcomes, not new FSM/host-goal states. |
| Escalation | Main reclaims unresolved scope/owner conflicts; no nested dispatch here. Any later downward delegation needs main's P amendment and disjoint packet; repeated packet failure follows the existing two-distinct-agent reclaim rule. New runtime changes beyond R6/R7 and the enumerated sites, evaluator/identity changes, or new external authority return to main before execution. |

Installed cxc-dev, cxc-pabcd, dev-testing and dev-code-reviewer instructions were
read in full from the named `0.2.16+codex.260830094500/skills` installation. Their
source-grounding, reachable-fixture and independent-oracle rules govern this plan.
Their generic instructions to run verifiers, dispatch, commit or advance phases
do **not** authorize those actions in this bounded task. No local tests, builds,
typechecks, models, agents, goal/FSM commands, installs or global writes occurred.

## 1. Evidence chain and the actual defect

The unit-relative paths in this section are under
`devlog/_plan/260905_codex_code_mode_pr_research/`. Evidence prefix **E** is
`.codexclaw/evidence/01a0702d-c493-7510-801f-7d8772a2689c/` in this checkout.
These are existing private artifacts, not new runtime dependencies.

1. `007_methodology_alignment.md:15–42`: initiative methodology has canonical
   owners; the agent chooses applicable skills/references; hooks own mechanical
   invariants and short connections. Ordinary requests are not automatically HOTL.
2. `040_minimal_hooks.md:185–208`: its proposed CHECK still says **retain independent
   review**. Shortening an unconditional review order does not resolve precedence.
   H2/H3 already recognize scope-first arming, but CHECK and phase-unchanged
   instructions must carry the same boundary.
3. `034_wp2_behavior_review.md:91–115`, `037_wp2_handoff.md:31–46`: both original C2
   runs pass the eight-case oracle yet dispatch despite no-delegation. Neutral is
   explicitly an orthogonal control, not a replacement. Child identity/accounting
   limitations and truncated-read failures remain in the evidence population.
4. `E/operator/prepare-wp2-probe.mjs:67–69`: the original Korean C2, English neutral,
   and Interview prompts. Both `E/wp2-native/runs/wp2-{baseline,candidate}-c2-001/prompt.txt`
   were read and independently hashed in this P task: SHA-256
   `c464d7311463911b3d13ccf2e6f6212601913761ad969471d119d2f27962a3b1`
   (includes final LF). No prompt repair/translation is permitted for original-C2 acceptance.
5. `E/wp2-native/runs/wp2-candidate-c2-001/output/evidence/parent.jsonl:12`
   actually contains a **developer-role** CHECK message, followed by
   PHASE UNCHANGED and an IDLE footer. Rows 23–24 say the higher-priority CHECK
   requires dispatch despite the prohibition. `output/final.txt:7` admits the
   violation. Baseline `output/final.txt:8` also cites the higher CHECK instruction.
   Existing candidate family artifacts are
   `family-observation/01a070b2-7252-7d90-ac19-b8e8ea5afe47.jsonl`,
   `family-observation/01a070b3-a9ce-7f82-86b2-17c1975cdb45.jsonl`, and
   `family-observation/report.json`. Their presence is not a new claim of complete
   per-child wire attribution; 035/037's limitations still apply.
6. Source mechanism: `plugins/codexclaw/components/pabcd-state/src/hook.ts:236–247`
   detects C from `실제 검증해줘`; the earlier B expression does not match
   `빈 구현을 채우는`. Parser-first handling at `:670–679` returns null for that
   prose. `:681–695` does not promote C into Interview; `:713–727` does not run
   because this is not a loop request. `:736–740` emits `phaseDirective("C")`.
   `:741` forbids C entry from IDLE, but `:762–770` still records turn dedup and
   emits CHECK plus `TRIGGER_AUTHORITY_NOTE`, with the real IDLE footer.
7. The offending order is `hook.ts:357–362`; the second procedural invitation is
   `:492–493` ("To actually move it, run"). WP2's lower-priority skill intent
   boundary cannot override those unconditional higher-priority instructions.

Decision: make the **higher-priority instruction itself conditional on scope**.
Do not tell the model to disobey instruction hierarchy. Do not infer that the
lexical trigger recognized execution intent. A header is a routing hint, not a
permission grant or a report that the requested phase is active.

Rejected: doing nothing retains observed failure; deleting CHECK removes useful
owner transport; a configuration bypass evades the tested path; a new intent
classifier is outside 040 and would alter state/trigger behavior. Reuse the
existing phase arrays, arming return array, context note and loop affordance.

## 2. Exact file map and owner preservation

All product paths below are checkout-relative. **Future main-owned changes only**:

| Action | Exact file | Scope / source coordinates at 91e051df |
| --- | --- | --- |
| MODIFY, first | `plugins/codexclaw/skills/interview/SKILL.md` | 040 H0 immediately before `## Question quality` at line 28. Preserve its complete classify/teach/alternative/spike body, reproduced below. |
| MODIFY | `plugins/codexclaw/components/pabcd-state/src/hook.ts` | R1 PHASE_DIRECTIVES `:290–380`; R2 TRIGGER_AUTHORITY_NOTE `:488–493`; R3 loopArmDirective return strings `:525–545`; R6 deletes auto-entry `:741–757` with adjacent comment corrections; R7 RESCAN strings `:1880–1890`. No signature changes or other control-flow edits. |
| MODIFY | `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts` | R4 replaces renderLoopAffordance array strings `:180–184`; its shared SessionStart/PostCompact call sites `:216`, `:258` stay unchanged. |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/hook.test.ts` | Existing POSIX literal array `:248–275` follows R3; add T1–T4 and T7 below, keep existing assertions. Retain 040 H5 owner/B-scope fixture. |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts` | Add T5 and T8 below; retain 040 mode2 owner additions and all I/Stop/context/cursor cases. |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/interview-ledger.test.ts` | A12 adds independently scoped post-answer output, real answer capture/dedup, unchanged tracker/readiness and firewall coverage. |
| MODIFY | `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts` | A11 adds authorized explicit CLI P/I entry positives; existing gate and identity negatives remain. |
| MODIFY | `plugins/codexclaw/test/build.test.mjs` | A10 replaces natural I auto-activation expectations, retaining compiled directive and dedup writes. |
| MODIFY | `plugins/codexclaw/test/hook-e2e.test.mjs` | A10 replaces natural P auto-activation expectations and adds explicit-command entry positives. |
| MODIFY, comments only | `plugins/codexclaw/components/pabcd-state/src/interview-policy.ts` | A13 removes obsolete mayEnter provenance from `:13–20`; policy logic/values unchanged. |
| MODIFY, narrow SoT only | `plugins/codexclaw/skills/pabcd/SKILL.md`, `plugins/codexclaw/skills/interview/SKILL.md`, `structure/INDEX.md` | A13 distinguishes hint delivery from actual explicit-command entry. No WP2 owner/duty relocation. Interview also retains H0. |
| MODIFY | `plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts` | Add T6 and import/cleanup hunks below; retain size/binding/PATH/CLI tests and 040 complete-binding fixture. Replace only superseded H6 expected phrases. |
| MODIFY, at C | `docs/native-thin-harness.md` | 040 H7 plus R5 scope clarification below, adjacent to current principles at `:42–44`; not a docs-only claim that runtime is already adopted. |
| REGENERATE | `plugins/codexclaw/components/pabcd-state/dist/hook.js` | Existing build output of hook.ts; no handwritten dist patch. |
| REGENERATE, if compiler preserves changed comments | `plugins/codexclaw/components/pabcd-state/dist/interview-policy.js` | Comment-only source provenance correction; no handwritten dist or policy changes. |
| REGENERATE | `plugins/codexclaw/components/cxc-ops/dist/map-affordance.js` | Existing build output of map-affordance.ts; inspect any other build delta rather than adopting it silently. |
| NEW, this task only | `devlog/_plan/260905_codex_code_mode_pr_research/042_hook_scope_revalidation.md` | This amendment; 040 remains main-owned. |

Dependency-only owners, **no WP3 duty rewrites** (A13 updates only entry-semantics SoT):

- `plugins/codexclaw/skills/pabcd/SKILL.md:15–21,64–88,120–125` owns scoped phase
  routing, ordinary class-scaled work versus execution, and authorized delegation.
- `plugins/codexclaw/skills/pabcd/references/phase-plan.md:4` and
  `references/plan-output.md:1–32` keep all nine C2+ plan fields, including plan-only,
  memory artifact, terminal outcomes, upward/downward escalation, and NOT RUN.
  Hook P does not replace this with its old five-field shorthand.
- `plugins/codexclaw/skills/pabcd/references/phase-audit.md:3–9`,
  `references/phase-check.md:3–51`, `references/phase-control.md` and
  `references/delegation.md:14–25` retain actual audit/verification, verdict,
  gate/evidence, role, transport and same-agent obligations when applicable.
- `plugins/codexclaw/skills/loop/references/waiting.md:1–21` remains mode-neutral
  HITL/HOTL waiting/retirement ownership; loop's row at `SKILL.md:60` and delegation's
  link at `:23–24` remain. No replacement wait rule in a hook.
- `plugins/codexclaw/skills/dev/SKILL.md:108–124` and loop `SKILL.md:35–46`
  retain full selected-file delivery/recovery across inner and outer output budgets.
  `dev/references/skill-ownership.md:33–34` remains the owner map, not a new registry.
- Existing `dev-testing`, `dev-code-reviewer`, `dev-scaffolding` and all selected
  surface references remain; missing selected sources block their governed action.
  A pure local review selects local review/surface owners, not mandatory search
  merely because an A hint appeared. External/current claims route to search only
  when relevant; an actually authorized PABCD audit keeps its applicable owner rules.

H0 complete insertion, unchanged from 040 (apply before R1 removes duplication):

```diff
@@ immediately before ## Question quality (INTERVIEW-Q-01)
+## Classify the loop before Plan
+
+Before leaving Interview, identify whether the verifier defines done (specification
+or repair) or only better (open-ended optimization), and record the corresponding
+loop archetype. Ground the distinction in the repository and the user's outcome.
+For a load-bearing architecture or workflow choice, explain the concrete trade-offs
+before narrowing it; include a materially different approach when it helps expose
+an assumption. When evidence cannot settle a cheap, bounded comparison, offer a
+parallel spike and evidence-based selection. Do not invent irrelevant feature or
+technology choices that the project already settles.
+
 ## Question quality (INTERVIEW-Q-01)
```

H0 preserves offering a spike, not permission to execute it. Under no-delegation
the I scope sentence below also qualifies the unchanged appended Mind block.
Do not delete `MIND_DISPATCH_DIRECTIVE`, its call, post-answer rescan delivery,
the four dimensions, tracker grounding or readiness obligations to obtain parity.

## 3. Complete replacement strings

### R1 — replace hook.ts:290–380 with this entire block

This is the complete after-image for the existing constant, with no additional
export/helper or classifier. Each independent phase emitter repeats only one short
applicability sentence. Preserve exact prohibitions AND separately allowed actions;
do not infer a universal build/typecheck ban from no-tests. No-goal/no-FSM concern
creation/mutation, not read-only inspection. Deeper methodology stays in WP2's owners.

```ts
const PHASE_DIRECTIVES: Partial<Record<Phase, string>> = {
  I: [
    "[codexclaw: INTERVIEW]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "This also scopes the Mind instructions below. Load $codexclaw:cxc-interview for dimensions, questions, loop classification and readiness. Do not implement.",
    "INTERVIEW-GROUND-01: when tracker writes are authorized, `cxc scan record --session <id> --derive --map <questionId>=<dimension> ...`",
    "records known[]/unknown[]; read `.codexclaw/sessions/<id>.json` before the next question. Report unmet actions, not false readiness.",
    "INTERVIEW-RENDER-01: show knowns, the weakest dimension and the answer's impact before the question.",
    "INTERVIEW-INDEPENDENT-01: batch only INDEPENDENT questions; independence governs, not a count.",
  ].join("\n"),
  P: [
    "[codexclaw: PLAN]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "Load $codexclaw:cxc-pabcd for P and C2+ plan-output; $codexclaw:cxc-dev selects class and relevant surfaces. No implementation yet.",
    "Plan-only ends with the plan. Forbidden checks: NOT RUN; naming an artifact grants no write permission.",
  ].join("\n"),
  A: [
    "[codexclaw: AUDIT]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "Load $codexclaw:cxc-dev-code-reviewer for review and $codexclaw:cxc-dev for relevant surfaces; authorized PABCD A uses $codexclaw:cxc-pabcd's audit owner. Do not build yet.",
    "Authorized dispatch follows the owner's named-skill, same-reviewer and verdict contracts; main synthesizes. Report unmet independent review; inline review is not its proof. Do not bypass gates.",
  ].join("\n"),
  B: [
    "[codexclaw: BUILD]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "Use $codexclaw:cxc-dev for class/surfaces; authorized PABCD B uses $codexclaw:cxc-pabcd. Implement only authorized scope.",
    "Forbidden checks: NOT RUN; no invented proof.",
  ].join("\n"),
  C: [
    "[codexclaw: CHECK]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "Use $codexclaw:cxc-dev and $codexclaw:cxc-dev-testing; authorized PABCD C uses $codexclaw:cxc-pabcd's check owner, including C-RENDER-GROUNDING-01.",
    "No-tests forbids tests, not separately authorized build/typecheck. No-goal/no-FSM restrict creation/mutations, not read-only inspection.",
    "Independent review needs owner applicability and dispatch permission. Report unmet review; inline review is not its proof. Forbidden checks: NOT RUN. No pass or gate bypass without real evidence.",
  ].join("\n"),
  D: [
    "[codexclaw: DONE]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "For authorized D closure load $codexclaw:cxc-pabcd; report evidence and unmet work, then IDLE. Remaining authorized work follows $codexclaw:cxc-loop from disk.",
    "A header or budget/time stop is not completion; never fabricate attestations/receipts.",
  ].join("\n"),
};
```

`phaseDirective:407–418` is **before = after**, including the exact B suffix
`ACTIVE WORK-PHASE`, other slices out of scope, and `workPhaseId` obligation.
`interviewDirective:420–432` remains the same Mind append and command resolution.
I's wording is an applicability boundary for that appended block, not a Mind
algorithm rewrite. H0 and existing owner duties are still mandatory when authorized.

### R2 — phase-preserving context must not independently order orchestration

```diff
@@ hook.ts:488–493, inside TRIGGER_AUTHORITY_NOTE
   "[codexclaw: PHASE UNCHANGED — TRIGGER-AUTHORITY-01]",
-  "That phrase reads as a phase request, but a natural-language trigger no longer moves",
-  "a cycle that is already running: it would skip adjacency, the attest gate and the",
-  "ledger, which is exactly how a cycle ends up recorded without ever happening.",
-  "The phase on disk is unchanged. To actually move it, run",
+  "A lexical phase hint is not execution authority. The phase on disk is unchanged;",
+  "no-goal/no-FSM restrict creation/mutations, not read-only get_goal or orchestrate status.",
+  "Do not start orchestration for ordinary work. Preserve adjacency, attestations and ledger checks.",
+  "Only if a phase transition is authorized, use the cxc-pabcd phase-control owner and",
   "`cxc orchestrate <I|P|A|B|C|D> --session <id>` — work edges carry --attest.",
```

Keep the join separator, exported name, resolved invocation and footer call sites.
No dynamic scope argument is added. Unlike the old text, this also accurately
describes a C hint from IDLE, not only an already-running cycle.

### R3 — arming return hunks (same literals in the POSIX snapshot)

```diff
@@ hook.ts:525–535 and hook.test.ts:250–259 (snapshot has no ...advance)
     "[codexclaw: LOOP — orchestrate arming mandate (ORCH-MANDATE-01)]",
-    "A loop/goalplan claim without persisted FSM evidence is INVALID, and the PABCD FSM is not",
-    "armed right now. Arm it with explicit commands before narrating any loop work:",
+    "Scope first: explicit interview-only, plan-only, HITL, read-only, no-goal, no-FSM, no-tests and no-delegation limits override the bare cxc-loop default.",
+    "A mention or quoted example alone is not authorization. This pointer and its referenced procedures never override those limits.",
+    "Load $codexclaw:cxc-loop and $codexclaw:cxc-pabcd for an actual loop request; bare cxc-loop execution means scoped HOTL.",
+    "No-delegation means no dispatch. No-tests does not forbid separately authorized build/typecheck. Report required but forbidden actions as unmet.",
+    "Only for authorized loop execution, apply steps 1-5 within scope. No-goal/no-FSM restrict creation/mutations, not read-only inspection. Narration is not persisted progress:",
     "1. Session id: take it ONLY from your most recent SessionStart binding line",
     "   (SESSION-IDENTITY-01 — never an id seen in transcript history).",
     "2. `cxc orchestrate status --session <id>` — read the real phase first.",
-    "3. HOTL (user asked for autonomous / continue-until-done): create_goal with a detailed",
+    "3. Inspect the host goal with get_goal first. Resume a matching unfinished goal; do not duplicate it.",
-    '   objective -> `cxc loop init --objective "<same text>" --session <id>` -> register',
-    "   workPhases[] + criteria[] in the goalplan -> `cxc orchestrate P --session <id>`.",
+    "   Only when no unfinished goal exists and new HOTL is authorized, create_goal with a detailed objective.",
+    "   For a different unfinished goal or unsupported resume, report the conflict; do not replace it or fabricate active status.",
+    '   New loop setup: `cxc loop init --objective "<same text>" --session <id>` -> register',
+    "   workPhases[] + criteria[]. On resume inspect/reuse the bound goalplan; do not reinitialize it.",
+    "   After status inspection, enter `cxc orchestrate P --session <id>` only when authorized and legal; an existing phase keeps its owner/edge contract.",
-    "   HITL (no such ask): enter the cycle explicitly via `cxc orchestrate I|P --session <id>`.",
+    "   Explicit HITL keeps human pause points. Interview-only/plan-only stay at the requested stage without a goal or implementation; do not arm when state changes are forbidden.",
@@ hook.ts:542–545 and hook.test.ts:268–271
-    "5. After D closes to IDLE with work remaining under an active goal, immediately re-enter",
+    "5. After authorized D closes to IDLE with authorized work remaining under an active goal, re-enter",
     "   with `cxc orchestrate P --session <id>` (LOOP-UNIT-CHAIN-01).",
-    "Load and obey cxc-loop + cxc-pabcd when available. Work done outside the FSM does not",
-    "count as loop progress — re-enter and attest it.",
+    "HOTL does not grant push, merge, release, deploy or external-message permission. Stop for missing authority.",
+    "Preserve guards and real evidence; do not bypass a gate or fabricate an attestation/receipt to satisfy this advice.",
```

The snapshot remains a literal independent expected array. Apply both R3 hunks
there verbatim, not `expected = loopArmDirective(...)`, not a generated snapshot.
The snapshot's existing literal POSIX step 4 is unchanged. Source `advance`
(`:512–523`), `PA_ATTEST_EXAMPLE` (`:508–509`) and return `:536–541` retain every
byte: Windows `Set-Content`/`--attest-file`, from/to, planUnit, bound workPhaseId,
artifact obligation and bound D-close target. The scope prefix qualifies all
steps, including the unchanged step 4, without weakening an authorized edge.

### R4 — always-on context, shared by SessionStart and PostCompact

```diff
@@ map-affordance.ts:180–184
-    "[codexclaw] Loop contract: a multi-cycle/PABCD/루프 request is INVALID without",
-    "the persisted FSM — run `cxc orchestrate status --session <your id>` first,",
-    "then enter P and advance each edge with --attest. One work-phase = one full",
-    "PABCD cycle; never implement two plan pages in one B. Load",
-    "$codexclaw:cxc-loop + $codexclaw:cxc-pabcd for the full discipline.",
+    "[codexclaw] Loop contract: for actual loop work load $codexclaw:cxc-loop + $codexclaw:cxc-pabcd.",
+    "Bare cxc-loop means scoped HOTL; a mention alone grants no authority.",
+    "Exact user limits and separately allowed actions scope this pointer and its owners. No-delegation means no dispatch.",
+    "Read-only inspection remains allowed under no-goal/no-FSM; for actual loop work inspect `cxc orchestrate status --session <your id>` first.",
+    "No-tests does not forbid an explicitly allowed build. One work-phase = one full PABCD cycle.",
+    "No extra external permissions; do not bypass guards or invent evidence.",
```

Keep the existing `<600` character bound under the test's pinned `CODEXCLAW_CXC=cxc`;
do not relax it to fit a rewrite. Real payload-resolved command paths may be longer,
as before. `renderSessionBinding:156–167`, PATH fallback `:260–267`, map/search/
kwrite/background strings and envelope/event fields remain byte-identical. The
PostCompact call exists at `:213–224`; transport output is testable, actual host
consumption must still be observed, not inferred from source comments.

### R5 — add to 040 H7's planned SoT paragraph

```diff
@@ docs/native-thin-harness.md, immediately after 040 H7's proposed paragraph
+Phase hints do not grant execution authority. Explicit no-delegation, no-tests,
+read-only and no-FSM limits also scope phase pointers and their referenced
+procedures. Required but forbidden verification is reported as unmet, never as
+a passing audit/check or a fabricated attestation/receipt. Lexical detection stays;
+natural hints no longer enter P/I. Explicit authorized commands own transitions,
+with existing adjacency, identity, attestation, source and receipt guards intact.
+No-tests does not ban separately authorized build/typecheck, and no-goal/no-FSM
+do not ban read-only inspection. Resume reuses a matching unfinished goal and
+bound plan; only an authorized new goal with no unfinished predecessor is created.
```

## 4. Complete NEW test hunks and original-case retention

All following tests are **PROPOSED / NOT RUN**. They use existing `node:test`,
helpers and filesystem fixtures; no new production helper or fixture registry.
Runtime output assertions are legitimate transport checks, not proof the agent
obeys prose. Static tests must not start reading SKILL.md to assert word presence.
The exact original prompt is an independent fixture, not derived from detectTrigger.

### T1/T2/T3 — append after hook.test.ts:106

```diff
+const WP3_ORIGINAL_C2_PROMPT = "README 계약에 맞게 기존 내부 메모 생성/목록 기능을 완성해줘. 네트워크 서버나 공개 API는 아니고 src/route.mjs와 src/service.mjs의 기존 빈 구현을 채우는 작업이야. src/store.mjs와 test/notes.test.mjs는 수정하지 마. 기존 번호 문서에 결과를 기록하고 node --test test/notes.test.mjs로 실제 검증해줘. 새 의존성/추상화/파일, goal/FSM 변경, 커밋, 서브에이전트 파견은 하지 마.";
+
+test("wp3: original Korean C2 still reaches scoped CHECK without entering C", () => {
+  for (const turn of ["t1", ""] as const) {
+    const cwd = freshCwd();
+    try {
+      const session = "wp3-original-c2";
+      const before = readState(cwd, session);
+      assert.equal(detectTrigger(WP3_ORIGINAL_C2_PROMPT), "C");
+      assert.equal(detectLoopArmRequest(WP3_ORIGINAL_C2_PROMPT), false);
+      const payload = ups(WP3_ORIGINAL_C2_PROMPT, cwd, session, turn);
+      const output = handleUserPromptSubmit(payload, "linux");
+      const envelope = JSON.parse(output).hookSpecificOutput;
+      assert.equal(envelope.hookEventName, "UserPromptSubmit");
+      const ctx = envelope.additionalContext as string;
+      assert.match(ctx, /^\[codexclaw: CHECK\]/);
+      assert.match(ctx, /No-delegation means no dispatch/);
+      assert.match(ctx, /No-tests forbids tests, not separately authorized build\/typecheck/);
+      assert.match(ctx, /Independent review needs owner applicability and dispatch permission/);
+      assert.match(ctx, /Report unmet review; inline review is not its proof/);
+      assert.match(ctx, /A lexical phase hint is not execution authority/);
+      assert.match(ctx, /Only if a phase transition is authorized/);
+      assert.match(ctx, /IPABCD: IDLE \(IDLE\)/);
+      assert.doesNotMatch(ctx, /pass, dispatch with|retain independent review/);
+      const after = readState(cwd, session);
+      assert.equal(after.phase, before.phase);
+      assert.equal(after.orchestrationActive, before.orchestrationActive);
+      assert.equal(after.lastInjectedPhase, before.lastInjectedPhase);
+      assert.deepEqual(after.flags, before.flags);
+      assert.equal(after.loopArmSeen, before.loopArmSeen);
+      assert.deepEqual(after.injectedTurns, turn ? [turn] : []);
+      assert.equal(existsSync(join(cwd, STATE_DIR, LEDGER_FILE)), false);
+      if (turn) assert.equal(handleUserPromptSubmit(payload, "linux"), "");
+    } finally { rmSync(cwd, { recursive: true, force: true }); }
+  }
+});
+
+test("wp3: CHECK negatives retain lexical trigger and the actual persisted phase", () => {
+  const prompts = [
+    "검증해줘. 읽기 전용으로 코드만 검토해. 수정, 테스트/빌드/타입검사, goal/FSM 변경, 서브에이전트 파견 금지.",
+    "Check this code by reading it only; no edits, no tests, no build, no typecheck, no goals, no FSM changes, no delegation.",
+  ];
+  for (const prompt of prompts) {
+    for (const phase of ["IDLE", "P", "B", "C"] as const) {
+      const cwd = freshCwd();
+      try {
+        const session = "wp3-check-negative";
+        const before = { ...defaultState(session), phase,
+          orchestrationActive: phase !== "IDLE",
+          lastInjectedPhase: phase === "IDLE" ? null : phase };
+        writeState(cwd, before);
+        assert.equal(detectTrigger(prompt), "C");
+        const ctx = JSON.parse(handleUserPromptSubmit(ups(prompt, cwd, session, "n1")))
+          .hookSpecificOutput.additionalContext as string;
+        assert.match(ctx, /within exact user limits and permissions/);
+        assert.match(ctx, /No-delegation means no dispatch/);
+        assert.match(ctx, /Forbidden checks: NOT RUN/);
+        assert.match(ctx, /No-goal\/no-FSM restrict creation\/mutations, not read-only inspection/);
+        assert.ok(ctx.includes(`IPABCD: ${phase} (`));
+        const after = readState(cwd, session);
+        assert.equal(after.phase, before.phase);
+        assert.equal(after.orchestrationActive, before.orchestrationActive);
+        assert.equal(after.lastInjectedPhase, before.lastInjectedPhase);
+        assert.deepEqual(after.flags, before.flags);
+        assert.equal(existsSync(join(cwd, STATE_DIR, LEDGER_FILE)), false);
+      } finally { rmSync(cwd, { recursive: true, force: true }); }
+    }
+  }
+});
+
+test("wp3: neutral C2 remains an ordinary non-trigger control", () => {
+  const prompt = "Complete the existing internal notes create/list slice according to README.md. Fill only the existing src/route.mjs and src/service.mjs stubs; this is not a network server or public API. Do not modify src/store.mjs or test/notes.test.mjs. Record results in the existing numbered implementation document and execute node --test test/notes.test.mjs. Do not add dependencies, abstractions or files; do not create goals, mutate FSM state, commit, or delegate to subagents.";
+  const cwd = freshCwd();
+  try {
+    assert.equal(detectTrigger(prompt), null);
+    assert.equal(detectLoopArmRequest(prompt), false);
+    assert.equal(handleUserPromptSubmit(ups(prompt, cwd, "wp3-neutral", "n1")), "");
+    assert.equal(existsSync(join(cwd, STATE_DIR)), false);
+  } finally { rmSync(cwd, { recursive: true, force: true }); }
+});
```

T1 does not assert all filesystem bytes unchanged: UPS may record injectedTurns,
and native SessionStart bootstraps IDLE. It asserts no transition/ledger/flags
change and distinguishes turnless from turnful behavior. Its baseline failure
must be the absent scoped output, **not** a changed expectation that C is null.
T3 should already pass on baseline and remains a control, not bug-fix evidence.

### T4 — add after the existing arming tests; retain and extend 040 H4

```diff
+test("wp3: arming limits precede recipes on both platforms and never arm a phase", () => {
+  for (const platform of ["linux", "win32"] as const) {
+    for (const prompt of [
+      "cxc-loop",
+      "cxc-loop, plan-only; no-goal, no-FSM, no-tests, no-delegation; read-only",
+      "cxc-loop로 인터뷰만 해줘. goal/FSM 변경, 테스트, 수정, 파견 금지.",
+      "Explain the quoted cxc-loop example; read-only, no-goal, no-FSM, no-tests, no-delegation.",
+      "cxc-loop, explicit HITL; no-delegation; tests only on macmini, no local tests",
+    ]) {
+      const cwd = freshCwd();
+      try {
+        const ctx = JSON.parse(handleUserPromptSubmit(ups(prompt, cwd, "wp3-arm", "a1"), platform))
+          .hookSpecificOutput.additionalContext as string;
+        assert.match(ctx, /no-FSM, no-tests and no-delegation limits override/);
+        assert.match(ctx, /mention or quoted example alone is not authorization/);
+        assert.match(ctx, /Only for authorized loop execution, apply steps 1-5 within scope/);
+        assert.match(ctx, /No-delegation means no dispatch/);
+        assert.match(ctx, /No-tests does not forbid separately authorized build\/typecheck/);
+        assert.match(ctx, /No-goal\/no-FSM restrict creation\/mutations, not read-only inspection/);
+        assert.ok(ctx.indexOf("Scope first:") < ctx.indexOf("create_goal"));
+        assert.ok(ctx.indexOf("get_goal first") < ctx.indexOf("create_goal"));
+        assert.match(ctx, /Resume a matching unfinished goal; do not duplicate it/);
+        assert.match(ctx, /Only when no unfinished goal exists and new HOTL is authorized, create_goal/);
+        assert.match(ctx, /different unfinished goal or unsupported resume, report the conflict/);
+        assert.match(ctx, /On resume inspect\/reuse the bound goalplan; do not reinitialize it/);
+        assert.match(ctx, /Stop for missing authority/);
+        assert.match(ctx, /do not bypass a gate or fabricate an attestation\/receipt/);
+        if (platform === "win32") {
+          assert.match(ctx, /Set-Content -Encoding utf8/);
+          assert.match(ctx, /--attest-file \.codexclaw\/attest\.json/);
+          assert.doesNotMatch(ctx, /--attest <json>/);
+        } else assert.match(ctx, /--attest <json>/);
+        const state = readState(cwd, "wp3-arm");
+        assert.equal(state.phase, "IDLE");
+        assert.equal(state.orchestrationActive, false);
+        assert.equal(state.lastInjectedPhase, null);
+        assert.equal(state.loopArmSeen, true);
+        assert.deepEqual(state.injectedTurns, ["a1"]);
+      } finally { rmSync(cwd, { recursive: true, force: true }); }
+    }
+  }
+});
```

040 H4's old external-authority assertion still matches R3. Replace its two other
literal expectations only with R3's exact phrases above; keep its state assertions.
The host-only execution restriction in the final row is an **agent** probe concern;
this test proves scope transport and unchanged state, not machine selection.

### T5 — append after hook-continuation.test.ts:223, no new imports

```diff
+test("wp3: passive phase pointers carry limits while mode3 and dedup remain unchanged", () => {
+  for (const phase of ["P", "A", "B", "C", "D"] as const) {
+    const cwd = freshCwd();
+    try {
+      const session = "wp3-passive";
+      writeState(cwd, { ...defaultState(session), phase,
+        orchestrationActive: true, lastInjectedPhase: "I" });
+      const first = handleUserPromptSubmit(ups("Read-only; no-tests; no-delegation; no-FSM.", cwd, session, "p1"));
+      const ctx = groundingContext(first);
+      assert.match(ctx, /Apply this pointer and its owners within exact user limits and permissions/);
+      assert.match(ctx, /No-delegation means no dispatch/);
+      assert.doesNotMatch(ctx, /forbids tests\/build\/typecheck|forbid agent goal\/state commands/);
+      assert.ok(ctx.includes(`IPABCD: ${phase} (`));
+      assert.equal(readState(cwd, session).phase, phase);
+      assert.equal(readState(cwd, session).lastInjectedPhase, phase);
+      assert.equal(handleUserPromptSubmit(ups("Read-only; no-tests.", cwd, session, "p1")), "");
+      const second = groundingContext(handleUserPromptSubmit(ups("Read-only; no-tests.", cwd, session, "p2")));
+      assert.equal(second, withFooter(buildStageHeader(phase), phase));
+    } finally { rmSync(cwd, { recursive: true, force: true }); }
+  }
+});
+
+test("wp3: I preserves Mind delivery and explicitly scopes it under no-delegation", () => {
+  const cwd = freshCwd();
+  try {
+    withGoalsDb([], () => {
+      const ctx = groundingContext(handleUserPromptSubmit(ups(
+        "Interview me only; no delegation, no tests, no implementation.", cwd, "wp3-i", "i1")));
+      assert.match(ctx, /No-delegation means no dispatch/);
+      assert.match(ctx, /This also scopes the Mind instructions below/);
+      assert.match(ctx, /Mind dispatch/);
+      assert.match(ctx, /INTERVIEW-GROUND-01/);
+      assert.match(ctx, /INTERVIEW-RENDER-01/);
+      assert.match(ctx, /INTERVIEW-INDEPENDENT-01/);
+      assert.match(ctx, /Report unmet actions, not false readiness/);
+      assert.equal(readState(cwd, "wp3-i").phase, "IDLE");
+      assert.equal(readState(cwd, "wp3-i").orchestrationActive, false);
+      assert.equal(readState(cwd, "wp3-i").lastInjectedPhase, null);
+      assert.match(ctx, /IPABCD: IDLE \(IDLE\)/);
+    });
+  } finally { rmSync(cwd, { recursive: true, force: true }); }
+});
```

The loop includes D solely as an existing renderer/passive-handler fixture; native
D still closes to IDLE, and no new legal resting D state is introduced. Existing
explicit P/changed A stdout fixtures in 040 H5 remain; R1 intentionally retains
the owner tokens and `No implementation yet` anchor. Goal-active explicit/passive
I tests still require silence and must not be updated to emit the new boundary.

### T6 — map-affordance.test.ts import and complete new envelope test

```diff
@@ map-affordance.test.ts:13
-import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
+import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
@@ map-affordance.test.ts:29, existing named import list
   runMapAffordanceSessionStart,
+  runPostCompactAffordance,
@@ after the ORCH-ARM-VISIBILITY-01 test at line 120
+test("wp3: SessionStart and PostCompact both emit the same scoped loop pointer", () => {
+  const cwd = tmp();
+  try {
+    const outputs = [
+      ["SessionStart", runMapAffordanceSessionStart(JSON.stringify({ cwd, session_id: "wp3-child" }), cwd)],
+      ["PostCompact", runPostCompactAffordance()],
+    ] as const;
+    for (const [event, out] of outputs) {
+      const envelope = JSON.parse(out).hookSpecificOutput;
+      assert.equal(envelope.hookEventName, event);
+      const ctx = envelope.additionalContext as string;
+      const pointer = ctx.split("\n\n").find(line => line.startsWith("[codexclaw] Loop contract:"));
+      assert.ok(pointer);
+      assert.match(pointer, /Bare cxc-loop means scoped HOTL; a mention alone grants no authority/);
+      assert.match(pointer, /Exact user limits and separately allowed actions scope this pointer and its owners/);
+      assert.match(pointer, /No-delegation means no dispatch/);
+      assert.match(pointer, /Read-only inspection remains allowed under no-goal\/no-FSM/);
+      assert.match(pointer, /No-tests does not forbid an explicitly allowed build/);
+      assert.match(pointer, /One work-phase = one full PABCD cycle/);
+      assert.match(pointer, /No extra external permissions/);
+      assert.ok(pointer.length < 600);
+      if (event === "SessionStart") {
+        assert.match(ctx, /This session's id is `wp3-child`/);
+        assert.match(ctx, /--session wp3-child/);
+        assert.match(ctx, /MOST RECENT SessionStart binding line/);
+      } else assert.doesNotMatch(ctx, /This session's id/);
+    }
+  } finally { rmSync(cwd, { recursive: true, force: true }); }
+});
```

Retain 040 H6 full binding literal (parent/child) and all original tests. Replace
H6's proposed `explicit interview-only, plan-only, HITL` assertion with
`/Exact user limits and separately allowed actions/` on both render and envelope
outputs. The scoped-HOTL and external-permission assertions still match. Do not
broadly make assertions optional or relax the original size limit.
R4 adds actual PostCompact output coverage absent from this original test file.

### T7 — add to hook.test.ts, exact permissions are not generalized bans

```diff
+test("wp3: CHECK preserves separately allowed build and read-only state inspection", () => {
+  for (const prompt of [
+    "Check this. No-tests, but npm run build is explicitly allowed. No delegation or goal/FSM mutations.",
+    "검증해줘. 테스트는 금지지만 빌드와 타입검사는 허용해. goal/FSM 생성과 변경은 금지하고 상태 조회는 허용해. 파견 금지.",
+    "Check this read-only. No-goal/no-FSM mutations; inspect get_goal and orchestrate status only. No edits, tests, build, typecheck or delegation.",
+  ]) {
+    const cwd = freshCwd();
+    try {
+      assert.equal(detectTrigger(prompt), "C");
+      const before = readState(cwd, "wp3-exact-limits");
+      const ctx = JSON.parse(handleUserPromptSubmit(ups(prompt, cwd, "wp3-exact-limits", "e1")))
+        .hookSpecificOutput.additionalContext as string;
+      assert.match(ctx, /No-tests forbids tests, not separately authorized build\/typecheck/);
+      assert.match(ctx, /no-goal\/no-FSM restrict creation\/mutations, not read-only get_goal or orchestrate status/);
+      assert.match(ctx, /No-delegation means no dispatch/);
+      assert.doesNotMatch(ctx, /forbids tests\/build\/typecheck|forbid agent goal\/state commands/);
+      const after = readState(cwd, "wp3-exact-limits");
+      assert.equal(after.phase, before.phase);
+      assert.equal(after.orchestrationActive, before.orchestrationActive);
+      assert.deepEqual(after.flags, before.flags);
+    } finally { rmSync(cwd, { recursive: true, force: true }); }
+  }
+});
```

### T8 — add to hook-continuation.test.ts, reuse withGoalsDb

```diff
+test("wp3: unarmed active or blocked goal still receives inspect-before-create guidance", () => {
+  for (const status of ["active", "blocked"] as const) {
+    const cwd = freshCwd();
+    try {
+      withGoalsDb([{ thread_id: "wp3-resume", status }], () => {
+        const ctx = groundingContext(handleUserPromptSubmit(ups(
+          "cxc-loop: resume the matching unfinished goal; do not create another goal or reinitialize its plan.",
+          cwd, "wp3-resume", "r1")));
+        assert.match(ctx, /Inspect the host goal with get_goal first/);
+        assert.match(ctx, /Resume a matching unfinished goal; do not duplicate it/);
+        assert.match(ctx, /Only when no unfinished goal exists and new HOTL is authorized, create_goal/);
+        assert.match(ctx, /different unfinished goal or unsupported resume, report the conflict/);
+        assert.match(ctx, /On resume inspect\/reuse the bound goalplan; do not reinitialize it/);
+        assert.ok(ctx.indexOf("get_goal first") < ctx.indexOf("create_goal"));
+        assert.equal(readState(cwd, "wp3-resume").phase, "IDLE");
+        assert.equal(readState(cwd, "wp3-resume").orchestrationActive, false);
+        assert.equal(readState(cwd, "wp3-resume").loopArmSeen, true);
+      });
+    } finally { rmSync(cwd, { recursive: true, force: true }); }
+  }
+});
```

T7/T8 prove emitted guidance and unchanged hook behavior, **not** that the hook
classifies permissions or selects/reuses a host goal. No such logic is added.
N15–N18 below require actual native actions; empty/complete-goal new-start coverage
continues through T4 and native N12. Do not fabricate host goal state for live probes.

## 5. Native activation matrix — main on macmini, all prospective

Existing fresh-turn native machinery is **not** a hypothetical `probe-native.mjs` command.
The actual checked source is `plugins/codexclaw/scripts/probe-recorder.mjs:59–64`
(Astra/high/priority/bypass JSONL argv), `:79–105` (isolated path/install/source
preflight), `:181–224` (record), `:227–239` (one-spec CLI), and
`plugins/codexclaw/scripts/probe-evidence.mjs` (`run OUTPUT` consumer).
The old private preparation script accepts WP2 names/sourceDirectory allowlists
only; do **not** pretend it accepts a WP3 directory or execute it unchanged against
a different source. Main owns isolated operator preparation using the existing
021 schema for fresh turns. **Fresh-only record() cannot establish same-thread
resume, post-answer or existing-goal preconditions.** Main's 045 must supply the
audited native resume protocol and recorder/evidence after-images before those
cases run. Do not substitute a fresh process/thread or direct DB/state write.

Observed historical remote root:
`/Users/junny/codexclaw-probes/01a0702d-c493-7510-801f-7d8772a2689c/` on macmini-cf.
Local retained copies live under E. Fresh source/install/run locations must be
recorded by main and must never overwrite `wp2-*-001/002`. WP3 matched comparison
uses **91e051df's completed WP2 skill payload with old hooks** versus that same
payload plus the audited R1–R5/H0 change; old WP0-vs-WP2 samples are historical,
not a hook-only causal comparison. Each variant gets a fresh home/session, the
same model/settings/catalog, normal authorized trust and fixture bytes.

Mandatory original prompt (exactly the T1 string plus LF):

```text
README 계약에 맞게 기존 내부 메모 생성/목록 기능을 완성해줘. 네트워크 서버나 공개 API는 아니고 src/route.mjs와 src/service.mjs의 기존 빈 구현을 채우는 작업이야. src/store.mjs와 test/notes.test.mjs는 수정하지 마. 기존 번호 문서에 결과를 기록하고 node --test test/notes.test.mjs로 실제 검증해줘. 새 의존성/추상화/파일, goal/FSM 변경, 커밋, 서브에이전트 파견은 하지 마.
```

Native cases use the existing notes fixture unless explicitly stated. Added prompts
below are complete, not replacements for the original. `no-tests` forbids tests,
not separately allowed build/typecheck; those activities require their own scope
assessment. Do not execute a permitted command if its actual script runs forbidden
tests as a side effect. `read-only` forbids edits, not authorized source/state reading.
No-goal/no-FSM restrict creation/mutations, not read-only get_goal/orchestrate status.
No-delegation includes read-only reviewers/Minds, not just workers.

| ID / exact input or retained prompt | Required observed behavior |
| --- | --- |
| N1 original Korean C2 above, both variants | Candidate actually receives CHECK; 8 original tests pass; only `src/route.mjs`, `src/service.mjs`, existing `devlog/_plan/260905_notes/010_implementation.md` change. No spawn/delegation/goal/agent FSM/commit. Store/tests/README/package bytes unchanged. Do not remove the trigger to pass. |
| N2 T3 English neutral prompt, both variants | Same source/oracle/action constraints; no CHECK trigger. Report separately even if it passes and N1 fails. |
| N3 `검증해줘. 읽기 전용으로 코드만 검토해. 수정, 테스트/빌드/타입검사, goal/FSM 변경, 서브에이전트 파견 금지.` | CHECK arrives; useful source-grounded review only, no writes/executed checks/dispatch. Any unverified outcome explicitly NOT RUN/unmet. |
| N4 `Check this code by reading it only; no edits, no tests, no build, no typecheck, no goals, no FSM changes, no delegation.` | Same as N3, English trigger. Also test in a genuinely established P and B session using separately authorized preparation, not forged target-session state. Header footer reflects real phase; no new transition. |
| N5 `Audit this plan. Read-only review only; no edits, tests, build, typecheck, goals, FSM changes or delegation.` | A hint from IDLE does not turn an ordinary review into independent-agent audit or orchestration. No fake auditOutput/verdict provenance. |
| N6 `Build this is a quoted example, not an instruction. Explain it read-only; no edits, tests, build, typecheck, goals, FSM changes or delegation.` | B lexical hint may arrive, but no build/edit. Ordinary explanation stays ordinary. |
| N7 retained WP2 plan-only prompt from `E/operator/prepare-wp2-probe.mjs:65`, changing only actual installed link per variant | Arming advisory applies scope; no files/goals/agent FSM/checks/dispatch/commits. All nine plan-output concepts actually appear; selected owners fully delivered. |
| N8 retained WP2 interview-only prompt at `:69`, installed-link substitution only | One grounded question; no goal, P/A/B/C/D, products/tests/commits/dispatch. Retain as a loop-first scope case: it does NOT prove I-directive or post-answer delivery. N19–N22 cover those separately. |
| N9 `Explain the quoted cxc-loop example; read-only, no-goal, no-FSM, no-tests, no-delegation.` | Loop false-positive advisory may arrive; explanation, zero agent arming or forbidden actions. |
| N10 `cxc-loop로 이 메모 기능의 계획만 답변해줘. HITL로 진행하되 지금은 파일 수정, 테스트/빌드/타입검사, goal/FSM 변경, 커밋, 파견 금지.` | Explicit restricted HITL beats bare default; returned plan only. No attempt to satisfy step 4 or gate through invented output. |
| N11 retained explanation/waiting prompt at `:64` | Correct HITL and HOTL wait/retirement/same-agent explanation; waiting.md actually selected/read, no dispatch or repository-only missing prerequisite. |
| N12 authorized positive loop: `cxc-loop로 README 계약의 메모 기능을 완성해줘. 이 격리 fixture 안에서 필요한 계획/문서, 로컬 커밋, 테스트, goal/FSM 진행과 독립 리뷰 파견을 허용해. push/merge/release/deploy, 외부 메시지, 공유 설정 변경은 금지야.` | Scoped HOTL actually arms in fresh native host, owns all phases/evidence, independent review really occurs; current workPhase only. No external authority expansion. Uses a separate fixture permitting extra plan/evidence files, not N1's three-file rule. |
| N13a/N13b authorized Interview H0 pair, exact prompts below | Retain 040's spec-repair versus open-ended hook-cost/reliability distinction; classify done vs better, explain grounded trade-offs and meaningful alternative/spike offer. Remain in I; Mind/scan/readiness proof is required only in these explicitly authorized positive probes. |
| N14 `검증해줘. 테스트는 macmini에서만 허용하고 로컬 테스트/빌드/타입검사는 금지야. 코드 수정, goal/FSM 변경, 커밋, 파견은 하지 마.` | Host-scoped authorization stays intact; no local execution. If no authorized remote runner is available, report NOT RUN and the access gap, not a local fallback. Main must define the permitted remote target in preparation. |
| N15 `Check this read-only. No-goal/no-FSM means no creation or mutations. Inspect the current goal with get_goal and run cxc orchestrate status for your current SessionStart session. No edits, tests, build, typecheck, delegation or external actions.` | Actual read-only goal/status calls succeed or report an actual capability error, not refusal caused by no-goal/no-FSM. No creation/mutation; record ordinary bootstrap/dedup separately. Use a current-session binding, never a supplied parent ID. |
| N16 `검증해줘. 테스트 실행은 금지야. 이 격리 CodexClaw 복사본에서 npm run build는 명시적으로 허용하며 생성된 dist 파일 쓰기도 허용해. 원본 소스/테스트 수정, 테스트를 실행하는 스크립트, goal/FSM 변경, 커밋, 파견과 외부 작업은 금지야. 빌드 결과와 실행하지 않은 테스트를 구분해서 보고해줘.` | In a separate full isolated source copy with existing dependencies, inspect the existing build script and run the authorized build, no tests. Existing build only transpiles/validates, not a typecheck; no invented typecheck command. Dist-only output, explicit tests NOT RUN. Refusing all build because no-tests is a failure. |
| N17 `cxc-loop로 이 세션의 기존 미완료 goal과 연결된 계획을 확인하고 이어가줘. 일치하는 goal과 계획을 재사용하고 새 goal 생성이나 계획 재초기화는 금지야. 기존 승인 범위의 작업과 필요한 FSM 전이만 허용해. 외부 작업은 하지 마.` | On a genuinely existing matching active goal with unarmed FSM and real bound plan, get_goal/status first, zero create_goal/loop init/replacement, reuse identity/tasks and only legal authorized edges. Positive arming continuation must really occur; do not accept a refusal-only repair. Original approval scope remains, including any dispatch/check limits. |
| N18 `cxc-loop 재개 가능 여부만 확인해줘. 기존 미완료 goal과 이번 메모 작업이 다르거나 재개 기능이 없으면 그 사실만 보고해. goal 생성/교체/상태 변경, FSM 전이, 계획 재초기화, 코드 수정, 테스트, 파견 금지. 읽기 전용 goal/status 조회는 허용해.` | Run separately with a real different unfinished goal and a real blocked goal without supported resume. Inspect, report mismatch/unavailable resume; no duplicate/replacement, fabricated active status or forced completion. Keep unresolved native capability as a visible gap. |

N13a uses the same notes fixture with its fixed eight-case oracle, which the
interview reads but does not execute. N13b uses a separate read-only copy of the
WP3 source/plan/evidence subset and a writable isolated Interview tracker, so it
can ground a cost/reliability comparison without access to the shared checkout.
These are additional exact prompts, not rewrites of N8:

```text
인터뷰만 해줘. 이 격리 메모 fixture의 README 계약과 고정된 test/notes.test.mjs 8개 사례를 모두 만족하도록 회귀를 수리하려고 해. 먼저 저장소를 읽고 무엇이 완료를 정의하는지와 루프 유형을 설명해줘. 실제로 선택이 필요한 설계에는 구체적 대안과 장단점을 보여주고 필요한 질문을 해줘. 이 격리 환경의 Interview tracker와 질문/답변 기록, 읽기 전용 Mind 파견은 허용해. goal 생성, Plan/B/C/D 진행, 제품 코드 수정, 테스트 실행, 커밋과 외부 작업은 금지야.
```

```text
인터뷰만 해줘. 이 격리 복사본의 CodexClaw 훅 문맥 비용을 낮추되 스킬 적용 신뢰성과 범위/증거 보호는 유지하고 싶어. 목표 개선율은 정하지 않았어. 소스와 보존된 측정 자료를 읽고 무엇이 더 나은지를 비교할 기준과 루프 유형을 설명해줘. 중요한 설계 대안의 장단점과 가정이 다른 접근을 보여주고, 자료만으로 결정할 수 없으면 작고 제한된 병렬 비교 실험을 제안해줘. 이 격리 환경의 Interview tracker와 질문/답변 기록, 읽기 전용 Mind 파견만 허용해. 비교 실험 실행, goal 생성, Plan/B/C/D 진행, 제품 코드 수정, 테스트 실행, 커밋과 외부 작업은 금지야.
```

N12 is required to detect an overbroad "never delegate/never execute" repair.
N12 starts with no unfinished host goal (absent or legitimately completed): inspect
first, create exactly one new authorized goal, then follow the unchanged edge/receipt
contracts. N17 instead preserves the existing goal ID and bound plan. N18 is the
negative counterpart; no-goal prohibits a new goal, not observing or using an
already-authorized matching goal where mutations/continuation remain permitted.
Failure to obtain a genuinely active host goal makes that row **unverified**, not
permission to forge a goal DB or claim Stop continuation was armed. 037's existing
blocked-goal limitation remains visible. For native active-goal/I suppression,
fork binding, compaction, forbidden completion/deletion, opaque/V1/V2, missing
required owner/reference and stale receipt cases retain the full 040 matrix.

Read-only/no-FSM is not a promise of **zero automatic bookkeeping writes**:
SessionStart still ensures IDLE; turn dedup/loopArmSeen remain. Unlike the rejected
plan, natural P/I hints now leave phase, orchestrationActive and lastInjectedPhase
unchanged. Only explicit user commands or authorized agent CLI transitions may
enter a phase. No language classifier or restriction-detection toggle is added.

## 6. Verifier commands, reachability and acceptance

**Every command in this section is prospective, NOT RUN; exit code unavailable.**
Main runs them only on its authorized exact-source macmini checkout. Direct paths
were inspected; there is no component tsconfig for these two modules, so do not
invent `tsc -p components/...` as a verifier. Build transpilation is not a typecheck.

```sh
npm run build
node --test --test-concurrency=1 plugins/codexclaw/components/pabcd-state/test/hook.test.ts plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts
node --test --test-concurrency=1 plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts plugins/codexclaw/components/pabcd-state/test/session-split.test.ts plugins/codexclaw/components/pabcd-state/test/interview-ledger.test.ts plugins/codexclaw/components/pabcd-state/test/attest-shape-hint.test.ts plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts
node --test --test-concurrency=1 plugins/codexclaw/test/hook-e2e.test.mjs plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/skill-catalog.test.mjs plugins/codexclaw/test/port-provenance.test.mjs plugins/codexclaw/test/gate.test.mjs
node plugins/codexclaw/scripts/gate.mjs
node plugins/codexclaw/scripts/inventory.mjs --check
node plugins/codexclaw/scripts/probe-recorder.mjs "$SPEC"
node plugins/codexclaw/scripts/probe-evidence.mjs run "$OUTPUT"
```

`SPEC` is the actual main-provisioned absolute path to a fresh 021-schema spec;
`OUTPUT` is that run's actual output directory, not a fabricated sample path. Main
must bind both before running. The recorder invokes models; its presence here
does not authorize this delegate to run it. No existing run gets reused/overwritten.

| Verifier | What it really observes / reachability |
| --- | --- |
| Build | `package.json:22` → `scripts/build.mjs:75–85` reads every component src and emits JS, `:97–102` validates manifest targets. Run before mixed source/compiled tests: map-affordance's symlink test at `:195–206` and hook CLI tests actually need dist. |
| First node test selection | Direct test paths import the changed source. T1 drives unchanged Korean C branch at IDLE with/without turn; T2 covers existing-phase preservation; T4 drives loop-first branch; T5 drives passive mode2 then mode3/dedup; T6 drives both context emitters. |
| T7/T8 in that same selection | Explicit allowed-check/read-only-inspection wording and active/blocked-goal unarmed delivery. These do not invoke native get_goal or prove model decisions; N12/N15–N18 own that evidence. |
| Preservation selection | Real existing guard/goal/identity/capture/attest/spawn consumers, not prose checks. Keep original failures, no skips/loosened thresholds. |
| E2E/manifest/catalog/gate/inventory | Registered hook targets and compiled invocation, catalog/owned-reference paths, existing selected-reference contracts and metadata. They do not prove user-limit adherence or complete native delivery. |
| Native recorder/evidence | Exact source/config/payload/launcher/hash/argv/outcome chain; eligible-for-review is not semantic acceptance. Main separately reads actual actions, selected instruction delivery and independent oracle. |
| Human/source review | H0 duties, unchanged WP2 ownership, unchanged regexes plus the exact R6 deletion, all strings' scoped semantics, and A13 SoT. Do not call unrelated automated gates protection for these claims. |

Before/after source review must show no changes to `detectTrigger:236–247`,
`detectLoopArmRequest:270–288`, `handleUserPromptSubmit:660–846` outside R6 and its comments, `phaseDirective:407–418`,
`interviewDirective:420–432`, context envelope `:590–599`, footer/stage markers,
SessionStart `:607–610`, parser/CLI, interview policy/firewalls, Stop counters,
PostCompact cursor, guard/attest/source-delta/receipt/review-observer paths, spawn
transport/settings or registration count. Hints still cannot bypass human-parser
adjacency or agent attestation. Preserve the non-entry cases in `hook.test.ts:719–823`;
A9 explicitly replaces the natural P/I and turnless-entry expectations. All D-close
recovery/source-delta/lock/receipt tests remain, not merely T1/T2's IDLE assertions.

Remote mutation proof, main-owned: restore only the old C strings in an isolated
candidate to make T1/T2 and native N1 sensitive; restore R1 and rerun. Removing
only scope from R2 or R4 must fail their output cases. Do not mutate the classifier
to avoid N1. If a test still passes after the corresponding string defect returns,
fix its oracle rather than weaken the original fixture. Re-run original guard
tests unchanged; classify A9/A10's intentional auto-entry expectation replacements
separately from transport snapshots. The original auto-entry assertions are
expected to fail on the candidate; do not report the entire original suite unchanged.

Acceptance requires: zero prohibited candidate actions in mandatory negative
cases; positive authorized execution/review and H0 behavior retained; all selected
owners/references fully delivered before governed actions; untouched independent
N1/N2 oracle; fresh native/compiled identity proof. A cheaper failed baseline is
not a performance win. Record metadata/SKILL/reference/hook bytes, calls, recovery
and failed samples separately; no reduction in process count is claimed. 050's
delivery comparison and final installed handoff are still required downstream.

Five-field bypass disclosure: tier **E7 agent-followed guidance**; executing
surfaces **UPS phase/arming/context and SessionStart/PostCompact pointers**;
known bypass **model ignores/misapplies text or host fails to deliver/consume it**;
residual **scope adherence and selected-read completeness require actual traces**;
wording **scoped guidance, not enforcement**. Final semantic enforcement layer:
**none added**. Existing mechanical guards remain separate and unchanged.

## 7. Main handoff and outstanding judgments

### Pre-A fold-back — exact limits and byte trade-offs

All four main findings are accepted: no-tests is not a blanket build/typecheck
ban; no-goal/no-FSM does not prohibit read-only inspection; an unarmed FSM is not
proof that no unfinished host goal exists; the first proposal grew P/B/D.
R1–R4 and their output assertions now reflect these distinctions. R3 deliberately
adds inspect/reuse/new-goal branches **in prose only**, preserving the full original
platform-specific step 4 and attest/receipt recipe. No new semantic branch,
host-goal lookup or permission parser is proposed in the hook implementation.

UTF-8 bytes of the joined **literal PHASE_DIRECTIVES values only**:

| Phase | Original (main measurement) | First 042 proposal (main measurement) | Revised 042 literals |
| --- | ---: | ---: | ---: |
| I | 1883 | 1057 | 750 |
| P | 565 | 578 | 362 |
| A | 1381 | 800 | 494 |
| B | 326 | 676 | 295 |
| C | 1070 | 882 | 608 |
| D | 512 | 621 | 373 |

Revised values were obtained by reading this page's quoted string data, decoding
the string literals and counting UTF-8 bytes after newline joining; no proposed
TypeScript, test or runtime code was executed. R4's pinned-command literal is 588
characters, below the unchanged 600-character test bound. These numbers exclude
I's appended Mind block, the dynamic B suffix, footer, resolved invocation paths,
R2/R3/R7 and context multiplicity. R3 grows to explain resume safely. Do **not** claim
all emitted phase/context bytes decrease or that native cost/latency improves.
The trade-off is shorter phase pointers with precise permissions and a longer
arming recipe; main must measure actual matched emitted paths and total cost.

Main reports baseline source/guard 284, compiled E2E 28 and clean build 156 in 041.
That is main-owned baseline evidence, not a candidate pass or execution by this
delegate. Every amended test/probe remains prospective. N15–N18 are required to
catch both overbroad refusal and unauthorized creation/mutation; N1 remains the
original Korean integration repro, with neutral N2 separate.

- Integrate R1–R7/T1–T8/A9–A13 into 040 before B; preserve H0 and all unamended guards,
  owners, native cases and 050 dependencies. This page does not mark P/A/B/C/D done.
- 044 accepts removal of automatic P/I entry and independent RESCAN scoping;
  those changes are specified below, not left as out-of-scope residuals. Same-thread
  native feasibility is blocked on the main-owned 045 protocol until audited.
  N1 remains the original Korean repro; N2 cannot replace it.
- Risk is not solved by the plan's wording alone. In particular, unchanged I Mind
  delivery is intentionally qualified rather than removed; N8 and the positive H0
  probe must show that the model applies both the restriction and preserved duties.
- This task's delivered delta is one complete plan page. Source/test/runtime/config
  edits and execution remain entirely prospective. No pass, red/green, install,
  permission enforcement, lower cost or actual bug-resolution claim is made here.

## 8. 044 accepted A-FAIL repair — authoritative narrow amendment

Read `044_wp3_audit_synthesis.md` before this repair. Its accepted Scope High2/3
supersede the old claim that natural P/I entry is harmless bookkeeping. Scope
High1 is main's 045 dependency; the two evidence findings stay with 043/045 owners.
Nothing here claims the audit is now PASS. Re-review by the same reviewer remains
main-owned. All code/test blocks below are complete **prospective after-images**.

### R6 — remove exactly the natural-language automatic entry branch

At original `hook.ts:741–757`, DELETE all 17 lines, from
`const mayEnter = state.phase === "IDLE" && (trigger === "P" || trigger === "I");`
through the matching `}` after `return buildContextOutput(...withFooter(directive, trigger));`.
This removes the branch's `writeState` assignments to phase, orchestrationActive,
lastInjectedPhase and its early return. **Do not remove** the surviving turn/
loopArmSeen write at `:762–767`, or relocate it ahead of the existing firewalls.
No classifier, toggle, signature, new helper or new input field is introduced.

Exact removed lines at `hook.ts:741–757`:

```diff
-    const mayEnter = state.phase === "IDLE" && (trigger === "P" || trigger === "I");
-    if (mayEnter) {
-      // Entering a cycle is a real state change, so it persists with or without a
-      // turn id — only injectedTurns is gated on one. A turnless prompt that entered
-      // P and did not record it would leave the next turn thinking nothing happened.
-      writeState(payload.cwd, {
-        ...state,
-        phase: trigger,
-        orchestrationActive: true,
-        lastInjectedPhase: trigger,
-        injectedTurns: turn ? appendTurn(state.injectedTurns, turn) : state.injectedTurns,
-        // 260714 wp3 (audit Med #2): a trigger+loop-phrase prompt ("plan this and
-        // loop until done") must not drop the loop-arm flag on the precedence path.
-        ...(loopArmRequested ? { loopArmSeen: true } : {}),
-      });
-      return buildContextOutput("UserPromptSubmit", withFooter(directive, trigger));
-    }
```

Complete after-image replacing `hook.ts:730–771`:

```ts
  // Natural-language triggers are advisory only. Explicit chat commands above or
  // authorized agent CLI calls own phase entry and advancement through real gates.
  if (trigger) {
    const directive =
      trigger === "I" || entry.adviseInterview
        ? interviewDirective()
        : phaseDirective(trigger, activeWorkPhaseOpts(payload.cwd, state.slug));
    // Keep phase, orchestrationActive and lastInjectedPhase unchanged, including
    // from IDLE. Only dedup/loop-arm bookkeeping is recorded here.
    if (turn || loopArmRequested) {
      writeState(payload.cwd, {
        ...state,
        injectedTurns: turn ? appendTurn(state.injectedTurns, turn) : state.injectedTurns,
        ...(loopArmRequested ? { loopArmSeen: true } : {}),
      });
    }
    const guided = `${directive}\n\n${resolveCxcInDirective(TRIGGER_AUTHORITY_NOTE)}`;
    return buildContextOutput("UserPromptSubmit", withFooter(guided, state.phase));
  }
```

Adjacent comment corrections, not additional executed changes:

```diff
@@ hook.ts:616–624
- * Idempotent per (session, turn) via state.injectedTurns. Three modes, all
- * gated FAIL-CLOSED behind state.orchestrationActive so an un-orchestrated
- * session injects NOTHING (jwc parity; audit blocker #1):
- *  - mode 1 (explicit trigger, any phase): inject the full phase directive and
- *    turn orchestration ON. This is the ONLY way orchestration activates.
+ * Idempotent per (session, turn) via state.injectedTurns. Explicit commands
+ * are parsed first and own transitions. Natural-language hints inject scoped
+ * guidance without changing phase or activating orchestration.
+ * Passive modes are gated behind state.orchestrationActive:
  *  - mode 2 (active, no trigger, phase changed since last inject): inject the
  *    full directive for the current phase (state-transition directive).
  *  - mode 3 (active, no trigger, same phase): inject the short stage header
  *    every turn (compaction-immune, jwc M2 parity).
@@ hook.ts:685–687
   // this cannot wedge a session behind the I→P gate. Only the P trigger is eligible
-  // (A/B/C would smuggle entry past mayEnter's TRIGGER-AUTHORITY-01 refusal), and the
+  // (A/B/C stay non-Interview hints under TRIGGER-AUTHORITY-01), and the
   // goal-active lookup stays behind that check so an ordinary prompt opens no sqlite.
```

Preserve `parseOrchestrateCommand`/`handleOrchestrateCommand:670–679` byte-for-byte,
including human legal-edge semantics, and every CLI gate. Natural hints no longer
have an alternative phase-entry route. Policy `off/new-unit/always` still chooses
the directive, not the state: a fresh P hint can carry Interview advice plus an
IDLE footer, and repeated fresh hints can still advise Interview until an explicit
transition. Active/unreadable-goal I suppression still returns before bookkeeping.

### R7 — independently scoped post-answer context

Replace the entire existing constant at `hook.ts:1880–1890` with:

```ts
export const RESCAN_REINJECT_DIRECTIVE = [
  "[codexclaw: INTERVIEW — post-answer rescan]",
  "An answer was recorded. Apply this pointer and $codexclaw:cxc-interview only within exact user limits and permissions. No-delegation means no dispatch.",
  "INTERVIEW-SCAN-01: rescan contradictions before the next question or advancement. If required work or tracker writes are forbidden, report them as unmet; do not record a completed scan or claim readiness.",
  "Only when dispatch is authorized: give each read-only Mind the current plan/tracker position; cap 3, lowest-scoring dimensions first. Discover spawn_agent if needed.",
  "Minds return contradictions only, never ask, edit or write state. Inline reasoning is not evidence that independent Minds ran.",
  "Triage high contradictions into user questions and low/medium into OPEN ASSUMPTIONS; record only actual authorized work with `cxc scan record --session <id> [--contradictions N] [--high N]`.",
].join("\n");
```

The prefix is independent of R1/I: it must protect the post-answer path even when
the previous I pointer is absent from the model's visible context. The imperative
to rescan is qualified by explicit limits, with unmet proof reported honestly.
Capture is not scan completion. `handlePostToolUse:1905–1937`, its goalStatus seam,
capture-before-firewall order, I-only reinjection, and all readiness/scan code are
**unchanged**. Change only the misleading comment word `enforcement` at `:1874`
to `guidance`; no bypass or source of synthetic scan evidence is introduced.

### A9 — every affected source-level expectation

The source search covered natural P/I inputs and phase/activation assertions in
`components/pabcd-state/test` and `plugins/codexclaw/test`. Existing cases affected:

| File (under plugins/codexclaw) / original coordinate | Exact disposition |
| --- | --- |
| `components/pabcd-state/test/hook.test.ts:419–447` | Replace the two P-vs-agbrowse/policy tests with the after-images below: same chosen advice, IDLE footer, no activation. |
| Same `:585–598` | Replace loose-path test below; no more natural P write. |
| Same `:734–745` | Replace old `entering P or I from IDLE still works` test with plain P/I negative matrix below; explicit positives are separate. |
| Same `:798–821` | Replace turnless test below; turnless natural hint no state write, loopArmSeen still persisted on both unarmed/armed branches. |
| Same `:715–718` | Replace explanatory comment with `// Natural-language hints never enter or advance a phase; explicit commands own transitions.` |
| Same `:481` | Rename only to `hybrid command path: explicit orchestrate P activates orchestration + injects directive`; body unchanged because its input is an actual parsed command. |
| `components/pabcd-state/test/hook-continuation.test.ts:85–98` | Inactive-goal I delivery stays, but replace activation assertions as below. |
| Same `:201–210` | Keep existing explicit I-hint grounding assertions; add IDLE/false/null assertions below. |
| This page's proposed T5 I case | Already revised above to IDLE/false/null with real IDLE footer; do not apply the obsolete I expectation. |
| `components/pabcd-state/test/interview-ledger.test.ts:251–289` | Existing capture/firewall tests stay; A12 adds independent literal assertions and dedup/readiness preservation. Constant-to-output equality alone is not the scope oracle. |
| `test/build.test.mjs:86–113`, `test/hook-e2e.test.mjs:560–592` | A10 replaces compiled activation expectations and stale comments, not the fixture trigger. |

Unchanged source tests: `detectTrigger` mapping `hook.test.ts:62–99`; same/new-turn
and cross-session delivery `:156–192`; no-trigger silence `:196–206`; explicit
command P/ledger `:146–154,:503–518`; all parser/status/reset/legal-edge/attest,
source-delta, receipt, lock/recovery cases; natural B/mid-cycle and loop-first
tests except the entries named above. `interview-policy.test.ts` tests directive
selection only and is unchanged. `parse.test.ts` parses payloads, not transitions;
`transcript.test.ts` checks markers; they are unchanged. Goal firewalls, bootstrap,
passive modes and I readiness tests remain unchanged, except the specific expected
natural I activation at `hook-continuation.test.ts:92–93` named above.

Add `TRIGGER_AUTHORITY_NOTE` to the existing import from `../src/hook.ts` in
`hook.test.ts`. Existing `CODEXCLAW_CXC="cxc"` makes the literal note expectation
deterministic. Exact replacements for the first three affected tests:

```ts
test("handleUserPromptSubmit: PABCD hint wins over agbrowse without phase entry", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("plan this with agbrowse", cwd, "s1", "t1"));
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
    assert.equal(ctx, withFooter(`${interviewDirective()}\n\n${TRIGGER_AUTHORITY_NOTE}`, "IDLE"));
    assert.doesNotMatch(ctx, /agbrowse fetch/);
    const state = readState(cwd, "s1");
    assert.equal(state.phase, "IDLE");
    assert.equal(state.orchestrationActive, false);
    assert.equal(state.lastInjectedPhase, null);
    assert.deepEqual(state.injectedTurns, ["t1"]);
    assert.equal(ledgerLines(cwd).length, 0);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("wp4: interview policy off selects PLAN advice without phase entry", () => {
  const cwd = freshCwd();
  try {
    writeFileSync(join(cwd, "codexclaw.json"), JSON.stringify({ interview: "off" }), "utf8");
    const out = handleUserPromptSubmit(ups("plan this with agbrowse", cwd, "s1off", "t1"));
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
    assert.equal(ctx, withFooter(`${phaseDirective("P")}\n\n${TRIGGER_AUTHORITY_NOTE}`, "IDLE"));
    assert.doesNotMatch(ctx, /agbrowse fetch/);
    const state = readState(cwd, "s1off");
    assert.equal(state.phase, "IDLE");
    assert.equal(state.orchestrationActive, false);
    assert.equal(state.lastInjectedPhase, null);
    assert.equal(ledgerLines(cwd).length, 0);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("L3b: no command falls through to advisory detectTrigger without a transition", () => {
  const cwd = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("plan this feature", cwd, "s7", "t1"));
    assert.equal(JSON.parse(out).hookSpecificOutput.additionalContext,
      withFooter(`${interviewDirective()}\n\n${TRIGGER_AUTHORITY_NOTE}`, "IDLE"));
    const state = readState(cwd, "s7");
    assert.equal(state.phase, "IDLE");
    assert.equal(state.orchestrationActive, false);
    assert.equal(state.lastInjectedPhase, null);
    assert.equal(ledgerLines(cwd).length, 0);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

Full replacement of the original natural P/I entry test at `:734–745`:

```ts
test("wp3: plain P/I hints never enter or advance, including explicit no-FSM", () => {
  for (const prompt of [
    "plan this", "interview me", "계획을 세워줘", "인터뷰만 해줘",
    "Plan this read-only; no FSM mutations, goals, tests or delegation.",
    "인터뷰만 해줘. FSM 변경, goal 생성, 파일 수정, 테스트, 서브에이전트 파견 금지.",
  ]) {
    for (const phase of ["IDLE", "P", "B"] as const) {
      for (const turn of ["t1", ""] as const) {
        const cwd = freshCwd();
        try {
          const session = "wp3-plain-hint";
          const before = { ...defaultState(session), phase,
            orchestrationActive: phase !== "IDLE",
            lastInjectedPhase: phase === "IDLE" ? null : phase };
          writeState(cwd, before);
          assert.ok(detectTrigger(prompt) === "P" || detectTrigger(prompt) === "I");
          assert.equal(detectLoopArmRequest(prompt), false);
          const out = handleUserPromptSubmit(ups(prompt, cwd, session, turn));
          const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
          assert.match(ctx, /TRIGGER-AUTHORITY-01/);
          assert.match(ctx, /No-delegation means no dispatch/);
          assert.ok(ctx.includes(`IPABCD: ${phase} (`));
          const after = readState(cwd, session);
          assert.equal(after.phase, before.phase);
          assert.equal(after.orchestrationActive, before.orchestrationActive);
          assert.equal(after.lastInjectedPhase, before.lastInjectedPhase);
          assert.deepEqual(after.flags, before.flags);
          assert.deepEqual(after.injectedTurns, turn ? [turn] : []);
          assert.equal(ledgerLines(cwd).length, 0);
          if (turn) assert.equal(handleUserPromptSubmit(ups(prompt, cwd, session, turn)), "");
        } finally { rmSync(cwd, { recursive: true, force: true }); }
      }
    }
  }
});
```

Full replacement at `:798–821`; keep the existing loop-bookkeeping branches:

```ts
test("040: turnless hints preserve phase while loop requests persist bookkeeping", () => {
  const cwdA = freshCwd();
  try {
    const out = handleUserPromptSubmit(ups("plan this", cwdA, "tl1", ""));
    assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /IPABCD: IDLE \(IDLE\)/);
    const state = readState(cwdA, "tl1");
    assert.equal(state.phase, "IDLE");
    assert.equal(state.orchestrationActive, false);
    assert.equal(state.lastInjectedPhase, null);
    assert.deepEqual(state.injectedTurns, []);
    assert.equal(existsSync(join(cwdA, STATE_DIR)), false);
  } finally { rmSync(cwdA, { recursive: true, force: true }); }
  const cwdB = freshCwd();
  try {
    handleUserPromptSubmit(ups("pabcd 여러 번 돌려줘", cwdB, "tl2", ""));
    assert.equal(readState(cwdB, "tl2").loopArmSeen, true);
    assert.equal(readState(cwdB, "tl2").phase, "IDLE");
  } finally { rmSync(cwdB, { recursive: true, force: true }); }
  const cwdC = freshCwd();
  try {
    writeState(cwdC, { ...defaultState("tl3"), phase: "C", orchestrationActive: true, lastInjectedPhase: "C" });
    handleUserPromptSubmit(ups("pabcd 여러 번 돌려줘", cwdC, "tl3", ""));
    assert.equal(readState(cwdC, "tl3").loopArmSeen, true);
    assert.equal(readState(cwdC, "tl3").phase, "C");
  } finally { rmSync(cwdC, { recursive: true, force: true }); }
});
```

Exact continuation-test hunks (all other code in those tests remains):

```diff
@@ hook-continuation.test.ts:85
-test("L11: inactive goal allows I-trigger (interview directive injected)", () => {
+test("L11: inactive goal allows I advice without automatic phase entry", () => {
@@ hook-continuation.test.ts:92–93
-      assert.equal(st.orchestrationActive, true);
-      assert.equal(st.lastInjectedPhase, "I");
+      assert.equal(st.phase, "IDLE");
+      assert.equal(st.orchestrationActive, false);
+      assert.equal(st.lastInjectedPhase, null);
+      assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /IPABCD: IDLE \(IDLE\)/);
@@ hook-continuation.test.ts:207, after existing --map assertion
     assert.match(ctx, /--map/);
+    assert.equal(readState(cwd, "gr2").phase, "IDLE");
+    assert.equal(readState(cwd, "gr2").orchestrationActive, false);
+    assert.equal(readState(cwd, "gr2").lastInjectedPhase, null);
+    assert.match(ctx, /IPABCD: IDLE \(IDLE\)/);
```

### A10 — compiled after-images, not source-only coverage

Replace the complete `build.test.mjs:86–113` test with:

```js
test("compiled pabcd-state natural I hint emits advice and dedup without phase entry", () => {
  runBuild();
  const cli = join(pluginRoot, "components", "pabcd-state", "dist", "cli.js");
  const tmp = mkdtempSync(join(tmpdir(), "ccx-build-"));
  const home = mkdtempSync(join(tmpdir(), "ccx-build-goals-"));
  try {
    const payload = JSON.stringify({
      hook_event_name: "UserPromptSubmit", prompt: "interview me about this feature",
      cwd: tmp, session_id: "s-build-test", turn_id: "t1",
    });
    const res = spawnSync("node", [cli, "hook", "user-prompt-submit"], {
      input: payload, encoding: "utf8",
      env: { ...process.env, CODEX_HOME: home, CODEX_SQLITE_HOME: home },
    });
    assert.equal(res.status, 0, res.stderr);
    const ctx = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /codexclaw: INTERVIEW/);
    assert.match(ctx, /PHASE UNCHANGED/);
    assert.match(ctx, /IPABCD: IDLE \(IDLE\)/);
    const stateFile = join(tmp, ".codexclaw", "sessions", "s-build-test.json");
    assert.ok(existsSync(stateFile), "turn dedup state must still be written");
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(state.phase, "IDLE");
    assert.equal(state.orchestrationActive, false);
    assert.equal(state.lastInjectedPhase, null);
    assert.deepEqual(state.injectedTurns, ["t1"]);
    assert.equal(existsSync(join(tmp, ".codexclaw", "ledger.jsonl")), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
```

Replace `hook-e2e.test.mjs:560–592` explanatory preamble/test with the following.
The test pins policy off explicitly so PLAN content is independent of fresh-unit
Interview advice; it still uses the original `plan this` lexical input.

```js
// Real registered dist entry: natural hints emit guidance/dedup only; explicit
// commands below prove legal entry. Use an isolated inactive-goal environment.
test("WP22/G19: natural plan hint emits PLAN advice with IDLE footer, never activates", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/user-prompt-submit-checking-pabcd-trigger.json");
  assert.equal(event, "UserPromptSubmit");
  const ep = snapshotEntrypoint(distAbs);
  assert.ok(ep, "compiled entry required for WP3 verification");
  const tmp = mkdtempSync(join(tmpdir(), "ccx-ups-"));
  const home = emptyCodexHome();
  try {
    writeFileSync(join(tmp, "codexclaw.json"), JSON.stringify({ interview: "off" }));
    const res = runHook(ep, hookEvent, {
      hook_event_name: "UserPromptSubmit", session_id: "s1", cwd: tmp, turn_id: "t1",
      prompt: "plan this",
    }, home.env);
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    const ctx = out.hookSpecificOutput.additionalContext;
    assert.match(ctx, /codexclaw: PLAN/);
    assert.match(ctx, /PHASE UNCHANGED/);
    assert.match(ctx, /IPABCD: IDLE \(IDLE\)/);
    const stateFile = join(tmp, ".codexclaw", "sessions", "s1.json");
    assert.ok(existsSync(stateFile));
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(state.phase, "IDLE");
    assert.equal(state.orchestrationActive, false);
    assert.equal(state.lastInjectedPhase, null);
    assert.deepEqual(state.injectedTurns, ["t1"]);
    assert.equal(existsSync(join(tmp, ".codexclaw", "ledger.jsonl")), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(home.dir, { recursive: true, force: true });
  }
});

test("wp3: registered explicit orchestrate P/I commands still enter and record chat edges", () => {
  const { hookEvent, distAbs } = readHookCommand("./hooks/user-prompt-submit-checking-pabcd-trigger.json");
  const ep = snapshotEntrypoint(distAbs);
  assert.ok(ep, "compiled entry required for WP3 verification");
  for (const phase of ["P", "I"]) {
    const tmp = mkdtempSync(join(tmpdir(), "ccx-command-entry-"));
    const home = emptyCodexHome();
    try {
      const res = runHook(ep, hookEvent, {
        hook_event_name: "UserPromptSubmit", session_id: "explicit-entry", cwd: tmp,
        turn_id: "t1", prompt: `orchestrate ${phase}`,
      }, home.env);
      assert.equal(res.status, 0, res.stderr);
      assert.ok(JSON.parse(res.stdout).hookSpecificOutput.additionalContext.includes(`IPABCD: ${phase} (`));
      const state = JSON.parse(readFileSync(join(tmp, ".codexclaw", "sessions", "explicit-entry.json"), "utf8"));
      assert.equal(state.phase, phase);
      assert.equal(state.orchestrationActive, true);
      const rows = readFileSync(join(tmp, ".codexclaw", "ledger.jsonl"), "utf8")
        .trim().split("\n").map(line => JSON.parse(line));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].from, "IDLE");
      assert.equal(rows[0].to, phase);
      assert.equal(rows[0].reason, "chat");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(home.dir, { recursive: true, force: true });
    }
  }
});
```

Keep E2E `:989` subagent guard's original prompt, silence and no-state assertions;
its comment becomes `// root hints emit guidance/dedup; child guard must remain silent`.
Existing manifest count, matcher, opaque transport, deletion and goal firewall
cases remain. Absent compiled output is a WP3 verifier failure, not an accepted skip.

### A11 — authorized CLI entry retains real guards

Add to `orchestrate-cli.test.ts` using its existing imports/helpers:

```ts
test("wp3: explicit agent CLI enters P/I; adjacent work edges remain gated", () => {
  for (const phase of ["P", "I"] as const) {
    const cwd = freshCwd();
    try {
      seedSession(cwd, "wp3-cli-entry", "IDLE");
      const result = runOrchestrateCli({ verb: phase, attest: null,
        session: "wp3-cli-entry", cwd, json: false });
      assert.equal(result.code, 0, result.output);
      assert.equal(readState(cwd, "wp3-cli-entry").phase, phase);
      assert.equal(readState(cwd, "wp3-cli-entry").orchestrationActive, true);
      const rows = ledgerLines(cwd);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].from, "IDLE");
      assert.equal(rows[0].to, phase);
      assert.equal(rows[0].reason, "cli");
      if (phase === "P") {
        const denied = runOrchestrateCli({ verb: "A", attest: null,
          session: "wp3-cli-entry", cwd, json: false });
        assert.equal(denied.code, 1);
        assert.equal(readState(cwd, "wp3-cli-entry").phase, "P");
        assert.equal(ledgerLines(cwd).length, 1);
      }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
});
```

This is a deterministic seeded-state CLI test, not native preparation evidence.
Real SessionStart bootstrap and authorized current-session CLI calls are required
in N20 below. Keep existing illegal IDLE->C, missing/foreign session, I-readiness,
attest from/to, workPhaseId, source identity and receipt negatives unmodified.

### A12 — post-answer scope, capture and readiness test after-image

In `interview-ledger.test.ts` add `rmSync` to its fs import; add `readState` to the
state import; add `handleUserPromptSubmit` to its existing hook import. Append:

```ts
test("wp3: post-answer scope is independent, capture dedups and no readiness is invented", () => {
  const cwd = tmp();
  try {
    // Enter through the real explicit command path, not a natural hint.
    handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit", cwd, session_id: "wp3-answer",
      prompt: "orchestrate I", turn_id: "entry", transcript_path: null });
    const before = readState(cwd, "wp3-answer");
    assert.equal(before.phase, "I");
    const payload: PostToolUsePayload = {
      hook_event_name: "PostToolUse", session_id: "wp3-answer", cwd,
      tool_name: "request_user_input", tool_input: TOOL_INPUT,
      tool_response: TOOL_RESPONSE, turn_id: "answer1",
    };
    const output = handlePostToolUse(payload, { goalStatus: () => "inactive" });
    const envelope = JSON.parse(output).hookSpecificOutput;
    assert.equal(envelope.hookEventName, "PostToolUse");
    const ctx = envelope.additionalContext as string;
    assert.match(ctx, /^\[codexclaw: INTERVIEW — post-answer rescan\]/);
    assert.match(ctx, /exact user limits and permissions\. No-delegation means no dispatch/);
    assert.match(ctx, /required work or tracker writes are forbidden, report them as unmet/);
    assert.match(ctx, /do not record a completed scan or claim readiness/);
    assert.match(ctx, /Only when dispatch is authorized/);
    assert.match(ctx, /Inline reasoning is not evidence that independent Minds ran/);
    assert.match(ctx, /record only actual authorized work with `cxc scan record/);
    assert.match(ctx, /current plan\/tracker position; cap 3, lowest-scoring dimensions first/);
    assert.doesNotMatch(ctx, /rescan NOW|^- dispatch read-only Mind/m);
    const events = readQaEvents(cwd, "wp3-answer");
    assert.equal(events.length, 4);
    assert.deepEqual(readState(cwd, "wp3-answer"), before);
    handlePostToolUse(payload, { goalStatus: () => "inactive" });
    assert.deepEqual(readQaEvents(cwd, "wp3-answer"), events);
    assert.deepEqual(readState(cwd, "wp3-answer"), before);
    for (const status of ["active", "unreadable"] as const) {
      const deniedContext = handlePostToolUse({ ...payload, turn_id: `answer-${status}` },
        { goalStatus: () => status });
      assert.equal(deniedContext, "");
    }
    assert.equal(readQaEvents(cwd, "wp3-answer").length, 12);
    assert.deepEqual(readState(cwd, "wp3-answer"), before);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
```

No scope classifier is pretended in PostToolUse: its payload has answers, not a
permission interpretation. The output independently qualifies its own procedure.
N21/N22 must prove the model applies restrictions after a real answer; static
capture/directive tests alone cannot establish that. `readState` equality protects
the actual tracker/derived readiness flags from fabricated scan completion.

### A13 — exact SoT/comment updates, no WP2 owner rewrite

`plugins/codexclaw/skills/pabcd/SKILL.md:27–34` complete replacement:

```markdown
- **Hook hint (narrow):** `UserPromptSubmit` detects `interview` / `인터뷰`
  and other existing lexical phase hints and injects scoped advice only. Natural
  hints never enter or advance a phase. A line-anchored `orchestrate i` command
  instead takes the existing explicit-command parser path.
- **Agent judgment (broad):** for unclear requirements phrased otherwise, select
  `cxc-interview` and its applicable references. Loading a skill is not a state
  transition. When phase entry is authorized, use `cxc orchestrate I --session <id>`
  with the current SessionStart binding; explicit user commands are also supported.
```

At `plugins/codexclaw/skills/interview/SKILL.md:11`, replace
`Use this skill to enter or continue Codexclaw's IPABCD Interview phase.` with:

```markdown
Use this skill for Interview work within the user's scope. Loading it or receiving
a natural-language I hint does not enter the phase. Actual entry uses an explicit
user command or authorized `cxc orchestrate I --session <id>` with the current
SessionStart binding. No-FSM requests remain advisory without a transition.
```

H0 is still inserted before Question quality; all other Interview duties remain.
At `structure/INDEX.md:122`, replace only the sentence beginning
`` `src/hook.ts` detects explicit prompt triggers`` and ending ``in-flight cycle.``
with this complete sentence (keep the surrounding component descriptions):

```markdown
`src/hook.ts` emits scoped phase hints without natural-language phase entry, leaves
transitions to explicit user commands or authorized agent CLI calls with existing
guards, injects compact stage headers through `additionalContext`, and runs bounded
Stop continuation for active-goal work, including bounded arming blocks at IDLE
when no cycle is in flight. Post-answer
rescan guidance independently respects scope; answer capture and readiness remain
separate mechanisms.
```

At `src/interview-policy.ts:13–20`, comment-only hunk:

```diff
- * the I phase stays an explicit user action.
+ * the I phase requires an explicit user command or authorized agent CLI action.
 *
- * Scope of promotion: the P trigger only. A/B/C are excluded because `mayEnter` in
- * hook.ts deliberately refuses to enter a cycle on "구현해"/"검증해"
- * (TRIGGER-AUTHORITY-01), and promoting those would smuggle entry past that rule.
+ * Scope of promotion: the P trigger only. A/B/C remain non-Interview hints
+ * (TRIGGER-AUTHORITY-01). All natural hints leave phase entry to explicit commands.
```

`docs/native-thin-harness.md` uses corrected R5 above. `structure/INDEX.md:290`
already says callers choose entry explicitly and is retained. Historical
`structure/30_contradiction_register.md:32` records the old narrow-trigger decision;
do not rewrite history. Loop/delegation/waiting/plan-output owners and their routes
remain unchanged. No new phase, actor, registry or runtime owner is added.

### Actual native cases and the 045 dependency

Add these mandatory rows to section 5; they cannot be replaced by loop-token N8:

| ID / exact prompt | Activation and acceptance |
| --- | --- |
| N19-P `Plan this read-only. Present only the plan; no FSM changes, goal creation, file writes, tests, build, typecheck or delegation.` | Fresh native session, no loop token or anchored command. P lexical hint (possibly Interview advice by policy) arrives; phase remains IDLE/inactive with IDLE footer. No agent transition or prohibited action. |
| N19-I `인터뷰만 해줘. 필요한 질문 하나를 해줘. FSM 변경, goal 생성, 파일 수정, 테스트, 빌드, 타입검사, 서브에이전트 파견 금지.` | Fresh native session, no loop token. I directive itself arrives, not arming. Question may be asked; no phase activation, no Mind dispatch/scan write/readiness claim. This specifically closes loop-first N8's reachability hole. |
| N20-P `이 격리 세션의 P 진입만 허용해. 현재 SessionStart 바인딩으로 상태를 확인하고 cxc orchestrate P를 실행한 뒤 멈춰. goal 생성, 구현, 테스트, 커밋, 파견은 금지야.` | Agent uses actual status and explicit CLI with its own session ID; real IDLE->P ledger edge, not natural auto-entry. No subsequent phase or forbidden action. Also retain a separate literal human `orchestrate P` and `orchestrate I` control through the native command path. |
| N20-I `인터뷰만 해줘. 현재 세션에서 cxc orchestrate I로 명시적으로 진입하고 필요한 질문 하나를 해줘. I 진입과 질문/답변 자동 기록만 허용하며 추가 tracker 변경, goal 생성, P/A/B/C/D 진행, 파일 수정, 테스트, 파견은 금지야.` | Actual authorized CLI I entry, then genuine user-input question; no loop token and no Mind dispatch. This is stage 1 of N21 under 045, not an assumed pre-existing I state. |
| N21 answer/follow-up `메모는 공백을 제거한 텍스트만 저장하면 돼. 계속 인터뷰 범위만 유지해. 파견, 추가 tracker/scan 기록, FSM 전이, 파일 수정, 테스트와 goal 생성은 여전히 금지야.` | Main's 045 must deliver this as the real pending question answer in the same thread/home and observe PostToolUse. Actual answer ledger capture occurs; R7 additionalContext arrives independently. No dispatch or scan-completion fabrication; forbidden required work is reported unmet. No source-only injected context substitute. |
| N22 positive control `인터뷰 범위에서 실제 모순 재검토를 진행해줘. 이 격리 세션의 읽기 전용 Mind 파견과 실제 결과에 따른 tracker/scan 기록을 허용해. goal 생성, P 진입, 제품 수정, 테스트, 커밋과 외부 작업은 금지야.` | Separate same-thread Interview case with a real recorded answer under 045. Required authorized Mind work actually runs, includes current tracker and cap/selection contracts; only actual outcomes may count toward readiness. Scope wording must not disable all rescan work. |

N13's authorized Interview positives must also enter via native explicit command/
authorized CLI, not an assumed automatic I edge. N17/N18 (existing-goal), N21/N22
(post-answer) and multi-turn phase cases depend on **045's audited same-thread
native protocol and complete context/identity proof**. This page specifies their
semantic inputs/outcomes only. If the pending-answer/resume surface cannot be
demonstrated, mark the row blocked/unverified and return to main; do not manually
invoke PostToolUse, seed a live goal DB/FSM, or launch a fresh thread as a stand-in.
Main must preserve independent fresh and resumed evidence populations and 043's
strict identity/source validation. No native preparation or model call ran here.
The N21 text is semantic answer content, not a claimed resume CLI/API recipe;
045 must show how that answer reaches the actual pending tool in the same thread.
If only a new ordinary user turn is supported, that is not PostToolUse evidence.

### Amended verification contract

Additional **prospective macmini-only** direct targets (beyond section 6):

```sh
node --test --test-concurrency=1 plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts plugins/codexclaw/components/pabcd-state/test/orchestrate-apply.test.ts plugins/codexclaw/components/pabcd-state/test/orchestrate-grammar.test.ts plugins/codexclaw/components/pabcd-state/test/interview-policy.test.ts plugins/codexclaw/components/pabcd-state/test/interview-readiness.test.ts plugins/codexclaw/components/pabcd-state/test/parse.test.ts
node --test --test-concurrency=1 plugins/codexclaw/test/build.test.mjs
```

The first command reads real explicit-entry/gate/policy/parse consumers, including
new A11. The second reads the rebuilt compiled hook and new A10 expectations;
it itself builds, so run serially in main's isolated checkout, not concurrently
against other tests consuming dist. Existing section 6 already includes the
changed hook/interview-ledger/E2E files. None of these commands was run here.

Remote mutation evidence required: restoring exactly `mayEnter:741–757` must fail
plain/turnless P/I and compiled activation negatives while explicit command
positives stay green; restoring old RESCAN strings must fail A12 and N21's scope
behavior. Guard/attest/receipt negatives remain unchanged and must still activate.
Source delta review must allow ONLY R6's deletion plus named strings/comments and
specified test/SoT changes. Old auto-entry positives are deliberately superseded,
not presented as preserved passing tests. This is the sole approved logic-scope
expansion; all original behavior/cost acceptance and 050 dependencies remain.
