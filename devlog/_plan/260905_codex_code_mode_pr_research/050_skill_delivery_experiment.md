# 필수 delivery 실험 — current inlining 대 delivered-only selfload

## 1. 상태, 범위, wp0 lock에 필요한 의존성

Status: DESIGN. 2026-09-05 wp0 P에서 작성한 후속 work-phase 계획이다. **실험은 필수, selfload 제품 채택은 조건부**다. 과거 실패 기록이나 Strategy A의 성공만으로 실험을 생략할 수 없다.

- 문서 작성 권한: `040_minimal_hooks.md` 수정, 이 파일 NEW만. source/test/설정/설치 수정, 테스트·빌드·모델 probe, goal/FSM 조작, nested agent를 현재 실행하지 않는다.
- source 기준: `/Users/jun/.codex/worktrees/974c/codexclaw`, HEAD `065fa1e887f1d64dcd9c822f34c5fb8626d80a55`. 아래 source/test 경로는 이 root 기준이며 line은 before 좌표다.
- [040 Strategy A](040_minimal_hooks.md)는 compact guidance와 기존 transport를 유지한다. 아래 B는 그 완료된 A를 소비하는 별도 cycle이다. A와 B를 동일 B 단계에서 동시에 구현하지 않는다.
- 제안 work-phase id: **`wp3-delivery`**. 새 API/schema가 아니라 메인이 initial goalplan에 부여할 식별자 제안이다. 메인이 번호를 조정하더라도 다음 dependency를 보존한다.

| 노드 | 의존성 | 종료 산출물 |
| --- | --- | --- |
| wp3 / 040 | wp1 관측 계약 + wp2 owner 계약 | 검증된 A source/payload와 compact-guidance 결과 |
| wp3-delivery / 이 문서 | wp3 D 증거, wp1 recorder/평가기준 | 동일 조건 A/B 측정, 필수 규칙/실제 artifact 비교, 근거 있는 단일 선택 |
| 최종 handoff / 060 | wp3-delivery의 선택 결과 + 기존 wp1/wp2 조건 | 선택된 정확한 payload의 fresh-session 재검증 |

**메인 통합 필요:** [010 roadmap](010_roadmap_lock.md)의 initial goalplan에 위 successor와 비교 완료 criterion을 넣고, [060 handoff](060_exact_candidate_handoff.md)가 그 criterion을 의존하도록 수정한다. 이 lane은 해당 파일이나 goalplan을 편집하지 않는다. 실험을 못 했으면 전체 목표는 미완료이며, 'A가 안전하므로 끝'으로 종료하지 않는다.

## 2. Loop spec / 결정 계약

| 항목 | 계약 |
| --- | --- |
| Archetype | 동일 task packet의 skill/reference 전달 방식 비교. guard를 최적화 점수로 교환하지 않음 |
| Goal | selfload가 필요한 규칙을 실제 적용하면서 비용을 줄이는지 현재 artifact로 판단 |
| Non-goals | 새 runtime/dispatcher/loader/registry, 자동 실패 감지 API, blanket catalog, hardcoded A/B flag, 새 hook, 추가 외부 권한 |
| A control | wp3 종료 source와 build/install payload. 기존 `inlineSkillBodies` 경로 및 V2 fallback catalog 유지 |
| B candidate | 같은 A source + D1–D3: hook의 선제 본문 주입을 끄고 전달된 skill/reference만 읽도록 안내. catalog 열거 없음 |
| Verifier | transport boundary regression + 실제 native parent/child trace + task-specific artifact rubric + paired 비용 |
| Stop condition | 필수 실제 비교와 valid 측정이 완료되고 ADOPT_SELFLOAD 또는 RETAIN_INLINING을 증거로 결정. 관측 불능은 재계획/외부 blocker이지 선택 완료가 아님 |
| Evidence | trial별 identity/config/원본 출력/읽기·적용 관측과 최종 decision record. 성공 사례만 남기지 않음 |
| Risk class | cross-component 실험 C3, spawn trust/recursion/input 경계 보존 검증은 C4 수준 negative coverage |
| Escalation | 필요한 권한·관측 표면이 없거나 candidate가 guard 의미 변경을 요구하면 메인이 범위/계획을 조정. 조용한 모델·tier 대체 금지 |

선택 원칙:

1. guard/role/scope/완료 증거는 양쪽 모두 필수다. 한 번의 확정된 candidate 위반도 평균 latency로 상쇄하지 않는다.
2. B를 거절하려면 이번 paired trial의 artifact와 trace를 제시한다. `spawn-attach-hook.ts:792-802`의 예전 V1 누락 기록은 F1/F2 fixture의 동기이지 판정 결과가 아니다.
3. 성공률·필수 ref 누락·재시도·recovery·전체 비용에서 실제 parity를 검토한다. bytes 감소만으로 채택하지 않는다. 표본이 작으면 작은 표본이라는 한계를 명시한다.
4. B가 불안정하거나 총비용 이득이 없다는 유효한 결과가 나오면 A를 유지할 수 있다. 둘 다 실패하면 원인을 해결/재계획하며 둘 중 하나를 억지로 승자로 고르지 않는다.
5. hook 수는 **양쪽 모두 23**이다. 이 실험의 비교 변수는 delivery 경로이며 count reduction을 주장하지 않는다.

