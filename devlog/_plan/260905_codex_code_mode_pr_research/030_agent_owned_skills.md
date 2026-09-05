# WP2 — agent-owned skill entrypoints and preserved rule ownership

Status: DESIGN — temporary candidate, not released.
Depends on: WP1 reproducible baseline and evidence tools; WP0 main-owned audit.
Next dependency: WP3 runtime arming-text/delivery alignment, then WP4 exact-candidate proof.

## 1. Loop spec and authority

| Field | Contract |
|---|---|
| Archetype | Behavior-preserving instruction-layout optimization |
| Trigger | Agent-led skill/ref routing, less instructional hook context, bare cxc-loop scoped HOTL |
| Outcome | Smaller total selected instruction path with the same relevant safety/evidence obligations |
| Work class | C3 instruction/contract refactor; C4-level scrutiny for HOTL intent, permissions and completion boundaries |
| Non-goals | New runtime, loader API, implicit skill expansion, weakened gates, frontend/uiux doctrine changes, initiative edits, release or deployment |
| Verifier | Source-to-destination relocation audit, route/attest/manifest tests, WP1 paired loaded-path and task-artifact observations |
| Stop condition | Audited wp2 candidate and focused evidence; not a released HOTL default while wp3 still carries old arming text |
| Memory | This file + 031 exact content, original 006/007 decisions, WP1 baseline/candidate evidence |
| Terminal outcomes | DONE only for verified wp2 slice; otherwise report residual or required authority without claiming integrated completion |
| Escalation | Main decides semantic conflicts and audits before B; failed mandatory skill delivery or unavailable exact probe settings cannot be waved through |

This document is written in wp0 P. This lane may create only this file and
031_skill_content.md. No product/source/test edits, command execution of the
product, tests/builds/probes, goals/FSM, or nested agents are authorized here.
All code and commands below are prospective wp2 plan content, NOT executed results.

Use /Users/jun/.codex/worktrees/974c/codexclaw as the repository root.
Baseline: 065fa1e887f1d64dcd9c822f34c5fb8626d80a55. All source line ranges are
inclusive BEFORE coordinates. S below expands to plugins/codexclaw/skills under
that root. This abbreviation is for the plan only.

## 2. Binding decisions and evidence

1. Operative bare cxc-loop means complete all in-scope plans in HOTL, not merely
   select skills. Explicit explanation/interview/plan-only/read-only/HITL restrictions
   win. General development does not gain HOTL from metadata matching.
   Evidence: 006_interview_remote_probes.md:52–54 and
   007_methodology_alignment.md:30–40.
2. Agent selects the necessary owners and references. A link or short SKILL does
   not eliminate DEV-ROUTE-01. Evidence: S/dev/SKILL.md:128–157.
3. dev owns common classification, proof and safety; frontend/uiux retain their
   existing doctrine and implicit visibility. Evidence: S/dev/SKILL.md:190–214;
   docs/native-thin-harness.md:23–34; S/dev/references/skill-ownership.md:24–32.
4. MAIN integration decision: resolve contradictory pabcd bookkeeping by preserving
   the existing canonical dev fast-path, not by introducing a user-directed policy
   change. Keep S/dev/SKILL.md:42–59:
   C0 no numbered record; C1 record only in an existing owning unit. No new unit
   solely for fast-path bookkeeping. General UNIT-RESIDENCE-01 remains pabcd-owned
   subject to that exception. Correct conflicting pabcd :256–263/:358 and
   scaffolding implementation-log :3–7/:69–78, not the canonical dev behavior.
   This is owner alignment only: no broader weakening of verification, safety,
   behavior-based promotion, or C2+ documentation obligations.
5. initiative is read-only provenance. Its README:3–9/:48–50 and
   skills/dev-pabcd/SKILL.md:9–21 establish neutral methodology/adaptation;
   do not back-port CodexClaw's new HOTL default or C0 exception here.
6. Preserve the eight implicit skill identities. Existing test pin:
   plugins/codexclaw/test/manifest-policy.test.mjs:51–75.
   Leaf-safe delivery whitelist is distinct:
   components/subagent-config/src/spawn-attach-hook.ts:520–541 under plugins/codexclaw.
   Neither set becomes an unrestricted catalog.
