# wp1 — exact change plan

Dependency: wp0 roadmap lock.

Scope: only the files and changes below. Re-read against the current tree at P; amend before writing if stale. Existing audit is historical evidence and is not rewritten.

Verification: `node --test plugins/codexclaw/test/manifest-policy.test.mjs` (baseline 6/6 pass, reads skill metadata); YAML parsing over changed SKILL.md files; `git diff --check`. Semantic verification uses independent read-only scenario judgments, not prose phrase assertions.

## 1. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
Core rules applied to every coding task, regardless of surface.
`````

After:

`````text
Core rules applied to every coding task, regardless of surface.

User instructions and the actual host's safety/tool contracts take precedence over skill guidance. A diagnosis or review authorizes investigation, not fixes, installs, publishing, or account changes; a change request authorizes only its scoped implementation.
`````

## 2. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
§7.2 static analysis. C0 patches (typo, config, one-line fix) are exempt from
  numbered implementation-unit records. C1 patches record in the owning unit only
  when a unit already exists
`````

After:

`````text
§7 type/static checks when applicable. C0 changes with zero behavior impact are exempt
  from numbered implementation-unit records. C1 patches leave a short change/reason/proof
  record only when an owning unit already exists; do not create a unit just for C0/C1.
  Security, data-loss, or new-abstraction changes are not this fast path. This exception applies
`````

## 3. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
Every rule in the dev skill family carries one severity class. When a rule's class is not
marked, treat prohibitions (⛔/MUST/NEVER) as STRICT and everything else as DEFAULT.
`````

After:

`````text
Rule authority is based on purpose, not typography. Safety, correctness, permission
boundaries, and truthful verification are mandatory. File-size thresholds, naming,
module layout, implementation style, and aesthetic choices are DEFAULT or STYLE_SAMPLE,
even when an older reference calls them MUST/NEVER or assigns HIGH severity. A documented
project/user contract may make a particular constraint mandatory; cite that contract.
Explicitly requested workflows retain their phase/evidence requirements. An unclassified
rule is DEFAULT unless violating it has a concrete safety or correctness consequence.
`````

## 4. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
| Database / schema / data | `dev-data` | `dev-backend` for migrations |
`````

After:

`````text
| App database / OLTP / transactional schema | `dev-backend` | `dev-security` for access; `dev-testing` for migrations |
| Analytics / ETL / data quality / analytical backfills | `dev-data` | `dev-backend` for API integration |
`````

## 5. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
### Browse / QA Tool Routing

**STRICT (DEV-BROWSE-NATIVE-01): for ad-hoc browse and exploratory QA tasks (브라우저
열기, 페이지 확인, URL 검증, 화면 QA, 스크린샷), do NOT install Playwright, puppeteer,
or browser drivers.** Use `tool_search` for the native browser tools first — they are
stable and enabled by default (`structure/60_native_capabilities.md` §3). Intentional
Playwright E2E test suites (플레이라이트 E2E 테스트 스위트) are `dev-testing` §4's
domain and not covered by this rule.

Two scoped ladders exist — the ordering is intentional, not contradictory:

| Context | Ladder | Order (start at 1; state why when skipping) | Owner |
|---------|--------|----------------------------------------------|-------|
| Public-web proof (search, research, URL verification) | SEARCH-BROWSE-01 | 1. `agbrowse` (scripted HTTP/CDP) → 2. `browser:control-in-app-browser` → 3. `chrome:control-chrome` → 4. `computer-use:computer-use` | `cxc-search` Tier 2 |
| QA of agent-built/served surfaces | QA-TOOL-LADDER-01 | 1. `browser:control-in-app-browser` → 2. `chrome:control-chrome` → 3. `computer-use:computer-use` → 4. `agbrowse` (public-URL shape checks only) | `dev-testing` §4.6 |

> **agbrowse 실패 시:** agbrowse 명령이 실패하면(connection refused, no browser 등) `agbrowse start`부터 실행한 뒤 재시도할 것.

