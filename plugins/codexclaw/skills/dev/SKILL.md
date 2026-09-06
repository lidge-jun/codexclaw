---
name: cxc-dev
description: "MUST USE for coding, PR creation/review/merge, dependent branches, scaffolding, and QA. Classify C0-C5, preserve safety and fresh proof, and load the matching surface owner. Triggers: develop, fix, refactor, test, review, docs, browse, QA, stacked PR, 개발, 수정, 검토, 스택 PR."
metadata:
  last-verified: "2026-07-02"
  short-description: "Universal dev discipline: work classifier, modular limits, verification gate, safety rules."
  keywords: ["develop", "implement", "refactor", "feature", "code quality", "verification", "browse", "browser", "QA", "agbrowse", "stacked PR", "stacked pull request", "stacked diff", "PR stack", "restack", "브라우저", "페이지 확인", "화면 QA", "플레이라이트", "스택 PR", "PR 쪼개기"]
---

# Dev — Common Development Guidelines

Core rules applied to every coding task, regardless of surface.

User instructions and the actual host's safety/tool contracts take precedence over skill guidance. A diagnosis or review authorizes investigation, not fixes, installs, publishing, or account changes; a change request authorizes only its scoped implementation.

## §0.0 Work Classifier (C0-C5)

**Classify every task before choosing process depth** (DEV-CLASS-01). The class selects how much
planning, reading, and verification the task deserves — never apply maximum process by default.

| Class | Name | Signals | Default Process |
|-------|------|---------|-----------------|
| C0 | Trivial Text | Typo, comment, copy, log string — zero behavior change | Direct fix + smallest proof (§0.1) |
| C1 | Single-File Local | One file, local behavior, no new abstractions | Fast path (§0.1) + targeted check |
| C2 | Ordinary Product Slice | Conventional endpoint, form, table, model, list/detail screen, integration touchpoint | Compact plan + adjacent convention search + focused tests + micro-audit |
| C3 | Cross-Domain Feature/Refactor | Multiple modules, public API, shared types, broad behavior | Compact or full PABCD depending on persistence/risk; add subagent audit when scope or risk warrants |
| C4 | High-Risk | Auth, payments, data deletion, migration, release, permission model, security boundary | Full PABCD (mandatory) + full relevant gates + durable risk/evidence record |
| C5 | Research/Ambiguous | Unclear requirements, ambiguous user value, unknown territory after one §0 clarification round | Interview-first via the `pabcd` skill, then reclassify |

**C5 is temporary** — it cannot enter implementation until Interview resolves ambiguity
and the task is reclassified C0-C4.

**Tie-break (DEFAULT):** when signals match two classes, the higher class wins. A
conventional route→service→storage slice still counts as C2 even though it spans files;
C3's "multiple modules" means crossing a module/package boundary beyond that conventional slice.

**C4-promotion triggers override any fast path** (DEV-ESCALATE-01): security, data
deletion/migration, destructive ops, public contract change, release surface, permission
model, new dependency/framework. Any of these promotes the **affected part** of the task
to C4-level care — split it out rather than inflating the whole slice. Promotion alone
does not force a user question; stopping to ask is required only for rules individually
classed **ESCALATE** (§0.2).

## §0.1 Patch Fast-Path (C0/C1)

For **C0/C1 work** (bounded by "one file, no new abstractions, local behavior" — a ≤5-line
in-place edit is an example, not a limit):
- Skip: §0.5 convention discovery, §1.5 pre-write search, reference file reading
- Keep: §3 verification gate, §4 change documentation, §5 safety rules (imports/exports),
  §7 type/static checks when applicable. C0 changes with zero behavior impact are exempt
  from numbered implementation-unit records. C1 patches leave a short change/reason/proof
  record only when an owning unit already exists; do not create a unit just for C0/C1.
  Security, data-loss, or new-abstraction changes are not this fast path. This exception applies (UNIT-RESIDENCE-01, `pabcd` Implementation-Unit Documents).
- Role skills: read only the `SKILL.md` routing table — skip references unless the table explicitly routes to one