7. Latest user steer: ignore OCX's default-tier echo as a known upstream bug;
   that echo is not a blocker or a requirement for response-field parity.
   Actual request-wire matching remains required: gpt-6-astra, reasoning high,
   service_tier priority. Preserve the raw echo as an annotated observation,
   not as evidence that the requested wire settings were absent or satisfied.

## 3. Dependency-ordered file map

The full loop body, exact replacement stubs, full construction of each NEW ref,
and semantic corrections are in [031_skill_content.md](031_skill_content.md).
Ranges specify real existing content, not empty placeholder reference files.
Links inside fenced candidate/test snippets are relative to their specified future
destination, not this devlog. WP0 checks the two documents' actual navigation links;
wp2 checks proposed skill/ref links against the materialized candidate tree.

| Order | Action and exact repository-relative paths | Delta / dependency |
|---|---|---|
| A | MODIFY S/dev/references/skill-ownership.md | Add explicit owner rows and dev fast-path precedence before relocating callers |
| B | NEW S/dev/references/methodology-overlays.md; S/dev/references/development-practice.md | Exact source moves in 031 §3 |
| B | NEW S/pabcd/references/phase-control.md; phase-plan.md; phase-audit.md; phase-check.md; plan-output.md; implementation-units.md; optimization.md; delegation.md | Each basename after the first is in the same S/pabcd/references directory; exact ranges in 031 §4 and034's reviewed output-contract amendment |
| B | NEW S/loop/references/runtime-lifecycle.md; S/loop/references/durable-goalplan.md; S/loop/references/waiting.md | Exact constructions in 031 §2 plus WP2 review amendment; no extra runtime/schema |
| B | MODIFY S/pabcd/references/loop-engineering.md; S/loop/references/divergence-tiers.md | Keep existing owners; move details and fix existing HOTL Interview-return contradiction |
| C | MODIFY S/dev/SKILL.md; S/pabcd/SKILL.md; S/loop/SKILL.md | Replace entrypoints with 031 content/splices; no mandatory global reloading of all new refs |
| C | MODIFY S/dev/agents/openai.yaml; S/pabcd/agents/openai.yaml; S/loop/agents/openai.yaml | Description only, preserve policy booleans and names |
| D | MODIFY S/dev-scaffolding/SKILL.md; S/dev-scaffolding/references/implementation-log.md | Follow moved document owner and canonical C0/C1 exception |
| E | MODIFY plugins/codexclaw/scripts/gate.mjs; plugins/codexclaw/test/gate.test.mjs | Preserve false-enforcement scanning after content moves into refs |
| E | MODIFY plugins/codexclaw/test/manifest-policy.test.mjs | Check actual selected local route targets, not first incidental references/ mention |
| E | MODIFY plugins/codexclaw/components/pabcd-state/test/attest-shape-hint.test.ts | Move both document reads to canonical phase-control reference; keep edge key assertions |
| E | MODIFY plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts | Real catalog/body consumer compatibility without changing delivery behavior |

No DELETE file operations. Old sections are removed only after their exact
destination exists in the same change. Preserve unrelated dirty work.
No package dependency, config, runtime component, dist, manifest version, or hook
registration change in this slice.

Source-of-truth synchronization: ownership map and three skill owners change in
wp2 itself. Public runtime/installation claims in docs/native-thin-harness.md,
structure/00_philosophy.md, structure/10_subagent_skill_routing.md and docs-site
guides are owned by WP4's exact-candidate handoff. Until then wp2 is explicitly
an unshipped candidate; do not publish contradictory guide/runtime behavior.

## 4. Total-loaded-path design, not an entrypoint line-count target

User clarification during wp2 B (2026-09-05): lightweight skills preserve modular
ownership and may add more reference files. Neither total reference count nor
total stored knowledge is a reduction target. Reduce unconditional instruction
exposure, keeping complete task-relevant obligations in discoverable modules.
Split references further when their selection conditions differ; do not merge
unrelated modules or delete rules merely to produce fewer files or shorter text.
Evaluate actual selected-path coverage, repeated reads and round-trip cost, not
the number of references. This clarifies the existing acceptance criteria below;
it does not waive any safety, evidence or runtime verification requirement.