Full ladder protocols and rationale live in their owners above.
`````

After:

`````text
### Browse / QA Tool Routing

Canonical selection policy: [Portable browser routing](references/browser-routing.md).
Use it for public proof, authenticated research, parallel extraction, and local UI QA.
Aside is preferred when suitable and available; agbrowse is recommended, not required.
No optional browser, CLI, account, or native plugin is assumed installed on every host.
Do not install a new driver/runner merely because a request says Playwright; use the
available capability. Explicit project-owned E2E work remains `dev-testing`'s domain.
`````

## 6. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
**Hard limits (DEFAULT — exceed only with a stated reason):**
`````

After:

`````text
**Review signals (DEFAULT — exceed with a stated responsibility/risk rationale):**
`````

## 7. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
- Use ES Module (`import`/`export`) in JS/TS projects — CommonJS `require()` breaks tree-shaking and static analysis.
`````

After:

`````text
- Prefer ESM for new JS/TS code when the runtime and repository support it. Preserve required CommonJS configuration/package interfaces; interop and bundler optimization are separate checks, not reasons for a blanket migration.
`````

## 8. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
| C0/C1 | Smallest proof for the change (build/type-check or the one relevant test) |
`````

After:

`````text
| C0/C1 | Smallest relevant proof; text/docs edits use consistency checks, behavior edits use the focused test or checker |
`````

## 9. MODIFY plugins/codexclaw/skills/dev/SKILL.md

Before:

`````text
- **Preserve existing exports** — other modules may depend on them. Deprecate first if removal is needed.
`````

After:

`````text
- **Preserve public contracts** — trace external consumers before removing exports. Internal unused exports may be removed within scope after consumer search; public removals need a compatibility/migration decision.
`````

## 10. NEW plugins/codexclaw/skills/dev/references/browser-routing.md

After:

`````text
# Portable browser routing

Canonical owner for dev-family browser selection. This is guidance, not a browser
installer or a guarantee that a tool exists. Read the live tool schema or installed
CLI's documentation before invoking it. A missing optional tool is normal.

## Selection

| Need | Preferred usable capability | Fallback |
|---|---|---|
| Public static source | Hosted search for URL discovery, then HTTP source-open; agbrowse fetch when installed | Host fetch/open or another available source reader |
| Many independent public pages | agbrowse HTTP or CDP extraction with independent task-owned tabs | Bounded native-tab or serial reads |
| Signed-in / judgment-heavy browsing | Aside when installed, running, permitted, and appropriate to the task | Native signed-in browser or agbrowse session that actually has the required access |
| Local UI / interactive QA | Suitable available Aside or native browser; agbrowse is also valid for built-UI driving | Another available browser capability preserving the required render/action/evidence features |
| Desktop / browser-chrome-only UI | Available native computer-use capability | Report the specific capability gap |
| Maintained E2E regression | Repository-owned test runner and fixtures | Report unavailable test prerequisites; exploratory QA is not a replacement |

Aside preference never means a required dependency. Its platform support and account
state must be detected, not inferred from an OS name. Do not copy a personal skill path,
account root, model, or permission preset into distributed defaults. Follow the exposed
Aside integration skill/CLI docs when available; do not claim a private skill is bundled.

agbrowse is recommended, not required. Its package installation is separate from
Node and a compatible browser. Check installed-version requirements; when necessary,
offer the official installation instructions without modifying a project's dependencies.
No available equivalent and no authorized installation path -> report the missing
capability and required human action. Never lower the evidence standard to report PASS.

## Session and parallel-work boundaries

- Inspect -> act -> re-inspect. Read screenshots you cite; verify the promised interaction.
- Each parallel lane owns explicit tabs/targets. Separate profile/port/context where
  necessary; do not race a shared active-tab cursor, overwrite another lane's references,
  or stop a browser/profile another task owns.
- Never assume cookies or permissions transfer between Aside, native Chrome, and agbrowse.
  Do not export credentials to make a fallback work. Reconfirm the actual account/access.
- Before retrying a side-effecting action or switching tools after a timeout, inspect
  whether the action already happened. No duplicate messages, purchases, or submissions.
- A tool's ok/verdict/title is not proof of the requested content. RSS, navigation shells,
  metadata, wrong accounts, and truncated content can require another reader or rendering.
- Start/retry a CDP session only after diagnosing a connection failure and checking
  ownership. Do not start Chrome to repair an unrelated HTTP/auth/content error.
- Missing native plugins on Windows, CLI, or restricted hosts is not a product failure.
  Record the selected fallback; claim platform support only to the extent actually tested.
`````