This is scope guidance, not an exemption. Conventions visible in the touched file still
apply even when proactive discovery is skipped. Promotion is **behavioral**, not
territorial: a patch escalates when it can alter the behavior of an auth/payment/deletion
or other DEV-ESCALATE-01 path — not merely because the file lives in such an area. A
zero-behavior edit (comment, typo, log string) inside an auth file stays C0; any edit
touching the executed logic of such a path is not C0/C1 — reclassify and read the
relevant reference.

## §0.2 Rule Classes

Rule authority is based on purpose, not typography. Safety, correctness, permission
boundaries, and truthful verification are mandatory. File-size thresholds, naming,
module layout, implementation style, and aesthetic choices are DEFAULT or STYLE_SAMPLE,
even when an older reference calls them MUST/NEVER or assigns HIGH severity. A documented
project/user contract may make a particular constraint mandatory; cite that contract.
Explicitly requested workflows retain their phase/evidence requirements. An unclassified
rule is DEFAULT unless violating it has a concrete safety or correctness consequence.

- **STRICT** — always applies; violating it blocks completion (safety, broken builds, secrets).
- **DEFAULT** — apply unless a documented, stated reason says otherwise.
- **HEURISTIC** — judgment guide; deviation needs no justification, just awareness.
- **STYLE_SAMPLE** — illustrative example or preset only. Examples illustrate acceptable
  choices but MUST NOT become universal requirements (DEV-STYLE-SAMPLE-01).
- **ESCALATE** — stop and ask the user before proceeding.

## §0.3 Methodology Overlays

For PR creation/review/merge or dependent work-phase delivery, read
[stacked PRs](references/stacked-prs.md) (DEV-STACK-06/07), even without a DevOps
trigger. Verify native membership and CI separately; a body map or parent base
is not registration. Generic CSS/runtime stacks are not PR-stack signals.

Methodologies are conditional, not universal. For an explicit method, repo
requirement, or a matching strict trigger, read
[Methodology overlays](references/methodology-overlays.md).
The surface table below remains mandatory before writing in that surface.
C2 conventional product slices also select
[CRUD product development](references/product/crud-product-development.md).
Read selected references only; do not preload every overlay's owners.

## §0.4 Workflow Modes

The same rules flex by execution mode — know which one you are in:
ordinary chat (direct work, C0-C2 typical) · PABCD mode (`pabcd` skill) ·
goal mode (`create_goal`, evidence-backed checkpoints) · subagent
(scoped writes when explicitly delegated) · read-only review (no mutation,
findings only) · docs-only work (no code gates, docs consistency checks instead).

PABCD, goal, divergence, and repeated work-phase mechanics are canonical in
`pabcd` and `cxc-loop`. Load those skills when the selected process requires
them; classify each work-phase independently.
Multi-cycle loops (2+ work-phases) enter docs-first: the first work-phase is a
docs-only PABCD that locks the diff-level roadmap before any implementation cycle
(LOOP-DOCS-FIRST-01, `cxc-loop`).

**Production surface (shared definition):** a surface is production when it is deployed
for real users beyond the author; prototypes, spikes, and internal demos are not. Skills
that scope rules to production-surface concerns (for example `dev-backend` observability
or `dev-frontend` production checklists) condition on this definition.

## Companion Skills

This skill covers universal guidelines. **STRICT (DEV-ROUTE-01): you MUST read the
matching `dev-*` router `SKILL.md` before writing code in that surface.** Routing is not
optional discovery — for any change whose surface appears below, reading that router's
`SKILL.md` (its routing table; references only when the change needs that depth) is a
precondition for writing code there. Skipping it is a STRICT violation (dev §0.2), the
same severity as a broken build. When a change spans multiple surfaces, read each
matching router first.

For required full-file reads, bound batches by both the nested read tool's output
budget and the enclosing code-mode output budget. A truncated result is incomplete:
read the missing portions before the governed action. A successful command exit
does not prove that all instructions reached the model. Keep the C0/C1 scope
exceptions; this is not a request to load every linked reference.

If a selected file's output is truncated, re-read that file separately. Do not
guess missing ranges from an elision marker. If it cannot fit one result, use
numbered, contiguous, non-overlapping chunks through EOF and verify no gaps.
Keep both nested and outer output budgets large enough for each returned chunk.

