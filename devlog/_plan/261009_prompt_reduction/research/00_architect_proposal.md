# Prompt architecture constitution — architect proposal

PROPOSAL · 2026-10-09 · C3 read-only architecture review. D1–D12 are proposal IDs. Repository-relative citations establish source shape, not host activation/compliance.

**Adopt one owner per obligation and minimum sufficient exposure.** Preserve guards; use L1 facts/pointers, L2 discovery, L3 routing, L4 detail, L5 proof. Gate structural properties offline; semantic dedup remains advisory. Existing doctrine distinguishes enforcement/guidance and exposure costs (`structure/00_philosophy.md:26-58`; `docs/native-thin-harness.md:23-52`).

## D1 — Layers are exposure categories, not file extensions

| Layer | Proposed definition | Evidence |
|---|---|---|
| L0: mechanics | Observable runtime predicates, parsers, identity/receipt checks and deny/rewrite/block/state decisions in component `src/`. An instruction string stored in TypeScript is not itself enforcement. | Real goal-mode predicate/deny: `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:136-154`; enforcement distinction: `structure/00_philosophy.md:46-54`. |
| L1: recurring injection | SessionStart/UPS and compaction-recovery text: notices, owner pointers, bounded current facts/data. A recurring hook can emit nothing. Other hook diagnostics/Stop reasons get equivalent emitted-text accounting, labeled triggered rather than global. | Conditional completion emission: `plugins/codexclaw/components/bg-wake/src/hook.ts:93-106`; SessionStart aggregation: `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:319-340`. |
| L2: discovery | Frontmatter description plus host-rendered YAML display/summary/activation metadata. Answers “select this skill when”; grants no workflow authority. Count actual catalog projections separately from installed files. | `plugins/codexclaw/skills/dev/SKILL.md:1-8`; `plugins/codexclaw/skills/dev/agents/openai.yaml:1-5`; exposure distinction: `docs/native-thin-harness.md:25-32`. |
| L3: selected router | SKILL.md body: scope, minimum contract and condition→owner/reference table. Selected role prompts/skill bodies transported at spawn are conditional L3 payloads, not global policy. | Phase routing: `plugins/codexclaw/skills/pabcd/SKILL.md:66-81`; transport retained until parity: `docs/native-thin-harness.md:49-52`. |
| L4: selected procedure | Cohesive details, schemas, examples, platform recipes and exceptions loaded only when a router condition applies. A link is not recursive preload authority. | `plugins/codexclaw/skills/loop/SKILL.md:54-81`; phase-control detail: `plugins/codexclaw/skills/pabcd/SKILL.md:53-56`. |
| L5: repository proof | Tests/gates checking L0 behavior, real L1 emission, metadata, pointers, budgets and ownership. Exact wording locks only for genuine interfaces. Repository enforcement does not prove live-model obedience. | `structure/40_enforcement_methods.md:29-32,103-107`; emitted-contract tests: `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts:138-151`. |

Classify regions, not files. Generated/inlined copies retain ownership and pay delivery cost; words stored in code remain guidance (`plugins/codexclaw/components/pabcd-state/src/hook.ts:324-366,587-607`; `docs/native-thin-harness.md:49-52`).

## D2 — Separate authority, enforcement, ownership and exposure

Per-rule axes: authority, STRICT/DEFAULT/HEURISTIC/STYLE_SAMPLE/ESCALATE class, runtime/repository/agent mechanism, owner, exposure. Layer is not precedence; STRICT prose need not be runtime-enforced. Size defaults need a project contract to become mandatory; loading/hints/accepted hooks grant no authority (`plugins/codexclaw/skills/dev/SKILL.md:14,69-84,252-254`; `plugins/codexclaw/skills/loop/SKILL.md:28-36`).

Compact structural map before relocation:

| Boundary | Current dependency | Proposed dependency / blast radius |
|---|---|---|
| Manifest→CLI→renderer→context | SessionStart runs cxc-ops; UPS runs pabcd-state; strings embed policies/procedures. | Keep manifests, envelopes, guards; emit current facts+owners. Plugin context surface. `plugins/codexclaw/hooks/session-start-announcing-map-affordance.json:3-10`; `plugins/codexclaw/hooks/user-prompt-submit-checking-pabcd-trigger.json:3-10`; `plugins/codexclaw/components/pabcd-state/src/hook.ts:491-533`. |
| Catalog→router→reference | Loop/pabcd overlap on intent, dispatch, cycle and identity wording. | Owner directory→single obligation→consumer pointers. Skill-family surface. `plugins/codexclaw/skills/loop/SKILL.md:12-36,89-128`; `plugins/codexclaw/skills/pabcd/SKILL.md:88-104,127-151`; `plugins/codexclaw/skills/dev/references/skill-ownership.md:40-50`. |
| Runtime/prose/test seam | Tests check pointers and long procedural phrases. | L0 never requires prose to execute; L1 routes; L5 independently checks guard, owner and delivery. `plugins/codexclaw/components/pabcd-state/test/hook.test.ts:240-298`; `docs/native-thin-harness.md:42-52`. |

**Chosen:** maintainer constitution in `structure/70_prompt_architecture.md` (future proposal), obligations at existing owners. **Alternative:** global constitution injection improves discovery but recreates the pile. Existing structure separates philosophy/location/doctrine (`structure/00_philosophy.md:9-13`; `structure/20_pabcd_dispatch_doctrine.md:9-16`).

## D3 — Placement procedure

Apply in order; one obligation may need both a predicate and a short explanatory pointer, without two prose owners.

| Question | Decision | Basis |
|---|---|---|
| Is this plugin behavior or repeated host behavior? | Reuse host contracts. Admit an adapter only with native gap, activation, cost/failure/disable/sunset/evidence. Do not add a semantic permission classifier. | `docs/native-thin-harness.md:7,42-43,60,76-96`. |
| Must this invalid action/state be prevented independently of obedience, with a sound observable predicate at an owned boundary? | L0 + positive/negative L5 tests. Declare trusted inputs, unknown states and failure mode. If no supported interception exists, use truthful guidance. | `structure/00_philosophy.md:30-58`; boundary decision: `plugins/codexclaw/skills/dev-architecture/SKILL.md:361-368`. |
| Is it a repository property? | L5 gate: links, owners, metadata, budgets, delivery. No per-turn hook for editorial checking. | `structure/40_enforcement_methods.md:29-32,103-107`. |
| Must this be known before any owner is selected? | L1 only for necessary current facts or otherwise-undiscoverable essential owners, subject to D4. | Compact hook pointers/dormancy: `docs/native-thin-harness.md:46-52,96`. |
| Does it discriminate skill selection? | L2: purpose, trigger, critical selection exclusion. No procedures or state advancement. | `plugins/codexclaw/skills/pabcd/SKILL.md:3,27-34`. |
| Is it needed for almost every task selecting this skill? | Concise L3 rule or condition→owner edge; keep class/risk/fast-path distinctions. | `plugins/codexclaw/skills/dev/SKILL.md:18-19,49-67,125-157`. |
| Is it detailed, conditional or platform-specific? | L4, with an exact L3 activation condition. Incidents go to D9 archives. | `plugins/codexclaw/skills/pabcd/SKILL.md:53-56,66-75,98-111`. |

## D4 — L1 is a bootstrap, not a second manual

Admission: `owner/trigger/native_gap/fact_or_pointer/max_chars/dedupe_key/failure_mode/disable/sunset_when/fixture`. Reuse native-thin requirements. Emit facts+applicability+one owner; retain one necessary scope sentence, not repeated restriction catalogs (`docs/native-thin-harness.md:76-100`; current repetition: `plugins/codexclaw/components/pabcd-state/src/hook.ts:325-365`).

Proposed dispositions, not edits performed:

| Material | Placement / preservation | Source |
|---|---|---|
| Session id and usable CLI invocation | Short facts stay L1; recovery details in phase-control L4; retain CLI identity rejection. | `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:158-169,328-335`; `plugins/codexclaw/skills/pabcd/SKILL.md:53-56`; `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:526-545`. |
| Full loop setup / Windows attest example | L1 owner pointer; lifecycle/setup/platform procedure in selected L4. | `plugins/codexclaw/components/pabcd-state/src/hook.ts:491-533`; `plugins/codexclaw/skills/loop/SKILL.md:72-74`. |
| PR policy, async questions, terminal polling | Matching dev/loop route; global discovery pointer only if narrower selection demonstrably misses it. | `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:191-231`; owner map: `plugins/codexclaw/skills/dev/references/skill-ownership.md:13-15`; waiting: `plugins/codexclaw/skills/loop/SKILL.md:81`. |
| Recall/completion/status | Labeled data, bounded whole summaries, IDs and retrieval pointers; separate policy accounting. | `plugins/codexclaw/components/recall/src/hook.ts:227-235,708-737`; `plugins/codexclaw/components/bg-wake/src/hook.ts:44-54,93-106`; `plugins/codexclaw/components/provider-bridge/src/cli.ts:71-81`. |

**Host correction:** compaction recovery belongs to L1, but current PostCompact does not carry additionalContext. Recall returns empty and recovers through SessionStart(`compact`); cxc-ops queues a marker for the next root UPS; pabcd-state clears its reinjection cursor. The constitution must describe those implemented paths, not promise direct PostCompact injection (`plugins/codexclaw/components/recall/src/hook.ts:690-758`; `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:259-289`; `plugins/codexclaw/components/pabcd-state/src/hook.ts:2020-2032`).

## D5 — L2 selects, without prescribing workflow

Format: “Use for <responsibility>. <critical exclusion>. Triggers: <small bilingual set>.” No procedures/history/ID catalogs/copied safety. Preserve invocation policy; frontmatter selects, YAML displays/activates and retains routing metadata ownership. Summaries need scope coherence, not byte identity or another manual (`plugins/codexclaw/skills/dev/SKILL.md:3,165-166`; `plugins/codexclaw/skills/dev/agents/openai.yaml:1-5`; `plugins/codexclaw/skills/loop/SKILL.md:3,83-85`).

## D6 — Small complete routers, cohesive references

Proposed L3: purpose/authority→minimum contract→`condition | owner/reference | before which action`. Dev retains concise classification/safety/proof; loop owns activation/continuation; pabcd owns phase work; architecture owns boundary judgment. Move lengthy CI recipes and specialized exceptions to topic owners, preserving exact applicability (`plugins/codexclaw/skills/dev/references/skill-ownership.md:7-10,40-50`; CI detail: `plugins/codexclaw/skills/dev/SKILL.md:356-411`).

Proposed L4: applicability→prerequisites→procedure→observable pass/fail/limits→only disambiguating examples. A move is incomplete without the router edge. Do not fragment a cohesive procedure solely for size, or normalize specialist semantics to shrink common context. Architecture requires evidence before splitting; frontend/UIUX grammar is explicitly protected (`plugins/codexclaw/skills/dev-architecture/SKILL.md:55-67`; `docs/native-thin-harness.md:32-34`).

## D7 — One semantic owner, explicit pointers

Extend existing skill-ownership directory with location metadata. Runtime obligations have one predicate owner and one explanatory owner linked to implementation/proof; never another prose manual (`plugins/codexclaw/skills/dev/references/skill-ownership.md:3,52`; `structure/00_philosophy.md:46-54`).

Proposed pointers:

```text
L3/L4: Before <applicable action>, read [<topic>](<relative path>#<stable-anchor>) (<RULE-ID>).
L1:    <fact/applicability>. Owner: $codexclaw:cxc-<skill>; <reference>#<anchor> (<ID if needed>).
L5:    <ID> -> canonical file#anchor; runtime file::symbol; test/fixture.
```

Resolve Markdown from the containing skill, emitted paths from installed root/mention. Anchors/IDs are navigation; path:line is revision evidence (`plugins/codexclaw/skills/loop/SKILL.md:54-56`; `structure/10_subagent_skill_routing.md:46-51`; `plugins/codexclaw/skills/dev/SKILL.md:269-272`).