## 11. MODIFY plugins/codexclaw/skills/search/SKILL.md

Before:

`````text
### Tier 2 — Browse-Use Ladder (proof, default) (SEARCH-BROWSE-01)
Open candidate URLs and read the real source, escalating through the ladder below —
each rung is a NAMED live tool (`structure/60_native_capabilities.md`), not a vague
"browser use" phrase. Stop at the first rung that yields primary evidence.

**agbrowse is the PRIMARY Tier-2 surface.** Resolve it ONCE per session with
`scripts/agbrowse_helper.py doctor`; while it resolves, rungs 1-2 own proof and the
native tools are the FALLBACK tier (rung 3) — do not reach for a native browser tool
when a resolvable agbrowse rung can do the job.

1. Scripted HTTP proof — `agbrowse fetch "<url>" --json --browser never` returns an
   ok/verdict/source/finalUrl/content/evidence envelope; `agbrowse search --verify
   "<url>" --json --browser never` gives a compact verdict on a KNOWN url. The JSON
   envelope IS the evidence artifact. Mandatory first attempt when agbrowse resolves.
2. agbrowse CDP (render / interact, still primary): one-shot render-read
   `agbrowse fetch "<url>" --json --browser auto` for JS-rendered/blocked pages; a full
   interactive session when steps must act on the page — `agbrowse start --headed` ->
   `agbrowse navigate "<url>"` -> `agbrowse snapshot --interactive` (element refs
   e1, e2, ...) -> `agbrowse click e1` / act -> re-snapshot -> `agbrowse stop`.
   `agbrowse doctor` diagnoses CDP/start/profile failures. Local Chrome CDP only;
   remote/hosted CDP is out.
   **If an agbrowse command fails (connection refused, no browser, etc.), run
   `agbrowse start` first to launch the local Chrome session, then retry.**
3. Native fallback tier — use ONLY when agbrowse is unresolvable, its CDP session
   cannot complete the flow, or conversational control genuinely fits better:
   `browser:control-in-app-browser` (Codex-owned browser: JS/PDF/visual checks, local
   dev servers) and `chrome:control-chrome` (conversational real-profile CDP via
   `browser_use_full_cdp_access` for logged-in/WAF/DevTools-grade needs). State WHY
   agbrowse was insufficient when you drop to this rung.
4. GUI last resort — `computer-use:computer-use`: only for browser chrome or OS UI
   no browser tool can reach (per-app approval applies; never drive terminals).

**Verification loop (SEARCH-BROWSE-VERIFY-01, cli-jaw CDP doctrine ported):** for any
interactive rung, verify state before and after acting — inspect -> act -> re-inspect
(in agbrowse terms: `snapshot --interactive` -> `click eN` -> re-snapshot). When DOM
inspection fails or the target is canvas/WebGL/shadow-DOM, fall back to screenshot +
`view_image`, then pointer-level interaction via `computer-use:computer-use`. Never
chain blind actions; never use `curl`/`wget` hand-rolling when a ladder rung applies.

Either way confirm date, author/source identity, the exact claim, and whether
the page is primary evidence. When a source is blocked, JS-rendered, PDF-only, or table-only,
apply the tactics in `references/blocked-url-reader.md` — that helper is Tier 2 guidance,
**not** a fourth tier.

Do **not** use plain `agbrowse search "<query>"` as discovery: without `--stdin-results` it
fabricates candidate URLs. Discovery stays Tier 1 (hosted `web_search`); `agbrowse` is a
proof-of-a-known-url helper only.

**Tier 2 proof rules (SEARCH-PROOF-01):** for time-sensitive or public claims, record the exact
date and source type, and whether the claim is corroborated by a second independent source.
Prefer official docs / announcements / specs before reporting a settled answer. When sources
conflict, state which source wins and why rather than averaging them.
`````

