# AI-Assisted Code Review

Last reviewed: 2026-06-16
Applies to: GitHub Copilot code review, CodeRabbit 2025+, Sourcery 2024+
When to read: Using AI review tools in PR workflow
Canonical owner: dev-code-reviewer

AI review tools augment human reviewers — they do not replace them. Treat AI findings as triage, not verdicts.

## 1. Workflow Integration

AI review runs as a deterministic gate before human review, not alongside it:

```
PR opened
  → CI (lint + type + test)           # machine gate 1
  → AI review (Copilot / CodeRabbit)  # machine gate 2
  → Human review                      # judgment gate
  → Merge
```

| Phase | Owner | Catches | Misses |
|-------|-------|---------|--------|
| CI gates | Toolchain | Syntax, types, lint, test regression | Logic, architecture, business intent |
| AI review | AI tool | Pattern bugs, style drift, common vulns, test gaps | Novel architecture issues, domain intent, subtle security |
| Human review | Engineer/agent | Architecture, correctness, business logic, security depth | Repetitive style issues (already caught above) |

Rules:
- AI review must run after CI passes — do not waste AI cycles on code that does not compile.
- AI review output feeds into human review as pre-triage, not as final verdict.
- Human reviewer starts from AI findings, does not re-check what AI already validated.
- If AI review is unavailable or errors out, proceed with human review — AI is additive, not a gate.

## 2. Severity Classification

Not all AI findings deserve human attention:

| AI Severity | Human Action | Auto-Approve Eligible |
|-------------|-------------|----------------------|
| Critical (security, data loss) | Must address before merge | No |
| High (logic error, missing validation) | Must address before merge | No |
| Medium (naming, structure, missing test) | Review and decide | No |
| Low (style, formatting, minor improvement) | Batch or skip | Yes — if CI passes and finding is style-only |
| Suggestion (refactor opportunity) | Note for future | Yes — informational only |

Auto-approve conditions (all must be true):
- [ ] Only Low/Suggestion findings
- [ ] CI passes (lint + type + test)
- [ ] No file in security-sensitive paths (`auth/`, `payment/`, `admin/`, `middleware/`)
- [ ] Diff < 50 lines
- [ ] No new dependency added

## 3. AI-Generated Code Re-review

When AI generates code AND AI reviews it, the feedback loop creates blind spots:

| Risk | Example | Mitigation |
|------|---------|------------|
| Shared blind spot | AI generates N+1 query, AI reviewer misses same pattern | Human must review AI-generated code with extra scrutiny on performance |
| Positive bias | AI reviewer rates AI-generated code higher than human code | Treat AI-generated PRs as higher review priority, not lower |
| Pattern lock-in | Same model generates and reviews → no diversity of perspective | Use different models for generation vs review, or ensure human review |
| Test gap | AI generates code that passes AI-generated tests but misses edge cases | Human must verify test coverage includes boundary and error cases |

Rules:
- AI-generated code requires the same or stricter review standards as human code.
- When possible, use a different AI model for review than for generation.
- AI-generated test suites must be reviewed for coverage gaps — AI tests tend to test the happy path.
- Never auto-approve AI-generated code, even if AI review finds no issues.

## 4. Content Exclusion

Exclude these from AI review scope to reduce noise:

| Excluded Content | Reason |
|-----------------|--------|
| Generated files (`*.gen.ts`, `*.pb.go`, OpenAPI output) | Not human-authored, not human-reviewable |
| Vendor / `node_modules` / lock files | Managed by package manager |
| `.env.example` (but NOT `.env`) | Template only; actual secrets must never be in PR |
| Large data fixtures (> 500 lines) | AI review on test data is noise |
| Binary assets (images, fonts, compiled) | Not code |

Configure exclusion in `.coderabbit.yaml`, `.copilot-review.yml`, or equivalent:

```yaml
# .coderabbit.yaml example
reviews:
  path_filters:
    - "!**/*.gen.ts"
    - "!**/vendor/**"
    - "!**/*.lock"
    - "!**/fixtures/data/**"
```

## 5. Acceptance Metrics

Track AI review effectiveness quarterly:

| Metric | Target | Measurement |
|--------|--------|-------------|
| True positive rate | > 70% | AI findings confirmed by human reviewer / total AI findings |
| False positive rate | < 30% | AI findings dismissed by human reviewer / total AI findings |
| Coverage additive value | > 0 | Issues caught by AI that human would have missed (sample audit) |
| Review time reduction | 15-30% | Average human review time with AI vs without |
| Critical miss rate | 0% | Critical/High issues merged despite AI review (post-mortem) |

If false positive rate exceeds 40%, tune AI review rules or switch tools — noise erodes trust.

## 6. Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| AI review as sole reviewer | No human eyes on code | AI is triage, human is verdict |
| Auto-merging AI-approved PRs | Critical issues slip through | Auto-approve only for Low/Suggestion + strict conditions (§2) |
| Same model generates and reviews | Shared blind spots amplify | Different models or mandatory human review |
| Ignoring AI findings systematically | Tool becomes shelfware | Review false positive rate, tune or replace |
| AI review on generated code | Noise flood, no signal | Exclude generated files (§4) |

## Pre-flight

- [ ] AI review tool configured with correct exclusion paths (§4)
- [ ] Severity mapping matches team's merge-blocking policy (§2)
- [ ] Auto-approve conditions are explicit and enforced (§2)
- [ ] AI-generated code review policy is documented and followed (§3)
- [ ] Quarterly metrics review scheduled (§5)
- [ ] Different models used for code generation vs code review where possible