Stubs state applicability/hazard, not permissions/thresholds/exceptions. Generated projections declare `projection_of` and pay emitted budget; handwritten copies do not qualify. Split distinct obligations; use loop-WHEN/pabcd-contents/dev-exemption ownership as model (`plugins/codexclaw/skills/loop/SKILL.md:145-148`; `plugins/codexclaw/skills/pabcd/SKILL.md:100-104`).

## D8 — Budgets are tightest at widest exposure

Numbers are **editorial proposals**, not native limits/optimal tokens. Start no-growth ratchets; reviewed ceilings become project gates. Never delete safety to pass; doctrine permits size exceptions and requires context-cost evidence (`plugins/codexclaw/skills/dev/SKILL.md:69-84`; `docs/native-thin-harness.md:76-100`).

Measure normalized Unicode code points for emitted text, UTF-8 bytes for loaded files; report nonblank lines secondarily. No chars÷4 or monetary claim. Count final resolved paths/commands, all co-emitting components and child-body transport. A pinned tokenizer can later supply a separate measured token report (`plugins/codexclaw/components/pabcd-state/src/hook.ts:214-232`; `docs/native-thin-harness.md:49-52`).

| Layer | Proposed target / ceiling | Reason / evidence |
|---|---|---|
| L0 | No prompt-token allowance for mechanics; no manual hidden as “code.” No new code LOC cap or automatic guard removal. | Protect observable invariants; size alone is not a split diagnosis. `structure/00_philosophy.md:46-54`; `plugins/codexclaw/skills/dev-architecture/SKILL.md:55-67`. |
| L1 static | ≤400 chars/block; aggregate startup/resume ≤2,400; root UPS including recovery ≤1,200. Unrelated ordinary UPS target 0 static text. | Aggregate avoids multiplying per-hook allowances. Existing SessionStart has eight pushes plus optional PATH notice. `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:319-335`. |
| L1 data | Aggregate startup/resume ≤2,000 chars; recovery/UPS ≤1,200. Initially retain recall’s 1,400/800 excerpt ceilings; ≤5 completion summaries plus count/retrieval pointer. | Preserve useful recovery data; whole-record bounds. `plugins/codexclaw/components/recall/src/hook.ts:213-235`; `plugins/codexclaw/components/bg-wake/src/hook.ts:121-127`. |
| L2 | Description ≤320 chars; short summary ≤90; total projection target ≤450/skill. Freeze aggregate visible-catalog baseline; additions declare delta. Count both projections if both render. | Installed skill count is not exposure; per-skill caps miss aggregate growth. `docs/native-thin-harness.md:25-32,136-138`. |
| L3 | Dev target 8 KiB/ceiling 12; loop/pabcd each 6/8; other routers 6/10. Exclude frontmatter but report selected total. Frontend/UIUX exceptions owner-reviewed. | Full reads multiply; move detail without weakening routing or protected grammar. `plugins/codexclaw/skills/dev/SKILL.md:474-479`; `docs/native-thin-harness.md:32-34`. |
| L4 | Target ≤16 KiB/topic; review above 24. Selected reference bundle >32 KiB needs justified read plan, not automatic failure. Installed corpus has no aggregate prompt cap. | Conditional loading saves cost; fragmentation can increase navigation. `plugins/codexclaw/skills/loop/SKILL.md:54-65`. |
| L5 | Zero live context target; no test LOC cap added. New wording locks name protected interfaces; budgets/pointers need allowed/forbidden fixtures. | Repo proof is separate from turn context. `structure/40_enforcement_methods.md:29-32`; `plugins/codexclaw/skills/dev-architecture/SKILL.md:398-403`. |

Do not truncate assembled instructions to meet targets: a cut can sever a pointer. CI rejects new static overages; structured optional data shortens by whole records with retrieval pointers. Retain existing 32k context/4096 dispatch/1200 card backstops until separately proved replacements; they are safety ceilings, not prompt targets. Long resolved paths need explicit fixtures/exceptions, not mid-command truncation (`plugins/codexclaw/components/pabcd-state/src/hook.ts:212,583-596`; `plugins/codexclaw/components/subagent-config/src/fallback-dispatch-cli.ts:18-20`; `plugins/codexclaw/components/subagent-config/src/dispatch-card.ts:36-46`).