After:

`````text
### Tier 2 — Source-open proof (SEARCH-BROWSE-01)

Use the shared [portable browser routing](../dev/references/browser-routing.md).
For public pages, prefer HTTP proof with a usable source reader. If agbrowse resolves
via `scripts/agbrowse_helper.py doctor`, `agbrowse fetch "<url>" --json --browser never`
is the recommended first attempt, not a prerequisite for all users.

For JS-rendered or inaccessible content, select a suitable available browser. Prefer
Aside for existing authenticated or judgment-heavy flows; use agbrowse for independent
parallel extraction; available native browsers are valid alternatives. Local UI QA is
not prohibited on agbrowse. Read current CLI/tool docs rather than assuming tool names,
flags, schemas, platform support, or account access.

**SEARCH-PROOF-01:** Read the requested claim in the actual source. Confirm URL, source
identity, relevant date (or state it is absent), and whether corroboration exists.
An `ok` envelope, matching title, RSS feed, snippet, or navigation shell is not enough.
Use a different reader/rendering path if the actual claim is missing; mark blocked or
unverified when no path proves it. Inspect -> act -> re-inspect (SEARCH-BROWSE-VERIFY-01).
For blocked/JS/PDF/table pages, see `references/blocked-url-reader.md`.

Do not use plain `agbrowse search "<query>"` as the evidence for discovery: feed actual
hosted search candidates via its documented input, or open known URLs. Never invent
URLs. Optional tool absence does not justify installing drivers without authorization.
Fallbacks preserve session, permission, and evidence boundaries from the shared policy.
`````

## 12. MODIFY plugins/codexclaw/skills/search/SKILL.md

Before:

`````text
- Query rewrite runs prompt-side. `agbrowse` is an OPT-IN, lazily-resolved Tier-2 proof
  helper (HTTP-first; local-CDP escalation only); it is not bundled and not required —
  without it, Tier 2 starts at rung 2 (`browser:control-in-app-browser`) and escalates
  to `chrome:control-chrome` / `computer-use:computer-use` per SEARCH-BROWSE-01.
`````

After:

`````text
- Query rewrite runs prompt-side. Optional agbrowse, Aside, native browsers, and HTTP
  readers follow the shared portable policy; no fixed tool-name ladder is guaranteed
  on every distribution or host.
`````

## 13. MODIFY plugins/codexclaw/skills/dev-testing/SKILL.md

Before:

`````text
### 4.7 Native Computer-Use / Browse-Use QA (exploratory tier) (TEST-CU-QA-01)
Browser QA loads `dev-frontend` for rendered implementation context.
Playwright owns deterministic suites; native tools own immediate exploratory proof.
**QA-TOOL-LADDER-01:** start at 1 and state why when skipping:
1. `browser:control-in-app-browser` for built or locally served web UI.
2. `chrome:control-chrome` for real profile, login, extension, or WAF state.
3. `computer-use:computer-use` for desktop or GUI-only flows; keep credentials human-supervised.
4. `agbrowse` only for public-URL response-shape proof, never built-UI driving.
Use inspect -> act -> re-inspect; use screenshots plus `view_image` when DOM inspection fails.
Evidence names the flow, states, result, and screenshots; promote durable flows to Playwright.
Load `cxc-qa` for scenario matrices, adversarial/oracle passes, evidence layout, and teardown.
`````