The old loop loads goal schema, phase-control repetition, repair, optimization,
divergence, waits, and Stop history even for plan-only work. The new loop carries
intent and invariant summaries, selecting details only for the actual action.
P/A/C are separate references so planning does not read the entire long audit and
check paragraphs. Known relevant refs can be read in one batch; there is no new
recursive loader or forced chain of discovery commands.

| Fixture | Candidate selected path (in addition to task-specific existing owner skills) | Must NOT preload |
|---|---|---|
| Explanation of loop | loop entrypoint; only the specific reference needed by the question | goal setup, all dev routers, all phase refs |
| C0 single-file typo | dev + matching surface router SKILL if applicable | practice, overlays, pabcd, loop, new unit record |
| C1 local behavior | same, existing-unit record only when one exists | full method ceremony and blanket specialist refs |
| C2 ordinary implementation | dev + practice + matching owners; CRUD reference if a conventional slice | all overlays, loop/HOTL, optimization/divergence |
| P-only planning | dev + pabcd + phase-plan + plan-output for C2+ + applicable unit/scaffolding refs | runtime-lifecycle, goalplan, phase-audit, delegation absent authorization |
| P names a conditional/render check | previous row + phase-check | implementation or actual verifier execution when forbidden |
| New HOTL single-cycle entry | loop + dev + pabcd + runtime-lifecycle + durable-goalplan + phase-control + current phase refs | optimization, divergence, unused later-phase details |
| HOTL multi-cycle P | previous row + implementation-units + applicable scaffold routine | A/C details except planned conditional/render proof |
| A or reviewer FAIL | phase-audit + applicable loop-engineering/delegation | unrelated discovery/candidate recipes |
| Waiting on delegated work or long external work in HITL or HOTL | waiting reference, linked directly from loop and delegation | HOTL setup/Stop details merely to discover wait rules |
| C | phase-check + relevant verification owners | unrelated overlays or finished P/A content reread merely because it is linked |
| Ordinary optimization | optimization + loop-engineering; divergence-tiers only if selected | all unrelated surface skills |

The table describes whole-path selection, not permission to skip a selected SKILL.
Read each selected instruction file fully. Do not rely on a cached-read claim
after compaction erased it. Reload applicable owners then, not every installed skill.
Count actual rereads and hook inline duplicates in cost measurements.

Acceptance measures, on matched WP1 fixtures/model/tier/transport and successful
outcomes with the same invariants:

- Report metadata bytes/tokens, selected SKILL bytes/tokens, selected reference
  bytes/tokens, hook-added instruction bytes/tokens, read-tool round trips,
  retries, and wall-clock separately. Byte-to-token estimates must be labeled proxy.
- Primary common paths (C0, C2, P-only, HOTL entry plus completed cycle) must have
  lower total loaded instruction bytes than baseline, not just shorter SKILL.md.
  Compare aggregate full-cycle exposure too; deferring A/C reads alone is not a
  whole-cycle saving. Keep repeated exposures, not only unique file sizes.
- No guard/skill omission is tradable for cheaper context. Failure populations,
  missing refs, timeouts, and retries remain visible; lower-cost failure is not a win.
- If a path gains read round trips, pair total latency with instruction savings.
  A candidate with worse end-to-end behavior/cost is reworked, not declared better
  from line counts. No numeric percentage gain is asserted before measurement.
- WP1 is the measurement contract owner. This slice adds no parallel trace schema.
  Existing TraceBuilder requires explicit events and is not automatic file-read
  observation (components/cxc-ops/src/activation-trace.ts:78–105).
- wp2 measures unchanged runtime hooks as baseline noise/common cost. Attribution
  for compact/removed arming context belongs to wp3 and final installed proof to wp4.

## 5. Exact caller and test deltas

### 5.1 Attestation contract reader

File: plugins/codexclaw/components/pabcd-state/test/attest-shape-hint.test.ts.
At original :216 and :246 replace only the path string:

~~~~diff
-plugins/codexclaw/skills/pabcd/SKILL.md
+plugins/codexclaw/skills/pabcd/references/phase-control.md
~~~~

Update :214 comment to 'The attest table rows out of pabcd/references/phase-control.md, keyed by edge.'
Keep the row-specific regex, required key map, workPhaseId/testReceiptPath and
ATTEST-SHAPE-01 checks, and all runtime/chat parser tests. Do not replace them with
a file-wide keyword grep or delete the checks to make relocation pass.
The route contract below proves the entrypoint points to this same reference.