| Change surface | Primary router | Also load |
|---------------|----------------|-----------|
| Backend / API / server | `dev-backend` | `dev-security` for auth/input |
| Frontend / UI / web | `dev-frontend` | `dev-uiux-design` for vague/open visual direction, UX-state meaning, IA, brand, concept gen |
| App database / OLTP / transactional schema | `dev-backend` | `dev-security` for access; `dev-testing` for migrations |
| Analytics / ETL / data quality / analytical backfills | `dev-data` | `dev-backend` for API integration |
| Tests / QA | `dev-testing` | `dev-frontend` for browser QA |
| Security / auth / secrets | `dev-security` | surface-specific router |
| Architecture / modules / deps | `dev-architecture` | `dev-scaffolding` for new structure |
| Debugging / crashes / perf | `dev-debugging` | surface-specific router |
| DevOps / deploy / infra | `dev-devops` | `dev-security` for credentials |
| Scaffolding / docs / setup | `dev-scaffolding` | `dev-architecture` for boundaries |
| Code review | `dev-code-reviewer` | `dev-security` + `dev-testing` |
| Diagrams / charts | `dev-diagram-viewer` | — |

### Subagent Skill Injection (DEV-SKILL-INJECT-01)
Attach `cxc-dev` and every relevant surface skill explicitly to governed subagents.
Prefer resolvable skill links; use plugin-native mentions or v1 `items` when needed.
Hooks may normalize recognized plaintext mentions but never infer omitted skills.
Attach `cxc-search` for search tasks; the same search policy binds delegated agents.

Surface-to-owner mappings live in `references/skill-ownership.md`; router trigger
metadata remains canonical in each skill's `agents/openai.yaml`.

### Capability Routing Hub

**Independent peers:** for substantive work, consider whether another existing
task owns a relevant decision, dependency, or finding. When that can affect either
task, read [peer collaboration](references/peer-collaboration.md): discover and
read selectively, consult or notify only for a concrete reason, and preserve each
task's user authority. No mandatory lookup for trivial work or per-turn polling.
Use `dev` plus repo tools for local facts; load `search`, `pabcd`, `loop`, `recall`,
`cxc-qa`, or the matching `dev-*` owner for their named domains. `skill-hub` is deprecated.

### Browse / QA Tool Routing

Canonical selection policy: [Portable browser routing](references/browser-routing.md).
Use it for public proof, authenticated research, parallel extraction, and local UI QA.
Aside is preferred when suitable and available; agbrowse is recommended, not required.
No optional browser, CLI, account, or native plugin is assumed installed on every host.
Do not install a new driver/runner merely because a request says Playwright; use the
available capability. Explicit project-owned E2E work remains `dev-testing`'s domain.

### Skill Ownership Map
Canonical rule ownership and stub locations live in `references/skill-ownership.md`.
Update the canonical owner first and keep stubs as pointers; multi-domain tasks load
every relevant owner skill before work begins.

---

## Family Invariants (apply to every `cxc-*` skill)

> **Role boundary (canonical — identical in `dev-frontend` and `dev-uiux-design`):**
> `dev` owns universal process, evidence, and safety rules. `dev-uiux-design` owns
> design intent, direction, and concept judgment. `dev-frontend` owns concrete frontend
> implementation and rendered tell enforcement. Anti-slop has three layers: `dev` =
> output/process hygiene (FAMILY-SLOP-01), `dev-uiux-design` = concept/taste judgment
> (is this direction generic or domain-wrong?), `dev-frontend` = rendered implementation
> tell detection and removal (FE-AI-TELL-01).

These hold for every dev-family skill and every response they govern. `dev` is the canonical
owner; other routers reference this section rather than restating it. They are agent-followed
wording (no Codex hook enforces skill text — `structure/00_philosophy.md` §1), not runtime gates.

- **Anti-slop output (FAMILY-SLOP-01).** No filler, no performative narration, no decorative
  rationale. Ship no placeholders, TODO-only deliverables, fake fallbacks, speculative wrapper
  layers, or broad defensive clutter without a named boundary reason. Code-smell catalog lives
  in §6 + `dev-code-reviewer` §3; this rule is about not emitting slop in the first place.
