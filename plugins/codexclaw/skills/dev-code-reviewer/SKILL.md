---
name: cxc-dev-code-reviewer
description: "MUST USE for code review and review-readiness — review process, quality thresholds, antipattern detection, review verdicts, and giving/receiving feedback. Activates by change-surface for PR review, diff review, pre-merge checks, refactor audits, and high-risk changes. Triggers: 'review this', 'code review', 'PR review', 'check my diff', 'before merge', 'antipattern', '리뷰', '코드 리뷰', '머지 전에 확인'."
metadata:
  last-verified: "2026-07-02"
  short-description: "Code review router: findings, severity, verdicts, and review workflow."
  keywords: ["review", "PR", "pull request", "diff", "merge", "feedback", "approve", "code quality"]
---

# Dev-Code-Reviewer — Code Review Guide

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.
> **Read the `dev` skill first** for project-wide conventions before applying review rules.

Systematic code review patterns for finding real issues, not bikeshedding.
This skill activates by change-surface for review requests, pre-merge checks, or independent audit passes.

## Review Posture (REVIEW-POSTURE-01)

Review as a skeptical, independent outsider. Executor claims, passing tests, AI summaries, and
user-facing "done" prose are untrusted until you confirm them yourself — assume the work may have
failed and look for the regression or false-confidence test that proves it. Inspect artifacts
before believing them; a green run you did not read is not evidence.

## When to Activate

