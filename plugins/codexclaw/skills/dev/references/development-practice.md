# Development practice

## 0.5 Repository Convention Discovery

Before broad changes, inspect source layout, source-of-truth docs, agent instructions,
toolchain config, and sibling naming/test/module patterns. Devlogs use decade-range
numbering, never bare `PLAN.md`/`PHASES.md`/`RCA.md` (LEXICO-SPLIT-01; see `pabcd`).

Discover conventions in order: repo instructions/SoT docs → toolchain/config → owning
module → direct callers → 2-3 sibling examples.

MUST follow existing conventions when they are clear.
MUST read existing source-of-truth docs before broad implementation.
MUST NOT create docs folders, instruction files, or new tooling silently in an existing repo.

If the repo is immature, undocumented, or inconsistent, propose a lightweight source-of-truth structure and ask for approval before creating it.

### Broad Change Preview

For directory changes, 5+ files, cross-surface work, new modules/services, or new
project docs, preview current signals, a compact tree (max ~40 lines), planned
touch points, and whether existing conventions are reused or need approval.

---

## 1. Modular Development

Give every file, function, and class a single, clear responsibility.

**Hard limits (DEFAULT — exceed only with a stated reason):**

| Metric | Threshold | Action |
| ------ | --------- | ------ |
| File length | >400 lines | Split into focused modules (canonical owner: `dev-architecture` §1) |
| Function length | >50 lines | Extract helper functions |
| Class methods | >20 methods | Split by responsibility |
| Nesting depth | >4 levels | Flatten with early returns or extraction |
| Function parameters | >5 | Use an options/config object |
| PR changeset | >500 lines | Split into focused PRs |

### Blast Radius Limits

Each PR/changeset MUST be scoped to one logical change. Opportunistic rewrites, unrelated cleanup, and drive-by refactors go in separate PRs.

| Change Scope | Max Blast Radius | Exceeds → |
|---|---|---|
| Single bug fix | 1–3 files | Split fix from cleanup |
| Feature addition | 1 module/package | Separate infra from feature |
| Refactoring | Pre-approved scope only | Get scope approval first |
| Dependency upgrade | Isolated PR | Never bundle with features |

**Rules:**
- Use ES Module (`import`/`export`) in JS/TS projects — CommonJS `require()` breaks tree-shaking and static analysis.
- One default export per file when the file has a primary purpose (JS/TS convention; other languages follow their idioms).
- Follow existing naming conventions in the project. Check sibling files before creating new ones.
- New files must match the directory structure and naming patterns already in use.
- Devlog phase documents use decade-range numbering (LEXICO-SPLIT-01, `pabcd` Implementation-Unit Documents). Never use bare filenames like `PLAN.md`, `PHASES.md`, or `RCA.md`.

---

## 1.5 Necessity Gate & Pre-Write Search Obligation

**DEV-NECESSITY-01 (DEFAULT — ponytail discipline, verified 2026-07-02):** before writing
ANY code, check the no-code options in order — do nothing / delete / configure / reuse —
and state which you rejected and why. Frame tasks exclusions-first (what NOT to add)
before the goal. Never lazy about STRICT domains: trust boundaries, data loss, security,
accessibility.

**Rule:** Before creating a new function, helper, type, component, constant, route, fixture, or module, search the codebase for an existing owner or equivalent implementation. No new abstraction may be introduced without search evidence. This section does not apply on the dev SKILL.md §0.1 fast path (C0/C1 — no new abstractions are being created).

**Structure map first (DEFAULT — DEV-MAP-FIRST-01):** for C2+ work in unfamiliar territory,
run `cxc map <dir>` (repo-map skill, tree-sitter + PageRank overview) before deep `rg`
dives; then use `rg`/ast-grep to confirm the narrowed targets. Guidance, not hook-enforced.

**Read before editing (DEV-READ-FIRST-01).** Beyond new-abstraction creation, any C2+ edit to
existing code reads the target file (and its direct caller/consumer when the change crosses a
boundary) before writing. Do not propose or apply a change to code you have not read. The dev SKILL.md §0.1
fast path still applies to C0/C1.

| Artifact being created | Required searches | Preferred outcome |
|---|---|---|
| Function/helper | Exact name, verb phrase, domain noun | Extend existing helper or add next to owner |
| Type/interface/schema | Exact type name and shape fields | Reuse or extend existing contract |
| Component | UI label, route, component name, feature folder | Modify owning component |
| Constant/magic string | Literal value and semantic name | Move to existing constants/contract module |
| Test fixture/factory | Fixture factory and existing test data | Extend shared fixture factory |
| Route/API client | Endpoint path, handler name, client wrapper | Update both server and client owner |
| Config/env flag | Env var prefix and config module | Add to central config owner |

**Banned patterns:**
- Creating `utils.ts`, `helpers.ts`, or `common.ts` without owner search
- Duplicating a type because import path was not obvious
- Creating parallel API clients for the same endpoint
- "I could not find it" without showing search terms

**Search evidence required:** When code is changed, include terms searched, files inspected, reuse decision, and new-code justification in the final response.

## 2. Systematic Debugging

Root-cause method, instrumentation, hypothesis testing, emergency stop triggers,
and postmortems are canonical in `dev-debugging/SKILL.md`. Reproduce and isolate
before editing for any non-obvious defect. Load `dev-debugging` for runtime failures,
unclear causality, or after 2 failed repair attempts.

**Repeated-friction rule (DEV-FRICTION-01, DEFAULT).** When the same shell command
class fails twice with the same normalized error, do not retry a third time
unchanged: switch approach (different tool, different flags, or root-cause the
environment). Repeated identical failures are friction evidence, not bad luck.

**Repeated-edit-shape rule (DEV-EDIT-SHAPE-01, DEFAULT).** Three same-shaped edits
in a row (same structural transform on different sites) mean you are hand-running
a codemod: stop and switch to `$cxc-ast-grep` (or a scripted rewrite) so the
remaining sites are transformed deterministically.