- **file:line evidence (FAMILY-CITE-01).** When reporting code findings, plans, reviews, or
  contradictions, cite `path:line`. Plans list exact paths + the verification command; review
  and audit findings carry `path:line`; verification claims carry the command + its output or
  artifact path. This mirrors the structure doctrine (`structure/00_philosophy.md:135-141`).
- **Completion proof (FAMILY-PROOF-01).** No completion claim without fresh proof — see the
  §3 verification gate for the long form. Every other router inherits that gate; it is not
  re-stated per skill.

---

## External Evidence and Recall Routing

| Need | Route |
|---|---|
| External library syntax or pinned-version behavior | Context7 `resolve-library-id` → `query-docs`; otherwise official docs |
| Current versions, releases, CVEs, providers, or public evidence | Load `cxc-search` and follow its evidence rules |
| HTTP-first URL proof | `agbrowse fetch <url> --json`; full ladder: `cxc-search` Tier 2 |

### Recall Lookup Scope (DEV-RECALL-01, MUST)
| Trigger | Route |
|---|---|
| Prior term/file/decision is unfamiliar or context was lost | `cxc chat search "<terms>" --days 0` and `cxc memory search "<topic>"` |
| Both searches miss | Ask the user and report what was searched; full flags: `cxc-recall` |

---

## 0. Intent Clarification

Clarify only material uncertainty; skip questions already answered by context.
During work, when `request_user_input_async` is exposed and allowed, leave useful
questions without expecting a reply or stopping progress. Continue with evidence
and authorized assumptions; incorporate answers if they arrive, and leave distinct
new questions as needed. Read [Async user questions](references/async-questions.md)
for schema, pending-answer handling and fallback. Interview keeps its existing flow.

---

## 0.5 Repository Convention Discovery

C2+ implementation first reads
[Development practice](references/development-practice.md): repository conventions,
modular limits, necessity and owner search, read-before-edit, and friction rules.
The C0/C1 fast-path in §0.1 applies. Read the source and direct callers before
proposing a change; do not invent new structure without the required approval.

## 1. Modular Development

Canonical details remain in [Development practice](references/development-practice.md).

## 1.5 Necessity Gate & Pre-Write Search Obligation

Before any new abstraction, apply DEV-NECESSITY-01 and owner search in
[Development practice](references/development-practice.md).

## 2. Systematic Debugging

For non-obvious defects or repeated failed repairs load cxc-dev-debugging.
DEV-FRICTION-01 and DEV-EDIT-SHAPE-01 remain in
[Development practice](references/development-practice.md).

---

## 3. Verification Before Completion (STRICT)

Verify every completion claim with evidence. Run the relevant command fresh, read full output, and confirm the claim matches.

**Verification gate (before any completion claim):**

1. **Identify** — What command proves this claim?
2. **Run** — Execute fresh (not cached).
3. **Read** — Full output. Check exit code. Count failures.
4. **Confirm** — Does the output actually support the claim?
5. **Report** — State the claim with evidence attached.

| Claim | Requires | Not Sufficient |
| ----- | -------- | -------------- |
| "Tests pass" | Test command output: 0 failures | Previous run, "should pass" |
| "Build succeeds" | Build command: exit 0 | "Linter passed" |
| "Bug fixed" | Original symptom verified resolved | "Code changed, assumed fixed" |
| "Feature complete" | Each requirement checked line-by-line | "Tests pass" |
| "Subagent completed" | VCS diff shows actual changes | Subagent report says "success" |
| "Regression test works" | Red-green cycle verified | Test passes once |

**Per-class verification floor (DEV-VERIFY-FLOOR-01).** The gate above is universal; the
minimum *scope* scales with the work class (§0.0). This is the floor, not a cap:

| Class | Minimum verification |
| ----- | -------------------- |
| C0/C1 | Smallest relevant proof: text consistency for C0; focused test/checker for C1, or an observed repro with stated limits when automation does not fit |
| C2 | Focused integration/contract test for the touched slice + targeted build/typecheck + UI smoke if UI changed (CRUD per-operation negatives: see `dev-testing` references/core/crud-test-matrix.md) |
| C3 | Affected suites + docs/contract consistency when a public contract changed |
| C4 | Full relevant gates + negative cases + durable evidence record |