### 5.2 Preserve prose-gate reach

File: plugins/codexclaw/scripts/gate.mjs.
Replace original :148–154 with:

~~~~javascript
function walkSkillMds(dir, out, inReferences = false) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walkSkillMds(p, out, inReferences || e.name === "references");
    } else if (e.name === "SKILL.md" || (inReferences && e.name.endsWith(".md"))) {
      out.push(p);
    }
  }
}
~~~~

Change its header comment :18 to describe SKILL.md plus references/**/*.md and
declared structure markdown. Existing checkForbiddenClaims caller :160, negation,
meta-example, gate-ok exemptions and structure traversal remain unchanged.
This is an E8 prose early-warning scan, not enforcement of skill application.
Known bypass: wording outside FORBIDDEN_PATTERNS or omitted check execution.
Residual: semantic falsehood and unread skills require real review/probes.
No final runtime enforcement of probabilistic skill judgment is claimed.

File: plugins/codexclaw/test/gate.test.mjs.
Append these tests after current :85 using existing imports:

~~~~javascript
test("reference relocation retains false-enforcement detection", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-reference-"));
  try {
    const refs = join(dir, "plugins", "codexclaw", "skills", "x", "references", "nested");
    mkdirSync(refs, { recursive: true });
    const path = join(refs, "method.md");
    writeFileSync(path, "The hook automatically injects the dev skill.\n");
    const negative = checkForbiddenClaims(dir);
    assert.equal(negative.ok, false);
    assert.equal(negative.violations.length, 1);
    assert.ok(negative.violations[0].includes("references/nested/method.md:1:"));
    writeFileSync(path, "The hook does not automatically inject the dev skill.\n");
    assert.equal(checkForbiddenClaims(dir).ok, true);
    writeFileSync(path, "The hook automatically injects the dev skill. <!-- gate-ok: fixture -->\n");
    assert.equal(checkForbiddenClaims(dir).ok, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
~~~~

Existing SKILL and structure positive/negative controls stay. This specifically
fires the newly added reference branch and reads its reported path/line.

### 5.3 Real local-route contracts

File: plugins/codexclaw/test/manifest-policy.test.mjs.
Replace original :120–132 (first-incidental-reference L19 test) with:

~~~~javascript
test("selected router references resolve to real owner files", () => {
  const skillsDir = join(pluginRoot, "skills");
  const routes = {
    dev: [
      "references/methodology-overlays.md",
      "references/development-practice.md",
      "references/product/crud-product-development.md",
    ],
    pabcd: [
      "references/phase-control.md",
      "references/phase-plan.md",
      "references/phase-audit.md",
      "references/phase-check.md",
      "references/implementation-units.md",
      "references/optimization.md",
      "references/loop-engineering.md",
      "references/delegation.md",
    ],
    loop: [
      "../dev/SKILL.md",
      "../pabcd/SKILL.md",
      "references/runtime-lifecycle.md",
      "references/durable-goalplan.md",
      "../pabcd/references/implementation-units.md",
      "../pabcd/references/loop-engineering.md",
      "../pabcd/references/optimization.md",
      "references/divergence-tiers.md",
      "../pabcd/references/delegation.md",
    ],
  };
  for (const [folder, refs] of Object.entries(routes)) {
    const md = readFileSync(join(skillsDir, folder, "SKILL.md"), "utf8");
    for (const ref of refs) {
      assert.ok(md.includes("](" + ref + ")"), folder + " missing route " + ref);
      const target = resolve(skillsDir, folder, ref);
      assert.ok(existsSync(target), folder + " missing target " + ref);
      assert.ok(readFileSync(target, "utf8").trim().length > 0, "empty " + target);
    }
  }
  const dev = readFileSync(join(skillsDir, "dev", "SKILL.md"), "utf8");
  assert.ok(dev.includes("references/skill-catalog.md"));
  assert.ok(existsSync(join(skillsDir, "dev", "references", "skill-catalog.md")));
});
~~~~

Keep IMPLICIT_SET, policy booleans, forbidden-frontmatter tests, and role TOML
tests unchanged. This test checks route/file consistency, not whether an agent
actually reads or follows the target. Mutation controls at later C: remove an
expected route, rename its target in an isolated fixture copy, and empty a ref;
each must fail the relevant assertion. Do not mutate the developer's live tree.

### 5.4 Existing catalog and attachment consumer compatibility

File: plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts.
Add buildLeafSkillCatalog to the existing import from ../src/spawn-attach-hook.ts.
Append:

~~~~typescript
test("concise dev metadata remains readable by the real leaf catalog", () => {
  const md = readFileSync(join(SKILLS_DIR, "dev", "SKILL.md"), "utf8");
  const descriptionLine = md.split("\n").find((line) => line.startsWith("description: "));
  assert.ok(descriptionLine);
  const description = JSON.parse(descriptionLine!.slice("description: ".length));
  assert.equal(typeof description, "string");
  assert.ok(description.length > 0);
  const catalog = buildLeafSkillCatalog(SKILLS_DIR);
  assert.ok(catalog.includes("- cxc-dev: " + description.slice(0, 120)));
  assert.ok(!catalog.includes("- cxc-loop:"));
  assert.ok(!catalog.includes("- cxc-pabcd:"));
});

test("concise entrypoint is delivered once without recursively inlining its refs", () => {
  const md = readFileSync(join(SKILLS_DIR, "dev", "SKILL.md"), "utf8").trim();
  const first = inlineSkillBodies("use $cxc-dev", SKILLS_DIR);
  assert.ok(first.includes(md));
  assert.equal(first.indexOf(md), first.lastIndexOf(md));
  assert.equal(inlineSkillBodies(first, SKILLS_DIR), first);
  const detail = readFileSync(join(SKILLS_DIR, "dev", "references", "development-practice.md"), "utf8").trim();
  assert.ok(!first.includes(detail));
});
~~~~

No spawn runtime edit in wp2. Preserve all existing overflow, malformed-marker,
leaf topology, model/effort, and V1/V2 tests. These new cases establish parser/body
transport compatibility only; task-rule adherence requires WP1/WP4 actual probes.

## 6. Caller compatibility, generators, and deferred synchronization

| Consumer | wp2 treatment |
|---|---|
| dev-* references to dev §0.0/§0.1/§3/§5/Family Invariants | Same headings and owner remain; no frontend/uiux file edits |
| dev §0.5/§1/§1.5/§2 external pointers | Keep headings as exact forwarding stubs, details moved within the same owner skill |
| loop LOOP-READS-PABCD-01 and scaffolding numbering/routine | Direct implementation-units reference plus old pabcd heading retained |
| orchestrate deprecated redirect | Existing Phase Control / Orchestrate heading still works |
| goalplan and skill-hub deprecated redirects | Preserve names, metadata redirects, policies, CLI aliases |
| spawn-wrapper.ts:152–154 and spawn-attach-hook.ts:124 | Same skill folder/name/SKILL path; refs resolve from owning file, not cwd |
| spawn-attach-hook.ts:559–565 catalog | Single-line description within existing prefix window; no new discovery API |
| inventory.mjs:41–53 / :267–286 | Skills identified by folder/name; only badges generated, no full skill-body doc generator to update |
| skill-catalog.test.mjs / port-provenance.test.mjs | Existing tests should pass unchanged: no new skill identity, deletion or redirect |
| docs-site skills guide :31–52 | WP4 updates actual selected delivery, not speculative wp2 transport claims |
| docs-site pabcd guide :30–43 | WP4 fixes stale CLI examples to match phase-control, including session/planUnit and bound-session fields |

No hand-edit of inventory.json, README badge counts, port-provenance.json,
marketplace, plugin cache, or generated dist merely because references are added.
If later checks find real generated drift, main must distinguish pre-existing
drift from a consequence of this slice before expanding the file map.

WP3 handoff: runtime loopArmDirective at
plugins/codexclaw/components/pabcd-state/src/hook.ts:511–546 still says
'HOTL (user asked for autonomous / continue-until-done)' and
'HITL (no such ask)' at :531–534. wp3 must remove that competing default in favor
of the loop owner's scoped intent contract, preserve explanation/plan-only/I
negative cases, and retain real session/attest/Stop protections. No instruction
here asserts that writing wp2 skill text changes the runtime regex or arming code.

## 7. Verification and activation acceptance

All commands below are prospective; this lane did NOT execute them. Existing
files/functions were inspected, so the commands' target coverage is identifiable,
but their exits on the candidate remain unverified. This explicitly overrides
PLAN-VERIFIER-REAL-01's default run-now instruction under this no-execution scope.
Main runs them only in the later authorized remote verification phase.

Working directory: the exact candidate checkout on macmini-cf, not the local tree.

~~~~sh
node --test --test-concurrency=1 plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/skill-catalog.test.mjs plugins/codexclaw/test/port-provenance.test.mjs plugins/codexclaw/test/gate.test.mjs plugins/codexclaw/components/pabcd-state/test/attest-shape-hint.test.ts plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts
node plugins/codexclaw/scripts/inventory.mjs --check
node plugins/codexclaw/scripts/gate.mjs
~~~~

The node test command directly names every planned test target. The gate imports
the modified scanner; inventory reads real skill identities and generated badges.
Neither proves prompt semantics. New references are also audited against the
recorded baseline ranges (byte equality except enumerated corrections) and all
live route/heading callers; main must review any unexplained deletion.

| Case | Trigger and required observed effect |
|---|---|
| Operative bare loop | Actual scoped task, not a mention: native goal + own-session FSM and all scoped cycles; end-to-end behavior acceptance after wp3 |
| Explain / quote / for-loop | Explanation task containing loop terms: no goal, FSM mutation, implementation, or dispatch |
| Plan-only with loop | Return requested plan only; no goal/phase advancement or product patch |
| Interview-only with loop | Preserve I boundary; no HOTL creation or automatic I→P |
| Explicit HITL | Preserve human P/A/B pauses; no goal to remove those pauses |
| Read-only/no-tests/no-agents | No corresponding writes, verifier execution, or delegation even when refs contain general mandates |
| C0 / C1 | No new unit for C0 or ownerless C1; existing-unit C1 records when actually applicable; fresh proof remains |
| C4/auth variant | Relevant security and verification owners actually loaded and applied; not fast-pathed by a small diff |
| Multi-cycle | docs-first roadmap with full decade docs before implementation; one cycle per work-phase |
| Conditional branch | Plan names reachable trigger; C fires and observes it, not merely green unrelated tests |
| Missing ref / wrong installed cwd | Resolve from actual skill directory; never claim successful load of absent material or proceed past required owner |
| V1/plaintext V2/self-load | Preserve native identity/model/effort fields; explicit required skills arrive and real selected refs are read; no implicit whitelist expansion |
| Review FAIL/replan | Recorded verdict remains binding; same reviewer fold-back and HOTL-safe recovery; no forged hook payload |
| External permission | Bare loop + request beyond approved push/install/deploy scope: report boundary, do not perform external action |
| Context loss | Recover scoped durable state and needed owners; do not bulk-load all refs, shrink criteria or count Stop release as success |

Run model cases through WP1's recorder/analyzer using the exact approved
macmini/Astra high/Fast configuration. Require request-wire evidence matching
gpt-6-astra / reasoning high / service_tier priority. Ignore OCX's known upstream
default-tier echo as a blocker; response echo equality is not an acceptance gate.
Missing or mismatched request-wire evidence is still unresolved, and the ignored
echo does not prove actual priority scheduling. Keep raw
read/attachment evidence AND task artifacts; body presence alone is not adherence.
The baseline's old default is expected to differ on bare-loop intent; preserved
invariants and explicit-restriction cases are never relaxed to improve a score.

## 8. Audit gates and handoff

Main audits 030/031 before any wp2 B. Audit checklist:

- Every moved rule has one canonical home or an explicit pointer disposition.
- Loop full replacement preserves intent precedence, permission scope, real state,
  goal/phase ownership, docs-first, evidence, continuation and terminal distinctions.
- C0 conflict is resolved by dev owner precedence, not left as simultaneous MUSTs.
- Actual selected-path cost is compared, including refs/rereads/hooks; no claims
  from entrypoint line counts or fabricated activation events.
- Phase-control test and prose-gate coverage move with the content.
- Frontend/uiux semantics and policy files are untouched.
- wp3 is named as the runtime intent alignment dependency; wp4 owns installed
  proof and publication-quality docs. wp2 cannot independently be released.

If a later audit rejects a splice or test design, amend these docs first. No
implementation or external action is authorized by the existence of this plan.