## D9 — Keep incidents in evidence, not operative instructions

Flow: incident→dated evidence→owner obligation→regression→provenance link. L1–L3 omit incident chronology/anecdotes. L4 retains only useful minimal counterexamples; archive events. Private originals stay outside checkout; devlog holds safe summary/pointer (`plugins/codexclaw/skills/dev/SKILL.md:265-268,445`).

Keep contradiction registers/devlogs as dated evidence/navigation, not routine preload or fresh capability truth. Separate current doctrine from historical narratives: routing SOT mixes historical shipped/proposed sequence; the capability matrix already labels itself historical (`structure/30_contradiction_register.md:9-17,81`; `structure/10_subagent_skill_routing.md:249-281`; `structure/60_native_capabilities.md:11-21`).

Bounded recall excerpts are the deliberate L1 exception: history **as data with provenance**, never a new universal instruction or permission. Preserve recovery usefulness and current scope precedence (`plugins/codexclaw/components/recall/src/hook.ts:708-737`; `docs/native-thin-harness.md:54-60`).

## D10 — IDs identify obligations, not sentences

IDs for cross-layer/shared, mechanically tested or audit-stable obligations; none for local examples/style/every route. Preserve namespaces/classes; IDs never upgrade authority (`plugins/codexclaw/skills/dev/SKILL.md:69-84`; existing ID-owner map: `plugins/codexclaw/skills/dev/references/skill-ownership.md:15,40-50`).

IDs survive relocation and wording changes while the obligation remains identical. Update owner/path/anchor/pointers atomically. Material splits receive child IDs+`supersedes`; changed obligations get new IDs+`replaces`; retired IDs are never reused. Prefixes survive owner renames. D1–D12 remain proposal decisions; mint PROMPT-* only for actual shared/enforced contracts. Extend owner-first/stub-check discipline rather than adding a runtime policy engine (`plugins/codexclaw/skills/dev/references/skill-ownership.md:52`; decision content: `plugins/codexclaw/skills/dev-architecture/SKILL.md:45-53`).

Proposed index fields: `id`, `class`, `canonical=file#anchor` (or `file::symbol`), optional `runtime`, `proof`, `aliases/supersedes`, `projection_of`. Repeated references are expected; repeated canonical declarations fail. The index locates the obligation and never copies its imperative body (`plugins/codexclaw/skills/dev/references/skill-ownership.md:3,52`).

## D11 — Cheap robust enforcement: deterministic gate + emission fixtures

Propose offline Node `check-prompt-architecture.mjs` under existing scripts/gate; JSON: file/line/check/owner/observed/budget. Reuse test discovery; no daemon/tokenizer/embedding/per-turn dependency (`plugins/codexclaw/scripts/gate.mjs:23-26,313-350`; `package.json:21-25`; `docs/native-thin-harness.md:119-128`).

| Check | Proposed blocking contract | Proof boundary / evidence |
|---|---|---|
| Static sizes | L2 strings, L3 bodies, L4 files; adopted ceilings or no-growth baselines. Exceptions have owner/reason/revisit trigger. | Linear offline scan; size remains distinct from safety. `plugins/codexclaw/skills/dev/SKILL.md:69-84`; ratchet precedent: `plugins/codexclaw/skills/dev-architecture/SKILL.md:400-403`. |
| Owners/IDs/pointers | Duplicate canonical IDs, unresolved local files/anchors, mention-folder mismatches, missing relocation destinations or projection origins fail. | Deterministic; does not prove a model read. `plugins/codexclaw/skills/dev/references/skill-ownership.md:3,52`; `structure/00_philosophy.md:40-54`. |
| Exact duplication | Normalize wrapping/emphasis/whitespace; hash declared normative blocks and long sentences (e.g. ≥80 chars). Block new identical canonical blocks; unclassified repeats warn. Preserve negation/numbers/code. Exclude archive/test quotations; projections still count bytes. | Cheap/robust for copy-paste, not paraphrase equivalence. Existing narrow scanner and exemptions are precedent. `plugins/codexclaw/scripts/gate.mjs:123-176`. |
| Aggregate L1 | Pure rendered fixtures: startup/resume/compact, ordinary/triggered UPS, root/child, off/on, long id/path, missing PATH, simultaneous recall/completions. Separate static/data; test no-op/dedupe. | Render actual resolved text across components. Replay cannot certify host trust/activation. `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:259-289`; `docs/native-thin-harness.md:102-106`. |
| L0 preservation | Keep allow/deny, legal/illegal edge, identity/receipt and bounded continuation tests. Moving words cannot delete a guard/change failure mode. | Behavioral assertions remain independent from prose. Existing negative tests: `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts:72-111`. |
| L5 wording discipline | Pin wire keys, marker IDs, CLI options, pointers and essential boundary messages. Check detailed procedure at its canonical owner; emitted-envelope tests protect delivery. Change phrase locks with relocation. | Current architect tests pin long procedure phrases: `plugins/codexclaw/components/pabcd-state/test/hook.test.ts:257-298`. |