**Subagent delegation:** When subagents report success, verify independently: check VCS diff → verify changes exist → confirm behavior.

---

## 4. Change Documentation
For C2+ work with a supplied log, add a concise factual change/reason/verification entry.
C0/C1 automatic record duties follow §0.1; merely finding a devlog or changelog does
not reinstate them. An explicit user request or a documented release-record contract
still governs its named log. Do not create an unrelated record to satisfy this section.

---

## 5. Safety Rules

- **Preserve public contracts** — trace external consumers before removing exports. Internal unused exports may be removed within scope after consumer search; public removals need a compatibility/migration decision.
- **Verify imports exist** before adding `import` statements. Confirm the target file and export are real.
- **Externalize configuration** — use config files or environment variables. Place magic strings and numbers in named constants.
- **Handle all async errors explicitly** — surface failures at a clear boundary. In JS/TS backend code, the Result pattern (`neverthrow`) may replace per-call `try/catch` when failures are surfaced at a verified boundary (see `dev-backend/SKILL.md` §3). In other cases, use `try/catch` and log with context (`console.error('[module]', error.message)`).
- **Confirm before destructive operations (ESCALATE)** — deleting files, dropping tables, resetting state, or clearing caches require explicit user approval.
- **Commit incrementally (DEV-GIT-COMMIT-01, DEFAULT)** — commit working progress as you go during implementation. Each logically complete step (passing test, wired feature, fixed bug) gets its own commit so that progress is checkpointed on disk and recoverable after compaction or failure. Do not accumulate an entire feature as uncommitted changes.
- **Push requires explicit user approval (DEV-GIT-PUSH-01, ESCALATE)** — never `git push` without the user's explicit approval in the current session. Committing locally is autonomous; pushing to a remote is an external state change that the user must authorize. If the user has not approved a push, do not push — even at D/completion. This applies equally to force-push, branch creation on remote, and tag push.
- **Stack dependent work instead of one oversized PR (DEV-STACK-01, DEFAULT)** — when a change splits into 2+ dependency-ordered parts and one PR would be too large to review, publish a bottom-up stack: each branch based on the one below, each PR's base pointing at its parent. Editing a lower layer means cascading the rebase to every layer above before pushing (`DEV-STACK-02`, STRICT). Merging a stack is bottom-up and stays user-authorized (`DEV-STACK-04`, ESCALATE). Canonical rules, depth guidance, anti-patterns, review scope, and tooling: `references/stacked-prs.md`.

---

## 6. Code Quality Signals (stub)

Anti-pattern detection (god class, long method, deep nesting, magic numbers, stringly
typed, missing boundary error handling, floating promises, copy-paste) is canonically
owned by `cxc-dev-code-reviewer` §3 — read it when writing or reviewing code.
Thresholds mirror §1 hard limits; boundary-error placement follows `cxc-dev-architecture` §4.

---

## 7. Type Safety & Static Analysis

Default to strict, explicit types in new code, use TypeScript for new JS/TS
source when the repo supports it, and run the project's configured static
analysis as part of §3 verification. Do not introduce new type/lint tooling or
convert a JS repo to TS without user approval.

Escape hatches (`any`, casts, `type: ignore`) must be narrow, explained near the
code, and verified by the strongest local checker available. Detailed language
rules, command examples, and rule mappings live in
`references/static-analysis.md`. Per-toolchain gate commands and type-annotation
rules live in `references/static-analysis-gate.md`.

---

## 8. Token Budget Awareness

When multiple skills are active, token consumption grows quickly. Always read
active `SKILL.md` files, read `references/` only when the task touches that
topic, and do not preload unrelated references (HEURISTIC). Each subagent gets
its own active-skill context, so load only what the sub-task needs.

---

## 9. Skill Discovery (DEV-SKILL-DISCOVERY-01, DEFAULT)

For uncovered capabilities, check `references/skill-catalog.md`, then run
`cxc skill search <query>` (jaw first; `--source all` adds clawhub and hermes).
Load only the needed result with `cxc skill show <id>`; its adapter preserves
`cxc-dev` authority, and built-in codexclaw skills win name conflicts.