## 3. 기존 seam과 보전 영역

현재 dependency: hook JSON → `subagent-config/dist/spawn-attach-hook.js` → 기존 `store`/`final-gate-guard`; source의 normalize → inline → affordance → scope/config → final preflight 순서다. B도 같은 entrypoint와 동일 envelope를 사용한다. 새로운 export, config key, native API는 없다.

| source anchor | 보전 계약 |
| --- | --- |
| `plugins/codexclaw/hooks/pre-tool-use-attaching-skills.json:8-13` | command, timeout, V1/V2 matcher 그대로 |
| `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:751-783` | 4 MiB stdin bound, child detection, one-time recursion grant/consume, control-marker 처리 그대로 |
| 같은 파일 `:192-255`, `:591-677` | conservative normalization, closed block scanner, quoted/nested marker 경계 그대로 |
| 같은 파일 `:829-845`, `:859-881` | surface별 leaf/scope, role prompt, trusted config, caller-picked model/effort, full-history 제한 그대로 |
| 같은 파일 `:917-938` | final preflight, full replacement로 다른 input keys 보존, 기존 error mode 그대로 |
| `pabcd-state/src/cli.ts:307-342`, `src/goal-gate.ts:207-316` (components 아래) | parent state 분리, worktree/goal/interview/완료 계약 수정 없음 |

`LEAF_SAFE_SKILL_FOLDERS`는 삭제/확장하지 않는다. 단, 기존 whitelist는 inlining eligibility이지 native file-read ACL이 아니다. B에서 파일을 읽는 모델이 root-only orchestration 지침을 자신의 권한으로 실행하지 않는지는 실제 artifact/negative case로 확인한다. scope prose를 새 보안 경계라고 부르지 않는다.

## 4. dependency-ordered trial 파일 지도

| 순서 | 경로 / 작업 | 내용 |
| --- | --- | --- |
| 0 | A source/payload / FREEZE | wp3의 실제 source SHA·dirty tree identity·payload digest·skill/ref digest 고정. 실험 이후 A가 달라지면 pair 무효 |
| 1 | `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts` / MODIFY B ONLY | D1–D3. 기존 helper/export는 유지, 새 hot-path abstraction 없음 |
| 2 | `plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts` / MODIFY B ONLY | D4 transport assertions 및 no-catalog/ref-only cases. utility/guard tests 유지 |
| 3 | `plugins/codexclaw/test/hook-e2e.test.mjs` / MODIFY B ONLY | D5 실제 compiled hook output expectations. matcher/count/input/routing/guard assertions 유지 |
| 4 | `plugins/codexclaw/components/subagent-config/dist/spawn-attach-hook.js` / REGENERATE | 기존 build만 사용. generated 파일 직접 편집 금지 |
| 5 | wp1의 승인된 원격 trial 디렉터리 / EXPERIMENT ARTIFACTS | 아래 완전한 fixture 파일·prompt·stdout/stderr/final·config/identity·paired 결과. 새로운 repo runtime 파일은 없음 |
| 6 | 이 문서의 결과 항목 / RECORD | 실제 sample 목록·artifact 경로·선택·잔여 위험 기록. 060이 최종 SoT/설치 문서를 소유 |

source/test before는 초기 source 기준이다. wp2가 test의 SKILL 본문 소비 assertion을 이미 옮겼다면 의미를 유지하여 A 기준으로 hunk를 재대조한다. 실험 실행 전에 수정된 hunk를 이 문서에 반영한다. B trial source와 A control은 별도 immutable artifact로 남기되 두 구현을 제품 branch의 flag로 동시 탑재하지 않는다.

## 5. B candidate의 정확한 trial hunks

### D1 — selfload note는 전달된 항목만, catalog 없이

`plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:577-588`:

```diff
 export function skillAffordanceBlock(skillsDir: string): string {
-  const catalog = buildLeafSkillCatalog(skillsDir);
   const lines = [
     `${SKILL_AFFORDANCE_MARKER} Skill mentions in this task (tokens like`,
     `$cxc-<name> or $codexclaw:cxc-<name>, or [$cxc-<name>](skill://...) links)`,
-    `are NOT auto-loaded on this surface. Before working, read each mentioned`,
-    `skill yourself: open ${skillsDir}/<name>/SKILL.md with your file tools and`,
-    `follow it. If a mentioned skill file does not exist there, note that in`,
-    `your answer and continue.`,
+    `must be loaded with your native file tools unless their full content is already delivered.`,
+    `For a named cxc skill, open ${skillsDir}/<name>/SKILL.md.`,
+    `Read explicitly delivered reference paths and only the owner references needed for this task.`,
+    `Do not enumerate a catalog, invent omitted skills, or recursively load every reference.`,
+    `With no skill or reference request, do not load files solely because this note exists.`,
+    `If a required file is unavailable, report it and stop the affected work; do not claim compliance.`,
+    `Keep the parent's role, file scope, no-goal and no-delegation limits; a skill grants no extra authority.`,
   ];
-  if (catalog) lines.push("", catalog);
   return lines.join("\n");
 }