After:

`````text
### 4.7 Exploratory browser QA (TEST-CU-QA-01)

Browser QA loads `dev-frontend` for rendered implementation context.
Follow [portable browser routing](../dev/references/browser-routing.md)
(QA-TOOL-LADDER-01). Suitable available Aside, native browsers, and agbrowse may
drive built UI; no one optional tool is required. Inspect -> act -> re-inspect,
exercise the promised interaction, and retain the state/result evidence.
Repository-owned Playwright suites remain the deterministic regression path.
Load `cxc-qa` for scenario matrices, adversarial/oracle passes, and teardown.
Missing tool/access -> report the gap, never mark an unperformed check passed.
`````

## 14. MODIFY plugins/codexclaw/skills/dev-testing/SKILL.md

Before:

`````text
- Review/test boundary and test adequacy findings: see `dev-code-reviewer`.
`````

After:

`````text
- This skill owns test adequacy; `dev-code-reviewer` owns finding severity and review process.
`````

## 15. MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

Before:

`````text
**Unit residence (STRICT, UNIT-RESIDENCE-01):** every piece of development work
belongs to an implementation unit (`devlog/_plan/YYMMDD_slug/`). Ceremony scales
with class (PABCD Depth by Work Class below); residence does not. C0-C1 fast-path
work skips the PABCD ceremony but MUST leave a numbered record doc in its owning
unit — next free index in the matching decade, e.g. `040_hotfix_dropdown_crash.md`
— stating what changed, why the fast path applied (class call), and the
verification evidence. No owning unit → create a minimal unit folder holding only
that record. Interview settles residence before P (Interview Trigger above).
`````

After:

`````text
**Unit residence (UNIT-RESIDENCE-01):** C2+ development belongs to an existing
implementation unit or a proposed unit under the repository's established convention.
C0/C1 record exceptions are canonical in `dev` §0.1: C0 needs no devlog; C1 records
briefly only if an owning unit exists. Do not create a unit merely for that fast path.
Retain safety classification and smallest relevant verification. Interview settles
residence before P when clarification is needed, not for already-clear trivial edits.
`````

## 16. MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

Before:

`````text
| C0-C1 | None/inline | Optional | Direct fix | Smallest proof | One-line summary as a numbered record doc in the owning unit (UNIT-RESIDENCE-01) |
`````

After:

`````text
| C0-C1 | None/inline | Optional | Direct fix | Smallest proof | C0 no devlog; C1 short record only in an existing owning unit (dev §0.1) |
`````

## 17. MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

Before:

`````text
  low-persistence C3 (a response-level plan is enough — but the work still leaves its
  numbered record in a unit, UNIT-RESIDENCE-01).
`````

After:

`````text
  low-persistence C3 (a response-level plan can suffice; C0/C1 record exceptions
  follow dev §0.1, and C2+ uses the owning unit convention).
`````

## 18. MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

Before:

`````text
**Native plan tracker (PLAN-TRACK-01)**: mirror the plan's work items into the native
`update_plan` tool at P and keep statuses current through B — the harness renders it as
live progress.
`````

After:

`````text
**Native plan tracker (PLAN-TRACK-01)**: when the host exposes `update_plan`, mirror
work items there at P and keep statuses current through B. If unavailable, use the
existing devlog/goalplan and concise progress updates; do not invent a tool call.
`````

## 19. MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

Before:

`````text
Dispatch an independent reviewer (`spawn_agent`, `agent_type:"explorer"` per DISPATCH-AGENT-TYPE-01)
`````

After:

`````text
Dispatch an independent read-only reviewer using the exposed spawn schema (`agent_type:"explorer"` only when that field is supported, per DISPATCH-AGENT-TYPE-01)
`````

## 20. MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

Before:

`````text
**Lifecycle contract.** If `spawn_agent` is not visible, use `tool_search` for it before
concluding delegation is unavailable.
`````

After:

`````text
**Lifecycle contract.** Discover the actual spawn capability through the host's tool
catalog/search when available. Read its schema before calling: omit unsupported
`agent_type`, `task_name`, `items`, fork, or model fields; encode read/write scope in
the task packet. If no discovery/spawn capability exists, report that gap.
`````

## 21. MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

Before:

`````text
- **REVIEW-DECORRELATE-01:** use a different model family for the A-gate reviewer.
`````

After:

`````text
- **REVIEW-DECORRELATE-01:** prefer an independent context; use a different model family
  only when host policy and user authorization permit the override. Otherwise inherit
  and record that family-level independence was not established.
`````

## 22. MODIFY plugins/codexclaw/skills/dev-scaffolding/references/implementation-log.md

Before:

`````text
work: unit residence is universal (UNIT-RESIDENCE-01) — the full routine below is for
C2+/multi-phase work; C0-C1 leaves a numbered record doc (see the last section).
`````

After:

`````text
work: the full routine below is for C2+/multi-phase work. C0/C1 exceptions follow
`dev` §0.1: no C0 devlog, and a short C1 record only in an existing owning unit.
`````

## 23. MODIFY plugins/codexclaw/skills/dev-scaffolding/references/implementation-log.md

Before:

`````text
## Ceremony scales; residence does not
`````

After:

`````text

`````

## 24. MODIFY plugins/codexclaw/skills/dev-scaffolding/references/implementation-log.md

Before:

`````text
Every piece of work lands in an implementation unit (UNIT-RESIDENCE-01). The full
routine above (master plan + all-phase diff-level docs + doc audit) is mandatory for
C4, for any multi-phase unit regardless of class, and for C3 when state must persist
across turns/agents or contracts/architecture need a durable audit trail. C0-C1
fast-path work skips the ceremony but still leaves a numbered record doc in its
owning unit (what changed, why the fast path applied, verification evidence);
create a minimal unit folder if none exists. Over-documenting small work is process
slop — but "small" scales the ceremony down, never the record away.
`````

After:

`````text
## Class-scaled residence

The full routine applies to C4, multi-phase units, and C3 work needing durable
cross-session or contract evidence. C2+ uses the repository's unit convention.
For C0/C1, defer to `dev` §0.1: C0 has no devlog obligation; C1 leaves a short
record only in an existing owning unit. No new unit is required for either.
Record substantive findings and verification truthfully without inflating trivial work.
`````

## 25. MODIFY plugins/codexclaw/skills/dev-scaffolding/SKILL.md

Before:

`````text
The implementation-unit devlog routine (`devlog/_plan/` units — `pabcd` §Work-Phase
Loop, UNIT-RESIDENCE-01) is the DEFAULT for any repo you do development work in — a
process rule, not a named style to be requested.
`````

After:

`````text
The implementation-unit devlog routine (`devlog/_plan/` units — `pabcd` §Work-Phase
Loop, UNIT-RESIDENCE-01) is the DEFAULT for C2+ work where the repository uses it.
C0/C1 follow the record exemptions in `dev` §0.1; do not create a unit just for them.
`````

## 26. MODIFY plugins/codexclaw/skills/dev-scaffolding/SKILL.md

Before:

`````text
once `devlog/_plan/` exists, creating unit subfolders — including the minimal record unit mandated by
UNIT-RESIDENCE-01 — is routine and needs no approval dialogue.
`````

After:

`````text
once `devlog/_plan/` exists, creating a scoped C2+ unit subfolder is routine.
This does not revoke C0/C1 exemptions or authorize unrelated documentation.
`````

## 27. MODIFY plugins/codexclaw/skills/dev/references/skill-ownership.md

Before:

`````text
| Manual surface QA / evidence matrix | `cxc-qa` | `dev-testing` §4.6 (tool routing stays there) |
`````