Test at least one allowed and forbidden example per new gate. Checking a renderer constant or “file contains ID” is insufficient: exercise envelope delivery and owner resolution. Existing tests explicitly warn that correct un-emitted constants can survive disconnected wiring (`plugins/codexclaw/skills/dev-architecture/SKILL.md:398-403`; `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts:138-151`).

Alternatives: generated central prompts add compiler/artifact drift; snapshots freeze accidental wording; semantic embeddings/LLM checks add cost/nondeterminism/false positives. Prefer deterministic structural checks; semantic review stays opt-in/advisory, as narrow current scanning cannot prove meaning (`plugins/codexclaw/scripts/gate.mjs:16-20,123-176`).

## D12 — Migration and acceptance

Migration: inventory→owners/IDs→destinations/routes→topic+test relocation→measure→ratchet→reviewed ceilings. No savings promise before baseline; retain child transport until self-loading parity (`docs/native-thin-harness.md:25-34,49-52,136-143`).

Parent acceptance packet: before/after anchors/render fixtures; preserved permission/scope/fast paths; reachable high-risk routes; unchanged L0 predicates; no irrelevant-emission growth; compaction/root/child pointer delivery. Host activation is a separate verification when manifests change: synthetic replay cannot prove trust, and current doctrine requires doctor/retrust handling for changed identities (`plugins/codexclaw/skills/dev/SKILL.md:49-67,125-157`; `docs/native-thin-harness.md:102-106`; `structure/40_enforcement_methods.md:34-40`).

Implementation needs expanded writes to emitters, skills/references, tests and gate. Parent owns adoption; this leaf writes only its report.

## Open assumptions

| Unknown / assumption | Working treatment / evidence |
|---|---|
| Actual host catalog/body projection | Measure representative native exposure; keep file-layer and host metrics separate. Historical doctrine describes dev body as always-on; native-thin distinguishes selected bodies. `structure/40_enforcement_methods.md:88-96`; `docs/native-thin-harness.md:25-32,102-106`. |
| Numeric ceilings are uncalibrated | Start as targets/ratchets; owner-reviewed exceptions for complete procedures, long paths, protected design semantics. `docs/native-thin-harness.md:34,76-100`. |
| Similar wording may govern different constraints | Split obligations, retain domain/security checks; semantic similarity alone cannot delete a defense. `plugins/codexclaw/skills/dev-architecture/SKILL.md:363-368`; owner distinctions: `plugins/codexclaw/skills/dev/references/skill-ownership.md:20,27-29`. |
| Historical prose may be stale | Owning source settles capability claims; reconcile owner map during migration. Inspection is not doctrine-wide certification. `structure/60_native_capabilities.md:11-21`; `structure/30_contradiction_register.md:9-17`. |
| Shorter pointers may reduce compliance | Keep minimum authority boundary/current transport; test recovery and measure parity before replacement. Byte saving is not outcome proof. `docs/native-thin-harness.md:49-52,102-106`; `plugins/codexclaw/skills/loop/SKILL.md:54-65`. |

Deliverable verification: source-anchor existence, D1–D12 completeness and <25 KB report. No implementation/build/runtime tests, orchestration, goal mutation, spawn or Git writes belong to this leaf.