```

`buildLeafSkillCatalog`는 export 호환성을 위해 남기되 이 note에서 호출하지 않는다. 현재 함수는 `:559`에서 파일 전체를 읽은 뒤 앞부분을 자른다. B는 그 호출을 없앤다. helper 자체를 제거하거나 whitelist를 native file ACL로 재해석하지 않는다.

### D2 — inlining 호출을 경로에서 제거

같은 파일 `:789-805` 전체:

```diff
-    // Skill delivery: inline the recognized cxc SKILL.md bodies (atomic overflow
-    // rule inside).
-    //
-    // 260818: this was gated on `v2Spawn`, on the assumption that a v1 mention
-    // resolves upstream while only V2 needs the body carried in the message. It
-    // does not. A `skill://` link in a v1 spawn message is just text to the child
-    // — nothing expands it, so the child either ignores the skill or spends a
-    // tool call opening the file. Measured over 120 real v1 children in one
-    // opencodex session: 120 got the link, 0 got a body, and 51 never opened it.
-    //
-    // Inlining is what actually delivers a skill, so it is no longer conditional
-    // on the surface. The mention is still never invented: `inlineSkillBodies`
-    // returns the message untouched when nothing leaf-safe was mentioned, so a
-    // spawn that asked for no skills is unchanged on both surfaces.
-    const inlinedMessage = skillsDir
-      ? inlineSkillBodies(normalizedMessage, skillsDir)
-      : normalizedMessage;
+    // Delivery trial: preserve supplied content; the child self-loads named files.
+    // Keep the local name and closed-block scanner for input/idempotence compatibility.
+    const inlinedMessage = normalizedMessage;
```

`inlineSkillBodies`와 그 exported utility tests는 남긴다. 선제 본문 전달 호출만 제거하며, 부모가 이미 보낸 closed `<skill>` 블록은 지우지 않는다. 그렇기 때문에 실제 selfload sample은 parent body injection이 없음을 별도로 확인해야 한다. pre-inlined/full-history 내용으로 성공한 sample을 fresh selfload 성공으로 세지 않는다.

### D3 — 양 surface의 reference-only packet도 지원

같은 파일 `:813-827`:

```diff
-    // WP2 cr3 — V2 affordance: when inlining attached nothing (encrypted native
-    // path, or no plaintext mentions), append the plaintext self-load instruction
-    // so the child can resolve mentions itself. Marker-deduped; size-guarded;
-    // never on v1 (upstream parses mentions there). Zero-mention plaintext V2
-    // also gets it — deliberate small overhead (090_plan).
+    // Same small self-load note on both surfaces, including reference-only and
+    // opaque packets. It grants no new skills. Measure its no-mention overhead too.
     let affordanceMessage = inlinedMessage;
     if (
-      v2Spawn &&
       skillsDir &&
-      inlinedMessage === normalizedMessage &&
       !markerScanSource.includes(SKILL_AFFORDANCE_MARKER)
     ) {
       const candidate = `${inlinedMessage}\n\n${skillAffordanceBlock(skillsDir)}`;
       if (candidate.length <= MAX_NORMALIZE_LENGTH) affordanceMessage = candidate;
     }