After:

`````text
| Manual surface QA / evidence matrix | `cxc-qa` | `dev-testing` §4.7; selection in `dev/references/browser-routing.md` |
`````

## 28. MODIFY plugins/codexclaw/skills/dev/references/skill-ownership.md

Before:

`````text
| Browse / QA tool routing | `dev-testing` §4.6 (QA ladder), `cxc-search` (search ladder) | `dev` (routing summary) |
`````

After:

`````text
| Browse / QA tool routing | `dev/references/browser-routing.md` | `dev`, `dev-testing` §4.7, `search`, `dev-frontend`, `dev-diagram-viewer` |
`````

## 29. MODIFY structure/20_pabcd_dispatch_doctrine.md

Before:

`````text
- **DISPATCH-AGENT-TYPE-01 (DEFAULT).** The role-to-agent-type mapping above is the
  canonical dispatch classifier for the SubagentStop evidence gate: only
  `agent_type:"worker"` triggers the evidence-receipt gate (hook matcher `^worker$` +
  runtime `GATED_AGENT_TYPES`). Read-only audit, research, and review dispatches MUST
  use `agent_type:"explorer"` to avoid conflicting evidence-persistence directives.
`````

After:

`````text
- **DISPATCH-AGENT-TYPE-01 (DEFAULT).** Read the actual spawn schema first.
  On hosts exposing `agent_type`, use `explorer` for read-only audit/research
  and `worker` for scoped writes; that vocabulary also affects evidence hooks.
  Other hosts may omit the field entirely. There, omit unsupported arguments
  and specify read/write scope in the task packet; do not claim the host
  enforced read-only access merely because the prompt requested it.
`````

## 30. MODIFY structure/60_native_capabilities.md

Before:

`````text
# 60 — Codex Native Capability Matrix (SOT)
`````

After:

`````text
# 60 — Codex Native Capability Matrix (SOT)

## Runtime boundary (2026-09-05)

The matrix below is a historical capability inventory, not a promise that every host
exposes these tool names or arguments. Inspect the callable catalog/schema for the
current task. Optional native browser plugins, `tool_search`, `update_plan`, and
`agent_type`/fork fields may be absent. Use supported equivalents only; record any
missing capability without fabricating a successful call. Portable browser selection
is owned by `plugins/codexclaw/skills/dev/references/browser-routing.md`.
`````

## 31. MODIFY structure/00_philosophy.md

Before:

`````text
## 7. How to use this file
`````

After:

`````text
## 6.1 Distributed skill policy (2026-09-05 Interview decision)

Safety, correctness, permission boundaries, and evidence remain mandatory.
Size/style/layout preferences admit documented project-specific exceptions.
C0 changes have no devlog obligation; C1 records only in an existing owning unit.
Optional browser capabilities are selected at runtime: suitable Aside is preferred,
agbrowse supports HTTP/parallel collection without being a required dependency,
and available native tools may substitute when they preserve access and proof.
Missing tools never authorize silent installs or a lower verification standard.

## 7. How to use this file
`````

## 32. MODIFY plugins/codexclaw/skills/interview/SKILL.md

Before:

`````text
- Mind spawn shape (MIND-SPAWN-SHAPE-01): dispatch each Mind as `agent_type "explorer"`,
  `task_name mind_<mindname>`, and a NON-full-history fork (V2 `fork_turns:"none"`; V1 omits
  `fork_context`)
`````

After:

`````text
- Mind spawn shape (MIND-SPAWN-SHAPE-01): use the actual host schema. When supported,
  set `agent_type "explorer"`, `task_name mind_<mindname>`, and a non-full-history fork.
  Omit unsupported fields (V1 may expose neither agent_type nor task_name); put the
  lens identity and read-only scope in the task packet. Do not claim prompt scope is
  host-enforced access control. V2 may use `fork_turns:"none"`; V1 omits `fork_context`
`````