- Reviewing code changes (own or others')
- Receiving code review feedback
- Assessing code quality before merge
- Evaluating pull requests or diffs
- Pre-refactoring quality baseline check

---
## Modular References

| File | When to Read | What It Covers |
|------|-------------|----------------|
| `references/tech-debt.md` | Tech debt inventory or paydown | Debt quadrant, inventory template, review integration, paydown budget |
| `references/ai-assisted-review.md` | Using AI review tools in PR workflow | AI review workflow, severity classification, re-review policy, exclusions, metrics |

## External/current review evidence

For dependency CVEs, release-note claims, package maintainer/source checks,
provider behavior, or other current/public evidence used in a review, read the
active `search` skill and follow its query-rewrite, source-fetch, and
evidence-status rules. Browser fetch/open/text/get-dom/snapshot is downstream
verification after candidate URLs exist, not a raw-query search substitute.

---

## 1. Code Review Process

### Pre-Review Checklist

Before reviewing any code, verify:

- [ ] Build passes (no compile/type errors)
- [ ] Tests pass (all green)
- [ ] PR/diff description explains **what** changed and **why**
- [ ] Diff is reasonable size (<500 changed lines — split larger PRs)

### Automated Pre-Scan (Run Before Manual Review)

Before reading a single line of code, run automated tools on changed files:

Run project-native linters, type checker, and tests before reviewing.

**Pre-Scan Rules:**
1. **Critical/error findings → block review.** Don't waste human review cycles on machine-detectable problems.
2. **Warnings → note for review, don't block.** Mention in review but don't make them blocking.
3. **Tool findings go first** in review output, before manual findings.
4. **No tool available?** Skip gracefully — pre-scan is additive, not a gate.

| Tool | Catches | Misses | Key Rules |
|------|---------|--------|-----------|
| ESLint/Ruff | Style, simple bugs, import issues | Architecture, business logic | `import/no-cycle`, `no-unused-vars`, `no-floating-promises`, `complexity` |
| tsc/mypy | Type errors, null safety | Runtime behavior, performance | `strict`, `noImplicitAny`, `strictNullChecks` |
| Semgrep | Injection, auth bypass, SSRF | Complex multi-step vulnerabilities | `javascript.lang.security.audit.sqli` |
| npm audit/pip-audit | Known CVEs in deps | Zero-day, license issues | — |

**Separation of concerns:** Tools catch patterns; humans catch intent. Focus manual review on architecture, correctness, and business logic that tools cannot evaluate.

### Review Order (by impact, not preference)

1. **Architecture** — Does the approach make sense? Right layer? Right abstraction? Is this the right place for this code?
2. **Correctness** — Logic errors, edge cases, off-by-one, null/undefined handling, error paths
3. **Security** — Input validation, injection risks, auth checks, secrets exposure
4. **Performance** — N+1 queries, unbounded collections, missing indexes, unnecessary computation
5. **Maintainability** — Naming, structure, complexity, test coverage, documentation
6. **Style** — Last priority. Don't bikeshed formatting when there are real issues.

Delegation: coupling classification belongs to `dev-architecture` §3; boundary and
validation-location findings belong to `dev-architecture` §4.

### Review Mindset

- **Be specific.** "This could fail" → "This throws if `user` is null on line 42"
- **Suggest, don't demand.** Unless it's a security or correctness issue.
- **Explain why.** Not just "change X to Y" but "X causes N+1 queries because..."
- **Acknowledge good work.** If a complex problem is solved elegantly, say so briefly.

### Output Contract (REVIEW-OUTPUT-01)

Tool findings go first (Pre-Scan Rule 3); then manual findings sorted
`Critical > High > Medium > Low > Style`; then a dedicated `blocking_issues` block; verdict last.
Every finding carries a concrete `trigger`, `impact`, and `path:line` (FAMILY-CITE-01) — no
finding on a hunch. Do not file pre-existing debt unless the patch worsened it. When a change
introduces a value/type/message crossing a module boundary, trace the consumer side before
declaring it correct, rather than reviewing the emitting hunk alone.

### Regression & false-confidence tests (REVIEW-REGRESS-01)

Run a dedicated pass: what previously-working behavior can now break, and do the tests cover that
surface? Flag deletion-only "fixes", tautological tests, tests that merely mirror the
implementation, and scope-drift abstractions added beyond the request.

---

## 2. Quality Thresholds

Flag these during review:

| Issue | Threshold | Severity |
|-------|-----------|----------|
| Long function | >50 lines | Medium |
| Large file | >400 lines | Medium; apply `dev-architecture` §1 canonical split rule |
| God class | >20 methods | High |
| Too many parameters | >5 | Medium |
| Deep nesting | >4 levels | Medium |
| High cyclomatic complexity | >10 branches | High |
| Missing error handling | any unhandled async | High |
| Hardcoded secrets | API keys, passwords in source | **Critical** |
| SQL injection | string concatenation in queries | **Critical** |
| Debug statements | console.log, debugger left in | Low |
| TODO/FIXME | unresolved in production code | Low |
| TypeScript `any` | bypassing type safety | Medium |

### File Size Guidance

Canonical rule imported from `dev-architecture` §1: **>400 LOC -> split (DEFAULT)**.

| Range | Interpretation |
|-------|---------------|
| 200-400 lines | Healthy — easy to navigate and review |
| 400-500 lines | Should split unless the author states a concrete reason |
| >500 lines | Blocking review finding unless already being split in this diff |

### Review Verdict

| Indicator | Verdict | Action |
|-----------|---------|--------|
| No high/critical issues | ✅ Approve | Merge |
| Only Medium/Low/Style issues | 🔧 Approve with suggestions | Fix non-blocking items before/after merge |
| Any unresolved High issue | ⚠️ Request changes | Author must address before merge |
| Any Critical issue | 🚫 Block | Cannot merge until resolved |

Deterministic blocker semantics (REVIEW-BLOCK-01): any unresolved Critical or High blocks the
merge. Medium may pass only when explicitly judged non-blocking; Style never affects the verdict.

---

## 3. Common Antipatterns

### Structural

| Pattern | Symptom | Fix |
|---------|---------|-----|
| God class | One class does everything | Split by single responsibility |
| Long method | Function does 5+ distinct things | Extract named helper functions |
| Deep nesting | 4+ levels of if/for/try | Guard clauses, early returns, extraction |
| Feature envy | Method uses another object's data more than its own | Move method to the data owner |
| Shotgun surgery | One change requires edits in 10+ files | Consolidate related logic |

### Dead Code

| Pattern | Detection | Fix |
|---------|-----------|-----|
| Unreachable code after return/throw | `no-unreachable`, compiler warnings | Delete the dead branch |
| Unused imports / variables | `no-unused-vars`, `@typescript-eslint/no-unused-vars` | Remove |
| Commented-out code blocks | Manual review | Delete — use version control history |
| Unused exports | `ts-prune`, `knip`, grep for import sites | Remove export; delete if no internal use |
| Stale feature-flagged code | Check flag status in flag service | Remove dead branch and the flag check |

Dead code is a maintenance tax — remove rather than comment out.

### Logic

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Boolean blindness | `doThing(true, false, true)` | Named options object or enum |
| Stringly typed | `status === 'actve'` (typo = silent bug) | Define enum or union type |
| Magic numbers | `if (retries > 3)` | Named constant: `MAX_RETRIES = 3` |
| Primitive obsession | Passing 5 related strings around | Create a data object/type |
| Direct mutation | `user.name = 'x'`, `arr.push(y)` | Immutable: `{...obj, name: 'x'}`, `[...arr, y]` |
| Missing boundary validation | Business logic handles raw user input | Delegate placement to `dev-architecture` §4; schema/content depth to `dev-security` |

### Security

Security review items are canonical in §3.5. Use that checklist for hardcoded
secrets, injection, validation, auth, authorization, and logging findings.

### Performance

| Pattern | Symptom | Fix |
|---------|---------|-----|
| N+1 queries | Loop → query per item | Batch fetch with `WHERE IN (...)` |
| Unbounded collections | `.all()` without LIMIT | Always paginate or set max |
| Missing index | Slow repeated lookups on same column | Add database index |
| Premature optimization | Complex caching for 10 rows | Profile first, optimize second |

### Async

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Floating promise | `doAsync()` without `await` | Always `await` or handle rejection |
| Callback hell | 4+ nested callbacks | Refactor to async/await |
| Missing timeout | External call can hang forever | Set timeout on all network calls |

---

## 3.5 Security Review Quick-Check

For **every review**, scan for these OWASP-aligned red flags. Delegate to `dev-security/SKILL.md` for deep analysis.

### Must-Check (Every PR)

| Check | Red Flag | Severity |
|-------|----------|----------|
| Hardcoded secrets | `apiKey = "sk-..."`, DB URLs in source | **Critical** |
| SQL/NoSQL injection | String concatenation in queries | **Critical** |
| Missing input validation | User input passed to logic without schema check | **High** |
| Missing auth check | Endpoint accessible without authentication | **High** |
| BOLA (Broken Object Auth) | No ownership check on object access (`/users/:id` without verifying caller owns resource) | **High** |
| Secrets in logs | `console.log(req.body)` leaking tokens/passwords | **High** |

### Check When Relevant

| Check | When | Red Flag |
|-------|------|----------|
| SSRF | External URL from user input | No URL allowlist, no domain validation |
| Path traversal | File path from user input | No path sanitization, `../` not blocked |
| Mass assignment | Object spread into DB model | `Object.assign(model, req.body)` without allowlist |
| Dep vulnerabilities | New dependencies added | No `npm audit`/`pip-audit` run |
| Lockfile changes | `package-lock.json` modified | Unexpected dependency resolution changes |

> **Deep security analysis** → invoke `dev-security/SKILL.md`. This checklist catches surface-level issues during code review; `dev-security` provides OWASP Top 10 depth, ASVS checklists, and static analysis integration.

---

## 3.6 Performance Review Quick-Check

Scan every PR for these common performance pitfalls:

### Database & API

| Check | Red Flag | Fix |
|-------|----------|-----|
| N+1 queries | Loop containing DB call or API fetch | Batch with `WHERE IN (...)` or DataLoader |
| Missing pagination | `.findAll()` or `SELECT *` without LIMIT | Add cursor-based or offset pagination |
| Missing index | New WHERE/JOIN column without index | `CREATE INDEX` on filtered/joined columns |
| Unbounded query | No LIMIT on user-facing list endpoints | Always set max page size |

### Frontend-Specific

| Check | Red Flag | Fix |
|-------|----------|-----|
| Unnecessary re-renders | State updates in parent causing child re-render cascade | `React.memo`, `useMemo`, extract state down |
| Bundle size impact | New large dependency (>50KB gzipped) | Check `bundlephobia.com`, consider alternatives or lazy loading |
| Missing `key` prop | List rendering without stable keys | Use unique ID, never array index for dynamic lists |
| Unoptimized images | Large images without `next/image`, `loading="lazy"`, or srcset | Use framework image optimization |

### General

| Check | Red Flag | Fix |
|-------|----------|-----|
| Missing timeout | External HTTP call without timeout | Set timeout on all network requests |
| Sync blocking | CPU-intensive work on main thread/event loop | Offload to worker/queue |
| Memory leak | Event listeners/subscriptions without cleanup | Add cleanup in `useEffect` return / `finally` block |

---

## 4. Receiving Code Review

### The Response Pattern

When receiving review feedback:

1. **READ** — Complete feedback without reacting immediately
2. **UNDERSTAND** — Restate the technical requirement in your own words
3. **VERIFY** — Check the suggestion against codebase reality (does it apply here?)
4. **EVALUATE** — Is it technically sound for THIS codebase, not just in theory?
5. **RESPOND** — Technical acknowledgment or reasoned pushback
6. **IMPLEMENT** — One item at a time, test each change

### When to Push Back

Push back when:
- Suggestion breaks existing functionality (test it)
- Reviewer lacks full context of the current architecture
- Violates YAGNI — feature is unused (grep the codebase to verify)
- Technically incorrect for this technology stack
- Conflicts with established architectural decisions

**How:** Use technical reasoning. Reference working tests, existing code, or documented decisions. Never push back emotionally — always with evidence.

### Implementation Order (multi-item feedback)

1. **Clarify ALL unclear items FIRST** — don't implement based on partial understanding
2. Blocking issues (security, data loss, broken functionality)
3. Simple fixes (typos, missing imports, naming)
4. Complex fixes (refactoring, logic changes)
5. Test EACH fix individually. Verify no regressions after each.

### Acknowledging Feedback

```
✅ "Fixed. Changed X to use parameterized query."
✅ "Good catch — the null check was missing. Added guard on line 42."
✅ Just fix it and show the result in code.

❌ "You're absolutely right!"
❌ "Great point! Thanks for catching that!"
❌ Any performative agreement without verification
```

---

## 5. Requesting Code Review

### When to Request

| Situation | Priority |
|-----------|----------|
| Before merge to main | **Mandatory** |
| After major feature completion | **Mandatory** |
| Before large refactoring | **Mandatory** |
| After complex bug fix | Recommended |
| When stuck on approach | Recommended |
| Small config/docs changes | Skip unless impactful |

### How to Request

1. Ensure build passes and all tests are green
2. Identify the diff range (base commit → head commit)
3. Provide a summary: what was implemented, what it should do, areas to focus on
4. Keep the diff <500 lines. Split larger changes into reviewable chunks.

### Acting on Feedback

| Severity | Action |
|----------|--------|
| Critical | Fix immediately, re-request review |
| High | Fix before proceeding to next task |
| Medium | Fix before merge, can continue other work |
| Low | Note for later, apply if trivial |
| Style | Apply if trivial, otherwise defer to team conventions |

---

## 6. Subagent Review Mode

Parallelize review only when domain breadth exceeds one reviewer's context (e.g., frontend + backend + infra in a single diff, or when the diff spans too many unrelated domains for a single pass). Each subagent receives its file subset, the review process from sections 1-5, and outputs structured findings. The main agent deduplicates, normalizes severity, and presents a unified review.

### AI Tool Integration Awareness

When external AI review tools are available, coordinate — don't duplicate:

| Tool | Strengths | Use When | Agent Focus Shifts To |
|------|-----------|----------|----------------------|
| **GitHub Copilot Code Review** | Full repo context, multi-model, auto-fix PRs | PR review on GitHub | Architecture, business logic, domain correctness |
| **CodeRabbit** | 40+ linters, learnable preferences, low false-positive | Team with `.coderabbit.yml` configured | Cross-service impact, subtle logic errors |
| **Cursor Bugbot** | Diff-focused bug hunting in Cursor PR flow | Cursor-based teams | Intent, architecture, exploitability |
| **Graphite AI Reviews (Diamond)** | Stacked-PR-aware AI review | Graphite stacked workflow | Cross-stack consistency |
| **SonarQube** | Enterprise SAST, tech debt tracking, security depth | Regulated environments, existing setup | Review findings, add context tools miss |
| **Manual agent review** | Full codebase understanding, intent verification | No external tools, offline, sensitive code | Everything — full §1-5 process |

**Coordination rules:**
- If an external AI tool already reviewed the PR, **read its findings first**, then focus manual review on what tools cannot do: architectural fit, business intent, cross-system impact.
- **STRICT (REVIEW-AI-EVIDENCE-01):** AI review findings are evidence to inspect, not authority — de-duplicate, reproduce, and severity-normalize before inclusion. Published evaluation shows AI reviewers frequently miss critical vulnerabilities (SQLi/XSS/deserialization) with low-severity skew (arXiv:2509.13650, checked 2026-07-02).

### Reviewing AI-Generated Code

Run IN ADDITION to the normal process when the diff is substantially AI-generated:

| Check | AI failure mode | Action |
|-------|-----------------|--------|
| Invented APIs | Plausible-but-nonexistent methods/options | Verify unfamiliar APIs against installed-version docs |
| Hallucinated dependencies | Nonexistent package names (slopsquatting) | Verify existence/maintainer/provenance before install — gate owned by `dev-security` |
| Missing authz edges | Happy-path handlers without ownership checks | Trace new endpoints against the BOLA check |
| Shallow/mirroring tests | Tests restating the implementation | Require behavior-level assertions |
| Scope drift | Abstractions/refactors beyond the request | Flag; one logical change per PR |

**Agentic/security trigger (DEFAULT):** PRs adding MCP servers, tools, agents, RAG, persistent memory, or delegated credentials invoke `dev-security` and map risks to OWASP LLM Top 10 (2025) + Top 10 for Agentic Applications 2026.

### AI Slop Cleanup Checklist (REVIEW-SLOP-01)

When the review targets a post-implementation cleanup pass (user asks to "remove
slop", "clean AI code", "deslop"), or the reviewer catches >=3 slop items during
normal review, apply the full checklist below. Safety invariant: **lock behavior
with green tests BEFORE removing any code.** Lineage: lazycodex
`remove-ai-slops` 9-category taxonomy, adapted for single-reviewer review (no
parallel agent swarm needed). E7 discipline.

**Stylistic**
1. Obvious comments — restating code, trivial docstrings, section dividers,
   commented-out code, vague TODOs. KEEP: why-comments (business logic, edge
   cases, workarounds), ticket links, regex/algorithm explanations.
2. Over-defensive code — null checks for guaranteed values, try/except around
   non-raising code, isinstance checks for statically typed params, broad
   `except Exception`/empty `catch {}`. KEEP: validation at system boundaries,
   I/O error handling, nullable DB fields. Refactor: narrow the catch to the
   expected exception.
3. Excessive complexity — deep nesting (>3), nested ternaries, >5 params
   without struct, god functions (>50L doing many things), if/elif chains for
   type/enum discrimination (use `match/case` + exhaustive check), `object` as
   type annotation (use `Protocol`/`TypeVar`/union).

**Structural**
4. Needless abstraction — pass-through wrappers, single-use helpers, speculative
   indirection, interfaces with one implementer and no testability win.
5. Boundary violations — wrong-layer imports (UI importing DB driver), handler
   doing business logic, hidden coupling, side effects in pure-named functions.
   Delegate placement to `dev-architecture` §4.
6. Oversized modules — >250 pure LOC (excluding tests, types, imports) is a
   slop-cleanup review smell, not a split mandate; `dev-architecture` §4 owns
   the canonical >400 LOC split threshold. Flag for review; do not just rename.

**Hidden cost**
7. Performance equivalences — O(n^2) loops where O(n) exists, repeated
   computation easily cached, unbounded allocations in hot paths. Profile first
   for cold paths.
8. Scope leaks — mutable global state, singletons disguised as modules, env
   reads scattered (centralize to config boundary).

**Coverage**
9. Missing behavior tests — changed paths with no test coverage. A checklist
   alone is not safety; a passing regression test is.

---