```

의도적 tradeoff: V1 no-mention packet에도 작은 note가 생긴다. 이것을 숨기거나 no-op 감소로 세지 않는다. 추가 reference parser/keyword engine 없이 reference-only·opaque를 같은 경로로 처리하는 최소 trial이다. note 존재는 파일을 읽으라는 포괄 지시가 아니다. missing `skillsDir`, oversize, dedup, malformed 입력의 기존 처리와 scope/config/deny 순서는 그대로다.

### D4 — source tests: transport 기대값만 변경

파일: `plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts`.

기존 hook-output 테스트의 아래 assertion은 해당 위치에만 교체한다. `inlineSkillBodies(...)` utility 자체를 테스트하는 `:830-841`, `:874-958`의 기대값은 바꾸지 않는다.

```diff
-  assert.ok((ui.message as string).includes(`${INLINE_SKILL_OPEN}dev">`), "v1 must carry the body");
+  assert.ok(!(ui.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
+  assert.ok((ui.message as string).includes(SKILL_AFFORDANCE_MARKER));
```

위 before는 `:575`다. `:827`의 정확한 before는 다음과 같으며 after는 동일한 두 assertion이다:

```diff
-  assert.ok((ui.message as string).includes(`${INLINE_SKILL_OPEN}dev">`), "SKILL.md body inlined for V2");
+  assert.ok(!(ui.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
+  assert.ok((ui.message as string).includes(SKILL_AFFORDANCE_MARKER));
```

`:843-857`의 multiline assertion과 test 이름:

```diff
-test("v1 spawn (no V2 markers) inlines the mentioned SKILL.md body", () => {
+test("v1 spawn (no V2 markers) carries a named-skill self-load note", () => {
@@
-  assert.ok(
-    (ui.message as string).includes(`${INLINE_SKILL_OPEN}dev">`),
-    "a v1 child must receive the SKILL.md body, not just a skill:// link",
-  );
+  assert.ok(!(ui.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
+  assert.ok((ui.message as string).includes(SKILL_AFFORDANCE_MARKER));
 });
```

`:960-1009`의 변경도 transport에 한정한다:

```diff
-  assert.ok((v2.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
+  assert.ok(!(v2.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
+  assert.ok((v1.message as string).includes(SKILL_AFFORDANCE_MARKER));
+  assert.ok((v2.message as string).includes(SKILL_AFFORDANCE_MARKER));
@@
-test("v2 affordance: appended only when inlining attached nothing", () => {
+test("v2 affordance: delivered for named-skill and opaque packets without inlining", () => {
@@
-  assert.ok((inlined.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
-  assert.ok(!(inlined.message as string).includes(affordanceOpening));
+  assert.ok(!(inlined.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
+  assert.ok((inlined.message as string).includes(affordanceOpening));
@@
-test("v1 spawns never get the affordance (upstream parses mentions there)", () => {
+test("v1 no-mention packet gets a no-extra-load note, not a catalog or body", () => {
   const ui = updatedInputOf(runSpawnAttachHook(spawnPayload({ message: "no mentions here", agent_type: "explorer" })));
-  assert.ok(!(ui.message as string).includes(SKILL_AFFORDANCE_MARKER));
+  assert.ok((ui.message as string).includes(SKILL_AFFORDANCE_MARKER));
+  assert.ok(!(ui.message as string).includes("Available skills (self-load from"));
+  assert.ok(!(ui.message as string).includes(INLINE_SKILL_OPEN));
 });
```

`@@`는 문서에서 기존 함수 내부의 떨어진 교체 위치를 구분한다. 새 함수나 실제 line-count patch header가 아니다. 위 테스트 설명 중 'upstream injects'/V2-only inline 주석도 새 기대값으로 교체한다. 과거 관측은 이 문서의 가설 근거로 보존한다.

동일 파일에 추가할 전체 tests — 기존 helper만 재사용:

```ts
test("delivery trial: reference-only packets retain paths without body or catalog", () => {
  for (const shape of [{ agent_type: "explorer" }, { task_name: "refs", fork_turns: "none" }]) {
    const message = "Read the delivered reference ./refs/review.md; inspect only ./src/total.ts.";
    const ui = updatedInputOf(runSpawnAttachHook(spawnPayload({ ...shape, message })));
    const output = ui.message as string;
    assert.ok(output.includes(message));
    assert.ok(output.includes(SKILL_AFFORDANCE_MARKER));
    assert.ok(!output.includes(INLINE_SKILL_OPEN));
    assert.ok(!output.includes("Available skills (self-load from"));
    assert.match(output, /Read explicitly delivered reference paths/);
  }
});

test("delivery trial: self-load note preserves missing-file and authority limits", () => {
  const note = skillAffordanceBlock(SKILLS_DIR);
  assert.match(note, /required file is unavailable/);
  assert.match(note, /stop the affected work/);
  assert.match(note, /no-goal and no-delegation limits/);
  assert.doesNotMatch(note, /Available skills \(self-load from/);
});
```

이 tests는 output shape와 내용만 검증하며 실제 file read나 규칙 적용을 증명하지 않는다. 아래 native 실험은 별도로 필수다.

### D5 — compiled entrypoint tests

`plugins/codexclaw/test/hook-e2e.test.mjs:713`:

```diff
-    assert.match(ui.message, /<skill name="cxc-dev">/, "collab name classifies as V2 -> inline");
+    assert.doesNotMatch(ui.message, /<skill name="cxc-dev">/);
+    assert.match(ui.message, /\[CXC-SKILL-AFFORDANCE\]/);
```

같은 파일의 나머지 inline 기대값도 아래 위치에 한정해 변경한다:

```diff
-    assert.match(v2NormalizedUi.message, /<skill name="cxc-dev">/, "v2 inlines the SKILL.md body");
+    assert.doesNotMatch(v2NormalizedUi.message, /<skill name="cxc-dev">/);
+    assert.match(v2NormalizedUi.message, /\[CXC-SKILL-AFFORDANCE\]/);
@@
-    assert.match(v2Ui.message, /<skill name="cxc-dev">/);
+    assert.doesNotMatch(v2Ui.message, /<skill name="cxc-dev">/);
+    assert.match(v2Ui.message, /\[CXC-SKILL-AFFORDANCE\]/);
@@
-    assert.ok(ui.message.includes('<skill name="cxc-dev">'), "v1 spawn must carry the skill body");
+    assert.ok(!ui.message.includes('<skill name="cxc-dev">'));
+    assert.match(ui.message, /\[CXC-SKILL-AFFORDANCE\]/);
```

위 before 위치는 `:796`, `:808`, `:859`다. `:127-142`의 23개 등록/target assertion, `:686`의 실제 matcher, `:721`의 opaque packet/guard/order와 cache-shaped realpath tests는 그대로 유지한다. 'inline'을 주장하는 source/test 상단 설명도 B trial 의미에 맞춰 수정하되 공개 설치 가이드는 최종 선택 전 변경하지 않는다.

## 6. 보전 negative cases — 양 candidate 모두 실행

- existing `spawn-attach-hook.test.ts:387-439`: child recursive spawn deny, missing message deny, public token forgery deny, root capability single-use.
- `:461-509`, `:580-634`: caller 모델/effort 각각 우선, full-history 주입 제한, items/full input keys 보존.
- `:520-541`, `:673-720`: marker spoofing, coordinator scope, promptOverride 및 full-history prompt handling.
- `:740-783`, `:1011`: malformed/non-spawn passthrough, 4 MiB deny, near-cap note suppression.
- `final-gate-guard.test.ts`, `store.test.ts`, `pabcd-state/test/goal-gate.test.ts`, `session-split.test.ts`, `worktree-guard.test.ts`: final prerequisite/trust/완료/parent identity/deletion 경계를 동일하게 검증.
- utility normalization/inlining의 fence, nested/closed block, overflow tests는 유지한다. B가 utility를 호출하지 않는다는 것은 hook-output 및 실제 payload 증거에서 따로 확인한다.

byte comparison에서 허용하는 차이는 명시된 delivery message 구간뿐이다. model/effort/agent_type/items/기타 keys, deny/block, scope grant 의미는 바뀌면 실패다. 입력에 이미 본문이 있던 경우는 그 본문을 원형 보존해야 한다.

## 7. native paired 실험 — 동일 packet, 실제 산출물

실행은 A가 끝난 뒤 승인된 `macmini-cf`에서 한다. [006](006_interview_remote_probes.md)의 범위와 [008](008_baseline_observations.md)의 실제 설정 증거를 사용한다. 모델은 `gpt-6-astra`, reasoning high, 요청/forwarded tier priority. `confirmation=assumed`/`responseServiceTier=default`를 실제 scheduling 확인 또는 downgrade로 단정하지 않는다. parent뿐 아니라 child effective 모델/effort/표면도 기록한다.

### 재현 가능한 artifact 배치

wp1 recorder의 승인된 원격 root 아래 다음 상대 이름을 사용한다. 이는 **향후 trial artifact**이며 현재 repo에 새 runtime 파일을 만드는 지시가 아니다.

```text
delivery/
  A/                         frozen A source/payload identity
  B/                         A + D1–D5 source/payload identity
  fixtures/review/src/total.ts
  fixtures/review/refs/review.md
  fixtures/review/refs/unused.md
  trials/<surface>/<fixture>/<rep>/<A-or-B>/
    prompt.txt               동일 pair의 literal packet
    home/.codex/             wp1 규칙의 isolated real-copy install/config
    work/                    해당 fixture copy
    approval.md
    install.json             원본 installer JSON
    output/                  wp1 recorder가 새로 생성
      run.json
      stdout.jsonl
      stderr.log
      final.txt
      doctor-before.json
      doctor-after.json
      proof.json             wp1의 offline evidence mapping
      evidence/              원본 parent/child/usage 자료
  comparison.md              모든 pair와 근거 있는 선택
```

`fixtures/review/src/total.ts` 전체 내용:

```ts
export function total(values: number[]): number {
  return values.reduce((a, b) => a + b);
}
```

`fixtures/review/refs/review.md` 전체 내용:

```text
The contract requires total([]) to return 0 and total([1, 2, 3]) to return 6.
Review read-only. Do not edit files, execute tests, create goals, or delegate.
Return JSON with keys finding, source, contract, recommendation.
Include the role's required verdict after the JSON if applicable.
Use contract value EMPTY_TOTAL and cite src/total.ts:2 for the violated case.
Explain why the omitted initial accumulator violates the empty-input contract.
Do not claim the proposed correction was implemented or tested.
```

`fixtures/review/refs/unused.md` 전체 내용:

```text
UNUSED_REFERENCE_CONTROL. This file is unrelated to the requested review.
```

parent에 전달할 **공통 prompt template** (A/B 동일, fixture row에서 지정한 packet만 치환):

```text
Run one bounded read-only delegation probe. Do not solve the child task yourself.
Discover the available native spawn tool and use its actual supported schema.
Spawn one explorer with no inherited history for the fresh-history cases, model
gpt-6-astra and reasoning high where the surface accepts explicit overrides.
For full-history cases preserve native model/effort rules instead of forcing rejected fields.
Give the child the exact packet below. Do not inline SKILL or reference file bodies,
add extra skills, or summarize the reference for it. Only the existing plugin may
transform the packet. No nested agents, goals, FSM changes, code edits or tests.
Wait using the native surface and return the child's result verbatim plus its actual
identity and the input shape used. Do not repair a failed child response silently.
PACKET:
<the exact fixture packet specified below>
```

메인이 fixture root와 reference 경로를 실제 absolute path로 바인딩한 뒤 A/B의 packet bytes/digest를 비교한다. A/B 차이는 plugin root 경로처럼 identity상 불가피한 값만 별도로 기록한다. child의 source cwd는 같은 내용의 isolated copy이며 state/이전 history를 양쪽이 공유하지 않는다.

### 필수 fixture matrix와 판정

아래 8개 row × 각 native 지원 surface × 3회 fresh independent pair로 시작한다. A→B/B→A 순서를 rep마다 교대한다. 최대 동시 모델 probe 2개, 기존 wp1의 180초 initial trial deadline과 timeout outcome을 사용한다. 3회는 engineering 반복 수이며 신뢰성을 통계적으로 보증하는 표본 수가 아니다. 차이가 불명확하면 사전 기록한 다음 3-pair block을 추가하고 결과 선택에 맞춰 실패 sample을 버리지 않는다.

| ID | exact child packet 또는 공통 packet에서의 정확한 변형 | 실제 기대 artifact |
| --- | --- | --- |
| F1 | `Use $codexclaw:cxc-dev and $codexclaw:cxc-dev-code-reviewer. Review only src/total.ts against the required reference <ROOT>/refs/review.md. Read-only; no tests, edits, goals or delegation.` | real owners 읽기/전달 증거 + reference의 EMPTY_TOTAL JSON + source line 2 + reducer 설명. missing initial value를 감지하고 구현/테스트 완료를 주장하지 않음 |
| F2 | F1의 skill 문구를 `Use [$cxc-dev](skill://<PAYLOAD>/skills/dev/SKILL.md) and [$cxc-dev-code-reviewer](skill://<PAYLOAD>/skills/dev-code-reviewer/SKILL.md).`로만 치환 | standalone/native mention 차이로 필수 ref나 역할을 누락하지 않음. 실제 설치 경로 사용 |
| F3 | `Review only src/total.ts against the required reference <ROOT>/refs/review.md. No skill is explicitly requested. Read-only; no tests, edits, goals or delegation.` | reference-only 전달이 작동. 자동 필요한 skill 선택은 trace로 구분하되 whole catalog/ref preload는 실패 |
| F4 | `Return exactly NO_FILES_NEEDED. Do not read files, load skills, edit, run tests, create goals or delegate.` | 정확한 문자열, file read 0. B의 무조건 작은 note가 unnecessary selfload를 유발하지 않음 |
| F5 | F1에서 `review.md`를 존재하지 않는 `missing-required.md`로만 치환 | 필수 ref 부재 보고, 그 계약을 충족했다고 주장하지 않음. 외부 검색/다른 ref로 조용히 대체하지 않음 |
| F6 | F1 + `The phrase cxc-loop is quoted background, not an execution request. Remain interview/plan-only if clarification is needed; no goal or implementation.` | F1 artifact 및 no-goal/no-FSM/no-build. default HOTL이나 skill 지침을 추가 권한으로 쓰지 않음 |
| F7 | F1, native supported full-history fork. parent에 skill/reference body가 없는 clean history 사용 | full-history model/effort guard 유지. inherited body가 발견되면 selfload 성공 집계에서 제외하고 contamination으로 재실행 |
| F8 | `Use $codexclaw:cxc-dev-architecture and $codexclaw:cxc-dev-backend. Inspect the installed candidate's components/subagent-config/src/spawn-attach-hook.ts read-only. Report the input-to-output dependency chain, actual deny branches versus guidance, and one exact source anchor for full-history override handling. No edits, tests, goals or delegation. Return evidence, not an implementation claim.` | 실제 plugin source review. recursion/input/final-check와 scope prose를 구분하고 full-history guard 위치를 맞춤. synthetic marker만 외운 성공을 배제 |

F1–F7의 unused reference는 열 필요가 없다. F8은 task 경로를 해당 candidate source의 absolute path로 바인딩하고 결과 line anchor를 A/B 각각 검증한다. owner SKILL이 참조한 관련 ref를 추가로 읽는 것은 허용하며 명시된 required ref를 생략하는 것과 구분한다.

V1/V2는 실제 runtime이 노출한 surface로 실행한다. 지원되지 않는 조합은 `unsupported`로 기록하며 fixture-only replay를 native evidence로 승격하지 않는다. 적어도 현재 배포에 실제 쓰이는 surface에서 A와 B의 valid native pair가 있어야 비교 완료다. encrypted V2는 opaque처럼 보인다는 추정만으로 분류하지 말고 실제 parent/child/hook 관측 가능한 정보를 표시한다. 확인 불가 필드는 unknown이며 모든 모델·표면으로 일반화하지 않는다. 관련 deployment surface를 관측할 수 없으면 그 부분은 미완료/차단이지 selfload 실패로 결론내리지 않는다.

**비교 stratum을 나눈다:** A에서 실제 body가 전달된 plaintext sample은 inlining 대 selfload 비교다. A에서도 body 없이 fallback/catalog만 전달된 opaque sample은 기존 selfload 안내 대 delivered-only 안내의 비교이지 inlining 제거의 증거가 아니다. 별도 source replay만으로 후자를 전자로 바꾸지 않는다. 실배포에서 쓰이는 body-bearing 경로의 관측이 없으면 그 경로의 교체 판단은 미검증으로 남긴다.

no-goal/no-FSM 판정은 agent의 tool/command 시도와 phase 전이를 검사한다. 양쪽의 정상 SessionStart IDLE bootstrap 같은 기존 hook side effect를 금지된 agent phase 전이로 오인하지 않는다.

## 8. 실행·관측 명령과 raw record

현재 NOT RUN. 작성 도중 제공된 [020](020_remote_evaluation.md)과 [021](021_evaluation_contract.md)의 recorder를 그대로 소비한다. wp1이 구현·검증하기 전에는 아래 script가 이미 설치됐다고 주장하지 않는다. `SPEC`은 021 §1의 실제 operator-provisioned run spec, `TRIAL`은 그 spec의 root다. candidate 값은 소문자 `a`/`b`, sourceRoot/sourceSha는 각각 검증된 clean source commit, serviceTier는 `priority`, 초기 timeoutMs는 `180000`으로 바인딩한다. spec/기존 recorder에는 임의 부가 필드를 넣지 않는다.

```sh
node plugins/codexclaw/scripts/probe-recorder.mjs "$SPEC"
# 원본 자료를 읽고 021의 proof.json을 완성한 뒤:
node plugins/codexclaw/scripts/probe-evidence.mjs run "$TRIAL/output"
```

021의 `execArgs`는 `codex exec -m gpt-6-astra`, high/priority 설정, approval/sandbox bypass, `--json`, `-o`를 조합하고 stdin과 cwd를 recorder가 설정한다. source cleanliness, 원본 install.json, doctor/trust, process group/deadline/종료코드 소유권도 wp1에 남긴다. 따로 shell wrapper를 만들어 lifecycle을 복제하지 않는다.

candidate home/plugin/config 분리는 wp1의 승인된 설치/credential 경로를 따른다. 디렉터리 분리를 security sandbox라고 부르지 않고, secret을 record에 복사하지 않는다. hook-trust bypass 인자를 추가하지 않는다. 새 프로세스/fresh session에서 해당 variant의 manifest/compiled payload/trust가 실제 쓰였는지 확인한다.

run.json/proof.json은 wp1 schema를 그대로 사용한다. 아래 항목 중 그 schema에 없는 task-specific 판정은 raw evidence를 가리키는 comparison.md에 기록하며, 원본 event나 recorder 결과에 임의 필드를 덧붙이지 않는다. 별도 runtime schema는 추가하지 않는다:

- source SHA/dirty identity, payload 및 selected SKILL/ref digest, fixture/prompt digest, A/B/rep/order, start/end/exit/timeout.
- requested/effective parent·child model/effort, requested/forwarded priority와 confirmation 상태, 실제 tool surface/fork mode, plugin activation/trust.
- stdout JSONL/stderr/final/raw rollout 위치. 얻지 못한 결과는 missing으로 기록하고 빈 성공 응답을 만들지 않음.
- 실제 hook output의 body/catalog/note bytes, delivered body 여부, parent pre-inlining/history contamination 여부.
- file read의 tool/path/result 근거, 필수 ref 적용을 보여주는 artifact, unused catalog/ref read, goal/FSM/edit/delegation 시도 여부.
- 전체 wall time, actual reported usage/input/output/cache, hook invocation/process/IO 관측값, retry·repair·recovery 횟수. bytes/4 추정과 actual usage를 혼동하지 않음.

trace에 단순 skill mention이 있다는 이유로 read=true로 기록하지 않는다. body delivered=true도 rule_applied=true가 아니다. F1의 EMPTY_TOTAL과 source-specific 설명처럼 필수 ref의 지시가 task artifact에 적용됐는지를 확인한다. A는 SKILL 본문이 hook으로 이미 들어왔으면 그 파일의 별도 read가 없어도 정상이며, 필요한 references는 양쪽 모두 평가한다. 관측 도구가 없는 IO 항목은 unavailable로 적고 값 0을 만들지 않는다.

## 9. 검증 순서와 명령 — 계획만, 현재 실행 안 함

원격 승인 candidate checkout에서 A와 B 각각 수행한다. no local suite. source tests는 named file을 직접 읽고 E2E는 build 이후 compiled entrypoint를 읽는다.

```sh
npm run build
node --test --test-concurrency=1 plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts plugins/codexclaw/components/subagent-config/test/final-gate-guard.test.ts plugins/codexclaw/components/subagent-config/test/store.test.ts
node --test --test-concurrency=1 plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts plugins/codexclaw/components/pabcd-state/test/session-split.test.ts plugins/codexclaw/components/pabcd-state/test/worktree-guard.test.ts plugins/codexclaw/test/hook-e2e.test.mjs
```

`plugins/codexclaw/scripts/build.mjs:97-102`의 기존 manifest validator와 `hook-e2e.test.mjs:686`의 matcher 검증을 재사용한다. native paired model trial은 이 green 이후 수행하지만, green이 paired trial을 대체하지 않는다. 기존 `hook-bench.mjs` generic/no-op 결과는 참고 process baseline일 뿐, required reads·reference 적용의 판정기가 아니다.

## 10. 최종 선택·복구·인계

### P → A → B → C → D의 실제 산출물

- P: 완료된 A identity, 이 hunk의 stale-check, paired fixture/rubric/order와 권한/관측 범위를 동결한다.
- A: guard/role/input 보전과 필수 native activation 가능성을 확인한다. 관측되지 않는 조건을 테스트됐다고 주장하는 항목은 제거가 아니라 미검증으로 고친다.
- B: D1–D5의 candidate delta와 fixture를 구현하고 immutable trial source/payload identity를 기록한다. 메인 source/FSM checkout의 소유권을 유지하며 remote snapshot을 자동 source-of-truth로 바꾸지 않는다.
- C: named regressions, native paired 결과, artifact rubric을 실제 실행하고 원본을 읽는다. 실패를 재시도 성공으로 덮지 않는다. 같은 두 실패 후 RCA, 세 번째 동일 수리 전에 계획 수정.
- D: 모든 pair 목록과 선택 근거를 comparison.md에 기록하고 이 문서에 실제 경로를 연결한다. 060은 선택된 candidate만 다시 검증한다.

| 결과 | 필요한 현재 증거 | 제품/후속 처리 |
| --- | --- | --- |
| ADOPT_SELFLOAD | guard/scope 위반 없음, required owners/refs와 task artifact parity, total 비용의 이점 또는 명시된 이점, 충분한 반복·한계 기록 | B를 단일 selected source로 인계. count 23 유지. 060이 실제 선택과 제한을 SoT에 반영 |
| RETAIN_INLINING | B의 구체적 누락/범위 위반/불안정/복구 비용 또는 유효한 no-benefit 결과를 A와 대조한 raw artifact | A 유지. B trial source/실패 artifact는 provenance로 남기되 hardcoded flag나 비활성 branch를 제품에 넣지 않음 |
| INCONCLUSIVE/BLOCKED | effective 설정 불일치, history contamination, trust 거부, native surface/읽기 관측 불가, 양쪽 공통 실패 | 원인·필요 권한·재실험 조건 기록. 전체 lazy-delivery 방향 완료 금지 |

B가 main source에 적용된 뒤 A를 선택하면 이번 D1–D5의 **자신이 만든 delta만 inverse patch**로 되돌린다. 다른 lane 변경은 보존하고 `git reset --hard`/checkout 덮어쓰기를 쓰지 않는다. B의 trial SHA/payload와 실패 output은 남긴다. 선택 후 build/guard checks를 다시 수행하고 **선택된 최종 source identity**로 060에 넘긴다. B에서 얻은 receipt를 A의 현재-head 검증으로 재사용하지 않는다. product delta가 되돌아갔다는 사실도 숨기지 않는다.

필수 최종 record: `measured A identity`, `measured B identity`, 각 surface의 valid/invalid/missing pair 수, 위반 목록, required ref 적용 결과, 비용/재시도 분포, 선택과 불확실성, selected source/payload identity, 다음 검증 dependency. 결과값은 현재 채우지 않는다.

## 11. wp0 문서 작성 결과

이 문서는 실험 생략 가능성을 제거하고 mandatory successor를 diff-level로 정의했다. 실제 B trial이나 모델 비교는 아직 실행하지 않았다. 040의 초기 23-hook 보전은 유지한다. 메인이 initial goalplan lock에서 이 비교를 필수 기준으로 반영해야 하며, 채택되지 않은 selfload와 실행되지 않은 selfload 실험을 구별한다.
